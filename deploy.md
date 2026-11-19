# 部署（让链接发给别人也能真对话）

## 方式一：Docker（推荐，任何云主机/容器平台）
```bash
docker build -t careerpilot .
docker run -p 8000:8000 -e PORT=8000 careerpilot
# 浏览器打开 http://<服务器IP>:8000
```

## 方式二：Railway / Render / 腾讯云轻量
1. 选「Deploy from GitHub repo」，指向 `2771781650-svg/career-pilot-skill`
2. 平台会自动识别 `Dockerfile`；保证环境变量 `HOST=0.0.0.0`
3. 部署完拿到公网域名，直接分享

## 方式三：已有服务器 + systemd
```bash
scp -r CareerPilot root@your-server:/opt/
ssh root@your-server
cd /opt/CareerPilot && python3 -m venv .venv && .venv/bin/pip install pillow python-docx
# /etc/systemd/system/careerpilot.service 里写：
#   Environment=HOST=0.0.0.0 PORT=8000
#   ExecStart=/opt/CareerPilot/.venv/bin/python server.py
systemctl enable --now careerpilot
# 再用 nginx 反代 80 → 8000
```

## 不部署也能真对话：页面里填自己的 API Key
打开网页 → 点「连接大模型」→ 填接口地址 / 模型 / Key → 保存并测试。
- DeepSeek：`https://api.deepseek.com/v1` + `deepseek-chat`
- 豆包 Ark：`https://ark.cn-beijing.volces.com/api/v3` + 推理接入点 ID
Key 只存本机浏览器；若提示跨域被拦，说明该服务不允许浏览器直连，此时只能用后端模式。

## 验收清单
- [ ] 打开首页 → 输一句话 → 有步骤气泡 + 结论
- [ ] 「上传简历图片」→ 识别出文字（需要 tesseract + chi_sim）
- [ ] 「导出 Word 简历」→ 下载 .docx
- [ ] 清空档案后重新说一句 → 档案条复位

## 手机 / 微信 / QQ 能用吗
- 手机浏览器、Safari、Chrome、QQ 内置浏览器：同一个公网 https 地址都能用，页面已做移动端适配（安全区、大按钮、小屏单列）。
- 微信：能对话、能面试，但微信内置浏览器**会拦 .docx 下载**。页面已内置「复制简历」，粘到 WPS/备忘录即可；想下载 Word 让用户点右上角「在浏览器打开」。
- 微信分享链接必须是 **https**，http 会被提示不安全甚至打不开。

### 给手机加 https（nginx + 免费证书）
```bash
# 服务器上已有域名解析到本机时
apt install -y nginx certbot python3-certbot-nginx
cat >/etc/nginx/sites-available/careerpilot <<'EOF2'
server {
  listen 80;
  server_name career.yourdomain.com;
  client_max_body_size 15m;
  location / { proxy_pass http://127.0.0.1:8000; proxy_set_header Host $host; }
}
EOF2
ln -sf /etc/nginx/sites-available/careerpilot /etc/nginx/sites-enabled/careerpilot
nginx -t && systemctl reload nginx
certbot --nginx -d career.yourdomain.com   # 自动签证书并跳转 https
```
### 只想快速试一下（不买域名/服务器）
- Cloudflare Tunnel：`cloudflared tunnel --url http://127.0.0.1:8000` → 直接给你一个 https 临时地址，手机和微信都能打开（本机需一直开着）。
- ngrok：`ngrok http 8000` 同理。

### 验收（手机端）
- [ ] 输入框点开不跳屏，键盘弹起后发送按钮可见
- [ ] 点「模拟面试」→ 选题选人 → 连答 5 题 → 出报告
- [ ] 微信里点「复制简历」→ 粘贴成功
