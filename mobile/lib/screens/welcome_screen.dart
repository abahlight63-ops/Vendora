// ── lib/screens/welcome_screen.dart ───────────────────────────────
// WHAT: the phone's front door, before signup, and the same screen as the web's
// frontend/src/pages/Landing.jsx: the 3D mark with the channels orbiting it, one
// promise, one sentence and one action. The tour after sign-up explains the rest.
//
// The backdrop drift and the orbit are the one place ambient motion is allowed
// (DESIGN.md). Under reduced motion both stop and the content stays.
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../brand_mark.dart';
import '../depth.dart';
import '../widgets/brand_ui.dart';
import '../widgets/mark_3d.dart';

const _amber = Color(0xFFFBBF24);
const _amberInk = Color(0xFF2A1E6B);

class WelcomeScreen extends StatelessWidget {
  final VoidCallback onCreateAccount;
  final VoidCallback onSignIn;

  const WelcomeScreen({
    super.key,
    required this.onCreateAccount,
    required this.onSignIn,
  });

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    return Scaffold(
      backgroundColor: const Color(0xFF211757),
      body: Stack(
        children: [
          const Positioned.fill(child: _Aurora()),
          SafeArea(
            bottom: false,
            child: LayoutBuilder(
              builder: (context, box) {
                final compact = box.maxHeight < 700;
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const _TopBar(),
                    const Expanded(child: Mark3D()),
                    Padding(
                      padding: EdgeInsets.fromLTRB(
                          20, 0, 20, (compact ? 12 : 22) + bottom),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _Promise(compact: compact),
                          SizedBox(height: compact ? 14 : 20),
                          _Actions(
                            onGetStarted: onCreateAccount,
                            onSignIn: onSignIn,
                          ),
                        ],
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.fromLTRB(20, 12, 20, 0),
      child: Row(
        children: [
          BrandMark(size: 30, solid: Colors.white, glow: true),
          SizedBox(width: 10),
          Text(
            'VeloSales Ai',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.4,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}

class _Promise extends StatelessWidget {
  final bool compact;
  const _Promise({required this.compact});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text.rich(
          TextSpan(
            style: TextStyle(
              fontSize: compact ? 31 : 40,
              height: 1.04,
              fontWeight: FontWeight.w800,
              letterSpacing: compact ? -1.1 : -1.4,
              color: Colors.white,
            ),
            children: const [
              TextSpan(text: 'Your WhatsApp shop, '),
              TextSpan(text: 'open\u00A024/7.', style: TextStyle(color: _amber)),
            ],
          ),
        ),
        SizedBox(height: compact ? 8 : 12),
        Text(
          'VeloSales Ai answers your customers in seconds, in English or '
          'Pidgin, straight from your catalog.',
          style: TextStyle(
            fontSize: compact ? 14 : 16,
            height: 1.5,
            fontWeight: FontWeight.w500,
            color: Colors.white.withValues(alpha: 0.74),
          ),
        ),
      ],
    );
  }
}

class _Actions extends StatelessWidget {
  final VoidCallback onGetStarted;
  final VoidCallback onSignIn;
  const _Actions({required this.onGetStarted, required this.onSignIn});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Semantics(
            button: true,
            label: 'Get started',
            excludeSemantics: true,
            child: Pressable(
              onTap: onGetStarted,
              radius: BorderRadius.circular(999),
              child: SizedBox(
                height: 56,
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Container(
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: const Text(
                              'Get started',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                letterSpacing: -0.2,
                                color: _amberInk,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Container(
                          width: 56,
                          height: 56,
                          alignment: Alignment.center,
                          decoration: const BoxDecoration(
                            color: _amber,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.north_east_rounded,
                              size: 22, color: _amberInk),
                        ),
                      ],
                    ),
                    // The neck joining the pill to the arrow.
                    const Positioned(
                      right: 47.8,
                      top: 8.2,
                      width: 26.4,
                      height: 39.6,
                      child: CustomPaint(painter: _NeckPainter()),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
        const SizedBox(width: 6),
        TextButton(
          onPressed: onSignIn,
          style: TextButton.styleFrom(
            foregroundColor: Colors.white,
            minimumSize: const Size(64, 48),
            padding: const EdgeInsets.symmetric(horizontal: 10),
            textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
          ),
          child: const Text('Sign in'),
        ),
      ],
    );
  }
}

class _NeckPainter extends CustomPainter {
  const _NeckPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(0, 0)
      ..quadraticBezierTo(13.2, 13, 26.4, 0)
      ..lineTo(26.4, 39.6)
      ..quadraticBezierTo(13.2, 26.6, 0, 39.6)
      ..close();
    canvas.drawPath(
      path,
      Paint()
        ..isAntiAlias = true
        ..color = Colors.white,
    );
  }

  @override
  bool shouldRepaint(_NeckPainter old) => false;
}

// ── stage ────────────────────────────────────────────────────────

class _Aurora extends StatefulWidget {
  const _Aurora();

  @override
  State<_Aurora> createState() => _AuroraState();
}

class _AuroraState extends State<_Aurora> with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 18),
    )..repeat(reverse: true);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (reducedMotion(context)) {
      _c.stop();
      _c.value = 0.5;
    } else if (!_c.isAnimating) {
      _c.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        final t = _c.value;
        return DecoratedBox(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Color(0xFF1C1350),
                Color(0xFF34238D),
                Color(0xFF5B4BD6),
                Color(0xFF3A2596),
              ],
              stops: [0.0, 0.38, 0.72, 1.0],
            ),
          ),
          child: Stack(
            children: [
              Positioned(
                left: -120 + math.sin(t * math.pi * 2) * 24,
                top: -140 + math.cos(t * math.pi * 2) * 18,
                child: const _Glow(
                    size: 420, color: Color(0xFF8B5CF6), strength: 0.55),
              ),
              Positioned(
                right: -150 + math.cos(t * math.pi * 2) * 30,
                top: 150 + math.sin(t * math.pi * 2) * 26,
                child: const _Glow(
                    size: 360, color: Color(0xFFEC4899), strength: 0.26),
              ),
              Positioned(
                left: 30 + math.cos(t * math.pi * 2) * 20,
                bottom: -170 + math.sin(t * math.pi * 2) * 22,
                child: const _Glow(
                    size: 400, color: Color(0xFF10B981), strength: 0.22),
              ),
              // Fine grain of starlight, so the flat gradient has texture.
              const Positioned.fill(child: _StarField()),
            ],
          ),
        );
      },
    );
  }
}

