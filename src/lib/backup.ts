import type {
  Application,
  Block,
  CoverLetter,
  JD,
  ModelProvider,
  Resume,
  ResumeSnapshot,
  RouteStrategy,
  Suggestion,
} from "../types";
import {
  ACTION_LABELS,
  SECTION_LABELS,
  TEMPLATES,
  BULLET_STYLE_OPTIONS,
} from "../types";

export interface BackupData {
  resumes: Resume[];
  jds: Record<string, JD>;
  suggestions: Suggestion[];
  models: ModelProvider[];
  privacy: { allowExternal: boolean; route: RouteStrategy };
  snapshots?: ResumeSnapshot[];
  applications?: Application[];
  coverLetters?: Record<string, CoverLetter>;
}

// Parse into a whitelist of fields; never merge untrusted objects into application state.
type Reader = (value: unknown) => unknown;
const fail = (): never => {
  throw new Error("备份数据格式不正确");
};
const text: Reader = (v) =>
  typeof v === "string" && v.length <= 100_000 ? v : fail();
const id: Reader = (v) =>
  typeof v === "string" &&
  /^[\w-]{1,128}$/.test(v) &&
  !["__proto__", "constructor", "prototype"].includes(v)
    ? v
    : fail();
const bool: Reader = (v) => (typeof v === "boolean" ? v : fail());
const number =
  (min: number, max: number): Reader =>
  (v) =>
    typeof v === "number" && Number.isFinite(v) && v >= min && v <= max
      ? v
      : fail();
const choice =
  (values: readonly string[]): Reader =>
  (v) =>
    typeof v === "string" && values.includes(v) ? v : fail();
const optional =
  (read: Reader): Reader =>
  (v) =>
    v === undefined ? undefined : read(v);
const array =
  (read: Reader, max = 1000): Reader =>
  (v) =>
    Array.isArray(v) && v.length <= max ? v.map(read) : fail();
const record = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : fail();
const object =
  (shape: Record<string, Reader>): Reader =>
  (v) => {
    const input = record(v);
    return Object.fromEntries(
      Object.entries(shape)
        .map(([key, read]) => [key, read(input[key])])
        .filter(([, value]) => value !== undefined)
    );
  };
const date: Reader = (v) =>
  typeof v === "string" && v.length <= 40 && Number.isFinite(Date.parse(v))
    ? v
    : fail();
const image: Reader = (v) =>
  typeof v === "string" &&
  v.length <= 3_000_000 &&
  (v === "" ||
    /^data:image\/(png|jpeg|webp|gif|svg\+xml|avif|bmp|x-icon);base64,[a-z0-9+/=]+$/i.test(
      v
    ))
    ? v
    : fail();
