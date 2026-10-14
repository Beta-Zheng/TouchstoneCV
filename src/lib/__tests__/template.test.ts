import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { A4Sheet } from "../../components/template";
import { testResume } from "./fixtures";

describe("基本信息格式与预览一致", () => {
  it.each(["modern_single_column", "classic_ats", "academic_photo"])("%s 不显示加粗标记，保留姓名与职位", template => {
    const resume = testResume(); resume.template_id = template;
    resume.data.basic_info.name = "**验证姓名**";
    resume.data.basic_info.title = "**前端工程师**";
    const markup = renderToStaticMarkup(createElement(A4Sheet, { resume }));
    expect(markup).not.toContain("**");
    expect(markup).toContain("验证姓名"); expect(markup).toContain("前端工程师");
    expect(markup).toContain("<strong");
  });
});
