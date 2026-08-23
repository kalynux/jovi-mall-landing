# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# ── Capacitor ────────────────────────────────────────────────────────────────
#
# Capacitor finds plugins by reflection: `@CapacitorPlugin`-annotated classes are
# instantiated by name, and `@PluginMethod` methods are invoked by name from
# JavaScript. R8 sees no caller for either and removes them, which does NOT fail
# the build — it produces an APK where every native call silently does nothing.
# That is the whole reason these rules exist.
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod public <methods>;
}

# Cordova plugins bridged through capacitor-cordova-android-plugins.
-keep class org.apache.cordova.** { *; }

# The JS bridge is annotation-driven on the Java side too.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep annotations themselves, or the keeps above match nothing.
-keepattributes *Annotation*, JavascriptInterface
