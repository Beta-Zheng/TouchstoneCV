import { useEffect, useMemo, useRef, useState } from 'react';
import type { Resume } from '../types';
import { defaultFitLocks, fitLayoutCost, onePageLayouts, removableFitEntries, visibleFitEntries, withHiddenEntries } from '../lib/one-page';
import { useApp, useAppSlice } from '../lib/store';
import { stripHtml } from '../lib/utils';
import { createResumeMeasurer, readResumeLayout } from './resume-measure';
import ResumePreview from './resume-preview';
import { Btn, Modal, ModalHeader } from './ui';

type Measurement = ReturnType<typeof readResumeLayout>;
type Analysis = {
  source: Resume; target: number; locks: ReadonlySet<string>;
  before: Measurement; best: Resume; bestMeasure: Measurement;
  suggested: Set<string> | null; reasons: Map<string, string>;
};
const fitsTarget = (m: Measurement, target: number) => m.pages.length <= target &&
  !m.pages.some(p => p.oversized) && (m.pages.length !== 1 || m.fits);
const lastFill = (m: Measurement) => {
  const last = m.pages[m.pages.length - 1];
  return (last?.usedHeight ?? m.contentHeight) / (last?.capacity ?? m.capacity);
};
const titleOf = (block: ReturnType<typeof visibleFitEntries>[number]['block']) =>
  stripHtml(block.title || block.subtitle || block.description || block.bullets[0] || block.skills.join('、') || '未命名条目');

