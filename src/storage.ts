import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Preferences } from "@capacitor/preferences";
import {
  DEFAULT_APP_PREFERENCES,
  DEFAULT_CREATION_DRAFT,
  DEFAULT_PROVIDER_STORE,
  IMAGE_MODEL,
  isAspectRatio,
  isImageQuality,
  isResolutionTier,
  isThemeMode,
  type ApiProfile,
  type AppPreferencesV1,
  type CreationDraftV2,
  type GenerationRecordV2,
  type ImageApiProfile,
  type ProfileStoreV2,
  type ProviderStoreV3,
  type TextApiProfile,
} from "./domain";

const PROVIDER_KEY = "dreamcanvas.api-providers.v3";
const PROFILE_V2_KEY = "dreamcanvas.api-profiles.v2";
const APP_PREFERENCES_KEY = "dreamcanvas.app-preferences.v1";
const LEGACY_SETTINGS_KEY = "dreamcanvas.api-settings.v1";
const LEGACY_SESSION_KEY = "dreamcanvas.api-key.session.v1";
const DRAFT_KEY = "dreamcanvas.create-draft.v2";
const LEGACY_DRAFT_KEY = "dreamcanvas.create-draft.v1";
const IMAGE_SECRET_PREFIX = "dreamcanvas.api-key.";
const TEXT_SECRET_PREFIX = "dreamcanvas.text-api-key.";
const HISTORY_DB = "dreamcanvas-history";
const HISTORY_STORE = "generations";
const MAX_HISTORY_ITEMS = 24;
const NATIVE_BYTE_BUDGET = 512 * 1024 * 1024;
const WEB_BYTE_BUDGET = 96 * 1024 * 1024;

const isNative = () => Capacitor.isNativePlatform();

export const createId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const profileNameFromBaseUrl = (baseUrl: string) => {
  try {
    const host = new URL(baseUrl).hostname;
    return host || "API 上游";
  } catch {
    return "API 上游";
  }
};

export const migrateLegacySettingsValue = (
  raw: string | null,
  now = Date.now(),
  id = createId(),
): ProfileStoreV2 => {
  if (!raw) return { version: 2, activeProfileId: null, profiles: [], hasConfirmedMaxHigh: false };
  try {
    const parsed = JSON.parse(raw) as { baseUrl?: unknown };
    if (typeof parsed.baseUrl !== "string" || !parsed.baseUrl.trim()) {
      return { version: 2, activeProfileId: null, profiles: [], hasConfirmedMaxHigh: false };
    }
    const baseUrl = parsed.baseUrl.trim().replace(/\/+$/, "");
    const profile: ApiProfile = {
      id,
      name: profileNameFromBaseUrl(baseUrl),
      baseUrl,
      createdAt: now,
      updatedAt: now,
      verificationStatus: "unverified",
      verificationMessage: "已从旧配置迁移，请重新测试连接。",
      fourKStatus: "unknown",
    };
    return { version: 2, activeProfileId: id, profiles: [profile], hasConfirmedMaxHigh: false };
  } catch {
    return { version: 2, activeProfileId: null, profiles: [], hasConfirmedMaxHigh: false };
  }
};

const sanitizeProfileStore = (value: unknown): ProfileStoreV2 => {
  if (!value || typeof value !== "object") return { version: 2, activeProfileId: null, profiles: [], hasConfirmedMaxHigh: false };
  const input = value as Partial<ProfileStoreV2>;
  const profiles = Array.isArray(input.profiles)
    ? input.profiles.filter((item): item is ApiProfile =>
        Boolean(item && typeof item.id === "string" && typeof item.name === "string" && typeof item.baseUrl === "string"),
      )
    : [];
  const activeProfileId = profiles.some((item) => item.id === input.activeProfileId)
    ? input.activeProfileId ?? null
    : null;
  return {
    version: 2,
    activeProfileId,
    profiles,
    hasConfirmedMaxHigh: input.hasConfirmedMaxHigh === true,
  };
};

