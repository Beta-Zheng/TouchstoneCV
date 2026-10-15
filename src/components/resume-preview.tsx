import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconEdit } from "./icons";
import type { Resume } from "../types";
import { type PageLayout } from "../lib/pagination";
import { A4Sheet } from "./template";
import { readResumeLayout } from "./resume-measure";
import { Btn } from "./ui";
import { flashLocation, scrollInPane, type ResumeLocation } from "../lib/preview-navigation";
import { stripHtml } from "../lib/utils";

export default function ResumePreview({
  resume,
  onLayout,
  location,
  onLocate,
}: {
  resume: Resume;
  onLayout?: (pages: PageLayout[], measurement: ReturnType<typeof readResumeLayout>) => void;
  location?: ResumeLocation | null;
  onLocate?: (sectionId: string, blockId?: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const displayed = useRef<HTMLDivElement>(null);
  const measuredSource = useRef<Resume | null>(null);
  const handled = useRef<number | null>(null);
  const clearHighlight = useRef<(() => void) | null>(null);
  const [notice, setNotice] = useState("");
  const [controls, setControls] = useState<Array<{ element: HTMLElement; sectionId: string; blockId?: string; label: string }>>([]);
  const [controlIndex, setControlIndex] = useState(0);
  const [width, setWidth] = useState(794);
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [pages, setPages] = useState<PageLayout[]>([
    { resume, oversized: false, height: 1123 },
  ]);
  const callback = useRef(onLayout);
  callback.current = onLayout;
  useEffect(() => {
    let frame = 0;
    let stopped = false;
    const compute = () => {
      if (stopped || !measure.current) return;
      const root = measure.current;
      const measurement = readResumeLayout(root, resume);
      const layout = measurement.pages;
      measuredSource.current = resume;
      setPages(layout);
      callback.current?.(layout, measurement);
    };
    const schedule = () => {
      if (stopped) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(compute);
    };
    const observer = new ResizeObserver(schedule);
    if (measure.current) observer.observe(measure.current);
    schedule();
    void document.fonts.ready.then(schedule);
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [resume]);
  useEffect(() => {
    const update = () =>
      setWidth(Math.max(200, (container.current?.clientWidth ?? 826) - 32));
    const observer = new ResizeObserver(update);
    if (container.current) observer.observe(container.current);
    update();
    return () => observer.disconnect();
  }, []);
  useEffect(() => () => clearHighlight.current?.(), []);
  useEffect(() => {
    if (!onLocate || !displayed.current) return;
    const root = displayed.current;
    const nodes = root.querySelectorAll<HTMLElement>("[data-resume-entry], section[data-resume-section] > h2, header[data-resume-section]");
    const next: typeof controls = [];
    nodes.forEach(element => {
      const sectionId = element.closest<HTMLElement>("[data-resume-section]")?.dataset.resumeSection;
      if (!sectionId) return;
      const section = resume.data.sections.find(s => s.section_id === sectionId);
      const block = section?.blocks.find(b => b.block_id === element.dataset.resumeEntry);
      if (element.tagName === "H2") element.setAttribute("aria-label", element.textContent?.trim() || section?.title || "栏目");
      next.push({ element, sectionId, blockId: element.dataset.resumeEntry,
        label: `定位编辑：${section?.title ?? "基本信息"}${block ? ` · ${stripHtml(block.title || block.subtitle || block.description || block.bullets[0] || block.skills.join("、") || "条目").slice(0, 48)}` : ""}` });
    });
    setControls(previous => previous.length === next.length && previous.every((item, i) => item.element === next[i].element && item.label === next[i].label) ? previous : next);
    setControlIndex(index => Math.min(index, Math.max(0, next.length - 1)));
  }, [pages, resume, onLocate]);
  useEffect(() => {
    if (!location || !displayed.current || measuredSource.current !== resume) return;
    const root = displayed.current;
    root.querySelectorAll("[data-preview-current]").forEach(el => el.removeAttribute("data-preview-current"));
    const sections = Array.from(root.querySelectorAll<HTMLElement>("[data-resume-section]"))
      .filter(el => el.dataset.resumeSection === location.sectionId);
    const target = location.blockId
      ? sections.flatMap(el => Array.from(el.querySelectorAll<HTMLElement>("[data-resume-entry]"))).find(el => el.dataset.resumeEntry === location.blockId)
      : sections[0]?.querySelector<HTMLElement>("h2") ?? sections[0];
    target?.setAttribute("data-preview-current", "true");
    if (!target) {
      clearHighlight.current?.();
      handled.current = location.requestId;
      setNotice("该内容已隐藏或为空，未出现在预览中");
      return;
    }
    const name = resume.data.sections.find(s => s.section_id === location.sectionId)?.title ?? "内容";
    setNotice(`已定位：${name} · 第 ${target.closest<HTMLElement>("[data-preview-page]")?.dataset.previewPage ?? "1"} 页`);
    // Reconcile the stable marker after repagination, without scrolling while typing.
    if (handled.current === location.requestId) return;
    handled.current = location.requestId;
    clearHighlight.current?.();
    const boundary = container.current?.closest<HTMLElement>(".editor-preview");
    const toolbar = container.current?.querySelector<HTMLElement>("[data-preview-toolbar]");
    if (boundary && location.scroll !== false) scrollInPane(target, boundary, (toolbar?.offsetHeight ?? 44) + 12, true);
    clearHighlight.current = flashLocation(target, "preview");
  }, [location, pages, resume]);
  const locateFromPreview = (target: Element) => {
    if (!onLocate || target.closest("a,input,textarea,select")) return;
    const selection = window.getSelection();
    if (selection?.toString() && displayed.current?.contains(selection.anchorNode)) return;
    const entry = target.closest<HTMLElement>("[data-resume-entry]");
    const section = target.closest<HTMLElement>("[data-resume-section]");
    if (section?.dataset.resumeSection) onLocate(section.dataset.resumeSection, entry?.dataset.resumeEntry);
  };
  const scale = zoom === "fit" ? Math.min(1, width / 794) : zoom;
  return (
    <div
      ref={container}
      className="relative min-w-0"
      data-testid="resume-preview"
    >
      <div data-preview-toolbar className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-line bg-paper-50 px-3 py-2">
        <span className="text-[11px] text-ink-500">
          预览 · {pages.length} 页
        </span>
        <div className="flex gap-1">
          {(["fit", 0.75, 1] as const).map((value) => (
            <Btn
              key={value}
              variant="ghost"
              aria-pressed={zoom === value}
              className={`h-7 px-2 text-[11px] ${
                zoom === value ? "bg-paper-200 font-medium text-ink-800" : ""
              }`}
              onClick={() => setZoom(value)}
            >
              {value === "fit" ? "适应窗口" : `${value * 100}%`}
            </Btn>
          ))}
        </div>
      </div>
      {onLocate && <p role="status" className={notice.startsWith("该内容") ? "border-b border-line px-3 py-2 text-[12px] text-seal-700" : "sr-only"}>{notice}</p>}
      {onLocate && controls.map((control, index) => createPortal(
        <button key={index} type="button" data-preview-edit
          className="preview-edit-link" aria-label={control.label} title={control.label}
          tabIndex={index === controlIndex ? 0 : -1}
          style={{ transform: `scale(${1 / scale})`, transformOrigin: "top right" }}
          onClick={event => { event.stopPropagation(); onLocate(control.sectionId, control.blockId); }}
          onFocus={() => setControlIndex(index)}
          onKeyDown={event => {
            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
            event.preventDefault(); event.stopPropagation();
            const next = event.key === "Home" ? 0 : event.key === "End" ? controls.length - 1 :
              (index + (event.key === "ArrowDown" ? 1 : -1) + controls.length) % controls.length;
            setControlIndex(next);
            controls[next].element.querySelector<HTMLButtonElement>("[data-preview-edit]")?.focus({ preventScroll: true });
            const boundary = container.current?.closest<HTMLElement>(".editor-preview");
            const toolbar = container.current?.querySelector<HTMLElement>("[data-preview-toolbar]");
            if (boundary) scrollInPane(controls[next].element, boundary, (toolbar?.offsetHeight ?? 44) + 12, true);
          }}><IconEdit size={16}/></button>, control.element, `${control.sectionId}:${control.blockId ?? 'heading'}:${index}`
      ))}
      <div
        ref={measure}
        aria-hidden="true"
        className="pointer-events-none"
        style={{
          width: 794,
          visibility: "hidden",
          position: "fixed",
          left: -10000,
          top: 0,
        }}
      >
        <A4Sheet resume={resume} />
      </div>
      <div ref={displayed} className={`overflow-x-auto bg-paper-200 px-4 py-4 ${onLocate ? "interactive-preview" : ""}`}
        onClick={event => locateFromPreview(event.target as Element)}
        >
        {pages.map((page, i) => (
          <div
            key={i}
            data-preview-page={i + 1}
            className="mx-auto mb-5"
            style={{ width: 794 * scale, minHeight: page.height * scale }}
          >
            <p className="mb-1 text-[10px] text-ink-500">
              第 {i + 1} 页{page.oversized && " · 单个条目过长，请拆分后导出"}
            </p>
            <div style={{ height: page.height * scale, position: "relative" }}>
              <div
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                  width: 794,
                }}
              >
                <A4Sheet resume={page.resume} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
