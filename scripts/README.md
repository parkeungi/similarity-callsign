# 🚀 유사호출부호 공유시스템 시작 스크립트 가이드

## 📌 개요

유사호출부호 공유시스템의 모든 컴포넌트(데이터베이스, 백엔드, 프론트엔드)를 관리하는 Bash 스크립트입니다.

- **start.sh** - 전체 시스템 시작
- **stop.sh** - 전체 시스템 중지

## 🎯 핵심 기능

### ✨ start.sh

**기존 프로세스 자동 종료 + 시스템 시작**

```bash
./start.sh
```

#### 수행 작업:
1. ✅ 포트 3000, 5432의 기존 프로세스 자동 종료
2. ✅ PostgreSQL 데이터베이스 시작
3. ✅ 각 서비스의 준비 상태 대기
4. ✅ Next.js 개발 서버 시작

#### 출력 예시:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  유사호출부호 공유시스템 시작
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1/3] 기존 프로세스 정리
  ⚠️  포트 3000에서 실행 중인 프로세스 발견
  🔴 PID 12345 종료 중...
  ✅ 포트 3000 정리 완료
  ✅ 포트 5432 비어있음

[2/3] PostgreSQL 데이터베이스 시작
  🚀 PostgreSQL 시작...
  ⏳ PostgreSQL 준비 대기...
  ✅ PostgreSQL 준비 완료 (PID: 12346)

[3/3] Next.js 개발 서버 시작
  🚀 Next.js 개발 서버 시작 (포트 3000)...
  📝 로그 파일: ~/.katc1/nextjs.log
  ⏳ Next.js 준비 대기...
  ✅ Next.js 준비 완료 (PID: 12347)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ 유사호출부호 공유시스템 시작 완료!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 서비스 정보:
  🌐 Frontend:  http://localhost:3000
  🗄️  Database:  localhost:5432

📝 프로세스 ID:
  PostgreSQL:  12346
  Next.js:     12347

📂 로그 파일:
  PostgreSQL:  ~/.katc1/postgres.log
  Next.js:     ~/.katc1/nextjs.log

💡 팁:
  • 시스템 중지: ./stop.sh
  • 로그 확인:  tail -f ~/.katc1/nextjs.log
  • 포트 확인:  lsof -i :3000
```

### 🛑 stop.sh

**실행 중인 모든 프로세스 안전 종료**

```bash
./stop.sh
```

#### 수행 작업:
1. ✅ Next.js 서버 종료 (포트 3000)
2. ✅ PostgreSQL 데이터베이스 종료 (포트 5432)

#### 출력 예시:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  유사호출부호 공유시스템 중지
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1/2] Next.js 프로세스 종료
  🔴 포트 3000에서 PID 12347 종료 중...
  ✅ Next.js 중지 완료

[2/2] PostgreSQL 프로세스 종료
  🔴 포트 5432에서 PID 12346 종료 중...
  ✅ PostgreSQL 중지 완료

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ 유사호출부호 공유시스템 중지 완료!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 팁:
  • 시스템 재시작: ./start.sh
```

---

## 📋 사전 요구사항

### 필수 설치

```bash
# macOS
brew install postgresql@15 node@20

# Ubuntu/Debian
sudo apt-get install postgresql-15 nodejs npm

# CentOS/RHEL
sudo dnf install postgresql-server nodejs npm
```

### 초기 설정

```bash
# 1. 의존성 설치
npm install

# 2. 데이터베이스 생성
createdb katc1_dev

# 3. 스키마 적용
psql -U $(whoami) -d katc1_dev -f scripts/init.sql

# 4. 환경 변수 설정
cp .env.example .env.local
```

---

## 🔄 일반적인 사용 시나리오

### 🌅 업무 시작

```bash
# 시스템 시작
./start.sh

# 브라우저 열기
open http://localhost:3000

# 또는
# firefox http://localhost:3000
# google-chrome http://localhost:3000
```

### 🏠 업무 종료

```bash
# 시스템 중지
./stop.sh
```

### 🔄 재시작

```bash
# 한 줄로 중지 + 시작
./stop.sh && ./start.sh
```

### 🐛 디버깅

```bash
# 실시간 로그 확인
tail -f ~/.katc1/nextjs.log

# 에러 필터링
tail -f ~/.katc1/nextjs.log | grep ERROR

# PostgreSQL 로그 확인
tail -f ~/.katc1/postgres.log
```

---

## 🔧 포트 설정

