# ─────────────────────────────────────────────────────────────────────────────
# R8 / ProGuard rules for the VeloSales Ai release build.
#
# Release builds are minified + resource-shrunk (see build.gradle.kts). Dart code
# is already tree-shaken by the AOT compiler, so this mostly protects the Java
# and Kotlin layer — which is exactly where the two silent-crash traps live:
#
#   1. The Flutter embedding and the engine, which Dart calls into by name.
#   2. Plugin classes, which the Android runtime instantiates REFLECTIVELY via
#      GeneratedPluginRegistrant. Obfuscating a plugin class it was told to
#      instantiate by string name produces a ClassNotFoundException that only
#      ever appears in release — the app installs, launches, then dies.
#
# Rule of thumb: if something is reached from Kotlin by a string literal, a
# serializer, or reflection, it needs a keep rule here.
# ─────────────────────────────────────────────────────────────────────────────

# Flutter embedding + engine (called from Dart by name, not by import path).
-keep class io.flutter.app.** { *; }
-keep class io.flutter.embedding.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.plugins.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.** { *; }

# The registrant is instantiated reflectively by the engine at startup.
-keep class io.flutter.plugins.GeneratedPluginRegistrant { *; }
-keep class io.flutter.plugins.GeneratedPluginRegistrant$* { *; }

# url_launcher / our own plugin glue — resolves activities from the manifest.
-keep class xyz.luan.** { *; }
-keep class io.flutter.plugins.**.MethodCallHandler { *; }

# Keep annotations: Dart-side reflection and dependency-injection read these.
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes InnerClasses
-keepattributes EnclosingMethod
-keepattributes Exceptions

# Kotlin metadata + coroutines (kotlinx-coroutines is used by several plugins).
-keep class kotlin.** { *; }
-keepclassmembers class **$Companion { *; }
-keepclasseswithmembers class kotlin.** { volatile <fields>; }
-dontwarn kotlinx.coroutines.**

# OkHttp (used transitively by the HTTP stack) ships optional platform hooks.
-dontwarn okhttp3.**
-dontwarn okio.**

# Play Core is referenced only by plugins that may not be in this build.
-dontwarn com.google.android.play.core.**
