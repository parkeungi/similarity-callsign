# Repository Guidelines

## Project Structure & Module Organization
Business logic lives in `src`. `src/app` holds App Router routes (admin dashboards in `admin/`, airline tooling in `(main)/`, REST handlers under `api/`). Shared UI sits in `src/components`, client state in `src/store`, domain helpers in `src/lib`, and types in `src/types`. Static assets go to `public`, databases to `data/`, and schema helpers to `scripts/`. Commit `.db` files only when schema changes require it.

## Build, Test, and Development Commands
- `npm run dev`: Starts the Next.js 14 dev server on port 3000 and refreshes better-sqlite3.
- `npm run build`: Produces the optimized production bundle; fails fast on TypeScript or route errors.
- `npm run start`: Serves the previously built bundle for staging smoke tests.
- `npm run lint`: Runs the `next/core-web-vitals` ESLint preset; fix warnings before opening a PR.
After editing `scripts/init.sql`, restart the dev server so schema changes cascade into the local SQLite instance.

## Coding Style & Naming Conventions
TypeScript/TSX files use 2-space indentation, ES module imports, and React functional components. Components are PascalCase (`ActionTimeline`), hooks are camelCase with a `use` prefix, Zustand stores end with `Store`. Keep Tailwind classlists inline; extract repeated configurations into helper components rather than custom CSS. Colocate shared helpers inside `src/lib` to maintain tree-shakeable modules.

## Testing Guidelines
No automated suite ships with the repo, so every change must include manual verification notes for admin, airline, and auth flows. When adding regression tests, rely on React Testing Library plus Vitest (co-located `*.test.tsx` files) and target 80% coverage on the code you touch. Reset the SQLite file or seed data via `scripts/init.sql` before running scenario tests to keep deterministic datasets.

## Commit & Pull Request Guidelines
Use the conventional prefixes already present in history (`feat:`, `fix:`, `refactor:`, etc.), and keep commits scoped to one logical concern. PRs should summarize intent, link issues, include screenshots for any UI shift, and explain schema or seed changes. List the commands you ran (`npm run lint`, manual smoke steps) so reviewers can reproduce quickly, and always flag when `data/katc1.db` needs to be replaced downstream.

## Security & Configuration Tips
Secrets belong in `.env.local` (`JWT_SECRET`, `NEXT_PUBLIC_API_URL`) and must never be committed. The bundled SQLite files contain placeholder credentials—regenerate passwords before deploying anywhere outside localhost. Clear cookies when switching between admin and airline roles to avoid leaking privileges, and prefer HTTPS tunnels when validating JWT cookie behavior.
