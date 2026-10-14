/* ------------------------------------------------------------------
 * 模板渲染器：Resume JSON + Template = Rendered Resume
 * 规则：先按 section.order 排序 → block.order 排序 → 过滤 visible=false
 * 现代单栏 / 经典 ATS 共用一套条目与模块渲染（EntryBody / SectionBlock），
 * 仅通过 TStyle 风格参数区分视觉，避免两份代码分叉导致字段遗漏（如 location）。
 * ------------------------------------------------------------------ */
import { Fragment, type CSSProperties, type ReactNode } from "react";
import type { Block, Resume, Section, SectionType, HeaderLayoutKey, BulletStyleKey } from "../types";
import { cx, fontStack, densityVars, isRichHtml, resolveBulletStyle, sanitizeInline, bulletPairs, stripHtml } from "../lib/utils";
import { localizedResume } from "../lib/workflow";
import { IconArrowRight, IconAward, IconBriefcase, IconCheck, IconFolderGit, IconGraduationCap, IconLayers, IconUser, IconWrench } from "./icons";

function orderedVisible(data: Resume["data"]): Section[] {
  return [...data.sections].filter((s) => s.visible).sort((a, b) => a.order - b.order);
}

function visibleBlocks(s: Section): Block[] {
  return [...s.blocks].filter((b) => b.visible).sort((a, b) => a.order - b.order);
}

function dateRange(b: Block): string {
  if (!b.start_date && !b.end_date) return "";
  const s = b.start_date || "";
  const e = b.end_date || "";
  if (s && e) return `${s} – ${e}`;
  return s || e; // 仅 start 或仅 end 时直接返回，避免前导 " – " 横线
}

/** 条目副标题全部段：subtitle 为首段（历史字段），subtitles 为追加段，空段过滤 */
function subtitleParts(b: Block): string[] {
  return [b.subtitle, ...(b.subtitles ?? [])].filter(Boolean);
}

/** 联系方式项：固定四项 + 自定义信息项（label：value），自定义项两者都有内容才显示 */
function contactItems(info: Resume["data"]["basic_info"]): string[] {
  const base = [info.email, info.phone, info.location, info.website].filter(Boolean);
  const extra = (info.custom_fields ?? [])
    .map((f) => [f.label?.trim(), f.value?.trim()].filter(Boolean).join("："))
    .filter(Boolean);
  return [...base, ...extra];
}

/** 头像盒子尺寸：1 寸照基准（w×h px）× avatar_scale（钳制 0.5–2） */
function avatarBox(scale: number | undefined, w: number, h: number): CSSProperties {
  const s = Math.min(2, Math.max(0.5, scale ?? 1));
  return { width: `${Math.round(w * s)}px`, height: `${Math.round(h * s)}px` };
}

/** 标题后副标题串（历史 subtitle 首段 + 追加段），段间一律以 · 分隔 */
function SubTitles({ block, className }: { block: Block; className?: string }) {
  const parts = subtitleParts(block);
  if (parts.length === 0) return null;
  return (
    <span className={className}>
      {parts.map((p, i) => (
        <span key={i}>
          <span className="mx-1.5 text-ink-300" aria-hidden="true">
            ·
          </span>
          {renderRich(p)}
        </span>
      ))}
    </span>
  );
}

/**
 * 各模块语义图标：教育=学士帽、工作=公文包、项目=代码分支、证书=奖章、
 * 技能=扳手、总结=人像、自定义=图层。
 * 未覆盖的模块类型会回退为一个小圆点，因此新增 SectionType 时应同步补这里。
 *
 * 选图原则：优先「小尺寸可辨识」。徽章内图标实际只有 0.68em（约 11px），
 * 细节多的图形（如书本翻页、引号弯钩）缩到这个尺寸会糊成一团，
 * 所以 summary 选人像而非书本 —— 后者还与 education 的学士帽语义重叠。
 */
