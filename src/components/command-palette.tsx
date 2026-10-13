import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cx } from "../lib/utils";
import { useAppSlice } from "../lib/store";
import { emptyResume } from "../lib/parser";
import { buildSampleResume } from "../lib/samples";
import { IconClipboard, IconCpu, IconDatabase, IconFile, IconPlus, IconSearch, IconSpark } from "./icons";

/**
 * ⌘K 命令面板（设计 §4.4）：聚合「跳转简历 / 切换页面 / 新建」三类可诚实执行的命令。
 * 仅复用现有 store 动作与路由，不新增业务逻辑、不伪造不生效的动作：
 * 导出 PDF、JD 匹配属编辑器内部状态（预览弹窗 / JD 面板），命令面板降级为「打开简历」跳转。
 * 唤起方式：Ctrl/Cmd+K 全局快捷键，或侧栏「搜索命令」入口（openCommandPalette 事件）。
 */

const OPEN_EVENT = "app:open-command-palette";

/** 供侧栏入口按钮调用，触发命令面板打开（组件自包含，不新增 store 字段） */
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

type Cmd = {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  keywords?: string;
  run: () => void;
};

export default function CommandPalette() {
  const { resumes, view, go, createResume, toast } = useAppSlice("resumes", "view", "go", "createResume", "toast");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /* 命令注册表：依赖 resumes / view 动态生成，全部来自真实 store */
  const allCommands = useMemo<Cmd[]>(() => {
    const cmds: Cmd[] = [];

    // 简历：打开（跳转编辑器）
    resumes.forEach((r) => {
      const name = r.data.basic_info.name || r.title;
      const isCurrent = view.name === "editor" && view.resumeId === r.id;
      cmds.push({
        id: `open-${r.id}`,
        group: "简历",
        label: `打开「${name}」`,
        hint: isCurrent ? "当前正在编辑" : "进入编辑器",
        icon: <IconFile size={15} />,
        keywords: `${name} 简历 编辑 打开`,
        run: () => go({ name: "editor", resumeId: r.id }),
      });
    });

    // 创建：空白 / 示例（立即创建并进入编辑器）
    cmds.push({
      id: "create-blank",
      group: "创建",
      label: "新建空白简历",
      hint: "创建后直接进入编辑",
      icon: <IconPlus size={15} />,
      keywords: "新建 空白 创建 简历",
      run: () => {
        const id = createResume(emptyResume(), "未命名简历");
        toast("ok", "已创建空白简历");
        go({ name: "editor", resumeId: id });
      },
    });
    cmds.push({
      id: "create-sample",
      group: "创建",
      label: "载入示例简历",
      hint: "含完整模块，可随意修改",
      icon: <IconSpark size={15} />,
      keywords: "示例 样例 演示 载入 简历",
      run: () => {
        const data = buildSampleResume();
        const id = createResume(data, `${data.basic_info.name}（示例）`);
        toast("ok", "已载入示例简历");
        go({ name: "editor", resumeId: id });
      },
    });

    // 页面：切换
    cmds.push({
      id: "nav-home",
      group: "页面",
      label: "工作台",
      hint: "查看全部简历",
      icon: <IconClipboard size={15} />,
      keywords: "工作台 首页 home 简历列表",
      run: () => go({ name: "home" }),
    });
    cmds.push({
      id: "nav-models",
      group: "页面",
      label: "模型与隐私",
      hint: "管理模型与外部调用",
      icon: <IconCpu size={15} />,
      keywords: "模型 隐私 外部 模型配置",
      run: () => go({ name: "models" }),
    });
    cmds.push({
      id: "nav-settings",
      group: "页面",
      label: "数据管理",
      hint: "导入 / 导出 / 清空",
      icon: <IconDatabase size={15} />,
      keywords: "数据 设置 导入 导出 备份 清空",
      run: () => go({ name: "settings" }),
    });

    return cmds;
  }, [resumes, view, go, createResume, toast]);

  /* 过滤：对 label / keywords 做不区分大小写的子串匹配 */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allCommands;
    return allCommands.filter((c) => `${c.label} ${c.keywords ?? ""}`.toLowerCase().includes(q));
  }, [allCommands, query]);

  /* 按分组聚合（保持命令注册顺序） */
  const groups = useMemo(() => {
    const map = new Map<string, Cmd[]>();
    filtered.forEach((c) => {
      const arr = map.get(c.group) ?? [];
      arr.push(c);
      map.set(c.group, arr);
    });
    return Array.from(map.entries());
  }, [filtered]);

  /* 打开：重置查询与高亮，聚焦输入框 */
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  /* 全局快捷键：Ctrl/Cmd+K 唤起、Esc 关闭 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  /* active 越界收敛 */
  useEffect(() => {
    if (active >= filtered.length) setActive(filtered.length ? filtered.length - 1 : 0);
  }, [filtered.length, active]);

  /* 高亮项滚动进视口 */
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  const run = (c: Cmd) => {
    setOpen(false);
    c.run();
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (filtered.length ? (a + 1) % filtered.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (filtered.length ? (a - 1 + filtered.length) % filtered.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const c = filtered[active];
      if (c) run(c);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[16vh]">
      <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] } }}
        className="relative w-full max-w-lg overflow-hidden rounded-xl bg-paper-25 shadow-2xl shadow-ink-950/30 ring-1 ring-ink-900/10"
      >
        {/* 搜索输入行 */}
        <div className="flex items-center gap-2.5 border-b border-ink-100 px-4 py-3">
          <IconSearch size={16} className="shrink-0 text-ink-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onListKeyDown}
            placeholder="搜索命令…（↑↓ 选择 · 回车执行 · Esc 关闭）"
            className="w-full bg-transparent text-[14px] text-ink-900 placeholder:text-ink-400 focus:outline-none"
            aria-label="搜索命令"
          />
          <kbd className="shrink-0 rounded-md border border-ink-200 bg-paper-200 px-1.5 py-0.5 font-mono text-[10px] text-ink-500">Esc</kbd>
        </div>

        {/* 命令列表 */}
        <div ref={listRef} className="max-h-[46vh] overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-ink-400">没有匹配的命令</p>
          ) : (
            groups.map(([group, cmds]) => (
              <div key={group} className="mb-1">
                <p className="px-2.5 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-400">{group}</p>
                {cmds.map((c) => {
                  const idx = filtered.indexOf(c);
                  const isActive = idx === active;
                  return (
                    <button
                      key={c.id}
                      data-idx={idx}
                      onClick={() => run(c)}
                      onMouseMove={() => setActive(idx)}
                      className={cx(
                        "group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                        isActive ? "bg-brand-50" : "hover:bg-ink-900/5"
                      )}
                    >
                      <span className={cx("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", isActive ? "bg-brand-100 text-brand-700" : "bg-paper-200 text-ink-500")}>{c.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium text-ink-900">{c.label}</span>
                        {c.hint && <span className={cx("block truncate text-[11px]", isActive ? "text-brand-600" : "text-ink-400")}>{c.hint}</span>}
                      </span>
                      {isActive && <kbd className="shrink-0 rounded-md border border-brand-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-brand-600">↵</kbd>}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* 底部说明：真实数据原则提示 */}
        <div className="flex items-center gap-2 border-t border-ink-100 bg-paper-50 px-4 py-2">
          <span className="sp-dot" />
          <p className="text-[10.5px] text-ink-400">导出 PDF、JD 匹配请进入对应简历的编辑器操作</p>
        </div>
      </motion.div>
    </div>
  );
}
