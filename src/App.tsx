import { useState } from "react";
import {
  History,
  Image as ImageIcon,
  Settings,
  Sparkles,
  WandSparkles,
} from "lucide-react";

type AppView = "create" | "history" | "settings";
type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";

const ratioOptions: AspectRatio[] = ["1:1", "3:4", "4:3", "9:16", "16:9"];

function CreateView() {
  const [prompt, setPrompt] = useState("");
  const [ratio, setRatio] = useState<AspectRatio>("1:1");
  const [message, setMessage] = useState<string | null>(null);

  const prepareGeneration = () => {
    if (!prompt.trim()) {
      setMessage("请先描述想要生成的画面。");
      return;
    }

    setMessage("创作参数已准备，下一步接入 image2api。");
  };

  return (
    <div className="create-view">
      <section className="preview-stage" aria-label="图片预览">
        <div className="preview-empty">
          <ImageIcon size={42} strokeWidth={1.5} aria-hidden="true" />
          <strong>生成结果会显示在这里</strong>
          <span>{ratio} 画布</span>
        </div>
      </section>

      <section className="composer-section">
        <label className="prompt-field">
          <span>描述画面</span>
          <textarea
            rows={5}
            maxLength={2000}
            value={prompt}
            placeholder="例如：雨后的城市街道，霓虹灯倒映在路面上，电影感摄影"
            onChange={(event) => {
              setPrompt(event.target.value);
              setMessage(null);
            }}
          />
          <small>{prompt.length} / 2000</small>
        </label>

        <div className="ratio-field">
          <span>画面比例</span>
          <div className="ratio-options" role="group" aria-label="画面比例">
            {ratioOptions.map((option) => (
              <button
                className={ratio === option ? "active" : ""}
                type="button"
                key={option}
                onClick={() => setRatio(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {message ? <p className="inline-message" role="status">{message}</p> : null}
      </section>

      <div className="generate-bar">
        <button className="generate-button" type="button" onClick={prepareGeneration}>
          <WandSparkles size={21} strokeWidth={1.8} aria-hidden="true" />
          开始生成
        </button>
      </div>
    </div>
  );
}

function HistoryView() {
  return (
    <section className="empty-view">
      <History size={42} strokeWidth={1.5} aria-hidden="true" />
      <h2>还没有创作记录</h2>
      <p>完成的图片会按时间保存在这里。</p>
    </section>
  );
}

function SettingsView() {
  return (
    <section className="empty-view">
      <Settings size={42} strokeWidth={1.5} aria-hidden="true" />
      <h2>接口设置</h2>
      <p>确认 image2api 的鉴权和响应格式后接入。</p>
    </section>
  );
}

export default function App() {
  const [view, setView] = useState<AppView>("create");

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            <Sparkles size={20} strokeWidth={1.8} />
          </span>
          <div>
            <p>AI 图片生成助手</p>
            <h1>DreamCanvas</h1>
          </div>
        </div>
        <button
          className={view === "settings" ? "icon-button active" : "icon-button"}
          type="button"
          title="设置"
          aria-label="设置"
          onClick={() => setView("settings")}
        >
          <Settings size={21} strokeWidth={1.8} />
        </button>
      </header>

      <main className={view === "create" ? "app-main create-main" : "app-main"}>
        {view === "create" ? <CreateView /> : null}
        {view === "history" ? <HistoryView /> : null}
        {view === "settings" ? <SettingsView /> : null}
      </main>

      <nav className="bottom-nav" aria-label="主导航">
        <button
          className={view === "create" ? "active" : ""}
          type="button"
          onClick={() => setView("create")}
        >
          <WandSparkles size={21} strokeWidth={1.8} />
          <span>创作</span>
        </button>
        <button
          className={view === "history" ? "active" : ""}
          type="button"
          onClick={() => setView("history")}
        >
          <History size={21} strokeWidth={1.8} />
          <span>历史</span>
        </button>
      </nav>
    </div>
  );
}
