import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, History, LoaderCircle, Settings, ShieldCheck, WandSparkles } from "lucide-react";
import { fetchModels, generateImage, isUnsupportedSizeError, normalizeApiBase, polishPrompt } from "./api";
import { BrandMark } from "./brand";
import {
  DEFAULT_CREATION_DRAFT,
  DEFAULT_PROVIDER_STORE,
  IMAGE_MODEL,
  hasExactModel,
  needsMaxHighConfirmation,
  selectFallbackProfileId,
  type AppView,
  type CreationDraftV2,
  type GenerationOptions,
  type GenerationRecordV2,
  type ImageApiProfile,
  type Notice,
  type PolishProvenance,
  type ProviderStoreV3,
  type TextApiProfile,
  type ThemeMode,
} from "./domain";
import { readImageDimensions, saveRecordToGallery } from "./media";
import { notifyLaunchReady } from "./launch";
import {
  createId,
  deleteGenerationRecord,
  deleteImageProfileSecret,
  deleteTextProfileSecret,
  getImageProfileSecret,
  getTextProfileSecret,
  hasImageProfileSecret,
  hasTextProfileSecret,
  loadCreationDraft,
  loadGenerationHistory,
  loadProviderStore,
  persistImageForHistory,
  saveAppPreferences,
  saveCreationDraft,
  saveGenerationRecord,
  saveProviderStore,
  setImageProfileSecret,
  setTextProfileSecret,
} from "./storage";
import { applyTheme } from "./theme";
import {
  CreateView,
  HistoryView,
  ImageProviderSheet,
  ImageViewer,
  PolishDialog,
  SettingsView,
  type ImageEditorValue,
  type RequestedEditor,
  type TextEditorValue,
} from "./views";

const mergeHistory = (records: GenerationRecordV2[]) =>
  [...new Map(records.map((record) => [record.id, record])).values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, 24);

const profileSnapshot = <T extends ImageApiProfile | TextApiProfile>(profile: T): T => ({ ...profile });

