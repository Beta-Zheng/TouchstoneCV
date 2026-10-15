import { useState } from "react";
import type { Application, ApplicationStatus, ResumeSnapshot } from "../types";
import { useAppSlice } from "../lib/store";
import { nowISO, uid, fmtDate } from "../lib/utils";
import { Btn, Confirm, Modal, ModalHeader } from "../components/ui";
import {
  APPLICATION_LABELS,
  TERMINAL_STATUSES,
  applicationStats,
  hasSubmission,
} from "../lib/applications";
import SnapshotView from "../components/snapshot-view";
import {
  IconFile,
  IconCheck,
  IconUser,
  IconAward,
  IconX,
  IconRefresh,
  IconAlert,
} from "../components/icons";

export { APPLICATION_LABELS } from "../lib/applications";
const STATUS_ICONS = {
  saved: IconFile,
  applied: IconCheck,
  interview: IconUser,
  offer: IconAward,
  rejected: IconX,
  withdrawn: IconRefresh,
  closed: IconAlert,
};
const STATUS_COLORS = {
  saved: "bg-paper-100 text-ink-500",
  applied: "bg-brand-50 text-brand-700",
  interview: "bg-seal-100 text-seal-700",
  offer: "bg-green-50 text-green-700",
  rejected: "bg-danger-100 text-danger-700",
  withdrawn: "bg-paper-100 text-ink-500",
  closed: "bg-paper-100 text-ink-500",
};
function StatusBadge({ status }: { status: ApplicationStatus }) {
  const Icon = STATUS_ICONS[status];
  return (
    <span
      className={`chip inline-flex items-center gap-1 ${STATUS_COLORS[status]}`}
    >
      <Icon size={13} />
      {APPLICATION_LABELS[status]}
    </span>
  );
}
export function ApplicationForm({
  initial,
  resumeId,
  onClose,
}: {
  initial?: Application;
  resumeId?: string;
  onClose: () => void;
}) {
  const app = useAppSlice("resumes", "snapshots", "saveApplication", "toast");
  const source =
    app.resumes.find((r) => r.id === (resumeId ?? initial?.resume_id)) ??
    app.resumes.find((r) => !r.archived_at);
  const [feedback, setFeedback] = useState("");
  const locked = !!initial?.snapshot_id && hasSubmission(initial);
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
    const saved = app.saveApplication(
      {
        ...draft,
        company: draft.company.trim(),
        role: draft.role.trim(),
        applied_at:
          ["applied", "interview", "offer", "rejected"].includes(
            draft.status
          ) && !draft.applied_at
            ? fmtDate(nowISO())
            : draft.applied_at,
      },
      feedback
    );
    if (!saved) {
      app.toast("warn", "记录未保存，请检查关联简历与投递版本");
      return;
    }
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
          <select data-ui-select
            className="field-input mt-1"
            value={draft.resume_id}
            disabled={locked}
            onChange={(e) =>
              patch({ resume_id: e.target.value, snapshot_id: undefined })
            }
          >
            <option value="" disabled>
              请选择
            </option>
            {app.resumes
              .filter((r) => !r.archived_at || r.id === draft.resume_id)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
          </select>
        </label>
        <label className="text-[12px]">
          投递时的版本
          <select data-ui-select
            className="field-input mt-1"
            value={draft.snapshot_id ?? ""}
            disabled={locked}
            onChange={(e) =>
              patch({ snapshot_id: e.target.value || undefined })
            }
          >
            <option value="">实际投递时固定当前内容；待投递不自动创建</option>
            {app.snapshots
              .filter((s) => s.resume_id === draft.resume_id)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} · {fmtDate(s.created_at)}
                </option>
              ))}
          </select>
        </label>
        {locked && (
          <p className="text-[12px] text-ink-500">
            投递版本已固定。再次使用不同简历投递，请新增记录。
          </p>
        )}
        <label className="text-[12px]">
          状态
          <select data-ui-select
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
        <label className="text-[12px]">
          新增反馈（追加到时间线）
          <textarea
            className="field-input mt-1"
            rows={2}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="如：一面安排在周五，重点准备项目经历"
            maxLength={10000}
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
  const [viewSnapshot, setViewSnapshot] = useState<ResumeSnapshot | null>(null);
  const today = fmtDate(nowISO());
  const stats = applicationStats(app.applications, today);
  const list = app.applications.filter(
    (a) =>
      (status === "all" || a.status === status) &&
      [a.company, a.role].join(" ").toLowerCase().includes(query.toLowerCase())
  );
  return (
    <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">投递记录</h1>
        </div>
        <Btn
          variant="primary"
          disabled={!app.resumes.some((r) => !r.archived_at)}
          onClick={() => setEdit("new")}
        >
          新增记录
        </Btn>
      </div>
      <div className="my-5 grid grid-cols-2 gap-3 border-y border-line py-4 lg:grid-cols-4">
        {[
          ["已投递", stats.submitted],
          ["有面试记录", stats.interviews],
          ["收到 Offer", stats.offers],
          ["待跟进", stats.followups],
        ].map(([label, count]) => (
          <div key={label} className="px-3">
            <p className="text-[13px] text-ink-500">{label}</p>
            <p className="mt-1 text-2xl font-bold">{count}</p>
          </div>
        ))}
      </div>
      <details className="mb-5 rounded-xl border border-line bg-surface p-4">
        <summary className="cursor-pointer text-[14px] font-medium">
          查看投递统计
        </summary>
        <p className="mt-3 text-[12px] text-ink-500">
          统计依据手动记录，缺失历史不推断；无反馈不代表拒绝。
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <section
            className="rounded-xl border border-line p-4"
            aria-label="投递状态分布"
          >
            <h2 className="mb-3 text-[13px] font-bold">当前状态分布</h2>
            {Object.entries(APPLICATION_LABELS).map(([key, label]) => (
              <div
                key={key}
                className="mb-2 grid grid-cols-[90px_1fr_24px] items-center gap-2 text-[12px]"
              >
                <span>{label}</span>
                <div className="h-2 rounded bg-paper-100">
                  <div
                    className="h-2 rounded bg-brand-400"
                    style={{
                      width: `${
                        app.applications.length
                          ? (stats.counts[key as ApplicationStatus] /
                              app.applications.length) *
                            100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <span>{stats.counts[key as ApplicationStatus]}</span>
              </div>
            ))}
          </section>
          <section
            className="rounded-xl border border-line p-4"
            aria-label="最近八周投递趋势"
          >
            <h2 className="text-[13px] font-bold">最近八周投递趋势</h2>
            <p className="mt-1 text-[12px] text-ink-500">
              按填写的投递日期统计；缺日期的记录不计入趋势。
            </p>
            <div className="mt-3 flex h-40 items-end gap-2">
              {stats.weeks.map((week) => (
                <div
                  key={week.from}
                  className="flex min-w-0 flex-1 flex-col items-center gap-1 text-[12px]"
                  title={`${week.from} 至 ${week.to}：${week.count} 次`}
                >
                  <span>{week.count}</span>
                  <div
                    className="w-full rounded-t bg-brand-400"
                    style={{
                      height: `${
                        week.count
                          ? Math.max(
                              6,
                              (week.count /
                                Math.max(
                                  1,
                                  ...stats.weeks.map((w) => w.count)
                                )) *
                                100
                            )
                          : 2
                      }px`,
                    }}
                  />
                  <span>{week.from.slice(5)}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-ink-500">
              已记录面试比例：
              {stats.submitted
                ? Math.round((stats.interviews / stats.submitted) * 100)
                : 0}
              % · Offer 比例：
              {stats.submitted
                ? Math.round((stats.offers / stats.submitted) * 100)
                : 0}
              %
            </p>
          </section>
        </div>
      </details>
      <div className="my-5 flex gap-3">
        <input
          aria-label="搜索投递记录"
          className="field-input max-w-xs"
          placeholder="公司或职位"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select data-ui-select
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
              <StatusBadge status={a.status} />
            </div>
            <p className="mt-2 text-[12px] text-ink-500">
              {app.resumes.find((r) => r.id === a.resume_id)?.title} ·{" "}
              {a.snapshot_id
                ? app.snapshots.find((s) => s.id === a.snapshot_id)?.label
                : "尚未记录投递版本"}
            </p>
            <p className="mt-1 text-[12px] text-ink-400">
              {a.applied_at && `投递 ${a.applied_at}`}{" "}
              {a.follow_up_at && `· 跟进 ${a.follow_up_at}`}
            </p>
            {a.follow_up_at &&
              a.follow_up_at <= today &&
              !TERMINAL_STATUSES.includes(a.status) && (
                <p className="mt-2 text-[12px] text-seal-700">已到跟进日期</p>
              )}
            <p className="mt-2 whitespace-pre-wrap text-[12px]">{a.notes}</p>
            <details className="mt-3 text-[12px]">
              <summary className="cursor-pointer text-ink-600">
                反馈时间线 · {a.events?.length ?? 1} 条
              </summary>
              <ol className="mt-2 space-y-2 border-l border-line pl-3">
                {(
                  a.events ?? [
                    {
                      id: a.id,
                      status: a.status,
                      at: a.updated_at,
                      note: "旧记录当前状态，此前历史未知",
                      legacy: true,
                    },
                  ]
                )
                  .slice()
                  .reverse()
                  .map((event) => (
                    <li key={event.id}>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={event.status} />
                        <time className="text-ink-400">
                          {new Date(event.at).toLocaleString()}
                        </time>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap">{event.note}</p>
                    </li>
                  ))}
              </ol>
            </details>
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn onClick={() => setEdit(a)}>编辑</Btn>
              <Btn
                onClick={() =>
                  app.go({ name: "editor", resumeId: a.resume_id })
                }
              >
                编辑当前简历
              </Btn>
              {a.snapshot_id && (
                <Btn
                  onClick={() => {
                    const snapshot = app.snapshots.find(
                      (s) => s.id === a.snapshot_id
                    );
                    if (snapshot) setViewSnapshot(snapshot);
                  }}
                >
                  查看投递版本
                </Btn>
              )}
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
      {viewSnapshot && (
        <SnapshotView
          snapshot={viewSnapshot}
          onClose={() => setViewSnapshot(null)}
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
