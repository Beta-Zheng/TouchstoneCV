import type { ResumeAudience, ResumeData, Section } from "../types";
import { uid, nowISO } from "./utils";

/**
 * 示例简历 —— 仅在用户主动点击「载入示例」时使用，不会自动写入。
 *
 * 三个完整示例档案（AI 应用 / 高级前端 / 数据分析），每次载入随机抽取一份，
 * 并从随机姓名池分配身份 → 同一键多次载入可得不同人设的简历。
 *
 * 内容设定均为虚构公司与人物，无真实个人信息；技术事实口径参考公开社区
 * 资料（RAGAS 忠实度、混合检索召回率、vLLM 多 LoRA 部署等常见实践）。
 */

/* ---------------- 随机身份 ---------------- */

/** 随机姓名池：名字与邮箱前缀成对，每次「载入示例」随机取一位 */
const NAME_POOL = [
  { name: "沈亦航", email: "shenyihang" },
  { name: "顾清源", email: "guqingyuan" },
  { name: "陆知行", email: "luzhixing" },
  { name: "江叙白", email: "jiangxubai" },
  { name: "林晚舟", email: "linwanzhou" },
  { name: "许望舒", email: "xuwangshu" },
];

interface Identity {
  name: string;
  email: string;
  phone: string;
}

function pickIdentity(): Identity {
  const pick = NAME_POOL[Math.floor(Math.random() * NAME_POOL.length)];
  const phone = "138-XXXX-XXXX";
  return { name: pick.name, email: pick.email, phone };
}

/* ---------------- 构件小工具 ---------------- */

function blk(type: import("../types").BlockType) {
  return {
    block_id: uid("blk"),
    type,
    title: "",
    subtitle: "",
    start_date: "",
    end_date: "",
    location: "",
    description: "",
    bullets: [] as string[],
    skills: [] as string[],
    links: [] as string[],
    visible: true,
    order: 0,
  };
}

const b = (
  partial: Partial<ReturnType<typeof blk>> & {
    type: ReturnType<typeof blk>["type"];
  }
) => ({
  ...blk(partial.type),
  ...partial,
});

/** 六个固定模块按标准顺序组装（basic_info 由外层统一填充） */
function assembleSections(parts: {
  /** 个人总结以要点分条填充（而非 description 段落） */
  summaryBullets: string[];
  work: ReturnType<typeof b>[];
  projects: ReturnType<typeof b>[];
  education: { school: string; major: string; start: string; end: string };
  skills: { group: string; items: string[] }[];
  certs: { title: string; year: string }[];
}): Section[] {
  return [
    {
      section_id: "basic_info",
      type: "basic_info",
      title: "基本信息",
      visible: true,
      order: 0,
      blocks: [],
    },
    {
      section_id: "summary",
      type: "summary",
      title: "个人总结",
      visible: true,
      order: 1,
      blocks: [{ ...blk("summary"), bullets: parts.summaryBullets }],
    },
    {
      section_id: "work_experience",
      type: "work_experience",
      title: "工作经历",
      visible: true,
      order: 2,
      blocks: parts.work,
    },
    {
      section_id: "project_experience",
      type: "project_experience",
      title: "项目经历",
      visible: true,
      order: 3,
      blocks: parts.projects,
    },
    {
      section_id: "education",
      type: "education",
      title: "教育经历",
      visible: true,
      order: 4,
      blocks: [
        b({
          type: "education_item",
          title: parts.education.school,
          subtitle: parts.education.major,
          start_date: parts.education.start,
          end_date: parts.education.end,
        }),
      ],
    },
    {
      section_id: "skills",
      type: "skills",
      title: "技能",
      visible: true,
      order: 5,
      blocks: parts.skills.map((s) => ({
        ...blk("skill_group"),
        title: s.group,
        skills: s.items,
      })),
    },
    {
      section_id: "certifications",
      type: "certifications",
      title: "证书奖项",
      visible: true,
      order: 6,
      blocks: parts.certs.map((c) =>
        b({ type: "certification", title: c.title, start_date: c.year })
      ),
    },
  ];
}

/* ---------------- 档案一：AI 应用工程师（大模型方向） ---------------- */

