// ── lib/brand_mark.dart ──────────────────────────────────────────
// WHAT: the VeloSales Ai mark, as real vectors.
//
// WHY this file exists: the app shipped the logo as a raster PNG in the
// retired green, sitting on an opaque white square (so it also pasted a white
// box onto tinted surfaces). The shape below is the designer's own path data
// from the vector kit, parsed once and painted from theme tokens — so it is
// razor-sharp at 28px in a list row and at 180px on the splash, and it
// re-tints with the theme instead of being frozen at one colour.
import 'package:flutter/material.dart';

import 'theme.dart';

/// viewBox of the designer's artwork. Every coordinate below is in this space.
const double _vb = 512;

/// The mark's sub-paths, in drawing order, exactly as the designer drew them:
/// outer frame, top band, the two side bars, four nested chevrons, the V, and
/// the centre diamond. All fills use even-odd, as the source does.
const List<String> _markPaths = [
  // outer hexagonal frame
  'M256.0 40.0 L468.0 150.2 L468.0 296.0 L386.0 378.0 L386.0 448.0 L366.0 468.0 '
      'L366.0 370.0 L433.0 295.0 L433.0 163.0 L256.0 71.0 L79.0 163.0 L79.0 295.0 '
      'L146.0 370.0 L146.0 468.0 L126.0 448.0 L126.0 378.0 L44.0 296.0 L44.0 150.2Z',
  // top band
  'M256.0 99.0 L91.0 181.5 L91.0 214.5 L256.0 132.0 L421.0 214.5 L421.0 181.5Z',
  // left bar
  'M18.0 158.0 L18.0 324.0 L112.0 418.0 L112.0 376.0 L36.0 300.0 L36.0 172.0Z',
  // right bar
  'M476.0 172.0 L476.0 300.0 L400.0 376.0 L400.0 418.0 L494.0 324.0 L494.0 158.0Z',
  // chevron 1
  'M256.0 160.0 L105.0 235.5 L135.9 254.1 L256.0 194.0 L376.1 254.1 L407.0 235.5Z',
  // chevron 2
  'M256.0 222.0 L161.0 269.5 L184.3 285.8 L256.0 250.0 L327.7 285.8 L351.0 269.5Z',
  // the V
  'M256.0 471.0 L107.0 289.0 L141.0 276.3 L256.0 416.0 L371.0 276.3 L405.0 289.0Z',
  // chevron 3
  'M256.0 278.0 L198.0 307.0 L211.3 312.3 L256.0 290.0 L300.7 312.3 L314.0 307.0Z',
  // centre diamond (even-odd punches the centre hole)
  'M256.0 319.0 L286.0 352.5 L256.0 386.0 L226.0 352.5Z'
      'M256.0 338.0 L268.0 352.5 L256.0 367.0 L244.0 352.5Z',
];

/// Parses the M/L/Z subset the artwork uses — no curves, so this stays small
/// and exact rather than approximating the designer's geometry by hand.
Path _markPath() {
  final path = Path()..fillType = PathFillType.evenOdd;
  final re = RegExp(r'([MLZ])([^MLZ]*)');
  for (final m in re.allMatches(_markPaths.join())) {
    final cmd = m.group(1)!;
    final nums = m
        .group(2)!
        .trim()
        .split(RegExp(r'[\s,]+'))
        .where((s) => s.isNotEmpty)
        .map(double.parse)
        .toList();
    switch (cmd) {
      case 'M':
        path.moveTo(nums[0], nums[1]);
        for (var i = 2; i + 1 < nums.length; i += 2) {
          path.lineTo(nums[i], nums[i + 1]);
        }
      case 'L':
        for (var i = 0; i + 1 < nums.length; i += 2) {
          path.lineTo(nums[i], nums[i + 1]);
        }
      case 'Z':
        path.close();
    }
  }
  return path;
}

/// Built once — the geometry never changes, only the paint colour does.
final Path _cachedPath = _markPath();

/// The brand mark. Use this everywhere the logo appears.
class BrandMark extends StatelessWidget {
  /// Rendered box, in logical pixels.
  final double size;

  /// Soft brand halo behind the mark. For the splash and empty states only —
  /// it is decoration, so it does not belong on every row.
  final bool glow;

  const BrandMark({super.key, this.size = 34, this.glow = false});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _MarkPainter(
          top: VeloSalesTheme.markTop(context),
          mid: VeloSalesTheme.markMid(context),
          bot: VeloSalesTheme.markBot(context),
          edge: VeloSalesTheme.markEdge(context),
          glow: glow ? VeloSalesTheme.markMid(context) : null,
        ),
      ),
    );
  }
}

class _MarkPainter extends CustomPainter {
  final Color top;
  final Color mid;
  final Color bot;
  final Color edge;
  final Color? glow;

  const _MarkPainter({
    required this.top,
    required this.mid,
    required this.bot,
    required this.edge,
    this.glow,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / _vb;
    canvas.save();
    canvas.scale(s);

    if (glow != null) {
      // A soft halo, not a ring: blurred, offset-free, low alpha.
      canvas.drawPath(
        _cachedPath,
        Paint()
          ..color = glow!.withValues(alpha: 0.25)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 22),
      );
    }

    // The mark's own vertical light-to-dark ramp (the source gradient runs
    // from y=40 to y=470).
    canvas.drawPath(
      _cachedPath,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          stops: const [0, 0.5, 1],
          colors: [top, mid, bot],
        ).createShader(const Rect.fromLTWH(0, 40, _vb, 430)),
    );

    // Top-edge highlight, the "bevelled metal" read the designer used.
    canvas.drawPath(
      _cachedPath,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.4
        ..color = edge,
    );

    canvas.restore();
  }

  @override
  bool shouldRepaint(_MarkPainter old) =>
      old.top != top || old.mid != mid || old.bot != bot || old.edge != edge || old.glow != glow;
}
