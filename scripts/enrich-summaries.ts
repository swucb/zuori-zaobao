import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { GoogleDecoder } = require("google-news-url-decoder") as { GoogleDecoder:new () => { decode:(url:string) => Promise<{status:boolean;decoded_url?:string}> } };

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
const token = process.env.ZHIPU_API_KEY || "";
const model = process.env.SUMMARY_MODEL || "glm-4.7-flash";
const minimumLongArticleLength = 900;
const requestIntervalMs = 6500;

function cleanArticleUrl(value:string) {
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|oc$|gclid$|fbclid$)/i.test(key)) url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return value;
  }
}

async function resolveOriginalUrls(stories:Story[]) {
  const wrapped = stories.filter((story) => /(^|\.)news\.google\.com$/i.test(new URL(story.url).hostname));
  if (!wrapped.length) return;
  const decoder = new GoogleDecoder();
  const concurrency = 4;
  let resolved = 0;
  for (let index = 0; index < wrapped.length; index += concurrency) {
    const group = wrapped.slice(index, index + concurrency);
    const results = await Promise.all(group.map(async (story) => {
      try {
        return await Promise.race([
          decoder.decode(story.url),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("解析超时")), 18_000)),
        ]);
      } catch {
        return { status:false };
      }
    }));
    results.forEach((result, offset) => {
      const decoded = result.status && result.decoded_url ? cleanArticleUrl(result.decoded_url) : "";
      if (decoded && !decoded.includes("news.google.com/")) {
        group[offset].url = decoded;
        resolved += 1;
      }
    });
  }
  console.log(`已逐条还原 ${resolved}/${wrapped.length} 条媒体原始链接。`);
}

function splitSentences(value:string) {
  return value
    .replace(/\n+/g, "。")
    .split(/(?<=[。！？!?；;])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 18 && sentence.length <= 240)
    .filter((sentence) => !/^(记者|编辑|来源|原标题|点击|更多|声明|本文)/.test(sentence));
}

function sourceSummary(story:Story, articleText:string) {
  const chineseShare = (articleText.match(/[\u3400-\u9fff]/g) || []).length / Math.max(articleText.length, 1);
  if (articleText.length < 100 || chineseShare < 0.25) return story.summary;

  const titleTerms = [...new Set((story.title.match(/[\u3400-\u9fff]{2,6}/g) || []).flatMap((term) =>
    term.length > 3 ? [term, ...Array.from({ length:term.length - 1 }, (_, index) => term.slice(index, index + 2))] : [term]
  ))];
  const sentences = splitSentences(articleText);
  const ranked = sentences.map((sentence, index) => {
    const titleHits = titleTerms.reduce((score, term) => score + (sentence.includes(term) ? Math.min(term.length, 4) : 0), 0);
    const facts = (sentence.match(/\d+(?:\.\d+)?%?|《[^》]+》|国务院|中央|部委|公司|表示|宣布|发布|决定|会议/g) || []).length;
    return { sentence, index, score:titleHits * 3 + facts * 2 + Math.max(0, 5 - index * 0.35) };
  });
  const picked = ranked
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .sort((a, b) => a.index - b.index)
    .map(({ sentence }) => sentence);
  if (!picked.length) return story.summary;

  let first = "";
  let second = "";
  for (const sentence of picked) {
    if ((first + sentence).length <= 190 || !first) first += sentence;
    else if ((second + sentence).length <= 180 || !second) second += sentence;
  }
  const result = [first, second].filter(Boolean).join("\n\n").slice(0, 420);
  return result.length >= 80 ? result : story.summary;
}

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

function extractReaderText(markdown:string) {
  const content = markdown.includes("Markdown Content:") ? markdown.split("Markdown Content:").slice(1).join("Markdown Content:") : markdown;
  return content
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[>*_`|]/g, " ")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 18)
    .filter((line) => !/^(Title:|URL Source:|Published Time:|Play Video|Image \d|Video \d|责任编辑|策划：|监制：|统筹：|记者：)/i.test(line))
    .join("\n")
    .slice(0, 5000);
}

async function fetchViaReader(url:string) {
  try {
    const readerUrl = `https://r.jina.ai/http://${url.replace(/^https?:\/\//, "")}`;
    const response = await fetch(readerUrl, {
      signal:AbortSignal.timeout(25000),
      headers:{ Accept:"text/plain", "User-Agent":"ZuoriZaobao/1.0" },
    });
    if (!response.ok) return "";
    return extractReaderText(await response.text());
  } catch {
    return "";
  }
}

async function fetchArticle(story:Story) {
  try {
    const response = await fetch(story.url, {
      redirect:"follow",
      signal:AbortSignal.timeout(7000),
      headers:{ "User-Agent":"Mozilla/5.0 (compatible; ZuoriZaobao/1.0; +https://swucb.github.io/zuori-zaobao/)" },
    });
    const type = response.headers.get("content-type") || "";
    if (response.ok && type.includes("text/html")) {
      const direct = extractArticleText(await response.text());
      if (direct.length >= 100) return direct;
    }
  } catch {
    // Continue with the public reader fallback below.
  }
  return fetchViaReader(story.url);
}

