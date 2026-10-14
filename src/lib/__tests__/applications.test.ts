import { describe, expect, it } from "vitest";
import type { Application } from "../../types";
import { applicationStats } from "../applications";
const base: Application = {
  id: "one",
  resume_id: "resume_test",
  company: "公司",
  role: "岗位",
  url: "",
  status: "applied",
  notes: "",
  applied_at: "2026-10-14",
  follow_up_at: "2026-10-14",
  created_at: "2026-10-14T00:00:00Z",
  updated_at: "2026-10-14T00:00:00Z",
};
describe("投递统计口径", () => {
  it("旧记录中已知的面试状态在后续结束后仍计数，不推断时间", () => {
    const stats = applicationStats(
      [
        {
          ...base,
          status: "closed",
          events: [
            {
              id: "old",
              status: "interview",
              at: base.updated_at,
              note: "此前历史未知",
              legacy: true,
            },
          ],
        },
      ],
      "2026-10-14"
    );
    expect(stats.interviews).toBe(1);
    expect(stats.offers).toBe(0);
  });
  it("无回复不是拒绝，缺日期不参与趋势，不推断面试", () => {
    const stats = applicationStats(
      [base, { ...base, id: "two", status: "offer", applied_at: "" }],
      "2026-10-14"
    );
    expect(stats.counts.rejected).toBe(0);
    expect(stats.interviews).toBe(0);
    expect(stats.offers).toBe(1);
    expect(stats.followups).toBe(1);
    expect(stats.weeks[stats.weeks.length - 1]?.count).toBe(1);
  });
  it("终止状态不提醒，历史面试保留，未投递撤回不算已投递", () => {
    const stats = applicationStats(
      [
        {
          ...base,
          status: "rejected",
          events: [
            {
              id: "event_one",
              status: "interview",
              at: base.created_at,
              note: "一面",
            },
          ],
        },
        { ...base, id: "two", status: "withdrawn", applied_at: "" },
        { ...base, id: "three", status: "closed" },
      ],
      "2026-10-14"
    );
    expect(stats.interviews).toBe(1);
    expect(stats.submitted).toBe(2);
    expect(stats.followups).toBe(0);
  });
});
