import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { testBackup, testBlock, testResume } from "./fixtures";
import { createBackup, parseBackup, createResumeBackup } from "../backup";

const disk = vi.hoisted(() => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
  vi.stubGlobal("localStorage", storage);
  return storage;
});
import { useApp, flushSave, saveAutomaticVersions } from "../store";

const applicationFixture = () => ({
  id: "application_versions",
  resume_id: "resume_test",
  company: "测试公司",
  role: "工程师",
  url: "",
  status: "applied" as const,
  notes: "",
  applied_at: "2026-10-14",
  follow_up_at: "",
  created_at: testResume().created_at,
  updated_at: testResume().updated_at,
});

describe("版本与投递记录", () => {
  it("选择主简历栏目更新保留岗位职位、未选内容和投递快照", () => {
    const state = useApp.getState();
    const job = state.createJobVersion(
      "resume_test",
      "公司",
      "岗位职位",
      "React"
    )!;
    state.saveApplication({ ...applicationFixture(), resume_id: job });
    const snapshotId = useApp.getState().applications[0].snapshot_id;
    state.patchBlock("resume_test", "section_test", "block_test", {
      title: "主简历新经历",
    });
    state.patchBasic("resume_test", {
      name: "主简历姓名",
      title: "主简历目标",
    });
    expect(state.mergeSource(job, ["section_test"], false)).toBe(true);
    let updated = useApp.getState().resumes.find((r) => r.id === job)!;
    expect(updated.data.sections[0].blocks[0].title).toBe("主简历新经历");
    expect(updated.data.basic_info.name).toBe("测试");
    expect(state.mergeSource(job, [], true)).toBe(true);
    updated = useApp.getState().resumes.find((r) => r.id === job)!;
    expect(updated.data.basic_info.name).toBe("主简历姓名");
    expect(updated.data.basic_info.title).toBe("岗位职位");
    expect(
      useApp.getState().snapshots.find((s) => s.id === snapshotId)?.resume.data
        .sections[0].blocks[0].title
    ).toBe("公司");
    expect(
      useApp
        .getState()
        .snapshots.some(
          (s) => s.resume_id === job && s.label === "从主简历更新前保存"
        )
    ).toBe(true);
  });
  it("旧简历首次编辑前保留原始内容", () => {
    useApp.getState().patchBasic("resume_test", { name: "新版姓名" });
    expect(useApp.getState().snapshots[0].resume.data.basic_info.name).toBe(
      "测试"
    );
    saveAutomaticVersions();
    expect(useApp.getState().snapshots[0].resume.data.basic_info.name).toBe(
      "新版姓名"
    );
  });
  it("归档、反馈与岗位来源在合并恢复后保留正确关联", () => {
    const state = useApp.getState();
    const job = state.createJobVersion("resume_test", "公司", "岗位", "React")!;
    state.saveApplication(
      { ...applicationFixture(), resume_id: job },
      "收到回复"
    );
    state.archiveResume(job, true);
    const exported = createBackup(useApp.getState());
    expect(state.importData(JSON.stringify(exported), "merge")).toBe(true);
    const imported = useApp.getState().applications[0];
    const resume = useApp
      .getState()
      .resumes.find((r) => r.id === imported.resume_id)!;
    expect(resume.archived_at).toBeDefined();
    expect(resume.target?.source_updated_at).toBeDefined();
    expect(resume.target?.source_resume_id).not.toBe("resume_test");
    expect(imported.events?.[0].note).toBe("收到回复");
    expect(
      useApp.getState().snapshots.find((s) => s.id === imported.snapshot_id)
        ?.resume_id
    ).toBe(imported.resume_id);
  });
  it("主简历、岗位简历和副本创建初始快照，独立编辑", () => {
    const state = useApp.getState();
    const id = state.createResume(testResume().data, "主简历");
    const job = state.createJobVersion(id, "公司", "岗位", "React")!;
    state.duplicateResume(job);
    const resumes = useApp.getState().resumes;
    for (const resumeId of [id, job, resumes[0].id])
      expect(
        useApp
          .getState()
          .snapshots.some(
            (s) => s.resume_id === resumeId && s.kind === "initial"
          )
      ).toBe(true);
    state.patchBasic(job, { name: "岗位姓名" });
    expect(
      useApp.getState().resumes.find((r) => r.id === id)?.data.basic_info.name
    ).toBe("测试");
    expect(
      useApp.getState().resumes.find((r) => r.id === job)?.target
        ?.source_updated_at
    ).toBeDefined();
  });
  it("有变化才生成自动版本，并记录变更摘要", () => {
    saveAutomaticVersions();
    const count = useApp.getState().snapshots.length;
    saveAutomaticVersions();
    expect(useApp.getState().snapshots).toHaveLength(count);
    useApp.getState().patchBasic("resume_test", { name: "更新姓名" });
    saveAutomaticVersions();
    expect(useApp.getState().snapshots[0].kind).toBe("auto");
    expect(useApp.getState().snapshots[0].summary).toContain("基本信息");
    saveAutomaticVersions();
    expect(useApp.getState().snapshots).toHaveLength(count + 1);
  });
  it("实际投递固定快照，反馈追加且禁止改绑，包括回退到待投递后", () => {
    const state = useApp.getState();
    expect(state.saveApplication(applicationFixture())).toBe(true);
    const original = useApp.getState().applications[0];
    state.patchBasic("resume_test", { name: "后续修改" });
    expect(
      useApp.getState().snapshots.find((s) => s.id === original.snapshot_id)
        ?.resume.data.basic_info.name
    ).toBe("测试");
    expect(
      state.saveApplication({ ...original, status: "interview" }, "一面通知")
    ).toBe(true);
    const interviewing = useApp.getState().applications[0];
    expect(interviewing.events?.map((e) => e.status)).toEqual([
      "applied",
      "interview",
    ]);
    expect(state.saveApplication({ ...interviewing, status: "saved" })).toBe(
      true
    );
    expect(
      state.saveApplication({
        ...useApp.getState().applications[0],
        snapshot_id: undefined,
      })
    ).toBe(false);
    expect(useApp.getState().applications[0].snapshot_id).toBe(
      original.snapshot_id
    );
  });
  it("待投递和未投递的主动撤回不伪造投递快照", () => {
    const state = useApp.getState();
    expect(
      state.saveApplication({
        ...applicationFixture(),
        applied_at: "",
        status: "saved",
      })
    ).toBe(true);
    expect(useApp.getState().applications[0].snapshot_id).toBeUndefined();
    expect(
      state.saveApplication({
        ...useApp.getState().applications[0],
        status: "withdrawn",
      })
    ).toBe(true);
    expect(useApp.getState().applications[0].snapshot_id).toBeUndefined();
  });
  it("归档与恢复保留投递和快照，关联简历不能被硬删除", () => {
    const state = useApp.getState();
    state.saveApplication(applicationFixture());
    const snapshot = useApp.getState().applications[0].snapshot_id;
    state.deleteResume("resume_test");
    expect(useApp.getState().resumes[0].archived_at).toBeDefined();
    expect(useApp.getState().snapshots.some((s) => s.id === snapshot)).toBe(
      true
    );
    expect(useApp.getState().applications).toHaveLength(1);
    state.archiveResume("resume_test", false);
    expect(useApp.getState().resumes[0].archived_at).toBeUndefined();
  });
  it("初始快照和投递快照不受近期20份上限清理", () => {
    const state = useApp.getState();
    saveAutomaticVersions();
    const initial = useApp.getState().snapshots[0].id;
    state.saveApplication(applicationFixture());
    const linked = useApp.getState().applications[0].snapshot_id;
    for (let i = 0; i < 25; i++)
      state.captureSnapshot("resume_test", `编辑${i}`);
    expect(useApp.getState().snapshots.some((s) => s.id === initial)).toBe(
      true
    );
    expect(useApp.getState().snapshots.some((s) => s.id === linked)).toBe(true);
    expect(useApp.getState().snapshots).toHaveLength(22);
  });
  it("拒绝其他简历快照，旧记录编辑不伪造此前反馈", () => {
    const state = useApp.getState();
    const other = state.createResume(testResume().data);
    const foreign = useApp
      .getState()
      .snapshots.find((s) => s.resume_id === other)!.id;
    expect(
      state.saveApplication({ ...applicationFixture(), snapshot_id: foreign })
    ).toBe(false);
    useApp.setState({ applications: [applicationFixture()] });
    expect(
      state.saveApplication(
        { ...applicationFixture(), status: "interview" },
        "收到通知"
      )
    ).toBe(true);
    expect(useApp.getState().applications[0].events?.[0].legacy).toBe(true);
    expect(useApp.getState().applications[0].events?.[1].note).toBe("收到通知");
    const restored = parseBackup(
      JSON.stringify(createBackup(useApp.getState())),
      []
    );
    expect(restored.applications![0].events).toEqual(
      useApp.getState().applications[0].events
    );
  });
});