function profileAI(
  _: Identity
): Pick<ResumeData, "sections"> & { roleTitle: string; location: string } {
  return {
    roleTitle: "AI 应用工程师 · 大模型方向",
    location: "北京",
    sections: assembleSections({
      summaryBullets: [
        "7 年软件研发经验，近 4 年专注大模型应用落地，覆盖 3 条业务线、日均 2 万+ 次调用",
        "主导企业级 RAG 知识库问答与多 Agent 工作流从 0 到 1，成为内部使用率最高的 AI 工具",
        "以 RAGAS 建立自动化评测闭环，答案忠实度（Faithfulness）从 71% 提升至 92%",
        "能独立完成从数据构建、SFT/LoRA 微调到推理部署的全链路交付",
      ],
      work: [
        b({
          type: "work_experience_item",
          title: "云阙智能",
          subtitle: "AI 应用工程师 / LLM 应用负责人",
          start_date: "2021-03",
          end_date: "至今",
          location: "北京",
          bullets: [
            "主导企业级 RAG 知识库问答系统从 0 到 1，采用混合检索（向量 + BM25）与 Rerank 重排，检索召回率从 58% 提升至 89%，覆盖 12 万篇内部文档",
            "建立 RAGAS 自动化评测流水线，答案忠实度（Faithfulness）从 71% 提升至 92%，幻觉类客诉下降 76%",
            "基于 vLLM 部署多 LoRA 推理服务，单基座挂载 4 个业务适配器，推理成本降低约 60%，P95 首字延迟控制在 1.2s 内",
            "负责 4 人 AI 应用小组，沉淀 Prompt 管理与灰度发布规范，需求平均交付周期从 2 周缩短至 3 天",
          ],
        }),
        b({
          type: "work_experience_item",
          title: "深流科技",
          subtitle: "后端工程师",
          start_date: "2018-07",
          end_date: "2021-02",
          location: "北京",
          bullets: [
            "负责数据接入与 ETL 平台开发，日均处理 2000 万条埋点数据，链路可用性 99.95%",
            "设计高可用任务调度系统，故障自动恢复时间小于 5 分钟",
            "推动服务容器化迁移上 Kubernetes，发布效率提升 3 倍",
          ],
        }),
      ],
      projects: [
        b({
          type: "project_experience_item",
          title: "企业知识库 RAG 问答助手",
          subtitle: "发起人 / 负责人",
          start_date: "2022-05",
          end_date: "至今",
          bullets: [
            "设计「多路召回 + Query 改写 + Rerank 重排」三段检索链路，Context Recall 提升 31 个百分点",
            "实现答案引用溯源与无据拒答策略，上线后答案采纳率 87%，成为公司内部使用率最高的 AI 工具",
          ],
          skills: ["LangChain", "Milvus", "BM25", "RAGAS", "vLLM"],
        }),
        b({
          type: "project_experience_item",
          title: "客服领域模型 LoRA 微调",
          subtitle: "核心成员",
          start_date: "2023-03",
          end_date: "2023-11",
          bullets: [
            "清洗并构建 2.3 万条领域指令数据集，基于 LLaMA-Factory 完成 SFT + LoRA 微调",
            "领域评测集准确率从基座 74% 提升至 91%，相比全量微调训练成本降低约 85%",
          ],
          skills: ["LoRA", "SFT", "LLaMA-Factory", "DeepSpeed", "Python"],
        }),
      ],
      education: {
        school: "北京邮电大学",
        major: "自动化 · 本科",
        start: "2014-09",
        end: "2018-06",
      },
      skills: [
        {
          group: "大模型应用",
          items: [
            "Prompt 工程",
            "RAG",
            "Agent 编排",
            "SFT/LoRA 微调",
            "RAGAS 评测",
            "模型部署",
          ],
        },
        {
          group: "工程与其他",
          items: [
            "Python",
            "TypeScript",
            "LangChain",
            "vLLM",
            "Milvus",
            "FastAPI",
            "Docker/K8s",
          ],
        },
      ],
      certs: [
        { title: "云阙智能年度技术之星", year: "2023" },
        { title: "软考高级 · 系统架构设计师", year: "2021" },
      ],
    }),
  };
}

/* ---------------- 档案二：高级前端工程师 ---------------- */

