import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AUDIENCE_LABELS,
  type ApplicationStatus,
  type ResumeAudience,
} from "../types";
import { APPLICATION_LABELS } from "../lib/applications";
import { Btn } from "./ui";
import {
  IconArrowRight,
  IconCheck,
  IconLayers,
  IconLock,
  IconPlus,
} from "./icons";

const ORIGINAL = "完成课程项目的页面开发。";
const IMPROVED = "优化页面加载，耗时从 3 秒降到 1 秒。";
const CAPTIONS = [
  [
    "点击「新建简历」",
    "选择校招、实习或社招",
    "示例简历准备好了",
    "试试选择你的求职场景",
  ],
  [
    "找到「主要成果」",
    "把做过的事写清楚",
    "右侧预览同步更新",
    "试着改写这条成果",
  ],
  [
    "主简历保存通用经历",
    "点击「为岗位创建版本」",
    "生成一份独立副本",
    "岗位职位变了，主简历没变",
  ],
  [
    "准备记录实际投递",
    "点击「记录投递」",
    "当时内容被固定保存",
    "继续修改，也不会改变投递版本",
  ],
  [
    "投递后等待回复",
    "收到面试邀请",
    "手动更新为「面试中」",
    "反馈进入时间线，统计随之更新",
  ],
];

