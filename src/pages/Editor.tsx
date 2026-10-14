import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { motion } from "framer-motion";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { AIAction, Resume, Section } from "../types";
import { AUDIENCE_LABELS, TEMPLATES } from "../types";
import { cx } from "../lib/utils";
import { useAppSlice, useResume } from "../lib/store";
import { SectionCard } from "../components/blocks";
import { AIPanel, JDPanel, OutlinePanel } from "../components/panels";
import ResumePreview from "../components/resume-preview";
import WorkflowSteps from "../components/workflow-steps";
import SourceUpdate from "../components/source-update";
import ExportDialog from "../components/export-dialog";
import WorkflowDialog, {
  type WorkflowTool,
} from "../components/workflow-dialog";
import { ApplicationForm } from "./Applications";
import type { PageLayout } from "../lib/pagination";
import { completion, inspectResume } from "../lib/workflow";
import { Btn, Modal, ModalHeader, SaveIndicator } from "../components/ui";
import {
  IconBookOpen,
  IconCheck,
  IconChevronLeft,
  IconGrip,
  IconPanelRight,
  IconPlus,
  IconSpark,
  IconTarget,
} from "../components/icons";

function navigateTabs(event: React.KeyboardEvent<HTMLDivElement>) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const tabs = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')
  ).filter((tab) => tab.getClientRects().length > 0);
  if (!tabs.length) return;
  const index = tabs.indexOf(document.activeElement as HTMLButtonElement);
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
      ? tabs.length - 1
      : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
        tabs.length;
  event.preventDefault();
  tabs[next].click();
  tabs[next].focus();
}

const THEME_COLORS = ["#4F46E5", "#1d4ed8", "#9f1239", "#b45309", "#334155"];

/** 下拉菜单内的分组小标题 + 内容 */
function MenuSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-ink-400">
        {title}
      </p>
      {children}
    </div>
  );
}

function SortableSection({
  resume,
  section,
  onRequestAI,
  highlight,
  onHover,
}: {
  resume: Resume;
  section: Section;
  onRequestAI: (s: string, b: string, a: AIAction) => void;
  highlight?: boolean;
  onHover?: (id: string | null) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.section_id });
  return (
    <div
      ref={setNodeRef}
      data-section-id={section.section_id}
      onMouseEnter={() => onHover?.(section.section_id)}
      onMouseLeave={() => onHover?.(null)}
      style={{
        transform: transform
          ? `${CSS.Transform.toString(transform)}${
              isDragging ? " rotate(2deg)" : ""
            }`
          : undefined,
        transition,
      }}
      className={cx(
        "rounded-xl transition-[opacity,box-shadow] duration-300",
        highlight && !isDragging && "ring-1 ring-brand-200",
        isDragging &&
          "z-20 opacity-95 shadow-[0_24px_48px_-12px_rgba(99,102,241,0.45)] ring-1 ring-brand-300"
      )}
    >
      <SectionCard
        resume={resume}
        section={section}
        onRequestAI={onRequestAI}
        dragHandle={
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab touch-none rounded p-1 text-ink-300 transition hover:bg-paper-200 hover:text-ink-600 active:cursor-grabbing"
            aria-label="拖动调整栏目顺序"
            title="拖动调整栏目顺序"
          >
            <IconGrip size={15} />
          </button>
        }
      />
    </div>
  );
}

