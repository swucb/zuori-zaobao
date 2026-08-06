import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { GET } from "../app/api/news/route.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "public-site/news.json");
const requiredCategories = ["政治", "行业", "科技", "全球"];

const response = await GET();
if (!response.ok) throw new Error(`新闻生成失败：HTTP ${response.status}`);

const data = await response.json() as {
  stories?: Array<{ categories?: string[] }>;
  counts?: Record<string, number>;
  editionDate?: string;
};

if (!Array.isArray(data.stories) || data.stories.length < 12) {
  throw new Error("新闻生成失败：总条数不足，保留上一版页面");
}

for (const category of requiredCategories) {
  const count = data.stories.filter((story) => story.categories?.includes(category)).length;
  if (count < 3) throw new Error(`新闻生成失败：${category}栏目仅 ${count} 条，保留上一版页面`);
}

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(data, null, 2)}\n`, "utf8");
console.log(`已生成 ${data.editionDate || "当日"} 早报：${data.stories.length} 条`);
