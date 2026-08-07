# Nexus 平台硬化 & 功能路线图

> 多迭代工程的分阶段推进计划。区分:**大工程(按项目推进)** 与 **新功能模块(写入规划,暂不建)**。
> 状态图例:🟢 已落 · 🟡 进行中/首增量已落 · ⚪ 规划中(未动)。

## A. 大工程(硬化 · 按项目推进)

### A1. 度量中台 / OLAP 数仓 — 🟡
- 已落:RLS 读模型表 `metric_daily_rollup` + `metric_channel_attribution`;多触点归因(线性/位置/时间衰减)纯函数 + 服务 + `/api/v2/metrics/*`(替代 CMO 直查 OLTP 的首步)。
- Phase 2:读模型**定时刷新**(cron/outbox 触发 `refreshDailyRollup`,替代手动)。
- Phase 3:引入 **OLAP(ClickHouse/数仓)** 承接跨租户大规模聚合 + 指标语义层(统一口径 metric registry);OLTP 只留读模型物化。
- 验收:CMO/cockpit 面板 100% 读读模型/OLAP,零直查业务表;租户隔离经 `guard:rls-enforcement`。

### A2. 可观测性 APM/Sentry — 🟡
- 已落:全局 `ObservabilityInterceptor`——请求 **trace-id 透传**(x-trace-id)+ 结构化时序/错误日志 + 慢请求告警 + 可插拔 `errorSink`(Sentry/OTel 接缝)。
- Phase 2:接 **OpenTelemetry**(trace 导出 OTLP)+ **Sentry**(`setErrorSink` 注入 @sentry/node,env `SENTRY_DSN` 开关)。
- Phase 3:Prometheus 指标(RED/USE)+ 看板(Grafana)。
- 验收:错误可在 Sentry 按 traceId 溯源;P95 延迟看板;告警接入。

### A3. AI 治理可观测性(eval / 成本看板) — ⚪
- 现状:ai-gateway 走 Tandem 治理网关,无 prompt 版本/评测/成本记录。
- Phase 1:AI 调用埋点表 `ai_invocation`(prompt 版本、tokens、成本、延迟、provider)+ 拦截 ai-gateway 落库。
- Phase 2:输出 **eval**(事实性/合规回归集)+ 成本看板 + 预算告警。
- 验收:每次 AI 生成可追 prompt 版本 + token 成本;上线前跑 eval 回归。

### A4. e2e / 视觉回归进 CI — ⚪
- 现状:`guard:ui-vi` / `guard:browser-visual` 常年 SKIP(需 staging)。
- Phase 1:Playwright 冒烟(登录→驾驶舱→各模块页 200 + 关键交互)纳入 CI。
- Phase 2:视觉快照回归(staging + `ENABLE_REACT_CANDIDATE=true`)进 PR 门禁。
- 验收:PR 自动跑 e2e + 视觉 diff,红线阻断合并。

### A5. event-bus HA(Redis Streams 消费组) — ⚪
- 现状:event-bus 进程内 + 快照 setInterval 兜底;`guard:redis-stream-dispatch` 有底座。
- Phase 1:关键跨域事件改走 **Redis Streams + 消费组**(至少一次投递 + ack + 重试 + 死信)。
- Phase 2:多实例消费者水平扩展 + outbox→stream 桥接幂等。
- 验收:重启/多实例不丢事件;`test:integration:flywheel` 在多实例通过。

### A6. 密钥 Vault/KMS — ⚪
- 现状:PII key 有 dev 默认回退;JWT/OTP/SSO 密钥靠 .env。
- Phase 1:`SecretsProvider` 抽象(env 实现 → Vault/KMS 实现),启动时校验必需密钥齐备。
- Phase 2:接 Vault/KMS + 轮换;移除所有 dev 默认回退(生产禁用)。
- 验收:生产无明文密钥落盘;密钥可轮换;`guard:oidc-secrets` 强化。

### A7. 双运行时收敛(legacy Express → NestJS) — ⚪
- 现状:legacy `server/`(Express+MongoDB, ~48k LOC)与 NestJS 目标并存。
- Phase 1:契约对齐清单(逐路由 parity 测试),标注可弃/待迁。
- Phase 2:分批迁移剩余业务路由到 NestJS + 数据迁出 MongoDB;流量切换。
- Phase 3:下线 legacy `server/` + docker 单体。
- 验收:生产入口仅 NestJS;MongoDB 退役;`guard:legacy-surface` 清零。

## B. 新功能模块(写入规划 · 暂不建)

> 均为营销中台 B端/增长范畴的新模块;按北极星(GEO→高意向线索)+ 副指标(经销商成交率)价值排序,后续单独立项。

| 模块 | 定位 | 依赖/接缝 | 优先级 |
|---|---|---|---|
| 付费媒体投放(SEM/信息流/OTV/梯媒) | GEO 免费被引之外的**付费放大** + 回流归因 | 接 metrics 多触点归因(付费渠道纳入)、gtm 预算 | P2 |
| VOC 口碑/评价挖掘 | 电商/社媒评价→GEO 事实弹药 + 竞品情报输入 | 喂 insight/GEO;opinion 雏形升级 | P2 |
| 预测决策 AI(线索评分/流失/需求预测/NBA) | 生成式之外的**预测式**:线索优先级、复购预测、次优动作 | 读 CDP/metrics 读模型;派单优先级 | P2 |
| MDF/Co-op 市场基金 + 预算总盘 | 集团预算盘子→事业部→渠道 co-op 费控闭环 | 扩展 gtm 预算 + channel 返利 | P2 |
| 门户 LMS(培训认证) | 分层认证=返利资格闸的落地(charter 4.19) | 联动 channel.certified;经销商门户 | P1 |
| 门户 线索认领 | GEO/活动派发到网点的线索自助认领与跟进 | 接 dispatch/crm(飞轮),按 RBAC scope | P1 |

> 门户两项(LMS/线索认领)为经销商门户 Under Construction 的实体化,直接抬升"经销商成交率",建议优先于其余 P2。