const url: Reader = (v) => {
  const value = text(v) as string;
  const parsed = new URL(value);
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  )
    fail();
  return value;
};
const block = object({
  block_id: id,
  type: choice([
    "summary",
    "work_experience_item",
    "project_experience_item",
    "education_item",
    "skill_group",
    "certification",
    "custom_text",
  ]),
  title: text,
  subtitle: text,
  start_date: text,
  end_date: text,
  location: text,
  description: text,
  bullets: array(text),
  bullet_marks: optional(array(bool)),
  subtitles: optional(array(text)),
  skills: array(text),
  links: array(text),
  visible: bool,
  order: number(0, 10000),
});
const bulletStyle = choice(BULLET_STYLE_OPTIONS.map((x) => x.key));
const resume = object({
  id,
  title: text,
  template_id: choice(TEMPLATES.map((x) => x.template_id)),
  created_at: date,
  updated_at: date,
  locale: optional(choice(["zh", "en"])),
  audience: optional(choice(["student", "experienced", "career_change"])),
  target: optional(
    object({ company: text, job_title: text, source_resume_id: optional(id) })
  ),
  theme: object({
    primary_color: (v) =>
      typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : fail(),
    font_size: number(8, 32),
    font_family: optional(
      choice(["sans", "serif", "system", "kai", "mono", "fangsong"])
    ),
    density: optional(choice(["compact", "medium", "loose"])),
    header_layout: optional(choice(["row", "stack"])),
    bullet_style: optional(bulletStyle),
    avatar_scale: optional(number(0.5, 2)),
  }),
  data: object({
    basic_info: object({
      name: text,
      title: text,
      email: text,
      phone: text,
      location: text,
      website: text,
      custom_fields: optional(array(object({ label: text, value: text }))),
    }),
    sections: array(
      object({
        section_id: id,
        type: choice(Object.keys(SECTION_LABELS)),
        title: text,
        visible: bool,
        order: number(0, 10000),
        blocks: array(block),
        bullet_style: optional(bulletStyle),
      }),
      100
    ),
    metadata: object({
      source: choice(["file", "pasted_text", "empty", "sample"]),
      source_name: optional(text),
      created_at: date,
      source_text: optional(text),
      reviewed_at: optional(date),
    }),
    avatar_url: optional(image),
    school_badge_url: optional(image),
  }),
});
const model = object({
  id,
  name: text,
  type: choice(["local", "external", "private"]),
  protocol: choice(["ollama", "openai_compatible"]),
  base_url: url,
  api_key: optional(text),
  model_name: text,
  temperature: number(0, 2),
  max_tokens: number(1, 1_000_000),
  timeout_ms: number(1, 600_000),
  enabled: bool,
  created_at: date,
});
const jd = object({
  jd_id: id,
  resume_id: id,
  raw_text: text,
  created_at: date,
  structured: object({
    job_title: text,
    responsibilities: array(text),
    requirements: array(text),
    skills: array(text),
    keywords: array(text),
    education: text,
    experience_years: (v) => (v === null ? null : number(0, 100)(v)),
  }),
});
const suggestion = object({
  id,
  resume_id: id,
  section_id: id,
  block_id: id,
  action: choice(Object.keys(ACTION_LABELS)),
  engine: choice(["llm", "rules"]),
  provider_name: text,
  status: choice(["generating", "success", "failed"]),
  original: block,
  suggested: optional(block),
  applied: optional(block),
  explanation: optional(text),
  matched_keywords: array(text),
  warnings: array(text),
  error: optional(text),
  resolution: optional(choice(["accepted", "rejected", "edited_accepted"])),
  created_at: date,
});
const snapshot = object({
  id,
  resume_id: id,
  label: text,
  kind: choice(["manual", "export"]),
  created_at: date,
  resume,
  jd: optional(jd),
});
const application = object({
  id,
  resume_id: id,
  snapshot_id: optional(id),
  company: text,
  role: text,
  url: text,
  status: choice(["saved", "applied", "interview", "offer", "rejected"]),
  notes: text,
  applied_at: text,
  follow_up_at: text,
  created_at: date,
  updated_at: date,
});
const letter = object({
  resume_id: id,
  company: text,
  job_title: text,
  locale: choice(["zh", "en"]),
  body: text,
  updated_at: date,
});

function unique(values: string[]) {
  if (new Set(values).size !== values.length) fail();
}

