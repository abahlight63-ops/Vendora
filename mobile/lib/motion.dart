// ── lib/motion.dart ──────────────────────────────────────────────
// WHAT: web motion vocabulary as Flutter widgets — 1:1 with
// styles.css keyframes: fadeSlide (cards), toastIn + errShake (toasts),
// blink (typing dots), .skel shimmer (loading), stagger (lists).
import 'dart:async';

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
// The sweep blends coral into lavender, so a loading screen is recognisably ours
// from across the room. Same as the web's .skel.
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
    final dark = scheme.brightness == Brightness.dark;
    final base = dark
        ? Colors.white.withValues(alpha: 0.1)
        : const Color(0xFF4F3FC7).withValues(alpha: 0.13);
    final sheenA = dark
        ? const Color(0xFFFF8A6B).withValues(alpha: 0.42)
        : const Color(0xFFFFB199).withValues(alpha: 0.75);
    final sheenB = dark
        ? const Color(0xFFB9AEFB).withValues(alpha: 0.46)
        : const Color(0xFFB5A6FF).withValues(alpha: 0.8);
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
                        gradient: LinearGradient(
                          stops: const [0, 0.45, 0.62, 1],
                          colors: [
                            sheenA.withValues(alpha: 0),
                            sheenA,
                            sheenB,
                            sheenB.withValues(alpha: 0),
                          ],
                        ),
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
// A coral and indigo arc, the same as the small web <Loader/>.
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
            a: widget.color ?? const Color(0xFFD03C16),
            b: widget.color?.withValues(alpha: 0.4) ?? scheme.primary,
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
    final stroke = size.width >= 28 ? 4.0 : 3.0;
    final rect = (Offset.zero & size).deflate(stroke / 2);
    final start = t * 2 * 3.14159265;
    final p = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(rect, start, 1.5, false, p..color = a);
    canvas.drawArc(rect, start + 1.5, 1.5, false, p..color = b);
  }

  @override
  bool shouldRepaint(_OrbitPainter old) => old.t != t || old.a != a || old.b != b;
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
