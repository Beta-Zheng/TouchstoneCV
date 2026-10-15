import { useState } from "react";
import type { AIAction, CoverLetter, Resume } from "../types";
import { ACTION_LABELS, TEMPLATES } from "../types";
import { useAppSlice } from "../lib/store";
import { diffLines, downloadText, fmtTime } from "../lib/utils";
import { resumeText } from "../lib/export";
import {
  blockHasContent,
  createCoverLetterDraft,
  coverLetterEvidence,
} from "../lib/workflow";
import { selectProvider } from "../lib/ai";
import { A4Sheet } from "./template";
import { Btn, Confirm, Modal, ModalHeader } from "./ui";
import SnapshotView from "./snapshot-view";

export type WorkflowTool =
  | "target"
  | "versions"
  | "module"
  | "letter"
  | "templates"
  | "source";
const TITLES: Record<WorkflowTool, string> = {
  target: "为岗位创建版本",
  versions: "版本快照与比较",
  module: "优化当前模块",
  letter: "求职信",
  templates: "选择模板",
  source: "导入原文",
};
export default function WorkflowDialog({
  tool,
  resume,
  onClose,
  onAIStart,
}: {
  tool: WorkflowTool;
  resume: Resume;
  onClose: () => void;
  onAIStart: (sectionId: string, blockId: string) => void;
}) {
  const app = useAppSlice(
    "models",
    "privacy",
    "jds",
    "snapshots",
    "coverLetters",
    "go",
    "toast",
    "createJobVersion",
    "captureSnapshot",
    "restoreSnapshot",
    "requestSectionSuggestions",
    "patchBlock",
    "saveCoverLetter",
    "setTemplate"
  );
  const [company, setCompany] = useState(resume.target?.company ?? "");
  const [role, setRole] = useState(
    resume.target?.job_title ?? resume.data.basic_info.title
  );
  const [jd, setJD] = useState(app.jds[resume.id]?.raw_text ?? "");
  const [label, setLabel] = useState("");
  const [compare, setCompare] = useState<string | null>(null);
  const [viewSnapshot, setViewSnapshot] = useState<string | null>(null);
  const [restore, setRestore] = useState<string | null>(null);
  const selectable = resume.data.sections.filter(
    (s) =>
      s.visible &&
      s.type !== "basic_info" &&
      s.blocks.some((b) => b.visible && blockHasContent(b))
  );
  const [sectionId, setSectionId] = useState(selectable[0]?.section_id ?? "");
  const section = selectable.find((s) => s.section_id === sectionId);
  const [selected, setSelected] = useState<string[]>(
    section?.blocks
      .filter((b) => b.visible && blockHasContent(b))
      .map((b) => b.block_id) ?? []
  );
  const [action, setAction] = useState<AIAction>("polish");
  const [scaleFact, setScaleFact] = useState("");
  const [timeFact, setTimeFact] = useState("");
  const [resultFact, setResultFact] = useState("");
  const [letter, setLetter] = useState<CoverLetter>(
    app.coverLetters[resume.id] ??
      createCoverLetterDraft(resume, company, role, { jd: app.jds[resume.id] })
  );
  const [regenerate, setRegenerate] = useState(false);
  const rules = selectProvider(app.models, app.privacy).kind === "rules";
  const availableEvidence = coverLetterEvidence(resume, app.jds[resume.id]);
  const [letterEvidence, setLetterEvidence] = useState(
    availableEvidence.slice(0, 3)
  );
  const [motivation, setMotivation] = useState("");
  const [contribution, setContribution] = useState("");
  const snapshots = app.snapshots.filter((s) => s.resume_id === resume.id);
  const compared = snapshots.find((s) => s.id === compare);
  const saveLetter = () => {
    app.saveCoverLetter({ ...letter, company, job_title: role });
    app.toast("ok", "求职信已保存到本机");
  };
  return (
    <Modal
      open
      onClose={onClose}
      width={
        tool === "templates" || tool === "versions" ? "max-w-4xl" : "max-w-2xl"
      }
    >
      <ModalHeader
        title={TITLES[tool]}
        sub={
          tool === "module" ? "建议需确认后写入；外部调用逐次确认。" : undefined
        }
        onClose={onClose}
      />
      <div className="px-5 pb-5">
        {tool === "target" && (
          <div className="flex flex-col gap-3">
            <p className="text-[12px] text-ink-500">
              创建独立副本，主简历保留。
            </p>
            <label className="text-[12px]">
              公司
              <input
                className="field-input mt-1"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </label>
            <label className="text-[12px]">
              目标职位
              <input
                className="field-input mt-1"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
            </label>
            <label className="text-[12px]">
              岗位 JD
              <textarea
                className="field-input mt-1"
                rows={7}
                value={jd}
                onChange={(e) => setJD(e.target.value)}
              />
            </label>
            <Btn
              variant="primary"
              disabled={!company.trim() || !role.trim()}
              onClick={() => {
                const id = app.createJobVersion(resume.id, company, role, jd);
                if (id) {
                  onClose();
                  app.go({ name: "editor", resumeId: id });
                  app.toast("ok", "岗位版本已创建");
                }
              }}
            >
              创建并打开岗位版本
            </Btn>
          </div>
        )}
        {tool === "versions" && (
          <>
            <details className="mb-3 text-[12px] text-ink-500">
              <summary className="cursor-pointer">版本保存规则</summary>
              <p className="mt-2">
                保留最近 20 份近期快照，初始及投递关联快照长期保留。停止编辑 30
                秒或离开编辑页时自动记录有变化的内容；恢复前保存当前版本。
              </p>
            </details>
            <div className="mb-4 flex gap-2">
              <input
                className="field-input"
                aria-label="快照名称"
                placeholder="如：投递前最终版"
                maxLength={128}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
              <Btn
                variant="primary"
                className="shrink-0"
                onClick={() => {
                  app.captureSnapshot(resume.id, label || "手动快照");
                  setLabel("");
                  app.toast("ok", "版本快照已保存");
                }}
              >
                保存快照
              </Btn>
            </div>
            <div className="flex flex-col gap-2">
              {snapshots.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3"
                >
                  <span className="text-[12px]">
                    {s.label} · {new Date(s.created_at).toLocaleDateString()}{" "}
                    {fmtTime(s.created_at)}
                    <span className="ml-2 text-ink-400">
                      {
                        {
                          initial: "初始",
                          auto: "自动",
                          manual: "手动",
                          export: "导出准备",
                        }[s.kind]
                      }
                    </span>
                    {s.summary && (
                      <span className="mt-1 block text-ink-500">
                        {s.summary}
                      </span>
                    )}
                  </span>
                  <div className="flex gap-2">
                    <Btn onClick={() => setViewSnapshot(s.id)}>查看版本</Btn>
                    <Btn onClick={() => setCompare(s.id)}>与当前比较</Btn>
                    <Btn onClick={() => setRestore(s.id)}>恢复</Btn>
                  </div>
                </div>
              ))}
              {!snapshots.length && (
                <p className="text-[12px] text-ink-400">
                  暂无快照，保存后可以比较和恢复。
                </p>
              )}
            </div>
            {compared && (
              <div className="mt-4">
                <p className="mb-2 text-[12px] font-bold">
                  {compared.label} → 当前简历（文本差异）
                </p>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-paper-50 p-3 text-[12px]">
                  {diffLines(
                    resumeText(compared.resume).split("\n"),
                    resumeText(resume).split("\n")
                  ).map((line, i) => (
                    <div
                      key={i}
                      className={
                        line.kind === "add"
                          ? "bg-brand-50 text-brand-800"
                          : line.kind === "del"
                          ? "bg-danger-100 text-danger-700"
                          : "text-ink-500"
                      }
                    >
                      {line.kind === "add"
                        ? "+ "
                        : line.kind === "del"
                        ? "− "
                        : "  "}
                      {line.text}
                    </div>
                  ))}
                </pre>
                <p className="mt-2 text-[12px] text-ink-500">
                  模板：{compared.resume.template_id} → {resume.template_id} ·
                  字号：{compared.resume.theme.font_size} →{" "}
                  {resume.theme.font_size} · 语言：
                  {compared.resume.locale ?? "zh"} → {resume.locale ?? "zh"}
                </p>
              </div>
            )}
          </>
        )}
        {tool === "module" && (
          <div className="flex flex-col gap-3">
            <label className="text-[12px]">
              选择模块
              <select data-ui-select
                className="field-input mt-1"
                value={sectionId}
                onChange={(e) => {
                  const next = selectable.find(
                    (s) => s.section_id === e.target.value
                  );
                  setSectionId(e.target.value);
                  setSelected(
                    next?.blocks
                      .filter((b) => b.visible && blockHasContent(b))
                      .map((b) => b.block_id) ?? []
                  );
                }}
              >
                {selectable.map((s) => (
                  <option key={s.section_id} value={s.section_id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[12px]">
              优化动作
              <select data-ui-select
                className="field-input mt-1"
                value={action}
                onChange={(e) => setAction(e.target.value as AIAction)}
              >
                {Object.entries(ACTION_LABELS).map(([id, meta]) => (
                  <option
                    key={id}
                    value={id}
                    disabled={
                      rules && ["rewrite", "expand", "translate"].includes(id)
                    }
                  >
                    {meta.label}
                    {rules && ["rewrite", "expand", "translate"].includes(id)
                      ? "（需模型）"
                      : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-lg border border-line p-3">
              {section?.blocks
                .filter((b) => b.visible && blockHasContent(b))
                .map((b) => (
                  <label
                    key={b.block_id}
                    className="mb-2 flex gap-2 text-[12px]"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(b.block_id)}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, b.block_id]
                            : selected.filter((id) => id !== b.block_id)
                        )
                      }
                    />
                    {b.title || b.description.slice(0, 40) || "该条目"}
                  </label>
                ))}
            </div>
            <p className="text-[12px] text-ink-500">
              计划生成 {selected.length}{" "}
              条建议，按顺序处理；你可以逐条接受或拒绝。取消会停止剩余队列。
            </p>
            {action === "quantify" && (
              <div className="rounded-lg bg-paper-50 p-3">
                <p className="mb-2 text-[12px] font-bold">
                  先补充真实事实（仅选择一个条目时可写入）
                </p>
                {[
                  ["规模", scaleFact, setScaleFact],
                  ["耗时 / 时间", timeFact, setTimeFact],
                  ["结果", resultFact, setResultFact],
                ].map(([name, value, setter]) => (
                  <label key={String(name)} className="mb-2 block text-[12px]">
                    {String(name)}
                    <input
                      className="field-input mt-1"
                      value={String(value)}
                      onChange={(e) =>
                        (setter as (s: string) => void)(e.target.value)
                      }
                    />
                  </label>
                ))}
                <Btn
                  disabled={
                    selected.length !== 1 ||
                    ![scaleFact, timeFact, resultFact].some((s) => s.trim())
                  }
                  onClick={() => {
                    const b = section?.blocks.find(
                      (b) => b.block_id === selected[0]
                    );
                    if (!b || !section) return;
                    const facts = [
                      ["规模", scaleFact],
                      ["时间", timeFact],
                      ["结果", resultFact],
                    ]
                      .filter(([, value]) => value.trim())
                      .map(([name, value]) => `${name}：${value.trim()}`);
                    app.patchBlock(resume.id, section.section_id, b.block_id, {
                      bullets: [...b.bullets, ...facts],
                    });
                    setScaleFact("");
                    setTimeFact("");
                    setResultFact("");
                    app.toast("ok", "已补充你提供的事实");
                  }}
                >
                  补充到条目
                </Btn>
              </div>
            )}
            <Btn
              variant="primary"
              disabled={
                !selected.length ||
                (action === "jd_match" && !app.jds[resume.id])
              }
              onClick={() => {
                app.requestSectionSuggestions(
                  resume.id,
                  sectionId,
                  action,
                  selected
                );
                onAIStart(sectionId, selected[0]);
                onClose();
              }}
            >
              按计划生成建议
            </Btn>
          </div>
        )}
        {tool === "letter" && (
          <div className="flex flex-col gap-3">
            <p className="text-[12px] text-ink-500">
              选择经历，补充动机，再生成草稿。
            </p>
            <p className="text-[12px] text-ink-500">
              当前草稿：{letter.locale === "en" ? "英文" : "中文"}·
              更换版式不会翻译已有内容。
            </p>
            <label className="text-[12px]">
              为何应聘这家公司（英文信请填写英文）
              <textarea
                aria-label="应聘动机"
                className="field-input mt-1"
                value={motivation}
                onChange={(e) => setMotivation(e.target.value)}
                placeholder="具体产品、业务或团队吸引你的原因，避免空泛赞美"
              />
            </label>
            <label className="text-[12px]">
              你能带来的贡献（只写真实能力）
              <textarea
                aria-label="岗位贡献"
                className="field-input mt-1"
                value={contribution}
                onChange={(e) => setContribution(e.target.value)}
                placeholder="把真实经历与当前岗位要解决的问题连接起来"
              />
            </label>
            <fieldset className="max-h-40 overflow-auto rounded-lg border border-line p-2">
              <legend className="text-[12px]">
                选择最多三条经历证据（按 JD 相关词项排序）
              </legend>
              {availableEvidence.map((text, i) => (
                <label key={i} className="mb-2 flex gap-2 text-[12px]">
                  <input
                    type="checkbox"
                    checked={letterEvidence.includes(text)}
                    disabled={
                      !letterEvidence.includes(text) &&
                      letterEvidence.length >= 3
                    }
                    onChange={(e) =>
                      setLetterEvidence(
                        e.target.checked
                          ? [...letterEvidence, text]
                          : letterEvidence.filter((x) => x !== text)
                      )
                    }
                  />
                  {text}
                </label>
              ))}
            </fieldset>
            {letter.locale === "en" && /[\u4e00-\u9fff]/.test(letter.body) && (
              <p role="status" className="text-[12px] text-seal-700">
                正文仍含中文经历。可先用模型翻译对应条目并确认，再生成英文求职信；切换版式不会翻译内容。
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <label className="text-[12px]">
                公司
                <input
                  className="field-input mt-1"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </label>
              <label className="text-[12px]">
                职位
                <input
                  className="field-input mt-1"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                />
              </label>
            </div>
            <Btn onClick={() => setRegenerate(true)}>
              按当前简历重新生成草稿
            </Btn>
            <textarea
              aria-label="求职信正文"
              className="field-input"
              rows={14}
              value={letter.body}
              onChange={(e) => setLetter({ ...letter, body: e.target.value })}
            />
            <div className="flex gap-2">
              <Btn variant="primary" onClick={saveLetter}>
                保存求职信
              </Btn>
              <Btn
                onClick={() => {
                  saveLetter();
                  downloadText(
                    `cover-letter-${
                      resume.data.basic_info.name || "resume"
                    }.txt`,
                    letter.body,
                    "text/plain"
                  );
                }}
              >
                下载 TXT
              </Btn>
            </div>
          </div>
        )}
        {tool === "templates" && (
          <div className="grid gap-4 sm:grid-cols-3">
            {TEMPLATES.map((t) => (
              <button
                key={t.template_id}
                className={`rounded-xl border p-3 text-left ${
                  resume.template_id === t.template_id
                    ? "border-brand-500 bg-brand-50"
                    : "border-line"
                }`}
                onClick={() => {
                  app.setTemplate(resume.id, t.template_id);
                  onClose();
                }}
              >
                <div className="mx-auto mb-3 h-[180px] w-[130px] overflow-hidden rounded bg-white">
                  <div
                    style={{
                      transform: "scale(0.164)",
                      transformOrigin: "top left",
                      width: 794,
                    }}
                  >
                    <A4Sheet
                      resume={{ ...resume, template_id: t.template_id }}
                    />
                  </div>
                </div>
                <p className="text-[13px] font-bold">{t.name}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-500">
                  {t.description}
                </p>
              </button>
            ))}
          </div>
        )}
        {tool === "source" && (
          <>
            <p className="mb-2 text-[12px] text-ink-500">
              {resume.data.metadata.reviewed_at
                ? "导入时已完成核对；原文保存在本机，不参与 PDF / DOCX 导出。"
                : "可将原文与当前条目对照核对。"}
            </p>
            <pre className="max-h-[55vh] overflow-auto whitespace-pre-wrap rounded-xl bg-paper-50 p-4 text-[12px]">
              {resume.data.metadata.source_text || "这份简历没有保存导入原文。"}
            </pre>
          </>
        )}
      </div>
      {viewSnapshot && app.snapshots.find((s) => s.id === viewSnapshot) && (
        <SnapshotView
          snapshot={app.snapshots.find((s) => s.id === viewSnapshot)!}
          onClose={() => setViewSnapshot(null)}
        />
      )}
      <Confirm
        open={!!restore}
        title="恢复该快照？"
        desc="将恢复内容、模板与 JD，并保留恢复前的自动快照；当前简历的 AI 建议会清除。"
        confirmText="恢复版本"
        onConfirm={() => {
          if (restore && app.restoreSnapshot(restore))
            app.toast("ok", "快照已恢复");
          setRestore(null);
        }}
        onCancel={() => setRestore(null)}
      />
      <Confirm
        open={regenerate}
        title="重新生成求职信草稿？"
        desc="将替换当前编辑框中的文字，已保存版本会在你再次保存时更新。"
        confirmText="重新生成"
        onConfirm={() => {
          setLetter(
            createCoverLetterDraft(resume, company, role, {
              jd: app.jds[resume.id],
              evidence: letterEvidence,
              motivation,
              contribution,
            })
          );
          setRegenerate(false);
        }}
        onCancel={() => setRegenerate(false)}
      />
    </Modal>
  );
}
