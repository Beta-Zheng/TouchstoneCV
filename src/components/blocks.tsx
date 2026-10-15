import {
  Fragment,
  useEffect,
  useState,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import type {
  AIAction,
  Block,
  BulletStyleKey,
  Resume,
  Section,
} from "../types";
import { ACTION_LABELS, BULLET_STYLE_OPTIONS, SECTION_LABELS } from "../types";
import {
  cx,
  fileToDataUrl,
  prepEditorHtml,
  resolveBulletStyle,
  stripHtml,
} from "../lib/utils";
import { useApp, useAppSlice } from "../lib/store";
import { selectProvider } from "../lib/ai";
import {
  IconArrowRight,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconEye,
  IconEyeOff,
  IconPlus,
  IconSpark,
  IconTrash,
  IconUpload,
  IconX,
} from "./icons";
import { Confirm, useActionMenu } from "./ui";

/* ---------------- 基础表单件 ---------------- */

function F({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block min-w-0", className)}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

/* ---------------- 行内加粗（Markdown ** 标记） ---------------- */

function wrapSelection(
  el: HTMLInputElement | HTMLTextAreaElement | null,
  onChange: (v: string) => void
) {
  if (!el) return;
  const s = el.selectionStart ?? 0;
  const e = el.selectionEnd ?? 0;
  const v = el.value;
  const sel = v.slice(s, e);
  const nv = v.slice(0, s) + "**" + sel + "**" + v.slice(e);
  onChange(nv);
  requestAnimationFrame(() => {
    el.focus();
    try {
      el.setSelectionRange(s + 2, s + 2 + sel.length);
    } catch {
      /* noop */
    }
  });
}

function BoldButton({
  elRef,
  onChange,
}: {
  elRef: RefObject<HTMLInputElement | HTMLTextAreaElement>;
  onChange: (v: string) => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => wrapSelection(elRef.current, onChange)}
      className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded border border-ink-200 bg-white/90 text-[12px] font-bold text-ink-500 transition hover:border-brand-400 hover:text-brand-700"
      title="选中文字后点击：用 ** 包裹以加粗"
      aria-label="加粗选中文字"
    >
      B
    </button>
  );
}

function RichField({
  label,
  value,
  onChange,
  placeholder,
  textarea,
  rows,
  mono,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
  rows?: number;
  mono?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [selected, setSelected] = useState(false);
  const selectionChanged = (el: HTMLInputElement | HTMLTextAreaElement) =>
    setSelected((el.selectionStart ?? 0) < (el.selectionEnd ?? 0));
  return (
    <F label={label} className={className}>
      <div
        className="relative"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setSelected(false);
        }}
      >
        {textarea ? (
          <textarea
            ref={ref as RefObject<HTMLTextAreaElement>}
            onSelect={(e) => selectionChanged(e.currentTarget)}
            className={cx(
              "field-input resize-y leading-relaxed pr-8",
              mono && "font-mono"
            )}
            rows={rows ?? 4}
            aria-label={label}
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <input
            ref={ref as RefObject<HTMLInputElement>}
            onSelect={(e) => selectionChanged(e.currentTarget)}
            className={cx("field-input pr-8", mono && "font-mono")}
            aria-label={label}
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
        {selected && <BoldButton elRef={ref} onChange={onChange} />}
      </div>
    </F>
  );
}

/** 轻量行内富文本编辑器：contentEditable + 加粗/斜体工具栏，输出消毒后的 HTML。
 *  与预览端 renderRich 配合，实现「要点/描述统一为富文本、可自定义加粗」。
 *
 *  受控同步策略：聚焦即真相（半受控）。用户正在输入时 document.activeElement
 *  就是编辑器本体，此时 value 变化一律不重写 innerHTML —— 彻底消除「每次按键
 *  setState → effect 重写 DOM → 光标被重置到末尾/开头」的竞争窗口。这也是历史上
 *  「要点无法编辑 / 长描述打不进字」类问题的共同根因：早期用 emittingRef +
 *  setTimeout(0) 做时间窗防抖，若 effect 恰好在防抖重置之后执行仍会重写 DOM，
 *  时序敏感、难以复现。外部程序性修改（AI 建议、撤销）几乎都发生在失焦状态，
 *  失焦后 effect 照常同步，功能不受影响。 */
function RichTextEditor({
  value,
  onChange,
  placeholder,
  ariaLabel = "经历概述",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 正在编辑：DOM 即真相，禁止重写（否则光标/选区被重置，用户表现为「无法编辑」）
    if (document.activeElement === el) return;
    const desired = prepEditorHtml(value);
    if (el.innerHTML !== desired) {
      el.innerHTML = desired;
    }
  }, [value]);
  const emit = () => {
    const el = ref.current;
    if (!el) return;
    onChange(el.innerHTML);
  };
  return (
    <div className="inline-editor relative">
      <div className="inline-format absolute right-1 top-1 z-10 flex items-center gap-0.5 rounded bg-white/95">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => document.execCommand("bold")}
          className="flex h-6 w-6 items-center justify-center rounded text-[13px] font-bold text-ink-500 transition hover:bg-brand-100 hover:text-brand-700"
          title="选中文字后加粗"
          aria-label="加粗"
        >
          B
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => document.execCommand("italic")}
          className="flex h-6 w-6 items-center justify-center rounded text-[13px] italic text-ink-500 transition hover:bg-brand-100 hover:text-brand-700"
          title="选中文字后斜体"
          aria-label="斜体"
        >
          I
        </button>
      </div>
      <div
        ref={ref}
        role="textbox"
        aria-label={ariaLabel}
        aria-multiline="true"
        contentEditable
        suppressContentEditableWarning
        data-ph={placeholder}
        className={cx(
          "field-input min-h-[2.6rem] resize-y overflow-auto pr-16 leading-relaxed",
          className
        )}
        onInput={emit}
        onBlur={emit}
        /* 粘贴一律降级为纯文本：编辑器只支持行内加粗/斜体，放行富文本粘贴会
         * 把网页的 <ul>/<li>/<span style> 等整段塞进存储值，预览端渲染出错
         * （历史上曾带入 scrollbar-color 内联样式与损坏的 li 标签）。
         * 多行文本的换行转成 <br> 插入（execCommand("insertText") 会把 \n
         * 折叠成空格，换行丢失）；末尾夹带的换行/空格直接削掉。 */
        onPaste={(e) => {
          e.preventDefault();
          const raw = e.clipboardData.getData("text/plain");
          if (!raw) return;
          const text = raw.replace(/\r\n?/g, "\n").replace(/[\s\u00a0]+$/, "");
          if (!text) return;
          const lines = text.split("\n");
          if (lines.length === 1) {
            document.execCommand("insertText", false, text);
          } else {
            const esc = (s: string) =>
              s
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
            document.execCommand(
              "insertHTML",
              false,
              lines.map(esc).join("<br>")
            );
          }
        }}
        onDrop={(e) => e.preventDefault()}
      />
    </div>
  );
}