type SectionIconProps = { size?: number; className?: string; style?: CSSProperties };
const SECTION_ICON: Partial<Record<SectionType, (props: SectionIconProps) => ReactNode>> = {
  education: IconGraduationCap,
  work_experience: IconBriefcase,
  project_experience: IconFolderGit,
  certifications: IconAward,
  skills: IconWrench,
  summary: IconUser,
  custom: IconLayers,
};

/** 行内富文本渲染：已是 HTML 则经白名单消毒后渲染，否则把 **关键词** 渲染为加粗 */
function InlineHtml({ html }: { html: string }) {
  return <span dangerouslySetInnerHTML={{ __html: sanitizeInline(html) }} />;
}
function renderRich(text: string): ReactNode {
  if (!text) return null;
  // 末尾夹带的换行/空格不渲染（用户输入/粘贴常带回车尾巴，会在简历上多出空行）
  const trimmed = text.replace(/[\s\u00a0]+$/, "");
  if (isRichHtml(trimmed)) return <InlineHtml html={trimmed} />;
  const segs = trimmed.split("**");
  return segs.map((seg, i) => {
    if (i % 2 === 1 && seg.length > 0) return <strong key={i}>{seg}</strong>;
    // 纯文本值中的换行符渲染为 <br>（contentEditable 存储与纯文本数据统一处理）
    const lines = seg.split(/\r?\n/);
    return (
      <span key={i}>
        {lines.map((ln, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {ln}
          </Fragment>
        ))}
      </span>
    );
  });
}

interface TStyle {
  color: string;
  isATS: boolean;
  bullet: "disc" | "diamond";
  bulletStyle: BulletStyleKey;
  skill: "text" | "chip";
  showLocation: boolean;
  headerLayout: HeaderLayoutKey;
}

/** 根据 bullet_style 渲染一条要点；marks[i]=false 的条目不渲染符号（无占位），
 *  有序样式序号只数勾选条目（不留空洞）。 */
function BulletList({
  bullets,
  marks,
  bulletStyle,
  color,
  isATS,
}: {
  bullets: string[];
  marks?: boolean[];
  bulletStyle: BulletStyleKey;
  color: string;
  isATS?: boolean;
}) {
  const pairs = bulletPairs(bullets, marks);
  let seq = 0;
  const renderItem = ({ text, marked }: { text: string; marked: boolean }) => {
    const num = marked ? ++seq : 0;
    return (
      <li key={num > 0 ? `m${num}` : `u${num}-${text}`} className="flex gap-[0.6em] break-inside-avoid text-[0.92em]" style={{ color: isATS ? "#222" : "#2b3a36" }}>
        {marked && (
          <span className={cx("shrink-0 leading-none", bulletStyle === "ordered" ? "mt-[0.15em]" : "mt-[0.52em]")}>
            {bulletStyle === "ordered" ? (
              <span className="inline-block min-w-[1.35em] text-right font-mono text-[0.86em] font-bold tabular-nums" style={{ color: isATS ? "#111" : color }}>
                {num}.
              </span>
            ) : bulletStyle === "disc" ? (
              <span className="block h-[5px] w-[5px] rounded-full" style={{ background: isATS ? "#111" : color }} />
            ) : bulletStyle === "arrow" ? (
              <IconArrowRight size={11} style={{ color: isATS ? "#111" : color }} />
            ) : bulletStyle === "square" ? (
              <span className="block h-[5px] w-[5px]" style={{ background: isATS ? "#111" : color }} />
            ) : bulletStyle === "check" ? (
              <IconCheck size={11} style={{ color: isATS ? "#111" : color }} />
            ) : bulletStyle === "circle" ? (
              <span className="block h-[6px] w-[6px] rounded-full border-[1.5px]" style={{ borderColor: isATS ? "#111" : color }} />
            ) : (
              <span className="block h-[5px] w-[5px] rotate-45" style={{ background: isATS ? "#111" : color }} />
            )}
          </span>
        )}
        <span className="flex-1">{renderRich(text)}</span>
      </li>
    );
  };

  const cls = "mt-[var(--entry-gap)] flex list-none flex-col gap-[var(--bullet-gap)] pl-0";
  if (bulletStyle === "ordered") {
    return <ol className={cls}>{pairs.map((p) => renderItem(p))}</ol>;
  }
  return <ul className={cls}>{pairs.map((p) => renderItem(p))}</ul>;
}

