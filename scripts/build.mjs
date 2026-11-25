#!/usr/bin/env node
// Disnana static page generator (no dependencies).
//   node scripts/build.mjs
// Reads data/contacts.json and data/members.json and writes:
//   contact.html, members.html, member/<id>.html, 404.html
// The generated HTML is committed so the site can stay on plain static hosting.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://disnana.com";
const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));
const write = (p, s) => {
  mkdirSync(dirname(join(root, p)), { recursive: true });
  writeFileSync(join(root, p), s);
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fail = (msg) => { console.error("build error: " + msg); process.exit(1); };

/* ---------------- data + validation ---------------- */
const contactData = read("data/contacts.json");
const memberData = read("data/members.json");
const contacts = contactData.contacts;
const contactById = new Map(contacts.map((c) => [c.id, c]));
if (contactById.size !== contacts.length) fail("duplicate contact id");
for (const c of contacts) {
  if (!/^[a-z0-9._+-]+@disnana\.com$/.test(c.email)) fail(`invalid contact email: ${c.email}`);
  if (/^tp-li@/i.test(c.email)) fail("personal address must not be published");
  if (!c.subject || !Array.isArray(c.template) || !c.template.length) fail(`contact needs subject/template: ${c.id}`);
}
if (!contactById.has(contactData.fallbackContact)) fail("fallbackContact missing");

// Every diagnosis branch must end at a known contact, and every `next` must exist.
const nodes = contactData.diagnosis.nodes;
const maxDepth = (id, seen = []) => {
  if (seen.includes(id)) fail(`diagnosis loop at ${id}`);
  const node = nodes[id] || fail(`unknown diagnosis node: ${id}`);
  let depth = 1;
  for (const o of node.options) {
    if (o.result) {
      if (!contactById.has(o.result.contact)) fail(`unknown contact in result: ${o.result.contact}`);
      if (!o.result.subject || !o.result.reason) fail(`result needs subject/reason: ${o.label}`);
    } else depth = Math.max(depth, 1 + maxDepth(o.next, [...seen, id]));
  }
  return depth;
};
maxDepth(contactData.diagnosis.start);

const members = memberData.members;
const memberIds = new Set();
for (const m of members) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(m.id)) fail(`invalid member id: ${m.id}`);
  if (memberIds.has(m.id)) fail(`duplicate member id: ${m.id}`);
  memberIds.add(m.id);
  if (!["active", "inactive", "alumni"].includes(m.status)) fail(`invalid status: ${m.id}`);
  for (const l of [...(m.links || []), ...(m.projects || [])]) if (l.url && !/^https:\/\//.test(l.url)) fail(`non-https url in ${m.id}: ${l.url}`);
  if (m.publicEmail && /^tp-li@/i.test(m.publicEmail)) fail("personal address must not be published");
}
const mailBody = (c) => [...c.template.flatMap((t) => [`【${t}】`, ""]), `※${contactData.safetyNotice}`].join("\r\n");
const mailto = (c, subject = c.subject) => `mailto:${c.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(mailBody(c))}`;
const publicMembers = members.filter((m) => m.published);

/* ---------------- shared shell ---------------- */
const STATUS = { active: "活動中", inactive: "休止中", alumni: "元メンバー" };
const sprite = `<svg class="icon-library" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <symbol id="icon-arrow" viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6" /></symbol>
      <symbol id="icon-external" viewBox="0 0 24 24"><path d="M6 18 18 6M6 6h12v12" /></symbol>
      <symbol id="icon-shield" viewBox="0 0 24 24"><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></symbol>
      <symbol id="icon-mail" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></symbol>
      <symbol id="icon-copy" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h8" /></symbol>
      <symbol id="icon-check" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" /></symbol>
      <symbol id="icon-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></symbol>
      <symbol id="icon-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></symbol>
      <symbol id="icon-moon" viewBox="0 0 24 24"><path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z" /></symbol>
    </svg>`;
const icon = (name, cls = "") => `<svg class="icon${cls ? " " + cls : ""}" aria-hidden="true"><use href="#icon-${name}" /></svg>`;

const themeScript = `<script>
      (() => {
        let theme;
        try {
          const stored = localStorage.getItem("disnana-theme");
          if (stored === "light" || stored === "dark") theme = stored;
        } catch {}
        theme ||= matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        document.documentElement.dataset.theme = theme;
        document.querySelector('meta[name="theme-color"]').content = theme === "dark" ? "#0d1422" : "#f8f9fc";
      })();
    </script>`;

