import { useEffect, useRef, useState } from "react";
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
  const [storageEstimate, setStorageEstimate] =
    useState<StorageEstimate | null>(null);
  useEffect(() => {
    let active = true;
    void navigator.storage
      ?.estimate()
      .then((value) => {
        if (active) setStorageEstimate(value);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [app.saveStatus, resumes.length, app.snapshots.length]);
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-12 pt-7 sm:px-6">
      <header className="anim-fade-up">
        <h1 className="text-[28px] font-semibold tracking-tight text-ink-900">
          数据管理
        </h1>
      </header>

      {app.saveStatus === "error" && (
        <p
          role="alert"
          className="rounded-xl bg-danger-100 p-3 text-[12px] text-danger-700"
        >
          本机数据读取或保存失败。请先保管已有备份并检查浏览器存储空间；若本机数据损坏，请从有效备份恢复，原存储内容会保留至明确恢复或清空。
        </p>
      )}

      <div className="grid items-start gap-4 md:grid-cols-[1.2fr_1fr]">
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
                <p className="text-[22px] font-semibold leading-none tabular-nums text-ink-900">
                  {n}
                  <span className="ml-1 text-[12px] font-medium text-ink-500">
                    {unit}
                  </span>
                </p>
                <p className="mt-1.5 text-[12px] text-ink-400">{label}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 flex items-center justify-between rounded-lg bg-paper-100 px-3 py-2 font-mono text-[12px] text-ink-500">
            <span>数据体积估算</span>
            <span className="font-bold text-ink-800">{storageKB} KB</span>
          </p>
          <details className="mt-3 text-[12px] text-ink-500">
            <summary className="cursor-pointer">存储与密钥说明</summary>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-paper-100 p-3 font-mono text-[12px] leading-relaxed text-ink-600">
              {`本机 IndexedDB
├── 简历与快照：共享未改动条目
├── 图片与导入原文：独立去重存储
└── 模型配置、投递记录与隐私设置

旧 localStorage 数据校验并迁移成功后才移除。
备份不含 API Key；本机密钥未加密。`}
            </pre>
            {storageEstimate && (
              <p className="mt-2 text-[12px] text-ink-500">
                站点实际占用约{" "}
                {((storageEstimate.usage ?? 0) / 1024 / 1024).toFixed(1)}{" "}
                MB，浏览器报告配额约{" "}
                {((storageEstimate.quota ?? 0) / 1024 / 1024).toFixed(0)}{" "}
                MB（含本网站缓存，配额不保证可全部使用）。
              </p>
            )}
          </details>
          <p className="mt-3 text-[12px] text-ink-500">
            清理浏览器数据会删除简历，请定期备份。
          </p>
        </section>

        {/* 隐私与备份 */}
        <section
          className="anim-fade-up flex flex-col gap-3"
          style={{ animationDelay: "0.1s" }}
        >
          <div className="rounded-xl border border-line bg-surface p-5 text-ink-800">
            <h2 className="flex items-center gap-2 text-[15px] font-bold">
              <IconLock size={16} className="text-ink-500" /> 数据隐私
            </h2>
            <details className="mt-3 text-[12px] text-ink-500">
              <summary className="cursor-pointer">查看隐私说明</summary>
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
                    className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-600"
                  >
                    <IconCheck
                      size={13}
                      className="mt-0.5 shrink-0 text-ink-500"
                    />{" "}
                    {t}
                  </li>
                ))}
              </ul>
            </details>
            <p className="mt-3 text-[12px] text-ink-500">
              外部模型发送内容前逐次确认。
            </p>
            <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
              <span className="flex items-center gap-2 text-[12px] font-medium">
                <IconShield
                  size={14}
                  className={
                    privacy.allowExternal ? "text-seal-600" : "text-ink-500"
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
            <p className="mt-2 text-[12px] text-ink-500">
              备份不含密钥，恢复时可选择合并或替换。
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
              <p className="text-[12px] text-ink-400">
                {lastBackup
                  ? `上次备份下载准备：${new Date(lastBackup).toLocaleString()}`
                  : "尚未下载全量备份"}
              </p>
              <div className="mt-2 flex gap-2">
                <select data-ui-select
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
                <select data-ui-select
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
              <p className="my-3 text-[12px] text-ink-500">
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
