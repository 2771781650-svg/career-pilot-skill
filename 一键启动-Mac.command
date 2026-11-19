#!/bin/bash
cd "$(dirname "$0")"
echo "================================================"
echo "  职途 CareerPilot · 本地服务 + 公网 https 链接"
echo "================================================"

if [ ! -x ./cloudflared ]; then
  echo "[1/3] 首次运行，下载 cloudflared..."
  curl -L -o cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64
  chmod +x cloudflared
  xattr -d com.apple.quarantine cloudflared 2>/dev/null
fi

echo "[2/3] 启动本地服务 127.0.0.1:8000 ..."
python3 server.py > server.log 2>&1 &
SRV=$!
sleep 3

echo "[3/3] 启动公网隧道..."
./cloudflared tunnel --url http://127.0.0.1:8000 --no-autoupdate > tunnel.log 2>&1 &
TUN=$!
sleep 10

echo
echo "公网地址（微信 / QQ / 手机都能打开）："
grep -o "https://[a-z0-9-]*\.trycloudflare\.com" tunnel.log | head -1
echo
echo "提示：链接每次启动都会变，关掉窗口失效。本机：http://127.0.0.1:8000"
open http://127.0.0.1:8000
echo "按 Ctrl+C 退出（会同时关掉服务和隧道）"
trap "kill $SRV $TUN 2>/dev/null" EXIT
wait
