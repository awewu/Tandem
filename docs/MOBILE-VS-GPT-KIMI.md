# Tandem 手机端 vs GPT / Kimi 对比分析

> 日期: 2026-05-28
> 背景: 手机端 P1-P4 实施后, Owner 要求对照 Kimi/GPT 评估差异与借鉴方向
> 状态: 战略参考文档, 非死锁判断, 后续迭代时可挑战

---

## 0 · 一句话定位

| | 产品本质 | 用户打开它做什么 |
|---|---|---|
| **GPT (ChatGPT)** | 个人通用 AI 助手 | 万事问 AI（写作/编码/翻译/陪聊）|
| **Kimi** | 长文本 / 长思考 AI 助手 | 看长文/查资料/写报告 |
| **Tandem** | 企业级 OKR 协同 + AI 辅助平台 | 围绕公司目标推进工作（看 KR / 写日报 / 跟同事议事 / 召唤搭子）|

**结论先行**: Tandem mobile 跟 GPT/Kimi 不是同一物种. 它们是「个人 AI 入口」, Tandem 是「组织协同 + AI 增强」. 直接比抄是错位竞争. 但**几个被它们验证过的体验范式值得借鉴**(流式打字 / 实时语音 / 多模态 / 零摩擦首屏).

---

## 1 · 详细维度对比

### 1.1 首屏与导航

| 维度 | GPT | Kimi | Tandem |
|---|---|---|---|
| 启动后默认页 | 全屏对话(新会话) | 全屏对话(新会话) | 工作台 / OKR / 日报 |
| 导航形态 | 顶部模型切换 + 左侧历史抽屉 | 顶部模型切换 + 左侧历史抽屉 | **底部 5 tab + 中间 FAB + 顶部汉堡 drawer** |
| 切换会话/模块成本 | 1 次点击(抽屉里历史会话) | 1 次点击 | tab 直达; 模块切换走 drawer |
| 入口零摩擦度 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐(多 tab 反而更明确, 但首屏不直接是 AI 对话) |

**洞察**: GPT/Kimi 是「打开即用」, Tandem 是「打开即看进展」. 这跟产品定位一致, **不要为了零摩擦把 Tandem 改成单聊** —— 那样就丢了 OKR 协同的灵魂.

### 1.2 AI 对话能力

| 维度 | GPT | Kimi | Tandem |
|---|---|---|---|
| 单聊全屏对话 | ✅ 核心 | ✅ 核心 | ✅ `/chat` 有, 但不是首屏 |
| 流式 token 打字机 | ✅ 优雅 | ✅ 优雅 | ✅ `/chat`、`/report` AI 对账 有; **IM 里 CompanyBrain 回复无流式(一次性出全)** |
| 长上下文 | 128K(GPT-4o 单轮) | **2000K 王炸** | 看后端模型, 缺一个「直接上传长文档」入口 |
| 多模态: 图片 | ✅ Vision | ✅ 图片识别 | ❌ 移动端无入口 |
| 多模态: 文件上传 | ✅ PDF/Word/CSV | ✅ 任意文件 | 📂 有 `/documents` `/drive`, 但跟 AI 对话不打通 |
| 联网搜索 | ✅ | ✅ | ❌ |
| 代码解释器 | ✅ | 部分 | ❌(自用阶段不需要) |
| 跨会话记忆 | ✅ Memory | ✅ | ✅ Persona 训练 + CompanyBrain 灵魂层(但围绕组织而非个人偏好) |

**洞察**:
- GPT/Kimi 是「**一个会做万事的对话框**」, Tandem 是「**有专门入口的协同平台 + AI 辅助**」
- 借鉴价值: **IM 里 CompanyBrain 回复加流式打字**(已有 `/api/llm-stream` 基础, IM 没接), 这是低成本高质感升级
- 不必追: 多模态图片识别、Code interpreter 等(自用阶段无需)

### 1.3 语音交互

| 维度 | GPT | Kimi | Tandem |
|---|---|---|---|
| Push-to-talk(长按录音) | ✅ | ✅ | ✅ Web Speech API(刚做) |
| ASR(语音→文字) | 自有大模型 | 自有大模型 | 浏览器原生(Chrome/Safari/Edge 支持, Firefox 不支持) |
| TTS(AI 回复念出来) | ✅ | ✅ | ❌ |
| **实时双向语音对话** | ✅ **Advanced Voice Mode**(像打电话) | ✅ 通话模式 | ❌ |
| 视频通话(带视觉) | ✅(GPT-4o 摄像头) | 部分 | ❌ |

