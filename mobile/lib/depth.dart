// ── lib/depth.dart ────────────────────────────────────────────────
// WHAT: the phone's depth layer.
//
// The web app is flat paper: a solid surface, a hairline border, one small
// shadow. The phone keeps that language, but a card can answer the thumb in
// three dimensions — a 2–4° tilt toward the finger, a 0.985 press, and a 3D
// rise on entry. Nothing loops, nothing pulses: every frame here is caused by
// a tap, a route change or a list arriving. Reduced motion switches it off.
import 'dart:math' as math;

import 'package:flutter/material.dart';

/// The operating system's "reduce motion" setting (iOS/Android) or the web's
/// `prefers-reduced-motion`. Every depth effect asks this first.
bool reducedMotion(BuildContext context) =>
    MediaQuery.maybeOf(context)?.disableAnimations ?? false;

/// Entry: fade + a short rise + a 2° pitch that settles flat.
///
/// This is the phone's version of the web's `fadeSlide` — same 300ms family,
/// with just enough perspective that the card reads as a sheet being laid
/// down rather than a block appearing.
class DepthReveal extends StatefulWidget {
  final Widget child;
  final int delayMs;
  final double rise;

  const DepthReveal({
    super.key,
    required this.child,
    this.delayMs = 0,
    this.rise = 14,
  });

  @override
  State<DepthReveal> createState() => _DepthRevealState();
}

class _DepthRevealState extends State<DepthReveal>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  bool _started = false;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 380),
    );
    if (widget.delayMs <= 0) {
      _c.forward();
      _started = true;
    } else {
      Future<void>.delayed(Duration(milliseconds: widget.delayMs), () {
        if (mounted) {
          _c.forward();
          _started = true;
        }
      });
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (reducedMotion(context) && !_started) {
      _c.value = 1;
      _started = true;
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (reducedMotion(context)) return widget.child;
    return AnimatedBuilder(
      animation: _c,
      child: widget.child,
      builder: (context, child) {
        final t = Curves.easeOutCubic.transform(_c.value);
        final m = Matrix4.identity()
          ..setEntry(3, 2, 0.0012)
          ..rotateX((1 - t) * 0.032)
          ..translateByDouble(0.0, (1 - t) * widget.rise, 0.0, 1.0);
        return Opacity(
          opacity: t.clamp(0.0, 1.0),
          child: Transform(
            alignment: Alignment.center,
            transform: m,
            child: child,
          ),
        );
      },
    );
  }
}

/// A surface that tilts toward the finger and springs back.
///
/// The card itself is drawn here (solid fill, hairline border, 16px radius,
/// the web's one small shadow), so call sites cannot accidentally add a
/// second border or a heavier shadow. [tilt] can be turned off for a surface
/// that should only press (a wide row, a form).
class DepthCard extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;
  final double radius;
  final EdgeInsetsGeometry margin;
  final EdgeInsetsGeometry? padding;
  final Color? color;
  final BoxBorder? border;
  final bool shadow;
  final bool tilt;
  final double maxTilt;
  final String? semanticLabel;

  const DepthCard({
    super.key,
    required this.child,
    this.onTap,
    this.radius = 16,
    this.margin = EdgeInsets.zero,
    this.padding,
    this.color,
    this.border,
    this.shadow = true,
    this.tilt = true,
    this.maxTilt = 0.055,
    this.semanticLabel,
  });

  @override
  State<DepthCard> createState() => _DepthCardState();
}

