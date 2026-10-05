// ── lib/splash.dart ────────────────────────────────────────────────
// WHAT: the brand intro — the gold mark on the deep charcoal gradient,
// the wordmark in Sora 300, and a quiet indeterminate bar, then fade out.
// Shown while the session check runs. The ring is amber, not green:
// MOBILE-DESIGN.md allows exactly one accent and the brand is gold.
import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'theme.dart';

class SplashView extends StatefulWidget {
  const SplashView({super.key});

  @override
  State<SplashView> createState() => _SplashViewState();
}

class _SplashViewState extends State<SplashView>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  late final Animation<double> _fade;
  late final Animation<Offset> _rise;
  late final AnimationController _orbit; // endless ring spin

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 1100));
    _fade = CurvedAnimation(parent: _c, curve: Curves.ease);
    _rise = Tween<Offset>(
            begin: const Offset(0, 0.12), end: Offset.zero)
        .animate(CurvedAnimation(parent: _c, curve: Curves.easeOut));
    _c.forward();
    _orbit = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 1600))
      ..repeat();
  }

  @override
  void dispose() {
    _c.dispose();
    _orbit.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent, // AppBackground paints the screen
      body: Center(
        child: FadeTransition(
          opacity: _fade,
          child: SlideTransition(
            position: _rise,
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              SizedBox(
                width: 116,
                height: 116,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    RotationTransition(
                      turns: _orbit,
                      child: CustomPaint(
                        size: const Size(116, 116),
                        painter: _OrbitPainter(),
                      ),
                    ),
                    // the supplied gold mark, sized down from the 1024 app icon
                    Image.asset(
                      'assets/brand-mark.png',
                      width: 72,
                      height: 72,
                      filterQuality: FilterQuality.high,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              const Text(
                'VELOSALES AI',
                style: TextStyle(
                  fontFamily: VsTokens.fontDisplay,
                  fontSize: 26,
                  height: 1.05,
                  letterSpacing: 3,
                  fontWeight: FontWeight.w300,
                  color: VsTokens.text,
                  fontVariations: [FontVariation('wght', 300)],
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Your WhatsApp shop, open 24/7',
                style: TextStyle(
                  fontFamily: VsTokens.fontBody,
                  fontSize: VsTokens.fsBody,
                  height: 1.45,
                  fontWeight: FontWeight.w400,
                  color: VsTokens.textMuted,
                  fontVariations: [FontVariation('wght', 400)],
                ),
              ),
              const SizedBox(height: 28),
              SizedBox(
                width: 160,
                child: LinearProgressIndicator(
                  color: VsTokens.accent,
                  backgroundColor: VsTokens.surfaceDeep,
                  borderRadius: BorderRadius.circular(VsTokens.rPill),
                ),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

/// One accent ring: a long amber arc + a short accentGlow arc + a head dot.
class _OrbitPainter extends CustomPainter {
  const _OrbitPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final c = Offset(size.width / 2, size.height / 2);
    final r = size.width / 2 - 6;
    Offset dot(double angle) =>
        c + Offset(math.cos(angle) * r, math.sin(angle) * r);
    final pAmber = Paint()
      ..color = VsTokens.accent
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(
        Rect.fromCircle(center: c, radius: r), -1.2, 3.6, false, pAmber);
    final pGlow = Paint()
      ..color = VsTokens.accentGlow
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(
        Rect.fromCircle(center: c, radius: r), 2.4, 0.9, false, pGlow);
    canvas.drawCircle(dot(2.4), 4.5, Paint()..color = VsTokens.accentGlow);
    canvas.drawCircle(dot(3.3), 4, Paint()..color = VsTokens.accent);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}