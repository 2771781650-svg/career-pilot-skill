#!/bin/bash
# Linux/云服务器：启动服务 + 公网临时 https 链接
cd "$(dirname "$0")"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "[1/2] 下载 cloudflared..."
  curl -L -o cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
  chmod +x cloudflared
  CF=./cloudflared
else
  CF=cloudflared
fi

HOST=0.0.0.0 PORT=${PORT:-8000} python3 server.py > server.log 2>&1 &
SRV=$!
sleep 2
$CF tunnel --url "http://127.0.0.1:${PORT:-8000}" --no-autoupdate > tunnel.log 2>&1 &
TUN=$!
sleep 8
echo "公网地址：$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' tunnel.log | head -1)"
trap "kill $SRV $TUN 2>/dev/null" EXIT
wait
