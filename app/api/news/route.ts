import { NextResponse } from "next/server";

type Feed = { url: string; source: string; category: string; boost?: number; policyOnly?: boolean; centralOnly?: boolean };
type Story = { id:string; title:string; summary:string; context:string; category:string; source:string; url:string; publishedAt:string; score:number };

const feeds: Feed[] = [
  { url:"https://www.chinanews.com.cn/rss/importnews.xml", source:"中国新闻网", category:"政策" },
  { url:"https://www.chinanews.com.cn/rss/china.xml", source:"中国新闻网", category:"政策" },
  { url:"https://www.chinanews.com.cn/rss/world.xml", source:"中国新闻网", category:"全球" },
  { url:"https://www.chinanews.com.cn/rss/finance.xml", source:"中国新闻网", category:"行业" },
  { url:"https://www.chinadaily.com.cn/rss/china_rss.xml", source:"China Daily", category:"政策" },
  { url:"https://www.chinadaily.com.cn/rss/bizchina_rss.xml", source:"China Daily", category:"行业" },
  { url:"https://www.chinadaily.com.cn/rss/world_rss.xml", source:"China Daily", category:"全球" },
  { url:"https://www.cgtn.com/subscribe/rss/section/politics.xml", source:"CGTN", category:"政策" },
  { url:"https://www.cgtn.com/subscribe/rss/section/business.xml", source:"CGTN", category:"行业" },
  { url:"https://www.cgtn.com/subscribe/rss/section/tech-sci.xml", source:"CGTN", category:"科技" },
  { url:"https://www.cgtn.com/subscribe/rss/section/world.xml", source:"CGTN", category:"全球" },
  { url:"https://news.un.org/feed/subscribe/zh/news/all/rss.xml", source:"联合国新闻", category:"全球" },
  { url:"https://feeds.bbci.co.uk/news/world/rss.xml", source:"BBC News", category:"全球" },
  { url:"https://feeds.bbci.co.uk/news/business/rss.xml", source:"BBC News", category:"行业" },
  { url:"https://feeds.bbci.co.uk/news/technology/rss.xml", source:"BBC News", category:"科技" },
  { url:"https://www.miit.gov.cn/api-gateway/jpaas-plugins-web-server/front/rss/getinfo?webId=8d828e408d90447786ddbe128d495e9e&columnIds=d3e2bede1bc045e2875fc7161c01db7d,028da85b0dbd4c9cb96fd5f421cd32b8,e4d6c56063fa4edca257cc2e24ad473c,161ae25e72be496f93cd1c1a79f5cc2b,ca517c97303b40cf80bd668b35f6148f", source:"工业和信息化部", category:"行业", boost:22 },
  { url:"https://www.miit.gov.cn/api-gateway/jpaas-plugins-web-server/front/rss/getinfo?webId=8d828e408d90447786ddbe128d495e9e&columnIds=925fa8f4afd44e53818794ed96d9876e,30f92eeafcfd4685984dfb793a2c5fff", source:"工业和信息化部", category:"政策", boost:24 },
  { url:"https://www.miit.gov.cn/api-gateway/jpaas-plugins-web-server/front/rss/getinfo?webId=8d828e408d90447786ddbe128d495e9e&columnIds=b5946cb121b84c30b9ac608467c9df4e,ebeccdcd21bc4eeb9655a8890e87c04c,4499228ad1ed4491978d3911ec38fc60,2b57d2422a8c4f949b02fd5d0a753f2f", source:"工业和信息化部", category:"行业", boost:20 },
  { url:"https://news.google.com/rss/search?q=site%3Amost.gov.cn%20when%3A2d&hl=zh-CN&gl=CN&ceid=CN%3Azh-Hans", source:"科学技术部", category:"科技", boost:24 },
  { url:"https://news.google.com/rss/search?q=site%3Amofcom.gov.cn%20when%3A2d&hl=zh-CN&gl=CN&ceid=CN%3Azh-Hans", source:"商务部", category:"行业", boost:24 },
  { url:"https://www.pbs.org/newshour/feeds/rss/headlines", source:"PBS NewsHour", category:"全球" },
  { url:"https://www.pbs.org/newshour/feeds/rss/politics", source:"PBS NewsHour", category:"全球" },
  { url:"https://feeds.npr.org/1001/rss.xml", source:"NPR", category:"全球" },
  { url:"http://www.xinhuanet.com/politics/news_politics.xml", source:"新华网", category:"政策", boost:25, policyOnly:true },
  { url:"https://news.google.com/rss/search?q=site%3Agov.cn%20when%3A2d%20(%E6%94%BF%E7%AD%96%20OR%20%E4%BB%BB%E5%85%8D%20OR%20%E5%9B%BD%E5%8A%A1%E9%99%A2)&hl=zh-CN&gl=CN&ceid=CN%3Azh-Hans", source:"中国政府网", category:"政策", boost:28, policyOnly:true, centralOnly:true },
  { url:"https://news.google.com/rss/search?q=site%3Anews.cn%2Fpolitics%20when%3A2d&hl=zh-CN&gl=CN&ceid=CN%3Azh-Hans", source:"新华时政", category:"政策", boost:25, policyOnly:true },
  { url:"https://news.google.com/rss/search?q=site%3Apeople.com.cn%20when%3A2d%20(%E6%97%B6%E6%94%BF%20OR%20%E4%BA%BA%E4%BA%8B)&hl=zh-CN&gl=CN&ceid=CN%3Azh-Hans", source:"人民网", category:"政策", boost:24, policyOnly:true },
];

