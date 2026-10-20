// ── lib/widgets/error_art.dart ────────────────────────────────────
// WHAT: the phone twin of frontend/src/components/Error3D.jsx — the brand tile
// as a solid object with a contact shadow and one status light. Red = the
// request failed; amber with a dashed ring = you are offline.
//
// Drawn with Canvas rather than an asset: it scales for free, ships in the
// bundle with no network, and the extrusion stays perfectly aligned with the
// facet. The whole thing floats 3px on a 6s loop; with reduce-motion it rests.
import 'dart:math' as math;

import 'package:flutter/material.dart';

class ErrorArt extends StatefulWidget {
  final bool offline;
  final double size;

  const ErrorArt({super.key, this.offline = false, this.size = 118});

  @override
  State<ErrorArt> createState() => _ErrorArtState();
}

class _ErrorArtState extends State<ErrorArt>
    with SingleTickerProviderStateMixin {
  late final AnimationController _float = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 6000),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _float.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduce = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    return SizedBox(
      width: widget.size,
      height: widget.size * (200 / 220),
      child: reduce
          ? CustomPaint(painter: _ArtPainter(offline: widget.offline, lift: 0.5))
          : AnimatedBuilder(
              animation: _float,
              builder: (_, _) => CustomPaint(
                painter: _ArtPainter(
                  offline: widget.offline,
                  lift: Curves.easeInOut.transform(_float.value),
                ),
              ),
            ),
    );
  }
}

class _ArtPainter extends CustomPainter {
  final bool offline;
  final double lift; // 0..1 → 3px of travel

  _ArtPainter({required this.offline, required this.lift});

  static final Path _hex = Path()
    ..moveTo(301, 0)
    ..lineTo(602, 189)
    ..lineTo(602, 513)
    ..lineTo(301, 696)
    ..lineTo(0, 513)
    ..lineTo(0, 189)
    ..close();

  static final Path _brand = Path()
    ..fillType = PathFillType.evenOdd
    ..moveTo(301, 0)
    ..lineTo(602, 189)
    ..lineTo(602, 513)
    ..lineTo(301, 696)
    ..lineTo(0, 513)
    ..lineTo(0, 189)
    ..close()
    ..moveTo(0, 189)
    ..lineTo(602, 189)
    ..lineTo(301, 696)
    ..close();

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 220;
    canvas.save();
    canvas.scale(s);

    // contact shadow — stays on the floor while the tile floats
    final shadowRect = Rect.fromCenter(
        center: const Offset(110, 176), width: 132, height: 28);
    canvas.drawOval(
      shadowRect,
      Paint()
        ..shader = const RadialGradient(colors: [
          Color(0x42171532),
          Color(0x00171532),
        ]).createShader(shadowRect)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 5),
    );

    canvas.save();
    canvas.translate(0, -3 * lift);
    canvas.translate(60, 26);
    canvas.scale(0.165);

    // extrusion, farthest plate first
    for (final step in const [
      [120, Color(0xFF241B63)],
      [90, Color(0xFF2A2069)],
      [60, Color(0xFF31258A)],
      [30, Color(0xFF3A2E9E)],
    ]) {
      canvas.save();
      canvas.translate(0, (step[0] as int).toDouble());
      canvas.drawPath(_hex, Paint()..color = step[1] as Color);
      canvas.restore();
    }

    // top face
    final faceRect = Rect.fromLTWH(0, 0, 602, 696);
    canvas.drawPath(
      _hex,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF7566EA), Color(0xFF4F3FC7), Color(0xFF352A7F)],
          stops: [0, 0.52, 1],
        ).createShader(faceRect),
    );

    // gloss
    canvas.drawPath(
      _hex,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0x57FFFFFF), Color(0x00FFFFFF)],
          stops: [0, 0.5],
        ).createShader(faceRect),
    );

    // white inlay, inset so a purple rim stays visible
    canvas.save();
    canvas.translate(301, 348);
    canvas.scale(0.88);
    canvas.translate(-301, -348);
    canvas.drawPath(_brand, Paint()..color = const Color(0xF7FFFFFF));
    canvas.restore();

    canvas.restore();

    // status light
    final dot = offline ? const Color(0xFFD97706) : const Color(0xFFDC2626);
    canvas.drawCircle(
        const Offset(167, 52), 11, Paint()..color = dot.withValues(alpha: 0.14));
    canvas.drawCircle(const Offset(167, 52), 5, Paint()..color = dot);
    if (offline) {
      final ring = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.4
        ..color = dot.withValues(alpha: 0.8);
      const dash = 3.0;
      const gap = 4.0;
      for (var a = 0.0; a < math.pi * 2; a += (dash + gap) / 9) {
        canvas.drawArc(
          Rect.fromCircle(center: const Offset(167, 52), radius: 9),
          a,
          dash / 9,
          false,
          ring,
        );
      }
    }

    canvas.restore();
  }

  @override
  bool shouldRepaint(_ArtPainter old) =>
      old.lift != lift || old.offline != offline;
}
