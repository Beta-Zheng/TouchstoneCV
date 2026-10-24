<div align="center">

# TouchstoneCV · 本地 AI 简历工作台

**创建、编辑、定制简历，记录投递进度。默认本机保存，外部模型逐次确认。**

[![License: MIT](https://img.shields.io/badge/license-MIT-534AB7.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6.svg)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF.svg)](https://vite.dev)

[在线体验](https://beta-zheng.github.io/TouchstoneCV/) · [使用指南](#使用指南) · [工作流说明](docs/resume-workflow.md)

</div>

TouchstoneCV 是本地优先的简历工作台：导入已有简历并校对内容，编辑经历、查看 A4 预览，依据招聘 JD 创建岗位版本，导出 PDF 或可编辑 DOCX。规则与模型建议以「原文 → 建议」对照呈现，确认后才写入。

默认不注册、不上传简历、不发送遥测。数据保存在当前站点的浏览器 IndexedDB；外部模型默认关闭，开启后每次发送内容仍需确认。本机密钥未加密，备份不包含 API Key。

**TouchstoneCV — Local-first AI Resume Workbench**

Import, review, edit and tailor resumes with A4 previews, optional model suggestions, version snapshots and application tracking. Data stays in your browser by default. External models require explicit enablement and confirmation for every call.

## 功能

- **创建与校对**：PDF / DOCX / MD / TXT 导入、粘贴文本、空白创建及分类示例；场景限定校招、实习、社招。解析结果先校对，确认后创建。
- **编辑与预览**：桌面内容与预览并排独立滚动，可调整比例，目录与建议面板按需打开并独立占位；手机工具收进「更多」。经历默认展开首条，其余保留摘要；支持排序、显隐、富文本和排版设置。
- **点击定位**：并排编辑时，切换条目可定位预览，可见目标和同条目操作不滚动；「定位预览」可主动返回。点击预览或使用独立定位按钮可展开编辑卡片，支持跨页、键盘及手机视图，重新分页保留当前位置标记。
- **JD 与内容建议**：支持连续段落与列表 JD；展示招聘原句和可定位证据，区分直接匹配、相关工具证据待确认和未识别词项，规则数值按需展开。示例联系方式需核对，岗位内容确认随内容或 JD 变化失效；规则不代表能力或招聘通过率。
- **主简历与岗位版本**：岗位版本是独立副本，修改不影响主简历；主简历更新仅提示，由用户选择栏目同步。
- **版本与投递追溯**：初始、自动、手动和导出快照可查看、比较与恢复。实际投递后固定关联快照，当前简历的后续编辑不改变投递内容。
- **智能篇幅调整**：按原稿推荐最多 1 页或 2 页，优先保留字号和内容；支持原稿对照、调整差异、必须保留条目及可解释的精简建议。有变化才创建独立副本，隐藏条目保留原文，不改写事实或裁切内容。
- **求职辅助**：中英版式、英文条目翻译、可编辑 DOCX、求职信草稿、状态图标、反馈时间线和跟进日期。投递与反馈由用户手动记录，不自动发送。
- **简洁工作台与演示**：默认紧凑列表，可切换真实内容缩略图；显示本浏览器备份状态。投递支持快捷更新进度、反馈与待跟进筛选，统计区分累计和当前状态，小样本显示分子/分母。新用户可直接开始或观看五步演示，侧栏可重看，演示不创建实际数据。

| 模板 | 实际布局 |
| --- | --- |
| 现代单栏 | 彩色标题、单栏内容 |
| 经典 ATS | 黑白单栏、标准标题 |
| 学术双栏 | 头像页眉、双栏内容 |

模板与匹配分数不保证招聘筛选结果。更多入口与行为见 [求职工作流说明](docs/resume-workflow.md)。

## 快速开始

直接打开 [在线体验](https://beta-zheng.github.io/TouchstoneCV/)，或在本机运行（Node.js ≥ 20）：

```bash
git clone https://github.com/Beta-Zheng/TouchstoneCV.git
cd TouchstoneCV
npm ci
npm run dev
```

打开终端显示的本机地址，端口被占用时会自动换端口。可选连接本机 Ollama；无模型也能编辑、使用规则检查、分析 JD 和导出。

部署到自己的 GitHub Pages：设置 `VITE_BASE_PATH=/<仓库名>/` 后运行 `npm run build`，发布 `dist/`。在线站点功能取决于其部署版本。

## 使用指南

1. **创建**：工作台「新建简历」选择文件（≤10MB）、文本、空白或示例；对照原文校对后确认。示例均为虚构资料，投递前替换。
2. **编辑**：切换「写内容」「内容与预览」「仅预览」。栏目目录用于排序和显隐；条目提供「优化这段」与「更多」。模板、语言、颜色与字号集中在「简历设置」。
3. **定制岗位**：展开「求职流程」，创建岗位副本并关联公司、岗位与 JD；JD 面板展示证据，工具面板查看建议。接受建议前核对事实。
4. **检查导出**：「导出」查看内容问题与实际分页，下载 DOCX、TXT、单份 JSON，或经浏览器打印保存 PDF。PDF 建议 A4、100% 缩放、关闭页眉页脚、开启背景图形；过长条目需拆分。
5. **记录投递**：关联实际投递版本，手动更新状态、反馈及跟进日期。「查看投递统计」展示状态分布和八周趋势；无反馈不代表拒绝，缺失历史不推断。

停止输入约 1 秒后保存当前内容；停止编辑 30 秒、离开编辑页或页面隐藏时记录有变化的快照。「辅助工具 → 版本记录」可查看、比较与恢复，保留初始、投递关联快照和最近 20 份其他快照。保存失败时先重试或备份，再刷新；多个窗口同时编辑会拒绝陈旧窗口覆盖。

「模型与隐私」支持本地 Ollama 和 OpenAI Compatible 服务。策略显示为「本地优先」「逐次确认」「仅本地」。模型默认关闭；改写、扩写与英文翻译需启用模型，规则建议不能代替模型写作。外部调用发送前展示内容并确认。

## 常见问题与限制

- **数据与备份**：数据仅属于当前浏览器及站点，不自动跨设备同步。「数据管理」备份与恢复支持校验、预览、合并或替换。旧 localStorage 数据校验后迁移，失败时保留旧副本；清理浏览器数据会删除本地资料，请定期备份。
- **扫描 PDF**：图片型 PDF 没有文本层，当前不提供 OCR；可粘贴文本并校对。
- **中英版式**：切换语言仅调整标准标题与日期，不翻译已有经历；模型翻译需逐条确认。
- **PDF 与 Word**：PDF 使用系统打印，关闭窗口不代表文件已保存，版本标记为「导出准备」。DOCX 为单栏文本布局，不复制头像与全部视觉样式，分页随字体环境变化。
- **模型与隐私**：外部服务需显式启用并逐次确认；API Key 不写入备份和日志。本机密钥未加密。富文本渲染经白名单消毒。
- **求职信与投递**：草稿需要核对事实与动机；没有自动投递、发信或企业反馈抓取。

## 开发与验证

```bash
npm run dev           # 开发服务
npm run typecheck     # TypeScript 检查
npm test              # 单元测试
npm run build         # 生产构建 → dist/
npm run test:storage  # 隔离浏览器中的 IndexedDB 回归
npm run test:layout   # 紧凑密度、一/两页副本与实际 PDF 页数回归
npm run test:navigation # 点击定位、高亮、独立滚动与焦点保护回归
npm run test:usability # 桌面/手机布局、核对状态、导出及投递完整流程
npm run test:exports  # 实际模板 PDF 与可选 Word 渲染验证，先运行 build
```

技术栈：React 18 · TypeScript · Vite 6 · Tailwind CSS 4 · Zustand · IndexedDB · dnd-kit · framer-motion。

当前验证包含 19 个测试文件、192 项测试，覆盖存储迁移与冲突、JD 证据、建议处理、版本隔离、投递快照、备份关联及首次使用偏好。浏览器回归覆盖 1280/1440/1920px 侧栏布局和 375px 编辑、导出、投递流程；三套模板中英 PDF 及 Word 渲染边界见下方说明。

导出验证产物位于忽略提交的 `.export-qa/`。本机没有 LibreOffice，未执行 Word 实际渲染；PR CI 安装 LibreOffice 与所需字体并设置 `REQUIRE_WORD_QA=1`，要求 Word 渲染通过。真实外部模型连接需按使用环境验证。

欢迎 Issue 与 PR：报告问题请附复现步骤及浏览器版本。

## License

[MIT](LICENSE)