export function TagInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    const t = draft.trim().replace(/[,，、]+$/, "");
    if (t && !values.includes(t)) onChange([...values, t]);
    setDraft("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-ink-200 bg-white/80 px-2 py-1.5 transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/25">
      {values.map((v) => (
        <span
          key={v}
          className="chip bg-brand-50 text-brand-800 ring-1 ring-brand-200"
        >
          {v}
          <button
            onClick={() => onChange(values.filter((x) => x !== v))}
            className="opacity-60 transition hover:opacity-100"
            aria-label={`移除 ${v}`}
          >
            <IconX size={10} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !draft && values.length) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={commit}
        placeholder={values.length ? "" : placeholder || "输入后回车添加"}
        className="min-w-[110px] flex-1 bg-transparent text-[13px] outline-none placeholder:text-ink-500"
      />
    </div>
  );
}

/** 要点符号：编辑器与预览保持一致的视觉 */
function BulletMarker({
  style,
  index,
}: {
  style: BulletStyleKey;
  index: number;
}) {
  if (style === "ordered")
    return (
      <span className="inline-block min-w-[1.2em] text-[12px] font-semibold tabular-nums">
        {index + 1}.
      </span>
    );
  if (style === "disc")
    return <span className="block h-[5px] w-[5px] rounded-full bg-current" />;
  if (style === "square")
    return <span className="block h-[5px] w-[5px] bg-current" />;
  if (style === "circle")
    return (
      <span className="block h-[6px] w-[6px] rounded-full border-[1.5px] border-current" />
    );
  if (style === "arrow")
    return <IconArrowRight size={12} className="text-current" />;
  if (style === "check")
    return <IconCheck size={12} className="text-current" />;
  return <span className="block h-[5px] w-[5px] rotate-45 bg-current" />;
}

/** 模块级要点列表样式选择器：与要点编辑器同处一行，改动即时作用于本模块所有条目 */
function BulletStyleSelect({
  value,
  onChange,
}: {
  value: BulletStyleKey;
  onChange: (v: BulletStyleKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useActionMenu(open, setOpen, ref);
  const cur =
    BULLET_STYLE_OPTIONS.find((o) => o.key === value) ??
    BULLET_STYLE_OPTIONS[0];
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="本模块要点列表样式（作用于该模块全部条目）"
        className={cx(
          "editor-action inline-flex items-center gap-1 rounded-sm border px-2 text-[13px] font-medium transition-colors",
          open
            ? "border-brand-400 bg-brand-50 text-brand-700"
            : "border-ink-200 bg-white text-ink-500 hover:border-brand-400 hover:text-brand-700"
        )}
      >
        <span className="font-mono text-brand-600">{cur.sample}</span>
        {cur.label}
        <IconChevronDown
          size={10}
          className={cx(
            "transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div
          role="menu" aria-label="成果列表样式"
          className="app-menu absolute right-0 top-7 z-30 w-44 overflow-hidden rounded-lg border border-ink-200 bg-white p-1 shadow-xl shadow-ink-950/15"
        >
          <p className="px-2 py-1 text-[12px] font-bold uppercase tracking-wider text-ink-400">
            成果列表样式
          </p>
          {BULLET_STYLE_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              role="menuitemradio" tabIndex={-1}
              aria-checked={value === o.key}
              onClick={() => {
                onChange(o.key);
                setOpen(false);
              }}
              className={cx(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition",
                value === o.key
                  ? "bg-brand-50 font-semibold text-brand-700"
                  : "text-ink-600 hover:bg-paper-100"
              )}
            >
              <span className="w-4 font-mono text-[12px]">{o.sample}</span>
              {o.label}
              {value === o.key && <IconCheck size={11} className="ml-auto" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BulletsEdit({
  value,
  marks,
  onChange,
  onMarksChange,
  bulletStyle,
  onBulletStyleChange,
}: {
  value: string[];
  /** 与 value 平行的勾选标记；缺省视为全部勾选（历史数据兼容） */
  marks?: boolean[];
  onChange: (v: string[]) => void;
  onMarksChange: (m: boolean[]) => void;
  bulletStyle: BulletStyleKey;
  onBulletStyleChange: (v: BulletStyleKey) => void;
}) {
  const isMarked = (i: number) => marks?.[i] ?? true;
  const update = (i: number, html: string) =>
    onChange(value.map((b, idx) => (idx === i ? html : b)));
  const remove = (i: number) => {
    onChange(value.filter((_, idx) => idx !== i));
    if (marks) onMarksChange(marks.filter((_, idx) => idx !== i));
  };
  const add = () => {
    onChange([...value, ""]);
    if (marks) onMarksChange([...marks, true]);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
    if (marks) {
      const nm = [...marks];
      [nm[i], nm[j]] = [nm[j], nm[i]];
      onMarksChange(nm);
    }
  };
  /** 符号即开关：点击行首符号切换勾选。序号只数勾选条目（有序样式重编号，不留空洞） */
  const toggleMark = (i: number) => {
    const next = value.map((_, idx) => isMarked(idx));
    next[i] = !next[i];
    onMarksChange(next);
  };
  return (
    <div className="sm:col-span-2 min-w-0">
      <div className="mb-1 flex items-center gap-2">
        <span className="field-label mb-0">主要成果</span>
        <div className="ml-auto">
          <BulletStyleSelect
            value={bulletStyle}
            onChange={onBulletStyleChange}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {value.map((b, i) => {
          const marked = isMarked(i);
          // 有序样式的槽位序号 = 之前勾选条目数（与预览端编号规则一致）
          const ordinal = value
            .slice(0, i)
            .filter((_, idx) => isMarked(idx)).length;
          return (
            <div key={i} className="achievement-row flex items-start gap-1.5">
              <button
                type="button"
                onClick={() => toggleMark(i)}
                aria-pressed={marked}
                title={
                  marked
                    ? "已勾选：预览显示列表符号（点击取消）"
                    : "未勾选：预览不显示列表符号（点击勾选）"
                }
                className="mt-[0.55rem] flex h-6 w-6 shrink-0 items-center justify-center rounded transition hover:bg-paper-200/80"
                style={{ color: "#178a79" }}
              >
                <span
                  className={cx(
                    "leading-none transition-opacity duration-150",
                    marked ? "opacity-100" : "opacity-25"
                  )}
                >
                  <BulletMarker style={bulletStyle} index={ordinal} />
                </span>
              </button>
              <div className="min-w-0 flex-1">
                <RichTextEditor
                  ariaLabel={`成果 ${i + 1}`}
                  value={b}
                  onChange={(html) => update(i, html)}
                  placeholder="做了什么，带来了什么结果"
                />
              </div>
              <div className="achievement-actions flex shrink-0 flex-col">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="tool-btn h-5 w-5 disabled:opacity-30"
                  aria-label="上移成果"
                >
                  <IconChevronUp size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === value.length - 1}
                  className="tool-btn h-5 w-5 disabled:opacity-30"
                  aria-label="下移成果"
                >
                  <IconChevronDown size={11} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                className="achievement-actions tool-btn h-6 w-6 hover:bg-danger-100 hover:text-danger-600"
                aria-label="删除成果"
              >
                <IconX size={12} />
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={add}
          className="self-start inline-flex items-center gap-1 text-[12px] font-medium text-brand-600 transition hover:text-brand-700"
        >
          <IconPlus size={12} /> 添加成果
        </button>
      </div>
    </div>
  );
}

/* ---------------- AI 动作菜单 ---------------- */

export function AIActionMenu({
  onAction,
  hasJD,
}: {
  onAction: (a: AIAction) => void;
  hasJD: boolean;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useActionMenu(open, setOpen, menuRef);
  const { models, privacy } = useAppSlice("models", "privacy");
  const rules = selectProvider(models, privacy).kind === "rules";
  return (
    <div
      className="relative"
      ref={menuRef}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cx(
          "editor-action inline-flex items-center gap-1.5 rounded-sm border px-3 text-[13px] font-medium transition-colors",
          open
            ? "border-brand-300 bg-brand-50 text-brand-700"
            : "border-brand-200 bg-brand-50 text-brand-700 hover:border-brand-400 hover:bg-brand-100"
        )}
        aria-label="优化这段"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <IconSpark size={13} />
        优化这段
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div
            role="menu" aria-label="条目优化动作"
          className="app-menu absolute right-0 top-8 z-30 w-60 overflow-hidden rounded-lg border border-ink-200 bg-white shadow-xl shadow-ink-950/15"
          >
            <p className="border-b border-ink-100 bg-paper-50 px-3 py-1.5 text-[12px] font-medium tracking-wide text-ink-400">
              {rules
                ? "规则检查：精简措辞与核对提示"
                : "模型写作：生成后逐条确认"}
            </p>
            {(Object.keys(ACTION_LABELS) as AIAction[]).map((a) => (
              <button
                key={a}
                role="menuitem" tabIndex={-1}
                disabled={
                  rules && ["rewrite", "expand", "translate"].includes(a)
                }
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  onAction(a);
                }}
                className="flex w-full items-start gap-2 px-3 py-2 text-left transition hover:bg-brand-50"
              >
                <span className="mt-0.5 w-14 shrink-0 text-[12px] font-bold text-ink-800">
                  {ACTION_LABELS[a].label}
                </span>
                <span className="text-[12px] leading-snug text-ink-400">
                  {rules && ["rewrite", "expand", "translate"].includes(a)
                    ? "需在模型与隐私中启用模型"
                    : ACTION_LABELS[a].hint}
                  {a === "jd_match" && !hasJD && (
                    <em className="ml-1 not-italic text-seal-600">
                      （未绑定 JD）
                    </em>
                  )}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- 单个 Block 编辑器 ---------------- */

const TYPE_LABEL: Record<Block["type"], string> = {
  summary: "总结",
  work_experience_item: "工作经历",
  project_experience_item: "项目",
  education_item: "教育",
  skill_group: "技能组",
  certification: "证书/奖项",
  custom_text: "自定义",
};

export function BlockCard({
  resume,
  section,
  block,
  index,
  total,
  onRequestAI,
  bulletStyle,
  onBulletStyleChange,
}: {
  resume: Resume;
  section: Section;
  block: Block;
  index: number;
  total: number;
  onRequestAI: (sectionId: string, blockId: string, action: AIAction) => void;
  /** 该模块解析后的要点样式（模块级设置 → 全局默认） */
  bulletStyle: BulletStyleKey;
  onBulletStyleChange: (v: BulletStyleKey) => void;
}) {
  const { patchBlock, deleteBlock, moveBlock } = useAppSlice(
    "patchBlock",
    "deleteBlock",
    "moveBlock"
  );
  const [open, setOpen] = useState(true);
  const [confirmDel, setConfirmDel] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  useActionMenu(moreOpen, setMoreOpen, moreRef);
  const jd = useApp((s) => s.jds[resume.id]);
  const isEntry = [
    "work_experience_item",
    "project_experience_item",
    "education_item",
  ].includes(block.type);
  const preview =
    block.title ||
    stripHtml(block.description).slice(0, 28) ||
    stripHtml(block.bullets[0] ?? "").slice(0, 28) ||
    "（空白条目）";

  return (
    <div
      data-block-id={block.block_id}
      className={cx(
        "group border-b border-line bg-transparent last:border-b-0"
      )}
    >
      <div
        className="flex flex-wrap cursor-pointer items-center gap-2 px-3 py-2"
        onClick={() => setOpen((v) => !v)}
      >
        <button
          className="tool-btn h-6 w-6"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          aria-label={open ? "折叠" : "展开"}
        >
          {open ? (
            <IconChevronDown size={14} />
          ) : (
            <IconChevronUp size={14} className="rotate-180" />
          )}
        </button>
        <span className="chip shrink-0 bg-paper-200 font-mono text-ink-500">
          {TYPE_LABEL[block.type]}
        </span>
        <span
          className={cx(
            "min-w-0 flex-1 truncate text-[13px]",
            block.title ? "font-medium text-ink-800" : "text-ink-500"
          )}
        >
          {preview}
        </span>
        {block.start_date && (
          <span className="shrink-0 font-mono text-[12px] text-ink-500">
            {block.start_date}
            {block.end_date ? ` – ${block.end_date}` : ""}
          </span>
        )}
        <div
          className="flex shrink-0 items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <AIActionMenu
            hasJD={!!jd}
            onAction={(a) => onRequestAI(section.section_id, block.block_id, a)}
          />
          <div
            className="relative"
            ref={moreRef}

          >
            <button
              type="button"
              className="editor-action rounded-sm px-3 py-1.5 text-[13px] text-ink-600 hover:bg-paper-100"
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              aria-label={`更多操作 ${preview}`}
              onClick={() => setMoreOpen((v) => !v)}
            >
              更多
            </button>
            {moreOpen && (
              <div
                role="menu" aria-label="条目操作"
          className="app-menu absolute right-0 top-full z-20 mt-1 w-36 rounded-lg border border-line bg-white p-1 shadow-lg"
              >
                <button
                  role="menuitem" tabIndex={-1}
                  className="block w-full rounded px-3 py-2 text-left text-[12px] hover:bg-paper-100 disabled:opacity-40"
                  disabled={index === 0}
                  onClick={() => {
                    moveBlock(
                      resume.id,
                      section.section_id,
                      block.block_id,
                      "up"
                    );
                    setMoreOpen(false);
                  }}
                >
                  上移
                </button>
                <button
                  role="menuitem" tabIndex={-1}
                  className="block w-full rounded px-3 py-2 text-left text-[12px] hover:bg-paper-100 disabled:opacity-40"
                  disabled={index === total - 1}
                  onClick={() => {
                    moveBlock(
                      resume.id,
                      section.section_id,
                      block.block_id,
                      "down"
                    );
                    setMoreOpen(false);
                  }}
                >
                  下移
                </button>
                <button
                  role="menuitem" tabIndex={-1}
                  className="block w-full rounded px-3 py-2 text-left text-[12px] hover:bg-paper-100"
                  onClick={() => {
                    patchBlock(resume.id, section.section_id, block.block_id, {
                      visible: !block.visible,
                    });
                    setMoreOpen(false);
                  }}
                >
                  {block.visible ? "隐藏这段" : "显示这段"}
                </button>
                <button
                  role="menuitem" tabIndex={-1}
                  className="block w-full rounded px-3 py-2 text-left text-[12px] text-danger-700 hover:bg-danger-100"
                  onClick={() => {
                    setConfirmDel(true);
                    setMoreOpen(false);
                  }}
                >
                  删除这段
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: "auto",
              opacity: 1,
              transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
            }}
            exit={{
              height: 0,
              opacity: 0,
              transition: { duration: 0.16, ease: "easeIn" },
            }}
            className="overflow-hidden"
          >
            <div
              className={cx(
                "grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-2 border-t border-ink-100 px-3 py-3",
                !block.visible && "opacity-50"
              )}
            >
              {(isEntry ||
                block.type === "certification" ||
                block.type === "custom_text") && (
                <F
                  label={
                    block.type === "education_item"
                      ? "学校"
                      : block.type === "work_experience_item"
                      ? "公司"
                      : block.type === "project_experience_item"
                      ? "项目名称"
                      : block.type === "certification"
                      ? "名称"
                      : "标题"
                  }
                >
                  <input
                    className="field-input"
                    value={block.title}
                    placeholder={
                      block.type === "education_item"
                        ? "XX 大学"
                        : "公司 / 项目名"
                    }
                    onChange={(e) =>
                      patchBlock(
                        resume.id,
                        section.section_id,
                        block.block_id,
                        { title: e.target.value }
                      )
                    }
                  />
                </F>
              )}
              {(isEntry || block.type === "custom_text") && (
                <Fragment>
                  <F
                    label={
                      block.type === "education_item"
                        ? "专业与学历"
                        : "职位或角色"
                    }
                  >
                    <input
                      className="field-input"
                      value={block.subtitle}
                      placeholder={
                        block.type === "education_item"
                          ? "专业 · 学历"
                          : "职位 / 角色"
                      }
                      onChange={(e) =>
                        patchBlock(
                          resume.id,
                          section.section_id,
                          block.block_id,
                          { subtitle: e.target.value }
                        )
                      }
                    />
                  </F>
                  {(block.subtitles ?? []).length > 0 && (
                    <div className="sm:col-span-2 flex flex-col gap-1.5">
                      {block.subtitles!.map((st, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <span
                            className="shrink-0 text-[12px] text-ink-500"
                            aria-hidden="true"
                          >
                            ·
                          </span>
                          <input
                            className="field-input min-w-0 flex-1"
                            value={st}
                            placeholder="补充职位或角色"
                            onChange={(e) => {
                              const next = [...(block.subtitles ?? [])];
                              next[i] = e.target.value;
                              patchBlock(
                                resume.id,
                                section.section_id,
                                block.block_id,
                                { subtitles: next }
                              );
                            }}
                          />
                          <button
                            className="tool-btn hover:bg-danger-100 hover:text-danger-600"
                            aria-label={`删除副标题 ${i + 1}`}
                            onClick={() =>
                              patchBlock(
                                resume.id,
                                section.section_id,
                                block.block_id,
                                {
                                  subtitles: (block.subtitles ?? []).filter(
                                    (_, j) => j !== i
                                  ),
                                }
                              )
                            }
                          >
                            <IconTrash size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    className="sm:col-span-2 self-start inline-flex items-center gap-1 text-[12px] font-medium text-brand-600 transition hover:text-brand-700"
                    onClick={() =>
                      patchBlock(
                        resume.id,
                        section.section_id,
                        block.block_id,
                        { subtitles: [...(block.subtitles ?? []), ""] }
                      )
                    }
                  >
                    <IconPlus size={12} /> 补充职位或角色
                  </button>
                </Fragment>
              )}
              {isEntry && (
                <>
                  <F label="开始时间">
                    <input
                      className="field-input font-mono"
                      value={block.start_date}
                      placeholder="2021-03"
                      onChange={(e) =>
                        patchBlock(
                          resume.id,
                          section.section_id,
                          block.block_id,
                          { start_date: e.target.value }
                        )
                      }
                    />
                  </F>
                  <F label="结束时间">
                    <input
                      className="field-input font-mono"
                      value={block.end_date}
                      placeholder="至今 / 2024-06"
                      onChange={(e) =>
                        patchBlock(
                          resume.id,
                          section.section_id,
                          block.block_id,
                          { end_date: e.target.value }
                        )
                      }
                    />
                  </F>
                </>
              )}
              {block.type === "certification" && (
                <F label="时间">
                  <input
                    className="field-input font-mono"
                    value={block.start_date}
                    placeholder="2023"
                    onChange={(e) =>
                      patchBlock(
                        resume.id,
                        section.section_id,
                        block.block_id,
                        { start_date: e.target.value }
                      )
                    }
                  />
                </F>
              )}

              {block.type === "summary" || block.type === "custom_text" ? (
                /* 不能用 F（<label>）包 RichTextEditor：label 的 labeled control 会命中
                 * 工具栏的 B 按钮（button 是 labelable 元素），点击描述区域内任何非交互
                 * 内容都会被转发为对 B 的一次合成点击 —— execCommand("bold") 被意外执行、
                 * 焦点被按钮抢走，用户表现为「描述无法编辑」。要点区正是用了 div 包装
                 * 才一直正常。两处编辑器的结构必须保持一致（均为 div，见 BulletsEdit）。 */
                <div className="sm:col-span-2 min-w-0">
                  <span className="field-label">经历概述（可选）</span>
                  <RichTextEditor
                    value={block.description}
                    onChange={(html) =>
                      patchBlock(
                        resume.id,
                        section.section_id,
                        block.block_id,
                        { description: html }
                      )
                    }
                    placeholder="概括与你的目标岗位相关的经历与优势"
                  />
                </div>
              ) : null}

              {block.type === "skill_group" && (
                <F label="组名" className="sm:col-span-2">
                  <input
                    className="field-input"
                    value={block.title}
                    placeholder="如：核心技术"
                    onChange={(e) =>
                      patchBlock(
                        resume.id,
                        section.section_id,
                        block.block_id,
                        { title: e.target.value }
                      )
                    }
                  />
                </F>
              )}
              {(block.type === "skill_group" ||
                block.type === "project_experience_item") && (
                <F label="技能标签" className="sm:col-span-2">
                  <TagInput
                    values={block.skills}
                    onChange={(v) =>
                      patchBlock(
                        resume.id,
                        section.section_id,
                        block.block_id,
                        { skills: v }
                      )
                    }
                    placeholder="React、TypeScript…"
                  />
                </F>
              )}

              {(isEntry ||
                block.type === "custom_text" ||
                block.type === "summary") && (
                <BulletsEdit
                  value={block.bullets}
                  marks={block.bullet_marks}
                  onChange={(v) =>
                    patchBlock(resume.id, section.section_id, block.block_id, {
                      bullets: v,
                    })
                  }
                  onMarksChange={(m) =>
                    patchBlock(resume.id, section.section_id, block.block_id, {
                      bullet_marks: m,
                    })
                  }
                  bulletStyle={bulletStyle}
                  onBulletStyleChange={onBulletStyleChange}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Confirm
        open={confirmDel}
        danger
        title="删除该条目？"
        desc={`「${preview}」将从简历中移除，此操作不可撤销。`}
        confirmText="删除"
        onConfirm={() => {
          deleteBlock(resume.id, section.section_id, block.block_id);
          setConfirmDel(false);
        }}
        onCancel={() => setConfirmDel(false)}
      />
    </div>
  );
}

/* ---------------- Section 卡片 ---------------- */

export function SectionCard({
  resume,
  section,
  onRequestAI,
  dragHandle,
}: {
  resume: Resume;
  section: Section;
  onRequestAI: (sectionId: string, blockId: string, action: AIAction) => void;
  dragHandle?: ReactNode;
}) {
  const {
    addBlock,
    toggleSection,
    deleteSection,
    renameSection,
    setSectionBulletStyle,
  } = useAppSlice(
    "addBlock",
    "toggleSection",
    "deleteSection",
    "renameSection",
    "setSectionBulletStyle"
  );
  const [confirmDel, setConfirmDel] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const visibleBlocks = section.blocks;
  // 模块级要点样式：本模块设置优先，未设置则继承全局默认
  const bulletStyle: BulletStyleKey = resolveBulletStyle(
    section.bullet_style,
    resume.theme.bullet_style
  );
  const setBulletStyle = (v: BulletStyleKey) =>
    setSectionBulletStyle(resume.id, section.section_id, v);

  return (
    <section
      className={cx(
        "rounded-xl border bg-white transition-all duration-200",
        section.visible
          ? "border-line"
          : "border-dashed border-ink-200 opacity-70"
      )}
    >
      <header className="flex items-center gap-2 border-b border-ink-100 px-3 py-2.5">
        {dragHandle}
        {editingTitle ? (
          <input
            autoFocus
            defaultValue={section.title}
            onBlur={(e) => {
              renameSection(
                resume.id,
                section.section_id,
                e.target.value.trim() || section.title
              );
              setEditingTitle(false);
            }}
            onKeyDown={(e) =>
              e.key === "Enter" && (e.target as HTMLInputElement).blur()
            }
            className="field-input max-w-[180px] py-0.5 font-display text-[15px] font-bold"
          />
        ) : (
          <h3
            className="cursor-text font-display text-[16px] font-bold text-ink-900"
            onClick={() => section.type === "custom" && setEditingTitle(true)}
            title={section.type === "custom" ? "点击重命名" : undefined}
          >
            {section.title}
            {section.type === "custom" && (
              <span className="ml-1.5 align-middle text-[12px] font-normal text-ink-500">
                自定义
              </span>
            )}
          </h3>
        )}
        {section.type !== "basic_info" && visibleBlocks.length > 0 && (
          <span className="text-[12px] text-ink-400">
            {visibleBlocks.length} 条
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button
            className="tool-btn"
            onClick={() => toggleSection(resume.id, section.section_id)}
            aria-label="显示/隐藏模块"
            title={
              section.visible
                ? "隐藏模块（保留排序位置，不参与预览/导出）"
                : "显示模块"
            }
          >
            {section.visible ? <IconEye size={15} /> : <IconEyeOff size={15} />}
          </button>
          {section.type === "custom" && (
            <button
              className="tool-btn hover:bg-danger-100 hover:text-danger-600"
              onClick={() => setConfirmDel(true)}
              aria-label="删除模块"
            >
              <IconTrash size={15} />
            </button>
          )}
        </div>
      </header>

      {!section.visible ? (
        <p className="px-4 py-3 text-[12px] text-ink-400">
          栏目已隐藏，不参与预览和导出。
        </p>
      ) : section.type === "basic_info" ? (
        <BasicInfoEditor resume={resume} />
      ) : visibleBlocks.length === 0 ? (
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-[12px] text-ink-500">暂无内容</p>
          <button
            onClick={() => addBlock(resume.id, section.section_id)}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-600 transition hover:text-brand-700"
          >
            <IconPlus size={13} /> 添加
            {section.type === "custom"
              ? section.title
              : SECTION_LABELS[section.type]}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 p-2.5">
          {visibleBlocks.map((b, i) => (
            <BlockCard
              key={b.block_id}
              resume={resume}
              section={section}
              block={b}
              index={i}
              total={visibleBlocks.length}
              onRequestAI={onRequestAI}
              bulletStyle={bulletStyle}
              onBulletStyleChange={setBulletStyle}
            />
          ))}
          <button
            onClick={() => addBlock(resume.id, section.section_id)}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-ink-200 py-2 text-[12px] font-medium text-ink-400 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
          >
            <IconPlus size={13} /> 添加
            {section.type === "custom"
              ? section.title
              : SECTION_LABELS[section.type]}
          </button>
        </div>
      )}

      <Confirm
        open={confirmDel}
        danger
        title="删除整个模块？"
        desc={`「${section.title}」及其 ${section.blocks.length} 个条目将被移除。`}
        confirmText="删除模块"
        onConfirm={() => {
          deleteSection(resume.id, section.section_id);
          setConfirmDel(false);
        }}
        onCancel={() => setConfirmDel(false)}
      />
    </section>
  );
}

function ImageUploadField({
  label,
  url,
  onFile,
  onClear,
  rounded,
  placeholder,
}: {
  label: string;
  url?: string;
  onFile: (file: File) => void;
  onClear: () => void;
  rounded: string;
  placeholder: string;
}) {
  const id = `img-${label}`;
  return (
    <div className="block min-w-0">
      <span className="field-label">{label}</span>
      <div className="flex items-center gap-2">
        <div
          className={cx(
            "h-14 w-14 shrink-0 overflow-hidden bg-paper-100 ring-1 ring-ink-100",
            rounded
          )}
        >
          {url ? (
            <img src={url} alt={label} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[1.1em] font-bold text-ink-500">
              {placeholder}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor={id}
            className="inline-flex cursor-pointer items-center gap-1 text-[12px] font-medium text-brand-600 hover:text-brand-700"
          >
            <IconUpload size={12} /> 上传
          </label>
          <input
            id={id}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          {url && (
            <button
              type="button"
              onClick={onClear}
              className="text-left text-[12px] text-danger-600 hover:text-danger-700"
            >
              清除
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function BasicInfoEditor({ resume }: { resume: Resume }) {
  const { patchBasic, setAvatar, setSchoolBadge, toast } = useAppSlice(
    "patchBasic",
    "setAvatar",
    "setSchoolBadge",
    "toast"
  );
  const b = resume.data.basic_info;
  const fields: Array<{
    key: "name" | "title" | "email" | "phone" | "location" | "website";
    label: string;
    ph: string;
  }> = [
    { key: "name", label: "姓名", ph: "张三" },
    { key: "title", label: "目标职位", ph: "高级前端工程师" },
    { key: "email", label: "邮箱", ph: "you@example.com" },
    { key: "phone", label: "电话", ph: "138-0000-0000" },
    { key: "location", label: "所在城市", ph: "上海" },
    { key: "website", label: "主页 / GitHub", ph: "github.com/you" },
  ];

  const handleImage = async (
    file: File | undefined,
    setter: (url: string | null) => void,
    label: string
  ) => {
    if (!file) return;
    try {
      const url = await fileToDataUrl(file);
      setter(url);
      toast("ok", `${label}已更新`);
    } catch (e) {
      toast("err", e instanceof Error ? e.message : "上传失败");
    }
  };

  return (
    <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-2 px-3 py-3">
      {fields.map((f) => (
        <RichField
          key={f.key}
          label={f.label}
          value={b[f.key]}
          placeholder={f.ph}
          onChange={(v) => patchBasic(resume.id, { [f.key]: v })}
        />
      ))}
      {/* 头像/校徽仅学术双栏模板渲染（template.tsx 中只有该分支使用），单栏与 ATS 不提供上传入口 */}
      {resume.template_id === "academic_photo" && (
        <>
          <ImageUploadField
            label="头像"
            url={resume.data.avatar_url}
            onFile={(file) =>
              handleImage(file, (url) => setAvatar(resume.id, url), "头像")
            }
            onClear={() => setAvatar(resume.id, null)}
            rounded="rounded-lg"
            placeholder="?"
          />
          <ImageUploadField
            label="校徽"
            url={resume.data.school_badge_url}
            onFile={(file) =>
              handleImage(file, (url) => setSchoolBadge(resume.id, url), "校徽")
            }
            onClear={() => setSchoolBadge(resume.id, null)}
            rounded="rounded-full"
            placeholder="校"
          />
        </>
      )}
      {/* 自定义信息项：固定六项之外的补充字段（如 期望薪资 / 政治面貌），随联系方式一行渲染 */}
      <div className="sm:col-span-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="field-label">补充信息</span>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-600 transition hover:text-brand-700"
            onClick={() =>
              patchBasic(resume.id, {
                custom_fields: [
                  ...(b.custom_fields ?? []),
                  { label: "", value: "" },
                ],
              })
            }
          >
            <IconPlus size={12} /> 添加信息
          </button>
        </div>
        {(b.custom_fields ?? []).length === 0 && (
          <details className="text-[12px] text-ink-500">
            <summary className="cursor-pointer">哪些信息适合放在这里？</summary>
            <p className="mt-1">
              可按岗位要求补充到岗时间等信息，填写名称与内容后显示在简历上。
            </p>
          </details>
        )}
        {(b.custom_fields ?? []).length > 0 && (
          <div className="flex flex-col gap-1.5">
            {(b.custom_fields ?? []).map((f, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  className="field-input w-24 shrink-0"
                  value={f.label}
                  placeholder="字段名"
                  aria-label={`信息项字段名 ${i + 1}`}
                  onChange={(e) => {
                    const next = [...(b.custom_fields ?? [])];
                    next[i] = { ...next[i], label: e.target.value };
                    patchBasic(resume.id, { custom_fields: next });
                  }}
                />
                <input
                  className="field-input min-w-0 flex-1"
                  value={f.value}
                  placeholder="内容（如 20-30k）"
                  aria-label={`信息项内容 ${i + 1}`}
                  onChange={(e) => {
                    const next = [...(b.custom_fields ?? [])];
                    next[i] = { ...next[i], value: e.target.value };
                    patchBasic(resume.id, { custom_fields: next });
                  }}
                />
                <button
                  type="button"
                  className="tool-btn hover:bg-danger-100 hover:text-danger-600"
                  aria-label={`删除信息项 ${f.label || i + 1}`}
                  onClick={() =>
                    patchBasic(resume.id, {
                      custom_fields: (b.custom_fields ?? []).filter(
                        (_, j) => j !== i
                      ),
                    })
                  }
                >
                  <IconTrash size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
