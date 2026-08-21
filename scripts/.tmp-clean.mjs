import { readFileSync, writeFileSync } from "node:fs";

// The English month field is replaced, not hidden. A dead control left in the
// markup is one more thing for the next reader to work out.
const dead = [
  ["app/admin/factory/ledger/page.tsx", `        <div className="hidden">
          <input
            type="month"
            value=""
            readOnly
            className="w-full min-h-12 px-3 py-2 border border-slate-300 rounded-lg"
          />
        </div>
`],
  ["app/admin/factory/salary/page.tsx", `          <input
            type="month"
            value=""
            readOnly
            hidden
            className="w-full px-4 py-2 border border-slate-300 rounded-lg"
          />
`],
  ["app/admin/factory/reports/page.tsx", `          <input
            type="month"
            value=""
            readOnly
            hidden
            className="min-h-12 px-3 py-2 border border-slate-300 rounded-lg"
          />
`],
];

for (const [file, block] of dead) {
  const raw = readFileSync(file, "utf8");
  const crlf = raw.includes("\r\n");
  let src = crlf ? raw.split("\r\n").join("\n") : raw;
  if (!src.includes(block)) throw new Error(`${file}: dead block not found`);
  src = src.replace(block, "");

  const imp = src.match(/^import .*from "@\/(lib|components)\/.*";$/m);
  if (!imp) throw new Error(`${file}: import anchor missing`);
  src = src.replace(
    imp[0],
    `import BikramMonthPicker from "@/components/admin/BikramMonthPicker";\nimport { bikramMonthKeyOf } from "@/lib/bikram-sambat";\n${imp[0]}`,
  );

  writeFileSync(file, crlf ? src.split("\n").join("\r\n") : src);
  console.log("cleaned " + file);
}
