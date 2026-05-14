@echo off
cd /d "%~dp0"

:: Arrêter l'éventuel serveur déjà lancé
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8080" ^| findstr "LISTENING" 2^>nul') do (
    taskkill /f /pid %%a >nul 2>&1
)

:: Lancer le serveur en arrière-plan (fenêtre minimisée)
start /min python server.py

:: Attendre 1 seconde puis ouvrir le navigateur
timeout /t 1 /nobreak >nul
start http://localhost:8080
