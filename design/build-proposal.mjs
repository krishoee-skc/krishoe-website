import { readFileSync, writeFileSync } from "node:fs";

/**
 * The proposal as one ordinary web page — and its language switch WORKS.
 *
 * Two things the earlier version could not do: it needed a claude.ai sign-in,
 * and its language button was a picture of a button. Both are fixed here.
 *
 * Every screen is shown as a PC/phone PAIR, because the owner asked for both
 * everywhere rather than some on one and some on the other. A screen that only
 * exists on one is shown alone and says so.
 *
 * Run: node design/build-proposal.mjs (from the repo root, or beside the
 * .dc.html files). It writes public/krishoe-design.html.
 */
const pairs = [
  {
    ne: "हिसाब — पसलले के भन्दैछ",
    en: "Report — what the shop is saying",
    noteNe: "११ वटै एउटै ठाउँमा, menu मा 'हिसाब · Report'। बैजनी रङ = app ले आफैँ भेटेको कुरा।",
    noteEn: "All eleven in one place, in the main menu. Purple marks what the app worked out on its own.",
    desktop: "Analysis.dc.html",
    phone: "AnalysisPhone.dc.html",
  },
  {
    ne: "कहाँबाट आयो + लिङ्क बनाउने",
    en: "Where they came from + the link maker",
    noteNe: "Facebook कि Instagram छुट्याउने। पर्चा टाँस्न QR पनि।",
    noteEn: "Splits Facebook from Instagram. A QR code for printed flyers too.",
    desktop: "Channels.dc.html",
    phone: null,
  },
  {
    ne: "भाषाको बटन",
    en: "The language switch",
    noteNe: "माथिको बटन साँच्चै चल्छ — थिचेर हेर्नुहोस्।",
    noteEn: "The switch at the top of this page is real — press it.",
    desktop: "Switch.dc.html",
    phone: null,
  },
  {
    ne: "पसल",
    en: "The shop",
    noteNe: "ग्राहकले देख्ने पाना।",
    noteEn: "What a shopper sees.",
    desktop: "ShopDesktop.dc.html",
    phone: "ShopPhone.dc.html",
  },
  {
    ne: "मालिकको",
    en: "The owner",
    noteNe: "माथि एउटै ठूलो सङ्ख्या — आजको बिक्री।",
    noteEn: "One number at the top: today's takings.",
    desktop: "Owner.dc.html",
    phone: "OwnerPhone.dc.html",
  },
  {
    ne: "Staff को",
    en: "The counter",
    noteNe: "जे गर्न पाइन्छ त्यति मात्र। उधारो छुट्टै टाइलमा।",
    noteEn: "Only what this role may do. Credit gets its own tile.",
    desktop: "Staff.dc.html",
    phone: "StaffPhone.dc.html",
  },
  {
    ne: "कारखाना",
    en: "The factory",
    noteNe: "थिच्नुअघि नै ज्याला देखिन्छ।",
    noteEn: "The wage is shown before the button is pressed.",
    desktop: null,
    phone: "Factory.dc.html",
  },
  {
    ne: "ग्राहकको खाता",
    en: "The customer account",
    noteNe: "अर्डर कहाँ पुग्यो — एउटै प्रश्नको जवाफ।",
    noteEn: "Where are my shoes — the one question, answered.",
    desktop: null,
    phone: "Customer.dc.html",
  },
  {
    ne: "रङ",
    en: "Colour",
    noteNe: "पहिले र पछि सँगै।",
    noteEn: "Before and after, side by side.",
    desktop: "Palette.dc.html",
    phone: null,
  },
  {
    ne: "अक्षर र शब्दकोश",
    en: "Type and the glossary",
    noteNe: "नेपालीलाई पहिलो पटक आफ्नै font।",
    noteEn: "A typeface for the Nepali, for the first time.",
    desktop: "Main.dc.html",
    phone: null,
  },
];

let styles = "";
let fontLink = "";
const seen = new Set();

