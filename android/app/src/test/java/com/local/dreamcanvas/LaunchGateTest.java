package com.local.dreamcanvas;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class LaunchGateTest {
    @Test
    public void doesNotDismissBeforeMinimumDurationEvenWhenWebIsReady() {
        assertFalse(LaunchGate.shouldDismissSplash(0L, true));
        assertFalse(LaunchGate.shouldDismissSplash(1499L, true));
        assertTrue(LaunchGate.nextCheckDelayMs(1499L, true) > 0L);
    }

    @Test
    public void dismissesAtMinimumDurationWhenWebIsReady() {
        assertTrue(LaunchGate.shouldDismissSplash(1500L, true));
        assertTrue(LaunchGate.nextCheckDelayMs(1500L, true) == 0L);
    }

    @Test
    public void waitsForWebBetweenMinimumAndMaximumDuration() {
        assertFalse(LaunchGate.shouldDismissSplash(1500L, false));
        assertFalse(LaunchGate.shouldDismissSplash(2199L, false));
        assertTrue(LaunchGate.nextCheckDelayMs(2199L, false) == 1L);
    }

    @Test
    public void dismissesAtMaximumDurationEvenWhenWebIsNotReady() {
        assertTrue(LaunchGate.shouldDismissSplash(2200L, false));
        assertTrue(LaunchGate.shouldDismissSplash(3000L, false));
    }
}