function profileFrontend(
  _: Identity
): Pick<ResumeData, "sections"> & { roleTitle: string; location: string } {
  return {
    roleTitle: "高级前端工程师",
    location: "杭州",
    sections: assembleSections({
      summaryBullets: [
        "7 年前端开发经验，专注大型 Web 应用架构与性能优化",
        "主导日活 80 万的中台系统重构，首屏耗时从 3.2s 降至 1.1s",
        "落地微前端方案支撑 6 个子应用独立发布，发布耗时缩短 80%",
        "熟悉 React 生态与前端工程化全链路，长期负责团队代码规范与新人培养",
      ],
      work: [
        b({
          type: "work_experience_item",
          title: "星澜互动",
          subtitle: "高级前端工程师 / 前端组长",
          start_date: "2021-03",
          end_date: "至今",
          location: "杭州",
          bullets: [
            "主导交易中台前端重构，将 jQuery 单体迁移至 React + TypeScript，缺陷率下降 42%",
            "设计微前端落地方案，6 个子应用独立发布，发布耗时从 40 分钟缩短至 8 分钟",
            "搭建前端监控体系，覆盖性能、异常与业务指标，线上问题平均发现时间缩短至 3 分钟",
            "负责 5 人小组的技术评审与带教，推动组件库沉淀，复用率达到 70%",
          ],
        }),
        b({
          type: "work_experience_item",
          title: "青柠网络",
          subtitle: "前端工程师",
          start_date: "2018-07",
          end_date: "2021-02",
          location: "成都",
          bullets: [
            "负责电商营销活动页开发，累计交付 30+ 场大促活动，零线上事故",
            "实现活动页搭建平台原型，运营配置效率提升 5 倍",
            "优化移动端首屏加载，通过资源拆分与预加载将 LCP 从 2.8s 降至 1.4s",
          ],
        }),
      ],
      projects: [
        b({
          type: "project_experience_item",
          title: "Atlas 设计组件库",
          subtitle: "发起人 / 核心维护者",
          start_date: "2022-01",
          end_date: "至今",
          bullets: [
            "从零搭建团队 React 组件库，覆盖 48 个组件，单元测试覆盖率 85%",
            "编写主题定制与暗色模式方案，支撑 3 条产品线视觉统一",
          ],
          skills: ["React", "TypeScript", "Rollup", "Storybook"],
        }),
        b({
          type: "project_experience_item",
          title: "实时协作文档",
          subtitle: "前端负责人",
          start_date: "2020-03",
          end_date: "2020-12",
          bullets: [
            "基于 CRDT 实现多人协同编辑，支持 50 人同时在线编辑不冲突",
            "设计离线缓存与增量同步策略，弱网环境下编辑丢失率降为 0",
          ],
          skills: ["WebSocket", "IndexedDB", "Yjs"],
        }),
      ],
      education: {
        school: "北京邮电大学",
        major: "计算机科学与技术 · 本科",
        start: "2014-09",
        end: "2018-06",
      },
      skills: [
        {
          group: "核心技术",
          items: ["React", "TypeScript", "Vue", "Node.js", "Webpack", "Vite"],
        },
        {
          group: "工程与其他",
          items: ["微前端", "性能优化", "前端监控", "CI/CD", "Docker", "MySQL"],
        },
      ],
      certs: [
        { title: "星澜互动年度技术突破奖", year: "2023" },
        { title: "AWS Certified Cloud Practitioner", year: "2022" },
      ],
    }),
  };
}

/* ---------------- 档案三：数据分析师（增长方向） ---------------- */

function profileData(
  _: Identity
): Pick<ResumeData, "sections"> & { roleTitle: string; location: string } {
  return {
    roleTitle: "数据分析师 · 增长方向",
    location: "上海",
    sections: assembleSections({
      summaryBullets: [
        "6 年数据分析经验，专注用户增长与商业化分析",
        "搭建覆盖 200+ 指标的增长度量体系，统一全公司北极星指标口径",
        "主导会员转化漏斗优化，付费转化率从 3.1% 提升至 4.6%，年化 GMV 增量 4800 万",
        "熟练以 SQL / Python 完成取数、建模到实验设计的全流程，擅长把数据结论翻译成业务动作",
      ],
      work: [
        b({
          type: "work_experience_item",
          title: "澜舟零售",
          subtitle: "高级数据分析师 / 增长分析负责人",
          start_date: "2021-06",
          end_date: "至今",
          location: "上海",
          bullets: [
            "搭建用户增长度量体系，统一北极星指标与 200+ 过程指标口径，结束各部门「数出多门」",
            "主导会员转化漏斗优化，通过人群分层与触点实验将付费转化率从 3.1% 提升至 4.6%，年化 GMV 增量 4800 万",
            "设计 A/B 实验平台分析规范，年均支撑 120+ 场实验，实验结论采纳率 90% 以上",
            "搭建留存预测模型（XGBoost），高流失风险用户识别准确率 82%，挽留活动 ROI 提升 2.4 倍",
          ],
        }),
        b({
          type: "work_experience_item",
          title: "临江信息",
          subtitle: "数据分析师",
          start_date: "2019-07",
          end_date: "2021-05",
          location: "南京",
          bullets: [
            "负责内容社区核心指标日报与专题分析体系，取数自动化覆盖 80% 高频需求",
            "完成首次投放归因模型搭建，将渠道预算再分配后获客成本下降 18%",
          ],
        }),
      ],
      projects: [
        b({
          type: "project_experience_item",
          title: "用户分层与生命周期运营看板",
          subtitle: "负责人",
          start_date: "2022-08",
          end_date: "2023-06",
          bullets: [
            "基于 RFM + 聚类完成千万级用户五层分层，分层策略接入自动化触达系统",
            "Looker 看板覆盖 8 个业务团队，周均使用 400+ 次，替代 60% 的人工取数需求",
          ],
          skills: ["SQL", "Python", "XGBoost", "Looker"],
        }),
        b({
          type: "project_experience_item",
          title: "渠道投放归因分析",
          subtitle: "核心成员",
          start_date: "2020-04",
          end_date: "2020-11",
          bullets: [
            "对比末次触点与马尔可夫链归因模型，识别 2 个被高估的付费渠道并推动预算迁移",
            "搭建渠道质量评分卡，纳入后续全部投放决策流程",
          ],
          skills: ["马尔可夫链", "归因分析", "Hive", "Pandas"],
        }),
      ],
      education: {
        school: "北京邮电大学",
        major: "信息与计算科学 · 本科",
        start: "2015-09",
        end: "2019-06",
      },
      skills: [
        {
          group: "分析方法",
          items: [
            "A/B 实验设计",
            "归因分析",
            "用户分层",
            "留存建模",
            "因果推断",
          ],
        },
        {
          group: "工具",
          items: [
            "SQL",
            "Python",
            "Pandas",
            "XGBoost",
            "Hive",
            "Tableau",
            "Looker",
          ],
        },
      ],
      certs: [
        { title: "澜舟零售年度最佳分析案例", year: "2022" },
        {
          title: "Google Data Analytics Professional Certificate",
          year: "2020",
        },
      ],
    }),
  };
}

