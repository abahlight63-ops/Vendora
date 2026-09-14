// ── lib/splash.dart ────────────────────────────────────────────────
// WHAT: the 1.5-second brand intro — mirrors Splash.jsx: logo float +
// VENDORA letterspacing + tagline + indeterminate bar, then fade out.
// Shown while the session check runs (never shorter than the web one).
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
  }

  @override
  void dispose() {
    _c.dispose();
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
              Image.asset('assets/logo.png', width: 84, height: 84),
              const SizedBox(height: 16),
              const Text('VENDORA',
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
