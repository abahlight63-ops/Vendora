// ── lib/theme.dart ───────────────────────────────────────────────
// WHAT: VeloSales Ai web tokens as Flutter themes — 1:1 with
// frontend/src/styles.css. Light = :root tokens (the web DEFAULT),
// dark = [data-theme="dark"] overrides. Same Inter, same 12px radius,
// same 180ms motion feel. ThemeMode persists (SharedPreferences).
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class VeloSalesTheme {
  static const _radius = 12.0;
  static const _key = 'velosalesai_theme_mode'; // 'light' | 'dark' | 'system'

  // ── :root (web light default) ──
  static const lightGreen = Color(0xFF128C4A);
  static const lightGreenDark = Color(0xFF0B6B38);

  // ── [data-theme="dark"] ──
  static const darkGreen = Color(0xFF25D366);
  static const darkGreenSoft = Color(0xFF7EF0C0);

  // ── liquid-glass glow (shared with web --glass-teal) ──
  static const accentTeal = Color(0xFF5EEAD4);
  static const accentGold = Color(0xFFFFCF5C);

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

  static TextTheme _text(TextTheme base, Color body, Color muted) =>
      base.apply(bodyColor: body, displayColor: body, fontFamily: 'Inter');

  // ── eye-friendly light blue (matches the web light theme) ──
  static const lightBlue = Color(0xFF1F6FEB);
  static const lightBlueBg = Color(0xFFE3EEFE);

  static ThemeData get light {
    const ink = Color(0xFF10233A);
    const muted = Color(0xFF4A6A8A);
    const line = Color(0xFFDBE7F5);
    const bg = Color(0xFFF8FAFC);
    const card = Color(0xFFFFFFFF);
    const scheme = ColorScheme.light(
      primary: lightBlue,
      onPrimary: Colors.white,
      primaryContainer: lightBlueBg,
      surface: card,
      onSurface: ink,
      surfaceContainerLowest: bg,
      error: Color(0xFFD92D20),
    );
    return _build(scheme, bg, card, line, muted, ink);
  }

  static ThemeData get dark {
    const ink = Color(0xFFEAF3ED);
    const muted = Color(0xFFA9C6B4);
    const line = Color(0xFF1D4030);
    const bg = Color(0xFF06110C);
    const card = Color(0xFF0B1E14);
    const scheme = ColorScheme.dark(
      primary: darkGreen,
      onPrimary: Color(0xFF062B18),
      surface: card,
      onSurface: ink,
      surfaceContainerLowest: bg,
      error: Color(0xFFFF7A70),
    );
    return _build(scheme, bg, card, line, muted, ink);
  }

  static ThemeData _build(
    ColorScheme scheme,
    Color bg,
    Color card,
    Color line,
    Color muted,
    Color ink,
  ) {
    // Liquid glass: scaffolds are TRANSPARENT so the mesh gradient
    // (GlassBackground, stacked in MaterialApp.builder) shows through —
    // every frosted surface above refracts it. Splash keeps its own
    // explicit background (brand moment, unaffected).
    final frost = card.withValues(alpha: 0.72); // bar tint (blurred on top)
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: Colors.transparent,
      textTheme: _text(ThemeData.light().textTheme, ink, muted),
      // .page fade .12s → global page transition (fast fade).
      pageTransitionsTheme: const PageTransitionsTheme(builders: {
        TargetPlatform.android: _FadePageBuilder(),
        TargetPlatform.iOS: _FadePageBuilder(),
        TargetPlatform.linux: _FadePageBuilder(),
        TargetPlatform.macOS: _FadePageBuilder(),
        TargetPlatform.windows: _FadePageBuilder(),
      }),
      appBarTheme: AppBarTheme(
        backgroundColor: frost, // translucent: main.dart blurs beneath it
        foregroundColor: ink,
        elevation: 0,
        scrolledUnderElevation: 0,
        // .topbar 1px bottom border (Divider under AppBar via shape).
        shape: Border(bottom: BorderSide(color: line)),
        titleTextStyle: TextStyle(
            fontFamily: 'Inter',
            fontSize: 17,
            fontWeight: FontWeight.w700,
            color: ink),
      ),
      // .card: 24px padding, 12px radius, 1px token border, tiny shadow.
      cardTheme: CardThemeData(
        color: card,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(_radius),
          side: BorderSide(color: line),
        ),
      ),
      // .btn: h40, radius 12, semibold 14.
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(0, 40),
          padding: const EdgeInsets.symmetric(horizontal: 20),
          textStyle: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 14,
              fontWeight: FontWeight.w600),
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(_radius)),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(0, 40),
          padding: const EdgeInsets.symmetric(horizontal: 20),
          textStyle: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 14,
              fontWeight: FontWeight.w600),
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(_radius)),
          side: BorderSide(color: line),
        ),
      ),
      // inputs: h44, radius 12, 2px accent focus + soft ring.
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: card,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        hintStyle: TextStyle(
            fontFamily: 'Inter', fontSize: 14, color: muted),
        labelStyle: TextStyle(
            fontFamily: 'Inter', fontSize: 14, color: muted),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(_radius),
          borderSide: BorderSide(color: line),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(_radius),
          borderSide: BorderSide(color: scheme.primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(_radius),
          borderSide: BorderSide(color: scheme.error),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: frost, // translucent: main.dart blurs beneath it
        indicatorColor: scheme.primary.withValues(alpha: 0.15),
      ),
      // Sheets + dialogs paint their own glass (glass.dart) — theme stays
      // transparent so it never covers the frost with a solid panel.
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: Colors.transparent,
        modalBackgroundColor: Colors.transparent,
        elevation: 0,
      ),
      dialogTheme: const DialogThemeData(
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      chipTheme: ThemeData.light().chipTheme.copyWith(
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(999)),
          ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(11)),
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
