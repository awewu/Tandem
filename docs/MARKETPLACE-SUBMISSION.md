# Marketplace Submission · 应用市场上架指南

> 三大平台 (钉钉 / 企微 / 飞书) 上架流程

## 通用准备物料

### 应用信息
```yaml
应用名称: 牛马搭子 (Tandem)
副标题: 让 17 分钟达成共识的 AI 协作伙伴
分类: 协作 / OKR 管理 / AI 工具
费用模型: 免费试用 14 天 + 按席位订阅 (¥99 / 人 / 月)
```

### 核心价值主张
1. **17 分钟决议室**: 用 3+1 框架, 杜绝无效会议
2. **拿捏老板分身**: AI 学习老板风格, 替老板做事 (5 阶段进化)
3. **9 宫格人才矩阵**: KPI × TTI 双轨评估
4. **议事文化沉淀**: Material → Memory 三方签批, 知识资产化

### 应用截图 (8 张, 1920×1080)
1. 议事室主界面 (5 步流程 + 17min 计时)
2. 3+1 选项卡片 (含 D 选项原创占位)
3. 决议卡详情 (Action items + 24h 否决)
4. 9 宫格人才矩阵
5. 拿捏老板 dashboard (5 阶段)
6. Steward 工作台 (Memory 签批)
7. OKR 看板 (KR + TTI 双轨)
8. 数据归属说明页

### 视频 Demo (3 分钟)
- 0-30s: 痛点 (无效会议 + AI 焦虑)
- 30-90s: 议事室演示 (从问题到决议 17min)
- 90-150s: 拿捏老板分身 + 安全机制
- 150-180s: 数据归属 + 客户保障

## 钉钉应用市场

### 入口
https://op.dingtalk.com/

### 步骤
1. 企业开发者认证 (营业执照 + 法人扫脸)
2. 创建应用 (类型: 第三方企业应用)
3. 配 OAuth 回调: `https://yourdomain.com/api/auth/callback/dingtalk`
4. 申请权限 (按需):
   - 通讯录读取 (用于组织架构同步)
   - 工作通知发送
   - 日程读写
   - 用户身份信息
5. 安全自检 (钉钉提供工具)
6. 提交审核 (6-8 周)

### 关键点
- ISV 协议: 必读, 注意会话管理 / 数据安全条款
- 应用市场分成: 钉钉 30%, 自有 70% (V2 单独定价可申请豁免)

## 企业微信应用市场

### 入口
https://open.work.weixin.qq.com/wwopen/devtool/serviceProvider

### 步骤
1. ISV 认证 (年费 ¥300)
2. 创建第三方应用模板
3. 配 OAuth + 网页授权:
   - Authorization URL: `https://open.work.weixin.qq.com/wwopen/sso/qrConnect`
   - Callback: `https://yourdomain.com/api/auth/callback/wecom`
4. 配置消息推送 / Webhook
5. 提交安全合规自查
6. 提交审核 (4-6 周)

### 关键点
- 企微对国央企客户友好, 是首选战场
- 上架后可申请"企微生态合作伙伴"标签 (V2)

## 飞书应用商店

### 入口
https://open.feishu.cn/

### 步骤
1. 开发者认证 (个人 / 企业均可)
2. 创建企业自建应用 → 转换为商店应用
3. 配 OAuth:
   - Authorize: `https://open.feishu.cn/open-apis/authen/v1/index`
   - Callback: `https://yourdomain.com/api/auth/callback/feishu`
4. 申请能力 (Capabilities):
   - 通讯录 (contact:user.read)
   - 日历 (calendar:event.write)
   - 消息 (im:message)
5. 提交审核 (2-4 周, 飞书最快)

### 关键点
- 飞书对中小型互联网公司友好
- "飞书 OpenAI" 大力推 AI 应用, Tandem 是天然契合

## 上架后运营

### 关键指标
- 首次激活率 (装后 7 日内创建议事室)
- 议事室周活
- D 选项使用率 (反 AI 欺诈核心指标)
- Memory 转化率 (Material → Memory 比例)
- 否决率 (越低 = 拿捏度越高)

### 用户反馈渠道
- 钉钉 / 企微 / 飞书 内置评分
- 应用内反馈 (`/feedback` 路由)
- 邮件: `support@tandem.app`
- 周会客户访谈 (M3 启动)
