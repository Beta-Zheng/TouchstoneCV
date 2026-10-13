import { useRef, useState } from "react";
import { downloadText, fmtDateCompact, nowISO } from "../lib/utils";
import { useAppSlice } from "../lib/store";
import {
  createBackup,
  createResumeBackup,
  parseBackup,
  type BackupData,
} from "../lib/backup";
import { Btn, Confirm, Toggle, Modal, ModalHeader } from "../components/ui";
import {
  IconAlert,
  IconCheck,
  IconDatabase,
  IconDownload,
  IconLock,
  IconShield,
  IconTrash,
  IconUpload,
} from "../components/icons";

export default function Settings() {
  const app = useAppSlice(
    "resumes",
    "jds",
    "suggestions",
    "models",
    "privacy",
    "setPrivacy",
    "toast",
    "importData",
    "clearAll",
    "saveStatus",
    "snapshots",
    "applications",
    "coverLetters"
  );
  const { resumes, jds, suggestions, models, privacy, setPrivacy } = app;
  const [clearArmed, setClearArmed] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const [restoring, setRestoring] = useState<{
    raw: string;
    data: BackupData;
  } | null>(null);
  const [restoreMode, setRestoreMode] = useState<"merge" | "replace">("merge");
  const [singleId, setSingleId] = useState("");
  const [lastBackup, setLastBackup] = useState(() => {
    try {
      return localStorage.getItem("resume-last-backup");
    } catch {
      return null;
    }
  });

  const storageKB =
    Math.round(
      new Blob([
        JSON.stringify({
          resumes,
          jds,
          suggestions,
          models,
          snapshots: app.snapshots,
          applications: app.applications,
          coverLetters: app.coverLetters,
        }),
      ]).size / 102.4
    ) / 10;

  const backup = () => {
    const payload = createBackup(app);
    downloadText(
      `ai-resume-backup-${fmtDateCompact(nowISO())}.json`,
      JSON.stringify(payload, null, 2)
    );
    app.toast("ok", "备份文件已下载（含全部简历与配置）");
    const date = nowISO();
    setLastBackup(date);
    try {
      localStorage.setItem("resume-last-backup", date);
    } catch {
      /* Download remains available when local storage is full. */
    }
  };

  const onImport = (file: File) => {
    if (file.size > 20_000_000) {
      app.toast("err", "备份文件不能超过 20 MB");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => app.toast("err", "无法读取备份文件");
    reader.onload = () => {
      try {
        const raw = String(reader.result || "");
        const data = parseBackup(raw, models);
        setRestoring({ raw, data });
        setRestoreMode("merge");
      } catch {
        app.toast("err", "备份文件格式不正确，原有数据未改变");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-6 pb-16 pt-8">
      <header className="anim-fade-up">
        <p className="mb-1.5 flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-brand-600">
          <IconDatabase size={12} /> Local Data
        </p>
        <h1 className="font-display text-[30px] font-black text-ink-900">
          数据与隐私
        </h1>
        <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-ink-500">
          所有数据默认保存在本机，不上传、不遥测、不请求外部服务。你可以随时备份、恢复或彻底清空。
        </p>
      </header>

      {app.saveStatus === "error" && (
        <p
          role="alert"
          className="rounded-xl bg-danger-100 p-3 text-[12px] text-danger-700"
        >
          本机数据读取或保存失败。请先保管已有备份并检查浏览器存储空间；若本机数据损坏，请从有效备份恢复，原存储内容会保留至明确恢复或清空。
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
        {/* 数据概览 */}
        <section
          className="anim-fade-up rounded-2xl border border-ink-200 bg-paper-25 p-5"
          style={{ animationDelay: "0.05s" }}
        >
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-ink-900">
            <IconDatabase size={16} className="text-brand-600" /> 本地数据概览
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {[
              ["简历", resumes.length, "份"],
              ["JD", Object.keys(jds).length, "份"],
              ["AI 建议记录", suggestions.length, "条"],
              ["模型配置", models.length, "个"],
            ].map(([label, n, unit]) => (
              <div
                key={String(label)}
                className="rounded-xl border border-ink-100 bg-white px-3.5 py-3"
              >
                <p className="font-mono text-[22px] font-bold leading-none text-ink-900">
                  {n}
                  <span className="ml-1 text-[11px] font-medium text-ink-300">
                    {unit}
                  </span>
                </p>
                <p className="mt-1.5 text-[11px] text-ink-400">{label}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 flex items-center justify-between rounded-lg bg-paper-100 px-3 py-2 font-mono text-[11px] text-ink-500">
            <span>浏览器 localStorage</span>
            <span className="font-bold text-ink-800">{storageKB} KB</span>
          </p>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-ink-900 p-3.5 font-mono text-[10.5px] leading-relaxed text-paper-200">
            {`ai-resume-workbench-v1
├── 简历、JD 与 AI 建议
├── 模型配置与本机 API Key
└── 隐私设置

备份文件不包含 API Key`}
          </pre>
        </section>

        {/* 隐私（v1.4：深靛底替代纯黑，属靛蓝家族不违反墨色减法） */}
        <section
          className="anim-fade-up flex flex-col gap-3"
          style={{ animationDelay: "0.1s" }}
        >
          <div className="rounded-2xl border border-brand-800 bg-brand-800 p-5 text-white">
            <h2 className="flex items-center gap-2 text-[15px] font-bold">
              <IconLock size={16} className="text-brand-200" /> 隐私承诺
            </h2>
            <ul className="mt-3 flex flex-col gap-2">
              {[
                "默认不上传任何数据",
                "默认不发送遥测",
                "默认不请求外部服务",
                "外部模型必须显式开启并逐次提示",
                "日志不记录完整 API Key 与简历全文",
              ].map((t) => (
                <li
                  key={t}
                  className="flex items-start gap-2 text-[12px] leading-relaxed text-white/85"
                >
                  <IconCheck
                    size={13}
                    className="mt-0.5 shrink-0 text-brand-200"
                  />{" "}
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-brand-900 px-3.5 py-2.5">
              <span className="flex items-center gap-2 text-[12px] font-medium">
                <IconShield
                  size={14}
                  className={
                    privacy.allowExternal ? "text-seal-500" : "text-brand-200"
                  }
                />
                允许外部模型
              </span>
              <Toggle
                checked={privacy.allowExternal}
                onChange={(v) => {
                  setPrivacy({ allowExternal: v });
                  app.toast(
                    v ? "warn" : "ok",
                    v ? "外部模型已开启" : "外部模型已关闭"
                  );
                }}
                label="允许外部模型"
              />
            </div>
          </div>

          {/* 备份恢复 */}
          <div className="flex-1 rounded-2xl border border-ink-200 bg-paper-25 p-5">
            <h2 className="text-[15px] font-bold text-ink-900">备份与恢复</h2>
            <p className="mt-1 text-[11.5px] leading-relaxed text-ink-400">
              备份包含简历、JD、AI 建议与模型配置，不含 API
              Key。恢复将覆盖当前数据、关闭外部调用，并保留同一服务的本机密钥；新设备请重新填写密钥。
            </p>
            <div className="mt-3.5 flex flex-col gap-2">
              <Btn variant="dark" className="h-9" onClick={backup}>
                <IconDownload size={14} /> 下载备份 JSON
              </Btn>
              <Btn
                variant="outline"
                className="h-9"
                onClick={() => importRef.current?.click()}
              >
                <IconUpload size={14} /> 从备份恢复
              </Btn>
              <input
                ref={importRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImport(f);
                  e.target.value = "";
                }}
              />
              <p className="text-[10px] text-ink-400">
                {lastBackup
                  ? `上次备份下载准备：${new Date(lastBackup).toLocaleString()}`
                  : "尚未下载全量备份"}
              </p>
              <div className="mt-2 flex gap-2">
                <select
                  aria-label="选择单份备份简历"
                  className="field-input min-w-0 flex-1"
                  value={singleId}
                  onChange={(e) => setSingleId(e.target.value)}
                >
                  <option value="">选择简历</option>
                  {resumes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
                <Btn
                  disabled={!singleId}
                  onClick={() =>
                    downloadText(
                      `resume-${singleId}.json`,
                      JSON.stringify(createResumeBackup(app, singleId), null, 2)
                    )
                  }
                >
                  单份备份
                </Btn>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 危险区 */}
      <section
        className="anim-fade-up rounded-2xl border border-danger-600/25 bg-danger-100/40 p-5"
        style={{ animationDelay: "0.15s" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger-100 text-danger-600">
              <IconAlert size={18} />
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-danger-700">
                清空全部数据
              </h2>
              <p className="mt-0.5 text-[12px] leading-relaxed text-ink-500">
                删除本机全部简历、JD、AI
                建议记录，并将模型配置恢复为默认。该操作不可撤销，建议先下载备份。
              </p>
            </div>
          </div>
          {!clearArmed ? (
            <Btn
              variant="danger"
              className="h-9"
              onClick={() => setClearArmed(true)}
            >
              <IconTrash size={14} /> 清空全部数据
            </Btn>
          ) : (
            <div className="flex items-center gap-2">
              <Btn
                variant="ghost"
                className="h-9"
                onClick={() => setClearArmed(false)}
              >
                取消
              </Btn>
              <Btn
                variant="danger"
                className="h-9 font-bold"
                onClick={() => setConfirmClear(true)}
              >
                <IconTrash size={14} /> 确认清空（二次确认）
              </Btn>
            </div>
          )}
        </div>
      </section>

      <p className="text-center font-mono text-[10.5px] text-ink-300">
        TouchstoneCV · 本地优先 · 隐私默认保护 · 构建于{" "}
        {new Date().getFullYear()}
      </p>

      <Confirm
        open={confirmClear}
        danger
        title="确定清空全部数据？"
        desc={`将删除 ${resumes.length} 份简历、${
          suggestions.length
        } 条 AI 建议记录、${
          Object.keys(jds).length
        } 份 JD，模型配置恢复默认。此操作不可撤销。`}
        confirmText="永久删除"
        onConfirm={() => {
          app.clearAll();
          setConfirmClear(false);
          setClearArmed(false);
          app.toast("ok", "全部数据已清空");
        }}
        onCancel={() => setConfirmClear(false)}
      />
      <Modal open={!!restoring} onClose={() => setRestoring(null)}>
        <ModalHeader
          title="预览备份内容"
          sub="确认恢复方式后才写入本机"
          onClose={() => setRestoring(null)}
        />
        <div className="px-5 pb-5">
          {restoring && (
            <>
              <p className="text-[13px]">
                {restoring.data.resumes.length} 份简历 ·{" "}
                {restoring.data.snapshots?.length ?? 0} 份快照 ·{" "}
                {restoring.data.applications?.length ?? 0} 条投递记录
              </p>
              <ul className="my-3 max-h-40 overflow-auto text-[12px] text-ink-500">
                {restoring.data.resumes.map((r) => (
                  <li key={r.id}>{r.title}</li>
                ))}
              </ul>
              <label className="block text-[12px]">
                恢复方式
                <select
                  className="field-input mt-1"
                  value={restoreMode}
                  onChange={(e) =>
                    setRestoreMode(e.target.value as typeof restoreMode)
                  }
                >
                  <option value="merge">
                    合并：保留当前数据，为导入简历分配新 ID
                  </option>
                  <option value="replace">覆盖：替换所有当前简历与配置</option>
                </select>
              </label>
              <p className="my-3 text-[11px] text-ink-500">
                {restoreMode === "replace"
                  ? "覆盖会替换当前数据并关闭外部调用，请先备份。密钥只保留同一服务已有的本机密钥。"
                  : "合并保留当前模型、密钥和隐私设置，关联版本与投递记录一并导入。"}
              </p>
              <Btn
                variant={restoreMode === "replace" ? "danger" : "primary"}
                onClick={() => {
                  if (app.importData(restoring.raw, restoreMode))
                    setRestoring(null);
                  else app.toast("err", "恢复失败，原有数据未改变");
                }}
              >
                {restoreMode === "replace" ? "确认覆盖恢复" : "确认合并导入"}
              </Btn>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
