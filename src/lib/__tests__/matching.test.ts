import { describe, it, expect } from "vitest";
import { containsTerm, resumeToText } from "../utils";
import {
  matchResumeData,
  parseJD,
  matchResume,
  jdEvidence,
  qualificationEvidence,
} from "../jd";
import { testResume } from "./fixtures";

describe("匹配与可见内容一致性", () => {
  it("证据可定位条目，并区分必需与优先要求", () => {
    const r = testResume();
    const jd = parseJD("任职要求\n1. 精通 React\n2. Java 优先", r.id);
    const evidence = jdEvidence(r, jd);
    expect(evidence.find((e) => e.term === "react")).toMatchObject({
      priority: "必需",
      matches: [
        { sectionId: "section_test", blockId: "block_test", title: "公司" },
      ],
    });
    expect(evidence.find((e) => e.term === "java")).toMatchObject({
      priority: "优先",
      matches: [],
    });
  });
  it("工作年限去除重叠，日期缺失时不冒充已满足", () => {
    const r = testResume();
    const b = r.data.sections[0].blocks[0];
    b.start_date = "2020-01";
    b.end_date = "2022-12";
    r.data.sections[0].blocks.push({
      ...b,
      block_id: "second",
      start_date: "2021-01",
      end_date: "2023-12",
    });
    const jd = parseJD("工程师，3 年以上工作经验", r.id);
    expect(qualificationEvidence(r, jd)[0]).toMatchObject({
      status: "有依据",
      evidence: expect.stringContaining("3.9 年"),
    });
    b.end_date = "";
    expect(qualificationEvidence(r, jd)[0].status).toBe("待确认");
  });
  it.each([
    ["JavaScript", "Java"],
    ["Django", "Go"],
    ["GitHub", "Git"],
    ["C++", "C#"],
    ["C++", "C"],
  ])("%s 不误命中 %s", (text, term) => {
    expect(containsTerm(text, term)).toBe(false);
  });
  it.each([
    ["NodeJS", "Node.js"],
    ["Golang", "Go"],
    ["Kubernetes", "k8s"],
    ["熟悉性能优化", "性能优化"],
    ["React、Java", "Java"],
  ])("%s 命中 %s", (text, term) => {
    expect(containsTerm(text, term)).toBe(true);
  });
  it("隐藏模块和条目不参与匹配", () => {
    const data = testResume().data;
    const jd = parseJD("工程师，熟悉 React", "resume_test");
    expect(matchResumeData(data, jd).missing_skills).not.toContain("react");
    data.sections[0].blocks[0].visible = false;
    expect(matchResumeData(data, jd).missing_skills).toContain("react");
    data.sections[0].blocks[0].visible = true;
    data.sections[0].visible = false;
    expect(resumeToText(data)).not.toContain("react");
  });
  it("匹配报告不会把 JavaScript 和 Django 计为 Java / Go", () => {
    const jd = parseJD("工程师，熟悉 Java 和 Go", "resume_test");
    expect(matchResume("JavaScript Django", jd).missing_skills).toEqual(
      expect.arrayContaining(["java", "go"])
    );
  });
});
