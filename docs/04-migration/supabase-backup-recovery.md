# Supabase 백업 및 복구 가이드

> 이 문서는 Supabase PostgreSQL 데이터베이스의 백업 정책, 복구 방법, 그리고 데이터 보존 전략을 설명합니다.

---

## 1. Supabase 자동 백업 정책

### 플랜별 백업 보존 기간

| 플랜 | 백업 주기 | 보존 기간 | PITR 지원 |
|------|----------|----------|-----------|
| **Free** | 매일 1회 | **7일** | X |
| Pro | 매일 1회 | 7일 | 추가 가능 (유료) |
| Team | 매일 1회 | 14일 | 추가 가능 |
| Enterprise | 커스텀 | 협의 | 포함 |

### 자동 백업 특징

- **전체 백업(Full Snapshot)**: 매일 데이터베이스 전체를 스냅샷으로 저장
- **별도 설정 불필요**: Supabase가 자동으로 수행
- **Dashboard에서 관리**: Settings > Database > Backups

---

## 2. 백업 보존 기간의 의미

### 7일 보존 기간 예시

```
오늘: 2026년 3월 20일

보존된 백업 (복원 가능):
├── 3월 20일 백업 ✅
├── 3월 19일 백업 ✅
├── 3월 18일 백업 ✅
├── 3월 17일 백업 ✅
├── 3월 16일 백업 ✅
├── 3월 15일 백업 ✅
├── 3월 14일 백업 ✅
│
삭제된 백업 (복원 불가):
├── 3월 13일 백업 ❌ (자동 삭제됨)
├── 3월 12일 백업 ❌
└── 그 이전 ❌
```

### 실제 상황별 복원 가능 여부

| 상황 | 발견 시점 | 복원 가능 여부 |
|------|----------|---------------|
| 3월 15일 실수로 데이터 삭제 | 3월 18일 (3일 후) | ✅ 가능 - 3월 14일 백업 사용 |
| 3월 10일 실수로 데이터 삭제 | 3월 20일 (10일 후) | ❌ 불가능 - 백업 이미 삭제됨 |
| 3월 19일 잘못된 UPDATE 실행 | 3월 20일 (1일 후) | ✅ 가능 - 3월 18일 백업 사용 |

---

## 3. Supabase Dashboard에서 복원하기

### 3.1 백업 목록 확인

