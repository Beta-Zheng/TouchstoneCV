import type { Block, Resume } from '../types';
import { containsTerm, stripHtml } from './utils';
import { blockHasContent } from './workflow';

/** Try less disruptive layouts first; never shrink a normal resume below 14px. */
export function onePageLayouts(source: Resume): Resume[] {
  const themes: Resume['theme'][] = [source.theme];
  const floor = Math.min(14, source.theme.font_size);
  for (let size = source.theme.font_size; ; size = Math.max(floor, Math.round((size - .5) * 10) / 10)) {
    for (const density of ['medium', 'compact'] as const) {
      // Never loosen a compact original while trying to reduce its page count.
      if (source.theme.density === 'compact' && density === 'medium') continue;
      themes.push({ ...source.theme, density, font_size: size });
      themes.push({ ...source.theme, density, font_size: size, header_layout: 'row' });
    }
    if (size === floor) break;
  }
  const seen = new Set<string>();
  return themes.filter(theme => {
    const key = JSON.stringify(theme);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).map(theme => ({ ...source, theme: { ...theme } }));
}

export function visibleFitEntries(resume: Resume) {
  return resume.data.sections.filter(s => s.visible && s.type !== 'basic_info')
    .flatMap(s => s.blocks.filter(b => b.visible && blockHasContent(b)).map(block => ({section:s,block})));
}

/** Only change visibility; descriptions, dates, metrics and hidden data remain intact. */
export function withHiddenEntries(resume: Resume, hidden: ReadonlySet<string>): Resume {
  return { ...resume, data: { ...resume.data, sections: resume.data.sections.map(s => ({ ...s,
    blocks: s.blocks.map(b => hidden.has(b.block_id) ? { ...b, visible: false } : b),
  })) } };
}

function recent(block: Block) {
  const end = block.end_date.trim();
  const dateKey = (date: string) => {
    const match = date.match(/(\d{4})(?:\D+(\d{1,2}))?/);
    return match ? match[1] + (match[2] || '1').padStart(2, '0') : '000000';
  };
  const ending = /^(至今|现在|present|current|now)$/i.test(end) ? '999999' : dateKey(end || block.start_date);
  return ending + dateKey(block.start_date);
}

export function defaultFitLocks(source: Resume, terms: string[] = []) {
  const removable = new Set(removableFitEntries(source, terms).map(e => e.block.block_id));
  return new Set(visibleFitEntries(source).filter(e => !removable.has(e.block.block_id)).map(e => e.block.block_id));
}

/** Prefer readable layouts; a sparse last page is a hint, not a reason to delete facts. */
export function fitLayoutCost(source: Resume, candidate: Resume, lastPageFill = 1) {
  const density = { loose: 0, medium: 1, compact: 2 };
  return Math.max(0, source.theme.font_size - candidate.theme.font_size) * 20 +
    Math.max(0, density[candidate.theme.density ?? 'medium'] - density[source.theme.density ?? 'medium']) * 4 +
    ((source.theme.header_layout ?? 'row') !== (candidate.theme.header_layout ?? 'row') ? 1 : 0) +
    Math.max(0, .35 - lastPageFill) * 6;
}

/** Ranking is a local heuristic, never a hiring score or an automatic content rewrite. */
export function removableFitEntries(source: Resume, terms: string[] = [], locked?: ReadonlySet<string>, heights: Record<string, number> = {}) {
  const entries = visibleFitEntries(source);
  const uniqueTerms = [...new Set(terms.map(s => s.trim().toLowerCase()).filter(Boolean))].slice(0,100);
  const score = (entry: typeof entries[number]) => {
    const b = entry.block;
    const text = stripHtml([b.title,b.subtitle,b.description,...b.bullets,...b.skills].join(' '));
    return uniqueTerms.filter(term => containsTerm(text,term)).length * 10 +
      (/\d+(?:\.\d+)?\s*%/.test(text) ? 2 : 0);
  };
  const protectedIds = new Set<string>();
  for (const type of ['work_experience','education']) {
    const latest = entries.filter(e=>e.section.type===type).sort((a,b)=>recent(b.block).localeCompare(recent(a.block)) || a.block.order-b.block.order)[0];
    if (latest) protectedIds.add(latest.block.block_id);
  }
  if (source.audience === 'student' || source.audience === 'internship' || !entries.some(e=>e.section.type==='work_experience')) {
    const project=entries.filter(e=>e.section.type==='project_experience').sort((a,b)=>score(b)-score(a) || recent(b.block).localeCompare(recent(a.block)))[0];
    if(project)protectedIds.add(project.block.block_id);
  }
  const locks = locked ?? protectedIds;
  const recencyOrder = [...entries].sort((a, b) => recent(b.block).localeCompare(recent(a.block)));
  const recencyRank = new Map(recencyOrder.map((entry, index) => [entry.block.block_id, index]));
  // Content cost per unit of space: avoid sacrificing many short entries first.
  const cost = (e: typeof entries[number]) => (10 + score(e) +
    4 * (1 - (recencyRank.get(e.block.block_id) ?? 0) / Math.max(1, entries.length))) /
    Math.max(40, heights[e.block.block_id] ?? 120);
  return entries.filter(e=>!locks.has(e.block.block_id))
    .sort((a,b)=>cost(a)-cost(b) || recent(a.block).localeCompare(recent(b.block)) || b.block.order-a.block.order)
    .map(e=>{
      const hits=uniqueTerms.filter(term=>containsTerm(stripHtml([e.block.title,e.block.subtitle,e.block.description,...e.block.bullets,...e.block.skills].join(' ')),term)).length;
      return {...e,reason:uniqueTerms.length ? `命中 ${hits} 个岗位词项，结合经历时间与占用空间建议` : '未关联岗位，结合经历时间与占用空间建议'};
    });
}