const header = (current) => {
  const link = (href, label, key) => `<a href="${href}"${current === key ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<a class="skip-link" href="#main">本文へスキップ</a>
    ${sprite}
    <header class="site-header">
      <div class="header-inner container">
        <a class="brand" href="/" aria-label="Disnana ホーム">
          <span class="brand-mark">
            <img class="brand-mark-light" src="/assets/disnana-icon-light.png" width="40" height="40" alt="" />
            <img class="brand-mark-dark" src="/assets/disnana-icon-dark-cropped.png" width="40" height="40" alt="" />
          </span>
          <span>Disnana<span class="brand-caption">OFFICIAL</span></span>
        </a>
        <nav class="site-nav" id="site-navigation" aria-label="メインナビゲーション">
          ${link("/#about", "Disnanaについて", "about")}
          ${link("/#projects", "プロジェクト", "projects")}
          ${link("/members", "メンバー", "members")}
          ${link("/contact", "お問い合わせ", "contact")}
        </nav>
        <div class="header-actions">
          <button class="theme-toggle icon-button" type="button" aria-label="ダークモード" aria-pressed="false" hidden>
            <svg class="icon theme-icon-light" aria-hidden="true"><use href="#icon-moon" /></svg>
            <svg class="icon theme-icon-dark" aria-hidden="true"><use href="#icon-sun" /></svg>
          </button>
          <a class="header-cta" href="https://dashboard.disnana.com" target="_blank" rel="noopener noreferrer">ダッシュボード <svg class="icon" aria-hidden="true"><use href="#icon-external" /></svg></a>
          <button class="menu-toggle icon-button" type="button" aria-label="メニュー" aria-expanded="false" aria-controls="site-navigation" hidden><span></span><span></span></button>
        </div>
      </div>
    </header>`;
};

const footer = `<footer class="site-footer">
      <div class="container">
        <div class="footer-top">
          <div class="footer-about">
            <a class="footer-brand" href="/">Disnana<span>.</span></a>
            <p>コミュニティと、つくる人のそばに。</p>
          </div>
          <nav class="footer-nav" aria-label="フッターナビゲーション">
            <div><h2>Disnana</h2><a href="/#about">Disnanaについて</a><a href="/members">メンバー</a><a href="/#projects">プロジェクト</a></div>
            <div><h2>サービス</h2><a href="https://bot.disnana.com/">Bot公式サイト</a><a href="https://dashboard.disnana.com" target="_blank" rel="noopener noreferrer">ダッシュボード</a><a href="https://status.disnana.com" target="_blank" rel="noopener noreferrer">稼働状況</a></div>
            <div><h2>サポート</h2><a href="/contact">お問い合わせ</a><a href="https://tos.disnana.com" target="_blank" rel="noopener noreferrer">利用規約</a><a href="https://privacypolicy.disnana.com" target="_blank" rel="noopener noreferrer">プライバシーポリシー</a></div>
          </nav>
        </div>
        <div class="footer-bottom"><span>© <span data-current-year>2026</span> Disnana</span><a class="back-top" href="#top">ページの先頭へ <span aria-hidden="true">↑</span></a></div>
      </div>
    </footer>`;

const page = ({ path, title, description, current, body, scripts = "", ogType = "website", ogImage = `${ORIGIN}/assets/og-image.png`, twitterCard = "summary_large_image", noindex = false, extraHead = "" }) => `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${esc(description)}" />
    <meta name="theme-color" content="#f8f9fc" />
    ${noindex ? '<meta name="robots" content="noindex" />' : ""}
    <title>${esc(title)}</title>
    <link rel="icon" href="/favicon.ico" />
    ${noindex ? "" : `<link rel="canonical" href="${ORIGIN}${path}" />`}
    <meta property="og:type" content="${ogType}" />
    <meta property="og:locale" content="ja_JP" />
    <meta property="og:site_name" content="Disnana" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${ORIGIN}${path}" />
    <meta property="og:image" content="${esc(ogImage)}" />
    <meta name="twitter:card" content="${twitterCard}" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${esc(ogImage)}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Noto+Sans+JP:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    ${themeScript}
    <link rel="stylesheet" href="/main.css" />
    <link rel="stylesheet" href="/pages.css" />
    ${extraHead}
  </head>
  <body id="top">
    ${header(current)}
    <main id="main" tabindex="-1">
${body}
    </main>
    ${footer}
    <script src="/main.js"></script>
    ${scripts}
  </body>
</html>
`;

