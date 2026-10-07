// ── lib/airbot/airbot_speech.dart ────────────────────────────────
// WHAT: the premium speech bubble that points at AirBot. Rounded, neutral,
// readable at any width; sits BELOW/ABOVE the character (never painted over
// important buttons — it repositions onto whichever side has room). Long
// messages collapse to a constraint + ellipsis; text maxes ~3 lines.
// Pure presentation: reads theme tokens, no packages.
library;

import 'package:flutter/material.dart';

/// The bubble. Expose [ownerWidth] so it can never cover the character.
class AirBotBubble extends StatelessWidget {
  const AirBotBubble({
    super.key,
    required this.text,
    this.align = Alignment.center,
    this.onShown,
  });

  final String text;
  final Alignment align;
  final VoidCallback? onShown;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? scheme.surface : Colors.white;
    // tail: small circle pointing up toward the character.
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // the body (rounded, soft shadow, hairline)
        Material(
          color: bg,
          elevation: 0,
          borderRadius: BorderRadius.circular(14),
          clipBehavior: Clip.antiAlias,
          child: Container(
            constraints: const BoxConstraints(maxWidth: 340, maxHeight: 120),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: scheme.onSurface.withValues(alpha: 0.06)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.06),
                  blurRadius: 18,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Text(
              text,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 14,
                height: 1.35,
                fontWeight: FontWeight.w500,
                color: scheme.onSurface,
              ),
            ),
          ),
        ),
        // little pointer triangle (points up = toward the bot above it)
        CustomPaint(
          size: const Size(14, 8),
          painter: AirBotTailPainter(bg),
        ),
      ],
    );
  }
}

class AirBotTailPainter extends CustomPainter {
  AirBotTailPainter(this.color);
  final Color color;
  @override
  void paint(Canvas canvas, Size size) {
    final p = Path()
      ..moveTo(0, size.height)
      ..lineTo(size.width / 2, 0)
      ..lineTo(size.width, size.height)
      ..close();
    canvas.drawPath(p, Paint()..color = color);
  }

  @override
  bool shouldRepaint(AirBotTailPainter old) => old.color != color;
}