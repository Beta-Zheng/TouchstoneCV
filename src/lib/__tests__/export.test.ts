import { describe, it, expect } from "vitest";
import { generateDocx, resumeText } from "../export";
import { testResume } from "./fixtures";
import { extractRawText } from "mammoth";

describe("本地文档导出", () => {
  it("TXT 保留大小写、顺序和数字，并排除隐藏内容", () => {
    const r = testResume();
    r.data.sections[0].blocks[0].bullets = ["React API <b>20%</b>"];
    expect(resumeText(r)).toContain("React API 20%");
    r.data.sections[0].visible = false;
    expect(resumeText(r)).not.toContain("React");
  });
  it("生成的 DOCX 可由独立解析器读取，XML 特殊字符不破坏内容", async () => {
    const r = testResume();
    r.locale = "en";
    r.data.basic_info.name = "A & B <Team>";
    const output = await generateDocx(r);
    // Mammoth's browser entry reads arrayBuffer; its Node entry reads buffer.
    const input = { arrayBuffer: output, buffer: new Uint8Array(output) };
    const parsed = await extractRawText(input);
    expect(parsed.value).toContain("A & B <Team>");
    expect(parsed.value).toContain("Experience");
    expect(parsed.value).toContain("Present");
    expect(parsed.value).toContain("耗时降低约 20%");
  });
});
