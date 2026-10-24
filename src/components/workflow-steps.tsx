import type { Resume } from "../types";
import { inspectResume, moduleFilled } from "../lib/workflow";

export default function WorkflowSteps({
  resume,
  hasJD,
  hasTargetReview,
  onConfirmTarget,
  hasExport,
  hasApplication,
  onStep,
}: {
  resume: Resume;
  hasJD: boolean;
  hasTargetReview: boolean;
  onConfirmTarget: () => void;
  hasExport: boolean;
  hasApplication: boolean;
  onStep: (step: number) => void;
}) {
  const issues = inspectResume(resume).filter((i) => i.severity === "warning");
  const complete = [
    moduleFilled(resume, "basic_info") &&
      !issues.some(i => i.sectionId === resume.data.sections.find(s => s.type === 'basic_info')?.section_id) &&
      (!resume.data.metadata.source_text || !!resume.data.metadata.reviewed_at),
    hasJD,
    hasTargetReview,
    hasExport,
    hasApplication,
  ];
  const next = !complete[0]
    ? 0
    : !hasJD
    ? 1
    : !hasTargetReview
    ? 2
    : !hasExport
    ? 3
    : 4;
  const labels = ["校对内容", "选择岗位", "核对岗位内容", "检查导出", "记录投递"];
  return (
    <nav
      aria-label="求职流程"
      className="shrink-0 border-b border-line bg-paper-50 px-3 py-1.5 text-[12px] sm:px-4"
    >
      <details>
        <summary className="cursor-pointer text-ink-500">
          求职流程 · 下一步：
          <span className="font-medium text-ink-800">{labels[next]}</span>
          {issues.length > 0 && (
            <span className="ml-2 text-[12px]">{issues.length} 项待核对</span>
          )}
        </summary>
        <div className="mt-2 flex flex-wrap gap-1 pb-1">
          {labels.map((label, i) => (
            <button
              key={label}
              aria-current={next === i ? "step" : undefined}
              className={`rounded px-2 py-1.5 ${
                next === i
                  ? "bg-brand-50 font-medium text-brand-700"
                  : "text-ink-600 hover:bg-paper-200"
              }`}
              onClick={() => onStep(i)}
            >
              {i + 1}. {label}
              {complete[i] && (
                <span className="ml-1 text-[12px] text-ink-400">
                  {i === 2 ? "已确认" : i === 3 ? "已准备" : "已有内容"}
                </span>
              )}
            </button>
          ))}
          {hasJD && !hasTargetReview && <button className="rounded px-2 py-1.5 font-medium text-brand-700 disabled:opacity-50" disabled={issues.length > 0}
            title={issues.length ? '请先处理待核对内容' : undefined} onClick={onConfirmTarget}>确认岗位内容已核对</button>}
        </div>
      </details>
    </nav>
  );
}
