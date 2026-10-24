import type {
  Block,
  Resume,
  Section,
  SectionType,
  CoverLetter,
  JD,
  ResumeSnapshot,
} from "../types";
import { EN_SECTION_LABELS, SECTION_LABELS } from "../types";
import { stripHtml, nowISO, containsTerm } from "./utils";

export const CORE_MODULES: { type: SectionType; label: string }[] = [
  { type: "basic_info", label: "基本信息" },
  { type: "summary", label: "个人总结" },
  { type: "work_experience", label: "工作经历" },
  { type: "project_experience", label: "项目经历" },
  { type: "education", label: "教育经历" },
  { type: "skills", label: "技能" },
];
const hasText = (s: string) =>
  !!stripHtml(s)
    .replace(/&nbsp;/g, " ")
    .trim();
export function blockHasContent(b: Block): boolean {
  return [b.title, b.subtitle, b.description, ...b.bullets, ...b.skills].some(
    hasText
  );
}
export function sectionHasContent(s: Section): boolean {
  return s.visible && s.blocks.some((b) => b.visible && blockHasContent(b));
}
export function moduleFilled(r: Resume, type: SectionType): boolean {
  if (type === "basic_info") {
    const b = r.data.basic_info;
    return (
      r.data.sections.find((s) => s.type === type)?.visible !== false &&
      hasText(b.name) &&
      hasText(b.title) &&
      !!(b.email.trim() || b.phone.trim())
    );
  }
  return r.data.sections.some(
    (s) =>
      s.type === type &&
      s.visible &&
      s.blocks.some((b) => {
        if (!b.visible) return false;
        if (type === "skills") return b.skills.some(hasText);
        if (type === "summary")
          return hasText(b.description) || b.bullets.some(hasText);
        if (["work_experience", "project_experience"].includes(type))
          return (
            hasText(b.title) &&
            (hasText(b.description) || b.bullets.some(hasText))
          );
        if (type === "education")
          return hasText(b.title) && hasText(b.subtitle);
        return blockHasContent(b);
      })
  );
}
export interface ResumeIssue {
  id: string;
  message: string;
  sectionId?: string;
  blockId?: string;
  severity: "warning" | "info";
}
export function inspectResume(r: Resume): ResumeIssue[] {
  const issues: ResumeIssue[] = [];
  const basic = r.data.basic_info;
  const basicId = r.data.sections.find(
    (s) => s.type === "basic_info"
  )?.section_id;
  const add = (
    id: string,
    message: string,
    sectionId?: string,
    blockId?: string,
    severity: ResumeIssue["severity"] = "warning"
  ) => issues.push({ id, message, sectionId, blockId, severity });
  if (r.data.sections.find((s) => s.type === "basic_info")?.visible === false)
    add(
      "hidden-contact",
      "基本信息已隐藏，导出不会包含姓名和联系方式",
      basicId
    );
  if (!hasText(basic.name)) add("name", "请填写姓名", basicId);
  if (!basic.email.trim() && !basic.phone.trim())
    add("contact", "请填写邮箱或电话", basicId);
  if (
    basic.email.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(basic.email.trim())
  )
    add("email", "邮箱格式可能不正确，请核对", basicId);
  if (!hasText(basic.title)) add("title", "请填写目标职位", basicId);
  if (/x{3,}|[＊*]{3,}|待填写|示例/i.test(basic.phone))
    add("placeholder-phone", "电话仍含占位内容，请填写实际联系方式", basicId);
  if (/@example\.(?:com|org|net)$/i.test(basic.email.trim()))
    add("placeholder-email", "邮箱为示例地址，请核对实际联系方式", basicId);
  if (
    !moduleFilled(r, "work_experience") &&
    !moduleFilled(r, "project_experience")
  )
    add("experience", "请补充工作、实习或项目经历");
  if (
    (r.audience === "student" || r.audience === "internship") &&
    !moduleFilled(r, "education")
  )
    add("education", "校招、实习简历建议补充教育经历");
  if (!moduleFilled(r, "skills"))
    add("skills", "建议填写与岗位相关的真实技能", undefined, undefined, "info");
  for (const s of r.data.sections.filter(
    (s) => s.visible && s.type !== "basic_info"
  )) {
    for (const b of s.blocks.filter((b) => b.visible)) {
      if (!blockHasContent(b)) {
        add(
          `empty-${b.block_id}`,
          `「${s.title}」存在空白条目，请填写、隐藏或删除`,
          s.section_id,
          b.block_id
        );
        continue;
      }
      if (
        ["work_experience", "project_experience", "education"].includes(s.type)
      ) {
        if (!hasText(b.title))
          add(
            `heading-${b.block_id}`,
            `「${s.title}」条目缺少标题`,
            s.section_id,
            b.block_id
          );
        if (!b.start_date || !b.end_date)
          add(
            `date-${b.block_id}`,
            `「${b.title || s.title}」时间范围待确认`,
            s.section_id,
            b.block_id
          );
        else if (
          /^\d{4}(-\d{2})?$/.test(b.start_date) &&
          /^\d{4}(-\d{2})?$/.test(b.end_date) &&
          b.start_date > b.end_date
        )
          add(
            `date-order-${b.block_id}`,
            `「${b.title || s.title}」结束时间早于开始时间`,
            s.section_id,
            b.block_id
          );
      }
    }
  }
  if (r.template_id === "academic_photo")
    add(
      "photo",
      "当前模板包含照片区域，请确认符合目标岗位的投递要求",
      undefined,
      undefined,
      "info"
    );
  return issues;
}

