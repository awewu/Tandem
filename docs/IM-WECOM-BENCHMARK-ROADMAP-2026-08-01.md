# Tandem IM · 对标企业微信 Roadmap + 体验极致化计划

> 归档日期: 2026-08-01
> 定位: Tandem IM 不做企业微信的全面替代品，而是**"AI 原生的组织协作中枢"**——
> 在"内部知识型协作 + AI 增强"赛道打出结构性优势，在"通用 IM 基础设施 + 外部私域"上不硬拼、只补到"够用不难受"。

---

## 0. 判断基线（基于代码实测，非宣传）

已具备(对齐企微基础盘): 7 种频道类型 · 单聊 · 撤回/置顶/表情回应/转发/附件(对象存储预签名)/已读回执 · SSE 实时 · 组织架构一键建群 · 通讯录 · 全文+语义(RRF)搜索。

差异化优势(企微没有): 分身代答 · 一条消息开议事室 · 消息沉淀为 Memory(三级签批) · 中央 AI 参与 + AI trace 可观测 · 频道 AI 摘要 · 语义搜索 · 与 OKR/PMS/学院同一数据底座 · 反焦虑已读语义。

---

## A. 基础功能对齐差距（Parity Gaps）

| # | 差距 | 企微 | Tandem 现状 | 优先级 | 建议路径 |
|---|---|---|---|---|---|
| A1 | 音视频通话 / 会议 / 屏幕共享 | 核心 | 无 | P1 | 接 LiveKit(自托管) 或 声网/腾讯 RTC；先 1:1 语音，再群会议 |
| A2 | 移动端消息可靠性(弱网重传/断线补洞/离线队列) | 成熟 | ✅**已做**: 重连对账补洞 + 降级轮询; ⏳未做: seq-log 精准补洞、离线发送队列 | **P0(部分)** | 见下方"P0 已交付" + 后续 seq-log |
| A3 | 外部客户联系 / 微信互通 / 私域 | 核心 | 有外部用户体系，无微信图谱 | P2 | 不硬拼；仅做外部 partner/contractor 的受限 IM |
| A4 | 第三方应用/小程序生态 · 群机器人 webhook | 开放平台 | Launchpad 无第三方 | P1 | 群机器人 incoming webhook(投产/告警/CI 回流) 性价比最高 |
| A5 | 会话存档合规(金融/政务) | 有 | 无 | P2 | 视客户合规需求再做 |
| A6 | 打卡/审批/红包 IM 内联 | 有 | 独立模块，未进聊天流 | P2 | 审批卡片可复用 convergence 决策卡内联 |
| A7 | 历史消息分页/无限上翻 | 有 | `limit=200` 硬顶，无 load-more | **P0** | 见 B2 |

---

## B. 流畅性 / 体验硬审计（代码取证的真实毛边）

> 这一节是"push 自己"的核心：先诚实列出当前不够极致的地方，全部有 file:line 佐证。

### B1. `typing`「正在输入」是假闭环 — **P0**
- 证据: `lib/im/service.ts` `emitTyping` + `app/api/im/channels/[id]/typing/route.ts` + SSE 广播都在，但 `app/im/page.tsx` 的 SSE 监听(388–421)既不监听 `typing` 事件、composer 也不 POST typing；无组件渲染。
- 影响: 建了一半的功能 = 维护成本却零价值，违反"假闭环预防"军规。
- 修: composer onChange debounce(~2s) POST typing；SSE 加 `typing` 监听 → 顶部/底部渲染"对方正在输入…"(3s TTL 自动消失)。

### B2. 无历史分页，向上翻不到更早消息 — **P0**
- 证据: `app/im/page.tsx:344,356` 固定 `?limit=200`，无游标上翻。
- 修: 滚动到顶部触发 `before=<最早msg.createdAt>` 拉上一页；保持滚动锚点(记录 scrollHeight 差值回补，避免跳动)；配 `listByChannel` 已有的游标能力。

### B3. 8 处原生 `window.alert/prompt/confirm` — **P0**
- 证据: `app/im/page.tsx` 246,286,454,479,658,696,715,739,807。
- 影响: 阻塞式系统弹窗，移动端尤其割裂；`newDmPrompt`(807) 让用户**手输 userId**，几乎不可用。
- 修: 全部换 `hooks/use-toast.ts` 的 toast + 项目内 Dialog；`newDmPrompt` 改用已存在的 `StartDmDialog`(带人员选择器)。

### B4. 无日期分割线 / 无发送人时间分组落点 — **P1（已落 2026-08-01）**
- 证据: `app/im/page.tsx:931-958` 平铺渲染，仅把 `prev` 传给 MessageRow。
- 修: 跨天插入居中日期分隔("今天/昨天/M月D日")；同人 5 分钟内合并气泡(省头像重复)。
- **落地**: 纯 helper `formatImDateDivider`/`shouldShowImDateDivider`(`lib/im/message-display.ts`, 单测 8 例) → 渲染循环按天插入居中日期 pill；MessageRow 续条(`!showSender`)隐藏头像用等宽占位保持对齐 + 收紧行距。

