import type { Application, ApplicationStatus } from "../types";

export const APPLICATION_LABELS: Record<ApplicationStatus, string> = {
  saved: "待投递",
  applied: "已投递",
  interview: "面试中",
  offer: "收到 Offer",
  rejected: "已拒绝",
  withdrawn: "主动撤回",
  closed: "岗位关闭",
};
export const TERMINAL_STATUSES: ApplicationStatus[] = [
  "offer",
  "rejected",
  "withdrawn",
  "closed",
];
export function hasSubmission(application: Application) {
  return (
    !!application.applied_at ||
    ["applied", "interview", "offer", "rejected"].includes(
      application.status
    ) ||
    !!application.events?.some((event) =>
      ["applied", "interview", "offer", "rejected"].includes(event.status)
    )
  );
}
export function applicationStats(applications: Application[], today: string) {
  const counts = Object.fromEntries(
    Object.keys(APPLICATION_LABELS).map((status) => [
      status,
      applications.filter((a) => a.status === status).length,
    ])
  ) as Record<ApplicationStatus, number>;
  const submitted = applications.filter(hasSubmission);
  const interviews = submitted.filter(
    (a) =>
      a.status === "interview" ||
      a.events?.some((e) => e.status === "interview")
  ).length;
  const offers = submitted.filter(
    (a) => a.status === "offer" || a.events?.some((e) => e.status === "offer")
  ).length;
  const followups = applications.filter(
    (a) =>
      a.follow_up_at &&
      a.follow_up_at <= today &&
      !TERMINAL_STATUSES.includes(a.status)
  ).length;
  // Seven-day buckets use date-only strings to avoid timezone shifts.
  const anchor = new Date(`${today}T12:00:00Z`).getTime();
  const weeks = Array.from({ length: 8 }, (_, index) => {
    const start = anchor - (7 * (7 - index) + 6) * 86400000;
    const end = start + 6 * 86400000;
    const from = new Date(start).toISOString().slice(0, 10);
    const to = new Date(end).toISOString().slice(0, 10);
    return {
      from,
      to,
      count: submitted.filter(
        (a) =>
          /^\d{4}-\d{2}-\d{2}$/.test(a.applied_at) &&
          a.applied_at >= from &&
          a.applied_at <= to
      ).length,
    };
  });
  return {
    counts,
    submitted: submitted.length,
    interviews,
    offers,
    followups,
    weeks,
  };
}
