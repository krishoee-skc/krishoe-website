"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "@/components/Icons";
import { useLanguage } from "@/components/LanguageProvider";
import type { AdminFacts } from "@/lib/ai/admin-assistant-prompt";

// The browser's own speech-to-text, on the two names it goes by. It is free and
// on-device; when the browser has neither, the mic button simply never shows and
// typing works exactly as before — so a phone without it is never broken.
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};
function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Ask the shop about itself, in words.
 *
 * Sends the owner's question to /api/admin/assistant, which reads the true
 * numbers first and layers an AI sentence on top. This panel shows both: the
 * real figures as tiles (always), and the AI's plain-language answer above them
 * (when the AI answered). If the AI is off or busy, the tiles still tell the
 * owner what they asked — the box is never blank and never shows a made-up
 * number, because every number here came straight from the API's `facts`.
 *
 * It only reads. There is no control here that changes anything; the tiles link
 * out to the pages where a change is actually made.
 */

type Turn = { role: "owner" | "assistant"; text: string };

const money = (v: number | null) =>
  v === null ? null : `Rs. ${Math.round(v).toLocaleString("en-IN")}`;

function MicIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

function SpeakerIcon({ className, muted }: { className?: string; muted?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      {muted ? <path d="m22 9-6 6M16 9l6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12" />}
    </svg>
  );
}

// The browser's own text-to-speech, if it has one. Free and on-device, like the
// mic; where it is missing, the speaker button never shows and nothing breaks.
function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * Pick the clearest available voice for a language, preferring a female one.
 *
 * Setting only utterance.lang leaves the browser to choose, and on many phones
 * it reads Nepali with an English voice — the words come out garbled. So we look
 * through the installed voices and choose deliberately, in this order:
 *   1. a female voice in the right script (Nepali, else Hindi — Hindi shares
 *      Devanagari and sounds far closer to Nepali than English);
 *   2. any voice in that script;
 *   3. whatever matches the language tag, then the default.
 * The owner asked for a clear female Nepali voice; a real one is only there if
 * the phone has it, but this gets as close as the device allows. English almost
 * always has a good voice, so the rescue work is really for Nepali.
 */
const FEMALE_HINT = /female|woman|zira|susan|heera|kalpana|swara|lekha|veena|priya|neerja|aditi|google.*(हिन्दी|hindi|nepali)/i;

function isFemale(voice: SpeechSynthesisVoice): boolean {
  // Some engines expose no gender at all; the name is the only clue. Google's
  // default Hindi/Nepali web voices are female, so treat those as female too.
  return FEMALE_HINT.test(voice.name);
}

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;
  const wanted = lang.toLowerCase();
  const scripts = wanted.startsWith("ne") ? ["ne", "hi"] : [wanted.slice(0, 2)];

  const inScript = (prefix: string) =>
    voices.filter((voice) => voice.lang?.toLowerCase().startsWith(prefix));

  for (const prefix of scripts) {
    const matches = inScript(prefix);
    const female = matches.find(isFemale);
    if (female) return female; // a female voice in the right script — best case
    if (matches[0]) return matches[0]; // any voice in the right script
  }
  // Nothing in-script: a female English voice if we can, else the default.
  return voices.find(isFemale) ?? voices[0];
}

function speakText(message: string, lang: string) {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel(); // never let two answers talk over each other
  const utterance = new SpeechSynthesisUtterance(message);
  const voice = pickVoice(lang);
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang; // match the tag to the chosen voice
  } else {
    utterance.lang = lang;
  }
  // A touch slower reads clearer, especially for a Hindi voice speaking Nepali.
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

