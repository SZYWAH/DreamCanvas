export const aspectRatios = ["1:1", "3:4", "4:3", "9:16", "16:9"] as const;
export const resolutionTiers = ["standard", "2k", "max"] as const;
export const imageQualities = ["low", "medium", "high", "auto"] as const;

export type AspectRatio = (typeof aspectRatios)[number];
export type ResolutionTier = (typeof resolutionTiers)[number];
export type ImageQuality = (typeof imageQualities)[number];
export type ImageModel = "gpt-image-2";
export type FourKStatus = "unknown" | "supported" | "unsupported";
export type VerificationStatus = "unverified" | "success" | "error";
export type ThemeMode = "dark" | "light";
export type AppView = "create" | "history" | "settings";

export interface ImageApiProfile {
  id: string;
  name: string;
  baseUrl: string;
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
  lastVerifiedAt?: number;
  verificationStatus: VerificationStatus;
  verificationMessage?: string;
  fourKStatus: FourKStatus;
}

export interface TextApiProfile {
  id: string;
  name: string;
  baseUrl: string;
  selectedModel?: string;
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
  lastVerifiedAt?: number;
  verificationStatus: VerificationStatus;
  verificationMessage?: string;
}

/** Kept only as the input shape for the V2 to V3 migration. */
export interface ApiProfile extends ImageApiProfile {
  promptModel?: string;
}

export interface ProfileStoreV2 {
  version: 2;
  activeProfileId: string | null;
  profiles: ApiProfile[];
  hasConfirmedMaxHigh: boolean;
}

export interface ProviderStoreV3 {
  version: 3;
  activeImageProfileId: string | null;
  imageProfiles: ImageApiProfile[];
  activeTextProfileId: string | null;
  textProfiles: TextApiProfile[];
  hasConfirmedMaxHigh: boolean;
}

export interface AppPreferencesV1 {
  version: 1;
  theme: ThemeMode;
}

export interface PolishProvenance {
  textProfileId: string;
  textProfileName: string;
  model: string;
}

export interface GenerationOptions {
  ratio: AspectRatio;
  resolutionTier: ResolutionTier;
  quality: ImageQuality;
}

export interface GenerationRecordV2 {
  id: string;
  createdAt: number;
  originalPrompt?: string;
  prompt: string;
  modelRevisedPrompt?: string;
  polishProvenance?: PolishProvenance;
  ratio: AspectRatio;
  resolutionTier: ResolutionTier;
  requestedSize: string;
  actualWidth?: number;
  actualHeight?: number;
  quality: ImageQuality;
  model: ImageModel;
  profileId: string;
  profileName: string;
  imageUri: string;
  mimeType?: string;
  byteSize?: number;
  storageKind: "native-file" | "indexeddb" | "remote";
}

export interface CreationDraftV2 extends GenerationOptions {
  version: 2;
  prompt: string;
}

export interface Notice {
  tone: "info" | "success" | "error";
  text: string;
}

export const DEFAULT_PROVIDER_STORE: ProviderStoreV3 = {
  version: 3,
  activeImageProfileId: null,
  imageProfiles: [],
  activeTextProfileId: null,
  textProfiles: [],
  hasConfirmedMaxHigh: false,
};

export const DEFAULT_APP_PREFERENCES: AppPreferencesV1 = {
  version: 1,
  theme: "dark",
};

export const DEFAULT_CREATION_DRAFT: CreationDraftV2 = {
  version: 2,
  prompt: "",
  ratio: "1:1",
  resolutionTier: "standard",
  quality: "high",
};

export const IMAGE_MODEL: ImageModel = "gpt-image-2";

export const isAspectRatio = (value: unknown): value is AspectRatio =>
  aspectRatios.includes(value as AspectRatio);

export const isResolutionTier = (value: unknown): value is ResolutionTier =>
  resolutionTiers.includes(value as ResolutionTier);

export const isImageQuality = (value: unknown): value is ImageQuality =>
  imageQualities.includes(value as ImageQuality);

export const isThemeMode = (value: unknown): value is ThemeMode =>
  value === "dark" || value === "light";

export const needsMaxHighConfirmation = (
  options: GenerationOptions,
  hasConfirmed: boolean,
) => options.resolutionTier === "max" && options.quality === "high" && !hasConfirmed;

export const hasExactModel = (models: string[], selectedModel: string) =>
  models.includes(selectedModel.trim());

export const selectFallbackProfileId = <T extends { id: string; lastUsedAt?: number; verificationStatus: VerificationStatus }>(profiles: T[]) =>
  [...profiles]
    .filter((profile) => profile.verificationStatus === "success")
    .sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0))[0]?.id ?? null;
