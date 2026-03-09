#!/bin/bash

# 🚀 KATC1 로컬 개발 시작 스크립트
# SQLite + 3000 포트 자동 설정

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PORT=3000
DB_RUNTIME_MODE="supabase"

# 함수: 헤더 출력
print_header() {
  echo -e "\n${BLUE}════════════════════════════════════════${NC}"
  echo -e "${BLUE}🛫 KATC1 유사호출부호 경고시스템${NC}"
  echo -e "${BLUE}════════════════════════════════════════${NC}\n"
}

# 함수: 포트 킬 (기존 프로세스 종료)
kill_port() {
  echo -e "\n${YELLOW}🔍 포트 $PORT 확인 중...${NC}"

  # macOS/Linux에서 포트 사용 중인 프로세스 찾기
  if lsof -i :$PORT > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  포트 $PORT이(가) 이미 사용 중입니다. 프로세스 종료 중...${NC}"

    # PID 찾아서 종료
    pid=$(lsof -ti :$PORT)
    if [ ! -z "$pid" ]; then
      kill -9 $pid 2>/dev/null || true
      echo -e "${GREEN}✓ 포트 $PORT의 프로세스 종료 완료 (PID: $pid)${NC}"
      sleep 1
    fi
  else
    echo -e "${GREEN}✓ 포트 $PORT 사용 가능${NC}"
  fi
}

# 함수: 캐시 초기화
clear_cache() {
  echo -e "\n${BLUE}🗑️  캐시 정리 중...${NC}"

  # Next.js 빌드 캐시 제거
  if [ -d .next ]; then
    rm -rf .next
    echo -e "${GREEN}✓ .next 캐시 제거 완료${NC}"
  fi

  # npm 캐시 제거
  if [ -d node_modules/.cache ]; then
    rm -rf node_modules/.cache
    echo -e "${GREEN}✓ node_modules/.cache 제거 완료${NC}"
  fi

  # Turbo 캐시 제거
  if [ -d .turbo ]; then
    rm -rf .turbo
    echo -e "${GREEN}✓ .turbo 캐시 제거 완료${NC}"
  fi

  # 브라우저 캐시 정리 안내
  echo -e "${YELLOW}💡 팁: 브라우저에서 Ctrl+Shift+Delete로 캐시를 비우면 더 완벽합니다${NC}"
}

# 공용 함수: 기존 .env.local 백업
backup_env_file() {
  if [ -f .env.local ]; then
    local backup_file=".env.local.bak-$(date +%s)"
    cp .env.local "$backup_file"
    echo -e "${YELLOW}⚠️  기존 .env.local을 ${backup_file} 로 백업했습니다.${NC}"
  fi
}

# 공용 함수: 민감 정보 마스킹 출력
mask_value() {
  local value="$1"
  local length=${#value}
  if [ "$length" -le 4 ]; then
    echo "***"
  else
    local prefix=${value:0:4}
    local suffix=${value: -2}
    echo "${prefix}***${suffix}"
  fi
}

# 함수: SQLite 환경 설정
setup_sqlite() {
  echo -e "\n${BLUE}📝 SQLite 환경 설정 중...${NC}"
  backup_env_file
  DB_RUNTIME_MODE="sqlite"

  cat > .env.local <<'EOF'
DB_PROVIDER=sqlite
DB_PATH=./data/katc1.db
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_BKEND_PROJECT_ID=
JWT_SECRET=dev-secret-key-for-local-only
SESSION_SECRET=dev-session-secret-for-local-only
EOF

  echo -e "${GREEN}✓ .env.local 설정 완료 (SQLite)${NC}"
  mkdir -p ./data
  echo -e "${GREEN}✓ 데이터 디렉토리 준비 완료${NC}"
  echo -e "${BLUE}환경 요약:${NC}"
  echo -e "  DB_PROVIDER: sqlite"
  echo -e "  DB_PATH: ./data/katc1.db"
}

# 함수: Supabase 환경 설정
setup_supabase() {
  echo -e "\n${BLUE}📝 Supabase 환경 설정 중...${NC}"
  backup_env_file
  DB_RUNTIME_MODE="supabase"

  read -rp "DATABASE_URL (Supabase Postgres) : " DATABASE_URL_INPUT
  read -rp "NEXT_PUBLIC_SUPABASE_URL        : " SUPABASE_URL_INPUT
  read -rp "NEXT_PUBLIC_SUPABASE_ANON_KEY   : " SUPABASE_ANON_INPUT
  read -sp "SUPABASE_SERVICE_ROLE_KEY (optional, Enter 생략 가능): " SUPABASE_SERVICE_ROLE_INPUT
  echo ""

  if [[ -z "$DATABASE_URL_INPUT" || -z "$SUPABASE_URL_INPUT" || -z "$SUPABASE_ANON_INPUT" ]]; then
    echo -e "${RED}❌ 필수 값이 비어있습니다. Supabase 모드 설정을 중단합니다.${NC}"
    exit 1
  fi

  cat > .env.local <<EOF
DB_PROVIDER=postgresql
DATABASE_URL=${DATABASE_URL_INPUT}
NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL_INPUT}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_INPUT}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_INPUT}
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_BKEND_PROJECT_ID=
JWT_SECRET=dev-secret-key-for-local-only
SESSION_SECRET=dev-session-secret-for-local-only
EOF

  echo -e "${GREEN}✓ .env.local 설정 완료 (Supabase)${NC}"
  echo -e "${BLUE}환경 요약:${NC}"
  echo -e "  DB_PROVIDER: postgresql"
  echo -e "  DATABASE_URL: $(mask_value "$DATABASE_URL_INPUT")"
  echo -e "  NEXT_PUBLIC_SUPABASE_URL: $SUPABASE_URL_INPUT"
  echo -e "  NEXT_PUBLIC_SUPABASE_ANON_KEY: $(mask_value "$SUPABASE_ANON_INPUT")"
  if [ -n "$SUPABASE_SERVICE_ROLE_INPUT" ]; then
    echo -e "  SUPABASE_SERVICE_ROLE_KEY: $(mask_value "$SUPABASE_SERVICE_ROLE_INPUT")"
  else
    echo -e "  SUPABASE_SERVICE_ROLE_KEY: (empty)"
  fi
  echo -e "${YELLOW}추가 확인:${NC} psql \"$DATABASE_URL_INPUT\" -c '\\dt'"
}