function board(file) {
  if (!file) return null;
  const source = readFileSync(file, "utf8");
  const scope = file.replace(".dc.html", "").toLowerCase();
  const helmet = source.match(/<helmet>([\s\S]*?)<\/helmet>/)?.[1] ?? "";

  // Each artboard's CSS is scoped to its own id so ten of them can share one
  // document without one board's `body {}` rule repainting the page.
  if (!seen.has(scope)) {
    seen.add(scope);
    styles += helmet
      .replace(/<link[^>]*>/g, (link) => {
        fontLink = link;
        return "";
      })
      .replace(
        /<style>([\s\S]*?)<\/style>/g,
        (_, css) =>
          `<style>${css.replace(/(^|\})\s*([^{}@]+)\{/g, (whole, brace, selector) =>
            selector.trim().startsWith("@")
              ? whole
              : `${brace} #${scope} ${selector.trim().replace(/^body$/, "")} {`,
          )}</style>`,
      );
  }

  const body =
    source
      .match(/<x-dc>([\s\S]*?)<\/x-dc>/)?.[1]
      ?.replace(/<helmet>[\s\S]*?<\/helmet>/, "") ?? "";

  return { scope, body };
}

let sections = "";
for (const pair of pairs) {
  const desktop = board(pair.desktop);
  const phone = board(pair.phone);

  const frames = [
    desktop &&
      `<figure class="frame"><figcaption><span class="tag">PC</span></figcaption><div class="scroller"><div id="${desktop.scope}">${desktop.body}</div></div></figure>`,
    phone &&
      `<figure class="frame phone"><figcaption><span class="tag"><span data-ne>मोबाइल</span><span data-en hidden>PHONE</span></span></figcaption><div class="scroller"><div id="${phone.scope}">${phone.body}</div></div></figure>`,
  ]
    .filter(Boolean)
    .join("");

  sections += `
  <section class="board">
    <header class="board-head">
      <h2><span data-ne>${pair.ne}</span><span data-en hidden>${pair.en}</span></h2>
      <p><span data-ne>${pair.noteNe}</span><span data-en hidden>${pair.noteEn}</span></p>
    </header>
    <div class="frames">${frames}</div>
  </section>`;
}

const page = `<!doctype html>
<html lang="ne" data-lang="ne">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>KRISHOE — डिजाइन प्रस्ताव</title>
${fontLink}
${styles}
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #F4F2ED; font-family: "Mukta", "Inter", "Segoe UI", Arial, sans-serif; color: #10231D; letter-spacing: 0.3px; }

  .top { position: sticky; top: 0; z-index: 20; background: #10231D; padding: 11px 20px; display: flex; align-items: center; justify-content: space-between; gap: 14px; }
  .mark { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .mark .k { width: 30px; height: 30px; flex-shrink: 0; border-radius: 999px; border: 1px solid rgba(200,160,77,.55); display: inline-flex; align-items: center; justify-content: center; color: #C8A04D; font-weight: 700; font-size: 13px; }
  .mark strong { font-family: "Inter", sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 2.6px; color: #fff; }

  .switch { display: inline-flex; align-items: stretch; height: 42px; flex-shrink: 0; border: 1px solid #C8A04D; border-radius: 999px; overflow: hidden; }
  .switch button { appearance: none; border: 0; cursor: pointer; font: inherit; font-weight: 700; font-size: 13.5px; padding: 0 18px; display: inline-flex; align-items: center; gap: 7px; background: transparent; color: #9baba3; transition: background .18s ease, color .18s ease; }
  .switch button:hover { color: #fff; }
  .switch button[aria-pressed="true"] { background: #C8A04D; color: #10231D; }
  .switch svg { display: none; }
  .switch button[aria-pressed="true"] svg { display: block; }

  .page-head { padding: 34px 20px 4px; max-width: 1180px; margin: 0 auto; }
  .kicker { margin: 0; font-size: 10px; font-weight: 700; letter-spacing: 2.4px; text-transform: uppercase; color: #B98A2E; }
  .page-head h1 { margin: 12px 0 0; font-family: "Tiro Devanagari Hindi", Georgia, serif; font-size: 32px; line-height: 1.2; font-weight: 700; }
  .page-head .lede { margin: 10px 0 0; font-size: 15px; line-height: 1.75; color: #6B6459; max-width: 680px; }

  .boards { padding: 20px 20px 90px; max-width: 1180px; margin: 0 auto; display: flex; flex-direction: column; gap: 46px; }
  .board-head h2 { margin: 0; font-family: "Tiro Devanagari Hindi", Georgia, serif; font-size: 21px; font-weight: 700; }
  .board-head p { margin: 5px 0 14px; font-size: 13.5px; line-height: 1.6; color: #6B6459; max-width: 720px; }

  .frames { display: flex; gap: 18px; align-items: flex-start; flex-wrap: wrap; }
  .frame { margin: 0; flex: 1 1 600px; min-width: 0; }
  .frame.phone { flex: 0 0 auto; max-width: 100%; }
  figcaption { margin-bottom: 7px; }
  .tag { display: inline-block; font-size: 10px; font-weight: 700; letter-spacing: 1.6px; text-transform: uppercase; color: #6B6459; background: #FDFBF7; border: 1px solid #E4DFD5; border-radius: 999px; padding: 3px 11px; }
  .scroller { border: 1px solid #E4DFD5; border-radius: 16px; background: #FDFBF7; overflow-x: auto; overflow-y: hidden; }
  .frame.phone .scroller { width: 390px; max-width: 100%; }

  html[data-lang="en"] [data-ne] { display: none; }
  html[data-lang="en"] [data-en] { display: inline; }

  @media (max-width: 760px) {
    .page-head h1 { font-size: 25px; }
    .switch button { padding: 0 13px; font-size: 12.5px; }
    .boards { gap: 38px; }
  }
</style>
</head>
<body>
  <div class="top">
    <div class="mark"><span class="k">K</span><strong>KRISHOE</strong></div>
    <div class="switch" role="group" aria-label="भाषा · Language">
      <button type="button" data-lang-btn="ne" aria-pressed="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m4 12.5 5 5L20 7"/></svg>
        नेपाली
      </button>
      <button type="button" data-lang-btn="en" aria-pressed="false">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m4 12.5 5 5L20 7"/></svg>
        ENGLISH
      </button>
    </div>
  </div>

  <div class="page-head">
    <p class="kicker"><span data-ne>KRISHOE · डिजाइन प्रस्ताव</span><span data-en hidden>KRISHOE · design proposal</span></p>
    <h1><span data-ne>बनाउनुअघि हेर्नुहोस्</span><span data-en hidden>Look before it is built</span></h1>
    <p class="lede">
      <span data-ne>हरेक पाना PC र मोबाइल — दुवैमा। माथिको बटन साँच्चै चल्छ, थिचेर हेर्नुहोस्। अहिलेसम्म कुनै code फेरिएको छैन।</span>
      <span data-en hidden>Every screen on both a computer and a phone. The switch above is real — press it. No code has been changed yet.</span>
    </p>
  </div>

  <div class="boards">${sections}
  </div>

<script>
  // The switch the owner asked to actually work. It turns this page's own
  // words; the mock screens keep their Nepali, because Nepali is what the shop
  // is written in.
  var buttons = document.querySelectorAll("[data-lang-btn]");

  function choose(lang) {
    document.documentElement.setAttribute("data-lang", lang);
    document.documentElement.lang = lang === "en" ? "en" : "ne";
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute("aria-pressed", String(buttons[i].getAttribute("data-lang-btn") === lang));
    }
    try { localStorage.setItem("krishoe-design-lang", lang); } catch (error) { /* private window */ }
  }

  for (var i = 0; i < buttons.length; i++) {
    buttons[i].addEventListener("click", function () { choose(this.getAttribute("data-lang-btn")); });
  }

  try {
    if (localStorage.getItem("krishoe-design-lang") === "en") choose("en");
  } catch (error) { /* private window */ }
</script>
</body>
</html>`;

writeFileSync("../public/krishoe-design.html", page);
console.log(`wrote public/krishoe-design.html — ${Math.round(page.length / 1024)}KB, ${pairs.length} screens`);
