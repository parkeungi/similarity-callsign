# Supabase 데이터베이스 백업 스크립트 (Windows PowerShell)
# 사용법: .\scripts\backup-database.ps1
#
# 사전 요구사항:
# - PostgreSQL 클라이언트 설치 (pg_dump 명령어 필요)
# - DATABASE_URL 환경 변수 또는 .env.local 파일

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Supabase Database Backup Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 환경 변수에서 DATABASE_URL 로드
if (-not $env:DATABASE_URL) {
    Write-Host "DATABASE_URL 환경 변수 확인 중..." -ForegroundColor Yellow

    # .env.local에서 읽기
    $envPath = Join-Path $PSScriptRoot "..\\.env.local"
    if (Test-Path $envPath) {
        $envContent = Get-Content $envPath
        $dbUrlLine = $envContent | Where-Object { $_ -match "^DATABASE_URL=" }
        if ($dbUrlLine) {
            $env:DATABASE_URL = ($dbUrlLine -split "=", 2)[1].Trim('"').Trim("'")
            Write-Host ".env.local에서 DATABASE_URL 로드 완료" -ForegroundColor Green
        }
    }

    if (-not $env:DATABASE_URL) {
        Write-Error "DATABASE_URL 환경 변수가 설정되지 않았습니다."
        Write-Host "해결 방법:" -ForegroundColor Yellow
        Write-Host "  1. .env.local 파일에 DATABASE_URL 추가"
        Write-Host "  2. 또는 환경 변수 설정: `$env:DATABASE_URL = 'postgresql://...'`"
        exit 1
    }
}

# pg_dump 확인
try {
    $null = Get-Command pg_dump -ErrorAction Stop
} catch {
    Write-Error "pg_dump 명령어를 찾을 수 없습니다."
    Write-Host "PostgreSQL 클라이언트를 설치해주세요:" -ForegroundColor Yellow
    Write-Host "  https://www.postgresql.org/download/windows/"
    exit 1
}

# 백업 디렉토리 생성
$backupDir = Join-Path $PSScriptRoot "..\backups"
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
    Write-Host "백업 디렉토리 생성: $backupDir" -ForegroundColor Green
}

# 백업 파일명 생성
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = Join-Path $backupDir "backup_full_$timestamp.dump"

Write-Host ""
Write-Host "백업 시작..." -ForegroundColor Cyan
Write-Host "  대상: Supabase PostgreSQL"
Write-Host "  파일: $backupFile"
Write-Host ""

# pg_dump 실행
$startTime = Get-Date
pg_dump $env:DATABASE_URL -F c -f $backupFile 2>&1

if ($LASTEXITCODE -eq 0) {
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalSeconds
    $size = (Get-Item $backupFile).Length / 1MB

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  백업 완료!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  파일: $backupFile"
    Write-Host "  크기: $([math]::Round($size, 2)) MB"
    Write-Host "  소요 시간: $([math]::Round($duration, 1))초"
    Write-Host ""

    # 30일 이상 된 백업 삭제
    $oldBackups = Get-ChildItem (Join-Path $backupDir "backup_*.dump") |
        Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) }

    if ($oldBackups.Count -gt 0) {
        $oldBackups | Remove-Item -Force
        Write-Host "30일 이상 된 백업 $($oldBackups.Count)개 정리 완료" -ForegroundColor Yellow
    }

    # 현재 백업 목록 출력
    Write-Host ""
    Write-Host "현재 보유 백업:" -ForegroundColor Cyan
    Get-ChildItem (Join-Path $backupDir "backup_*.dump") |
        Sort-Object LastWriteTime -Descending |
        ForEach-Object {
            $s = $_.Length / 1MB
            Write-Host "  $($_.Name) - $([math]::Round($s, 2)) MB"
        }

} else {
    Write-Host ""
    Write-Error "백업 실패!"
    Write-Host "오류 원인을 확인해주세요:" -ForegroundColor Yellow
    Write-Host "  1. DATABASE_URL이 올바른지 확인"
    Write-Host "  2. 네트워크 연결 확인"
    Write-Host "  3. Supabase에서 IP 허용 확인"
    exit 1
}
