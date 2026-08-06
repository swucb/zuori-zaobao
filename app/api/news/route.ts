import { NextResponse } from "next/server";

type Feed = { url: string; source: string; category: string };
type Story = { id:string; title:string; summary:string; context:string; category:string; source:string; url:string; publishedAt:string; score:number };

const feeds: Feed[] = [
  { url:"https://www.chinanews.com.cn/rss/importnews.xml", source:"中国新闻网", category:"政界" },
  { url:"https://www.chinanews.com.cn/rss/china.xml", source:"中国新闻网", category:"政界" },
  { url:"https://www.chinanews.com.cn/rss/world.xml", source:"中国新闻网", category:"全球" },
  { url:"https://www.chinanews.com.cn/rss/finance.xml", source:"中国新闻网", category:"行业" },
  { url:"https://www.chinadaily.com.cn/rss/china_rss.xml", source:"China Daily", category:"政界" },
  { url:"https://www.chinadaily.com.cn/rss/bizchina_rss.xml", source:"China Daily", category:"行业" },
  { url:"https://www.chinadaily.com.cn/rss/world_rss.xml", source:"China Daily", category:"全球" },
];

const noise = /明星|演员|歌手|网红|恋情|绯闻|综艺|票房|红毯|娱乐|八卦|婚礼|离婚|球赛|足球|篮球|彩票|时尚|美妆|celebrity|entertainment|movie|fashion|football|basketball/i;
const high = /中央|国务院|政策|改革|经济|金融|利率|贸易|关税|外交|冲突|战争|能源|芯片|人工智能|气候|监管|选举|就业|GDP|inflation|election|government|policy|economy|trade|tariff|war|energy|chip|artificial intelligence|climate/i;
const tech = /科技|技术|人工智能|芯片|半导体|算力|航天|科研|science|technology|AI\b|chip|semiconductor|space/i;
const knowledge = /研究|报告|发现|教育|健康|科学|考古|research|study|science|education|health/i;

function decode(value:string) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/<[^>]+>/g," ")
    .replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'")
    .replace(/\s+/g," ").trim();
}
function field(xml:string, name:string) {
  return decode(xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,"i"))?.[1] || "");
}
function classify(title:string, summary:string, fallback:string) {
  const text = `${title} ${summary}`;
  if (tech.test(text)) return "科技";
  if (knowledge.test(text)) return "知识";
  return fallback;
}
function contextFor(category:string) {
  const map:Record<string,string> = {
    政界:"值得关注的是它对公共政策、治理节奏与市场预期可能带来的后续影响。",
    全球:"这条信息有助于判断外部环境、国际关系及跨境市场的变化方向。",
    行业:"它可能影响产业链、企业决策与资源配置，后续执行细节比短期情绪更值得关注。",
    科技:"关注点不只在技术本身，也在落地速度、成本变化和监管边界。",
    知识:"这项信息提供了新的事实或认知线索，结论仍应结合原始材料与后续验证理解。",
  };
  return map[category] || "这是一条值得继续跟踪的重要信息。";
}
function parseFeed(xml:string, feed:Feed):Story[] {
  return (xml.match(/<item[\s\S]*?<\/item>/gi) || []).map((item, index) => {
    const title = field(item,"title");
    const raw = field(item,"description") || field(item,"content:encoded");
    const summary = raw.length > 260 ? `${raw.slice(0,257)}…` : raw;
    const url = field(item,"link") || field(item,"guid");
    const publishedAt = field(item,"pubDate") || new Date().toISOString();
    const category = classify(title, summary, feed.category);
    const age = Math.max(0, (Date.now() - new Date(publishedAt).getTime()) / 36e5);
    const score = Math.round(60 + (high.test(`${title} ${summary}`) ? 28 : 0) + Math.max(0, 18 - age / 2) - index * .7);
    return { id:`${feed.source}-${index}-${title.slice(0,18)}`, title, summary:summary || "原始新闻源未提供摘要，请点击查看完整报道。", context:contextFor(category), category, source:feed.source, url, publishedAt, score };
  }).filter((story) => story.title && story.url && !noise.test(`${story.title} ${story.summary}`));
}

export async function GET() {
  const responses = await Promise.allSettled(feeds.map(async (feed) => {
    const response = await fetch(feed.url, { headers:{ "User-Agent":"YesterdayBrief/1.0" }, cf:{ cacheTtl:900 } } as RequestInit & { cf:{cacheTtl:number} });
    if (!response.ok) throw new Error("feed unavailable");
    return parseFeed(await response.text(), feed);
  }));
  const all = responses.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const seen = new Set<string>();
  const unique = all.filter((story) => {
    const key = story.title.replace(/[\s，。、“”‘’：:！!？?]/g,"").slice(0,28).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  const dayKey = (date:Date) => new Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Shanghai", year:"numeric", month:"2-digit", day:"2-digit" }).format(date);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const target = dayKey(yesterday);
  const fromYesterday = unique.filter((story) => dayKey(new Date(story.publishedAt)) === target);
  const pool = fromYesterday.length >= 3 ? fromYesterday : unique;
  const stories = pool.sort((a,b) => b.score - a.score).slice(0,18);
  return NextResponse.json({ stories, editionDate:target, updatedAt:new Date().toISOString(), methodology:"公开RSS聚合、娱乐降噪、昨日筛选、时效与公共影响评分" }, { headers:{ "Cache-Control":"public, max-age=600, s-maxage=900" } });
}
