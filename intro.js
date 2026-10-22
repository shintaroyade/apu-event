/* =========================================================================
 * intro.js — 読み込み時のオープニング「世界から、この丘へ」(約13秒)
 *
 *   0.0  世界のあいさつがパパパッと切り替わる(Hello / こんにちは / 你好 / 안녕하세요 …)
 *   1.1  点でできた地球が現れ、「言葉にしない想いは、存在しないのと同じだ」
 *   3.7  APUの国際学生の出身国(在籍数の多い上位10の国)から、別府へ光の線が集まる
 *        「118の国・地域」「学生の約半数が国際学生」(APU公式・2025年11月1日時点)
 *   4.6  日本・九州・別府へ、ぐんぐん近づく
 *   8.3  別府の湯けむりが立ちのぼり、APUに光が落ちる(鶴見岳・別府湾の目印)
 *   9.3  世界の言葉で「やってみたい」が飛び出す
 *   9.9  「あなたのやりたいを聴かせてください」+ 参加・登壇ボタン
 *
 *  ・「スキップ」「サイトを見る」でいつでも閉じられます。同じ端末では6時間に1回だけ表示
 *    (index.html?intro=1 でいつでも再生)
 *  ・「視差効果を減らす」設定のときは表示しません
 *  ・地表は、画面を同じ間隔の点で埋め、各点が陸か海かを陸地データ(earth-data.js)で調べて描きます
 *  ・出典:学生数と出身国はAPU公式「Student Enrollment by Country/Region」(2025年11月1日)
 * ========================================================================= */
