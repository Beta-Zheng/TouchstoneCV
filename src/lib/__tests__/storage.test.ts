import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { createBufferedStorage } from "../storage";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
describe("持久化保存可靠性", () => {
  const setup = () => {
    const disk = { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn() } as unknown as Storage;
    const status = vi.fn();
    return { disk, status, ...createBufferedStorage<{ text: string }>(() => disk, status) };
  };
  it("连续编辑仅写入最新内容，成功之前不标记已保存", () => {
    const { disk, status, storage } = setup();
    storage.setItem("test", { state: { text: "a" } });
    vi.advanceTimersByTime(400);
    storage.setItem("test", { state: { text: "b" } });
    expect(disk.setItem).not.toHaveBeenCalled();
    expect(status).not.toHaveBeenCalledWith("saved");
    vi.advanceTimersByTime(800);
    expect(disk.setItem).toHaveBeenCalledExactlyOnceWith("test", JSON.stringify({ state: { text: "b" } }));
    expect(status).toHaveBeenLastCalledWith("saved");
  });
  it("临时 UI 更新不触发持久化", () => {
    const { disk, storage, flush } = setup();
    storage.setItem("test", { state: { text: "same" } }); flush();
    storage.setItem("test", { state: { text: "same" } }); flush();
    expect(disk.setItem).toHaveBeenCalledTimes(1);
  });
  it("容量失败保留待保存内容，并能重试", () => {
    const { disk, status, storage, flush } = setup();
    vi.mocked(disk.setItem).mockImplementationOnce(() => { throw new DOMException("quota", "QuotaExceededError"); });
    storage.setItem("test", { state: { text: "keep me" } }); flush();
    expect(status).toHaveBeenLastCalledWith("error");
    flush();
    expect(disk.setItem).toHaveBeenLastCalledWith("test", JSON.stringify({ state: { text: "keep me" } }));
    expect(status).toHaveBeenLastCalledWith("saved");
  });
  it("离开页面前可立即刷新待保存内容", () => {
    const { disk, storage, flush } = setup();
    storage.setItem("test", { state: { text: "final" } }); flush();
    expect(disk.setItem).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(800);
    expect(disk.setItem).toHaveBeenCalledTimes(1);
  });
  it("损坏的本机数据不会被默认状态覆盖，明确恢复后才写入", () => {
    const disk = { getItem: vi.fn(() => "broken JSON"), setItem: vi.fn(), removeItem: vi.fn() } as unknown as Storage;
    const status = vi.fn();
    const { storage, flush, allowRecovery } = createBufferedStorage<{ text: string }>(() => disk, status);
    expect(storage.getItem("test")).toBeNull();
    storage.setItem("test", { state: { text: "default" } }); flush();
    expect(disk.setItem).not.toHaveBeenCalled();
    expect(status).toHaveBeenLastCalledWith("error");
    allowRecovery();
    storage.setItem("test", { state: { text: "restored" } }); flush();
    expect(disk.setItem).toHaveBeenCalledExactlyOnceWith("test", JSON.stringify({ state: { text: "restored" } }));
  });
  it("启动时校验本机数据结构", () => {
    const disk = { getItem: () => '{"state":{"text":null},"version":0}', setItem: vi.fn() } as unknown as Storage;
    const status = vi.fn();
    const { storage } = createBufferedStorage<{ text: string }>(() => disk, status, 800, (state) => {
      if (typeof state.text !== "string") throw new Error("invalid");
      return state;
    });
    expect(storage.getItem("test")).toBeNull();
    expect(status).toHaveBeenCalledWith("error");
  });
});