/* ---------------- /contact ---------------- */
const contactCard = (c) => `
          <article class="contact-card" id="contact-${c.id}" aria-labelledby="contact-${c.id}-title" data-contact="${c.id}">
            <header class="contact-card-head">
              <h3 id="contact-${c.id}-title">${esc(c.name)}</h3>
              <p class="contact-purpose">${esc(c.purpose)}</p>
            </header>
            <ul class="contact-examples">${c.examples.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
            <p class="contact-choose">${esc(c.choose)}</p>
            <div class="contact-mail">
              <div class="address-frame">
                <p class="contact-address"><span class="visually-hidden">メールアドレス: </span><code>${esc(c.email)}</code></p>
              </div>
              <div class="contact-actions">
                <button class="button button-soft" type="button" data-copy="${esc(c.email)}" hidden>${icon("copy")}<span>コピー</span><span class="visually-hidden"> (${esc(c.name)}のアドレス)</span></button>
                <a class="button button-primary" href="${esc(mailto(c))}">${icon("mail")}メール作成<span class="visually-hidden"> (${esc(c.name)})</span></a>
              </div>
            </div>
          </article>`;

const clientData = {
  contacts: Object.fromEntries(contacts.map((c) => [c.id, { email: c.email, name: c.name, purpose: c.purpose, tips: c.tips, subject: c.subject, body: mailBody(c) }])),
  fallback: contactData.fallbackContact,
  safety: contactData.safetyNotice,
  start: contactData.diagnosis.start,
  nodes,
};
const clientJson = JSON.stringify(clientData).replace(/</g, "\\u003c");

const contactBody = `
      <section class="page-hero container" aria-labelledby="page-title">
        <p class="eyebrow">Contact</p>
        <h1 id="page-title">お問い合わせ</h1>
        <p class="page-lead">ご用件に合わせた窓口をご用意しています。どこに連絡すればよいか迷うときは、簡単な質問に答えて窓口を調べることもできます。診断を使わず、一覧から直接メールすることも可能です。</p>
        <ul class="page-anchors">
          <li><a class="text-link" href="#diagnosis">窓口を診断する ${icon("arrow")}</a></li>
          <li><a class="text-link" href="#list">窓口の一覧を見る ${icon("arrow")}</a></li>
        </ul>
      </section>

      <section class="container notice-section" aria-labelledby="notice-title">
        <div class="notice" role="note">
          ${icon("shield")}
          <div>
            <h2 id="notice-title">メールを送る前に</h2>
            <p>${esc(contactData.safetyNotice)}</p>
          </div>
        </div>
      </section>

      <section class="container page-section" id="diagnosis" aria-labelledby="diagnosis-title">
        <div class="split">
          <div class="section-intro">
            <p class="eyebrow">Quick guide</p>
            <h2 class="section-title" id="diagnosis-title">窓口の簡易診断</h2>
            <p class="section-lead">選択式の質問に答えると、おすすめの窓口を案内します。回答内容は、この端末のブラウザ内だけで処理され、送信・保存されません。</p>
          </div>
          <div class="wizard" id="wizard" data-state="idle">
            <noscript><p class="wizard-fallback">簡易診断にはJavaScriptが必要です。下の<a href="#list">窓口の一覧</a>から直接お問い合わせください。</p></noscript>
          </div>
        </div>
      </section>

      <section class="container page-section" id="list" aria-labelledby="list-title" tabindex="-1">
        <div class="section-intro">
          <p class="eyebrow">All contacts</p>
          <h2 class="section-title" id="list-title">お問い合わせ先一覧</h2>
          <p class="section-lead">用途ごとに窓口を分けています。内容に近い窓口へご連絡ください。</p>
        </div>
        <div class="contact-grid">${contacts.map(contactCard).join("")}
          <aside class="contact-card contact-card-hint" aria-labelledby="hint-title">
            <h3 id="hint-title">どこに送るか迷ったら</h3>
            <p>簡単な質問に答えて、窓口を調べられます。判断できない場合は総合窓口（${esc(contactById.get(contactData.fallbackContact).email)}）へどうぞ。</p>
            <a class="button button-soft" href="#diagnosis">窓口を診断する ${icon("arrow")}</a>
          </aside>
        </div>
        <p class="copy-status visually-hidden" role="status" aria-live="polite" id="copy-status"></p>
      </section>

      <section class="container page-section" id="compare" aria-labelledby="compare-title">
        <div class="section-intro">
          <p class="eyebrow">Which one?</p>
          <h2 class="section-title" id="compare-title">用途が近い窓口の選び方</h2>
        </div>
        <dl class="compare-list">${contactData.comparisons.map((c) => `
          <div><dt>${esc(c.title)}</dt><dd>${esc(c.text)}</dd></div>`).join("")}
        </dl>
        <p class="page-note">どの窓口か判断できない場合は、総合窓口（${esc(contactById.get(contactData.fallbackContact).email)}）へご連絡ください。</p>
        <p class="page-note">メンバーの一覧は<a class="inline-link" href="/members">公式メンバー</a>のページでご確認いただけます。お問い合わせは、メンバー個人ではなく上記の窓口へお願いします。</p>
      </section>`;

