# Hammer Team Guidelines

## 🔨 团队使用规范

本文档规定了团队在日常开发中如何使用 Hammer 验证体系。

---

## 1. 开发工作流

### 1.1 标准开发流程

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Coding    │───▶│  Local Test │───▶│   Commit    │───▶│    Push     │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │                  │                  │                  │
       │                  │                  │                  │
       ▼                  ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ npm run dev │    │ npm run     │    │ Hammer L1-L3│    │ Hammer L1-L9│
│ (开发)      │    │ hammer:fast │    │ (pre-commit)│    │ (pre-push)  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### 1.2 各阶段验证要求

| 阶段 | 触发条件 | 验证范围 | 门禁等级 | 失败处理 |
|------|----------|----------|----------|----------|
| 本地快速验证 | 手动执行 `npm run hammer:fast` | L1-L3 | G2 | 必须修复后提交 |
| 提交前验证 | `git commit` (pre-commit hook) | L1-L3 | G2 | 阻断提交 |
| 推送前验证 | `git push` (pre-push hook) | L1-L9 | G1 | 阻断推送 |
| CI验证 | PR/Push to main | L1-L9 | G0 | 阻断合并 |

---

## 2. 本地开发规范

### 2.1 提交前必须执行

```bash
# 1. 运行快速验证
npm run hammer:fast

# 2. 如果失败，修复问题后再次运行
npm run hammer:structure  # 仅检查结构和语法

# 3. 确保通过后提交
git commit -m "feat: xxx"
```

### 2.2 绕过机制 (仅紧急情况)

```bash
# 提交时绕过验证（不推荐）
git commit --no-verify -m "紧急修复"

# 推送时绕过验证（不推荐）
git push --no-verify
```

> ⚠️ **警告**: 绕过验证的提交会被标记，需要在24小时内补全验证。

### 2.3 验证失败处理流程

```
验证失败
    │
    ▼
┌─────────────────────────────────────────┐
│ 1. 查看错误信息                          │
│    node hammer.js --mode=fast           │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 2. 定位问题                              │
│    - 查看错误详情和修复建议                │
│    - 参考 HAMMER-METHODOLOGY.md          │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 3. 修复问题                              │
│    - 按优先级修复 (Critical > High)       │
│    - 本地验证通过后继续                    │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 4. 重新验证                              │
│    npm run hammer:fast                  │
└─────────────────────────────────────────┘
```

---

## 3. 质量门禁说明

### 3.1 门禁等级定义

| 等级 | 名称 | 触发条件 | 处理方式 |
|------|------|----------|----------|
| G0 | 💀 Critical | 安全漏洞/数据丢失 | 立即修复，禁止合并 |
| G1 | ❌ High | 核心功能失败/重大bug | 必须修复后合并 |
| G2 | ⚠️ Medium | 次要问题/性能下降 | 建议修复，可延期 |
| G3 | ℹ️ Low | 代码规范/优化建议 | 记录待办，不阻断 |
| G4 | ✅ Pass | 全部通过 | 正常合并 |

### 3.2 团队责任矩阵

| 角色 | G0 Critical | G1 High | G2 Medium | G3/G4 |
|------|-------------|---------|-----------|-------|
| 开发者 | 立即修复 | 优先修复 | 计划修复 | 通过 |
| Tech Lead | 审核方案 | 审核修复 | 跟踪进度 | - |
| 架构师 | 安全评估 | 架构审查 | 优化建议 | - |
| QA | 回归测试 | 功能测试 | 质量监控 | - |

---

## 4. CI/CD 集成

### 4.1 GitHub Actions 工作流

项目已配置 `.github/workflows/hammer-validation.yml`：

- **Push/PR 触发**: 自动运行完整验证
- **多阶段验证**: Fast → Full → Report
- **门禁控制**: G0/G1 阻断合并，G2 警告
- **PR 评论**: 自动生成验证报告评论

### 4.2 分支保护规则

```yaml
# 建议配置的分支保护规则
main 分支:
  - 需要 Hammer CI 通过
  - 需要 Code Review (1人)
  - 禁止强制推送
  - 禁止删除

develop 分支:
  - 需要 Hammer CI 通过 (G1以下)
  - 需要 Code Review (1人)
  - 允许合并提交
```

---

## 5. 报告与监控

### 5.1 报告位置

| 类型 | 位置 | 保留时间 |
|------|------|----------|
| 本地报告 | `./hammer-reports/` | 手动清理 |
| CI 报告 | Actions Artifacts | 30天 |
| 历史报告 | 团队共享存储 | 90天 |

### 5.2 关键指标监控

```bash
# 查看质量分数趋势
npm run hammer:report
# 然后查看 hammer-reports/hammer-report.json

# 关键指标:
# - Quality Score >= 85
# - Critical Issues = 0
# - High Issues < 3
# - Code Coverage >= 80%
```

---

## 6. 常见问题 (FAQ)

### Q1: 为什么提交被阻断了？

```bash
# 查看具体原因
cat .git/hooks/pre-commit.log 2>/dev/null || echo "查看上面错误信息"

# 重新运行验证
npm run hammer:fast
```

### Q2: 如何临时绕过验证？

```bash
# 仅限紧急修复
git commit --no-verify -m "HOTFIX: xxx"

# 但必须:
# 1. 在 PR 描述中说明原因
# 2. 创建跟进 Issue 补全验证
# 3. 24小时内修复根本问题
```

### Q3: 验证太慢怎么办？

```bash
# 仅验证特定层
npm run hammer:structure  # L1-L3
npm run hammer:runtime    # L4-L6
npm run hammer:system     # L7-L9

# 或禁用耗时验证器
node hammer.js --suites=L1,L2  # 仅最基础的两层
```

### Q4: 如何添加自定义验证？

```javascript
// 在 server/core/Hammer.js 中注册
this.registerValidator('L6_FUNCTIONAL', {
  id: 'F99',
  name: 'Custom Check',
  weight: 3,
  fn: async () => {
    // 自定义验证逻辑
    return {
      success: true/false,
      severity: 'INFO'/'MEDIUM'/'HIGH'/'CRITICAL',
      message: '描述',
      fix: '修复建议'
    };
  }
});
```

---

## 7. 最佳实践

### 7.1 提交信息规范

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

Type 类型：
- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档
- `style`: 格式（不影响代码运行的变动）
- `refactor`: 重构
- `test`: 测试
- `chore`: 构建过程或辅助工具的变动

### 7.2 代码审查清单

- [ ] Hammer 验证通过 (G2以上)
- [ ] 代码符合项目规范
- [ ] 有适当的测试覆盖
- [ ] 文档已更新
- [ ] 无安全隐患

### 7.3 性能优化建议

```bash
# 增量验证（仅检查变更文件）
node hammer.js --incremental

# 并行验证（更快但资源占用高）
node hammer.js --parallel

# 缓存结果（跳过已通过的验证）
node hammer.js --cache
```

---

## 8. 联系方式

- **技术支持**: #hammer-support (Slack)
- **问题反馈**: [GitHub Issues](../../issues)
- **文档更新**: [PR to docs/](../../pulls)

---

**最后更新**: 2026-04-19  
**版本**: 1.0.0  
**维护**: Rysnova Engineering Team
