# NJU LMS Scraper

南京大学 LMS 文档附件获取工具，提供 **Chromium 浏览器扩展**和 **Python 命令行程序**两种使用方式。

项目原创代码与文档采用 [0BSD（零条款 BSD）协议](LICENSE)，允许商用、修改、闭源集成和再分发，不要求保留署名或许可文本；第三方依赖、课件、商标和其他第三方内容不因此获得授权。免责声明不为 0BSD 添加额外许可条件。

> **使用前请阅读 [免责声明与使用边界](DISCLAIMER.md)。** 能登录、能预览或接口返回文件，不等于获得下载、复制或传播授权。仅在具有相应权利依据、符合学校及课程要求的范围内使用。项目不包含课件、账号信息或私钥，与南京大学、LMS 服务商及浏览器厂商不存在官方隶属或背书关系。

## 选择使用方式

| | Chromium 扩展 | Python 程序 |
| --- | --- | --- |
| 使用入口 | 打开活动页面，点击扩展图标 | 运行命令 |
| 登录状态 | 复用当前浏览器会话，不导出 Cookie | 手动登录后将本站状态保存到本地 |
| 保存附件 | 浏览器下载管理器 | HTTP 请求保存文件 |
| 文件校验 | 下载状态由浏览器展示 | HTTP 状态、文件大小、PDF 文件头、SHA-256 |
| HTTP 报告 | 不生成 | `http-analysis.json` |
| 适配范围 | 数字课程编号的文档活动，已验证课程 11611 | 当前限定课程 11611 的文档活动 |

两种方式均不支持视频下载或自动处理验证码。扩展可在当前课程的课件列表页分页读取可见附件并多选下载；Python 程序仍按活动链接逐个运行。扩展不需要 Python。

## 获取源码

```powershell
git clone https://github.com/zoinve/nju-lms-scraper.git
cd nju-lms-scraper
```

## 浏览器扩展

### 安装和使用

1. Chrome 打开 `chrome://extensions`；Edge 打开 `edge://extensions`。
2. 开启「开发者模式」，点击「加载已解压的扩展程序」。
3. 选择仓库内的 `chromium-extension` 目录，即包含 `manifest.json` 的文件夹。
4. 在同一浏览器中正常登录 LMS，刷新已经打开的活动页面。
5. 打开类似 `https://lms.nju.edu.cn/course/11611/learning-activity#/44877` 的具体活动地址，页面左下角会出现紫色圆形 SVG 下载按钮。点击后在按钮上方展开小弹窗，再选择附件下载；也可继续使用工具栏扩展图标。

悬浮按钮仅在数字课程编号及活动编号匹配时显示，随页面片段切换出现或隐藏。小弹窗直接位于当前网页左下角，不创建新的扩展标签页；可点击关闭按钮、点击外部或按 Esc 收起。切换活动后自动关闭旧列表，再次展开时读取当前活动。主题色按 `C50 M100 Y0 K40` 近似转换为屏幕色 `#4D0099`。更新扩展后请刷新 LMS 页面。

文件交给浏览器下载管理器，默认位于下载目录的 `NJU-LMS/活动编号/` 下。同名文件由浏览器增加编号。关闭弹窗不会取消已启动的下载；完成或中断状态以浏览器下载列表为准。

### CRX 签名与安装限制

扩展源码采用 Manifest V3，可由 Chromium 浏览器打包为 CRX3。开发者密钥签名用于校验包完整性并确定扩展 ID，**不表示通过 Chrome 商店审核、厂商认证或安全审计**。

