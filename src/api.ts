import { CapacitorHttp } from "@capacitor/core";
import {
  IMAGE_MODEL,
  type AspectRatio,
  type GenerationOptions,
  type ImageQuality,
  type ResolutionTier,
} from "./domain";

type JsonRecord = Record<string, unknown>;

export interface GeneratedImage {
  imageUri: string;
  mimeType?: string;
  byteSize?: number;
  isLocalData: boolean;
  requestedSize: string;
  modelRevisedPrompt?: string;
}

export class ApiRequestError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.payload = payload;
  }
}

const SIZE_TABLE: Record<AspectRatio, Record<ResolutionTier, string>> = {
  "1:1": { standard: "1024x1024", "2k": "2048x2048", max: "2880x2880" },
  "3:4": { standard: "768x1024", "2k": "1536x2048", max: "2448x3264" },
  "4:3": { standard: "1024x768", "2k": "2048x1536", max: "3264x2448" },
  "9:16": { standard: "720x1280", "2k": "1152x2048", max: "2160x3840" },
  "16:9": { standard: "1280x720", "2k": "2048x1152", max: "3840x2160" },
};

export const resolveImageSize = (ratio: AspectRatio, tier: ResolutionTier) =>
  SIZE_TABLE[ratio][tier];

export const displayImageSize = (size: string) => size.replace("x", " × ");

export const getResolutionLabel = (ratio: AspectRatio, tier: ResolutionTier) => {
  if (tier === "standard") return "标准";
  if (tier === "2k") return "2K";
  return ratio === "16:9" || ratio === "9:16" ? "4K（实验）" : "最大（实验）";
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parsePayload = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
};

const payloadErrorMessage = (payload: unknown) => {
  if (!isRecord(payload)) return undefined;
  if (isRecord(payload.error) && typeof payload.error.message === "string") {
    return payload.error.message;
  }
  return typeof payload.message === "string" ? payload.message : undefined;
};

const getErrorMessage = (payload: unknown, status: number) => {
  const upstream = payloadErrorMessage(payload);
  if (upstream) return upstream;
  if (status === 400) return "请求参数未被上游接受，请检查模型、尺寸或画质设置。";
  if (status === 401 || status === 403) return "API 密钥无效，或当前密钥没有访问权限。";
  if (status === 402) return "账户余额不足，请在 API 服务中检查额度。";
  if (status === 404) return "接口地址不正确，或上游未提供这个兼容接口。";
  if (status === 429) return "请求过于频繁，请稍后再试。";
  if (status >= 500) return "API 服务暂时不可用，请稍后重试。";
  return `请求失败，状态码 ${status}。`;
};

export const normalizeApiBase = (rawValue: string) => {
  const value = rawValue.trim();
  if (!value) throw new Error("请输入 API 地址。");

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("API 地址格式不正确。");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("API 地址必须以 http:// 或 https:// 开头。");
  }
  const localHost = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !localHost) {
    throw new Error("为避免密钥被明文传输，非本机 API 必须使用 https://。");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("API 地址只需填写基础地址，不要包含账号、参数或锚点。");
  }
  const path = parsed.pathname.replace(/\/+$/, "");
  if (/\/(models|images\/generations|chat\/completions)$/i.test(path)) {
    throw new Error("请填写 API 基础地址，不要填写具体接口路径。");
  }
  parsed.pathname = path;
  return parsed.toString().replace(/\/$/, "");
};

const buildEndpoint = (baseUrl: string, path: string) => {
  const normalized = normalizeApiBase(baseUrl);
  const versioned = /\/v1$/i.test(normalized) ? normalized : `${normalized}/v1`;
  return `${versioned}/${path.replace(/^\/+/, "")}`;
};

export const requestJson = async (
  baseUrl: string,
  apiKey: string,
  path: string,
  method: "GET" | "POST",
  data?: JsonRecord,
  readTimeout = 30_000,
) => {
  if (!apiKey.trim()) throw new Error("请输入 API 密钥。");
  try {
    const response = await CapacitorHttp.request({
      url: buildEndpoint(baseUrl, path),
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      data,
      connectTimeout: 20_000,
      readTimeout,
      responseType: "json",
      webFetchExtra: { credentials: "omit" },
    });
    const payload = parsePayload(response.data);
    if (response.status === 0) {
      throw new Error("无法连接 API，请检查地址、网络或跨域设置。");
    }
    if (response.status < 200 || response.status >= 300) {
      throw new ApiRequestError(getErrorMessage(payload, response.status), response.status, payload);
    }
    return payload;
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    if (error instanceof Error) {
      if (/timeout|timed out/i.test(error.message)) throw new Error("连接超时，请检查网络后重试。");
      if (/failed to fetch|network|load failed|cors/i.test(error.message)) {
        throw new Error("无法连接 API，请检查地址、网络或跨域设置。");
      }
      throw error;
    }
    throw new Error("无法连接 API，请检查地址和网络。");
  }
};

export const fetchModels = async (baseUrl: string, apiKey: string) => {
  const payload = await requestJson(baseUrl, apiKey, "models", "GET");
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    throw new Error("连接成功，但模型列表格式无法识别。");
  }
  const models = payload.data
    .map((item) => (isRecord(item) && typeof item.id === "string" ? item.id : null))
    .filter((item): item is string => Boolean(item));
  const unique = [...new Set(models)].sort((a, b) => a.localeCompare(b));
  if (!unique.length) throw new Error("连接成功，但当前密钥没有返回可用模型。");
  return unique;
};

