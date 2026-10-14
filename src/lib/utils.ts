import type { FontKey, DensityKey, BulletStyleKey } from "../types";

export function uid(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function fmtTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fmtDateCompact(iso: string): string {
  return fmtDate(iso).replace(/-/g, "");
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return fmtDate(iso);
}

export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number
) {
  let t: ReturnType<typeof setTimeout> | null = null;
  return (...args: A) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function downloadText(
  filename: string,
  content: string,
  mime = "application/json"
) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/** 将图片文件读取为 base64 Data URL；超过 maxBytes 时拒绝 */
export function fileToDataUrl(
  file: File,
  maxBytes = 2 * 1024 * 1024
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("请选择图片文件"));
      return;
    }
    if (file.size > maxBytes) {
      reject(new Error(`图片大小不能超过 ${formatBytes(maxBytes)}`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
}

/* ---------------- 行级 LCS Diff（AI 建议对比用） ---------------- */

export type DiffOp = { kind: "same" | "add" | "del"; text: string };

export function diffLines(a: string[], b: string[]): DiffOp[] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0)
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ kind: "same", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ kind: "del", text: a[i] });
      i++;
    } else {
      out.push({ kind: "add", text: b[j] });
      j++;
    }
  }
  while (i < n) out.push({ kind: "del", text: a[i++] });
  while (j < m) out.push({ kind: "add", text: b[j++] });
  return out;
}

/** 将简历内容压平为纯文本，用于 JD 匹配 */
export function resumeToText(data: {
  basic_info: { name: string; title: string };
  sections: Array<{
    title: string;
    type?: string;
    visible?: boolean;
    blocks: Array<{
      title: string;
      subtitle: string;
      description: string;
      bullets: string[];
      skills: string[];
      visible?: boolean;
    }>;
  }>;
}): string {
  const parts: string[] =
    data.sections.find((s) => s.type === "basic_info")?.visible === false
      ? []
      : [data.basic_info.name, data.basic_info.title];
  for (const s of data.sections) {
    if (s.visible === false) continue;
    for (const b of s.blocks) {
      if (b.visible === false) continue;
      parts.push(
        b.title,
        b.subtitle,
        stripHtml(b.description),
        ...b.bullets.map(stripHtml),
        ...b.skills
      );
    }
  }
  return parts.filter(Boolean).join("\n").toLowerCase();
}

const TERM_ALIASES: Record<string, string[]> = {
  "node.js": ["node.js", "nodejs"],
  nodejs: ["node.js", "nodejs"],
  "next.js": ["next.js", "nextjs"],
  nextjs: ["next.js", "nextjs"],
  go: ["go", "golang"],
  golang: ["go", "golang"],
  postgres: ["postgres", "postgresql"],
  postgresql: ["postgres", "postgresql"],
  k8s: ["k8s", "kubernetes"],
  kubernetes: ["k8s", "kubernetes"],
};

/** Chinese phrases may be embedded in a sentence; Latin skills require token boundaries. */
export function containsTerm(text: string, term: string): boolean {
  const lower = text.toLowerCase();
  const needle = term.toLowerCase().trim();
  if (!needle) return false;
  return (TERM_ALIASES[needle] ?? [needle]).some((alias) => {
    if (/[\u4e00-\u9fff]/.test(alias)) return lower.includes(alias);
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9_+#])${escaped}($|[^a-z0-9_+#])`, "i").test(
      lower
    );
  });
}

