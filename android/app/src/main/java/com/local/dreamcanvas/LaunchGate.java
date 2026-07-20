package com.local.dreamcanvas;

final class LaunchGate {
    static final long MIN_SPLASH_DURATION_MS = 1500L;
    static final long MAX_SPLASH_DURATION_MS = 2200L;

    private LaunchGate() {}

    static boolean shouldDismissSplash(long visibleElapsedMs, boolean webReady) {
        return visibleElapsedMs >= MAX_SPLASH_DURATION_MS
            || (webReady && visibleElapsedMs >= MIN_SPLASH_DURATION_MS);
    }

    static long nextCheckDelayMs(long visibleElapsedMs, boolean webReady) {
        if (shouldDismissSplash(visibleElapsedMs, webReady)) return 0L;
        long targetMs = webReady ? MIN_SPLASH_DURATION_MS : MAX_SPLASH_DURATION_MS;
        return Math.max(1L, targetMs - Math.max(0L, visibleElapsedMs));
    }
}
