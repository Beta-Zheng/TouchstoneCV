import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import type {
  AIAction,
  Application,
  Block,
  BulletStyleKey,
  CoverLetter,
  JD,
  ModelProvider,
  Resume,
  ResumeData,
  ResumeSnapshot,
  RouteStrategy,
  Section,
  Suggestion,
} from "../types";
import { nowISO, uid } from "./utils";
import {
  buildResumeSummary,
  generateWithLLM,
  ruleSuggestion,
  selectProvider,
  defaultModels,
} from "./ai";
import {
  blockContent,
  blockPatch,
  parseBackup,
  type BackupData,
} from "./backup";
import { createBufferedStorage, type SaveStatus } from "./storage";
import { parseJD } from "./jd";
import { viewHash } from "./navigation";

export type View =
  | { name: "home" }
  | { name: "editor"; resumeId: string }
  | { name: "models" }
  | { name: "settings" }
  | { name: "applications" };
// The applications page uses the same local state and backup boundary as resumes.

export interface Toast {
  id: string;
  kind: "ok" | "warn" | "err" | "info";
  msg: string;
}

interface PendingExternal {
  resumeId: string;
  sectionId: string;
  blockId: string;
  action: AIAction;
  providerName: string;
  providerHost: string;
  execute: () => void;
}

interface AppState {
  resumes: Resume[];
  jds: Record<string, JD>;
  suggestions: Suggestion[];
  models: ModelProvider[];
  privacy: { allowExternal: boolean; route: RouteStrategy };
  externalCallCount: number;
  snapshots: ResumeSnapshot[];
  applications: Application[];
  coverLetters: Record<string, CoverLetter>;

  view: View;
  toasts: Toast[];
  pendingExternal: PendingExternal | null;
  lastSavedAt: string | null;
  saveStatus: SaveStatus;

  go: (view: View) => void;
  toast: (kind: Toast["kind"], msg: string) => void;
  dismissToast: (id: string) => void;

  createResume: (data: ResumeData, title?: string) => string;
  deleteResume: (id: string) => void;
  duplicateResume: (id: string) => void;
  setResumeOptions: (
    id: string,
    patch: Pick<Partial<Resume>, "locale" | "audience">
  ) => void;
  createJobVersion: (
    id: string,
    company: string,
    role: string,
    jdText: string
  ) => string | null;
  captureSnapshot: (
    id: string,
    label: string,
    kind?: ResumeSnapshot["kind"]
  ) => string | null;
  restoreSnapshot: (id: string) => boolean;
  saveApplication: (application: Application) => void;
  deleteApplication: (id: string) => void;
  saveCoverLetter: (letter: CoverLetter) => void;
  requestSectionSuggestions: (
    resumeId: string,
    sectionId: string,
    action: AIAction,
    blockIds: string[]
  ) => void;
  queuedSuggestionCount: number;
  renameResume: (id: string, title: string) => void;
  setTemplate: (id: string, templateId: string) => void;
  setTheme: (id: string, patch: Partial<Resume["theme"]>) => void;
  setAvatar: (id: string, url: string | null) => void;
  setSchoolBadge: (id: string, url: string | null) => void;

  patchBasic: (
    resumeId: string,
    patch: Partial<ResumeData["basic_info"]>
  ) => void;
  patchBlock: (
    resumeId: string,
    sectionId: string,
    blockId: string,
    patch: Partial<Block>
  ) => void;
  addBlock: (resumeId: string, sectionId: string) => void;
  deleteBlock: (resumeId: string, sectionId: string, blockId: string) => void;
  moveBlock: (
    resumeId: string,
    sectionId: string,
    blockId: string,
    dir: "up" | "down"
  ) => void;
  reorderSections: (resumeId: string, orderedIds: string[]) => void;
  toggleSection: (resumeId: string, sectionId: string) => void;
  renameSection: (resumeId: string, sectionId: string, title: string) => void;
  /** 模块级要点样式；传 null 表示恢复为「跟随全局默认」 */
  setSectionBulletStyle: (
    resumeId: string,
    sectionId: string,
    style: BulletStyleKey | null
  ) => void;
  addSection: (resumeId: string, title: string) => void;
  deleteSection: (resumeId: string, sectionId: string) => void;

  requestSuggestion: (
    resumeId: string,
    sectionId: string,
    blockId: string,
    action: AIAction
  ) => void;
  confirmExternal: (proceed: boolean) => void;
  acceptSuggestion: (sugId: string, edited?: Block) => boolean;
  cancelSuggestion: (sugId: string) => void;
  undoSuggestion: (sugId: string) => boolean;
  rejectSuggestion: (sugId: string) => void;
  clearSuggestions: (resumeId: string) => void;

