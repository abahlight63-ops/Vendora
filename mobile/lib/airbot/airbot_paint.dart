// ── lib/airbot/airbot_paint.dart ─────────────────────────────────
// WHAT: the AirBot character, drawn with vector paths (CustomPainter) so it
// scales cleanly on any screen and each body part can move independently.
// It is NOT a flattened PNG — eyes blink, mouth opens for talking, arms
// rotate to wave/point — and it carries NO file asset, so it cannot be
// watermark/art-broken. Palette follows the app: light=green+white card,
// dark=deep green+dark card, accent gold + teal glow (see theme.dart).
//
// The painter receives a frozen "pose" computed by the guide widget once per
// frame: breathe/headTilt/armLift/mouthOpen/blink/eyeShift etc. Keeping the
// math outside the paint() keeps it cheap (no allocations in the painter).
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';

/// One immutable snapshot of everything the character must draw this frame.
/// The widget builds it from its animation controllers; the painter just
/// draws. `reduceMotion` = the shy-mode snapshot (pose == zeroed values).
class AirBotPose {
  final double breath; // -1..1 → chest rise (idle breathing)
  final double headTilt; // radians (±) subtle head lean
  final double armLift; // 0..1 right arm raised for wave/point
  final double armRot; // radians arm swing (point/wave oscillation)
  final double mouthOpen; // 0..1 talking jaw
  final double blink; // 0..1 (1 = fully closed)
  final double eyeShift; // -1..1 eye-gaze shift (thinking)
  final double bob; // px vertical drift (idle sway)
  final bool reduce;

  const AirBotPose({
    this.breath = 0,
    this.headTilt = 0,
    this.armLift = 0,
    this.armRot = 0,
    this.mouthOpen = 0,
    this.blink = 0,
    this.eyeShift = 0,
    this.bob = 0,
    this.reduce = false,
  });

  /// Safe pose for `reduceMotion` accessibility (still, but visible).
  static const shy = AirBotPose(reduce: true);
}

class AirBotPainter extends CustomPainter {
  AirBotPainter({
    required this.pose,
    required this.light,
    required this.theme,
  });

  final AirBotPose pose;
  final bool light; // light-theme palette vs dark
  final ColorScheme theme;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final cx = w / 2;
    final unit = w / 100; // scale everything from width (@100 = full box)

    // ── palette ──
    final body = light ? const Color(0xFF128C4A) : const Color(0xFF25D366);
    final bodyDark = light ? const Color(0xFF0B6B38) : const Color(0xFF0E7B4B);
    final skin = light ? const Color(0xFFFFE8D6) : const Color(0xFFB98A5F);
    final hair = light ? const Color(0xFF624A3C) : const Color(0xFF8E6E5A);
    final accentGold = const Color(0xFFFFCF5C);
    final accentTeal = light ? const Color(0xFF5EEAD4) : const Color(0xFF7EF0C0);
    final faceLine = light ? const Color(0xFF10233A) : const Color(0xFFEAF3ED);

    // every part is relative to `unit` so it scales (no hard px in paint).

    // ── soft glow halo (breath-linked, gentle) ──
    final halo = Paint()
      ..shader = RadialGradient(
        colors: [
          accentTeal.withValues(alpha: 0.22),
          accentTeal.withValues(alpha: 0),
        ],
      ).createShader(
          Rect.fromCircle(center: Offset(cx, h * 0.5), radius: w * 0.5));
    canvas.drawCircle(Offset(cx, h * 0.5), w * 0.5, halo);

    // ── body (rounded blob — breathes via scaleY) ──
    final breathe = pose.reduce ? 0.0 : pose.breath * 0.015;
    final bodyH = h * (0.42 + breathe); // chest rises/falls slightly
    final bodyTop = h * 0.58 - bodyH + (pose.reduce ? 0 : pose.bob);
    final bodyRect = RRect.fromRectAndRadius(
      Rect.fromCenter(
          center: Offset(cx, bodyTop + bodyH / 2), width: w * 0.5, height: bodyH),
      Radius.circular(unit * 18),
    );
    canvas.drawRRect(bodyRect, Paint()..color = body);

