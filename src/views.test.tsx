import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerationRecordV2, ImageApiProfile, TextApiProfile } from "./domain";
import { Overlay } from "./overlays";
import { CreateView, ImageViewer, ParameterSheet, PolishDialog, SettingsView } from "./views";

const imageProfile: ImageApiProfile = {
  id: "image-1", name: "Provider A", baseUrl: "https://image.example.com", createdAt: 1, updatedAt: 1,
  verificationStatus: "success", verificationMessage: "已验证", fourKStatus: "supported",
};
const otherImage: ImageApiProfile = {
  ...imageProfile, id: "image-2", name: "Provider B", baseUrl: "https://image-b.example.com", fourKStatus: "unknown",
};
const textProfile: TextApiProfile = {
  id: "text-1", name: "TextHub", baseUrl: "https://text.example.com", selectedModel: "gpt-5-mini",
  createdAt: 1, updatedAt: 1, verificationStatus: "success", verificationMessage: "已验证",
};

const makeRecord = (id: string): GenerationRecordV2 => ({
  id, createdAt: 1, prompt: "雪山湖畔", ratio: "16:9", resolutionTier: "max", requestedSize: "3840x2160",
  actualWidth: 3840, actualHeight: 2160, quality: "high", model: "gpt-image-2", profileId: "p1",
  profileName: "Provider A", imageUri: "data:image/png;base64,iVBORw0KGgo=", storageKind: "indexeddb",
});

beforeEach(() => {
  window.history.replaceState({}, "");
});

describe("确认弹层与原图查看器", () => {
  it("润色结果只有用户确认后才触发替换", () => {
    const accept = vi.fn();
    render(<PolishDialog original="原文" polished="润色后" onAccept={accept} onKeep={vi.fn()} />);
    expect(screen.getByText("原文")).toBeInTheDocument();
    expect(screen.getAllByText("润色后")).toHaveLength(2);
    expect(accept).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /使用润色结果/ }));
    expect(accept).toHaveBeenCalledTimes(1);
  });

  it("查看器缩放后切换图片会重置到 100%，并暴露保存动作", () => {
    const save = vi.fn().mockResolvedValue("已保存");
    const { rerender } = render(<ImageViewer record={makeRecord("one")} onClose={vi.fn()} onSave={save} />);
    fireEvent.click(screen.getByRole("button", { name: "放大" }));
    expect(screen.getByText(/150%/)).toBeInTheDocument();
    rerender(<ImageViewer record={makeRecord("two")} onClose={vi.fn()} onSave={save} />);
    expect(screen.getByText(/100%/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /保存/ }));
    expect(save).toHaveBeenCalledTimes(1);
  });
});

describe("创作页精简交互", () => {
  const renderCreate = (result: GenerationRecordV2 | null = null) => render(<CreateView
    activeImageProfile={imageProfile} activeTextProfile={textProfile} imageSecretReady textSecretReady
    textProfiles={[textProfile]} textSecretPresence={{ "text-1": true }} textModels={{ "text-1": ["gpt-5-mini"] }}
    prompt="雪山湖畔" options={{ ratio: "1:1", resolutionTier: "standard", quality: "high" }} result={result}
    notice={null} isGenerating={false} isPolishing={false} onPromptChange={vi.fn()} onOptionChange={vi.fn()}
    onGenerate={vi.fn()} onPolish={vi.fn()} onOpenSettings={vi.fn()} onRefreshTextModels={vi.fn().mockResolvedValue(undefined)}
    onSelectTextModel={vi.fn()} onOpenImage={vi.fn()} />);

  it("生成参数默认关闭，摘要正确，点击后才显示详细控件", () => {
    renderCreate();
    expect(screen.queryByText("画面比例")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /生成参数.*1:1.*标准.*1024 × 1024.*High/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /生成参数/ }));
    expect(screen.getByText("画面比例")).toBeInTheDocument();
    expect(screen.getByText("分辨率")).toBeInTheDocument();
  });

  it("生成结果只有一个可见的查看原图按钮，图片本身不是按钮", () => {
    renderCreate(makeRecord("result"));
    expect(screen.getAllByRole("button", { name: /查看原图/ })).toHaveLength(1);
    expect(screen.getByRole("img", { name: /生成结果/ }).closest("button")).toBeNull();
  });
});