class _Glow extends StatelessWidget {
  final double size;
  final Color color;
  final double strength;
  const _Glow({
    required this.size,
    required this.color,
    required this.strength,
  });

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(colors: [
            color.withValues(alpha: strength),
            color.withValues(alpha: strength * 0.35),
            color.withValues(alpha: 0),
          ]),
        ),
      ),
    );
  }
}

class _StarField extends StatelessWidget {
  const _StarField();

  @override
  Widget build(BuildContext context) =>
      const IgnorePointer(child: CustomPaint(painter: _StarPainter()));
}

class _StarPainter extends CustomPainter {
  const _StarPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()..color = Colors.white.withValues(alpha: 0.10);
    // A fixed scatter, not random: the same sky every launch.
    const points = [
      [0.08, 0.12, 1.2], [0.21, 0.28, 0.8], [0.34, 0.07, 1.0],
      [0.47, 0.19, 0.7], [0.63, 0.10, 1.1], [0.78, 0.24, 0.8],
      [0.91, 0.13, 1.3], [0.13, 0.46, 0.7], [0.29, 0.62, 1.0],
      [0.55, 0.52, 0.8], [0.72, 0.44, 1.2], [0.88, 0.63, 0.7],
      [0.06, 0.77, 1.0], [0.24, 0.91, 0.8], [0.41, 0.84, 1.1],
      [0.66, 0.79, 0.7], [0.83, 0.92, 1.0], [0.96, 0.74, 0.8],
    ];
    for (final s in points) {
      canvas.drawCircle(
          Offset(size.width * s[0], size.height * s[1]), s[2], p);
    }
  }

  @override
  bool shouldRepaint(_StarPainter old) => false;
}