export default function App({ initialTheme = "dark" }: { initialTheme?: ThemeMode }) {
  const [booting, setBooting] = useState(true);
  const [view, setView] = useState<AppView>("create");
  const [theme, setTheme] = useState<ThemeMode>(initialTheme);
  const [providerStore, setProviderStoreState] = useState<ProviderStoreV3>(DEFAULT_PROVIDER_STORE);
  const [imageSecretPresence, setImageSecretPresence] = useState<Record<string, boolean>>({});
  const [textSecretPresence, setTextSecretPresence] = useState<Record<string, boolean>>({});
  const [textModelOptions, setTextModelOptions] = useState<Record<string, string[]>>({});
  const [requestedEditor, setRequestedEditor] = useState<RequestedEditor>(null);
  const [imageSheetOpen, setImageSheetOpen] = useState(false);
  const [settingsNotice, setSettingsNotice] = useState<Notice | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);

  const [draft, setDraft] = useState<CreationDraftV2>(DEFAULT_CREATION_DRAFT);
  const [acceptedPolish, setAcceptedPolish] = useState<{ original: string; polished: string; provenance: PolishProvenance }>();
  const [polishComparison, setPolishComparison] = useState<{ original: string; polished: string; provenance: PolishProvenance } | null>(null);
  const [isPolishing, setIsPolishing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationNotice, setGenerationNotice] = useState<Notice | null>(null);
  const [result, setResult] = useState<GenerationRecordV2 | null>(null);
  const [history, setHistory] = useState<GenerationRecordV2[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyNotice, setHistoryNotice] = useState<Notice | null>(null);
  const [viewerRecord, setViewerRecord] = useState<GenerationRecordV2 | null>(null);
  const providerStoreRef = useRef(providerStore);

  const activeImageProfile = useMemo(() => providerStore.imageProfiles.find((item) => item.id === providerStore.activeImageProfileId) ?? null, [providerStore]);
  const activeTextProfile = useMemo(() => providerStore.textProfiles.find((item) => item.id === providerStore.activeTextProfileId) ?? null, [providerStore]);
  const imageSecretReady = activeImageProfile ? Boolean(imageSecretPresence[activeImageProfile.id]) : false;
  const textSecretReady = activeTextProfile ? Boolean(textSecretPresence[activeTextProfile.id]) : false;
  const busy = isGenerating || isPolishing || profileBusy;

  const commitProviderStore = async (next: ProviderStoreV3) => {
    providerStoreRef.current = next;
    setProviderStoreState(next);
    await saveProviderStore(next);
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadProviderStore(), loadCreationDraft(), loadGenerationHistory()])
      .then(async ([store, loadedDraft, records]) => {
        const [imageSecrets, textSecrets] = await Promise.all([
          Promise.all(store.imageProfiles.map(async (profile) => [profile.id, await hasImageProfileSecret(profile.id)] as const)),
          Promise.all(store.textProfiles.map(async (profile) => [profile.id, await hasTextProfileSecret(profile.id)] as const)),
        ]);
        if (cancelled) return;
        providerStoreRef.current = store;
        setProviderStoreState(store);
        setDraft(loadedDraft);
        setHistory(mergeHistory(records));
        setImageSecretPresence(Object.fromEntries(imageSecrets));
        setTextSecretPresence(Object.fromEntries(textSecrets));
      })
      .catch((error) => { if (!cancelled) setSettingsNotice({ tone: "error", text: error instanceof Error ? error.message : "应用数据初始化失败。" }); })
      .finally(() => { if (!cancelled) { setBooting(false); setHistoryLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  useLayoutEffect(() => {
    if (!booting) void notifyLaunchReady();
  }, [booting]);

  useEffect(() => {
    if (booting) return;
    const timer = window.setTimeout(() => void saveCreationDraft(draft).catch(() => undefined), 250);
    return () => window.clearTimeout(timer);
  }, [draft, booting]);

  const updateTheme = (next: ThemeMode) => {
    setTheme(next);
    void applyTheme(next).catch(() => undefined);
    void saveAppPreferences({ version: 1, theme: next }).catch(() => undefined);
  };

  const validateBase = (nameValue: string, baseUrlValue: string) => {
    const name = nameValue.trim();
    if (!name) throw new Error("配置名称不能为空。");
    if (name.length > 40) throw new Error("配置名称不能超过 40 个字符。");
    return { name, baseUrl: normalizeApiBase(baseUrlValue) };
  };

  const saveImageDraft = async (value: ImageEditorValue) => {
    const normalized = validateBase(value.name, value.baseUrl);
    setProfileBusy(true);
    try {
      const current = providerStoreRef.current;
      const existing = value.id ? current.imageProfiles.find((item) => item.id === value.id) : undefined;
      const now = Date.now();
      const profile: ImageApiProfile = {
        id: existing?.id ?? createId(), name: normalized.name, baseUrl: normalized.baseUrl,
        createdAt: existing?.createdAt ?? now, updatedAt: now, lastUsedAt: existing?.lastUsedAt,
        verificationStatus: "unverified", verificationMessage: "草稿已修改，请重新测试连接。",
        fourKStatus: existing?.baseUrl === normalized.baseUrl ? existing.fourKStatus : "unknown",
      };
      if (value.apiKey.trim()) await setImageProfileSecret(profile.id, value.apiKey);
      const imageProfiles = existing ? current.imageProfiles.map((item) => item.id === profile.id ? profile : item) : [...current.imageProfiles, profile];
      await commitProviderStore({ ...current, imageProfiles });
      setImageSecretPresence((state) => ({ ...state, [profile.id]: Boolean(value.apiKey.trim()) || Boolean(state[profile.id]) }));
      return profile;
    } finally { setProfileBusy(false); }
  };

  const testImageActivate = async (value: ImageEditorValue) => {
    const normalized = validateBase(value.name, value.baseUrl);
    setProfileBusy(true);
    try {
      const current = providerStoreRef.current;
      const existing = value.id ? current.imageProfiles.find((item) => item.id === value.id) : undefined;
      const id = existing?.id ?? createId();
      const apiKey = value.apiKey.trim() || (existing ? await getImageProfileSecret(existing.id) : "");
      if (!apiKey) throw new Error("请输入图片 API 密钥后再测试连接。");
      const models = await fetchModels(normalized.baseUrl, apiKey);
      if (!models.includes(IMAGE_MODEL)) throw new Error("模型列表中没有精确 ID gpt-image-2，当前配置不能启用生图。");
      const now = Date.now();
      const profile: ImageApiProfile = {
        id, name: normalized.name, baseUrl: normalized.baseUrl, createdAt: existing?.createdAt ?? now, updatedAt: now,
        lastUsedAt: now, lastVerifiedAt: now, verificationStatus: "success", verificationMessage: "gpt-image-2 已验证。",
        fourKStatus: existing?.baseUrl === normalized.baseUrl ? existing.fourKStatus : "unknown",
      };
      await setImageProfileSecret(id, apiKey);
      const imageProfiles = existing ? current.imageProfiles.map((item) => item.id === id ? profile : item) : [...current.imageProfiles, profile];
      await commitProviderStore({ ...current, imageProfiles, activeImageProfileId: id });
      setImageSecretPresence((state) => ({ ...state, [id]: true }));
      setSettingsNotice({ tone: "success", text: `${profile.name} 已验证并设为当前图片供应商。` });
      return profile;
    } finally { setProfileBusy(false); }
  };

  const saveTextDraft = async (value: TextEditorValue) => {
    const normalized = validateBase(value.name, value.baseUrl);
    setProfileBusy(true);
    try {
      const current = providerStoreRef.current;
      const existing = value.id ? current.textProfiles.find((item) => item.id === value.id) : undefined;
      const now = Date.now();
      const profile: TextApiProfile = {
        id: existing?.id ?? createId(), name: normalized.name, baseUrl: normalized.baseUrl,
        selectedModel: value.selectedModel.trim() || undefined, createdAt: existing?.createdAt ?? now, updatedAt: now,
        lastUsedAt: existing?.lastUsedAt, verificationStatus: "unverified", verificationMessage: "草稿已修改，请重新读取模型列表。",
      };
      if (value.apiKey.trim()) await setTextProfileSecret(profile.id, value.apiKey);
      const textProfiles = existing ? current.textProfiles.map((item) => item.id === profile.id ? profile : item) : [...current.textProfiles, profile];
      await commitProviderStore({ ...current, textProfiles });
      setTextSecretPresence((state) => ({ ...state, [profile.id]: Boolean(value.apiKey.trim()) || Boolean(state[profile.id]) }));
      return profile;
    } finally { setProfileBusy(false); }
  };

  const testTextConnection = async (value: TextEditorValue) => {
    const normalized = validateBase(value.name, value.baseUrl);
    setProfileBusy(true);
    try {
      const current = providerStoreRef.current;
      const existing = value.id ? current.textProfiles.find((item) => item.id === value.id) : undefined;
      const id = existing?.id ?? createId();
      const apiKey = value.apiKey.trim() || (existing ? await getTextProfileSecret(existing.id) : "");
      if (!apiKey) throw new Error("请输入文本 API 密钥后再测试连接。");
      const models = await fetchModels(normalized.baseUrl, apiKey);
      const now = Date.now();
      const profile: TextApiProfile = {
        id, name: normalized.name, baseUrl: normalized.baseUrl, selectedModel: value.selectedModel.trim() || existing?.selectedModel,
        createdAt: existing?.createdAt ?? now, updatedAt: now, lastUsedAt: existing?.lastUsedAt,
        verificationStatus: "unverified", verificationMessage: "模型列表已读取，请选择模型并启用。",
      };
      await setTextProfileSecret(id, apiKey);
      const textProfiles = existing ? current.textProfiles.map((item) => item.id === id ? profile : item) : [...current.textProfiles, profile];
      await commitProviderStore({ ...current, textProfiles });
      setTextSecretPresence((state) => ({ ...state, [id]: true }));
      setTextModelOptions((state) => ({ ...state, [id]: models }));
      return { profile, models };
    } finally { setProfileBusy(false); }
  };

  const activateTextFromEditor = async (value: TextEditorValue, models: string[]) => {
    const normalized = validateBase(value.name, value.baseUrl);
    const model = value.selectedModel.trim();
    if (!model || !hasExactModel(models, model)) throw new Error("所选模型必须精确出现在本次验证的模型列表中。");
    setProfileBusy(true);
    try {
      const current = providerStoreRef.current;
      const existing = value.id ? current.textProfiles.find((item) => item.id === value.id) : undefined;
      if (!existing) throw new Error("请先测试连接并读取模型列表。");
      const apiKey = value.apiKey.trim() || await getTextProfileSecret(existing.id);
      if (!apiKey) throw new Error("当前文本配置缺少密钥。");
      const now = Date.now();
      const profile: TextApiProfile = { ...existing, name: normalized.name, baseUrl: normalized.baseUrl, selectedModel: model, updatedAt: now,
        lastUsedAt: now, lastVerifiedAt: now, verificationStatus: "success", verificationMessage: `模型 ${model} 已验证。` };
      if (value.apiKey.trim()) await setTextProfileSecret(profile.id, value.apiKey);
      const textProfiles = current.textProfiles.map((item) => item.id === profile.id ? profile : item);
      await commitProviderStore({ ...current, textProfiles, activeTextProfileId: profile.id });
      setTextSecretPresence((state) => ({ ...state, [profile.id]: true }));
      setSettingsNotice({ tone: "success", text: `${profile.name} / ${model} 已设为当前润色模型。` });
      return profile;
    } finally { setProfileBusy(false); }
  };

  const openSettingsEditor = (kind?: "image" | "text", profileId?: string) => {
    setImageSheetOpen(false);
    setRequestedEditor(kind ? { kind, profileId } : null);
    setView("settings");
  };

  const activateImage = async (profile: ImageApiProfile) => {
    if (busy) return;
    if (profile.verificationStatus !== "success" || !await hasImageProfileSecret(profile.id)) {
      openSettingsEditor("image", profile.id);
      setSettingsNotice({ tone: "info", text: `${profile.name} 需要重新输入密钥或完成验证。` });
      return;
    }
    const now = Date.now();
    const imageProfiles = providerStoreRef.current.imageProfiles.map((item) => item.id === profile.id ? { ...item, lastUsedAt: now } : item);
    await commitProviderStore({ ...providerStoreRef.current, imageProfiles, activeImageProfileId: profile.id });
    setGenerationNotice({ tone: "success", text: `已切换到 ${profile.name}。` });
  };

  const refreshTextModels = async (profile: TextApiProfile) => {
    const apiKey = await getTextProfileSecret(profile.id);
    if (!apiKey) throw new Error(`${profile.name} 在当前会话中缺少文本密钥。`);
    const models = await fetchModels(profile.baseUrl, apiKey);
    setTextModelOptions((state) => ({ ...state, [profile.id]: models }));
  };

  const selectTextModel = async (profile: TextApiProfile, model: string) => {
    if (busy) return;
    const models = textModelOptions[profile.id];
    if (!models?.includes(model) || !await hasTextProfileSecret(profile.id)) {
      openSettingsEditor("text", profile.id);
      setSettingsNotice({ tone: "info", text: `${profile.name} 需要重新验证模型或补充文本密钥。` });
      return;
    }
    const now = Date.now();
    const textProfiles = providerStoreRef.current.textProfiles.map((item) => item.id === profile.id ? {
      ...item, selectedModel: model, lastUsedAt: now, lastVerifiedAt: now, updatedAt: now,
      verificationStatus: "success" as const, verificationMessage: `模型 ${model} 已验证。`,
    } : item);
    await commitProviderStore({ ...providerStoreRef.current, textProfiles, activeTextProfileId: profile.id });
    setGenerationNotice({ tone: "success", text: `润色模型已切换为 ${profile.name} / ${model}。` });
  };

  const activateExistingText = async (profile: TextApiProfile) => {
    if (!profile.selectedModel || profile.verificationStatus !== "success" || !await hasTextProfileSecret(profile.id)) {
      openSettingsEditor("text", profile.id);
      return;
    }
    const now = Date.now();
    const textProfiles = providerStoreRef.current.textProfiles.map((item) => item.id === profile.id ? { ...item, lastUsedAt: now } : item);
    await commitProviderStore({ ...providerStoreRef.current, textProfiles, activeTextProfileId: profile.id });
  };

  const deleteImageProfile = async (profile: ImageApiProfile) => {
    if (!window.confirm(`确定删除图片供应商“${profile.name}”吗？`)) return;
    setProfileBusy(true);
    try {
      await deleteImageProfileSecret(profile.id);
      const imageProfiles = providerStoreRef.current.imageProfiles.filter((item) => item.id !== profile.id);
      const activeImageProfileId = providerStoreRef.current.activeImageProfileId === profile.id ? selectFallbackProfileId(imageProfiles) : providerStoreRef.current.activeImageProfileId;
      await commitProviderStore({ ...providerStoreRef.current, imageProfiles, activeImageProfileId });
      setImageSecretPresence((state) => { const next = { ...state }; delete next[profile.id]; return next; });
      setSettingsNotice({ tone: "success", text: "图片供应商已删除，文本供应商和历史记录未受影响。" });
    } finally { setProfileBusy(false); }
  };

  const deleteTextProfile = async (profile: TextApiProfile) => {
    if (!window.confirm(`确定删除文本供应商“${profile.name}”吗？`)) return;
    setProfileBusy(true);
    try {
      await deleteTextProfileSecret(profile.id);
      const textProfiles = providerStoreRef.current.textProfiles.filter((item) => item.id !== profile.id);
      const activeTextProfileId = providerStoreRef.current.activeTextProfileId === profile.id ? selectFallbackProfileId(textProfiles) : providerStoreRef.current.activeTextProfileId;
      await commitProviderStore({ ...providerStoreRef.current, textProfiles, activeTextProfileId });
      setTextSecretPresence((state) => { const next = { ...state }; delete next[profile.id]; return next; });
      setTextModelOptions((state) => { const next = { ...state }; delete next[profile.id]; return next; });
      setSettingsNotice({ tone: "success", text: "文本供应商已删除，图片供应商和历史记录未受影响。" });
    } finally { setProfileBusy(false); }
  };

  const confirmMaxHigh = async (options: GenerationOptions) => {
    if (!needsMaxHighConfirmation(options, providerStoreRef.current.hasConfirmedMaxHigh)) return true;
    const accepted = window.confirm("最高分辨率配合 High 可能显著增加生成耗时和费用，且属于实验能力。是否继续？");
    if (!accepted) return false;
    await commitProviderStore({ ...providerStoreRef.current, hasConfirmedMaxHigh: true });
    return true;
  };

  const changeOption = <K extends keyof GenerationOptions>(field: K, value: GenerationOptions[K]) => {
    const next = { ...draft, [field]: value };
    if (needsMaxHighConfirmation(next, providerStoreRef.current.hasConfirmedMaxHigh)) void confirmMaxHigh(next).then((accepted) => { if (accepted) setDraft(next); });
    else setDraft(next);
  };

  const handlePolish = async () => {
    if (!activeTextProfile?.selectedModel || isPolishing || isGenerating) return;
    const snapshot = profileSnapshot(activeTextProfile);
    const textModel = activeTextProfile.selectedModel;
    const original = draft.prompt.trim();
    const options: GenerationOptions = { ratio: draft.ratio, resolutionTier: draft.resolutionTier, quality: draft.quality };
    setIsPolishing(true);
    setGenerationNotice({ tone: "info", text: `正在使用 ${snapshot.name} / ${snapshot.selectedModel} 润色。` });
    try {
      const apiKey = await getTextProfileSecret(snapshot.id);
      if (!apiKey) throw new Error("当前文本供应商缺少密钥。");
      const polished = await polishPrompt({ baseUrl: snapshot.baseUrl, apiKey, model: textModel, prompt: original, options });
      setPolishComparison({ original, polished, provenance: { textProfileId: snapshot.id, textProfileName: snapshot.name, model: textModel } });
      setGenerationNotice(null);
    } catch (error) { setGenerationNotice({ tone: "error", text: error instanceof Error ? error.message : "AI 润色失败，原文未改变。" }); }
    finally { setIsPolishing(false); }
  };

  const updateImageProfile = async (profileId: string, patch: Partial<ImageApiProfile>) => {
    const current = providerStoreRef.current;
    const imageProfiles = current.imageProfiles.map((profile) => profile.id === profileId ? { ...profile, ...patch, updatedAt: Date.now() } : profile);
    await commitProviderStore({ ...current, imageProfiles });
  };

  const handleGenerate = async () => {
    if (!activeImageProfile || isGenerating || isPolishing) return;
    const requestPrompt = draft.prompt.trim();
    if (!requestPrompt) { setGenerationNotice({ tone: "error", text: "请先填写图片提示词。" }); return; }
    const options: GenerationOptions = { ratio: draft.ratio, resolutionTier: draft.resolutionTier, quality: draft.quality };
    if (!await confirmMaxHigh(options)) return;
    const profile = profileSnapshot(activeImageProfile);
    const polishTrace = acceptedPolish?.polished === requestPrompt ? acceptedPolish : undefined;
    const id = createId();
    setIsGenerating(true); setResult(null); setGenerationNotice({ tone: "info", text: `请求已提交到 ${profile.name}。` });
    try {
      const apiKey = await getImageProfileSecret(profile.id);
      if (!apiKey) throw new Error("当前图片供应商缺少密钥。");
      const generated = await generateImage({ baseUrl: profile.baseUrl, apiKey, prompt: requestPrompt, options });
      let dimensions: { width: number; height: number } | undefined;
      try { dimensions = await readImageDimensions(generated.imageUri); } catch { dimensions = undefined; }
      const memoryRecord: GenerationRecordV2 = {
        id, createdAt: Date.now(), originalPrompt: polishTrace?.original, prompt: requestPrompt, polishProvenance: polishTrace?.provenance,
        modelRevisedPrompt: generated.modelRevisedPrompt, ratio: options.ratio, resolutionTier: options.resolutionTier,
        requestedSize: generated.requestedSize, actualWidth: dimensions?.width, actualHeight: dimensions?.height,
        quality: options.quality, model: IMAGE_MODEL, profileId: profile.id, profileName: profile.name,
        imageUri: generated.imageUri, mimeType: generated.mimeType, byteSize: generated.byteSize,
        storageKind: generated.isLocalData ? "indexeddb" : "remote",
      };
      setResult(memoryRecord);
      let stored = false;
      try {
        const persisted = await persistImageForHistory({ id, imageUri: generated.imageUri, mimeType: generated.mimeType, byteSize: generated.byteSize });
        const record = { ...memoryRecord, ...persisted };
        const kept = await saveGenerationRecord(record);
        setResult(record); setHistory(mergeHistory(kept)); stored = true;
      } catch { stored = false; }
      const actual = dimensions ? `${dimensions.width}x${dimensions.height}` : undefined;
      const mismatch = actual && actual !== generated.requestedSize;
      setGenerationNotice({ tone: stored ? "success" : "info", text: stored ? mismatch ? `已保存。请求 ${generated.requestedSize}，上游实际返回 ${actual}。` : "图片已生成并保存到本地历史。" : "生成成功，但未写入历史，请先保存当前图片。" });
      await updateImageProfile(profile.id, { lastUsedAt: Date.now(), ...(options.resolutionTier === "max" ? { fourKStatus: "supported" as const } : {}) });
    } catch (error) {
      if (options.resolutionTier === "max" && isUnsupportedSizeError(error)) { await updateImageProfile(profile.id, { fourKStatus: "unsupported" }); setGenerationNotice({ tone: "error", text: "上游拒绝了该最高尺寸，未自动重试。请手动选择 2K 或标准。" }); }
      else setGenerationNotice({ tone: "error", text: error instanceof Error ? error.message : "图片生成失败，请稍后重试。" });
    } finally { setIsGenerating(false); }
  };

  const handleDeleteRecord = async (record: GenerationRecordV2) => {
    if (!window.confirm("确定删除这条记录和应用私有原图吗？系统相册中的副本不会删除。")) return;
    try { await deleteGenerationRecord(record); setHistory((items) => items.filter((item) => item.id !== record.id)); if (result?.id === record.id) setResult(null); setHistoryNotice({ tone: "success", text: "历史记录和应用私有原图已删除。" }); }
    catch { setHistoryNotice({ tone: "error", text: "删除失败，请稍后重试。" }); }
  };

  if (booting) return <div className="boot-screen"><BrandMark className="boot-mark" /><LoaderCircle className="spin" size={22} /><p>正在加载本地配置</p></div>;

  return <div className="app-shell">
    <header className="app-header"><div className="brand-lockup"><span className="brand-mark"><BrandMark /></span><h1>DreamCanvas</h1></div>
      <button className={`header-status ${activeImageProfile && imageSecretReady ? "ready" : ""}`} type="button" disabled={busy} onClick={() => setImageSheetOpen(true)}>
        {activeImageProfile && imageSecretReady ? <ShieldCheck size={16} /> : <AlertCircle size={16} />}<span>{activeImageProfile?.name ?? "图片供应商"}</span><ChevronIndicator /></button></header>
    <main className="app-main">
      {view === "create" ? <CreateView activeImageProfile={activeImageProfile} activeTextProfile={activeTextProfile} imageSecretReady={imageSecretReady} textSecretReady={textSecretReady}
        textProfiles={providerStore.textProfiles} textSecretPresence={textSecretPresence} textModels={textModelOptions} prompt={draft.prompt} options={draft} result={result} notice={generationNotice}
        isGenerating={isGenerating} isPolishing={isPolishing} onPromptChange={(prompt) => { setDraft((current) => ({ ...current, prompt })); if (acceptedPolish && prompt !== acceptedPolish.polished) setAcceptedPolish(undefined); if (generationNotice?.tone === "error") setGenerationNotice(null); }}
        onOptionChange={changeOption} onGenerate={() => void handleGenerate()} onPolish={() => void handlePolish()} onOpenSettings={openSettingsEditor}
        onRefreshTextModels={refreshTextModels} onSelectTextModel={(profile, model) => void selectTextModel(profile, model)} onOpenImage={setViewerRecord} /> : null}
      {view === "history" ? <HistoryView records={history} loading={historyLoading} notice={historyNotice} onOpen={setViewerRecord} onDelete={(record) => void handleDeleteRecord(record)} onCreate={() => setView("create")} /> : null}
      {view === "settings" ? <SettingsView imageProfiles={providerStore.imageProfiles} textProfiles={providerStore.textProfiles} activeImageProfile={activeImageProfile} activeTextProfile={activeTextProfile}
        imageSecretPresence={imageSecretPresence} textSecretPresence={textSecretPresence} textModels={textModelOptions} requestedEditor={requestedEditor} theme={theme} notice={settingsNotice} busy={busy}
        onThemeChange={updateTheme} onSaveImageDraft={saveImageDraft} onTestImageActivate={testImageActivate} onSaveTextDraft={saveTextDraft} onTestText={testTextConnection}
        onActivateText={activateTextFromEditor} onActivateImage={(profile) => void activateImage(profile)} onActivateExistingText={(profile) => void activateExistingText(profile)}
        onRefreshTextModels={refreshTextModels} onSelectTextModel={(profile, model) => void selectTextModel(profile, model)}
        onDeleteImage={(profile) => void deleteImageProfile(profile)} onDeleteText={(profile) => void deleteTextProfile(profile)} onEditorHandled={() => setRequestedEditor(null)} /> : null}
    </main>
    <nav className="bottom-nav" aria-label="主导航"><button className={view === "create" ? "active" : ""} onClick={() => setView("create")}><WandSparkles size={20} /><span>创作</span></button><button className={view === "history" ? "active" : ""} onClick={() => setView("history")}><History size={20} /><span>历史</span></button><button className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}><Settings size={20} /><span>设置</span></button></nav>
    {imageSheetOpen ? <ImageProviderSheet profiles={providerStore.imageProfiles} activeId={activeImageProfile?.id ?? null} secretPresence={imageSecretPresence} busy={busy} onDismiss={() => setImageSheetOpen(false)} onActivate={(profile) => void activateImage(profile)} onEdit={(profile) => openSettingsEditor("image", profile?.id)} /> : null}
    {polishComparison ? <PolishDialog original={polishComparison.original} polished={polishComparison.polished} onAccept={() => { setAcceptedPolish(polishComparison); setDraft((current) => ({ ...current, prompt: polishComparison.polished })); setPolishComparison(null); setGenerationNotice({ tone: "success", text: "已替换为润色结果，请确认后开始生成。" }); }} onKeep={() => setPolishComparison(null)} /> : null}
    {viewerRecord ? <ImageViewer record={viewerRecord} onClose={() => setViewerRecord(null)} onSave={saveRecordToGallery} /> : null}
  </div>;
}

function ChevronIndicator() { return <span aria-hidden="true" className="chevron-indicator">⌄</span>; }
