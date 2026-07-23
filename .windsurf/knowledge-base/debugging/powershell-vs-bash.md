# PowerShell vs Bash 命令差异学习

## 问题场景
跨平台命令兼容性

## 核心差异

| 场景 | Bash | PowerShell |
|------|------|------------|
| 命令连接 | `&&` | `;` |
| 后台运行 | `&` | `Start-Process` |
| 输出重定向 | `2>&1` | `2>&1` (兼容) |
| 管道 | `\|` | `\|` |
| 空设备 | `/dev/null` | `$null` |
| 注释 | `#` | `#` |

## 常见错误

### 错误1: 使用 && 连接命令
```powershell
# ❌ 错误
command1 && command2

# ✅ 正确
command1; command2
```

### 错误2: 使用 & 后台运行
```powershell
# ❌ 错误
command &

# ✅ 正确
Start-Process command
```

### 错误3: 重定向到 nul
```powershell
# ❌ 错误
command 2>nul

# ✅ 正确
command 2>$null
# 或使用 -ErrorAction SilentlyContinue
```

## 最佳实践

1. **检测 Shell 类型**:
   ```powershell
   if ($PSVersionTable) { # PowerShell }
   ```

2. **编写兼容命令**:
   ```powershell
   # PowerShell 专用语法
   $env:VAR = "value"
   ```

3. **错误处理**:
   ```powershell
   try { command } catch { handle }
   ```

## 本次教训

在 Windows 环境使用 PowerShell 时:
- 不使用 Bash 语法
- 使用 PowerShell 原生语法
- 测试命令在目标环境中执行
