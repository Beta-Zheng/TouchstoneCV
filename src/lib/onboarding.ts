export const GUIDE_STORAGE_KEY = "touchstonecv-usage-guide";
export type GuideDecision = "started" | "skipped" | "completed" | "existing";
type GuideStorage = Pick<Storage, "getItem" | "setItem">;

/** This device preference is independent of resume backups and clear-all. */
export function createGuidePreferences(getStorage: () => GuideStorage) {
  let sessionDecision: GuideDecision | null = null;
  return {
    read(): GuideDecision | null {
      try {
        const raw = getStorage().getItem(GUIDE_STORAGE_KEY);
        if (!raw) return sessionDecision;
        const value: unknown = JSON.parse(raw);
        if (
          value &&
          typeof value === "object" &&
          "version" in value &&
          value.version === 1 &&
          "decision" in value &&
          typeof value.decision === "string" &&
          ["started", "skipped", "completed", "existing"].includes(
            value.decision
          )
        )
          return value.decision as GuideDecision;
      } catch {
        /* A blocked browser preference must not block resume work. */
      }
      return sessionDecision;
    },
    remember(decision: GuideDecision) {
      sessionDecision = decision;
      try {
        getStorage().setItem(
          GUIDE_STORAGE_KEY,
          JSON.stringify({ version: 1, decision })
        );
        return true;
      } catch {
        return false;
      }
    },
  };
}

export function shouldOfferGuide(
  hasSavedWork: boolean,
  decision: GuideDecision | null
) {
  return !hasSavedWork && decision === null;
}

export const GUIDE_STEPS = [
  {
    title: "先建一份简历",
    text: "选择求职场景，从示例或已有简历开始。",
    label: "创建",
    entry: "工作台 → 新建简历",
  },
  {
    title: "写成果，看预览",
    text: "改一条成果，看看简历怎样同步变化。",
    label: "编辑",
    entry: "简历编辑页 → 内容与预览",
  },
  {
    title: "给岗位准备一份副本",
    text: "按岗位修改，主简历保持原样。",
    label: "岗位",
    entry: "求职流程 → 选择岗位",
  },
  {
    title: "记住投递的是哪一版",
    text: "实际投递后，记录并固定当时的内容。",
    label: "投递",
    entry: "导出文件并自行投递 → 记录投递",
  },
  {
    title: "有回复，再更新进度",
    text: "手动记录面试与结果，方便下次跟进。",
    label: "反馈",
    entry: "投递记录 → 编辑 → 状态与反馈",
  },
] as const;

export function openUsageGuide() {
  window.dispatchEvent(new Event("touchstonecv-open-guide"));
}
