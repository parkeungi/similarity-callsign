# Senior Code Reviewer - Agent Memory

## Project: 유사호출부호 공유시스템

### Key Architecture Facts
- Next.js 14 App Router, TypeScript, Tailwind CSS, TanStack Query v5, Zustand
- Auth: accessToken in memory (Zustand), refreshToken in httpOnly cookie, user info in `user` JS cookie
- DB: SQLite (better-sqlite3) - PostgreSQL support removed. Single DB mode only.
- User type uses `id` not `_id`
- DB layer: src/lib/db/index.ts → sqlite.ts → sqlite-schema.ts

### DB Layer Architecture (Post-SQLite Migration)
- `src/lib/db/index.ts` - thin passthrough to sqlite.ts (PostgreSQL removed)
- `src/lib/db/sqlite.ts` - SQLite driver, NO RETURNING clause stripping (direct better-sqlite3)
- `src/lib/db/sqlite-schema.ts` - schema init + sample data
- IDs are TEXT (hex UUID-like via `lower(hex(randomblob(16)))`), NOT integer AUTOINCREMENT
- Schema tables: airlines, users, password_history, audit_logs, file_uploads, callsigns,
  callsign_occurrences, actions, action_history, announcements, announcement_views

### Confirmed query() return shape (sqlite.ts)
- SELECT: `{ rows: any[], rowCount: number }` - rows available
- INSERT/UPDATE/DELETE: `{ changes: number, rowCount: number }` - NO rows property
- All INSERT/UPDATE must follow-up with SELECT to retrieve row data
- Pattern: await query(INSERT...) then await query(SELECT WHERE unique_key = ?)

### transaction() behavior (sqlite.ts)
- Returns whatever the callback returns
- The callback receives `query` function as `trx` parameter
- transaction return value shape depends on what callback returns
- When callback returns a SELECT result: has .rows and .rowCount
- When callback returns fallback `{ rows: [], changes: 0 }`: checking result.changes is WRONG
  because SELECT results have no .changes property → always undefined → always 0

### SQLite-specific SQL constraints
- No `?` as SQL fragment (WHERE ? or SET ?) - ? is value placeholder only
- No PostgreSQL functions: ANY(), string_to_array(), ILIKE, $N params, ::cast, ROW_NUMBER (supported in SQLite 3.25+)
- RETURNING clause: NOT supported in all SQLite versions - avoid or use follow-up SELECT
- IN clause with array: must expand `callsignIds.map(()=>'?').join(',')`
- COALESCE(boolean_expr, false): SQLite returns 0/1 for booleans, not true/false

### Confirmed Patterns

**API Response Pattern**: snake_case + camelCase both returned (intentional dual-field pattern)

**Auth Guard Pattern**: `document.cookie` reads `user` JS cookie for client-side auth

**POST after INSERT pattern (correct)**:
```
await query('INSERT INTO ...', params);
const result = await query('SELECT ... WHERE unique_field = ?', [value]);
return result.rows[0];
```

### Critical Schema Facts
- `announcement_views` table (NOT `announcement_reads`)
- `file_uploads` columns: file_name, file_size, uploaded_by, status, uploaded_at (no stored_filename, mimetype)
- `actions` schema requires `airline_id` (NOT NULL)

### Remaining Bugs After Feb 2026 Fixes (2026-02-28 Review)

#### CRITICAL - Still Broken:
1. **`actions/route.ts` L125 - countSql `%?%` not fixed**
   - Main sql block (L82-88) was fixed to `%${search}%`
   - countSql block (L125) still uses literal `%?%` string
   - COUNT query returns wrong total when search is active

2. **`airlines/[airlineId]/callsigns/route.ts` L125 - `?` fragment in countSql**
   - countSql L125: ends with bare `?` but countRiskCondition is NOT interpolated
   - The variable `countRiskCondition` is defined (L114) but never used in the SQL
   - Query will throw SQLite error: unexpected `?` at end of WHERE clause
   - The main query (L93) correctly uses `${riskLevelCondition}` but countSql uses `?`

3. **`actions/[id]/route.ts` L274 - transaction result.changes always undefined**
   - transaction callback returns `updated` (a SELECT result) or `{ rows: [], changes: 0 }`
   - SELECT results have no `.changes` property → always undefined
   - `if (result.changes === 0 || result.rows.length === 0)` → always triggers false positive
   - Should check only `result.rows.length === 0`

#### MEDIUM - Logic/Quality Issues:
4. **`announcements/history/route.ts` L161 - `COALESCE(av.id IS NOT NULL, false)`**
   - SQLite returns 0/1 for boolean expressions, not true/false
   - Should be: `CASE WHEN av.id IS NOT NULL THEN 1 ELSE 0 END as "isViewed"`
   - Or just use: `av.id IS NOT NULL as "isViewed"` (returns 0/1 which JS coerces to boolean)

5. **`admin/file-uploads/[id]/route.ts` L82 - `if (!deleteResult)` always false**
   - query() always returns an object `{ changes, rowCount }` - never null/undefined
   - Existence check before delete was already done at line 42-45, so this is dead logic
   - Should check `deleteResult.changes === 0` to detect "not found" race condition

6. **`airlines/[airlineId]/actions/route.ts` L397 - error message template bug**
   - `{ error: \`조치 생성 중 오류가 발생했습니다: ?\` }` - literal `?` not interpolated
   - `errorMessage` variable is captured but not used in the template string
   - Should be: `{ error: \`조치 생성 중 오류가 발생했습니다: ${errorMessage}\` }`

#### FIXED (Verified Clean):
- WHERE ? pattern: all removed
- SET ? pattern: all removed
- ANY(string_to_array): removed
- ILIKE: removed
- $N params: removed (only in .bak files)
- INSERT then .rows[0] crash: all fixed with follow-up SELECT
- IN clause placeholders: fixed in file-uploads/[id]
- Main search `%?%` in actions/route.ts data query: fixed
- callsigns/route.ts WHERE fragment: fixed
- admin/announcements/route.ts: fully clean
- admin/announcements/[id]/route.ts: fully clean
- admin/users/[id]/route.ts: fully clean
- admin/airlines/[id]/route.ts: fully clean
- admin/airlines/route.ts: fully clean
- admin/users/route.ts: fully clean
- announcements/route.ts: fully clean
- announcements/[id]/route.ts: fully clean
- announcements/history/route.ts: WHERE ? fixed (but COALESCE issue remains)
- airlines/[airlineId]/actions/route.ts: POST SELECT fix correct, GET search fix correct

### SQLite Compatibility Score
- Before fixes: ~40% (many critical SQL errors)
- After Feb 2026 fixes: ~85% (3 critical bugs remain, 3 medium bugs)
- Production ready: NO - callsigns count query and actions search count are broken

See: patterns.md for detailed patterns
