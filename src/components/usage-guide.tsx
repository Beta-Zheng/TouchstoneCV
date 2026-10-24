import { useEffect, useState } from "react";
import GuideDemo from "./guide-demo";
import {
  createGuidePreferences,
  GUIDE_STEPS,
  GUIDE_STORAGE_KEY,
  shouldOfferGuide,
} from "../lib/onboarding";
import { useApp } from "../lib/store";
import { Btn, Modal, ModalHeader } from "./ui";
import { IconArrowRight } from "./icons";

const preferences = createGuidePreferences(() => window.localStorage);

export default function UsageGuide() {
  const [mode, setMode] = useState<"welcome" | "tour" | null>(null);
  const [step, setStep] = useState(0);
  const [run, setRun] = useState(0);
  useEffect(() => {
    const state = useApp.getState();
    const hasSavedWork = !!(
      state.resumes.length ||
      state.applications.length ||
      state.snapshots.length ||
      state.suggestions.length ||
      Object.keys(state.jds).length ||
      Object.keys(state.coverLetters).length ||
      state.externalCallCount ||
      state.models.some((model) => model.enabled)
    );
    if (shouldOfferGuide(hasSavedWork, preferences.read())) setMode("welcome");
    else if (hasSavedWork && !preferences.read())
      preferences.remember("existing");
    const reopen = () => {
      preferences.remember("started");
      setStep(0);
      setRun((previous) => previous + 1);
      setMode("tour");
    };
    const sync = (event: StorageEvent) => {
      if (event.key === GUIDE_STORAGE_KEY && preferences.read())
        setMode((previous) => (previous === "welcome" ? null : previous));
    };
    window.addEventListener("touchstonecv-open-guide", reopen);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("touchstonecv-open-guide", reopen);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const close = () => {
    preferences.remember("skipped");
    setMode(null);
  };
  if (!mode) return null;
  return (
    <Modal
      open
      onClose={close}
      width={mode === "welcome" ? "max-w-lg" : "max-w-2xl"}
    >
      <ModalHeader
        title={mode === "welcome" ? "第一次使用 TouchstoneCV？" : "使用指南"}
        sub={
          mode === "welcome"
            ? "跟着动画看一遍，再动手试一下。"
            : `第 ${step + 1} / ${GUIDE_STEPS.length} 步`
        }
        onClose={close}
      />
      {mode === "welcome" ? (
        <div className="px-5 pb-5">
          <p className="my-4 text-[13px] leading-relaxed text-ink-600">
            从创建到投递，只看关键操作。演示资料不会保存。
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Btn variant="primary" onClick={close}>
              直接开始
            </Btn>
            <Btn
              variant="outline"
              onClick={() => {
                preferences.remember("started");
                setStep(0);
                setMode("tour");
              }}
            >
              开始演示
              <IconArrowRight size={14} />
            </Btn>
          </div>
          <p className="mt-4 text-[11px] text-ink-400">
            可随时从「使用指南」重新查看。
          </p>
        </div>
      ) : (
        <div className="px-5 pb-5">
          <div
            className="my-4 flex gap-1"
            aria-label={`演示进度：${step + 1} / ${GUIDE_STEPS.length}`}
          >
            {GUIDE_STEPS.map((item, index) => (
              <button
                key={item.title}
                aria-label={`查看${item.label}演示`}
                aria-current={index === step ? "step" : undefined}
                onClick={() => setStep(index)}
                className={`min-w-0 flex-1 rounded-lg px-1 py-2 text-[12px] transition-colors ${
                  index === step
                    ? "bg-brand-50 font-bold text-brand-700"
                    : "text-ink-400 hover:bg-paper-100"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            <h2 className="text-lg font-bold" aria-live="polite">
              {GUIDE_STEPS[step].title}
            </h2>
            <p className="mb-3 mt-1 text-[13px] text-ink-500">
              {GUIDE_STEPS[step].text}
            </p>
            <GuideDemo key={run} step={step} />
            <p className="mt-3 text-[11px] text-ink-400">
              实际入口：
              {step === 1 ? (
                <>
                  <span className="hidden xl:inline">
                    {GUIDE_STEPS[step].entry}
                  </span>
                  <span className="xl:hidden">简历编辑页 → 仅预览</span>
                </>
              ) : (
                GUIDE_STEPS[step].entry
              )}
            </p>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <Btn variant="ghost" onClick={close}>
              跳过演示
            </Btn>
            <div className="flex gap-2">
              <Btn
                disabled={step === 0}
                onClick={() => setStep((previous) => Math.max(0, previous - 1))}
              >
                上一步
              </Btn>
              <Btn
                variant="primary"
                onClick={() => {
                  if (step === GUIDE_STEPS.length - 1) {
                    preferences.remember("completed");
                    setMode(null);
                  } else
                    setStep((previous) =>
                      Math.min(GUIDE_STEPS.length - 1, previous + 1)
                    );
                }}
              >
                {step === GUIDE_STEPS.length - 1
                  ? "开始使用"
                  : `下一步：${GUIDE_STEPS[step + 1].label}`}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
