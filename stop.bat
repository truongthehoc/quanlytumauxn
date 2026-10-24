@echo off
title Dung He Thong Quan Ly Tu Mau
cls

echo ======================================================================
echo          DANG DUNG HE THONG QUAN LY TU MAU (BLOOD BANK)...
echo ======================================================================
echo.

echo [*] Dang tat tien trinh tren cong 5005 (Backend Server)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5005 "') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo [*] Dang tat tien trinh tren cong 3005 (Web Frontend)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3005 "') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo [*] Dang dong cac cua so cmd lien quan...
taskkill /fi "WINDOWTITLE eq BloodBank-Server*" /f >nul 2>&1
taskkill /fi "WINDOWTITLE eq BloodBank-Web*" /f >nul 2>&1

echo.
echo ======================================================================
echo    DA DUNG TOAN BO HE THONG THANH CONG!
echo ======================================================================
ping 127.0.0.1 -n 3 > nul
