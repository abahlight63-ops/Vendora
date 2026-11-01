// ── lib/splash.dart ──────────────────────────────────────────────
// WHAT: the brand intro, shown while the session check runs: the 3D logo assembles
// and turns once, then the wordmark and tagline arrive. Same story and timing as
// the web's Splash.jsx. main.dart holds this screen for 2.6s, so the turn finishes.
import 'package:flutter/material.dart';

import 'widgets/mark_3d.dart';

class SplashView extends StatefulWidget {
  const SplashView({super.key});

  @override
  State<SplashView> createState() => _SplashViewState();
}

class _SplashViewState extends State<SplashView> with TickerProviderStateMixin {
  late final AnimationController _word;

  @override
  void initState() {
    super.initState();
    _word = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 420),
    );
    Future.delayed(const Duration(milliseconds: 1100), () {
      if (mounted) _word.forward();
    });
  }

  @override
  void dispose() {
    _word.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: RadialGradient(
            center: Alignment(0, -0.2),
            radius: 1.1,
            colors: [Color(0xFF2A1C7A), Color(0xFF120B4A), Color(0xFF0B0630)],
            stops: [0, 0.62, 1],
          ),
        ),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(
                width: 340,
                height: 300,
                child: Mark3D(channels: false, spin: true),
              ),
              FadeTransition(
                opacity: CurvedAnimation(parent: _word, curve: Curves.easeOut),
                child: SlideTransition(
                  position: Tween<Offset>(
                    begin: const Offset(0, 0.25),
                    end: Offset.zero,
                  ).animate(CurvedAnimation(parent: _word, curve: Curves.easeOutCubic)),
                  child: const Column(
                    children: [
                      Text(
                        'VeloSales Ai',
                        style: TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.8,
                          color: Colors.white,
                        ),
                      ),
                      SizedBox(height: 6),
                      Text(
                        'Your shop\'s AI, open 24/7',
                        style: TextStyle(fontSize: 14, color: Color(0xFFC9C2F5)),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
