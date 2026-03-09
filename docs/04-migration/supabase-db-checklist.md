# Supabase 데이터베이스 정합성 체크리스트 (프로젝트: kkervrjezzhuzdkzgtme)

> 목적: Supabase Postgres 인스턴스가 현재 저장소의 스키마/데이터 정의(`scripts/init.sql`, `docs/migration_step2_data.sql`)와 일치하는지 단계별로 검증한다.

---

## 1. 기준 문서

| 구분 | 역할 | 파일 |
|------|------|------|
| 스키마 정의 | 11개 테이블·인덱스·시드 데이터 구조 | `scripts/init.sql` |
| 2단계 데이터 마이그레이션 | callsigns 400건 + announcements | `docs/migration_step2_data.sql` |
| Gap 분석 참고 | API/데이터 모델 우선순위 | `docs/03-analysis/katc1-full-system-v5.analysis.md` |

---

## 2. 테이블 및 인덱스 목록

| 테이블 | 핵심 컬럼/제약 | 인덱스 |
|--------|----------------|--------|
| `airlines` | `code` UNIQUE, `display_order` | `idx_airlines_code` |
| `users` | `airline_id` FK → airlines, 상태/역할 CHECK, 비밀번호 정책 필드 | `idx_users_email`, `idx_users_airline_id`, `idx_users_status`, `idx_users_created_at`, `idx_users_role` |
| `password_history` | `user_id` FK → users | `idx_password_history_user_id` |
| `audit_logs` | JSONB old/new, `user_id` FK | `idx_audit_logs_user_id`, `idx_audit_logs_created_at` |
| `file_uploads` | 업로드 상태·카운터 | `idx_file_uploads_uploaded_at`, `idx_file_uploads_status`, `idx_file_uploads_uploaded_by` |
| `callsigns` | 30+ 필드, `airline_id` FK, 두 개의 UNIQUE 제약(`airline_id+callsign_pair`, `airline_code+callsign_pair`) | 위험도/상태 등 6개 인덱스 |
| `callsign_occurrences` | `callsign_id` FK, 발생일/상세 | 필요시 커스텀 인덱스 검토 |
| `actions` | `callsign_id` FK, `is_cancelled`, 상태 관리 | 사용률 높은 컬럼 기준 인덱스 TBD |
| `action_history` | `action_id` FK, 변경 로그 | 기본 PK |
| `announcements` | `status`, `is_pinned`, 공개 범위 | `idx_announcements_status`, `idx_announcements_is_pinned` (추가 필요 시) |
| `announcement_views` | `announcement_id` FK, `user_id` FK | `idx_announcement_views_user_id`, `idx_announcement_views_announcement_id` |

> 모든 테이블은 `UUID DEFAULT gen_random_uuid()`와 `TIMESTAMP DEFAULT NOW()` 패턴을 사용하므로 Supabase 인스턴스에 `pgcrypto` 확장이 활성화돼 있어야 한다.

---

## 3. 데이터 시드 확인 포인트

| 데이터셋 | 기대 수량 | 검증 쿼리 예시 |
|----------|-----------|---------------|
| `airlines` | 11건 (국내 항공사) | `SELECT code FROM airlines ORDER BY display_order;` |
| `users` | 최소 13건 (관리자 1 + 항공사 계정) | `SELECT email, role FROM users ORDER BY created_at;` |
| `file_uploads` | 2건 (샘플 엑셀) | `SELECT COUNT(*) FROM file_uploads;` |
| `callsigns` | 400건 (`docs/migration_step2_data.sql`) | `SELECT COUNT(*), MIN(created_at), MAX(created_at) FROM callsigns;` |
| `announcements` | 1건 이상 | `SELECT COUNT(*) FROM announcements;` |

데이터 값 자체는 동일할 필요가 없지만, 최소한 **수량·필수 필드 NULL 여부**와 **FK 무결성**을 확인한다.

---

## 4. Supabase 인스턴스 점검 절차

1. **연결 확인**  
   ```bash
   # DATABASE_URL 사용, sslmode=require 권장
    psql "$DATABASE_URL"
   ```
2. **필수 확장**  
   ```sql
   CREATE EXTENSION IF NOT EXISTS "pgcrypto";
   ```
3. **테이블 구조 비교**  
   ```sql
   \d+ airlines
   \d+ users
   -- 나머지 테이블도 동일하게 확인
   ```
   출력이 `scripts/init.sql` 정의와 동일한지 확인 후 차이는 체크박스에 기록.

4. **인덱스 검증**  
   ```sql
   SELECT indexname, tablename
   FROM pg_indexes
   WHERE schemaname = 'public'
     AND tablename IN ('airlines','users','callsigns', ... )
   ORDER BY tablename, indexname;
   ```

5. **데이터 카운트/샘플**  
   ```sql
   SELECT COUNT(*) FROM callsigns;
   SELECT airline_code, COUNT(*) FROM callsigns GROUP BY 1 ORDER BY COUNT(*) DESC;
   ```

6. **RLS/Policy 확인 (향후 단계)**  
   ```sql
   SELECT tablename, rlspolicy
   FROM pg_tables
   WHERE schemaname = 'public';
   ```
   → 현재는 RLS 미사용 상태로 예상되지만, 프론트엔드 전용 구조를 위해 필요한 정책을 추후 정의.

7. **덤프 후 diff (선택)**  
   ```bash
   supabase db dump --db-url "$DATABASE_URL" --schema public --file supabase-schema.sql
   diff -u scripts/init.sql supabase-schema.sql
   ```

---

## 5. 체크 항목 요약

| 항목 | 상태 | 메모 |
|------|------|------|
| `pgcrypto` 확장 활성화 | ☐ |  |
| 테이블 11개 생성 여부 | ☐ |  |
| UNIQUE / FK / CHECK 제약 일치 | ☐ |  |
| 인덱스 15+개 일치 | ☐ |  |
| Airlines 11건 | ☐ |  |
| Users 관리자 계정 존재 | ☐ |  |
| Callsigns 400건 (또는 최신 값) | ☐ |  |
| Announcements 최소 1건 | ☐ |  |
| 향후 RLS 정책 설계 필요 여부 기록 | ☐ |  |

체크 완료 후, 차이점은 `docs/04-migration/` 하위에 별도 diff 리포트를 남긴다.

---

## 6. 열린 이슈

- Supabase Auth와 기존 `users` 테이블을 어떻게 동기화할지 결정 필요 (별도 설계 문서 예정).
- RLS 정책 및 Edge Function 도입 여부는 프론트엔드 전용화 단계에서 확정.
- Supabase Storage/Functions 사용 계획 없음 → 필요 시 별도 검토.
