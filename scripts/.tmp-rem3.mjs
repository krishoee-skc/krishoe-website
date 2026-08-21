import { readFileSync, writeFileSync } from "node:fs";

function edit(file, pairs) {
  const raw = readFileSync(file, "utf8");
  const crlf = raw.includes("\r\n");
  let src = crlf ? raw.split("\r\n").join("\n") : raw;
  for (const [from, to] of pairs) {
    if (!src.includes(from)) throw new Error(`${file}: anchor missing -> ${from.slice(0, 70)}`);
    src = src.replace(from, to);
  }
  writeFileSync(file, crlf ? src.split("\n").join("\r\n") : src);
  console.log("edited " + file);
}

edit("app/admin/login/actions.ts", [
  ["  getAdminSessionMaxAge,", "  getAdminSessionMaxAge,\n  sessionMaxAge,"],
  // Read the box on the way in, and carry it to the two-step screen.
  [
    `  const email = textValue(formData, "email");
  const password = textValue(formData, "password");`,
    `  const email = textValue(formData, "email");
  const password = textValue(formData, "password");
  const remember = formData.get("remember") === "on";`,
  ],
  [
    `      challengeToken: challenge.token,
      emailHint: emailHint(staff.email),
    };
    }`,
    `      challengeToken: challenge.token,
      emailHint: emailHint(staff.email),
      remember,
    };
    }`,
  ],
]);