const imageMimeType = (base64Value: string) => {
  if (base64Value.startsWith("/9j/")) return "image/jpeg";
  if (base64Value.startsWith("UklGR")) return "image/webp";
  return "image/png";
};

const safeImageUrl = (value: unknown) => {
  if (typeof value !== "string") return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? value : null;
  } catch {
    return null;
  }
};

const base64ByteSize = (value: string) => {
  const normalized = value.replace(/\s/g, "");
  return Math.max(0, Math.floor((normalized.length * 3) / 4) - (normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0));
};

const downloadImageAsDataUrl = async (url: string) => {
  const response = await CapacitorHttp.get({
    url,
    headers: { Accept: "image/*" },
    connectTimeout: 20_000,
    readTimeout: 180_000,
    responseType: "blob",
    webFetchExtra: { credentials: "omit" },
  });
  if (response.status < 200 || response.status >= 300 || typeof response.data !== "string") {
    throw new Error("远程原图无法下载到本地。");
  }
  if (response.data.startsWith("data:image/")) return response.data;
  const header = Object.entries(response.headers).find(([key]) => key.toLowerCase() === "content-type");
  const declared = header?.[1]?.split(";")[0]?.trim();
  const mime = declared?.startsWith("image/") ? declared : imageMimeType(response.data);
  return `data:${mime};base64,${response.data}`;
};

// Kept separate from UI state so tests can assert the exact single request body.
export const generateImage = async ({
  baseUrl,
  apiKey,
  prompt,
  options,
}: {
  baseUrl: string;
  apiKey: string;
  prompt: string;
  options: GenerationOptions;
}): Promise<GeneratedImage> => {
  const requestedSize = resolveImageSize(options.ratio, options.resolutionTier);
  const payload = await requestJson(
    baseUrl,
    apiKey,
    "images/generations",
    "POST",
    { model: IMAGE_MODEL, prompt: prompt.trim(), size: requestedSize, quality: options.quality, n: 1 },
    300_000,
  );
  if (!isRecord(payload) || !Array.isArray(payload.data) || !payload.data.length) {
    throw new Error("API 已响应，但没有返回图片数据。");
  }
  const first = payload.data[0];
  if (!isRecord(first)) throw new Error("图片响应格式无法识别。");

  let imageUri: string | null = null;
  let isLocalData = false;
  let mimeType: string | undefined;
  let byteSize: number | undefined;
  if (typeof first.b64_json === "string") {
    mimeType = imageMimeType(first.b64_json);
    byteSize = base64ByteSize(first.b64_json);
    imageUri = `data:${mimeType};base64,${first.b64_json}`;
    isLocalData = true;
  } else {
    const remote = safeImageUrl(first.url);
    if (remote) {
      try {
        imageUri = await downloadImageAsDataUrl(remote);
        const match = imageUri.match(/^data:([^;]+);base64,(.+)$/s);
        mimeType = match?.[1];
        byteSize = match ? base64ByteSize(match[2]) : undefined;
        isLocalData = true;
      } catch {
        imageUri = remote;
      }
    }
  }
  if (!imageUri) throw new Error("图片响应中缺少 url 或 b64_json。");
  return {
    imageUri,
    mimeType,
    byteSize,
    isLocalData,
    requestedSize,
    modelRevisedPrompt: typeof first.revised_prompt === "string" ? first.revised_prompt : undefined,
  };
};

export const polishPrompt = async ({
  baseUrl,
  apiKey,
  model,
  prompt,
  options,
}: {
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  options: GenerationOptions;
}) => {
  const size = resolveImageSize(options.ratio, options.resolutionTier);
  const system = [
    "你是图片生成提示词编辑器。保持用户输入的语言。",
    "必须保留主体、数量、身份、动作、关系、文字内容与核心构图意图。",
    "只补充构图、光线、镜头、材质、氛围和细节；不要添加艺术家姓名。",
    "不要输出 Markdown、解释、标题或前后缀。只输出一段纯提示词，最多 1600 个字符。",
  ].join("");
  const user = `创作上下文：画面比例 ${options.ratio}，请求尺寸 ${size}，画质 ${options.quality}。像素规格仅作上下文，不要写进提示词。\n原提示词：${prompt.trim()}`;
  const payload = await requestJson(baseUrl, apiKey, "chat/completions", "POST", {
    model: model.trim(),
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  }, 90_000);
  if (!isRecord(payload) || !Array.isArray(payload.choices) || !payload.choices.length) {
    throw new Error("润色接口没有返回可识别的内容。");
  }
  const choice = payload.choices[0];
  const content = isRecord(choice) && isRecord(choice.message) ? choice.message.content : undefined;
  if (typeof content !== "string" || !content.trim()) throw new Error("润色接口返回了空内容，原文未改变。");
  const result = content.trim();
  if (result.length > 2000) throw new Error("润色结果超过 2000 字符，原文未改变。");
  return result;
};

export const isUnsupportedSizeError = (error: unknown) =>
  error instanceof ApiRequestError &&
  error.status === 400 &&
  /(size|dimension|resolution|pixel|width|height|尺寸|分辨率|像素|宽|高)/i.test(error.message);

export const qualityLabel = (quality: ImageQuality) =>
  ({ low: "Low", medium: "Medium", high: "High", auto: "Auto" })[quality];
