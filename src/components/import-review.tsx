import { useState } from "react";
import type { BasicInfo, Block, ResumeData, SectionType } from "../types";
import { SECTION_LABELS } from "../types";
import { uid } from "../lib/utils";
import { Btn } from "./ui";

const BLOCK_TYPES: Record<SectionType, Block["type"]> = {
  basic_info: "custom_text",
  summary: "summary",
  work_experience: "work_experience_item",
  project_experience: "project_experience_item",
  education: "education_item",
  skills: "skill_group",
  certifications: "certification",
  custom: "custom_text",
};
export function moveDraftBlock(
  data: ResumeData,
  sourceId: string,
  blockId: string,
  targetId: string
): ResumeData {
  const source = data.sections.find((s) => s.section_id === sourceId);
  const target = data.sections.find((s) => s.section_id === targetId);
  const block = source?.blocks.find((b) => b.block_id === blockId);
  if (!block || !target || sourceId === targetId) return data;
  return {
    ...data,
    sections: data.sections.map((s) => ({
      ...s,
      blocks: (s.section_id === sourceId
        ? s.blocks.filter((b) => b.block_id !== blockId)
        : s.section_id === targetId
        ? [...s.blocks, { ...block, type: BLOCK_TYPES[s.type] }]
        : s.blocks
      ).map((b, order) => ({ ...b, order })),
    })),
  };
}

export default function ImportReview({
  data,
  sourceText,
  multiColumn,
  onChange,
  onConfirm,
  onBack,
}: {
  data: ResumeData;
  sourceText: string;
  multiColumn: boolean;
  onChange: (data: ResumeData) => void;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const [notes, setNotes] = useState("");
  const basicFields: Array<[keyof BasicInfo, string]> = [
    ["name", "姓名"],
    ["title", "目标职位"],
    ["email", "邮箱"],
    ["phone", "电话"],
    ["location", "城市"],
    ["website", "主页"],
  ];
  const patchBlock = (
    sectionId: string,
    blockId: string,
    patch: Partial<Block>
  ) =>
    onChange({
      ...data,
      sections: data.sections.map((s) =>
        s.section_id === sectionId
          ? {
              ...s,
              blocks: s.blocks.map((b) =>
                b.block_id === blockId ? { ...b, ...patch } : b
              ),
            }
          : s
      ),
    });
  return (
    <div className="flex min-h-0 flex-col">
      <p className="mb-3 rounded-lg bg-brand-50 p-3 text-[12px] leading-relaxed text-brand-800">
        解析结果是草稿，请核对姓名、联系方式、日期和条目归属。原文会随简历保存在本机。
        {multiColumn && " 检测到疑似多栏，请特别检查阅读顺序。"}
      </p>
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <h4 className="mb-2 font-bold">原始文本</h4>
          <pre className="max-h-[55vh] overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-paper-50 p-4 text-[12px] leading-relaxed">
            {sourceText}
          </pre>
          <label className="mt-3 block text-[12px]">
            需要保留的未归类内容
            <textarea
              className="field-input mt-1"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="从原文复制未识别的内容，创建参考模块"
            />
          </label>
          <Btn
            className="mt-2"
            disabled={!notes.trim()}
            onClick={() => {
              onChange({
                ...data,
                sections: [
                  ...data.sections,
                  {
                    section_id: uid("sec"),
                    type: "custom",
                    title: "待归类内容",
                    visible: false,
                    order: data.sections.length,
                    blocks: [
                      {
                        block_id: uid("blk"),
                        type: "custom_text",
                        title: "",
                        subtitle: "",
                        start_date: "",
                        end_date: "",
                        location: "",
                        description: notes,
                        bullets: [],
                        skills: [],
                        links: [],
                        visible: true,
                        order: 0,
                      },
                    ],
                  },
                ],
              });
              setNotes("");
            }}
          >
            保留为隐藏参考模块
          </Btn>
        </div>
        <div className="max-h-[55vh] overflow-y-auto pr-1">
          <h4 className="mb-2 font-bold">核对结构化结果</h4>
          <div className="grid grid-cols-2 gap-2">
            {basicFields.map(([key, label]) => (
              <label key={key} className="text-[12px]">
                {label}
                <input
                  className="field-input mt-1"
                  value={String(data.basic_info[key] ?? "")}
                  onChange={(e) =>
                    onChange({
                      ...data,
                      basic_info: { ...data.basic_info, [key]: e.target.value },
                    })
                  }
                />
              </label>
            ))}
          </div>
          {data.sections
            .filter((s) => s.type !== "basic_info")
            .map((s) => (
              <section
                key={s.section_id}
                className="mt-4 border-t border-line pt-3"
              >
                <h5 className="text-[13px] font-bold">{s.title}</h5>
                {s.blocks.map((b) => (
                  <div
                    key={b.block_id}
                    className="mt-2 rounded-lg bg-paper-50 p-3"
                  >
                    <label className="block text-[11px]">
                      条目归属
                      <select
                        aria-label={`条目归属 ${b.title || s.title}`}
                        className="field-input mt-1"
                        value={s.section_id}
                        onChange={(e) =>
                          onChange(
                            moveDraftBlock(
                              data,
                              s.section_id,
                              b.block_id,
                              e.target.value
                            )
                          )
                        }
                      >
                        {data.sections
                          .filter((s) => s.type !== "basic_info")
                          .map((s) => (
                            <option key={s.section_id} value={s.section_id}>
                              {s.title}
                            </option>
                          ))}
                      </select>
                    </label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {(
                        [
                          ["title", "标题"],
                          ["subtitle", "职位 / 专业"],
                          ["start_date", "开始时间"],
                          ["end_date", "结束时间"],
                        ] as const
                      ).map(([key, label]) => (
                        <label key={key} className="text-[11px]">
                          {label}
                          <input
                            className="field-input mt-1"
                            value={b[key]}
                            onChange={(e) =>
                              patchBlock(s.section_id, b.block_id, {
                                [key]: e.target.value,
                              })
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <label className="mt-2 block text-[11px]">
                      描述
                      <textarea
                        className="field-input mt-1"
                        rows={2}
                        value={b.description}
                        onChange={(e) =>
                          patchBlock(s.section_id, b.block_id, {
                            description: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="mt-2 block text-[11px]">
                      要点（每行一条）
                      <textarea
                        className="field-input mt-1"
                        rows={3}
                        value={b.bullets.join("\n")}
                        onChange={(e) =>
                          patchBlock(s.section_id, b.block_id, {
                            bullets: e.target.value.split("\n"),
                          })
                        }
                      />
                    </label>
                    {s.type === "skills" && (
                      <label className="mt-2 block text-[11px]">
                        技能（逗号分隔）
                        <input
                          className="field-input mt-1"
                          value={b.skills.join(", ")}
                          onChange={(e) =>
                            patchBlock(s.section_id, b.block_id, {
                              skills: e.target.value
                                .split(/[,，]/)
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                        />
                      </label>
                    )}
                  </div>
                ))}
                {!s.blocks.length && (
                  <p className="mt-1 text-[11px] text-ink-400">
                    未识别到{SECTION_LABELS[s.type]}，可进入编辑器补充。
                  </p>
                )}
              </section>
            ))}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-line pt-3">
        <Btn variant="ghost" onClick={onBack}>
          返回修改原文
        </Btn>
        <Btn variant="primary" onClick={onConfirm}>
          核对完成，进入编辑器
        </Btn>
      </div>
    </div>
  );
}
