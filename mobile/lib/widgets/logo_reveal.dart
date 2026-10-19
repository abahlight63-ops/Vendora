// ── lib/widgets/logo_reveal.dart ─────────────────────────────────
// WHAT: the brand mark assembling itself.
//
// This is the owner's reference animation (logo animations.mp4) rebuilt from
// OUR geometry. The reference is a watermelon built out of seeds and rind
// strokes; ours is a hexagon built out of three triangles — but the sequence
// is the same, beat for beat, and so are the numbers:
//
//   0.10–1.00s  the three pieces orbit in from outside the frame, each one
//               spinning and scaling up as it travels (the flight path itself
//               is turned 34° and unwinds as they land, so they curve in)
//   0.00–1.05s  the outline draws itself as two arcs sweeping round the centre
//   0.92s       the seam closes: the mark is whole for the first time
//   1.00–1.40s  a pass of light crosses it
//   1.10–1.88s  the wordmark DROPS in, one letter at a time, each falling from
//               above its baseline and springing past it on the way home
//
// The letters are the signature move — the reference's wordmark is not faded
// in, it is dropped in, glyph by glyph, with an overshoot. A fade would be
// cheaper and would look like a different animation.
//
// The web splash runs the identical timeline (frontend/src/styles.css, the
// `.splash` block) at the identical speed, so both clients show one animation,
// not two cousins of one. Keep kRevealMs and the constants below in step with
// it.
//
// It is one authored moment, used once — on the splash. Do not put it on a
// loading state that fires often; a reveal that repeats is a delay.
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../brand_mark.dart';
import '../theme.dart';

/// Length of the whole sequence. The web splash uses 2300ms too.
const int kRevealMs = 2300;

// ── the beats, in milliseconds ──
const double _assembleFirst = 100; // first piece leaves its start point
const double _assembleStagger = 90; // between pieces
const double _assembleDur = 720; // per piece, start to home
const double _orbitDur = 900; // the flight path unwinding
const double _ringDur = 1050; // arcs drawing and sweeping
const double _joinAt = 920; // pieces are exactly home
const double _shineAt = 1000;
const double _shineDur = 400;
const double _dropFirst = 1100; // first letter starts falling
const double _dropStagger = 42;
const double _dropDur = 320;

// The same curves the CSS uses — a cubic-bezier is a cubic-bezier.
const _arrive = Cubic(0.3, 0.68, 0.3, 1.1); // the piece flight (+ a little spring)
const _drop = Cubic(0.2, 1.55, 0.42, 1); // the letter drop (overshoots, hard)
const _ringCurve = Cubic(0.4, 0.05, 0.2, 1);
const _orbitCurve = Cubic(0.32, 0.86, 0.24, 1);

double _at(double ms, double start, double dur) =>
    dur <= 0 ? (ms >= start ? 1 : 0) : ((ms - start) / dur).clamp(0.0, 1.0);

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

