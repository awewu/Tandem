# Tandem 种子客户试用指南 (Pilot Onboarding)

> **适用**: 友好客户 / 种子用户 / 内测企业
> **目标**: 从零到跑通第一条议事室决议 **≤ 60 分钟**
> **时长**: 7 天 pilot → 能自主判断是否续签 V1 GA
> **前置**: 宪章 §17 — 仅面向民企 (互联网 / SaaS / 消费 / 教育 / 创意 / 跨境 / 文娱), sweet spot 200-1000 人
> **宪章锚点**: §13 数据归公司 + 4 项员工尊严保障 · §18 OSS 借力 + 自建思考层

---

## 角色分工 (pilot 期间)

| 角色 | 数量 | 职责 | 我方对接人 |
|---|---|---|---|
| **Pilot Champion** | 1 (客户 CEO / COO / CHRO) | 决定是否续签 · 审第一条 Memory | Tandem CSM |
| **IT Admin** | 1 (客户运维 or 我方部署工程师) | 装机 · 备份 · 升级 | Tandem DevOps |
| **Steward (首任)** | 1-2 (战略部 / CoS / 资深专家) | Memory 签批 · 降级评估 | Tandem 产品 |
| **首批员工** | 3-5 (跨 2 个部门) | 跑议事室 · 写 D 选项 · 给反馈 | Tandem 产品 |

**铁律**: Champion 必须 Day 1 就启用 MFA, Day 2 自己跑一条议事室. **不是交给下属试用** — 否则 7 天后他没感觉, 续签黄掉.

---

## Day 0 · 预检清单 (24h 前)

- [ ] 签了 NDA + pilot 服务协议 (30 天周期, 可续)
- [ ] 客户指派了 Champion / IT / Steward 候选 / 3-5 首批员工名单 (Excel 格式: 姓名 + 邮箱 + 部门)
- [ ] 我方确认了部署形态:
  - [ ] 选项 A: **客户自有服务器** (云主机 / IDC, 推荐 — 数据归公司故事最硬)
  - [ ] 选项 B: 我方托管私域单租户 (过渡方案, Champion 担心 IT 成本时用)
- [ ] Champion 读过 `docs/USER-GUIDE.md` + `docs/MANIFESTO.md` 18 条 (至少 §4 / §9 / §13)

---

## Day 1 · 装机 + 首登 (1 小时)

### 1.1 服务器最小配置 (Linux 或 Windows Server)

```
CPU     4 core
RAM     8 GB
Disk    100 GB SSD
Net     出站可达 api.deepseek.com (主 LLM)
Port    80 / 443 (Nginx 反代到 Tandem 3000)
```

### 1.2 IT Admin 装机 (30 min, 照抄命令)

```powershell
# ── 1. 装 Node 20 + PostgreSQL 16 + git ──
winget install -e --id OpenJS.NodeJS.LTS
winget install -e --id PostgreSQL.PostgreSQL.16
winget install -e --id Git.Git

# ── 2. 建数据库 (pw 换成强随机) ──
$env:PGPASSWORD = 'PG_SUPERUSER_PASSWORD_HERE'
psql -U postgres -h localhost -c "CREATE ROLE tandem WITH LOGIN PASSWORD 'TANDEM_DB_PW_HERE';"
psql -U postgres -h localhost -c "CREATE DATABASE tandem OWNER tandem;"

# ── 3. 拉代码 + 装依赖 ──
git clone git@github.com:<org>/tandem-core.git C:\tandem
cd C:\tandem
npm ci

# ── 4. 生成密钥 ──
$JWT = [Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Max 256 }))
$MFA = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Max 256 }))

# ── 5. 写 .env.local ──
@"
DATABASE_URL=postgresql://tandem:TANDEM_DB_PW_HERE@localhost:5432/tandem?schema=public

NEXTAUTH_SECRET=$JWT
SESSION_SECRET=$JWT
MFA_ENCRYPTION_KEY=$MFA

TANDEM_BOOTSTRAP_OWNER_EMAIL=champion@<客户域名>
TANDEM_BOOTSTRAP_OWNER_PASSWORD=TempPass-Change-On-First-Login-2026!
TANDEM_BOOTSTRAP_OWNER_NAME=<Champion 真名>

DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_API_KEY=<你方 DeepSeek key, 按量后收客户成本>
"@ | Out-File -FilePath .env.local -Encoding utf8

# ── 6. 建表 ──
npm run db:generate
npm run db:deploy

# ── 7. 起服务 ──
npm run build
npm start
# 默认 3000 端口; 生产挂 Nginx 443 反代 + Let's Encrypt
```

