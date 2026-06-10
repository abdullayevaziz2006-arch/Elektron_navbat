@echo off
chcp 65001 >nul
start "" "node_modules\electron\dist\electron.exe" . --monitor
