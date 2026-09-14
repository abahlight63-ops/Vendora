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
        vsync: this, duration: const Duration(milliseconds: 1400))
      ..repeat(reverse: true);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final base = Theme.of(context).colorScheme.surface;
    return AnimatedBuilder(
      animation: _c,
      builder: (_, _) => Container(
        height: widget.height,
        width: widget.width,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(widget.radius),
          color: Color.lerp(
              base, Theme.of(context).colorScheme.onSurface, 0.04 + 0.06 * _c.value),
        ),
      ),
    );
  }
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
                ? const Color(0xFF7A271A)
                : const Color(0xFF101828),
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
                        ? const Color(0xFFFFB4AB)
                        : const Color(0xFF7EF0C0)),
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
