// ── lib/motion.dart ──────────────────────────────────────────────
// WHAT: web motion vocabulary as Flutter widgets — 1:1 with
// styles.css keyframes: fadeSlide (cards), toastIn + errShake (toasts),
// blink (typing dots), .skel shimmer (loading), stagger (lists).
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

// @keyframes fadeSlide — cards/lists entrance (opacity + 10px rise).
class FadeSlideIn extends StatefulWidget {
  final Widget child;
  final int delayMs; // stagger = index * 60
  const FadeSlideIn({super.key, required this.child, this.delayMs = 0});

  @override
  State<FadeSlideIn> createState() => _FadeSlideInState();
}

class _FadeSlideInState extends State<FadeSlideIn>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  late final Animation<double> _fade;
  late final Animation<Offset> _slide;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 300));
    _fade = CurvedAnimation(parent: _c, curve: Curves.ease);
    _slide = Tween<Offset>(
            begin: const Offset(0, 0.06), end: Offset.zero)
        .animate(CurvedAnimation(parent: _c, curve: Curves.ease));
    Future.delayed(Duration(milliseconds: widget.delayMs), () {
      if (mounted) _c.forward();
    });
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fade,
      child: SlideTransition(position: _slide, child: widget.child),
    );
  }
}

// @keyframes blink — AI "typing…" dots (web .typing b).
class TypingDots extends StatefulWidget {
  const TypingDots({super.key});

  @override
  State<TypingDots> createState() => _TypingDotsState();
}

class _TypingDotsState extends State<TypingDots>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 1100))
      ..repeat();
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
      builder: (_, _) => Row(
        mainAxisSize: MainAxisSize.min,
        children: List.generate(3, (i) {
          final t = (_c.value * 3 - i).clamp(0.0, 1.0);
          final o = 0.25 + 0.75 * (t < 0.5 ? t * 2 : (1 - t) * 2);
          return Container(
            width: 7,
            height: 7,
            margin: EdgeInsets.only(left: i == 0 ? 0 : 5),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Theme.of(context)
                  .colorScheme
                  .onSurface
                  .withValues(alpha: o),
            ),
          );
        }),
      ),
    );
  }
}

// .skel — shimmer placeholder rows while lists load.
//
// Same object as the web's `.skel`: a flat plate with a light travelling across
// it, not a block that pulses. A pulse reads as "something is wrong with this
// box"; a sweep reads as "content is on its way", which is what is happening.
// The sweep carries the brand purple rather than white, so a loading screen is
// recognisably ours from across the room.
class Skeleton extends StatefulWidget {
  final double height;
  final double? width;
  final double radius;
  const Skeleton(
      {super.key, this.height = 72, this.width, this.radius = 12});

  @override
  State<Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<Skeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 1600))
      ..repeat();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final base = Color.lerp(scheme.surface, scheme.onSurface, 0.055)!;
    final sheen = scheme.primary.withValues(alpha: 0.20);
    final still = MediaQuery.maybeDisableAnimationsOf(context) ?? false;

    return LayoutBuilder(builder: (context, c) {
      final w = widget.width ??
          (c.maxWidth.isFinite ? c.maxWidth : 160.0);
      return SizedBox(
        height: widget.height,
        width: w,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(widget.radius),
          child: Stack(
            fit: StackFit.expand,
            children: [
              ColoredBox(color: base),
              if (!still)
                AnimatedBuilder(
                  animation: _c,
                  builder: (_, _) => FractionalTranslation(
                    // left edge → right edge, one clean pass, then again
                    translation: Offset(-1.0 + 2.0 * _c.value, 0),
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(colors: [
                          sheen.withValues(alpha: 0),
                          sheen,
                          sheen.withValues(alpha: 0),
                        ]),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      );
    });
  }
}

// ── the ONE spinner ─────────────────────────────────────────────────
// A dashed orbit with the V inside it, drawn from the same 120×120 geometry
// and the same 1.4s rotation as the web's <Loader/> (components/Loader.jsx).
// Every place the app says "working" without saying anything else uses this —
// a second spinner style would make the product look assembled from parts.
//
// `color` exists for spinners that sit ON the brand purple (buttons), where the
// purple ring would disappear; pass Colors.white there.
class OrbitLoader extends StatefulWidget {
  final double size;
  final Color? color;
  const OrbitLoader({super.key, this.size = 20, this.color});

  @override
  State<OrbitLoader> createState() => _OrbitLoaderState();
}

class _OrbitLoaderState extends State<OrbitLoader>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 1400))
      ..repeat();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final still = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    return SizedBox(
      width: widget.size,
      height: widget.size,
      child: AnimatedBuilder(
        animation: _c,
        builder: (_, _) => CustomPaint(
          painter: _OrbitPainter(
            t: still ? 0 : _c.value,
            a: widget.color ?? const Color(0xFF818CF8),
            b: widget.color ?? scheme.primary,
          ),
        ),
      ),
    );
  }
}

