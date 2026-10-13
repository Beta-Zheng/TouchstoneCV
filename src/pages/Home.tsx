import { useEffect, useRef, useState } from "react";
import type { Resume, ResumeData, SourceKind } from "../types";
import { TEMPLATES } from "../types";
import {
  ACCEPT_EXTS,
  MAX_FILE_SIZE,
  extractFileText,
  structureResume,
  emptyResume,
  type SupportedExt,
} from "../lib/parser";
import { buildSampleResume, type SampleKind } from "../lib/samples";
import { nowISO, timeAgo } from "../lib/utils";
import { useAppSlice } from "../lib/store";
import {
  CORE_MODULES,
  completion,
  inspectResume,
  moduleFilled,
  sectionHasContent,
} from "../lib/workflow";
import { Btn, Confirm, Modal, ModalHeader } from "../components/ui";
import ImportReview from "../components/import-review";
import {
  IconArrowRight,
  IconFile,
  IconLayers,
  IconPlus,
  IconShield,
  IconTrash,
  IconUpload,
} from "../components/icons";

type CreateTab = "start" | "file" | "paste" | "samples";
const AUDIENCES = {
  student: "应届 / 实习",
  experienced: "社招",
  career_change: "转行",
} as const;
const SAMPLE_KINDS = {
  ai: "AI 应用工程师",
  frontend: "前端工程师",
  data: "数据分析师",
} as const;

