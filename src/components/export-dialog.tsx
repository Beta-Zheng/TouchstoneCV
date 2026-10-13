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
}: {
  resume: Resume;
  onClose: () => void;
  onLocate: (sectionId: string, blockId?: string) => void;
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
    "setTheme",
    "captureSnapshot"
  );
  const [plan, setPlan] = useState<{
    source: Resume;
    pages: PageLayout[];
  } | null>(null);
  const planRef = useRef(plan);
  planRef.current = plan;
  const [busy, setBusy] = useState(false);
  const issues = inspectResume(resume);
  const ready = plan?.source === resume;
  const filename = `resume_${
    resume.data.basic_info.name || "untitled"
  }_${fmtDateCompact(nowISO())}`;
  const capture = (label: string) =>
    app.captureSnapshot(resume.id, label, "export");
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
      document.title = filename;
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
        `${filename}.docx`,
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
        sub="PDF 按下方分页输出；DOCX 使用可编辑单栏布局。导出准备会保留快照，打印关闭不代表已保存文件。"
        onClose={onClose}
      />
      <div className="grid max-h-[65vh] grid-cols-1 overflow-y-auto lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-line p-4 lg:border-r">
          <h4 className="mb-2 text-[13px] font-bold">投递前检查</h4>
          {issues.length ? (
            <ul className="space-y-2">
              {issues.map((issue) => (
                <li
                  key={issue.id}
                  className={`rounded-lg p-2 text-[11px] ${
                    issue.severity === "warning"
                      ? "bg-danger-100 text-danger-700"
                      : "bg-paper-100 text-ink-500"
                  }`}
                >
                  {issue.message}
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
            <p className="text-[12px] text-brand-700">基础内容检查通过</p>
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
            onClick={() => app.setTheme(resume.id, { density: "compact" })}
          >
            切换紧凑布局
          </Btn>
        </aside>
        <div className="min-w-0">
          <ResumePreview
            resume={resume}
            onLayout={(pages) => setPlan({ source: resume, pages })}
          />
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-paper-25 p-3">
        <Btn
          disabled={busy}
          onClick={() => {
            downloadText(
              `${filename}.json`,
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
            downloadText(`${filename}.txt`, resumeText(resume), "text/plain");
            capture("TXT 导出准备");
          }}
        >
          下载 TXT
        </Btn>
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