function EntryBody({ block, style }: { block: Block; style: TStyle }) {
  const { color, isATS, skill, showLocation, headerLayout, bulletStyle } = style;
  const bullets = block.bullets.filter(Boolean);
  const hasContent =
    block.title || block.subtitle || block.subtitles?.length || block.description || bullets.length > 0 || block.skills.length > 0 || (showLocation && block.location);
  if (!hasContent) return null;
  return (
    <div data-resume-entry={block.block_id} className="mb-[var(--entry-gap)] break-inside-avoid">
      {(block.title || subtitleParts(block).length > 0) &&
        (headerLayout === "stack" ? (
          <p className="text-[1em] font-bold text-ink-900">
            {renderRich(block.title)}
            <SubTitles block={block} className="ml-1.5 font-normal text-ink-500" />
          </p>
        ) : (
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[1.02em] font-bold leading-snug text-ink-900">
              {renderRich(block.title)}
              <SubTitles block={block} className="font-normal text-ink-500" />
            </p>
            {dateRange(block) && (
              <p className="shrink-0 text-[0.82em] font-medium tabular-nums" style={{ color: isATS ? "#222" : "#64716c" }}>
                {dateRange(block)}
              </p>
            )}
          </div>
        ))}
      {showLocation && block.location && headerLayout !== "stack" && (
        <p className={cx("text-[0.82em]", !isATS && "text-ink-400")} style={isATS ? { color: "#333" } : undefined}>
          {block.location}
        </p>
      )}
      {headerLayout === "stack" && (dateRange(block) || (showLocation && block.location)) && (
        <p className="mt-0.5 text-[0.8em] text-ink-400">
          {dateRange(block)}
          {showLocation && block.location && <span className="ml-2">{block.location}</span>}
        </p>
      )}
      {block.description && (
        <p className={cx("mt-[var(--entry-gap)] whitespace-pre-line text-[0.92em] leading-relaxed", isATS ? "text-[#222]" : "text-ink-700")}>{renderRich(block.description)}</p>
      )}
      {bullets.length > 0 && <BulletList bullets={bullets} marks={block.bullet_marks} bulletStyle={bulletStyle} color={color} isATS={isATS} />}
      {block.skills.length > 0 &&
        (skill === "text" ? (
          <p className="mt-[var(--entry-gap)] text-[0.9em]" style={{ color: isATS ? "#333" : undefined }}>
            {block.skills.join("  ·  ")}
          </p>
        ) : (
          <div className="mt-[var(--entry-gap)] flex flex-wrap gap-1">
            {block.skills.map((sk) => (
              <span
                key={sk}
                className="rounded-[3px] px-1.5 py-[0.12em] text-[0.78em] font-medium"
                style={{ background: `${color}17`, color, boxShadow: `inset 0 0 0 1px ${color}30` }}
              >
                {sk}
              </span>
            ))}
          </div>
        ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 模块标题的视觉元素：图标徽章 + 羽化分隔带
 * ------------------------------------------------------------------ */

/** ATS 模板实线宽度；预览可自适应缩放，打印保持原始尺寸。 */
const RULE_PX_SOLID = 2.4;

/**
 * 模块标题右侧的分隔带。上一版是「3px 高、上下硬边、横向渐隐」的色块，
 * 横贯整栏，视觉重量压过了正文，被反馈「笨重、抢重点」。这一版改两处：
 *
 * 三个参数是一组，改任一个都要回头核对另两个：
 *
 * 1. 几何高度 5px（上一版 2.6px）。相位差的相对冲击 = 1 / 跨越行数：
 *    2.6px 只跨 3～4 行（差 33%），5px 跨 5～6 行（差 17%），
 *    且缩放后 4.25px 远大于 2px 下限，冗余充足。
 *
 * 2. 实心核占高度 40%（30%～70%），上一版只有 16%（42%～58%，约 0.42px）。
 *    这是上一版真正的失误：几乎不存在满覆盖区间，整条带的厚度感知完全由
 *    上下两段斜坡决定，而斜坡墨量低，边缘那一行在「可见 / 不可见」之间跳变，
 *    比硬边的抖动更难收敛 —— 柔化做过了头，反而把不确定性从边缘扩大到整条。
 *    现在有 2px 的实心核（×0.85 = 1.7px）锚定厚度，斜坡只负责柔化边界。
 *
 * 3. 峰值不透明度 15%（上一版 33%），高度翻了近一倍，靠压峰值把墨量拉回来：
 *    单位宽度墨量 = 5 × 0.15 × 0.7 ≈ 0.53，与上一版（2.6 × 0.33 × 0.58 ≈ 0.50）
 *    基本持平 —— 观感不变更重，但相位稳定性显著提升。

 * 横向消隐继续用 mask 而非叠加第二层渐变：底色是白纸，叠加白色渐变会写死
 * 背景色。mask 在 Chromium 的打印管线里可用；万一失效，退化结果是
 * 「等宽的柔化色带」，观感可接受，不会破版。
 */
/**
 * 模块标题右侧的延伸分隔线。设计原则：
 *   「粗细 / 深浅不随模块字数变动，视觉淡淡，不抢戏」
 *
 * 实现：1px 高的均匀横线，颜色 = color + 14（≈ 8% 不透明度），不渐隐、不柔化。
 *
 * 为什么这样能同时解决「粗细不一致」与「深浅不一致」：
 *
 * 1. 与字数解耦：均匀填色（不渐隐），宽度任意时单位长度墨量相同。
 *    上一版 mask 渐隐（40px 实 + 168px 渐隐）虽然头部形态固定，但尾部
 *    「剩余长短」仍让短线 vs 长线在视觉上不等价 —— 用户看到的就是这个。
 *
 * 2. 相位差不可辨：1px × 0.85 = 0.85px，跨 1 行（满覆盖）或跨 2 行（各 0.42px）。
 *    相位翻转理论上让 8% 灰变成 4% + 4% 的双行。但：
 *      - 8% 灰已接近背景白，对比度 ≈ 0.92（白对 8% 黑）
 *      - 韦伯定律下低强度区可辨阈值 ≈ ±5%，亚像素抖动最多 ±1%，远低于阈值
 *      - 即「深色线抖动明显、低色线抖动不可辨」是同一原理的两端
 *    所以低对比度是相位差的天然解耦器 —— 不用几何高度硬扛。
 *
 * 3. 不抢戏：单位墨量 0.85 × 8% = 0.068，是上一版（≈ 0.53）的 1/8。
 *
 * 放弃上一版的几何高度策略：纵然 5px + 15% 峰值能稳，但 5px 在视觉上
 * 仍是「一条色带」，且渐隐让线长受字数影响。1px + 8% 是更纯粹的极简解。
 */
function SectionRule({ color }: { color: string }) {
  return <span className="flex-1 self-center" style={{ height: 1, background: `${color}14` }} />;
}

/**
 * 模块标题的图标徽章。两个非 ATS 模板共用结构（保证切换模板时观感不跳变），
 * 用形状区分调性：现代单栏=圆角方块（干练），学术双栏=圆形（柔和）。
 * 尺寸全部走 em，随字号与密度联动；图标固定 0.68em（约占徽章 54%，
 * 落在 50%～60% 的舒适区，比原先写死 12px 在大字号下偏小的问题更稳）。
 */
function SectionBadge({ section, color, shape }: { section: Section; color: string; shape: "squircle" | "circle" }) {
  const Icon = SECTION_ICON[section.type];
  return (
    <span
      className="flex h-[1.25em] w-[1.25em] shrink-0 items-center justify-center"
      style={{ background: color, borderRadius: shape === "circle" ? "9999px" : "0.3em" }}
    >
      {Icon ? (
        <Icon className="h-[0.68em] w-[0.68em] text-white" />
      ) : (
        <span className="h-[0.3em] w-[0.3em] rounded-full bg-white" />
      )}
    </span>
  );
}

function SectionBlock({ section, style }: { section: Section; style: TStyle }) {
  const blocks = visibleBlocks(section);
  if (section.type === "summary" && !blocks.some((b) => b.description || b.bullets.some(Boolean))) return null;
  if (blocks.length === 0 && section.type !== "summary") return null;
  const { color, isATS } = style;
  // 模块级要点样式优先，未设置时继承全局默认
  const secStyle: TStyle = { ...style, bulletStyle: resolveBulletStyle(section.bullet_style, style.bulletStyle) };
  return (
    <section data-resume-section={section.section_id} className="mb-[var(--sec-gap)]">
      <h2
        className={cx("mb-[var(--head-gap)] text-[1.12em] font-bold", !isATS && "flex items-center gap-[0.5em]")}
        style={
          isATS
            ? { borderBottom: `${RULE_PX_SOLID}px solid #111`, paddingBottom: "0.26em", color: "#111", textTransform: "uppercase", letterSpacing: "0.08em", breakAfter: "avoid" }
            : { color, letterSpacing: "0.02em", breakAfter: "avoid" }
        }
      >
        {!isATS && <SectionBadge section={section} color={color} shape="squircle" />}
        {section.title}
        {!isATS && <SectionRule color={color} />}
      </h2>
      {blocks.map((b) => (
        <EntryBody key={b.block_id} block={b} style={secStyle} />
      ))}
    </section>
  );
}

function AcademicSectionBlock({ section, color, headerLayout, bulletStyle }: { section: Section; color: string; headerLayout: HeaderLayoutKey; bulletStyle: BulletStyleKey }) {
  const blocks = visibleBlocks(section);
  if (section.type === "summary" && !blocks.some((b) => b.description || b.bullets.some(Boolean))) return null;
  if (blocks.length === 0 && section.type !== "summary") return null;
  // 模块级要点样式优先，未设置时继承全局默认
  const bs = resolveBulletStyle(section.bullet_style, bulletStyle);
  return (
    <section data-resume-section={section.section_id} className="mb-[var(--sec-gap)]">
      <h2 className="mb-[var(--head-gap)] flex items-center gap-[0.5em] text-[1.12em] font-bold" style={{ color, letterSpacing: "0.02em", breakAfter: "avoid" }}>
        <SectionBadge section={section} color={color} shape="circle" />
        {section.title}
        <SectionRule color={color} />
      </h2>
      {blocks.map((b) => (
        <div key={b.block_id} data-resume-entry={b.block_id} className="mb-[var(--entry-gap)] break-inside-avoid">
          {(b.title || subtitleParts(b).length > 0) &&
            (headerLayout === "stack" ? (
              <p className="text-[1em] font-bold text-ink-900">
                {renderRich(b.title)}
                <SubTitles block={b} className="ml-1.5 font-normal text-ink-500" />
              </p>
            ) : (
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[1.02em] font-bold leading-snug text-ink-900">
                  {renderRich(b.title)}
                  <SubTitles block={b} className="font-normal text-ink-500" />
                </p>
                <div className="shrink-0 text-right text-[0.82em] font-medium tabular-nums" style={{ color: "#64716c" }}>
                  {dateRange(b) && <span>{dateRange(b)}</span>}
                  {b.location && <span className="ml-2 text-ink-400">{b.location}</span>}
                </div>
              </div>
            ))}
          {headerLayout === "stack" && (dateRange(b) || b.location) && (
            <p className="mt-0.5 text-[0.8em] text-ink-400">
              {dateRange(b)}
              {b.location && <span className="ml-2">{b.location}</span>}
            </p>
          )}
          {b.description && (
            <p className="mt-[var(--entry-gap)] whitespace-pre-line text-[0.92em] leading-relaxed text-ink-700">{renderRich(b.description)}</p>
          )}
          {b.bullets.filter(Boolean).length > 0 && <BulletList bullets={b.bullets.filter(Boolean)} marks={b.bullet_marks} bulletStyle={bs} color={color} />}
          {b.skills.length > 0 && (
            <div className="mt-[var(--entry-gap)] flex flex-wrap gap-1">
              {b.skills.map((sk) => (
                <span
                  key={sk}
                  className="rounded-[3px] px-1.5 py-[0.12em] text-[0.78em] font-medium"
                  style={{ background: `${color}17`, color, boxShadow: `inset 0 0 0 1px ${color}30` }}
                >
                  {sk}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

function AcademicPhotoSheet({ resume, forPrint }: { resume: Resume; forPrint?: boolean }) {
  const color = resume.theme.primary_color;
  const fs = resume.theme.font_size;
  const info = resume.data.basic_info;
  const contacts = contactItems(info);
  const basicSection = resume.data.sections.find((s) => s.type === "basic_info");
  const basicVisible = basicSection?.visible ?? true;
  const bodySections = orderedVisible(resume.data).filter((s) => s.type !== "basic_info");
  const headerLayout = resume.theme.header_layout ?? "row";

  return (
    <div
      className={cx("resume-sheet bg-white", !forPrint && "shadow-xl shadow-ink-950/15")}
      style={{ fontSize: `${fs}px`, lineHeight: "var(--lh)", fontFamily: fontStack(resume.theme.font_family), color: "#222", ...densityVars(resume.theme.density) }}
    >
      {basicVisible && (
        <header className="mb-[var(--sec-gap)] flex items-center gap-5">
          {/* 头像：矩形无边框，基准约 1 寸（25×35mm）照片比例，尺寸随 theme.avatar_scale 缩放；缺省时不占位 */}
          {resume.data.avatar_url && (
            <div className="shrink-0 overflow-hidden rounded-sm bg-paper-100" style={avatarBox(resume.theme.avatar_scale, 90, 126)}>
              <img src={resume.data.avatar_url} alt="头像" className="h-full w-full object-cover" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="font-[700] leading-tight" style={{ fontSize: "2.2em", color: "#101817", letterSpacing: "-0.01em" }}>
              {renderRich(info.name || "未命名")}
            </h1>
            {info.title && (
              <p className="mt-1 font-medium" style={{ color }}>
                {renderRich(info.title)}
              </p>
            )}
            {contacts.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-y-1 text-[0.85em] text-ink-500">
                {contacts.map((c, idx) => (
                  <span key={c} className="inline-flex items-center">
                    <span>{renderRich(c)}</span>
                    {idx < contacts.length - 1 && <span className="mx-3 text-ink-300" aria-hidden="true">|</span>}
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* 校徽：圆形无边框，比例合理；缺省时不占位 */}
          {resume.data.school_badge_url && (
            <div className="flex h-[76px] w-[76px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-white">
              <img src={resume.data.school_badge_url} alt="校徽" className="h-full w-full object-contain" />
            </div>
          )}
        </header>
      )}
      <main>
        {bodySections.map((s) => (
          <AcademicSectionBlock key={s.section_id} section={s} color={color} headerLayout={headerLayout} bulletStyle={resume.theme.bullet_style ?? "diamond"} />
        ))}
      </main>
    </div>
  );
}

export function ResumeSheet({ resume, forPrint }: { resume: Resume; forPrint?: boolean }) {
  if (resume.template_id === "academic_photo") {
    return <AcademicPhotoSheet resume={resume} forPrint={forPrint} />;
  }

  const isATS = resume.template_id === "classic_ats";
  const color = isATS ? "#111111" : resume.theme.primary_color;
  const fs = resume.theme.font_size;

  // 基本信息模块：visible=false 时整个 header（姓名/职位/联系）不渲染，语义一致
  const basicSection = resume.data.sections.find((s) => s.type === "basic_info");
  const basicVisible = basicSection?.visible ?? true;
  const info = resume.data.basic_info;
  const contacts = contactItems(info);

  const style: TStyle = isATS
    ? { color: "#111111", isATS: true, bullet: "disc", bulletStyle: resume.theme.bullet_style ?? "disc", skill: "text", showLocation: true, headerLayout: resume.theme.header_layout ?? "row" }
    : { color, isATS: false, bullet: "diamond", bulletStyle: resume.theme.bullet_style ?? "diamond", skill: "chip", showLocation: true, headerLayout: resume.theme.header_layout ?? "row" };

  const bodySections = orderedVisible(resume.data).filter((s) => s.type !== "basic_info");

  const headerEl =
    basicVisible && (info.name || info.title || contacts.length > 0) ? (
      isATS ? (
        <header className="mb-[var(--sec-gap)] text-center">
          <h1 className="text-[2.1em] font-bold leading-tight tracking-wide">{renderRich(info.name || "未命名")}</h1>
          {info.title && <p className="mt-0.5 text-[1.05em] font-medium">{renderRich(info.title)}</p>}
          {contacts.length > 0 && (
            <p className="mt-2 flex flex-wrap items-center justify-center gap-y-1 text-[0.85em] text-[#333]">
              {contacts.map((c, idx) => (
                <span key={c} className="inline-flex items-center">
                  <span>{renderRich(c)}</span>
                  {idx < contacts.length - 1 && <span className="mx-3 text-ink-300" aria-hidden="true">|</span>}
                </span>
              ))}
            </p>
          )}
        </header>
      ) : (
        <header className="mb-[var(--sec-gap)]">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="font-[700] leading-tight" style={{ fontSize: "2.3em", color: "#101817", letterSpacing: "-0.01em" }}>
                {renderRich(info.name || "未命名")}
              </h1>
              {info.title && (
                <p className="mt-1 text-[1.1em] font-medium" style={{ color }}>
                  {renderRich(info.title)}
                </p>
              )}
            </div>
            {/* 单栏模板不放照片，统一用姓名首字母色块保持右上角视觉锚点（头像仅学术双栏） */}
            <div
              className="mb-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{ background: `linear-gradient(135deg, ${color}, ${color}bf)` }}
            >
              <span className="font-bold text-white" style={{ fontSize: "1.35em" }}>
                {(stripHtml(info.name).replace(/\*\*/g, "") || "?").slice(0, 1)}
              </span>
            </div>
          </div>
          {contacts.length > 0 && (
            <div className="mt-[var(--head-gap)] flex flex-wrap items-center gap-y-1 text-[0.85em] text-ink-500">
              {contacts.map((c, idx) => (
                <span key={c} className="inline-flex items-center">
                  <span>{renderRich(c)}</span>
                  {idx < contacts.length - 1 && <span className="mx-3 text-ink-300" aria-hidden="true">|</span>}
                </span>
              ))}
            </div>
          )}
        </header>
      )
    ) : null;

  return (
    <div
      className={cx("resume-sheet bg-white", !forPrint && "shadow-xl shadow-ink-950/15")}
      style={{ fontSize: `${fs}px`, lineHeight: "var(--lh)", fontFamily: fontStack(resume.theme.font_family), ...densityVars(resume.theme.density) }}
    >
      {headerEl}
      <main>
        {bodySections.map((s) => (
          <SectionBlock key={s.section_id} section={s} style={style} />
        ))}
      </main>
    </div>
  );
}

/** A4 尺寸容器：794 x 1123 px @96dpi */
export function A4Sheet({ resume, forPrint }: { resume: Resume; forPrint?: boolean }) {
  const prepared = localizedResume(resume);
  return (
    <div className="resume-sheet-wrap bg-white" style={{ width: forPrint ? "210mm" : 794, minHeight: forPrint ? "297mm" : 1123, ...densityVars(resume.theme.density) }}>
      <div style={{ minHeight: forPrint ? "297mm" : 1123, padding: "var(--page-pad-y) var(--page-pad-x)" }}>
        <ResumeSheet resume={prepared} forPrint={forPrint} />
      </div>
    </div>
  );
}
