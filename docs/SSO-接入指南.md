# Tandem SSO 接入指南 (ai.rhautt.com)

> 面向**接入方开发者**。Tandem 是标准 OpenID Connect (OIDC) 身份提供方 (IdP)。
> 你的项目接入后，用户用统一的 Tandem 账号登录，并可获取其在公司里的**组织结构信息**（部门、汇报线、角色、工号）。

- **Issuer（发行方）**：`https://ai.rhautt.com`
- **协议**：OpenID Connect 1.0 / OAuth 2.0 Authorization Code + PKCE
- **签名算法**：RS256（用 JWKS 公钥验签，无需共享密钥）

---

## 0. 端点总览

| 用途 | 方法 | 完整 URL |
|---|---|---|
| 发现文档（推荐自动发现） | GET | `https://ai.rhautt.com/.well-known/openid-configuration` |
| 验签公钥 (JWKS) | GET | `https://ai.rhautt.com/.well-known/jwks.json` |
| 授权 | GET | `https://ai.rhautt.com/api/oidc/authorize` |
| 令牌 | POST | `https://ai.rhautt.com/api/oidc/token` |
| 用户信息 | GET/POST | `https://ai.rhautt.com/api/oidc/userinfo` |
| 登出 | GET | `https://ai.rhautt.com/api/oidc/logout` |

> 大多数 OIDC 客户端库（NextAuth、oidc-client-ts、Spring Security、passport-openidconnect…）只需填 **Issuer** 或 **Discovery URL** 即可自动发现以上全部端点。

---

## 1. 前置：在 Tandem 注册你的应用（接入方）

由 Tandem 的 **owner / admin** 在后台完成：

1. 登录 `https://ai.rhautt.com`，进入 **用户与权限 → SSO 单点登录**（即 `/admin/sso`）。
2. 点「注册接入方」，填写：
   - **应用名称**：例如 `报销系统`
   - **类型**：
     - `服务端应用 (confidential)` — 有后端、能保密 secret（Web 后端、BFF）。**推荐**。
     - `SPA / 移动端 (public)` — 纯前端，无法保密 secret，**强制使用 PKCE**。
   - **回调地址 (redirect_uri)**：你的应用接收授权码的地址，**必须精确匹配**（含路径与端口，不能带 `#fragment`）。可填多行多个。
     - 例：`https://expense.rhautt.com/api/auth/callback/tandem`
   - **授权范围 (scope)**：勾选需要的 `openid profile email roles org`（`org` = 组织结构）。
3. 创建后会**一次性显示 `client_secret`**（confidential 类型），请立即复制保存，关闭后无法再查看（可重置）。

你最终会拿到：

```
client_id     = cli_xxxxxxxxxxxxxxxx
client_secret = <仅 confidential, 一次性>
issuer        = https://ai.rhautt.com
redirect_uri  = https://你的应用/callback
scopes        = openid profile email roles org
```

---

## 2. 授权码流程（标准 4 步）

```
浏览器                你的应用(接入方)              Tandem (ai.rhautt.com)
  │  访问受保护页 ────────▶│                              │
  │                        │  ① 302 跳转 authorize ───────▶│  用户登录(若未登录)
  │ ◀───────────────────────────────────────────────────│  并同意
  │  ② 带 code 回跳 redirect_uri ─▶│                       │
  │                        │  ③ 用 code 换 token (后端) ──▶│
  │                        │ ◀── access/id/refresh token ─│
  │                        │  ④ 用 access_token 取 userinfo▶│
  │ ◀── 登录完成 ───────────│                              │
```

### ① 发起授权（浏览器跳转）

```
GET https://ai.rhautt.com/api/oidc/authorize
  ?response_type=code
  &client_id=cli_xxxxxxxxxxxxxxxx
  &redirect_uri=https%3A%2F%2Fexpense.rhautt.com%2Fapi%2Fauth%2Fcallback%2Ftandem
  &scope=openid%20profile%20email%20roles%20org
  &state=<随机防CSRF串>
  &nonce=<随机防重放串>
  &code_challenge=<BASE64URL(SHA256(code_verifier))>
  &code_challenge_method=S256
```

- `state`：随机串，回跳时原样返回，用于防 CSRF（必须校验一致）。
- `nonce`：随机串，写入 `id_token`，验签后必须校验一致（防重放）。
- `code_challenge` / `code_challenge_method`：**PKCE**。public 类型必填；confidential 强烈建议带上。
  - `code_verifier`：43~128 位随机串（自己生成并暂存于会话）。
  - `code_challenge = BASE64URL(SHA256(code_verifier))`。

用户未登录会被带到 `https://ai.rhautt.com/login`，登录后自动回到授权流程。

### ② 接收授权码（回跳）

Tandem 302 回你的 `redirect_uri`：

