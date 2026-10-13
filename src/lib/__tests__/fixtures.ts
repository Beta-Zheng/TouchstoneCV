import type { Block, Resume } from "../../types";
import { defaultModels } from "../ai";
import type { BackupData } from "../backup";

export const testBlock = (): Block => ({ block_id: "block_test", type: "work_experience_item", title: "公司", subtitle: "工程师",
  start_date: "2021-03", end_date: "至今", location: "", description: "", bullets: ["负责服务优化，耗时降低约 20%"],
  skills: ["React"], links: [], visible: true, order: 0 });
export const testResume = (): Resume => ({ id: "resume_test", title: "测试简历", template_id: "modern_single_column",
  created_at: "2026-10-13T00:00:00.000Z", updated_at: "2026-10-13T00:00:00.000Z",
  theme: { primary_color: "#4F46E5", font_size: 14 }, data: {
    basic_info: { name: "测试", title: "工程师", email: "", phone: "", location: "", website: "" },
    sections: [{ section_id: "section_test", type: "work_experience", title: "工作经历", visible: true, order: 0, blocks: [testBlock()] }],
    metadata: { source: "empty", created_at: "2026-10-13T00:00:00.000Z" },
  } });
export const testBackup = (): BackupData => ({ resumes: [testResume()], jds: {}, suggestions: [], models: defaultModels(),
  privacy: { allowExternal: false, route: "local_first" } });
