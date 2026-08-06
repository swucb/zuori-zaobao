"use client";

import { useEffect, useMemo, useState } from "react";

type Story = {
  id: string;
  title: string;
  summary: string;
  context: string;
  category: string;
  source: string;
  url: string;
  publishedAt: string;
  score: number;
};

const fallbackStories: Story[] = [
  {
    id: "fallback-1",
    title: "正在连接昨日新闻源",
    summary: "早报正在从公开 RSS 与免费新闻索引中汇总昨日的重要信息。连接完成后，这里会自动替换为真实报道。",
    context: "系统只保留中国政策、中国行业、中国科技，以及中美与全球层面的重要信息，并自动过滤娱乐、明星和花边新闻。",
    category: "速览",
    source: "早报编辑器",
    url: "#",
    publishedAt: new Date().toISOString(),
    score: 100,
  },
];

const filters = ["全部", "政治", "行业", "科技", "全球"];

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
  const [stories, setStories] = useState<Story[]>(fallbackStories);
  const [filter, setFilter] = useState("全部");
  const [active, setActive] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/news?v=politics-20260806-1&t=${Date.now()}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        if (Array.isArray(data.stories) && data.stories.length) setStories(data.stories);
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
    () => (filter === "全部" ? stories : stories.filter((story) => story.category === filter)),
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
                  <span className={`tag tag-${story.category}`}>{story.category}</span>
                  <span>{story.source}</span>
                </div>
                <h2>{story.title}</h2>
                <p>{story.summary}</p>
                <div className="read-more">阅读摘要 <span>→</span></div>
              </div>
            </button>
          </article>
        )) : (
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
            <div className="sheet-top"><span>{active.category}</span><span>{active.source}</span></div>
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
