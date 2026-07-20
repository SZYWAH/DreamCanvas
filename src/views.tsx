import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  Edit3,
  Eye,
  EyeOff,
  History,
  Image as ImageIcon,
  KeyRound,
  LoaderCircle,
  Maximize2,
  Moon,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trash2,
  WandSparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { displayImageSize, getResolutionLabel, qualityLabel, resolveImageSize } from "./api";
import {
  IMAGE_MODEL,
  aspectRatios,
  imageQualities,
  resolutionTiers,
  type GenerationOptions,
  type GenerationRecordV2,
  type ImageApiProfile,
  type Notice,
  type TextApiProfile,
  type ThemeMode,
} from "./domain";
import { Overlay } from "./overlays";
import { resolveDisplayImageUri } from "./storage";

export const formatDateTime = (timestamp?: number) => {
  if (!timestamp) return "尚未验证";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
};

const hostname = (baseUrl: string) => {
  try { return new URL(baseUrl).hostname; } catch { return baseUrl; }
};

export function StatusMessage({ notice, compact = false }: { notice: Notice | null; compact?: boolean }) {
  if (!notice) return null;
  const Icon = notice.tone === "success" ? CheckCircle2 : AlertCircle;
  return (
    <div className={`status-message ${notice.tone} ${compact ? "compact" : ""}`} role={notice.tone === "error" ? "alert" : "status"}>
      <Icon size={17} aria-hidden="true" />
      <span>{notice.text}</span>
    </div>
  );
}

function VerificationBadge({ status }: { status: ImageApiProfile["verificationStatus"] }) {
  const label = status === "success" ? "已验证" : status === "error" ? "验证失败" : "待验证";
  return <span className={`verification-badge ${status}`}>{status === "success" ? <Check size={13} /> : <AlertCircle size={13} />}{label}</span>;
}

interface ImageProviderSheetProps {
  profiles: ImageApiProfile[];
  activeId: string | null;
  secretPresence: Record<string, boolean>;
  busy: boolean;
  onDismiss: () => void;
  onActivate: (profile: ImageApiProfile) => void;
  onEdit: (profile?: ImageApiProfile) => void;
}

export function ImageProviderSheet({ profiles, activeId, secretPresence, busy, onDismiss, onActivate, onEdit }: ImageProviderSheetProps) {
  return (
    <Overlay title="图片供应商" eyebrow="选择生成线路" onDismiss={onDismiss}>
      {(close) => (
        <div className="sheet-content">
          <div className="provider-choice-list">
            {profiles.map((profile) => {
              const active = profile.id === activeId;
              return (
                <button
                  type="button"
                  className={`provider-choice ${active ? "active" : ""}`}
                  key={profile.id}
                  disabled={busy}
                  onClick={() => close(() => onActivate(profile))}
                >
                  <span className="provider-choice-icon"><ImageIcon size={19} /></span>
                  <span className="provider-choice-copy">
                    <strong>{profile.name}</strong>
                    <small>{hostname(profile.baseUrl)} · gpt-image-2</small>
                    <span><VerificationBadge status={profile.verificationStatus} /> {secretPresence[profile.id] ? "密钥可用" : "缺少密钥"}</span>
                  </span>
                  <span className="provider-choice-side">
                    {active ? <span className="current-chip">当前</span> : <ChevronRight size={18} />}
                    <small>最高档 {profile.fourKStatus === "supported" ? "已验证" : profile.fourKStatus === "unsupported" ? "不支持" : "未知"}</small>
                  </span>
                </button>
              );
            })}
          </div>
          {!profiles.length ? <div className="empty-panel"><ImageIcon size={24} /><p>还没有图片供应商。</p></div> : null}
          <button type="button" className="secondary-button wide" onClick={() => close(() => onEdit())}><Plus size={18} /> 添加图片供应商</button>
        </div>
      )}
    </Overlay>
  );
}

interface TextProviderModelSheetProps {
  profiles: TextApiProfile[];
  activeId: string | null;
  secretPresence: Record<string, boolean>;
  models: Record<string, string[]>;
  busy: boolean;
  onDismiss: () => void;
  onRefreshModels: (profile: TextApiProfile) => Promise<void>;
  onSelect: (profile: TextApiProfile, model: string) => void;
  onEdit: (profile?: TextApiProfile) => void;
}

