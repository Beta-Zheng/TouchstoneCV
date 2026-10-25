import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { motion } from "framer-motion";
import { cx } from "./lib/utils";
import { useApp, type View } from "./lib/store";
import { ToastHost } from "./components/ui";
import CommandPalette, {
  openCommandPalette,
} from "./components/command-palette";
import Logo from "./components/logo";
import Home from "./pages/Home";
import UsageGuide from "./components/usage-guide";
import { openUsageGuide } from "./lib/onboarding";
import { hashView } from "./lib/navigation";
import {
  IconAlert,
  IconDashboard,
  IconSend,
  IconCpu,
  IconDatabase,
  IconMenu,
  IconSearch,
  IconShield,
  IconBookOpen,
} from "./components/icons";

const Editor = lazy(() => import("./pages/Editor"));
const Models = lazy(() => import("./pages/Models"));
const Settings = lazy(() => import("./pages/Settings"));
const Applications = lazy(() => import("./pages/Applications"));

/** 全局错误边界：任何渲染异常都显示可读的错误卡片，而不是白屏 */
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div
          className="flex h-screen items-center justify-center bg-page p-6"
          style={{ fontFamily: '"Noto Sans SC", "PingFang SC", sans-serif' }}
        >
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl shadow-ink-900/10">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger-100 text-danger-700">
                <IconAlert size={18} />
              </span>
              <div>
                <h1
                  className="text-[16px] font-bold"
                  style={{ color: "#1B1C1F" }}
                >
                  页面渲染出错了
                </h1>
                <p className="text-[12px]" style={{ color: "#6E7076" }}>
                  应用遇到了意外错误，你的本地数据不会丢失
                </p>
              </div>
            </div>
            <pre
              className="mt-4 max-h-32 overflow-auto rounded-lg p-3 font-mono text-[12px] leading-relaxed"
              style={{ background: "#F4F4F0", color: "#B91C1C" }}
            >
              {this.state.error.message || String(this.state.error)}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 w-full rounded-md px-3 py-2 text-[13px] font-medium text-white transition active:scale-[0.98]"
              style={{ background: "#4338CA" }}
            >
              重新加载应用
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function NavItem({
  active,
  onClick,
  icon,
  label,
  trailing,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  trailing?: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cx(
        "group relative flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300",
        active
          ? "bg-brand-50 text-brand-700"
          : "text-ink-500 hover:bg-subtle hover:text-ink-900"
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-brand-500" />
      )}
      <span
        className={cx(
          "flex h-5 w-5 shrink-0 items-center justify-center transition-colors",
          active ? "text-brand-600" : "text-ink-400 group-hover:text-brand-600"
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
    </button>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}

function AppShell() {
  const [hydrated, setHydrated] = useState(useApp.persist.hasHydrated());
  useEffect(() => {
    const unsubscribe = useApp.persist.onFinishHydration(() =>
      setHydrated(true)
    );
    setHydrated(useApp.persist.hasHydrated());
    return unsubscribe;
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    const sync = () => {
      const view = hashView(window.location.hash);
      if (!view) return;
      const state = useApp.getState();
      useApp.setState({
        view:
          view.name === "editor" &&
          !state.resumes.some((r) => r.id === view.resumeId)
            ? { name: "home" }
            : view,
      });
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [hydrated]);
  const view = useApp((s) => s.view);
  const go = useApp((s) => s.go);
  const privacy = useApp((s) => s.privacy);
  const resumeCount = useApp((s) => s.resumes.length);
  // 移动端抽屉导航（<md）：桌面侧栏 fixed 化后滑入滑出
  const [drawerOpen, setDrawerOpen] = useState(false);

  const nav: Array<{
    key: View["name"];
    label: string;
    icon: React.ReactNode;
    view: View;
  }> = [
    {
      key: "home",
      label: "工作台",
      icon: <IconDashboard size={20} />,
      view: { name: "home" },
    },
    {
      key: "models",
      label: "模型与隐私",
      icon: <IconCpu size={20} />,
      view: { name: "models" },
    },
    {
      key: "settings",
      label: "数据管理",
      icon: <IconDatabase size={20} />,
      view: { name: "settings" },
    },
    {
      key: "applications",
      label: "投递记录",
      icon: <IconSend size={20} />,
      view: { name: "applications" },
    },
  ];
  const activeKey = view.name === "editor" ? "home" : view.name;

  if (!hydrated)
    return (
      <p role="status" className="p-6">
        正在读取本机简历与版本…
      </p>
    );
  return (
    <div id="app-root" className="flex h-screen overflow-hidden bg-page">
      {/* 移动端顶栏（<md）：汉堡按钮 + 品牌 */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-16 items-center gap-2.5 border-b border-line bg-surface/95 px-3 py-2 backdrop-blur md:hidden">
        <button
          onClick={() => setDrawerOpen(true)}
          className="tool-btn"
          aria-label="打开导航菜单"
          aria-expanded={drawerOpen}
        >
          <IconMenu size={18} />
        </button>
        <Logo size={28} />
        <span className="text-[16px] font-semibold leading-none text-ink-900">
          TouchstoneCV
        </span>
      </div>
      {/* 抽屉遮罩 */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink-950/45 md:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}
      {/* 侧边导航（v1.4 浅色化；<md 转为固定抽屉，滑入滑出） */}
      <nav
        className={cx(
          "flex w-[232px] shrink-0 flex-col overflow-y-auto border-r border-line bg-surface",
          "fixed inset-y-0 left-0 z-50 transition-transform duration-200 md:static md:z-auto md:translate-x-0 md:transition-none",
          drawerOpen
            ? "translate-x-0 shadow-2xl shadow-ink-950/25"
            : "-translate-x-full"
        )}
      >
        <div className="flex shrink-0 items-center gap-3 px-5 py-6">
          <Logo size={38} />
          <div>
            <p className="text-[16px] font-bold leading-5 tracking-tight text-ink-900">
              TouchstoneCV
            </p>
            <p className="mt-0.5 text-[12px] leading-4 text-ink-400">
              简历工作台
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-1 px-3">
          {nav.map((n) => (
            <NavItem
              key={n.key}
              active={activeKey === n.key}
              onClick={() => {
                go(n.view);
                setDrawerOpen(false);
              }}
              icon={n.icon}
              label={n.label}
            />
          ))}
        </div>

        <div className="mx-6 my-4 h-px shrink-0 bg-line" />
        <div className="flex shrink-0 flex-col gap-1 px-3">
          <NavItem
            active={false}
            label="搜索命令"
            icon={<IconSearch size={20} />}
            onClick={() => {
              setDrawerOpen(false);
              openCommandPalette();
            }}
            trailing={
              <kbd className="hidden rounded border border-line px-1.5 py-0.5 text-[12px] font-normal leading-4 text-ink-400 md:block">
                {typeof navigator !== "undefined" &&
                /Mac/i.test(navigator.platform)
                  ? "⌘ K"
                  : "Ctrl K"}
              </kbd>
            }
          />
          <NavItem
            active={false}
            label="使用指南"
            icon={<IconBookOpen size={20} />}
            onClick={() => {
              setDrawerOpen(false);
              openUsageGuide();
            }}
          />
        </div>

        <div className="mt-auto shrink-0 px-3 pb-3 pt-6">
          <div className="rounded-xl bg-subtle px-3 py-3 ring-1 ring-line">
            <p className="flex items-center gap-1.5 text-[12px] font-bold text-ink-900">
              <IconShield
                size={13}
                className={
                  privacy.allowExternal ? "text-seal-600" : "text-brand-600"
                }
              />
              {privacy.allowExternal ? "外部模型已开启" : "本地模式"}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-500">
              {privacy.allowExternal
                ? "本地模型不可用时可能发起外部请求，调用前会提示。"
                : "数据不出本机，不发起任何外部请求。"}
            </p>
            <div className="mt-2 flex items-center gap-1.5 font-mono text-[12px] text-ink-500">
              <span
                className={cx(
                  "h-1.5 w-1.5 rounded-full",
                  privacy.allowExternal
                    ? "bg-seal-600"
                    : "anim-pulse-dot bg-brand-500"
                )}
              />
              {resumeCount} 份本机简历
            </div>
          </div>
        </div>
      </nav>

      {/* Switch content immediately; entry animation does not block navigation. */}
      <main className="mt-16 min-w-0 flex-1 overflow-hidden md:mt-0">
        <motion.div
          key={view.name}
          initial={{ opacity: 0, y: 10 }}
          animate={{
            opacity: 1,
            y: 0,
            transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
          }}
          className={cx(
            "h-full overflow-y-auto",
            view.name === "editor" && "overflow-hidden"
          )}
        >
          {view.name === "home" && <Home />}
          <Suspense
            fallback={
              <p role="status" className="p-6 text-ink-400">
                正在加载…
              </p>
            }
          >
            {view.name === "editor" && (
              <Editor key={`${view.resumeId}:${view.panel ?? ""}`} resumeId={view.resumeId} initialPanel={view.panel} />
            )}
            {view.name === "models" && <Models />}
            {view.name === "settings" && <Settings />}
            {view.name === "applications" && <Applications initialDueOnly={view.dueOnly} />}
          </Suspense>
        </motion.div>
      </main>

      <ToastHost />
      <CommandPalette />
      <UsageGuide />
    </div>
  );
}
