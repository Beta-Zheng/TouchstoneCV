import { useState } from "react";
import type { Resume } from "../types";
import { useAppSlice } from "../lib/store";
import { resumeText } from "../lib/export";
import { diffLines } from "../lib/utils";
import { Btn, Modal, ModalHeader } from "./ui";

export default function SourceUpdate({
  resume,
  source,
  onClose,
}: {
  resume: Resume;
  source: Resume;
  onClose: () => void;
}) {
  const app = useAppSlice("mergeSource", "toast");
  const [selected, setSelected] = useState<string[]>([]);
  const [basic, setBasic] = useState(false);
  return (
    <Modal open onClose={onClose} width="max-w-3xl">
      <ModalHeader
        title="对照主简历并选择更新"
        sub={`${source.title} → ${resume.title}`}
        onClose={onClose}
      />
      <div className="max-h-[70vh] overflow-auto px-5 pb-5">
        <p className="my-3 text-[12px] text-ink-500">
          仅更新勾选的栏目，整栏替换为主简历内容；岗位职位、未选择内容、模板和投递快照保留。更新前保存快照，确认后不再提示本次来源更新。
        </p>
        <label className="mb-3 flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={basic}
            onChange={(e) => setBasic(e.target.checked)}
          />
          基本信息（保留岗位目标职位）
        </label>
        <details className="mb-3 text-[12px]">
          <summary>查看基本信息差异</summary>
          <div className="mt-2 space-y-1">
            {(
              [
                ["name", "姓名"],
                ["email", "邮箱"],
                ["phone", "电话"],
                ["location", "城市"],
                ["website", "主页"],
              ] as const
            ).map(([key, label]) => (
              <p key={key} className="break-all">
                {label}：{resume.data.basic_info[key] || "未填写"} →{" "}
                {source.data.basic_info[key] || "未填写"}
              </p>
            ))}
            <p className="break-all">
              补充信息：
              {JSON.stringify(
                resume.data.basic_info.custom_fields ?? []
              )} → {JSON.stringify(source.data.basic_info.custom_fields ?? [])}
            </p>
          </div>
        </details>
        {source.data.sections
          .filter((section) => section.type !== "basic_info")
          .map((section) => {
            const current = resume.data.sections.find(
              (s) => s.section_id === section.section_id
            );
            const before = current
              ? resumeText({
                  ...resume,
                  data: {
                    ...resume.data,
                    basic_info: {
                      name: "",
                      title: "",
                      email: "",
                      phone: "",
                      location: "",
                      website: "",
                    },
                    sections: [
                      {
                        ...current,
                        visible: true,
                        blocks: current.blocks.map((block) => ({
                          ...block,
                          visible: true,
                        })),
                      },
                    ],
                  },
                })
              : "";
            const after = resumeText({
              ...source,
              data: {
                ...source.data,
                basic_info: {
                  name: "",
                  title: "",
                  email: "",
                  phone: "",
                  location: "",
                  website: "",
                },
                sections: [
                  {
                    ...section,
                    visible: true,
                    blocks: section.blocks.map((block) => ({
                      ...block,
                      visible: true,
                    })),
                  },
                ],
              },
            });
            return (
              <div
                key={section.section_id}
                className="mb-2 rounded-lg border border-line p-3"
              >
                <label className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={selected.includes(section.section_id)}
                    onChange={(e) =>
                      setSelected((ids) =>
                        e.target.checked
                          ? [...ids, section.section_id]
                          : ids.filter((id) => id !== section.section_id)
                      )
                    }
                  />
                  {section.title}
                  {!section.visible && (
                    <span className="text-ink-400">主简历中已隐藏</span>
                  )}
                </label>
                <details className="mt-2 text-[12px]">
                  <summary>查看岗位内容 → 主简历文字差异（含隐藏条目）</summary>
                  <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap">
                    {diffLines(before.split("\n"), after.split("\n")).map(
                      (line, index) => (
                        <div
                          key={index}
                          className={
                            line.kind === "add"
                              ? "text-brand-700"
                              : line.kind === "del"
                              ? "text-danger-700"
                              : "text-ink-500"
                          }
                        >
                          {line.kind === "add"
                            ? "+ "
                            : line.kind === "del"
                            ? "− "
                            : "  "}
                          {line.text}
                        </div>
                      )
                    )}
                  </pre>
                </details>
              </div>
            );
          })}
        <Btn
          className="mt-3"
          variant="primary"
          disabled={!basic && !selected.length}
          onClick={() => {
            if (app.mergeSource(resume.id, selected, basic)) {
              app.toast("ok", "所选栏目已更新，更新前版本已保存");
              onClose();
            }
          }}
        >
          更新所选内容
        </Btn>
      </div>
    </Modal>
  );
}