const noise = /明星|演员|歌手|网红|恋情|绯闻|综艺|票房|红毯|娱乐|八卦|婚礼|离婚|球赛|足球|篮球|彩票|时尚|美妆|企业名称.*所属地区|备案状态|政府采购|采购电子交易|招标|投标|项目申报|国务院要闻|国务院信息|地点：|celebrity|entertainment|movie|fashion|football|basketball/i;
const high = /中央|国务院|政策|改革|经济|金融|利率|贸易|关税|外交|冲突|战争|能源|芯片|人工智能|气候|监管|选举|就业|GDP|inflation|election|government|policy|economy|trade|tariff|war|energy|chip|artificial intelligence|climate/i;
const tech = /科技|技术|人工智能|芯片|半导体|算力|航天|科研|science|technology|AI\b|chip|semiconductor|space/i;
const china = /中国|中方|我国|国内|北京|中美|国务院|党中央|工信部|科技部|商务部|人民币|A股|China|Chinese|Beijing|Xi Jinping/i;
const unitedStates = /美国|美方|美联储|白宫|华盛顿|国会|特朗普|拜登|美元|美股|United States|U\.S\.|American|White House|Federal Reserve|Congress|Trump|Biden/i;
const policy = /任免|人事|干部|党委|政治局|国务院|中央|两会|政府|政策|改革|部长|主席|书记|局长|官员|获刑|落马|审查|法律|法案|条例|规定|外交|会议|部署|召开|强调|会见|主持|出席|印发|讲话|考察|决定|govern|policy|minister|official|politburo|meeting|law|regulation|diploma/i;
const centralPolicy = /中共中央|党中央|中央政治局|国务院|习近平|李强|全国人大|全国政协|国家主席|国家工作人员|任免|外交部|中央纪委|中央组织部|最高人民法院|最高人民检察院/;
const industry = /经济|企业|产业|制造|工业|投资|消费|出口|进口|贸易|金融|银行|证券|房地产|就业|市场|供应链|产量|销量|economic|economy|business|industry|manufactur|investment|consumer|export|import|trade|financial|bank|market|supply chain/i;
const systemWide = /全球|世界|国际|联合国|多边|世贸|贸易体系|供应链|金融市场|能源市场|气候变化|G20|APEC|WTO|IMF|global|world|international|United Nations|multilateral|supply chain|financial markets|climate/i;
const otherCountry = /英国|法国|德国|俄罗斯|俄总统|普京|乌克兰|伊朗|以色列|日本|韩国|印度|巴西|墨西哥|加拿大|澳大利亚|意大利|西班牙|土耳其|叙利亚|黎巴嫩|卡塔尔|沙特|朝鲜|越南|菲律宾|泰国|马来西亚|新加坡|霍尔木兹|加沙|Indonesia|Britain|UK\b|France|Germany|Russia|Ukraine|Iran|Israel|Japan|Korea|India|Brazil|Mexico|Canada|Australia|Italy|Spain|Turkey|Syria|Lebanon|Qatar|Saudi|Vietnam|Philippines|Thailand|Malaysia|Singapore|Hormuz|Gaza/i;
const chineseOfficial = /工业和信息化部|科学技术部|商务部/;
const domesticPolicySource = /^(中国新闻网|China Daily|CGTN|工业和信息化部|科学技术部|商务部|新华网|中国政府网|新华时政|人民网)$/;

