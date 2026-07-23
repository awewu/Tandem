# Hammer Setup Guide

## 快速安装指南

### 1. 一键安装 (Windows)

```batch
:: 安装 Git Hooks
.husky\install.bat

:: 验证安装
npm run hammer:fast
```

### 2. 手动安装

```bash
# 复制 hooks
copy .husky\pre-commit .git\hooks\pre-commit
copy .husky\pre-push .git\hooks\pre-push

# 赋予执行权限 (Linux/Mac)
chmod +x .git/hooks/pre-commit
chmod +x .git/hooks/pre-push
```

### 3. 验证安装

```bash
# 运行快速验证
npm run hammer:fast

# 预期输出:
# 🔨 Hammer is striking...
# ✅ Quality Gate: Gate 4: Pass
```

---

## CI/CD 配置

### GitHub Actions

已自动配置: `.github/workflows/hammer-validation.yml`

### GitLab CI

```yaml
# .gitlab-ci.yml
stages:
  - validate

hammer:validate:
  stage: validate
  image: node:18
  script:
    - npm ci
    - npm run hammer:ci
  artifacts:
    paths:
      - reports/
    expire_in: 1 week
  only:
    - merge_requests
    - main
```

---

## 环境要求

- Node.js >= 16
- npm >= 8
- Git >= 2.30

---

## 故障排除

### Hook 未触发

```bash
# 检查 hook 是否存在
ls -la .git/hooks/pre-commit

# 检查文件权限 (Linux/Mac)
chmod +x .git/hooks/pre-commit
```

### 验证太慢

```bash
# 使用快速模式
npm run hammer:fast

# 或指定特定层
npm run hammer:structure
```

---

**文档版本**: 1.0.0