write("contact.html", page({
  path: "/contact",
  title: "お問い合わせ｜Disnana",
  description: "Disnanaのお問い合わせ窓口の一覧です。サポート、法務、個人情報、セキュリティ、請求などの窓口を用途別にご案内し、簡単な質問で適切な窓口を診断できます。",
  current: "contact",
  body: contactBody,
  scripts: `<script type="application/json" id="contact-data">${clientJson}</script>
    <script src="/contact.js"></script>`,
}));

/* ---------------- /members and /member/:id ---------------- */
const statusBadge = (m) => `<span class="badge badge-status is-${m.status}">${STATUS[m.status]}</span>`;
const officialBadge = `<span class="badge badge-official">${icon("shield")}Disnana 公式メンバー</span>`;
const avatar = (m, cls) => m.avatar
  ? `<img class="${cls}" src="${esc(m.avatar)}" width="160" height="160" alt="${esc(m.avatarAlt || m.displayName)}" loading="lazy" />`
  : `<span class="${cls} avatar-fallback" aria-hidden="true">${esc([...m.displayName][0] || "?")}</span>`;

const memberCard = (m) => `
          <li>
            <a class="member-card" href="/member/${esc(m.id)}">
              ${avatar(m, "member-avatar")}
              <span class="member-card-body">
                <span class="member-card-badges">${officialBadge}${statusBadge(m)}</span>
                <strong class="member-name">${esc(m.displayName)}</strong>
                <span class="member-role">${esc(m.role)}</span>
                <span class="member-areas">${(m.areas || []).slice(0, 3).map(esc).join(" / ")}</span>
              </span>
              ${icon("arrow", "member-arrow")}
            </a>
          </li>`;

const membersBody = `
      <section class="page-hero container" aria-labelledby="page-title">
        <p class="eyebrow">Members</p>
        <h1 id="page-title">公式メンバー</h1>
        <p class="page-lead">Disnanaの運営・開発に関わるメンバーを紹介します。このページに掲載されているプロフィールが、Disnana公式のものです。</p>
      </section>
      <section class="container page-section" aria-labelledby="members-title">
        <h2 class="visually-hidden" id="members-title">メンバー一覧</h2>
        ${publicMembers.length
          ? `<ul class="member-grid">${publicMembers.map(memberCard).join("")}
        </ul>`
          : `<p class="empty-state">現在、公開しているメンバーはいません。</p>`}
        <div class="notice" role="note">
          ${icon("mail")}
          <div>
            <h2>Disnanaへのお問い合わせ</h2>
            <p>ご連絡はメンバー個人ではなく、用途別の公式窓口へお願いします。<a class="inline-link" href="/contact">お問い合わせ先を確認する</a></p>
          </div>
        </div>
      </section>`;

write("members.html", page({
  path: "/members",
  title: "公式メンバー｜Disnana",
  description: "Disnanaの公式メンバー一覧です。運営・開発に関わるメンバーの役職、担当領域、プロフィールをご紹介します。",
  current: "members",
  body: membersBody,
}));