> **用 Docker?** 不推荐. Hermes runtime 要能联网进化, Docker 网络桥接 + 反代会把 DeepSeek SSE 流式响应砸成 buffered. 直接装 Node + PG 最稳.

### 1.3 Champion 首登 (10 min)

1. 浏览器开 `https://tandem.<客户域名>/login`
2. 用 `champion@<客户域名>` + `TempPass-Change-On-First-Login-2026!` 登录
3. **立刻改密** (`/settings/security` → 改密 + 启用 MFA)
4. 扫码 Google Authenticator, 抄下 10 个恢复码, 打印封存在保险柜

> 没启 MFA 的 Champion 账号 = 空口袋的老板. 不给任何员工入场券.

### 1.4 IT Admin 验收 (10 min)

```powershell
# 跑一次我方 e2e 确认核心链路全绿
node scripts/e2e-auth.mjs   # 17/17 PASS
powershell -File scripts/e2e-v1.ps1   # 33/33 PASS

# 验审计链 (数据归公司核心证据)
Invoke-RestMethod 'http://localhost:3000/api/audit?limit=20' | Select-Object integrity
# 期望: integrity.ok = True
```

---

## Day 2 · 邀请 + Steward 任命 + 首条议事 (1 小时)

### 2.1 Champion 邀请首批员工 (15 min)

`/admin/invite` 生成邀请码, 每人一条, 贴到企微 / 钉钉私聊. 邀请码格式 `XXXX-XXXX-XXXX-XXXX`, 7 天有效.

**铁律**: 至少跨 2 个部门邀请 — 单部门试用容易变成 "玩具", 跨部门协作才能触发议事室的核心价值.

### 2.2 任命 Steward (10 min)

- 候选人: 战略部 / CoS / 总裁办 / 资深专家
- **不能兼任**: 直接业务 Leader / HR (宪章 §14)
- Champion 在 `/admin/stewards` 任命, 签字生效

### 2.3 载入基础 Memory (15 min)

Steward 把客户已有的 3-5 条 SOP (Word / PDF) 上传到 `/memories`:
- 分类: requirement / consensus / standard / context
- 等级: 先全标 **Lv1 团队级** (Pilot 期不做 Lv3 公司级 — 流程太重)
- Steward + 部门 Leader 二签, 公示 3 天自动生效

这一步让 AI 的 "A · SOP 方案" 有弹药. 没 Memory 的话 A 选项会空, 价值打折.

### 2.4 Champion 跑第一条议事 (20 min — 现场陪跑)

**我方产品经理现场陪跑**. 议题选客户本周真实的一个小决策:

```
✅ 好议题:
   "下周要不要请客户 X 做产品调研"
   "Q3 营销预算砍 20% vs 不砍"
   "新入职的张三放哪个组"

❌ 烂议题:
   "公司未来战略" (太大, 17min 跑不完)
   "周会议程" (根本不是决议)
   "薪资调整" (宪章 §9 红区, AI 强退)
```

流程:
1. `/convergence` 发起 → DeepSeek 17-25 秒流式给 3+1 选项
2. Champion 看 A/B/C, **亲手写 D** (这里是感受 autonomy 的关键)
3. 4 分钟收敛 → COMMIT
4. Champion 亲眼看到: 24h 否决窗口开, Persona 统计 +1

**Champion 跑完这一条后如果点头 "这东西能用", pilot 就成了 60%**.

---

## Day 3-7 · 日常演练节奏

| 日 | 动作 | 产出 |
|---|---|---|
| 3 | 每人跑 1 条议事 (跨部门) | 5 张 Decision Card |
| 4 | hover IM 消息 → 一键开议事室 · 试 @persona 召唤 | 第一张"从聊天生的"决议 |
| 5 | 挑 Day 3 最好的 1 条决议, 提议升级为 Memory | 第一张 pilot 产出的 SOP |
| 6 | Steward 签批 + 3 天公示期开始 | Lv1 SOP 进 Memory 库 |
| 7 | Champion 看 `/admin/steward` + `/nine-box`, 写 2 页决策日志给我方 | 续签判断材料 |

**每天 15:00 有 15 分钟 Tandem 产品同学在线答疑** (Zoom / 腾讯会议链接, 我方固定).

---

## 数据归谁, 退出怎么办 (给 Champion 看的)

宪章 §13 "一明一暗":

