#!/bin/bash
# Supabase 데이터베이스 백업 스크립트 (Linux/Mac)
# 사용법: ./scripts/backup-database.sh
#
# 사전 요구사항:
# - PostgreSQL 클라이언트 설치 (pg_dump 명령어 필요)
# - DATABASE_URL 환경 변수 또는 .env.local 파일

set -e

echo "========================================"
echo "  Supabase Database Backup Script"
echo "========================================"
echo ""

# 스크립트 디렉토리 기준 프로젝트 루트
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 환경 변수 로드
if [ -z "$DATABASE_URL" ]; then
    echo "DATABASE_URL 환경 변수 확인 중..."

    if [ -f "$PROJECT_ROOT/.env.local" ]; then
        export $(grep -E "^DATABASE_URL=" "$PROJECT_ROOT/.env.local" | xargs)
        echo ".env.local에서 DATABASE_URL 로드 완료"
    fi

    if [ -z "$DATABASE_URL" ]; then
        echo "ERROR: DATABASE_URL 환경 변수가 설정되지 않았습니다."
        echo ""
        echo "해결 방법:"
        echo "  1. .env.local 파일에 DATABASE_URL 추가"
        echo "  2. 또는: export DATABASE_URL='postgresql://...'"
        exit 1
    fi
fi

# pg_dump 확인
if ! command -v pg_dump &> /dev/null; then
    echo "ERROR: pg_dump 명령어를 찾을 수 없습니다."
    echo ""
    echo "PostgreSQL 클라이언트 설치:"
    echo "  Mac: brew install postgresql"
    echo "  Ubuntu: sudo apt install postgresql-client"
    exit 1
fi

# 백업 디렉토리 생성
BACKUP_DIR="$PROJECT_ROOT/backups"
mkdir -p "$BACKUP_DIR"

# 백업 파일명 생성
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_full_$TIMESTAMP.dump"

echo ""
echo "백업 시작..."
echo "  대상: Supabase PostgreSQL"
echo "  파일: $BACKUP_FILE"
echo ""

# pg_dump 실행
START_TIME=$(date +%s)

if pg_dump "$DATABASE_URL" -F c -f "$BACKUP_FILE"; then
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)

    echo ""
    echo "========================================"
    echo "  백업 완료!"
    echo "========================================"
    echo "  파일: $BACKUP_FILE"
    echo "  크기: $SIZE"
    echo "  소요 시간: ${DURATION}초"
    echo ""

    # 30일 이상 된 백업 삭제
    OLD_COUNT=$(find "$BACKUP_DIR" -name "backup_*.dump" -mtime +30 | wc -l)
    if [ "$OLD_COUNT" -gt 0 ]; then
        find "$BACKUP_DIR" -name "backup_*.dump" -mtime +30 -delete
        echo "30일 이상 된 백업 ${OLD_COUNT}개 정리 완료"
    fi

    # 현재 백업 목록 출력
    echo ""
    echo "현재 보유 백업:"
    ls -lh "$BACKUP_DIR"/backup_*.dump 2>/dev/null | awk '{print "  " $9 " - " $5}'

else
    echo ""
    echo "ERROR: 백업 실패!"
    echo ""
    echo "오류 원인을 확인해주세요:"
    echo "  1. DATABASE_URL이 올바른지 확인"
    echo "  2. 네트워크 연결 확인"
    echo "  3. Supabase에서 IP 허용 확인"
    exit 1
fi