async function summarizeBatch(items:Array<{ story:Story; evidence:string; key:string }>) {
  const input = items.map(({ story, evidence, key }) => ({
    key,
    title:story.title,
    source:story.source,
    existing_summary:story.summary,
    article_text:evidence.slice(0, 4000),
  }));

  const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
    method:"POST",
    signal:AbortSignal.timeout(45000),
    headers:{
      Authorization:`Bearer ${token}`,
      "Content-Type":"application/json",
    },
    body:JSON.stringify({
      model,
      temperature:0.15,
      max_tokens:1400,
      thinking:{ type:"disabled" },
      response_format:{ type:"json_object" },
      messages:[
        {
          role:"system",
          content:"你是严谨的中文早报编辑。当前请求只有一篇长文。只能依据给定标题和文章正文，不得使用外部知识，不得猜测。写成两段较详细的中文摘要，共220至420个汉字：第一段完整交代事件、主体、时间、措施和关键数据；第二段提炼文章给出的背景、原因、影响或后续关注点。保留政策与机构的准确名称，删除宣传性套话；英文材料译成自然中文。任何结论都必须能在正文中找到依据。严格原样返回key，只输出JSON。",
        },
        {
          role:"user",
          content:`请返回 {"summaries":[{"key":"对应key","summary":"一至两段摘要"}]}。材料如下：\n${JSON.stringify(input)}`,
        },
      ],
    }),
  });

  if (!response.ok) throw new Error(`智谱 GLM ${response.status}: ${(await response.text()).slice(0, 180)}`);
  const payload = await response.json() as { choices?:Array<{ message?:{ content?:string } }> };
  const content = payload.choices?.[0]?.message?.content?.trim() || "";
  const parsed = JSON.parse(content.replace(/^```json\s*|\s*```$/g, "")) as { summaries?:Array<{key:string;summary:string}> };
  return parsed.summaries || [];
}

async function summarizeWithRetry(items:Array<{ story:Story; evidence:string; key:string }>) {
  let lastError:unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await summarizeBatch(items);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!/429|408|500|502|503|504|fetch failed|timeout/i.test(message) || attempt === 2) throw error;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 2500 * (attempt + 1)));
    }
  }
  throw lastError;
}

const data = JSON.parse(await readFile(newsPath, "utf8")) as { stories:Story[]; [key:string]:unknown };
data.stories.forEach((story) => { story.url = cleanArticleUrl(story.url); });
await resolveOriginalUrls(data.stories);
console.log(`正在抓取 ${data.stories.length} 篇原文…`);
const evidence = new Map<string,string>();
const longArticles:Story[] = [];
const concurrency = 12;
for (let index = 0; index < data.stories.length; index += concurrency) {
  const batch = data.stories.slice(index, index + concurrency);
  const bodies = await Promise.all(batch.map(fetchArticle));
  batch.forEach((story, offset) => {
    const body = bodies[offset] || "";
    evidence.set(story.id, body || story.summary);
    if (body.replace(/\s+/g, "").length >= minimumLongArticleLength) longArticles.push(story);
    const summary = sourceSummary(story, body);
    if (summary !== story.summary) {
      story.summary = summary;
      story.summaryMethod = "source-extractive";
    }
  });
}

let enriched = 0;
let useAi = Boolean(token);
if (!token) console.log("未提供智谱 API Key，使用原文提炼摘要。");
console.log(`识别出 ${longArticles.length}/${data.stories.length} 篇长文，仅长文调用智谱。`);
for (let index = 0; useAi && index < longArticles.length; index += 1) {
  const story = longArticles[index];
  const items = [{ story, evidence:evidence.get(story.id) || "", key:"ARTICLE" }];
  try {
    const summaries = await summarizeWithRetry(items);
    const result = summaries.find((item) => item.key === "ARTICLE");
    const summary = result?.summary?.trim() || "";
    if (summary.length >= 120 && /[\u3400-\u9fff]/.test(summary)) {
      story.summary = summary.slice(0, 900);
      story.summaryMethod = "zhipu-glm-4.7-flash";
      enriched += 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`第 ${index + 1} 篇长文 AI 摘要失败，使用原文提炼摘要：${message}`);
    if (/401|403/.test(message)) useAi = false;
  }
  if (index + 1 < longArticles.length) await new Promise((resolveDelay) => setTimeout(resolveDelay, requestIntervalMs));
}

data.summaryEnrichedAt = new Date().toISOString();
const extracted = data.stories.filter((story) => story.summaryMethod === "source-extractive").length;
data.summaryEnrichedCount = enriched + extracted;
data.summaryAiCount = enriched;
data.summarySourceCount = extracted;
await writeFile(newsPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
console.log(`已生成 ${enriched + extracted}/${data.stories.length} 条一至两段中文摘要（AI ${enriched} 条，原文提炼 ${extracted} 条）。`);
process.exit(0);
