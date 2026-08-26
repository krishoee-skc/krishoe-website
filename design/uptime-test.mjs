import { readFileSync, writeFileSync } from "node:fs";

function edit(file, edits) {
  let s = readFileSync(file, "utf8");
  for (const [from, to] of edits) {
    const lf = (t) => t.split("\r\n").join("\n");
    const crlf = (t) => lf(t).split("\n").join("\r\n");
    const v = [[lf(from), lf(to)], [crlf(from), crlf(to)]].find(([t]) => s.includes(t));
    if (!v) { console.error("MISSING →", JSON.stringify(from.slice(0, 70))); process.exit(1); }
    s = s.split(v[0]).join(v[1]);
  }
  writeFileSync(file, s);
  console.log(`ok ${file}`);
}

/**
 * The checker files through a narrow door instead of holding the house key.
 *
 * Writing straight to Neon would have meant the database connection string
 * living in GitHub's secrets, and anything reaching those could then read every
 * order, wage and customer this shop has. What it holds now can write one
 * uptime row and nothing else.
 */
edit("tests/uptime-is-measured-from-outside.test.ts", [
  ["  it(\"writes the reading to the database, not through the app\", () => {\n    const probe = readFileSync(PROBE, \"utf8\");\n\n    // Straight to Neon. Posting to the site that is down is the one moment the\n    // recording would fail.\n    expect(probe).toContain(\"INSERT INTO monitoring_uptime\");\n    expect(probe).toContain(\"DATABASE_URL\");\n    expect(probe).not.toMatch(/fetch\([^)]*\/api\/(monitoring|uptime)/);\n  });",
   "  it(\"never carries the database connection string\", () => {\n    const probe = readFileSync(PROBE, \"utf8\");\n    const workflow = readFileSync(WORKFLOW, \"utf8\");\n\n    // The blast radius of a stolen secret is the whole point. DATABASE_URL in\n    // GitHub would mean every order, wage and customer readable by anything\n    // that reached those secrets. UPTIME_WRITE_TOKEN writes one row.\n    expect(probe).not.toContain(\"DATABASE_URL\");\n    expect(workflow).not.toContain(\"DATABASE_URL\");\n    expect(workflow).toContain(\"UPTIME_WRITE_TOKEN\");\n    // And it pulls in no third-party code to do it.\n    expect(workflow).not.toContain(\"npm install\");\n  });\n\n  it(\"guards the door it files through\", () => {\n    const route = readFileSync(\"app/api/monitoring/uptime/route.ts\", \"utf8\");\n\n    // No token configured means no writing — silence, not a free door.\n    expect(route).toContain(\"UPTIME_WRITE_TOKEN\");\n    expect(route).toContain(\"status: 503\");\n    expect(route).toContain(\"status: 401\");\n    // A plain === leaks the length of the correct prefix to anybody willing to\n    // send a few thousand guesses.\n    expect(route).toContain(\"timingSafeEqual\");\n    // One shape of row, one table, and nothing readable back.\n    expect(route).not.toMatch(/export async function GET/);\n  });\n\n  it(\"files a reading under the time it was taken, not the time it landed\", () => {\n    const probe = readFileSync(PROBE, \"utf8\");\n    const monitoring = readFileSync(\"lib/monitoring.ts\", \"utf8\");\n\n    // A \"down\" reading cannot be filed until the shop comes back, so it lands\n    // minutes late. Stamping it on arrival would record every outage as having\n    // happened the moment it ended.\n    expect(probe).toContain(\"checkedAt\");\n    expect(probe).toContain(\"RETRY_DELAYS_MS\");\n    expect(monitoring).toContain(\"COALESCE($5::timestamptz, now())\");\n  });"],
]);
