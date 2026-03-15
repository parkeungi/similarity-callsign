# Security Architect Memory - 유사호출부호 공유시스템

## Project Overview
- 유사호출부호 공유시스템: Aviation similar callsign sharing system
- Stack: Next.js 14, React 18, TypeScript, Zustand, better-sqlite3, bcryptjs, JWT
- Self-hosted backend: SQLite + JWT generation in API routes
- Level: Dynamic (fullstack)
- Working directory: /Users/sein/Desktop/similarity_callsign

## Security Score History
- 2026-02-19: 57/100 (Conditional Pass)
- 2026-02-22: 68/100 (Conditional Pass, improved)
- 2026-03-01 (reset-data): 98/100 (PASS)
- 2026-03-01 (full audit): 72/100 (Conditional Pass)

## Resolved Issues (cumulative)
1. httpOnly cookie for refreshToken - FIXED
2. Security headers (7 types) - FIXED in next.config.js
3. middleware.ts server-side route protection - FIXED
4. AuthState user:any - FIXED with proper User type
5. AuthState refreshToken field - FIXED (removed, cookie-only)
6. Debug APIs exposed - FIXED (deleted)
7. reset-data userId extraction bug - FIXED
8. GET logout (CSRF risk) - FIXED: POST only now
9. Signup API open - FIXED: admin-only user creation (POST /api/admin/users)
10. Math.random() for temp passwords - FIXED: crypto.getRandomValues() now used
11. .env.development tracked by Git - FIXED: .gitignore covers .env* (not just .env*.local)

## Current Issues (2026-03-01 full audit)
### Critical
1. **C-1**: user cookie httpOnly=false - middleware role check manipulable via JS
2. **C-2**: CSP unsafe-inline + unsafe-eval in script-src
3. **C-3**: File upload no size limit (DoS risk)

### High/Major
4. **M-1**: Password reset API returns tempPassword in plaintext response
5. **M-2**: No rate limiting on auth endpoints (brute-force)
6. **M-3**: verifyToken called with possible undefined (action-type-stats, duplicate-callsigns-stats)
7. **M-6**: PostgreSQL ::int syntax in SQLite (duplicate-callsigns-stats)
8. **M-7**: No refreshToken blacklist (logout doesn't invalidate server-side)
9. **M-8**: Internal error.message exposed in some 500 responses

### Minor
10. 44 console.log/error calls across API - no structured logging
11. JWT_SECRET strength not validated
12. Same secret for accessToken and refreshToken
13. params await missing in admin/airlines/[id] PATCH/DELETE

## Good Security Patterns Confirmed
- Parameterized queries (? placeholders) in ALL SQL - no injection
- No innerHTML/dangerouslySetInnerHTML/eval in frontend
- Enumeration defense: same error for invalid email/password
- PASSWORD_REGEX: 8+ chars, upper, lower, digit, special
- Password history (5 previous hashes) reuse prevention
- 90-day password expiry check on login
- Token rotation on refresh
- accessToken: Zustand memory only
- refreshToken: httpOnly + Secure + SameSite=lax cookie
- Concurrent refresh prevention (refreshingPromise singleton)
- Admin role verification on ALL /api/admin/* endpoints
- Transaction wrapping for multi-step DB operations
- crypto.getRandomValues() for temp password generation
- Suspended account check on login + refresh
- Self password-reset blocked (admin can't reset own via API)

## Key File Paths
- `/Users/sein/Desktop/similarity_callsign/src/middleware.ts`
- `/Users/sein/Desktop/similarity_callsign/src/lib/jwt.ts`
- `/Users/sein/Desktop/similarity_callsign/src/lib/db/sqlite.ts`
- `/Users/sein/Desktop/similarity_callsign/src/lib/api/client.ts`
- `/Users/sein/Desktop/similarity_callsign/src/store/authStore.ts`
- `/Users/sein/Desktop/similarity_callsign/next.config.js`
- `/Users/sein/Desktop/similarity_callsign/.env.local`

## Architecture Notes
- Backend: SQLite (better-sqlite3) with abstraction layer (src/lib/db/index.ts -> sqlite.ts)
- JWT created via jsonwebtoken library
- AccessToken payload: userId, email, role, status, airlineId
- RefreshToken payload: userId only
- bcryptjs salt rounds: 10
- WAL mode + foreign_keys ON in SQLite
- 32 API endpoints total across auth, admin, airlines, actions, announcements, callsigns
