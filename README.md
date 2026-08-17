# 职聘通 JobHunter 🎯

**简历分析 · 岗位推荐 · 简历优化 · 官网直达 · 一键投递** —— 开源的本地部署综合求职平台

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Node](https://img.shields.io/badge/Node-%3E%3D18-green.svg)
![Platform](https://img.shields.io/badge/Platform-Win%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)
![Lang](https://img.shields.io/badge/Lang-HTML%20%2F%20JS%20%2F%20CSS-orange.svg)

> 面向应届生 / 往届生 / 实习生 / 社招求职者。核心思路：**先分析你的简历 → 按投递赛道匹配出合适的公司与岗位 → 官网直达核对 → 由自动化引擎代填表单投递，验证码由你中继提供，提交前人工确认**。所有数据存本地，不上传任何服务器。

> [!IMPORTANT]
> The job database is for screening and demonstration, not a guarantee that a
> posting remains active. Before applying, verify the official company link,
> eligibility, deadline, and recruitment process. Never commit a real resume,
> contact information, browser session, application history, or screenshots
> containing personal data.

---

## ✨ 功能特性

| 模块 | 说明 |
|------|------|
| 📄 **简历分析** | 上传 PDF（pdf.js 本地解析，扫描件自动提示）或粘贴文本，自动提取 **25 项画像字段**（姓名/性别/出生/籍贯/电话/邮箱/微信/现居/学校/专业/学历/毕业年/就读-毕业时间/英语/其他外语/证书/技能/经历/求职方向/擅长/期望薪资/期望年薪/是否调剂/期望城市/简历附件），生成"简历画像" |
| 🎯 **岗位推荐** | 基于画像对岗位库打分（关键词 60% + 方向 15% + 城市 10% + 薪资匹配 +5 + 英语 +4 + 证书 +3 + 接受调剂 +3 + 届次 5% + 学历 5%），**Top 30 精选**，≥75 强烈推荐 |
| ✍️ **简历优化** | ① 个人信息缺漏诊断（手机号占位/邮箱/学历/籍贯/英语/证书/毕业时间/期望薪资/调剂/简历附件等 **23 项**）② 正文问题检测（空泛词/无数据/无结果/AI腔等 7 条规则），每条附 **HR 可能追问 + 建议回答**（一键复制）+ 8 类 40+ 条表达复制库 + AI 提示词模板 |
| 🏢 **公司数据库** | **5622 条岗位 / 2247 家正规公司 / 17 行业 / 34 省级行政区 185 市**，全维度 **多选 chips 筛选**（投递赛道·类型·规模等级·行业·岗位类别·学历·公司类型·地区一体栏省→市二级联动）+ 招聘详情展开（职责/要求/公司信息/投递渠道）+ 分页 + 统计条 + 官网直达 |
| 🚀 **一键投递** | 五列看板（待投→已投→有回复→面试→Offer），自动化引擎代填表单，**验证码截图回传**、**提交前整页截图确认**，实时日志 |
| 🎨 **设计展示页** | 站内内置 Terranova 液体玻璃设计页，并已整合为全站动态背景（详见下文） |

## 🚀 快速开始

```bash
# 1. 克隆仓库
git clone <你的仓库地址> job-hunter
cd job-hunter

# 2. 安装依赖（首次）
npm install

# 3. 启动
npm start
# 浏览器打开 http://localhost:8621
```

**前置要求**：本机安装 Chrome 或 Edge（程序自动检测），Node.js ≥ 18。

> 无需任何配置即可启动：项目自带开源模板画像（`resume/profile.example.json`）与完整岗位数据库（`db/jobs.json`），clone 后开箱即用。

## 🌐 公开访问部署

要把链接发给其他人使用，请部署 **公共模式**，而不是直接暴露本机的 `localhost`。公共模式保留全部网页功能；每位访问者的简历画像和投递看板保存在其浏览器内，服务端的自动投递任务、实时日志和浏览器登录态按随机会话隔离。

最简单的方式是将仓库推送到 GitHub 后，在 [Render](https://render.com/) 创建 **Blueprint** 并选择此仓库。项目内的 `render.yaml` 会使用 Docker 自动构建，部署成功后 Render 会提供一个 `https://...onrender.com` 地址，可直接分享。

也可在任意支持 Docker 的云主机运行：

```bash
docker build -t job-hunter .
docker run -d --name job-hunter -p 8621:8621 \
  -e PUBLIC_MODE=1 -e APPLY_HEADLESS=1 job-hunter
```

公共部署必须使用 HTTPS 反向代理或托管平台的 HTTPS 地址。不要将包含真实 `resume/profile.json` 的本地目录直接上传到服务器。

## ⚙️ 配置说明

### 简历画像（你的个人数据）

| 文件 | 作用 | 是否入库 |
|------|------|---------|
| `resume/profile.example.json` | 开源占位模板，所有人共享 | ✅ 随仓库分发 |
| `resume/profile.json` | **你自己的真实画像**（姓名/手机/邮箱/学校/经历/简历路径…），服务端优先读取 | ❌ 已被 `.gitignore` 忽略，绝不会提交 |

使用方式：启动后在页面「简历分析 → 编辑简历画像」中填写并保存；或直接编辑 `resume/profile.json`（复制 `profile.example.json` 后修改）。画像同时驱动岗位推荐打分、简历优化诊断与一键投递自动填表，**请确保手机号、邮箱填写正确**。

### 环境变量

| 变量 | 默认 | 说明 |
|------|------|------|
| `PORT` | `8621` | 服务端口 |
| `PUPPETEER_EXECUTABLE_PATH` | 自动检测 | Chrome/Edge 可执行文件路径（检测失败时指定） |
| `APPLY_HEADLESS` | `0`（可见窗口） | 设为 `1` 时后台无头运行自动投递 |
| `HOST` | `127.0.0.1` | Server bind address; the default limits access to this machine |
| `PUBLIC_MODE` | `0` | 设为 `1` 启用多人会话隔离，并且只向访客返回示例画像 |

## 🤖 一键投递的工作原理

```
你在前端勾选岗位 → 后端启动浏览器（可见窗口，方便登录/滑块）→ 打开官网招聘页
→ 启发式识别表单字段（姓名/手机/邮箱/学校/专业/学历/毕业年/简历附件…）自动填写
→ 遇到验证码：自动截图回传前端 → 你输入验证码 → 机器人继续
→ 找到提交按钮：整页截图回传 → 你确认后点提交 → 投递成功自动登记看板
→ 遇到登录墙 / 无法识别的字段：暂停并提示你在浏览器中手动完成，点"继续"即可
```

**关键设计**：
- **验证码中继**：你只负责"提供验证码"和"最终确认"，其余筛选、填写、提交由引擎完成
- **持久登录**：浏览器使用独立 profile（`.profile` 目录），登录一次后续自动保持
- **可见窗口**（默认）：你全程能看到机器人在做什么，可随时手动接管
- **可配置无头**：`APPLY_HEADLESS=1 npm start` 后台运行（不推荐）

## 🗄️ 岗位数据库（大数据筛选）

- **规模**：5622 条岗位 × 2247 家真实正规公司（含 **1300 家 A 股上市公司**程序化扩充） × 17 个行业 × 34 省级行政区 185 市 × 7 类岗位（技术/产品/运营/市场/销售/设计/职能），位于 `db/jobs.json`
- **投递赛道**：每条岗位确定性分配四大赛道之一——🎓 **应届生**（1982 条，2026-2027 届校招）/ ⏳ **往届生**（860 条，毕业 1-3 年可投校招）/ 📎 **实习生**（1368 条，2027-2028 届日常/暑期实习）/ 💼 **社招**（1412 条，经验不限），岗位卡片带彩色赛道徽章，招聘详情明示赛道说明与面向届次
- **公司分级**：岗位按公司规模分为 🏅 **大厂（1226 条）/ 中厂（4226 条）/ 小厂（170 条）** 三档，卡片带等级徽章，可单独筛选
- **数据来源**：`data/companies.js` 收录 2247 家公司元数据（名称/行业/总部/类型/规模/参考薪资/官网/简介/等级），由 `node data/gen-jobs.js` 确定性生成岗位（同公司不重复、可复现，含岗位职责 resp / 任职要求 req / 所属省份 prov / 赛道 track / 面向届次 gradYear）；`data/expand-companies.js` 从东方财富行情 API 按市值拉取真实 A 股公司自动合并扩充
- **筛选维度**（全部支持**多选**，任意组合）：
  - 投递赛道（应届生/往届生/实习生/社招）、招聘类型（校招/社招/实习）、规模等级（大厂/中厂/小厂）、行业（17）
  - 岗位类别（7）、学历要求（本科/硕士/博士/不限）、公司类型（18 类：互联网大厂/央企/国企/上市/外企/独角兽/券商/银行/军工…）
  - **地区一体栏（省→市二级展开）**：34 个省级行政区（含港澳台）一排展示；点「多城市省」= 展开该省城市面板并**自动全选全省**，再点 = 收起并取消；展开后城市 chips 可**单独多选**（取消一个即省变半选高亮）；直辖市/单城市省直接点击切换
  - 关键词、匹配度阈值、"只看已加入"
- **招聘信息明示**：岗位卡片可展开「招聘详情」查看 **岗位职责 / 任职要求 / 赛道说明 / 公司信息 / 投递渠道**；「复制信息」可带职责要求一键复制，方便粘贴给 AI 定制简历
- **分页**：每页 20 / 50 / 100 条，顶部统计条实时显示命中数；「刷新数据库」按钮可随时重新拉取
- **投递闭环**：筛选 → 查看岗位卡片（含官网链接/投递渠道）→ 加入投递单 → Tab5 一键投递
- **扩充方式**：
  1. 运行 `node data/expand-companies.js` 从东方财富 API 自动拉取 A 股上市公司并入公司库（支持断点续拉：`node data/expand-companies.js <起始页>`）
  2. 编辑 `data/companies.js` 追加公司元数据 → 重跑 `node data/gen-jobs.js` 重新生成
  3. 前端「加入岗位库」粘贴 JSON 或 `公司|岗位|城市|URL|类型` 文本（写入 `db/jobs_custom.json`）
  4. 运行抓取模板 `node tools/crawler-template.js <招聘页URL>` 生成导入文件

## 📋 简历画像与优化诊断（自动填表数据源）

「简历分析 → 编辑简历画像」维护 **25 项**：姓名/性别/出生年月/籍贯/手机/邮箱/微信/现居城市/学校/专业/学历/毕业届次/就读时间/毕业时间/技能/求职方向/擅长领域/英语水平/其他外语/技能证书/期望月薪/期望年薪/是否接受调剂/期望就业城市/本机简历 PDF 路径。自动化引擎用这份数据填表（27 条表单字段规则自动映射）。

「简历优化 → 检测当前文本」会同时输出两块报告：
- **🔎 个人信息诊断**：对照画像检查 **23 项关键字段**（含"请填写手机号"这类占位符识别），缺漏项标注高危/中等/轻微
- **📝 简历正文问题**：规则引擎扫描空泛形容词、经历无数据、无结果导向、被动弱主语、AI 腔、超长句、自我评价单薄

每张诊断卡片都带 **HR 可能追问**（面试官会怎么问）+ **建议回答**（怎么答最合适，一键复制）。

## 🎨 设计展示页（Terranova — Signals from the Deep Green）

站内独立设计展示页，从主站顶部导航「🎨 设计页」或访问 `/design/terranova/` 打开。

- **纯原生实现**：`design/terranova/` 下仅 5 个文件：`index.html` / `styles.css` / `glass-card.js` / `ui.js` / `serve.mjs`，无框架、无构建、无 Three.js / WebGL / WebGPU / Canvas 3D
- **视觉**：全出血循环背景视频（1920×1080 肥皂泡/玻璃球素材，100% 透明度，无遮罩/渐变/暗化层）
- **液体玻璃**：SVG 滤镜链（`feTurbulence` + `feGaussianBlur` + `feComponentTransfer` 边缘遮罩 + RGB 三次 `feDisplacementMap` 色差）实现实时折射
- **帧同步**：`glass-card.js` 每帧把背景视频按 `object-fit: cover` 绘制到全视口 2D canvas，卡片通过 `overflow: hidden` + `border-radius: 48px` 成为窗口
- **独立运行**：`cd design/terranova && node serve.mjs` → `http://127.0.0.1:8123`

### 主站动态背景整合

设计页动态背景已整合为职聘通主站的全局背景：

- **层级（z-index）**：z0 全屏循环背景视频 → z1 液体玻璃折射装饰卡（右下角）→ z2 主站内容层 `.container` → z50 顶部导航 header → z100 弹窗 → z200 Toast
- **内容玻璃化**：header、`.card`、`.job-card` 等主站卡片改为 `rgba(255,255,255,0.86)` + `backdrop-filter: blur(14px) saturate(1.15)`
- **失败降级**：`bg-glass.js` 监听视频 `error`，10 秒内无法解码则写入 `html.no-terranova`，背景层隐藏、body 恢复浅色，主站所有功能完全不受影响
- **无障碍**：`prefers-reduced-motion: reduce` 时隐藏视频与玻璃卡并暂停循环

整合文件：`design/terranova/bg.css`（背景层样式 + 内容玻璃化覆盖）、`design/terranova/bg-glass.js`（折射帧同步 + 降级处理）。

## 🧪 测试

```bash
npm test   # 依次运行回归(25) + 全量(60) + 整合(43)，共 128 项断言，需先 npm start
```

| 脚本 | 断言数 | 覆盖 |
|------|-------|------|
| `node tools/e2e-regression.js` | 25 | 主站核心功能回归（需 `npm start`） |
| `node tools/e2e-full.js` | 60 | 全功能端到端：资源/PDF 解析/25 项画像/推荐/优化诊断/四赛道筛选/省市区联动/详情展开/看板/WebSocket/REST/localStorage |
| `node tools/integration-check.js` | 43 | 背景整合专项：背景层结构/滤镜参数/z-index/可滚动性/功能无损/降级自洽/控制台无报错 |
| `node tools/design-check.js` | 22 | Terranova 设计页专项：视频属性/滤镜/canvas/菜单交互/焦点管理/禁止库引用/响应式 |

## ❓ 常见问题

- **Q：为什么打开页面提示"离线示例模式"？** A：直接用浏览器打开了 index.html，请通过 `npm start` 访问。
- **Q：自动投递会不会填错？** A：提交前有整页截图人工确认环节；无法识别的字段会暂停提示手动补齐。请勿对不熟悉的表单盲目确认。
- **Q：验证码能自动识别吗？** A：引擎不破解验证码（合规优先），截图回传由你输入，通常 5 秒内完成。
- **Q：表单按钮文案特殊怎么办？** A：机器人会优先找"提交/投递/申请"类按钮；找不到时暂停，你手动点完点"继续"。
- **Q：某公司官网结构特殊填不了？** A：建议该岗位走"官网直达"手动投递，或把该公司从自动队列中移除。
- **Q：如何保护我的隐私？** A：个人画像 `resume/profile.json` 与投递记录 `data/applications.json` 已被 `.gitignore` 忽略，不会随仓库提交；`.profile/` 浏览器登录态目录同样被忽略。

## ⚠️ 合规提示

- 本工具仅用于**个人求职**，投递前请确认目标公司招聘页的条款允许
- 验证码由本人提供、提交由本人确认，全程可追溯
- 请控制投递频率，避免短时间对同一平台高频操作

## 📁 目录结构

```
job-hunter/
├── index.html          # 前端单页应用（五模块 + 动态背景）
├── server.js           # Express + WebSocket + 投递自动化引擎
├── package.json        # npm 脚本（start / test）
├── LICENSE             # MIT 开源许可证
├── .gitignore          # 忽略个人数据与运行时产物
├── db/
│   ├── jobs.json           # 岗位数据库（5622 条 × 2247 家，程序化生成，含 resp/req/prov/tier/track/gradYear）
│   └── jobs_custom.json    # 用户手动导入的岗位（自动生成，不入库）
├── design/terranova/       # Terranova 设计展示页（液体玻璃 hero）+ 主站背景整合
│   ├── index.html / styles.css
│   ├── glass-card.js       # 逐帧同步视频到 canvas 的液体玻璃帧同步
│   ├── ui.js               # 滑入菜单交互
│   ├── serve.mjs           # 独立静态服务器（http://127.0.0.1:8123）
│   ├── bg.css              # 主站动态背景层 + 内容玻璃化覆盖
│   └── bg-glass.js         # 主站折射帧同步（data-bg-glass + 失败降级）
├── data/
│   ├── companies.js        # 公司元数据源（2247 家，可扩充）
│   ├── gen-jobs.js         # 岗位生成器（node data/gen-jobs.js 重新生成 db/jobs.json）
│   ├── expand-companies.js # 公司库自动扩容脚本（东方财富 A 股 API，支持断点续拉）
│   ├── upgrade-companies.js# 公司库分级/扩充脚本（自动计算大中小厂 tier）
│   └── applications.json   # 投递记录（自动生成，不入库）
├── lib/
│   ├── pdf.min.js          # pdf.js 本地库（简历 PDF 解析，离线可用）
│   └── pdf.worker.min.js   # pdf.js 本地 worker
├── resume/
│   ├── profile.example.json# 开源占位画像模板（随仓库分发）
│   └── profile.json        # 你的真实画像（不入库）
├── tools/
│   ├── crawler-template.js # 校招信息抓取模板
│   ├── e2e-full.js         # 全功能端到端实测（60 项断言）
│   ├── e2e-regression.js   # 端到端回归测试（25 项断言）
│   ├── design-check.js     # Terranova 设计页接入实测（22 项断言）
│   ├── integration-check.js# 背景整合专项实测（43 项断言）
│   ├── shot.js             # 通用截图脚本
│   ├── shot-terranova.js   # 设计页截图脚本
│   └── shot-terranova-bg.js# 背景整合后截图脚本
└── .profile/               # 浏览器持久登录态（自动生成，不入库）
```

## 🤝 贡献

欢迎提交 Issue 与 Pull Request。请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 📄 许可证

[MIT License](LICENSE) © 2026 JobHunter Contributors

---

*由 WorkBuddy 构建 · 2026-08-17*
