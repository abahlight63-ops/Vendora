// ── lib/widgets/logo_reveal.dart ─────────────────────────────────
// WHAT: the brand mark assembling itself.
//
// The reference animation works like this: the parts arrive scattered and
// spinning, sweep around a centre they are not yet part of, then converge and
// snap into the finished mark, and finally the wordmark comes in letter by
// letter. This is that sequence built from OUR geometry — the mark already is
// three separate triangles (brand_mark.dart), so it can genuinely come apart
// and come back together rather than just fading in.
//
// Timeline (fraction of the run):
//   0.00–0.40  pieces orbit in, ring sweeping; wordmark absent
//   0.34–0.78  pieces converge and settle with a slight overshoot
//   0.62–1.00  wordmark letters rise in, staggered
//
// It is one authored moment, used once — on the splash. Do not put it on a
// loading state that fires often; a reveal that repeats is a delay.
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../brand_mark.dart';
import '../theme.dart';

class LogoReveal extends StatefulWidget {
  /// Height of the mark, in logical pixels.
  final double size;

  /// Wordmark under the mark. Pass an empty string to omit it.
  final String wordmark;

  /// Play the whole thing once and settle. False keeps it looping (only useful
  /// for design review).
  final bool once;

  /// Fired when the sequence has settled, so the caller can move on.
  final VoidCallback? onSettled;

  const LogoReveal({
    super.key,
    this.size = 96,
    this.wordmark = 'VeloSales Ai',
    this.once = true,
    this.onSettled,
  });

  @override
  State<LogoReveal> createState() => _LogoRevealState();
}

class _LogoRevealState extends State<LogoReveal> with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  static const _run = Duration(milliseconds: 2100);

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: _run);
    if (widget.once) {
      _c.forward().whenComplete(() {
        if (mounted && widget.onSettled != null) widget.onSettled!();
      });
    } else {
      _c.repeat();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final letters = widget.wordmark.split('');

    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        final t = _c.value;
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: widget.size * kMarkAspect,
              height: widget.size,
              child: CustomPaint(
                painter: _RevealPainter(
                  t: t,
                  gradient: markGradient(context),
                  soft: VeloSalesTheme.markMid(context),
                  ring: Theme.of(context).colorScheme.primary,
                ),
              ),
            ),
            if (letters.isNotEmpty) ...[
              SizedBox(height: widget.size * 0.20),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  for (var i = 0; i < letters.length; i++)
                    _Letter(
                      ch: letters[i],
                      p: staggerProgress(t, i, letters.length, from: 0.62, to: 1.0),
                      size: widget.size * 0.235,
                    ),
                ],
              ),
            ],
          ],
        );
      },
    );
  }
}

class _Letter extends StatelessWidget {
  final String ch;
  final double p;
  final double size;

  const _Letter({required this.ch, required this.p, required this.size});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Opacity(
      opacity: Curves.easeOut.transform(p),
      child: Transform.translate(
        offset: Offset(0, (1 - Curves.easeOutCubic.transform(p)) * size * 0.7),
        child: Text(
          ch,
          style: TextStyle(
            fontSize: size,
            height: 1.1,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.6,
            color: scheme.onSurface,
          ),
        ),
      ),
    );
  }
}

class _RevealPainter extends CustomPainter {
  final double t;
  final Gradient gradient;
  final Color soft;
  final Color ring;

  _RevealPainter({
    required this.t,
    required this.gradient,
    required this.soft,
    required this.ring,
  });

  /// Where each piece flies in from, and how far round it is spun.
  /// Order matches kMarkPieces: cap, left wing, right wing.
  static const _home = <Offset>[
    Offset(301, 126), // cap centroid
    Offset(100, 466), // left wing centroid
    Offset(502, 466), // right wing centroid
  ];
  static const _from = <Offset>[
    Offset(0, -190),
    Offset(-185, 80),
    Offset(185, 80),
  ];
  static const _spin = <double>[-0.30, 0.26, -0.26]; // radians

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.height / kMarkH;
    canvas.save();
    // Work in the artwork's own coordinate space, so the numbers above are the
    // same numbers that are in brand_mark.dart.
    canvas.translate(size.width / 2, size.height / 2);
    canvas.scale(s);
    canvas.translate(-kMarkW / 2, -kMarkH / 2);

    final outline = markOutlinePath();
    final pieces = markPiecePaths();

    // ── the settling: 0 while scattered, 1 when in place ──
    final raw = ((t - 0.34) / 0.44).clamp(0.0, 1.0);
    final settle = Curves.easeOutBack.transform(raw); // slight overshoot
    // A group turn that unwinds as the pieces arrive.
    final groupRot = (1 - Curves.easeOutCubic.transform(raw)) * -0.14;

