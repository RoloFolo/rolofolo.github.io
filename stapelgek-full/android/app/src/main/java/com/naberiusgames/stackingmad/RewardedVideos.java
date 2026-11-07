package com.naberiusgames.stackingmad;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.RequestConfiguration;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Rewarded AdMob videos for the game, always started by the player (window.StapelgekFullAds in JavaScript).
 * Nothing starts before the game has told the player's age group (setAudience), asked once at the first start:
 * children get only non-personalized ads suitable for everyone, and no consent form; under 16 never personalized.
 * For the others, where the law asks for it (Europe, the UK), Google's consent form comes first.
 * The game hears back through window.stapelgekfullAdDone(id, rewarded, why).
 */
final class RewardedVideos {
    private static final long WAIT_FOR_LOAD_MS = 8000;

    private final Activity activity;
    private final WebView web;
    private final ConsentInformation consent;
    private final AtomicBoolean told = new AtomicBoolean(false);
    private final Handler main = new Handler(Looper.getMainLooper());
    private final AtomicBoolean started = new AtomicBoolean(false);
    private RewardedAd ad;
    private boolean loading;
    private int waitingId = -1; // a video the player asked for while it was still loading

    RewardedVideos(Activity activity, WebView web) {
        this.activity = activity;
        this.web = web;
        consent = UserMessagingPlatform.getConsentInformation(activity);
    }

    /** "child" (under 13), "teen" (13 to 15) or "adult"; only the first call of a run counts. */
    @JavascriptInterface
    public void setAudience(final String who) {
        if (told.getAndSet(true)) return;
        main.post(() -> {
            boolean child = "child".equals(who);
            boolean young = child || "teen".equals(who);
            MobileAds.setRequestConfiguration(new RequestConfiguration.Builder()
                    .setTagForChildDirectedTreatment(child
                            ? RequestConfiguration.TAG_FOR_CHILD_DIRECTED_TREATMENT_TRUE
                            : RequestConfiguration.TAG_FOR_CHILD_DIRECTED_TREATMENT_FALSE)
                    .setTagForUnderAgeOfConsent(young
                            ? RequestConfiguration.TAG_FOR_UNDER_AGE_OF_CONSENT_TRUE
                            : RequestConfiguration.TAG_FOR_UNDER_AGE_OF_CONSENT_FALSE)
                    .setMaxAdContentRating(child
                            ? RequestConfiguration.MAX_AD_CONTENT_RATING_G
                            : RequestConfiguration.MAX_AD_CONTENT_RATING_PG)
                    .build());
            // Under the age of consent the form is never shown; Google then serves only non-personalized ads.
            consent.requestConsentInfoUpdate(activity,
                    new ConsentRequestParameters.Builder().setTagForUnderAgeOfConsent(young).build(),
                    () -> {
                        if (young) startAds();
                        else UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity, error -> startAds());
                    },
                    error -> startAds());
            startAds(); // a choice made on an earlier day may already allow ads
        });
    }

    private void startAds() {
        if (!consent.canRequestAds() || started.getAndSet(true)) return;
        new Thread(() -> MobileAds.initialize(activity, status -> main.post(this::load))).start();
    }

    private void load() {
        if (ad != null || loading || !started.get()) return;
        loading = true;
        RewardedAd.load(activity, BuildConfig.REWARDED_ID, new AdRequest.Builder().build(), new RewardedAdLoadCallback() {
            @Override
            public void onAdLoaded(RewardedAd loaded) {
                loading = false;
                ad = loaded;
                if (waitingId >= 0) {
                    int id = waitingId;
                    waitingId = -1;
                    play(id);
                }
            }

            @Override
            public void onAdFailedToLoad(LoadAdError error) {
                loading = false;
                if (waitingId >= 0) {
                    answer(waitingId, false, "none");
                    waitingId = -1;
                }
            }
        });
    }

    @JavascriptInterface
    public void show(final int id) {
        main.post(() -> {
            if (ad != null) { play(id); return; }
            if (!started.get()) { answer(id, false, "none"); return; }
            // Not ready yet: wait a little for the video that is on its way.
            waitingId = id;
            load();
            main.postDelayed(() -> {
                if (waitingId != id) return;
                waitingId = -1;
                answer(id, false, "none");
            }, WAIT_FOR_LOAD_MS);
        });
    }

    private void play(final int id) {
        RewardedAd showing = ad;
        ad = null;
        final boolean[] earned = {false};
        showing.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override
            public void onAdDismissedFullScreenContent() {
                answer(id, earned[0], "");
                load();
            }

            @Override
            public void onAdFailedToShowFullScreenContent(AdError error) {
                answer(id, false, "none");
                load();
            }
        });
        showing.show(activity, reward -> earned[0] = true);
    }

    /** Whether the settings must offer a way to change the ads choice (Europe, the UK). */
    @JavascriptInterface
    public boolean privacyOptions() {
        return consent.getPrivacyOptionsRequirementStatus() == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED;
    }

    @JavascriptInterface
    public void showPrivacyOptions() {
        main.post(() -> UserMessagingPlatform.showPrivacyOptionsForm(activity, error -> startAds()));
    }

    private void answer(int id, boolean rewarded, String why) {
        web.evaluateJavascript("window.stapelgekfullAdDone && window.stapelgekfullAdDone(" + id + ", " + rewarded + ", '" + why + "')", null);
    }
}
