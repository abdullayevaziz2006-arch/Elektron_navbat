@echo off
chcp 65001 >nul
title Elektron Navbat - Desktop Dastur Qadoqlash

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║       ELEKTRON NAVBAT - DESKTOP DASTUR QADOQLASH        ║
echo ║              electron-packager yordamida                 ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

:: Node.js mavjudligini tekshirish
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [XATO] Node.js topilmadi! Iltimos, https://nodejs.org dan o'rnating.
    pause
    exit /b 1
)

:: electron-packager mavjudligini tekshirish
if not exist "node_modules\electron-packager" (
    echo [INFO] electron-packager o'rnatilmoqda...
    npm install electron-packager --save-dev
    if %ERRORLEVEL% NEQ 0 (
        echo [XATO] electron-packager o'rnatishda xato!
        pause
        exit /b 1
    )
)

:: Eski dist papkasini tozalash
if exist "dist" (
    echo [INFO] Eski dist papkasi o'chirilmoqda...
    rmdir /s /q "dist"
)

echo [1/4] Dastur qadoqlanmoqda...
echo.

:: Electron Packager yordamida dasturni qadoqlash
call node_modules\.bin\electron-packager . "Elektron Navbat" ^
    --platform=win32 ^
    --arch=x64 ^
    --out=dist ^
    --overwrite ^
    --ignore=dist ^
    --ignore=.git ^
    --ignore="EdgeProfile_.*" ^
    --ignore=queue.db ^
    --asar

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [XATO] Qadoqlash muvaffaqiyatsiz yakunlandi!
    pause
    exit /b 1
)

echo.
echo [2/4] Konfiguratsiya fayllari ko'chirilmoqda...
if exist "dist\Elektron Navbat-win32-x64\" (
    copy /Y "config.json" "dist\Elektron Navbat-win32-x64\resources\app\config.json" >nul
    echo     config.json - OK
)

echo.
echo [3/4] Ishga tushiruvchi .bat fayllar yaratilmoqda...

:: Kiosk launcher
(
    echo @echo off
    echo start "" "Elektron Navbat.exe" --kiosk
) > "dist\Elektron Navbat-win32-x64\KIOSK.bat"

:: Monitor launcher
(
    echo @echo off
    echo start "" "Elektron Navbat.exe" --monitor
) > "dist\Elektron Navbat-win32-x64\MONITOR.bat"

:: Operator launcher
(
    echo @echo off
    echo start "" "Elektron Navbat.exe" --operator
) > "dist\Elektron Navbat-win32-x64\OPERATOR.bat"

:: Admin launcher
(
    echo @echo off
    echo start "" "Elektron Navbat.exe" --admin
) > "dist\Elektron Navbat-win32-x64\ADMIN.bat"

echo     KIOSK.bat    - OK
echo     MONITOR.bat  - OK
echo     OPERATOR.bat - OK
echo     ADMIN.bat    - OK

echo.
echo [4/4] Natija tekshirilmoqda...
if exist "dist\Elektron Navbat-win32-x64\Elektron Navbat.exe" (
    echo.
    echo ╔══════════════════════════════════════════════════════════╗
    echo ║            QADOQLASH MUVAFFAQIYATLI YAKUNLANDI!         ║
    echo ╚══════════════════════════════════════════════════════════╝
    echo.
    echo Dastur joylashuvi:
    echo   dist\Elektron Navbat-win32-x64\
    echo.
    echo Ishga tushirish usullari:
    echo   1. "Elektron Navbat.exe" - Asosiy menyu
    echo   2. "KIOSK.bat"           - Kiosk rejimi
    echo   3. "MONITOR.bat"         - Monitor rejimi
    echo   4. "OPERATOR.bat"        - Operator paneli
    echo   5. "ADMIN.bat"           - Admin panel
    echo.
    set /p OPEN="Dastur papkasini ochishni xohlaysizmi? (Ha/Yo'q): "
    if /i "%OPEN%"=="Ha" (
        explorer "dist\Elektron Navbat-win32-x64\"
    )
) else (
    echo [XATO] Dastur fayli topilmadi!
)

pause
