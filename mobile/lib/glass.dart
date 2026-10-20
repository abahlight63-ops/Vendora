// ── lib/glass.dart ─────────────────────────────────────────────────
// WHAT: the app's surface primitives — one place for every card, sheet and
// dialog, so they cannot drift apart. Flat by design: a solid surface fill
// and a hairline border, no blur and no gloss. (The name is historical; the
// frosted-glass recipe this file used to implement is gone.)
// Light/dark aware via the active ColorScheme.
import 'package:flutter/material.dart';

import 'widgets/error_art.dart';

/// Blur strength for cards vs sheets/dialogs.
///
/// Was 18/22 — real backdrop blur, with translucent tints so a mesh gradient
/// shimmered through everything. That whole language is retired (the web build
/// dropped glass too). Zero blur + solid fills means every existing surface
/// that was frosted now reads as a plain bordered card, with no call-site
/// changes.
class Glass {
  static const double cardBlur = 0;
  static const double sheetBlur = 0;
  static const double radius = 16;

  /// Solid surface — no transparency, nothing to shimmer through.
  static Color tint(BuildContext context) =>
      Theme.of(context).colorScheme.surface;

  /// Hairline border — the same token line the web cards use.
  static Color edge(BuildContext context) =>
      Theme.of(context).colorScheme.outline;

  /// No gloss: flat surfaces do not catch light.
  static Color gloss(BuildContext context) => Colors.transparent;
}

/// Card — flat surface, hairline token border, 16px radius.
/// Drop-in replacement for Card(child:, margin:); same default margin (4 all)
/// so layouts do not shift.
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
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: Glass.tint(context),
          borderRadius: r,
          border: border ?? Border.all(color: Glass.edge(context), width: 1),
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
    );
  }
}

/// Flat page backdrop — simply the theme's lowest surface.
///
/// This used to be a mesh gradient of green/teal radial glows that frosted
/// surfaces above it refracted. There is nothing to refract now: every surface
/// paints a solid fill, so the backdrop is just the page colour. It stays in
/// the tree only so the MaterialApp builder contract doesn't change.
class GlassBackground extends StatelessWidget {
  const GlassBackground({super.key});

  @override
  Widget build(BuildContext context) {
    return ColoredBox(color: Theme.of(context).colorScheme.surfaceContainerLowest);
  }
}

/// Bottom sheet — solid surface, 28px top radius. Replaces raw
/// showModalBottomSheet for every sheet in the app.
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
        child: Container(
          decoration: BoxDecoration(
            color: Glass.tint(c),
            border: Border(top: BorderSide(color: Glass.edge(c))),
          ),
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          child: SafeArea(top: false, child: child),
        ),
      ),
    ),
  );
}

/// Confirmation dialog — solid card body over a dimmed barrier.
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
    final low = message.toLowerCase();
    final offline = low.contains('offline') || low.contains('no connection');
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (retry != null) ...[
              ErrorArt(offline: offline, size: 116),
              const SizedBox(height: 6),
            ],
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