# 함수: DB 모드 선택
select_db_mode() {
  echo -e "\n${BLUE}DB 모드를 선택하세요:${NC}"
  echo -e "  1) SQLite (기본)"
  echo -e "  2) Supabase (PostgreSQL)"
  read -rp "선택 (1/2) [1]: " DB_MODE
  case "$DB_MODE" in
    2)
      echo "Supabase 모드로 진행합니다."
      setup_supabase
      ;;
    *)
      echo "SQLite 모드로 진행합니다."
      setup_sqlite
      ;;
  esac
}

# 함수: Next.js 개발 서버 시작
start_next_dev() {
  echo -e "\n${BLUE}📦 의존성 설치 확인 중...${NC}"

  if [ ! -d node_modules ]; then
    echo -e "${YELLOW}⏳ npm install 중...${NC}"
    npm install
  fi

  export WATCHPACK_POLLING=true
  echo -e "\n${GREEN}════════════════════════════════════════${NC}"
  echo -e "${GREEN}✓ 개발 서버 시작!${NC}"
  echo -e "${GREEN}════════════════════════════════════════${NC}"
  echo -e "\n${BLUE}📍 로컬 애플리케이션:${NC}"
  echo -e "   ${BLUE}http://localhost:3000${NC}"
  echo ""
  echo -e "${YELLOW}테스트 계정:${NC}"
  echo -e "   관리자: admin@katc.com / Admin1234"
  echo -e "   사용자: kal-user@katc.com / User1234"
  echo ""
  echo -e "${YELLOW}데이터베이스:${NC}"
  if [ "$DB_RUNTIME_MODE" = "supabase" ]; then
    echo -e "   Supabase Postgres (DB_PROVIDER=postgresql)"
  else
    echo -e "   SQLite: ./data/katc1.db"
  fi
  echo ""
  echo -e "${YELLOW}중지하려면 Ctrl+C를 누르세요${NC}\n"

  # Next.js dev 서버 시작
  npm run dev
}

# 함수: 종료 핸들러
cleanup() {
  echo -e "\n\n${YELLOW}🛑 개발 서버를 종료합니다...${NC}"
  echo -e "${GREEN}✓ 종료 완료${NC}"
  exit 0
}

# 메인 실행
main() {
  print_header

  # Ctrl+C 트래핑
  trap cleanup SIGINT SIGTERM

  # 1️⃣ 포트 체크 및 킬 (기존 프로세스 종료)
  kill_port

  # 2️⃣ 캐시 초기화
  clear_cache

  # 3️⃣ 데이터베이스 모드 설정 (Supabase 자동 선택)
  if [ -f .env.local ] && grep -q "DB_PROVIDER=postgresql" .env.local; then
    echo -e "\n${GREEN}✓ 기존 Supabase 설정 사용 (.env.local)${NC}"
  else
    setup_supabase
  fi

  # 4️⃣ Next.js 시작
  start_next_dev
}

# 스크립트 실행
main
