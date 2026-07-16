import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.local.dreamcanvas",
  appName: "DreamCanvas",
  webDir: "dist",
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      backgroundColor: "#F4F6F8",
      style: "LIGHT",
    },
  },
};

export default config;
