# Native Auth · 自研身份系统

> Tandem 的核心定位: **数据归你, 身份也归你**. SSO 是补充, 不是必需.

## 设计原则

1. **私有化优先**: 离开钉钉/企微/飞书也能完整运行
2. **零外部依赖**: 不依赖 NextAuth / Auth0 / Clerk, 全部自研
3. **B2B 邀请制**: 默认关闭公开注册, 老板邀员工
4. **MFA 默认推荐**: TOTP 二步验证, 兼容 Google Authenticator
5. **审计完备**: 任何登录 / 失败 / MFA 事件全程留痕
6. **等保 2.0 对齐**: 5 次失败锁 / 历史密码 / 强度策略

## 模块结构

```
lib/auth/
├── password.ts       # 密码哈希 (scrypt) + 强度策略
├── session.ts        # JWT (HS256) + httpOnly cookie + 设备指纹
├── mfa.ts            # TOTP (RFC 6238) + 恢复码 + AES-256-GCM 加密
├── invite.ts         # 邀请码生成/校验 (hash + pepper)
├── native.ts         # 业务编排 (register/login/mfa/logout)
├── bootstrap.ts      # 首次启动建 owner (幂等)
└── config.ts         # SSO 适配器 (可选)
```

## API 端点

```
POST /api/auth/register       邀请制注册
POST /api/auth/login          邮箱+密码 (一阶段)
POST /api/auth/mfa/verify     TOTP / 恢复码 (二阶段)
POST /api/auth/mfa/setup      启用 MFA (两阶段)
GET  /api/auth/mfa/setup      查询 MFA 状态
POST /api/auth/logout         登出 + 撤销 session
GET  /api/auth/me             当前会话
POST /api/auth/invite         发邀请码 (admin/manager)
GET  /api/auth/invite         我发出的邀请
```

## UI 路由

```
/login                登录页 (含 MFA 二阶段)
/register?invite=...  邀请制注册
/admin/invite         邀请码管理 (admin)
```

## 安全机制

| 攻击面 | 防御 |
|---|---|
| 密码爆破 | 5 次失败 → 15 分钟锁; 等比延迟 |
| 时序攻击 | `timingSafeEqual` 比对 hash / sig |
| 用户枚举 | 登录失败统一 "邮箱或密码错误" |
| 弱密码 | 强度评估 + 字典 + 用户信息相似度 |
| 密码复用 | 历史 hash 比对 (最近 5 次) |
| Session 劫持 | httpOnly + sameSite=lax + 设备指纹绑定 |
| Refresh Token 泄露 | 仅 hash 入库, 撤销列表 |
| MFA 绕过 | 高敏 API 校验 `mfa: true` |
| 邀请码爆破 | hash + pepper, 16 字节熵 (96 bit) |
| Replay TOTP | 30s 窗口 + 一次性消费检查 (V2) |

## 配置

`.env.local`:
```bash
NEXTAUTH_SECRET=<openssl rand -base64 48 输出>
TANDEM_BOOTSTRAP_OWNER_EMAIL=admin@yourcompany.com
TANDEM_BOOTSTRAP_OWNER_PASSWORD=ChangeMeAtFirstLogin!2026
TANDEM_BOOTSTRAP_OWNER_NAME=Owner Name
```

第一次启动时自动创建该 owner. 登录后立即:
1. 改密
2. 启用 MFA
3. 邀请其他成员

## 与 SSO 的关系

```
默认: 自研账号 (邮箱+密码+MFA)
可选: 钉钉 / 企微 / 飞书 OAuth → 关联到 User.ssoBindings (JSON)
```

SSO 流程仅作为快捷登录, **不替代**自研账号:
- SSO 登录后, 仍写一条 Session 记录
- SSO 用户也可启用 MFA
- 可以同时存在邮箱密码 + SSO 绑定

## 数据归属

```
所有 User / Session / Invite / AuthEvent 记录:
  → 写入客户私有 PostgreSQL
  → 不上传任何外部服务
  → 客户完全控制
```

## 未来增强 (V2+)

- [ ] WebAuthn / Passkey (无密码)
- [ ] SCIM provisioning (企业自动同步)
- [ ] 短信验证码作为 MFA 备选
- [ ] 设备管理面板 (列出活跃 session 强制退出)
- [ ] OIDC Provider (反向: Tandem 作为 IdP, 给其他系统颁证)
- [ ] LDAP / AD 接入 (大型企业)
- [ ] 审计日志导出 (合规需求)
