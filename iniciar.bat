@echo off
title English Path - servidor (feche esta janela para parar)
cd /d "%~dp0app"
start "" http://localhost:8007
python -m http.server 8007
pause
