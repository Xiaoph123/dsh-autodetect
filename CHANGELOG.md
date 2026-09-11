# 更新日志

本项目遵循语义化版本号。所有版本变更均以中文记录。

## [0.2.1] - 2026-09-11

### 修复与发布

- 将当前 TypeScript 修复版作为 npm 与 GitHub 的 `0.2.1` 正式发布。
- 修复 Harness Web 中选区“添加到对话”按钮缺少 `conversation` 与 `sessions` 注入的问题。
- 保持 npm 发布包不包含 `docs` 文件夹。

## [0.2.0] - 2026-09-10

### 重要变更

- 编码检测、读取与写回逻辑从 Python 迁移至 TypeScript 和 Node.js，不再依赖 Python 或 `charset-normalizer`。
- 插件定位从脚本查看器升级为工作区文件预览与编辑器，后续将继续集成更多文件能力与工作区协作功能。
- 修复选中文本点击“添加到对话”无响应的问题，改用官方 conversation/session 注入接口将内容写入当前对话草稿。
- 改进“添加到对话”按钮事件处理：在指针按下阶段提交，避免浏览器 selectionchange 先卸载按钮导致点击事件丢失。
- 按照官方 conversation 插件契约，通过 `ctx.sessions.scope(...)` 和 `conversation.input.for(...)` 写入当前会话草稿。

### 新增

- 支持检测并保留 UTF-8、UTF-16、UTF-32、GBK、GB18030、CP1252、Shift-JIS 等文本编码。
- 支持保留 BOM、LF、CRLF 和 CR 换行格式。
- 保存前执行 SHA-256 并发校验；通过临时文件原子替换写回，并生成 `.autodetect.bak` 备份。
- 在 DeepSeek Harness Web 官方右侧文件标签页中提供文件预览与编辑能力。

### 兼容性

- 仅适用于 DeepSeek Harness Web 官方侧边栏扩展接口。
- 不适配第三方侧边栏、浏览器扩展、桌面客户端或其他非 Harness Web 宿主。

## [0.1.0] - 2026-09-10

### 首次发布

- 初始 Python 实现，提供 DeepSeek Harness Web 官方侧边栏中的 Windows 文本文件编码安全预览与编辑能力。
