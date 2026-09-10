# AutoDetect

AutoDetect 是一个面向 DeepSeek Harness Web 的 Windows 文本文件查看与编辑插件。

它可以在工作区中直接查看和编辑以下文件，并尽量保留文件原有的编码、BOM 和换行格式：

- `.bat`
- `.cmd`
- `.ini`
- `.vbs`
- `.ps1`

插件名称为 **AutoDetect**，npm/DSH 包名为 `dsh-autodetect`。

## 功能特性

- 使用 `charset_normalizer` 检测文件编码
- 支持 UTF-8、UTF-16、UTF-32、GBK、GB18030、CP1252、Shift-JIS 等常见编码
- 自动识别 BOM 和换行格式（LF、CRLF、CR）
- 二进制文件自动识别并禁止编辑
- 保存前校验文件 SHA-256，避免覆盖外部修改
- 保存前创建 `.autodetect.bak` 备份文件
- 使用临时文件和原子替换写入，降低写入中断导致文件损坏的风险
- 限制文件只能访问当前会话工作区，拒绝越权路径
- 支持通过 `AUTODETECT_PYTHON` 指定 Python 解释器

## 环境要求

- DeepSeek Harness Web
- Node.js
- Python 3.10 或更高版本
- Python 依赖：`charset-normalizer >= 3.4, < 4`

## 安装

### 1. 安装 Python 依赖

请使用 DeepSeek Harness 实际运行时会调用的 Python 解释器安装依赖：

```powershell
python -m pip install -r requirements.txt
```

如果系统中有多个 Python，可以显式指定解释器：

```powershell
C:\Path\To\python.exe -m pip install -r requirements.txt
```

也可以通过环境变量指定解释器：

```powershell
$env:AUTODETECT_PYTHON = 'C:\Path\To\python.exe'
```

验证依赖是否可用：

```powershell
python -c "import charset_normalizer; print(charset_normalizer.__version__)"
```

### 2. 安装插件

在插件目录的上级目录执行本地安装命令：

```powershell
dsh plugin --profile web install .\AutoDetect --replace --yes
```

如果希望直接使用当前目录进行开发调试，可以使用链接安装：

```powershell
dsh plugin --profile web install .\AutoDetect --link --replace --yes
```

安装或更新插件后，请重启 DeepSeek Harness Web，使插件重新加载。

## 使用方法

1. 启动 DeepSeek Harness Web。
2. 打开一个 `.bat`、`.cmd`、`.ini`、`.vbs` 或 `.ps1` 文件。
3. AutoDetect 会自动检测编码并显示文件内容。
4. 修改内容后，使用工具栏中的保存操作写回文件。

保存时会沿用读取时记录的编码、BOM 和换行格式。文件被其他程序修改后，保存会被拒绝，需要重新加载文件。

## 项目结构

```text
AutoDetect/
├─ lib/
│  ├─ index.js             # Web Server 路由和 Python Helper 调用
│  └─ client.js             # Harness 官方 Sidebar 文件标签页界面
├─ python/
│  └─ autodetect_codec.py   # 编码检测、读取和写入
├─ tests/
│  └─ test_codec.py         # 编码与文件写入测试
├─ cordis.patch.yml         # DSH Web 插件挂载配置
├─ package.json
├─ requirements.txt
└─ README.md
```

## 开发与测试

运行 Python 测试：

```powershell
python -m unittest discover -s tests
```

检查 Python 语法：

```powershell
python -m py_compile python\autodetect_codec.py
```

检查 Node.js 语法：

```powershell
node --check lib\index.js
```

## 工作原理

Node.js 后端为插件注册两个内部接口：

- `GET /autodetect/api/read`
- `POST /autodetect/api/write`

接口接收会话工作区和相对路径，由 Python Helper 读取原始字节并完成编码检测。写入时，Node.js 先校验当前文件的 SHA-256，然后创建备份，最后由 Python Helper 按原编码和换行格式原子写回。

## 注意事项

- `charset-normalizer` 是必需依赖，不建议删除或替换。
- Python 依赖必须安装到插件实际使用的解释器中。
- 插件只允许访问当前会话工作区内的文件。
- 二进制文件不会被当作文本编辑。
- `.autodetect.bak` 是保存时生成的备份文件，请根据需要纳入或排除版本控制。

## 许可证

本项目的许可证以仓库根目录中的许可证文件为准。
