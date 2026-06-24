# Tandem SSO — OpenID Connect 提供方 (IdP)

Tandem 作为企业级 **OpenID Connect (OIDC) 身份提供方**。其他项目（接入方 / relying party）
通过标准授权码流程接入后：

1. 用户用统一的 Tandem 账号登录（单点登录，免重复注册）。
2. 接入方按授权范围（scope）获取 Tandem 的**组织结构体系**：部门、部门路径、汇报线、角色、工号。

这样组织结构成为一处维护、多处复用的**公司级共享身份目录**。

---

## 1. 端点一览

| 用途 | 路径 |
|---|---|
| Discovery（自动发现） | `GET /.well-known/openid-configuration` |
| JWKS（验签公钥） | `GET /.well-known/jwks.json` |
| 授权 | `GET /api/oidc/authorize` |
| 令牌 | `POST /api/oidc/token` |
| 用户信息 | `GET\|POST /api/oidc/userinfo` |
| 登出 | `GET /api/oidc/logout` |
| 接入方管理（owner/admin） | `/api/oidc/clients`、`/admin/sso` |

`issuer` = 对外根地址（`OIDC_ISSUER`，留空按请求 Host 推导）。接入方只需填 Discovery 地址即可自动发现其余端点。

---

## 2. 协议与安全

- **流程**：Authorization Code（推荐叠加 **PKCE S256**；public client 强制 PKCE）。
- **签名**：`id_token` / `access_token` 均为 **RS256 JWT**，接入方用 JWKS 公钥离线验签。
- **client 类型**：
  - `confidential`（服务端应用）：持 `client_secret`，token 端点支持 `client_secret_basic` / `client_secret_post`。
  - `public`（SPA / 移动端）：无 secret，仅 PKCE。
- **防开放重定向**：`redirect_uri` 与登记值**精确匹配**（含 query、不含 fragment）。
- **令牌时效**：授权码 60s（一次性）；access/id token 1h；refresh token 30 天（旋转，用旧换新即吊销旧）。
- **会话复用**：authorize 端点复用 Tandem 现有登录会话（`tandem_at` cookie）；未登录则回跳 `/login?next=…`，登录后继续授权。特权账户未启用 MFA 会被强制先去 `/settings/security`。

---

## 3. Scope 与下发的 claims

| scope | claims |
|---|---|
| `openid` | `sub`（必选，= Tandem userId） |
| `profile` | `name`、`preferred_username`、`job_title` |
| `email` | `email`、`email_verified` |
| `roles` | `roles[]`（Tandem 角色 SSOT）、`tenant` |
| `org` | `department`、`department_id`、`department_path`（如 `销售大区 / 华东区`）、`manager_id`、`manager_name`、`employee_id`、`job_title` |
| `offline_access` | 颁发 `refresh_token` |

`roles` 取值见 `lib/auth/roles.ts`（owner/admin/manager/employee/steward/champion/finance/internal_staff/guest/partner/contractor）。

---

## 4. 注册一个接入方

管理页：**`/admin/sso`**（仅 owner / admin）。

填写：应用名称、类型、`redirect_uri`（每行一个）、授权 scope。创建后 `client_secret` **仅显示一次**，请立即保存。也可：停用 / 启用、重置 secret、删除。

也可走 API：

```bash
curl -X POST https://<issuer>/api/oidc/clients \
  -H 'Content-Type: application/json' \
  --cookie 'tandem_at=<owner 会话>' \
  -d '{
    "name": "报销系统",
    "type": "confidential",
    "redirectUris": ["https://expense.corp.com/api/auth/callback/tandem"],
    "allowedScopes": ["openid","profile","email","roles","org"]
  }'
```

---

## 5. 接入方对接示例

### 任意 OIDC 客户端库（推荐）

填入 Discovery 地址 `https://<issuer>/.well-known/openid-configuration` + `client_id` / `client_secret` 即可。

### 手动流程

```text
# 1. 跳转授权
GET https://<issuer>/api/oidc/authorize
  ?response_type=code
  &client_id=<client_id>
  &redirect_uri=https://app.corp.com/callback
  &scope=openid%20profile%20email%20roles%20org
  &state=<csrf>
  &code_challenge=<base64url(sha256(verifier))>
  &code_challenge_method=S256

# 2. 用 code 换 token
POST https://<issuer>/api/oidc/token
  Content-Type: application/x-www-form-urlencoded
  Authorization: Basic base64(client_id:client_secret)   # confidential
  grant_type=authorization_code
  &code=<code>
  &redirect_uri=https://app.corp.com/callback
  &code_verifier=<verifier>
# → { access_token, id_token, token_type, expires_in, scope, refresh_token? }

# 3. 拉取组织结构 claims
GET https://<issuer>/api/oidc/userinfo
  Authorization: Bearer <access_token>
# → { sub, name, email, roles, department_path, manager_id, ... }
```

接入方应校验 `id_token`：用 JWKS 验签（RS256）、`iss` 等于 issuer、`aud` 等于本 `client_id`、`exp` 未过期、`nonce` 一致。

---

## 6. 配置

`.env.local`（见 `.env.local.example` 的「OIDC IdP」段）：

- `OIDC_ISSUER`：对外根地址，无末尾斜杠。dev 可留空（按 Host 推导）。
- `OIDC_PRIVATE_KEY`：RSA PKCS8 PEM 签名私钥。生产**强烈建议显式配置**以保证多副本一致；留空则单机自动生成并持久化到 DB（`KvStore` collection `oidc_keys`）。

```bash
openssl genpkey -algorithm RSA -pkcs8 -out oidc.pem -pkeyopt rsa_keygen_bits:2048
```

---

## 7. 存储与代码地图

| 关注点 | 文件 |
|---|---|
| 数据模型 / scope SSOT | `lib/oidc/types.ts` |
| 签名密钥 / JWKS | `lib/oidc/keys.ts` |
| 接入方注册表 | `lib/oidc/clients.ts` |
| 授权码 / 刷新令牌 | `lib/oidc/store.ts` |
| claims 映射（组织结构） | `lib/oidc/claims.ts` |
| JWT 签发 / 验签 | `lib/oidc/tokens.ts` |
| Discovery 文档 | `lib/oidc/discovery.ts` |
| 端点 | `app/api/oidc/*`、`app/.well-known/*` |
| 管理页 | `app/admin/sso/page.tsx` |
| 单元测试 | `tests/unit/oidc-core.test.ts` |

持久化全部走 `KvStore`（collections：`oidc_keys` / `oidc_clients` / `oidc_auth_codes` / `oidc_refresh_tokens`），多租户隔离，无需新建表 / 迁移。

中间件白名单见 `middleware.ts`：协议端点（authorize/token/userinfo/logout）公开；`/api/oidc/clients` 仍走 owner/admin 鉴权。
