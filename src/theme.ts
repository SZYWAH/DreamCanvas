import { Capacitor, registerPlugin } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import type { ThemeMode } from "./domain";

interface SystemUiPlugin {
  setNavigationBar(options: { color: string; lightIcons: boolean }): Promise<void>;
}

const SystemUi = registerPlugin<SystemUiPlugin>("SystemUi");

export const themeColors: Record<ThemeMode, string> = {
  dark: "#000000",
  light: "#F7F7F7",
};

export const applyTheme = async (theme: ThemeMode) => {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", themeColors[theme]);
  if (Capacitor.getPlatform() !== "android") return;
  await StatusBar.setOverlaysWebView({ overlay: false });
  await StatusBar.setBackgroundColor({ color: themeColors[theme] });
  await StatusBar.setStyle({ style: theme === "dark" ? Style.Dark : Style.Light });
  await StatusBar.show();
  await SystemUi.setNavigationBar({ color: themeColors[theme], lightIcons: theme === "dark" });
};