export default function Editor({ resumeId }: { resumeId: string }) {
  const resume = useResume(resumeId);
  const parentResume = useResume(resume?.target?.source_resume_id);
  const [sourceUpdateOpen, setSourceUpdateOpen] = useState(false);
  const app = useAppSlice(
    "jds",
    "snapshots",
    "applications",
    "go",
    "requestSuggestion",
    "reorderSections",
    "toast",
    "renameResume",
    "setTemplate",
    "setTheme",
    "addSection",
    "setResumeOptions"
  );
  const [panelTab, setPanelTab] = useState<"ai" | "jd">("ai");
  const [activeTarget, setActiveTarget] = useState<{
    sectionId: string;
    blockId: string;
  } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<
    "content" | "layout" | "preview"
  >("content");
  const [canSplit, setCanSplit] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 1280px)").matches
  );
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1280px)");
    const sync = () => {
      setCanSplit(media.matches);
      if (!media.matches)
        setEditorMode((mode) => (mode === "layout" ? "content" : mode));
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<
    "document" | "template" | "style" | "layout"
  >("template");
  const [splitRatio, setSplitRatio] = useState(43);
  const splitRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<WorkflowTool | null>(null);
  const [applicationOpen, setApplicationOpen] = useState(false);
  const [livePages, setLivePages] = useState<PageLayout[]>([]);
  const [addSecOpen, setAddSecOpen] = useState(false);
  const [newSecTitle, setNewSecTitle] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const sections = useMemo(
    () =>
      resume ? [...resume.data.sections].sort((a, b) => a.order - b.order) : [],
    [resume]
  );

  // ---------- Scrollspy：视口顶部 reading line 命中的模块突出显示，其余淡化 ----------
  const scrollRef = useRef<HTMLElement>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  // 鼠标悬停的模块优先成为高亮对象；移开后回落到滚动判定
  const [hoverSection, setHoverSection] = useState<string | null>(null);
  // 移动端（<md）左右两栏折叠为抽屉：none=仅中栏，outline=模块大纲，panel=AI/JD 面板
  const [mobilePanel, setMobilePanel] = useState<"none" | "outline" | "panel">(
    "none"
  );
  // 正在输入时不淡化：编辑动作发生在某个卡片内部，淡化它的邻居会干扰输入
  const sectionIdsKey = sections.map((s) => s.section_id).join(",");

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const compute = () => {
      raf = 0;
      const cards = el.querySelectorAll<HTMLElement>("[data-section-id]");
      if (!cards.length) return;
      const containerTop = el.getBoundingClientRect().top;
      let current: string | null = cards[0].dataset.sectionId ?? null;
      cards.forEach((c) => {
        if (c.getBoundingClientRect().top - containerTop <= 150)
          current = c.dataset.sectionId ?? current;
      });
      setActiveSection(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(compute);
    };
    compute();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll, true);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [sectionIdsKey]);

  if (!resume) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-[14px] text-ink-400">简历不存在或已被删除</p>
        <Btn variant="primary" onClick={() => app.go({ name: "home" })}>
          返回工作台
        </Btn>
      </div>
    );
  }

  const onRequestAI = (
    sectionId: string,
    blockId: string,
    action: AIAction
  ) => {
    setActiveTarget({ sectionId, blockId });
    setPanelTab("ai");
    setMobilePanel("panel");
    app.requestSuggestion(resumeId, sectionId, blockId, action);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = sections.findIndex((s) => s.section_id === active.id);
    const newIdx = sections.findIndex((s) => s.section_id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    app.reorderSections(
      resumeId,
      arrayMove(sections, oldIdx, newIdx).map((s) => s.section_id)
    );
    app.toast("ok", "模块顺序已更新，正在自动保存");
  };

  const locate = (sectionId: string, blockId?: string) => {
    setEditorMode("content");
    setMobilePanel("none");
    setActiveSection(sectionId);
    requestAnimationFrame(() => {
      const card = scrollRef.current?.querySelector<HTMLElement>(
        `[data-section-id="${sectionId}"]`
      );
      const entry = blockId
        ? card?.querySelector<HTMLElement>(`[data-block-id="${blockId}"]`)
        : null;
      (entry ?? card)?.scrollIntoView({ behavior: "smooth", block: "start" });
      const field = (entry ?? card)?.querySelector<HTMLElement>(
        "input,textarea,[contenteditable]"
      );
      field?.focus({ preventScroll: true });
    });
  };

  return (
    <div className="flex h-full flex-col">
      <header
        className="shrink-0 border-b border-line bg-white px-3 py-2 sm:px-4"
        data-testid="editor-header"
      >
        <div className="flex items-center gap-2">
          <button
            className="tool-btn shrink-0"
            aria-label="返回工作台"
            onClick={() => app.go({ name: "home" })}
          >
            <IconChevronLeft size={18} />
          </button>
          <input
            aria-label="简历标题"
            title={resume.title}
            className="min-w-0 flex-1 truncate border-0 bg-transparent px-1 text-[15px] font-semibold text-ink-900 outline-none focus:ring-1 focus:ring-brand-300"
            value={resume.title}
            onChange={(e) => app.renameResume(resumeId, e.target.value)}
          />
          <div className="hidden shrink-0 sm:block">
            <SaveIndicator />
          </div>
          <Btn
            variant="ghost"
            className="h-9 shrink-0 text-[12px]"
            onClick={() => setSettingsOpen(true)}
          >
            简历设置
          </Btn>
          <Btn
            variant="primary"
            className="h-9 shrink-0 text-[12px]"
            onClick={() => setPreviewOpen(true)}
          >
            导出
          </Btn>
        </div>
        <div className="mt-1 pl-9 sm:hidden">
          <SaveIndicator />
        </div>
      </header>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line bg-white px-3 py-2 text-[12px] sm:px-4">
        <div
          className="flex rounded-lg bg-paper-100 p-0.5"
          role="tablist"
          onKeyDown={navigateTabs}
          aria-label="编辑视图"
        >
          {(
            [
              ["content", "写内容"],
              ["layout", "内容与预览"],
              ["preview", "仅预览"],
            ] as const
          )
            .filter(([mode]) => mode !== "layout" || canSplit)
            .map(([mode, label]) => (
              <button
                key={mode}
                role="tab"
                aria-selected={editorMode === mode}
                tabIndex={editorMode === mode ? 0 : -1}
                className={cx(
                  "rounded-md px-2 py-1.5 sm:px-3",
                  editorMode === mode
                    ? "bg-white font-semibold text-ink-900 shadow-sm"
                    : "text-ink-500"
                )}
                onClick={() => {
                  setEditorMode(mode);
                  setMobilePanel("none");
                }}
              >
                {label}
              </button>
            ))}
        </div>
        <Btn
          variant="ghost"
          className="h-8 text-[12px]"
          onClick={() => {
            setEditorMode("content");
            setMobilePanel((m) => (m === "outline" ? "none" : "outline"));
          }}
        >
          <IconBookOpen size={14} />
          目录
        </Btn>
        <Btn
          variant="ghost"
          className="h-8 text-[12px]"
          onClick={() => {
            setEditorMode("content");
            setMobilePanel((m) => (m === "panel" ? "none" : "panel"));
          }}
        >
          <IconPanelRight size={14} />
          建议
        </Btn>
        <select
          aria-label="辅助工具"
          className="max-w-32 rounded border border-line bg-white px-2 py-1.5"
          value=""
          onChange={(e) => {
            if (e.target.value === "parent" && parentResume)
              app.go({ name: "editor", resumeId: parentResume.id });
            else if (e.target.value) setTool(e.target.value as WorkflowTool);
          }}
        >
          <option value="">辅助工具</option>
          <option value="versions">版本记录</option>
          <option value="letter">求职信</option>
          <option value="source">导入原文</option>
          {parentResume && <option value="parent">返回主简历</option>}
        </select>
        <span
          className="ml-auto text-[11px] text-ink-500"
          title={`基础字段完成度 ${completion(resume)}%，仅表示填写情况`}
        >
          {inspectResume(resume).filter((i) => i.severity === "warning").length
            ? `${
                inspectResume(resume).filter((i) => i.severity === "warning")
                  .length
              } 项待检查`
            : "基础检查通过"}
          {editorMode !== "content" && livePages.length
            ? ` · ${livePages.length} 页`
            : ""}
        </span>
      </div>
      {resume.archived_at && (
        <p className="px-4 py-2 text-[12px] text-ink-500">
          这份简历已归档，投递历史和快照仍保留；可在工作台的已归档列表恢复。
        </p>
      )}
      {parentResume && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2 text-[12px] text-ink-500">
          <span>来源：{parentResume.title} · 独立岗位版本</span>
          {resume.target?.source_updated_at &&
            parentResume.updated_at > resume.target.source_updated_at && (
              <span className="text-seal-700">
                主简历已有更新，岗位内容未自动覆盖
              </span>
            )}
          <Btn
            variant="ghost"
            onClick={() =>
              app.go({ name: "editor", resumeId: parentResume.id })
            }
          >
            查看主简历
          </Btn>
          <Btn variant="ghost" onClick={() => setSourceUpdateOpen(true)}>
            对照并选择更新
          </Btn>
        </div>
      )}
      {sourceUpdateOpen && parentResume && (
        <SourceUpdate
          resume={resume}
          source={parentResume}
          onClose={() => setSourceUpdateOpen(false)}
        />
      )}
      <WorkflowSteps
        resume={resume}
        hasJD={!!app.jds[resumeId]}
        hasExport={app.snapshots.some(
          (s) => s.resume_id === resumeId && s.kind === "export"
        )}
        hasApplication={app.applications.some((a) => a.resume_id === resumeId)}
        onStep={(step) => {
          if (step === 0) {
            if (resume.data.metadata.source_text) setTool("source");
            else {
              setEditorMode("content");
              locate(
                sections.find((s) => s.type === "basic_info")?.section_id ??
                  sections[0]?.section_id ??
                  ""
              );
            }
          } else if (step === 1) {
            if (!app.jds[resumeId] && !resume.target) setTool("target");
            else {
              setPanelTab("jd");
              setEditorMode("content");
              setMobilePanel("panel");
            }
          } else if (step === 2) setTool("module");
          else if (step === 3) setPreviewOpen(true);
          else setApplicationOpen(true);
        }}
      />
      {/* 内容与预览：宽屏并排，窄屏工具面板使用抽屉 */}
      {mobilePanel !== "none" && (
        <div
          className="fixed inset-0 z-30 bg-ink-950/45 2xl:hidden"
          onClick={() => setMobilePanel("none")}
          aria-hidden="true"
        />
      )}
      <div
        className={cx(
          "grid min-h-0 flex-1 grid-cols-1",
          editorMode === "content" &&
            "2xl:grid-cols-[218px_minmax(0,1fr)_320px]"
        )}
      >
        {editorMode === "content" && (
          <aside
            className={cx(
              "min-h-0 overflow-y-auto border-r border-ink-200 bg-paper-50",
              mobilePanel === "outline"
                ? "fixed bottom-0 left-0 top-0 z-40 block w-72 shadow-2xl shadow-ink-950/25 2xl:static 2xl:z-auto 2xl:block 2xl:w-auto 2xl:shadow-none"
                : "hidden 2xl:block"
            )}
          >
            <button
              className="px-3 py-2 text-[11px] text-ink-500 2xl:hidden"
              aria-label="关闭目录"
              onClick={() => setMobilePanel("none")}
            >
              关闭目录
            </button>
            <OutlinePanel
              resume={resume}
              activeId={activeSection}
              onAdd={() => setAddSecOpen(true)}
            />
          </aside>
        )}

        <main
          ref={scrollRef}
          className={cx(
            "min-h-0 bg-paper-50 p-3 sm:p-4",
            editorMode === "layout"
              ? "overflow-y-auto xl:overflow-hidden"
              : "overflow-y-auto"
          )}
          onFocusCapture={(e) => {
            const card = (e.target as HTMLElement).closest<HTMLElement>(
              "[data-section-id]"
            );
            if (card?.dataset.sectionId)
              setActiveSection(card.dataset.sectionId);
          }}
        >
          <div
            ref={splitRef}
            className={cx(editorMode === "layout" && "editor-split")}
            style={{ "--editor-split": `${splitRatio}%` } as CSSProperties}
          >
            {editorMode !== "preview" && (
              <>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={onDragEnd}
                >
                  <SortableContext
                    items={sections.map((s) => s.section_id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div
                      className={cx(
                        "editor-content mx-auto flex w-full min-w-0 flex-col gap-4 pb-10",
                        editorMode === "content" && "max-w-3xl"
                      )}
                    >
                      {sections.map((s) => {
                        const current = hoverSection ?? activeSection;
                        return (
                          <SortableSection
                            key={s.section_id}
                            resume={resume}
                            section={s}
                            onRequestAI={onRequestAI}
                            highlight={current === s.section_id}
                            onHover={setHoverSection}
                          />
                        );
                      })}
                      <button
                        onClick={() => setAddSecOpen(true)}
                        className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-200 py-4 text-[13px] font-medium text-ink-400 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
                      >
                        <IconPlus size={14} /> 添加栏目
                      </button>
                    </div>
                  </SortableContext>
                </DndContext>
              </>
            )}
            {editorMode === "layout" && (
              <div
                role="separator"
                aria-label="调整编辑与预览宽度"
                aria-orientation="vertical"
                aria-valuemin={34}
                aria-valuemax={60}
                aria-valuenow={splitRatio}
                tabIndex={0}
                className="hidden cursor-col-resize touch-none items-center justify-center rounded hover:bg-paper-200 focus:bg-paper-200 xl:flex"
                onPointerDown={(e) =>
                  e.currentTarget.setPointerCapture(e.pointerId)
                }
                onPointerMove={(e) => {
                  if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
                  const rect = splitRef.current?.getBoundingClientRect();
                  if (rect)
                    setSplitRatio(
                      Math.min(
                        60,
                        Math.max(
                          34,
                          ((e.clientX - rect.left) / rect.width) * 100
                        )
                      )
                    );
                }}
                onPointerUp={(e) => {
                  if (e.currentTarget.hasPointerCapture(e.pointerId))
                    e.currentTarget.releasePointerCapture(e.pointerId);
                }}
                onKeyDown={(e) => {
                  if (["ArrowLeft", "ArrowRight", "Home"].includes(e.key)) {
                    e.preventDefault();
                    setSplitRatio((r) =>
                      e.key === "Home"
                        ? 43
                        : Math.max(
                            34,
                            Math.min(60, r + (e.key === "ArrowLeft" ? -2 : 2))
                          )
                    );
                  }
                }}
              >
                <span className="h-12 w-1 rounded bg-ink-200" />
              </div>
            )}
            {editorMode !== "content" && (
              <div
                className={cx(
                  "editor-preview min-w-0 rounded-xl border border-line bg-white",
                  editorMode === "preview" && "mx-auto max-w-5xl"
                )}
                data-testid="live-preview"
              >
                <ResumePreview resume={resume} onLayout={setLivePages} />
              </div>
            )}
          </div>
        </main>

        {editorMode === "content" && (
          <aside
            className={cx(
              "min-h-0 flex-col border-l border-ink-200 bg-paper-50",
              mobilePanel === "panel"
                ? "fixed bottom-0 right-0 top-0 z-40 flex w-80 max-w-[88vw] shadow-2xl shadow-ink-950/25 2xl:static 2xl:z-auto 2xl:flex 2xl:max-w-none 2xl:shadow-none"
                : "hidden 2xl:flex"
            )}
          >
            <button
              className="self-end px-3 py-2 text-[11px] text-ink-500 2xl:hidden"
              aria-label="关闭 AI 与 JD 面板"
              onClick={() => setMobilePanel("none")}
            >
              关闭面板
            </button>
            <div className="flex border-b border-ink-200">
              {(
                [
                  ["ai", "AI 建议", <IconSpark key="a" size={13} />],
                  ["jd", "JD 匹配", <IconTarget key="j" size={13} />],
                ] as const
              ).map(([k, label, icon]) => (
                <button
                  key={k}
                  onClick={() => setPanelTab(k)}
                  className={cx(
                    "relative flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[12.5px] font-bold transition",
                    panelTab === k
                      ? "text-brand-700"
                      : "text-ink-400 hover:text-ink-700"
                  )}
                >
                  {icon} {label}
                  {panelTab === k && (
                    <motion.span
                      layoutId="editor-panel-tab-underline"
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 34,
                      }}
                      className={cx(
                        "absolute inset-x-6 bottom-0 h-0.5 rounded-full",
                        k === "jd" && "bg-brand-600"
                      )}
                      style={
                        k === "ai"
                          ? {
                              backgroundImage:
                                "linear-gradient(90deg, var(--color-sp-a), var(--color-sp-b), var(--color-sp-c))",
                            }
                          : undefined
                      }
                    />
                  )}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1">
              {panelTab === "ai" ? (
                <AIPanel resume={resume} activeTarget={activeTarget} />
              ) : (
                <JDPanel resume={resume} onLocate={locate} />
              )}
            </div>
          </aside>
        )}
      </div>

      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        width="max-w-2xl"
      >
        <ModalHeader
          title="简历设置"
          sub="调整栏目场景、模板和版式"
          onClose={() => setSettingsOpen(false)}
        />
        <div className="px-5 pb-5">
          <div
            className="mb-4 flex gap-2 border-b border-line"
            role="tablist"
            onKeyDown={navigateTabs}
            aria-label="简历设置分类"
          >
            {(
              [
                ["document", "文档"],
                ["template", "模板"],
                ["style", "外观"],
                ["layout", "排版"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={settingsTab === id}
                tabIndex={settingsTab === id ? 0 : -1}
                className={cx(
                  "border-b-2 px-3 py-2 text-[13px]",
                  settingsTab === id
                    ? "border-brand-600 text-brand-700"
                    : "border-transparent text-ink-500"
                )}
                onClick={() => setSettingsTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="max-h-[60vh] overflow-y-auto" role="tabpanel">
            {settingsTab === "document" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-[13px]">
                  求职场景
                  <select
                    aria-label="求职场景"
                    className="field-input mt-1"
                    value={resume.audience ?? "experienced"}
                    onChange={(e) =>
                      app.setResumeOptions(resumeId, {
                        audience: e.target.value as Resume["audience"],
                      })
                    }
                  >
                    {Object.entries(AUDIENCE_LABELS).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[13px]">
                  版式语言
                  <select
                    aria-label="版式语言"
                    className="field-input mt-1"
                    value={resume.locale ?? "zh"}
                    onChange={(e) =>
                      app.setResumeOptions(resumeId, {
                        locale: e.target.value as Resume["locale"],
                      })
                    }
                  >
                    <option value="zh">中文</option>
                    <option value="en">英文版式</option>
                  </select>
                  <span className="mt-1 block text-[11px] text-ink-500">
                    仅调整标准标题和日期，经历内容需单独翻译。
                  </span>
                </label>
              </div>
            )}
            {settingsTab === "template" && (
              <div className="grid gap-3 sm:grid-cols-3">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.template_id}
                    aria-pressed={resume.template_id === t.template_id}
                    className={cx(
                      "rounded-xl border p-4 text-left",
                      resume.template_id === t.template_id
                        ? "border-brand-400 bg-brand-50"
                        : "border-line bg-white"
                    )}
                    onClick={() => app.setTemplate(resumeId, t.template_id)}
                  >
                    <p className="text-[14px] font-semibold">{t.name}</p>
                    <p className="mt-2 text-[12px] leading-relaxed text-ink-500">
                      {t.description}
                    </p>
                  </button>
                ))}
              </div>
            )}
            {settingsTab === "style" && (
              <div>
                {resume.template_id !== "classic_ats" && (
                  <MenuSection title="主题色">
                    <div className="flex items-center gap-1.5 px-1">
                      {THEME_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() =>
                            app.setTheme(resumeId, { primary_color: c })
                          }
                          className={cx(
                            "relative flex h-[22px] w-[22px] items-center justify-center rounded-full transition hover:scale-110",
                            resume.theme.primary_color === c
                              ? "ring-2 ring-offset-1 ring-ink-900"
                              : "ring-1 ring-ink-200 hover:ring-ink-400"
                          )}
                          style={{ background: c }}
                          aria-label={`主题色 ${c}`}
                        >
                          {resume.theme.primary_color === c && (
                            <IconCheck size={12} className="text-white" />
                          )}
                        </button>
                      ))}
                      <label
                        className="relative flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded-full ring-1 ring-ink-200 transition hover:ring-ink-400"
                        title="自定义主题色"
                      >
                        <input
                          type="color"
                          value={resume.theme.primary_color}
                          onChange={(e) =>
                            app.setTheme(resumeId, {
                              primary_color: e.target.value,
                            })
                          }
                          className="absolute inset-0 cursor-pointer opacity-0"
                          aria-label="自定义主题色"
                        />
                        <div className="h-3 w-3 rounded-full bg-gradient-to-br from-red-400 via-green-400 to-blue-400" />
                      </label>
                    </div>
                  </MenuSection>
                )}

                <MenuSection title="字号">
                  <div className="flex gap-1 rounded-lg bg-paper-100 p-0.5">
                    {[13, 14, 15].map((n) => (
                      <button
                        key={n}
                        onClick={() => app.setTheme(resumeId, { font_size: n })}
                        className={cx(
                          "flex-1 rounded-md px-2 py-1 font-mono text-[11px] font-bold transition",
                          resume.theme.font_size === n
                            ? "bg-white text-ink-900 shadow-sm"
                            : "text-ink-500 hover:bg-paper-200 hover:text-ink-800"
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </MenuSection>

                <MenuSection title="字体">
                  <div className="grid grid-cols-3 gap-1">
                    {(
                      [
                        ["sans", "黑体"],
                        ["serif", "宋体"],
                        ["system", "系统"],
                        ["kai", "楷体"],
                        ["mono", "等宽"],
                        ["fangsong", "仿宋"],
                      ] as const
                    ).map(([k, label]) => (
                      <button
                        key={k}
                        onClick={() =>
                          app.setTheme(resumeId, { font_family: k })
                        }
                        className={cx(
                          "rounded-md px-1.5 py-1 text-[11px] font-medium transition",
                          (resume.theme.font_family ?? "sans") === k
                            ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200"
                            : "bg-paper-100 text-ink-500 hover:bg-paper-200 hover:text-ink-800"
                        )}
                        title={`字体：${label}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </MenuSection>
              </div>
            )}
            {settingsTab === "layout" && (
              <div>
                <MenuSection title="密度（内容多选紧凑）">
                  <div className="flex gap-1 rounded-lg bg-paper-100 p-0.5">
                    {(
                      [
                        ["compact", "紧凑"],
                        ["medium", "中等"],
                        ["loose", "宽松"],
                      ] as const
                    ).map(([k, label]) => (
                      <button
                        key={k}
                        onClick={() => app.setTheme(resumeId, { density: k })}
                        className={cx(
                          "flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition",
                          (resume.theme.density ?? "medium") === k
                            ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200"
                            : "text-ink-500 hover:bg-paper-200 hover:text-ink-800"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </MenuSection>
                {resume.template_id !== "classic_ats" && (
                  <MenuSection title="条目标题排布">
                    <div className="flex gap-1 rounded-lg bg-paper-100 p-0.5">
                      {(
                        [
                          ["row", "标题 · 日期同行"],
                          ["stack", "日期另起一行"],
                        ] as const
                      ).map(([k, label]) => (
                        <button
                          key={k}
                          onClick={() =>
                            app.setTheme(resumeId, { header_layout: k })
                          }
                          className={cx(
                            "flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition",
                            (resume.theme.header_layout ?? "row") === k
                              ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200"
                              : "text-ink-500 hover:bg-paper-200 hover:text-ink-800"
                          )}
                          title={
                            k === "row"
                              ? "标题居左，日期居右"
                              : "标题居上，日期与地点居下"
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </MenuSection>
                )}

                {resume.template_id === "academic_photo" && (
                  <MenuSection title="头像大小">
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0.5}
                        max={2}
                        step={0.1}
                        value={resume.theme.avatar_scale ?? 1}
                        onChange={(e) =>
                          app.setTheme(resumeId, {
                            avatar_scale: Number(e.target.value),
                          })
                        }
                        className="h-1 min-w-0 flex-1 accent-brand-600"
                        aria-label="头像显示比例"
                      />
                      <span className="w-10 shrink-0 text-right font-mono text-[11px] text-ink-500">
                        {(resume.theme.avatar_scale ?? 1).toFixed(1)}×
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-ink-400">
                      基于 1
                      寸照（25×35mm）基准按比例缩放，0.5×–2.0×；未上传头像时无效。
                    </p>
                  </MenuSection>
                )}

                <MenuSection title="要点列表">
                  <p className="rounded-lg bg-paper-100 px-2 py-1.5 text-[11px] leading-snug text-ink-500">
                    已改为
                    <strong className="font-semibold text-ink-700">
                      按模块设置
                    </strong>
                    ：在中间栏各模块的「要点」编辑区右上角切换（菱形 / 圆点 /
                    方块 / 空心圆 / 箭头 / 对勾 /
                    有序），每条要点可点行首符号单独开关。
                  </p>
                </MenuSection>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* 添加自定义栏目 */}
      <Modal
        open={addSecOpen}
        onClose={() => setAddSecOpen(false)}
        width="max-w-sm"
      >
        <ModalHeader
          title="添加自定义栏目"
          sub="自定义栏目可重命名、调整位置，并参与预览与导出"
          onClose={() => setAddSecOpen(false)}
        />
        <div className="px-5 pb-5">
          <input
            autoFocus
            className="field-input"
            placeholder="如：开源贡献 / 发表作品 / 语言能力"
            value={newSecTitle}
            onChange={(e) => setNewSecTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newSecTitle.trim()) {
                app.addSection(resumeId, newSecTitle.trim());
                setNewSecTitle("");
                setAddSecOpen(false);
                app.toast("ok", "栏目已添加");
              }
            }}
          />
          <div className="mt-3 flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setAddSecOpen(false)}>
              取消
            </Btn>
            <Btn
              variant="primary"
              disabled={!newSecTitle.trim()}
              onClick={() => {
                app.addSection(resumeId, newSecTitle.trim());
                setNewSecTitle("");
                setAddSecOpen(false);
                app.toast("ok", "栏目已添加");
              }}
            >
              添加
            </Btn>
          </div>
        </div>
      </Modal>

      {previewOpen && (
        <ExportDialog
          resume={resume}
          onClose={() => setPreviewOpen(false)}
          onLocate={locate}
        />
      )}
      {tool && (
        <WorkflowDialog
          key={tool}
          tool={tool}
          resume={resume}
          onClose={() => setTool(null)}
          onAIStart={(sectionId, blockId) => {
            setEditorMode("content");
            setPanelTab("ai");
            setMobilePanel("panel");
            setActiveTarget({ sectionId, blockId });
          }}
        />
      )}
      {applicationOpen && (
        <ApplicationForm
          resumeId={resumeId}
          onClose={() => setApplicationOpen(false)}
        />
      )}
    </div>
  );
}
