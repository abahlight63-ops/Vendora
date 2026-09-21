// ── lib/glass.dart ─────────────────────────────────────────────────
// WHAT: the liquid-glass system — ONE place for every frosted surface in
// the app (cards, app shell backdrop, bottom sheets, dialogs). Same recipe
// everywhere: blur what is behind (BackdropFilter) + translucent surface
// tint + hairline light edge + glossy top highlight. Light/dark aware via
// the active ColorScheme, so the glass reads correctly in both themes.
// No new packages — dart:ui + material only.
import 'dart:ui';

import 'package:flutter/material.dart';

import 'theme.dart'; // accentTeal (same glow the web app uses!)

/// Blur strength for cards (18) vs sheets/dialogs (22, chunkier surfaces).
class Glass {
  static const double cardBlur = 18;
  static const double sheetBlur = 22;
  static const double radius = 20;

  /// Translucent surface tint — lets the mesh backdrop shimmer through.
  static Color tint(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Theme.of(context)
        .colorScheme
        .surface
        .withValues(alpha: dark ? 0.5 : 0.62);
  }

  /// Hairline light edge (the bright rim that sells "glass").
  static Color edge(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Colors.white.withValues(alpha: dark ? 0.14 : 0.55);
  }

  /// Glossy top highlight, painted OVER the tint (foregroundDecoration).
  static Color gloss(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Colors.white.withValues(alpha: dark ? 0.05 : 0.12);
  }
}

/// Frosted card — drop-in replacement for Card(child:, margin:).
/// Same default margin as Card (4 all) so layouts do not shift.
class GlassCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry margin;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;
  final double radius;
  final BoxBorder? border; // override the hairline edge (e.g. hot plan)
  const GlassCard({
    super.key,
    required this.child,
    this.margin = const EdgeInsets.all(4),
    this.padding,
    this.onTap,
    this.radius = Glass.radius,
    this.border,
  });

  @override
  Widget build(BuildContext context) {
    final r = BorderRadius.circular(radius);
    final inner = padding == null
        ? child
        : Padding(padding: padding!, child: child);
    return Padding(
      padding: margin,
      child: ClipRRect(
        borderRadius: r,
        child: BackdropFilter(
          filter: ImageFilter.blur(
              sigmaX: Glass.cardBlur, sigmaY: Glass.cardBlur),
          child: Container(
            decoration: BoxDecoration(
              color: Glass.tint(context),
              borderRadius: r,
              border: border ??
                  Border.all(color: Glass.edge(context), width: 1),
            ),
            foregroundDecoration: BoxDecoration(
              borderRadius: r,
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.center,
                colors: [Glass.gloss(context), Colors.transparent],
              ),
            ),
            child: Material(
              color: Colors.transparent,
              child: onTap == null
                  ? inner
                  : InkWell(
                      borderRadius: r,
                      onTap: onTap,
                      child: inner,
                    ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Mesh-gradient backdrop — brand-green glows over the theme base.
/// Lives behind every Scaffold (MaterialApp builder in main.dart);
/// the frosted surfaces above refract THIS, which is what makes the
/// glass visible instead of frosted-over-flat-grey.
class GlassBackground extends StatelessWidget {
  const GlassBackground({super.key});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final dark = Theme.of(context).brightness == Brightness.dark;
    // Brand glow: primary green melted toward web teal (same liquid family!).
    final glow = Color.lerp(scheme.primary, VeloSalesTheme.accentTeal, 0.35) ?? scheme.primary;
    return Stack(children: [
      Positioned.fill(
          child: ColoredBox(color: scheme.surfaceContainerLowest)),
      Positioned.fill(
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: RadialGradient(
              center: const Alignment(0.9, -0.9),
              radius: 1.1,
              colors: [
                glow.withValues(alpha: dark ? 0.3 : 0.16),
                Colors.transparent,
              ],
            ),
          ),
        ),
      ),
      Positioned.fill(
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: RadialGradient(
              center: const Alignment(-0.9, 1.0),
              radius: 1.2,
              colors: [
                glow.withValues(alpha: dark ? 0.16 : 0.1),
                Colors.transparent,
              ],
            ),
          ),
        ),
      ),
    ]);
  }
}

/// Frosted bottom sheet — same glass as cards, chunkier blur, 28px top
/// radius. Replaces raw showModalBottomSheet for every sheet in the app.
Future<T?> glassSheet<T>(
  BuildContext context, {
  required Widget child,
}) {
  return showModalBottomSheet<T>(
    context: context,
    backgroundColor: Colors.transparent,
    barrierColor: Colors.black.withValues(alpha: 0.45),
    showDragHandle: true,
    isScrollControlled: true,
    builder: (c) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(c).viewInsets.bottom),
      child: ClipRRect(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        child: BackdropFilter(
          filter: ImageFilter.blur(
              sigmaX: Glass.sheetBlur, sigmaY: Glass.sheetBlur),
          child: Container(
            decoration: BoxDecoration(
              color: Glass.tint(c),
              border: Border(top: BorderSide(color: Glass.edge(c))),
            ),
            foregroundDecoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.center,
                colors: [Glass.gloss(c), Colors.transparent],
              ),
            ),
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            child: SafeArea(top: false, child: child),
          ),
        ),
      ),
    ),
  );
}

/// Frosted dialog — blurred barrier + glass card body. Replaces raw
/// showDialog everywhere a confirmation or popup appears.
Future<T?> glassDialog<T>(
  BuildContext context, {
  required Widget child,
}) {
  return showDialog<T>(
    context: context,
    barrierColor: Colors.black.withValues(alpha: 0.45),
    builder: (_) => Dialog(
      backgroundColor: Colors.transparent,
      elevation: 0,
      insetPadding: const EdgeInsets.all(20),
      child: GlassCard(
        margin: EdgeInsets.zero,
        padding: const EdgeInsets.all(20),
        child: child,
      ),
    ),
  );
}
