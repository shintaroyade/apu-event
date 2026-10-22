/* =========================================================================
 * vote.js — 共感度投票ページの処理(軽さ優先・最小限)
 * ========================================================================= */
(function () {
  "use strict";
  const { t, loc, applyI18n, sendData, reducedMotion, store } = window.App;
  const $ = id => document.getElementById(id);

  /* 二重投票の防止について:
   * 「この端末(ブラウザ)で投票した発表者のID」を localStorage に保存し、
   * 同じ発表者には投票ボタンを押せないようにしています。
   * ただし、別のブラウザ・シークレットモード・履歴の削除などで回避できるため、
   * これは完全な防止ではなく「目安」です。集計時は deviceId 列も参考にしてください。 */
  const VOTED_KEY = "apu-event-voted-v1";
  const DEVICE_KEY = "apu-event-device-id";

  let deviceId = store.get(DEVICE_KEY, "");
  if (!deviceId) {
    deviceId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
      : "d-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    store.set(DEVICE_KEY, deviceId);
  }
  const voted = new Set(store.get(VOTED_KEY, []) || []);

  let rating = 0;
  let busy = false;

  document.addEventListener("DOMContentLoaded", () => {
    const form = $("voteForm"), select = $("vSpeaker"), hearts = $("vHearts");
    const comment = $("vComment"), submit = $("vSubmit");

    /* ---- ① 発表者リスト(config から生成) ---- */
    function buildOptions() {
      const keep = select.value;
      select.textContent = "";
      const ph = new Option(t("form.selectPlaceholder"), "");
      select.add(ph);
      [["person", "vote.groupPerson"], ["group", "vote.groupGroup"]].forEach(([type, key]) => {
        const list = CONFIG.speakers.filter(s => s.type === type);
        if (!list.length) return;
        const og = document.createElement("optgroup");
        og.label = t(key);
        list.forEach(s => {
          const label = loc(s.name) + (voted.has(s.id) ? "  " + t("vote.votedMark") : "");
          og.appendChild(new Option(label, s.id));
        });
        select.appendChild(og);
      });
      select.value = keep;
    }

    // 初期選択:config の「現在の発表者」(投票済みなら未選択)
    function initialSpeaker() {
      const cur = CONFIG.currentSpeakerId;
      return CONFIG.speakers.some(s => s.id === cur) && !voted.has(cur) ? cur : "";
    }

    function updateVotedState() {
      const isVoted = voted.has(select.value);
      $("vVoted").hidden = !isVoted;
      submit.disabled = isVoted || busy;
    }

    /* ---- ② ハート ---- */
    for (let n = 1; n <= 5; n++) {
      const label = document.createElement("label");
      label.className = "heart";
      label.innerHTML = `<input type="radio" name="rating" value="${n}"><span aria-hidden="true">♥</span>`;
      hearts.appendChild(label);
    }
    function paintHearts() {
      hearts.querySelectorAll(".heart").forEach((h, i) => {
        h.classList.toggle("is-on", i < rating);
        h.querySelector("input").setAttribute("aria-label", t("vote.heartAria", { n: i + 1 }));
      });
    }
    hearts.addEventListener("change", e => {
      rating = Number(e.target.value);
      paintHearts();
      $("vRatingErr").textContent = "";
    });

    /* ---- ③ コメント ---- */
    const countComment = () => { $("vCount").textContent = Array.from(comment.value).length + "/60"; };
    comment.addEventListener("input", countComment);

    select.addEventListener("change", () => {
      $("vSpeakerErr").textContent = "";
      select.removeAttribute("aria-invalid");
      updateVotedState();
    });

    /* ---- ④ 送信 ---- */
    form.addEventListener("submit", async e => {
      e.preventDefault();
      if (busy) return;                       // 二重送信防止
      const id = select.value;
      let ok = true;
      if (!id) { $("vSpeakerErr").textContent = t("vote.err.speaker"); select.setAttribute("aria-invalid", "true"); ok = false; }
      if (!rating) { $("vRatingErr").textContent = t("vote.err.rating"); ok = false; }
      if (!ok || voted.has(id)) return;

      const sp = CONFIG.speakers.find(s => s.id === id);
      busy = true;
      submit.disabled = true;
      submit.textContent = t("vote.sending");
      $("vSendErr").textContent = "";

      try {
        const res = await sendData("vote", {
          speakerId: sp.id,
          speakerName: loc(sp.name, "ja"),
          speakerType: sp.type === "group" ? "団体" : "個人",
          rating,
          comment: Array.from(comment.value.trim()).slice(0, 60).join(""),
          deviceId
        });
        voted.add(id);
        store.set(VOTED_KEY, Array.from(voted));
        burst(submit);
        $("vThanksTest").hidden = !res.test;
        form.hidden = true;
        $("vThanks").hidden = false;
        $("vThanks").focus();
      } catch (err) {
        console.error(err);
        $("vSendErr").textContent = t("vote.err.send");
      } finally {
        busy = false;
        submit.textContent = t("vote.submit");
        updateVotedState();
      }
    });

    /* ---- 続けて別の発表者に投票 ---- */
    $("vNext").addEventListener("click", () => {
      rating = 0;
      form.reset();
      paintHearts();
      countComment();
      buildOptions();
      select.value = initialSpeaker();
      updateVotedState();
      $("vThanks").hidden = true;
      form.hidden = false;
      select.focus();
    });

    /* ---- 言語切り替え ---- */
    document.addEventListener("langchange", () => {
      buildOptions();
      paintHearts();
      submit.textContent = t(busy ? "vote.sending" : "vote.submit");
      ["vSpeakerErr", "vRatingErr", "vSendErr"].forEach(i => { $(i).textContent = ""; });
    });

    buildOptions();
    select.value = initialSpeaker();
    paintHearts();
    updateVotedState();
  });

  /* ---- 送信時の演出:ハートが弾ける(0.8秒・視差効果を減らす設定では表示しない) ---- */
  function burst(fromEl) {
    if (reducedMotion()) return;
    const r = fromEl.getBoundingClientRect();
    const box = document.createElement("div");
    box.className = "burst";
    box.style.left = (r.left + r.width / 2) + "px";
    box.style.top = (r.top + r.height / 2) + "px";
    const N = 12;
    for (let i = 0; i < N; i++) {
      const h = document.createElement("i");
      const a = (Math.PI * 2 * i) / N + Math.random() * .4;
      const d = 70 + Math.random() * 60;
      h.textContent = "♥";
      h.style.setProperty("--x", Math.cos(a) * d + "px");
      h.style.setProperty("--y", Math.sin(a) * d + "px");
      h.style.setProperty("--r", (Math.random() * 60 - 30) + "deg");
      h.style.fontSize = (18 + Math.random() * 16) + "px";
      box.appendChild(h);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 900);
  }
})();
