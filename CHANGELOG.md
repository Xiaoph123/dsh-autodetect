# 更新日志

本项目遵循语义化版本号。所有版本变更均以中文记录。

## [0.2.0] - 2026-09-10

### 重要变更

- 编码检测、读取与写回逻辑从 Python 迁移至 TypeScript 和 Node.js，不再依赖 Python 或 `charset-normalizer`。
- 插件定位从脚本查看器升级为工作区文件预览与编辑器，后续将继续集成更多文件能力与工作区协作功能。

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
