package com.local.dreamcanvas;

import android.graphics.Color;
import android.view.Window;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SystemUi")
public class SystemUiPlugin extends Plugin {
    @PluginMethod
    public void setNavigationBar(PluginCall call) {
        String color = call.getString("color", "#000000");
        Boolean lightIcons = call.getBoolean("lightIcons", true);
        getActivity().runOnUiThread(() -> {
            try {
                Window window = getActivity().getWindow();
                window.setNavigationBarColor(Color.parseColor(color));
                WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
                controller.setAppearanceLightNavigationBars(!Boolean.TRUE.equals(lightIcons));
                call.resolve(new JSObject());
            } catch (Exception error) {
                call.reject("Unable to update the Android navigation bar", error);
            }
        });
    }
}
