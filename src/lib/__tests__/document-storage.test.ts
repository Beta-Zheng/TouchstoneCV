import { describe, it, expect, vi } from "vitest";
import {
  packDocument,
  unpackDocument,
  createDocumentStorage,
  type DocumentBackend,
  type PackedDocument,
} from "../document-storage";
import { testResume } from "./fixtures";

function setup() {
  let stored: PackedDocument | null = null;
  const backend: DocumentBackend = {
    read: vi.fn(async () => stored),
    write: vi.fn(async (_name, doc) => {
      stored = structuredClone(doc);
    }),
    remove: vi.fn(async () => {
      stored = null;
    }),
  };
  const legacy = {
    getItem: vi.fn((): string | null => null),
    removeItem: vi.fn(),
    setItem: vi.fn(),
  } as unknown as Storage;
  const status = vi.fn();
  const control = createDocumentStorage<{ text: string }>(
    backend,
    () => legacy,
    status,
    (state) => {
      if (typeof state.text !== "string") throw new Error("Invalid text");
      return state;
    }
  );
  return { backend, legacy, status, ...control };
}
describe("分离文档存储与安全迁移", () => {
  it("40 个版本共享图片、原文和未修改条目，重新读取不丢内容", async () => {
    const resume = testResume();
    resume.data.avatar_url = "data:image/png;base64," + "a".repeat(20000);
    resume.data.metadata.source_text = "原始经历".repeat(10000);
    const value = {
      state: {
        resumes: [resume],
        snapshots: Array.from({ length: 40 }, (_, i) => ({
          id: `s${i}`,
          resume: structuredClone(resume),
        })),
      },
      version: 0,
    };
    const packed = await packDocument(value);
    expect(packed.assets.size).toBe(2);
    expect(packed.records.size).toBe(3);
    expect(unpackDocument(packed)).toEqual(value);
    const bytes =
      JSON.stringify(packed.manifest).length +
      JSON.stringify([...packed.assets]).length +
      JSON.stringify([...packed.records]).length;
    expect(bytes).toBeLessThan(JSON.stringify(value).length / 10);
  });
  it("资产或记录缺失时拒绝部分恢复", async () => {
    const r = testResume();
    r.data.metadata.source_text = "原文";
    const document = await packDocument(r);
    document.assets.clear();
    expect(() => unpackDocument(document)).toThrow("Missing document asset");
  });
  it("迁移提交成功之后才删除旧数据", async () => {
    const { storage, backend, legacy } = setup();
    vi.mocked(legacy.getItem).mockReturnValue(
      '{"state":{"text":"旧简历"},"version":0}'
    );
    expect(await storage.getItem("resume")).toEqual({
      state: { text: "旧简历" },
      version: 0,
    });
    expect(backend.write).toHaveBeenCalledOnce();
    expect(legacy.removeItem).toHaveBeenCalledWith("resume");
    expect(await storage.getItem("resume")).toEqual({
      state: { text: "旧简历" },
      version: 0,
    });
  });
  it("迁移失败仍读取旧数据并支持重试，不删除旧副本", async () => {
    const { storage, backend, legacy, flush, status } = setup();
    vi.mocked(legacy.getItem).mockReturnValue('{"state":{"text":"旧简历"}}');
    vi.mocked(backend.write).mockRejectedValueOnce(new Error("quota"));
    expect(await storage.getItem("resume")).toEqual({
      state: { text: "旧简历" },
    });
    expect(legacy.removeItem).not.toHaveBeenCalled();
    expect(status).toHaveBeenLastCalledWith("error");
    await flush();
    expect(status).toHaveBeenLastCalledWith("saved");
  });
  it("损坏数据不覆盖，显式恢复才允许保存", async () => {
    const { storage, backend, legacy, flush, allowRecovery } = setup();
    vi.mocked(legacy.getItem).mockReturnValue("broken JSON");
    expect(await storage.getItem("resume")).toBeNull();
    storage.setItem("resume", { state: { text: "default" } });
    await flush();
    expect(backend.write).not.toHaveBeenCalled();
    allowRecovery();
    storage.setItem("resume", { state: { text: "restored" } });
    await flush();
    expect(unpackDocument(vi.mocked(backend.write).mock.calls[0][1])).toEqual({
      state: { text: "restored" },
    });
  });
  it("写入失败保留最新版本，重试后才显示已保存", async () => {
    const { storage, backend, flush, status } = setup();
    vi.mocked(backend.write).mockRejectedValueOnce(new Error("quota"));
    storage.setItem("resume", { state: { text: "a" } });
    await flush();
    expect(status).toHaveBeenLastCalledWith("error");
    storage.setItem("resume", { state: { text: "b" } });
    await flush();
    expect(status).toHaveBeenLastCalledWith("saved");
    expect(await storage.getItem("resume")).toEqual({ state: { text: "b" } });
  });
  it("异步写入串行，旧请求不会覆盖新编辑", async () => {
    const { storage, backend, flush } = setup();
    let release!: () => void;
    vi.mocked(backend.write).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        })
    );
    storage.setItem("resume", { state: { text: "a" } });
    const first = flush();
    await vi.waitFor(() => expect(release).toBeDefined());
    storage.setItem("resume", { state: { text: "b" } });
    const second = flush();
    release();
    await Promise.all([first, second]);
    expect(backend.write).toHaveBeenCalledTimes(2);
    expect(await storage.getItem("resume")).toEqual({ state: { text: "b" } });
  });
});
