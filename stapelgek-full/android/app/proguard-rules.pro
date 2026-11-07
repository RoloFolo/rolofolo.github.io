# The game calls the ads bridge from JavaScript, so its methods must keep their names.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