const isProfileBase = (item: unknown): item is { id: string; name: string; baseUrl: string } =>
  Boolean(item && typeof (item as Record<string, unknown>).id === "string" &&
    typeof (item as Record<string, unknown>).name === "string" &&
    typeof (item as Record<string, unknown>).baseUrl === "string");

const sanitizeImageProfile = (item: ImageApiProfile): ImageApiProfile => ({
  id: item.id,
  name: item.name,
  baseUrl: item.baseUrl,
  createdAt: Number.isFinite(item.createdAt) ? item.createdAt : Date.now(),
  updatedAt: Number.isFinite(item.updatedAt) ? item.updatedAt : Date.now(),
  lastUsedAt: Number.isFinite(item.lastUsedAt) ? item.lastUsedAt : undefined,
  lastVerifiedAt: Number.isFinite(item.lastVerifiedAt) ? item.lastVerifiedAt : undefined,
  verificationStatus: ["unverified", "success", "error"].includes(item.verificationStatus) ? item.verificationStatus : "unverified",
  verificationMessage: typeof item.verificationMessage === "string" ? item.verificationMessage : undefined,
  fourKStatus: ["unknown", "supported", "unsupported"].includes(item.fourKStatus) ? item.fourKStatus : "unknown",
});

const sanitizeTextProfile = (item: TextApiProfile): TextApiProfile => ({
  id: item.id,
  name: item.name,
  baseUrl: item.baseUrl,
  selectedModel: typeof item.selectedModel === "string" && item.selectedModel.trim() ? item.selectedModel.trim() : undefined,
  createdAt: Number.isFinite(item.createdAt) ? item.createdAt : Date.now(),
  updatedAt: Number.isFinite(item.updatedAt) ? item.updatedAt : Date.now(),
  lastUsedAt: Number.isFinite(item.lastUsedAt) ? item.lastUsedAt : undefined,
  lastVerifiedAt: Number.isFinite(item.lastVerifiedAt) ? item.lastVerifiedAt : undefined,
  verificationStatus: ["unverified", "success", "error"].includes(item.verificationStatus) ? item.verificationStatus : "unverified",
  verificationMessage: typeof item.verificationMessage === "string" ? item.verificationMessage : undefined,
});

export const sanitizeProviderStore = (value: unknown): ProviderStoreV3 => {
  if (!value || typeof value !== "object") return { ...DEFAULT_PROVIDER_STORE, imageProfiles: [], textProfiles: [] };
  const input = value as Partial<ProviderStoreV3>;
  const imageProfiles = Array.isArray(input.imageProfiles)
    ? input.imageProfiles.filter(isProfileBase).map((item) => sanitizeImageProfile(item as ImageApiProfile))
    : [];
  const textProfiles = Array.isArray(input.textProfiles)
    ? input.textProfiles.filter(isProfileBase).map((item) => sanitizeTextProfile(item as TextApiProfile))
    : [];
  return {
    version: 3,
    activeImageProfileId: imageProfiles.some((item) => item.id === input.activeImageProfileId) ? input.activeImageProfileId ?? null : null,
    imageProfiles,
    activeTextProfileId: textProfiles.some((item) => item.id === input.activeTextProfileId) ? input.activeTextProfileId ?? null : null,
    textProfiles,
    hasConfirmedMaxHigh: input.hasConfirmedMaxHigh === true,
  };
};

export const migrateV2StoreToV3 = (value: unknown): ProviderStoreV3 => {
  const v2 = sanitizeProfileStore(value);
  return sanitizeProviderStore({
    version: 3,
    activeImageProfileId: v2.activeProfileId,
    imageProfiles: v2.profiles.map(({ promptModel: _ignored, ...profile }) => profile),
    activeTextProfileId: null,
    textProfiles: [],
    hasConfirmedMaxHigh: v2.hasConfirmedMaxHigh,
  });
};

export const saveProviderStore = async (store: ProviderStoreV3) => {
  await Preferences.set({ key: PROVIDER_KEY, value: JSON.stringify(sanitizeProviderStore(store)) });
};