  setJD: (resumeId: string, jd: JD | null) => void;

  saveModel: (m: ModelProvider) => void;
  deleteModel: (id: string) => void;
  toggleModel: (id: string) => void;
  setPrivacy: (patch: Partial<AppState["privacy"]>) => void;

  importData: (raw: string, mode?: "replace" | "merge") => boolean;
  clearAll: () => void;
}

const BLOCK_TYPE_BY_SECTION: Record<Section["type"], Block["type"]> = {
  basic_info: "custom_text",
  summary: "summary",
  work_experience: "work_experience_item",
  project_experience: "project_experience_item",
  education: "education_item",
  skills: "skill_group",
  certifications: "certification",
  custom: "custom_text",
};

function blankBlock(type: Block["type"], order: number): Block {
  return {
    block_id: uid("blk"),
    type,
    title: "",
    subtitle: "",
    start_date: "",
    end_date: "",
    location: "",
    description: "",
    bullets: [],
    skills: [],
    links: [],
    visible: true,
    order,
  };
}

function withResume(
  state: AppState,
  resumeId: string,
  fn: (r: Resume) => Resume
): Partial<AppState> {
  return {
    resumes: state.resumes.map((r) =>
      r.id === resumeId ? { ...fn(r), updated_at: nowISO() } : r
    ),
  };
}

const requests = new Map<string, AbortController>();
let suggestionQueue: Array<{
  resumeId: string;
  sectionId: string;
  blockId: string;
  action: AIAction;
}> = [];
let queueEpoch = 0;
function advanceSuggestionQueue() {
  const next = suggestionQueue.shift();
  useApp.setState({ queuedSuggestionCount: suggestionQueue.length });
  if (next)
    useApp
      .getState()
      .requestSuggestion(
        next.resumeId,
        next.sectionId,
        next.blockId,
        next.action
      );
}
const persistedSuggestions = new WeakMap<Suggestion[], Suggestion[]>();
const buffered = createBufferedStorage<
  BackupData & { externalCallCount: number }
>(
  () => localStorage,
  (saveStatus) =>
    queueMicrotask(() => {
      useApp.setState({
        saveStatus,
        ...(saveStatus === "saved" ? { lastSavedAt: nowISO() } : {}),
      });
    }),
  800,
  (state) => {
    const data = parseBackup(JSON.stringify(state), defaultModels(), "hydrate");
    const count = state.externalCallCount ?? 0;
    if (!Number.isSafeInteger(count) || count < 0)
      throw new Error("Invalid call count");
    return { ...data, externalCallCount: count };
  }
);
export const flushSave = buffered.flush;
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushSave);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushSave();
  });
}

