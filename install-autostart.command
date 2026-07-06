#!/bin/zsh
# Double-click me once: InstaMirror will then always run in the background
# (starts at login, restarts if it crashes) at http://localhost:8788
set -e
DIR="$(cd "$(dirname "$0")" && pwd -P)"

case "$DIR" in
  */Desktop/*|*/Documents/*|*/Downloads/*)
    echo "⚠️  macOS חוסם שירותי רקע מלקרוא מ-Desktop/Documents/Downloads."
    echo "העבירו את התיקייה למקום אחר (למשל: mv \"$DIR\" ~/instamirror) והריצו שוב."
    read -sk '?לחצו מקש כלשהו לסגירה'
    exit 1
    ;;
esac

NODE="$(command -v node || true)"
if [ -z "$NODE" ]; then
  echo "❌ node לא מותקן. מתקינים מ-https://nodejs.org והריצו שוב."
  read -sk '?לחצו מקש כלשהו לסגירה'
  exit 1
fi
CLAUDE_DIR="$(dirname "$(command -v claude 2>/dev/null || echo /usr/local/bin/claude)")"

PLIST="$HOME/Library/LaunchAgents/com.instamirror.server.plist"
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.instamirror.server</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>$DIR/serve.js</string>
  </array>
  <key>WorkingDirectory</key><string>$DIR</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>$CLAUDE_DIR:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>/tmp/instamirror.log</string>
  <key>StandardErrorPath</key><string>/tmp/instamirror.log</string>
</dict>
</plist>
EOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
sleep 1
if curl -s --max-time 4 http://127.0.0.1:8788/api/claude/ping | grep -q ok; then
  echo "✅ InstaMirror רץ ברקע וימשיך לרוץ תמיד: http://localhost:8788"
  open "http://localhost:8788"
else
  echo "⚠️  השירות הותקן אבל עוד לא עונה. בדקו את /tmp/instamirror.log"
fi
read -sk '?לחצו מקש כלשהו לסגירה'
