import type { Resume } from "../types";

export function resumeVersionContent(resume: Resume) {
  const { updated_at: _updated, archived_at: _archived, ...content } = resume;
  return JSON.stringify(content);
}

export function versionSummary(
  previous: Resume | undefined,
  current: Resume
): string {
  if (!previous) return "首次保存的版本";
  const changes: string[] = [];
  if (previous.title !== current.title) changes.push("名称");
  if (
    JSON.stringify(previous.data.basic_info) !==
    JSON.stringify(current.data.basic_info)
  )
    changes.push("基本信息");
  const sectionIds = new Set(
    [...previous.data.sections, ...current.data.sections].map(
      (s) => s.section_id
    )
  );
  for (const id of sectionIds) {
    const before = previous.data.sections.find((s) => s.section_id === id);
    const after = current.data.sections.find((s) => s.section_id === id);
    if (JSON.stringify(before) !== JSON.stringify(after))
      changes.push(after?.title ?? before?.title ?? "栏目");
  }
  if (
    previous.template_id !== current.template_id ||
    JSON.stringify(previous.theme) !== JSON.stringify(current.theme)
  )
    changes.push("模板与排版");
  if (
    previous.locale !== current.locale ||
    previous.audience !== current.audience
  )
    changes.push("语言与求职场景");
  return changes.length
    ? `修改：${[...new Set(changes)].join("、")}`
    : "保存当前内容与岗位要求";
}
