import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const sarvamCall = vi.fn();
const openaiCall = vi.fn();
let keys = { sarvam: true, openai: true };

vi.mock("sarvamai", () => ({ SarvamAIClient: class { chat = { completions: sarvamCall }; } }));
vi.mock("openai", () => ({ default: class { chat = { completions: { create: openaiCall } }; } }));
vi.mock("@/server/env", () => ({
  env: { SARVAM_API_KEY: "k", SARVAM_MODEL: "sarvam-105b-conversations", SARVAM_TIMEOUT_MS: 20000, OPENAI_API_KEY: "k", OPENAI_MODEL: "gpt-5-mini", OPENAI_TIMEOUT_MS: 20000 },
  get sarvamEnabled() { return keys.sarvam; },
  get openaiEnabled() { return keys.openai; },
}));

const req = { name: "t", schema: {}, messages: [{ role: "user" as const, content: "hi" }], maxTokens: 100 };
const sarvamOk = { model: "sarvam-105b-conversations", choices: [{ message: { content: '{"a":1}' } }] };
const openaiOk = { model: "gpt-5-mini", choices: [{ message: { content: '{"b":2}' } }] };

async function load() {
  vi.resetModules();
  delete (globalThis as Record<string, unknown>).__praanaOpenAI;
  delete (globalThis as Record<string, unknown>).__praanaSarvam;
  return import("./client");
}

describe("completeJson provider chain", () => {
  beforeEach(() => {
    sarvamCall.mockReset();
    openaiCall.mockReset();
    keys = { sarvam: true, openai: true };
  });

  it("uses Sarvam first", async () => {
    sarvamCall.mockResolvedValue(sarvamOk);
    const { completeJson } = await load();
    expect(await completeJson(req)).toMatchObject({ provider: "sarvam", content: '{"a":1}' });
    expect(openaiCall).not.toHaveBeenCalled();
  });

  it("falls back to OpenAI when Sarvam errors", async () => {
    sarvamCall.mockRejectedValue(new Error("503"));
    openaiCall.mockResolvedValue(openaiOk);
    const { completeJson } = await load();
    expect(await completeJson(req)).toMatchObject({ provider: "openai", model: "gpt-5-mini" });
  });

  it("falls back to OpenAI when Sarvam returns empty content", async () => {
    sarvamCall.mockResolvedValue({ choices: [{ message: { content: "" } }] });
    openaiCall.mockResolvedValue(openaiOk);
    const { completeJson } = await load();
    expect((await completeJson(req)).provider).toBe("openai");
  });

  it("skips Sarvam when no Sarvam key", async () => {
    keys = { sarvam: false, openai: true };
    openaiCall.mockResolvedValue(openaiOk);
    const { completeJson } = await load();
    expect((await completeJson(req)).provider).toBe("openai");
    expect(sarvamCall).not.toHaveBeenCalled();
  });

  it("throws with both reasons when every provider fails, so callers use the rule engine", async () => {
    sarvamCall.mockRejectedValue(new Error("a"));
    openaiCall.mockRejectedValue(new Error("b"));
    const { completeJson } = await load();
    await expect(completeJson(req)).rejects.toThrow(/sarvam: a.*openai: b/);
  });

  it("throws when nothing is configured", async () => {
    keys = { sarvam: false, openai: false };
    const { completeJson } = await load();
    await expect(completeJson(req)).rejects.toThrow(/no AI provider/);
  });
});

describe("plainProse", () => {
  it("turns dash asides into commas and leaves numeric ranges", async () => {
    const { plainProse } = await load();
    expect(plainProse("Pain is 7 — worse at night")).toBe("Pain is 7, worse at night");
    expect(plainProse("scale 0–10 -- noted")).toBe("scale 0–10, noted");
  });
});