class _LogoRevealState extends State<LogoReveal>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: kRevealMs),
    );
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
        final ms = _c.value * kRevealMs;
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: widget.size * kMarkAspect,
              height: widget.size,
              child: CustomPaint(
                painter: _RevealPainter(
                  t: _c.value,
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
                      p: _at(
                        ms,
                        _dropFirst + i * _dropStagger,
                        _dropDur,
                      ),
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

/// One glyph of the wordmark: falls from above the baseline, overshoots it,
/// springs back. The fade is deliberately quicker than the fall — a letter you
/// cannot see yet cannot be seen to fall.
class _Letter extends StatelessWidget {
  final String ch;
  final double p;
  final double size;

  const _Letter({required this.ch, required this.p, required this.size});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final fall = _drop.transform(p);
    return Opacity(
      opacity: (p / 0.45).clamp(0.0, 1.0),
      child: Transform.translate(
        offset: Offset(0, -(1 - fall) * size * 0.85),
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

  /// Where each piece lives, and where it flies in from. Order matches
  /// kMarkPieces: cap, left wing, right wing. The offsets are the artwork's
  /// own numbers scaled up (×2.4) for the entrance — an arrival you can
  /// actually see at 112px.
  static const _home = <Offset>[
    Offset(301, 126), // cap centroid
    Offset(100, 466), // left wing centroid
    Offset(502, 466), // right wing centroid
  ];
  static const _from = <Offset>[
    Offset(0, -456),
    Offset(-444, 192),
    Offset(444, 192),
  ];
  static const _spin = <double>[-0.593, 0.524, -0.524]; // radians (−34°, +30°, −30°)

  @override
  void paint(Canvas canvas, Size size) {
    final ms = t * kRevealMs;
    final s = size.height / kMarkH;
    canvas.save();
    // Work in the artwork's own coordinate space, so the numbers above are the
    // same numbers that are in brand_mark.dart.
    canvas.translate(size.width / 2, size.height / 2);
    canvas.scale(s);
    canvas.translate(-kMarkW / 2, -kMarkH / 2);

    final outline = markOutlinePath();
    final pieces = markPiecePaths();

    // ── the outline drawing itself: two arcs, sweeping ──
    final ringP = _ringCurve.transform((ms / _ringDur).clamp(0.0, 1.0));
    final ringIn = (ms / 140).clamp(0.0, 1.0);
    final ringOut = ((ms - (_ringDur - 260)) / 260).clamp(0.0, 1.0);
    final ringFade = ringIn * (1 - ringOut);
    if (ringFade > 0.01) {
      final centre = Offset(kMarkW / 2, kMarkH / 2);
      final angle = (-118 + 216 * ringP) * math.pi / 180;
      final paint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 26
        ..strokeCap = StrokeCap.round;
      // 620 of 2664 (84°) and 360 of 3079 (42°) — the CSS dash lengths.
      canvas.drawArc(
        Rect.fromCircle(center: centre, radius: 424),
        angle,
        math.pi * 0.467,
        false,
        paint..color = ring.withValues(alpha: 0.62 * ringFade),
      );
      canvas.drawArc(
        Rect.fromCircle(center: centre, radius: 490),
        -angle * 0.7,
        math.pi * 0.233,
        false,
        paint..color = ring.withValues(alpha: 0.34 * ringFade),
      );
    }

    // ── the soft halo, which blooms as the mark closes ──
    final halo = Curves.easeOut.transform(_at(ms, _joinAt, 700));
    if (halo > 0.01) {
      canvas.drawPath(
        outline,
        Paint()
          ..color = soft.withValues(alpha: 0.22 * halo)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 30),
      );
    }

    // ── the orbit: the whole flight path is turned, then unwinds ──
    final orbit = _orbitCurve.transform((ms / _orbitDur).clamp(0.0, 1.0));
    final groupRot = -0.593 * (1 - orbit); // −34°
    final groupScale = 0.84 + 0.16 * orbit;

    canvas.save();
    canvas.translate(kMarkW / 2, kMarkH / 2);
    canvas.scale(groupScale);
    canvas.rotate(groupRot);
    canvas.translate(-kMarkW / 2, -kMarkH / 2);

    // The pieces fade up as they arrive. The alpha goes on a LAYER, not on the
    // paint: a paint that carries a shader ignores its own colour, so setting
    // the colour there would silently do nothing.
    final layer =
        ((ms - _assembleFirst) / 160).clamp(0.0, 1.0).toDouble();
    canvas.saveLayer(
      Rect.fromLTWH(-300, -300, kMarkW + 600, kMarkH + 600),
      Paint()..color = Colors.white.withValues(alpha: layer),
    );

    for (var i = 0; i < pieces.length; i++) {
      final p = _at(ms, _assembleFirst + i * _assembleStagger, _assembleDur);
      final e = _arrive.transform(p);
      final home = _home[i];
      final off = Offset.lerp(_from[i], Offset.zero, e)!;
      final rot = _spin[i] * (1 - e);
      final sc = 0.72 + 0.28 * e;

      canvas.save();
      canvas.translate(home.dx + off.dx, home.dy + off.dy);
      canvas.rotate(rot);
      canvas.scale(sc);
      canvas.translate(-home.dx, -home.dy);
      canvas.drawPath(
        pieces[i],
        Paint()
          ..shader = gradient.createShader(
            const Rect.fromLTWH(0, 0, kMarkW, kMarkH),
          ),
      );
      canvas.restore();
    }

    canvas.restore(); // the pieces layer
    canvas.restore(); // the orbit

    // ── close the seams ──
    // Three filled triangles that share edges are anti-aliased independently,
    // so where they meet they leave a hairline. By 0.92s the pieces are exactly
    // home, so redrawing the mark as the single even-odd path here cannot pop
    // — it is pixel-identical except for the hairlines it removes.
    if (ms >= _joinAt) {
      canvas.drawPath(
        outline,
        Paint()
          ..shader = gradient.createShader(
            const Rect.fromLTWH(0, 0, kMarkW, kMarkH),
          ),
      );
    }

    // ── the light that crosses the finished mark ──
    final sweep = _at(ms, _shineAt, _shineDur);
    if (sweep > 0 && sweep < 1) {
      final x = -0.5 + Curves.easeOut.transform(sweep) * 2.0;
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
