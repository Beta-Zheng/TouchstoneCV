import { describe, it, expect } from "vitest";
import {
  completion,
  moduleFilled,
  inspectResume,
  localizedResume,
  createCoverLetterDraft,
  hasReviewedTarget,
} from "../workflow";
import { paginateResume } from "../pagination";
import { testBlock, testResume } from "./fixtures";
import { emptyResume } from "../parser";
import { buildSampleResume } from "../samples";
import { hashView, viewHash } from "../navigation";
import { moveDraftBlock } from "../../components/import-review";
import { parseJD } from '../jd';
import type { ResumeSnapshot } from '../../types';

describe("简历核心流程", () => {
  it("空白条目不会提高完成度，姓名单独存在不算基本信息完成", () => {
    const r = testResume();
    r.data = emptyResume();
    r.data.basic_info.name = "姓名";
    r.data.sections
      .find((s) => s.type === "work_experience")!
      .blocks.push({
        ...testBlock(),
        title: "",
        subtitle: "",
        description: "",
        bullets: [],
        skills: [],
      });
    expect(completion(r)).toBe(0);
    expect(moduleFilled(r, "work_experience")).toBe(false);
  });
  it("应届生可以用项目经历满足经历要求，不强制工作经历", () => {
    const r = testResume();
    r.audience = "student";
    r.data = buildSampleResume("frontend", "student");
    expect(completion(r)).toBe(100);
    expect(inspectResume(r).find((i) => i.id === "experience")).toBeUndefined();
  });
  it("检查识别联系方式错误、逆序日期与空白条目", () => {
    const r = testResume();
    r.data.basic_info.email = "bad email";
    r.data.sections[0].blocks[0].end_date = "2020-01";
    expect(inspectResume(r).map((i) => i.id)).toEqual(
      expect.arrayContaining(["email", "date-order-block_test"])
    );
  });
  it('示例电话和邮箱必须人工核对，不把非示例地址误报',()=>{
    const r=testResume();r.data.basic_info.phone='138-XXXX-XXXX';r.data.basic_info.email='hello@example.com';
    expect(inspectResume(r).map(i=>i.id)).toEqual(expect.arrayContaining(['placeholder-phone','placeholder-email']));
    r.data.basic_info.phone='13812345678';r.data.basic_info.email='hello@company.cn';
    expect(inspectResume(r).some(i=>i.id.startsWith('placeholder'))).toBe(false);
  });
  it('岗位核对仅适用于确认的内容和JD，创建副本或导出不算确认',()=>{
    const r=testResume();const jd=parseJD('工程师，熟悉React',r.id);
    const snapshot={id:'review',resume_id:r.id,kind:'manual',label:'岗位内容已核对',created_at:r.updated_at,resume:structuredClone(r),jd} as ResumeSnapshot;
    expect(hasReviewedTarget(r,jd,[])).toBe(false);
    expect(hasReviewedTarget(r,jd,[snapshot])).toBe(true);
    expect(hasReviewedTarget(r,parseJD('工程师，熟悉Java',r.id),[snapshot])).toBe(false);
    r.data.basic_info.title='新岗位';
    expect(hasReviewedTarget(r,jd,[snapshot])).toBe(false);
  });
  it("英文版式转换标准模块名与至今，不改写事实", () => {
    const r = testResume();
    r.locale = "en";
    const localized = localizedResume(r);
    expect(localized.data.sections[0].title).toBe("Experience");
    expect(localized.data.sections[0].blocks[0].end_date).toBe("Present");
    expect(localized.data.sections[0].blocks[0].bullets).toEqual(
      r.data.sections[0].blocks[0].bullets
    );
    expect(r.data.sections[0].title).toBe("工作经历");
  });
  it("求职信只引用可见的既有经历", () => {
    const r = testResume();
    const letter = createCoverLetterDraft(r, "公司", "工程师");
    expect(letter.body).toContain("耗时降低约 20%");
    r.data.sections[0].visible = false;
    expect(createCoverLetterDraft(r, "公司", "工程师").body).not.toContain(
      "耗时降低约 20%"
    );
  });
  it("导入核对移动条目保留事实、更新类型和顺序", () => {
    const data = testResume().data;
    data.sections.push({
      section_id: "project",
      type: "project_experience",
      title: "项目",
      blocks: [],
      order: 1,
      visible: true,
    });
    const moved = moveDraftBlock(data, "section_test", "block_test", "project");
    expect(moved.sections[0].blocks).toHaveLength(0);
    expect(moved.sections[1].blocks[0]).toMatchObject({
      block_id: "block_test",
      type: "project_experience_item",
      title: "公司",
      order: 0,
    });
    expect(data.sections[0].blocks).toHaveLength(1);
  });
  it("按条目分页，不丢失、不重复内容，只有第一页显示基本信息", () => {
    const r = testResume();
    r.data.sections[0].blocks.push({
      ...testBlock(),
      block_id: "second",
      order: 1,
    });
    const pages = paginateResume(
      r,
      { block_test: 600, second: 600 },
      100,
      { section_test: 50 },
      1000
    );
    expect(pages).toHaveLength(2);
    expect(
      pages.flatMap((p) =>
        p.resume.data.sections.flatMap((s) => s.blocks.map((b) => b.block_id))
      )
    ).toEqual(["block_test", "second"]);
    expect(pages.map((p) => p.resume.data.sections[0].visible)).toEqual([
      true,
      false,
    ]);
    expect(pages.every((p) => !p.oversized)).toBe(true);
  });
  it("过长条目标记为超出页面，不能静默截断", () => {
    const pages = paginateResume(
      testResume(),
      { block_test: 1800 },
      0,
      { section_test: 40 },
      1000
    );
    expect(pages[0].oversized).toBe(true);
    expect(pages[0].resume.data.sections[1].blocks[0].bullets).toEqual(
      testBlock().bullets
    );
  });
  it("路由可往返，并拒绝非法路径", () => {
    expect(
      hashView(viewHash({ name: "editor", resumeId: "resume_test" }))
    ).toEqual({ name: "editor", resumeId: "resume_test" });
    expect(hashView("#/editor/%ZZ")).toBeNull();
    expect(hashView("#/unknown")).toBeNull();
  });
});