```
https://expense.rhautt.com/api/auth/callback/tandem?code=<authorization_code>&state=<原state>
```

- 先校验 `state` 与发起时一致。
- `code` 有效期 **60 秒**，且**一次性**（用过即失效）。

### ③ 用 code 换 token（后端发起，application/x-www-form-urlencoded）

confidential（推荐，用 HTTP Basic 传客户端凭据）：

```
POST https://ai.rhautt.com/api/oidc/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic BASE64(client_id:client_secret)

grant_type=authorization_code
&code=<authorization_code>
&redirect_uri=https://expense.rhautt.com/api/auth/callback/tandem
&code_verifier=<原始 code_verifier>
```

public（无 secret，靠 PKCE）：

```
POST https://ai.rhautt.com/api/oidc/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&client_id=cli_xxxxxxxxxxxxxxxx
&code=<authorization_code>
&redirect_uri=<你的回调>
&code_verifier=<原始 code_verifier>
```

成功响应：

```json
{
  "access_token": "<RS256 JWT>",
  "token_type": "Bearer",
  "expires_in": 3600,
  "id_token": "<RS256 JWT>",
  "refresh_token": "<仅当 scope 含 offline_access>",
  "scope": "openid profile email roles org"
}
```

### ④ 获取用户信息

```
GET https://ai.rhautt.com/api/oidc/userinfo
Authorization: Bearer <access_token>
```

返回（按授权 scope 裁剪）：

```json
{
  "sub": "user_abc123",
  "name": "何恒",
  "preferred_username": "hehe",
  "email": "hehe@rhautt.com",
  "email_verified": true,
  "job_title": "销售经理",
  "roles": ["manager"],
  "tenant": "default",
  "department": "华东区",
  "department_id": "dept_002",
  "department_path": "销售大区 / 华东区",
  "manager_id": "user_boss01",
  "manager_name": "王总",
  "employee_id": "E1001"
}
```

---

## 3. id_token 校验（接入方必须做）

`id_token` 是 RS256 JWT，验证步骤：

1. 用 JWKS（`https://ai.rhautt.com/.well-known/jwks.json`）的公钥按 `header.kid` 验签。
2. `iss` 必须等于 `https://ai.rhautt.com`。
3. `aud` 必须等于你的 `client_id`。
4. `exp` 未过期；`iat` 合理。
5. `nonce` 与发起授权时一致。

> 用成熟库（jose / NextAuth / Spring Security 等）会自动完成以上校验，不要手写。

---

## 4. Scope 与 claims 对照表

| scope | 返回的 claims |
|---|---|
| `openid` | `sub`（Tandem 用户唯一 ID，**用它作为你系统里的用户主键映射**） |
| `profile` | `name`、`preferred_username`、`job_title` |
| `email` | `email`、`email_verified` |
| `roles` | `roles[]`（如 `owner/admin/manager/employee/steward/champion/finance/...`）、`tenant` |
| `org` | `department`、`department_id`、`department_path`、`manager_id`、`manager_name`、`employee_id`、`job_title` |
| `offline_access` | 颁发 `refresh_token`（长期登录/后台同步用） |

---

## 5. 刷新令牌（可选，scope 含 offline_access 时）

```
POST https://ai.rhautt.com/api/oidc/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic BASE64(client_id:client_secret)   # public 改用 body 里的 client_id

grant_type=refresh_token
&refresh_token=<上次拿到的 refresh_token>
```

- 采用**旋转策略**：每次刷新会返回**新的 refresh_token**，旧的立即失效，请覆盖保存。
- refresh_token 有效期 30 天。

---

## 6. 登出（可选）

```
GET https://ai.rhautt.com/api/oidc/logout
  ?post_logout_redirect_uri=<需先在 SSO 后台登记白名单>
  &state=<可选>
  &id_token_hint=<可选, 上次的 id_token>
```

会清除 Tandem 侧会话；若 `post_logout_redirect_uri` 在该 client 登记的白名单内则回跳，否则回到 Tandem 登录页。

---

## 7. 调试步骤（按顺序排查）

> Windows PowerShell 若提示脚本被禁用，可用 `cmd /c "curl ..."`，或用 Postman / Apifox。

### Step 1 · 验证发现文档可达

```bash
curl https://ai.rhautt.com/.well-known/openid-configuration
```

期望：返回 JSON，且 `"issuer": "https://ai.rhautt.com"`，各 endpoint 均为 `https://ai.rhautt.com/...`。
**如果 issuer 不是该域名** → 检查部署是否设了 `OIDC_ISSUER=https://ai.rhautt.com` 并重启。

### Step 2 · 验证 JWKS 可达

```bash
curl https://ai.rhautt.com/.well-known/jwks.json
```

