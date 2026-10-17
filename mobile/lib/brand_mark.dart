// ── lib/brand_mark.dart ──────────────────────────────────────────
// WHAT: the VeloSales Ai mark, as real vectors.
//
// WHY this file exists: the app shipped the logo as a raster PNG in the
// retired green, sitting on an opaque white square (so it also pasted a white
// box onto tinted surfaces). This draws the mark from geometry instead — so it
// is razor-sharp at 24px in the sidebar and at 180px on the splash, and it
// re-tints with the theme.
//
// THE SHAPE (measured off the owner's own logo file, not invented): a hexagon
// with an inscribed inverted triangle. The negative space between them reads
// as a V — the V in VeloSales. It is delivered as three solid triangles, which
// together are exactly "hexagon minus triangle", and which can be animated
// apart (see widgets/logo_reveal.dart).
//
//   viewBox 0 0 602 696   (the source artwork's own aspect — taller than wide)
import 'package:flutter/material.dart';

import 'theme.dart';

/// The artwork's coordinate space. Every number below is in these units.
const double kMarkW = 602;
const double kMarkH = 696;

/// Aspect ratio, for callers that lay the mark out in a row.
const double kMarkAspect = kMarkW / kMarkH;

/// The three pieces, in drawing order. Vertex coordinates are the source's.
const List<String> kMarkPieces = [
  // top cap: apex → upper-right → upper-left
  'M301 0 L602 189 L0 189 Z',
  // left wing: upper-left → lower-left → bottom apex
  'M0 189 L0 513 L301 696 Z',
  // right wing: upper-right → lower-right → bottom apex
  'M602 189 L602 513 L301 696 Z',
];

/// The same shape as one path (hexagon with the triangle punched out). Used for
/// the static mark: adjacent triangles that share an edge can leave a hairline
/// seam where they are anti-aliased, and a single path cannot.
final Path _outline = _parse(
  'M301 0 L602 189 L602 513 L301 696 L0 513 L0 189 Z M0 189 L602 189 L301 696 Z',
  evenOdd: true,
);

/// Parses the M/L/Z subset the artwork uses — no curves, so this stays small
/// and exact rather than approximating the geometry by hand.
Path _parse(String d, {bool evenOdd = false}) {
  final path = Path();
  if (evenOdd) path.fillType = PathFillType.evenOdd;
  final re = RegExp(r'([MLZ])([^MLZ]*)');
  for (final m in re.allMatches(d)) {
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

/// Exposed so the same geometry can drive the reveal animation.
Path markOutlinePath() => _outline;
List<Path> markPiecePaths() => kMarkPieces.map((d) => _parse(d)).toList();

/// The mark's own vertical ramp. It is the one element allowed a gradient
/// (it is a solid shape, so the ramp reads as form, not as decoration).
LinearGradient markGradient(BuildContext context) => LinearGradient(
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
      stops: const [0, 0.5, 1],
      colors: [
        VeloSalesTheme.markTop(context),
        VeloSalesTheme.markMid(context),
        VeloSalesTheme.markBot(context),
      ],
    );

/// The brand mark. Use this everywhere the logo appears.
class BrandMark extends StatelessWidget {
  /// Height in logical pixels. The width follows the artwork's aspect ratio.
  final double size;

  /// Soft brand halo behind the mark. For the splash and empty states only —
  /// it is decoration, so it does not belong on every row.
  final bool glow;

  const BrandMark({super.key, this.size = 34, this.glow = false});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size * kMarkAspect,
      height: size,
      child: CustomPaint(
        painter: _MarkPainter(
          gradient: markGradient(context),
          glow: glow ? VeloSalesTheme.markMid(context) : null,
        ),
      ),
    );
  }
}

class _MarkPainter extends CustomPainter {
  final Gradient gradient;
  final Color? glow;

  const _MarkPainter({required this.gradient, this.glow});

  @override
  void paint(Canvas canvas, Size size) {
    // Height drives the scale; the width is whatever the aspect gives us.
    final s = size.height / kMarkH;
    canvas.save();
    canvas.scale(s);

    if (glow != null) {
      // A soft halo: blurred, offset-free, low alpha. Not a ring.
      canvas.drawPath(
        _outline,
        Paint()
          ..color = glow!.withValues(alpha: 0.30)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 26),
      );
    }

    canvas.drawPath(
      _outline,
      Paint()
        ..shader = gradient.createShader(const Rect.fromLTWH(0, 0, kMarkW, kMarkH)),
    );

    canvas.restore();
  }

  @override
  bool shouldRepaint(_MarkPainter old) => old.gradient != gradient || old.glow != glow;
}
