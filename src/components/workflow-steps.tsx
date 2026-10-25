import type { Resume } from '../types';
import { inspectResume } from '../lib/workflow';

/** A master resume can be maintained and exported without choosing an employer. */
export default function WorkflowSteps({ resume, hasJD, hasTargetReview, hasExport, hasApplication, onStep }: {
  resume: Resume; hasJD: boolean; hasTargetReview: boolean; hasExport: boolean;
  hasApplication: boolean; onStep: (step: number) => void;
}) {
  const issues = inspectResume(resume).filter(i => i.severity === 'warning');
  const needsSourceReview = !!resume.data.metadata.source_text && !resume.data.metadata.reviewed_at;
  const steps = [
    { id: 0, label: '完善内容', done: !issues.length && !needsSourceReview },
    ...(resume.target ? [{ id: 1, label: '核对岗位', done: hasJD && hasTargetReview }] : []),
    { id: 3, label: '预览与导出', done: hasExport },
    ...(resume.target ? [{ id: 4, label: '记录投递', done: hasApplication }] : []),
  ];
  const next = steps.find(step => !step.done);
  return <nav aria-label="求职流程" className="shrink-0 border-b border-line bg-paper-50 px-3 py-2 text-[13px] sm:px-4">
    <details>
      <summary className="cursor-pointer text-ink-500">
        {resume.target ? '岗位投递' : '通用简历'} · {next ? `下一步：${next.label}` : '当前步骤已完成'}
        {issues.length > 0 && <span className="ml-2">{issues.length} 项待核对</span>}
      </summary>
      <div className="mt-2 flex flex-wrap gap-2">
        {steps.map(step => <button key={step.id} onClick={() => onStep(step.id)}
          aria-current={next?.id === step.id ? 'step' : undefined}
          className={`rounded px-3 py-2 ${next?.id === step.id ? 'bg-brand-50 font-medium text-brand-700' : 'text-ink-600 hover:bg-paper-200'}`}>
          {step.label}{step.done ? ' ✓' : ''}
        </button>)}
      </div>
    </details>
  </nav>;
}