export default function OnePageDialog({ resume, onClose, onEdit }: {
  resume: Resume; onClose: () => void; onEdit?: (sectionId: string, blockId: string) => void;
}) {
  const app = useAppSlice('jds', 'duplicateResume', 'renameResume', 'setResumeOptions', 'setTheme', 'patchBlock', 'captureSnapshot', 'go');
  const jd = app.jds[resume.id];
  const terms = useMemo(() => [...(jd?.structured.skills ?? []), ...(jd?.structured.keywords ?? [])], [jd]);
  const [targetPages, setTargetPages] = useState<1 | 2 | null>(null);
  const [locks, setLocks] = useState<ReadonlySet<string>>(() => defaultFitLocks(resume, terms));
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [plan, setPlan] = useState<'all' | 'suggested' | 'custom'>('all');
  const [customHidden, setCustomHidden] = useState<Set<string>>(new Set());
  const [previewOriginal, setPreviewOriginal] = useState(false);
  const [preview, setPreview] = useState<{ source: Resume; measurement: Measurement } | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const latest = useRef(resume); latest.current = resume;

  useEffect(() => {
    const controller = new AbortController();
    setBusy(true); setError('');
    async function analyze() {
      const measurer = createResumeMeasurer(controller.signal);
      try {
        const before = await measurer.measure(resume);
        if (targetPages === null) {
          if (!controller.signal.aborted) setTargetPages(before.pages.length === 1 && before.fits ? 1 : 2);
          return;
        }
        let best = resume, bestMeasure = before, bestCost = Infinity;
        if (!fitsTarget(before, targetPages)) {
          for (const candidate of onePageLayouts(resume).slice(1)) {
            const measured = await measurer.measure(candidate);
            const cost = fitLayoutCost(resume, candidate, lastFill(measured));
            if (fitsTarget(measured, targetPages)) {
              if (cost < bestCost) { best = candidate; bestMeasure = measured; bestCost = cost; }
            } else if (bestCost === Infinity && measured.contentHeight < bestMeasure.contentHeight) {
              best = candidate; bestMeasure = measured;
            }
          }
        }
        // Recheck the chosen layout after candidate rendering and font/layout settling.
        bestMeasure = await measurer.measure(best);
        const reasons = new Map<string, string>();
        let suggested: Set<string> | null = null;
        if (!fitsTarget(bestMeasure, targetPages)) {
          const hidden = new Set<string>();
          for (const entry of removableFitEntries(resume, terms, locks, bestMeasure.entryHeights)) {
            hidden.add(entry.block.block_id); reasons.set(entry.block.block_id, entry.reason);
            const measured = await measurer.measure(withHiddenEntries(best, hidden));
            if (fitsTarget(measured, targetPages)) {
              // Restore anything that still fits, avoiding redundant exclusions.
              for (const id of [...hidden].reverse()) {
                const restored = new Set(hidden); restored.delete(id);
                if (fitsTarget(await measurer.measure(withHiddenEntries(best, restored)), targetPages)) hidden.delete(id);
              }
              suggested = hidden; break;
            }
          }
        }
        if (!controller.signal.aborted) setAnalysis({ source: resume, target: targetPages, locks, before, best, bestMeasure, suggested, reasons });
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : '排版测量失败');
      } finally {
        measurer.dispose();
        if (!controller.signal.aborted) setBusy(false);
      }
    }
    void analyze();
    return () => controller.abort();
  }, [resume, terms, targetPages, locks, retry]);

  const current = analysis?.source === resume && analysis.target === targetPages && analysis.locks === locks;
  const entries = useMemo(() => visibleFitEntries(resume), [resume]);
  const hidden = useMemo(() => new Set([...(plan === 'suggested' ? analysis?.suggested ?? [] : plan === 'custom' ? customHidden : [])].filter(id => !locks.has(id))), [plan, analysis, customHidden, locks]);
  const draft = useMemo(() => withHiddenEntries(current ? analysis.best : resume, hidden), [current, analysis, resume, hidden]);
  const shown = previewOriginal ? resume : draft;
  const ready = !busy && !error && current && preview?.source === draft;
  const fits = !!(ready && fitsTarget(preview.measurement, targetPages!));
  const allContentFits = !!(current && ((ready && fits && hidden.size === 0) || fitsTarget(analysis.bestMeasure, targetPages!)));
  const unchanged = !!(current && hidden.size === 0 && JSON.stringify(draft.theme) === JSON.stringify(resume.theme));
  const densityNames = { loose: '宽松', medium: '适中', compact: '紧凑' };
  const changes = [
    resume.theme.font_size !== draft.theme.font_size ? `字号 ${resume.theme.font_size} → ${draft.theme.font_size}px` : '',
    (resume.theme.density ?? 'medium') !== (draft.theme.density ?? 'medium') ? `间距 ${densityNames[resume.theme.density ?? 'medium']} → ${densityNames[draft.theme.density ?? 'medium']}` : '',
    (resume.theme.header_layout ?? 'row') !== (draft.theme.header_layout ?? 'row') ? '条目标题改为横排' : '',
    hidden.size ? `隐藏 ${hidden.size} 项，原文保留` : '',
  ].filter(Boolean);
  const oversized = ready ? entries.filter(e => (preview.measurement.entryHeights[e.block.block_id] ?? 0) > preview.measurement.capacity) : [];
  const emptySections = current ? resume.data.sections.filter(s => s.visible && ['work_experience', 'education'].includes(s.type) && entries.some(e => e.section.section_id === s.section_id) && entries.filter(e => e.section.section_id === s.section_id).every(e => hidden.has(e.block.block_id))) : [];

  const chooseTarget = (count: 1 | 2) => {
    setTargetPages(count); setPlan('all'); setCustomHidden(new Set()); setPreviewOriginal(false);
  };
  const toggleContent = (id: string, included: boolean) => {
    const next = new Set(hidden); included ? next.delete(id) : next.add(id);
    setCustomHidden(next); setPlan('custom'); setPreviewOriginal(false);
  };
  const createCopy = () => {
    if (!fits || !analysis || unchanged || latest.current !== analysis.source || useApp.getState().resumes.find(r => r.id === resume.id) !== resume) return;
    const copyId = app.duplicateResume(resume.id); if (!copyId) return;
    const count = preview!.measurement.pages.length;
    app.renameResume(copyId, `${resume.title} · ${count}页版`); app.setTheme(copyId, draft.theme);
    app.setResumeOptions(copyId, { page_limit: targetPages! });
    for (const entry of entries) if (hidden.has(entry.block.block_id)) app.patchBlock(copyId, entry.section.section_id, entry.block.block_id, { visible: false });
    app.captureSnapshot(copyId, `${count}页篇幅调整完成`);
    app.go({ name: 'editor', resumeId: copyId }); onClose();
  };

  return <Modal open onClose={onClose} width="max-w-6xl" bare>
    <ModalHeader title="智能篇幅调整" sub="预览调整方案，确认后另存副本。" onClose={onClose} />
    <div className="grid max-h-[70vh] grid-cols-1 overflow-y-auto lg:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="space-y-4 border-b border-line p-4 lg:border-r">
        <fieldset><legend className="mb-2 text-[13px] font-medium">最多几页</legend>
          <div className="flex gap-2">{([1, 2] as const).map(count => <Btn key={count} size="sm" aria-pressed={targetPages === count} variant={targetPages === count ? 'primary' : 'outline'} onClick={() => chooseTarget(count)}>{count} 页</Btn>)}</div>
        </fieldset>
        <p role="status" className="text-[14px] font-medium">{busy ? '正在测量实际版式…' : error ? '测量失败，请重试' : !ready ? (previewOriginal ? '正在对照原稿' : '正在更新方案预览…') : `原稿 ${analysis!.before.pages.length} 页 → 当前方案 ${preview.measurement.pages.length} 页`}</p>
        {error && <div><p role="alert" className="mb-2 text-[13px] text-danger-700">{error}</p><Btn size="sm" onClick={() => setRetry(v => v + 1)}>重新测量</Btn></div>}
        {current && !busy && !error && <>
          <div className="rounded-lg bg-subtle p-3 text-[13px]" data-testid="layout-changes">
            {changes.length ? <ul className="space-y-1">{changes.map(change => <li key={change}>{change}</li>)}</ul> : <p>{fitsTarget(analysis!.before, targetPages!) ? '原稿无需调整' : '保持原排版，内容仍需调整'}</p>}
          </div>
          {!fitsTarget(analysis!.before, targetPages!) && <fieldset className="space-y-2">
            <legend className="mb-2 text-[13px] font-medium">选择方案</legend>
            {([
              ['all', '保留全部内容', allContentFits ? '只调整排版' : '仅排版仍超出目标页数'],
              ['suggested', '精简部分内容', analysis!.suggested ? `建议隐藏 ${analysis!.suggested.size} 项，可逐项调整` : '没有满足当前锁定条件的精简方案'],
            ] as const).filter(([value]) => value === 'all' || !allContentFits).map(([value, label, detail]) => <label key={value} className={`flex cursor-pointer gap-2 rounded-lg border p-3 text-[13px] ${plan === value ? 'border-brand-500 bg-brand-50' : 'border-line'}`}>
              <input type="radio" name="fit-plan" value={value} checked={plan === value} disabled={value === 'suggested' && !analysis!.suggested} onChange={() => { setPlan(value); setPreviewOriginal(false); }} className="mt-1 accent-brand-600" />
              <span><span className="block font-medium">{label}</span><span className="block text-[12px] text-ink-500">{detail}</span></span>
            </label>)}
            {plan === 'custom' && <p className="text-[12px] font-medium">已自定义内容</p>}
          </fieldset>}
          {ready && fits && hidden.size === 0 && changes.length > 0 && <p className="text-[13px] text-brand-700">全部内容已保留，仅调整排版。</p>}
          {ready && !fits && <p className="text-[13px] text-seal-700">{oversized.length ? '以下条目超过单页容量，请先精简或拆成独立经历。' : '当前方案未达标。可调整纳入内容、解锁条目，或选择 2 页。'}</p>}
          {oversized.map(({ section, block }) => <div key={block.block_id} className="rounded-lg border border-line p-2 text-[13px]"><p>{titleOf(block)}</p>{onEdit && <Btn size="sm" onClick={() => { onClose(); onEdit(section.section_id, block.block_id); }}>前往编辑</Btn>}</div>)}
          {emptySections.length > 0 && <p role="alert" className="text-[13px] text-seal-700">此版本将不展示{emptySections.map(s => s.title).join('、')}，请确认符合用途。</p>}
          {ready && fits && preview.measurement.pages.length === 2 && lastFill(preview.measurement) < .35 && <p className="text-[12px] text-ink-500">第二页内容较少，可尝试 1 页；无需为了铺满纸张删除经历。</p>}
          <details open={hidden.size > 0}>
            <summary className="cursor-pointer text-[13px] font-medium">纳入此版本 · {entries.length - hidden.size}/{entries.length} 项</summary>
            <p className="my-2 text-[12px] text-ink-500">关键经历默认必须保留，可主动解锁。{jd ? '岗位词项仅用于辅助建议。' : '未关联岗位，建议仅参考时间和篇幅。'}</p>
            {resume.data.sections.filter(s => entries.some(e => e.section.section_id === s.section_id)).sort((a, b) => a.order - b.order).map(section => <fieldset key={section.section_id} className="mb-3">
              <legend className="text-[12px] font-medium text-ink-500">{section.title}</legend>
              {entries.filter(e => e.section.section_id === section.section_id).sort((a, b) => a.block.order - b.block.order).map(({ block }) => <div key={block.block_id} data-fit-entry={block.block_id} className="border-b border-line py-2 text-[13px]">
                <div className="flex items-start gap-2">
                  <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-start gap-2 py-2">
                    <input type="checkbox" aria-label={`纳入：${titleOf(block)}`} className="mt-1 accent-brand-600" checked={!hidden.has(block.block_id)} disabled={locks.has(block.block_id)} onChange={e => toggleContent(block.block_id, e.target.checked)} />
                    <span className="min-w-0 break-words">{titleOf(block)}</span>
                  </label>
                  <Btn size="sm" aria-label={`必须保留：${titleOf(block)}`} aria-pressed={locks.has(block.block_id)} onClick={() => {
                    const next = new Set(locks);
                    if (next.has(block.block_id)) next.delete(block.block_id);
                    else {
                      next.add(block.block_id);
                      setCustomHidden(previous => { const restored = new Set(previous); restored.delete(block.block_id); return restored; });
                    }
                    setLocks(next); setPlan('all'); setPreviewOriginal(false);
                  }}>{locks.has(block.block_id) ? '已锁定' : '锁定'}</Btn>
                </div>
                {hidden.has(block.block_id) && <p className="text-[12px] text-seal-700">{plan === 'custom' ? '手动排除' : analysis!.reasons.get(block.block_id)}{analysis!.bestMeasure.entryHeights[block.block_id] ? ` · 约占单页 ${Math.round(100 * analysis!.bestMeasure.entryHeights[block.block_id] / analysis!.bestMeasure.capacity)}%` : ''}</p>}
                <details className="text-[12px] text-ink-500"><summary className="cursor-pointer py-1">查看原文</summary><p className="whitespace-pre-wrap break-words">{stripHtml([block.subtitle, block.description, ...block.bullets, ...block.skills, ...block.links].filter(Boolean).join('\n')) || '无补充描述'}</p></details>
              </div>)}
            </fieldset>)}
          </details>
        </>}
      </aside>
      <div className="min-w-0">
        <div className="flex gap-2 border-b border-line p-2" role="group" aria-label="对照预览">
          <Btn size="sm" aria-pressed={!previewOriginal} onClick={() => setPreviewOriginal(false)}>调整方案</Btn><Btn size="sm" aria-pressed={previewOriginal} onClick={() => setPreviewOriginal(true)}>查看原稿</Btn>
        </div>
        <ResumePreview resume={shown} onLayout={(_, measurement) => { if (shown === draft) setPreview({ source: draft, measurement }); }} />
      </div>
    </div>
    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line p-4">
      <Btn onClick={onClose}>取消</Btn>
      {unchanged && fits ? <Btn variant="primary" onClick={onClose}>完成</Btn> : <Btn variant="primary" disabled={!fits} onClick={createCopy}>创建 {fits ? preview!.measurement.pages.length : targetPages ?? '—'} 页副本{hidden.size > 0 ? `（隐藏 ${hidden.size} 项）` : ''}</Btn>}
    </div>
  </Modal>;
}
