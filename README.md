<div align="center">

# TouchstoneCV · 本地 AI 简历工作台

**把一份旧简历，变成一份打得准的新简历 —— 全程在你的浏览器里完成，数据不出本机。**

[![License: MIT](https://img.shields.io/badge/license-MIT-534AB7.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6.svg)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF.svg)](https://vite.dev)
[![Local-first](https://img.shields.io/badge/local--first-100%25%20in--browser-0F6E56.svg)](#-隐私与安全)

[▶ 在线体验 Live Demo](https://beta-zheng.github.io/TouchstoneCV/) · [下载使用](#-快速开始) · [使用指南](#-使用指南) · [常见问题](#-常见问题)

</div>

---

TouchstoneCV 是一个**本地优先**的 AI 简历工作台：上传已有的简历（PDF / DOCX / MD / TXT），自动解析成结构化数据；逐模块编辑、拖拽排序；粘贴一段招聘 JD，立刻得到本地匹配度分析；再让 AI 针对每个条目给出润色建议——所有建议都以「原文 → 建议」对照呈现，**你确认后才写入**。最后经系统打印管线导出像素级还原的 A4 PDF。

**默认配置下，没有任何数据离开你的电脑**：不注册、不上传、无遥测；外部模型默认关闭，开启后每次调用都要逐次确认。

---

**TouchstoneCV — Local-first AI Resume Workbench**

A local-first AI workbench for building, analyzing, and tailoring resumes. Parse your experience into structured data, match your resume against job descriptions, improve content with AI, and export polished resumes — while keeping your data under your control.

By default nothing leaves your machine: no sign-up, no upload, no telemetry. External models stay off until you enable them, and every call asks for your confirmation before it goes out.

<p align="center">
  <img src="docs/screenshots/home.png" alt="TouchstoneCV 工作台首页" width="48%" />
  &nbsp;
  <img src="docs/screenshots/editor.png" alt="TouchstoneCV A4 编辑器与 AI 建议面板" width="48%" />
</p>

## ✨ 它能帮你做什么

- **免重录的起点** —— 拖入旧简历，PDF / DOCX / MD / TXT 自动解析成结构化数据，姓名、经历、技能各归各位，从「改」开始而不是从「打」开始。
- **所见即所得的 A4 编辑** —— 左侧调模块、中间改内容、右侧看建议，实时 A4 预览；模块拖拽排序、条目显隐、要点样式（菱形/圆点/短横）随手切换。
- **JD 匹配度体检** —— 粘贴目标岗位的 JD，本地规则引擎提取技能与关键词，给出综合匹配分、四维细分（技能/关键词/经历相关性/表达质量）和缺失项清单，改哪里一目了然。
- **AI 只当副驾** —— 逐条目规则检查与模型写作（润色、改写、量化、精简、扩写、JD 对齐、ATS 表达优化）；模型支持英文条目翻译；未启用模型时改写、扩写和翻译不可用。支持模块逐条排队，每条建议以 diff 对照展示，接受、编辑后接受或拒绝都由你决定。
- **隐私不打折扣** —— 不注册不上传不遥测；API Key 界面掩码、不进日志；富文本经白名单消毒；一键备份/恢复全部数据。
- **导出即所见** —— 三套模板（现代单栏 / 经典 ATS / 学术双栏）配主题色与字号调节，「打印 → 另存为 PDF」忠实还原预览效果，ATS 模板专门为机器筛选优化。
- **完整求职流程** —— 导入后先校对，分类示例按校招/实习/社招选择；母版与岗位版本独立编辑，快照可比较与恢复；中英版式、可编辑 DOCX、求职信草稿及投递跟进记录。

新功能入口及验证范围见 [求职工作流说明](docs/resume-workflow.md)。

<details>
<summary>三套模板一览</summary>

| 模板         | 适合                                                        |
| ------------ | ----------------------------------------------------------- |
| **现代单栏** | 互联网 / 设计等行业投递，serif 姓名 + 主题色分隔 + 图标徽章 |
| **经典 ATS** | 大厂网申、机器筛简历场景：标准标题、纯文本技能，解析器友好  |
| **学术双栏** | 应届生 / 学术求职：头像页眉、圆形图标徽章、双栏紧凑排版     |

</details>

## 🚀 快速开始

**方式一：在线体验（零安装）**

直接打开 👉 **[beta-zheng.github.io/TouchstoneCV](https://beta-zheng.github.io/TouchstoneCV/)**，数据只存在当前浏览器的 IndexedDB 中。

**方式二：本地运行**

```bash
git clone https://github.com/beta-zheng/TouchstoneCV.git
cd TouchstoneCV
npm install
npm run dev        # 打开 http://localhost:3000
```

要求：Node.js ≥ 20。可选：本地运行 [Ollama](https://ollama.com) 即可启用纯本机的模型建议（无需任何 API Key）。

> 部署到自己的 GitHub Pages：`VITE_BASE_PATH=/<仓库名>/ npm run build`，把 `dist/` 发布即可。

## 📖 使用指南

### 1. 创建简历（三种方式）

- **上传文件**：把 `.pdf / .docx / .md / .txt`（≤10MB）拖进页面任意位置，或点「新建简历」选择文件；
- **粘贴文本**：解析失败会自动引导到此页签，直接粘贴简历全文同样可以结构化；
- **空白 / 示例**：从零手动填写，或选择 AI 应用、前端、数据分析示例，以及校招/实习/社招场景。示例内容为虚构资料，投递前必须替换。

文件或文本解析后先进入校对页，可对照原文修改字段、移动条目归类；确认后才创建简历。原文保留在「更多工具 → 查看导入原文」。

> 扫描件 PDF 提取不到文本时会明确提示，不会静默给你一份空简历。

### 2. 编辑器与求职流程

顶部五步流程直接进入校对内容、选择岗位、补强经历、检查导出、记录投递。基础字段完成度只表示填写情况，不代表内容质量或投递准备完成。

- **左栏 · 模块大纲**：拖拽调整模块顺序、开关模块显隐、添加自定义模块；
- **中栏 · 编辑区**：每个条目卡片可折叠、可整卡拖拽排序、可上移/下移/删除/隐藏；描述与要点支持选中加粗、斜体；右上「AI」按钮呼出动作菜单；
- **右栏 · AI 建议 + JD 匹配**：两个页签分别承载 AI 建议流程与 JD 分析结果；
- **自动保存**：停止输入约 1 秒后写入本机，顶栏显示最近保存时间，刷新不丢。

### 3. JD 匹配

右栏切到「JD 匹配」→ 粘贴招聘 JD → 「解析 JD」提取技能与关键词 → 「分析与当前简历的匹配度」，先核对 JD 原句、必需/优先项及简历证据，规则数值默认折叠；低于理想的维度会列出缺失技能与关键词，回到编辑器针对性补强即可。

### 4. AI 建议

条目上点「AI」→ 选动作（润色 / 改写 / 量化 / 精简 / 扩写 / JD 对齐 / ATS 表达优化）→ 建议以**原文 → 建议 diff** 呈现 → 「接受」「编辑后接受」或「拒绝」。默认使用本地规则引擎；连接 Ollama 或开启外部模型后由模型生成，模型上下文包含可见经历、目标职位与成果，排除联系方式。「更多工具 → 优化当前模块」支持串行批处理；外部模型仍对每个条目单独确认。量化向导只加入你提供的事实。

### 5. 模板与导出 PDF

编辑器顶部可切换模板、主题色、字号和版式语言。「看版式 / 实时预览」按条目测量并分页；「检查 / 导出」检查内容并下载 DOCX、TXT、单份 JSON，或通过系统打印保存 PDF。单个条目超过一页时需拆分后再打印，避免裁切。英文版式调整标准标题和日期，不自动翻译经历；可在已启用模型时使用条目的「英文翻译」，逐条确认后再导出。DOCX 使用可编辑单栏，保留文本内容，不复制 PDF 的头像与视觉样式。

> 提示：打印时请在「更多设置」中勾选**背景图形**，主题色分隔线与徽章底色才会被打印出来。

### 6. 模型配置（可选）

默认启用规则检查，不自动调用模型；「模型与隐私」页预置了待启用的本地 Ollama（`http://localhost:11434`）。三种策略按需选择：`local_first`（默认，本地优先）、`ask_before_external`（外部模型每次弹窗确认）、`local_only`（永不外发）。外部 OpenAI Compatible 模型默认关闭，API Key 仅存本机、界面掩码。

## ❓ 常见问题

**Q：我的简历数据存在哪里？**
浏览器的 IndexedDB 中，只在当前浏览器与站点中。旧 localStorage 数据会校验后迁移，迁移失败时保留旧副本。「数据管理」页可查看占用、备份全部或单份简历。恢复前会校验并预览，可合并为新简历或替换现有数据。备份不含 API Key，旧备份兼容；新导入或地址变化的模型默认关闭。清理浏览器数据会丢失本地记录，请定期备份；容量不足会显示保存失败与重试入口。

**Q：PDF 解析失败怎么办？**
先确认不是扫描件（图片型 PDF 无文本层）。解析失败会自动引导到「粘贴文本」页签，复制原文粘贴同样能结构化。

**Q：导出的 PDF 没有颜色？**
系统打印默认不打印背景色。在打印对话框的「更多设置」里勾选「背景图形」即可。

**Q：必须配置模型才能用吗？**
不需要。无模型时 AI 动作走内置的本地规则引擎（去冗余修饰、统一表述等），JD 匹配本身就是纯本地规则，完整可用。

**Q：AI 会不会直接改我的简历？**
不会。任何 AI 建议都以对照形式展示，只有你点了「接受」（或「编辑后接受」）才会写入，并可随时在「AI 建议」记录里追溯。

## 🔒 隐私与安全

- 默认不上传任何数据、不发遥测、不请求外部服务；
- 外部模型必须显式开启，且每次调用前逐次确认；
- API Key 界面掩码展示，不写入备份与日志；
- 富文本渲染前经白名单消毒（`sanitizeInline`），防注入；
- 解析失败、AI 失败、导出失败均有兜底，不会丢失已编辑内容。

## 🛠 开发

```bash
npm run dev           # 开发模式 → http://localhost:3000
npm run build         # 生产构建 → dist/
npm run typecheck     # TypeScript 检查
npm test              # 单元测试
npm run test:storage  # 隔离浏览器中的真实 IndexedDB 回归
npm run test:exports  # 实际模板 PDF 渲染及 Word 布局验证（先 build）
```

技术栈：React 18 · TypeScript · Vite 6 · Tailwind CSS 4 · Zustand（persist）· dnd-kit · framer-motion。

欢迎 Issue 与 PR：报 bug 请附复现步骤与浏览器版本；提功能建议请先说明使用场景。

## License

[MIT](LICENSE)
