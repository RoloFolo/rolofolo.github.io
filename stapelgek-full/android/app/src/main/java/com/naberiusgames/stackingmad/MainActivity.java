package com.naberiusgames.stackingmad;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Shows the game (assets/index.html) full screen. */
public class MainActivity extends Activity {
    // View.SYSTEM_UI_FLAG_* values.
    private static final int IMMERSIVE = 0x1000 /* IMMERSIVE_STICKY */ | 0x0004 /* FULLSCREEN */
            | 0x0002 /* HIDE_NAVIGATION */ | 0x0200 /* LAYOUT_HIDE_NAVIGATION */
            | 0x0400 /* LAYOUT_FULLSCREEN */ | 0x0100 /* LAYOUT_STABLE */;

    private WebView web;
    private RewardedVideos videos;

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
        // Rewarded videos for the game; the page finds them as window.StapelgekFullAds.
        videos = new RewardedVideos(this, web);
        web.addJavascriptInterface(videos, "StapelgekFullAds");
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
        // Stops the music loop while the app is in the background. pauseTimers() holds every WebView in the app,
        // also the one a video ad plays in, so not while a video is on screen: its countdown and close button would stop.
        if (!videos.isShowing()) web.pauseTimers();
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