export function parseBackup(
  raw: string,
  currentModels: ModelProvider[],
  mode: "restore" | "hydrate" = "restore"
): BackupData {
  if (raw.length > 20_000_000) fail();
  const input = record(JSON.parse(raw));
  // v1 is the existing public backup format; an absent version supports older exports.
  if (input.version !== undefined && input.version !== 1 && input.version !== 2)
    fail();
  if (input.app !== undefined && input.app !== "ai-resume") fail();
  const resumes = array(resume, 1000)(input.resumes) as Resume[];
  unique(resumes.map((r) => r.id));
  for (const r of resumes) {
    unique(r.data.sections.map((s) => s.section_id));
    unique(r.data.sections.flatMap((s) => s.blocks.map((b) => b.block_id)));
  }
  const ids = new Set(resumes.map((r) => r.id));
  const jds: Record<string, JD> = Object.fromEntries(
    Object.entries(record(input.jds ?? {})).map(([key, value]) => {
      const parsed = jd(value) as JD;
      if (!ids.has(key) || parsed.resume_id !== key) fail();
      return [key, parsed];
    })
  );
  const suggestions = array(
    suggestion,
    10000
  )(input.suggestions ?? []) as Suggestion[];
  unique(suggestions.map((s) => s.id));
  for (const s of suggestions) {
    if (
      !ids.has(s.resume_id) ||
      s.original.block_id !== s.block_id ||
      (s.suggested && s.suggested.block_id !== s.block_id)
    )
      fail();
    if (s.status === "success" && !s.suggested) fail();
  }
  const snapshots = array(
    snapshot,
    2000
  )(input.snapshots ?? []) as ResumeSnapshot[];
  unique(snapshots.map((s) => s.id));
  for (const s of snapshots) {
    if (
      !ids.has(s.resume_id) ||
      s.resume.id !== s.resume_id ||
      (s.jd && s.jd.resume_id !== s.resume_id)
    )
      fail();
    unique(s.resume.data.sections.map((section) => section.section_id));
    unique(
      s.resume.data.sections.flatMap((section) =>
        section.blocks.map((b) => b.block_id)
      )
    );
  }
  const snapshotIds = new Set(snapshots.map((s) => s.id));
  const applications = array(
    application,
    1000
  )(input.applications ?? []) as Application[];
  unique(applications.map((a) => a.id));
  for (const a of applications)
    if (
      !ids.has(a.resume_id) ||
      (a.snapshot_id &&
        (!snapshotIds.has(a.snapshot_id) ||
          snapshots.find((s) => s.id === a.snapshot_id)?.resume_id !==
            a.resume_id))
    )
      fail();
  const coverLetters: Record<string, CoverLetter> = Object.fromEntries(
    Object.entries(record(input.coverLetters ?? {})).map(([key, value]) => {
      const parsed = letter(value) as CoverLetter;
      if (!ids.has(key) || parsed.resume_id !== key) fail();
      return [key, parsed];
    })
  );
  const models =
    input.models === undefined
      ? currentModels
      : (array(model, 100)(input.models) as ModelProvider[]);
  unique(models.map((m) => m.id));
  const restoredModels = models.map((m) => {
    const existing = currentModels.find(
      (x) =>
        x.id === m.id &&
        x.base_url === m.base_url &&
        x.protocol === m.protocol &&
        x.type === m.type
    );
    return {
      ...m,
      api_key: mode === "hydrate" ? m.api_key ?? "" : existing?.api_key ?? "",
      enabled:
        mode === "hydrate" ? m.enabled : !!existing?.enabled && m.enabled,
    };
  });
  const privacy =
    input.privacy === undefined
      ? { allowExternal: false, route: "local_first" as const }
      : (object({
          allowExternal: bool,
          route: choice(["local_first", "local_only", "ask_before_external"]),
        })(input.privacy) as BackupData["privacy"]);
  return {
    resumes,
    jds,
    suggestions: suggestions.filter((s) => s.status !== "generating"),
    models: restoredModels,
    snapshots,
    applications,
    coverLetters,
    privacy: {
      ...privacy,
      allowExternal: mode === "hydrate" && privacy.allowExternal,
    },
  };
}

export function createBackup(data: BackupData) {
  return {
    app: "ai-resume",
    version: 2,
    exported_at: new Date().toISOString(),
    snapshots: data.snapshots ?? [],
    applications: data.applications ?? [],
    coverLetters: data.coverLetters ?? {},
    resumes: data.resumes,
    jds: data.jds,
    suggestions: data.suggestions.filter((s) => s.status !== "generating"),
    models: data.models.map(({ api_key: _key, ...model }) => model),
    privacy: data.privacy,
  };
}

export function createResumeBackup(data: BackupData, resumeId: string) {
  const selected = data.resumes.find((r) => r.id === resumeId);
  if (!selected) throw new Error("简历不存在");
  return createBackup({
    resumes: [selected],
    jds: data.jds[resumeId] ? { [resumeId]: data.jds[resumeId] } : {},
    suggestions: data.suggestions.filter((s) => s.resume_id === resumeId),
    snapshots: data.snapshots?.filter((s) => s.resume_id === resumeId),
    applications: data.applications?.filter((a) => a.resume_id === resumeId),
    coverLetters: data.coverLetters?.[resumeId]
      ? { [resumeId]: data.coverLetters[resumeId] }
      : {},
    models: [],
    privacy: { allowExternal: false, route: "local_first" },
  });
}

/** Compare only fields AI acceptance can replace. Reordering / visibility is independent. */
export function blockContent(block: Block): string {
  return JSON.stringify([
    block.title,
    block.subtitle,
    block.start_date,
    block.end_date,
    block.location,
    block.description,
    block.bullets,
    block.skills,
    block.links,
    block.bullet_marks,
  ]);
}

export function blockPatch(block: Block): Partial<Block> {
  return {
    title: block.title,
    subtitle: block.subtitle,
    start_date: block.start_date,
    end_date: block.end_date,
    location: block.location,
    description: block.description,
    bullets: block.bullets,
    skills: block.skills,
    links: block.links,
    bullet_marks: block.bullet_marks,
  };
}
