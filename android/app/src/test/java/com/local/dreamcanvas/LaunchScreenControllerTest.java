package com.local.dreamcanvas;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.util.ArrayList;
import java.util.List;

import org.junit.Test;

public class LaunchScreenControllerTest {
    @Test
    public void webReadyBeforeSplashStillWaitsForFullMinimumDuration() {
        Fixture fixture = new Fixture();
        fixture.controller.onWebReady();
        fixture.controller.onSplashViewAvailable(fixture.splash);

        assertEquals(1500L, fixture.scheduler.delayMs);
        fixture.scheduler.runAt(1499L);
        assertFalse(fixture.splash.fadeStarted);
        assertEquals(1L, fixture.scheduler.delayMs);

        fixture.scheduler.runAt(1500L);
        assertTrue(fixture.splash.fadeStarted);
        assertEquals(LaunchScreenController.FADE_DURATION_MS, fixture.splash.fadeDurationMs);
    }

    @Test
    public void webReadyAfterMinimumStartsFadeImmediately() {
        Fixture fixture = new Fixture();
        fixture.controller.onSplashViewAvailable(fixture.splash);
        fixture.clock.nowMs = 1700L;

        fixture.controller.onWebReady();

        assertTrue(fixture.splash.fadeStarted);
        assertNull(fixture.scheduler.pending);
        assertEquals(1, fixture.countEvent("web_ready"));
    }

    @Test
    public void missingWebReadyForcesFadeAtMaximumDuration() {
        Fixture fixture = new Fixture();
        fixture.controller.onSplashViewAvailable(fixture.splash);

        assertEquals(2200L, fixture.scheduler.delayMs);
        fixture.scheduler.runAt(2200L);

        assertTrue(fixture.splash.fadeStarted);
    }

    @Test
    public void repeatedWebReadyIsHandledOnlyOnce() {
        Fixture fixture = new Fixture();
        fixture.controller.onWebReady();
        fixture.controller.onWebReady();

        assertEquals(1, fixture.countEvent("web_ready"));
    }

    @Test
    public void disposeCancelsPendingWorkAndRemovesSplash() {
        Fixture fixture = new Fixture();
        fixture.controller.onSplashViewAvailable(fixture.splash);
        Runnable staleAction = fixture.scheduler.pending;

        fixture.controller.dispose();
        fixture.clock.nowMs = 2000L;
        staleAction.run();

        assertTrue(fixture.splash.removedImmediately);
        assertFalse(fixture.splash.fadeStarted);
        assertNull(fixture.scheduler.pending);
    }

    @Test
    public void fadeCompletionRecordsRemovalOnce() {
        Fixture fixture = new Fixture();
        fixture.controller.onWebReady();
        fixture.controller.onSplashViewAvailable(fixture.splash);
        fixture.scheduler.runAt(1500L);

        fixture.splash.completeFade();
        fixture.splash.completeFade();

        assertEquals(1, fixture.countEvent("splash_removed"));
    }

    @Test
    public void duplicateSplashViewIsRemovedImmediately() {
        Fixture fixture = new Fixture();
        FakeSplash duplicate = new FakeSplash();
        fixture.controller.onSplashViewAvailable(fixture.splash);

        fixture.controller.onSplashViewAvailable(duplicate);

        assertTrue(duplicate.removedImmediately);
    }

    private static final class Fixture {
        final FakeClock clock = new FakeClock();
        final FakeScheduler scheduler = new FakeScheduler(clock);
        final FakeSplash splash = new FakeSplash();
        final List<String> events = new ArrayList<>();
        final LaunchScreenController controller = new LaunchScreenController(
            clock,
            scheduler,
            (event, elapsedMs) -> events.add(event + ":" + elapsedMs)
        );

        int countEvent(String name) {
            int count = 0;
            for (String event : events) {
                if (event.startsWith(name + ":")) count++;
            }
            return count;
        }
    }

    private static final class FakeClock implements LaunchScreenController.Clock {
        long nowMs;

        @Override
        public long nowMs() {
            return nowMs;
        }
    }

    private static final class FakeScheduler implements LaunchScreenController.Scheduler {
        private final FakeClock clock;
        Runnable pending;
        long delayMs;

        FakeScheduler(FakeClock clock) {
            this.clock = clock;
        }

        @Override
        public void schedule(Runnable action, long delayMs) {
            this.pending = action;
            this.delayMs = delayMs;
        }

        @Override
        public void cancel(Runnable action) {
            if (pending == action) pending = null;
        }

        void runAt(long nowMs) {
            Runnable action = pending;
            pending = null;
            clock.nowMs = nowMs;
            action.run();
        }
    }

    private static final class FakeSplash implements LaunchScreenController.SplashHandle {
        boolean fadeStarted;
        boolean removedImmediately;
        long fadeDurationMs;
        Runnable fadeCompletion;

        @Override
        public void fadeOut(long durationMs, Runnable onComplete) {
            fadeStarted = true;
            fadeDurationMs = durationMs;
            fadeCompletion = onComplete;
        }

        @Override
        public void removeImmediately() {
            removedImmediately = true;
        }

        void completeFade() {
            if (fadeCompletion != null) fadeCompletion.run();
        }
    }
}