class _DepthCardState extends State<DepthCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  double _beginRx = 0, _targetRx = 0;
  double _beginRy = 0, _targetRy = 0;
  double _beginScale = 1, _targetScale = 1;
  bool _down = false;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 180),
      value: 1,
    );
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  double get _currentRx =>
      _beginRx + (_targetRx - _beginRx) * Curves.easeOutCubic.transform(_c.value);
  double get _currentRy =>
      _beginRy + (_targetRy - _beginRy) * Curves.easeOutCubic.transform(_c.value);

  void _to(double rx, double ry, double scale, int ms) {
    _beginRx = _currentRx;
    _beginRy = _currentRy;
    _beginScale =
        _beginScale + (_targetScale - _beginScale) * Curves.easeOutCubic.transform(_c.value);
    _targetRx = rx;
    _targetRy = ry;
    _targetScale = scale;
    _c.duration = Duration(milliseconds: ms);
    _c.forward(from: 0);
  }

  void _place(Offset local, Size size) {
    if (!widget.tilt || size.width <= 0 || size.height <= 0) return;
    final dx = ((local.dx / size.width) - 0.5) * 2; // -1 … 1
    final dy = ((local.dy / size.height) - 0.5) * 2;
    _to(-dy * widget.maxTilt, dx * widget.maxTilt, 0.985, 90);
  }

  void _reset() {
    _down = false;
    _to(0, 0, 1, 220);
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final radius = BorderRadius.circular(widget.radius);
    final reduce = reducedMotion(context);

    final surface = Container(
      padding: widget.padding,
      decoration: BoxDecoration(
        // Nearly solid frost: prices and chats must survive sunlight.
        color: widget.color ??
            (dark
                ? const Color(0xFF261D6E).withValues(alpha: 0.78)
                : Colors.white.withValues(alpha: 0.82)),
        borderRadius: radius,
        border: widget.border ??
            Border.all(
              color: Colors.white.withValues(alpha: dark ? 0.13 : 0.85),
            ),
        boxShadow: widget.shadow
            ? [
                BoxShadow(
                  color: Colors.black.withValues(alpha: dark ? 0.30 : 0.045),
                  blurRadius: _down ? 24 : 3,
                  offset: Offset(0, _down ? 12 : 1),
                ),
              ]
            : null,
      ),
      child: widget.child,
    );

    Widget body = reduce
        ? surface
        : AnimatedBuilder(
            animation: _c,
            builder: (context, child) {
              final sc = _beginScale +
                  (_targetScale - _beginScale) *
                      Curves.easeOutCubic.transform(_c.value);
              final m = Matrix4.identity()
                ..setEntry(3, 2, 0.0014)
                ..rotateX(_currentRx)
                ..rotateY(_currentRy)
                ..scaleByDouble(sc, sc, 1.0, 1.0);
              return Transform(
                alignment: Alignment.center,
                transform: m,
                child: child,
              );
            },
            child: surface,
          );

    if (widget.onTap != null) {
      body = GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: widget.onTap,
        child: body,
      );
    }

    body = Listener(
      behavior: HitTestBehavior.opaque,
      onPointerDown: widget.onTap == null
          ? null
          : (e) {
              final size = context.size;
              if (size == null) return;
              setState(() => _down = true);
              _place(e.localPosition, size);
            },
      onPointerMove: widget.onTap == null
          ? null
          : (e) {
              final size = context.size;
              if (size == null) return;
              _place(e.localPosition, size);
            },
      onPointerUp: (_) {
        if (widget.onTap != null) _reset();
      },
      onPointerCancel: (_) {
        if (widget.onTap != null) _reset();
      },
      child: body,
    );

    return Padding(
      padding: widget.margin,
      child: Semantics(
        button: widget.onTap != null,
        label: widget.semanticLabel,
        child: body,
      ),
    );
  }
}

/// A page transition with the same restraint: the new page comes forward from
/// 12px behind the glass, pitched 2°, and settles in 240ms.
class DepthPageTransitionsBuilder extends PageTransitionsBuilder {
  const DepthPageTransitionsBuilder();

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    if (reducedMotion(context)) return child;
    final fade = animation.drive(CurveTween(curve: Curves.easeOut));
    return AnimatedBuilder(
      animation: animation,
      builder: (context, _) {
        final e = Curves.easeOutCubic.transform(animation.value);
        final m = Matrix4.identity()
          ..setEntry(3, 2, 0.0011)
          ..rotateX((1 - e) * 0.035)
          ..translateByDouble(0.0, (1 - e) * 14.0, 0.0, 1.0)
          ..scaleByDouble(0.988 + 0.012 * e, 0.988 + 0.012 * e, 1.0, 1.0);
        return FadeTransition(
          opacity: fade,
          child: Transform(
            alignment: Alignment.bottomCenter,
            transform: m,
            child: child,
          ),
        );
      },
      child: child,
    );
  }
}

/// Small helper for the few places that draw a custom shadow (the floating
/// dock, the drawer's identity chip). Keeps one shadow recipe.
List<BoxShadow> softShadow(BuildContext context, {double lift = 0}) {
  final dark = Theme.of(context).brightness == Brightness.dark;
  return [
    BoxShadow(
      color: Colors.black.withValues(alpha: dark ? 0.32 : 0.06 + lift * 0.04),
      blurRadius: 6 + lift * 22,
      offset: Offset(0, 2 + lift * 10),
    ),
  ];
}

/// Rotate a card by a fixed angle — used by the auth/onboarding art, which is
/// allowed to sit in space because it is the one thing on the screen.
Matrix4 tilted(double rx, double ry, {double z = 0.0012}) => Matrix4.identity()
  ..setEntry(3, 2, z)
  ..rotateX(rx)
  ..rotateY(ry);

/// Unused by the frame, but keeps the import of dart:math honest if a future
/// call site wants a degree helper.
double degrees(double d) => d * math.pi / 180;