    // ── head ──
    final headR = w * 0.19;
    final headC = Offset(cx + math.sin(pose.headTilt) * unit * -2, h * 0.34 + (pose.reduce ? 0 : pose.bob) + (pose.reduce ? 0 : pose.breath * 0.006 * h));
    canvas.save();
    canvas.translate(headC.dx, headC.dy);
    canvas.rotate(pose.headTilt);
    // skin + hair cap
    canvas.drawCircle(Offset.zero, headR, Paint()..color = skin);
    final capPaint = Paint()..color = hair;
    canvas.drawArc(
      Rect.fromCircle(center: Offset(0, -unit * 2), radius: headR * 1.02),
      math.pi,
      math.pi,
      true,
      capPaint,
    );

    // ── eyes ──
    final eyeY = unit * 0.5;
    final eyeDX = unit * 11;
    final blinkFactor = pose.reduce ? 0.0 : pose.blink;
    for (final dir in [-1.0, 1.0]) {
      final ex = dir * eyeDX + pose.eyeShift * unit * 2;
      // normal eye height vs squashed when blinking
      final eyeH = unit * 4.2 * (1 - blinkFactor);
      canvas.drawOval(
        Rect.fromCenter(center: Offset(ex, eyeY), width: unit * 6, height: math.max(0.8, eyeH)),
        Paint()..color = faceLine.withValues(alpha: 0.92),
      );
    }

    // ── mouth (opens for talking) ──
    final mouthOpenFactor = pose.reduce ? 0.0 : pose.mouthOpen;
    final mouthY = unit * 12;
    if (mouthOpenFactor > 0.02) {
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromCenter(
              center: Offset(unit * 3, mouthY + unit * 2),
              width: unit * 9,
              height: unit * (5 + mouthOpenFactor * 7)),
          Radius.circular(unit * 3),
        ),
        Paint()..color = faceLine.withValues(alpha: 0.85),
      );
    } else {
      // neutral smile line
      final smile = Path()
        ..moveTo(unit * -3, mouthY)
        ..quadraticBezierTo(unit * 0.5, mouthY + unit * 2, unit * 4.5, mouthY);
      canvas.drawPath(
          smile,
          Paint()
            ..color = faceLine.withValues(alpha: 0.75)
            ..style = PaintingStyle.stroke
            ..strokeWidth = unit * 1.6
            ..strokeCap = StrokeCap.round);
    }
    canvas.restore();

    // ── right arm (the expressive one: wave / point / think) ──
    final shoulder = Offset(cx + unit * 18, h * 0.62 - (pose.reduce ? 0 : pose.bob));
    final lift = pose.reduce ? 0.0 : pose.armLift;
    if (lift > 0.02) {
      // arm raised from shoulder; rotate swings it left/right
      final baseAngle = -math.pi / 2 + pose.armRot; // up + oscillate
      final armLen = w * 0.16;
      final hand = Offset(
          shoulder.dx + math.cos(baseAngle) * armLen,
          shoulder.dy + math.sin(baseAngle) * armLen);
      canvas.drawLine(shoulder, hand,
          Paint()
            ..color = bodyDark
            ..strokeWidth = unit * 6
            ..strokeCap = StrokeCap.round);
      // hand (gold = friendly accent)
      canvas.drawCircle(hand, unit * 4, Paint()..color = accentGold);
      // when pointing, add a little directional cue (dot trail)
      if (pose.armRot.abs() > 0.1) {
        canvas.drawCircle(
          hand + Offset(pose.armRot > 0 ? unit * 6 : -unit * 6, 0),
          2.2,
          Paint()..color = accentGold.withValues(alpha: 0.55),
        );
      }
    }

    canvas.restore();
  }

  @override
  bool shouldRepaint(AirBotPainter old) =>
      old.pose != pose || old.light != light || old.theme != theme;
}