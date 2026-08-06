import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const background = resolve(root, "assets/share-cover-bg.png");
const output = resolve(root, "public-site/share-cover.jpg");

const overlay = Buffer.from(`
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect x="106" y="292" width="650" height="514" rx="2" fill="#f5f0e7" fill-opacity="0.90"/>
  <text x="142" y="360" font-family="Helvetica, Arial, sans-serif" font-size="23" font-weight="700" letter-spacing="5" fill="#d71920">THE MORNING BRIEF</text>
  <text x="132" y="510" font-family="Songti SC, STSong, serif" font-size="132" font-weight="900" letter-spacing="-8" fill="#111111">昨日</text>
  <text x="132" y="640" font-family="Songti SC, STSong, serif" font-size="132" font-weight="900" letter-spacing="-8" fill="#d71920">早报</text>
  <line x1="140" y1="688" x2="455" y2="688" stroke="#111111" stroke-width="8"/>
  <text x="140" y="746" font-family="Heiti SC, PingFang SC, sans-serif" font-size="35" font-weight="700" fill="#111111">昨天，真正重要的事。</text>
  <text x="142" y="790" font-family="Heiti SC, PingFang SC, sans-serif" font-size="21" font-weight="600" letter-spacing="3" fill="#66625d">政治 · 行业 · 科技 · 全球</text>
</svg>`);

await sharp(background)
  .resize(1024, 1024, { fit:"cover" })
  .composite([{ input:overlay, top:0, left:0 }])
  .jpeg({ quality:90, mozjpeg:true })
  .toFile(output);

console.log(output);
