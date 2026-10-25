import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Resume } from "../types";
import { useAppSlice } from "../lib/store";
import { createResumeBackup } from "../lib/backup";
import { inspectResume } from "../lib/workflow";
import { generateDocx, resumeText, downloadBlob } from "../lib/export";
import { downloadText, fmtDateCompact, nowISO } from "../lib/utils";
import type { PageLayout } from "../lib/pagination";
import ResumePreview from "./resume-preview";
import { A4Sheet } from "./template";
import { Btn, Modal, ModalHeader } from "./ui";

export default function ExportDialog({
  resume,
  onClose,
  onLocate,
  onAdjustLayout,
  onRecordApplication,
}: {
  resume: Resume;
  onClose: () => void;
  onLocate: (sectionId: string, blockId?: string) => void;
  onAdjustLayout: () => void;
  onRecordApplication: () => void;
}) {
  const app = useAppSlice(
    "resumes",
    "jds",
    "suggestions",
    "snapshots",
    "applications",
    "coverLetters",
    "models",
    "privacy",
    "toast",
    "captureSnapshot"
  );
  const [plan, setPlan] = useState<{
    source: Resume;
    pages: PageLayout[];
  } | null>(null);
  const planRef = useRef(plan);
  planRef.current = plan;
  const [busy, setBusy] = useState(false);
  const [prepared, setPrepared] = useState(false);
  const [ignored, setIgnored] = useState<string[]>([]);
  const issues = inspectResume(resume).filter(issue => !ignored.includes(issue.id));
  const ready = plan?.source === resume;
  const [filename, setFilename] = useState(() => [resume.data.basic_info.name || '简历', resume.target?.company,
    resume.target?.job_title || resume.data.basic_info.title, fmtDateCompact(nowISO())].filter(Boolean).join('_'));
  const safeName = filename.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[.\s]+$/g, '').slice(0, 120) || '简历';
  const capture = (label: string) => {
    app.captureSnapshot(resume.id, label, "export"); setPrepared(true);
  };
  const print = async () => {
    if (!ready) return;
    const previous = document.title;
    setBusy(true);
    try {
      await Promise.race([
        document.fonts.ready,
        new Promise((resolve) => setTimeout(resolve, 2500)),
      ]);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
      if (
        planRef.current?.source !== resume ||
        planRef.current.pages.some((p) => p.oversized)
      ) {
        app.toast("warn", "分页待更新或有过长条目，请检查后再打印");
        return;
      }
      capture("PDF 导出准备");
      document.title = safeName;
      window.print();
    } catch {
      app.toast("err", "无法打开打印，请尝试下载 DOCX 或 TXT");
    } finally {
      document.title = previous;
      setBusy(false);
    }
  };
  const word = async () => {
    setBusy(true);
    try {
      const content = await generateDocx(resume);
      downloadBlob(
        `${safeName}.docx`,
        new Blob([content], {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        })
      );
      capture("DOCX 导出准备");
      app.toast("ok", "已生成可编辑的单栏 Word 文档");
    } catch {
      app.toast("err", "Word 导出失败，内容已保留");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} width="max-w-6xl" bare>
      <ModalHeader
        title="检查并导出"
        sub="PDF 保留下方分页；Word 为可编辑单栏。"
        onClose={onClose}
      />
      <div className="grid max-h-[65vh] grid-cols-1 overflow-y-auto lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-line p-4 lg:border-r">
          <h4 className="mb-2 text-[13px] font-bold">投递前检查</h4>
          <details className="mb-3 text-[12px] text-ink-500">
            <summary className="cursor-pointer">打印与格式说明</summary>
            <p className="mt-2">
              PDF 建议使用 A4、100% 缩放、关闭页眉页脚并开启背景图形。Word
              采用单栏内容布局，分页会随字体环境变化。
            </p>
            <p className="mt-2">
              导出准备会保留快照，关闭打印窗口不代表文件已保存。
            </p>
          </details>
          {issues.length ? (
            <ul className="space-y-2">
              {[...issues].sort((a,b) => Number(b.severity === "warning") - Number(a.severity === "warning")).map((issue) => (
                <li
                  key={issue.id}
                  className={`rounded-lg p-2 text-[13px] ${
                    issue.severity === "warning"
                      ? "bg-danger-100 text-danger-700"
                      : "bg-paper-100 text-ink-500"
                  }`}
                >
                  <span className="mb-1 block font-medium">{issue.severity === "warning" ? "需要核对" : "可选建议"}</span>
                  <span>{issue.message}</span>
                  {issue.severity === "info" && <button className="ml-2 underline" onClick={() => setIgnored(ids => [...ids, issue.id])}>本次忽略</button>}
                  {issue.sectionId && (
                    <button
                      className="ml-2 underline"
                      onClick={() => {
                        onLocate(issue.sectionId!, issue.blockId);
                        onClose();
                      }}
                    >
                      定位修改
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12px] text-brand-700">基础字段已填写，请确认内容真实准确</p>
          )}
          {ready && (
            <p className="mt-4 text-[12px] text-ink-500">
              当前 {plan.pages.length} 页
              {plan.pages.length > 1 ? "，可根据经历长度决定是否精简。" : "。"}
            </p>
          )}
          {ready && plan.pages.some((p) => p.oversized) && (
            <p role="alert" className="mt-2 text-[12px] text-danger-700">
              单个条目超过一页，请拆分后再打印。DOCX / TXT 仍可下载。
            </p>
          )}
          <Btn
            className="mt-3"
            disabled={busy}
            onClick={onAdjustLayout}
          >
            调整篇幅
          </Btn>
        </aside>
        <div className="min-w-0">
          <ResumePreview
            resume={resume}
            onLayout={(pages) => setPlan({ source: resume, pages })}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-paper-25 p-3">
        <label className="mr-auto min-w-0 flex-1 basis-52 text-[12px] text-ink-500">文件名称<input aria-label="导出文件名称" className="field-input mt-1" value={filename} onChange={e => setFilename(e.target.value)} /></label>
        <details className="relative">
          <summary className="cursor-pointer rounded-lg border border-line px-3 py-2 text-[13px]">备份与文本格式</summary>
          <div className="absolute bottom-full right-0 z-20 mb-2 flex w-44 flex-col gap-1 rounded-lg border border-line bg-white p-2 shadow-lg">
        <Btn
          disabled={busy}
          onClick={() => {
            downloadText(
              `${safeName}.json`,
              JSON.stringify(createResumeBackup(app, resume.id), null, 2)
            );
            capture("JSON 导出准备");
          }}
        >
          下载单份 JSON
        </Btn>
        <Btn
          disabled={busy}
          onClick={() => {
            downloadText(`${safeName}.txt`, resumeText(resume), "text/plain");
            capture("TXT 导出准备");
          }}
        >
          下载 TXT
        </Btn>
          </div>
        </details>
        <Btn disabled={busy} onClick={() => void word()}>
          下载 DOCX
        </Btn>
        <Btn
          variant="primary"
          disabled={busy || !ready || !!plan?.pages.some((p) => p.oversized)}
          onClick={() => void print()}
        >
          {busy ? "正在准备…" : "打印 / 另存为 PDF"}
        </Btn>
      </div>
      {prepared && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-2 text-[12px] text-ink-500"><span>已保留导出准备快照；尚未记录实际投递。</span><Btn size="sm" onClick={onRecordApplication}>记录投递</Btn></div>}
      {ready &&
        createPortal(
          <div className="print-only">
            {plan.pages.map((page, i) => (
              <div className="resume-print-page" key={i}>
                <A4Sheet resume={page.resume} forPrint />
              </div>
            ))}
          </div>,
          document.body
        )}
    </Modal>
  );
}