describe("设置页默认信息层级与主题", () => {
  it("默认只显示当前供应商，不渲染完整列表或编辑表单", () => {
    render(<SettingsView imageProfiles={[imageProfile, otherImage]} textProfiles={[textProfile]} activeImageProfile={imageProfile} activeTextProfile={textProfile}
      imageSecretPresence={{ "image-1": true, "image-2": true }} textSecretPresence={{ "text-1": true }} textModels={{}}
      requestedEditor={null} theme="dark" notice={null} busy={false} onThemeChange={vi.fn()}
      onSaveImageDraft={vi.fn()} onTestImageActivate={vi.fn()} onSaveTextDraft={vi.fn()} onTestText={vi.fn()} onActivateText={vi.fn()}
      onActivateImage={vi.fn()} onActivateExistingText={vi.fn()} onRefreshTextModels={vi.fn()} onSelectTextModel={vi.fn()}
      onDeleteImage={vi.fn()} onDeleteText={vi.fn()} onEditorHandled={vi.fn()} />);
    expect(screen.getByText("Provider A")).toBeInTheDocument();
    expect(screen.getByText("TextHub")).toBeInTheDocument();
    expect(screen.queryByText("Provider B")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("配置名称")).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /暗色/ })).toHaveAttribute("aria-checked", "true");
  });

  it("主题切换只在用户点击时触发", () => {
    const changeTheme = vi.fn();
    render(<SettingsView imageProfiles={[]} textProfiles={[]} activeImageProfile={null} activeTextProfile={null}
      imageSecretPresence={{}} textSecretPresence={{}} textModels={{}} requestedEditor={null} theme="dark" notice={null} busy={false}
      onThemeChange={changeTheme} onSaveImageDraft={vi.fn()} onTestImageActivate={vi.fn()} onSaveTextDraft={vi.fn()} onTestText={vi.fn()}
      onActivateText={vi.fn()} onActivateImage={vi.fn()} onActivateExistingText={vi.fn()} onRefreshTextModels={vi.fn()} onSelectTextModel={vi.fn()}
      onDeleteImage={vi.fn()} onDeleteText={vi.fn()} onEditorHandled={vi.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: /亮色/ }));
    expect(changeTheme).toHaveBeenCalledWith("light");
  });

  it("文本配置改动地址后会清除旧模型验证结果", async () => {
    const testConnection = vi.fn().mockResolvedValue({ profile: textProfile, models: ["gpt-5-mini"] });
    render(<SettingsView imageProfiles={[]} textProfiles={[textProfile]} activeImageProfile={null} activeTextProfile={textProfile}
      imageSecretPresence={{}} textSecretPresence={{ "text-1": true }} textModels={{}} requestedEditor={{ kind: "text", profileId: "text-1" }} theme="dark" notice={null} busy={false}
      onThemeChange={vi.fn()} onSaveImageDraft={vi.fn()} onTestImageActivate={vi.fn()} onSaveTextDraft={vi.fn()} onTestText={testConnection}
      onActivateText={vi.fn()} onActivateImage={vi.fn()} onActivateExistingText={vi.fn()} onRefreshTextModels={vi.fn()} onSelectTextModel={vi.fn()}
      onDeleteImage={vi.fn()} onDeleteText={vi.fn()} onEditorHandled={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /测试连接/ }));
    expect(await screen.findByRole("button", { name: /gpt-5-mini/ })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("API 基础地址"), { target: { value: "https://new.example.com" } });
    expect(screen.queryByRole("button", { name: /gpt-5-mini/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /保存并启用/ })).toBeDisabled();
  });

  it("已有配置但没有密钥时不会误报密钥已保存", () => {
    render(<SettingsView imageProfiles={[imageProfile]} textProfiles={[]} activeImageProfile={imageProfile} activeTextProfile={null}
      imageSecretPresence={{ "image-1": false }} textSecretPresence={{}} textModels={{}} requestedEditor={{ kind: "image", profileId: "image-1" }} theme="dark" notice={null} busy={false}
      onThemeChange={vi.fn()} onSaveImageDraft={vi.fn()} onTestImageActivate={vi.fn()} onSaveTextDraft={vi.fn()} onTestText={vi.fn()}
      onActivateText={vi.fn()} onActivateImage={vi.fn()} onActivateExistingText={vi.fn()} onRefreshTextModels={vi.fn()} onSelectTextModel={vi.fn()}
      onDeleteImage={vi.fn()} onDeleteText={vi.fn()} onEditorHandled={vi.fn()} />);
    expect(screen.queryByText("密钥已安全保存")).not.toBeInTheDocument();
    expect(screen.getByText("API 密钥")).toBeInTheDocument();
  });
});

