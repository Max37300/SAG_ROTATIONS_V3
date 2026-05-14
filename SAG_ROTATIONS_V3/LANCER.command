#!/bin/bash
cd "$(dirname "$0")"

# Arrêter l'éventuel serveur déjà lancé
pkill -f "python3 server.py" 2>/dev/null
sleep 0.5

# Lancer le serveur détaché du terminal (nohup + disown)
nohup python3 server.py > /dev/null 2>&1 &
disown

sleep 1
open http://localhost:8080

# Fermer le terminal automatiquement
osascript -e 'tell application "Terminal" to close front window' &