1. [Supabase Dashboard](https://supabase.com/dashboard) 접속
2. 프로젝트 선택 (`kkervrjezzhuzdkzgtme`)
3. **Settings** > **Database** > **Backups** 이동
4. 사용 가능한 백업 목록 확인

### 3.2 백업에서 복원

1. 복원할 날짜의 백업 선택
2. **Restore** 버튼 클릭
3. 확인 다이얼로그에서 **Confirm** 클릭
4. 복원 완료까지 대기 (데이터 크기에 따라 수 분 ~ 수십 분)

> **주의**: 복원 시 현재 데이터가 해당 시점의 데이터로 **완전히 덮어씌워집니다**.

---

## 4. 수동 백업 (pg_dump)

Supabase 자동 백업 외에 직접 백업을 생성하는 방법입니다.

### 4.1 환경 변수 설정

```bash
# .env.local 또는 환경에서 DATABASE_URL 확인
# 형식: postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
```

### 4.2 전체 백업 (스키마 + 데이터)

```bash
# Windows (PowerShell)
$DATE = Get-Date -Format "yyyyMMdd_HHmmss"
pg_dump $env:DATABASE_URL -F c -f "backup_full_$DATE.dump"

# Linux/Mac
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump "$DATABASE_URL" -F c -f "backup_full_${DATE}.dump"
```

### 4.3 스키마만 백업

```bash
pg_dump "$DATABASE_URL" --schema-only -f "backup_schema_$(date +%Y%m%d).sql"
```

### 4.4 데이터만 백업

```bash
pg_dump "$DATABASE_URL" --data-only -f "backup_data_$(date +%Y%m%d).sql"
```

### 4.5 특정 테이블만 백업

```bash
# callsigns 테이블만 백업
pg_dump "$DATABASE_URL" -t callsigns -f "backup_callsigns_$(date +%Y%m%d).sql"

# 여러 테이블 백업
pg_dump "$DATABASE_URL" -t callsigns -t actions -t users -f "backup_core_$(date +%Y%m%d).sql"
```

---

## 5. 수동 복원 (pg_restore / psql)

### 5.1 Custom 형식(.dump) 복원

```bash
# 전체 복원 (기존 데이터 삭제 후)
pg_restore --clean --if-exists -d "$DATABASE_URL" backup_full_20260320.dump

# 데이터만 복원 (스키마 유지)
pg_restore --data-only -d "$DATABASE_URL" backup_full_20260320.dump
```

### 5.2 SQL 파일(.sql) 복원

```bash
# psql로 SQL 파일 실행
psql "$DATABASE_URL" -f backup_data_20260320.sql
```

### 5.3 특정 테이블만 복원

```bash
# 1. 기존 테이블 데이터 삭제 (필요시)
psql "$DATABASE_URL" -c "TRUNCATE TABLE callsigns CASCADE;"

# 2. 백업에서 해당 테이블만 복원
pg_restore -d "$DATABASE_URL" -t callsigns backup_full_20260320.dump
```

---

## 6. 백업 자동화 스크립트

### 6.1 Windows (PowerShell 스크립트)

`scripts/backup-database.ps1` 파일 생성:

```powershell
# Supabase 데이터베이스 백업 스크립트
# 사용법: .\scripts\backup-database.ps1

$ErrorActionPreference = "Stop"

# 환경 변수에서 DATABASE_URL 로드
if (-not $env:DATABASE_URL) {
    # .env.local에서 읽기
    $envFile = Get-Content ".env.local" | Where-Object { $_ -match "^DATABASE_URL=" }
    if ($envFile) {
        $env:DATABASE_URL = ($envFile -split "=", 2)[1].Trim('"')
    } else {
        Write-Error "DATABASE_URL 환경 변수가 설정되지 않았습니다."
        exit 1
    }
}

# 백업 디렉토리 생성
$backupDir = "backups"
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir
}

# 백업 파일명 생성
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "$backupDir\backup_full_$timestamp.dump"

Write-Host "백업 시작: $backupFile"

# pg_dump 실행
pg_dump $env:DATABASE_URL -F c -f $backupFile

if ($LASTEXITCODE -eq 0) {
    $size = (Get-Item $backupFile).Length / 1MB
    Write-Host "백업 완료: $backupFile ($([math]::Round($size, 2)) MB)"

    # 30일 이상 된 백업 삭제
    Get-ChildItem "$backupDir\backup_*.dump" |
        Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } |
        Remove-Item -Force
    Write-Host "30일 이상 된 백업 정리 완료"
} else {
    Write-Error "백업 실패!"
    exit 1
}
```

### 6.2 Linux/Mac (Bash 스크립트)

`scripts/backup-database.sh` 파일 생성:

```bash
#!/bin/bash
# Supabase 데이터베이스 백업 스크립트
# 사용법: ./scripts/backup-database.sh

set -e

# 환경 변수 로드
if [ -z "$DATABASE_URL" ]; then
    if [ -f ".env.local" ]; then
        export $(grep DATABASE_URL .env.local | xargs)
    else
        echo "ERROR: DATABASE_URL 환경 변수가 설정되지 않았습니다."
        exit 1
    fi
fi

# 백업 디렉토리 생성
BACKUP_DIR="backups"
mkdir -p "$BACKUP_DIR"

# 백업 파일명 생성
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_full_$TIMESTAMP.dump"

echo "백업 시작: $BACKUP_FILE"

# pg_dump 실행
pg_dump "$DATABASE_URL" -F c -f "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "백업 완료: $BACKUP_FILE ($SIZE)"

    # 30일 이상 된 백업 삭제
    find "$BACKUP_DIR" -name "backup_*.dump" -mtime +30 -delete
    echo "30일 이상 된 백업 정리 완료"
else
    echo "백업 실패!"
    exit 1
fi
```

---

## 7. 권장 백업 전략

### 7.1 일반 운영 환경

| 백업 유형 | 주기 | 보존 기간 | 방법 |
|----------|------|----------|------|
| 자동 백업 | 매일 | 7일 | Supabase 자동 |
| 수동 백업 | 주 1회 | 30일 | pg_dump 스크립트 |
| 배포 전 백업 | 배포 시 | 90일 | 수동 실행 |

### 7.2 중요 이벤트 시 백업

다음 상황에서는 **반드시 수동 백업**을 권장합니다:

```
✅ 대규모 데이터 마이그레이션 전
✅ 스키마 변경 (ALTER TABLE) 전
✅ 프로덕션 배포 전
✅ 일괄 데이터 수정/삭제 작업 전
✅ 새로운 기능 릴리스 전
```

### 7.3 백업 파일 관리

```
backups/
├── backup_full_20260320_100000.dump    # 최신
├── backup_full_20260313_100000.dump    # 1주 전
├── backup_full_20260306_100000.dump    # 2주 전
├── backup_full_20260227_100000.dump    # 3주 전
└── backup_full_20260220_100000.dump    # 4주 전 (30일 후 자동 삭제)
```

---

## 8. PITR (Point-in-Time Recovery)

### PITR이란?

- **특정 시점으로 복원**: 초 단위로 원하는 시점으로 복원 가능
- 예: "2026년 3월 20일 오후 2시 35분 42초" 상태로 복원

### Free 플랜 vs PITR

| 기능 | Free 플랜 (일일 백업) | PITR (Pro 추가 옵션) |
|------|---------------------|---------------------|
| 복원 단위 | 하루 단위 | 초 단위 |
| 데이터 손실 | 최대 24시간 | 최소화 (거의 없음) |
| 비용 | 무료 | 월 $100+ |
| 적합 대상 | 일반 서비스 | 금융, 의료, 미션 크리티컬 |

### PITR 활성화 (Pro 플랜 이상)

1. Dashboard > Settings > Addons
2. "Point in Time Recovery" 활성화
3. 복원 시 특정 타임스탬프 지정 가능

---

## 9. 문제 해결

### 9.1 pg_dump 연결 실패

```bash
# 오류: connection refused
# 해결: Supabase에서 IP 허용 확인
# Dashboard > Settings > Database > Connection Pooling > Allow connections from
```

### 9.2 복원 시 권한 오류

```bash
# 오류: permission denied
# 해결: --no-owner 옵션 사용
pg_restore --no-owner -d "$DATABASE_URL" backup.dump
```

### 9.3 대용량 백업 타임아웃

```bash
# 오류: timeout
# 해결: Direct Connection 사용 (Pooler 우회)
# Transaction pooler (6543) 대신 Direct connection (5432) 사용
```

---

## 10. 체크리스트

### 백업 상태 확인

| 항목 | 상태 | 확인일 |
|------|------|--------|
| Supabase 자동 백업 활성화 | ☐ | |
| 수동 백업 스크립트 준비 | ☐ | |
| 최근 수동 백업 일자 | - | |
| 백업 복원 테스트 완료 | ☐ | |
| 백업 파일 저장 위치 확인 | ☐ | |

### 권장 액션

1. [ ] 주 1회 수동 백업 실행 루틴 수립
2. [ ] 배포 전 백업 체크리스트에 추가
3. [ ] 백업 파일 외부 저장소(S3, Google Drive 등) 동기화 검토

---

## 11. 로컬 백업 및 외부 저장소 동기화

### 11.1 로컬 PC에 백업하기

**방법 1: 스크립트 사용 (권장)**

```powershell
# Windows PowerShell
.\scripts\backup-database.ps1
```

```bash
# Linux/Mac
chmod +x scripts/backup-database.sh
./scripts/backup-database.sh
```

**방법 2: 직접 명령어 실행**

```bash
# 기본 백업 (전체)
pg_dump "$DATABASE_URL" -F c -f "backup_$(date +%Y%m%d).dump"

# SQL 텍스트 형식 (읽기 가능)
pg_dump "$DATABASE_URL" -f "backup_$(date +%Y%m%d).sql"

# 압축된 SQL
pg_dump "$DATABASE_URL" | gzip > "backup_$(date +%Y%m%d).sql.gz"
```

### 11.2 외부 저장소로 백업 동기화

#### Google Drive (Windows)

```powershell
# Google Drive 폴더로 복사 (Google Drive Desktop 설치 필요)
$backupFile = "backups\backup_full_$(Get-Date -Format 'yyyyMMdd').dump"
$googleDrive = "$env:USERPROFILE\Google Drive\KATC1_Backups"

# 폴더 생성
if (-not (Test-Path $googleDrive)) { New-Item -ItemType Directory -Path $googleDrive }

# 복사
Copy-Item $backupFile $googleDrive
Write-Host "Google Drive 동기화 완료: $googleDrive"
```

#### OneDrive (Windows)

```powershell
# OneDrive 폴더로 복사
$backupFile = "backups\backup_full_$(Get-Date -Format 'yyyyMMdd').dump"
$oneDrive = "$env:USERPROFILE\OneDrive\KATC1_Backups"

if (-not (Test-Path $oneDrive)) { New-Item -ItemType Directory -Path $oneDrive }
Copy-Item $backupFile $oneDrive
```

#### AWS S3

```bash
# AWS CLI 설치 후
aws s3 cp backups/backup_full_20260320.dump s3://your-bucket/katc1-backups/

# 전체 폴더 동기화
aws s3 sync backups/ s3://your-bucket/katc1-backups/ --exclude "*" --include "*.dump"
```

### 11.3 자동화된 로컬 백업 (Windows 작업 스케줄러)

**1단계: 배치 파일 생성**

`scripts/scheduled-backup.bat`:
```batch
@echo off
cd /d C:\Users\Administrator\Desktop\similarity-callsign
powershell -ExecutionPolicy Bypass -File scripts\backup-database.ps1
```

**2단계: 작업 스케줄러 등록**

```powershell
# PowerShell (관리자 권한)
$action = New-ScheduledTaskAction -Execute "C:\Users\Administrator\Desktop\similarity-callsign\scripts\scheduled-backup.bat"
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At 9am
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable

Register-ScheduledTask -TaskName "KATC1_Weekly_Backup" -Action $action -Trigger $trigger -Principal $principal -Settings $settings
```

### 11.4 자동화된 로컬 백업 (Linux/Mac Cron)

```bash
# crontab 편집
crontab -e

# 매주 월요일 오전 9시 백업
0 9 * * 1 /path/to/similarity-callsign/scripts/backup-database.sh >> /var/log/katc1-backup.log 2>&1

# 매일 새벽 2시 백업
0 2 * * * /path/to/similarity-callsign/scripts/backup-database.sh >> /var/log/katc1-backup.log 2>&1
```

### 11.5 백업 파일 관리 권장사항

```
백업 보관 전략:
├── 로컬 (backups/)
│   └── 최근 30일 보관 (스크립트가 자동 정리)
│
├── 외부 저장소 (Google Drive/OneDrive/S3)
│   ├── 주간 백업: 12주(3개월) 보관
│   └── 월간 백업: 12개월 보관
│
└── 중요 시점 백업 (영구 보관)
    ├── 프로덕션 배포 전
    ├── 대규모 마이그레이션 전
    └── 분기별 스냅샷
```

**백업 명명 규칙 (외부 저장소용)**:

```
backup_full_20260320_100000.dump        # 일반 백업
backup_predeploy_20260320_v2.1.0.dump   # 배포 전 백업
backup_monthly_202603.dump              # 월간 백업
backup_quarterly_2026Q1.dump            # 분기 백업
```

---

## 12. 참고 링크

- [Supabase Backups Documentation](https://supabase.com/docs/guides/platform/backups)
- [PostgreSQL pg_dump Manual](https://www.postgresql.org/docs/current/app-pgdump.html)
- [PostgreSQL pg_restore Manual](https://www.postgresql.org/docs/current/app-pgrestore.html)

---

**최종 수정**: 2026-03-20
**관리자**: sein
