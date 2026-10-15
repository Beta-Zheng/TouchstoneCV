import type { Resume } from "../types";
import { inspectResume, moduleFilled } from "../lib/workflow";

export default function WorkflowSteps({
  resume,
  hasJD,
  hasExport,
  hasApplication,
  onStep,
}: {
  resume: Resume;
  hasJD: boolean;
  hasExport: boolean;
  hasApplication: boolean;
  onStep: (step: number) => void;
}) {
  const issues = inspectResume(resume).filter((i) => i.severity === "warning");
  const complete = [
    moduleFilled(resume, "basic_info") &&
      (!resume.data.metadata.source_text || !!resume.data.metadata.reviewed_at),
    hasJD,
    !issues.length,
    hasExport,
    hasApplication,
  ];
  const next = !complete[0]
    ? 0
    : !hasJD
    ? 1
    : issues.length
    ? 2
    : !hasExport
    ? 3
    : 4;
  const labels = ["校对内容", "选择岗位", "补强经历", "检查导出", "记录投递"];
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
                  {i === 3 ? "已准备" : "已有内容"}
                </span>
              )}
            </button>
          ))}
        </div>
      </details>
    </nav>
  );
}
