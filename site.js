/* =========================================================================
 * site.js — 全ページ共通の動き
 *  ・メニューの開閉
 *  ・今いるページの表示
 *  ・登壇者募集のカウントダウンと、締切後の自動切り替え
 *    (data-speaker-when="open" は募集中だけ、"closed" は受付終了後だけ表示)
 * ========================================================================= */
(function () {
  "use strict";
  const { t, speakerOpen, speakerDeadline } = window.App;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /* ---------- 今いるページ ---------- */
  function markCurrent() {
    const page = document.body.dataset.page;
    $$("[data-page-link]").forEach(a => {
      if (a.dataset.pageLink.split(" ").indexOf(page) >= 0) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  /* ---------- メニュー ---------- */
  function initMenu() {
    const btn = $("#menuBtn"), menu = $("#siteMenu");
    if (!btn || !menu) return;

    function setOpen(open) {
      menu.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
      btn.setAttribute("aria-label", t(open ? "menu.close" : "menu.open"));
      document.body.classList.toggle("menu-open", open);
      if (open) { const first = $("a", menu); if (first) first.focus({ preventScroll: true }); }
    }
    btn.addEventListener("click", () => setOpen(menu.hidden));
    menu.addEventListener("click", e => { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && !menu.hidden) { setOpen(false); btn.focus(); }
    });
    document.addEventListener("langchange", () => btn.setAttribute("aria-label", t(menu.hidden ? "menu.open" : "menu.close")));
    btn.setAttribute("aria-label", t("menu.open"));
  }

  /* ---------- カウントダウン ---------- */
  const pad = n => String(n).padStart(2, "0");

  function deadlineLabel() {
    const sp = CONFIG.speaker || {};
    return window.App.loc(sp.deadline);
  }

  function remaining() {
    const d = speakerDeadline();
    if (!d) return null;
    let ms = d.getTime() - Date.now();
    if (ms < 0) ms = 0;
    const s = Math.floor(ms / 1000);
    return { ms, d: Math.floor(s / 86400), h: Math.floor(s % 86400 / 3600), m: Math.floor(s % 3600 / 60), s: s % 60 };
  }

  let lastOpen = null;
  let lastAria = "";

  function applyState() {
    const open = speakerOpen();
    document.documentElement.dataset.speaker = open ? "open" : "closed";
    $$("[data-speaker-when]").forEach(el => {
      el.hidden = (el.dataset.speakerWhen === "open") !== open;
    });
    lastOpen = open;
  }

  function tick() {
    if (speakerOpen() !== lastOpen) applyState();
    const r = remaining();
    $$("[data-countdown]").forEach(box => {
      if (!r) { box.hidden = true; return; }
      const set = (u, v) => { const el = $(`[data-u="${u}"]`, box); if (el) el.textContent = v; };
      set("d", String(r.d)); set("h", pad(r.h)); set("m", pad(r.m)); set("s", pad(r.s));
      box.classList.toggle("is-urgent", r.ms < 3 * 86400000);
      const until = $("[data-cd-until]", box);
      if (until) until.textContent = t("cd.until", { date: deadlineLabel() });
      const timer = $(".cd__grid", box);
      if (timer) {
        const aria = t("cd.aria", { d: r.d, h: r.h, m: r.m });
        if (aria !== lastAria) { timer.setAttribute("aria-label", aria); lastAria = aria; }
      }
    });
    $$("[data-cd-short]").forEach(el => {
      if (!r) { el.textContent = ""; return; }
      el.textContent = r.d >= 1 ? t("cd.short.days", { n: r.d })
        : r.h >= 1 ? t("cd.short.hours", { n: r.h }) : t("cd.short.last");
    });
  }

  /* ---------- 移動を速く・迷わなくする ---------- */
  // 下のタブ・メニューのページを、あいた時間に先読みしておく(通信量を抑える設定のときは何もしない)
  function prefetchPages() {
    const c = navigator.connection;
    if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ""))) return;
    const here = location.pathname.split("/").pop() || "index.html";
    const seen = new Set();
    $$(".tabbar a, .site-menu a").forEach(a => {
      const h = a.getAttribute("href");
      if (!h || h.charAt(0) === "#" || seen.has(h) || h === here) return;
      seen.add(h);
      const l = document.createElement("link"); l.rel = "prefetch"; l.href = h; document.head.appendChild(l);
    });
  }
  // 入力中はキーボードで画面が狭くなるので、下のタブを隠す
  function initKeyboardHide() {
    const isField = el => el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !/^(checkbox|radio|button|submit)$/.test(el.type || "");
    document.addEventListener("focusin", e => { if (isField(e.target)) document.body.classList.add("kb-open"); });
    document.addEventListener("focusout", () => setTimeout(() => { if (!isField(document.activeElement)) document.body.classList.remove("kb-open"); }, 80));
  }

  // ページを開いたときは、いつも一番上から表示する(アンカー付きのリンクは、そのまま)
  try { if ("scrollRestoration" in history) history.scrollRestoration = "manual"; } catch (e) { /* 何もしない */ }
  function toTop() { if (!location.hash) window.scrollTo({ top: 0, left: 0, behavior: "instant" }); }
  toTop();
  window.addEventListener("pageshow", toTop);
  window.addEventListener("load", toTop);
  document.addEventListener("DOMContentLoaded", () => {
    toTop();
    initKeyboardHide();
    (window.requestIdleCallback || (f => setTimeout(f, 1500)))(prefetchPages);
    markCurrent();
    initMenu();
    applyState();
    tick();
    setInterval(tick, 1000);
    document.addEventListener("langchange", tick);
  });
})();