**洞察**:
- Tandem 当前的 push-to-talk 是基础线, 已够用
- **实时双向语音对话** 是 GPT/Kimi 杀手锏(通勤路上语音聊聊就能写完日报). Tandem 有机会做: **`/chat` 加实时语音模式**(接 OpenAI Realtime API 或 Kimi 通话 API), 让员工**通勤语音 → 提炼成日报 → 推流 OKR** —— 这是 OKR 协同独有的杀手场景
- 优先级中等, 2-3 天可做(OpenAI Realtime API 已开放)

### 1.4 视觉审美

| 维度 | GPT | Kimi | Tandem(新版) |
|---|---|---|---|
| 主色 | 白底 + 单一墨绿色 logo | 蓝色品牌 + 渐变装饰 | **白底 + 品牌红 FAB(其他克制)** |
| 字体层级 | Apple HIG / Inter | 系统字体 + 自有显示字体 | Inter + Inter Tight |
| 装饰元素 | 几乎为零(克制极致) | 中等(emoji、卡片渐变) | **刚去花哨化(去渐变/pulse/bounce/emoji)** |
| 动画 | 仅 token 流入 | token 流入 + 卡片过渡 | 仅 hover / token 流入 |
| 触感(FAB / 凸起按钮) | 无 | 无 | **有(中间日报 FAB 凸起)** |
| 暗黑模式 | ✅ | ✅ | ✅(系统跟随) |

**洞察**:
- 视觉路线 Tandem 跟 GPT 同源(Apple HIG 克制), 跟 Kimi 不同(Kimi 略偏装饰)
- **唯一独有的 FAB 凸起设计是亮点** —— 这是企业自用阶段「每日打开干一件事 = 写日报」的强语义信号, GPT/Kimi 没这种产品诉求

### 1.5 协同与社交

| 维度 | GPT | Kimi | Tandem |
|---|---|---|---|
| 多人协作 | ❌ 完全个人 | ❌ 完全个人 | ✅ **核心**(IM / 议事室 / OKR 对齐 / 360 评估) |
| @ 提及 | ❌ | ❌ | ✅ |
| 异步消息流 | ❌ | ❌ | ✅ |
| AI 召唤到群聊 | ❌ | ❌ | ✅ `@CompanyBrain` `@分身` |
| 决策可追溯 | ❌ | ❌ | ✅ AuditLog + DecisionCard |

**洞察**: 这是 Tandem 完全独有的赛道. GPT/Kimi 永远不会做, 因为它们的赛道是 ToC 个人助手. Tandem 不要因为追 GPT 颜值放弃这个差异化.

### 1.6 通知与触达

| 维度 | GPT | Kimi | Tandem |
|---|---|---|---|
| 原生 App | ✅ iOS/Android | ✅ iOS/Android | ⚠️ 仅 PWA + Tauri 桌面 |
| Push 通知 | ✅ APNs/FCM | ✅ | ❌ Web Push 需配 VAPID(未做) / ✅ Tauri 桌面 native 通知(已做) |
| 锁屏提醒 | ✅ | ✅ | ❌(iOS PWA 限制) |

**洞察**:
- 移动端没原生 app 是 Tandem 短板, 但自用阶段不致命(同事桌面用 Tauri、手机用 PWA + 浏览器够用)
- 后续可以考虑 Capacitor 套壳出 Android APK(iOS 需开发者账号)

### 1.7 数据归属与隐私

| 维度 | GPT | Kimi | Tandem |
|---|---|---|---|
| 数据存储 | OpenAI 服务器 | Moonshot 服务器 | **公司局域网 Postgres**(自主可控) |
| 训练数据使用 | 默认会用(可关) | 默认会用(可关) | **不上传外部** |
| 合规 | GDPR / 部分 | 部分 | **企业自定** |

**洞察**: Tandem 数据归属是企业级的硬护城河, GPT/Kimi 永远赶不上(除非 ToB 版本).

---

## 2 · 战略性差异矩阵

```text
              高频   低频
            ┌──────┬──────┐
     个人  │ GPT  │      │
            │ Kimi │      │
            ├──────┼──────┤
     协同  │Tandem│      │
            │  ⭐  │      │
            └──────┴──────┘
```

