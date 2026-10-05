// ── lib/glass.dart ─────────────────────────────────────────────────
// WHAT: the surface system — ONE place for every panel in the app.
// Recipe per MOBILE-DESIGN.md: gradient surface, radius 24, 1px hairline
// border, and a 1px white@6% highlight along the top edge. Blur is used
// at most twice per screen (bottom bar, sheets) — everything else is
// plain gradients, because BackdropFilter is expensive on weak phones.
// Dark-first: no light/dark branching, the palette has one mode.
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;

import 'theme.dart';

/// Blur + geometry shared by the frosted surfaces.
class Glass {
  static const double cardBlur = 16; // only over an image or glow
  static const double sheetBlur = 22; // bottom bar, sheets
  static const double radius = VsTokens.rCard;

  /// Translucent glass fill (rgba white 10%).
  static Color tint(BuildContext context) => VsTokens.surfaceGlass;

  /// Hairline light edge (rgba white 12%).
  static Color edge(BuildContext context) => VsTokens.glassBorder;

  /// Inner top highlight (rgba white 6%).
  static Color gloss(BuildContext context) => VsTokens.innerHighlight;
}

/// The screen itself: full-bleed bgTop → bgBottom gradient with a single
/// diagonal lean, plus one soft accent glow in the top-right corner so the
/// deep green-charcoal never reads flat. Painted behind every Scaffold
/// (MaterialApp.builder in main.dart); it also stamps the light status-bar
/// icons, so no screen has to remember to do it.
class AppBackground extends StatelessWidget {
  const AppBackground({super.key});

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: VeloSalesTheme.overlay,
      child: DecoratedBox(
        decoration: const BoxDecoration(gradient: VsTokens.bgGradient),
        child: Stack(fit: StackFit.expand, children: [
          // one glow only — the accent stays "used sparingly"
          Align(
            alignment: const Alignment(0.9, -0.9),
            child: FractionallySizedBox(
              widthFactor: 1.1,
              heightFactor: 0.9,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    colors: [
                      VsTokens.accentGlow.withValues(alpha: 0.10),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
          ),
        ]),
      ),
    );
  }
}

/// Legacy name kept so main.dart keeps compiling; now the spec background.
class GlassBackground extends AppBackground {
  const GlassBackground({super.key});
}

/// Surface card — drop-in replacement for Card(child:, margin:).
/// Gradient surface, radius 24, hairline border, 1px white@6% top highlight.
/// No BackdropFilter here on purpose: blur is reserved for the bottom bar
/// and sheets so weak phones keep their frame budget.
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
        child: Container(
          decoration: BoxDecoration(
            gradient: VsTokens.surfaceGradient,
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
                    splashColor: VsTokens.accent.withValues(alpha: 0.12),
                    highlightColor: VsTokens.accent.withValues(alpha: 0.06),
                    child: inner,
                  ),
          ),
        ),
      ),
    );
  }
}

/// Frosted bottom sheet — same surface as cards, chunkier blur, 28px top
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

/// The app's ONE empty-state. Several screens used to hand-roll this as a bare
/// `Center(child: Text(...))`, which meant no horizontal padding (long messages
/// ran edge-to-edge on narrow phones) and — worse — an ERROR rendered exactly
/// like a calm "nothing here" message, with no Retry. Those are the two states
/// a user most needs to tell apart.
class EmptyState extends StatelessWidget {
  const EmptyState(this.title, this.message, {super.key, this.retry});

  final String title; // bold lead line, mirrors the web app's <b> + text shape
  final String message; // one honest sentence, never dev-speak
  final VoidCallback? retry; // non-null renders Retry — set it on FAILURES only

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(title,
                textAlign: TextAlign.center,
                style:
                    const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            Text(message,
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontSize: 13,
                    color: scheme.onSurface.withValues(alpha: 0.7))),
            if (retry != null) ...[
              const SizedBox(height: 14),
              FilledButton(onPressed: retry, child: const Text('Retry')),
            ],
          ],
        ),
      ),
    );
  }
}