Windows/macOS 上的 Chrome 对商店外 CRX 安装有限制。个人开发使用建议按上面的方式加载源码；面向普通用户分发应走商店发布等浏览器支持的渠道。不要为安装扩展而关闭安全防护或修改组织管理策略。参考 [Chrome 官方分发说明](https://developer.chrome.com/docs/extensions/how-to/distribute?hl=en)。

本仓库提交源码，不提交本地 CRX、Cookie 或签名私钥。重新打包及密钥管理见 [扩展说明](chromium-extension/README.md)。

### 课件列表页多选下载（1.3.0）

打开 `https://lms.nju.edu.cn/course/11611/courseware#/`，点击左下角紫色下载按钮，在原网页的小弹窗中勾选文件，再点击「下载所选」。支持全选、取消全选、选择数量、每项状态和「停止排队」。无需逐个打开活动页面，不创建新标签页。

列表来自当前账号可访问的课件接口，自动读取分页并去重，不猜测其他活动编号。文档地址依次获取、间隔启动浏览器下载；文件传输仍由浏览器管理，可能并行进行。成功启动项取消勾选，失败项保留勾选，可再次点击重试。界面中的「已启动」不等于文件下载完成，仍需检查浏览器下载列表。

关闭弹窗不会停止当前队列；「停止排队」只阻止后续任务，当前请求及已启动的下载可能继续。刷新、关闭或离开原课件页面会结束未启动的队列；重新打开后需重新选择。当前选择及队列不持久化。浏览器可能按自身策略限制多文件下载或询问保存位置。

## Python 程序

需要 Python 3.10+，以下示例使用 Windows PowerShell：

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

若已安装 Edge，使用 `--channel msedge` 即可。若使用默认 Chromium，先运行：

```powershell
.\.venv\Scripts\python.exe -m playwright install chromium
```

### 登录

```powershell
.\.venv\Scripts\python.exe lms.py login --channel msedge --auto-save
```

在独立浏览器中自行完成统一身份认证、扫码和验证码。返回课程页并检测到本站 Cookie 后，状态写入 `.auth/state.json`，最多等待 10 分钟。不加 `--auto-save` 时，在课程内容显示后回终端按 Enter 保存。过期后重新登录。

状态文件以明文保存本站 Cookie、localStorage 和 IndexedDB；不保存统一身份认证站点的 Cookie，不读取日常浏览器配置，也不在代码中保存密码。状态文件仍属于敏感凭证，必须妥善保管。

### 下载文档附件

```powershell
.\.venv\Scripts\python.exe lms.py download --url "https://lms.nju.edu.cn/course/11611/learning-activity#/44877"
```

保留 `#/活动编号`，获取同一课程其他活动时替换编号。省略 `--url` 默认活动为 `44877`。此命令只发起 HTTP 请求，不启动浏览器。成功文件和报告写入 `data/44877/`。

已验证示例为 9,473,066 字节、77 页的 PDF；这只是一次兼容性验证，不代表对该文件的下载或分发授权。仓库不提供示例课件。

### 可选：导出活动网页

```powershell
.\.venv\Scripts\python.exe lms.py scrape --channel msedge --headless --wait 8 --url "https://lms.nju.edu.cn/course/11611/learning-activity#/44877"
```

在 `data/时间戳/` 下生成 `page.html`、`text.txt`、`links.json`、`metadata.json` 和 `page.png`。正文只包含网页可见文本，不包含 iframe 内的 PDF 正文；实际附件应使用 `download`。

### 参数

运行 `python lms.py --help` 查看帮助。

| 参数 | 说明 |
| --- | --- |
| `login` / `download` / `scrape` | 登录、获取附件、导出网页 |
| `--url URL` | 完整活动链接，默认课程 11611 的活动 44877 |
| `--channel` | `chromium`（默认）、`chrome`、`msedge`，用于 login 和 scrape |
| `--auto-save` | login 返回课程页后自动保存状态 |
| `--headless` | scrape 隐藏浏览器 |
| `--wait 秒数` | scrape 额外渲染等待，默认 5 秒 |
| `--selector CSS` | scrape 等待指定元素可见 |
| `--timeout 秒数` | 浏览器导航和元素等待超时，默认 60 秒 |

HTTP 元数据请求超时 60 秒，文件请求超时 120 秒，与浏览器的 `--timeout` 独立。

## 鉴权与文件传输

未登录时，课程页面会跳转至学校统一身份认证。完成认证后，通过 LMS 本站会话访问接口。活动 URL 的 `#/活动编号` 由前端解析，片段本身不随 HTTP 请求发送。

文件获取流程：

1. 请求 `/api/activities/{activity_id}`，核对课程信息并读取附件、引用编号。
2. 请求 `/api/uploads/reference/document/{reference_id}/url`，携带活动引用及预览参数，获取文件地址；无引用编号时使用对应文档接口。
3. 请求服务器提供的 HTTPS 文件地址，保存响应中的实际文件字节。

此流程不修改服务器上的权限设置，但接口可访问性不能代替合法授权。页面或课程明确限制下载时，不应仅因另一接口可返回文件就认为允许保存；应先取得必要许可。

Python 下载器会拒绝错误 HTTP 状态或 HTML 响应，核对非零附件大小，PDF 额外校验 `%PDF-` 文件头，成功后计算 SHA-256。报告记录状态、类型、长度、附件编号和文件摘要，不写入 Cookie 或临时签名地址。部分附件失败时退出码非零，已成功文件保留。这些检查不等于完整内容验证、恶意软件扫描或权利审查。

## 隐私与权限

扩展申请 `activeTab`、`downloads` 和 `https://lms.nju.edu.cn/*` 权限，不申请 Cookie API 权限，不导出或持久化 Cookie。内容脚本仅匹配 LMS 学习活动和课件列表页面；用户打开弹窗后读取活动信息，点击下载后获取文档地址。当前实现没有第三方分析上报，但 LMS、文件服务器和浏览器可能保留各自的正常访问或下载记录。

Python 导出的 HTML、截图和正文可能包含姓名、通知或其他个人信息。不要将登录状态、带签名文件地址、课程内容或含个人信息的日志提交至仓库或公开 Issue。

## 常见问题与限制

- **扩展提示无法连接：** 安装或更新扩展后刷新 LMS 页面，再重新打开弹窗。
- **切换活动后列表未更新：** 点击「重新读取」。扩展会拒绝旧列表对其他活动发起下载。
- **登录失效：** 扩展在当前浏览器正常登录后刷新；Python 重新运行 login。
- **找不到 Chromium：** 安装 Chromium 或使用已安装的 Edge/Chrome。
- **附件失败：** 检查账号权限、文档转换状态、网络和 Python HTTP 报告；遇到明确禁止下载的要求应停止使用并确认授权。
- **网页正文不完整：** 增加 `--wait` 或指定 `--selector`；程序不自动展开、翻页或提取 iframe 正文。

网站接口、浏览器安装策略、sessionStorage 或设备绑定变化都可能导致不兼容。自动登录检测仅检查 URL、密码框和 Cookie，不能识别全部异常。扩展支持其他数字课程编号的路由，但未逐一验证其他课程。

## 目录与提交边界

```text
chromium-extension/  Manifest V3 扩展源码与安装说明
lms.py              Python 登录及页面导出入口
download.py         文档 HTTP 获取与校验
requirements.txt    Python 依赖
DISCLAIMER.md       免责声明与使用边界
LICENSE             0BSD 软件许可证
.auth/              本地登录状态、签名私钥（忽略）
data/               本地文件和报告（忽略）
```

`.gitignore` 排除登录状态、下载结果、私钥、CRX 和虚拟环境。忽略规则不是安全隔离：强制添加、复制到其他路径或已跟踪文件仍可能造成泄露。提交前检查暂存内容。删除 `.auth/state.json` 不会自动使其已泄露副本失效。

## 开源协议

本项目原创代码及文档以 [0BSD](LICENSE) 许可。你可以免费或收费使用、复制、修改及分发，也可以集成到闭源产品中，无须强制署名或保留许可文本。依赖和其他第三方材料按其各自许可或权利依据使用；本项目不转授学校课件、商标、账号或平台服务的权利。参考 [SPDX 0BSD](https://spdx.org/licenses/0BSD.html)。

第三方权利、使用风险、责任限制和问题反馈详见 [DISCLAIMER.md](DISCLAIMER.md)。声明中的使用边界说明法律及第三方授权要求，不构成 0BSD 的附加许可限制；软件许可与强制性法律规定的关系依适用法律处理。

参考：[Playwright 身份验证](https://playwright.dev/python/docs/auth)、[Chrome 下载 API](https://developer.chrome.com/docs/extensions/reference/api/downloads)。