### 明面: 数据归公司
- 所有决议 / 消息 / Memory / Persona 画像 **属于你的公司**
- 存在 **你们自己的 PostgreSQL** (Prisma migrate 到你机器上), 我方不接触原始数据
- 你随时可以 `pg_dump` 带走全部
- Pilot 结束不续签, 我方**不保留任何拷贝** (含日志 / 备份 / 埋点)

### 暗面: 员工尊严铁律 (对 Champion 透明)
每个员工都有:
1. **导出权** · `/api/me/export` 拉个人成长报告 + 决议历史 JSON
2. **匿名化** · 员工离职时 admin 一键 `/api/admin/users/:id/anonymize`, Persona 停止学习 + 通讯示例清空
3. **否决权** · AI 代行 24h 内可撤回
4. **拒绝代笔** · 薪资 / 法律 / 投诉 红区自动禁 AI

> **销售话术**: "其他工具告诉你'员工数据你都能看'. 我们告诉你: 数据你都能看, 但员工的尊严不受侵犯. 这样员工才不会联合起来防你."

---

## 7 天后 · Go / No-Go 决策

Champion 和 Tandem CSM 1 小时复盘会, 看 4 个指标:

| 指标 | 阈值 | 数据来源 |
|---|---|---|
| 跑通的议事室数 | ≥ 7 条 | `/api/dashboard/stats` |
| 17 分钟内 COMMIT 比率 | ≥ 70% | Decision Card `elapsedSeconds` |
| D 选项占比 (原创率) | ≥ 20% | PRD 北极星指标 §2.1 |
| Pilot 产出 SOP 数 | ≥ 1 条进 Memory | `/admin/steward` |

达标 → 正式续签 V1 GA (6-12 个月) + 铺到全公司.
不达标 → **我方退全款**, 数据由客户 `pg_dump` 带走或由我方协助物理销毁 (`npm run db:reset`).

---

## 常见障碍 (troubleshooting)

| 症状 | 原因 | 解决 |
|---|---|---|
| 启动日志 `[boot] storage=in-memory` | `.env.local` 的 `DATABASE_URL` 被注释或拼错 | 取消注释, `npm restart` |
| 议事室发起 500 | DeepSeek key 失效 / 超限 | `/api/llm-health` 看状态, 换 key 或切 Kimi/Qwen |
| `账号锁定` | 5 次错密码 | 等 15 min 自动解 / admin 在 DB `UPDATE users SET failedLoginCount=0, lockedUntil=NULL` |
| 3+1 的 A 选项总是空 | Memory 库空 | Steward 先载入 3-5 条 SOP (Day 2.3) |
| persona 老停在 🥚 newborn | 决议数 < 5 | 多跑几条真实议事室, 不要跑 "测试议题" 灌水 |
| 邀请注册 400 `weak_password` | 密码不含特殊字符 / 包含邮箱前缀 | 密码规则见 `lib/auth/password.ts:evaluatePassword` |

---

## 我方 SLA (pilot 期)

- 工作时段 (9:00-19:00) 响应 ≤ 30 min
- P0 (登录不了 / 议事室跑不动) 响应 ≤ 15 min, 解决 ≤ 4h
- 每天 1 份运行报告 (议事数 / LLM 调用量 / 审计事件) 发给 Champion
- Champion 任何宪章层面 (§4 / §9 / §13) 的疑问 **直接我方创始人答**, 不走客服

---

## 交付物清单 (pilot 开始前我方准备)

- [ ] `.env.local` 模板 (已填 DeepSeek key, 占位 DB_PW / JWT / 邀请 owner)
- [ ] `scripts/e2e-auth.mjs` + `scripts/e2e-v1.ps1` (IT 验收工具)
- [ ] 上次 clean install 的 50/50 测试日志截图
- [ ] `docs/USER-GUIDE.md` PDF (给员工)
- [ ] `docs/MANIFESTO.md` PDF + 高亮版 (给 Champion, 先读 §4/§9/§13/§17)
- [ ] `docs/PRISMA-SETUP.md` (给 IT Admin)
- [ ] 本文 `docs/PILOT-ONBOARDING.md` (运营手册)

---

## 续签后: 从 Pilot 到 GA

- Week 2-4: 铺到 50% 员工
- Month 2: 铺到全公司 + 任命第 2 个 Steward + 启用 Lv2 / Lv3 Memory 签批
- Month 3: 腾讯会议寄生接入 (§9 分身代参 meeting proxy 上线)
- Month 6: Persona 升到 deputy 阶段 (黄区代行), §15 autonomy 守门启用

这份指南每个 pilot 结束后复盘 + 迭代. 下次 pilot 时间期望压到 **30 分钟装机 + 30 分钟 Day 1**.
