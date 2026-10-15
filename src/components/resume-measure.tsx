import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { Resume } from '../types';
import { paginateResume } from '../lib/pagination';
import { A4Sheet } from './template';

export function readResumeLayout(root: HTMLElement, resume: Resume) {
  const heights: Record<string,number> = {}, titles: Record<string,number> = {};
  const outerHeight = (el: HTMLElement) => el.getBoundingClientRect().height + (parseFloat(getComputedStyle(el).marginBottom) || 0);
  root.querySelectorAll<HTMLElement>('[data-resume-entry]').forEach(el=>{heights[el.dataset.resumeEntry!]=outerHeight(el);});
  root.querySelectorAll<HTMLElement>('[data-resume-section]').forEach(el=>{
    const heading=el.querySelector<HTMLElement>('h2');
    if(heading)titles[el.dataset.resumeSection!]=outerHeight(heading)+(parseFloat(getComputedStyle(el).marginBottom)||0);
  });
  const header=root.querySelector<HTMLElement>('.resume-sheet header');
  const padded=root.querySelector<HTMLElement>('.resume-sheet-wrap > div');
  const pad=padded ? parseFloat(getComputedStyle(padded).paddingTop)+parseFloat(getComputedStyle(padded).paddingBottom) : 88;
  const pages=paginateResume(resume,heights,header ? outerHeight(header) : 0,titles,1123-pad-4);
  const sheet=root.querySelector<HTMLElement>('.resume-sheet');
  const contentHeight=(sheet?.getBoundingClientRect().height ?? 0)+pad;
  return { pages, contentHeight, entryHeights: heights, capacity: 1123-pad-4, fits:pages.length===1 && !pages[0].oversized && contentHeight<=1119 };
}

/** One isolated full-size render, reused while testing layout candidates. */
export function createResumeMeasurer(signal: AbortSignal) {
  const host=document.createElement('div');
  host.setAttribute('aria-hidden','true');
  Object.assign(host.style,{position:'fixed',left:'-10000px',top:'0',width:'794px',visibility:'hidden',pointerEvents:'none'});
  document.body.append(host);
  const root=createRoot(host);
  return {
    async measure(resume: Resume) {
      if(signal.aborted)throw new DOMException('Cancelled','AbortError');
      await new Promise<void>(resolve=>requestAnimationFrame(()=>{if(!signal.aborted)flushSync(()=>root.render(<A4Sheet resume={resume}/>));resolve();}));
      await document.fonts.ready;
      await Promise.all(Array.from(host.querySelectorAll('img')).map(image=>image.decode().catch(()=>{})));
      if(signal.aborted)throw new DOMException('Cancelled','AbortError');
      return readResumeLayout(host,resume);
    },
    dispose(){root.unmount();host.remove();},
  };
}
