@echo off
REM Supabase 데이터베이스 자동 백업 스크립트 (Windows 작업 스케줄러용)
REM
REM 작업 스케줄러 등록 방법:
REM 1. 작업 스케줄러 열기 (taskschd.msc)
REM 2. "기본 작업 만들기" 선택
REM 3. 이름: KATC1_Weekly_Backup
REM 4. 트리거: 매주 (또는 원하는 주기)
REM 5. 동작: 프로그램 시작 > 이 파일 경로 지정

cd /d C:\Users\Administrator\Desktop\similarity-callsign
powershell -ExecutionPolicy Bypass -File scripts\backup-database.ps1

REM 결과 로깅
if %ERRORLEVEL% EQU 0 (
    echo [%date% %time%] Backup completed successfully >> backups\backup.log
) else (
    echo [%date% %time%] Backup FAILED with error code %ERRORLEVEL% >> backups\backup.log
)