export default function GuideDemo({ step }: { step: number }) {
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [audience, setAudience] = useState<ResumeAudience>("student");
  const [created, setCreated] = useState(false);
  const [achievement, setAchievement] = useState(ORIGINAL);
  const [jobCreated, setJobCreated] = useState(false);
  const [jobTitle, setJobTitle] = useState("前端开发");
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [status, setStatus] = useState<ApplicationStatus>("applied");
  const [hadInterview, setHadInterview] = useState(false);
  const [manual, setManual] = useState(false);
  const pause = () => {
    setPlaying(false);
    setManual(true);
  };
  const reset = () => {
    setPhase(0);
    setManual(false);
    if (step === 0) setCreated(false);
    if (step === 1) setAchievement(ORIGINAL);
    if (step === 2) {
      setJobCreated(false);
      setJobTitle("前端开发");
    }
    if (step === 3) {
      setSnapshot(null);
      setAchievement(IMPROVED);
    }
    if (step === 4) {
      setStatus("applied");
      setHadInterview(false);
    }
  };
  useEffect(() => {
    reset();
    setPlaying(!reducedMotion);
  }, [step, reducedMotion]);
  useEffect(() => {
    if (!playing || reducedMotion) return;
    if (phase === 3) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => {
      const next = phase + 1;
      if (step === 0 && next === 1) setAudience("internship");
      if (step === 0 && next === 2) setCreated(true);
      if (step === 1 && next === 2) setAchievement(IMPROVED);
      if (step === 2 && next === 2) setJobCreated(true);
      if (step === 2 && next === 3) setJobTitle("前端开发实习生");
      if (step === 3 && next === 2) setSnapshot(achievement);
      if (step === 3 && next === 3) setAchievement("新增项目复盘与测试记录。");
      if (step === 4 && next === 2) {
        setStatus("interview");
        setHadInterview(true);
      }
      setPhase(next);
    }, 1600);
    return () => clearTimeout(timer);
  }, [playing, phase, step, reducedMotion, achievement]);
  const enter = {
    initial: reducedMotion
      ? (false as const)
      : { opacity: 0, y: 12, scale: 0.96 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { duration: reducedMotion ? 0 : 0.35 },
  };
  const actionClass =
    phase === 1 && playing
      ? "guide-action ring-2 ring-brand-300 ring-offset-2"
      : "";
  return (
    <section
      className="rounded-2xl border border-line bg-paper-50 p-3 sm:p-4"
      aria-label="虚构资料交互演示"
    >
      <div className="mb-3 flex items-center justify-between gap-2 text-[11px]">
        <span className="text-ink-400">演示资料 · 不会保存</span>
        <div className="flex gap-1">
          {!reducedMotion && (
            <Btn
              variant="ghost"
              className="h-7 px-2 text-[11px]"
              aria-label={playing ? "暂停演示" : "播放演示"}
              onClick={() => {
                if (!playing && (phase === 3 || manual)) reset();
                setPlaying(!playing);
              }}
            >
              {playing ? "Ⅱ 暂停" : "▷ 播放"}
            </Btn>
          )}
          <Btn
            variant="ghost"
            className="h-7 px-2 text-[11px]"
            onClick={() => {
              reset();
              setPlaying(!reducedMotion);
            }}
          >
            重看这一步
          </Btn>
        </div>
      </div>
      <motion.div
        key={step}
        {...enter}
        className="min-h-[220px] rounded-xl border border-line bg-white p-3 sm:min-h-[230px] sm:p-4"
      >
        {step === 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <strong className="text-[13px]">简历工作台</strong>
              <Btn
                className={actionClass}
                onClick={() => {
                  pause();
                  setCreated(true);
                }}
              >
                <IconPlus size={13} />
                新建简历
              </Btn>
            </div>
            <div className="flex gap-2" aria-label="演示求职场景">
              {Object.entries(AUDIENCE_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  aria-pressed={audience === key}
                  className={`flex-1 rounded-lg border px-2 py-2 text-[12px] ${
                    audience === key
                      ? "border-brand-300 bg-brand-50 text-brand-700"
                      : "border-line text-ink-500"
                  }`}
                  onClick={() => {
                    pause();
                    setAudience(key as ResumeAudience);
                    setCreated(true);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <AnimatePresence>
              {created ? (
                <motion.div
                  {...enter}
                  className="rounded-lg border border-brand-200 bg-brand-50 p-4"
                >
                  <p className="flex items-center gap-2 text-[13px] font-bold">
                    <IconCheck size={15} />
                    {AUDIENCE_LABELS[audience]} · 示例简历
                  </p>
                  <div className="mt-3 h-2 w-2/3 rounded bg-brand-200" />
                  <div className="mt-2 h-2 w-1/2 rounded bg-brand-100" />
                </motion.div>
              ) : (
                <div className="rounded-lg border border-dashed border-line p-5 text-center text-[12px] text-ink-400">
                  新建简历后，从导入、示例或空白开始
                </div>
              )}
            </AnimatePresence>
          </div>
        )}
        {step === 1 && (
          <div className="grid gap-3 sm:grid-cols-[1fr_24px_1fr]">
            <label className="text-[12px] font-medium">
              主要成果
              <textarea
                aria-label="演示成果"
                className={`field-input mt-2 ${actionClass}`}
                rows={3}
                value={achievement}
                maxLength={500}
                onFocus={pause}
                onChange={(e) => {
                  pause();
                  setAchievement(e.target.value);
                }}
              />
            </label>
            <span className="hidden self-center text-brand-400 sm:block">
              <IconArrowRight />
            </span>
            <motion.div
              animate={{ borderColor: phase >= 2 ? "#a5b4fc" : "#e5e7eb" }}
              transition={{ duration: reducedMotion ? 0 : 0.4 }}
              className="rounded-lg border p-3"
            >
              <p className="mb-3 text-[10px] text-ink-400">实时预览</p>
              <p className="text-[13px] font-bold">林同学 · 课程项目</p>
              <motion.p
                key={achievement}
                initial={reducedMotion ? false : { opacity: 0.3 }}
                animate={{ opacity: 1 }}
                className="mt-3 break-words text-[12px] leading-relaxed"
              >
                {achievement || "你的成果会显示在这里"}
              </motion.p>
            </motion.div>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-3">
            <Btn
              className={actionClass}
              onClick={() => {
                pause();
                setJobCreated(true);
              }}
            >
              <IconLayers size={13} />
              为岗位创建版本
            </Btn>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-line bg-paper-50 p-3">
                <p className="text-[12px] text-ink-400">主简历</p>
                <p className="mt-2 text-[13px] font-bold">前端开发</p>
                <p className="mt-2 flex items-center gap-1 text-[11px] text-ink-500">
                  <IconLock size={12} />
                  通用经历保留
                </p>
              </div>
              {jobCreated ? (
                <motion.div
                  {...enter}
                  className="rounded-lg border border-brand-300 bg-brand-50 p-3"
                >
                  <label className="text-[12px] text-brand-700">
                    示例公司 · 岗位版本
                    <input
                      aria-label="演示岗位职位"
                      className="field-input mt-2"
                      value={jobTitle}
                      maxLength={60}
                      onFocus={pause}
                      onChange={(e) => {
                        pause();
                        setJobTitle(e.target.value);
                      }}
                    />
                  </label>
                </motion.div>
              ) : (
                <div className="flex items-center justify-center rounded-lg border border-dashed border-line text-[12px] text-ink-400">
                  岗位副本将出现在这里
                </div>
              )}
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-3">
            <label className="block text-[12px]">
              当前简历
              <textarea
                aria-label="演示当前内容"
                className="field-input mt-1"
                rows={2}
                maxLength={500}
                value={achievement}
                onFocus={pause}
                onChange={(e) => {
                  pause();
                  setAchievement(e.target.value);
                }}
              />
            </label>
            <Btn
              className={actionClass}
              disabled={snapshot !== null || !achievement.trim()}
              onClick={() => {
                pause();
                setSnapshot(achievement);
              }}
            >
              <IconLock size={13} />
              {snapshot === null ? "记录投递" : "已固定投递版本"}
            </Btn>
            {snapshot !== null && (
              <motion.div
                {...enter}
                className="rounded-lg border border-brand-300 bg-brand-50 p-3"
              >
                <p className="flex items-center gap-1 text-[12px] font-bold text-brand-700">
                  <IconLock size={12} />
                  投递时的内容 · 只读
                </p>
                <p className="mt-2 break-words text-[12px]">{snapshot}</p>
              </motion.div>
            )}
          </div>
        )}
        {step === 4 && (
          <div className="space-y-3">
            <p className="text-[13px] font-bold">示例公司 · 前端实习生</p>
            <label className="block text-[12px]">
              收到反馈后，更新状态
              <select
                aria-label="演示投递状态"
                className={`field-input mt-1 ${actionClass}`}
                value={status}
                onFocus={pause}
                onChange={(e) => {
                  pause();
                  const next = e.target.value as ApplicationStatus;
                  setStatus(next);
                  if (next === "interview") setHadInterview(true);
                }}
              >
                {Object.entries(APPLICATION_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <motion.div
              key={status}
              {...enter}
              className="flex items-center gap-2 rounded-lg bg-brand-50 p-3 text-[12px] text-brand-700"
            >
              <IconCheck size={14} />
              {APPLICATION_LABELS[status]}
              <span className="ml-auto">已记入时间线</span>
            </motion.div>
            <div className="flex items-end gap-3 border-b border-line px-3 pt-1 text-[11px] text-ink-500">
              <span>已投递 1</span>
              <motion.div
                animate={{ height: hadInterview ? 34 : 8 }}
                transition={{ duration: reducedMotion ? 0 : 0.4 }}
                className="w-7 rounded-t bg-brand-300"
              />
              <span>面试 {hadInterview ? 1 : 0}</span>
            </div>
          </div>
        )}
      </motion.div>
      <div className="mt-3 flex min-h-6 items-center gap-2 text-[12px] text-ink-600">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            playing ? "bg-brand-500" : "bg-ink-300"
          }`}
        />
        <span aria-live="polite">
          {manual ? "演示已暂停，你可以自由尝试" : CAPTIONS[step][phase]}
        </span>
      </div>
    </section>
  );
}
