# Product Manager Memory

## Project Identity
- Name: 유사호출부호 공유시스템
- Level: Dynamic (Next.js 14, TypeScript, TanStack Query v5, PostgreSQL via bkend.ai)
- Plan docs path: `docs/01-plan/features/{feature}.plan.md`
- Template: `/Users/sein/.claude/plugins/cache/bkit-marketplace/bkit/1.5.5/templates/plan.template.md`

## Completed Phases Summary
- Phase 1-3: Auth, user management, routing (plan: katc1-authentication.plan.md)
- Phase 4 (partial): Callsigns/actions DB schema, API routes, hooks, airline page UI
- Phase 5: Login UI improvements
- Phase 6: Callsigns & Actions Management System (plan: callsigns-actions-management.plan.md)

## Key Conventions to Reflect in Plans
- All plans must note Bearer token + role check pattern for API security
- TanStack Query staleTime: 30s, gcTime: 5min
- Tailwind only, `rounded-none` style throughout UI
- Korean comments in code, Korean error messages in UI
- Raw SQL (no ORM) - keep plans DB-schema-explicit

## Known Architecture Facts
- Upload route exists: `POST /api/admin/upload-callsigns` (functional)
- `callsign_occurrences` table referenced in upload route - verify it exists in init.sql before planning DB work
- `file_uploads` table exists and is populated by the upload route
- Excel export on client side uses `xlsx` library (already installed)
- Admin dashboard at `/admin` shows user stats only (not callsign/action stats yet)

## Plan Document Conventions
- Always check existing plans in `docs/01-plan/features/` before creating new ones
- Feature names use kebab-case for filenames
- Include "Estimated Scope" section with effort classification (Major/Medium/Small)
- Requirements table must use FR-XX IDs with MoSCoW priority
- Acceptance criteria must be testable (specific, not vague)
- Risk table must include "blocked if active actions exist" pattern for delete operations
