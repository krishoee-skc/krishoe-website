import { readFileSync, writeFileSync } from "node:fs";

/**
 * The channels report and its link maker, which I wrote Nepali-only.
 *
 * The owner had ENGLISH selected and got a Nepali page — the same fault as the
 * products screen, on a screen I built myself a few hours after diagnosing it.
 * Worse, I then audited the app for half-finished work and did not name this
 * one, because I had just written it and assumed it was done.
 *
 * Both files are client components already, so text() rather than <T>.
 */
function pair(file, edits, needsHook) {
  let s = readFileSync(file, "utf8");
  const eol = s.includes("\r\n") ? "\r\n" : "\n";
  const nl = (t) => t.split("\n").join(eol);

  for (const [from, to] of edits) {
    const target = nl(from);
    if (!s.includes(target)) {
      console.error("MISSING in", file, "→", from.slice(0, 55));
      process.exit(1);
    }
    s = s.replace(target, nl(to));
  }

  if (needsHook) {
    const anchor = nl(needsHook.anchor);
    if (!s.includes(anchor)) {
      console.error("MISSING hook anchor in", file);
      process.exit(1);
    }
    s = s.replace(anchor, nl(needsHook.with));
  }

  if (!s.includes(`import { useLanguage }`)) {
    const first = s.indexOf("import ");
    const lineEnd = s.indexOf("\n", first);
    s = s.slice(0, lineEnd + 1) + `import { useLanguage } from "@/components/LanguageProvider";` + eol + s.slice(lineEnd + 1);
  }

  writeFileSync(file, s);
  console.log(`ok ${file} — ${edits.length} paired`);
}

// The report page is a server component, so its words move into a client
// island the same way the alert texts did.
{
  const p = "app/admin/reports/channels/page.tsx";
  let s = readFileSync(p, "utf8");
  const eol = s.includes("\r\n") ? "\r\n" : "\n";
  const nl = (t) => t.split("\n").join(eol);

  const edits = [
    [`      >
        ← हिसाब
      </Link>`,
     `      >
        ← <AlertText en="Report" ne="हिसाब" />
      </Link>`],

    [`        हिसाब · कहाँबाट आयो
      </p>`,
     `        <AlertText en="Report · where they came from" ne="हिसाब · कहाँबाट आयो" />
      </p>`],

    [`        ग्राहक कुनबाट आए?
      </h1>`,
     `        <AlertText en="Where did the shoppers come from?" ne="ग्राहक कुनबाट आए?" />
      </h1>`],

    [`              पछिल्लो ३० दिन
            </p>`,
     `              <AlertText en="Last 30 days" ne="पछिल्लो ३० दिन" />
            </p>`],

    [`              <span className="text-lg font-bold text-white/70">भ्रमण</span>`,
     `              <span className="text-lg font-bold text-white/70">
                <AlertText en="visits" ne="भ्रमण" />
              </span>`],

    [`              {busiest
                ? \`सबैभन्दा धेरै — \${label(busiest.label).ne}\`
                : "अझै कोही आएको छैन।"}`,
     `              {busiest ? (
                <AlertText
                  en={\`Most of them — \${busiest.label}\`}
                  ne={\`सबैभन्दा धेरै — \${label(busiest.label).ne}\`}
                />
              ) : (
                <AlertText en="Nobody has come yet." ne="अझै कोही आएको छैन।" />
              )}`],

    [`              Google Analytics बाट डाटा आएन
            </p>`,
     `              <AlertText en="No data came back from Google Analytics" ne="Google Analytics बाट डाटा आएन" />
            </p>`],

    [`            कुन बाटोबाट
          </p>`,
     `            <AlertText en="By route" ne="कुन बाटोबाट" />
          </p>`],

    [`                  <span className="block truncate text-sm font-bold text-brand-green-ink">
                    {label(row.label).ne}
                  </span>`,
     `                  <span className="block truncate text-sm font-bold text-brand-green-ink">
                    <AlertText en={row.label} ne={label(row.label).ne} />
                  </span>`],

    [`                    <span className="block text-xs text-brand-muted">{label(row.label).detail}</span>`,
     `                    <span className="block text-xs text-brand-muted">
                      <AlertText en="" ne={label(row.label).detail} />
                    </span>`],

    [`          &ldquo;Social&rdquo; भन्छ, तर Facebook कि Instagram भन्दैन
        </p>`,
     `          <AlertText
            en={'It says "Social", but not Facebook or Instagram'}
            ne={'"Social" भन्छ, तर Facebook कि Instagram भन्दैन'}
          />
        </p>`],

    [`          Google ले तीनवटैलाई एउटै झोलामा हाल्छ। छुट्याउने एउटै बाटो — पोस्ट गर्दा लिङ्कमा चिनो
          लगाउने। त्यो चिनो तल आफैँ बन्छ।
        </p>`,
     `          <AlertText
            en="Google files all three into one bucket. There is exactly one way to tell them apart: tag the link when you post it. The tag builds itself below."
            ne="Google ले तीनवटैलाई एउटै झोलामा हाल्छ। छुट्याउने एउटै बाटो — पोस्ट गर्दा लिङ्कमा चिनो लगाउने। त्यो चिनो तल आफैँ बन्छ।"
          />
        </p>`],

    [`        कुन पाना धेरै हेरियो
        <ArrowRightIcon className="h-4 w-4" />`,
     `        <AlertText en="Which pages were read most" ne="कुन पाना धेरै हेरियो" />
        <ArrowRightIcon className="h-4 w-4" />`],
  ];

  for (const [from, to] of edits) {
    const target = nl(from);
    if (!s.includes(target)) {
      console.error("MISSING in channels page →", from.slice(0, 55));
      process.exit(1);
    }
    s = s.replace(target, nl(to));
  }

  if (!s.includes(`import AlertText`)) {
    const first = s.indexOf("import ");
    const lineEnd = s.indexOf("\n", first);
    s = s.slice(0, lineEnd + 1) + `import AlertText from "@/components/admin/AlertText";` + eol + s.slice(lineEnd + 1);
  }

  writeFileSync(p, s);
  console.log(`ok ${p} — ${edits.length} paired`);
}

