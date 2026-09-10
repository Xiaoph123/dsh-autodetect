# AutoDetect

<p align="center">
  <strong>DeepSeek Harness Web 官方侧边栏的 Windows 编码安全文件预览与编辑器</strong><br>
  <sub>在官方文件标签页中预览和编辑工作区文件，同时保留原始编码、BOM 与换行格式。</sub>
</p>

<p align="center">
  <a href="https://github.com/Xiaoph123/dsh-autodetect"><img src="https://img.shields.io/badge/DeepSeek-Harness%20Web-4b6bfb" alt="DeepSeek Harness Web"></a>
  <a href="https://www.npmjs.com/package/dsh-autodetect"><img src="https://img.shields.io/npm/v/dsh-autodetect" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/dsh-autodetect"><img src="https://img.shields.io/npm/dm/dsh-autodetect" alt="npm downloads"></a>
  <a href="https://github.com/Xiaoph123/dsh-autodetect/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT license"></a>
</p>

> [!IMPORTANT]
> **适配边界**：本项目是 **DeepSeek Harness Web 官方侧边栏插件**，使用 DSH 官方 `client-runtime`、`client-ui-slots` 和 `client-ui-sidebar-right` 扩展接口。它**不适配第三方 DeepSeek 侧边栏、浏览器扩展、桌面客户端或其他非 Harness Web 宿主**。

## 为什么需要 AutoDetect？

AutoDetect 是面向 DeepSeek Harness Web 官方侧边栏的文件预览与编辑器。它目前优先解决 Windows 工具链中文件编码、BOM 与换行格式容易损坏的问题，让工作区文件可以在官方右侧文件标签页中安全预览、编辑并按原格式写回。

当前重点覆盖 `.bat`、`.cmd`、`.ini`、`.vbs` 和 `.ps1` 等常见文本文件；后续会在此基础上集成更多文件能力与工作区协作功能。

## 功能

| 能力 | 说明 |
| --- | --- |
| 编码检测 | UTF-8、UTF-16、UTF-32、GBK、GB18030、CP1252、Shift-JIS 等 |
| 格式保留 | 识别并保留 BOM 与 LF、CRLF、CR 换行 |
| 文件保护 | 二进制文件禁止编辑；路径限制在当前会话工作区 |
| 并发保护 | 保存前校验 SHA-256，检测磁盘外部修改 |
| 可靠写入 | 保存前生成 `.autodetect.bak`，使用临时文件和原子替换 |
| 对话协作 | 选中文本后可添加到当前 Harness 对话 |

## 安装

### 推荐：通过 npm 包安装

当前 TypeScript 版本 `0.2.0` 已发布到 [npm](https://www.npmjs.com/package/dsh-autodetect)。它不再需要 Python；完整版本记录请见 [更新日志](CHANGELOG.md)。先确认已安装 Node.js 和 DeepSeek Harness Web，然后推荐直接执行这一条命令：

```powershell
dsh plugin --profile web add dsh-autodetect
```

`dsh` 会从 npm 获取 `dsh-autodetect`，并把它注册到 **Harness Web 官方侧边栏**。安装或更新后重启 Harness Web。

如果你的 `dsh` 版本不支持从 npm 包名解析，可以先下载包再使用本地目录：

```powershell
npm install dsh-autodetect
dsh plugin --profile web add .\node_modules\dsh-autodetect
```

### 开发链接安装

```powershell
git clone https://github.com/Xiaoph123/dsh-autodetect.git
cd dsh-autodetect
dsh plugin --profile web add .
```

## 使用

1. 启动 DeepSeek Harness Web。
2. 在工作区打开 `.bat`、`.cmd`、`.ini`、`.vbs` 或 `.ps1` 文件。
3. AutoDetect 会在官方右侧文件标签页中检测编码并显示内容。
4. 修改后使用宿主工具栏或插件的保存按钮写回文件。

保存会沿用读取时的编码、BOM 和换行格式。如果文件在编辑期间被其他程序修改，保存会被拒绝，请重新加载后再操作。

## 工作原理

插件由两个部分组成：

- **Node.js Host**：注册 `/autodetect/api/read` 和 `/autodetect/api/write`，执行会话工作区校验、SHA-256 并发检查和备份。
- **TypeScript Codec**：使用 Node.js Buffer 和 `iconv-lite` 读取原始字节，检测编码、BOM 和换行格式，并按元数据原子写回。

客户端通过 Harness 官方 Sidebar slots 注册文件标签页，只匹配 `dsh-resource://file/**` 下的目标扩展名。

## 项目结构

```text
dsh-autodetect/
├─ src/
│  ├─ host/                 # Node.js Host 路由与会话工作区校验
│  ├─ codec/                # TypeScript 编码检测、读取和写入
│  └─ client/               # Harness 官方 Sidebar 文件标签页
├─ lib/                     # 构建后的 JavaScript 文件
├─ tests/
│  ├─ codec.test.mjs       # 编码与文件写入测试
│  └─ test_package.mjs     # npm 元数据和 README 回归测试
├─ cordis.patch.yml        # DSH Web 插件挂载配置
├─ package.json
├─ tsconfig.json
└─ README.md
```

## 开发与测试

```powershell
npm test
npm run pack:check
node --check lib\index.js
```

`npm run pack:check` 会检查最终 npm 包内容，不会把 `node_modules`、源代码、测试、缓存或备份文件打进去。

## 维护者发布

维护者登录 npm 后执行：

```powershell
npm login
npm publish --access public
```

当前公开包地址：<https://www.npmjs.com/package/dsh-autodetect>

发布新版本前先更新 `package.json` 中的版本号，并运行：

```powershell
npm version patch
npm run pack:check
npm publish --access public
```

## 常见问题

### 安装后看不到文件标签页

确认宿主是 **DeepSeek Harness Web**，插件安装目标是 `--profile web`，并重启 Harness Web。第三方侧边栏不在支持范围内。

### 保存时报文件已被修改

这是 SHA-256 并发保护触发。重新打开文件、确认内容后再保存，避免覆盖其他程序的修改。

### 旧版本为什么需要 Python？

`0.1.x` 是历史 Python 版本；从 `0.2.0` 开始，编码检测和文件写回已经迁移到 TypeScript/Node.js，不再需要 Python 或 `charset-normalizer`。

## 许可证

[MIT License](LICENSE)

## 反馈与贡献

欢迎通过 [GitHub Issues](https://github.com/Xiaoph123/dsh-autodetect/issues) 提交问题。反馈时请注明 Harness Web 版本、Node.js 版本，以及是否使用了官方侧边栏宿主。
