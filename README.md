# NJU LMS Scraper

使用 Python 获取南京大学 LMS 学习活动中的文档附件。首次手动登录后，在本地保存登录状态，后续通过 HTTP 下载实际文件，并校验文件长度、PDF 文件头和 SHA-256。

目前支持课程 `11611` 的 `learning-activity#/活动编号` 链接。已实测活动 `44877`，成功获取 9,473,066 字节、77 页的原始 PDF。

## 功能

- 在独立浏览器中手动完成统一身份认证、扫码或验证码，不在代码中保存密码。
- 保存本站 Cookie、localStorage 和 IndexedDB，不读取日常浏览器配置，不保存统一身份认证站点的 Cookie。
- 获取文档附件原始字节，输出 HTTP 校验报告。
- 可选导出网页 HTML、正文、链接、元信息和截图。
- 登录状态、课程文件及虚拟环境默认不进入 Git。

## 安装

需要 Python 3.10+，能访问南大 LMS，以及有权访问对应课程的账号。以下命令使用 Windows PowerShell：

```powershell
git clone https://github.com/zoinve/nju-lms-scraper.git
cd nju-lms-scraper
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

如果已经安装 Microsoft Edge，可直接使用下面的 `--channel msedge`。若使用默认 Chromium，先安装浏览器：

```powershell
.\.venv\Scripts\python.exe -m playwright install chromium
```

## 快速开始

### 1. 登录

```powershell
.\.venv\Scripts\python.exe lms.py login --channel msedge --auto-save
```

在打开的独立浏览器中完成登录。程序检测到返回课程页且存在本站 Cookie 后，将状态保存至 `.auth/state.json`，最多等待 10 分钟。不加 `--auto-save` 时，在课程内容显示后回到终端按 Enter 保存。登录过期时重新运行此命令。

### 2. 下载实际文件

```powershell
.\.venv\Scripts\python.exe lms.py download --url "https://lms.nju.edu.cn/course/11611/learning-activity#/44877"
```

保留 URL 中的 `#/活动编号`，获取同一课程其他活动时替换编号即可。省略 `--url` 时默认活动为 `44877`。此命令仅发起 HTTP 请求，不启动浏览器。

```text
data/
└── 44877/
    ├── AI驱动的集成电路制造技术-7-光刻工艺.pdf
    └── http-analysis.json
```

相同文件重复下载时写入同一位置；如果已有同名文件且内容不同，则以附件编号作为文件名前缀。

### 3. 可选：导出网页

```powershell
.\.venv\Scripts\python.exe lms.py scrape --channel msedge --headless --wait 8 --url "https://lms.nju.edu.cn/course/11611/learning-activity#/44877"
```

结果写入 `data/时间戳/`：`page.html`、`text.txt`、`links.json`、`metadata.json` 和 `page.png`。正文仅包含网页可见文本，不包含 iframe 内的文档正文；实际附件请用 `download`。

## HTTP 流程与校验

1. 加载 `.auth/state.json`，建立带登录状态的请求上下文。
2. 请求 `/api/activities/{activity_id}`，核对课程编号，读取附件和引用编号。
3. 请求 `/api/uploads/reference/document/{reference_id}/url`，携带 `preview=true`、`refer_type=learning_activity` 和活动编号，取得文件地址。无引用编号时使用对应的文档接口。
4. 请求接口返回的 HTTPS 文件地址，获取实际字节。
5. 校验 HTTP 成功状态、是否返回 HTML、长度是否与附件元数据一致。PDF 额外检查 `%PDF-` 文件头。
6. 校验通过后保存原文件，计算 SHA-256，写入 `http-analysis.json`。

报告记录活动信息、附件编号、HTTP 状态、内容类型、预期和实际大小、保存文件名及 SHA-256，不记录 Cookie 或临时签名地址。附件失败会记录错误类型，命令以非零状态退出；已成功附件会保留。

当前实现使用前端文档阅读流程提供的文件地址，不修改服务器上的附件设置。接口拒绝访问时停止该附件的获取，不将错误 HTML 保存为 PDF。

## 参数

运行 `python lms.py --help` 查看帮助。

| 参数 | 说明 |
| --- | --- |
| `login` | 打开浏览器并保存登录状态 |
| `download` | 通过 HTTP 获取活动文档附件 |
| `scrape` | 导出活动网页 |
| `--url URL` | 完整活动链接，默认活动 44877 |
| `--channel` | `chromium`（默认）、`chrome`、`msedge`；用于 login、scrape |
| `--auto-save` | login 返回课程页后自动保存状态 |
| `--headless` | scrape 隐藏浏览器窗口 |
| `--wait 秒数` | scrape 额外渲染等待，默认 5 秒 |
| `--selector CSS` | scrape 等待指定内容元素可见 |
| `--timeout 秒数` | 浏览器导航和元素等待超时，默认 60 秒 |

HTTP 元数据接口超时为 60 秒，文件请求超时为 120 秒，与浏览器的 `--timeout` 分开设置。

## 常见问题

**没有登录状态或登录已过期：** 重新运行 `login --channel msedge --auto-save`。

**找不到 Chromium：** 安装 Chromium，或使用已安装的 `--channel msedge` / `--channel chrome`。

**附件获取失败：** 检查 `data/活动编号/http-analysis.json`，确认活动属于课程 11611、账号能正常阅读附件。重新登录后重试；网络问题、接口变更、文档转换未完成或权限限制均可能导致失败。

**网页导出不完整：** 增加 `--wait` 或指定 `--selector`。当前不会自动展开活动列表、翻页或读取 iframe 正文。

## 本地数据与限制

`.auth/state.json` 是明文登录凭证，请勿分享或提交。`.auth/`、`data/`、`.venv/` 和 Python 缓存已加入 `.gitignore`。删除状态文件可清除本程序保存的状态，但不会使已经复制出去的凭证自动失效。

目前仅适配课程 11611 的文档附件，不包含视频下载、课程批量遍历、定时任务、PDF 正文提取或自动重新登录。网站依赖 sessionStorage、设备绑定或更改接口时可能需要适配。自动登录检测使用 URL、密码框和 Cookie，不能识别所有异常，以实际附件请求结果为准。

仅使用本人有权访问的账号和课程内容。本仓库只包含程序与说明，不包含登录状态或课程文件。

参考：[Playwright 身份验证文档](https://playwright.dev/python/docs/auth)。
