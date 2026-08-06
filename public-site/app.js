const filters = ["全部", "政治", "行业", "科技", "全球"];
const cacheKey = "zuori-zaobao-github-v1";
let stories = [];
let activeFilter = "全部";

const feed = document.querySelector("#feed");
const overlay = document.querySelector("#overlay");
const storyCount = document.querySelector("#story-count");
const readingTime = document.querySelector("#reading-time");
const editionLabel = document.querySelector("#edition-label");

function formatEdition(value) {
  const date = value ? new Date(`${value}T12:00:00+08:00`) : new Date(Date.now() - 86400000);
  return new Intl.DateTimeFormat("zh-CN", { month:"long", day:"numeric", weekday:"long", timeZone:"Asia/Shanghai" }).format(date);
}

function setMeta(editionDate) {
  storyCount.textContent = `${stories.length} 条精选`;
  readingTime.textContent = `预计阅读 ${Math.max(2, Math.ceil(stories.length * .65))} 分钟`;
  editionLabel.textContent = `THE MORNING BRIEF · ${formatEdition(editionDate)}`;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function openStory(story) {
  document.querySelector("#modal-categories").textContent = story.categories.join(" · ");
  document.querySelector("#modal-source").textContent = story.source;
  document.querySelector("#story-title").textContent = story.title;
  document.querySelector("#modal-summary").textContent = story.summary;
  document.querySelector("#source-link").href = story.url;
  overlay.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeStory() {
  overlay.hidden = true;
  document.body.style.overflow = "";
}

function render() {
  const visible = activeFilter === "全部" ? stories : stories.filter((story) => story.categories?.includes(activeFilter));
  feed.replaceChildren();
  if (!visible.length) {
    feed.append(element("div", "empty", stories.length ? "这一栏目暂时没有入选资讯。" : "正在整理今日早报…"));
    return;
  }

  visible.forEach((story, index) => {
    const article = element("article", "story");
    const button = element("button");
    button.type = "button";
    button.setAttribute("aria-label", `阅读：${story.title}`);
    button.addEventListener("click", () => openStory(story));
    button.append(element("div", "rank", String(index + 1).padStart(2, "0")));

    const body = element("div", "story-body");
    const kicker = element("div", "story-kicker");
    story.categories.forEach((category) => kicker.append(element("span", "tag", category)));
    kicker.append(element("span", "", story.source));
    body.append(kicker, element("h2", "", story.title), element("p", "", story.summary));
    const more = element("div", "read-more", "阅读摘要 ");
    more.append(element("span", "", "→"));
    body.append(more);
    button.append(body);
    article.append(button);
    feed.append(article);
  });
}

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("active", item === button));
    render();
  });
});
document.querySelector("#close").addEventListener("click", closeStory);
overlay.addEventListener("mousedown", (event) => { if (event.target === overlay) closeStory(); });
window.addEventListener("keydown", (event) => { if (event.key === "Escape") closeStory(); });

try {
  const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
  if (cached?.stories?.length && Date.now() - cached.savedAt < 72 * 3600000) {
    stories = cached.stories;
    setMeta(cached.editionDate);
    render();
  }
} catch { /* A damaged cache should never block a fresh edition. */ }

fetch(`./news.json?v=${new Date().toISOString().slice(0, 10)}`, { cache:"no-store" })
  .then((response) => response.ok ? response.json() : Promise.reject(new Error("news unavailable")))
  .then((data) => {
    if (!Array.isArray(data.stories) || !data.stories.length) return;
    const healthy = filters.slice(1).every((category) => data.stories.filter((story) => story.categories?.includes(category)).length >= 3);
    if (!healthy && stories.length) return;
    stories = data.stories;
    localStorage.setItem(cacheKey, JSON.stringify({ savedAt:Date.now(), editionDate:data.editionDate, stories }));
    setMeta(data.editionDate);
    render();
  })
  .catch(() => {
    if (!stories.length) feed.replaceChildren(element("div", "empty", "今日早报暂未生成，请稍后再来。"));
  });
