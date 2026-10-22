/* =========================================================================
 * 共通処理(index.html / vote.html の両方で使用)
 *  - 言語切り替えと文言の差し込み
 *  - 送信処理(sendData:送信はすべてこの1つの関数を通ります)
 *  - 「視差効果を減らす」設定の判定
 *  - localStorage の安全な読み書き
 * ========================================================================= */
(function () {
  "use strict";

  const LANG_KEY = "apu-event-lang";

  /* ---------- localStorage(使えない環境でも落ちないように) ---------- */
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v === null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; }
      catch (e) { return false; }
    }
  };

  /* ---------- 言語 ---------- */
  let lang = store.get(LANG_KEY, null);
  if (lang !== "ja" && lang !== "en") lang = CONFIG.defaultLang === "en" ? "en" : "ja";

  /** 辞書から文言を取り出す。vars で {name} を置き換え */
  function t(key, vars) {
    let s = (I18N[lang] && I18N[lang][key]);
    if (s === undefined) s = (I18N.ja[key] !== undefined ? I18N.ja[key] : key);
    if (vars) Object.keys(vars).forEach(k => { s = s.split("{" + k + "}").join(vars[k]); });
    return s;
  }

  /** 指定言語の文言(送信データを日本語ラベルで記録するときなどに使用) */
  function tIn(l, key) {
    return (I18N[l] && I18N[l][key] !== undefined) ? I18N[l][key] : key;
  }

  /** config 内の { ja, en } を現在の言語で取り出す */
  function loc(value, l) {
    if (value && typeof value === "object") return value[l || lang] ?? value.ja ?? "";
    return value ?? "";
  }

  /** "event.name" のようなパスで CONFIG の値を取得 */
  function cfg(path) {
    return path.split(".").reduce((o, k) => (o == null ? o : o[k]), CONFIG);
  }

  /** 改行(\n)を <br> にしつつ安全にテキストを入れる */
  function setText(el, text) {
    const parts = String(text).split("\n");
    el.textContent = "";
    parts.forEach((p, i) => {
      if (i) el.appendChild(document.createElement("br"));
      el.appendChild(document.createTextNode(p));
    });
  }

  /**
   * 画面に文言を差し込む
   *  data-i18n="key"            → 本文
   *  data-i18n-placeholder="key" → placeholder
   *  data-i18n-aria="key"        → aria-label
   *  data-cfg="event.date"       → CONFIG の値
   */
  function applyI18n(root) {
    root = root || document;
    root.querySelectorAll("[data-i18n]").forEach(el => setText(el, t(el.dataset.i18n)));
    root.querySelectorAll("[data-i18n-placeholder]").forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    root.querySelectorAll("[data-i18n-aria]").forEach(el => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
    root.querySelectorAll("[data-cfg]").forEach(el => setText(el, loc(cfg(el.dataset.cfg))));
    document.documentElement.lang = lang;
    const titleKey = document.documentElement.dataset.titleKey;
    if (titleKey) document.title = t(titleKey);
  }

  function setLang(next) {
    lang = next === "en" ? "en" : "ja";
    store.set(LANG_KEY, lang);
    applyI18n();
    document.dispatchEvent(new CustomEvent("langchange", { detail: { lang } }));
  }

  /* ---------- アニメーション抑制の判定 ---------- */
  const motionQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function reducedMotion() { return !!(motionQuery && motionQuery.matches); }

  /* ---------- 送信処理(送信はすべてここを通る) ----------
   * type: "entry"(参加申込) / "vote"(共感度投票)
   * CONFIG.endpoint が空ならテストモード:コンソールに出すだけ。
   *
   * Google Apps Script へは Content-Type を指定せず(=text/plain)に POST します。
   * こうするとブラウザの事前確認(CORS プリフライト)が発生せず、GAS で受け取れます。
   */
  async function sendData(type, data) {
    const payload = Object.assign({ type, lang, sentAt: new Date().toISOString() }, data);

    if (!CONFIG.endpoint) {
      console.groupCollapsed("%c[TEST MODE] sendData: " + type, "color:#d63a1a;font-weight:bold");
      console.log(payload);
      console.log(JSON.stringify(payload, null, 2));
      console.groupEnd();
      await new Promise(r => setTimeout(r, 500));
      return { ok: true, test: true };
    }

    const res = await fetch(CONFIG.endpoint, {
      method: "POST",
      body: JSON.stringify(payload),
      redirect: "follow"
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    let json = null;
    try { json = await res.json(); } catch (e) { /* 応答が読めなくても送信自体は成功扱い */ }
    if (json && json.ok === false) throw new Error(json.error || "server error");
    return { ok: true, test: false };
  }

  /* ---------- テストモード表示 ---------- */
  function showTestBadge() {
    if (CONFIG.endpoint) return;
    const b = document.createElement("div");
    b.className = "test-badge";
    b.setAttribute("role", "status");
    b.dataset.i18n = "common.testMode";
    const foot = document.querySelector(".site-footer");
    (foot || document.body).appendChild(b);
  }

  /* ---------- 登壇者募集の受付状態 ----------
   * CONFIG.speaker.open が false、または締切日時(deadlineDate)を過ぎていたら「終了」 */
  function speakerDeadline() {
    const d = CONFIG.speaker && CONFIG.speaker.deadlineDate ? new Date(CONFIG.speaker.deadlineDate) : null;
    return d && !isNaN(d) ? d : null;
  }
  function speakerOpen() {
    const sp = CONFIG.speaker || {};
    if (sp.open === false) return false;
    const d = speakerDeadline();
    return !d || Date.now() < d.getTime();
  }

  /* ---------- 初期化 ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    showTestBadge();
    applyI18n();
    const btn = document.getElementById("langToggle");
    if (btn) btn.addEventListener("click", () => setLang(lang === "ja" ? "en" : "ja"));
  });

  /* 他のスクリプトから使えるように公開 */
  window.App = {
    t, tIn, loc, cfg, setText, applyI18n, setLang, sendData, reducedMotion, store, speakerOpen, speakerDeadline,
    get lang() { return lang; }
  };
})();
