# 搭子手抄 · Voice「转文件不流畅」诊断 + voicebox 借鉴清单

> 存档日期：2026-08-06 · 定位：**排期用借鉴清单**,非实施记录(本轮未动代码)。
> 单一事实源：Tandem 项目(`main` 分支);本文引用文件均在 `main`。
> ⚠️ 本文件创建时工作树停在 `nexus-main`,属**未跟踪文件**;正式归档请在 `main` 分支 `git add` 并登记 docs INDEX。

---

## 1. 手抄模块体系(现状速览)

搭子手抄 = Notion / Get笔记式 PKM,语音只是采集入口之一。

| 域 | API / 文件 |
| --- | --- |
| 笔记核心 | `app/api/shouchao/notes`(CRUD)、`notes/[id]/links`(双链)、`notebooks`、`notes/[id]/share-to-persona` |
| 结构化数据 | `databases` + `rows` + `databases/[id]/extract`(表格视图) |
| 智能加工 | `ai`(润色)、`ask`(笔记问答/RAG)、`distill`(蒸馏) |
| 采集入口 | `transcribe`(语音)、`clip`(剪藏)、`import`(导入)、`attachments`、`ocr` |
| 端/同步 | `sync` + `lib/shouchao/offline-queue.ts` + `android-shouchao`(Capacitor + `ShouchaoNativeRecorderPlugin.java`) |
| lib | `service` · `store` · `db-service`/`db-view` · `distillation`/`distill-detect` · `extract` · `tree` · `offline-queue` · `voice-note` |

页面：`app/shouchao/page.tsx`(约 3466 行)、`app/shouchao/db/[id]/page.tsx`、`layout.tsx`。

---

## 2. Voice 两条路

| 路 | 文件 | 技术 | 特点 |
| --- | --- | --- | --- |
| A. 实时语音输入 | `components/voice-input-button.tsx` | 浏览器 Web Speech API | 实时、无后端;仅 chat/IM 用,**手抄未用**;Firefox 不支持、Android WebView 不稳 |
| B. 转文件(手抄用) | `app/api/shouchao/transcribe/route.ts` + `lib/infra/transcribe.ts` | 后端批量 STT:DashScope `qwen3-asr-flash` / OpenAI Whisper | 整段上传批处理,**当前卡顿源** |

手抄录音流程(`app/shouchao/page.tsx` L2867–3160):离散阻塞模态
`idle → recording → recorded →（手动点转写）→ transcribing → 结果`。

---

## 3. 卡顿根因(按影响排序)

1. **全程阻塞、无流式**:点转写后整段音频一次性上传 + 整段 STT +（润色/会议模式）再**串行**调一次 LLM(1200–1800 token),期间只有 spinner,零增量。
2. **双次串行网络往返**:STT 完才发第二个 LLM 请求,不并行、不流式。
3. **整文件 base64 缓冲**:`transcribeWithDashScope` 把整段 `arrayBuffer → base64 data URL`,内存 + 体积涨 33%,长音频更慢。
4. **不留音频**:route 注释"仅转写不落库" → 转错只能重录,不能换模型重转/重润色。
5. **移动端格式脆**:web webm/opus vs 原生 m4a,`inferAudioMimeType` 兜底,偶发差。
6. **>25MB 硬拒**(提示"分段上传"),**无自动分段**。

---

## 4. voicebox 判断

`jamiepine/voicebox`(voicebox.sh)= **本地优先 Rust 桌面应用**(macOS/Win/Linux),Whisper 本地 STT + 本地 LLM 润色 + MCP server + REST `/transcribe`、`/captures`。

**结论:不复用代码**(桌面 Rust,与我们 Next.js + Capacitor Web/移动栈不同栈,无法移植)。**借鉴其产品 skills / 架构模式**。

---

## 5. 借鉴清单(voicebox skill → 手抄落地)

| # | voicebox skill | 治哪个根因 | 手抄落地点 | 优先级 |
| --- | --- | --- | --- | --- |
| 1 | **流式:STT 出稿即回显,LLM 润色 SSE 追加** | 根因 1/2 | `transcribe/route.ts` 改 SSE;复用 BossAI stream 范式;`page.tsx` transcribing 阶段增量渲染 | **P0** |
| 2 | **push-to-talk / 录完自动转写**(去手动点一步) | 交互 | `page.tsx` `onstop` 直接进 `transcribe()`;或引入按住说话草稿 | **P0** |
| 3 | **Captures:原音频 + 稿一起留存,可重转/重润色** | 根因 4 | 转写落 `attachments` 存原音频 + 稿;新增"重转/重润色"入口 | P1 |
| 4 | **确定性去幻觉环**(剥离 "thanks for watching" 类 Whisper 循环) | 质量 | `route.ts` 在 `isLikelyFillerOnly` 旁加 loop-strip | P1 |
| 5 | **长音频自动分段并行转** | 根因 6 | 前端切片 or 服务端分段;>25MB 不再硬拒 | P1 |
| 6 | **润色 flag 快照**(去口水/去自我更正/保留术语),可重跑 | 可控性 | `voice-note.ts` + route 增加 flags 参数并持久化 | P2 |
| 7 | **Turbo/快模型跑实时** | 延迟 | STT 模型选型;`qwen3-asr-flash` 已偏快,评估更快档 | P2 |
| 8 | **MCP 工具 `shouchao.transcribe`** | 生态 | 挂到已建的 Tandem MCP server(commit `063b384`)对称 `voicebox.transcribe` | P2 |

---

## 6. 建议排期

- **一期(P0)**:流式回显 + 录完自动转写 —— 直接消灭"黑屏双串行等待",投入小、体感提升最大。
- **二期(P1)**:Captures 留存 + 去幻觉环 + 自动分段。
- **三期(P2)**:润色 flag 可重跑 + 模型选型 + MCP 暴露。

> 参考:voicebox docs — Dictation / Captures / Recording & Transcription(voicebox.sh/docs)。
