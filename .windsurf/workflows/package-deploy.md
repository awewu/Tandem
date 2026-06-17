---
description: 打包 Tandem 生产部署包 (standalone build → tandem-deploy.zip)
---

# 打包部署包 (package-deploy)

把当前代码打成可上传的生产部署 zip。底层调用仓库根目录的 `package-deploy.ps1`，
它会依次：停掉本仓库的 Next 进程 → 跑 standalone 生产构建 → 组装 `standalone + .next/static + public + drizzle` → 压成 `../tandem-deploy.zip` 并校验内容。

## 前置说明

- 必须在仓库根目录 `c:\projects\tandem\Tandem` 下执行（用 `Cwd` 指定，不要 `cd`）。
- 构建用的是 `package-deploy.ps1` 内置的 build-only 占位环境变量（`NEXTAUTH_SECRET` / `DEEPSEEK_API_KEY=build-placeholder` / `SKIP_STARTUP_GUARD=1` 等），**不读 `.env.local`，不联外网**，所以不会因 Google Fonts / LLM key 缺失而 fail build。
- 字体等静态资源会自动随 `.next/static` 打入产物，无需额外步骤。
- 构建较久（数分钟），用非阻塞方式跑并轮询 `command_status` 直到出现 `Done.`。

## 步骤

1. 确认仓库根存在 `package-deploy.ps1`（若缺失则停止并告知用户）。

2. 运行打包脚本（**非阻塞**，`Cwd=c:\projects\tandem\Tandem`）：

```
powershell -ExecutionPolicy Bypass -File package-deploy.ps1
```

   - 该步骤会停掉正在运行的本仓库 dev server（脚本内部 `Stop-Process`），属预期行为。
   - 用 `command_status` 轮询，直到输出里出现 `Done.` 与 `Package: ... tandem-deploy.zip`。
   - 若中途 `next build failed` 或 `Zip verification failed`，把报错原文回报用户，**不要**重试遮盖错误。

3. 构建成功后，从输出中提取并回报给用户：
   - 产物路径：`C:\projects\tandem\tandem-deploy.zip`
   - 体积（bytes）
   - `SHA256`

4. （可选，仅在用户要求时）把产物复制到更新目录：

```
Copy-Item "C:\projects\tandem\tandem-deploy.zip" "E:\tandem-deploy\update\tandem-deploy.zip" -Force
```

   随后提示用户运行更新脚本：`E:\tandem-deploy\update\更新脚本-本次打包版.ps1`。

## 常见参数

- 跳过构建、仅用现有 `.next` 重新打包：`powershell -ExecutionPolicy Bypass -File package-deploy.ps1 -SkipBuild`
- 自定义输出位置：`... package-deploy.ps1 -OutputZip "D:\out\tandem-deploy.zip"`

## 注意

- 终端里出现的 `鏇存柊鑴氭湰...` 是中文文件名「更新脚本-本次打包版.ps1」的编码显示问题，文件本身正常。
- `package-deploy.ps1` 是唯一 SSOT；不要在本工作流里复制构建逻辑，始终调用脚本。
