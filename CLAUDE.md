@AGENTS.md

## Skills and how they fit this repo

Global skills live in `~/.claude/skills`. Load the matching one before the work, but where its advice clashes with this repo, the repo wins:

- **UI / new screens** — `frontend-design`, `ui-ux-pro-max`, `ui-design-system`. Keep the existing brand palette and tokens in `tailwind.config.js` (`brand.green` etc.); don't introduce a new palette or font set. An approved namuna (design mock) beats any skill's taste.
- **Tailwind** — `tailwind-patterns` is written for **v4** (CSS-first `@theme`, `@import "tailwindcss"`). This repo is on **Tailwind v3** with `tailwind.config.js` + the `tailwindcss` PostCSS plugin and `darkMode: "class"`. Use only its version-neutral ideas (semantic tokens, container queries via plugin, class ordering); never migrate config or syntax to v4 unasked.
- **Frontend** — `senior-frontend`. Next **16** App Router with React **18.3**: check `node_modules/next/dist/docs/` before any Next API (see AGENTS.md); middleware is `proxy.ts`. Don't run its scaffolder scripts here — they generate generic structure that doesn't match `app/` / `components/` / `lib/`.
- **Backend** — `senior-backend`. No Express/GraphQL here: APIs are Next route handlers under `app/api/`, DB is raw `pg` against SQL files in `migrations/`. The live DB is a shared transaction pooler — no `SET SESSION`; use `BEGIN READ ONLY` for checks. Don't run its load tester against the live site.
- **Bugs** — `systematic-debugging`: root cause before any fix.
- **Reviews** — `code-reviewer` (or `/code-review`).
- **Public pages** — `seo-optimizer`; contact/social data stays centralized in `lib/seo.ts`.
- Before any push: rerun `tsc` / `next build` after the last edit (vitest doesn't type-check).