期望：`{ "keys": [ { "kty":"RSA", "kid":"...", "alg":"RS256", "use":"sig", ... } ] }`。

### Step 3 · 浏览器手测授权端点

把第 ② 步那段 `authorize` URL 贴进浏览器（先用一个临时 `code_challenge`/`state` 也行）：
- 未登录 → 应跳到 `https://ai.rhautt.com/login`，登录后回跳到你的 `redirect_uri?code=...&state=...`。
- 报 `redirect_uri mismatch` → 后台登记的回调与请求里的**没逐字符匹配**（注意结尾斜杠、端口、http/https）。
- 报 `invalid_scope` → 申请的 scope 超出该 client 被授权的范围。

### Step 4 · 用 code 换 token（命令行）

```bash
curl -X POST https://ai.rhautt.com/api/oidc/token \
  -u "cli_xxxxxxxxxxxxxxxx:你的client_secret" \
  -d "grant_type=authorization_code" \
  -d "code=粘贴Step3拿到的code" \
  -d "redirect_uri=https://expense.rhautt.com/api/auth/callback/tandem" \
  -d "code_verifier=Step3对应的原始verifier"
```

- 注意 code 60 秒过期且一次性，手测要快。
- 报 `invalid_client` → client_id/secret 错，或 Basic 头编码不对。
- 报 `invalid_grant` → code 过期/已用过/redirect_uri 不一致/PKCE verifier 不匹配。

### Step 5 · 用 access_token 取 userinfo

```bash
curl https://ai.rhautt.com/api/oidc/userinfo \
  -H "Authorization: Bearer 粘贴access_token"
```

期望返回用户 claims。报 `invalid_token` → token 过期或被篡改。

### Step 6 · 在线解码 id_token

把 `id_token` 贴到 jwt.io（或用 jose 验签），确认 `iss/aud/exp/nonce` 正确。

---

## 8. 框架对接示例

### NextAuth (Auth.js) — 自定义 OIDC Provider

```ts
// auth.ts
import NextAuth from 'next-auth';

export const { handlers, auth } = NextAuth({
  providers: [
    {
      id: 'tandem',
      name: 'Tandem SSO',
      type: 'oidc',
      issuer: 'https://ai.rhautt.com',
      clientId: process.env.TANDEM_CLIENT_ID,
      clientSecret: process.env.TANDEM_CLIENT_SECRET,
      authorization: { params: { scope: 'openid profile email roles org' } },
    },
  ],
  callbacks: {
    async jwt({ token, profile }) {
      if (profile) {
        token.roles = (profile as any).roles;
        token.department = (profile as any).department_path;
        token.tandemSub = (profile as any).sub;
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).roles = token.roles;
      (session as any).department = token.department;
      return session;
    },
  },
});
```

回调地址填：`https://你的应用/api/auth/callback/tandem`

### 通用库（oidc-client-ts / 后端）

只需配置：
- `authority` / `issuer`: `https://ai.rhautt.com`
- `client_id` / `client_secret`
- `redirect_uri`
- `scope`: `openid profile email roles org`
- `response_type`: `code`
- 开启 PKCE（public 必须）

---

## 9. 常见错误速查

| 现象 | 原因 / 处理 |
|---|---|
| discovery 里 issuer 不是 ai.rhautt.com | 部署未设 `OIDC_ISSUER` 或反代未转发 `X-Forwarded-Host/Proto`；设 `OIDC_ISSUER=https://ai.rhautt.com` 并重启 |
| `redirect_uri mismatch` | 后台登记值与请求未逐字符相同（斜杠/端口/协议） |
| `invalid_client` | client_id/secret 错误，或 Basic 头编码错误 |
| `invalid_grant` | code 过期(>60s)/已使用/PKCE 不匹配/redirect_uri 不一致 |
| `invalid_scope` | 申请的 scope 超出该 client 授权范围 |
| `PKCE code_verifier required` | public client 未带 PKCE，或 verifier 与 challenge 不对应 |
| id_token 验签失败 | 未用 JWKS 公钥，或 `iss/aud` 校验不通过 |
| 401 `unauthenticated`（调 API） | 直接调了非协议端点；接入只用本文档列出的 `/.well-known/*` 与 `/api/oidc/*` 端点 |

---

## 10. 安全要点（给接入方）

- `client_secret` 只放后端，**绝不**进前端/仓库；纯前端用 public + PKCE。
- 始终校验 `state`、`nonce`、`id_token` 的 `iss/aud/exp`。
- 用 `sub` 作为用户唯一标识做账号映射（不要用 email，email 可能变更）。
- 全程 HTTPS。

如需联调，可让 Tandem 管理员先在 `/admin/sso` 给你登记一个测试 client（回调可填本地 `http://localhost:xxxx/...` 做开发联调，本地地址在非生产允许 http）。
