"use client";

import { useEffect, useMemo, useState } from "react";

type Story = {
  id: string;
  title: string;
  summary: string;
  context: string;
  category: string;
  categories: string[];
  source: string;
  url: string;
  publishedAt: string;
  score: number;
};

const filters = ["全部", "政治", "行业", "科技", "全球"];
const newsCacheKey = "zuori-zaobao-stories-v6";

function yesterdayLabel() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

export default function Home() {
  const [stories, setStories] = useState<Story[]>([]);
  const [filter, setFilter] = useState("全部");
  const [active, setActive] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(newsCacheKey) || "null");
      if (cached && Array.isArray(cached.stories) && cached.stories.length && Date.now() - cached.savedAt < 72 * 36e5) {
        setStories(cached.stories);
        setLoading(false);
      }
    } catch {
      // Ignore a damaged local cache and fetch a fresh edition.
    }

    fetch("/api/news?v=multi-sections-20260806-2")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        if (Array.isArray(data.stories) && data.stories.length) {
          setStories((cachedStories) => {
            const categories = ["政治", "行业", "科技", "全球"];
            const merged = categories.flatMap((category) => {
              const fresh = data.stories.filter((story:Story) => story.categories?.includes(category));
              const cached = cachedStories.filter((story) => story.categories?.includes(category));
              const healthy = fresh.length >= Math.max(3, Math.ceil(cached.length * .5));
              return healthy || !cached.length ? fresh : cached;
            });
            const uniqueMerged = merged.filter((story, index, items) => items.findIndex((candidate) => candidate.id === story.id) === index);
            if (uniqueMerged.length) {
              localStorage.setItem(newsCacheKey, JSON.stringify({ savedAt:Date.now(), editionDate:data.editionDate, stories:uniqueMerged }));
            }
            return uniqueMerged;
          });
        }
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!active) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setActive(null);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [active]);

  const visible = useMemo(
    () => (filter === "全部" ? stories : stories.filter((story) => story.categories?.includes(filter))),
    [filter, stories],
  );

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="昨日早报首页">
          昨日<span>早报</span>
        </a>
        <div className="status"><i /> 每日 07:30 更新</div>
      </header>

      <section className="intro" id="top">
        <p className="eyebrow">THE MORNING BRIEF · {yesterdayLabel()}</p>
        <h1>昨天，<br />真正重要的事。</h1>
        <p className="dek">替你读完公开新闻源。先看中国政治，再看中国行业与科技，最后掌握中美及全球大势。</p>
        <div className="meta-row">
          <span>{loading ? "正在汇总…" : `${stories.length} 条精选`}</span>
          <span>预计阅读 {Math.max(2, Math.ceil(stories.length * 0.65))} 分钟</span>
        </div>
      </section>

      <nav className="filters" aria-label="新闻分类">
        {filters.map((item) => (
          <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>
            {item}
          </button>
        ))}
      </nav>

      <section className="feed" aria-live="polite">
        {visible.length ? visible.map((story, index) => (
          <article className="story" key={story.id}>
            <button onClick={() => setActive(story)} aria-label={`阅读：${story.title}`}>
              <div className="rank">{String(index + 1).padStart(2, "0")}</div>
              <div className="story-body">
                <div className="story-kicker">
                  {story.categories.map((category) => <span className={`tag tag-${category}`} key={category}>{category}</span>)}
                  <span>{story.source}</span>
                </div>
                <h2>{story.title}</h2>
                <p>{story.summary}</p>
                <div className="read-more">阅读摘要 <span>→</span></div>
              </div>
            </button>
          </article>
        )) : loading ? (
          <div className="empty">正在整理今日早报…</div>
        ) : (
          <div className="empty">昨日没有筛选出这一类的重要讯息。</div>
        )}
      </section>

      <footer>
        <div className="footer-mark">昨日报</div>
        <p>公开来源 · 智能去重 · 重要性排序</p>
        <p className="fineprint">摘要仅用于信息速览，事实与完整语境请以原报道为准。</p>
      </footer>

      {active && (
        <div className="overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setActive(null)}>
          <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="story-title">
            <button className="close" onClick={() => setActive(null)} aria-label="关闭">×</button>
            <div className="sheet-top"><span>{active.categories.join(" · ")}</span><span>{active.source}</span></div>
            <h2 id="story-title">{active.title}</h2>
            <div className="summary-label">早报摘要</div>
            <p>{active.summary}</p>
            {active.url !== "#" && <a className="source-link" href={active.url} target="_blank" rel="noreferrer">查看原报道 ↗</a>}
          </section>
        </div>
      )}
    </main>
  );
}