/** Confirmation applies to this content and JD, not every later edit of a copy. */
export function hasReviewedTarget(resume: Resume, jd: JD | undefined, snapshots: ResumeSnapshot[]) {
  return !!jd && snapshots.some(s => s.resume_id === resume.id && s.kind === 'manual' &&
    s.label === '岗位内容已核对' && s.jd?.raw_text === jd.raw_text &&
    JSON.stringify(s.resume.data) === JSON.stringify(resume.data));
}
export function completion(r: Resume) {
  const checks = [
    moduleFilled(r, "basic_info"),
    moduleFilled(r, "work_experience") || moduleFilled(r, "project_experience"),
    moduleFilled(r, "skills"),
  ];
  if (r.audience === "student" || r.audience === "internship")
    checks.push(moduleFilled(r, "education"));
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
export function sectionLabel(s: Section, locale: Resume["locale"]): string {
  if (s.type === "custom") return s.title;
  if (
    s.title === SECTION_LABELS[s.type] ||
    s.title === EN_SECTION_LABELS[s.type]
  )
    return locale === "en" ? EN_SECTION_LABELS[s.type] : SECTION_LABELS[s.type];
  return s.title;
}
export function localizedResume(r: Resume): Resume {
  if (r.locale !== "en") return r;
  return {
    ...r,
    data: {
      ...r.data,
      sections: r.data.sections.map((s) => ({
        ...s,
        title: sectionLabel(s, r.locale),
        blocks: s.blocks.map((b) => ({
          ...b,
          end_date: /^(至今|现在|今)$/.test(b.end_date)
            ? "Present"
            : b.end_date,
        })),
      })),
    },
  };
}
export function coverLetterEvidence(r: Resume, jd?: JD): string[] {
  const terms = jd
    ? [...new Set([...jd.structured.skills, ...jd.structured.keywords])]
    : [];
  return [
    ...new Set(
      r.data.sections
        .filter(
          (s) =>
            s.visible &&
            ["work_experience", "project_experience"].includes(s.type)
        )
        .flatMap((s) =>
          s.blocks
            .filter((b) => b.visible)
            .flatMap((b) =>
              [b.description, ...b.bullets].filter(hasText).map(stripHtml)
            )
        )
    ),
  ]
    .map((text, order) => ({
      text,
      order,
      relevance: terms.filter((t) => containsTerm(text, t)).length,
    }))
    .sort((a, b) => b.relevance - a.relevance || a.order - b.order)
    .map((x) => x.text);
}
export function createCoverLetterDraft(
  r: Resume,
  company: string,
  jobTitle: string,
  options: {
    jd?: JD;
    evidence?: string[];
    motivation?: string;
    contribution?: string;
  } = {}
): CoverLetter {
  const locale = r.locale ?? "zh";
  const available = coverLetterEvidence(r, options.jd);
  const evidence = (
    options.evidence
      ? options.evidence.filter((s) => available.includes(s))
      : available
  ).slice(0, 3);
  const skills = r.data.sections
    .filter((s) => s.visible && s.type === "skills")
    .flatMap((s) => s.blocks.filter((b) => b.visible).flatMap((b) => b.skills))
    .slice(0, 8);
  const personal = [options.motivation?.trim(), options.contribution?.trim()]
    .filter(Boolean)
    .join("\n\n");
  const body =
    locale === "en"
      ? `Dear Hiring Team,\n\nI am applying for the ${
          jobTitle || "[role]"
        } position at ${company || "[company]"}.\n\n${
          personal ? personal + "\n\n" : ""
        }${
          evidence.length
            ? "My relevant experience includes:\n" +
              evidence.map((s) => "• " + s).join("\n")
            : "[Add a relevant example from your experience.]"
        }\n\n${
          skills.length
            ? "My skills include " + skills.join(", ") + ".\n\n"
            : ""
        }Thank you for considering my application. I would welcome the opportunity to discuss my experience.\n\nSincerely,\n${
          stripHtml(r.data.basic_info.name) || "[Name]"
        }`
      : `尊敬的招聘负责人：\n\n您好！我希望应聘${company || "[公司名称]"}的${
          jobTitle || "[职位名称]"
        }岗位。\n\n${personal ? personal + "\n\n" : ""}${
          evidence.length
            ? "以下是我与岗位相关的经历：\n" +
              evidence.map((s) => "• " + s).join("\n")
            : "[请补充一项真实的相关经历。]"
        }\n\n${
          skills.length
            ? "我掌握的相关技能包括：" + skills.join("、") + "。\n\n"
            : ""
        }感谢您审阅我的申请，期待有机会进一步交流我的经历与岗位需求。\n\n此致\n${
          stripHtml(r.data.basic_info.name) || "[姓名]"
        }`;
  return {
    resume_id: r.id,
    company,
    job_title: jobTitle,
    locale,
    body,
    updated_at: nowISO(),
  };
}
