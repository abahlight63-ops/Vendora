// ── lib/theme.dart ───────────────────────────────────────────────
// WHAT: Vendora brand as a Material 3 ColorScheme (same dark-green +
// WhatsApp-green identity as the web app). One place, every screen uses it.
import 'package:flutter/material.dart';

class VendoraTheme {
  static const green = Color(0xFF25D366);
  static const deepGreen = Color(0xFF128C4B);
  static const bg = Color(0xFF0D1F16);
  static const card = Color(0xFF12291D);

  static ThemeData get dark => ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        scaffoldBackgroundColor: bg,
        colorScheme: const ColorScheme.dark(
          primary: green,
          onPrimary: Color(0xFF062B18),
          surface: card,
          onSurface: Color(0xFFF2F7F3),
        ),
        cardTheme: const CardThemeData(
          color: card,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.all(Radius.circular(18)),
            side: BorderSide(color: Color(0xFF1F4030)),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFF0A1811),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: Color(0xFF1F4030)),
          ),
        ),
      );
}
