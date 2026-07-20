import { beforeEach, describe, expect, it } from "vitest";
import {
  hasExactModel,
  needsMaxHighConfirmation,
  selectFallbackProfileId,
  type GenerationRecordV2,
  type ProfileStoreV2,
} from "./domain";
import {
  getImageProfileSecret,
  getTextProfileSecret,
  migrateLegacySettingsValue,
  migrateV2StoreToV3,
  sanitizeProviderStore,
  selectRecordsToKeep,
  setImageProfileSecret,
  setTextProfileSecret,
} from "./storage";

const record = (id: string, createdAt: number, byteSize: number): GenerationRecordV2 => ({
  id, createdAt, prompt: id, ratio: "1:1", resolutionTier: "standard", requestedSize: "1024x1024",
  quality: "high", model: "gpt-image-2", profileId: "profile", profileName: "上游",
  imageUri: `data:image/png;base64,${id}`, byteSize, storageKind: "indexeddb",
});

describe("V3 双供应商迁移与存储", () => {
  beforeEach(() => sessionStorage.clear());

  it("旧单配置迁移时不保留旧模型或密钥", () => {
    const store = migrateLegacySettingsValue(JSON.stringify({
      baseUrl: "https://image.example.com", model: "old-model", apiKey: "must-not-leak",
    }), 100, "profile-1");
    expect(store.activeProfileId).toBe("profile-1");
    expect(store.profiles[0]).toMatchObject({ name: "image.example.com", verificationStatus: "unverified", fourKStatus: "unknown" });
    expect(JSON.stringify(store)).not.toContain("must-not-leak");
    expect(JSON.stringify(store)).not.toContain("old-model");
  });

  it("V2 配置全部成为图片供应商，promptModel 不创建文本供应商，重复迁移稳定", () => {
    const v2: ProfileStoreV2 = {
      version: 2,
      activeProfileId: "image-a",
      hasConfirmedMaxHigh: true,
      profiles: [{
        id: "image-a", name: "Provider A", baseUrl: "https://image.example.com", promptModel: "gpt-5-mini",
        createdAt: 1, updatedAt: 2, verificationStatus: "success", fourKStatus: "supported",
      }],
    };
    const first = migrateV2StoreToV3(v2);
    const second = migrateV2StoreToV3(v2);
    expect(first).toEqual(second);
    expect(first.activeImageProfileId).toBe("image-a");
    expect(first.imageProfiles).toHaveLength(1);
    expect(first.textProfiles).toEqual([]);
    expect(first.activeTextProfileId).toBeNull();
    expect(JSON.stringify(first)).not.toContain("gpt-5-mini");
  });

  it("图片密钥和文本密钥使用独立空间且不会进入配置序列化", async () => {
    await setImageProfileSecret("same-id", "image-secret");
    await setTextProfileSecret("same-id", "text-secret");
    expect(await getImageProfileSecret("same-id")).toBe("image-secret");
    expect(await getTextProfileSecret("same-id")).toBe("text-secret");
    const serialized = JSON.stringify(sanitizeProviderStore({
      version: 3, activeImageProfileId: null, imageProfiles: [], activeTextProfileId: null, textProfiles: [],
      hasConfirmedMaxHigh: false, imageSecret: "image-secret", textSecret: "text-secret",
    }));
    expect(serialized).not.toContain("image-secret");
    expect(serialized).not.toContain("text-secret");
  });

  it("删除当前配置时回退到最近使用且验证成功的同类配置", () => {
    expect(selectFallbackProfileId([
      { id: "unverified", verificationStatus: "unverified", lastUsedAt: 99 },
      { id: "older", verificationStatus: "success", lastUsedAt: 10 },
      { id: "recent", verificationStatus: "success", lastUsedAt: 20 },
    ])).toBe("recent");
    expect(selectFallbackProfileId([{ id: "bad", verificationStatus: "error" }])).toBeNull();
  });

  it("文本模型只接受精确 ID", () => {
    expect(hasExactModel(["gpt-5-mini", "gpt-5"], "gpt-5-mini")).toBe(true);
    expect(hasExactModel(["gpt-5-mini"], "gpt-5")).toBe(false);
    expect(hasExactModel(["GPT-5-MINI"], "gpt-5-mini")).toBe(false);
  });
});

describe("历史治理与生成偏好", () => {
  it("按条数和字节预算保留最新记录", () => {
    const records = [record("old", 1, 40), record("middle", 2, 40), record("new", 3, 40)];
    expect(selectRecordsToKeep(records, 80).map((item) => item.id)).toEqual(["new", "middle"]);
    expect(selectRecordsToKeep(records, 1_000, 2).map((item) => item.id)).toEqual(["new", "middle"]);
  });

  it("最高档 High 仅在本机未确认时需要提醒", () => {
    const maxHigh = { ratio: "16:9", resolutionTier: "max", quality: "high" } as const;
    expect(needsMaxHighConfirmation(maxHigh, false)).toBe(true);
    expect(needsMaxHighConfirmation(maxHigh, true)).toBe(false);
    expect(needsMaxHighConfirmation({ ...maxHigh, quality: "auto" }, false)).toBe(false);
    expect(needsMaxHighConfirmation({ ...maxHigh, resolutionTier: "2k" }, false)).toBe(false);
  });
});