### B5. 无「回到最新 · N 条新消息」悬浮按钮 — **P1（已落 2026-08-01）**
- 证据: `nearBottom` 逻辑(392)在用户上翻时抑制自动滚动，但**不给任何落点**；新消息静默堆积。
- 修: 上翻时右下角悬浮"↓ N 条新消息"，点按平滑滚底并清零。
- **落地**: `atBottom`/`newMsgCount` 状态；`onScroll` 追踪贴底态贴底清零；SSE `message` 非贴底且非本人 → 累积计数；`scrollToBottom()` 平滑滚底清零；消息流包 `relative` 容器承载右下角悬浮按钮(未贴底才显示)。

### B6. SSE 之外叠 30s 轮询，冗余且可能抖动 — **P2**
- 证据: `app/im/page.tsx:423-426` `setInterval 30_000 → refreshMessages`。
- 修: SSE 健康时停轮询；仅在 SSE 断线(onerror)时降级为轮询，恢复后停。与 A2 断线补洞合并做。

### B7. 消息列表未虚拟化 — **P2（已评估 · 暂缓）**
- 现状 200 条上限尚可；一旦 B2 上翻累积会退化。
- 修: 引入虚拟滚动(react-virtuoso 或自研 window)，配合 B2。
- **2026-08-01 决策**: 初始批量已从 200 降到 50(见性能落地 §P4a) + MessageRow memo 化后单屏 DOM 已轻，虚拟化边际收益低却风险高(深链滚动/翻页锚点/hover 操作条/已读浮层)。经 Owner 确认**暂缓**，待长会话规模化后再引入。

### B8. 发送体验细节 — **P1（图片内联已优化）**
- 乐观发送已做(good)；但失败仅 alert(B3)，且**图片用 dataURL 内联**(`uploadAttachment` image 分支)会让大图撑爆消息体/内存。
- 修: 图片也走预签名 + 缩略图；发送态用气泡内进度/重试角标替代 alert。
- **2026-08-01 落地**: 上传前客户端压缩/降采样(最长边 1600px, 重编码 jpeg/webp, fail-soft 回退)大幅削减 base64 负载；消息流 `<img>` 加 `loading=lazy` + `decoding=async`。预签名对象存储路径保留。

---

## B'. 性能优化落地记录（2026-08-01，深挖"IM 慢/卡"根因后按序 #2→#5→#4→#1）

> 根因: 每次输入/typing/轮询触发父组件重渲染 → 全量重渲染消息行；已读回执每条消息一发；初始 200 条 + 图片 base64 内联撑爆 DOM/负载。

- **P#2 memo 化行组件 — 已落**: `MessageRow` 包 `memo`；7 个行内回调(spawnRoom/promoteToMemory/recall/pin/forward/mentionPersona/reactionChange)全部转稳定 `useCallback`(按 id 参数化)，`busy`/`recallingIds` guard 移入 ref 镜像。打字/typing/降级轮询不再连带刷全列。
- **P#5 已读回执节流 — 已落**: `markActiveChannelRead` 按频道节流 ≤1 次/1.5s + trailing 边界补发 + 卸载清理定时器。高频消息流不再每条 `POST /read` + 全局刷频道列。
- **P#4a 初始批量降量 — 已落**: `INITIAL_PAGE` 200→50，`REFRESH_PAGE` 80，`OLDER_PAGE` 50；首屏 DOM/负载更轻，更早历史靠 B2 上翻按需加载(merge 保留已加载页)。
- **P#4b 虚拟滚动 — 暂缓**: 见 B7 决策。
- **P#1 图片上传优化 — 已落**: 见 B8 落地。

验证: `npx tsc --noEmit` 中 `app/im/page.tsx` 零错误；IM 单测 `im-search` + `im-search-route` 13/13 通过。

---

## C. 优势功能"体验极致化"（让 AI 原生功能有"魔法感"）

> 对齐只是"不难受"；真正拉开差距靠优势功能的体验密度。

### C1. 分身代答 — 从"兜底"升级为"有存在感"
- 现状: 离线 24h 兜底回复。
- 极致: 回复前先显示"XX 的分身正在替他思考…"(复用 typing)；回复气泡带**可信度标注 + 一键"转人工/催真人"**；真人上线后分身回复顶部提示"以下由分身代答，[标记待本人确认]"。

### C2. 一条消息 → 开议事室 — 降低摩擦 + 回流可见
- 极致: hover 菜单预览"将生成决策卡: <标题>"；开室后原消息**内联挂一张迷你卡片**(状态实时随 convergence 更新)，而非只 window.open 新标签。

