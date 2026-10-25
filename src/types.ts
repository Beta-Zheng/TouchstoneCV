/* ------------------------------------------------------------------
 * 结构化数据模型 —— 与需求文档 §10 / §11 对齐
 * 简历内容一律保存为结构化 JSON，而不是富文本
 * ------------------------------------------------------------------ */

export type SourceKind = "file" | "pasted_text" | "empty" | "sample";

export const AUDIENCE_LABELS = {
  student: "校招",
  internship: "实习",
  experienced: "社招",
} as const;
export type ResumeAudience = keyof typeof AUDIENCE_LABELS;

export type SectionType =
  | "basic_info"
  | "summary"
  | "work_experience"
  | "project_experience"
  | "education"
  | "skills"
  | "certifications"
  | "custom";

export type BlockType =
  | "summary"
  | "work_experience_item"
  | "project_experience_item"
  | "education_item"
  | "skill_group"
  | "certification"
  | "custom_text";

export interface BasicInfo {
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  website: string;
  /** 自定义信息项：固定六项之外的补充（如 期望薪资、政治面貌），随联系方式一行渲染 */
  custom_fields?: Array<{ label: string; value: string }>;
}

/** 通用 Block 结构（§11.3） */
export interface Block {
  block_id: string;
  type: BlockType;
  title: string;
  subtitle: string;
  start_date: string;
  end_date: string;
  location: string;
  description: string;
  bullets: string[];
  /** 与 bullets 平行的「是否显示列表符号」勾选标记；缺省 / 越界视为显示（兼容历史数据与 AI 生成） */
  bullet_marks?: boolean[];
  /** 追加副标题段：与 subtitle 合并后用 · 分隔渲染（subtitle 为首段，兼容历史数据） */
  subtitles?: string[];
  skills: string[];
  links: string[];
  visible: boolean;
  order: number;
}

export interface Section {
  section_id: string;
  type: SectionType;
  title: string;
  visible: boolean;
  order: number;
  blocks: Block[];
  /** 该模块的要点列表样式（模块级自定义）；缺省时继承 theme.bullet_style */
  bullet_style?: BulletStyleKey;
}

export interface ResumeData {
  basic_info: BasicInfo;
  sections: Section[]; // 渲染按 order 升序，再过滤 visible=false
  metadata: {
    source: SourceKind;
    source_name?: string;
    created_at: string;
    source_text?: string;
    reviewed_at?: string;
  };
  /** 个人头像（base64 或外链），仅部分模板展示 */
  avatar_url?: string;
  /** 学校/机构徽标（base64 或外链），仅部分模板展示 */
  school_badge_url?: string;
}

export type FontKey = "sans" | "serif" | "system" | "kai" | "mono" | "fangsong";
export type DensityKey = "compact" | "medium" | "loose";
export type HeaderLayoutKey = "row" | "stack";
export type BulletStyleKey =
  | "disc"
  | "diamond"
  | "arrow"
  | "ordered"
  | "square"
  | "check"
  | "circle";

/** 要点列表可选样式（编辑器与预览共用一份定义，避免两处不一致） */
export const BULLET_STYLE_OPTIONS: Array<{
  key: BulletStyleKey;
  label: string;
  sample: string;
}> = [
  { key: "diamond", label: "菱形", sample: "◆" },
  { key: "disc", label: "圆点", sample: "●" },
  { key: "square", label: "方块", sample: "▪" },
  { key: "circle", label: "空心圆", sample: "○" },
  { key: "arrow", label: "箭头", sample: "→" },
  { key: "check", label: "对勾", sample: "✓" },
  { key: "ordered", label: "有序", sample: "1." },
];

/** 支持要点列表的模块类型（其余模块不展示要点样式开关） */
export const BULLET_CAPABLE_SECTIONS: SectionType[] = [
  "work_experience",
  "project_experience",
  "education",
  "custom",
  "summary",
];

export interface Resume {
  id: string;
  title: string;
  data: ResumeData;
  template_id: string;
  theme: {
    primary_color: string;
    font_size: number;
    /** 全文字体：sans=黑体 / serif=宋体 / system=系统默认 / kai=楷体 / mono=等宽 / fangsong=仿宋 */
    font_family?: FontKey;
    /** 布局紧凑度：紧凑 / 中等 / 宽松，用于一页简历的篇幅调节 */
    density?: DensityKey;
    /** 条目头布局：row=标题居左·日期居右；stack=标题居上·信息居下 */
    header_layout?: HeaderLayoutKey;
    /** 要点列表样式：disc=圆点 / diamond=菱形 / arrow=箭头 / ordered=有序数字 */
    bullet_style?: BulletStyleKey;
    /** 头像显示比例：基于 1 寸照基准尺寸的倍数（0.5–2，缺省 1）；仅展示头像的模板生效 */
    avatar_scale?: number;
  };
  created_at: string;
  updated_at: string;
  locale?: "zh" | "en";
  audience?: ResumeAudience;
  archived_at?: string;
  /** Source of an independent copy; never implies automatic synchronization. */
  copy_source_id?: string;
  page_limit?: 1 | 2;
  target?: {
    company: string;
    job_title: string;
    source_resume_id?: string;
    source_updated_at?: string;
  };
}

