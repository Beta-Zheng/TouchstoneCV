import { afterEach, describe, it, expect, vi } from "vitest";
import { generateWithLLM, defaultModels, ruleSuggestion } from "../ai";
import { testBlock } from "./fixtures";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const provider = () => ({ ...defaultModels()[1], timeout_ms: 100 });
const response = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }] }));
describe("AI 请求与事实保护", () => {
  it("鉴权错误保留 HTTP 原因且不重复请求", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("secret-server-detail", { status: 401 }));
    vi.stubGlobal("fetch", fetch);
    await expect(generateWithLLM(provider(), "polish", testBlock(), "", null)).rejects.toThrow("HTTP 401");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("网络错误不被改写为 JSON 校验失败", async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch")); vi.stubGlobal("fetch", fetch);
    await expect(generateWithLLM(provider(), "polish", testBlock(), "", null)).rejects.toThrow("Failed to fetch");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("只有模型输出格式错误才重试一次", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response("not JSON"))
      .mockResolvedValueOnce(response('{"suggested_block":{"title":"修改"},"explanation":"测试"}'));
    vi.stubGlobal("fetch", fetch);
    expect((await generateWithLLM(provider(), "polish", testBlock(), "", null)).suggested_block.title).toBe("修改");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("响应正文尚未读完时超时仍会中止请求", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_url, init) => {
      signal = init.signal;
      return Promise.resolve({ ok: true, json: () => new Promise((_resolve, reject) =>
        signal?.addEventListener("abort", () => reject(new DOMException("timeout", "AbortError")))) });
    }));
    const result = generateWithLLM(provider(), "polish", testBlock(), "", null);
    const assertion = expect(result).rejects.toThrow("timeout");
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(signal?.aborted).toBe(true);
  });
  it("润色保留职责强度和估算限定词", () => {
    const block = { ...testBlock(), bullets: ["负责约 20 人的服务，耗时降低 30% 左右", "参与了大概 3 个项目"] };
    const result = ruleSuggestion("polish", block, []);
    expect(result.suggested_block.bullets).toEqual(["负责约 20 人的服务，耗时降低 30% 左右", "参与大概 3 个项目"]);
  });
});
