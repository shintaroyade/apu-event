/* =========================================================================
 * index.js — 参加申込ページの処理
 * 各機能は独立した関数になっていて、HTML側のセクションを削除しても
 * 該当する要素が無ければ何もしないので、エラーになりません。
 * ========================================================================= */
(function () {
  "use strict";
  const { t, tIn, loc, applyI18n, sendData, reducedMotion, store } = window.App;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const charLen = s => Array.from(s).length;   // 絵文字などを1文字として数える

  /* =======================================================================
   * スクロールで下からふわっと表示(IntersectionObserver)
   * ===================================================================== */
  function initReveal() {
    const items = $$(".reveal");
    if (reducedMotion() || !("IntersectionObserver" in window)) {
      items.forEach(el => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    items.forEach(el => io.observe(el));
  }

  /* =======================================================================
   * 遊べるコンテンツ2:タイムテーブル探検
   * ===================================================================== */
  const JOIN_POINTS = ["change", "break"];   // 「ここからの参加もOK」を表示するパート

  function initTimetable() {
    const list = $("#ttList");
    if (!list) return;

    CONFIG.timetable.forEach((part, i) => {
      const li = document.createElement("li");
      li.className = "tt-item reveal";
      li.dataset.kind = part.kind;
      const panelId = "tt-panel-" + part.id;
      li.innerHTML = `
        ${JOIN_POINTS.includes(part.id) ? `<p class="tt-join" data-i18n="tt.joinHere"></p>` : ""}
        <button type="button" class="tt-btn" aria-expanded="false" aria-controls="${panelId}">
          <budoux-ja class="tt-btn__name" data-i18n="tt.${part.id}.name"></budoux-ja>
          <span class="tt-btn__min" data-min-index="${i}"></span>
          <span class="tt-btn__icon" aria-hidden="true">+</span>
        </button>
        <div class="tt-panel" id="${panelId}" hidden>
          <dl>
            <dt data-i18n="tt.whatLabel"></dt><dd data-i18n="tt.${part.id}.what"></dd>
            <dt data-i18n="tt.youLabel"></dt><dd data-i18n="tt.${part.id}.you"></dd>
          </dl>
        </div>`;
      list.appendChild(li);
    });

    applyI18n(list);
    renderMinutes();

    list.addEventListener("click", e => {
      const btn = e.target.closest(".tt-btn");
      if (!btn) return;
      const open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!open));
      document.getElementById(btn.getAttribute("aria-controls")).hidden = open;
    });

    document.addEventListener("langchange", renderMinutes);

    function renderMinutes() {
      $$("[data-min-index]", list).forEach(el => {
        const part = CONFIG.timetable[Number(el.dataset.minIndex)];
        el.textContent = t("tt.minutes", { min: loc(part.min) });
      });
    }
  }

  /* =======================================================================
   * 遊べるコンテンツ1:「やりたいこと」ひとこと診断
   * 入力内容はこの端末内(canvas)だけで処理し、どこにも送信しません。
   * ===================================================================== */
  function initDiagnosis() {
    const form = $("#dxForm");
    if (!form) return;

    const MAX = 30;
    const whatEl = $("#dxWhat"), whyEl = $("#dxWhy");
    const otherWrap = $("#dxWhoOtherWrap"), otherEl = $("#dxWhoOther");
    const result = $("#dxResult"), img = $("#dxImage");
    const canvas = document.createElement("canvas");
    canvas.width = 1080; canvas.height = 1350;
    let last = null;   // 直近の回答(言語切り替え時に描き直すため)

    // 登壇公募リンク(config に URL があればそちらへ)
    const speakerLink = $("#dxSpeakerLink");
    if (speakerLink && CONFIG.links.speakerCall) {
      speakerLink.href = CONFIG.links.speakerCall;
      speakerLink.target = "_blank";
      speakerLink.rel = "noopener";
    }

    // 文字数カウンター
    function updateCounter(input, out) {
      $(out).textContent = t("dx.counter", { n: charLen(input.value), max: MAX });
    }
    [[whatEl, "#dxWhatCount"], [whyEl, "#dxWhyCount"]].forEach(([el, out]) => {
      el.addEventListener("input", () => updateCounter(el, out));
      updateCounter(el, out);
    });

    // 「自由入力」を選んだら入力欄を出す
    form.addEventListener("change", e => {
      if (e.target.name !== "who") return;
      otherWrap.hidden = e.target.value !== "other";
      if (!otherWrap.hidden) otherEl.focus();
      $("#dxWhoErr").textContent = "";
    });

    function getWho() {
      const checked = form.querySelector('input[name="who"]:checked');
      if (!checked) return null;
      if (checked.value === "other") return { custom: otherEl.value.trim() };
      return { key: "dx.who." + checked.value };
    }

    form.addEventListener("submit", async e => {
      e.preventDefault();
      const who = getWho();
      const what = whatEl.value.trim();
      const why = whyEl.value.trim();
      let ok = true;
      const setErr = (id, key, cond) => { $(id).textContent = cond ? t(key) : ""; if (cond) ok = false; };
      setErr("#dxWhoErr", "dx.errWho", !who || (who.custom !== undefined && !who.custom));
      setErr("#dxWhatErr", "dx.errWhat", !what);
      setErr("#dxWhyErr", "dx.errWhy", !why);
      if (!ok) return;

      last = { who, what: Array.from(what).slice(0, MAX).join(""), why: Array.from(why).slice(0, MAX).join("") };
      await drawCard();
      result.hidden = false;
      result.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
      result.focus({ preventScroll: true });
    });

    $("#dxRetry").addEventListener("click", () => {
      result.hidden = true;
      form.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
      whatEl.focus({ preventScroll: true });
    });

    // 画像として保存(スマホは共有メニュー、それ以外はダウンロード)
    $("#dxSave").addEventListener("click", () => saveCanvasImage(canvas, "my-one-line.png"));

    document.addEventListener("langchange", () => {
      updateCounter(whatEl, "#dxWhatCount");
      updateCounter(whyEl, "#dxWhyCount");
      if (last && !result.hidden) drawCard();
    });

    async function drawCard() {
      const whoText = last.who.custom !== undefined ? last.who.custom : t(last.who.key);
      img.alt = await drawOneLineCard(canvas, { who: whoText, what: last.what, why: last.why });
      img.src = canvas.toDataURL("image/png");
    }
  }

  /** canvas を画像として保存(スマホは共有メニュー、それ以外はダウンロード) */
  function saveCanvasImage(canvas, filename) {
    canvas.toBlob(async blob => {
      if (!blob) return;
      const file = new File([blob], filename, { type: "image/png" });
      const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
      if (coarse && navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file] }); return; }
        catch (err) { if (err && err.name === "AbortError") return; }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, "image/png");
  }

  /* =======================================================================
   * 「やりたいこと」カードの描画(申込の完了画面でも使う)
   *  data: { who, what, why }(who・why は空でも可)。戻り値は代替テキスト。
   * ===================================================================== */
  async function drawOneLineCard(canvas, data) {
    const FONT = '"Zen Kaku Gothic New", "Hiragino Sans", "Noto Sans JP", sans-serif';
    const TECH = '"Chakra Petch", "Zen Kaku Gothic New", sans-serif';
    try {
      await Promise.all([
        document.fonts.load('900 60px "Zen Kaku Gothic New"', "あA"),
        document.fonts.load('600 30px "Chakra Petch"', "A")
      ]);
    } catch (e) { /* フォント未読込でも描画は続行 */ }

    const css = getComputedStyle(document.documentElement);
    const C = name => css.getPropertyValue(name).trim();
    const PINK = C("--c-primary") || "#ff2e97";
    const W = canvas.width, H = canvas.height;
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "middle";

    // 背景(黒)+グリッド
    ctx.fillStyle = C("--c-bg") || "#08080c";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(255,255,255,.06)"; ctx.lineWidth = 2;
    for (let x = 0; x <= W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // ピンクの光
    const glow = ctx.createRadialGradient(W - 120, 160, 0, W - 120, 160, 520);
    glow.addColorStop(0, "rgba(255,46,151,.55)"); glow.addColorStop(.45, "rgba(255,46,151,.12)"); glow.addColorStop(1, "rgba(255,46,151,0)");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    const glow2 = ctx.createRadialGradient(80, H - 120, 0, 80, H - 120, 420);
    glow2.addColorStop(0, "rgba(255,46,151,.22)"); glow2.addColorStop(1, "rgba(255,46,151,0)");
    ctx.fillStyle = glow2; ctx.fillRect(0, 0, W, H);

    // 細いリング
    ctx.strokeStyle = "rgba(255,46,151,.6)"; ctx.lineWidth = 2;
    ctx.shadowColor = PINK; ctx.shadowBlur = 24;
    ctx.beginPath(); ctx.arc(W - 120, 160, 210, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;

    // 上部ラベル
    const pad = 90;
    ctx.font = `600 30px ${TECH}`;
    ctx.fillStyle = PINK;
    ctx.beginPath(); ctx.arc(pad + 8, 132, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillText(t("dx.cardLabel").split("").join(String.fromCharCode(8202)), pad + 32, 132);

    // 本文のパネル(四隅ブラケット)
    const cardX = pad, cardY = 210, cardW = W - pad * 2, cardH = 820;
    ctx.fillStyle = "rgba(19,19,28,.82)";
    roundRect(ctx, cardX, cardY, cardW, cardH, 16); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.14)"; ctx.lineWidth = 2;
    roundRect(ctx, cardX, cardY, cardW, cardH, 16); ctx.stroke();
    ctx.strokeStyle = PINK; ctx.lineWidth = 6; ctx.shadowColor = PINK; ctx.shadowBlur = 18;
    const k = 56;
    [[cardX, cardY, 1, 1], [cardX + cardW, cardY, -1, 1], [cardX, cardY + cardH, 1, -1], [cardX + cardW, cardY + cardH, -1, -1]]
      .forEach(([x, y, dx, dy]) => { ctx.beginPath(); ctx.moveTo(x + dx * k, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * k); ctx.stroke(); });
    ctx.shadowBlur = 0;

    // 本文(回答部分はピンクで光らせる)
    const values = { who: data.who || "", what: data.what || "", why: data.why || "" };
    const tpl = !values.who ? "dx.templateWhat" : !values.why ? "dx.templateNoWhy" : "dx.template";
    const segments = [];
    t(tpl).split(/(\{who\}|\{what\}|\{why\})/).forEach(part => {
      const m = part.match(/^\{(who|what|why)\}$/);
      if (m) segments.push({ text: values[m[1]], hl: true });
      else if (part) segments.push({ text: part, hl: false });
    });

    const boxX = cardX + 70, boxW = cardW - 140, boxY = cardY + 90, boxH = cardH - 180;
    let size = 84, lines, lineH;
    do {
      ctx.font = `900 ${size}px ${FONT}`;
      lines = layout(ctx, segments, boxW);
      lineH = size * 1.55;
      size -= 4;
    } while (lines.length * lineH > boxH && size > 36);
    size += 4;
    ctx.font = `900 ${size}px ${FONT}`;

    let y = boxY + (boxH - lines.length * lineH) / 2 + lineH / 2;
    lines.forEach(line => {
      let x = boxX;
      line.forEach(u => {
        const w = ctx.measureText(u.text).width;
        if (u.hl) { ctx.fillStyle = PINK; ctx.shadowColor = PINK; ctx.shadowBlur = 22; }
        else { ctx.fillStyle = C("--c-ink") || "#f3f2f8"; ctx.shadowBlur = 0; }
        ctx.fillText(u.text, x, y);
        if (u.hl && u.text.trim()) {   // 細い下線
          ctx.shadowBlur = 0;
          ctx.fillRect(x, y + size * .62, w + 1, 4);
        }
        x += w;
      });
      y += lineH;
    });
    ctx.shadowBlur = 0;

    // フッター(イベント名・コンセプト)
    ctx.fillStyle = "rgba(255,255,255,.18)";
    ctx.fillRect(pad, H - 236, W - pad * 2, 2);
    ctx.fillStyle = C("--c-ink") || "#f3f2f8";
    fitText(ctx, loc(CONFIG.event.name), pad, H - 180, W - pad * 2, 40, FONT);
    ctx.fillStyle = PINK;
    fitText(ctx, t("hero.concept").replace(/\n/g, " "), pad, H - 116, W - pad * 2, 32, FONT);

    return t("dx.imgAlt") + ":" + segments.map(s => s.text).join("");
  }

  // 文字を幅に合わせて改行(日本語は1文字ずつ、英語は単語単位)
  function layout(ctx, segments, maxW) {
    const NO_START = "、。,.!?!?」』)】ー〜…ゃゅょっぁぃぅぇぉャュョッ";
    const units = [];
    segments.forEach(seg => {
      (seg.text.match(/[A-Za-z0-9'’\-.,!?:;"()&\/]+\s*|\s+|./gsu) || []).forEach(s => units.push({ text: s, hl: seg.hl }));
    });
    const lines = [[]];
    let w = 0;
    units.forEach(u => {
      const uw = ctx.measureText(u.text.replace(/\s+$/, "")).width;
      const line = lines[lines.length - 1];
      if (w + uw > maxW && line.length && !NO_START.includes(u.text)) {
        lines.push([]);
        w = 0;
        if (/^\s+$/.test(u.text)) return;   // 行頭の空白は捨てる
      }
      lines[lines.length - 1].push(u);
      w += ctx.measureText(u.text).width;
    });
    return lines;
  }

  function fitText(ctx, text, x, y, maxW, size, font) {
    let s = size;
    do { ctx.font = `700 ${s}px ${font}`; s -= 2; } while (ctx.measureText(text).width > maxW && s > 18);
    ctx.fillText(text, x, y);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* =======================================================================
   * 遊べるコンテンツ3:交流ミッション(進捗は localStorage に保存)
   * ===================================================================== */
  const MISSIONS = ["m1", "m2", "m3", "m4", "m5", "m6"];  // 文言は i18n.js の ms.m1〜
  const MS_KEY = "apu-event-missions-v1";

  function rankKeyFor(n, total) {
    if (n === 0) return "ms.rank0";
    if (n >= total) return "ms.rank4";   // 全部達成:挑戦の連鎖
    if (n === 1) return "ms.rank1";      // 1つ:はじめの一歩
    if (n <= 3) return "ms.rank2";
    return "ms.rank3";
  }

  function initMissions() {
    const list = $("#msList");
    if (!list) return;
    let done = new Set((store.get(MS_KEY, []) || []).filter(id => MISSIONS.includes(id)));
    let prevRank = null;

    MISSIONS.forEach((id, i) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <button type="button" class="mission" data-id="${id}" aria-pressed="false">
          <span class="mission__no">MISSION ${String(i + 1).padStart(2, "0")}</span>
          <budoux-ja class="mission__text" data-i18n="ms.${id}"></budoux-ja>
          <span class="mission__state"></span>
        </button>`;
      list.appendChild(li);
    });
    applyI18n(list);

    list.addEventListener("click", e => {
      const btn = e.target.closest(".mission");
      if (!btn) return;
      const id = btn.dataset.id;
      done.has(id) ? done.delete(id) : done.add(id);
      store.set(MS_KEY, Array.from(done));
      render(true);
    });

    // 確認ダイアログはこの環境で表示されないため、ボタン自体を「もう一度押すとリセット」に切り替える
    const resetBtn = $("#msReset");
    let armed = null;
    function disarm() {
      clearTimeout(armed); armed = null;
      resetBtn.textContent = t("ms.reset");
    }
    resetBtn.addEventListener("click", () => {
      if (!armed) {
        resetBtn.textContent = t("ms.resetConfirm");
        armed = setTimeout(disarm, 4000);
        return;
      }
      disarm();
      done = new Set();
      store.set(MS_KEY, []);
      render(false);
    });

    document.addEventListener("langchange", () => render(false));
    render(false);

    function render(animate) {
      const n = done.size, total = MISSIONS.length;
      $$(".mission", list).forEach(btn => {
        const on = done.has(btn.dataset.id);
        btn.setAttribute("aria-pressed", String(on));
        $(".mission__state", btn).textContent = t(on ? "ms.done" : "ms.todo");
      });
      const rankEl = $("#msRank");
      const key = rankKeyFor(n, total);
      rankEl.textContent = t(key);
      if (animate && prevRank !== null && key !== prevRank && !reducedMotion()) {
        rankEl.classList.remove("is-up");
        void rankEl.offsetWidth;          // アニメーションを毎回やり直すため
        rankEl.classList.add("is-up");
      }
      prevRank = key;
      $("#msBar").style.width = (n / total * 100) + "%";
      $("#msCount").textContent = t("ms.progress", { n, total });
    }
  }

  /* =======================================================================
   * 参加申込フォーム
   * ===================================================================== */
  function initEntryForm() {
    const form = $("#entryForm");
    if (!form) return;
    try {
      if (new URLSearchParams(location.search).get("role") === "group") {
        $$('input[name="slots"][value="group"], input[name="interests"][value="group"]', form).forEach(i => { i.checked = true; });
      }
    } catch (e) { /* 何もしない */ }
    const submitBtn = $("#entrySubmit");
    const summary = $("#entrySummary");
    const sendErr = $("#entrySendErr");
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let busy = false;
    let tried = false;   // 一度送信を試みたら、入力のたびに再チェック

    const el = {
      name: $("#f-name"), affiliation: $("#f-aff"), grade: $("#f-grade"),
      companions: $("#f-comp"), email: $("#f-email"), wish: $("#f-wish"), consent: $("#f-consent"),
      affOther: $("#f-aff-other"), gradeOther: $("#f-grade-other"), publish: $("#f-publish"),
      why: $("#f-why"), whoOther: $("#f-who-other")
    };

    // 「誰に?」で「自由に入力」を選んだら入力欄を出す
    const whoWrap = $("#f-who-other-wrap");
    $$('input[name="who"]', form).forEach(r => r.addEventListener("change", () => {
      const on = r.checked && r.value === "other";
      if (r.checked) { whoWrap.hidden = !on; if (on) el.whoOther.focus(); }
    }));
    // 文字数カウンター
    [[el.wish, "#f-wish-count"], [el.why, "#f-why-count"]].forEach(([inp, out]) => {
      const max = Number(inp.getAttribute("maxlength")) || 40;
      const upd = () => { $(out).textContent = t("dx.counter", { n: charLen(inp.value), max }); };
      inp.addEventListener("input", upd); document.addEventListener("langchange", upd); upd();
    });
    const whoAnswer = () => {
      const r = $('input[name="who"]:checked', form);
      if (!r) return { ja: "", shown: "" };
      if (r.value === "other") { const v = el.whoOther.value.trim(); return { ja: v, shown: v }; }
      return { ja: tIn("ja", "dx.who." + r.value), shown: t("dx.who." + r.value) };
    };

    // 「みんなのやってみたい」への掲載チェックは、ひとことを書いたときだけ出す
    const publishField = $('[data-field="publish"]', form);
    const syncPublish = () => {
      if (!publishField) return;
      const has = !!el.wish.value.trim();
      publishField.hidden = !has;
      if (!has && el.publish) el.publish.checked = false;
    };
    el.wish.addEventListener("input", syncPublish);
    syncPublish();

    // 「その他」を選んだときだけ、自由入力欄を出す
    const otherPairs = [
      { sel: el.affiliation, input: el.affOther, wrap: $("#f-aff-other-wrap"), field: "affiliation" },
      { sel: el.grade, input: el.gradeOther, wrap: $("#f-grade-other-wrap"), field: "grade" }
    ];
    otherPairs.forEach(o => {
      const sync = focus => {
        const on = o.sel.value === "other";
        o.wrap.hidden = !on;
        o.input.setAttribute("aria-required", on ? "true" : "false");
        if (on && focus) o.input.focus();
      };
      o.sel.addEventListener("change", () => sync(true));
      o.input.addEventListener("input", () => { if (tried || o.sel.hasAttribute("aria-invalid")) check(o.field); });
      o.input.addEventListener("blur", () => { o.input.dataset.touched = "1"; check(o.field); });
      sync(false);
    });
    const selectRule = (sel, input) => {
      if (!sel.value) return "form.err.select";
      if (sel.value === "other" && !input.value.trim() && (tried || input.dataset.touched)) return "form.err.other";
      return "";
    };
    const selectLabel = (prefix, sel, input) => {
      const base = tIn("ja", prefix + sel.value);
      return sel.value === "other" ? base + "(" + input.value.trim() + ")" : base;
    };
    const checked = name => $$(`input[name="${name}"]:checked`, form).map(i => i.value);

    // 各項目のチェック(エラーの文言キーを返す。問題なければ "")
    const rules = {
      name:        () => el.name.value.trim() ? "" : "form.err.required",
      affiliation: () => selectRule(el.affiliation, el.affOther),
      grade:       () => selectRule(el.grade, el.gradeOther),
      slots:       () => checked("slots").length ? "" : "form.err.slots",
      fields:      () => checked("fields").length ? "" : "form.err.fields",
      seek:        () => checked("seek").length ? "" : "form.err.seek",
      companions:  () => {
        const v = el.companions.value.trim();
        if (el.companions.validity && el.companions.validity.badInput) return "form.err.number";
        if (v === "") return "";
        return /^\d+$/.test(v) && Number(v) <= 50 ? "" : "form.err.number";
      },
      email:       () => {
        const v = el.email.value.trim();
        if (!v) return "form.err.required";
        return EMAIL_RE.test(v) ? "" : "form.err.email";
      },
      consent:     () => el.consent.checked ? "" : "form.err.consent"
    };
    const errIds = {
      name: "f-name-err", affiliation: "f-aff-err", grade: "f-grade-err", slots: "f-slots-err",
      fields: "f-fields-err", seek: "f-seek-err",
      companions: "f-comp-err", email: "f-email-err", consent: "f-consent-err"
    };
    const targets = {
      name: el.name, affiliation: el.affiliation, grade: el.grade,
      slots: $('[data-field="slots"]', form), fields: $('[data-field="fields"]', form), seek: $('[data-field="seek"]', form),
      companions: el.companions, email: el.email, consent: el.consent
    };

    function check(field) {
      const key = rules[field]();
      const errEl = document.getElementById(errIds[field]);
      errEl.dataset.key = key;
      errEl.textContent = key ? t(key) : "";
      if (key) targets[field].setAttribute("aria-invalid", "true");
      else targets[field].removeAttribute("aria-invalid");
      return !key;
    }

    function checkAll() {
      const ORDER = ["name", "affiliation", "grade", "slots", "companions", "email", "fields", "seek", "consent"];
      const bad = ORDER.filter(f => rules[f] && !check(f));
      if (bad.length) {
        summary.hidden = false;
        summary.dataset.n = bad.length;
        summary.textContent = t("form.err.summary", { n: bad.length });
      } else {
        summary.hidden = true;
      }
      return bad;
    }

    // その場でのチェック:入力欄を離れたとき/選択が変わったとき
    ["name", "email", "companions"].forEach(f => {
      targets[f].addEventListener("blur", () => { if (targets[f].value.trim() || tried) check(f); });
      targets[f].addEventListener("input", () => { if (tried || targets[f].hasAttribute("aria-invalid")) check(f); });
    });
    ["affiliation", "grade", "consent"].forEach(f => targets[f].addEventListener("change", () => check(f)));
    $$('input[name="slots"]', form).forEach(i => i.addEventListener("change", () => check("slots")));
    $$('input[name="fields"]', form).forEach(i => i.addEventListener("change", () => check("fields")));
    $$('input[name="seek"]', form).forEach(i => i.addEventListener("change", () => check("seek")));

    // 「全部」:押すと全セッションにチェック。個別のチェックと連動
    const slotAll = $("#f-slots-all");
    const sessionBoxes = $$('input[name="slots"]:not([value="undecided"])', form);
    const undecidedBox = $('input[name="slots"][value="undecided"]', form);
    const syncAll = () => { if (slotAll) slotAll.checked = sessionBoxes.every(i => i.checked); };
    if (slotAll) {
      slotAll.addEventListener("change", () => {
        sessionBoxes.forEach(i => { i.checked = slotAll.checked; });
        if (slotAll.checked && undecidedBox) undecidedBox.checked = false;
        check("slots");
      });
      sessionBoxes.forEach(i => i.addEventListener("change", () => {
        if (i.checked && undecidedBox) undecidedBox.checked = false;
        syncAll();
      }));
      if (undecidedBox) undecidedBox.addEventListener("change", () => {
        if (undecidedBox.checked) sessionBoxes.forEach(i => { i.checked = false; });
        syncAll();
      });
      syncAll();
    }
    form.addEventListener("change", () => { if (tried && !summary.hidden) checkAll(); });

    // 言語を切り替えたら、表示中のエラーも訳し直す
    document.addEventListener("langchange", () => {
      Object.values(errIds).forEach(id => {
        const e = document.getElementById(id);
        if (e.dataset.key) e.textContent = t(e.dataset.key);
      });
      if (!summary.hidden) summary.textContent = t("form.err.summary", { n: summary.dataset.n });
      if (sendErr.dataset.key) sendErr.textContent = t(sendErr.dataset.key);
      submitBtn.textContent = t(busy ? "form.sending" : "form.submit");
    });

    form.addEventListener("submit", async e => {
      e.preventDefault();
      if (busy) return;                     // 二重送信防止
      tried = true;
      sendErr.textContent = ""; sendErr.dataset.key = "";

      const bad = checkAll();
      if (bad.length) {
        const first = targets[bad[0]];
        let focusEl = first.tagName === "FIELDSET" ? $("input", first) : first;
        const op = otherPairs.find(o => o.sel === first && o.sel.value === "other");
        if (op) focusEl = op.input;
        first.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" });
        focusEl.focus({ preventScroll: true });
        return;
      }

      // 運営が読みやすいよう、選択肢は日本語のラベルで記録します
      const label = key => tIn("ja", key);
      const data = {
        name: el.name.value.trim(),
        affiliation: selectLabel("form.aff.", el.affiliation, el.affOther),
        grade: selectLabel("form.grade.", el.grade, el.gradeOther),
        slots: (slotAll && slotAll.checked) ? label("form.slot.all") : checked("slots").map(v => label("form.slot." + v)).join(" / "),
        companions: el.companions.value.trim() === "" ? "" : Number(el.companions.value),
        email: el.email.value.trim(),
        fields: checked("fields").map(v => label("form.fields." + v)).join(" / "),
        seek: checked("seek").map(v => label("form.seek." + v)).join(""),
        who: whoAnswer().ja,
        wish: el.wish.value.trim(),
        why: el.why.value.trim(),
        publish: (el.publish && el.publish.checked && el.wish.value.trim()) ? "掲載OK" : "",
        interests: checked("interests").map(v => label("form.int." + v)).join(" / "),
        consent: "同意"
      };

      busy = true;
      submitBtn.disabled = true;
      submitBtn.setAttribute("aria-busy", "true");
      submitBtn.textContent = t("form.sending");

      try {
        const res = await sendData("entry", data);
        form.hidden = true;
        const done = $("#entryDone");
        $("#entryDoneTest").hidden = !res.test;
        // 「何を?」が書かれていれば、その人だけのカードを出す
        const cardBox = $("#entryCard");
        if (cardBox && data.wish) {
          const cv = document.createElement("canvas"); cv.width = 1080; cv.height = 1350;
          const draw = async () => {
            const im = $("#entryCardImg");
            im.alt = await drawOneLineCard(cv, { who: whoAnswer().shown, what: data.wish, why: data.why });
            im.src = cv.toDataURL("image/png");
          };
          await draw();
          document.addEventListener("langchange", draw);
          $("#entryCardSave").addEventListener("click", () => saveCanvasImage(cv, "my-one-line.png"));
          cardBox.hidden = false;
        }
        done.hidden = false;
        done.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
        done.focus({ preventScroll: true });
      } catch (err) {
        console.error(err);
        sendErr.dataset.key = "form.err.send";
        sendErr.textContent = t("form.err.send");
        busy = false;
        submitBtn.disabled = false;
        submitBtn.removeAttribute("aria-busy");
        submitBtn.textContent = t("form.submit");
      }
    });
  }

  /* =======================================================================
   * 問い合わせ先(config から差し込み)
   * ===================================================================== */
  function initContact() {
    const insta = $("#contactInsta"), mail = $("#contactEmail");
    const o = CONFIG.organizer;
    if (insta) {
      const list = Array.isArray(o.instagrams) && o.instagrams.length ? o.instagrams.map(x => ({ handle: x.label, url: x.url }))
        : Array.isArray(o.instagram) ? o.instagram : [{ handle: o.instagram, url: o.instagramUrl }];
      list.forEach((ig, i) => {
        if (i) insta.appendChild(document.createElement("br"));
        if (ig.url) {
          const a = document.createElement("a");
          a.href = ig.url; a.target = "_blank"; a.rel = "noopener"; a.textContent = ig.handle;
          insta.appendChild(a);
        } else insta.appendChild(document.createTextNode(ig.handle));
      });
    }
    if (mail) {
      if (/^[^\s@【]+@[^\s@]+$/.test(o.email)) {
        const a = document.createElement("a");
        a.href = "mailto:" + o.email; a.textContent = o.email;
        mail.appendChild(a);
      } else mail.textContent = o.email;
    }
  }

  /* =======================================================================
   * 画面下の固定申込ボタン(フォームが見えている間だけ隠す)
   * ===================================================================== */
  function initStickyCta() {
    const cta = $("#stickyCta"), entry = $("#entry");
    if (!cta || !entry || !("IntersectionObserver" in window)) return;
    new IntersectionObserver(([en]) => {
      cta.classList.toggle("is-hidden", en.isIntersecting);
    }, { threshold: 0.05 }).observe(entry);
  }

  /* =======================================================================
   * 登壇者の応募フォーム
   *  ・CONFIG.speaker.open が false なら、受付終了の表示に切り替え
   *  ・CONFIG.links.speakerCall があれば、ページ内フォームの代わりに外部フォームへのボタンを表示
   *  ・それ以外は sendData("speaker", …) で送信(送信先が未設定ならテストモード)
   * ===================================================================== */
  function initSpeaker() {
    const form = $("#spForm");
    if (!form) return;
    const wrap = $("#spFormWrap"), closed = $("#spClosed");
    const sp = CONFIG.speaker || {};

    if (!window.App.speakerOpen()) {
      wrap.hidden = true;
      closed.hidden = false;
      return;
    }
    if (CONFIG.links && CONFIG.links.speakerCall) {
      const ext = $("#spExternal");
      ext.href = CONFIG.links.speakerCall;
      ext.target = "_blank";
      ext.rel = "noopener";
      ext.hidden = false;
      form.hidden = true;
      $("#spPrivacy").hidden = true;
      return;
    }

    const submitBtn = $("#spSubmit");
    const summary = $("#spSummary");
    const sendErr = $("#spSendErr");
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let busy = false;
    let tried = false;

    const val = id => $("#" + id).value.trim();
    // 所属・学年で「その他」を選んだら自由入力欄を出す
    const spSelectRule = k => {
      const v = $("#sp-" + k).value;
      if (!v) return "form.err.select";
      if (v === "other" && !val("sp-" + k + "-other") && (tried || $("#sp-" + k + "-other").dataset.touched)) return "form.err.other";
      return "";
    };
    const spLabel = (prefix, k) => {
      const v = $("#sp-" + k).value, base = tIn("ja", prefix + v);
      return v === "other" ? base + "(" + val("sp-" + k + "-other") + ")" : base;
    };
    ["aff", "grade"].forEach(k => {
      const sel = $("#sp-" + k), inp = $("#sp-" + k + "-other"), wrap = $("#sp-" + k + "-other-wrap");
      if (!inp) return;
      const sync = focus => { const on = sel.value === "other"; wrap.hidden = !on; if (on && focus) inp.focus(); };
      sel.addEventListener("change", () => sync(true));
      inp.addEventListener("input", () => { if (tried || sel.hasAttribute("aria-invalid")) check(k); });
      inp.addEventListener("blur", () => { inp.dataset.touched = "1"; check(k); });
      sync(false);
    });
    const radio = name => { const r = form.querySelector(`input[name="${name}"]:checked`); return r ? r.value : ""; };

    // 項目ごとのチェック(エラーの文言キーを返す。問題なければ "")
    const rules = {
      name:    () => val("sp-name") ? "" : "form.err.required",
      aff:     () => spSelectRule("aff"),
      grade:   () => spSelectRule("grade"),
      wish:    () => val("sp-wish") ? "" : "form.err.required",
      lang:    () => radio("lang") ? "" : "sp.err.lang",
      email:   () => {
        const v = val("sp-email");
        if (!v) return "form.err.required";
        return EMAIL_RE.test(v) ? "" : "form.err.email";
      },
      consent: () => $("#sp-consent").checked ? "" : "form.err.consent"
    };
    const order = ["name", "aff", "grade", "wish", "lang", "email", "consent"];
    const targets = {
      name: $("#sp-name"), aff: $("#sp-aff"), grade: $("#sp-grade"), wish: $("#sp-wish"),
      lang: $('[data-field="lang"]', form), email: $("#sp-email"), consent: $("#sp-consent")
    };

    function check(f) {
      const key = rules[f]();
      const errEl = $("#sp-" + f + "-err");
      errEl.dataset.key = key;
      errEl.textContent = key ? t(key) : "";
      if (key) targets[f].setAttribute("aria-invalid", "true");
      else targets[f].removeAttribute("aria-invalid");
      return !key;
    }
    function checkAll() {
      const bad = order.filter(f => !check(f));
      if (bad.length) {
        summary.hidden = false;
        summary.dataset.n = bad.length;
        summary.textContent = t("form.err.summary", { n: bad.length });
      } else summary.hidden = true;
      return bad;
    }

    // その場でのチェック
    ["name", "wish", "email"].forEach(f => {
      targets[f].addEventListener("blur", () => { if (targets[f].value.trim() || tried) check(f); });
      targets[f].addEventListener("input", () => { if (tried || targets[f].hasAttribute("aria-invalid")) check(f); });
    });
    ["aff", "grade", "consent"].forEach(f => targets[f].addEventListener("change", () => check(f)));
    $$('input[name="lang"]', form).forEach(i => i.addEventListener("change", () => check("lang")));
    form.addEventListener("change", () => { if (tried && !summary.hidden) checkAll(); });

    // 言語を切り替えたら、表示中のエラーも訳し直す
    document.addEventListener("langchange", () => {
      order.forEach(f => {
        const e = $("#sp-" + f + "-err");
        if (e.dataset.key) e.textContent = t(e.dataset.key);
      });
      if (!summary.hidden) summary.textContent = t("form.err.summary", { n: summary.dataset.n });
      if (sendErr.dataset.key) sendErr.textContent = t(sendErr.dataset.key);
      submitBtn.textContent = t(busy ? "form.sending" : "sp.submit");
    });

    form.addEventListener("submit", async e => {
      e.preventDefault();
      if (busy) return;
      tried = true;
      sendErr.textContent = ""; sendErr.dataset.key = "";

      const bad = checkAll();
      if (bad.length) {
        const first = targets[bad[0]];
        const focusEl = first.tagName === "FIELDSET" ? $("input", first) : first;
        first.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" });
        focusEl.focus({ preventScroll: true });
        return;
      }

      // 運営が読みやすいよう、選択肢は日本語のラベルで記録します
      const label = key => tIn("ja", key);
      const stage = radio("stage");
      const data = {
        name: val("sp-name"),
        affiliation: spLabel("form.aff.", "aff"),
        grade: spLabel("form.grade.", "grade"),
        wish: val("sp-wish"),
        stage: stage ? label("sp.stage." + stage) : "",
        detail: val("sp-detail"),
        presentLang: label("sp.lang." + radio("lang")),
        email: val("sp-email"),
        instagram: val("sp-insta"),
        availability: val("sp-avail"),
        consent: "同意"
      };

      busy = true;
      submitBtn.disabled = true;
      submitBtn.setAttribute("aria-busy", "true");
      submitBtn.textContent = t("form.sending");

      try {
        const res = await sendData("speaker", data);
        form.hidden = true;
        const done = $("#spDone");
        $("#spDoneTest").hidden = !res.test;
        done.hidden = false;
        done.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" });
        done.focus({ preventScroll: true });
      } catch (err) {
        console.error(err);
        sendErr.dataset.key = "form.err.send";
        sendErr.textContent = t("form.err.send");
        busy = false;
        submitBtn.disabled = false;
        submitBtn.removeAttribute("aria-busy");
        submitBtn.textContent = t("sp.submit");
      }
    });
  }

  /* =======================================================================
   * 準備中のロックカード
   *  ・CONFIG.teasers の順に並べる。locked: true は5回ノックするとヒントが見える(中身は出さない)
   *  ・locked: false にすると、ロックが外れて content がそのまま表示される
   *  ・ノックの回数はこの端末の localStorage に保存する
   * ===================================================================== */
  const LK_KEY = "apu-event-locks-v1";
  const KNOCKS = 5;

  function initLocks() {
    const grid = $("#lkGrid");
    if (!grid) return;
    const items = Array.isArray(CONFIG.teasers) ? CONFIG.teasers : [];
    const saved = store.get(LK_KEY, {}) || {};
    const counts = {};

    items.forEach(item => {
      const li = document.createElement("li");
      li.className = "lock-item";
      li.dataset.id = item.id;

      if (item.locked === false) {
        li.innerHTML = `
          <article class="lock-card lock-card--open">
            <p class="lock-card__badge lock-card__badge--open" data-i18n="lk.open"></p>
            <h3 class="lock-card__name" data-i18n="lk.${item.id}.name"></h3>
            <p class="lock-card__content" data-content></p>
          </article>`;
        grid.appendChild(li);
        return;
      }

      counts[item.id] = Math.min(KNOCKS, Math.max(0, Number(saved[item.id]) || 0));
      li.innerHTML = `
        <div class="lock-card">
          <button type="button" class="lock-btn" aria-describedby="lk-msg-${item.id}">
            <svg class="lock-btn__icon" viewBox="0 0 48 58" aria-hidden="true" focusable="false">
              <path class="lock-shackle" d="M15 27V17a9 9 0 0 1 18 0v10" fill="none" stroke-width="4.5" stroke-linecap="round"/>
              <rect class="lock-body" x="6" y="26" width="36" height="28" rx="4" stroke-width="2"/>
              <circle class="lock-hole" cx="24" cy="38" r="3.4"/>
              <path class="lock-crack" d="M31 26l-5 9 6 5" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
              <path class="lock-crack" d="M17 54l4-8-5-4" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
              <path class="lock-crack" d="M10 33l7 2 1 6" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
              <path class="lock-crack" d="M40 45l-7-2-2 6" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="lock-btn__text">
              <budoux-ja class="lock-card__name" data-i18n="lk.${item.id}.name"></budoux-ja>
              <span class="lock-card__status"></span>
            </span>
          </button>
          <p class="lock-msg" id="lk-msg-${item.id}" aria-live="polite"></p>
          <div class="lock-reveal" hidden>
            <p class="lock-reveal__hint" data-i18n="lk.${item.id}.hint"></p>
            <p class="lock-reveal__eta"><span class="lock-reveal__label" data-i18n="lk.etaLabel"></span><span data-eta></span></p>
          </div>
        </div>`;
      grid.appendChild(li);
    });

    applyI18n(grid);
    renderContents();
    items.forEach(item => { if (item.locked !== false) render(item.id, false); });

    grid.addEventListener("click", e => {
      const btn = e.target.closest(".lock-btn");
      if (!btn) return;
      const id = btn.closest(".lock-item").dataset.id;
      if (counts[id] < KNOCKS) {
        counts[id] += 1;
        const all = store.get(LK_KEY, {}) || {};
        all[id] = counts[id];
        store.set(LK_KEY, all);
      }
      render(id, true);
    });

    document.addEventListener("langchange", () => {
      renderContents();
      items.forEach(item => { if (item.locked !== false) render(item.id, false); });
    });

    function renderContents() {
      items.forEach(item => {
        if (item.locked !== false) return;
        const el = $(`.lock-item[data-id="${item.id}"] [data-content]`, grid);
        if (el) el.textContent = loc(item.content);
      });
    }

    function render(id, knocked) {
      const item = items.find(x => x.id === id);
      const li = $(`.lock-item[data-id="${id}"]`, grid);
      if (!item || !li) return;
      const n = counts[id];
      const cracks = $$(".lock-crack", li);
      cracks.forEach((c, i) => c.classList.toggle("is-on", i < Math.min(n, cracks.length)));
      const cracked = n >= KNOCKS;
      li.classList.toggle("is-cracked", cracked);
      $(".lock-card__status", li).textContent = cracked ? t("lk.cracked") : (n ? t("lk.knock", { n, max: KNOCKS }) : t("lk.locked"));
      $(".lock-msg", li).textContent = n ? t("lk.k" + n) : "";
      const reveal = $(".lock-reveal", li);
      reveal.hidden = !cracked;
      $("[data-eta]", li).textContent = loc(item.eta);

      if (knocked && !reducedMotion()) {
        const card = $(".lock-card", li);
        card.classList.remove("is-knock");
        void card.offsetWidth;            // アニメーションを毎回やり直すため
        card.classList.add("is-knock");
        if (n === KNOCKS) burst($(".lock-btn__icon", li));
      }
    }

    // ヒビが入った瞬間の小さな光の粒
    function burst(anchor) {
      const box = document.createElement("span");
      box.className = "lock-burst";
      box.setAttribute("aria-hidden", "true");
      for (let i = 0; i < 12; i++) {
        const p = document.createElement("i");
        p.style.setProperty("--a", (i * 30) + "deg");
        p.style.setProperty("--r", (46 + (i % 3) * 14) + "px");
        box.appendChild(p);
      }
      anchor.parentNode.appendChild(box);
      setTimeout(() => box.remove(), 900);
    }
  }

  /* ---------- 起動 ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    initTimetable();   // 先に道のパートを作ってから、スクロール表示を設定
    initDiagnosis();
    initMissions();
    initLocks();
    initSpeaker();
    initEntryForm();
    initContact();
    initReveal();
  });
})();
