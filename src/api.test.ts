import { beforeEach, describe, expect, it, vi } from "vitest";
import { CapacitorHttp } from "@capacitor/core";
import {
  ApiRequestError,
  generateImage,
  isUnsupportedSizeError,
  polishPrompt,
  resolveImageSize,
} from "./api";
import { aspectRatios, resolutionTiers } from "./domain";

vi.mock("@capacitor/core", () => ({
  CapacitorHttp: { request: vi.fn(), get: vi.fn() },
}));

const requestMock = vi.mocked(CapacitorHttp.request);

describe("gpt-image-2 尺寸映射", () => {
  const expected = {
    "1:1": ["1024x1024", "2048x2048", "2880x2880"],
    "3:4": ["768x1024", "1536x2048", "2448x3264"],
    "4:3": ["1024x768", "2048x1536", "3264x2448"],
    "9:16": ["720x1280", "1152x2048", "2160x3840"],
    "16:9": ["1280x720", "2048x1152", "3840x2160"],
  } as const;

  it("覆盖全部 15 组固定尺寸并满足官方约束", () => {
    for (const ratio of aspectRatios) {
      resolutionTiers.forEach((tier, index) => {
        const size = resolveImageSize(ratio, tier);
        expect(size).toBe(expected[ratio][index]);
        const [width, height] = size.split("x").map(Number);
        expect(width % 16).toBe(0);
        expect(height % 16).toBe(0);
        expect(Math.max(width, height)).toBeLessThanOrEqual(3840);
        expect(width * height).toBeGreaterThanOrEqual(655_360);
        expect(width * height).toBeLessThanOrEqual(8_294_400);
      });
    }
  });
});

describe("图片与润色请求", () => {
  beforeEach(() => requestMock.mockReset());

  it("图片请求固定模型并只发出一次，包含真实 size 和 quality", async () => {
    requestMock.mockResolvedValue({ status: 200, data: { data: [{ b64_json: "iVBORw0KGgo=" }] }, headers: {}, url: "" });
    const result = await generateImage({
      baseUrl: "https://api.example.com",
      apiKey: "secret",
      prompt: "湖边雪山",
      options: { ratio: "16:9", resolutionTier: "max", quality: "high" },
    });
    expect(result.requestedSize).toBe("3840x2160");
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock.mock.calls[0][0].data).toEqual({
      model: "gpt-image-2",
      prompt: "湖边雪山",
      size: "3840x2160",
      quality: "high",
      n: 1,
    });
  });

  it("润色只发送 model 和 messages，并拒绝空结果与超长结果", async () => {
    requestMock.mockResolvedValueOnce({ status: 200, data: { choices: [{ message: { content: "雪山湖畔的现代住宅，冬日柔光" } }] }, headers: {}, url: "" });
    await expect(polishPrompt({
      baseUrl: "https://api.example.com", apiKey: "secret", model: "gpt-5-mini", prompt: "雪山房子",
      options: { ratio: "16:9", resolutionTier: "2k", quality: "high" },
    })).resolves.toContain("雪山湖畔");
    expect(Object.keys(requestMock.mock.calls[0][0].data as object)).toEqual(["model", "messages"]);

    requestMock.mockResolvedValueOnce({ status: 200, data: { choices: [{ message: { content: "" } }] }, headers: {}, url: "" });
    await expect(polishPrompt({
      baseUrl: "https://api.example.com", apiKey: "secret", model: "gpt-5-mini", prompt: "原文",
      options: { ratio: "1:1", resolutionTier: "standard", quality: "auto" },
    })).rejects.toThrow("空内容");

    requestMock.mockResolvedValueOnce({ status: 200, data: { choices: [{ message: { content: "x".repeat(2001) } }] }, headers: {}, url: "" });
    await expect(polishPrompt({
      baseUrl: "https://api.example.com", apiKey: "secret", model: "gpt-5-mini", prompt: "原文",
      options: { ratio: "1:1", resolutionTier: "standard", quality: "auto" },
    })).rejects.toThrow("超过 2000");
  });

  it("只有明确的 400 尺寸错误才判定为最高档不支持", () => {
    expect(isUnsupportedSizeError(new ApiRequestError("unsupported size 3840x2160", 400, {}))).toBe(true);
    expect(isUnsupportedSizeError(new ApiRequestError("invalid prompt", 400, {}))).toBe(false);
    expect(isUnsupportedSizeError(new ApiRequestError("unsupported size", 500, {}))).toBe(false);
  });
});
