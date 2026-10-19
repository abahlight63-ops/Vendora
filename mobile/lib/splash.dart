// ── lib/splash.dart ────────────────────────────────────────────────
// WHAT: the brand intro, shown while the session check runs.
//
// The mark assembles itself (widgets/logo_reveal.dart), the wordmark drops in
// letter by letter, the tagline follows once the wordmark is on its way, and a
// thin bar sweeps underneath. The choreography and its timings are the same
// numbers as the web splash, so both clients show one animation.
//
// main.dart holds this screen for 2s — long enough for the last letter to land
// at 1.88s. A splash that cuts the wordmark in half is worse than no splash.
import 'package:flutter/material.dart';

import 'widgets/logo_reveal.dart';

class SplashView extends StatefulWidget {
  const SplashView({super.key});

  @override
  State<SplashView> createState() => _SplashViewState();
}

class _SplashViewState extends State<SplashView> with TickerProviderStateMixin {
  /// Drives the tagline and the progress bar: both wait until the wordmark is
  /// on its way down before they appear, so the eye has one thing at a time.
  late final AnimationController _tag;

  @override
  void initState() {
    super.initState();
    _tag = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 320),
    );
    // The wordmark starts dropping at 1.10s and lands at 1.88s; the tagline
    // joins at 1.52s, exactly as the web splash does it.
    Future.delayed(const Duration(milliseconds: 1520), () {
      if (mounted) _tag.forward();
    });
  }

  @override
  void dispose() {
    _tag.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      backgroundColor: scheme.surfaceContainerLowest,
      body: Stack(
        children: [
          Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const LogoReveal(size: 112, wordmark: 'VeloSales Ai'),
                const SizedBox(height: 20),
                FadeTransition(
                  opacity: CurvedAnimation(parent: _tag, curve: Curves.easeOut),
                  child: SlideTransition(
                    // Drops in from above, like the wordmark above it.
                    position: Tween<Offset>(
                      begin: const Offset(0, -0.35),
                      end: Offset.zero,
                    ).animate(CurvedAnimation(parent: _tag, curve: Curves.easeOutCubic)),
                    child: Text(
                      'Your WhatsApp shop, open 24/7',
                      style: TextStyle(
                        fontSize: 13.5,
                        color: scheme.onSurface.withValues(alpha: 0.58),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 68,
            child: FadeTransition(
              // The bar is a loading affordance, not part of the logo: during
              // the assembly it read as a stray dash under the mark.
              opacity: _tag,
              child: Center(child: _SweepBar(color: scheme.primary)),
            ),
          ),
        ],
      ),
    );
  }
}

/// A thin indeterminate bar: a soft track with a short segment crossing it.
/// Quieter than a Material progress bar and it matches the fixed width the
/// web splash uses, so the two screens read as the same brand.
class _SweepBar extends StatefulWidget {
  final Color color;
  const _SweepBar({required this.color});

  @override
  State<_SweepBar> createState() => _SweepBarState();
}

class _SweepBarState extends State<_SweepBar> with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1250))
      ..repeat();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 132,
      height: 4,
      child: AnimatedBuilder(
        animation: _c,
        builder: (context, _) => CustomPaint(
          painter: _SweepPainter(t: _c.value, color: widget.color),
        ),
      ),
    );
  }
}

class _SweepPainter extends CustomPainter {
  final double t;
  final Color color;
  const _SweepPainter({required this.t, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final r = Radius.circular(size.height);
    // track
    canvas.drawRRect(
      RRect.fromRectAndRadius(Offset.zero & size, r),
      Paint()..color = color.withValues(alpha: 0.16),
    );

    // The segment eases rather than travelling linearly, so it reads as
    // breathing instead of mechanical.
    final eased = Curves.easeInOut.transform(t);
    final w = size.width * 0.38;
    final x = -w + (size.width + w) * eased;
    final seg = Rect.fromLTWH(x, 0, w, size.height);
    canvas.save();
    canvas.clipRRect(RRect.fromRectAndRadius(Offset.zero & size, r));
    canvas.drawRRect(
      RRect.fromRectAndRadius(seg, r),
      Paint()
        ..shader = LinearGradient(
          colors: [
            color.withValues(alpha: 0),
            color,
            color.withValues(alpha: 0),
          ],
        ).createShader(seg),
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(_SweepPainter old) => old.t != t || old.color != color;
}
