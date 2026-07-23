# Rhautt Nexus SSO OIDC Issue 拆分

来源 PRD：`docs/dev/rhautt-nexus-sso-oidc-prd.md`

本拆分遵循本仓库本地 issue 约定，正式 issue 文件发布在 `docs/dev/rhautt-nexus-sso-oidc-issues/`。每个 issue 都按可领取的 vertical slice 编写，优先保证一条可验证的端到端路径，而不是按纯前端/纯后端分层拆分。

## Issue 列表

| Issue | 标题 | 类型 | 依赖 | 并发批次 |
| --- | --- | --- | --- | --- |
| 01 | OIDC 登录入口、发现配置和安全跳转 | AFK | 无 | Wave 0 |
| 02 | SSO 外部身份绑定和受限首登策略 | AFK | 无 | Wave 0 |
| 03 | OIDC Callback 换码、验签和 Nexus 会话 | AFK | 01, 02 | Wave 1 |
| 04 | `/hub` 登录落点和前端会话衔接 | AFK | 03 | Wave 2 |
| 05 | SSO 失败处理、审计和安全负例 | AFK | 01, 03 | Wave 2 |
| 06 | 本地/生产配置模板和密钥交付护栏 | AFK | 无 | Wave 0 |
| 07 | 路由归属、架构守卫和生产就绪检查 | AFK | 01, 03, 06 | Wave 3 |
| 08 | 本地到生产的 SSO 验收烟测 | HITL | 03, 04, 05, 07 | Final |

## 可并发执行顺序

### Wave 0：第一批，可立即并发

1. `01-oidc-login-entry-discovery-safe-redirect`
2. `02-sso-external-identity-binding-provisioning`
3. `06-config-templates-secret-guardrails`

说明：01 做 OIDC 登录入口和 discovery；02 做身份绑定/首登策略的持久化和服务契约；06 做配置模板和密钥护栏。三者依赖少，适合并行。注意 01 和 02 都属于 auth 域，执行时要尽量新增小文件和服务，避免同时大改同一个 auth 文件。

### Wave 1：核心闭环

1. `03-oidc-callback-token-validation-nexus-session`

说明：03 依赖 01 的 state/login 入口和 02 的绑定策略，完成真正的 code exchange、token 验证、本地会话签发和 `/api/v2/auth/me` 可用。

### Wave 2：体验和安全补强，可并发

1. `04-hub-landing-session-bridge`
2. `05-sso-failure-audit-security-negative-cases`

说明：04 接通用户落到 `/hub` 的实际体验；05 补齐失败态、审计和负例。二者都依赖 03，但可由不同 agent 并行。

### Wave 3：架构和发布门禁

1. `07-route-ownership-guards-production-readiness`

说明：确认 `/api/v2/auth/sso/*` 符合路由归属、架构边界和生产检查。

### Final：人工联调验收

1. `08-local-production-sso-acceptance-smoke`

说明：最后需要用 `https://ai.rhautt.com/` 的真实本地/生产 client 配置做联调，属于 HITL，因为可能需要真实 IdP 登录态、回调白名单和生产环境密钥。

## 第一批并发执行提示词

### Agent A：Issue 01

```text
请实现 docs/dev/rhautt-nexus-sso-oidc-issues/01-oidc-login-entry-discovery-safe-redirect.md。

要求先读取 AGENTS.md、docs/AGENT-MEMORY.md、docs/dev/rhautt-nexus-sso-oidc-prd.md 和该 issue 文件。只做 Issue 01 范围：在 /api/v2/auth 下实现 SSO login 入口、OIDC discovery、state 生成/保存、安全 redirect 校验和登录重定向；不要实现 callback 换码、用户绑定或会话签发。遵守项目规则：新生产 API 属于 services/api/src/modules/auth，不要把新业务路由写进 server-production.js。完成后运行该 issue 要求的 focused tests，并报告未能运行的检查。
```

### Agent B：Issue 02

```text
请实现 docs/dev/rhautt-nexus-sso-oidc-issues/02-sso-external-identity-binding-provisioning.md。

要求先读取 AGENTS.md、docs/AGENT-MEMORY.md、docs/dev/rhautt-nexus-sso-oidc-prd.md 和该 issue 文件。只做 Issue 02 范围：建立 SSO 外部身份绑定和首登策略的持久化/服务契约，支持按 provider+issuer+subject 找到本地 Nexus 用户，并定义无绑定用户的受限/待授权策略；不要实现 OIDC login redirect 或 callback 换码。必须保持 tenant/RLS 语义，不允许上游 roles 直接绕过 Nexus RBAC。完成后运行该 issue 要求的 focused tests，并报告结果。
```

### Agent C：Issue 06

```text
请实现 docs/dev/rhautt-nexus-sso-oidc-issues/06-config-templates-secret-guardrails.md。

要求先读取 AGENTS.md、docs/AGENT-MEMORY.md、docs/dev/rhautt-nexus-sso-oidc-prd.md 和该 issue 文件。只做 Issue 06 范围：补齐本地和生产 OIDC 配置模板、运行时配置说明、secret 不入库护栏和文档；不要提交任何 client_secret 明文，不要改动业务登录逻辑。完成后用搜索确认仓库没有写入已知 secret，并报告检查结果。
```

## 执行注意

1. 每个 issue 建议单独分支，避免多个 agent 同时编辑同一核心 auth 文件。
2. Wave 0 的 agent 应优先新增小服务、小实体、小测试，再把控制器接入点保持窄接口。
3. 任何 issue 都不得把 OIDC client secret 写入仓库、前端代码或测试快照。
4. `https://nexus.rhautt.com/hub` 和 `http://localhost:4000/hub` 是登录成功落点，不是 callback。
5. 如果实现过程中发现 IdP claims 与 PRD 假设不一致，先把 claim 映射写成配置项，并在 issue 结果中明确实际 claim 名称。
