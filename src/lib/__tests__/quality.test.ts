import { describe, it, expect } from "vitest";
import { buildResumeSummary, ruleSuggestion, defaultModels } from "../ai";
import { matchResume, matchResumeData, parseJD, jdEvidence } from "../jd";
import { createCoverLetterDraft, coverLetterEvidence } from "../workflow";
import { testResume, testBlock } from "./fixtures";

describe("能力边界与岗位证据", () => {
  it("首次使用不自动请求尚未验证可连接的本地模型", () => {
    expect(defaultModels().every((m) => !m.enabled)).toBe(true);
  });
  it("ATS 表达检查不会删除数学比较符号，量化检查不接受版本号", () => {
    const block = {
      ...testBlock(),
      bullets: ["使用 React 18 开发页面", "优化接口，延迟降低至 <100ms"],
    };
    expect(
      ruleSuggestion("ats_optimize", block, []).suggested_block.bullets[1]
    ).toContain("<100ms");
    expect(ruleSuggestion("quantify", block, []).warnings.join()).toContain(
      "React 18"
    );
  });
  it("同一句中的优先项不会把相邻必需项降级", () => {
    const r = testResume();
    const evidence = jdEvidence(
      r,
      parseJD("精通 React、TypeScript，Java 优先。", r.id)
    );
    expect(evidence.find((x) => x.term === "react")?.priority).toBe("必需");
    expect(evidence.find((x) => x.term === "typescript")?.priority).toBe(
      "必需"
    );
    expect(evidence.find((x) => x.term === "java")?.priority).toBe("优先");
  });
  it("模型上下文包含职位、经历、日期和成果，排除联系方式与隐藏条目", () => {
    const resume = testResume();
    resume.data.basic_info.email = "private@example.com";
    resume.data.sections[0].blocks.push({
      ...testBlock(),
      block_id: "hidden",
      visible: false,
      title: "不可发送",
    });
    const context = buildResumeSummary(resume.data);
    expect(context).toContain("目标职位：工程师");
    expect(context).toContain("2021-03–至今");
    expect(context).toContain("耗时降低约 20%");
    expect(context).not.toContain("private@example.com");
    expect(context).not.toContain("不可发送");
  });
  it("技术版本号和任意数字不算量化成果", () => {
    const jd = parseJD("熟悉 React 的工程师", "r");
    const version = matchResume("使用 React 18 开发项目", jd);
    const outcome = matchResume("使用 React 优化页面，耗时降低 20%", jd);
    expect(version.writing_quality_score).toBeLessThan(
      outcome.writing_quality_score
    );
    expect(matchResume("React 18", jd).writing_quality_score).toBeLessThan(50);
  });
  it("成果检查不把姓名、职位和技能字段当经历", () => {
    const r = testResume();
    r.data.basic_info.title = "降低 90%";
    r.data.sections[0].blocks[0].bullets = ["使用 React 18 开发项目"];
    const report = matchResumeData(r.data, parseJD("React 工程师", r.id));
    expect(report.writing_quality_score).toBeLessThan(50);
  });
  it("求职信按 JD 相关性选择真实证据，并包含用户的动机与贡献", () => {
    const r = testResume();
    r.data.sections[0].blocks[0].bullets = [
      "负责行政文书整理",
      "使用 React 优化页面，耗时降低 20%",
    ];
    const jd = parseJD("精通 React", r.id);
    expect(coverLetterEvidence(r, jd)[0]).toContain("React");
    const letter = createCoverLetterDraft(r, "目标企业", "前端工程师", {
      jd,
      evidence: [coverLetterEvidence(r, jd)[0], "并不存在的经历"],
      motivation: "我希望参与无障碍产品建设。",
      contribution: "我能把已验证的页面优化经验用于该岗位。",
    });
    expect(letter.body).toContain("无障碍产品建设");
    expect(letter.body).toContain("20%");
    expect(letter.body).not.toContain("行政文书");
    expect(letter.body).not.toContain("并不存在");
  });
  it("规则引擎不会伪造英文翻译，原始事实保留", () => {
    const result = ruleSuggestion("translate", testBlock(), []);
    expect(result.suggested_block).toEqual(testBlock());
    expect(result.warnings.join()).toContain("模型");
  });
});