export const loadProviderStore = async (): Promise<ProviderStoreV3> => {
  const current = await Preferences.get({ key: PROVIDER_KEY });
  if (current.value) {
    try {
      return sanitizeProviderStore(JSON.parse(current.value) as unknown);
    } catch {
      return { ...DEFAULT_PROVIDER_STORE, imageProfiles: [], textProfiles: [] };
    }
  }

  const v2Stored = await Preferences.get({ key: PROFILE_V2_KEY });
  let v2: ProfileStoreV2;
  let legacyKey = "";
  if (v2Stored.value) {
    try {
      v2 = sanitizeProfileStore(JSON.parse(v2Stored.value) as unknown);
    } catch {
      v2 = migrateLegacySettingsValue(null);
    }
  } else {
    let legacyRaw: string | null = null;
    try {
      legacyRaw = localStorage.getItem(LEGACY_SETTINGS_KEY);
      legacyKey = sessionStorage.getItem(LEGACY_SESSION_KEY) ?? "";
    } catch {
      // Locked-down storage starts with an empty provider store.
    }
    v2 = migrateLegacySettingsValue(legacyRaw);
    await Preferences.set({ key: PROFILE_V2_KEY, value: JSON.stringify(v2) });
  }

  const migrated = migrateV2StoreToV3(v2);
  const active = migrated.imageProfiles.find((profile) => profile.id === migrated.activeImageProfileId);
  if (active && legacyKey) {
    try {
      await setImageProfileSecret(active.id, legacyKey);
      sessionStorage.removeItem(LEGACY_SESSION_KEY);
    } catch {
      // Leave the V1 value intact so a later launch can retry safely.
    }
  }
  await saveProviderStore(migrated);
  return migrated;
};

const secretKey = (kind: "image" | "text", profileId: string) =>
  `${kind === "image" ? IMAGE_SECRET_PREFIX : TEXT_SECRET_PREFIX}${profileId}`;

const getSecret = async (kind: "image" | "text", profileId: string) => {
  if (isNative()) {
    const value = await SecureStorage.get(secretKey(kind, profileId));
    return typeof value === "string" ? value : "";
  }
  try {
    return sessionStorage.getItem(secretKey(kind, profileId)) ?? "";
  } catch {
    return "";
  }
};

const setSecret = async (kind: "image" | "text", profileId: string, apiKey: string) => {
  const value = apiKey.trim();
  if (!value) return deleteSecret(kind, profileId);
  if (isNative()) {
    await SecureStorage.set(secretKey(kind, profileId), value);
  } else {
    sessionStorage.setItem(secretKey(kind, profileId), value);
  }
};

const deleteSecret = async (kind: "image" | "text", profileId: string) => {
  if (isNative()) {
    await SecureStorage.remove(secretKey(kind, profileId));
  } else {
    try {
      sessionStorage.removeItem(secretKey(kind, profileId));
    } catch {
      // Nothing else to remove.
    }
  }
};

export const getImageProfileSecret = (profileId: string) => getSecret("image", profileId);
export const setImageProfileSecret = (profileId: string, apiKey: string) => setSecret("image", profileId, apiKey);
export const deleteImageProfileSecret = (profileId: string) => deleteSecret("image", profileId);
export const hasImageProfileSecret = async (profileId: string) => Boolean(await getImageProfileSecret(profileId));

export const getTextProfileSecret = (profileId: string) => getSecret("text", profileId);
export const setTextProfileSecret = (profileId: string, apiKey: string) => setSecret("text", profileId, apiKey);
export const deleteTextProfileSecret = (profileId: string) => deleteSecret("text", profileId);
export const hasTextProfileSecret = async (profileId: string) => Boolean(await getTextProfileSecret(profileId));

export const loadAppPreferences = async (): Promise<AppPreferencesV1> => {
  const stored = await Preferences.get({ key: APP_PREFERENCES_KEY });
  if (!stored.value) return { ...DEFAULT_APP_PREFERENCES };
  try {
    const parsed = JSON.parse(stored.value) as Partial<AppPreferencesV1>;
    return { version: 1, theme: isThemeMode(parsed.theme) ? parsed.theme : "dark" };
  } catch {
    return { ...DEFAULT_APP_PREFERENCES };
  }
};

