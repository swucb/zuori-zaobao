import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

type Story = {
  id:string;
  title:string;
  summary:string;
  source:string;
  url:string;
  [key:string]:unknown;
};

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const newsPath = resolve(root, "public-site/news.json");
const token = process.env.GH_MODELS_TOKEN || process.env.GITHUB_TOKEN || "";
const model = process.env.SUMMARY_MODEL || "openai/gpt-4.1-mini";
const batchSize = 6;
const requestIntervalMs = 4300;

function decodeHtml(value:string) {
  const entities:Record<string,string> = { amp:"&", lt:"<", gt:">", quot:'"', apos:"'", nbsp:" " };
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => entities[name.toLowerCase()] ?? match);
}

function cleanText(value:string) {
  return decodeHtml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractArticleText(html:string) {
  const body = html
    .replace(/<(nav|header|footer|aside|form)[\s\S]*?<\/\1>/gi, " ")
    .slice(0, 2_500_000);
  const paragraphs = [...body.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi)]
    .map((match) => cleanText(match[1]))
    .filter((text) => text.length >= 35)
    .filter((text) => !/版权|责任编辑|打开微信|扫码|客户端下载|隐私政策|广告|登录后|相关阅读/.test(text));
  return paragraphs.join("\n").slice(0, 2400);
}

async function fetchArticle(story:Story) {
  try {
    const response = await fetch(story.url, {
      redirect:"follow",
      signal:AbortSignal.timeout(7000),
      headers:{ "User-Agent":"Mozilla/5.0 (compatible; ZuoriZaobao/1.0; +https://swucb.github.io/zuori-zaobao/)" },
    });
    const type = response.headers.get("content-type") || "";
    if (!response.ok || !type.includes("text/html")) return "";
    return extractArticleText(await response.text());
  } catch {
    return "";
  }
}

async function summarizeBatch(items:Array<{ story:Story; evidence:string; key:string }>) {
  const input = items.map(({ story, evidence, key }) => ({
    key,
    title:story.title,
    source:story.source,
    existing_summary:story.summary,
    article_text:evidence.slice(0, 1200),
  }));

  const response = await fetch("https://models.github.ai/inference/chat/completions", {
    method:"POST",
    signal:AbortSignal.timeout(45000),
    headers:{
      Accept:"application/vnd.github+json",
      Authorization:`Bearer ${token}`,
      "X-GitHub-Api-Version":"2026-03-10",
      "Content-Type":"application/json",
    },
    body:JSON.stringify({
      model,
      temperature:0.15,
      max_tokens:2500,
      response_format:{ type:"json_object" },
      messages:[
        {
          role:"system",
          content:"你是严谨的中文早报编辑。只能依据给定标题、已有摘要和文章正文，不得使用外部知识，不得猜测。为每条新闻写一至两段中文摘要，共120至260个汉字；第一段说明发生了什么，第二段仅在材料足够时说明背景、数据或影响。保留关键主体、数字、时间和政策名称；删除宣传性套话；英文材料必须译成自然中文。若正文抓取不足，应保守改写已有摘要，不得虚构。只输出JSON。",
        },
        {
          role:"user",
          content:`请返回 {"summaries":[{"key":"对应key","summary":"一至两段摘要"}]}。材料如下：\n${JSON.stringify(input)}`,
        },
      ],
    }),
  });

  if (!response.ok) throw new Error(`GitHub Models ${response.status}: ${(await response.text()).slice(0, 180)}`);
  const payload = await response.json() as { choices?:Array<{ message?:{ content?:string } }> };
  const content = payload.choices?.[0]?.message?.content?.trim() || "";
  const parsed = JSON.parse(content.replace(/^```json\s*|\s*```$/g, "")) as { summaries?:Array<{key:string;summary:string}> };
  return parsed.summaries || [];
}

const data = JSON.parse(await readFile(newsPath, "utf8")) as { stories:Story[]; [key:string]:unknown };
if (!token) {
  console.log("未提供 GitHub Models 令牌，保留新闻源原摘要。");
  process.exit(0);
}

console.log(`正在抓取 ${data.stories.length} 篇原文…`);
const evidence = new Map<string,string>();
const concurrency = 12;
for (let index = 0; index < data.stories.length; index += concurrency) {
  const batch = data.stories.slice(index, index + concurrency);
  const bodies = await Promise.all(batch.map(fetchArticle));
  batch.forEach((story, offset) => evidence.set(story.id, bodies[offset] || story.summary));
}

let enriched = 0;
for (let index = 0; index < data.stories.length; index += batchSize) {
  const stories = data.stories.slice(index, index + batchSize);
  const items = stories.map((story, offset) => ({ story, evidence:evidence.get(story.id) || story.summary, key:String(index + offset) }));
  try {
    const summaries = await summarizeBatch(items);
    for (const result of summaries) {
      const story = data.stories[Number(result.key)];
      const summary = result.summary?.trim();
      if (story && summary && summary.length >= 60 && /[\u3400-\u9fff]/.test(summary)) {
        story.summary = summary.slice(0, 700);
        story.summaryMethod = "github-models";
        enriched += 1;
      }
    }
  } catch (error) {
    console.warn(`第 ${Math.floor(index / batchSize) + 1} 批摘要失败，保留原摘要：${error instanceof Error ? error.message : error}`);
  }
  if (index + batchSize < data.stories.length) await new Promise((resolveDelay) => setTimeout(resolveDelay, requestIntervalMs));
}

data.summaryEnrichedAt = new Date().toISOString();
data.summaryEnrichedCount = enriched;
await writeFile(newsPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
console.log(`已生成 ${enriched}/${data.stories.length} 条一至两段中文摘要。`);
