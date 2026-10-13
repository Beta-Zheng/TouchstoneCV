import { describe, it, expect } from "vitest";
import type { Block, ModelProvider } from "../../types";
import { parseAIOutput, selectProvider, ruleSuggestion, defaultModels } from "../ai";

function mkBlock(partial: Partial<Block> = {}): Block {
  return {
    block_id: "blk_test",
    type: "work_experience_item",
    title: "星云科技",
    subtitle: "前端工程师",
    start_date: "2021-03",
    end_date: "至今",
    location: "",
    description: "",
    bullets: [],
    skills: [],
    links: [],
    visible: true,
    order: 0,
    ...partial,
  };
}

describe("parseAIOutput：AI 输出 JSON 校验（PRD §15.1，禁止跳过校验）", () => {
  it("合法 JSON（含代码块包裹）解析成功，且未提供的字段保留原值", () => {
    const raw = '```json\n{"suggested_block":{"title":"资深前端工程师"},"explanation":"强化职级表述"}\n```';
    const out = parseAIOutput(raw, mkBlock());
    expect(out.suggested_block.title).toBe("资深前端工程师");
    expect(out.suggested_block.subtitle).toBe("前端工程师"); // 未返回 → 保留原值
    expect(out.suggested_block.bullets).toEqual([]);
    expect(out.explanation).toBe("强化职级表述");
  });

  it("缺少 suggested_block 或 explanation 时抛错", () => {
    expect(() => parseAIOutput('{"explanation":"x"}', mkBlock())).toThrow(/suggested_block/);
    expect(() => parseAIOutput('{"suggested_block":{}}', mkBlock())).toThrow(/explanation/);
  });

  it("非 JSON 输出抛错（触发上层重试 / 降级）", () => {
    expect(() => parseAIOutput("抱歉，我无法回答", mkBlock())).toThrow();
  });
});

describe("selectProvider：隐私路由策略（外部模型默认关闭）", () => {
  const local: ModelProvider = { ...defaultModels()[0] };
  const external: ModelProvider = {
    id: "m_ext",
    name: "外部",
    type: "external",
    protocol: "openai_compatible",
    base_url: "https://api.example.com/v1",
    api_key: "sk-x",
    model_name: "gpt-x",
    temperature: 0.3,
    max_tokens: 2048,
    timeout_ms: 30000,
    enabled: true,
    created_at: new Date().toISOString(),
  };

  it("本地模型可用时优先本地", () => {
    const r = selectProvider([local, external], { allowExternal: true, route: "local_first" });
    expect(r.kind).toBe("provider");
    if (r.kind === "provider") expect(r.provider.type).toBe("local");
  });

  it("未开启外部模型时绝不走外部（PRD 验收标准）", () => {
    const r = selectProvider([external], { allowExternal: false, route: "ask_before_external" });
    expect(r.kind).toBe("rules");
  });

  it("开启外部且策略为 ask_before_external 时要求用户确认", () => {
    const r = selectProvider([external], { allowExternal: true, route: "ask_before_external" });
    expect(r.kind).toBe("confirm_external");
  });

  it("local_only 策略下任何情况都不走外部", () => {
    const r = selectProvider([external], { allowExternal: true, route: "local_only" });
    expect(r.kind).toBe("rules");
  });

  it("默认模型列表包含本地 Ollama", () => {
    expect(defaultModels().some((m) => m.protocol === "ollama" && m.type === "local")).toBe(true);
  });
});

describe("ruleSuggestion：本地规则引擎兜底（失败可降级）", () => {
  it("polish 保持 bullets 数量不变，不新增内容", () => {
    const out = ruleSuggestion("polish", mkBlock({ bullets: ["负责了系统的开发工作", "做了一些优化"] }), []);
    expect(out.suggested_block.bullets).toHaveLength(2);
    expect(out.explanation).toContain("规则引擎");
  });

  it("quantify 对缺少数据的描述给出补充建议，不编造数字", () => {
    const out = ruleSuggestion("quantify", mkBlock({ bullets: ["优化了首屏加载", "接口耗时从 800ms 降至 300ms"] }), []);
    expect(out.warnings.some((w) => w.includes("优化了首屏加载"))).toBe(true);
    expect(out.warnings).toHaveLength(1);
  });

  it("shorten 保留长句中的事实并提示拆分", () => {
    const long = "主导交易中台前端重构，将老旧的 jQuery 单体应用逐步迁移至 React 与 TypeScript 技术栈，并同步建立了完整的组件规范";
    const out = ruleSuggestion("shorten", mkBlock({ bullets: [long] }), []);
    expect(out.suggested_block.bullets[0]).toBe(long);
    expect(out.warnings[0]).toContain("拆分");
  });

  it("jd_match 标记已命中关键词，并警告未命中项（不强行添加）", () => {
    const out = ruleSuggestion("jd_match", mkBlock({ skills: ["React"] }), ["React", "微前端"]);
    expect(out.matched_keywords).toContain("React");
    expect(out.warnings.some((w) => w.includes("微前端"))).toBe(true);
  });
});
