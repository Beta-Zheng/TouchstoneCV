import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
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
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  AIAction,
  Block,
  MatchReport,
  Resume,
  Section,
  Suggestion,
} from "../types";
import { ACTION_LABELS, SECTION_LABELS } from "../types";
import { cx, diffLines, fmtTime, timeAgo } from "../lib/utils";
import { useApp, useAppSlice } from "../lib/store";
import {
  matchResumeData,
  parseJD,
  jdEvidence,
  qualificationEvidence,
} from "../lib/jd";
import { SAMPLE_JD_TEXT } from "../lib/samples";
import { blockContent } from "../lib/backup";
import { celebrate } from "../lib/celebrate";
import { Btn, Empty, ScoreBar, ScoreRing } from "./ui";
import {
  IconCheck,
  IconEdit,
  IconEye,
  IconEyeOff,
  IconGrip,
  IconRefresh,
  IconSpark,
  IconTarget,
  IconWand,
  IconX,
  IconAlert,
  IconLock,
  IconPlus,
} from "./icons";

/* ================= 左侧大纲（可拖拽排序） ================= */

function OutlineItem({
  section,
  resumeId,
  active,
}: {
  section: Section;
  resumeId: string;
  active?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.section_id });
  const toggleSection = useApp((s) => s.toggleSection);
  // 点击标题跳转到中栏对应模块卡；scrollIntoView 沿最近的滚动容器（中栏 main）滚动
  const scrollToSection = () => {
    document
      .querySelector<HTMLElement>(`[data-section-id="${section.section_id}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cx(
        "group flex items-center gap-1.5 rounded-lg border px-2 py-1.5 transition-all duration-150",
        isDragging
          ? "z-10 border-brand-400 bg-brand-50 shadow-lg shadow-brand-900/10"
          : active && section.visible
          ? "border-brand-200 bg-brand-50"
          : "border-transparent hover:border-ink-200 hover:bg-white",
        !section.visible && "opacity-45"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className={cx(
          "cursor-grab touch-none transition active:cursor-grabbing",
          active && section.visible
            ? "text-brand-500"
            : "text-ink-500 hover:text-ink-600"
        )}
        aria-label="拖动排序"
      >
        <IconGrip size={14} />
      </button>
      <button
        type="button"
        onClick={scrollToSection}
        title="点击跳转到该模块"
        className={cx(
          "min-w-0 flex-1 truncate rounded text-left text-[12.5px] transition-colors hover:text-brand-700",
          section.visible
            ? active
              ? "font-bold text-brand-800"
              : "font-medium text-ink-800"
            : "text-ink-400 line-through decoration-ink-300"
        )}
      >
        {section.title}
      </button>
      <span className="font-mono text-[12px] text-ink-500">
        {section.type === "basic_info" ? "" : section.blocks.length}
      </span>
      <button
        className="tool-btn h-6 w-6 opacity-0 transition group-hover:opacity-100"
        onClick={() => toggleSection(resumeId, section.section_id)}
        aria-label="显示/隐藏"
      >
        {section.visible ? <IconEye size={12} /> : <IconEyeOff size={12} />}
      </button>
    </li>
  );
}

export function OutlinePanel({
  resume,
  activeId,
  onAdd,
}: {
  resume: Resume;
  activeId?: string | null;
  onAdd?: () => void;
}) {
  const reorderSections = useApp((s) => s.reorderSections);
  const toast = useApp((s) => s.toast);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );
  const sections = [...resume.data.sections].sort((a, b) => a.order - b.order);

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = sections.findIndex((s) => s.section_id === active.id);
    const newIdx = sections.findIndex((s) => s.section_id === over.id);
    const next = arrayMove(sections, oldIdx, newIdx).map((s) => s.section_id);
    reorderSections(resume.id, next);
    const moved = sections[oldIdx];
    toast(
      "ok",
      `「${moved.title}」已移动到第 ${newIdx + 1} 位，顺序已自动保存`
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 pb-2 pt-3">
        <h2 className="text-[12px] font-bold  text-ink-400">
          栏目目录
        </h2>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="flex items-center gap-1 rounded px-2 py-1 text-[12px] text-ink-600 hover:bg-paper-200"
          >
            <IconPlus size={12} />
            添加栏目
          </button>
        )}
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={sections.map((s) => s.section_id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="flex flex-col gap-0.5 px-1.5 pb-3">
            {sections.map((s) => (
              <OutlineItem
                key={s.section_id}
                section={s}
                resumeId={resume.id}
                active={activeId === s.section_id}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <p className="mt-auto border-t border-ink-100 px-3 py-2.5 text-[10.5px] leading-relaxed text-ink-500">
        顺序实时同步到预览与 PDF 导出；隐藏的模块保留位置但不渲染。
      </p>
    </div>
  );
}

/* ================= AI 建议面板 ================= */

function FieldDiff({
  label,
  from,
  to,
}: {
  label: string;
  from: string;
  to: string;
}) {
  if (from === to) return null;
  return (
    <div className="rounded-md border border-ink-100 bg-white px-2.5 py-1.5 text-[12px]">
      <span className="mr-2 font-mono text-[12px] uppercase tracking-wide text-ink-500">
        {label}
      </span>
      {from && (
        <span className="text-ink-400 line-through decoration-danger-600/50">
          {from}
        </span>
      )}
      {from && to && <span className="mx-1.5 text-ink-500">→</span>}
      <span className="font-medium text-brand-700">{to || "（删除）"}</span>
    </div>
  );
}

function BulletsDiff({ from, to }: { from: string[]; to: string[] }) {
  const ops = diffLines(from.filter(Boolean), to.filter(Boolean));
  return (
    <ul className="flex flex-col gap-1">
      {ops.map((op, i) => (
        <li
          key={i}
          className={cx(
            "rounded-md border px-2.5 py-1.5 text-[12px] leading-relaxed",
            op.kind === "same" && "border-ink-100 bg-white text-ink-600",
            op.kind === "add" && "border-brand-200 bg-brand-50 text-brand-800",
            op.kind === "del" &&
              "border-danger-600/15 bg-danger-100/50 text-ink-400 line-through decoration-danger-600/40"
          )}
        >
          <span
            className={cx(
              "mr-1.5 font-mono text-[12px]",
              op.kind === "add"
                ? "text-brand-600"
                : op.kind === "del"
                ? "text-danger-600"
                : "text-ink-500"
            )}
          >
            {op.kind === "add" ? "+" : op.kind === "del" ? "−" : "·"}
          </span>
          {op.text}
        </li>
      ))}
    </ul>
  );
}

const STATUS_CHIP: Record<string, { text: string; cls: string }> = {
  generating: { text: "生成中", cls: "bg-seal-100 text-seal-700" },
  success: {
    text: "待确认",
    cls: "bg-brand-50 text-brand-700 ring-1 ring-brand-200",
  },
  failed: { text: "失败", cls: "bg-danger-100 text-danger-700" },
  accepted: { text: "已接受", cls: "bg-brand-600 text-white" },
  edited_accepted: { text: "编辑后接受", cls: "bg-brand-100 text-brand-800" },
  rejected: { text: "已拒绝", cls: "bg-paper-200 text-ink-400" },
};

export function AIPanel({
  resume,
  activeTarget,
}: {
  resume: Resume;
  activeTarget: { sectionId: string; blockId: string } | null;
}) {
  const {
    suggestions,
    requestSuggestion,
    acceptSuggestion,
    rejectSuggestion,
    pendingExternal,
    confirmExternal,
    cancelSuggestion,
    undoSuggestion,
    queuedSuggestionCount,
  } = useAppSlice(
    "suggestions",
    "requestSuggestion",
    "acceptSuggestion",
    "rejectSuggestion",
    "pendingExternal",
    "confirmExternal",
    "cancelSuggestion",
    "undoSuggestion",
    "queuedSuggestionCount"
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<{
    title: string;
    subtitle: string;
    description: string;
    bullets: string;
  } | null>(null);

  const list = useMemo(
    () => suggestions.filter((s) => s.resume_id === resume.id),
    [suggestions, resume.id]
  );
  const active: Suggestion | undefined =
    (selectedId && list.find((s) => s.id === selectedId)) ||
    (activeTarget &&
      list.find((s) => !s.resolution && s.block_id === activeTarget.blockId)) ||
    list.find((s) => !s.resolution && s.status === "success") ||
    list[0];

  const blockTitle = active
    ? active.original.title ||
      active.original.description.slice(0, 16) ||
      "该条目"
    : "";

  const startEdit = (s: Suggestion) => {
    if (!s.suggested) return;
    setEditing(true);
    setDraft({
      title: s.suggested.title,
      subtitle: s.suggested.subtitle,
      description: s.suggested.description,
      bullets: s.suggested.bullets.filter(Boolean).join("\n"),
    });
  };

  const acceptEdited = (s: Suggestion) => {
    if (!s.suggested || !draft) return;
    const edited: Block = {
      ...s.suggested,
      title: draft.title,
      subtitle: draft.subtitle,
      description: draft.description,
      bullets: draft.bullets.split("\n"),
    };
    if (!acceptSuggestion(s.id, edited)) return;
    celebrate();
    setEditing(false);
    setDraft(null);
  };

  const accept = (s: Suggestion) => {
    if (acceptSuggestion(s.id)) celebrate();
  };

  return (
    <div className="flex h-full flex-col">
      {queuedSuggestionCount > 0 && (
        <p
          role="status"
          className="bg-brand-50 px-4 py-2 text-[12px] text-brand-700"
        >
          模块优化：还有 {queuedSuggestionCount}{" "}
          条等待生成；外部请求会逐条确认。
        </p>
      )}
      <div className="flex items-center justify-between px-4 pb-2 pt-3.5">
        <h2 className="flex items-center gap-1.5 text-[12px] font-bold  text-ink-400">
          <IconWand size={13} className="text-brand-600" /> AI 建议
        </h2>
        <span className="font-mono text-[12px] text-ink-500">
          {list.length} 条记录
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {!active && (
          <Empty
            accent="ai"
            icon={<IconSpark size={20} />}
            title="还没有 AI 建议"
            desc="在经历条目上点击「优化这段」，选择需要的动作。生成的建议需确认后才会写入简历。"
          />
        )}

        {active && (
          <div className="anim-fade-up flex flex-col gap-2.5" key={active.id}>
            <div className="relative overflow-hidden rounded-xl border border-ink-200 bg-white shadow-sm">
              {/* AI 流标识：光谱左边框（3px），看到光谱 = AI 在工作 */}
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 z-10 w-[3px]"
                style={{
                  backgroundImage:
                    "linear-gradient(180deg, var(--color-sp-a), var(--color-sp-b), var(--color-sp-c))",
                }}
              />
              <div className="flex items-center gap-2 border-b border-ink-100 px-3.5 py-2.5">
                <span
                  className={cx(
                    "chip",
                    STATUS_CHIP[active.resolution ?? active.status].cls
                  )}
                >
                  {STATUS_CHIP[active.resolution ?? active.status].text}
                </span>
                <span className="text-[12.5px] font-bold text-ink-800">
                  {ACTION_LABELS[active.action].label}
                </span>
                <span className="truncate text-[11.5px] text-ink-400">
                  · {blockTitle}
                </span>
                <span className="ml-auto shrink-0 font-mono text-[12px] text-ink-500">
                  {fmtTime(active.created_at)}
                </span>
              </div>

              <div className="flex flex-col gap-2.5 px-3.5 py-3">
                <p className="flex items-center gap-1.5 text-[12px] text-ink-400">
                  <span className="sp-dot" />
                  <IconLock size={11} />
                  {active.engine === "rules" ? "规则检查" : "模型写作"}：
                  {active.provider_name} · 不直接覆盖原文
                </p>

                {active.status === "generating" && (
                  <div className="flex flex-col gap-2 py-2">
                    {(active.engine === "rules"
                      ? ["核对当前条目", "检查措辞与事实", "生成补充提示"]
                      : [
                          "构建 Prompt 与上下文",
                          "调用模型生成",
                          "JSON Schema 校验",
                        ]
                    ).map((step, i) => (
                      <div
                        key={step}
                        className="flex items-center gap-2 text-[12px] text-ink-500"
                        style={{
                          animation: `fade-in .3s ease ${i * 0.12}s both`,
                        }}
                      >
                        <span
                          className="anim-pulse-dot h-1.5 w-1.5 rounded-full bg-seal-500"
                          style={{ animationDelay: `${i * 0.25}s` }}
                        />
                        {step}
                        <span className="shimmer ml-auto h-2 w-16 rounded-full" />
                      </div>
                    ))}
                    <p className="mt-1 text-[12px] text-ink-500">
                      {active.engine === "rules"
                        ? "正在核对措辞与补充提示，原文保持不变…"
                        : "模型较慢时可能需要数十秒，期间可继续编辑…"}
                    </p>
                    <Btn
                      variant="ghost"
                      className="h-7 text-[12px]"
                      onClick={() => cancelSuggestion(active.id)}
                    >
                      取消生成
                    </Btn>
                  </div>
                )}

                {active.status === "failed" && (
                  <div className="rounded-lg border border-danger-600/20 bg-danger-100/60 px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-danger-700">
                      <IconAlert size={13} /> 生成失败，原内容已保留
                    </p>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-danger-700/80">
                      {active.error}
                    </p>
                    <Btn
                      variant="outline"
                      className="mt-2.5 h-7 px-2.5 text-[12px]"
                      onClick={() =>
                        requestSuggestion(
                          active.resume_id,
                          active.section_id,
                          active.block_id,
                          active.action
                        )
                      }
                    >
                      <IconRefresh size={12} /> 重试
                    </Btn>
                  </div>
                )}

                {active.status === "success" && active.suggested && (
                  <>
                    {active.suggested &&
                      blockContent(active.original) ===
                        blockContent(active.suggested) && (
                        <p className="rounded bg-paper-100 p-2 text-[12px]">
                          原文无需改动；以下仅为检查提示，可编辑补充真实事实。
                        </p>
                      )}
                    {active.explanation && (
                      <p className="rounded-lg bg-paper-100 px-3 py-2 text-[12px] leading-relaxed text-ink-600">
                        {active.explanation}
                      </p>
                    )}
                    {active.warnings.length > 0 && (
                      <ul className="flex flex-col gap-1">
                        {active.warnings.map((w, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-1.5 rounded-md border border-seal-500/20 bg-seal-100/60 px-2.5 py-1.5 text-[11.5px] leading-snug text-seal-700"
                          >
                            <IconAlert size={11} className="mt-0.5 shrink-0" />{" "}
                            {w}
                          </li>
                        ))}
                      </ul>
                    )}
                    {active.matched_keywords.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-[10.5px] text-ink-400">
                          命中关键词
                        </span>
                        {active.matched_keywords.map((k) => (
                          <span
                            key={k}
                            className="chip bg-brand-600 text-white"
                          >
                            {k}
                          </span>
                        ))}
                      </div>
                    )}

                    {!editing ? (
                      <div className="flex flex-col gap-2">
                        {(active.original.title !== active.suggested.title ||
                          active.original.subtitle !==
                            active.suggested.subtitle) && (
                          <div className="flex flex-col gap-1">
                            <FieldDiff
                              label="标题"
                              from={active.original.title}
                              to={active.suggested.title}
                            />
                            <FieldDiff
                              label="副标题"
                              from={active.original.subtitle}
                              to={active.suggested.subtitle}
                            />
                          </div>
                        )}
                        {active.original.description !==
                          active.suggested.description && (
                          <div>
                            <p className="field-label">描述对比</p>
                            <BulletsDiff
                              from={[active.original.description]}
                              to={[active.suggested.description]}
                            />
                          </div>
                        )}
                        {(active.original.bullets.filter(Boolean).length > 0 ||
                          active.suggested.bullets.filter(Boolean).length >
                            0) && (
                          <div>
                            <p className="field-label">要点 Diff</p>
                            <BulletsDiff
                              from={active.original.bullets}
                              to={active.suggested.bullets}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      draft && (
                        <div className="flex flex-col gap-2 rounded-lg border border-brand-200 bg-brand-50/50 p-2.5">
                          <p className="field-label mb-0">编辑建议内容后接受</p>
                          <input
                            className="field-input"
                            value={draft.title}
                            onChange={(e) =>
                              setDraft({ ...draft, title: e.target.value })
                            }
                            placeholder="标题"
                          />
                          <input
                            className="field-input"
                            value={draft.subtitle}
                            onChange={(e) =>
                              setDraft({ ...draft, subtitle: e.target.value })
                            }
                            placeholder="副标题"
                          />
                          <textarea
                            className="field-input resize-y"
                            rows={2}
                            value={draft.description}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                description: e.target.value,
                              })
                            }
                            placeholder="描述"
                          />
                          <textarea
                            className="field-input resize-y"
                            rows={5}
                            value={draft.bullets}
                            onChange={(e) =>
                              setDraft({ ...draft, bullets: e.target.value })
                            }
                            placeholder="每行一条要点"
                          />
                        </div>
                      )
                    )}

                    {!active.resolution && active.status === "success" && (
                      <div className="flex flex-wrap gap-2 border-t border-ink-100 pt-2.5">
                        {!editing ? (
                          <>
                            <button
                              className="cta-ai flex h-8 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-bold"
                              disabled={
                                !!active.suggested &&
                                blockContent(active.original) ===
                                  blockContent(active.suggested)
                              }
                              onClick={() => accept(active)}
                            >
                              <IconCheck size={13} /> 接受
                            </button>
                            <Btn
                              variant="outline"
                              className="h-8"
                              onClick={() => startEdit(active)}
                            >
                              <IconEdit size={12} /> 编辑后接受
                            </Btn>
                            <Btn
                              variant="ghost"
                              className="h-8"
                              onClick={() => rejectSuggestion(active.id)}
                            >
                              <IconX size={13} /> 拒绝
                            </Btn>
                          </>
                        ) : (
                          <>
                            <button
                              className="cta-ai flex h-8 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-bold"
                              onClick={() => acceptEdited(active)}
                            >
                              <IconCheck size={13} /> 接受编辑后的内容
                            </button>
                            <Btn
                              variant="ghost"
                              className="h-8"
                              onClick={() => {
                                setEditing(false);
                                setDraft(null);
                              }}
                            >
                              返回对比
                            </Btn>
                          </>
                        )}
                      </div>
                    )}
                    {active.applied &&
                      (active.resolution === "accepted" ||
                        active.resolution === "edited_accepted") && (
                        <Btn
                          variant="outline"
                          className="mt-2 h-8"
                          onClick={() => undoSuggestion(active.id)}
                        >
                          撤销本次接受
                        </Btn>
                      )}
                  </>
                )}
              </div>
            </div>

            {list.length > 1 && (
              <div>
                <p className="field-label px-1">历史记录</p>
                <ul className="flex flex-col gap-1">
                  {list.slice(0, 8).map((s) => (
                    <li key={s.id}>
                      <button
                        onClick={() => {
                          setSelectedId(s.id === active?.id ? null : s.id);
                          setEditing(false);
                        }}
                        className={cx(
                          "flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition",
                          s.id === active?.id
                            ? "border-brand-300 bg-brand-50"
                            : "border-transparent hover:border-ink-200 hover:bg-white"
                        )}
                      >
                        <span
                          className={cx(
                            "chip shrink-0",
                            STATUS_CHIP[s.resolution ?? s.status].cls
                          )}
                        >
                          {STATUS_CHIP[s.resolution ?? s.status].text}
                        </span>
                        <span className="shrink-0 text-[11.5px] font-medium text-ink-700">
                          {ACTION_LABELS[s.action].label}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[12px] text-ink-400">
                          {s.original.title || "条目"}
                        </span>
                        <span className="shrink-0 font-mono text-[9.5px] text-ink-500">
                          {fmtTime(s.created_at)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 底部隐私注脚（设计 §4.3-2）：AI 可控叙事，看到光谱 = AI */}
      {active && (
        <div className="border-t border-line px-4 py-2.5">
          <p className="flex items-center gap-1.5 text-[10.5px] text-ink-400">
            <span className="sp-dot" /> 规则检查与模型写作分别标注 ·
            确认前不会改动原文
          </p>
        </div>
      )}

      {/* 外部模型调用确认（ask_before_external / 首次外部调用） */}
      {pendingExternal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="anim-fade-in absolute inset-0 bg-ink-950/55"
            onClick={() => confirmExternal(false)}
          />
          <div className="anim-scale-in relative w-full max-w-sm rounded-xl bg-paper-25 p-5 shadow-2xl ring-1 ring-ink-900/10">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-seal-100 text-seal-600">
                <IconAlert size={17} />
              </span>
              <div>
                <h3 className="text-[15px] font-bold text-ink-900">
                  即将调用外部模型
                </h3>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-500">
                  继续将把
                  <strong className="text-ink-800">
                    该条目、姓名与技能摘要及目标 JD 上下文
                  </strong>
                  发送到外部服务
                  <strong className="text-ink-800">
                    「{pendingExternal.providerName}」
                  </strong>
                  （{pendingExternal.providerHost}
                  ）进行处理。本次确认仅授权当前请求。
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Btn variant="ghost" onClick={() => confirmExternal(false)}>
                取消，保持本地
              </Btn>
              <Btn variant="seal" onClick={() => confirmExternal(true)}>
                确认发送
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= JD 面板 ================= */

export function JDPanel({
  resume,
  onLocate,
}: {
  resume: Resume;
  onLocate?: (sectionId: string, blockId?: string) => void;
}) {
  const { setJD, toast } = useAppSlice("setJD", "toast");
  const jd = useApp((s) => s.jds[resume.id]);
  const [raw, setRaw] = useState("");
  const [editingJD, setEditingJD] = useState(false);
  const [analysis, setAnalysis] = useState<{
    report: MatchReport;
    data: Resume["data"];
    jd: typeof jd;
  } | null>(null);
  const report =
    analysis?.data === resume.data && analysis.jd === jd
      ? analysis.report
      : null;

  const doParse = (text: string) => {
    if (!text.trim()) {
      toast("warn", "JD 内容不能为空");
      return;
    }
    const parsed = parseJD(text, resume.id);
    setJD(resume.id, parsed);
    setAnalysis(null);
    setEditingJD(false);
    toast(
      "ok",
      `JD 解析完成：提取 ${parsed.structured.skills.length} 项技能、${parsed.structured.keywords.length} 个关键词`
    );
  };

  const doMatch = () => {
    if (!jd) return;
    const r = matchResumeData(resume.data, jd);
    setAnalysis({ report: r, data: resume.data, jd });
  };

  if (!jd || editingJD) {
    return (
      <div className="flex h-full flex-col px-4 pb-4 pt-3.5">
        <h2 className="flex items-center gap-1.5 pb-2 text-[12px] font-bold  text-ink-400">
          <IconTarget size={13} className="text-brand-600" /> 目标岗位 JD
        </h2>
        <p className="mb-2 text-[11.5px] leading-relaxed text-ink-400">
          粘贴招聘
          JD，系统将提取技能与关键词（本地规则解析，不发送给模型），并与简历做匹配分析。
        </p>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={10}
          placeholder={
            "高级前端工程师\n\n岗位职责：\n1. 负责…\n\n任职要求：\n1. 精通 React、TypeScript…"
          }
          className="field-input min-h-0 flex-1 resize-none leading-relaxed"
        />
        <div className="mt-2.5 flex gap-2">
          <Btn
            variant="primary"
            className="h-8 flex-1"
            onClick={() => doParse(raw)}
          >
            <IconTarget size={13} /> 解析 JD
          </Btn>
          <Btn
            variant="outline"
            className="h-8"
            onClick={() => setRaw(SAMPLE_JD_TEXT)}
          >
            填入示例
          </Btn>
          {editingJD && (
            <Btn variant="ghost" onClick={() => setEditingJD(false)}>
              取消修改
            </Btn>
          )}
        </div>
      </div>
    );
  }

  const st = jd.structured;
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pb-2 pt-3.5">
        <h2 className="flex items-center gap-1.5 text-[12px] font-bold  text-ink-400">
          <IconTarget size={13} className="text-brand-600" /> JD ·{" "}
          {st.job_title || "未命名岗位"}
        </h2>
        <div className="flex items-center gap-1">
          <button
            className="tool-btn h-6 w-6"
            title="修改 JD"
            aria-label="修改 JD"
            onClick={() => {
              setRaw(jd.raw_text);
              setEditingJD(true);
            }}
          >
            <IconEdit size={12} />
          </button>
          <button
            className="tool-btn h-6 w-6"
            title="重新解析"
            onClick={() => doParse(jd.raw_text)}
            aria-label="重新解析"
          >
            <IconRefresh size={12} />
          </button>
          <button
            className="tool-btn h-6 w-6 hover:bg-danger-100 hover:text-danger-600"
            title="移除 JD"
            onClick={() => {
              setJD(resume.id, null);
              setAnalysis(null);
            }}
            aria-label="移除 JD"
          >
            <IconX size={12} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <p className="mb-3 rounded-lg bg-paper-100 p-2 text-[12px] leading-relaxed text-ink-500">
          本地规则匹配参考。分数不代表招聘通过率或真实 ATS
          结果；学历和年限的文本依据在下方单独核对。
        </p>
        <div className="mb-2.5 flex flex-wrap gap-1">
          <span className="chip bg-paper-200 text-ink-500">
            {st.education || "学历要求待核对"}
          </span>
          {st.experience_years && (
            <span className="chip bg-paper-200 text-ink-500">
              {st.experience_years} 年经验
            </span>
          )}
          <span className="chip bg-paper-200 text-ink-500">
            {st.responsibilities.length ? `${st.responsibilities.length} 条职责` : '职责尚未识别'}
          </span>
          <span className="chip bg-paper-200 text-ink-500">
            {st.requirements.length ? `${st.requirements.length} 条要求` : '要求尚未识别'}
          </span>
        </div>

        <p className="field-label">提取的技能（{st.skills.length}）</p>
        <div className="mb-3 flex flex-wrap gap-1">
          {st.skills.length ? (
            st.skills.map((s) => (
              <span key={s} className="chip bg-brand-700 text-white">
                {s}
              </span>
            ))
          ) : (
            <span className="text-[12px] text-ink-500">未识别到技能词</span>
          )}
        </div>
        <details className="mb-3 rounded-lg border border-line p-2">
          <summary className="cursor-pointer text-[12px] font-bold">
            JD 原句与简历依据
          </summary>
          <div className="mt-2 space-y-2">
            {jdEvidence(resume, jd).map((item) => (
              <div
                key={item.term}
                className="rounded bg-paper-50 p-2 text-[12px]"
              >
                <p className="font-bold">
                  {item.term} · {item.priority}
                </p>
                <p className="mt-1 text-ink-500">
                  {item.sourceLines[0] || "关键词频次提取，请人工核对"}
                </p>
                {item.matches.length ? (
                  item.matches.map((match) => (
                    <button
                      key={match.blockId}
                      className="mt-1 block text-brand-700 underline"
                      onClick={() => onLocate?.(match.sectionId, match.blockId)}
                    >
                      定位：{match.title}
                    </button>
                  ))
                ) : item.relatedMatches.length ? (
                  <div className="mt-1 text-seal-700"><p>发现相关工具证据，需确认实际使用范围：</p>{item.relatedMatches.map(match => <button key={match.blockId} className="mt-1 block text-brand-700 underline" onClick={() => onLocate?.(match.sectionId, match.blockId)}>定位：{match.title}（{match.tools.join('、')}）</button>)}</div>
                ) : (
                  <p className="mt-1 text-danger-700">
                    未直接匹配到词项，请核对真实经历，不代表缺少该能力。
                  </p>
                )}
              </div>
            ))}
          </div>
        </details>
        {qualificationEvidence(resume, jd).map((item) => (
          <div
            key={item.label}
            className="mb-2 rounded-lg bg-paper-100 p-2 text-[12px]"
          >
            <p className="font-bold">
              {item.label} · {item.status}
            </p>
            <p className="mt-1 text-ink-500">{item.evidence}</p>
          </div>
        ))}

        {!report ? (
          <div>
            {analysis && (
              <p className="mb-2 text-[12px] text-seal-700">
                简历或 JD 已变化，请重新分析。
              </p>
            )}
            <Btn variant="dark" className="h-9 w-full" onClick={doMatch}>
              <IconTarget size={14} /> 分析与当前简历的匹配度
            </Btn>
          </div>
        ) : (
          <div className="anim-fade-up flex flex-col gap-3">
            <details className="rounded-xl border border-ink-200 bg-white p-3.5">
              <summary className="cursor-pointer text-[12px]">
                查看规则数值（不代表岗位胜任度）
              </summary>
              <div className="mt-3 flex items-center gap-4">
                <ScoreRing score={report.overall_score} label="词项覆盖参考" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <ScoreBar label="技能匹配" score={report.skill_match_score} />
                  <ScoreBar
                    label="关键词覆盖"
                    score={report.keyword_coverage_score}
                  />
                  <ScoreBar
                    label="要求词元覆盖"
                    score={report.experience_relevance_score}
                  />
                  <ScoreBar
                    label="成果表述检查"
                    score={report.writing_quality_score}
                  />
                </div>
              </div>
            </details>
            <p className="text-[12px] text-ink-400">
              兼容参考值：技能 35% + 关键词 25% + 经历词元 25% + 表达规则
              15%。该权重未经招聘结果验证，优先核对上方证据。
            </p>

            {report.missing_skills.length > 0 && (
              <div>
                <p className="field-label">
                  待核对词项（{report.missing_skills.length}）
                </p>
                <div className="flex flex-wrap gap-1">
                  {report.missing_skills.map((s) => (
                    <span
                      key={s}
                      className="chip bg-danger-100 text-danger-700 ring-1 ring-danger-600/20"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {!!report.related_skills?.length && <div className="rounded-lg bg-seal-100 p-3 text-[12px] text-seal-700"><p className="font-medium">相关工具证据待确认</p>{report.related_skills.map(item => <p key={item.term}>{item.term}：{item.tools.join('、')}</p>)}</div>}
            {report.missing_keywords.length > 0 && (
              <div>
                <p className="field-label">未覆盖关键词</p>
                <div className="flex flex-wrap gap-1">
                  {report.missing_keywords.map((s) => (
                    <span key={s} className="chip bg-seal-100 text-seal-700">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="field-label">优化建议</p>
              <ul className="flex flex-col gap-1.5">
                {report.suggestions.map((s, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 rounded-lg border border-ink-100 bg-white px-3 py-2 text-[11.5px] leading-relaxed text-ink-600"
                  >
                    <span className="mt-0.5 font-mono text-[12px] font-bold text-brand-600">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-between">
              <span className="font-mono text-[12px] text-ink-500">
                分析于 {timeAgo(report.computed_at)} · 本地规则引擎
              </span>
              <Btn
                variant="ghost"
                className="h-7 text-[11.5px]"
                onClick={doMatch}
              >
                <IconRefresh size={11} /> 重新分析
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export type { AIAction };
export { SECTION_LABELS };
