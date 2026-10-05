// ── lib/theme.dart ───────────────────────────────────────────────
// WHAT: the mobile design tokens, 1:1 with files (2)/MOBILE-DESIGN.md.
// One dark palette, one accent (amber, so the app matches the gold logo
// and the web app), silver-white pills/bubbles, hairline-separated cards.
// Colors live in VsTokens (a ThemeExtension) so widgets read them off the
// theme and NOTHING hard-codes a hex (spec: "Never hard-code a color").
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Design tokens: gradients, radii, spacing and the raw colors.
/// Attached to ThemeData.extensions so any widget can do
/// `VsTokens.of(context).cardRadius`.
@immutable
class VsTokens extends ThemeExtension<VsTokens> {
  const VsTokens();

  // ── accent: the amber set (MOBILE-DESIGN.md "Accent" table, amber column)
  static const Color accent = Color(0xFFF5B63A);
  static const Color accentGlow = Color(0xFFFFD27A);
  static const Color onAccent = Color(0xFF2A1A00);

  // ── screen + surfaces
  static const Color bgTop = Color(0xFF2A332F);
  static const Color bgBottom = Color(0xFF0E1210);
  static const Color surfaceTop = Color(0xFF232A27);
  static const Color surfaceBottom = Color(0xFF1A201D);
  static const Color surfaceDeep = Color(0xFF0F1311);
  static const Color surfaceGlass = Color(0x1AFFFFFF); // rgba(255,255,255,.10)
  static const Color glassBorder = Color(0x1FFFFFFF); // rgba(255,255,255,.12)
  static const Color innerHighlight = Color(0x0FFFFFFF); // white @ 6%, top edge
  static const Color hairline = Color(0x14FFFFFF); // rgba(255,255,255,.08)

  // ── silver (primary actions + bot bubbles). Text on silver: onSilver.
  static const Color silverTop = Color(0xFFFFFFFF);
  static const Color silverBottom = Color(0xFFA8ADAA);
  static const Color onSilver = Color(0xFF101513);

  // ── text
  static const Color text = Color(0xFFF2F4F1);
  static const Color textMuted = Color(0xFF8F9994);
  static const Color textFaint = Color(0xFF5F6965);

  // ── status (always paired with an icon or label)
  static const Color danger = Color(0xFFFF8A7A);
  static const Color success = Color(0xFF7FD6A0);

  // ── type
  static const String fontDisplay = 'Sora'; // headlines, weight 300
  static const String fontBody = 'DMSans'; // body + UI
  static const double fsHero = 44; // 40-48 band
  static const double fsSection = 22;
  static const double fsBodyLg = 16;
  static const double fsBody = 14;
  static const double fsLabel = 12;

  // ── radii
  static const double rChip = 16; // chips + inputs inside cards
  static const double rCard = 24;
  static const double rRow = 28; // rows + bottom bar
  static const double rPill = 999;

  // ── spacing scale
  static const double s4 = 4;
  static const double s8 = 8;
  static const double s12 = 12;
  static const double s16 = 16;
  static const double s20 = 20; // screen padding
  static const double s24 = 24;
  static const double s32 = 32;
  static const double s48 = 48;

  // ── the only soft shadow in the system: under silver pills
  static const List<BoxShadow> silverShadow = [
    BoxShadow(color: Color(0x59000000), blurRadius: 24, offset: Offset(0, 8)),
  ];

  static VsTokens of(BuildContext context) =>
      Theme.of(context).extension<VsTokens>() ?? const VsTokens();

  // ── gradients (the ONLY four allowed)
  static const LinearGradient bgGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [bgTop, bgBottom],
  );

  static const LinearGradient surfaceGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [surfaceTop, surfaceBottom],
  );

  static const LinearGradient silverGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [silverTop, silverBottom],
  );

  /// The one glowing ring: selected plan dot, selected chip.
  static const LinearGradient glowGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [accentGlow, accent],
  );

  @override
  VsTokens copyWith() => const VsTokens();

  @override
  VsTokens lerp(ThemeExtension<VsTokens>? other, double t) =>
      const VsTokens();
}

class VeloSalesTheme {
  static const _key = 'velosalesai_theme_mode'; // kept: settings still writes it

  static Future<ThemeMode> loadMode() async {
    final p = await SharedPreferences.getInstance();
    switch (p.getString(_key)) {
      case 'light':
        return ThemeMode.light;
      case 'dark':
        return ThemeMode.dark;
      default:
        return ThemeMode.system;
    }
  }