describe("统一覆盖层", () => {
  const options = { ratio: "1:1", resolutionTier: "standard", quality: "high" } as const;

  it("支持 Esc 和 popstate 关闭最上层面板", () => {
    const dismiss = vi.fn();
    render(<ParameterSheet options={options} onChange={vi.fn()} onDismiss={dismiss} />);
    const dialog = screen.getByRole("dialog", { name: "生成参数" });
    expect(within(dialog).getByText("画面比例")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it("pointerdown 不会提前关闭，完整遮罩点击只关闭面板且不触发背景操作", async () => {
    const backgroundAction = vi.fn();

    function Harness() {
      const [open, setOpen] = useState(true);
      return <>
        <button type="button" onClick={backgroundAction}>背景操作</button>
        {open ? <ParameterSheet options={options} onChange={vi.fn()} onDismiss={() => setOpen(false)} /> : null}
      </>;
    }

    render(<Harness />);
    const dialog = screen.getByRole("dialog", { name: "生成参数" });
    const backdrop = dialog.parentElement as HTMLElement;

    fireEvent.pointerDown(backdrop);
    expect(screen.getByRole("dialog", { name: "生成参数" })).toBeInTheDocument();
    expect(backgroundAction).not.toHaveBeenCalled();

    fireEvent.pointerUp(backdrop);
    fireEvent.click(backdrop);
    window.dispatchEvent(new PopStateEvent("popstate"));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "生成参数" })).not.toBeInTheDocument());
    expect(backgroundAction).not.toHaveBeenCalled();
  });

  it("面板内点击和从面板内拖到遮罩都不会关闭面板", () => {
    const dismiss = vi.fn();
    const change = vi.fn();
    render(<ParameterSheet options={options} onChange={change} onDismiss={dismiss} />);
    const dialog = screen.getByRole("dialog", { name: "生成参数" });
    const backdrop = dialog.parentElement as HTMLElement;
    const twoK = within(dialog).getByRole("button", { name: /2K.*2048 × 2048/ });

    fireEvent.pointerDown(twoK);
    fireEvent.pointerUp(twoK);
    fireEvent.click(twoK);
    expect(change).toHaveBeenCalledWith("resolutionTier", "2k");
    expect(dismiss).not.toHaveBeenCalled();

    fireEvent.pointerDown(twoK);
    fireEvent.pointerUp(backdrop);
    fireEvent.click(backdrop);
    expect(dismiss).not.toHaveBeenCalled();
  });

  it("编辑页点击遮罩不会关闭", () => {
    const dismiss = vi.fn();
    render(<Overlay title="编辑配置" mode="editor" onDismiss={dismiss}>{() => <div>编辑内容</div>}</Overlay>);
    const dialog = screen.getByRole("dialog", { name: "编辑配置" });
    const backdrop = dialog.parentElement as HTMLElement;

    fireEvent.pointerDown(backdrop);
    fireEvent.pointerUp(backdrop);
    fireEvent.click(backdrop);

    expect(dismiss).not.toHaveBeenCalled();
    expect(dialog).toBeInTheDocument();
  });
});