beforeEach(() => {
  vi.stubGlobal("localStorage", disk);
  vi.useFakeTimers();
  useApp.getState().clearAll();
  const data = testBackup();
  data.models = [{ ...data.models[1], enabled: true }];
  data.privacy.allowExternal = true;
  useApp.setState({
    ...data,
    pendingExternal: null,
    toasts: [],
    externalCallCount: 0,
  });
});
afterEach(() => {
  useApp.getState().clearAll();
  flushSave();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const request = () =>
  useApp
    .getState()
    .requestSuggestion("resume_test", "section_test", "block_test", "polish");
const currentBlock = () =>
  useApp.getState().resumes[0].data.sections[0].blocks[0];
const success = () => {
  const original = testBlock();
  useApp.setState({
    suggestions: [
      {
        id: "suggestion_test",
        resume_id: "resume_test",
        section_id: "section_test",
        block_id: "block_test",
        action: "polish",
        engine: "rules",
        provider_name: "test",
        status: "success",
        original,
        suggested: { ...original, title: "优化后的标题" },
        matched_keywords: [],
        warnings: [],
        created_at: testResume().created_at,
      },
    ],
  });
};

describe("真实 store 的 AI 与恢复流程", () => {
  it("无内容变化的检查提示不能标为已接受", () => {
    success();
    useApp.setState((s) => ({
      suggestions: s.suggestions.map((x) => ({ ...x, suggested: x.original })),
    }));
    expect(useApp.getState().acceptSuggestion("suggestion_test")).toBe(false);
    expect(useApp.getState().suggestions[0].resolution).toBeUndefined();
  });
  it.each(["merge", "replace"] as const)(
    "%s 恢复清理待确认批量队列计数",
    (mode) => {
      useApp.setState({ queuedSuggestionCount: 3 });
      request();
      expect(useApp.getState().pendingExternal).not.toBeNull();
      expect(
        useApp
          .getState()
          .importData(JSON.stringify(createBackup(testBackup())), mode)
      ).toBe(true);
      expect(useApp.getState().queuedSuggestionCount).toBe(0);
      expect(useApp.getState().pendingExternal).toBeNull();
    }
  );
  it("畸形外部地址终止模块队列，不保留待处理计数", () => {
    useApp.setState((s) => ({
      models: s.models.map((m) => ({ ...m, base_url: "not a URL" })),
      resumes: s.resumes.map((r) => ({
        ...r,
        data: {
          ...r.data,
          sections: r.data.sections.map((sec) => ({
            ...sec,
            blocks: [...sec.blocks, { ...testBlock(), block_id: "second" }],
          })),
        },
      })),
    }));
    useApp
      .getState()
      .requestSectionSuggestions("resume_test", "section_test", "polish", [
        "block_test",
        "second",
      ]);
    expect(useApp.getState().queuedSuggestionCount).toBe(0);
    expect(useApp.getState().pendingExternal).toBeNull();
    expect(useApp.getState().suggestions).toHaveLength(0);
  });
  it("岗位版本关联母版，编辑版本不会改变母版", () => {
    const id = useApp
      .getState()
      .createJobVersion(
        "resume_test",
        "目标公司",
        "目标岗位",
        "工程师，掌握 React"
      );
    expect(id).not.toBeNull();
    const version = useApp.getState().resumes.find((r) => r.id === id)!;
    expect(version.target?.source_resume_id).toBe("resume_test");
    expect(useApp.getState().jds[id!].resume_id).toBe(id);
    useApp
      .getState()
      .patchBlock(id!, "section_test", "block_test", { title: "仅版本修改" });
    expect(
      useApp.getState().resumes.find((r) => r.id === "resume_test")!.data
        .sections[0].blocks[0].title
    ).toBe("公司");
  });
  it("快照恢复内容与 JD，并自动保留恢复前版本", () => {
    const id = useApp.getState().captureSnapshot("resume_test", "初始版本")!;
    useApp.getState().patchBlock("resume_test", "section_test", "block_test", {
      title: "新内容",
    });
    expect(useApp.getState().restoreSnapshot(id)).toBe(true);
    expect(currentBlock().title).toBe("公司");
    expect(
      useApp.getState().snapshots[0].resume.data.sections[0].blocks[0].title
    ).toBe("新内容");
  });
  it("合并备份重新分配 ID，保留投递与快照关联，不覆盖原数据", () => {
    const snapshotId = useApp
      .getState()
      .captureSnapshot("resume_test", "已投递版本")!;
    const now = testResume().created_at;
    useApp.getState().saveApplication({
      id: "application_test",
      resume_id: "resume_test",
      snapshot_id: snapshotId,
      company: "公司",
      role: "职位",
      url: "",
      status: "applied",
      notes: "",
      applied_at: "2026-10-13",
      follow_up_at: "",
      created_at: now,
      updated_at: now,
    });
    const raw = JSON.stringify(createBackup(useApp.getState()));
    expect(useApp.getState().importData(raw, "merge")).toBe(true);
    expect(useApp.getState().resumes).toHaveLength(2);
    const imported = useApp
      .getState()
      .applications.find((a) => a.id !== "application_test")!;
    expect(imported.resume_id).not.toBe("resume_test");
    expect(
      useApp.getState().snapshots.find((s) => s.id === imported.snapshot_id)
        ?.resume_id
    ).toBe(imported.resume_id);
    expect(() =>
      parseBackup(JSON.stringify(createBackup(useApp.getState())), [])
    ).not.toThrow();
  });
  it("单份备份包含其快照、投递与求职信，兼容完整校验", () => {
    useApp.getState().captureSnapshot("resume_test", "snapshot");
    useApp.getState().saveCoverLetter({
      resume_id: "resume_test",
      company: "公司",
      job_title: "工程师",
      locale: "zh",
      body: "测试求职信",
      updated_at: testResume().created_at,
    });
    const data = parseBackup(
      JSON.stringify(createResumeBackup(useApp.getState(), "resume_test")),
      []
    );
    expect(data.snapshots).toHaveLength(1);
    expect(data.coverLetters?.resume_test.body).toBe("测试求职信");
  });
  it("模块规则建议按顺序处理，并可停止剩余队列", () => {
    useApp.getState().setPrivacy({ route: "local_only" });
    useApp.setState((s) => ({
      resumes: s.resumes.map((r) => ({
        ...r,
        data: {
          ...r.data,
          sections: r.data.sections.map((sec) => ({
            ...sec,
            blocks: [...sec.blocks, { ...testBlock(), block_id: "second" }],
          })),
        },
      })),
    }));
    useApp
      .getState()
      .requestSectionSuggestions("resume_test", "section_test", "polish", [
        "block_test",
        "second",
      ]);
    expect(useApp.getState().queuedSuggestionCount).toBe(1);
    useApp.getState().cancelSuggestion(useApp.getState().suggestions[0].id);
    vi.advanceTimersByTime(1000);
    expect(useApp.getState().suggestions).toHaveLength(1);
    expect(useApp.getState().queuedSuggestionCount).toBe(0);
  });
  it.each(["local_first", "ask_before_external"] as const)(
    "%s 每次确认，确认只执行一次",
    async (route) => {
      useApp.getState().setPrivacy({ route });
      const fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content:
                    '{"suggested_block":{"title":"优化"},"explanation":"测试"}',
                },
              },
            ],
          })
        )
      );
      vi.stubGlobal("fetch", fetch);
      request();
      expect(fetch).not.toHaveBeenCalled();
      expect(useApp.getState().pendingExternal).not.toBeNull();
      useApp.getState().confirmExternal(true);
      useApp.getState().confirmExternal(true);
      await vi.waitFor(() =>
        expect(useApp.getState().suggestions[0].status).toBe("success")
      );
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(useApp.getState().pendingExternal).toBeNull();
      request();
      expect(useApp.getState().pendingExternal).not.toBeNull();
      expect(fetch).toHaveBeenCalledTimes(1);
    }
  );
  it("取消确认不请求外部模型", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    request();
    useApp.getState().confirmExternal(false);
    expect(fetch).not.toHaveBeenCalled();
    expect(useApp.getState().externalCallCount).toBe(0);
  });
  it.each(["content", "provider", "privacy"])(
    "确认期间 %s 改变时不发送",
    (change) => {
      const fetch = vi.fn();
      vi.stubGlobal("fetch", fetch);
      request();
      if (change === "content")
        useApp
          .getState()
          .patchBlock("resume_test", "section_test", "block_test", {
            title: "new",
          });
      if (change === "provider")
        useApp.getState().saveModel({
          ...useApp.getState().models[0],
          base_url: "https://changed.example/v1",
        });
      if (change === "privacy")
        useApp.getState().setPrivacy({ allowExternal: false });
      useApp.getState().confirmExternal(true);
      expect(fetch).not.toHaveBeenCalled();
    }
  );
  it("旧建议不能覆盖手动编辑，也不能标记为已接受", () => {
    success();
    useApp.getState().patchBlock("resume_test", "section_test", "block_test", {
      title: "用户的新内容",
    });
    expect(useApp.getState().acceptSuggestion("suggestion_test")).toBe(false);
    expect(currentBlock().title).toBe("用户的新内容");
    expect(useApp.getState().suggestions[0].resolution).toBeUndefined();
  });
  it("接受与撤销正常工作，并保留条目排序和可见性", () => {
    success();
    useApp.getState().patchBlock("resume_test", "section_test", "block_test", {
      order: 2,
      visible: false,
    });
    expect(useApp.getState().acceptSuggestion("suggestion_test")).toBe(true);
    expect(currentBlock().title).toBe("优化后的标题");
    expect(useApp.getState().undoSuggestion("suggestion_test")).toBe(true);
    expect(currentBlock().title).toBe("公司");
    expect(currentBlock()).toMatchObject({ order: 2, visible: false });
  });
  it("接受后再编辑，撤销不会覆盖新内容", () => {
    success();
    useApp.getState().acceptSuggestion("suggestion_test");
    useApp.getState().patchBlock("resume_test", "section_test", "block_test", {
      description: "新的说明",
    });
    expect(useApp.getState().undoSuggestion("suggestion_test")).toBe(false);
    expect(currentBlock().description).toBe("新的说明");
  });
  it("畸形恢复不会改变原有数据", () => {
    const before = useApp.getState().resumes;
    expect(useApp.getState().importData('{"resumes":[{}]}')).toBe(false);
    expect(useApp.getState().resumes).toBe(before);
  });
  it("取消本地规则生成后不会被延迟回调改成成功", () => {
    useApp.getState().setPrivacy({ route: "local_only" });
    request();
    const id = useApp.getState().suggestions[0].id;
    useApp.getState().cancelSuggestion(id);
    vi.advanceTimersByTime(500);
    expect(useApp.getState().suggestions[0]).toMatchObject({
      status: "failed",
      error: "已取消生成",
    });
  });
  it("取消 LLM 请求会中止网络请求", () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url, init) => {
        signal = init.signal;
        return new Promise((_resolve, reject) =>
          signal?.addEventListener("abort", () =>
            reject(new DOMException("cancelled", "AbortError"))
          )
        );
      })
    );
    request();
    useApp.getState().confirmExternal(true);
    useApp.getState().cancelSuggestion(useApp.getState().suggestions[0].id);
    expect(signal?.aborted).toBe(true);
    expect(useApp.getState().suggestions[0].status).toBe("failed");
  });
});
