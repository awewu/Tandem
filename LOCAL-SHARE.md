# 本机部署 · 让别人也能用

服务已经跑在你 `E:\Hermes` 的 `localhost:3005`. 现在按"谁要用"选档:

| 谁 | 选哪档 |
|---|---|
| 只你自己 | A (什么都不用做) |
| 同 Wi-Fi / 同办公室的同事 | B (一行 PowerShell) |
| 公司外 / 在家的人 / 异地试用 | C (一行 PowerShell + 装个 cloudflared) |

---

## A. 只给自己用

已经能用了:

```text
http://localhost:3005/login
```

- Owner: `admin@tandem.local` + .env.local 里 `TANDEM_BOOTSTRAP_OWNER_PASSWORD`
- Demo: `manager@tandem.local` + `Demo1234!@#` (manager / employee / hr 都是这个密码)

---

## B. 局域网同事也能用

```powershell
cd E:\Hermes
pwsh -File scripts/share-lan.ps1
```

脚本会:

1. 帮你找出本机 IPv4 (比如 192.168.1.23)
2. 自动开 Windows 防火墙 3005 端口 (如果你以管理员身份跑)
3. 提示改 `.env.local` 里 `NEXTAUTH_URL=http://<你的IP>:3005`
4. 用 `npm run dev:lan` 启动 (bind 0.0.0.0:3005)

同事电脑上浏览器开 `http://<你的IP>:3005/register?invite=XXXX` 就能注册.

> 邀请码生成 (另开一个 PowerShell):
>
> ```powershell
> cd E:\Hermes
> node scripts/issue-trial-invite.mjs 20 168 employee
> ```
>
> 输出里的注册 URL 把 `localhost` 换成你 IP 再发即可.

**注意**:

- 你电脑必须开着、Wi-Fi 连着, 同事才能用
- 如果你家路由器 / 公司网络做了 client isolation, 同 Wi-Fi 也可能不通
- 局域网内是 HTTP 不是 HTTPS, PWA 安装能力会受限 (浏览器只允许 localhost / HTTPS 装 PWA)

---

## C. 公网随便谁都能用 (无需服务器)

### 装 cloudflared (一次性)

```powershell
winget install --id Cloudflare.cloudflared
# 装完关掉这个 PowerShell, 重新打开
```

或下载安装包: <https://github.com/cloudflare/cloudflared/releases>

### 起隧道

先确保 dev server 在 3005 跑着. 另开一个 PowerShell:

```powershell
cd E:\Hermes
pwsh -File scripts/share-tunnel.ps1
```

输出里找形如:

```text
Your quick Tunnel has been created! Visit it at:
https://random-words-1234.trycloudflare.com
```

那就是公网 HTTPS URL.

### 改 NEXTAUTH_URL (重要)

编辑 `.env.local`:

```env
NEXTAUTH_URL=https://random-words-1234.trycloudflare.com
```

重启 dev server (`Ctrl+C` 后 `npm run dev`).  不重启 cookie/redirect 会乱.

### 生成邀请码发出去

```powershell
node scripts/issue-trial-invite.mjs 100 168 employee
```

脚本输出的 "注册地址" 现在用的是公网 URL, 直接发给任何人.

### 优缺点

✅ 自动 HTTPS, PWA 装得了  
✅ 不用买域名, 不用配防火墙  
✅ 关电脑自动停 (按需开放)  
❌ 每次起 quick tunnel URL 都会变  
❌ 你电脑关了别人就用不了 (要长期在线, 改用 VPS, 见 DEPLOY.md §二)

### 想要固定域名 (可选, 进阶)

1. Cloudflare 注册账号, 加一个你拥有的域名
2. `cloudflared tunnel login`
3. `cloudflared tunnel create tandem`
4. `cloudflared tunnel route dns tandem tandem.your-domain.com`
5. `cloudflared tunnel run tandem`

URL 就固定成 `https://tandem.your-domain.com` 了.

---

## 切换场景速查

```powershell
# A → B (开放局域网)
pwsh -File scripts/share-lan.ps1

# A → C (开放公网)
pwsh -File scripts/share-tunnel.ps1

# C → A (停公网, 只本机)
# 在 cloudflared 那个窗口按 Ctrl+C
# 改回 .env.local: NEXTAUTH_URL=http://localhost:3005
# 重启 npm run dev
```

---

## 生产用?

本机方式适合 **试用 / 演示 / ≤20 人**.  
正式给团队用建议 VPS Docker Compose, 见 `DEPLOY.md` § 二.
