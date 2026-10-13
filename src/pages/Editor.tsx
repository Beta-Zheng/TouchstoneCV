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
import { TEMPLATES } from "../types";
import { cx } from "../lib/utils";
import { useAppSlice, useResume } from "../lib/store";
import { SectionCard } from "../components/blocks";
import { AIPanel, JDPanel, OutlinePanel } from "../components/panels";
import ResumePreview from "../components/resume-preview";
import ExportDialog from "../components/export-dialog";
import WorkflowDialog, {
  type WorkflowTool,
} from "../components/workflow-dialog";
import { ApplicationForm } from "./Applications";
import type { PageLayout } from "../lib/pagination";
import { completion, inspectResume } from "../lib/workflow";
import { Btn, Modal, ModalHeader, SaveIndicator } from "../components/ui";
import {
  IconAlert,
  IconBookOpen,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconGrip,
  IconLayout,
  IconPalette,
  IconPanelRight,
  IconPlus,
  IconPrinter,
  IconSpark,
  IconTarget,
  IconX,
} from "../components/icons";

const THEME_COLORS = ["#4F46E5", "#1d4ed8", "#9f1239", "#b45309", "#334155"];

/** 工具栏下拉菜单：点击展开，点击外部 / 按 Esc 关闭。带图标 + 功能副标签 + 面板说明，让新用户一眼看懂这组设置管什么 */
function ToolbarMenu({
  label,
  hint,
  desc,
  icon: Icon,
  children,
}: {
  label: string;
  hint: string;
  desc: string;
  icon: (p: {
    size?: number;
    className?: string;
    style?: CSSProperties;
  }) => ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={desc}
        className={cx(
          "flex items-center gap-2 rounded-lg bg-white px-2.5 py-1 text-left shadow-sm shadow-ink-950/5 ring-1 ring-ink-100 transition hover:ring-ink-200",
          open ? "text-brand-700 ring-brand-200" : "text-ink-600"
        )}
      >
        <Icon
          size={15}
          className={cx("shrink-0", open ? "text-brand-500" : "text-ink-400")}
        />
        <span className="flex flex-col leading-tight">
          <span className="text-[12px] font-semibold">{label}</span>
          <span className="text-[10px] text-ink-400">{hint}</span>
        </span>
        <IconChevronDown
          size={13}
          className={cx(
            "shrink-0 text-ink-300 transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+8px)] z-30 w-64 rounded-2xl border border-ink-200 bg-white p-3.5 shadow-xl shadow-ink-950/15"
        >
          <p className="mb-2.5 border-b border-ink-100 pb-2 text-[11px] leading-snug text-ink-400">
            {desc}
          </p>
          {children}
        </div>
      )}
    </div>
  );
}

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
  dim,
  onHover,
}: {
  resume: Resume;
  section: Section;
  onRequestAI: (s: string, b: string, a: AIAction) => void;
  highlight?: boolean;
  dim?: boolean;
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
        highlight &&
          !isDragging &&
          "shadow-[0_16px_40px_-26px_rgba(99,102,241,0.6)] ring-1 ring-brand-300",
        dim && "opacity-55",
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
            aria-label="拖动调整模块顺序"
            title="拖动调整模块顺序"
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
  const app = useAppSlice(
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
  const [editorMode, setEditorMode] = useState<"content" | "layout">("content");
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
  const [editingField, setEditingField] = useState(false);
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
      el.removeEventListener("scroll", onScroll);
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
      {/* 顶部工具栏：按功能分组，减少视觉混乱 */}
      <div className="flex flex-wrap items-center gap-2.5 border-b border-ink-200 bg-paper-25 px-4 py-2.5">
        {/* 文档组 */}
        <div className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 shadow-sm shadow-ink-950/5 ring-1 ring-ink-100">
          <button
            onClick={() => app.go({ name: "home" })}
            className="tool-btn h-7 w-7"
            aria-label="返回"
          >
            <IconChevronLeft size={16} />
          </button>
          <input
            value={resume.title}
            onChange={(e) => app.renameResume(resumeId, e.target.value)}
            className="w-40 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 font-display text-[15px] font-bold text-ink-900 outline-none transition hover:border-ink-200 focus:border-brand-500 focus:bg-white"
            aria-label="简历标题"
          />
          <SaveIndicator />
        </div>

        {/* 模板组 */}
        <div className="flex items-center gap-1 rounded-lg bg-white px-2 py-1.5 shadow-sm shadow-ink-950/5 ring-1 ring-ink-100">
          <span className="hidden pr-1 text-[10px] font-bold uppercase tracking-wider text-ink-300 lg:inline">
            模板
          </span>
          <div className="flex rounded-md bg-paper-100 p-0.5">
            {TEMPLATES.map((t) => (
              <button
                key={t.template_id}
                onClick={() => app.setTemplate(resumeId, t.template_id)}
                className={cx(
                  "rounded-md px-2.5 py-1 text-[11px] font-bold transition",
                  resume.template_id === t.template_id
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-ink-500 hover:bg-paper-200 hover:text-ink-800"
                )}
                title={t.description}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        {/* 外观下拉：主题色（仅非 ATS） + 字号 + 字体 */}
        <ToolbarMenu
          label="外观样式"
          hint="颜色 · 字体 · 字号"
          desc="调整整份简历的配色、正文字号与字体，对所有模块统一生效。"
          icon={IconPalette}
        >
          {resume.template_id !== "classic_ats" && (
            <MenuSection title="主题色">
              <div className="flex items-center gap-1.5 px-1">
                {THEME_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => app.setTheme(resumeId, { primary_color: c })}
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
                      app.setTheme(resumeId, { primary_color: e.target.value })
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
                  onClick={() => app.setTheme(resumeId, { font_family: k })}
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
        </ToolbarMenu>

        {/* 布局下拉：密度 + 条头（条头仅非 ATS） */}
        <ToolbarMenu
          label="排版布局"
          hint="间距 · 疏密 · 一页篇幅"
          desc="调整整份简历的行距与模块间距：内容偏多选紧凑，偏少选宽松，让简历恰好一页。"
          icon={IconLayout}
        >
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
                    onClick={() => app.setTheme(resumeId, { header_layout: k })}
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
              <strong className="font-semibold text-ink-700">按模块设置</strong>
              ：在中间栏各模块的「要点」编辑区右上角切换（菱形 / 圆点 / 方块 /
              空心圆 / 箭头 / 对勾 / 有序），每条要点可点行首符号单独开关。
            </p>
          </MenuSection>
        </ToolbarMenu>

        {/* 操作组 */}
        <div className="ml-auto flex items-center gap-2.5">
          {/* 移动端抽屉开关：<md 显示，桌面隐藏 */}
          <div className="flex items-center gap-1.5 2xl:hidden">
            <button
              className={cx(
                "tool-btn h-8 w-8",
                mobilePanel === "outline" && "bg-brand-50 text-brand-700"
              )}
              aria-label="打开模块大纲"
              title="模块大纲"
              onClick={() => {
                setEditorMode("content");
                setMobilePanel((m) => (m === "outline" ? "none" : "outline"));
              }}
            >
              <IconBookOpen size={16} />
            </button>
            <button
              className={cx(
                "tool-btn h-8 w-8",
                mobilePanel === "panel" && "bg-brand-50 text-brand-700"
              )}
              aria-label="打开 AI 与 JD 面板"
              title="AI / JD 面板"
              onClick={() => {
                setEditorMode("content");
                setMobilePanel((m) => (m === "panel" ? "none" : "panel"));
              }}
            >
              <IconPanelRight size={16} />
            </button>
          </div>
          <Btn
            variant="outline"
            className="h-8 text-[12px]"
            onClick={() => setAddSecOpen(true)}
          >
            <IconPlus size={13} /> 添加模块
          </Btn>
          <Btn
            variant="primary"
            className="h-8 text-[12px]"
            onClick={() => setPreviewOpen(true)}
          >
            <IconPrinter size={13} /> 检查 / 导出
          </Btn>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-white px-4 py-2 text-[11px]">
        <div className="flex rounded-lg bg-paper-100 p-0.5">
          {(
            [
              ["content", "写内容"],
              ["layout", "看版式 / 实时预览"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              className={cx(
                "rounded-md px-3 py-1.5",
                editorMode === mode && "bg-brand-600 text-white"
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
        <label className="flex items-center gap-1">
          场景
          <select
            aria-label="求职场景"
            className="rounded border border-line px-1 py-1"
            value={resume.audience ?? "experienced"}
            onChange={(e) =>
              app.setResumeOptions(resumeId, {
                audience: e.target.value as Resume["audience"],
              })
            }
          >
            <option value="experienced">社招</option>
            <option value="student">应届 / 实习</option>
            <option value="career_change">转行</option>
          </select>
        </label>
        <label className="flex items-center gap-1">
          版式
          <select
            aria-label="版式语言"
            className="rounded border border-line px-1 py-1"
            value={resume.locale ?? "zh"}
            onChange={(e) =>
              app.setResumeOptions(resumeId, {
                locale: e.target.value as Resume["locale"],
              })
            }
          >
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
        </label>
        <select
          aria-label="简历工具"
          className="max-w-40 rounded border border-line px-2 py-1"
          value=""
          onChange={(e) => {
            if (e.target.value) setTool(e.target.value as WorkflowTool);
          }}
        >
          <option value="">更多工具…</option>
          <option value="target">为岗位创建版本</option>
          <option value="versions">快照 / 比较 / 恢复</option>
          <option value="module">优化当前模块</option>
          <option value="templates">模板缩略图</option>
          <option value="letter">求职信</option>
          <option value="source">查看导入原文</option>
        </select>
        <Btn
          variant="ghost"
          className="h-7 text-[11px]"
          onClick={() => setApplicationOpen(true)}
        >
          记录投递
        </Btn>
        {parentResume && (
          <Btn
            variant="ghost"
            className="h-7 text-[11px]"
            onClick={() =>
              app.go({ name: "editor", resumeId: parentResume.id })
            }
          >
            查看母版
          </Btn>
        )}
        <span className="ml-auto text-ink-500">
          内容完整度 {completion(resume)}% ·{" "}
          {inspectResume(resume).filter((i) => i.severity === "warning").length}{" "}
          项待检查
          {editorMode === "layout" && livePages.length > 0
            ? ` · ${livePages.length} 页`
            : ""}
        </span>
      </div>

      {/* 三栏：<md 折叠为单栏（左右栏转抽屉），md+ 恢复三栏网格 */}
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
              aria-label="关闭模块大纲"
              onClick={() => setMobilePanel("none")}
            >
              关闭大纲
            </button>
            <OutlinePanel resume={resume} activeId={activeSection} />
          </aside>
        )}

        <main
          ref={scrollRef}
          className="min-h-0 overflow-y-auto bg-paper-100 px-5 py-5"
          onFocusCapture={(e) => {
            setEditingField(true);
            const card = (e.target as HTMLElement).closest<HTMLElement>(
              "[data-section-id]"
            );
            if (card?.dataset.sectionId)
              setActiveSection(card.dataset.sectionId);
          }}
          onBlurCapture={() => setEditingField(false)}
        >
          <div
            className={cx(
              editorMode === "layout" && "grid items-start gap-5 xl:grid-cols-2"
            )}
          >
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext
                items={sections.map((s) => s.section_id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="mx-auto flex max-w-3xl flex-col gap-4 pb-10">
                  {sections.map((s) => {
                    const current = hoverSection ?? activeSection;
                    return (
                      <SortableSection
                        key={s.section_id}
                        resume={resume}
                        section={s}
                        onRequestAI={onRequestAI}
                        highlight={current === s.section_id}
                        dim={
                          sections.length >= 2 &&
                          !editingField &&
                          current !== null &&
                          current !== s.section_id
                        }
                        onHover={setHoverSection}
                      />
                    );
                  })}
                  <button
                    onClick={() => setAddSecOpen(true)}
                    className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-200 py-4 text-[13px] font-medium text-ink-400 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
                  >
                    <IconPlus size={14} /> 添加自定义模块（可参与拖拽排序）
                  </button>
                </div>
              </SortableContext>
            </DndContext>
            {editorMode === "layout" && (
              <div
                className="min-w-0 rounded-xl border border-line"
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

      {/* 添加自定义模块 */}
      <Modal
        open={addSecOpen}
        onClose={() => setAddSecOpen(false)}
        width="max-w-sm"
      >
        <ModalHeader
          title="添加自定义模块"
          sub="自定义模块可重命名、拖拽排序，并参与预览与导出"
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
                app.toast("ok", "模块已添加");
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
                app.toast("ok", "模块已添加");
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
