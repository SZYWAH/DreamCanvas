import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { loadAppPreferences } from "./storage";
import "./styles.css";
import { applyTheme } from "./theme";

const root = createRoot(document.getElementById("root")!);

const start = async () => {
  const preferences = await loadAppPreferences();
  await applyTheme(preferences.theme).catch(() => undefined);
  root.render(<StrictMode><App initialTheme={preferences.theme} /></StrictMode>);
};

void start();
