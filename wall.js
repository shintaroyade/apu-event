/* =========================================================================
 * wall.js — 「みんなのやってみたい」一覧
 *  ・CONFIG.endpoint があれば、GAS から「公開OKかつ運営が承認した」ひとことだけを取得して表示
 *  ・endpoint が空のときは、見た目の確認用にサンプル(CONFIG.wall.demo)を表示
 *  ・表示は textContent だけで行い、受け取った文字列をHTMLとして解釈しません
 *  ・♥ は「この端末で押した」記録のみ(集計はしません)
 * ========================================================================= */
(function () {
  "use strict";
  const list = document.getElementById("wallList");
  if (!list) return;
  const { t, store, reducedMotion } = window.App;
  const LIKE_KEY = "apu-event-wall-likes-v1";
  const liked = new Set(store.get(LIKE_KEY, []) || []);
  const status = document.getElementById("wallStatus");
  const demoNote = document.getElementById("wallDemo");
  let items = [];

  const clip = (s, n) => Array.from(String(s == null ? "" : s)).slice(0, n).join("");

  function setStatus(key) { status.dataset.key = key || ""; status.textContent = key ? t(key) : ""; status.hidden = !key; }

  function render() {
    list.textContent = "";
    items.forEach((it, i) => {
      const li = document.createElement("li");
      li.className = "wall-card";
      li.style.setProperty("--k", String(i % 4));
      li.style.setProperty("--d", Math.min(i, 8) * 70 + "ms");

      const q = document.createElement("p");
      q.className = "wall-card__wish";
      q.textContent = it.wish;

      const foot = document.createElement("div");
      foot.className = "wall-card__foot";
      const who = document.createElement("span");
      who.className = "wall-card__name";
      who.textContent = it.name || t("wall.anon");

      const like = document.createElement("button");
      like.type = "button";
      like.className = "wall-like";
      const id = it.id;
      const paint = () => {
        const on = liked.has(id);
        like.classList.toggle("is-on", on);
        like.setAttribute("aria-pressed", String(on));
        like.setAttribute("aria-label", t("wall.like"));
        like.textContent = "♥";
      };
      like.addEventListener("click", () => {
        if (liked.has(id)) liked.delete(id); else liked.add(id);
        store.set(LIKE_KEY, Array.from(liked));
        paint();
      });
      paint();

      foot.append(who, like);
      li.append(q, foot);
      list.appendChild(li);
    });
    observe();
  }

  function observe() {
    const cards = Array.from(list.children);
    if (reducedMotion() || !("IntersectionObserver" in window)) { cards.forEach(c => c.classList.add("is-in")); return; }
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } }), { threshold: .15 });
    cards.forEach(c => io.observe(c));
  }

  function shuffle() {
    for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
    render();
  }

  async function load() {
    const w = CONFIG.wall || {};
    if (!CONFIG.endpoint) {
      demoNote.hidden = false;
      items = (w.demo || []).map((d, i) => ({ id: "demo" + i, name: d.name, wish: d.wish }));
    } else {
      demoNote.hidden = true;
      setStatus("wall.loading");
      try {
        const res = await fetch(CONFIG.endpoint + (CONFIG.endpoint.includes("?") ? "&" : "?") + "action=wall", { redirect: "follow" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const json = await res.json();
        if (!json || json.ok === false || !Array.isArray(json.items)) throw new Error("bad response");
        items = json.items.slice(0, 120).map((d, i) => ({ id: String(d.id || "r" + i), name: clip(d.name, 20), wish: clip(d.wish, 100) })).filter(d => d.wish);
      } catch (e) {
        console.error(e);
        setStatus("wall.error");
        return;
      }
    }
    setStatus(items.length ? "" : "wall.empty");
    render();
  }

  document.getElementById("wallShuffle").addEventListener("click", shuffle);
  document.addEventListener("langchange", () => { if (status.dataset.key) setStatus(status.dataset.key); render(); });
  document.addEventListener("DOMContentLoaded", load);
})();