export const saveAppPreferences = async (preferences: AppPreferencesV1) => {
  await Preferences.set({
    key: APP_PREFERENCES_KEY,
    value: JSON.stringify({ version: 1, theme: isThemeMode(preferences.theme) ? preferences.theme : "dark" }),
  });
};

export const loadCreationDraft = async (): Promise<CreationDraftV2> => {
  const current = await Preferences.get({ key: DRAFT_KEY });
  let parsed: Record<string, unknown> = {};
  try {
    if (current.value) parsed = JSON.parse(current.value) as Record<string, unknown>;
    else {
      const legacy = localStorage.getItem(LEGACY_DRAFT_KEY);
      if (legacy) parsed = JSON.parse(legacy) as Record<string, unknown>;
    }
  } catch {
    return { ...DEFAULT_CREATION_DRAFT };
  }
  return {
    version: 2,
    prompt: typeof parsed.prompt === "string" ? parsed.prompt.slice(0, 2000) : "",
    ratio: isAspectRatio(parsed.ratio) ? parsed.ratio : "1:1",
    resolutionTier: isResolutionTier(parsed.resolutionTier) ? parsed.resolutionTier : "standard",
    quality: isImageQuality(parsed.quality) ? parsed.quality : "high",
  };
};

export const saveCreationDraft = async (draft: CreationDraftV2) => {
  await Preferences.set({ key: DRAFT_KEY, value: JSON.stringify(draft) });
};

let databasePromise: Promise<IDBDatabase> | null = null;

const openHistoryDatabase = () => {
  if (!databasePromise) {
    databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(HISTORY_DB, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(HISTORY_STORE)) {
          request.result.createObjectStore(HISTORY_STORE, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("无法打开历史记录。"));
    });
  }
  return databasePromise;
};

const requestResult = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("历史记录操作失败。"));
  });

const transactionComplete = (transaction: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("历史记录事务已取消。"));
    transaction.onerror = () => reject(transaction.error ?? new Error("历史记录事务失败。"));
  });

const putRecord = async (record: GenerationRecordV2) => {
  const database = await openHistoryDatabase();
  const transaction = database.transaction(HISTORY_STORE, "readwrite");
  const completed = transactionComplete(transaction);
  await requestResult(transaction.objectStore(HISTORY_STORE).put(record));
  await completed;
};

const dataUriParts = (uri: string) => {
  const match = uri.match(/^data:([^;]+);base64,(.+)$/s);
  return match ? { mimeType: match[1], base64: match[2] } : null;
};

const extensionForMime = (mimeType?: string) => {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
};

const estimateDataUriSize = (uri: string) => {
  const parts = dataUriParts(uri);
  if (!parts) return undefined;
  const value = parts.base64.replace(/\s/g, "");
  return Math.max(0, Math.floor((value.length * 3) / 4) - (value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0));
};

export const persistImageForHistory = async ({
  id,
  imageUri,
  mimeType,
  byteSize,
}: {
  id: string;
  imageUri: string;
  mimeType?: string;
  byteSize?: number;
}) => {
  const parts = dataUriParts(imageUri);
  if (isNative() && parts) {
    const resolvedMime = mimeType ?? parts.mimeType;
    const path = `images/${id}.${extensionForMime(resolvedMime)}`;
    const written = await Filesystem.writeFile({
      path,
      data: parts.base64,
      directory: Directory.Data,
      recursive: true,
    });
    return {
      imageUri: written.uri,
      mimeType: resolvedMime,
      byteSize: byteSize ?? estimateDataUriSize(imageUri),
      storageKind: "native-file" as const,
    };
  }
  if (parts) {
    return {
      imageUri,
      mimeType: mimeType ?? parts.mimeType,
      byteSize: byteSize ?? estimateDataUriSize(imageUri),
      storageKind: "indexeddb" as const,
    };
  }
  return { imageUri, mimeType, byteSize, storageKind: "remote" as const };
};

