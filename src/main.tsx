import { StrictMode } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

const setupNativeStatusBar = async () => {
  if (Capacitor.getPlatform() !== "android") {
    return;
  }

  await StatusBar.setOverlaysWebView({ overlay: false });
  await StatusBar.setBackgroundColor({ color: "#F4F6F8" });
  await StatusBar.setStyle({ style: Style.Light });
  await StatusBar.show();
};

void setupNativeStatusBar().catch(() => undefined);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
