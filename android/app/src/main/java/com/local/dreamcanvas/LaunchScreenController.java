package com.local.dreamcanvas;

final class LaunchScreenController {
    static final long FADE_DURATION_MS = 250L;

    interface Clock {
        long nowMs();
    }

    interface Scheduler {
        void schedule(Runnable action, long delayMs);
        void cancel(Runnable action);
    }

    interface SplashHandle {
        void fadeOut(long durationMs, Runnable onComplete);
        void removeImmediately();
    }

    interface EventListener {
        void onEvent(String event, long visibleElapsedMs);
    }

    private final Clock clock;
    private final Scheduler scheduler;
    private final EventListener eventListener;
    private final Runnable reevaluate = this::evaluate;

    private SplashHandle splashHandle;
    private long visibleStartedAtMs = -1L;
    private boolean webReady;
    private boolean fadeStarted;
    private boolean removed;
    private boolean disposed;

    LaunchScreenController(Clock clock, Scheduler scheduler, EventListener eventListener) {
        this.clock = clock;
        this.scheduler = scheduler;
        this.eventListener = eventListener;
    }

    void onSplashViewAvailable(SplashHandle handle) {
        if (disposed || fadeStarted || removed || splashHandle != null) {
            handle.removeImmediately();
            return;
        }
        splashHandle = handle;
        visibleStartedAtMs = clock.nowMs();
        emit("splash_view_acquired");
        evaluate();
    }

    void onWebReady() {
        if (disposed || webReady) return;
        webReady = true;
        emit("web_ready");
        evaluate();
    }

    void dispose() {
        if (disposed) return;
        disposed = true;
        scheduler.cancel(reevaluate);
        if (splashHandle != null && !removed) {
            splashHandle.removeImmediately();
            removed = true;
            emit("splash_removed_on_destroy");
            splashHandle = null;
        }
    }

    private void evaluate() {
        if (disposed || fadeStarted || splashHandle == null) return;
        scheduler.cancel(reevaluate);
        long visibleElapsedMs = visibleElapsedMs();
        if (LaunchGate.shouldDismissSplash(visibleElapsedMs, webReady)) {
            fadeStarted = true;
            emit("fade_started");
            SplashHandle fadingHandle = splashHandle;
            fadingHandle.fadeOut(FADE_DURATION_MS, () -> completeRemoval(fadingHandle));
            return;
        }
        scheduler.schedule(reevaluate, LaunchGate.nextCheckDelayMs(visibleElapsedMs, webReady));
    }

    private void completeRemoval(SplashHandle completedHandle) {
        if (removed) return;
        removed = true;
        if (splashHandle == completedHandle) splashHandle = null;
        emit("splash_removed");
    }

    private long visibleElapsedMs() {
        if (visibleStartedAtMs < 0L) return -1L;
        return Math.max(0L, clock.nowMs() - visibleStartedAtMs);
    }

    private void emit(String event) {
        eventListener.onEvent(event, visibleElapsedMs());
    }
}
