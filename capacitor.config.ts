import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.local.dreamcanvas",
  appName: "DreamCanvas",
  webDir: "dist",
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      backgroundColor: "#000000",
      style: "DARK",
    },
  },
};

export default config;
