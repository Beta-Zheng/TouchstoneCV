import { describe, expect, it } from "vitest";
import { AUDIENCE_LABELS } from "../../types";
import { parseBackup } from "../backup";
import { buildSampleResume } from "../samples";
import { inspectResume } from "../workflow";
import { testBackup, testResume } from "./fixtures";

describe("求职场景规范", () => {
  it.each(["student", "internship", "experienced"] as const)(
    "%s 可保存并恢复",
    (audience) => {
      const backup = testBackup();
      backup.resumes[0].audience = audience;
      expect(
        parseBackup(JSON.stringify(backup), [], "hydrate").resumes[0].audience
      ).toBe(audience);
    }
  );

  it("旧转行简历及快照归入社招，保留内容", () => {
    const backup = testBackup();
    backup.resumes[0].audience = "career_change" as never;
    backup.snapshots = [
      {
        id: "snapshot_test",
        resume_id: "resume_test",
        label: "旧版本",
        kind: "manual",
        created_at: backup.resumes[0].created_at,
        resume: structuredClone(backup.resumes[0]),
      },
    ];
    for (const mode of ["hydrate", "restore"] as const) {
      const result = parseBackup(JSON.stringify(backup), [], mode);
      expect(result.resumes[0].audience).toBe("experienced");
      expect(result.snapshots![0].resume.audience).toBe("experienced");
      expect(result.resumes[0].data).toEqual(backup.resumes[0].data);
    }
  });

  it.each(["student", "internship"] as const)(
    "%s 示例符合学生身份，检查教育经历",
    (audience) => {
      for (const kind of ["ai", "frontend", "data"] as const) {
        const resume = testResume();
        resume.audience = audience;
        resume.data = buildSampleResume(kind, audience);
        expect(resume.data.basic_info.title).not.toMatch(/高级|资深/);
        const text = JSON.stringify(resume.data.sections);
        expect(text).not.toMatch(/年.*经验|80 万|负责人|组长|核心维护者/);
        expect(
          resume.data.sections.some((s) => s.type === "work_experience")
        ).toBe(false);
        expect(
          inspectResume(resume).some((issue) => issue.id === "experience")
        ).toBe(false);
        resume.data.sections = resume.data.sections.filter(
          (s) => s.type !== "education"
        );
        expect(
          inspectResume(resume).some((issue) => issue.id === "education")
        ).toBe(true);
      }
      expect(Object.values(AUDIENCE_LABELS)).toEqual(["校招", "实习", "社招"]);
    }
  );
});
