// Contact page: copy buttons + client-side contact finder.
// Everything runs in the browser; answers are never sent or stored.
(() => {
  const dataEl = document.getElementById("contact-data");
  if (!dataEl) return;
  let data;
  try { data = JSON.parse(dataEl.textContent); } catch { return; }

  const status = document.getElementById("copy-status");
  const svg = (name) => `<svg class="icon" aria-hidden="true"><use href="#icon-${name}" /></svg>`;

  /* ---------- copy ---------- */
  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.cssText = "position:fixed;top:0;left:0;opacity:0";
      document.body.appendChild(area);
      area.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch {}
      area.remove();
      return ok;
    }
  };
  const bindCopy = (button) => {
    button.hidden = false;
    const label = button.querySelector("span");
    const original = label.textContent;
    button.addEventListener("click", async () => {
      const ok = await copyText(button.dataset.copy);
      label.textContent = ok ? "コピーしました" : "コピーできませんでした";
      if (status) status.textContent = ok ? `${button.dataset.copy} をコピーしました` : "コピーできませんでした。手動で選択してコピーしてください。";
      clearTimeout(button._t);
      button._t = setTimeout(() => { label.textContent = original; }, 2000);
    });
  };
  document.querySelectorAll("[data-copy]").forEach(bindCopy);

  /* ---------- finder ---------- */
  const wizard = document.getElementById("wizard");
  if (!wizard) return;
  const el = (tag, attrs = {}, html = "") => {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    if (html) node.innerHTML = html;
    return node;
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  let path = []; // [{ nodeId, label }]
  let current = data.start;

  // Move focus to the new heading without letting the browser scroll, then scroll only when
  // the card's top is out of view, so the page stays put while answering on small screens.
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const focusHeading = () => {
    wizard.querySelector("[data-focus]")?.focus({ preventScroll: true });
    const card = wizard.querySelector(".wizard-card");
    if (!card) return;
    const top = card.getBoundingClientRect().top;
    const headerHeight = document.querySelector(".site-header")?.offsetHeight || 0;
    if (top < headerHeight || top > window.innerHeight * 0.7) {
      card.scrollIntoView({ block: "start", behavior: reduceMotion.matches ? "auto" : "smooth" });
    }
  };

  const renderQuestion = () => {
    const node = data.nodes[current];
    wizard.dataset.state = "question";
    wizard.replaceChildren();
    const card = el("div", { class: "wizard-card" });
    card.append(el("p", { class: "wizard-step" }, `質問 ${path.length + 1}`));
    card.append(el("h3", { class: "wizard-question", tabindex: "-1", "data-focus": "", id: "wizard-q" }, esc(node.question)));
    const group = el("div", { class: "wizard-options", role: "group", "aria-labelledby": "wizard-q" });
    node.options.forEach((option) => {
      const b = el("button", { type: "button", class: "wizard-option" }, `<span>${esc(option.label)}</span>${svg("arrow")}`);
      b.addEventListener("click", () => {
        path.push({ nodeId: current, label: option.label });
        if (option.result) renderResult(option);
        else { current = option.next; renderQuestion(); focusHeading(); }
      });
      group.append(b);
    });
    card.append(group);
    if (path.length) {
      const back = el("button", { type: "button", class: "button button-soft wizard-back" }, "前の質問に戻る");
      back.addEventListener("click", () => { current = path.pop().nodeId; renderQuestion(); focusHeading(); });
      card.append(back);
    }
    wizard.append(card);
  };

  const buildMailto = (contact, subject) =>
    `mailto:${contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(contact.body)}`;

  const renderResult = (option) => {
    const result = option.result;
    const contact = data.contacts[result.contact] || data.contacts[data.fallback];
    wizard.dataset.state = "result";
    wizard.replaceChildren();
    const card = el("div", { class: "wizard-card wizard-result" });
    card.append(el("p", { class: "wizard-step" }, "診断結果"));
    card.append(el("h3", { class: "wizard-question", tabindex: "-1", "data-focus": "" }, `おすすめの窓口: ${esc(contact.name)}`));
    card.append(el("p", { class: "wizard-reason" }, esc(result.reason)));
    const mail = el("div", { class: "contact-mail" });
    mail.append(el("div", { class: "address-frame" }, `<p class="contact-address"><span class="visually-hidden">メールアドレス: </span><code>${esc(contact.email)}</code></p>`));
    const actions = el("div", { class: "contact-actions" });
    const copy = el("button", { type: "button", class: "button button-soft", "data-copy": contact.email }, `${svg("copy")}<span>コピー</span>`);
    actions.append(copy);
    actions.append(el("a", { class: "button button-primary", href: buildMailto(contact, result.subject) }, `${svg("mail")}件名つきでメール作成`));
    mail.append(actions);
    card.append(mail);
    bindCopy(copy);
    const tips = el("div", { class: "wizard-tips" }, `<h4>問い合わせ時に記載すると対応が円滑になる情報</h4><ul>${contact.tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`);
    card.append(tips);
    card.append(el("p", { class: "notice-inline" }, esc(data.safety)));

    const nav = el("div", { class: "wizard-nav" });
    const retry = el("button", { type: "button", class: "button button-soft" }, "診断をやり直す");
    retry.addEventListener("click", () => { path = []; current = data.start; renderQuestion(); focusHeading(); });
    const list = el("a", { class: "button button-soft", href: "#list" }, "窓口一覧に戻る");
    list.addEventListener("click", () => document.getElementById("list")?.focus({ preventScroll: true }));
    nav.append(retry, list);
    card.append(nav);
    wizard.append(card);
    focusHeading();
  };

  wizard.setAttribute("aria-live", "polite");
  renderQuestion();
})();
