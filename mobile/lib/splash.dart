// ── lib/splash.dart ────────────────────────────────────────────────
// WHAT: the 1.5-second brand intro — mirrors Splash.jsx: Orbit V ring
// around the logo + VELOSALES AI letterspacing + tagline + indeterminate bar,
// then fade out. Shown while the session check runs (never shorter than
// the web one). Ring = two arcs (primary green + gold) spinning forever.
import 'dart:math' as math;

import 'package:flutter/material.dart';

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
  late final AnimationController _orbit; // endless ring spin (Orbit V!)

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
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      backgroundColor: scheme.surfaceContainerLowest,
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
                        painter: _OrbitPainter(scheme.primary),
                      ),
                    ),
                    Image.asset('assets/logo.png', width: 64, height: 64),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              const Text('VELOSALES AI',
                  style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 6)),
              const SizedBox(height: 6),
              Text('Your WhatsApp shop, open 24/7',
                  style: TextStyle(
                      color: scheme.onSurface.withValues(alpha: 0.65),
                      fontSize: 14)),
              const SizedBox(height: 24),
              SizedBox(
                width: 160,
                child: LinearProgressIndicator(
                  color: scheme.primary,
                  backgroundColor:
                      scheme.primary.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

/// Orbit V ring: long primary arc + short gold arc + head dots.
class _OrbitPainter extends CustomPainter {
  final Color color;
  const _OrbitPainter(this.color);

  @override
  void paint(Canvas canvas, Size size) {
    final c = Offset(size.width / 2, size.height / 2);
    final r = size.width / 2 - 6;
    const gold = Color(0xFFFFCF5C);
    const mint = Color(0xFF7EF0C0);
    Offset dot(double angle) =>
        c + Offset(math.cos(angle) * r, math.sin(angle) * r);
    final pGreen = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.5
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(Rect.fromCircle(center: c, radius: r), -1.2, 3.6, false, pGreen);
    final pGold = Paint()
      ..color = gold
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.5
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(Rect.fromCircle(center: c, radius: r), 2.4, 0.9, false, pGold);
    canvas.drawCircle(dot(2.4), 4.5, Paint()..color = mint);
    canvas.drawCircle(dot(3.3), 4, Paint()..color = gold);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
