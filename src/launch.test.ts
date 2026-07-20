import { beforeEach, describe, expect, it, vi } from "vitest";

const platformMock = vi.fn();
const readyMock = vi.fn(() => Promise.resolve());

vi.mock("@capacitor/core", () => ({
  Capacitor: { getPlatform: platformMock },
  registerPlugin: vi.fn(() => ({ ready: readyMock })),
}));

describe("launch readiness notification", () => {
  beforeEach(() => {
    vi.resetModules();
    platformMock.mockReset();
    readyMock.mockReset();
    readyMock.mockResolvedValue(undefined);
  });

  it("notifies the Android plugin only once", async () => {
    platformMock.mockReturnValue("android");
    const { notifyLaunchReady } = await import("./launch");

    await Promise.all([notifyLaunchReady(), notifyLaunchReady()]);

    expect(readyMock).toHaveBeenCalledTimes(1);
  });

  it("does not call the native plugin outside Android", async () => {
    platformMock.mockReturnValue("web");
    const { notifyLaunchReady } = await import("./launch");

    await expect(notifyLaunchReady()).resolves.toBeUndefined();
    expect(readyMock).not.toHaveBeenCalled();
  });

  it("does not reject application startup when the plugin fails", async () => {
    platformMock.mockReturnValue("android");
    readyMock.mockRejectedValueOnce(new Error("plugin unavailable"));
    const { notifyLaunchReady } = await import("./launch");

    await expect(notifyLaunchReady()).resolves.toBeUndefined();
  });
});