pair(
  "app/admin/reports/channels/CampaignLinkMaker.tsx",
  [
    [`<h2 className="font-display text-xl font-black text-brand-green-ink">पोस्टको लिङ्क बनाउने</h2>`,
     `<h2 className="font-display text-xl font-black text-brand-green-ink">
        {text("Build the link for your post", "पोस्टको लिङ्क बनाउने")}
      </h2>`],

    [`        कुन पाना, कहाँ पोस्ट गर्ने — दुई थिचाइ, अनि लिङ्क तयार।
      </p>`,
     `        {text(
          "Which page, and where you are posting it — two taps and the link is ready.",
          "कुन पाना, कहाँ पोस्ट गर्ने — दुई थिचाइ, अनि लिङ्क तयार।",
        )}
      </p>`],

    [`        कहाँ लैजाने
      </p>`, `        {text("Where it lands", "कहाँ लैजाने")}
      </p>`],

    [`        कहाँ पोस्ट गर्ने
      </p>`, `        {text("Where you are posting", "कहाँ पोस्ट गर्ने")}
      </p>`],

    [`            {option.ne}
          </button>
        ))}
      </div>

      <p className="mt-5 text-xs font-black uppercase tracking-[0.14em] text-brand-muted">
        {text("Where you are posting", "कहाँ पोस्ट गर्ने")}`,
     `            {text(option.en, option.ne)}
          </button>
        ))}
      </div>

      <p className="mt-5 text-xs font-black uppercase tracking-[0.14em] text-brand-muted">
        {text("Where you are posting", "कहाँ पोस्ट गर्ने")}`],

    [`            {option.ne}
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-dashed`,
     `            {text(option.en, option.ne)}
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-dashed`],

    [`            {copied ? "कपी भयो ✓" : "लिङ्क कपी गर्ने"}`,
     `            {copied ? text("Copied ✓", "कपी भयो ✓") : text("Copy the link", "लिङ्क कपी गर्ने")}`],

    [`              QR खोल्ने · छाप्ने
            </a>`,
     `              {text("Open QR · print", "QR खोल्ने · छाप्ने")}
            </a>`],

    [`        यही लिङ्क पोस्टमा राख्नुहोस्। एक हप्तापछि माथिको तालिकामा{" "}
        <strong className="text-brand-green-ink">{source.showsAsNe}</strong> देखिन्छ।`,
     `        {text("Put this link in the post. A week later the table above shows", "यही लिङ्क पोस्टमा राख्नुहोस्। एक हप्तापछि माथिको तालिकामा")}{" "}
        <strong className="text-brand-green-ink">{text(source.showsAsEn, source.showsAsNe)}</strong>
        {text(".", " देखिन्छ।")}`],
  ],
  {
    anchor: `  const [place, setPlace] = useState(campaignPlaces[0]);`,
    with: `  const { text } = useLanguage();
  const [place, setPlace] = useState(campaignPlaces[0]);`,
  },
);
