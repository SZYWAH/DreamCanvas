package com.local.dreamcanvas;

import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageView;

import androidx.core.splashscreen.SplashScreen;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String LAUNCH_LOG_TAG = "DreamCanvasLaunch";
    private static final long OVERLAY_ACTIVATION_FALLBACK_MS = 500L;

    private LaunchScreenController launchScreenController;
    private Handler mainHandler;
    private NativeLaunchOverlayHandle launchOverlayHandle;
    private boolean launchOverlayActivated;
    private final Runnable activateLaunchOverlayAction = this::activateLaunchOverlay;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SystemUiPlugin.class);
        registerPlugin(LaunchScreenPlugin.class);
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);

        mainHandler = new Handler(Looper.getMainLooper());
        launchScreenController = new LaunchScreenController(
            SystemClock::uptimeMillis,
            new LaunchScreenController.Scheduler() {
                @Override
                public void schedule(Runnable action, long delayMs) {
                    mainHandler.postDelayed(action, delayMs);
                }

                @Override
                public void cancel(Runnable action) {
                    mainHandler.removeCallbacks(action);
                }
            },
            this::logLaunchEvent
        );
        launchOverlayHandle = createLaunchOverlay();
        splashScreen.setOnExitAnimationListener(provider -> {
            provider.remove();
            mainHandler.removeCallbacks(activateLaunchOverlayAction);
            activateLaunchOverlay();
        });
        mainHandler.postDelayed(activateLaunchOverlayAction, OVERLAY_ACTIVATION_FALLBACK_MS);
    }

    void markWebReady() {
        if (launchScreenController != null) launchScreenController.onWebReady();
    }

    @Override
    public void onDestroy() {
        if (mainHandler != null) mainHandler.removeCallbacks(activateLaunchOverlayAction);
        if (launchScreenController != null) launchScreenController.dispose();
        if (launchOverlayHandle != null) launchOverlayHandle.removeImmediately();
        super.onDestroy();
    }

    private NativeLaunchOverlayHandle createLaunchOverlay() {
        FrameLayout overlay = new FrameLayout(this);
        overlay.setBackgroundColor(Color.BLACK);
        overlay.setClickable(true);
        overlay.setFocusable(true);

        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.splash_icon);
        logo.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        logo.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);

        int logoBoxSize = dpToPx(144);
        FrameLayout.LayoutParams logoParams = new FrameLayout.LayoutParams(logoBoxSize, logoBoxSize);
        logoParams.gravity = Gravity.CENTER;
        overlay.addView(logo, logoParams);

        ViewGroup decorView = (ViewGroup) getWindow().getDecorView();
        decorView.addView(
            overlay,
            new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );
        overlay.bringToFront();
        return new NativeLaunchOverlayHandle(overlay);
    }

    private void activateLaunchOverlay() {
        if (launchOverlayActivated || launchScreenController == null || launchOverlayHandle == null) return;
        launchOverlayActivated = true;
        launchOverlayHandle.show();
        launchScreenController.onSplashViewAvailable(launchOverlayHandle);
    }

    private int dpToPx(int dp) {
        return Math.round(dp * getResources().getDisplayMetrics().density);
    }

    private void logLaunchEvent(String event, long visibleElapsedMs) {
        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            Log.d(LAUNCH_LOG_TAG, event + " visibleElapsedMs=" + visibleElapsedMs);
        }
    }

    private static final class NativeLaunchOverlayHandle implements LaunchScreenController.SplashHandle {
        private final View overlayView;
        private boolean removed;

        NativeLaunchOverlayHandle(View overlayView) {
            this.overlayView = overlayView;
        }

        void show() {
            if (removed) return;
            overlayView.setAlpha(1f);
            overlayView.setVisibility(View.VISIBLE);
            overlayView.bringToFront();
        }

        @Override
        public void fadeOut(long durationMs, Runnable onComplete) {
            if (removed) {
                onComplete.run();
                return;
            }
            overlayView.animate().cancel();
            overlayView.setAlpha(1f);
            overlayView.animate()
                .alpha(0f)
                .setDuration(durationMs)
                .withEndAction(() -> {
                    if (!removed) {
                        removed = true;
                        removeFromParent();
                    }
                    onComplete.run();
                })
                .start();
        }

        @Override
        public void removeImmediately() {
            if (removed) return;
            removed = true;
            overlayView.animate().cancel();
            removeFromParent();
        }

        private void removeFromParent() {
            if (overlayView.getParent() instanceof ViewGroup) {
                ((ViewGroup) overlayView.getParent()).removeView(overlayView);
            }
        }
    }
}
