import { Capacitor, registerPlugin } from "@capacitor/core";

interface LaunchScreenPlugin {
  ready(): Promise<void>;
}

const LaunchScreen = registerPlugin<LaunchScreenPlugin>("LaunchScreen");
let readyPromise: Promise<void> | null = null;

export const notifyLaunchReady = (): Promise<void> => {
  if (Capacitor.getPlatform() !== "android") return Promise.resolve();
  if (!readyPromise) readyPromise = LaunchScreen.ready().catch(() => undefined);
  return readyPromise;
};
