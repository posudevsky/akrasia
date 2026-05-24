# акразия

A web app that helps Russian-speaking job seekers adapt their resume to a specific job vacancy using Yandex LLM AI.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port varies)
- `pnpm --filter @workspace/resume-adapter run dev` — run the frontend (port varies)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Required env: `YANDEX_API_KEY` (secret), `YANDEX_FOLDER_ID` (env var), `JWT_SECRET` (secret), `ADMIN_PASSWORD` (secret)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- Frontend: React + Vite + Tailwind CSS + shadcn/ui + framer-motion
- AI: Yandex LLM (Qwen3 model via OpenAI-compatible API)
- Auth: JWT in httpOnly cookie (30-day expiry), bcryptjs for password hashing
- Build: esbuild (CJS bundle for server)
- File parsing: mammoth (DOCX), pdf-parse (PDF)
- Download: docx package (Word), Blob (TXT), window.print (PDF)

## Where things live

- `artifacts/api-server/src/routes/resume.ts` — /analyze, /adapt, /parse-file endpoints (auth-protected)
- `artifacts/api-server/src/routes/auth.ts` — /auth/login, /auth/logout, /auth/me, /auth/waitlist
- `artifacts/api-server/src/routes/admin.ts` — /admin/verify, /admin/waitlist, /admin/users
- `artifacts/api-server/src/middlewares/auth.ts` — JWT auth middleware + admin password middleware
- `artifacts/api-server/src/lib/prompts.ts` — LLM prompts (easy to edit/swap)
- `artifacts/api-server/src/lib/yandex.ts` — Yandex LLM API client
- `artifacts/resume-adapter/src/` — React frontend (App.tsx + screen components)
- `artifacts/resume-adapter/src/components/ScreenLogin.tsx` — Login screen + waitlist modal
- `artifacts/resume-adapter/src/components/AdminPage.tsx` — /admin panel
- `lib/api-spec/openapi.yaml` — API contract source of truth
- `lib/api-client-react/src/generated/` — generated React Query hooks
- `lib/db/src/schema/index.ts` — users + waitlist tables

## Architecture decisions

- Auth uses JWT stored in httpOnly cookie (not localStorage) for XSS protection
- Admin password is validated on each admin request via `x-admin-password` header; not stored as a session
- LLM prompts are kept in a dedicated `prompts.ts` file for easy editing/replacement
- File parsing (PDF/DOCX) happens server-side to keep the browser lightweight
- Match Score is computed purely on the frontend using a weighted formula
- `<change>` tags in the adapted resume are parsed in React (no dangerouslySetInnerHTML)

## Product

**Screen 0 — Login:** Shown on app load if user has no active session. Email/password form. "Регистрация" link opens waitlist modal. On login success, proceeds to Screen 1.

**Screen 1 — Upload:** User pastes a job vacancy and their resume (or uploads PDF/DOCX). Clicks "Анализировать".

**Screen 2 — Analysis:** Shows a Match Score (%) and a sorted list of requirement cards — red (missing, with user input fields), yellow (partial), green (confirmed). Score recalculates in real-time. User clicks "Адаптировать резюме".

**Screen 3 — Result:** Shows the adapted resume with AI-highlighted changes, an updated Match Score with delta, and download buttons (TXT, DOCX, PDF).

**Admin Panel — `/admin`:** Password-protected. Shows waitlist emails (with copy) and invited users list (add/remove).

## User preferences

- App UI language: Russian
- No emojis in UI
- LLM prompts should remain in `artifacts/api-server/src/lib/prompts.ts` for easy access

## Gotchas

- Always run codegen after changing `lib/api-spec/openapi.yaml`
- The Yandex Qwen3 model may return `<think>...</think>` blocks — these are stripped in `yandex.ts`
- The adapt prompt returns `resume_updated` (snake_case) from the LLM; the route normalizes it to `resumeUpdated`
- pdf-parse is a CommonJS module — use dynamic import with `(module as any).default ?? module` pattern
- Admin password is passed as `x-admin-password` request header, not in the JWT cookie

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