const normalizeLegacyRecord = (value: unknown): GenerationRecordV2 | null => {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || typeof item.prompt !== "string") return null;
  if (typeof item.imageUri === "string" && item.model === IMAGE_MODEL) return item as unknown as GenerationRecordV2;
  const imageUri = typeof item.imageSrc === "string" ? item.imageSrc : "";
  if (!imageUri) return null;
  return {
    id: item.id,
    createdAt: typeof item.createdAt === "number" ? item.createdAt : Date.now(),
    prompt: item.prompt,
    modelRevisedPrompt: typeof item.revisedPrompt === "string" ? item.revisedPrompt : undefined,
    ratio: isAspectRatio(item.ratio) ? item.ratio : "1:1",
    resolutionTier: "standard",
    requestedSize: typeof item.size === "string" ? item.size : "1024x1024",
    quality: "high",
    model: IMAGE_MODEL,
    profileId: "legacy",
    profileName: "旧配置",
    imageUri,
    byteSize: estimateDataUriSize(imageUri),
    storageKind: imageUri.startsWith("data:image/") ? "indexeddb" : "remote",
  };
};

export const resolveDisplayImageUri = (record: Pick<GenerationRecordV2, "imageUri" | "storageKind">) =>
  record.storageKind === "native-file" ? Capacitor.convertFileSrc(record.imageUri) : record.imageUri;

export const loadGenerationHistory = async () => {
  const database = await openHistoryDatabase();
  const transaction = database.transaction(HISTORY_STORE, "readonly");
  const raw = await requestResult<unknown[]>(transaction.objectStore(HISTORY_STORE).getAll());
  const records = raw.map(normalizeLegacyRecord).filter((item): item is GenerationRecordV2 => Boolean(item));

  if (isNative()) void migrateLegacyImagesInBackground(records);
  return records.sort((a, b) => b.createdAt - a.createdAt);
};

const migrateLegacyImagesInBackground = async (records: GenerationRecordV2[]) => {
  for (const record of records) {
    if (record.storageKind !== "indexeddb" || !record.imageUri.startsWith("data:image/")) continue;
    try {
      const persisted = await persistImageForHistory(record);
      Object.assign(record, persisted);
      await putRecord(record);
    } catch {
      // The Data URL remains usable; the idempotent migration retries next launch.
    }
  }
};

const deletePrivateImage = async (record: GenerationRecordV2) => {
  if (record.storageKind !== "native-file") return;
  try {
    await Filesystem.deleteFile({ path: record.imageUri });
  } catch {
    // Missing files should not prevent metadata cleanup.
  }
};

export const deleteGenerationRecord = async (record: GenerationRecordV2) => {
  await deletePrivateImage(record);
  const database = await openHistoryDatabase();
  const transaction = database.transaction(HISTORY_STORE, "readwrite");
  const completed = transactionComplete(transaction);
  await requestResult(transaction.objectStore(HISTORY_STORE).delete(record.id));
  await completed;
};

export const selectRecordsToKeep = (
  records: GenerationRecordV2[],
  byteBudget: number,
  maxItems = MAX_HISTORY_ITEMS,
) => {
  const sorted = [...records].sort((a, b) => b.createdAt - a.createdAt);
  const kept: GenerationRecordV2[] = [];
  let bytes = 0;
  for (const record of sorted) {
    const size = record.byteSize ?? 0;
    if (kept.length >= maxItems || bytes + size > byteBudget) continue;
    kept.push(record);
    bytes += size;
  }
  return kept;
};

export const saveGenerationRecord = async (record: GenerationRecordV2) => {
  await putRecord(record);
  const all = await loadGenerationHistory();
  const keep = selectRecordsToKeep(all, isNative() ? NATIVE_BYTE_BUDGET : WEB_BYTE_BUDGET);
  const keepIds = new Set(keep.map((item) => item.id));
  for (const expired of all) {
    if (!keepIds.has(expired.id)) await deleteGenerationRecord(expired);
  }
  return keep;
};

export const getHistoryBudgets = () => ({
  maxItems: MAX_HISTORY_ITEMS,
  nativeBytes: NATIVE_BYTE_BUDGET,
  webBytes: WEB_BYTE_BUDGET,
});