    // ── the sweeping ring, gone by the time the mark is whole ──
    final ringFade = (1 - ((t - 0.10) / 0.42).clamp(0.0, 1.0));
    if (ringFade > 0.01) {
      final centre = Offset(kMarkW / 2, kMarkH / 2);
      final r = math.max(kMarkW, kMarkH) * 0.62;
      final begin = t * math.pi * 2.4;
      final paint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 7
        ..strokeCap = StrokeCap.round
        ..color = ring.withValues(alpha: 0.30 * ringFade);
      canvas.drawArc(
        Rect.fromCircle(center: centre, radius: r),
        begin,
        math.pi * 1.45,
        false,
        paint,
      );
      canvas.drawArc(
        Rect.fromCircle(center: centre, radius: r * 1.14),
        -begin * 0.7,
        math.pi * 0.9,
        false,
        paint..color = ring.withValues(alpha: 0.16 * ringFade),
      );
    }

    // ── the soft halo, which blooms as the mark closes ──
    final halo = Curves.easeOut.transform(((t - 0.55) / 0.45).clamp(0.0, 1.0));
    if (halo > 0.01) {
      canvas.drawPath(
        outline,
        Paint()
          ..color = soft.withValues(alpha: 0.22 * halo)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 30),
      );
    }

    // ── the pieces ──
    canvas.save();
    canvas.translate(kMarkW / 2, kMarkH / 2);
    canvas.rotate(groupRot);
    canvas.translate(-kMarkW / 2, -kMarkH / 2);

    // The pieces fade up as they arrive. The alpha goes on a LAYER, not on the
    // paint: a paint that carries a shader ignores its own colour, so setting
    // the colour there would silently do nothing.
    final op = ((t - 0.20) / 0.22).clamp(0.0, 1.0);
    canvas.saveLayer(
      Rect.fromLTWH(-300, -300, kMarkW + 600, kMarkH + 600),
      Paint()..color = Colors.white.withValues(alpha: op),
    );

    for (var i = 0; i < pieces.length; i++) {
      final p = staggerProgress(t, i, pieces.length, from: 0.30, to: 0.80);
      final e = Curves.easeOutBack.transform(p);
      final home = _home[i];
      final off = Offset.lerp(_from[i], Offset.zero, e)!;
      final rot = _spin[i] * (1 - e);
      final sc = 0.80 + 0.20 * e;

      canvas.save();
      canvas.translate(home.dx + off.dx, home.dy + off.dy);
      canvas.rotate(rot);
      canvas.scale(sc);
      canvas.translate(-home.dx, -home.dy);
      canvas.drawPath(
        pieces[i],
        Paint()..shader = gradient.createShader(const Rect.fromLTWH(0, 0, kMarkW, kMarkH)),
      );
      canvas.restore();
    }

    canvas.restore(); // the pieces layer
    canvas.restore(); // the group rotation

    // ── close the seams ──
    // Three filled triangles that share edges are anti-aliased independently,
    // so where they meet they leave a hairline. By 0.80 the pieces are exactly
    // home (the settle finishes at 0.78), so redrawing the mark as the single
    // even-odd path here cannot pop — it is pixel-identical except for the
    // hairlines it removes.
    if (t >= 0.80) {
      canvas.drawPath(
        outline,
        Paint()..shader = gradient.createShader(const Rect.fromLTWH(0, 0, kMarkW, kMarkH)),
      );
    }

    // ── the light that crosses the finished mark ──
    final sweep = ((t - 0.78) / 0.22).clamp(0.0, 1.0);
    if (sweep > 0 && sweep < 1) {
      final x = -0.5 + sweep * 2.0;
      canvas.save();
      canvas.clipPath(outline);
      final w = kMarkW * 0.55;
      final rect = Rect.fromLTWH(kMarkW * x - w / 2, 0, w, kMarkH);
      final shine = Paint()
        ..shader = LinearGradient(
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
          colors: [
            Colors.white.withValues(alpha: 0),
            Colors.white.withValues(alpha: 0.34 * math.sin(sweep * math.pi)),
            Colors.white.withValues(alpha: 0),
          ],
        ).createShader(rect);
      canvas.drawRect(rect, shine);
      canvas.restore();
    }

    canvas.restore();
  }

  @override
  bool shouldRepaint(_RevealPainter old) => old.t != t;
}

/// Same stagger maths as the reveal, exposed for other sequential entrances.
double staggerProgress(
  double t,
  int i,
  int n, {
  required double from,
  required double to,
}) {
  final span = to - from;
  final step = n <= 1 ? 0.0 : span * 0.55 / (n - 1);
  final start = from + step * i;
  final local = span * 0.45;
  if (local <= 0) return t >= start ? 1 : 0;
  return ((t - start) / local).clamp(0.0, 1.0);
}
