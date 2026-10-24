/* =========================================================================
 * 設定ファイル(CONFIG)
 * -------------------------------------------------------------------------
 * 日程・会場・発表者・問い合わせ先・送信先など「変わる可能性のある情報」は
 * すべてここに集めています。基本的にはこのファイルだけ書き換えれば更新できます。
 *
 * ・{ ja: "...", en: "..." } の形の項目は、日本語/英語それぞれを書き換えてください。
 * ・「【 】」はまだ決まっていない情報のプレースホルダーです。決まったら置き換えてください。
 * ========================================================================= */
const CONFIG = {

  /* ---------- イベント基本情報 ---------- */
  event: {
    name: {
      ja: "UNMUTE to ACTION",
      en: "UNMUTE to ACTION"
    },
    // キャッチコピー(トップのロゴの下に表示)
    tagline: {
      ja: "その声で次をつくれ",
      en: "Make what's next with your voice"
    },
    subtitle: {
      ja: "〜その声で次をつくれ〜",
      en: "~ Turn your voice into what's next ~"
    },
    date: {
      ja: "2026年12月上旬\n(日時は決まり次第発表します)",
      en: "Early December 2026\n(Date & time to be announced)"
    },
    venue: {
      ja: "APU J101教室(予定)",
      en: "APU Room J101 (planned)"
    }
  },

  /* ---------- 主催者・問い合わせ先 ---------- */
  organizer: {
    name: { ja: "森山慎太郎", en: "Shintaro Moriyama" },
    instagram: "@nextsparkjapan / @shintaroyade",
    instagrams: [
      { label: "@nextsparkjapan", url: "https://www.instagram.com/nextsparkjapan/" },
      { label: "@shintaroyade",   url: "https://www.instagram.com/shintaroyade/" }
    ],
    instagramUrl: "",                        // 例: "https://www.instagram.com/xxxx/"(空ならリンクにしない)
    email: "nextsparkjapan@gmail.com"               // 例: "xxxx@example.com"
  },

  /* ---------- リンク ---------- */
  links: {
    // 登壇公募フォームのURL。空のままなら「問い合わせ先」セクションへ移動します。
    speakerCall: ""
  },

  /* ---------- 送信先(Google Apps Script ウェブアプリのURL) ----------
   * 空文字("")の間は「テストモード」:送信内容をブラウザのコンソールに出すだけで、
   * どこにも送信しません。GASをデプロイしたら、発行された /exec のURLを貼ってください。
   * 例: "https://script.google.com/macros/s/XXXXXXXX/exec"
   */
  endpoint: "https://script.google.com/macros/s/AKfycby52x8HCH-GQjHI4rfLXNFXdA_mSjzWa-ioukG7xRTFMxlz_fATW73Y0GuvcFhFc3KB/exec",

  /* ---------- 共感度投票:現在の発表者 ----------
   * 下の speakers の id を指定すると、投票画面を開いたときの初期選択になります。
   * 当日は発表が切り替わるたびに、ここを書き換えて再アップロードしてください。
   */
  currentSpeakerId: "p1",

  /* ---------- 発表者リスト(個人:最大10人 + 団体) ----------
   * type: "person"(個人プレゼン) / "group"(サークル・団体プレゼン)
   * id は投票の記録に使うので、一度決めたら途中で変えないでください。
   */
  speakers: [
    { id: "p1",  type: "person", name: { ja: "【発表者1】",  en: "【Speaker 1】" } },
    { id: "p2",  type: "person", name: { ja: "【発表者2】",  en: "【Speaker 2】" } },
    { id: "p3",  type: "person", name: { ja: "【発表者3】",  en: "【Speaker 3】" } },
    { id: "p4",  type: "person", name: { ja: "【発表者4】",  en: "【Speaker 4】" } },
    { id: "p5",  type: "person", name: { ja: "【発表者5】",  en: "【Speaker 5】" } },
    { id: "p6",  type: "person", name: { ja: "【発表者6】",  en: "【Speaker 6】" } },
    { id: "p7",  type: "person", name: { ja: "【発表者7】",  en: "【Speaker 7】" } },
    { id: "p8",  type: "person", name: { ja: "【発表者8】",  en: "【Speaker 8】" } },
    { id: "p9",  type: "person", name: { ja: "【発表者9】",  en: "【Speaker 9】" } },
    { id: "p10", type: "person", name: { ja: "【発表者10】", en: "【Speaker 10】" } },
    { id: "g1",  type: "group",  name: { ja: "【団体名1】",  en: "【Group 1】" } },
    { id: "g2",  type: "group",  name: { ja: "【団体名2】",  en: "【Group 2】" } }
  ],

  /* ---------- タイムテーブル(約3時間) ----------
   * id は i18n.js の文言(tt.<id>.name / .what / .you)と対応しています。
   * min は所要時間(分)。幅があるものは言語ごとに書いています。
   * kind は色分け用: talk(プレゼン) / group(団体) / mingle(交流) / other
   */
  timetable: [
    { id: "opening", min: "10", kind: "other" },
    { id: "talk1",   min: "30", kind: "talk" },
    { id: "change",  min: "5",  kind: "other" },
    { id: "talk2",   min: "30", kind: "talk" },
    { id: "break",   min: "10", kind: "other" },
    { id: "group",   min: "25", kind: "group" },
    { id: "mingle",  min: "40", kind: "mingle" },
    { id: "closing", min: "10", kind: "other" }
  ],

  /* ---------- 登壇者募集(個人プレゼン) ----------
   * open: false にすると、応募フォームを閉じて「受付終了」の表示に切り替わります。
   * deadline: 応募締切の表示(日本語/英語)。
   * 外部フォーム(Googleフォームなど)で受け付けたい場合は、上の links.speakerCall にURLを入れると、
   * ページ内のフォームの代わりに「応募フォームを開く」ボタンが表示されます。
   */
  speaker: {
    open: true,
    // 募集締切(日本時間)。この日時を過ぎると、募集は自動で「受付終了」の表示になります。
    deadlineDate: "2026-10-31T23:59:59+09:00",
    // 画面に表示する締切の文言
    deadline: { ja: "10月31日(土)まで", en: "By Oct 31 (Sat)" }
  },

  /* ---------- 準備中のカード(ノックして開くロックカード) ----------
   * locked: true  → ロック表示。5回タップすると、ヒントと公開予定が見えます(中身はまだ公開しません)。
   * locked: false → ロックが外れ、content(日本語/英語)がそのまま表示されます。
   * 決まった情報から順に、locked を false にして content を書いてください。
   * eta は公開予定の表示です。ヒント文は i18n.js の lk.<id>.hint にあります。
   * 表示順は、この配列の順番です。不要なカードは行ごと削除してください。
   */
  teasers: [
    { id: "venue",    locked: true, eta: { ja: "決まり次第、ここで公開します", en: "Revealed here as soon as it's set" }, content: { ja: "", en: "" } },
    { id: "speakers", locked: true, eta: { ja: "登壇者が決まり次第、公開します", en: "Revealed once the presenters are set" }, content: { ja: "", en: "" } },
    { id: "guests",   locked: true, eta: { ja: "決まり次第、ここで公開します", en: "Revealed here as soon as it's set" }, content: { ja: "", en: "" } },
    { id: "mingle",   locked: true, eta: { ja: "イベントが近づいたら公開します", en: "Revealed closer to the event" }, content: { ja: "", en: "" } }
  ],

  /* ---------- 「みんなのやってみたい」(wall.html) ----------
   * 送信先(endpoint)が未設定のとき、見た目の確認用に出すサンプルです。
   * 送信先を設定すると、参加申込で「掲載OK」にして、運営が承認したひとことだけが表示されます。 */
  wall: {
    demo: [
      { name: "あぷたろう", wish: "地域の人と一緒に、小さなイベントをつくってみたい" },
      { name: "Mina", wish: "留学で見た景色を、ちゃんと言葉にして伝えたい" },
      { name: "ゆうと", wish: "ずっと気になっていた起業サークルに、まず顔を出してみる" },
      { name: "Ken", wish: "Start a podcast about life at APU" },
      { name: "さくら", wish: "人前で話すのが苦手だから、まず1分だけ話してみたい" },
      { name: "りく", wish: "ひとり旅で出会った人たちのことを、誰かに話したい" },
      { name: "Aya", wish: "自分の「好き」を仕事にする方法を探したい" },
      { name: "はると", wish: "学内でフリーマーケットを開いてみたい" }
    ]
  },

  /* ---------- 表示言語の初期値("ja" または "en") ---------- */
  defaultLang: "ja"
};