  static Future<void> saveMode(ThemeMode m) async {
    final p = await SharedPreferences.getInstance();
    await p.setString(
        _key, m == ThemeMode.light ? 'light' : m == ThemeMode.dark ? 'dark' : 'system');
  }

  /// Status bar: always light icons over the dark screen gradient.
  static const SystemUiOverlayStyle overlay = SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    statusBarBrightness: Brightness.dark,
    systemNavigationBarColor: VsTokens.surfaceDeep,
    systemNavigationBarIconBrightness: Brightness.light,
    systemNavigationBarDividerColor: Colors.transparent,
  );

  /// Dark-first. `light` intentionally returns the SAME dark palette: the
  /// spec ships dark only, and a half-built light theme would flash white
  /// and break contrast. The stored preference is preserved either way.
  static ThemeData get light => dark;

  static ThemeData get dark {
    const scheme = ColorScheme.dark(
      primary: VsTokens.accent,
      onPrimary: VsTokens.onAccent,
      primaryContainer: VsTokens.surfaceDeep,
      onPrimaryContainer: VsTokens.text,
      secondary: VsTokens.accentGlow,
      onSecondary: VsTokens.onAccent,
      surface: VsTokens.surfaceBottom,
      onSurface: VsTokens.text,
      surfaceContainerLowest: VsTokens.bgBottom,
      surfaceContainerHigh: VsTokens.surfaceTop,
      outline: VsTokens.hairline,
      error: VsTokens.danger,
      onError: Color(0xFF2A0B08),
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: Colors.transparent, // AppBackground paints it
      canvasColor: VsTokens.bgBottom,
      extensions: const [VsTokens()],
      textTheme: _text,
      // page transitions: gentle fade + 12px rise (spec: Motion)
      pageTransitionsTheme: const PageTransitionsTheme(builders: {
        TargetPlatform.android: _FadeRisePageBuilder(),
        TargetPlatform.iOS: _FadeRisePageBuilder(),
        TargetPlatform.linux: _FadeRisePageBuilder(),
        TargetPlatform.macOS: _FadeRisePageBuilder(),
        TargetPlatform.windows: _FadeRisePageBuilder(),
      }),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent, // screen gradient shows through
        surfaceTintColor: Colors.transparent,
        foregroundColor: VsTokens.text,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: true,
        systemOverlayStyle: overlay,
        titleTextStyle: const TextStyle(
          fontFamily: VsTokens.fontDisplay,
          fontSize: 16,
          fontWeight: FontWeight.w400,
          color: VsTokens.text,
        ),
      ),
      // Secondary action: deep fill, hairline, white text. Primary lives in
      // SilverButton (needs a gradient, which ButtonStyle cannot express).
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: VsTokens.surfaceDeep,
          foregroundColor: VsTokens.text,
          minimumSize: const Size(0, 48),
          padding: const EdgeInsets.symmetric(horizontal: 20),
          textStyle: _bodyStyle(FontWeight.w500),
          shape: const RoundedRectangleBorder(
            borderRadius: BorderRadius.all(Radius.circular(VsTokens.rPill)),
            side: BorderSide(color: VsTokens.hairline),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: VsTokens.text,
          minimumSize: const Size(0, 48),
          padding: const EdgeInsets.symmetric(horizontal: 20),
          textStyle: _bodyStyle(FontWeight.w500),
          side: const BorderSide(color: VsTokens.hairline),
          shape: const RoundedRectangleBorder(
            borderRadius: BorderRadius.all(Radius.circular(VsTokens.rPill)),
          ),
        ),
      ),
      // inputs: deep well, hairline, radius 16
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: VsTokens.surfaceDeep,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        hintStyle: _bodyStyle(FontWeight.w400).copyWith(color: VsTokens.textMuted),
        labelStyle: _bodyStyle(FontWeight.w400).copyWith(color: VsTokens.textMuted),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(VsTokens.rChip),
          borderSide: const BorderSide(color: VsTokens.hairline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(VsTokens.rChip),
          borderSide: const BorderSide(color: VsTokens.accent, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(VsTokens.rChip),
          borderSide: const BorderSide(color: VsTokens.danger),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(VsTokens.rChip),
          borderSide: const BorderSide(color: VsTokens.danger, width: 1.5),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: VsTokens.hairline,
        thickness: 1,
        space: 1,
      ),
      // bottom bar + sheets paint their own surfaces
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: Colors.transparent,
        modalBackgroundColor: Colors.transparent,
        elevation: 0,
      ),
      dialogTheme: const DialogThemeData(
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: Colors.transparent,
        indicatorColor: VsTokens.accent.withValues(alpha: 0.16),
        labelTextStyle: WidgetStateProperty.resolveWith((s) => TextStyle(
              fontFamily: VsTokens.fontBody,
              fontSize: VsTokens.fsLabel,
              fontWeight: FontWeight.w500,
              color: s.contains(WidgetState.selected)
                  ? VsTokens.text
                  : VsTokens.textFaint,
            )),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((s) =>
            s.contains(WidgetState.selected)
                ? VsTokens.onAccent
                : VsTokens.textMuted),
        trackColor: WidgetStateProperty.resolveWith((s) =>
            s.contains(WidgetState.selected)
                ? VsTokens.accent
                : VsTokens.surfaceDeep),
        trackOutlineColor:
            const WidgetStatePropertyAll(VsTokens.hairline),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: VsTokens.surfaceDeep,
        contentTextStyle: _bodyStyle(FontWeight.w400),
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(VsTokens.rChip)),
          side: BorderSide(color: VsTokens.hairline),
        ),
      ),
    );
  }

  // ── typography: Sora for headlines (weight 300), DM Sans for everything else
  static const TextStyle _headline = TextStyle(
    fontFamily: VsTokens.fontDisplay,
    fontSize: VsTokens.fsHero,
    height: 1.05,
    letterSpacing: -0.44, // -1%
    fontWeight: FontWeight.w300,
    color: VsTokens.text,
    fontVariations: [FontVariation('wght', 300)],
  );

  /// Variable-font instance for a Flutter weight (no deprecated .index).
  static double _wght(FontWeight w) {
    if (w == FontWeight.w300) return 300;
    if (w == FontWeight.w400) return 400;
    if (w == FontWeight.w500) return 500;
    if (w == FontWeight.w600) return 600;
    if (w == FontWeight.w700) return 700;
    return 400;
  }

  static TextStyle _bodyStyle(FontWeight w) => TextStyle(
        fontFamily: VsTokens.fontBody,
        fontSize: VsTokens.fsBody,
        height: 1.45,
        fontWeight: w,
        color: VsTokens.text,
        fontVariations: [FontVariation('wght', _wght(w))],
      );

  static final TextTheme _text = TextTheme(
    displayLarge: _headline,
    displayMedium: _headline,
    displaySmall: _headline.copyWith(fontSize: 40),
    headlineLarge: _headline.copyWith(fontSize: VsTokens.fsHero),
    headlineMedium: _headline.copyWith(fontSize: 34),
    headlineSmall: _headline.copyWith(fontSize: VsTokens.fsSection, height: 1.2),
    titleLarge: _bodyStyle(FontWeight.w500).copyWith(fontSize: VsTokens.fsBodyLg),
    titleMedium: _bodyStyle(FontWeight.w500),
    titleSmall: _bodyStyle(FontWeight.w500).copyWith(fontSize: VsTokens.fsLabel),
    bodyLarge: _bodyStyle(FontWeight.w400).copyWith(fontSize: VsTokens.fsBodyLg),
    bodyMedium: _bodyStyle(FontWeight.w400),
    bodySmall: _bodyStyle(FontWeight.w400).copyWith(
        fontSize: 13, color: VsTokens.textMuted),
    labelLarge: _bodyStyle(FontWeight.w500),
    labelMedium: _bodyStyle(FontWeight.w500).copyWith(fontSize: VsTokens.fsLabel),
    // tiny tracked plan labels are the one all-caps exception
    labelSmall: _bodyStyle(FontWeight.w500).copyWith(
        fontSize: VsTokens.fsLabel, letterSpacing: 0.6, color: VsTokens.textMuted),
  );
}

/// Gentle fade + 12px rise. One transition for every platform.
class _FadeRisePageBuilder extends PageTransitionsBuilder {
  const _FadeRisePageBuilder();

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    final curved = CurvedAnimation(parent: animation, curve: Curves.easeOut);
    return FadeTransition(
      opacity: curved,
      child: SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0, 0.03), // 12px on a ~400px tall page
          end: Offset.zero,
        ).animate(curved),
        child: child,
      ),
    );
  }
}