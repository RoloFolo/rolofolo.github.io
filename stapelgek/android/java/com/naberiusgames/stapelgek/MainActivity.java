package com.naberiusgames.stapelgek;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Shows the game (assets/index.html) full screen. */
public class MainActivity extends Activity {
    // View.SYSTEM_UI_FLAG_* values; the newer ones are not in the API 16 stubs we compile against.
    private static final int IMMERSIVE = 0x1000 /* IMMERSIVE_STICKY */ | 0x0004 /* FULLSCREEN */
            | 0x0002 /* HIDE_NAVIGATION */ | 0x0200 /* LAYOUT_HIDE_NAVIGATION */
            | 0x0400 /* LAYOUT_FULLSCREEN */ | 0x0100 /* LAYOUT_STABLE */;

    private WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        web.setBackgroundColor(0xffb9dcff);
        web.setWebViewClient(new WebViewClient());
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true); // the record is kept in localStorage
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        setContentView(web);

        if (state == null) web.loadUrl("file:///android_asset/index.html");
        else web.restoreState(state);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) getWindow().getDecorView().setSystemUiVisibility(IMMERSIVE);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onPause() {
        web.onPause();
        web.pauseTimers(); // stops the music loop while the app is in the background
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.resumeTimers();
        web.onResume();
    }

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }
}
