// ── lib/widgets/channel_marks.dart ───────────────────────────────
// WHAT: the three channels Velo answers for, drawn as vectors.
//
// WHY drawn: the app ships no icon package and no channel PNGs, and a generic
// Material glyph would not read as "Instagram" at 20px. Each mark is the
// channel's own colour and geometry, painted into the same rounded tile, so a
// row of them looks like one family rather than three borrowed stickers.
import 'package:flutter/material.dart';

enum SalesChannel { instagram, whatsapp, telegram }

extension SalesChannelX on SalesChannel {
  String get label => switch (this) {
        SalesChannel.instagram => 'Instagram',
        SalesChannel.whatsapp => 'WhatsApp',
        SalesChannel.telegram => 'Telegram',
      };

  /// The handle line on a sale card. Kept short so it never wraps.
  String get handle => switch (this) {
        SalesChannel.instagram => '@velosales.store',
        SalesChannel.whatsapp => 'Business · +234 •••• 4021',
        SalesChannel.telegram => '@velosales_store',
      };

  List<Color> get gradient => switch (this) {
        // Instagram's own five-stop ramp, tightened to three so the tile stays
        // legible at 24px (the yellow only survives as a warm edge).
        SalesChannel.instagram => const [
            Color(0xFFF9CE34),
            Color(0xFFEE2A7B),
            Color(0xFF6228D7),
          ],
        SalesChannel.whatsapp => const [Color(0xFF3DDC84), Color(0xFF1FAF5A)],
        SalesChannel.telegram => const [Color(0xFF37B7F3), Color(0xFF1F8AC0)],
      };
}

class ChannelMark extends StatelessWidget {
  final SalesChannel channel;
  final double size;
  final bool shadow;

  const ChannelMark({
    super.key,
    required this.channel,
    this.size = 28,
    this.shadow = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: channel.gradient,
        ),
        borderRadius: BorderRadius.circular(size * 0.30),
        boxShadow: shadow
            ? [
                BoxShadow(
                  color: channel.gradient.last.withValues(alpha: 0.32),
                  blurRadius: size * 0.55,
                  offset: Offset(0, size * 0.20),
                ),
              ]
            : null,
      ),
      child: Padding(
        padding: EdgeInsets.all(size * 0.20),
        child: CustomPaint(painter: ChannelGlyphPainter(channel)),
      ),
    );
  }
}

/// White glyph only, for a surface that already carries the channel colour.
class ChannelGlyphPainter extends CustomPainter {
  final SalesChannel channel;
  const ChannelGlyphPainter(this.channel);

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.shortestSide / 24;
    canvas.save();
    canvas.scale(s, s);
    final stroke = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.9
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..isAntiAlias = true;
    final fill = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.fill
      ..isAntiAlias = true;

    switch (channel) {
      case SalesChannel.instagram:
        // Camera outline + lens + flash dot.
        canvas.drawRRect(
          RRect.fromLTRBR(3.1, 3.1, 20.9, 20.9, const Radius.circular(5.6)),
          stroke,
        );
        canvas.drawCircle(const Offset(12, 12), 4.25, stroke);
        canvas.drawCircle(const Offset(17.4, 6.7), 1.15, fill);
      case SalesChannel.whatsapp:
        // Speech bubble with a small tail, then the handset dropped on top.
        final bubble = Path()
          ..addOval(Rect.fromCircle(center: const Offset(12, 11.6), radius: 8.2))
          ..moveTo(5.4, 17.7)
          ..lineTo(4.5, 21.1)
          ..lineTo(8.1, 19.7)
          ..close();
        canvas.drawPath(bubble, fill);
        canvas.save();
        canvas.translate(12, 11.7);
        canvas.scale(0.60);
        canvas.translate(-12, -12);
        final handset = Paint()
          ..color = channel.gradient.last
          ..style = PaintingStyle.fill
          ..isAntiAlias = true;
        final phone = Path()
          ..moveTo(6.62, 10.79)
          ..cubicTo(8.06, 13.62, 10.38, 15.93, 13.21, 17.38)
          ..lineTo(15.41, 15.18)
          ..cubicTo(15.68, 14.91, 16.08, 14.82, 16.43, 14.94)
          ..cubicTo(17.55, 15.31, 18.76, 15.51, 20.0, 15.51)
          ..cubicTo(20.55, 15.51, 21.0, 15.96, 21.0, 16.51)
          ..lineTo(21.0, 20.0)
          ..cubicTo(21.0, 20.55, 20.55, 21.0, 20.0, 21.0)
          ..cubicTo(10.61, 21.0, 3.0, 13.39, 3.0, 4.0)
          ..cubicTo(3.0, 3.45, 3.45, 3.0, 4.0, 3.0)
          ..lineTo(7.5, 3.0)
          ..cubicTo(8.05, 3.0, 8.5, 3.45, 8.5, 4.0)
          ..cubicTo(8.5, 5.25, 8.7, 6.45, 9.07, 7.57)
          ..cubicTo(9.18, 7.92, 9.1, 8.31, 8.82, 8.59)
          ..close();
        canvas.drawPath(phone, handset);
        canvas.restore();
      case SalesChannel.telegram:
        // The send plane, tilted the way the app's own send key is.
        canvas.save();
        canvas.translate(12, 12);
        canvas.rotate(-0.20);
        canvas.translate(-12, -12);
        final plane = Path()
          ..moveTo(2.7, 20.1)
          ..lineTo(22.1, 12)
          ..lineTo(2.7, 3.9)
          ..lineTo(2.7, 9.8)
          ..lineTo(15.2, 12)
          ..lineTo(2.7, 14.2)
          ..close();
        canvas.drawPath(plane, fill);
        canvas.restore();
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(ChannelGlyphPainter old) => old.channel != channel;
}

/// Product photography, replaced by a drawing.
///
/// The welcome cards are about the *shop*, so each one needs a product, and a
/// stock photo would date the screen and weigh 300KB. These three silhouettes
/// (bag, sneaker, bottle) carry the same soft ink line as the rest of the app.
enum ProductArt { tote, sneaker, bottle }

class ProductTile extends StatelessWidget {
  final ProductArt art;
  final Color tint;
  final double size;

