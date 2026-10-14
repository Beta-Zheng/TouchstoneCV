import { useState } from "react";
import type {
  ModelProvider,
  ModelProtocol,
  ModelType,
  RouteStrategy,
} from "../types";
import { cx, nowISO, uid } from "../lib/utils";
import { testProvider } from "../lib/ai";
import { useAppSlice } from "../lib/store";
import { Btn, Confirm, Modal, ModalHeader, Toggle } from "../components/ui";
import {
  IconAlert,
  IconCheck,
  IconCpu,
  IconEdit,
  IconEye,
  IconEyeOff,
  IconPlus,
  IconShield,
  IconTrash,
  IconZap,
} from "../components/icons";

const TYPE_META: Record<ModelType, { label: string; cls: string }> = {
  local: { label: "本地", cls: "bg-brand-600 text-white" },
  external: { label: "外部", cls: "bg-seal-500 text-white" },
  private: { label: "私有", cls: "bg-ink-800 text-paper-50" },
};

interface TestState {
  running?: boolean;
  ok?: boolean;
  latency?: number;
  message?: string;
}

function ModelForm({
  initial,
  onClose,
}: {
  initial: ModelProvider | null;
  onClose: () => void;
}) {
  const { saveModel, toast } = useAppSlice("saveModel", "toast");
  const [m, setM] = useState<ModelProvider>(
    initial ?? {
      id: uid("model"),
      name: "",
      type: "local",
      protocol: "ollama",
      base_url: "http://localhost:11434",
      api_key: "",
      model_name: "",
      temperature: 0.3,
      max_tokens: 2048,
      timeout_ms: 30000,
      enabled: true,
      created_at: nowISO(),
    }
  );
  const [showKey, setShowKey] = useState(false);
  const set = (patch: Partial<ModelProvider>) =>
    setM((v) => ({ ...v, ...patch }));

  const submit = () => {
    if (!m.name.trim() || !m.model_name.trim()) {
      toast("warn", "请填写模型名称与 Model 名称");
      return;
    }
    const baseUrl =
      m.base_url.trim() ||
      (m.protocol === "ollama"
        ? "http://localhost:11434"
        : "https://api.openai.com/v1");
    try {
      const parsed = new URL(baseUrl);
      if (
        !["http:", "https:"].includes(parsed.protocol) ||
        parsed.username ||
        parsed.password
      )
        throw new Error();
    } catch {
      toast(
        "warn",
        "请填写有效的 HTTP(S) 服务地址，不要在地址中包含密钥或密码"
      );
      return;
    }
    if (
      !Number.isFinite(m.temperature) ||
      m.temperature < 0 ||
      m.temperature > 2 ||
      !Number.isSafeInteger(m.max_tokens) ||
      m.max_tokens < 1 ||
      m.max_tokens > 1_000_000 ||
      !Number.isSafeInteger(m.timeout_ms) ||
      m.timeout_ms < 1 ||
      m.timeout_ms > 600_000
    ) {
      toast("warn", "请检查温度、输出长度和超时范围");
      return;
    }
    saveModel({
      ...m,
      base_url: baseUrl,
      name: m.name.trim(),
      model_name: m.model_name.trim(),
    });
    toast("ok", `模型「${m.name}」已保存`);
    onClose();
  };

  return (
    <Modal open onClose={onClose} width="max-w-md">
      <ModalHeader
        title={initial ? "编辑模型" : "新增模型"}
        sub={
          m.type === "external"
            ? "外部模型默认不参与路由，除非在隐私设置中显式开启"
            : "本地模型优先参与路由"
        }
        onClose={onClose}
      />
      <div className="flex flex-col gap-3 px-5 pb-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">名称</span>
            <input
              className="field-input"
              value={m.name}
              placeholder="本地 Ollama"
              onChange={(e) => set({ name: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="field-label">类型</span>
            <select
              className="field-input"
              value={m.type}
              onChange={(e) => set({ type: e.target.value as ModelType })}
            >
              <option value="local">local（本地）</option>
              <option value="external">external（外部）</option>
              <option value="private">private（私有网络）</option>
            </select>
          </label>
        </div>
        <label className="block">
          <span className="field-label">协议</span>
          <div className="flex rounded-lg bg-paper-200 p-0.5">
            {(
              [
                ["ollama", "Ollama"],
                ["openai_compatible", "OpenAI Compatible"],
              ] as Array<[ModelProtocol, string]>
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() =>
                  set({
                    protocol: k,
                    base_url:
                      k === "ollama"
                        ? "http://localhost:11434"
                        : m.base_url.includes("localhost:11434")
                        ? "https://api.openai.com/v1"
                        : m.base_url,
                  })
                }
                className={cx(
                  "flex-1 rounded-md py-1.5 text-[12px] font-bold transition",
                  m.protocol === k
                    ? "bg-white text-ink-900 shadow-sm"
                    : "text-ink-400"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </label>
        <label className="block">
          <span className="field-label">Base URL</span>
          <input
            className="field-input font-mono"
            value={m.base_url}
            placeholder={
              m.protocol === "ollama"
                ? "http://localhost:11434"
                : "https://api.openai.com/v1"
            }
            onChange={(e) => set({ base_url: e.target.value })}
          />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">Model</span>
            <input
              className="field-input font-mono"
              value={m.model_name}
              placeholder={
                m.protocol === "ollama" ? "qwen2.5:7b" : "gpt-4o-mini"
              }
              onChange={(e) => set({ model_name: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="field-label">
              API Key{m.type !== "external" && "（可选）"}
            </span>
            <div className="relative">
              <input
                className="field-input pr-8 font-mono"
                type={showKey ? "text" : "password"}
                value={m.api_key}
                placeholder={m.type === "external" ? "sk-…" : "本地可留空"}
                onChange={(e) => set({ api_key: e.target.value })}
              />
              <button
                type="button"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-ink-300 hover:text-ink-600"
                onClick={() => setShowKey((v) => !v)}
                aria-label="显示/隐藏 Key"
              >
                {showKey ? <IconEyeOff size={14} /> : <IconEye size={14} />}
              </button>
            </div>
          </label>
        </div>
        <details>
          <summary className="cursor-pointer text-[12px] font-bold text-ink-500">
            高级参数
          </summary>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="field-label">Temperature</span>
              <input
                className="field-input font-mono"
                type="number"
                step={0.1}
                min={0}
                max={2}
                value={m.temperature}
                onChange={(e) => set({ temperature: Number(e.target.value) })}
              />
            </label>
            <label className="block">
              <span className="field-label">Max Tokens</span>
              <input
                className="field-input font-mono"
                type="number"
                min={256}
                value={m.max_tokens}
                onChange={(e) => set({ max_tokens: Number(e.target.value) })}
              />
            </label>
            <label className="block">
              <span className="field-label">超时（ms）</span>
              <input
                className="field-input font-mono"
                type="number"
                min={5000}
                step={5000}
                value={m.timeout_ms}
                onChange={(e) => set({ timeout_ms: Number(e.target.value) })}
              />
            </label>
          </div>
        </details>
        <div className="flex items-center justify-between rounded-lg bg-paper-100 px-3 py-2">
          <span className="text-[12.5px] font-medium text-ink-700">
            启用该模型
          </span>
          <Toggle
            checked={m.enabled}
            onChange={(v) => set({ enabled: v })}
            label="启用"
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Btn variant="ghost" onClick={onClose}>
            取消
          </Btn>
          <Btn variant="primary" onClick={submit}>
            保存模型
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

export default function Models() {
  const {
    models,
    deleteModel,
    toggleModel,
    privacy,
    setPrivacy,
    externalCallCount,
    toast,
  } = useAppSlice(
    "models",
    "deleteModel",
    "toggleModel",
    "privacy",
    "setPrivacy",
    "externalCallCount",
    "toast"
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ModelProvider | null>(null);
  const [delTarget, setDelTarget] = useState<ModelProvider | null>(null);
  const [tests, setTests] = useState<Record<string, TestState>>({});
  const [confirmExternal, setConfirmExternal] = useState(false);
  const localModel = models.find((m) => m.enabled && m.type !== "external");
  const externalModel = models.find((m) => m.enabled && m.type === "external");
  const modeLabel = localModel
    ? "本机或私有模型已启用"
    : privacy.allowExternal && privacy.route !== "local_only" && externalModel
    ? "外部模型，逐次确认"
    : "本地规则，无需连接服务";

  const runTest = async (p: ModelProvider) => {
    setTests((t) => ({ ...t, [p.id]: { running: true } }));
    const r = await testProvider(p);
    setTests((t) => ({
      ...t,
      [p.id]: {
        running: false,
        ok: r.ok,
        latency: r.latency,
        message: r.message,
      },
    }));
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-12 pt-7 sm:px-6">
      <header className="anim-fade-up">
        <h1 className="text-[28px] font-semibold tracking-tight text-ink-900">
          模型与隐私
        </h1>
      </header>

      <section className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-5">
        <div>
          <p className="text-[14px] font-medium text-ink-800">
            当前：{modeLabel}
          </p>
          <details className="mt-2 text-[12px] text-ink-500">
            <summary className="cursor-pointer">运行说明</summary>
            <p className="mt-2">
              {localModel
                ? `配置模型：${localModel.name}。连接失败时会回退本地规则；启用不代表服务当前可连接。`
                : "本地规则直接在浏览器执行。外部模型仍需每次确认发送内容。"}
            </p>
          </details>
        </div>
        <Btn
          variant="outline"
          className="text-[13px]"
          onClick={() => {
            models.filter((m) => m.enabled).forEach((m) => toggleModel(m.id));
            setPrivacy({ allowExternal: false, route: "local_only" });
            toast("ok", "已切换到本地规则模式");
          }}
        >
          切换到本地规则
        </Btn>
      </section>

      {/* 隐私与路由 */}
      <section
        className="anim-fade-up rounded-2xl border border-ink-200 bg-paper-25 p-5"
        style={{ animationDelay: "0.05s" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className={cx(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                privacy.allowExternal
                  ? "bg-seal-100 text-seal-600"
                  : "bg-paper-100 text-ink-600"
              )}
            >
              <IconShield size={19} />
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-ink-900">
                允许调用外部模型
              </h2>
              <p className="mt-0.5 text-[12px] leading-relaxed text-ink-400">
                发送条目到外部服务前逐次确认。累计调用{" "}
                <b className="font-mono text-ink-700">{externalCallCount}</b>{" "}
                次。
              </p>
            </div>
          </div>
          <Toggle
            checked={privacy.allowExternal}
            onChange={(v) => {
              if (v) setConfirmExternal(true);
              else {
                setPrivacy({ allowExternal: false });
                toast("ok", "外部模型已关闭，所有请求仅走本地");
              }
            }}
            label="允许外部模型"
          />
        </div>
        <div className="mt-4 grid gap-3 border-t border-ink-100 pt-4 sm:grid-cols-3">
          {(
            [
              [
                "local_first",
                "本地优先",
                "本地优先，本地不可用且已授权时才用外部",
              ],
              ["ask_before_external", "逐次确认", "每次使用外部模型前弹窗确认"],
              [
                "local_only",
                "仅本地",
                "绝不发起外部请求，无本地模型时用规则引擎",
              ],
            ] as Array<[RouteStrategy, string, string]>
          ).map(([k, label, desc]) => (
            <button
              key={k}
              aria-pressed={privacy.route === k}
              onClick={() => {
                setPrivacy({ route: k });
                toast("ok", `已切换为${label}`);
              }}
              className={cx(
                "rounded-xl border p-3 text-left transition-all",
                privacy.route === k
                  ? "border-brand-500 bg-brand-50"
                  : "border-ink-200 bg-white hover:border-ink-300"
              )}
            >
              <span
                className={cx(
                  "flex items-center gap-1.5 text-[13px] font-medium",
                  privacy.route === k ? "text-brand-700" : "text-ink-700"
                )}
              >
                {privacy.route === k && <IconCheck size={11} />}
                {label}
              </span>
              <span className="mt-1 block text-[12px] leading-relaxed text-ink-500">
                {desc}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* 模型列表 */}
      <section className="anim-fade-up" style={{ animationDelay: "0.1s" }}>
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="font-display text-[18px] font-bold text-ink-900">
            已配置模型{" "}
            <span className="text-[12px] font-medium text-ink-500">
              {models.length}
            </span>
          </h2>
          <Btn
            variant="primary"
            className="h-8 text-[12px]"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <IconPlus size={13} /> 新增模型
          </Btn>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {models.map((m) => {
            const t = tests[m.id];
            return (
              <div
                key={m.id}
                className={cx(
                  "group rounded-xl border bg-surface p-4 transition-colors",
                  m.enabled ? "border-brand-200" : "border-line"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-[14px] font-bold text-ink-900">
                        {m.name}
                      </h3>
                      <span className={cx("chip", TYPE_META[m.type].cls)}>
                        {TYPE_META[m.type].label}
                      </span>
                    </div>
                    <p
                      className="mt-1 truncate text-[12px] text-ink-500"
                      title={m.base_url}
                    >
                      {m.base_url}
                    </p>
                  </div>
                  <Toggle
                    checked={m.enabled}
                    onChange={() => {
                      toggleModel(m.id);
                      toast(
                        "info",
                        `「${m.name}」已${m.enabled ? "停用" : "启用"}`
                      );
                    }}
                    label="启用模型"
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="chip bg-paper-200 font-mono text-ink-600">
                    {m.model_name}
                  </span>
                </div>
                <details className="mt-2 text-[12px] text-ink-500">
                  <summary className="cursor-pointer">
                    连接参数{m.api_key ? " · 已配置密钥" : ""}
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="chip bg-paper-200 text-ink-600">
                      {m.protocol}
                    </span>
                    <span className="chip bg-paper-200 text-ink-600">
                      temp {m.temperature}
                    </span>
                    <span className="chip bg-paper-200 font-mono text-ink-400">
                      {m.timeout_ms / 1000}s 超时
                    </span>
                  </div>
                </details>
                {t && !t.running && (
                  <p
                    className={cx(
                      "mt-2.5 flex items-start gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-medium leading-snug",
                      t.ok
                        ? "bg-ok-bg text-ok"
                        : "bg-danger-100 text-danger-700"
                    )}
                  >
                    {t.ok ? (
                      <IconCheck size={12} className="mt-0.5 shrink-0" />
                    ) : (
                      <IconAlert size={12} className="mt-0.5 shrink-0" />
                    )}
                    <span>
                      {t.message}
                      {t.ok && (
                        <span className="ml-1 font-mono text-[10px] opacity-70">
                          {t.latency}ms · JSON 输出可用
                        </span>
                      )}
                    </span>
                  </p>
                )}
                <div className="mt-3 flex items-center gap-1.5 border-t border-ink-100 pt-2.5">
                  <Btn
                    variant="outline"
                    className="h-7 px-2.5 text-[11.5px]"
                    onClick={() => runTest(m)}
                    disabled={t?.running}
                  >
                    <IconZap size={12} /> {t?.running ? "测试中…" : "测试连接"}
                  </Btn>
                  <div className="ml-auto flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      className="tool-btn"
                      onClick={() => {
                        setEditing(m);
                        setFormOpen(true);
                      }}
                      aria-label="编辑模型"
                    >
                      <IconEdit size={14} />
                    </button>
                    <button
                      className="tool-btn hover:bg-danger-100 hover:text-danger-600"
                      onClick={() => setDelTarget(m)}
                      aria-label="删除模型"
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <details className="mt-3 text-[12px] text-ink-500">
          <summary className="cursor-pointer">本地模型连接帮助</summary>
          <p className="mt-2 leading-relaxed">
            提示：本地 Ollama 需先在本机运行{" "}
            <span className="font-mono text-ink-400">ollama serve</span>{" "}
            并拉取模型（如{" "}
            <span className="font-mono text-ink-400">
              ollama pull qwen2.5:7b
            </span>
            ）。API Key 仅保存在本机，不在日志与界面明文展示。
          </p>
        </details>
      </section>

      {formOpen && (
        <ModelForm initial={editing} onClose={() => setFormOpen(false)} />
      )}

      <Confirm
        open={!!delTarget}
        danger
        title={`删除模型「${delTarget?.name}」？`}
        desc="删除后相关路由将失效；若没有其他可用模型，AI 功能会降级为本地规则引擎。"
        confirmText="删除模型"
        onConfirm={() => {
          if (delTarget) {
            deleteModel(delTarget.id);
            toast("ok", "模型已删除");
          }
          setDelTarget(null);
        }}
        onCancel={() => setDelTarget(null)}
      />

      <Confirm
        open={confirmExternal}
        title="开启外部模型？"
        desc={
          <span>
            开启后，当本地模型不可用时，简历条目内容可能被发送到你配置的外部 API
            服务进行处理。
            <b className="text-ink-800"> 默认不会自动调用</b>
            ，每次外部调用前都会明确提示。
          </span>
        }
        confirmText="我了解风险，开启"
        onConfirm={() => {
          setPrivacy({ allowExternal: true });
          setConfirmExternal(false);
          toast("warn", "外部模型已开启");
        }}
        onCancel={() => setConfirmExternal(false)}
      />
    </div>
  );
}