/** A version number alone is not evidence of scope, performance or business impact. */
export function hasAchievementMetric(text: string): boolean {
  return /(?:提升|提高|降(?:低|至)|下降|减少|缩短|增长|节省|覆盖|服务|达成|耗时|延迟|成本|准确率|召回率|缺陷率|reduc\w*|increas\w*|sav\w*|improv\w*|serv\w*|latency|accuracy)[^。；;\n]{0,30}\d+(?:\.\d+)?\s*(?:%|％|倍|人|用户|万|亿|秒|分钟|小时|天|ms|s\b|seconds?|minutes?|hours?|users?)/i.test(
    stripHtml(text)
  );
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/* ---------------- 字体 / 布局密度（模板全局选项） ---------------- */

/** 可选字体 → CSS font-family 栈 */
export const FONT_STACKS: Record<FontKey, string> = {
  sans: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
  serif: '"Noto Serif SC", "Songti SC", "SimSun", serif',
  system:
    'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
  kai: '"Kaiti SC", "KaiTi", "楷体", serif',
  mono: '"JetBrains Mono", "SF Mono", "Fira Code", "Consolas", "Noto Sans SC", monospace',
  fangsong: '"FangSong SC", "FangSong", "仿宋", serif',
};

export function fontStack(key?: FontKey): string {
  return FONT_STACKS[key ?? "sans"];
}

/** 三种密度对应的 CSS 变量（间距 + 行高 + 页边距），便于一页简历调节篇幅 */
export const DENSITY_VARS: Record<DensityKey, Record<string, string>> = {
  compact: {
    "--sec-gap": "0.6rem",
    "--entry-gap": "0.3rem",
    "--bullet-gap": "0.14rem",
    "--lh": "1.42",
    "--head-gap": "0.4rem",
    "--page-pad-x": "2.6rem",
    "--page-pad-y": "2.2rem",
  },
  medium: {
    "--sec-gap": "1rem",
    "--entry-gap": "0.55rem",
    "--bullet-gap": "0.28rem",
    "--lh": "1.6",
    "--head-gap": "0.7rem",
    "--page-pad-x": "3rem",
    "--page-pad-y": "2.75rem",
  },
  loose: {
    "--sec-gap": "1.5rem",
    "--entry-gap": "0.9rem",
    "--bullet-gap": "0.45rem",
    "--lh": "1.78",
    "--head-gap": "1rem",
    "--page-pad-x": "3.4rem",
    "--page-pad-y": "3.2rem",
  },
};

export function densityVars(key?: DensityKey): Record<string, string> {
  return DENSITY_VARS[key ?? "medium"];
}

/** 解析某模块实际生效的要点列表样式：模块级设置 > 全局默认 > 菱形。
 *  编辑器与预览共用，保证「所见即所得」。 */
export function resolveBulletStyle(
  sectionStyle?: BulletStyleKey,
  themeDefault?: BulletStyleKey
): BulletStyleKey {
  return sectionStyle ?? themeDefault ?? "diamond";
}

/** 要点与「是否显示列表符号」勾选标记的配对视图：过滤空要点。
 *  marks 缺省 / 越界一律视为显示 —— 历史数据与 AI 生成内容无需迁移即默认全带符号。 */
export function bulletPairs(
  bullets: string[],
  marks?: boolean[]
): Array<{ text: string; marked: boolean }> {
  return bullets
    .map((text, i) => ({ text, marked: marks?.[i] ?? true }))
    .filter((p) => p.text);
}

/* ---------------- 行内富文本（要点 / 描述） ---------------- */

/** 判断字符串是否已是富文本 HTML（而非 ** 标记或纯文本）。
 *  必须检测「任意」标签而非仅行内白名单：存储值可能含 <ul>/<li> 等块级标签
 *  （AI 建议返回列表、用户从网页粘贴）。若此处漏判，renderRich 会走纯文本分支
 *  把标签原样显示出来 —— 曾导致「个人总结描述显示出一堆 <ul style=...>」的线上 bug。 */
export function isRichHtml(s: string): boolean {
  return /<[a-zA-Z/][^>]*>/.test(s);
}

/** 去除所有 HTML 标签，保留纯文本（用于卡片预览 / JD 匹配） */
export function stripHtml(s: string): string {
  if (!s) return "";
  return s.replace(/<[^>]+>/g, "");
}

/** 仅保留白名单内的行内标签，剥离全部属性，防止富文本注入破坏文档。
 *  块级标签不是简单剥离（否则多个 <li> 的文本会粘成一团）：
 *  - <li>：转为换行；若父级是 <ol>，每行加「1. 2. 3.」序号前缀（对应「有序号列表」的预期）
 *  - <p>/<div>：转为换行
 *  - 其余块级标签（ul/ol/table/h1-6/…）：消毒子节点后原地展开
 *  块级行的分隔规则统一为「前置 <br>」：仅当前面存在实质内容（元素或非空白文本）
 *  时补换行 —— 行标记跟着新行走，尾部天然不会多出空行（配合 trimRichTail）。
 *  - 行内未知标签（font/a/mark/…）：原地展开、不补换行
 *  这样历史脏数据（AI 返回的列表、带内联样式的粘贴内容）在预览端直接显示为干净的分行文本。 */
export function sanitizeInline(html: string): string {
  if (typeof document === "undefined") return html;
  // 历史数据修复：外部页面复制粘贴曾带入损坏的属性残留，以纯文本形式存在于标签之间
  // （如 "child-style="scrollbar-color: …">）。注意 contentEditable 序列化后会以 &gt; 实体
  // 形式存回（无字面 >），两种形态都要覆盖，否则标签剥离后垃圾文本仍会显示。
  const cleaned = html.replace(/"?child-style="[^"]*"?(?:&gt;|>)?/g, "");
  const allowed = /^(b|strong|i|em|u|br|span)$/i;
  const blockUnwrap =
    /^(ul|ol|table|thead|tbody|tfoot|tr|h[1-6]|blockquote|pre|section|article|header|footer|figure)$/i;
  const doc = new DOMParser().parseFromString(
    `<body>${cleaned}</body>`,
    "text/html"
  );
  // ol 内 li 的序号计数：兄弟 li 会被陆续替换为文本节点（不再出现在 children 里），
  // 不能用 indexOf 现算 —— 必须在处理前按访问顺序递增计数
  const olCounters = new WeakMap<Element, number>();
  /** 前面是否还有实质内容（元素或非空白文本）。决定块级行是否需要前置 <br>：
   *  Chrome 的 contentEditable 把「回车分行」存成 `首行文本<div>次行</div>`，
   *  行分隔标记在 div 上 —— 因此 <br> 必须跟着「新行」前置，而不是给旧行补尾。 */
  const hasMeaningfulPrev = (node: Node): boolean => {
    let prev = node.previousSibling;
    while (prev) {
      if (prev.nodeType === 1) return true;
      if (prev.nodeType === 3 && /[^\s]/.test(prev.textContent || ""))
        return true;
      prev = prev.previousSibling;
    }
    return false;
  };

  const transform = (node: Element) => {
    [...node.children].forEach((child) => {
      const tag = child.tagName.toLowerCase();
      if (allowed.test(tag)) {
        [...child.attributes].forEach((a) => child.removeAttribute(a.name));
        transform(child);
        return;
      }
      if (tag === "li" || tag === "p" || tag === "div") {
        const parent = child.parentElement;
        const numbered =
          tag === "li" && parent && parent.tagName.toLowerCase() === "ol";
        let index = 0;
        if (numbered) {
          index = (olCounters.get(parent) ?? 0) + 1;
          olCounters.set(parent, index);
        }
        transform(child);
        const frag = doc.createDocumentFragment();
        if (hasMeaningfulPrev(child)) frag.appendChild(doc.createElement("br"));
        if (numbered) frag.appendChild(doc.createTextNode(`${index}. `));
        while (child.firstChild) frag.appendChild(child.firstChild);
        child.replaceWith(frag);
        return;
      }
      transform(child);
      const frag = doc.createDocumentFragment();
      if (blockUnwrap.test(tag) && hasMeaningfulPrev(child))
        frag.appendChild(doc.createElement("br"));
      while (child.firstChild) frag.appendChild(child.firstChild);
      child.replaceWith(frag);
    });
  };
  transform(doc.body);
  return trimRichTail(doc.body.innerHTML);
}

/** 修剪富文本 HTML 末尾夹带的换行与空白（<br>、&nbsp;、空格/制表符）。
 *  用户输入/粘贴常在结尾带回车或空行，直接渲染会在简历上多出空行。 */
function trimRichTail(html: string): string {
  return html.replace(/(?:\s|&nbsp;|<br\s*\/?>)+$/gi, "");
}

/** 把存储值转成编辑器初始 HTML：已是 HTML 则消毒（剥离块级标签与全部属性，
 *  历史脏数据借此在编辑器内自愈），否则把 **加粗** 转成 <strong>。
 *  纯文本值中的换行符转成 <br>，编辑器内才能可见地分行（contentEditable 会
 *  把裸 \n 折叠成空格）；末尾换行/空白一并修剪。 */
export function prepEditorHtml(value: string): string {
  const trimmed = value.replace(/[\s\u00a0]+$/, "");
  if (isRichHtml(trimmed)) return sanitizeInline(trimmed);
  return trimmed
    .split("**")
    .map((seg, i) =>
      i % 2 === 1 && seg.length > 0 ? `<strong>${seg}</strong>` : seg
    )
    .join("")
    .replace(/\r?\n/g, "<br>");
}
