import { describe, expect, it } from "vitest";
import {
  createGuidePreferences,
  GUIDE_STORAGE_KEY,
  shouldOfferGuide,
} from "../onboarding";

function disk(initial?: string) {
  const values = new Map<string, string>(
    initial ? [[GUIDE_STORAGE_KEY, initial]] : []
  );
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe("首次访问使用指南", () => {
  it("只有没有使用记录且未做选择时询问", () => {
    expect(shouldOfferGuide(false, null)).toBe(true);
    expect(shouldOfferGuide(true, null)).toBe(false);
  });
  it.each(["started", "skipped", "completed", "existing"] as const)(
    "%s 在新会话恢复后不再弹出",
    (decision) => {
      const storage = disk();
      const first = createGuidePreferences(() => storage);
      expect(first.remember(decision)).toBe(true);
      const returning = createGuidePreferences(() => storage);
      expect(returning.read()).toBe(decision);
      expect(shouldOfferGuide(false, returning.read())).toBe(false);
    }
  );
  it("存储被浏览器阻止时会话内仍记住选择，不阻止使用", () => {
    const preferences = createGuidePreferences(() => {
      throw new Error("blocked");
    });
    expect(preferences.read()).toBeNull();
    expect(preferences.remember("skipped")).toBe(false);
    expect(preferences.read()).toBe("skipped");
  });
  it.each([
    "bad json",
    '{"version":99,"decision":"completed"}',
    '{"version":1,"decision":"unknown"}',
    '{"version":1,"decision":["completed"]}',
  ])("非法偏好不崩溃且不会未经选择覆盖：%s", (raw) => {
    const storage = disk(raw);
    const preferences = createGuidePreferences(() => storage);
    expect(preferences.read()).toBeNull();
    expect(storage.getItem(GUIDE_STORAGE_KEY)).toBe(raw);
  });
  it("偏好不接触简历存储，清空简历不会清空指南选择", () => {
    const storage = disk();
    storage.setItem("ai-resume-workbench-v1", "resume-data");
    createGuidePreferences(() => storage).remember("completed");
    expect(storage.getItem("ai-resume-workbench-v1")).toBe("resume-data");
    expect(createGuidePreferences(() => storage).read()).toBe("completed");
  });
});
