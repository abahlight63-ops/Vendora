// ── lib/theme.dart ───────────────────────────────────────────────
// WHAT: the app's design tokens as Flutter themes — kept 1:1 with the web
// build (frontend/src/styles.css). Light = :root, dark = [data-theme="dark"].
//
// This used to be the OLD language: an "orange is green" accent, Inter, and a
// liquid-glass scaffold (translucent surfaces over a mesh gradient). None of
// that is the brand. It is now the web token set — one purple for every
// primary action, green kept for success only, flat surfaces, Manrope.
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class VeloSalesTheme {
  static const _key = 'velosalesai_theme_mode'; // 'light' | 'dark' | 'system'

  // ── :root (web light default) ──
  // Locked to the founder's reference dashboard (2026-10): indigo is authority,
  // amber is money/attention, green is only ever "it worked". Same values as
  // frontend/src/styles.css — if one changes, change both.
  static const purple = Color(0xFF5B4BD6); // the ONE primary accent
  static const purpleDark = Color(0xFF4938B4);
  static const purpleSoft = Color(0xFFEFEBFE); // tinted fills (chips, bubbles)
  static const purpleLine = Color(0xFFCFC6F8);
  static const accentSolid = Color(0xFF4F3FC7); // button fill — white text works in BOTH themes
  static const accentSolidHover = Color(0xFF4133A4);

  // ── the rail (drawer chrome) ──
  // The drawer is the phone's sidebar, so it wears the same deep-indigo wash the
  // web rail does — brand + nav on a dark frame, content on light paper.
  static const rail1 = Color(0xFF352A7F);
  static const rail2 = Color(0xFF221A56);
  static const rail3 = Color(0xFF1A1443);
  static const railInk = Color(0xFFF4F2FE);
  static const railMuted = Color(0xFFC6C0EA);
  static const railFaint = Color(0xFF9C95CB);
  static const railLine = Color(0x1FFFFFFF); // rgba(255,255,255,.12)
  static const railHover = Color(0x1AFFFFFF); // .10
  static const railActive = Color(0x2BFFFFFF); // .17
  static const railGrad = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [rail1, rail2, rail3],
    stops: [0.0, 0.58, 1.0],
  );

  // green = success / online / KPI-up ONLY (never a primary action)
  static const green = Color(0xFF10B981);
  static const greenDark = Color(0xFF059669);
  static const greenSoft = Color(0xFFD1FAE5);
  static const red = Color(0xFFDC2626);
  static const gold = Color(0xFFD97706);

  /// Kept so existing call sites keep compiling — this is the brand accent now.
  static const accentTeal = purpleDark;

  // ── brand-mark ramp ──
  // Same three steps as the web's --lg-top/mid/bot in styles.css, so the mark
  // is literally the same colour on both surfaces. The mark carries its own
  // light-to-dark gradient (it is the one element allowed to).
  static Color markTop(BuildContext c) =>
      Theme.of(c).brightness == Brightness.dark
          ? const Color(0xFFCFC7FD)
          : const Color(0xFFA89DF7);
  static Color markMid(BuildContext c) =>
      Theme.of(c).brightness == Brightness.dark
          ? const Color(0xFF8B7FF0)
          : purple;
  static Color markBot(BuildContext c) =>
      Theme.of(c).brightness == Brightness.dark
          ? const Color(0xFF5B4BD6)
          : const Color(0xFF4B3BB2);
  static Color markEdge(BuildContext c) =>
      Colors.white.withValues(alpha: Theme.of(c).brightness == Brightness.dark ? 0.30 : 0.45);

  // ── soft tints ──
  // The pastel fills the home screen's action cards use. Deliberately very
  // light: they sit behind text, so they carry a hue, never a shade.
  static Color tintLavender(BuildContext c) =>
      Theme.of(c).brightness == Brightness.dark ? const Color(0xFF221C4D) : const Color(0xFFEFEBFE);
  static Color tintSky(BuildContext c) =>
      Theme.of(c).brightness == Brightness.dark ? const Color(0xFF14243D) : const Color(0xFFEAF0FE);
  static Color tintMint(BuildContext c) =>
      Theme.of(c).brightness == Brightness.dark ? const Color(0xFF10291F) : const Color(0xFFE9F9F1);

  /// The one authored gradient in the app: the primary action fill.
  static LinearGradient cta(BuildContext c) => LinearGradient(
        begin: Alignment.centerLeft,
        end: Alignment.centerRight,
        colors: Theme.of(c).brightness == Brightness.dark
            ? const [Color(0xFF8B7FF0), Color(0xFF6D5CE0)]
            : const [Color(0xFF6A59DF), Color(0xFF4A3AB8)],
      );

  static const radius = 16.0; // cards
  static const radiusSmall = 12.0; // inputs
  static const pill = 999.0; // buttons + chips

  static const _font = 'Manrope';

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

  static TextTheme _text(TextTheme base) => base.apply(
        fontFamily: _font,
        bodyColor: const Color(0xFF171532),
        displayColor: const Color(0xFF171532),
      );

  static ThemeData get light {
    const ink = Color(0xFF171532);
    const muted = Color(0xFF6B6885);
    const line = Color(0xFFE7E5F0);
    const bg = Color(0xFFF7F6FB);
    const card = Color(0xFFFFFFFF);
    const scheme = ColorScheme.light(
      primary: accentSolid,
      onPrimary: Colors.white,
      primaryContainer: purpleSoft,
      onPrimaryContainer: Color(0xFF2B2168),
      surface: card,
      onSurface: ink,
      surfaceContainerLowest: bg,
      outline: line,
      error: red,
    );
    return _build(scheme, bg, card, line, muted, ink, Brightness.light);
  }

  static ThemeData get dark {
    const ink = Color(0xFFF2F1FA);
    const muted = Color(0xFFA5A1C0);
    const line = Color(0xFF272346);
    const bg = Color(0xFF0E0C1D);
    const card = Color(0xFF181530);
    const scheme = ColorScheme.dark(
      primary: Color(0xFF8B7FF0),
      onPrimary: Colors.white,
      primaryContainer: Color(0xFF221C4D),
      onPrimaryContainer: Color(0xFFDDD8FF),
      surface: card,
      onSurface: ink,
      surfaceContainerLowest: bg,
      outline: line,
      error: Color(0xFFF87171),
    );
    return _build(scheme, bg, card, line, muted, ink, Brightness.dark);
  }

  static ThemeData _build(
    ColorScheme scheme,
    Color bg,
    Color card,
    Color line,
    Color muted,
    Color ink,
    Brightness brightness,
  ) {
    final base = ThemeData(brightness: brightness, useMaterial3: true, fontFamily: _font);
    return base.copyWith(
      colorScheme: scheme,
      // Flat: scaffolds paint the page colour outright. The old build left them
      // transparent so a mesh gradient showed through — that is gone.
      scaffoldBackgroundColor: bg,
      canvasColor: bg,
      dividerColor: line,
      textTheme: _text(base.textTheme).apply(bodyColor: ink, displayColor: ink),
      // .page fade .12s → global page transition (fast fade).
      pageTransitionsTheme: const PageTransitionsTheme(builders: {
        TargetPlatform.android: _FadePageBuilder(),
        TargetPlatform.iOS: _FadePageBuilder(),
        TargetPlatform.linux: _FadePageBuilder(),
        TargetPlatform.macOS: _FadePageBuilder(),
        TargetPlatform.windows: _FadePageBuilder(),
      }),
      appBarTheme: AppBarTheme(
        backgroundColor: bg, // solid — no frost, no blur
        surfaceTintColor: Colors.transparent,
        foregroundColor: ink,
        elevation: 0,
        scrolledUnderElevation: 0,
        // .topbar 1px bottom border (Divider under AppBar via shape).
        shape: Border(bottom: BorderSide(color: line)),
        titleTextStyle: TextStyle(
            fontFamily: _font, fontSize: 17, fontWeight: FontWeight.w800, color: ink),
      ),
      // .card: 16px radius, 1px token border, no drop shadow games.
      cardTheme: CardThemeData(
        color: card,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radius),
          side: BorderSide(color: line),
        ),
      ),
      // .btn: pill, semibold 14 (matches the web build).
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(0, 44),
          padding: const EdgeInsets.symmetric(horizontal: 22),
          textStyle: const TextStyle(
              fontFamily: _font, fontSize: 14, fontWeight: FontWeight.w700),
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(pill)),
          // Disabled still reads as the same button, just unavailable —
          // Material's default washes it out to a different-looking control.
          disabledBackgroundColor: scheme.primary.withValues(alpha: 0.34),
          disabledForegroundColor: scheme.onPrimary.withValues(alpha: 0.85),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(0, 44),
          padding: const EdgeInsets.symmetric(horizontal: 22),
          foregroundColor: ink,
          textStyle: const TextStyle(
              fontFamily: _font, fontSize: 14, fontWeight: FontWeight.w700),
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(pill)),
          side: BorderSide(color: line),
          disabledForegroundColor: muted.withValues(alpha: 0.55),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: scheme.primary,
          textStyle: const TextStyle(
              fontFamily: _font, fontSize: 14, fontWeight: FontWeight.w700),
        ),
      ),
      // inputs: 44px, small radius, purple focus + soft ring.
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: card,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        hintStyle: TextStyle(fontFamily: _font, fontSize: 14, color: muted),
        labelStyle: TextStyle(fontFamily: _font, fontSize: 14, color: muted),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusSmall),
          borderSide: BorderSide(color: line),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusSmall),
          borderSide: BorderSide(color: scheme.primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusSmall),
          borderSide: BorderSide(color: scheme.error),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: card, // solid bar, hairline above
        surfaceTintColor: Colors.transparent,
        indicatorColor: scheme.primaryContainer,
        elevation: 0,
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: card,
        modalBackgroundColor: card,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: card,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      ),
      chipTheme: base.chipTheme.copyWith(
        backgroundColor: card,
        selectedColor: purpleSoft,
        side: BorderSide(color: line),
        labelStyle:
            const TextStyle(fontFamily: _font, fontSize: 13, fontWeight: FontWeight.w600),
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(pill)),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      listTileTheme: ListTileThemeData(
        iconColor: muted,
        textColor: ink,
      ),
    );
  }
}

// .page { animation: fade 0.12s ease } — page-level fade, both platforms.
class _FadePageBuilder extends PageTransitionsBuilder {
  const _FadePageBuilder();
  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    return FadeTransition(
      opacity: animation.drive(CurveTween(curve: Curves.ease)),
      child: child,
    );
  }
}
