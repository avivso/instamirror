#!/bin/zsh
# Double-click me in Finder: starts InstaMirror locally with the Claude Code bridge
cd "$(dirname "$0")"
echo "InstaMirror עולה... הדפדפן ייפתח מיד."
(sleep 1 && open "http://localhost:8788") &
exec node serve.js