class _OrbitPainter extends CustomPainter {
  final double t;
  final Color a;
  final Color b;
  _OrbitPainter({required this.t, required this.a, required this.b});

  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 120, size.height / 120);
    final shader = LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [a, b],
    ).createShader(const Rect.fromLTWH(0, 0, 120, 120));

    canvas.save();
    canvas.translate(60, 60);
    canvas.rotate(t * 2 * math.pi);
    canvas.translate(-60, -60);

    // 42 on / 26 off around r=44 (circumference 276) — four dashes, round caps
    final ring = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4
      ..strokeCap = StrokeCap.round
      ..shader = shader;
    final box = Rect.fromCircle(center: const Offset(60, 60), radius: 44);
    const dash = 42 / 276 * 2 * math.pi;
    for (var i = 0; i < 4; i++) {
      canvas.drawArc(box, i * math.pi / 2, dash, false, ring);
    }
    canvas.drawCircle(const Offset(60, 16), 6, Paint()..color = _soft(a));
    canvas.drawCircle(const Offset(60, 104), 5, Paint()..color = b);
    canvas.restore();

    // the V sits still while the orbit turns around it
    final v = Path()
      ..moveTo(42, 44)
      ..lineTo(60, 78)
      ..lineTo(78, 44);
    canvas.drawPath(
      v,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 9
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..shader = shader,
    );
  }

  /// The trailing dot is a step lighter than the leading one, as on the web.
  Color _soft(Color c) => Color.lerp(c, Colors.white, 0.45)!;

  @override
  bool shouldRepaint(_OrbitPainter old) =>
      old.t != t || old.a != a || old.b != b;
}

// ── toast() — web .toast: dark pill, slides in, ok green / err red+shake,
// auto-dismisses. Replaces raw SnackBars so feedback feels identical. ──
void showToast(BuildContext context, String msg,
    {String type = 'ok'}) {
  final scheme = Theme.of(context).colorScheme;
  final overlay = Overlay.of(context);
  late OverlayEntry entry;
  entry = OverlayEntry(
    builder: (_) => _ToastView(
      msg: msg,
      isErr: type == 'err',
      scheme: scheme,
      onDone: () => entry.remove(),
    ),
  );
  overlay.insert(entry);
}

class _ToastView extends StatefulWidget {
  final String msg;
  final bool isErr;
  final ColorScheme scheme;
  final VoidCallback onDone;
  const _ToastView(
      {required this.msg,
      required this.isErr,
      required this.scheme,
      required this.onDone});

  @override
  State<_ToastView> createState() => _ToastViewState();
}

class _ToastViewState extends State<_ToastView>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  late final Animation<Offset> _slide;
  late final Animation<double> _shake;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 350));
    _slide = Tween<Offset>(
            begin: const Offset(1.2, 0), end: Offset.zero)
        .animate(CurvedAnimation(parent: _c, curve: Curves.easeOut));
    // errShake — small horizontal shake after entrance (web parity).
    _shake = TweenSequence<double>([
      TweenSequenceItem(tween: ConstantTween(0), weight: 55),
      TweenSequenceItem(
          tween: Tween(begin: 0.0, end: 8.0)
              .chain(CurveTween(curve: Curves.easeOut)),
          weight: 11),
      TweenSequenceItem(
          tween: Tween(begin: 8.0, end: -6.0)
              .chain(CurveTween(curve: Curves.easeInOut)),
          weight: 11),
      TweenSequenceItem(
          tween: Tween(begin: -6.0, end: 4.0)
              .chain(CurveTween(curve: Curves.easeInOut)),
          weight: 11),
      TweenSequenceItem(
          tween: Tween(begin: 4.0, end: 0.0)
              .chain(CurveTween(curve: Curves.easeIn)),
          weight: 12),
    ]).animate(_c);
    _c.forward();
    Timer(const Duration(seconds: 3), () {
      if (mounted) {
        _c.reverse().then((_) => widget.onDone());
      } else {
        widget.onDone();
      }
    });
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Positioned(
      top: MediaQuery.of(context).padding.top + 12,
      right: 16,
      left: 60,
      child: SlideTransition(
        position: _slide,
        child: AnimatedBuilder(
          animation: _shake,
          builder: (_, child) => Transform.translate(
            offset: Offset(widget.isErr ? _shake.value : 0, 0),
            child: child,
          ),
          child: Material(
            color: widget.isErr
                ? const Color(0xFF7F1D1D)
                : const Color(0xFF0F172A),
            borderRadius: BorderRadius.circular(11),
            elevation: 8,
            child: Padding(
              padding: const EdgeInsets.symmetric(
                  horizontal: 16, vertical: 12),
              child: Row(children: [
                Icon(
                    widget.isErr
                        ? Icons.error_outline
                        : Icons.check_circle_outline,
                    size: 18,
                    color: widget.isErr
                        ? const Color(0xFFFCA5A5)
                        : const Color(0xFF34D399)),
                const SizedBox(width: 9),
                Expanded(
                  child: Text(widget.msg,
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 13.5,
                          fontWeight: FontWeight.w600)),
                ),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}