- **GPT/Kimi**: 高频 + 个人 → 「每天打开 N 次随便问点什么」
- **Tandem**: 高频 + 协同 → 「每天打开 1 次写日报推 OKR, 进 IM 看同事消息, 召唤搭子」

**结论**: Tandem 不该追 GPT 的「打开即对话」零摩擦 —— 那是个人 AI 的逻辑. Tandem 的零摩擦是「**打开即看进展 + 一键日报 → 推流 OKR**」, 这套 FAB 凸起设计已经体现了.

---

## 3 · 值得借鉴的 5 个 GPT/Kimi 实践(按 ROI 排序)

| # | 借鉴点 | 工作量 | 价值 | 来源 |
|---|---|---|---|---|
| 1 | **IM 里 CompanyBrain 回复加流式打字** | 4-6h(接已有 `/api/llm-stream` 到 IM SSE) | ⭐⭐⭐⭐⭐ 视觉档次拉满 | GPT |
| 2 | **`/chat` 加实时双向语音对话**(OpenAI Realtime API) | 2-3d | ⭐⭐⭐⭐ 通勤语音写日报场景王炸 | GPT Advanced Voice |
| 3 | **AI 输入框支持拖入文件 / 截图**(IM 发图 + AI 分析) | 1-2d | ⭐⭐⭐ 跟现有 `/documents` 打通 | GPT/Kimi |
| 4 | **TTS: CompanyBrain 回复念出来** | 1d | ⭐⭐ 通勤路上听同事/搭子总结 | GPT |
| 5 | **历史会话侧拉抽屉**(`/chat` 现在没有) | 半天 | ⭐⭐ 跨会话查历史 | GPT/Kimi 都有 |

---

## 4 · Tandem 应该坚持的 3 个独有定位

1. **底部 FAB「日报」凸起**: 每天打开 → 干一件事 = 写日报 → 推流 OKR. GPT/Kimi 没这种 daily ritual 设计.
2. **OKR 看板 + 日报推流闭环**: 进度自动更新, 不是手动拖滑块. GPT/Kimi 完全无此场景.
3. **协同 + 治理**: 议事室 / Baseline-Guard / OKR Drift / Audit. GPT/Kimi 永远到不了的赛道.

---

## 5 · 推荐下一轮迭代优先级

```text
Priority 1 (本周): IM CompanyBrain 流式打字 (4-6h)
                  → 这是用户每次 @CompanyBrain 都会看到的体验, 1 次改动覆盖 100% 用户

Priority 2 (下周): 实时双向语音 /chat 通勤模式 (2-3d)
                  → 配合手机端日报闭环 = Tandem 独有杀手场景

Priority 3 (下下周): 文件拖入 IM / Chat (1-2d)
                    → 多模态最小可用版

后续: PWA Web Push (VAPID, 1d) + Capacitor Android (3d)
```

---

## 6 · 风险提示

**不要做的事**:

- ❌ 不要把 Tandem 首屏改成「全屏对话」抄 GPT —— 这等于砍掉协同灵魂
- ❌ 不要追多模态全家桶(Vision / Code interpreter / 画图) —— 自用阶段无需, 浪费 1 个月工时
- ❌ 不要做「自有 GPTs 商店」 —— Tandem 已经有 Persona/Agent, 没必要重新发明

**要做的事**:

- ✅ 流式打字、语音对话、文件拖入: 把 GPT/Kimi 验证过的体验范式融到 Tandem 已有的协同场景里
- ✅ 持续强化日报 ↔ OKR 闭环: 这是 Tandem 跟 GPT/Kimi 拉开战略差距的核心

---

## 7 · 复审节点

- **2026-06-11**(2 周后): Priority 1+2 跑通后, 复评 Priority 3 优先级与实际同事使用反馈
- **2026-07**(M2 阶段): 看公司同事是否还有真实未满足需求, 决定是否做 PWA Web Push / Capacitor APK

## 附录: 相关文档

- `docs/SELF-USE-FIRST.md` — 自用阶段优先级总框架
- `docs/OKR-DRIVEN-ARCHITECTURE.md` — OKR 驱动器 6 条灵魂层
- `docs/MANIFESTO.md` — 19 条产品宣言
- `components/mobile-tab-bar.tsx` — 当前移动端 tab bar 实现
- `app/report/page.tsx` — 5min 日报 ↔ OKR 推流闭环