  const ProductTile({
    super.key,
    required this.art,
    required this.tint,
    this.size = 82,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [tint, Color.alphaBlend(tint.withValues(alpha: 0.42), scheme.surface)],
        ),
        borderRadius: BorderRadius.circular(15),
        border: Border.all(
          color: scheme.outline.withValues(alpha: dark ? 1 : 0.7),
        ),
      ),
      child: CustomPaint(
        painter: _ProductPainter(
          art,
          ink: dark ? const Color(0xFFF1EEFF) : const Color(0xFF2E2660),
        ),
      ),
    );
  }
}

class _ProductPainter extends CustomPainter {
  final ProductArt art;
  final Color ink;
  const _ProductPainter(this.art, {required this.ink});

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 96, size.height / 96);
    final fill = Paint()
      ..color = ink.withValues(alpha: 0.13)
      ..style = PaintingStyle.fill
      ..isAntiAlias = true;
    final line = Paint()
      ..color = ink.withValues(alpha: 0.82)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.4
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..isAntiAlias = true;

    switch (art) {
      case ProductArt.tote:
        final body = Path()
          ..moveTo(20, 33)
          ..lineTo(76, 33)
          ..lineTo(71, 78)
          ..quadraticBezierTo(70, 84, 64, 84)
          ..lineTo(32, 84)
          ..quadraticBezierTo(26, 84, 25, 78)
          ..close();
        canvas.drawPath(body, fill);
        canvas.drawPath(body, line);
        final handle = Path()
          ..moveTo(34, 33)
          ..cubicTo(34, 15, 62, 15, 62, 33);
        canvas.drawPath(handle, line);
        canvas.drawRRect(
          RRect.fromLTRBR(44, 30, 52, 37, const Radius.circular(2)),
          Paint()..color = ink.withValues(alpha: 0.72),
        );
        canvas.drawLine(const Offset(38, 70), const Offset(58, 70), line);
      case ProductArt.sneaker:
        final upper = Path()
          ..moveTo(15, 64)
          ..quadraticBezierTo(22, 47, 33, 39)
          ..quadraticBezierTo(39, 44, 46, 47)
          ..quadraticBezierTo(58, 53, 69, 55)
          ..quadraticBezierTo(82, 57, 82, 65)
          ..lineTo(82, 68)
          ..lineTo(15, 68)
          ..close();
        canvas.drawPath(upper, fill);
        canvas.drawPath(upper, line);
        final sole = Path()
          ..moveTo(13, 68)
          ..lineTo(84, 68)
          ..quadraticBezierTo(87, 68, 86, 73)
          ..lineTo(85, 78)
          ..quadraticBezierTo(84, 81, 78, 81)
          ..lineTo(21, 81)
          ..quadraticBezierTo(14, 81, 13, 76)
          ..close();
        canvas.drawPath(sole, Paint()..color = ink.withValues(alpha: 0.78));
        for (var i = 0; i < 3; i++) {
          final y = 48.0 + i * 5.5;
          canvas.drawLine(Offset(38, y), Offset(48, y + 3), line..strokeWidth = 2);
        }
        canvas.drawCircle(const Offset(71, 61), 2.1, Paint()..color = ink.withValues(alpha: 0.6));
      case ProductArt.bottle:
        canvas.drawRRect(
          RRect.fromLTRBR(38, 15, 58, 26, const Radius.circular(3)),
          Paint()..color = ink.withValues(alpha: 0.78),
        );
        canvas.drawRRect(
          RRect.fromLTRBR(42, 25, 54, 34, const Radius.circular(2)),
          fill,
        );
        final body = RRect.fromLTRBR(29, 33, 67, 84, const Radius.circular(9));
        canvas.drawRRect(body, fill);
        canvas.drawRRect(body, line);
        canvas.drawLine(const Offset(38, 59), const Offset(58, 59), line..strokeWidth = 1.8);
        canvas.drawLine(const Offset(38, 66), const Offset(52, 66), line..strokeWidth = 1.8);
        canvas.drawCircle(const Offset(48, 45), 5, line..strokeWidth = 1.8);
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(_ProductPainter old) => old.art != art || old.ink != ink;
}
