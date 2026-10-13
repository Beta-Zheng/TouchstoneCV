import { useState } from "react";
import type { Application, ApplicationStatus } from "../types";
import { useAppSlice } from "../lib/store";
import { nowISO, uid, fmtDate } from "../lib/utils";
import { Btn, Confirm, Modal, ModalHeader } from "../components/ui";

export const APPLICATION_LABELS: Record<ApplicationStatus, string> = {
  saved: "待投递",
  applied: "已投递",
  interview: "面试中",
  offer: "收到 Offer",
  rejected: "已结束",
};
export function ApplicationForm({
  initial,
  resumeId,
  onClose,
}: {
  initial?: Application;
  resumeId?: string;
  onClose: () => void;
}) {
  const app = useAppSlice(
    "resumes",
    "snapshots",
    "saveApplication",
    "captureSnapshot",
    "toast"
  );
  const source =
    app.resumes.find((r) => r.id === (resumeId ?? initial?.resume_id)) ??
    app.resumes[0];
  const [draft, setDraft] = useState<Application>(
    initial ?? {
      id: uid("application"),
      resume_id: source?.id ?? "",
      company: source?.target?.company ?? "",
      role: source?.target?.job_title ?? source?.data.basic_info.title ?? "",
      url: "",
      status: "saved",
      notes: "",
      applied_at: "",
      follow_up_at: "",
      created_at: nowISO(),
      updated_at: nowISO(),
    }
  );
  const patch = (value: Partial<Application>) =>
    setDraft((s) => ({ ...s, ...value }));
  const submit = () => {
    if (
      !draft.company.trim() ||
      !draft.role.trim() ||
      !app.resumes.some((r) => r.id === draft.resume_id)
    ) {
      app.toast("warn", "请填写公司、职位并选择简历");
      return;
    }
    if (draft.url.trim()) {
      try {
        const url = new URL(draft.url);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      } catch {
        app.toast("warn", "岗位链接需以 http:// 或 https:// 开头");
        return;
      }
    }
    let snapshotId = draft.snapshot_id;
    if (draft.status !== "saved" && !snapshotId)
      snapshotId =
        app.captureSnapshot(
          draft.resume_id,
          `${draft.company} · 投递记录版本`
        ) ?? undefined;
    app.saveApplication({
      ...draft,
      company: draft.company.trim(),
      role: draft.role.trim(),
      snapshot_id: snapshotId,
      applied_at:
        draft.status !== "saved" && !draft.applied_at
          ? fmtDate(nowISO())
          : draft.applied_at,
    });
    app.toast("ok", "投递记录已保存；该操作不会向企业发送简历");
    onClose();
  };
  return (
    <Modal open onClose={onClose}>
      <ModalHeader
        title={initial ? "编辑投递记录" : "新增投递记录"}
        sub="记录实际投递进度与当时版本，所有数据保存在本机"
        onClose={onClose}
      />
      <div className="flex flex-col gap-3 px-5 pb-5">
        {(
          [
            ["company", "公司"],
            ["role", "职位"],
            ["url", "岗位链接"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="text-[12px]">
            {label}
            <input
              className="field-input mt-1"
              value={draft[key]}
              onChange={(e) => patch({ [key]: e.target.value })}
            />
          </label>
        ))}
        <label className="text-[12px]">
          关联简历
          <select
            className="field-input mt-1"
            value={draft.resume_id}
            onChange={(e) =>
              patch({ resume_id: e.target.value, snapshot_id: undefined })
            }
          >
            <option value="" disabled>
              请选择
            </option>
            {app.resumes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[12px]">
          投递时的版本
          <select
            className="field-input mt-1"
            value={draft.snapshot_id ?? ""}
            onChange={(e) =>
              patch({ snapshot_id: e.target.value || undefined })
            }
          >
            <option value="">记录投递时自动创建当前版本快照</option>
            {app.snapshots
              .filter((s) => s.resume_id === draft.resume_id)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} · {fmtDate(s.created_at)}
                </option>
              ))}
          </select>
        </label>
        <label className="text-[12px]">
          状态
          <select
            className="field-input mt-1"
            value={draft.status}
            onChange={(e) =>
              patch({ status: e.target.value as ApplicationStatus })
            }
          >
            {Object.entries(APPLICATION_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ["applied_at", "投递日期"],
              ["follow_up_at", "跟进日期"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="text-[12px]">
              {label}
              <input
                type="date"
                className="field-input mt-1"
                value={draft[key]}
                onInput={(e) => patch({ [key]: e.currentTarget.value })}
                onChange={(e) => patch({ [key]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <label className="text-[12px]">
          备注
          <textarea
            className="field-input mt-1"
            rows={3}
            value={draft.notes}
            onChange={(e) => patch({ notes: e.target.value })}
          />
        </label>
        <Btn variant="primary" onClick={submit}>
          保存记录
        </Btn>
      </div>
    </Modal>
  );
}

export default function Applications() {
  const app = useAppSlice(
    "applications",
    "resumes",
    "snapshots",
    "go",
    "deleteApplication"
  );
  const [edit, setEdit] = useState<Application | "new" | null>(null);
  const [remove, setRemove] = useState<Application | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const today = fmtDate(nowISO());
  const list = app.applications.filter(
    (a) =>
      (status === "all" || a.status === status) &&
      [a.company, a.role].join(" ").toLowerCase().includes(query.toLowerCase())
  );
  return (
    <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">投递记录</h1>
          <p className="mt-2 text-[13px] text-ink-500">
            关联岗位、简历快照与跟进日期。这里记录进度，不会自动投递或发送邮件。
          </p>
        </div>
        <Btn
          variant="primary"
          disabled={!app.resumes.length}
          onClick={() => setEdit("new")}
        >
          新增记录
        </Btn>
      </div>
      <div className="my-5 flex gap-3">
        <input
          aria-label="搜索投递记录"
          className="field-input max-w-xs"
          placeholder="公司或职位"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="筛选投递状态"
          className="field-input max-w-40"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">全部状态</option>
          {Object.entries(APPLICATION_LABELS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {!list.length && (
        <p className="rounded-xl border border-dashed border-line p-8 text-center text-ink-500">
          {app.resumes.length ? "还没有符合条件的投递记录" : "请先创建一份简历"}
        </p>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {list.map((a) => (
          <article
            key={a.id}
            className="rounded-xl border border-line bg-surface p-4"
          >
            <div className="flex justify-between gap-3">
              <h2 className="font-bold">
                {a.company} · {a.role}
              </h2>
              <span className="chip bg-brand-50 text-brand-700">
                {APPLICATION_LABELS[a.status]}
              </span>
            </div>
            <p className="mt-2 text-[12px] text-ink-500">
              {app.resumes.find((r) => r.id === a.resume_id)?.title} ·{" "}
              {a.snapshot_id
                ? app.snapshots.find((s) => s.id === a.snapshot_id)?.label
                : "尚未记录投递版本"}
            </p>
            <p className="mt-1 text-[11px] text-ink-400">
              {a.applied_at && `投递 ${a.applied_at}`}{" "}
              {a.follow_up_at && `· 跟进 ${a.follow_up_at}`}
            </p>
            {a.follow_up_at &&
              a.follow_up_at <= today &&
              !["offer", "rejected"].includes(a.status) && (
                <p className="mt-2 text-[12px] text-seal-700">已到跟进日期</p>
              )}
            <p className="mt-2 whitespace-pre-wrap text-[12px]">{a.notes}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn onClick={() => setEdit(a)}>编辑</Btn>
              <Btn
                onClick={() =>
                  app.go({ name: "editor", resumeId: a.resume_id })
                }
              >
                打开简历
              </Btn>
              <Btn variant="ghost" onClick={() => setRemove(a)}>
                删除记录
              </Btn>
            </div>
          </article>
        ))}
      </div>
      {edit && (
        <ApplicationForm
          initial={edit === "new" ? undefined : edit}
          onClose={() => setEdit(null)}
        />
      )}
      <Confirm
        open={!!remove}
        title="删除投递记录？"
        desc="关联简历与版本快照会保留。"
        confirmText="删除记录"
        onConfirm={() => {
          if (remove) app.deleteApplication(remove.id);
          setRemove(null);
        }}
        onCancel={() => setRemove(null)}
      />
    </div>
  );
}