function mapSection(
  r: Resume,
  sectionId: string,
  fn: (s: Section) => Section
): Resume {
  return {
    ...r,
    data: {
      ...r.data,
      sections: r.data.sections.map((s) =>
        s.section_id === sectionId ? fn(s) : s
      ),
    },
  };
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      resumes: [],
      jds: {},
      suggestions: [],
      models: defaultModels(),
      privacy: { allowExternal: false, route: "local_first" },
      externalCallCount: 0,
      snapshots: [],
      applications: [],
      coverLetters: {},
      queuedSuggestionCount: 0,

      view: { name: "home" },
      toasts: [],
      pendingExternal: null,
      lastSavedAt: null,
      saveStatus: "idle",

      go: (view) => {
        set({ view });
        if (
          typeof window !== "undefined" &&
          window.location.hash !== viewHash(view)
        )
          window.location.hash = viewHash(view);
      },

      toast: (kind, msg) => {
        const id = uid("toast");
        set((s) => ({ toasts: [...s.toasts.slice(-3), { id, kind, msg }] }));
        setTimeout(() => get().dismissToast(id), 4200);
      },
      dismissToast: (id) =>
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      createResume: (data, title) => {
        const id = uid("resume");
        const now = nowISO();
        const resume: Resume = {
          id,
          title: title || data.basic_info.name || "未命名简历",
          data: { ...data, metadata: { ...data.metadata, created_at: now } },
          template_id: "modern_single_column",
          theme: {
            primary_color: "#4F46E5",
            font_size: 14,
            font_family: "sans",
            density: "medium",
            header_layout: "row",
            bullet_style: "diamond",
          },
          created_at: now,
          updated_at: now,
        };
        set((s) => ({ resumes: [resume, ...s.resumes] }));
        return id;
      },

      deleteResume: (id) =>
        set((s) => {
          s.suggestions
            .filter((x) => x.resume_id === id)
            .forEach((x) => {
              requests.get(x.id)?.abort();
              requests.delete(x.id);
            });
          suggestionQueue = [];
          queueEpoch++;
          const jds = { ...s.jds };
          delete jds[id];
          const coverLetters = { ...s.coverLetters };
          delete coverLetters[id];
          return {
            resumes: s.resumes.filter((r) => r.id !== id),
            jds,
            coverLetters,
            snapshots: s.snapshots.filter((x) => x.resume_id !== id),
            applications: s.applications.filter((x) => x.resume_id !== id),
            queuedSuggestionCount: 0,
            suggestions: s.suggestions.filter((x) => x.resume_id !== id),
            view:
              s.view.name === "editor" && s.view.resumeId === id
                ? { name: "home" }
                : s.view,
          };
        }),

      duplicateResume: (id) => {
        const src = get().resumes.find((r) => r.id === id);
        if (!src) return;
        const copy = JSON.parse(JSON.stringify(src)) as Resume;
        copy.id = uid("resume");
        copy.title = `${src.title} 副本`;
        copy.created_at = nowISO();
        copy.updated_at = nowISO();
        const jd = get().jds[id];
        set((s) => ({
          resumes: [copy, ...s.resumes],
          jds: jd
            ? {
                ...s.jds,
                [copy.id]: {
                  ...structuredClone(jd),
                  jd_id: uid("jd"),
                  resume_id: copy.id,
                },
              }
            : s.jds,
        }));
        get().toast("ok", "已复制简历");
      },

      renameResume: (id, title) =>
        set((s) => withResume(s, id, (r) => ({ ...r, title }))),
      setResumeOptions: (id, patch) =>
        set((s) => withResume(s, id, (r) => ({ ...r, ...patch }))),
      createJobVersion: (id, company, role, jdText) => {
        const source = get().resumes.find((r) => r.id === id);
        if (!source || !company.trim() || !role.trim()) return null;
        const copy = structuredClone(source);
        copy.id = uid("resume");
        copy.title = `${company.trim()} · ${role.trim()}`;
        copy.target = {
          company: company.trim(),
          job_title: role.trim(),
          source_resume_id: source.target?.source_resume_id ?? id,
        };
        copy.data.basic_info.title = role.trim();
        copy.created_at = copy.updated_at = nowISO();
        const originalJD = get().jds[id];
        const jd = jdText.trim()
          ? parseJD(jdText, copy.id)
          : originalJD
          ? {
              ...structuredClone(originalJD),
              jd_id: uid("jd"),
              resume_id: copy.id,
            }
          : null;
        set((s) => ({
          resumes: [copy, ...s.resumes],
          jds: jd ? { ...s.jds, [copy.id]: jd } : s.jds,
        }));
        return copy.id;
      },
      captureSnapshot: (id, label, kind = "manual") => {
        const resume = get().resumes.find((r) => r.id === id);
        if (!resume) return null;
        const snapshot: ResumeSnapshot = {
          id: uid("snapshot"),
          resume_id: id,
          label: label.trim() || "版本快照",
          kind,
          created_at: nowISO(),
          resume: structuredClone(resume),
          ...(get().jds[id] ? { jd: structuredClone(get().jds[id]) } : {}),
        };
        set((s) => {
          const linked = new Set(s.applications.map((a) => a.snapshot_id));
          let recent = 0;
          return {
            snapshots: [snapshot, ...s.snapshots].filter(
              (x) => x.resume_id !== id || linked.has(x.id) || ++recent <= 20
            ),
          };
        });
        return snapshot.id;
      },
      restoreSnapshot: (id) => {
        const snapshot = get().snapshots.find((s) => s.id === id);
        if (
          !snapshot ||
          !get().resumes.some((r) => r.id === snapshot.resume_id)
        )
          return false;
        suggestionQueue = [];
        queueEpoch++;
        get().captureSnapshot(snapshot.resume_id, "恢复前自动保存");
        const copy = structuredClone(snapshot.resume);
        copy.updated_at = nowISO();
        const jds = { ...get().jds };
        if (snapshot.jd) jds[copy.id] = structuredClone(snapshot.jd);
        else delete jds[copy.id];
        const ids = get()
          .suggestions.filter(
            (s) => s.resume_id === copy.id && s.status === "generating"
          )
          .map((s) => s.id);
        ids.forEach((id) => get().cancelSuggestion(id));
        set((s) => ({
          resumes: s.resumes.map((r) => (r.id === copy.id ? copy : r)),
          jds,
          pendingExternal: null,
          queuedSuggestionCount: 0,
          suggestions: s.suggestions.filter((s) => s.resume_id !== copy.id),
        }));
        return true;
      },
      saveApplication: (application) =>
        set((s) => ({
          applications: s.applications.some((a) => a.id === application.id)
            ? s.applications.map((a) =>
                a.id === application.id
                  ? { ...application, updated_at: nowISO() }
                  : a
              )
            : [{ ...application, updated_at: nowISO() }, ...s.applications],
        })),
      deleteApplication: (id) =>
        set((s) => ({
          applications: s.applications.filter((a) => a.id !== id),
        })),
      saveCoverLetter: (letter) =>
        set((s) => ({
          coverLetters: {
            ...s.coverLetters,
            [letter.resume_id]: { ...letter, updated_at: nowISO() },
          },
        })),
      setTemplate: (id, templateId) =>
        set((s) =>
          withResume(s, id, (r) => ({ ...r, template_id: templateId }))
        ),
      setTheme: (id, patch) =>
        set((s) =>
          withResume(s, id, (r) => ({ ...r, theme: { ...r.theme, ...patch } }))
        ),
      setAvatar: (id, url) =>
        set((s) =>
          withResume(s, id, (r) => ({
            ...r,
            data: { ...r.data, avatar_url: url ?? "" },
          }))
        ),
      setSchoolBadge: (id, url) =>
        set((s) =>
          withResume(s, id, (r) => ({
            ...r,
            data: { ...r.data, school_badge_url: url ?? "" },
          }))
        ),

      patchBasic: (resumeId, patch) =>
        set((s) =>
          withResume(s, resumeId, (r) => ({
            ...r,
            data: { ...r.data, basic_info: { ...r.data.basic_info, ...patch } },
          }))
        ),

      patchBlock: (resumeId, sectionId, blockId, patch) =>
        set((s) =>
          withResume(s, resumeId, (r) =>
            mapSection(r, sectionId, (sec) => ({
              ...sec,
              blocks: sec.blocks.map((b) =>
                b.block_id === blockId ? { ...b, ...patch } : b
              ),
            }))
          )
        ),

      addBlock: (resumeId, sectionId) =>
        set((s) =>
          withResume(s, resumeId, (r) =>
            mapSection(r, sectionId, (sec) => ({
              ...sec,
              blocks: [
                ...sec.blocks,
                blankBlock(BLOCK_TYPE_BY_SECTION[sec.type], sec.blocks.length),
              ],
            }))
          )
        ),

      deleteBlock: (resumeId, sectionId, blockId) =>
        set((s) =>
          withResume(s, resumeId, (r) =>
            mapSection(r, sectionId, (sec) => ({
              ...sec,
              blocks: sec.blocks
                .filter((b) => b.block_id !== blockId)
                .map((b, i) => ({ ...b, order: i })),
            }))
          )
        ),

      moveBlock: (resumeId, sectionId, blockId, dir) =>
        set((s) =>
          withResume(s, resumeId, (r) =>
            mapSection(r, sectionId, (sec) => {
              const idx = sec.blocks.findIndex((b) => b.block_id === blockId);
              const to = dir === "up" ? idx - 1 : idx + 1;
              if (idx < 0 || to < 0 || to >= sec.blocks.length) return sec;
              const blocks = [...sec.blocks];
              const [item] = blocks.splice(idx, 1);
              blocks.splice(to, 0, item);
              return {
                ...sec,
                blocks: blocks.map((b, i) => ({ ...b, order: i })),
              };
            })
          )
        ),

      reorderSections: (resumeId, orderedIds) =>
        set((s) =>
          withResume(s, resumeId, (r) => {
            const byId = new Map(
              r.data.sections.map((sec) => [sec.section_id, sec])
            );
            const sections = orderedIds.map((id, i) => ({
              ...byId.get(id)!,
              order: i,
            }));
            return { ...r, data: { ...r.data, sections } };
          })
        ),

      toggleSection: (resumeId, sectionId) =>
        set((s) =>
          withResume(s, resumeId, (r) =>
            mapSection(r, sectionId, (sec) => ({
              ...sec,
              visible: !sec.visible,
            }))
          )
        ),

      renameSection: (resumeId, sectionId, title) =>
        set((s) =>
          withResume(s, resumeId, (r) =>
            mapSection(r, sectionId, (sec) => ({ ...sec, title }))
          )
        ),

      setSectionBulletStyle: (resumeId, sectionId, style) =>
        set((s) =>
          withResume(s, resumeId, (r) =>
            mapSection(r, sectionId, (sec) => {
              if (style === null) {
                const next = { ...sec };
                delete next.bullet_style;
                return next;
              }
              return { ...sec, bullet_style: style };
            })
          )
        ),

      addSection: (resumeId, title) =>
        set((s) =>
          withResume(s, resumeId, (r) => ({
            ...r,
            data: {
              ...r.data,
              sections: [
                ...r.data.sections,
                {
                  section_id: uid("sec"),
                  type: "custom" as const,
                  title: title || "自定义模块",
                  visible: true,
                  order: r.data.sections.length,
                  blocks: [blankBlock("custom_text", 0)],
                },
              ],
            },
          }))
        ),

      deleteSection: (resumeId, sectionId) =>
        set((s) =>
          withResume(s, resumeId, (r) => ({
            ...r,
            data: {
              ...r.data,
              sections: r.data.sections
                .filter((x) => x.section_id !== sectionId)
                .map((x, i) => ({ ...x, order: i })),
            },
          }))
        ),

      /* ---------------- AI 建议 ---------------- */

      requestSectionSuggestions: (resumeId, sectionId, action, blockIds) => {
        if (
          get().pendingExternal ||
          requests.size ||
          get().suggestions.some((s) => s.status === "generating")
        ) {
          get().toast("warn", "请等待或取消当前生成，再启动模块优化");
          return;
        }
        const section = get()
          .resumes.find((r) => r.id === resumeId)
          ?.data.sections.find((s) => s.section_id === sectionId);
        const valid = new Set(
          section?.visible
            ? section.blocks.filter((b) => b.visible).map((b) => b.block_id)
            : []
        );
        queueEpoch++;
        suggestionQueue = [...new Set(blockIds)]
          .filter((id) => valid.has(id))
          .map((blockId) => ({ resumeId, sectionId, blockId, action }));
        advanceSuggestionQueue();
      },

      requestSuggestion: (resumeId, sectionId, blockId, action) => {
        const st = get();
        const resume = st.resumes.find((r) => r.id === resumeId);
        const block = resume?.data.sections
          .find((s) => s.section_id === sectionId)
          ?.blocks.find((b) => b.block_id === blockId);
        if (!resume || !block) {
          advanceSuggestionQueue();
          return;
        }

        const sel = selectProvider(st.models, st.privacy);

        const jd = st.jds[resumeId];
        const execute = () => {
          const epoch = queueEpoch;
          const base: Suggestion = {
            id: uid("sug"),
            resume_id: resumeId,
            section_id: sectionId,
            block_id: blockId,
            action,
            engine: sel.kind === "rules" ? "rules" : "llm",
            provider_name:
              sel.kind === "rules" ? "本地规则引擎（兜底）" : sel.provider.name,
            status: "generating",
            original: JSON.parse(JSON.stringify(block)),
            matched_keywords: [],
            warnings: [],
            created_at: nowISO(),
          };
          set((s) => ({ suggestions: [base, ...s.suggestions] }));

          if (sel.kind === "rules") {
            setTimeout(() => {
              const out = ruleSuggestion(
                action,
                block,
                jd?.structured.keywords ?? []
              );
              set((s) => ({
                suggestions: s.suggestions.map((x) =>
                  x.id === base.id && x.status === "generating"
                    ? {
                        ...x,
                        status: "success",
                        suggested: out.suggested_block,
                        explanation: out.explanation,
                        warnings: out.warnings,
                        matched_keywords: out.matched_keywords,
                      }
                    : x
                ),
              }));
              if (epoch === queueEpoch) advanceSuggestionQueue();
            }, 500);
            get().toast("info", "未检测到可用模型，已使用本地规则引擎生成建议");
            return;
          }

          const provider = sel.provider;
          if (provider.type === "external") {
            set((s) => ({ externalCallCount: s.externalCallCount + 1 }));
            let host = "api.openai.com";
            try {
              host = new URL(provider.base_url || "https://api.openai.com")
                .host;
            } catch {
              // base_url 非法时回退到默认值，不抛出未捕获异常
            }
            get().toast(
              "warn",
              `正在使用外部模型「${provider.name}」，内容将发送至 ${host}`
            );
          }
          const resumeSummary = buildResumeSummary(resume.data);
          const jdJson =
            action === "jd_match" && jd
              ? JSON.stringify({
                  job_title: jd.structured.job_title,
                  skills: jd.structured.skills,
                  keywords: jd.structured.keywords,
                  requirements: jd.structured.requirements,
                })
              : jd
              ? JSON.stringify({
                  job_title: jd.structured.job_title,
                  skills: jd.structured.skills,
                })
              : null;

          const controller = new AbortController();
          requests.set(base.id, controller);
          generateWithLLM(
            provider,
            action,
            block,
            resumeSummary,
            jdJson,
            controller.signal
          )
            .then((out) => {
              if (controller.signal.aborted) return;
              set((s) => ({
                suggestions: s.suggestions.map((x) =>
                  x.id === base.id
                    ? {
                        ...x,
                        status: "success",
                        suggested: out.suggested_block,
                        explanation: out.explanation,
                        warnings: out.warnings,
                        matched_keywords: out.matched_keywords,
                      }
                    : x
                ),
              }));
            })
            .catch((e) => {
              if (controller.signal.aborted) return;
              const msg = e instanceof Error ? e.message : "生成失败";
              const isConn =
                e instanceof TypeError ||
                /failed to fetch|aborted|networkerror|load failed/i.test(msg);
              if (isConn) {
                // 模型服务不可达 → 自动降级为本地规则引擎（失败可降级）
                const out = ruleSuggestion(
                  action,
                  block,
                  jd?.structured.keywords ?? []
                );
                set((s) => ({
                  suggestions: s.suggestions.map((x) =>
                    x.id === base.id
                      ? {
                          ...x,
                          status: "success",
                          engine: "rules",
                          provider_name: "本地规则引擎（自动降级）",
                          suggested: out.suggested_block,
                          explanation: out.explanation,
                          matched_keywords: out.matched_keywords,
                          warnings: [
                            `无法连接模型服务（${provider.base_url}），已自动降级为本地规则引擎；可在「模型与隐私」中测试连接或开启外部模型`,
                            ...out.warnings,
                          ],
                        }
                      : x
                  ),
                }));
                get().toast("warn", "模型连接失败，已自动降级为本地规则引擎");
              } else {
                set((s) => ({
                  suggestions: s.suggestions.map((x) =>
                    x.id === base.id
                      ? { ...x, status: "failed", error: msg }
                      : x
                  ),
                }));
                get().toast("err", "AI 生成失败，原内容已保留");
              }
            })
            .finally(() => {
              requests.delete(base.id);
              if (epoch === queueEpoch) advanceSuggestionQueue();
            });
        };
        if (sel.kind === "confirm_external") {
          let providerHost: string;
          try {
            providerHost = new URL(sel.provider.base_url).host;
          } catch {
            suggestionQueue = [];
            queueEpoch++;
            set({ queuedSuggestionCount: 0 });
            get().toast("err", "模型服务地址无效，请检查配置");
            return;
          }
          set({
            pendingExternal: {
              resumeId,
              sectionId,
              blockId,
              action,
              providerName: sel.provider.name,
              providerHost,
              execute: () => {
                const current = get();
                const selected = selectProvider(
                  current.models,
                  current.privacy
                );
                if (
                  selected.kind !== "confirm_external" ||
                  JSON.stringify(selected.provider) !==
                    JSON.stringify(sel.provider) ||
                  current.resumes.find((r) => r.id === resumeId)?.data !==
                    resume.data ||
                  current.jds[resumeId] !== jd
                ) {
                  get().toast(
                    "warn",
                    "内容、模型或隐私设置已变化，请重新发起 AI 请求"
                  );
                  suggestionQueue = [];
                  queueEpoch++;
                  set({ queuedSuggestionCount: 0 });
                  return;
                }
                execute();
              },
            },
          });
          return;
        }
        execute();
      },

      confirmExternal: (proceed) => {
        const pending = get().pendingExternal;
        set({ pendingExternal: null });
        if (!pending) return;
        if (proceed) {
          pending.execute();
        } else {
          suggestionQueue = [];
          queueEpoch++;
          set({ queuedSuggestionCount: 0 });
          get().toast("info", "已取消外部调用，原内容保持不变");
        }
      },

      acceptSuggestion: (sugId, edited) => {
        const sug = get().suggestions.find((x) => x.id === sugId);
        if (
          !sug ||
          !sug.suggested ||
          sug.status !== "success" ||
          sug.resolution
        )
          return false;
        const current = get()
          .resumes.find((r) => r.id === sug.resume_id)
          ?.data.sections.find((s) => s.section_id === sug.section_id)
          ?.blocks.find((b) => b.block_id === sug.block_id);
        if (!current || blockContent(current) !== blockContent(sug.original)) {
          get().toast(
            "warn",
            "条目已修改或删除，旧建议未应用；请基于当前内容重新生成"
          );
          return false;
        }
        const content = edited ?? sug.suggested;
        const applied = {
          ...current,
          ...blockPatch(content),
          bullet_marks: undefined,
        };
        set((s) => ({
          ...withResume(s, sug.resume_id, (r) =>
            mapSection(r, sug.section_id, (sec) => ({
              ...sec,
              blocks: sec.blocks.map((b) =>
                b.block_id === sug.block_id ? applied : b
              ),
            }))
          ),
          suggestions: s.suggestions.map((x) =>
            x.id === sugId
              ? {
                  ...x,
                  applied,
                  resolution: edited ? "edited_accepted" : "accepted",
                }
              : x
          ),
        }));
        get().toast("ok", edited ? "已应用编辑后的建议" : "已应用 AI 建议");
        return true;
      },

      cancelSuggestion: (sugId) => {
        suggestionQueue = [];
        queueEpoch++;
        set({ queuedSuggestionCount: 0 });
        requests.get(sugId)?.abort();
        requests.delete(sugId);
        set((s) => ({
          suggestions: s.suggestions.map((x) =>
            x.id === sugId && x.status === "generating"
              ? { ...x, status: "failed", error: "已取消生成" }
              : x
          ),
        }));
      },

      undoSuggestion: (sugId) => {
        const sug = get().suggestions.find((x) => x.id === sugId);
        if (
          !sug?.applied ||
          !["accepted", "edited_accepted"].includes(sug.resolution ?? "")
        )
          return false;
        const current = get()
          .resumes.find((r) => r.id === sug.resume_id)
          ?.data.sections.find((s) => s.section_id === sug.section_id)
          ?.blocks.find((b) => b.block_id === sug.block_id);
        if (!current || blockContent(current) !== blockContent(sug.applied)) {
          get().toast("warn", "条目已继续修改，撤销未执行，避免覆盖新内容");
          return false;
        }
        get().patchBlock(
          sug.resume_id,
          sug.section_id,
          sug.block_id,
          blockPatch(sug.original)
        );
        set((s) => ({
          suggestions: s.suggestions.map((x) =>
            x.id === sugId
              ? { ...x, applied: undefined, resolution: undefined }
              : x
          ),
        }));
        get().toast("ok", "已撤销 AI 建议，恢复接受前的内容");
        return true;
      },

      rejectSuggestion: (sugId) => {
        set((s) => ({
          suggestions: s.suggestions.map((x) =>
            x.id === sugId ? { ...x, resolution: "rejected" } : x
          ),
        }));
        get().toast("info", "已拒绝建议，原内容保持不变");
      },

      clearSuggestions: (resumeId) =>
        set((s) => ({
          suggestions: s.suggestions.filter((x) => x.resume_id !== resumeId),
        })),

      setJD: (resumeId, jd) =>
        set((s) => {
          const jds = { ...s.jds };
          if (jd) jds[resumeId] = jd;
          else delete jds[resumeId];
          return { jds };
        }),

      saveModel: (m) =>
        set((s) => {
          const exists = s.models.some((x) => x.id === m.id);
          return {
            models: exists
              ? s.models.map((x) => (x.id === m.id ? m : x))
              : [...s.models, m],
          };
        }),
      deleteModel: (id) =>
        set((s) => ({ models: s.models.filter((m) => m.id !== id) })),
      toggleModel: (id) =>
        set((s) => ({
          models: s.models.map((m) =>
            m.id === id ? { ...m, enabled: !m.enabled } : m
          ),
        })),
      setPrivacy: (patch) =>
        set((s) => ({ privacy: { ...s.privacy, ...patch } })),

      importData: (raw, mode = "replace") => {
        try {
          const data = parseBackup(raw, get().models);
          buffered.allowRecovery();
          suggestionQueue = [];
          queueEpoch++;
          get()
            .suggestions.filter((s) => s.status === "generating")
            .forEach((s) => get().cancelSuggestion(s.id));
          requests.forEach((controller) => controller.abort());
          requests.clear();
          if (mode === "merge") {
            const resumeIds = new Map(
              data.resumes.map((r) => [r.id, uid("resume")])
            );
            const snapshotIds = new Map(
              (data.snapshots ?? []).map((s) => [s.id, uid("snapshot")])
            );
            const remapResume = (r: Resume): Resume => ({
              ...r,
              id: resumeIds.get(r.id)!,
              target: r.target
                ? {
                    ...r.target,
                    source_resume_id: r.target.source_resume_id
                      ? resumeIds.get(r.target.source_resume_id)
                      : undefined,
                  }
                : undefined,
            });
            set((s) => ({
              resumes: [...data.resumes.map(remapResume), ...s.resumes],
              jds: {
                ...s.jds,
                ...Object.fromEntries(
                  Object.entries(data.jds).map(([id, jd]) => [
                    resumeIds.get(id)!,
                    { ...jd, jd_id: uid("jd"), resume_id: resumeIds.get(id)! },
                  ])
                ),
              },
              suggestions: [
                ...data.suggestions.map((x) => ({
                  ...x,
                  id: uid("sug"),
                  resume_id: resumeIds.get(x.resume_id)!,
                })),
                ...s.suggestions,
              ],
              snapshots: [
                ...(data.snapshots ?? []).map((x) => ({
                  ...x,
                  id: snapshotIds.get(x.id)!,
                  resume_id: resumeIds.get(x.resume_id)!,
                  resume: remapResume(x.resume),
                  jd: x.jd
                    ? { ...x.jd, resume_id: resumeIds.get(x.resume_id)! }
                    : undefined,
                })),
                ...s.snapshots,
              ],
              applications: [
                ...(data.applications ?? []).map((x) => ({
                  ...x,
                  id: uid("application"),
                  resume_id: resumeIds.get(x.resume_id)!,
                  snapshot_id: x.snapshot_id
                    ? snapshotIds.get(x.snapshot_id)
                    : undefined,
                })),
                ...s.applications,
              ],
              coverLetters: {
                ...s.coverLetters,
                ...Object.fromEntries(
                  Object.entries(data.coverLetters ?? {}).map(
                    ([id, letter]) => [
                      resumeIds.get(id)!,
                      { ...letter, resume_id: resumeIds.get(id)! },
                    ]
                  )
                ),
              },
              pendingExternal: null,
              queuedSuggestionCount: 0,
            }));
          } else
            set({
              ...data,
              snapshots: data.snapshots ?? [],
              applications: data.applications ?? [],
              coverLetters: data.coverLetters ?? {},
              pendingExternal: null,
              queuedSuggestionCount: 0,
              view: { name: "home" },
            });
          get().toast("ok", `已恢复 ${data.resumes.length} 份简历`);
          return true;
        } catch {
          return false;
        }
      },

      clearAll: () => {
        suggestionQueue = [];
        queueEpoch++;
        buffered.allowRecovery();
        requests.forEach((controller) => controller.abort());
        requests.clear();
        set({
          resumes: [],
          jds: {},
          suggestions: [],
          models: defaultModels(),
          privacy: { allowExternal: false, route: "local_first" },
          externalCallCount: 0,
          snapshots: [],
          applications: [],
          coverLetters: {},
          queuedSuggestionCount: 0,
          view: { name: "home" },
          lastSavedAt: null,
          pendingExternal: null,
        });
        flushSave();
      },
    }),
    {
      name: "ai-resume-workbench-v1",
      storage: buffered.storage,
      partialize: (s) => {
        let suggestions = persistedSuggestions.get(s.suggestions);
        if (!suggestions) {
          suggestions = s.suggestions.filter((x) => x.status !== "generating");
          persistedSuggestions.set(s.suggestions, suggestions);
        }
        return {
          resumes: s.resumes,
          jds: s.jds,
          suggestions,
          models: s.models,
          privacy: s.privacy,
          externalCallCount: s.externalCallCount,
          snapshots: s.snapshots,
          applications: s.applications,
          coverLetters: s.coverLetters,
        };
      },
    }
  )
);

/** Subscribe only to fields this component uses. */
export function useAppSlice<K extends keyof AppState>(
  ...keys: K[]
): Pick<AppState, K> {
  return useApp(
    useShallow(
      (state) =>
        Object.fromEntries(keys.map((key) => [key, state[key]])) as Pick<
          AppState,
          K
        >
    )
  );
}

/** 便捷选择器 */
export function useResume(id: string | undefined) {
  return useApp((s) => s.resumes.find((r) => r.id === id));
}
