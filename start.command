#!/bin/zsh
# Bấm đúp file này trong Finder để chạy Live Comment Studio.
# Dùng Node cài sẵn trên máy; nếu chưa có thì dùng bản trong ~/.local/node.
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  export PATH="$HOME/.local/node/bin:$PATH"
fi
if ! command -v node >/dev/null 2>&1; then
  echo "Chưa có Node.js. Hãy cài Node.js 22 tại https://nodejs.org rồi chạy lại."
  read -k1 "?Nhấn phím bất kỳ để đóng..."
  exit 1
fi
[ -d node_modules ] || npm install --no-audit --no-fund
npm start