export interface ResumeSnapshot {
  id: string;
  resume_id: string;
  label: string;
  kind: "initial" | "auto" | "manual" | "export";
  summary?: string;
  created_at: string;
  resume: Resume;
  jd?: JD;
}

export type ApplicationStatus =
  | "saved"
  | "applied"
  | "interview"
  | "offer"
  | "rejected"
  | "withdrawn"
  | "closed";
export interface ApplicationEvent {
  id: string;
  status: ApplicationStatus;
  at: string;
  note: string;
  legacy?: boolean;
}
export interface Application {
  id: string;
  resume_id: string;
  snapshot_id?: string;
  company: string;
  role: string;
  url: string;
  status: ApplicationStatus;
  notes: string;
  applied_at: string;
  follow_up_at: string;
  created_at: string;
  updated_at: string;
  events?: ApplicationEvent[];
}

export interface CoverLetter {
  resume_id: string;
  company: string;
  job_title: string;
  locale: "zh" | "en";
  body: string;
  updated_at: string;
}

export const EN_SECTION_LABELS: Record<SectionType, string> = {
  basic_info: "Contact",
  summary: "Summary",
  work_experience: "Experience",
  project_experience: "Projects",
  education: "Education",
  skills: "Skills",
  certifications: "Certifications & Awards",
  custom: "Additional Information",
};

/* ---------------- JD（§6 FR-06） ---------------- */

export interface JDStructured {
  job_title: string;
  responsibilities: string[];
  requirements: string[];
  skills: string[];
  keywords: string[];
  education: string;
  experience_years: number | null;
}

export interface JD {
  jd_id: string;
  resume_id: string;
  raw_text: string;
  structured: JDStructured;
  created_at: string;
}

export interface MatchReport {
  overall_score: number;
  skill_match_score: number;
  keyword_coverage_score: number;
  experience_relevance_score: number;
  writing_quality_score: number;
  missing_skills: string[];
  related_skills?: Array<{ term: string; tools: string[] }>;
  missing_keywords: string[];
  suggestions: string[];
  computed_at: string;
}

/* ---------------- 模型（§FR-09） ---------------- */

export type ModelType = "local" | "external" | "private";
export type ModelProtocol = "ollama" | "openai_compatible";
export type RouteStrategy =
  | "local_first"
  | "local_only"
  | "ask_before_external";

export interface ModelProvider {
  id: string;
  name: string;
  type: ModelType;
  protocol: ModelProtocol;
  base_url: string;
  api_key: string; // 界面不明文展示
  model_name: string;
  temperature: number;
  max_tokens: number;
  timeout_ms: number;
  enabled: boolean;
  created_at: string;
}

/* ---------------- AI 建议（§FR-08） ---------------- */

export type AIAction =
  | "polish"
  | "rewrite"
  | "quantify"
  | "shorten"
  | "expand"
  | "translate"
  | "jd_match"
  | "ats_optimize";

export type SuggestionStatus = "generating" | "success" | "failed";
export type SuggestionResolution = "accepted" | "rejected" | "edited_accepted";

export interface Suggestion {
  id: string;
  resume_id: string;
  section_id: string;
  block_id: string;
  action: AIAction;
  engine: "llm" | "rules";
  provider_name: string;
  status: SuggestionStatus;
  original: Block;
  suggested?: Block;
  /** Exact accepted content, used to avoid undoing later manual edits. */
  applied?: Block;
  explanation?: string;
  matched_keywords: string[];
  warnings: string[];
  error?: string;
  resolution?: SuggestionResolution;
  created_at: string;
}

/* ---------------- 模板（§FR-05） ---------------- */

export interface TemplateConfig {
  template_id: string;
  name: string;
  layout: "single_column" | "ats" | "photo_header";
  description: string;
}

export const TEMPLATES: TemplateConfig[] = [
  {
    template_id: "modern_single_column",
    name: "现代单栏",
    layout: "single_column",
    description: "彩色标题 · 单栏布局",
  },
  {
    template_id: "classic_ats",
    name: "经典 ATS",
    layout: "ats",
    description: "黑白单栏 · 标准标题",
  },
  {
    template_id: "academic_photo",
    name: "学术双栏",
    layout: "photo_header",
    description: "头像页眉 · 双栏布局",
  },
];

export const ACTION_LABELS: Record<AIAction, { label: string; hint: string }> =
  {
    translate: {
      label: "英文翻译",
      hint: "需模型：翻译当前条目，保留原有事实与数字",
    },
    polish: { label: "润色", hint: "保留事实，让表达更专业、结果导向" },
    rewrite: { label: "改写", hint: "重组句式：动词开头 + 内容 + 成果" },
    quantify: { label: "量化建议", hint: "指出可以补充数字指标的位置" },
    shorten: { label: "缩短", hint: "删冗词，单句控制在一行内" },
    expand: { label: "扩写", hint: "按 背景/方案/结果 补充结构提示" },
    jd_match: { label: "JD 对齐", hint: "向目标岗位关键词靠拢（不编造）" },
    ats_optimize: {
      label: "ATS 优化",
      hint: "标准动词开头、去符号、关键词前置",
    },
  };

export const SECTION_LABELS: Record<SectionType, string> = {
  basic_info: "基本信息",
  summary: "个人总结",
  work_experience: "工作经历",
  project_experience: "项目经历",
  education: "教育经历",
  skills: "技能",
  certifications: "证书奖项",
  custom: "自定义模块",
};