export default function AdminAskPanel() {
  const { text, language } = useLanguage();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [facts, setFacts] = useState<AdminFacts | null>(null);
  const [aiOff, setAiOff] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Voice input, only where the browser supports it. `voiceReady` gates the mic
  // button so a phone without speech never shows a dead control.
  // Starts false so the server and the client's first paint agree (no window on
  // the server), then flips to the browser's real capability after mount. That
  // one deliberate post-mount setState is why the rule is disabled on the line.
  const [voiceReady, setVoiceReady] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Speak the answer aloud. On by default when the browser can, and the owner
  // can mute it. Starts false for the same SSR/first-paint reason as voiceReady.
  const [speakReady, setSpeakReady] = useState(false);
  const [speakOn, setSpeakOn] = useState(true);

  useEffect(() => {
    // Both are browser-capability checks that must run after hydration, so the
    // server and first client paint agree; the disable covers both setStates.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- capability check after hydration, intentional
    setVoiceReady(getSpeechRecognition() !== null);
    setSpeakReady(canSpeak());
    // Warm the voice list: on many browsers getVoices() is empty on first call
    // and fills in asynchronously. Touching it here, and listening for the
    // change, means a good voice is ready by the time the first answer speaks.
    if (canSpeak()) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
    return () => {
      // Stop any live recognition, and silence any answer still being spoken,
      // if the panel unmounts.
      recognitionRef.current?.stop();
      if (canSpeak()) {
        window.speechSynthesis.onvoiceschanged = null;
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function toggleVoice() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Recognition = getSpeechRecognition();
    if (!Recognition) return;

    // Silence any answer being read aloud before listening, so the mic hears the
    // owner and not the phone's own voice.
    if (canSpeak()) window.speechSynthesis.cancel();

    const recognition = new Recognition();
    // Nepali when the shop is in Nepali, English otherwise; the phone falls back
    // on its own if it can't do one of them.
    recognition.lang = language === "en" ? "en-US" : "ne-NP";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const said = event.results?.[0]?.[0]?.transcript;
      if (said) setInput((prev) => (prev ? `${prev} ${said}` : said));
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  const suggestions = [
    text("How much did we sell today?", "आज कति बिक्री भयो?"),
    text("What stock is low?", "कुन स्टक कम छ?"),
    text("How much is owed to workers?", "कामदारलाई कति तलब बाँकी?"),
  ];

  async function ask(question: string) {
    const message = question.trim();
    if (!message || busy) return;

    setTurns((prev) => [...prev, { role: "owner", text: message }]);
    setInput("");
    setBusy(true);

    try {
      const response = await fetch("/api/admin/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history: turns.slice(-6).map((t) => ({ role: t.role === "owner" ? "user" : "assistant", text: t.text })),
        }),
      });

      // A guard failure (session expired) or a server error answers without
      // facts. Say so plainly rather than leaving a blank turn the owner can't
      // read — most often it means signing in again.
      if (!response.ok) {
        setTurns((prev) => [
          ...prev,
          {
            role: "assistant",
            text:
              response.status === 401
                ? text(
                    "Your session ended — please sign in again.",
                    "तपाईंको session सकियो — फेरि login गर्नुहोस्।",
                  )
                : text(
                    "Couldn't read the shop just now — please try again.",
                    "अहिले शप पढ्न सकिएन — फेरि प्रयास गर्नुहोस्।",
                  ),
          },
        ]);
        return;
      }

      const data = (await response.json()) as {
        facts?: AdminFacts;
        reply?: string | null;
      };

      if (data.facts) setFacts(data.facts);
      setAiOff(!data.reply);

      if (data.reply) {
        const reply = data.reply;
        setTurns((prev) => [...prev, { role: "assistant", text: reply }]);
        // Read the answer aloud, unless the owner muted it.
        if (speakOn) speakText(reply, language === "en" ? "en-US" : "ne-NP");
      }
    } catch {
      // Network trouble: keep whatever facts we had, say so plainly.
      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          text: text(
            "Couldn't reach the shop just now — please try again.",
            "अहिले जोडिन सकिएन — फेरि प्रयास गर्नुहोस्।",
          ),
        },
      ]);
    } finally {
      setBusy(false);
      setTimeout(
        () => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }),
        30,
      );
    }
  }

  const factTiles: { label: string; value: string | null; href: string }[] = facts
    ? [
        { label: text("Sold today", "आज बिक्री"), value: money(facts.todaySales), href: "/admin/reports" },
        { label: text("Credit owed", "उधारो बाँकी"), value: money(facts.creditOwed), href: "/admin/dues" },
        { label: text("Workers owed", "तलब बाँकी"), value: money(facts.workerOwed), href: "/admin/factory" },
        { label: text("Month profit", "महिना नाफा"), value: money(facts.monthProfit), href: "/admin/purchasing" },
      ]
    : [];

  return (
    <div className="flex min-h-0 flex-col">
      {/* Conversation + facts */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto">
        {turns.length === 0 ? (
          <div>
            <p className="text-sm text-brand-muted">
              {text(
                "Ask about today's sales, low stock, dues or wages owed. I read the shop's real numbers — I never change anything.",
                "आजको बिक्री, कम स्टक, उधारो वा तलब सोध्नुहोस्। म शपको साँचो नम्बर पढ्छु — केही बदल्दिनँ।",
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  className="rounded-full border border-brand-green-line bg-brand-mist px-3 py-1.5 text-xs font-bold text-brand-green transition hover:border-brand-green"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          turns.map((turn, index) => (
            <div key={index} className={`flex ${turn.role === "owner" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-6 ${
                  turn.role === "owner"
                    ? "bg-brand-green-ink text-white"
                    : "bg-brand-mist text-brand-green-ink ring-1 ring-brand-green-line"
                }`}
              >
                {turn.text}
              </div>
            </div>
          ))
        )}

        {busy ? (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-brand-mist px-3.5 py-2 text-sm text-brand-muted ring-1 ring-brand-green-line">
              {text("Reading the numbers…", "नम्बर हेर्दैछु…")}
            </div>
          </div>
        ) : null}

        {/* The real figures, always shown once asked — the safety net. Even if
            the AI said nothing, these are the true numbers, and each links to
            the page where it can be acted on. */}
        {factTiles.length > 0 ? (
          <div>
            {aiOff ? (
              <p className="mb-2 rounded-lg bg-brand-cream px-3 py-2 text-xs font-semibold text-brand-gold-dark">
                {text(
                  "Here are the real numbers. (The AI answer is resting — the figures are exact.)",
                  "यी साँचो नम्बर हुन्। (AI वाक्य अहिले आएन — नम्बर भने ठ्याक्कै सही छन्।)",
                )}
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              {factTiles.map((tile) => (
                <Link
                  key={tile.label}
                  href={tile.href}
                  className="rounded-xl border border-brand-green-line bg-brand-paper p-3 transition hover:border-brand-green"
                >
                  <span className="block text-[11px] font-bold uppercase tracking-wide text-brand-muted">
                    {tile.label}
                  </span>
                  <span className="mt-1 block font-display text-lg font-black tabular-nums text-brand-green-ink">
                    {tile.value ?? text("—", "—")}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Speak-aloud toggle — only where the browser can speak. Muting it also
          silences an answer being read right now. */}
      {speakReady ? (
        <button
          type="button"
          onClick={() => {
            setSpeakOn((on) => {
              if (on && canSpeak()) window.speechSynthesis.cancel();
              return !on;
            });
          }}
          aria-pressed={speakOn}
          className={`mt-3 inline-flex items-center gap-1.5 self-start rounded-full border px-3 py-1.5 text-xs font-bold transition ${
            speakOn
              ? "border-brand-green bg-brand-green-mist text-brand-green"
              : "border-brand-green-line bg-brand-paper text-brand-muted"
          }`}
        >
          <SpeakerIcon className="h-4 w-4" muted={!speakOn} />
          {speakOn
            ? text("Speaking answers", "बोलेर सुनाउँदै")
            : text("Answers muted", "आवाज बन्द")}
        </button>
      ) : null}

      {/* Ask box */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          ask(input);
        }}
        className="mt-3 flex items-end gap-2"
      >
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              ask(input);
            }
          }}
          rows={1}
          placeholder={
            voiceReady
              ? text("Speak or type a question…", "बोल्नुहोस् वा लेख्नुहोस्…")
              : text("Ask a question…", "प्रश्न सोध्नुहोस्…")
          }
          className="max-h-24 flex-1 resize-none rounded-xl border border-brand-green-line bg-brand-paper px-3 py-2.5 text-sm text-brand-green-ink outline-none focus:border-brand-green"
        />
        {/* Mic: only when the browser can hear. Tapping it starts listening;
            what is said lands in the box, so voice and typing share one field —
            speak, then edit or add by typing before sending. */}
        {voiceReady ? (
          <button
            type="button"
            onClick={toggleVoice}
            aria-label={listening ? text("Stop listening", "सुन्न रोक्नुहोस्") : text("Speak", "बोल्नुहोस्")}
            aria-pressed={listening}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border transition ${
              listening
                ? "animate-pulse border-brand-clay bg-brand-clay-tint text-brand-clay"
                : "border-brand-green-line bg-brand-paper text-brand-green hover:border-brand-green"
            }`}
          >
            <MicIcon className="h-5 w-5" />
          </button>
        ) : null}
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label={text("Ask", "सोध्नुहोस्")}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-green-ink text-white transition hover:bg-brand-green disabled:opacity-40"
        >
          <ArrowRightIcon className="h-5 w-5" />
        </button>
      </form>
      {listening ? (
        <p className="mt-2 text-center text-xs font-semibold text-brand-clay">
          {text("Listening… speak now", "सुन्दैछु… अहिले बोल्नुहोस्")}
        </p>
      ) : null}
    </div>
  );
}