/* ---------------- 随机组装入口 ---------------- */

const PROFILES = [profileAI, profileFrontend, profileData];

/** 每次调用：随机身份 × 随机档案 → 一份完整示例简历 */
export type SampleKind = "ai" | "frontend" | "data";
export function buildSampleResume(
  kind?: SampleKind,
  audience: ResumeAudience = "experienced"
): ResumeData {
  const who = pickIdentity();
  const factory = kind
    ? { ai: profileAI, frontend: profileFrontend, data: profileData }[kind]
    : PROFILES[Math.floor(Math.random() * PROFILES.length)];
  const profile = factory(who);
  if (audience === "student" || audience === "internship") {
    profile.sections = profile.sections.filter(
      (s) => s.type !== "work_experience" && s.type !== "certifications"
    );
    const summary = profile.sections.find((s) => s.type === "summary");
    if (summary)
      summary.blocks.forEach((b) => {
        b.title = "";
        b.description =
          audience === "internship"
            ? "在校生，正在寻找实习机会。以下课程项目为虚构示例，请替换为自己的真实经历。"
            : "应届毕业生，通过课程与项目实践积累岗位相关能力。以下内容为虚构示例，请替换为自己的真实经历。";
        b.bullets = [];
      });
    profile.roleTitle =
      profile.roleTitle.replace(/高级|资深/g, "").replace(/ ·.*$/, "") +
      (audience === "internship" ? "实习生" : "");
    const projects = profile.sections.find(
      (s) => s.type === "project_experience"
    );
    projects?.blocks.forEach((block, index) => {
      block.title = `课程实践：${block.title}`;
      block.subtitle = "项目成员";
      block.start_date = index === 0 ? "2025-09" : "2025-03";
      block.end_date = index === 0 ? "2025-12" : "2025-06";
      block.description = "";
      block.bullets = [
        "参与需求拆解与原型实现，完成分配的功能模块。",
        "整理测试用例并修复问题，记录实践过程与学习成果。",
      ];
    });
    const education = profile.sections.find((s) => s.type === "education");
    education?.blocks.forEach((block) => {
      block.start_date = "2023-09";
      block.end_date = audience === "internship" ? "至今" : "2027-06（预计）";
    });
    profile.sections.forEach((section, index) => {
      section.order = index;
    });
  }
  return {
    basic_info: {
      name: who.name,
      title: profile.roleTitle,
      email: `${who.email}@example.com`,
      phone: who.phone,
      location: profile.location,
      website: `${who.email}.example.com`,
    },
    sections: profile.sections,
    metadata: { source: "sample", created_at: nowISO() },
  };
}

export const SAMPLE_JD_TEXT = `AI 应用工程师（大模型方向）

岗位职责：
1. 负责大模型能力在业务场景的落地：RAG 知识库、智能问答与流程自动化；
2. 设计并优化 Prompt 与 Agent 工作流，建设效果评测体系；
3. 负责领域模型的 SFT/LoRA 微调、评测与推理部署优化；
4. 与产品、算法团队协作，持续提升回答质量与用户体验。

任职要求：
1. 本科及以上学历，计算机、自动化、软件工程等相关专业，3 年以上研发经验；
2. 熟悉大模型基本原理与 Prompt 工程，有 RAG 或 Agent 系统开发经验；
3. 熟悉 SFT/LoRA 等微调方法，了解 vLLM、LangChain 等框架者优先；
4. 扎实的 Python 功底，良好的工程化能力与数据敏感度；
5. 具备良好的沟通表达与跨团队协作能力。`;