### 기본 포트
- **Frontend:** 3000 (Next.js)
- **Database:** 5432 (PostgreSQL)

### 포트 변경 방법

`start.sh` 상단의 포트 변수를 수정하세요:

```bash
# start.sh, stop.sh 상단 부분
FRONTEND_PORT=3001  # 3000 → 3001로 변경
DB_PORT=5433        # 5432 → 5433로 변경
```

### 포트 충돌 해결

```bash
# 특정 포트 사용 확인
lsof -i :3000

# 자동 해결 (./start.sh 실행 시)
# 또는 수동 해결
kill -9 $(lsof -i :3000 -t)
```

---

## 📊 모니터링

### 프로세스 상태 확인

```bash
# 전체 프로세스 보기
ps aux | grep -E "(postgres|node|next)"

# 포트별 프로세스 확인
lsof -i :3000
lsof -i :5432
```

### 로그 모니터링

```bash
# Next.js 로그 - 실시간 모니터링
tail -f ~/.katc1/nextjs.log

# PostgreSQL 로그 - 실시간 모니터링
tail -f ~/.katc1/postgres.log

# 마지막 N줄만 보기
tail -50 ~/.katc1/nextjs.log

# 특정 시간대의 로그
tail -f ~/.katc1/nextjs.log | grep "2026-02-19"
```

---

## 🆘 문제 해결

### 시나리오 1: 포트 이미 사용 중

```
Error: listen EADDRINUSE :::3000
```

**해결:**
```bash
# 방법 1: 자동 해결
./stop.sh
./start.sh

# 방법 2: 수동 해결
kill -9 $(lsof -i :3000 -t)
./start.sh
```

### 시나리오 2: PostgreSQL 연결 실패

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**해결:**
```bash
# PostgreSQL 상태 확인
pg_isready -p 5432

# 수동 시작 (필요시)
brew services start postgresql@15

# 또는 전체 시스템 재시작
./stop.sh && sleep 2 && ./start.sh
```

### 시나리오 3: 스크립트 권한 오류

```
Permission denied: ./start.sh
```

**해결:**
```bash
chmod +x start.sh stop.sh
./start.sh
```

### 시나리오 4: Node.js 모듈 오류

```
Error: Cannot find module '@tanstack/react-query'
```

**해결:**
```bash
npm install
npm cache clean --force
npm install --force
```

---

## 📁 로그 파일 위치

```
~/.katc1/
├── postgres.log          # PostgreSQL 로그
├── nextjs.log           # Next.js 로그
└── postgres/            # PostgreSQL 데이터 디렉토리
```

### 로그 파일 정리

```bash
# 오래된 로그 제거
rm ~/.katc1/*.log

# 또는 로그 크기 제한
truncate -s 0 ~/.katc1/nextjs.log
```

---

## 🔐 보안 주의사항

### 개발 환경

```bash
# .env.local (개발용 - 안전하지 않음)
JWT_SECRET=dev_secret_key
DB_PASSWORD=dev_password
```

### 프로덕션 환경

```bash
# .env.local (프로덕션용 - 강력한 값 사용)
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)
DB_PASSWORD=$(openssl rand -base64 16)
```

---

## 💡 유용한 팁

### 백그라운드 실행

```bash
# nohup 사용
nohup ./start.sh > startup.log 2>&1 &

# tmux/screen 사용
tmux new-session -d -s katc1 './start.sh'
```

### 데이터베이스 백업/복원

```bash
# 백업
pg_dump katc1_dev > backup_$(date +%Y%m%d_%H%M%S).sql

# 복원
./stop.sh
psql katc1_dev < backup_20260219_120000.sql
./start.sh
```

### 시스템 리소스 확인

```bash
# macOS
top -l 1 | grep -E "Processes|PhysMem"

# Linux
free -h
top -bn1
```

---

## 📞 빠른 참조

| 명령어 | 설명 |
|--------|------|
| `./start.sh` | 전체 시스템 시작 |
| `./stop.sh` | 전체 시스템 중지 |
| `lsof -i :3000` | 포트 3000 프로세스 확인 |
| `tail -f ~/.katc1/nextjs.log` | Next.js 로그 실시간 모니터링 |
| `psql -d katc1_dev` | 데이터베이스 접속 |
| `npm run build` | TypeScript 컴파일 확인 |

---

**마지막 업데이트:** 2026-02-19

**참고:** 더 자세한 설정 방법은 `SETUP_GUIDE.md`를 참조하세요.
