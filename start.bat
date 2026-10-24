@echo off
title He Thong Quan Ly Tu Mau Khoa Xet Nghiem - BloodBank Lab
cls

echo ======================================================================
echo          HE THONG QUAN LY TU MAU KHOA XET NGHIEM (BLOOD BANK)        
echo ======================================================================
echo.

:CHECK_NODE
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Khong tim thay Node.js tren may tinh!
    echo Vui long cai dat Node.js tu https://nodejs.org/ truoc khi chay.
    echo ======================================================================
    pause
    exit /b 1
)

:CHECK_MODULES
if not exist "%~dp0server\node_modules\" (
    echo [*] Dang cai dat thu vien cho Backend Server...
    cd /d "%~dp0server"
    call npm.cmd install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Loi cai dat thu vien Backend!
        pause
        exit /b 1
    )
)

if not exist "%~dp0web\node_modules\" (
    echo [*] Dang cai dat thu vien cho Web Frontend...
    cd /d "%~dp0web"
    call npm.cmd install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Loi cai dat thu vien Frontend!
        pause
        exit /b 1
    )
)

:CHECK_MYSQL
tasklist /FI "IMAGENAME eq mysqld.exe" 2>nul | find /I /N "mysqld.exe" >nul
if "%ERRORLEVEL%"=="1" (
    echo [*] MySQL chua chay, dang khoi dong MySQL Server...
    if exist "C:\xampp\mysql_start.bat" (
        start /min "" cmd /c "cd /d C:\xampp && mysql_start.bat"
        ping 127.0.0.1 -n 5 > nul
    ) else if exist "C:\xampp\mysql\bin\mysqld.exe" (
        start /min "" cmd /c "cd /d C:\xampp && mysql\bin\mysqld.exe --defaults-file=mysql\bin\my.ini --standalone"
        ping 127.0.0.1 -n 5 > nul
    ) else (
        echo [!] Canh bao: Khong tim thay XAMPP MySQL.
        echo     Vui long dam bao MySQL/MariaDB da duoc khoi dong truoc.
    )
) else (
    echo [OK] Dich vu MySQL dang hoat dong.
)

:START_SERVICES
echo.
echo [*] Dang khoi chay Backend API Server (Port 5005)...
start "BloodBank-Server (Port 5005)" cmd /k "cd /d "%~dp0server" && npm.cmd run dev"

echo [*] Dang khoi chay Web Frontend (Port 3005)...
start "BloodBank-Web (Port 3005)" cmd /k "cd /d "%~dp0web" && npm.cmd run dev"

REM Doi 3 giay de server va web san sang roi tu dong mo trinh duyet
ping 127.0.0.1 -n 4 > nul
start http://localhost:3005

echo.
echo ======================================================================
echo    KHOI CHAY HE THONG THANH CONG!
echo ======================================================================
echo  - Giao dien Web:      http://localhost:3005
echo  - Backend API:        http://localhost:5005
echo  - Tai khoan Admin:    admin  /  admin123
echo  - Tai khoan Ky thuat: ktv1   /  123456
echo ======================================================================
echo.

:MENU
echo  Chon chuc nang:
echo    [1] Mo lai trang Web trong trinh duyet
echo    [2] Dung toan bo he thong (Stop)
echo    [3] Khoi dong lai he thong (Restart)
echo    [0] Thoat cua so dieu khien nay (He thong van tiep tuc chay)
echo.
set /p opt="Nhap lua chon [1/2/3/0]: "
if "%opt%"=="1" (
    start http://localhost:3005
    cls
    goto PRINT_INFO
)
if "%opt%"=="2" (
    call "%~dp0stop.bat"
    exit /b 0
)
if "%opt%"=="3" (
    call "%~dp0stop.bat"
    ping 127.0.0.1 -n 2 > nul
    goto START_SERVICES
)
if "%opt%"=="0" (
    exit /b 0
)
echo Lua chon khong hop le, vui long chon lai!
goto MENU

:PRINT_INFO
echo ======================================================================
echo  - Giao dien Web:      http://localhost:3005
echo  - Backend API:        http://localhost:5005
echo  - Tai khoan Admin:    admin  /  admin123
echo  - Tai khoan Ky thuat: ktv1   /  123456
echo ======================================================================
echo.
goto MENU