(function () {
  "use strict";
  const root = document.documentElement;
  const el = document.getElementById("intro");
  if (!el) return;
  const { t, store, reducedMotion, speakerOpen } = window.App;
  const KEY = "apu-event-intro-v1";

  function close(save) {
    if (save) store.set(KEY, Date.now());
    root.classList.remove("intro-on");
    el.remove();
  }
  if (!root.classList.contains("intro-on") || !window.EARTH_LEVELS || reducedMotion()) { close(false); return; }

  /* ---------- 陸地データ ---------- */
  const levels = window.EARTH_LEVELS.map(L => {
    const bin = atob(L.data), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { lon0: L.lon0, lat1: L.lat1, d: L.d, nx: L.nx, ny: L.ny, bytes };
  });
  function bit(L, lon, lat) {
    const x = Math.floor((lon - L.lon0) / L.d), y = Math.floor((L.lat1 - lat) / L.d);
    if (x < 0 || y < 0 || x >= L.nx || y >= L.ny) return -1;
    const i = y * L.nx + x;
    return (L.bytes[i >> 3] >> (7 - (i & 7))) & 1;
  }
  function isLand(lon, lat) {
    let res = -1;
    for (let k = 0; k < levels.length; k++) { const b = bit(levels[k], lon, lat); if (b >= 0) res = b; }
    return res < 0 ? 0 : res;
  }

  /* ---------- 画面 ---------- */
  const $ = id => document.getElementById(id);
  const canvas = $("introCanvas"), ctx = canvas.getContext("2d");
  let W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = el.clientWidth; H = el.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const bottomEl = document.getElementById("introBottom");
  function layout() {
    const bt = bottomEl.getBoundingClientRect().top;
    const stack = 30 + 32 + 10 + 38 + 8 + 62 + 10;   // 地名の札・説明・2本の帯の高さ
    CY = Math.max(H * .2, Math.min(H * .5, bt * .6, bt - stack));
    place.style.top = (CY + 30) + "px"; greet.style.top = CY + "px";
    const capTop = CY + 30 + (place.offsetHeight || 32) + 10;
    capEl.style.top = capTop + "px"; bandsEl.style.top = (capTop + (capEl.offsetHeight || 36) + 8) + "px";
  }
  window.addEventListener("resize", () => { resize(); layout(); });

  const ja = (document.documentElement.lang || "ja") !== "en";
  function buildLine(node, text) {
    node.textContent = "";
    let i = 0;
    text.split("\n").forEach((row, r) => {
      if (r) node.appendChild(document.createElement("br"));
      const units = ja ? Array.from(row) : row.split(" ");
      units.forEach((u, k) => {
        const s = document.createElement("span");
        s.className = "ch"; s.style.setProperty("--i", String(i++)); s.textContent = u;
        node.appendChild(s);
        if (!ja && k < units.length - 1) node.appendChild(document.createTextNode(" "));
      });
    });
  }
  const L1 = $("introL1"), L2 = $("introL2"), L3 = $("introL3");
  buildLine(L1, t("intro.l1")); buildLine(L2, t("intro.l2")); buildLine(L3, t("intro.l3"));
  const place = $("introPlace"); place.textContent = t("intro.place");
  const capEl = $("introCap"), flagsEl = $("introFlags"), bandsEl = $("introBands"), helloEl = $("introHello");
  // 国旗の絵文字が表示できる端末だけ、国旗の流れる帯を出す(出せない端末では文字になってしまうため)
  const FLAGS = ["🇲🇲", "🇮🇩", "🇨🇳", "🇰🇷", "🇧🇩", "🇹🇭", "🇻🇳", "🇮🇳", "🇲🇳", "🇳🇵", "🇯🇵"];
  (function () {
    let ok = false;
    try {
      const c = document.createElement("canvas").getContext("2d"); c.font = "20px sans-serif";
      const f = c.measureText("🇯🇵").width, a = c.measureText("🇯").width + c.measureText("🇵").width;
      ok = f < a * .85;
    } catch (e) { ok = false; }
    if (!ok) { flagsEl.remove(); return; }
    const tr = flagsEl.firstElementChild;
    [0, 1].forEach(() => FLAGS.forEach(f => { const b = document.createElement("span"); b.textContent = f; tr.appendChild(b); }));
  })();
  // 「こんにちは」を世界の言葉で流す帯
  function buildHello() {
    const tr = helloEl.firstElementChild;
    [0, 1].forEach(() => GREET.forEach(g => { const b = document.createElement("span"); b.textContent = g; tr.appendChild(b); }));
  }
  const stat = $("introStat"), num = $("introNum"), fin = $("introFinal"), greet = $("introGreet");
  const speakerBtn = $("introCtaSpeaker");
  speakerBtn.hidden = !speakerOpen();

  /* ---------- あいさつ(APUの学生の出身国で多い言語) ---------- */
  const GREET = ["Hello", "こんにちは", "你好", "안녕하세요", "Halo", "မင်္ဂလာပါ", "สวัสดี", "Xin chào", "নমস্কার", "Сайн уу", "नमस्ते"];
  /* ---------- 世界の言葉で「やってみたい」 ---------- */
  const WISH = ["やってみたい", "I want to try", "我想试试", "해보고 싶어", "Aku ingin mencoba", "อยากลอง", "Tôi muốn thử", "চেষ্টা করতে চাই", "Би оролдож үзмээр байна", "စမ်းကြည့်ချင်တယ်", "प्रयास गर्न चाहन्छु"];

  /* ---------- 場所と、国際学生の出身(在籍数の上位10の国の首都など) ---------- */
  const APU = { lat: 33.2796, lon: 131.4761 };
  const ORIGINS = [[13.4, 144.8], [-17.7, 178.0], [21.3, -157.8], [-33.9, 151.2], [14.6, 121.0], [1.35, 103.8], [-6.2, 106.85], [16.8, 96.15], [23.81, 90.41], [27.7, 85.32], [28.6, 77.2], [13.75, 100.5], [21.03, 105.85], [39.9, 116.4], [47.9, 106.9], [62.0, 129.7], [43.1, 131.9], [37.57, 126.98]];
  const TAGS = [
    { id: "introTagTsurumi", lat: 33.286, lon: 131.4275 },      // 鶴見岳
    { id: "introTagBay", lat: 33.295, lon: 131.536 },           // 別府湾
    { id: "introTagSteam", lat: 33.3175, lon: 131.4735 }        // 鉄輪(湯けむり)
  ];
  const STEAM = [[33.3175, 131.4735], [33.3258, 131.472], [33.287, 131.504]];

  /* ---------- 時間の流れ(ミリ秒) ---------- */
  const T = {
    greet: 2700, earthIn: 2600, rot0: 2600, rot1: 6500,
    l1On: 3400, l1Off: 6300, arc0: 5200, arc1: 9000, statOn: 5400, statOff: 10000,
    l2On: 6700, l2Off: 10300, zoom0: 6100, zoom1: 10900, steam0: 9700, pin: 10600, words0: 10800,
    finalOn: 11400
  };
  const D2R = Math.PI / 180;
  const ease = u => u * u * (3 - 2 * u);
  const easeIO = u => (u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const easeOut = u => 1 - Math.pow(1 - u, 3);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let CY = 0;
const R0 = () => Math.min(W * .42, CY * .8);
  const RT = () => (W / 2) / .0016;

  const vec = (lat, lon) => [Math.cos(lat * D2R) * Math.cos(lon * D2R), Math.cos(lat * D2R) * Math.sin(lon * D2R), Math.sin(lat * D2R)];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const stars = Array.from({ length: 90 }, (_, i) => ({ x: Math.sin(i * 91.7) * .5 + .5, y: Math.sin(i * 47.3 + 2) * .5 + .5, a: .25 + (i % 5) * .12 }));
  const apuV = vec(APU.lat, APU.lon);
  const arcs = ORIGINS.map((o, i) => ({ v: vec(o[0], o[1]), at: T.arc0 + i * 130 }));

  // 球の上の2点を、少し持ち上げた弧でつなぐ点
  function arcPoint(a, b, s) {
    const d = clamp(dot(a, b), -1, 1), om = Math.acos(d), so = Math.sin(om) || 1;
    const k1 = Math.sin((1 - s) * om) / so, k2 = Math.sin(s * om) / so, h = 1 + .24 * Math.sin(Math.PI * s) * Math.min(1, om * 1.4);
    return [(a[0] * k1 + b[0] * k2) * h, (a[1] * k1 + b[1] * k2) * h, (a[2] * k1 + b[2] * k2) * h];
  }

  // 画面に投影する(いまの視点:緯度経度 latC, lonC / 半径 R)
  function makeProjector(latC, lonC, R, cx, cy) {
    const c = vec(latC, lonC);
    const e = [-Math.sin(lonC * D2R), Math.cos(lonC * D2R), 0];
    const n = [-Math.sin(latC * D2R) * Math.cos(lonC * D2R), -Math.sin(latC * D2R) * Math.sin(lonC * D2R), Math.cos(latC * D2R)];
    return p => [cx + R * dot(p, e), cy - R * dot(p, n), dot(p, c)];
  }

  let t0 = 0, raf = 0, done = false, steam = [], lastSteam = 0, greetIdx = -1;
  const flags = {};
  function toggle(node, key, on, cls) { if (flags[key] !== on) { flags[key] = on; node.classList.toggle(cls || "is-on", on); } }

  /* 世界の言葉(やってみたい)を、ピンのまわりに並べる */
  const wordsBox = $("introWords");
  function buildWords(cx, cy) {
    wordsBox.textContent = "";
    const rx = Math.min(W * .38, 160);
    const n = Math.max(3, Math.min(WISH.length, Math.floor((cy - 190) / 17) + 1));
    WISH.slice(0, n).forEach((w, i) => {
      const side = i % 2 ? 1 : -1, x = side * (rx * .34 + (i % 3) * 14 + (i > 6 ? 6 : 0)), y = -118 - i * 17;
      const s = document.createElement("span");
      s.className = "intro__word"; s.textContent = w;
      s.style.left = cx + "px"; s.style.top = cy + "px";
      s.style.setProperty("--dx", x.toFixed(1) + "px"); s.style.setProperty("--dy", (y - 10).toFixed(1) + "px");
      s.style.transitionDelay = (i * 120) + "ms";
      wordsBox.appendChild(s);
    });
  }

  function frame(now) {
    if (done) return;
    const tt = now - t0;

    // あいさつ
    if (tt < T.greet) {
      const idx = Math.min(GREET.length - 1, Math.floor(tt / (T.greet / GREET.length - 0)));
      if (idx !== greetIdx) { greetIdx = idx; greet.textContent = GREET[idx]; greet.classList.remove("is-pop"); void greet.offsetWidth; greet.classList.add("is-pop"); }
    }
    toggle(greet, "greet", tt < T.greet, "is-live");

    // 文字
    toggle(L1, "l1", tt >= T.l1On && tt < T.l1Off); toggle(L2, "l2", tt >= T.l2On && tt < T.l2Off);
    toggle(stat, "stat", tt >= T.statOn && tt < T.statOff);
    toggle(place, "place", tt >= T.pin - 200); toggle(capEl, "cap", tt >= T.pin + 500); toggle(bandsEl, "bands", tt >= T.pin + 900);
    toggle(fin, "fin", tt >= T.finalOn);
    toggle(L3, "l3", tt >= T.finalOn);
    if (tt >= T.statOn) num.textContent = String(Math.round(118 * easeOut(clamp((tt - T.statOn - 150) / 1300, 0, 1))));

    // カメラ
    const rot = easeIO(clamp((tt - T.rot0) / (T.rot1 - T.rot0), 0, 1));
    const latC = 14 + (APU.lat - 14) * rot, lonC = -75 + (APU.lon + 75) * rot;
    const zu = ease(clamp((tt - T.zoom0) / (T.zoom1 - T.zoom0), 0, 1));
    const r0 = R0(), rt = RT();
    const R = r0 * Math.exp(Math.log(rt / r0) * Math.pow(zu, 1.15));
    draw(tt, latC, lonC, R, zu);

    raf = requestAnimationFrame(frame);
  }

  function draw(tt, latC, lonC, R, zu) {
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = CY;
    if (tt < T.earthIn - 100) return;
    const fadeIn = ease(clamp((tt - T.earthIn) / 1100, 0, 1));
    ctx.globalAlpha = fadeIn;
    const proj = makeProjector(latC, lonC, R, cx, cy);

    // 星
    const sa = clamp(1 - zu * 4, 0, 1);
    if (sa > 0) { ctx.fillStyle = "#fff"; stars.forEach(s => { ctx.globalAlpha = s.a * sa * fadeIn; ctx.fillRect(s.x * W, s.y * H, 1.4, 1.4); }); ctx.globalAlpha = fadeIn; }

    // 地球のふち
    if (R < Math.max(W, H) * 1.2) {
      const g = ctx.createRadialGradient(cx, cy, R * .9, cx, cy, R * 1.25);
      g.addColorStop(0, "rgba(255,46,151,.24)"); g.addColorStop(1, "rgba(255,46,151,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.25, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = "rgba(255,46,151,.6)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.stroke();
    }

    // 点で描く地表
    const step = 6, sinP = Math.sin(latC * D2R), cosP = Math.cos(latC * D2R);
    const landX = [], landY = [], landA = [], seaX = [], seaY = [];
    const x0 = cx - Math.floor(cx / step) * step, y0 = cy - Math.floor(cy / step) * step;
    for (let sy = y0; sy < H; sy += step) {
      for (let sx = x0; sx < W; sx += step) {
        const x = (sx - cx) / R, y = -(sy - cy) / R, rho2 = x * x + y * y;
        if (rho2 > .9985) continue;
        const rho = Math.sqrt(rho2), c = Math.asin(rho), sc = Math.sin(c), cc = Math.cos(c);
        let lat, lon;
        if (rho < 1e-9) { lat = latC; lon = lonC; }
        else {
          lat = Math.asin(cc * sinP + (y * sc * cosP) / rho) / D2R;
          lon = lonC + Math.atan2(x * sc, rho * cosP * cc - y * sinP * sc) / D2R;
        }
        if (lon > 180) lon -= 360; else if (lon < -180) lon += 360;
        if (isLand(lon, lat)) { landX.push(sx); landY.push(sy); landA.push(.35 + .65 * cc); }
        else { seaX.push(sx); seaY.push(sy); }
      }
    }
    ctx.fillStyle = "rgba(150,140,200,.16)";
    ctx.beginPath(); for (let i = 0; i < seaX.length; i++) ctx.rect(seaX[i] - .6, seaY[i] - .6, 1.2, 1.2); ctx.fill();
    const rad = 1.25 + zu * .45, dim = 1 - .6 * zu * zu;
    for (let a = 0; a < 3; a++) {
      ctx.fillStyle = "rgba(255,46,151," + ([.45, .75, 1][a] * dim).toFixed(3) + ")";
      ctx.beginPath();
      for (let i = 0; i < landX.length; i++) {
        const k = landA[i] < .62 ? 0 : landA[i] < .88 ? 1 : 2;
        if (k !== a) continue;
        ctx.moveTo(landX[i] + rad, landY[i]); ctx.arc(landX[i], landY[i], rad, 0, 6.2832);
      }
      ctx.fill();
    }

    // 世界から別府へ集まる光の線
    const fade = 1 - ease(clamp((tt - 7600) / (T.zoom1 + 900 - 7600), 0, 1));
    if (tt > T.arc0 && fade > 0) {
      ctx.lineCap = "round";
      arcs.forEach(a => {
        const p = clamp((tt - a.at) / 1500, 0, 1); if (p <= 0) return;
        const head = easeOut(p), N = 34;
        let prev = null;
        for (let k = 0; k <= N; k++) {
          const s = (k / N) * head;
          const q = proj(arcPoint(a.v, apuV, s));
          if (q[2] > 0 && prev) {
            const f = k / N;
            ctx.strokeStyle = "rgba(255," + Math.round(120 + 135 * f) + "," + Math.round(190 + 65 * f) + "," + (.18 + .75 * f * fade).toFixed(3) + ")";
            ctx.lineWidth = 1 + 1.6 * f; ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
          }
          prev = q[2] > 0 ? q : null;
        }
        const o = proj(a.v);                              // 出発地の点
        if (o[2] > 0) { ctx.fillStyle = "rgba(255,255,255," + (.9 * fade).toFixed(3) + ")"; ctx.beginPath(); ctx.arc(o[0], o[1], 2.4, 0, 6.2832); ctx.fill(); }
        if (p < 1) { const h = proj(arcPoint(a.v, apuV, head)); if (h[2] > 0) { ctx.shadowColor = "#ff2e97"; ctx.shadowBlur = 14; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(h[0], h[1], 3, 0, 6.2832); ctx.fill(); ctx.shadowBlur = 0; } }
      });
    }

    // 近づくほど下を暗くして、文字を読みやすく
    if (zu > .5) {
      const k = clamp((zu - .5) / .5, 0, 1), g = ctx.createLinearGradient(0, H * .35, 0, H);
      g.addColorStop(0, "rgba(5,5,10,0)"); g.addColorStop(1, "rgba(5,5,10," + (.93 * k).toFixed(3) + ")");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }

    // 別府の湯けむり
    if (tt > T.steam0) {
      if (tt - lastSteam > 70) {
        lastSteam = tt;
        STEAM.forEach(s => { const q = proj(vec(s[0], s[1])); steam.push({ x: q[0] + (Math.random() - .5) * 8, y: q[1], r: 3 + Math.random() * 3, life: 0, sway: Math.random() * 6 }); });
      }
      steam = steam.filter(p => p.life < 1);
      steam.forEach(p => {
        p.life += .012; p.y -= .55 + p.life * .6; p.r += .22;
        const x = p.x + Math.sin(p.sway + p.life * 7) * 6 * p.life;
        const a = (.34 * Math.sin(Math.PI * Math.min(1, p.life))).toFixed(3);
        const g = ctx.createRadialGradient(x, p.y, 0, x, p.y, p.r);
        g.addColorStop(0, "rgba(255,225,240," + a + ")"); g.addColorStop(1, "rgba(255,225,240,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, p.y, p.r, 0, 6.2832); ctx.fill();
      });
    }

    // APUに波紋とピン
    if (tt > T.pin) {
      const q = tt - T.pin;
      for (let k = 0; k < 3; k++) {
        if (q - k * 700 < 0) continue;
        const ph = ((q - k * 700) % 2100) / 2100;
        ctx.strokeStyle = "rgba(255,255,255," + (.75 * (1 - ph)).toFixed(3) + ")"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(cx, cy, 8 + ph * Math.min(W, H) * .34, 0, 6.2832); ctx.stroke();
      }
      const pop = clamp(q / 500, 0, 1), bounce = 1 + .25 * Math.sin(pop * Math.PI);
      ctx.shadowColor = "#ff2e97"; ctx.shadowBlur = 26;
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx, cy, 5 * pop * bounce, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = "#ff2e97"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 13 * pop * bounce, 0, 6.2832); ctx.stroke();
      ctx.shadowBlur = 0;
      // 目印のラベル(鶴見岳・別府湾・鉄輪)
      TAGS.forEach(tag => {
        const node = $(tag.id), p = proj(vec(tag.lat, tag.lon));
        node.style.left = p[0].toFixed(1) + "px"; node.style.top = p[1].toFixed(1) + "px";
        if (!flags[tag.id]) { flags[tag.id] = true; node.classList.add("is-on"); }
      });
    }
    ctx.globalAlpha = 1;
  }

  function finish(save) {
    if (done) return; done = true;
    cancelAnimationFrame(raf);
    el.classList.add("is-out");
    store.set(KEY, Date.now());
    setTimeout(() => close(true), 700);
  }
  $("introSkip").addEventListener("click", () => finish());
  $("introEnter").addEventListener("click", () => finish());
  el.addEventListener("click", e => { if (e.target.closest("a")) store.set(KEY, Date.now()); });
  el.querySelectorAll(".intro__final a[href^='#']").forEach(a => a.addEventListener("click", () => finish()));
  document.addEventListener("keydown", e => { if (e.key === "Escape") finish(); });

  buildHello(); resize(); layout(); setTimeout(layout, 300);
  t0 = performance.now();
  raf = requestAnimationFrame(frame);
  try { $("introSkip").focus({ preventScroll: true }); } catch (e) { /* 何もしない */ }
})();