### C3. 消息沉淀 Memory — 反馈即时化
- 现状: `promoteToMemory` 成功用 alert 打印 promotionId(739)。
- 极致: 改 toast + 原消息角标"📌 已提沉淀 · 待签批"，点角标直达 `/memories` 对应项。

### C4. 语义搜索 — 已加高亮，继续做"可解释"
- 现状: 词面+向量 RRF + 命中高亮(本次已加)。
- 极致: 结果分「关键词命中/语义相关」两组标注；键盘 ↑↓ + Enter 导航；最近搜索/建议词。

### C5. 频道 AI 摘要 — 从"按钮"变"在场"
- 极致: 长时间未读频道自动生成"你不在时发生了什么"3 条要点(可关)；@我 的消息单独聚合。

---

## D. 优先级 Roadmap（Impact × Effort）

### ✅ P0 已交付（2026-08-01, 全部 `app/im/page.tsx`, tsc 0 err · IM 测试 15/15）
- **B3** 6 处 `window.alert` → 非阻塞 `useToast` toast；删除死码 `newDmPrompt`(`window.prompt`, 无调用方)。
  - 保留项(诚实标注): 撤回二次确认 + 上传中离开守卫仍用 native `confirm`——后者绑定 `beforeunload/popstate` 生命周期必须同步, 是正确工具; 前者为破坏性操作守卫, 低风险留待 AlertDialog 化。
- **B1** typing 闭环: composer `handleComposerTextChange` 节流(2.5s)POST `/typing` → SSE `typing` 监听(4s TTL + 切频道清 timer)→ composer 上方"X 正在输入…"。服务端 `emitTyping`/SSE 早已就绪, 本次补齐客户端"发+收+渲染", 消除假闭环。
- **B2** 历史向上分页: `loadOlderMessages()` 用 `before=<最早 createdAt>` 排他游标, `onScroll<60px` 触发(ref 防重入), rAF 回补 `scrollTop` 保持锚点不跳; `loadMessages` 记 `hasMoreOlder`; 顶部"加载更早/已到最早"提示。
  - 连带修复潜在回归: `refreshMessages` 由**整列替换**改为**按 id merge + createdAt 升序重排**, 否则每次轮询/重连会抹掉已上翻的历史页。
- **A2/B6** SSE 自愈: `es.onopen`(重连第二次+)立即 `refreshMessages` 对账补洞 + `es.onerror` 置 unhealthy(不 close, 浏览器自动重连); 常态 30s 轮询改为**降级专用**(仅 SSE 断线时 15s 对账, 健康时 no-op), 消除滚动抖动与冗余请求。
  - 未做(诚实标注): 服务端 SSE 无 `id:`/`Last-Event-ID` 与 per-channel seq-log, 当前靠"拉最新 N 条 merge"近似补洞(N=200 覆盖现实缺口); **真·增量精准补洞需后续给事件总线加持久 seq-log**, 属下一步。离线发送队列亦未做。

### P1（下迭代 · 体验密度）
- ~~B4 日期分割 + 气泡分组~~ ✅ 已落 2026-08-01
- ~~B5 「回到最新 · N 条新消息」~~ ✅ 已落 2026-08-01
- B8 图片预签名+缩略图 + 发送态进度/重试（客户端压缩已落，对象存储切换待做）
- C1/C2/C3 优势功能体验化（分身在场感 / 议事室内联卡 / 沉淀角标）
- A4 群机器人 incoming webhook

### P2（按需 / 规模化）
- B7 虚拟滚动
- A1 音视频（LiveKit/RTC）
- C4/C5 搜索可解释 + 智能摘要在场
- A3/A5/A6 外部私域 / 合规存档 / 审批红包内联

---

## E. 极致体验标准（Definition of Excellence · 我给 IM 定的验收线）

任何 IM 改动，未同时满足以下量化线，不算"做完"：

1. **零阻塞弹窗** — 生产路径不得出现 `window.alert/confirm/prompt`；反馈一律 toast/inline。
2. **发送即时感** — 乐观渲染在下一帧出现(<16ms)；失败可就地重试，不丢草稿。
3. **首屏 < 300ms** — 切频道到消息可见(缓存优先，网络回填)。
4. **60fps 滚动** — 上翻加载不跳动(锚点回补)；长列表虚拟化。
5. **断线自愈** — SSE 断开自动重连 + 增量补洞，用户无感；不靠死轮询。
6. **无假闭环** — 任何"发得出去"的事件必须"收得到、看得见"(typing 即反例)；新功能须真链路探针验证。
7. **AI 有在场感** — 分身/中央 AI 的行为可见、可标注可信度、可一键转人工，绝不"偷偷代答"。
8. **移动端一等公民** — 触控热区 ≥44px、返回手势有上传保护、弱网可用。

> 一句话自我 push: **先把"假的/断崖的"改成"真的/顺的"(P0)，再把"顺的"改成"有魔法感的"(P1/C)**；对齐做到不难受即止，把工程预算压在别人抄不走的 AI 原生体验上。