const memberBody = (m) => {
  const realName = m.showRealName && m.realName ? m.realName : null;
  const email = m.showEmail && m.publicEmail ? m.publicEmail : null;
  const routeIds = ["info", "support"].filter((id) => contactById.has(id));
  return `
      <nav class="container breadcrumb" aria-label="パンくずリスト">
        <ol><li><a href="/">ホーム</a></li><li><a href="/members">メンバー</a></li><li aria-current="page">${esc(m.displayName)}</li></ol>
      </nav>
      <section class="container profile" aria-labelledby="page-title">
        <div class="profile-head">
          ${avatar(m, "profile-avatar")}
          <div class="profile-id">
            <div class="member-card-badges">${officialBadge}${statusBadge(m)}</div>
            <h1 id="page-title">${esc(m.displayName)}</h1>
            <p class="profile-role">${esc(m.role)}</p>
            ${realName ? `<p class="profile-real">本名: ${esc(realName)}</p>` : ""}
          </div>
        </div>
        <div class="profile-grid">
          <div class="profile-main">
            <section aria-labelledby="bio-title"><h2 id="bio-title">自己紹介</h2><p>${esc(m.bio)}</p></section>
            ${(m.areas || []).length ? `<section aria-labelledby="areas-title"><h2 id="areas-title">担当領域</h2><ul class="tag-list">${m.areas.map((a) => `<li>${esc(a)}</li>`).join("")}</ul></section>` : ""}
            ${(m.projects || []).length ? `<section aria-labelledby="projects-title"><h2 id="projects-title">参加プロジェクト</h2><ul class="link-list">${m.projects.map((p) => `<li>${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${esc(p.name)} ${icon("external")}</a>` : `<span>${esc(p.name)}</span>`}${p.description ? `<span class="link-desc">${esc(p.description)}</span>` : ""}</li>`).join("")}</ul></section>` : ""}
          </div>
          <aside class="profile-side" aria-label="リンクと連絡先">
            ${(m.links || []).length || email ? `<section aria-labelledby="links-title"><h2 id="links-title">リンク</h2><ul class="link-list">${(m.links || []).map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)} ${icon("external")}</a></li>`).join("")}${email ? `<li><a href="mailto:${esc(email)}">${esc(email)} ${icon("mail")}</a></li>` : ""}</ul></section>` : ""}
            <section aria-labelledby="contact-title" class="profile-contact">
              <h2 id="contact-title">Disnanaへのお問い合わせ</h2>
              <p>ご用件は、用途別の公式窓口で受け付けています。</p>
              <ul class="link-list">${routeIds.map((id) => { const c = contactById.get(id); return `<li><a href="/contact#contact-${id}">${esc(c.name)}（${esc(c.purpose)}）</a></li>`; }).join("")}</ul>
              <a class="button button-primary" href="/contact">${icon("mail")}窓口を診断する</a>
            </section>
          </aside>
        </div>
      </section>`;
};

const memberJsonLd = (m) => {
  const data = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: `${ORIGIN}/member/${m.id}`,
    mainEntity: {
      "@type": "Person",
      name: m.displayName,
      jobTitle: m.role,
      description: m.bio,
      ...(m.avatar ? { image: ORIGIN + m.avatar } : {}),
      worksFor: { "@type": "Organization", name: "Disnana", url: ORIGIN + "/" },
      ...((m.links || []).length ? { sameAs: m.links.map((l) => l.url) } : {}),
    },
  };
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
};

// Remove stale generated member pages (members that were deleted or unpublished).
mkdirSync(join(root, "member"), { recursive: true });
for (const f of readdirSync(join(root, "member"))) {
  if (f.endsWith(".html") && !publicMembers.some((m) => `${m.id}.html` === f)) unlinkSync(join(root, "member", f));
}
for (const m of publicMembers) {
  write(`member/${m.id}.html`, page({
    path: `/member/${m.id}`,
    title: `${m.displayName}｜Disnana 公式メンバー`,
    description: `Disnana公式メンバー ${m.displayName}（${m.role}）のプロフィール。${m.bio}`.slice(0, 160),
    current: "members",
    body: memberBody(m),
    ogType: "profile",
    ogImage: m.avatar ? ORIGIN + m.avatar : `${ORIGIN}/assets/og-image.png`,
    twitterCard: m.avatar ? "summary" : "summary_large_image",
    extraHead: memberJsonLd(m),
  }));
}

/* ---------------- 404 ---------------- */
write("404.html", page({
  path: "/404",
  title: "ページが見つかりません｜Disnana",
  description: "お探しのページは見つかりませんでした。",
  current: "",
  noindex: true,
  body: `
      <section class="container not-found" aria-labelledby="page-title">
        <p class="eyebrow">404</p>
        <h1 id="page-title">ページが見つかりません</h1>
        <p class="page-lead">お探しのページは存在しないか、非公開になった可能性があります。URLをご確認ください。</p>
        <div class="not-found-actions">
          <a class="button button-primary" href="/">ホームへ戻る ${icon("arrow")}</a>
          <a class="button button-soft" href="/members">メンバー一覧</a>
          <a class="button button-soft" href="/contact">お問い合わせ</a>
        </div>
      </section>`,
}));

console.log(`built: contact.html, members.html, ${publicMembers.length} member page(s), 404.html`);