function decode(value:string) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/<[^>]+>/g," ")
    .replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'")
    .replace(/\s+/g," ").trim();
}
function field(xml:string, name:string) {
  return decode(xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,"i"))?.[1] || "");
}
function classify(title:string, summary:string, feed:Feed) {
  const text = `${title} ${summary}`;
  const chinaRelated = chineseOfficial.test(feed.source) || china.test(text);
  if (domesticPolicySource.test(feed.source) && chinaRelated && policy.test(title)) return "政策";
  if (tech.test(text)) return chinaRelated ? "科技" : "全球";
  if (chinaRelated && (feed.category === "行业" || industry.test(text))) return "行业";
  return "全球";
}
function inChinaUSScope(story:Story) {
  const text = `${story.title} ${story.summary}`;
  const chinaUS = china.test(text) || unitedStates.test(text) || chineseOfficial.test(story.source);
  const domesticPolicyStory = story.category === "政策" && domesticPolicySource.test(story.source);
  if (otherCountry.test(story.title) && !china.test(story.title)) return false;
  return chinaUS || domesticPolicyStory || systemWide.test(text);
}
function contextFor(category:string) {
  const map:Record<string,string> = {
    政策:"值得关注的是它对国内政治、人事安排、公共政策与治理节奏可能带来的后续影响。",
    全球:"这条信息有助于判断外部环境、国际关系及跨境市场的变化方向。",
    行业:"它可能影响产业链、企业决策与资源配置，后续执行细节比短期情绪更值得关注。",
    科技:"关注点不只在技术本身，也在落地速度、成本变化和监管边界。",
  };
  return map[category] || "这是一条值得继续跟踪的重要信息。";
}
function parseFeed(xml:string, feed:Feed):Story[] {
  return (xml.match(/<item[\s\S]*?<\/item>/gi) || []).map((item, index) => {
    const title = field(item,"title").replace(/\s+-\s+(?:mofcom\.gov\.cn|most\.gov\.cn|gov\.cn|news\.cn|people\.com\.cn|商务部|新华网|人民网)(?:\s+-\s+(?:商务部|新华网|人民网))?\s*$/i, "");
    const raw = field(item,"description") || field(item,"content:encoded");
    const summary = raw.length > 260 ? `${raw.slice(0,257)}…` : raw;
    const url = field(item,"link") || field(item,"guid");
    const publishedAt = field(item,"pubDate") || new Date().toISOString();
    const category = classify(title, summary, feed);
    const age = Math.max(0, (Date.now() - new Date(publishedAt).getTime()) / 36e5);
    const score = Math.round(60 + (feed.boost || 0) + (high.test(`${title} ${summary}`) ? 28 : 0) + Math.max(0, 18 - age / 2) - index * .7);
    return { id:`${feed.source}-${index}-${title.slice(0,18)}`, title, summary:summary || "原始新闻源未提供摘要，请点击查看完整报道。", context:contextFor(category), category, source:feed.source, url, publishedAt, score };
  }).filter((story) => story.title && story.url && (!feed.policyOnly || story.category === "政策") && (!feed.centralOnly || centralPolicy.test(story.title)) && !noise.test(`${story.title} ${story.summary}`) && inChinaUSScope(story));
}

function needsTranslation(story:Story) {
  return !/[\u3400-\u9fff]/.test(story.title) && /[A-Za-z]{4}/.test(story.title);
}

async function translateStory(story:Story):Promise<Story | null> {
  if (!needsTranslation(story)) return story;
  const query = `${story.title}\n\n${story.summary}`;
  const endpoint = new URL("https://translate.googleapis.com/translate_a/single");
  endpoint.searchParams.set("client", "gtx");
  endpoint.searchParams.set("sl", "en");
  endpoint.searchParams.set("tl", "zh-CN");
  endpoint.searchParams.set("dt", "t");
  endpoint.searchParams.set("q", query);
  try {
    const response = await fetch(endpoint, { cf:{ cacheTtl:86400 } } as RequestInit & { cf:{cacheTtl:number} });
    if (!response.ok) return null;
    const payload = await response.json() as [Array<[string]>];
    const translated = payload[0]?.map((segment) => segment[0]).join("").trim();
    const [title, ...summaryParts] = translated.split(/\n\s*\n/);
    const summary = summaryParts.join("\n\n").trim();
    if (!title || !summary || !/[\u3400-\u9fff]/.test(`${title}${summary}`)) return null;
    return { ...story, title, summary };
  } catch {
    return null;
  }
}

async function translateStories(stories:Story[]) {
  const translated:Story[] = [];
  const batchSize = 12;
  for (let index = 0; index < stories.length; index += batchSize) {
    const batch = await Promise.all(stories.slice(index, index + batchSize).map(translateStory));
    translated.push(...batch.filter((story): story is Story => story !== null));
  }
  return translated;
}

function diversify(stories:Story[]) {
  const groups = new Map<string, Story[]>();
  for (const story of stories.sort((a,b) => b.score - a.score)) {
    const group = groups.get(story.source) || [];
    group.push(story);
    groups.set(story.source, group);
  }
  const sourceOrder = [...groups.keys()].sort((a,b) => (groups.get(b)?.[0].score || 0) - (groups.get(a)?.[0].score || 0));
  const picked:Story[] = [];
  const longestSource = Math.max(0, ...[...groups.values()].map((group) => group.length));
  for (let round = 0; round < longestSource; round++) {
    for (const source of sourceOrder) {
      const story = groups.get(source)?.[round];
      if (story) picked.push(story);
    }
  }
  return picked;
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
  const fromYesterday = unique.filter((story) => {
    const published = new Date(story.publishedAt);
    return !Number.isNaN(published.getTime()) && dayKey(published) === target;
  });
  const pool = fromYesterday.length >= 6 ? fromYesterday : unique;
  const translated = await translateStories(pool);
  const categoryOrder = ["政策", "行业", "科技", "全球"];
  const stories = categoryOrder.flatMap((category) => diversify(translated.filter((story) => story.category === category)));
  return NextResponse.json({ stories, editionDate:target, updatedAt:new Date().toISOString(), sources:[...new Set(stories.map((story) => story.source))], methodology:"公开RSS聚合、跨媒体轮排、娱乐降噪、昨日筛选与公共影响评分；不限制单一来源或总条数" }, { headers:{ "Cache-Control":"public, max-age=60, s-maxage=300, stale-while-revalidate=60" } });
}
