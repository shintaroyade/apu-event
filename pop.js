/* =========================================================================
 * pop.js — ホームの背景で遊べる「叫びチャージ」
 *  ・背景を長押しすると、光が中心に集まってエネルギーがたまる(ためるほど強い)
 *  ・指を離すと、衝撃波と一緒に「やってみたい!」などの言葉が飛び出す
 *  ・叫んだ回数はこの端末に記録(localStorage)。5・15・30回で、ひとことが出ます
 *  ・音は初期設定でオフ(右下の♪ボタンでオン)。スマホでは振動もします
 *  ・「視差効果を減らす」設定のときは動かさず、言葉をしばらく表示するだけにします
 *  ・動かすのは遊んでいる間だけ(待機中は何も描画せず、電池を使いません)
 *  ※ 旧バージョン(バブルを割る版)は pop_bubbles_v5.js として手元に残してあります
 * ========================================================================= */
(function () {
  "use strict";
  const hero = document.querySelector(".hero");
  const canvas = hero && hero.querySelector(".pop-canvas");
  if (!canvas || !canvas.getContext) return;

  const { t, reducedMotion, store } = window.App;
  const ctx = canvas.getContext("2d");
  const KEY = "apu-event-shout-v1", SND_KEY = "apu-event-pop-sound";
  const CHARGE_MS = 1600, WORDS = 6;
  const hint = hero.querySelector(".pop-hint");
  const countEl = hero.querySelector(".pop-count");
  const soundBtn = hero.querySelector(".pop-sound");

  let W = 0, H = 0, dpr = 1;
  let charge = null;                       // { x, y, t0, buzz }
  let rings = [], sparks = [], words = [], flash = 0;
  let count = Number(store.get(KEY, 0)) || 0;
  let sound = store.get(SND_KEY, false) === true;
  let running = false, last = 0, msgTimer = 0, stillTimer = 0;
  let audio = null, chargeOsc = null;

  const rnd = (a, b) => a + Math.random() * (b - a);
  const still = () => reducedMotion();
  const buzz = ms => { if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} } };

  function resize() {
    const r = hero.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---- 音(オンにしたときだけ) ---- */
  function ac() {
    try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === "suspended") audio.resume(); return audio; }
    catch (e) { return null; }
  }
  function chargeSound(on) {
    if (!sound) return;
    const a = ac(); if (!a) return;
    try {
      if (on) {
        const o = a.createOscillator(), g = a.createGain(), n = a.currentTime;
        o.type = "triangle"; o.frequency.setValueAtTime(110, n); o.frequency.exponentialRampToValueAtTime(520, n + CHARGE_MS / 1000);
        g.gain.setValueAtTime(.0001, n); g.gain.exponentialRampToValueAtTime(.09, n + .3);
        o.connect(g); g.connect(a.destination); o.start(n);
        chargeOsc = { o, g };
      } else if (chargeOsc) {
        const n = a.currentTime; chargeOsc.g.gain.cancelScheduledValues(n); chargeOsc.g.gain.setTargetAtTime(.0001, n, .03); chargeOsc.o.stop(n + .15); chargeOsc = null;
      }
    } catch (e) { chargeOsc = null; }
  }
  function boom(p) {
    if (!sound) return;
    const a = ac(); if (!a) return;
    try {
      const n = a.currentTime, o = a.createOscillator(), g = a.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(240 + p * 120, n); o.frequency.exponentialRampToValueAtTime(38, n + .35);
      g.gain.setValueAtTime(.25 + p * .2, n); g.gain.exponentialRampToValueAtTime(.001, n + .4);
      o.connect(g); g.connect(a.destination); o.start(n); o.stop(n + .42);
    } catch (e) { /* 音が出せなくても遊べます */ }
  }

  /* ---- 描画 ---- */
  function power(now) { return charge ? Math.min(1, (now - charge.t0) / CHARGE_MS) : 0; }

  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    if (flash > .01) { ctx.fillStyle = "rgba(255,46,151," + flash.toFixed(3) + ")"; ctx.fillRect(0, 0, W, H); }

    if (charge) {
      const p = power(now), R = 70 + p * 110;
      const shake = p * 2.2;
      const cx = charge.x + rnd(-shake, shake), cy = charge.y + rnd(-shake, shake);
      for (let k = 0; k < 3; k++) {                       // 中心に吸い込まれる輪
        const ph = ((now / 520) + k / 3) % 1, r = R * (1 - ph);
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832);
        ctx.strokeStyle = "rgba(255,46,151," + ((.15 + p * .6) * ph).toFixed(3) + ")"; ctx.lineWidth = 1.5 + p * 2; ctx.stroke();
      }
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 14 + p * 46);   // 中心の光
      g.addColorStop(0, "rgba(255,255,255," + (.7 + p * .3) + ")");
      g.addColorStop(.35, "rgba(255,46,151," + (.55 + p * .3) + ")");
      g.addColorStop(1, "rgba(255,46,151,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 14 + p * 46, 0, 6.2832); ctx.fill();
      for (let k = 0; k < 6 + p * 10; k++) {              // 吸い込まれる光の粒
        const a = (k * 2.399 + now / 900) % 6.2832, d = R * (1 - ((now / 700 + k * .37) % 1));
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1.6 + p, 0, 6.2832);
        ctx.fillStyle = "rgba(255,134,196,.9)"; ctx.fill();
      }
    }

    for (const r of rings) {
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, 6.2832);
      ctx.strokeStyle = "rgba(255,46,151," + r.a.toFixed(3) + ")"; ctx.lineWidth = r.w;
      ctx.shadowColor = "rgba(255,46,151,.8)"; ctx.shadowBlur = 14; ctx.stroke(); ctx.shadowBlur = 0;
    }
    for (const s of sparks) {
      ctx.beginPath(); ctx.arc(s.x, s.y, s.s, 0, 6.2832);
      ctx.fillStyle = s.c.replace("A", Math.max(0, s.a).toFixed(2)); ctx.fill();
    }
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const w of words) {
      const size = Math.round(w.size * (1 + (1 - w.a) * .12));
      ctx.font = "900 " + size + "px system-ui, -apple-system, 'Hiragino Sans', sans-serif";
      const half = ctx.measureText(w.text).width / 2 + 10;
      const x = Math.min(W - half, Math.max(half, w.x));
      ctx.lineWidth = 6; ctx.strokeStyle = "rgba(8,8,12," + Math.min(1, w.a).toFixed(2) + ")"; ctx.strokeText(w.text, x, w.y);
      ctx.shadowColor = "rgba(255,46,151,.9)"; ctx.shadowBlur = 18;
      ctx.fillStyle = "rgba(255,255,255," + Math.min(1, w.a).toFixed(2) + ")"; ctx.fillText(w.text, x, w.y); ctx.shadowBlur = 0;
    }
  }

  function step(dt, now) {
    if (charge) {
      const p = power(now);
      if (now - charge.buzz > 220) { charge.buzz = now; buzz(6 + Math.round(p * 20)); }
    }
    flash = Math.max(0, flash - dt * 1.8);
    rings = rings.filter(r => { r.r += r.v * dt; r.v *= .985; r.a -= dt * 0.9; r.w = Math.max(.5, r.w - dt * 2); return r.a > 0; });
    sparks = sparks.filter(s => { s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= .985; s.vy = s.vy * .985 + 180 * dt; s.a -= dt * .9; return s.a > 0; });
    words = words.filter(w => { w.y -= 26 * dt; w.a -= dt * .65; return w.a > 0; });
  }
  const alive = () => charge || rings.length || sparks.length || words.length || flash > .01;

  function frame(now) {
    if (!running) return;
    const dt = Math.min(.05, (now - last) / 1000 || .016); last = now;
    step(dt, now); draw(now);
    if (alive()) requestAnimationFrame(frame);
    else { running = false; ctx.clearRect(0, 0, W, H); }
  }
  function start() {
    if (running || still()) return;
    running = true; last = performance.now(); requestAnimationFrame(frame);
  }

  /* ---- 操作 ---- */
  function release(x, y) {
    if (!charge) return;
    const now = performance.now(), p = power(now);
    charge = null; chargeSound(false); boom(p);
    count += 1; store.set(KEY, count); showCount(true);
    const text = t("pop.s" + (1 + Math.floor(Math.random() * WORDS)));
    if (still()) {                                        // 動かさず、言葉だけをしばらく表示
      draw(now); ctx.clearRect(0, 0, W, H);
      words = [{ x, y, a: 1, size: 28, text }]; draw(now);
      clearTimeout(stillTimer); stillTimer = setTimeout(() => { words = []; ctx.clearRect(0, 0, W, H); }, 1800);
      return;
    }
    const n = 1 + Math.round(p * 2);
    for (let k = 0; k < n; k++) rings.push({ x, y, r: 8 - k * 14, v: 300 + p * 420 - k * 40, a: .95, w: 2.5 + p * 4 });
    const cnt = 26 + Math.round(p * 70);
    for (let k = 0; k < cnt; k++) {
      const a = rnd(0, 6.2832), v = rnd(80, 260 + p * 380);
      sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: rnd(1.4, 3.6), a: 1,
        c: Math.random() < .3 ? "rgba(255,255,255,A)" : "rgba(255,46,151,A)" });
    }
    words.push({ x, y: y - 6, a: 1.4, size: Math.round(26 + p * 26), text: p > .95 ? text + "!!" : text });
    flash = .12 + p * .4;
    buzz(p > .5 ? [30, 30, 60] : 25);
    if (!running) start();
  }

  canvas.addEventListener("pointerdown", e => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const r = canvas.getBoundingClientRect();
    charge = { x: e.clientX - r.left, y: e.clientY - r.top, t0: performance.now(), buzz: 0 };
    try { canvas.setPointerCapture(e.pointerId); } catch (x) {}
    chargeSound(true);
    if (still()) return;
    start();
  });
  canvas.addEventListener("pointermove", e => {
    if (!charge) return;
    const r = canvas.getBoundingClientRect();
    charge.x = e.clientX - r.left; charge.y = e.clientY - r.top;
  });
  canvas.addEventListener("pointerup", e => { if (charge) release(charge.x, charge.y); });
  canvas.addEventListener("pointercancel", () => { charge = null; chargeSound(false); });   // スクロールになったときは、叫ばずにやめる
  canvas.addEventListener("contextmenu", e => e.preventDefault());

  function showCount(fromRelease) {
    if (countEl) countEl.textContent = t("pop.count", { n: count });
    if (!fromRelease || !hint) return;
    const key = count === 5 ? "pop.m1" : count === 15 ? "pop.m2" : count === 30 ? "pop.m3" : "";
    if (key) {
      hint.textContent = t(key); hint.dataset.msg = key;
      clearTimeout(msgTimer);
      msgTimer = setTimeout(() => { hint.textContent = t("pop.hint"); delete hint.dataset.msg; }, 6500);
    }
  }

  if (soundBtn) {
    const paint = () => {
      soundBtn.setAttribute("aria-pressed", String(sound));
      soundBtn.setAttribute("aria-label", t(sound ? "pop.soundOn" : "pop.soundOff"));
      soundBtn.textContent = "♪";
      soundBtn.classList.toggle("is-on", sound);
    };
    soundBtn.addEventListener("click", () => { sound = !sound; store.set(SND_KEY, sound); paint(); if (sound) boom(.2); });
    document.addEventListener("langchange", paint);
    paint();
  }

  document.addEventListener("langchange", () => {
    if (hint) hint.textContent = t(hint.dataset.msg || "pop.hint");
    showCount(false);
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden && charge) { charge = null; chargeSound(false); } });
  window.addEventListener("resize", resize);
  if (window.ResizeObserver) new ResizeObserver(() => { if (Math.abs(hero.clientHeight - H) > 2 || Math.abs(hero.clientWidth - W) > 2) resize(); }).observe(hero);

  document.addEventListener("DOMContentLoaded", () => {
    if (hint) hint.textContent = t("pop.hint");
    showCount(false);
    resize();
  });
})();
