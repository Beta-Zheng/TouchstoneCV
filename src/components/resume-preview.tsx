import { useEffect, useRef, useState } from "react";
import type { Resume } from "../types";
import { paginateResume, type PageLayout } from "../lib/pagination";
import { A4Sheet } from "./template";
import { Btn } from "./ui";

export default function ResumePreview({
  resume,
  onLayout,
}: {
  resume: Resume;
  onLayout?: (pages: PageLayout[]) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
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
      const heights: Record<string, number> = {};
      const titles: Record<string, number> = {};
      root
        .querySelectorAll<HTMLElement>("[data-resume-entry]")
        .forEach((el) => {
          heights[el.dataset.resumeEntry!] =
            el.getBoundingClientRect().height +
            parseFloat(getComputedStyle(el).marginBottom || "0");
        });
      root
        .querySelectorAll<HTMLElement>("[data-resume-section]")
        .forEach((el) => {
          const h = el.querySelector("h2");
          if (h)
            titles[el.dataset.resumeSection!] =
              h.getBoundingClientRect().height +
              parseFloat(getComputedStyle(h).marginBottom || "0") +
              parseFloat(getComputedStyle(el).marginBottom || "0");
        });
      const header = root.querySelector<HTMLElement>(".resume-sheet header");
      const headerHeight = header
        ? header.getBoundingClientRect().height +
          parseFloat(getComputedStyle(header).marginBottom || "0")
        : 0;
      const padded = root.querySelector<HTMLElement>(
        ".resume-sheet-wrap > div"
      );
      const pad = padded
        ? parseFloat(getComputedStyle(padded).paddingTop) +
          parseFloat(getComputedStyle(padded).paddingBottom)
        : 88;
      const layout = paginateResume(
        resume,
        heights,
        headerHeight,
        titles,
        1123 - pad - 4
      );
      setPages(layout);
      callback.current?.(layout);
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
  const scale = zoom === "fit" ? Math.min(1, width / 794) : zoom;
  return (
    <div
      ref={container}
      className="relative min-w-0"
      data-testid="resume-preview"
    >
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-line bg-paper-50 px-3 py-2">
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
      <div className="overflow-x-auto bg-paper-200 px-4 py-4">
        {pages.map((page, i) => (
          <div
            key={i}
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
