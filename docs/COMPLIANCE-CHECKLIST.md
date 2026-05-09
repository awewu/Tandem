# Compliance Checklist · 等保二级 / GDPR / PIPL

> Tandem (牛马搭子) GA 上线前必过清单

## 等保二级 (中国 GA 必备)

### 物理安全
- [ ] 服务器机房等保二级认证 (阿里云 / 腾讯云 / 华为云 已自带)
- [ ] 数据中心位于中国境内 (PIPL 要求)

### 网络安全
- [ ] WAF 接入 (云厂商提供)
- [ ] DDoS 防护
- [ ] VPC 隔离, 内网通信加密
- [ ] 端口最小化暴露 (仅 80/443)

### 主机安全
- [ ] OS 加固 (CentOS 8 / Ubuntu LTS)
- [ ] 定期漏洞扫描 (Trivy / Anchore)
- [ ] 入侵检测 (HIDS, 云主机自带)

### 应用安全
- [x] HTTPS 强制 (Let's Encrypt 自动续期)
- [x] CSRF token (Next.js Server Actions 自带)
- [ ] XSS 防护 (DOMPurify 处理用户输入)
- [ ] SQL 注入防护 (Prisma 参数化查询)
- [x] 审计日志链式 hash (`lib/audit/log.ts` 已实现)
- [ ] 敏感字段加密存储 (邮件凭据 / SSO token)
- [ ] 密码学合规: SM2/SM3/SM4 国密支持 (V2)

### 数据安全
- [x] 数据归公司, 离职后画像匿名化 (MANIFESTO 第十三条)
- [ ] 数据库备份 (每日 + 7 天保留)
- [ ] 敏感字段加密 (`encryptedBlobRef` 已设计)
- [ ] PII 脱敏导出 (员工 ORIGIN 导出时打码)
- [ ] 访问日志保留 6 个月以上

### 身份与访问
- [ ] SSO 接入 (钉钉 / 企微 / 飞书 OAuth) - `lib/auth/config.ts` 已设计
- [ ] RBAC 角色权限 (Steward / Admin / Manager / Employee)
- [ ] 关键操作二次确认 (Memory promotion / 数据导出)
- [ ] 会话超时 30 天 (`authConfig.session.maxAge`)

## GDPR / PIPL (跨境数据)

### 用户权利
- [ ] 数据导出权 (`POST /api/data/export-personal`) - `lib/audit/log.ts` 已审计
- [ ] 数据删除权 ("被遗忘权")
- [ ] 数据更正权 (用户可修改 Persona / 个人信息)
- [ ] 数据可携带权 (导出 JSON 标准格式)

### 同意管理
- [ ] 注册时明示同意条款 (Persona 数据归公司)
- [ ] 风格模仿 / 代参 opt-in (默认关闭)
- [ ] Cookie 同意横幅 (面向欧盟用户)

## 反 AI 欺诈 (MANIFESTO 第九条)

- [x] D 选项强制员工原创 (`humanOnly: true` 守门)
- [x] AI 代行水印 (`isProxy=true` 必标)
- [x] 24h 否决窗口 (员工撤回权)
- [x] 高敏内容拒绝代笔 (`SENSITIVE_KEYWORDS` 检测)
- [x] 红区议题强制退出代参 (`processTranscript` 守门)

## 应用市场上架 (各平台)

### 钉钉应用市场
- [ ] 企业认证
- [ ] 应用功能描述 + 截图 (5-8 张)
- [ ] 隐私政策 URL
- [ ] 用户协议 URL
- [ ] 安全测评 (钉钉提供工具)
- [ ] 提交审核 (周期 6-8 周)

### 企业微信应用市场
- [ ] ISV 认证
- [ ] 应用打包 + 上传
- [ ] 安全合规检查
- [ ] 提交审核 (周期 4-6 周)

### 飞书应用商店
- [ ] 开发者认证
- [ ] OpenSDK 接入
- [ ] 应用提交
- [ ] 审核 (周期 2-4 周)

## 商业化页面 + 销售物料

- [ ] 落地页 (`tandem.app` / `niu-ma.app`)
- [ ] 定价页面 (按席位 / 按用量)
- [ ] 客户案例 (3 个 logo)
- [ ] 视频 demo (3 分钟)
- [ ] 销售 FAQ
- [ ] 客户成功 SOP

## 法务

- [ ] 用户协议 (中英文)
- [ ] 隐私政策 (中英文, GDPR / PIPL 双合规)
- [ ] OSS 协议 review:
  - [ ] Cal.com (AGPL) - 需法务确认
  - [ ] MinIO (AGPL) - 需法务确认 / 替换 SeaweedFS
  - [ ] 其他 MIT/Apache 项目 OK
- [ ] DPA (Data Processing Agreement) 模板
- [ ] SLA 模板 (99.9% 可用性)
