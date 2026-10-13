import { describe, it, expect } from "vitest";
import { createBackup, parseBackup } from "../backup";
import { testBackup, testResume } from "./fixtures";
import { buildSampleResume } from "../samples";

describe("备份与恢复边界", () => {
  it("导出排除密钥且不修改当前模型", () => {
    const data = testBackup();
    data.models[0].api_key = "test-secret";
    expect(JSON.stringify(createBackup(data))).not.toContain("test-secret");
    expect(createBackup(data).models[0]).not.toHaveProperty("api_key");
    expect(data.models[0].api_key).toBe("test-secret");
  });
  it("恢复保留同一服务的本机密钥，关闭外部调用", () => {
    const data = testBackup();
    data.models[0].api_key = "local-secret";
    data.privacy.allowExternal = true;
    const result = parseBackup(JSON.stringify(createBackup(data)), data.models);
    expect(result.models[0].api_key).toBe("local-secret");
    expect(result.privacy.allowExternal).toBe(false);
  });
  it("旧备份携带的密钥不会覆盖本机，也不转移到新服务", () => {
    const data = testBackup();
    const current = structuredClone(data.models);
    current[0].api_key = "local-secret";
    data.models[0].api_key = "untrusted-secret";
    data.models[0].base_url = "https://other.example/v1";
    expect(parseBackup(JSON.stringify(data), current).models[0].api_key).toBe("");
    expect(parseBackup(JSON.stringify(data), current).models[0].enabled).toBe(false);
  });
  it("刷新时保留本机密钥与隐私设置", () => {
    const data = testBackup();
    data.models[0].api_key = "local-secret";
    data.privacy.allowExternal = true;
    const result = parseBackup(JSON.stringify(data), [], "hydrate");
    expect(result.models[0].api_key).toBe("local-secret");
    expect(result.privacy.allowExternal).toBe(true);
  });
  it("当前示例与旧版备份仍能恢复", () => {
    const data = testBackup();
    data.resumes[0] = { ...testResume(), data: buildSampleResume() };
    expect(parseBackup(JSON.stringify(createBackup(data)), []).resumes).toEqual(data.resumes);
    expect(parseBackup(JSON.stringify({ resumes: [] }), []).resumes).toEqual([]);
  });
  it.each([
    { resumes: [{}] }, { resumes: [null] }, { resumes: [], suggestions: {} }, { resumes: [], version: 99 },
    { resumes: [testResume(), testResume()] },
    { resumes: [], privacy: { allowExternal: "yes", route: "local_only" } },
    { resumes: [], jds: { missing: {} } },
  ])("拒绝畸形结构或版本：%j", (data) => {
    expect(() => parseBackup(JSON.stringify(data), [])).toThrow();
  });
  it("拒绝非法枚举、过大字段、重复条目和远程图片", () => {
    for (const modify of [
      (data: ReturnType<typeof testBackup>) => { data.resumes[0].theme.font_family = "unknown" as never; },
      (data: ReturnType<typeof testBackup>) => { data.resumes[0].title = "x".repeat(100001); },
      (data: ReturnType<typeof testBackup>) => { const s = data.resumes[0].data.sections[0]; s.blocks.push(s.blocks[0]); },
      (data: ReturnType<typeof testBackup>) => { data.resumes[0].data.avatar_url = "https://tracker.example/image"; },
    ]) {
      const data = testBackup(); modify(data);
      expect(() => parseBackup(JSON.stringify(data), [])).toThrow();
    }
  });
});
