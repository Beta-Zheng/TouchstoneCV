import type { Resume, Section } from "../types";
import { blockHasContent, localizedResume } from "./workflow";

export interface PageLayout {
  resume: Resume;
  oversized: boolean;
  height: number;
  usedHeight?: number;
  capacity?: number;
}
export function paginateResume(
  resume: Resume,
  heights: Record<string, number>,
  headerHeight: number,
  sectionHeights: Record<string, number>,
  capacity = 1035
): PageLayout[] {
  const r = localizedResume(resume);
  const pages: PageLayout[] = [];
  let sections: Section[] = [];
  let used = headerHeight;
  let oversized = headerHeight > capacity;
  const finish = () => {
    const basic = r.data.sections.find((s) => s.type === "basic_info");
    pages.push({
      resume: {
        ...r,
        data: {
          ...r.data,
          sections: [
            {
              ...(basic ?? {
                section_id: "page-contact",
                type: "basic_info",
                title: "基本信息",
                blocks: [],
                order: -1,
              }),
              visible: pages.length === 0 && (basic?.visible ?? true),
            } as Section,
            ...sections,
          ],
        },
      },
      oversized,
      height: 1123 + Math.max(0, used - capacity),
      usedHeight: used,
      capacity,
    });
    sections = [];
    used = 0;
    oversized = false;
  };
  for (const s of r.data.sections
    .filter((s) => s.visible && s.type !== "basic_info")
    .sort((a, b) => a.order - b.order)) {
    const blocks = s.blocks
      .filter((b) => b.visible && blockHasContent(b))
      .sort((a, b) => a.order - b.order);
    const heading = sectionHeights[s.section_id] ?? 50;
    let group: Section | null = null;
    for (const b of blocks) {
      const height = heights[b.block_id] ?? 120;
      if (
        used + height + (group ? 0 : heading) > capacity &&
        (sections.length > 0 || used > 0)
      ) {
        finish();
        group = null;
      }
      if (!group) {
        group = { ...s, blocks: [] };
        sections.push(group);
        used += heading;
      }
      group.blocks.push(b);
      used += height;
      if (used > capacity) oversized = true;
    }
  }
  if (sections.length || !pages.length) finish();
  return pages;
}