export function TextProviderModelSheet({
  profiles, activeId, secretPresence, models, busy, onDismiss, onRefreshModels, onSelect, onEdit,
}: TextProviderModelSheetProps) {
  const [selectedId, setSelectedId] = useState(activeId ?? profiles[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const selected = profiles.find((profile) => profile.id === selectedId) ?? null;
  const available = selected ? models[selected.id] ?? [] : [];
  const filtered = available.filter((model) => model.toLowerCase().includes(query.trim().toLowerCase()));

  const chooseProvider = async (profile: TextApiProfile) => {
    setSelectedId(profile.id);
    setQuery("");
    setError(undefined);
    if (!secretPresence[profile.id]) return;
    setLoading(true);
    try { await onRefreshModels(profile); } catch (reason) {
      setError(reason instanceof Error ? reason.message : "模型列表加载失败。");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (selected && secretPresence[selected.id] && !models[selected.id]) void chooseProvider(selected);
    // Initial refresh only. Provider changes are handled by chooseProvider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Overlay title="润色模型" eyebrow="独立文本上游" onDismiss={onDismiss} className="model-sheet">
      {(close) => (
        <div className="sheet-content model-picker">
          {profiles.length ? (
            <div className="provider-tabs" role="tablist" aria-label="文本供应商">
              {profiles.map((profile) => (
                <button type="button" role="tab" aria-selected={selectedId === profile.id} className={selectedId === profile.id ? "active" : ""}
                  key={profile.id} disabled={busy || loading} onClick={() => void chooseProvider(profile)}>{profile.name}</button>
              ))}
            </div>
          ) : null}

          {!selected ? (
            <div className="empty-panel"><Sparkles size={24} /><p>添加独立文本供应商后，才可使用 AI 润色。</p></div>
          ) : !secretPresence[selected.id] ? (
            <div className="empty-panel"><KeyRound size={24} /><p>{selected.name} 在当前会话缺少文本密钥。</p>
              <button className="text-button" type="button" onClick={() => close(() => onEdit(selected))}>编辑配置</button></div>
          ) : (
            <>
              <label className="model-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索模型" /></label>
              {loading ? <div className="inline-loading"><LoaderCircle className="spin" size={19} /> 正在获取模型列表</div> : null}
              {error ? <div className="inline-error"><span>{error}</span><button type="button" onClick={() => void chooseProvider(selected)}><RefreshCw size={15} /> 重试</button></div> : null}
              {!loading && !error ? (
                <div className="model-list" role="listbox" aria-label={`${selected.name} 模型`}>
                  {filtered.map((model) => (
                    <button type="button" role="option" aria-selected={selected.selectedModel === model} key={model}
                      className={selected.selectedModel === model && selected.id === activeId ? "active" : ""}
                      onClick={() => close(() => onSelect(selected, model))}>
                      <span><strong>{model}</strong><small>{selected.name}</small></span>
                      {selected.selectedModel === model && selected.id === activeId ? <Check size={18} /> : <ChevronRight size={17} />}
                    </button>
                  ))}
                  {!filtered.length ? <p className="list-empty">没有匹配的模型。</p> : null}
                </div>
              ) : null}
            </>
          )}
          <button type="button" className="secondary-button wide" onClick={() => close(() => onEdit())}><Plus size={18} /> 添加文本供应商</button>
        </div>
      )}
    </Overlay>
  );
}

interface ParameterSheetProps {
  options: GenerationOptions;
  onChange: <K extends keyof GenerationOptions>(field: K, value: GenerationOptions[K]) => void;
  onDismiss: () => void;
}

export function ParameterSheet({ options, onChange, onDismiss }: ParameterSheetProps) {
  return (
    <Overlay title="生成参数" eyebrow="图片规格" onDismiss={onDismiss}>
      {() => (
        <div className="sheet-content parameter-sheet-content">
          <ParameterGroup label="画面比例" detail={`请求 ${displayImageSize(resolveImageSize(options.ratio, options.resolutionTier))}`}>
            <div className="segmented-options ratio-options">
              {aspectRatios.map((ratio) => <button key={ratio} type="button" className={options.ratio === ratio ? "active" : ""}
                aria-pressed={options.ratio === ratio} onClick={() => onChange("ratio", ratio)}>{ratio}</button>)}
            </div>
          </ParameterGroup>
          <ParameterGroup label="分辨率" detail="最高档取决于上游透传能力">
            <div className="resolution-options">
              {resolutionTiers.map((tier) => <button key={tier} type="button" className={options.resolutionTier === tier ? "active" : ""}
                aria-pressed={options.resolutionTier === tier} onClick={() => onChange("resolutionTier", tier)}>
                <strong>{getResolutionLabel(options.ratio, tier)}</strong><span>{displayImageSize(resolveImageSize(options.ratio, tier))}</span>
              </button>)}
            </div>
          </ParameterGroup>
          <ParameterGroup label="画质" detail="画质与像素尺寸分别传递">
            <div className="segmented-options quality-options">
              {imageQualities.map((quality) => <button key={quality} type="button" className={options.quality === quality ? "active" : ""}
                aria-pressed={options.quality === quality} onClick={() => onChange("quality", quality)}>{qualityLabel(quality)}</button>)}
            </div>
          </ParameterGroup>
          {options.resolutionTier === "max" ? <p className="experimental-note"><AlertCircle size={15} /> 实验档可能耗时更长、费用更高，部分中转上游可能不支持。</p> : null}
        </div>
      )}
    </Overlay>
  );
}

function ParameterGroup({ label, detail, children }: { label: string; detail: string; children: React.ReactNode }) {
  return <div className="parameter-group"><div className="field-label-row"><span>{label}</span><small>{detail}</small></div>{children}</div>;
}

interface CreateViewProps {
  activeImageProfile: ImageApiProfile | null;
  activeTextProfile: TextApiProfile | null;
  imageSecretReady: boolean;
  textSecretReady: boolean;
  textProfiles: TextApiProfile[];
  textSecretPresence: Record<string, boolean>;
  textModels: Record<string, string[]>;
  prompt: string;
  options: GenerationOptions;
  result: GenerationRecordV2 | null;
  notice: Notice | null;
  isGenerating: boolean;
  isPolishing: boolean;
  onPromptChange: (value: string) => void;
  onOptionChange: <K extends keyof GenerationOptions>(field: K, value: GenerationOptions[K]) => void;
  onGenerate: () => void;
  onPolish: () => void;
  onOpenSettings: (kind?: "image" | "text", profileId?: string) => void;
  onRefreshTextModels: (profile: TextApiProfile) => Promise<void>;
  onSelectTextModel: (profile: TextApiProfile, model: string) => void;
  onOpenImage: (record: GenerationRecordV2) => void;
}

export function CreateView(props: CreateViewProps) {
  const {
    activeImageProfile, activeTextProfile, imageSecretReady, textSecretReady, textProfiles, textSecretPresence, textModels,
    prompt, options, result, notice, isGenerating, isPolishing, onPromptChange, onOptionChange, onGenerate, onPolish,
    onOpenSettings, onRefreshTextModels, onSelectTextModel, onOpenImage,
  } = props;
  const [parametersOpen, setParametersOpen] = useState(false);
  const [textPickerOpen, setTextPickerOpen] = useState(false);
  const busy = isGenerating || isPolishing;
  const requestedSize = resolveImageSize(options.ratio, options.resolutionTier);
  const polishReady = Boolean(prompt.trim() && activeTextProfile?.selectedModel && textSecretReady && activeTextProfile.verificationStatus === "success");
  const previewRatio = result?.ratio ?? options.ratio;
  const actualMismatch = result?.actualWidth && result.actualHeight && `${result.actualWidth}x${result.actualHeight}` !== result.requestedSize;

  return (
    <div className="create-view">
      {!activeImageProfile || !imageSecretReady ? (
        <section className="setup-callout"><span className="callout-icon"><KeyRound size={20} /></span><div>
          <strong>{activeImageProfile ? `补充 ${activeImageProfile.name} 的图片密钥` : "添加图片供应商"}</strong>
          <p>连接测试只读取模型列表，不会产生图片费用。</p></div>
          <button type="button" className="text-button" onClick={() => onOpenSettings("image", activeImageProfile?.id)}>去设置</button>
        </section>
      ) : null}

      <section className="composer-section">
        <label className="composer-label" htmlFor="generation-prompt">描述你想生成的画面</label>
        <textarea id="generation-prompt" rows={7} maxLength={2000} value={prompt}
          placeholder="例如：雪山环抱的幽静湖畔，一座现代主义住宅临水而建，冬日薄雾，电影感广角镜头"
          onChange={(event) => onPromptChange(event.target.value)} />
        <div className="composer-tools">
          <button type="button" className="model-selector" disabled={busy} onClick={() => textProfiles.length ? setTextPickerOpen(true) : onOpenSettings("text")}>
            <Sparkles size={16} /><span>{activeTextProfile?.selectedModel ? <><strong>{activeTextProfile.name}</strong><small>{activeTextProfile.selectedModel}</small></> : <strong>配置润色</strong>}</span><ChevronRight size={16} />
          </button>
          <button type="button" className="polish-button" disabled={busy || !polishReady} onClick={onPolish}
            title={!polishReady ? "请先配置并验证文本供应商" : undefined}>
            {isPolishing ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}{isPolishing ? "润色中" : "AI 润色"}
          </button>
        </div>
        <div className="prompt-count">{prompt.length} / 2000</div>
      </section>

      <button type="button" className="parameter-summary" onClick={() => setParametersOpen(true)} disabled={busy}>
        <span className="summary-icon"><SlidersHorizontal size={18} /></span>
        <span><strong>生成参数</strong><small>{options.ratio} / {getResolutionLabel(options.ratio, options.resolutionTier)} {displayImageSize(requestedSize)} / {qualityLabel(options.quality)}</small></span>
        <ChevronRight size={19} />
      </button>

      <StatusMessage notice={notice} compact />
      <button className="primary-button generate-button" type="button" disabled={busy} onClick={activeImageProfile && imageSecretReady ? onGenerate : () => onOpenSettings("image", activeImageProfile?.id)}>
        {isGenerating ? <LoaderCircle className="spin" size={21} /> : <WandSparkles size={21} />}
        {isGenerating ? "正在生成" : activeImageProfile && imageSecretReady ? "开始生成" : "先配置图片供应商"}
      </button>

      <section className={`preview-stage ${result || isGenerating ? "visible" : ""}`} aria-busy={isGenerating}>
        {(result || isGenerating) ? <div className={`preview-canvas ${isGenerating ? "loading" : ""}`} style={{ aspectRatio: previewRatio.replace(":", " / ") }}>
          {isGenerating ? <div className="preview-loading" role="status"><LoaderCircle className="spin" size={31} /><strong>正在生成图片</strong><span>高分辨率请求需要更长时间，请保持应用开启。</span></div>
            : result ? <img src={resolveDisplayImageUri(result)} alt={`生成结果：${result.prompt.slice(0, 80)}`} /> : null}
        </div> : null}
        {result && !isGenerating ? <>
          <div className="result-details"><div><strong>{result.profileName}</strong><span>{result.ratio} / {qualityLabel(result.quality)} / 请求 {displayImageSize(result.requestedSize)}</span>
            {actualMismatch ? <em>上游实际返回 {result.actualWidth} × {result.actualHeight}</em> : null}</div>
            <button type="button" className="secondary-button compact" onClick={() => onOpenImage(result)}><Maximize2 size={16} /> 查看原图</button>
          </div>
          {(result.modelRevisedPrompt || result.originalPrompt || result.polishProvenance) ? <details className="prompt-trace"><summary>提示词记录</summary>
            {result.originalPrompt ? <p><b>原提示词：</b>{result.originalPrompt}</p> : null}<p><b>实际发送：</b>{result.prompt}</p>
            {result.polishProvenance ? <p><b>润色来源：</b>{result.polishProvenance.textProfileName} / {result.polishProvenance.model}</p> : null}
            {result.modelRevisedPrompt ? <p><b>图片接口改写：</b>{result.modelRevisedPrompt}</p> : null}</details> : null}
        </> : null}
      </section>

      {parametersOpen ? <ParameterSheet options={options} onChange={onOptionChange} onDismiss={() => setParametersOpen(false)} /> : null}
      {textPickerOpen ? <TextProviderModelSheet profiles={textProfiles} activeId={activeTextProfile?.id ?? null} secretPresence={textSecretPresence}
        models={textModels} busy={busy} onDismiss={() => setTextPickerOpen(false)} onRefreshModels={onRefreshTextModels}
        onSelect={onSelectTextModel} onEdit={(profile) => onOpenSettings("text", profile?.id)} /> : null}
    </div>
  );
}

interface HistoryViewProps {
  records: GenerationRecordV2[];
  loading: boolean;
  notice: Notice | null;
  onOpen: (record: GenerationRecordV2) => void;
  onDelete: (record: GenerationRecordV2) => void;
  onCreate: () => void;
}

export function HistoryView({ records, loading, notice, onOpen, onDelete, onCreate }: HistoryViewProps) {
  return (
    <section className="history-view">
      <div className="section-heading"><div><p className="eyebrow">保存在本机</p><h2>创作历史</h2></div><span className="count-label">{records.length} / 24</span></div>
      <StatusMessage notice={notice} compact />
      {loading ? <div className="history-grid">{[0, 1, 2, 3].map((item) => <div className="history-skeleton" key={item} />)}</div>
        : records.length ? <div className="history-grid">{records.map((record) => <article className="history-card" key={record.id}>
          <button className="history-image-button" type="button" onClick={() => onOpen(record)}><img src={resolveDisplayImageUri(record)} alt="" /></button>
          <div className="history-card-body"><button className="history-title" type="button" onClick={() => onOpen(record)}>{record.prompt}</button>
            <p>{record.profileName} / {displayImageSize(record.requestedSize)} / {qualityLabel(record.quality)}</p>
            <div className="history-meta"><span>{formatDateTime(record.createdAt)}</span><button className="icon-button danger" type="button" aria-label="删除记录" onClick={() => onDelete(record)}><Trash2 size={17} /></button></div>
          </div></article>)}</div>
          : <div className="empty-state"><span className="empty-icon"><History size={29} /></span><h3>还没有创作记录</h3><p>生成的原图和参数会保存在这台设备上，最多保留最近 24 条。</p>
            <button className="primary-button" type="button" onClick={onCreate}><WandSparkles size={18} /> 开始创作</button></div>}
    </section>
  );
}

export interface ImageEditorValue { id?: string; name: string; baseUrl: string; apiKey: string; }
export interface TextEditorValue { id?: string; name: string; baseUrl: string; selectedModel: string; apiKey: string; }
export type RequestedEditor = { kind: "image" | "text"; profileId?: string } | null;

interface SettingsViewProps {
  imageProfiles: ImageApiProfile[];
  textProfiles: TextApiProfile[];
  activeImageProfile: ImageApiProfile | null;
  activeTextProfile: TextApiProfile | null;
  imageSecretPresence: Record<string, boolean>;
  textSecretPresence: Record<string, boolean>;
  textModels: Record<string, string[]>;
  requestedEditor: RequestedEditor;
  theme: ThemeMode;
  notice: Notice | null;
  busy: boolean;
  onThemeChange: (theme: ThemeMode) => void;
  onSaveImageDraft: (value: ImageEditorValue) => Promise<ImageApiProfile>;
  onTestImageActivate: (value: ImageEditorValue) => Promise<ImageApiProfile>;
  onSaveTextDraft: (value: TextEditorValue) => Promise<TextApiProfile>;
  onTestText: (value: TextEditorValue) => Promise<{ profile: TextApiProfile; models: string[] }>;
  onActivateText: (value: TextEditorValue, models: string[]) => Promise<TextApiProfile>;
  onActivateImage: (profile: ImageApiProfile) => void;
  onActivateExistingText: (profile: TextApiProfile) => void;
  onRefreshTextModels: (profile: TextApiProfile) => Promise<void>;
  onSelectTextModel: (profile: TextApiProfile, model: string) => void;
  onDeleteImage: (profile: ImageApiProfile) => void;
  onDeleteText: (profile: TextApiProfile) => void;
  onEditorHandled: () => void;
}

export function SettingsView(props: SettingsViewProps) {
  const {
    imageProfiles, textProfiles, activeImageProfile, activeTextProfile, imageSecretPresence, textSecretPresence, textModels,
    requestedEditor, theme, notice, busy, onThemeChange, onActivateImage, onActivateExistingText, onEditorHandled,
  } = props;
  const [sheet, setSheet] = useState<"image" | "text" | null>(null);
  const [editor, setEditor] = useState<RequestedEditor>(null);

  useEffect(() => {
    if (!requestedEditor) return;
    setEditor(requestedEditor);
    onEditorHandled();
  }, [requestedEditor, onEditorHandled]);

  const openEditor = (kind: "image" | "text", profileId?: string) => { setSheet(null); setEditor({ kind, profileId }); };

  return (
    <section className="settings-view">
      <div className="section-heading"><div><p className="eyebrow">偏好与连接</p><h2>设置</h2></div></div>
      <StatusMessage notice={notice} compact />
      <div className="settings-sections">
        <section className="settings-block"><header><div><ImageIcon size={20} /><span><strong>图片供应商</strong><small>固定使用 gpt-image-2</small></span></div></header>
          <ProviderSummary profile={activeImageProfile} empty="尚未配置图片供应商" detail={activeImageProfile ? `${hostname(activeImageProfile.baseUrl)} / ${activeImageProfile.verificationStatus === "success" ? "已验证" : "待验证"}` : "图片生成需要独立地址和密钥"} />
          <div className="settings-actions"><button type="button" onClick={() => setSheet("image")}>切换</button><button type="button" disabled={!activeImageProfile} onClick={() => openEditor("image", activeImageProfile?.id)}><Edit3 size={15} /> 编辑</button><button type="button" onClick={() => openEditor("image")}><Plus size={15} /> 添加</button></div>
        </section>
        <section className="settings-block"><header><div><Sparkles size={20} /><span><strong>文本供应商</strong><small>仅用于 AI 提示词润色</small></span></div></header>
          <ProviderSummary profile={activeTextProfile} empty="尚未配置文本供应商" detail={activeTextProfile ? `${activeTextProfile.selectedModel ?? "未选择模型"} / ${hostname(activeTextProfile.baseUrl)}` : "文本地址、密钥和模型与生图完全独立"} />
          <div className="settings-actions"><button type="button" onClick={() => setSheet("text")}>切换</button><button type="button" disabled={!activeTextProfile} onClick={() => openEditor("text", activeTextProfile?.id)}><Edit3 size={15} /> 编辑</button><button type="button" onClick={() => openEditor("text")}><Plus size={15} /> 添加</button></div>
        </section>
        <section className="settings-block appearance-block"><header><div>{theme === "dark" ? <Moon size={20} /> : <Sun size={20} />}<span><strong>外观</strong><small>切换后立即应用并保存</small></span></div></header>
          <div className="theme-options" role="radiogroup" aria-label="主题"><button type="button" role="radio" aria-checked={theme === "dark"} className={theme === "dark" ? "active" : ""} onClick={() => onThemeChange("dark")}><Moon size={19} /><span><strong>暗色</strong><small>纯黑背景</small></span>{theme === "dark" ? <Check size={18} /> : null}</button>
            <button type="button" role="radio" aria-checked={theme === "light"} className={theme === "light" ? "active" : ""} onClick={() => onThemeChange("light")}><Sun size={19} /><span><strong>亮色</strong><small>浅色表面</small></span>{theme === "light" ? <Check size={18} /> : null}</button></div>
        </section>
        <p className="privacy-note"><ShieldCheck size={17} /> Android 密钥保存在系统安全存储中，Web 密钥只保留到当前浏览器会话结束。配置与历史不会记录密钥。</p>
      </div>

      {sheet === "image" ? <ImageProviderSheet profiles={imageProfiles} activeId={activeImageProfile?.id ?? null} secretPresence={imageSecretPresence} busy={busy} onDismiss={() => setSheet(null)}
        onActivate={onActivateImage} onEdit={(profile) => openEditor("image", profile?.id)} /> : null}
      {sheet === "text" ? <TextProviderModelSheet profiles={textProfiles} activeId={activeTextProfile?.id ?? null} secretPresence={textSecretPresence} models={textModels} busy={busy}
        onDismiss={() => setSheet(null)} onRefreshModels={props.onRefreshTextModels} onSelect={props.onSelectTextModel} onEdit={(profile) => openEditor("text", profile?.id)} /> : null}
      {editor?.kind === "image" ? <ImageProfileEditor profile={imageProfiles.find((item) => item.id === editor.profileId)} secretSaved={editor.profileId ? Boolean(imageSecretPresence[editor.profileId]) : false}
        busy={busy} onDismiss={() => setEditor(null)} onSaveDraft={props.onSaveImageDraft} onTestActivate={props.onTestImageActivate} onDelete={props.onDeleteImage} /> : null}
      {editor?.kind === "text" ? <TextProfileEditor profile={textProfiles.find((item) => item.id === editor.profileId)} secretSaved={editor.profileId ? Boolean(textSecretPresence[editor.profileId]) : false}
        initialModels={editor.profileId ? textModels[editor.profileId] ?? [] : []} busy={busy} onDismiss={() => setEditor(null)} onSaveDraft={props.onSaveTextDraft} onTest={props.onTestText} onActivate={props.onActivateText} onDelete={props.onDeleteText} /> : null}
    </section>
  );
}

function ProviderSummary({ profile, empty, detail }: { profile: ImageApiProfile | TextApiProfile | null; empty: string; detail: string }) {
  return <div className={`provider-summary ${profile ? "" : "empty"}`}><span className="provider-summary-mark">{profile ? profile.name.slice(0, 1).toUpperCase() : "+"}</span><span><strong>{profile?.name ?? empty}</strong><small>{detail}</small></span>{profile ? <VerificationBadge status={profile.verificationStatus} /> : null}</div>;
}

const emptyImageEditor = (): ImageEditorValue => ({ name: "", baseUrl: "", apiKey: "" });
const emptyTextEditor = (): TextEditorValue => ({ name: "", baseUrl: "", selectedModel: "", apiKey: "" });

function SecretField({ value, saved, busy, onChange }: { value: string; saved: boolean; busy: boolean; onChange: (value: string) => void }) {
  const [visible, setVisible] = useState(false);
  return <label className="form-field full"><span>API 密钥</span><div className="secret-input"><input type={visible ? "text" : "password"} value={value} disabled={busy} autoComplete="off"
    placeholder={saved ? "密钥已安全保存，留空表示不替换" : "输入当前供应商的 API 密钥"} onChange={(event) => onChange(event.target.value)} />
    <button type="button" aria-label={visible ? "隐藏密钥" : "显示密钥"} onClick={() => setVisible((current) => !current)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
    <small>密钥不会写入配置、历史或日志。</small></label>;
}

function ImageProfileEditor({ profile, secretSaved, busy, onDismiss, onSaveDraft, onTestActivate, onDelete }: {
  profile?: ImageApiProfile; secretSaved: boolean; busy: boolean; onDismiss: () => void;
  onSaveDraft: (value: ImageEditorValue) => Promise<ImageApiProfile>; onTestActivate: (value: ImageEditorValue) => Promise<ImageApiProfile>; onDelete: (profile: ImageApiProfile) => void;
}) {
  const [value, setValue] = useState<ImageEditorValue>(profile ? { id: profile.id, name: profile.name, baseUrl: profile.baseUrl, apiKey: "" } : emptyImageEditor());
  const [notice, setNotice] = useState<Notice | null>(null);
  const update = (patch: Partial<ImageEditorValue>) => { setValue((current) => ({ ...current, ...patch })); setNotice(null); };
  const save = async () => { try { const saved = await onSaveDraft(value); update({ id: saved.id, apiKey: "" }); setNotice({ tone: "success", text: "草稿已保存，请测试连接后启用。" }); } catch (error) { setNotice({ tone: "error", text: error instanceof Error ? error.message : "保存失败。" }); } };
  const test = async () => { setNotice({ tone: "info", text: "正在读取模型列表并验证 gpt-image-2。" }); try { const saved = await onTestActivate(value); update({ id: saved.id, apiKey: "" }); setNotice({ tone: "success", text: `${saved.name} 已验证并启用。` }); } catch (error) { setNotice({ tone: "error", text: error instanceof Error ? error.message : "连接测试失败。" }); } };
  return <Overlay title={profile ? profile.name : "添加图片供应商"} eyebrow={profile ? "编辑图片配置" : "新的图片配置"} mode="editor" onDismiss={onDismiss}>
    {(close) => <div className="editor-content"><div className="form-grid"><label className="form-field"><span>配置名称</span><input value={value.name} maxLength={40} disabled={busy} placeholder="例如：图片供应商" onChange={(event) => update({ name: event.target.value })} /></label>
      <label className="form-field"><span>API 基础地址</span><input type="url" value={value.baseUrl} disabled={busy} autoCapitalize="none" spellCheck={false} onChange={(event) => update({ baseUrl: event.target.value })} /></label>
      <div className="form-field"><span>图片模型</span><div className="readonly-field"><ImageIcon size={16} /> {IMAGE_MODEL}<small>固定</small></div></div>
      <SecretField value={value.apiKey} saved={secretSaved} busy={busy} onChange={(apiKey) => update({ apiKey })} /></div>
      <StatusMessage notice={notice} /><div className="editor-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => void save()}><Save size={17} /> 保存草稿</button><button type="button" className="primary-button" disabled={busy} onClick={() => void test()}>{busy ? <LoaderCircle className="spin" size={18} /> : <RefreshCw size={18} />} 测试并启用</button></div>
      {profile ? <div className="danger-zone"><div><strong>删除图片供应商</strong><small>不会删除文本供应商或历史记录。</small></div><button type="button" disabled={busy} onClick={() => close(() => onDelete(profile))}><Trash2 size={17} /> 删除</button></div> : null}
    </div>}
  </Overlay>;
}

function TextProfileEditor({ profile, secretSaved, initialModels, busy, onDismiss, onSaveDraft, onTest, onActivate, onDelete }: {
  profile?: TextApiProfile; secretSaved: boolean; initialModels: string[]; busy: boolean; onDismiss: () => void;
  onSaveDraft: (value: TextEditorValue) => Promise<TextApiProfile>; onTest: (value: TextEditorValue) => Promise<{ profile: TextApiProfile; models: string[] }>;
  onActivate: (value: TextEditorValue, models: string[]) => Promise<TextApiProfile>; onDelete: (profile: TextApiProfile) => void;
}) {
  const [value, setValue] = useState<TextEditorValue>(profile ? { id: profile.id, name: profile.name, baseUrl: profile.baseUrl, selectedModel: profile.selectedModel ?? "", apiKey: "" } : emptyTextEditor());
  const [models, setModels] = useState(initialModels);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const update = (patch: Partial<TextEditorValue>, invalidatesModels = false) => {
    setValue((current) => ({ ...current, ...patch }));
    if (invalidatesModels) {
      setModels([]);
      setQuery("");
    }
    setNotice(null);
  };
  const save = async () => { try { const saved = await onSaveDraft(value); update({ id: saved.id, apiKey: "" }); setNotice({ tone: "success", text: "草稿已保存，下一步请测试连接。" }); } catch (error) { setNotice({ tone: "error", text: error instanceof Error ? error.message : "保存失败。" }); } };
  const test = async () => { setNotice({ tone: "info", text: "正在读取文本模型列表。" }); try { const result = await onTest(value); setModels(result.models); update({ id: result.profile.id, apiKey: "" }); setNotice({ tone: "success", text: `已读取 ${result.models.length} 个模型，请选择后保存并启用。` }); } catch (error) { setNotice({ tone: "error", text: error instanceof Error ? error.message : "连接测试失败。" }); } };
  const activate = async () => { try { const saved = await onActivate(value, models); update({ id: saved.id, apiKey: "" }); setNotice({ tone: "success", text: `${saved.name} / ${saved.selectedModel} 已启用。` }); } catch (error) { setNotice({ tone: "error", text: error instanceof Error ? error.message : "启用失败。" }); } };
  const filtered = models.filter((model) => model.toLowerCase().includes(query.toLowerCase()));
  return <Overlay title={profile ? profile.name : "添加文本供应商"} eyebrow={profile ? "编辑文本配置" : "新的文本配置"} mode="editor" onDismiss={onDismiss}>
    {(close) => <div className="editor-content"><div className="editor-steps"><span className="active">连接</span><span className={models.length ? "active" : ""}>选择模型</span><span className={models.includes(value.selectedModel) ? "active" : ""}>启用</span></div>
      <div className="form-grid"><label className="form-field"><span>配置名称</span><input value={value.name} maxLength={40} disabled={busy} placeholder="例如：文本 API" onChange={(event) => update({ name: event.target.value })} /></label>
        <label className="form-field"><span>API 基础地址</span><input type="url" value={value.baseUrl} disabled={busy} autoCapitalize="none" spellCheck={false} onChange={(event) => update({ baseUrl: event.target.value }, true)} /></label>
        <SecretField value={value.apiKey} saved={secretSaved} busy={busy} onChange={(apiKey) => update({ apiKey }, true)} />
        <label className="form-field full"><span>文本模型</span><input value={value.selectedModel} disabled={busy} placeholder="测试连接后选择，或先手动输入" onChange={(event) => update({ selectedModel: event.target.value })} /><small>只有模型精确出现在本次模型列表中，配置才能启用。</small></label>
      </div>
      {models.length ? <div className="verified-models"><label className="model-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索已验证模型" /></label><div className="model-chip-list">{filtered.map((model) => <button type="button" className={value.selectedModel === model ? "active" : ""} key={model} onClick={() => update({ selectedModel: model })}>{model}{value.selectedModel === model ? <Check size={14} /> : null}</button>)}</div></div> : null}
      <StatusMessage notice={notice} /><div className="editor-actions three"><button type="button" className="ghost-button" disabled={busy} onClick={() => void save()}><Save size={17} /> 保存草稿</button><button type="button" className="secondary-button" disabled={busy} onClick={() => void test()}>{busy ? <LoaderCircle className="spin" size={18} /> : <RefreshCw size={18} />} 测试连接</button><button type="button" className="primary-button" disabled={busy || !models.includes(value.selectedModel)} onClick={() => void activate()}><Check size={18} /> 保存并启用</button></div>
      {profile ? <div className="danger-zone"><div><strong>删除文本供应商</strong><small>不会删除图片供应商或历史记录。</small></div><button type="button" disabled={busy} onClick={() => close(() => onDelete(profile))}><Trash2 size={17} /> 删除</button></div> : null}
    </div>}
  </Overlay>;
}

interface PolishDialogProps { original: string; polished: string; onAccept: () => void; onKeep: () => void; }

export function PolishDialog({ original, polished, onAccept, onKeep }: PolishDialogProps) {
  return <Overlay title="确认润色结果" eyebrow="AI 提示词润色" mode="dialog" onDismiss={onKeep} className="polish-dialog">
    {(close) => <div className="dialog-content"><div className="prompt-compare"><article><span>原提示词</span><p>{original}</p></article><article className="polished"><span>润色后</span><p>{polished}</p></article></div>
      <p className="dialog-helper">替换后不会自动开始生图。</p><div className="dialog-actions"><button type="button" className="secondary-button" onClick={() => close()}>保留原文</button><button type="button" className="primary-button" onClick={() => close(onAccept)}><Check size={18} /> 使用润色结果</button></div></div>}
  </Overlay>;
}

interface ImageViewerProps { record: GenerationRecordV2; onClose: () => void; onSave: (record: GenerationRecordV2) => Promise<string>; }

export function ImageViewer({ record, onClose, onSave }: ImageViewerProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const transform = useRef({ scale: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const lastCenter = useRef<{ x: number; y: number; distance: number } | null>(null);
  const [scaleLabel, setScaleLabel] = useState(1);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saveNotice, setSaveNotice] = useState<Notice | null>(null);
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  const apply = () => { if (!imageRef.current) return; const value = transform.current; imageRef.current.style.transform = `translate3d(${value.x}px, ${value.y}px, 0) scale(${value.scale})`; setScaleLabel(value.scale); };
  const reset = () => { transform.current = { scale: 1, x: 0, y: 0 }; pointers.current.clear(); lastCenter.current = null; apply(); };
  useEffect(reset, [record.id, retry]);
  const zoom = (delta: number) => { transform.current.scale = Math.min(8, Math.max(1, transform.current.scale + delta)); if (transform.current.scale === 1) transform.current = { scale: 1, x: 0, y: 0 }; apply(); };
  const onPointerDown = (event: ReactPointerEvent) => { event.currentTarget.setPointerCapture(event.pointerId); pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY }); };
  const onPointerMove = (event: ReactPointerEvent) => { const previous = pointers.current.get(event.pointerId); if (!previous) return; pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY }); const all = [...pointers.current.values()]; if (all.length === 1 && transform.current.scale > 1) { transform.current.x += event.clientX - previous.x; transform.current.y += event.clientY - previous.y; apply(); } else if (all.length >= 2) { const [a, b] = all; const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; const distance = Math.hypot(a.x - b.x, a.y - b.y); const last = lastCenter.current; if (last) { transform.current.scale = Math.min(8, Math.max(1, transform.current.scale * (distance / last.distance))); transform.current.x += center.x - last.x; transform.current.y += center.y - last.y; apply(); } lastCenter.current = { ...center, distance }; } };
  const onPointerUp = (event: ReactPointerEvent) => { pointers.current.delete(event.pointerId); lastCenter.current = null; };
  const handleSave = async () => { setSaving(true); setSaveNotice(null); try { setSaveNotice({ tone: "success", text: await onSave(record) }); } catch (error) { setSaveNotice({ tone: "error", text: error instanceof Error ? error.message : "保存失败。" }); } finally { setSaving(false); } };
  return <Overlay title={record.profileName} eyebrow={`${record.actualWidth ?? "?"} × ${record.actualHeight ?? "?"} / ${Math.round(scaleLabel * 100)}%`} mode="editor" onDismiss={onClose} className="viewer-panel">
    {() => <div className="viewer-content"><div className="viewer-toolbar"><button onClick={() => zoom(-0.5)} aria-label="缩小"><ZoomOut size={19} /></button><button onClick={() => zoom(0.5)} aria-label="放大"><ZoomIn size={19} /></button><button onClick={reset} aria-label="重置缩放"><RotateCcw size={18} /></button><button className="save" onClick={() => void handleSave()} disabled={saving}>{saving ? <LoaderCircle className="spin" size={18} /> : <Download size={18} />}<span>保存</span></button></div>
      <div className="viewer-stage" onWheel={(event) => { event.preventDefault(); zoom(event.deltaY < 0 ? 0.25 : -0.25); }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        {loadFailed ? <div className="viewer-error"><AlertCircle size={30} /><strong>原图加载失败</strong><button className="secondary-button" onClick={() => { setLoadFailed(false); setRetry((value) => value + 1); }}><RefreshCw size={17} /> 重试</button></div>
          : <img key={retry} ref={imageRef} draggable={false} src={resolveDisplayImageUri(record)} alt={record.prompt} onError={() => setLoadFailed(true)} />}</div>
      <details className="viewer-prompt-details"><summary>提示词记录</summary><div>{record.originalPrompt ? <p><b>原提示词：</b>{record.originalPrompt}</p> : null}<p><b>实际发送：</b>{record.prompt}</p>{record.polishProvenance ? <p><b>润色来源：</b>{record.polishProvenance.textProfileName} / {record.polishProvenance.model}</p> : null}{record.modelRevisedPrompt ? <p><b>图片接口改写：</b>{record.modelRevisedPrompt}</p> : null}</div></details>
      {saveNotice ? <div className={`viewer-notice ${saveNotice.tone}`}>{saveNotice.text}</div> : null}</div>}
  </Overlay>;
}
