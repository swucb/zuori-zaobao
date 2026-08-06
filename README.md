# 昨日早报

面向手机端的中文每日新闻早报，聚合公开新闻源，过滤娱乐花边，并按重要性呈现政治、行业、科技与全球资讯。一条新闻可以同时属于多个栏目。

## GitHub Pages

网站由 GitHub Actions 在北京时间每天 07:30 生成静态新闻快照并发布。每日任务会尝试读取原文，并通过 GitHub Models 为每条新闻生成一至两段中文摘要；原文或模型暂时不可用时自动保留新闻源摘要。页面只读取已生成的 `news.json`，不会在访客打开网页时临时抓取新闻，因此无需登录且内容稳定。

需要手动更新时，可以在仓库的 Actions 页面运行“每日早报与 GitHub Pages”。

## 本地检查

```bash
npm ci
node --experimental-strip-types scripts/generate-news.ts
```

生成完成后，以任意静态文件服务器打开 `public-site/`。
