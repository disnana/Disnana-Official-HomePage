#!/usr/bin/env node
// Generates the 1200x630 social preview images in assets/og/.
//   node scripts/og.mjs
// Dev-time only: needs Playwright (`require("playwright")`) with Chromium. It is NOT a site dependency;
// the generated PNGs are committed. Re-run after changing page titles or data/members.json.
import { createRequire } from "node:module";
import { readFileSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = createRequire(import.meta.url)("playwright");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// Inline images as data URIs: pages set via setContent() cannot load file:// URLs.
const dataUri = (p) => `data:image/png;base64,${readFileSync(join(root, p)).toString("base64")}`;
const ASIDE = process.argv.includes("--aside"); // preview: project list on the right of the home image
const outArg = process.argv.find((a) => a.startsWith("--out="))?.slice(6);

const members = JSON.parse(readFileSync(join(root, "data/members.json"), "utf8")).members.filter((m) => m.published);
const pages = [
  { name: "home", label: "DEVELOPMENT PROJECT", title: "身近な課題から、<br><em>ソフトウェアをつくる。</em>", sub: "Discord Botとオープンソースの開発プロジェクト", url: "disnana.com",
    aside: ["Disnana Bot", "Nagi", "NanaSQLite", "DisnanaSASPAM", "NyanSQLite", "niltest"],
    stats: [["280+", "導入数"], ["約30,000", "ユーザーを同時に保護"], ["6年以上", "開発を継続"]] },
  { name: "contact", label: "CONTACT", title: "お問い合わせ", sub: "用途別の窓口と、簡単な診断で適切な窓口をご案内", url: "disnana.com/contact" },
  { name: "members", label: "MEMBERS", title: "公式メンバー", sub: "Disnanaの運営・開発に関わるメンバー", url: "disnana.com/members" },
  ...members.map((m) => ({ name: `member-${m.id}`, label: "OFFICIAL MEMBER", title: esc(m.displayName), sub: esc(m.role), url: `disnana.com/member/${m.id}`, avatar: m.avatar })),
];

const html = (p) => `<!doctype html><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; background: #f6f7fb; color: #121a2e; font-family: "DM Sans", "Noto Sans JP", "Noto Sans CJK JP", system-ui, sans-serif; position: relative; overflow: hidden; }
  .frame { position: absolute; inset: 0; border: 1px solid #e1e5ee; }
  .brand { position: absolute; left: 72px; top: 64px; display: flex; align-items: center; gap: 20px; }
  .brand img { width: 64px; height: 64px; border-radius: 16px; box-shadow: 0 0 0 1px #e1e5ee; }
  .brand b { font-size: 34px; letter-spacing: -.01em; }
  .brand span { display: block; font-size: 13px; letter-spacing: .26em; color: #5b6579; margin-top: 4px; }
  .body { position: absolute; left: 72px; right: 72px; top: ${p.stats ? 172 : 200}px; }
  .label { font-size: 20px; font-weight: 700; letter-spacing: .18em; color: #2c50dc; display: flex; align-items: center; gap: 16px; }
  .label::before { content: ""; width: 36px; height: 3px; background: currentColor; border-radius: 2px; }
  h1 { margin-top: 24px; font-size: ${p.stats ? 80 : p.title.length > 12 ? 84 : 96}px; line-height: 1.18; letter-spacing: -.02em; font-weight: 800; }
  h1 em { font-style: normal; color: #2c50dc; }
  .sub { margin-top: 20px; font-size: 26px; color: #3d475c; }
  .avatar { position: absolute; right: 72px; top: 190px; width: 240px; height: 240px; border-radius: 50%; object-fit: cover; background: #e8edfd; }
  .stats { position: absolute; left: 72px; bottom: 64px; display: flex; gap: 64px; }
  .stats b { display: block; font-size: 44px; font-weight: 800; letter-spacing: -.02em; line-height: 1.1; }
  .stats span { font-size: 16px; color: #5b6579; }
  .aside { position: absolute; right: 72px; top: 150px; width: 330px; padding: 24px 28px; border: 1px solid #243049; border-radius: 16px; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 20px; line-height: 2; color: #c6cfe2; }
  .aside small { display: block; margin-bottom: 8px; font-size: 13px; letter-spacing: .18em; color: #9aa6bf; }
  .aside i { font-style: normal; color: #8fa8ff; }
  .url { position: absolute; right: 72px; bottom: 64px; font-size: 22px; color: #5b6579; letter-spacing: .02em; }
</style><div class="frame"></div>
<div class="brand"><img src="${dataUri("assets/disnana-icon-light.png")}" alt=""><div><b>Disnana</b><span>OFFICIAL</span></div></div>
<div class="body"><div class="label">${p.label}</div><h1>${p.title}</h1><p class="sub">${p.sub}</p></div>
${p.avatar ? `<img class="avatar" src="${dataUri(p.avatar.replace(/^\//, ""))}" alt="">` : ""}
${p.stats ? `<div class="stats">${p.stats.map(([n, l]) => `<div><b>${esc(n)}</b><span>${esc(l)}</span></div>`).join("")}</div>` : ""}
${ASIDE && p.aside ? `<div class="aside"><small>PROJECTS</small>${p.aside.map((n) => `<div><i>›</i> ${esc(n)}</div>`).join("")}</div>` : ""}
<div class="url">${p.url}</div>`;

const outDir = outArg || join(root, "assets/og");
mkdirSync(outDir, { recursive: true });
const keep = new Set(pages.map((p) => `${p.name}.png`));
for (const f of readdirSync(outDir)) if (f.endsWith(".png") && !keep.has(f)) unlinkSync(join(outDir, f));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const p of pages) {
  await page.setContent(html(p), { waitUntil: "load" });
  await page.screenshot({ path: join(outDir, `${p.name}.png`) });
  console.log("og:", `assets/og/${p.name}.png`);
}
await browser.close();