export default function Home() {
  const app = useAppSlice(
    "resumes",
    "suggestions",
    "privacy",
    "snapshots",
    "applications",
    "go",
    "createResume",
    "deleteResume",
    "duplicateResume",
    "setResumeOptions"
  );
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<CreateTab>("start");
  const [audience, setAudience] =
    useState<NonNullable<Resume["audience"]>>("experienced");
  const [locale, setLocale] = useState<"zh" | "en">("zh");
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [review, setReview] = useState<{
    data: ResumeData;
    raw: string;
    multiColumn: boolean;
  } | null>(null);
  const [del, setDel] = useState<Resume | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("updated");
  const fileRef = useRef<HTMLInputElement>(null);
  const ticket = useRef(0);
  const running = useRef(false);
  useEffect(
    () => () => {
      ticket.current++;
      running.current = false;
    },
    []
  );
  const sorted = [...app.resumes].sort((a, b) =>
    sort === "title"
      ? a.title.localeCompare(b.title)
      : b.updated_at.localeCompare(a.updated_at)
  );
  const list = sorted.filter(
    (r) =>
      (filter === "all" || (filter === "master" ? !r.target : !!r.target)) &&
      [
        r.title,
        r.data.basic_info.name,
        r.data.basic_info.title,
        r.target?.company ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase())
  );
  const latest = [...app.resumes].sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at)
  )[0];
  const issues = latest ? inspectResume(latest) : [];
  const openCreate = (next: CreateTab = "start") => {
    setOpen(true);
    setTab(next);
    setError("");
    setReview(null);
  };
  const close = () => {
    ticket.current++;
    running.current = false;
    setBusy(false);
    setOpen(false);
    setReview(null);
    setError("");
  };
  const create = (data: ResumeData, title?: string) => {
    const id = app.createResume(data, title);
    app.setResumeOptions(id, { audience, locale });
    close();
    app.go({ name: "editor", resumeId: id });
  };
  const structure = (
    raw: string,
    source: SourceKind,
    sourceName?: string,
    multiColumn = false
  ) => {
    if (!raw.trim()) throw new Error("简历内容不能为空");
    if (raw.length > 100_000)
      throw new Error("文本过长，请精简至 10 万字符以内后再导入");
    const data = structureResume(raw, source, sourceName);
    if (
      !data.sections.some(sectionHasContent) &&
      !(data.basic_info.name || data.basic_info.email || data.basic_info.phone)
    )
      throw new Error(
        "未识别到简历内容，可从空白简历开始。原文仍保留在输入框中。"
      );
    data.metadata.source_text = raw;
    setReview({ data, raw, multiColumn });
  };
  const handleFile = async (file: File) => {
    if (running.current) return;
    running.current = true;
    const id = ++ticket.current;
    setBusy(true);
    setError("");
    try {
      const ext = (
        file.name.split(".").pop() ?? ""
      ).toLowerCase() as SupportedExt;
      if (!ACCEPT_EXTS.includes(ext))
        throw new Error("仅支持 PDF、DOCX、MD、TXT 文件");
      if (file.size > MAX_FILE_SIZE)
        throw new Error("请使用不超过 10 MB 的文件");
      const result = await extractFileText(file, ext);
      if (id !== ticket.current) return;
      if (!result.ok || !result.text)
        throw new Error(result.error || "未提取到文本，请尝试粘贴原文");
      setPaste(result.text);
      structure(result.text, "file", file.name, !!result.maybeMultiColumn);
    } catch (e) {
      if (id === ticket.current)
        setError(e instanceof Error ? e.message : "解析失败");
    } finally {
      if (id === ticket.current) {
        setBusy(false);
        running.current = false;
      }
    }
  };
  return (
    <div
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-16 pt-7 sm:px-6"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (busy || review) return;
        const f = e.dataTransfer.files[0];
        if (f) {
          openCreate("file");
          void handleFile(f);
        }
      }}
    >
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-brand-600">
            Local-first Resume Workbench
          </p>
          <h1 className="mt-2 font-display text-[30px] font-black">
            简历工作台
          </h1>
          <p className="mt-2 text-[13px] text-ink-500">
            核对内容 → 针对岗位优化 → 检查版式 → 导出投递
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[11px] text-ink-500">
            <IconShield size={13} />
            {app.privacy.allowExternal ? "外部调用逐次确认" : "本地模式"}
          </span>
          <Btn variant="primary" onClick={() => openCreate()}>
            <IconPlus size={14} /> 新建简历
          </Btn>
        </div>
      </header>
      {latest && (
        <section className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
          <p className="text-[11px] font-bold text-brand-700">
            继续完成你的简历
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold">{latest.title}</h2>
              <p className="mt-1 text-[12px] text-ink-500">
                {issues.find((i) => i.severity === "warning")?.message ??
                  "可以检查岗位匹配与版式。"}
              </p>
            </div>
            <Btn
              variant="primary"
              onClick={() => app.go({ name: "editor", resumeId: latest.id })}
            >
              继续编辑 <IconArrowRight size={13} />
            </Btn>
          </div>
        </section>
      )}
      <div className="grid grid-cols-3 gap-3">
        {[
          ["简历", app.resumes.length],
          [
            "待审阅建议",
            app.suggestions.filter(
              (s) => s.status === "success" && !s.resolution
            ).length,
          ],
          ["投递记录", app.applications.length],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-xl border border-line bg-surface p-4"
          >
            <p className="text-[11px] text-ink-400">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold">我的简历</h2>
          <div className="flex flex-wrap gap-2">
            <input
              aria-label="搜索简历"
              className="field-input w-44"
              placeholder="搜索姓名、公司或职位"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              aria-label="简历类型"
              className="field-input w-28"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">全部版本</option>
              <option value="master">主简历</option>
              <option value="target">岗位版本</option>
            </select>
            <select
              aria-label="排序简历"
              className="field-input w-28"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="updated">最近更新</option>
              <option value="title">名称排序</option>
            </select>
          </div>
        </div>
        {!list.length ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface p-10 text-center">
            <IconFile size={30} className="mx-auto text-ink-300" />
            <p className="mt-3 font-bold">
              {app.resumes.length
                ? "没有符合条件的简历"
                : "从已有简历或示例开始"}
            </p>
            <p className="mt-2 text-[12px] text-ink-500">
              内容保存在本机，可随时下载备份。
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Btn variant="primary" onClick={() => openCreate()}>
                新建简历
              </Btn>
              <Btn onClick={() => openCreate("samples")}>选择示例</Btn>
            </div>
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.map((r) => {
              const problems = inspectResume(r).filter(
                (i) => i.severity === "warning"
              );
              const exp = app.snapshots.find(
                (s) => s.resume_id === r.id && s.kind === "export"
              );
              return (
                <li
                  key={r.id}
                  className="flex flex-col rounded-2xl border border-line bg-surface p-4"
                >
                  <button
                    className="text-left"
                    onClick={() => app.go({ name: "editor", resumeId: r.id })}
                  >
                    <p className="truncate font-bold">{r.title}</p>
                    <p className="mt-1 truncate text-[12px] text-ink-500">
                      {r.target
                        ? `${r.target.company} · ${r.target.job_title}`
                        : r.data.basic_info.title || "尚未填写目标职位"}
                    </p>
                  </button>
                  <div className="mt-3 flex flex-wrap gap-1 text-[10px]">
                    <span className="chip bg-paper-100">
                      {r.target ? "岗位版本" : "主简历"}
                    </span>
                    <span className="chip bg-paper-100">
                      {
                        TEMPLATES.find((t) => t.template_id === r.template_id)
                          ?.name
                      }
                    </span>
                    <span className="chip bg-paper-100">
                      {r.locale === "en" ? "英文版式" : "中文版式"}
                    </span>
                  </div>
                  <p className="mt-3 text-[11px] text-ink-500">
                    基础内容完整度 {completion(r)}% ·{" "}
                    {problems.length
                      ? `${problems.length} 项待检查`
                      : "基础检查通过"}
                  </p>
                  <div className="mt-2 flex gap-2">
                    {CORE_MODULES.map((m) => (
                      <span
                        key={m.type}
                        title={`${m.label}：${
                          moduleFilled(r, m.type) ? "已填写" : "待补充 / 可选"
                        }`}
                        className={`h-2 w-2 rounded-full ${
                          moduleFilled(r, m.type) ? "bg-brand-500" : "bg-line"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="mt-3 text-[10px] text-ink-400">
                    {timeAgo(r.updated_at)}更新 ·{" "}
                    {exp
                      ? `导出准备于${timeAgo(exp.created_at)}`
                      : "尚未生成导出快照"}
                  </p>
                  <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                    <Btn
                      variant="primary"
                      className="h-8"
                      onClick={() => app.go({ name: "editor", resumeId: r.id })}
                    >
                      打开
                    </Btn>
                    <div className="flex gap-1">
                      <button
                        className="tool-btn"
                        aria-label={`复制简历 ${r.title}`}
                        onClick={() => app.duplicateResume(r.id)}
                      >
                        <IconLayers size={14} />
                      </button>
                      <button
                        className="tool-btn text-danger-700"
                        aria-label={`删除简历 ${r.title}`}
                        onClick={() => setDel(r)}
                      >
                        <IconTrash size={14} />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <Modal
        open={open}
        onClose={close}
        width={review ? "max-w-5xl" : "max-w-xl"}
      >
        <ModalHeader
          title={review ? "核对解析结果" : "创建简历"}
          sub={
            review
              ? "确认字段后再创建；可以返回原文重新解析"
              : "选择起点和求职场景"
          }
          onClose={close}
        />
        <div className="px-5 pb-5">
          {review ? (
            <ImportReview
              data={review.data}
              sourceText={review.raw}
              multiColumn={review.multiColumn}
              onChange={(data) => setReview({ ...review, data })}
              onBack={() => {
                setReview(null);
                setTab("paste");
              }}
              onConfirm={() =>
                create(
                  {
                    ...review.data,
                    metadata: {
                      ...review.data.metadata,
                      reviewed_at: nowISO(),
                    },
                  },
                  review.data.basic_info.name || "导入简历"
                )
              }
            />
          ) : (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3">
                <label className="text-[12px]">
                  求职场景
                  <select
                    className="field-input mt-1"
                    value={audience}
                    onChange={(e) =>
                      setAudience(e.target.value as typeof audience)
                    }
                  >
                    {Object.entries(AUDIENCES).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[12px]">
                  版式语言
                  <select
                    className="field-input mt-1"
                    value={locale}
                    onChange={(e) => setLocale(e.target.value as typeof locale)}
                  >
                    <option value="zh">中文</option>
                    <option value="en">English（不自动翻译经历）</option>
                  </select>
                </label>
              </div>
              {tab !== "start" && (
                <Btn
                  variant="ghost"
                  className="mb-3"
                  disabled={busy}
                  onClick={() => setTab("start")}
                >
                  返回选择起点
                </Btn>
              )}
              {tab === "start" && (
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      ["file", "上传已有简历", "PDF / DOCX / MD / TXT"],
                      ["paste", "粘贴文本", "复制已有简历全文"],
                      ["samples", "从示例开始", "按场景和岗位选择"],
                    ] as const
                  ).map(([id, label, desc]) => (
                    <button
                      key={id}
                      className="rounded-xl border border-line bg-paper-50 p-4 text-left hover:border-brand-300"
                      onClick={() => setTab(id)}
                    >
                      <p className="text-[13px] font-bold">{label}</p>
                      <p className="mt-1 text-[11px] text-ink-500">{desc}</p>
                    </button>
                  ))}
                  <button
                    className="rounded-xl border border-line bg-paper-50 p-4 text-left hover:border-brand-300"
                    onClick={() => create(emptyResume(), "未命名简历")}
                  >
                    <p className="text-[13px] font-bold">空白简历</p>
                    <p className="mt-1 text-[11px] text-ink-500">
                      从零填写真实经历
                    </p>
                  </button>
                </div>
              )}
              {tab === "file" && (
                <button
                  disabled={busy}
                  className="flex w-full flex-col items-center rounded-xl border-2 border-dashed border-line p-8 hover:border-brand-300 disabled:opacity-50"
                  onClick={() => fileRef.current?.click()}
                >
                  <IconUpload size={26} />
                  <p className="mt-2 text-[13px]">选择文件，或拖拽到页面</p>
                  <p className="mt-1 text-[11px] text-ink-400">
                    单个文件 ≤ 10 MB
                  </p>
                </button>
              )}
              <input
                ref={fileRef}
                aria-label="上传简历文件"
                type="file"
                className="hidden"
                accept=".pdf,.docx,.md,.txt"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                  e.target.value = "";
                }}
              />
              {tab === "paste" && (
                <>
                  <textarea
                    className="field-input"
                    rows={10}
                    value={paste}
                    onChange={(e) => setPaste(e.target.value)}
                    placeholder="粘贴姓名、联系方式、工作或项目经历、教育及技能…"
                  />
                  <div className="mt-3 flex justify-end">
                    <Btn
                      variant="primary"
                      disabled={!paste.trim() || busy}
                      onClick={() => {
                        setError("");
                        try {
                          structure(paste, "pasted_text");
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "解析失败");
                        }
                      }}
                    >
                      解析并核对
                    </Btn>
                  </div>
                </>
              )}
              {tab === "samples" && (
                <>
                  <p className="mb-3 text-[12px] text-ink-500">
                    所有示例人物与经历均为虚构，请替换成真实内容。
                  </p>
                  <div className="flex flex-col gap-2">
                    {Object.entries(SAMPLE_KINDS).map(([id, label]) => (
                      <button
                        key={id}
                        className="rounded-xl border border-line p-4 text-left hover:border-brand-300"
                        onClick={() => {
                          const data = buildSampleResume(
                            id as SampleKind,
                            audience
                          );
                          create(data, `${label} · ${AUDIENCES[audience]}示例`);
                        }}
                      >
                        <p className="text-[13px] font-bold">{label}</p>
                        <p className="mt-1 text-[11px] text-ink-500">
                          {AUDIENCES[audience]} · 示例可编辑
                        </p>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {busy && (
                <p role="status" className="mt-3 text-[12px] text-brand-700">
                  正在提取并解析文件…
                </p>
              )}
              {error && (
                <div
                  role="alert"
                  className="mt-3 rounded-xl bg-danger-100 p-3 text-[12px] text-danger-700"
                >
                  <p>{error}</p>
                  <Btn
                    variant="ghost"
                    onClick={() => {
                      setTab("paste");
                      setError("");
                    }}
                  >
                    改用粘贴文本
                  </Btn>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>
      <Confirm
        open={!!del}
        danger
        title={`删除「${del?.title}」？`}
        desc="将删除该简历及相关 JD、建议、快照、求职信和投递记录。建议先下载备份。"
        confirmText="删除"
        onConfirm={() => {
          if (del) app.deleteResume(del.id);
          setDel(null);
        }}
        onCancel={() => setDel(null)}
      />
    </div>
  );
}
