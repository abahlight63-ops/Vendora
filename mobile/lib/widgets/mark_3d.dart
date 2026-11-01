// ── lib/widgets/mark_3d.dart ─────────────────────────────────────
// WHAT: the welcome scene — the brand mark as a real 3D object, with the sales
// channels orbiting it. No 3D package and no model file: the mark is three
// triangles, so extruding them keeps the exact logo and stays light on cheap
// phones.
//
// PARITY: frontend/src/components/mark3d-core.js draws the same scene from the
// same numbers. If a value below changes, change it there too.
//
// The mark turns toward the finger. Under reduced motion it holds one still,
// angled pose with every channel visible.
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

import '../depth.dart';
import 'channel_marks.dart';

const _depth = 120.0; // extrusion, in artwork units (the mark is 602 x 696)
const _focal = 1800.0;
const _orbitRadius = 510.0;
const _orbitTilt = 0.52;
const _orbitRoll = -0.22;
const _orbitPeriod = 14.0;
const _tile = 190.0;
const _tileMaxScale = 1.16;
const _sway = 0.34;
const _stillYaw = -0.38;
const _stillPitch = -0.14;
const _stillOrbit = 0.62;

class _Piece {
  final List<List<double>> v;
  final double dx, dy, rot;
  final List<Color> ramp;
  final Color sideDark, sideLit;
  const _Piece(this.v, this.dx, this.dy, this.rot, this.ramp, this.sideDark, this.sideLit);
}

const _pieces = [
  _Piece([[301, 0], [602, 189], [0, 189]], 0, -190, -17,
      [Color(0xFFFFB199), Color(0xFFFF7650), Color(0xFFD03C16)],
      Color(0xFF6B1D08), Color(0xFFD03C16)),
  _Piece([[0, 189], [0, 513], [301, 696]], -185, 80, 15,
      [Color(0xFF9C8FFA), Color(0xFF5B4BD6), Color(0xFF3B2E9E)],
      Color(0xFF1F1659), Color(0xFF6D5BF6)),
  _Piece([[602, 189], [602, 513], [301, 696]], 185, 80, -15,
      [Color(0xFFFF8A6B), Color(0xFFB44BA0), Color(0xFF4F3FC7)],
      Color(0xFF4A1D5E), Color(0xFFB44BA0)),
];

const _channels = [
  SalesChannel.whatsapp,
  SalesChannel.telegram,
  SalesChannel.instagram,
];

Color _tileSide(SalesChannel c) => switch (c) {
      SalesChannel.whatsapp => const Color(0xFF0F6F38),
      SalesChannel.telegram => const Color(0xFF125E85),
      SalesChannel.instagram => const Color(0xFF3D1590),
    };

class _V {
  final double x, y, z;
  const _V(this.x, this.y, this.z);
  _V operator -(_V o) => _V(x - o.x, y - o.y, z - o.z);
  _V operator -() => _V(-x, -y, -z);
  double dot(_V o) => x * o.x + y * o.y + z * o.z;
  _V cross(_V o) =>
      _V(y * o.z - z * o.y, z * o.x - x * o.z, x * o.y - y * o.x);
  _V get norm {
    final l = math.sqrt(x * x + y * y + z * z);
    return l == 0 ? this : _V(x / l, y / l, z / l);
  }
}

final _light = const _V(-0.45, -0.65, -0.62).norm;

double _clamp(double x, [double a = 0, double b = 1]) =>
    x < a ? a : (x > b ? b : x);
double _easeOut(double x) => 1 - math.pow(1 - x, 3).toDouble();
double _easeBack(double x) {
  const c = 1.45;
  return 1 +
      (c + 1) * math.pow(x - 1, 3).toDouble() +
      c * math.pow(x - 1, 2).toDouble();
}

_V _rotate(_V p, double yaw, double pitch) {
  final cy = math.cos(yaw), sy = math.sin(yaw);
  final cp = math.cos(pitch), sp = math.sin(pitch);
  final x = p.x * cy + p.z * sy;
  final z = -p.x * sy + p.z * cy;
  return _V(x, p.y * cp - z * sp, p.y * sp + z * cp);
}

_V _mean(List<_V> pts) {
  var x = 0.0, y = 0.0, z = 0.0;
  for (final p in pts) {
    x += p.x;
    y += p.y;
    z += p.z;
  }
  return _V(x / pts.length, y / pts.length, z / pts.length);
}

class Mark3D extends StatefulWidget {
  /// Show the orbiting channel tiles (the welcome screen).
  final bool channels;

  /// Turn once, a full revolution, after the pieces lock (the splash).
  final bool spin;

  const Mark3D({super.key, this.channels = true, this.spin = false});

  @override
  State<Mark3D> createState() => _Mark3DState();
}

class _Mark3DState extends State<Mark3D> with SingleTickerProviderStateMixin {
  late final Ticker _ticker;
  final _frame = ValueNotifier<int>(0);
  Duration _last = Duration.zero;
  double _t = 0, _px = 0, _py = 0, _tx = 0, _ty = 0;
  bool _still = false;
  Size _size = Size.zero;

  @override
  void initState() {
    super.initState();
    _ticker = createTicker(_tick);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _still = reducedMotion(context);
    if (_still) {
      if (_ticker.isActive) _ticker.stop();
      _frame.value++;
    } else if (!_ticker.isActive) {
      _last = Duration.zero;
      _ticker.start();
    }
  }

  void _tick(Duration now) {
    final dt = (now - _last).inMicroseconds / 1e6;
    _last = now;
    _t += dt > 0.05 ? 0.05 : dt; // a long pause must not jump the scene
    _px += (_tx - _px) * 0.08;
    _py += (_ty - _py) * 0.08;
    _frame.value++;
  }

  void _aim(Offset local) {
    if (_size.isEmpty) return;
    _tx = _clamp((local.dx - _size.width / 2) / (_size.width / 2 + 40), -1, 1);
    _ty = _clamp((local.dy - _size.height / 2) / (_size.height / 2 + 40), -1, 1);
  }

  void _release() {
    _tx = 0;
    _ty = 0;
  }

  @override
  void dispose() {
    _ticker.dispose();
    _frame.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      image: true,
      label: 'The VeloSales Ai mark with WhatsApp and Telegram orbiting it. '
          'Instagram is coming soon.',
      child: LayoutBuilder(
        builder: (context, box) {
          _size = box.biggest;
          return Listener(
            behavior: HitTestBehavior.opaque,
            onPointerDown: (e) => _aim(e.localPosition),
            onPointerMove: (e) => _aim(e.localPosition),
            onPointerUp: (_) => _release(),
            onPointerCancel: (_) => _release(),
            child: RepaintBoundary(
              child: CustomPaint(
                size: Size.infinite,
                painter: _ScenePainter(this),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _ScenePainter extends CustomPainter {
  final _Mark3DState s;
  _ScenePainter(this.s) : super(repaint: s._frame);

  static final TextPainter _soon = TextPainter(textDirection: TextDirection.ltr);

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width, h = size.height;
    if (w <= 0 || h <= 0) return;
    final still = s._still;
    final time = still ? 99.0 : s._t;
    final scale = math.min(w / 1320, h / 1120);
    final cx = w / 2, cy = h / 2;
    final settle = still ? 1.0 : _easeOut(_clamp(time / 1.1));
    final w_ = s.widget;
    final turnT = w_.spin ? _clamp((time - 1.1) / 1.3) : 0.0;
    final turn = Curves.easeInOutCubic.transform(turnT) * math.pi * 2;
    final yaw = still
        ? _stillYaw
        : (w_.spin ? -0.38 : math.sin(time * 0.55) * _sway) +
            turn +
            s._px * 0.45 +
            (1 - settle) * 1.4;
    final pitch = still
        ? _stillPitch
        : -0.1 + math.sin(time * 0.4) * 0.05 - s._py * 0.3;

    Offset project(_V p) {
      final k = _focal / (_focal + p.z);
      return Offset(cx + p.x * k * scale, cy + p.y * k * scale);
    }

    // Halo behind the object and a contact shadow beneath it.
    final haloR = 620 * scale;
    canvas.drawRect(
      Offset.zero & size,
      Paint()
        ..shader = ui.Gradient.radial(
          Offset(cx, cy),
          haloR,
          const [Color(0x6BBEB2FF), Color(0x248B5CF6), Color(0x008B5CF6)],
          const [0, 0.55, 1],
        ),
    );
    canvas.save();
    canvas.translate(cx, cy + 440 * scale);
    canvas.scale(1, 0.16);
    canvas.drawCircle(
      Offset.zero,
      300 * scale,
      Paint()
        ..shader = ui.Gradient.radial(
          Offset.zero,
          300 * scale,
          [
            const Color(0xFF0A0628).withValues(alpha: 0.5 * settle),
            const Color(0x000A0628),
          ],
        ),
    );
    canvas.restore();

    // The orbit plane: a tilted, rolled circle.
    final cr = math.cos(_orbitRoll), sr = math.sin(_orbitRoll);
    _V orbitPoint(double a, double radius) {
      final x0 = radius * math.cos(a);
      final sn = radius * math.sin(a);
      final y0 = -sn * math.sin(_orbitTilt);
      return _V(x0 * cr - y0 * sr, x0 * sr + y0 * cr, sn * math.cos(_orbitTilt));
    }

    final ringAlpha = still ? 1.0 : _clamp((time - 0.9) / 0.5);
    void drawRing(bool back) {
      if (ringAlpha == 0) return;
      final path = Path();
      for (var i = 0; i <= 48; i++) {
        final a = (back ? 0 : math.pi) + (i / 48) * math.pi;
        final p = project(orbitPoint(a, _orbitRadius));
        if (i == 0) {
          path.moveTo(p.dx, p.dy);
        } else {
          path.lineTo(p.dx, p.dy);
        }
      }
      canvas.drawPath(
        path,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = math.max(1, 3 * scale)
          ..isAntiAlias = true
          ..color = const Color(0xFFD6CFFF)
              .withValues(alpha: (back ? 0.2 : 0.42) * ringAlpha),
      );
    }

    drawRing(true);

    final items = <({double z, void Function() draw})>[];

    // ── the mark ──
    final gradA = project(_rotate(const _V(0, -348, -_depth / 2), yaw, pitch));
    final gradB = project(_rotate(const _V(0, 348, -_depth / 2), yaw, pitch));
    final sweep = still || time < 1 ? -1.0 : ((time - 1) % 7) / 1.2;

    for (var n = 0; n < _pieces.length; n++) {
      final piece = _pieces[n];
      final e = still ? 1.0 : _easeOut(_clamp((time - 0.05 - n * 0.06) / 0.95));
      final pts = [for (final v in piece.v) Offset(v[0] - 301, v[1] - 348)];
      final c = (pts[0] + pts[1] + pts[2]) / 3;
      final fly = (1 - e) * 3.4;
      final swirl = (1 - e) * 0.9;
      final ox = (piece.dx * math.cos(swirl) - piece.dy * math.sin(swirl)) * fly;
      final oy = (piece.dx * math.sin(swirl) + piece.dy * math.cos(swirl)) * fly;
      final spin = (1 - e) * piece.rot * math.pi / 30;
      final sc = 0.4 + 0.6 * e;

      _V place(Offset p, double z) {
        final lx = (p.dx - c.dx) * sc, ly = (p.dy - c.dy) * sc;
        final rx = lx * math.cos(spin) - ly * math.sin(spin);
        final ry = lx * math.sin(spin) + ly * math.cos(spin);
        return _rotate(_V(rx + c.dx + ox, ry + c.dy + oy, z * sc), yaw, pitch);
      }

      final front = [for (final p in pts) place(p, -_depth / 2)];
      final back = [for (final p in pts) place(p, _depth / 2)];
      final centre = _mean([...front, ...back]);
      final faces = <({List<_V> pts, bool front})>[
        (pts: front, front: true),
        (pts: back, front: false),
        for (var i = 0; i < 3; i++)
          (
            pts: [front[i], front[(i + 1) % 3], back[(i + 1) % 3], back[i]],
            front: false,
          ),
      ];

      items.add((
        z: centre.z + 40,
        draw: () {
          final alpha = _clamp(e * 3);
          final layered = alpha < 1;
          if (layered) {
            canvas.saveLayer(
              Offset.zero & size,
              Paint()..color = Colors.white.withValues(alpha: alpha),
            );
          }
          for (final f in faces) {
            var nrm = (f.pts[1] - f.pts[0]).cross(f.pts[2] - f.pts[0]).norm;
            final mid = _mean(f.pts);
            if (nrm.dot(mid - centre) < 0) nrm = -nrm;
            if (nrm.dot(mid - const _V(0, 0, -_focal)) >= 0) continue;
            final lit = _clamp(nrm.dot(_light));
            final path = Path()
              ..addPolygon([for (final p in f.pts) project(p)], true);
            if (f.front) {
              final shade = 0.72 + lit * 0.28;
              canvas.drawPath(
                path,
                Paint()
                  ..isAntiAlias = true
                  ..shader = ui.Gradient.linear(gradA, gradB, [
                    Color.lerp(const Color(0xFF352A7F), piece.ramp[0], shade)!,
                    Color.lerp(const Color(0xFF352A7F), piece.ramp[1], shade)!,
                    Color.lerp(const Color(0xFF352A7F), piece.ramp[2], shade)!,
                  ], const [0, 0.5, 1]),
              );
              if (sweep >= 0 && sweep <= 1) {
                final at = gradA.dx - 400 * scale + sweep * 800 * scale;
                canvas.save();
                canvas.clipPath(path);
                canvas.drawRect(
                  Offset.zero & size,
                  Paint()
                    ..shader = ui.Gradient.linear(
                      Offset(at - 90 * scale, cy - 200 * scale),
                      Offset(at + 90 * scale, cy + 200 * scale),
                      const [Color(0x00FFFFFF), Color(0xBFFFFFFF), Color(0x00FFFFFF)],
                      const [0, 0.5, 1],
                    ),
                );
                canvas.restore();
              }
              canvas.drawPath(
                path,
                Paint()
                  ..style = PaintingStyle.stroke
                  ..strokeJoin = StrokeJoin.round
                  ..strokeWidth = math.max(0.8, 2.2 * scale)
                  ..isAntiAlias = true
                  ..color = const Color(0xB3FFFFFF),
              );
            } else {
              final side = Color.lerp(piece.sideDark, piece.sideLit, lit)!;
              canvas.drawPath(
                path,
                Paint()
                  ..isAntiAlias = true
                  ..color = side,
              );
              canvas.drawPath(
                path,
                Paint()
                  ..style = PaintingStyle.stroke
                  ..strokeWidth = 0.6
                  ..color = side,
              );
            }
          }
          if (layered) canvas.restore();
        },
      ));
    }

    // ── the channels ──
    final base = still ? _stillOrbit : (time / _orbitPeriod) * math.pi * 2;
    for (var i = 0; w_.channels && i < _channels.length; i++) {
      final e = still ? 1.0 : _easeBack(_clamp((time - 0.8 - i * 0.12) / 0.7));
      if (e <= 0) continue;
      final a = base + (i * math.pi * 2) / 3;
      var p = orbitPoint(a, _orbitRadius * e);
      if (!still) {
        p = _V(p.x, p.y + math.sin(time * 0.9 + i * 2.1) * 14, p.z);
      }
      final at = project(p);
      final k = _focal / (_focal + p.z);
      final tileSize = _tile * scale * math.min(k, _tileMaxScale) * _clamp(e, 0, 1.15);
      items.add((
        z: p.z,
        draw: () => _drawTile(
              canvas,
              size,
              _channels[i],
              at,
              tileSize,
              math.cos(a) * 0.6,
              _clamp((p.z / _orbitRadius) * 0.36, 0, 0.36),
              _clamp(e * 2),
            ),
      ));
    }

    items.sort((a, b) => b.z.compareTo(a.z));
    for (final it in items) {
      it.draw();
    }
    drawRing(false);
  }

  void _drawTile(Canvas canvas, Size canvasSize, SalesChannel ch, Offset at,
      double size, double yaw, double dim, double alpha) {
    if (size <= 0) return;
    final half = size / 2;
    final radius = Radius.circular(size * 0.3);
    final step = size * 0.024;
    final dirX = -math.sin(yaw);
    const dirY = 0.72;
    final layered = alpha < 1;
    if (layered) {
      canvas.saveLayer(
        Offset.zero & canvasSize,
        Paint()..color = Colors.white.withValues(alpha: alpha),
      );
    }
    canvas.save();
    canvas.translate(at.dx, at.dy);
    canvas.save();
    canvas.transform(Float64List.fromList([
      math.cos(yaw), 0.18 * math.sin(yaw), 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]));
    // The tile's thickness: stacked copies of its outline, walked backward.
    final sidePaint = Paint()
      ..isAntiAlias = true
      ..color = _tileSide(ch);
    for (var i = 7; i >= 1; i--) {
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(-half + dirX * step * i, -half + dirY * step * i, size, size),
          radius,
        ),
        sidePaint,
      );
    }
    final rect = Rect.fromLTWH(-half, -half, size, size);
    final rr = RRect.fromRectAndRadius(rect, radius);
    final colors = ch.gradient;
    canvas.drawRRect(
      rr,
      Paint()
        ..isAntiAlias = true
        ..shader = ui.Gradient.linear(
          rect.topLeft,
          rect.bottomRight,
          colors,
          colors.length == 3 ? const [0, 0.55, 1] : const [0, 1],
        ),
    );
    // Top-lit gloss, then a bright rim, so it reads as a solid object.
    canvas.save();
    canvas.clipRRect(rr);
    canvas.drawRect(
      rect,
      Paint()
        ..shader = ui.Gradient.linear(
          Offset(0, -half),
          Offset(0, half * 0.1),
          const [Color(0x4DFFFFFF), Color(0x00FFFFFF)],
        ),
    );
    canvas.restore();
    canvas.drawRRect(
      rr,
      Paint()
        ..style = PaintingStyle.stroke
        ..isAntiAlias = true
        ..strokeWidth = math.max(1, size * 0.012)
        ..color = const Color(0x57FFFFFF),
    );
    final glyph = size * 0.6;
    canvas.save();
    canvas.translate(-glyph / 2, -glyph / 2);
    ChannelGlyphPainter(ch).paint(canvas, Size(glyph, glyph));
    canvas.restore();
    // Further away = a little darker, which is most of what sells the depth.
    if (dim > 0) {
      canvas.drawRRect(
        rr,
        Paint()..color = const Color(0xFF140E46).withValues(alpha: dim),
      );
    }
    canvas.restore();

    if (ch == SalesChannel.instagram) {
      final fs = math.max(11.0, size * 0.19);
      _soon.text = TextSpan(
        text: 'soon',
        style: TextStyle(
          fontFamily: 'Manrope',
          fontSize: fs,
          fontWeight: FontWeight.w700,
          color: const Color(0xFF2A1E6B),
        ),
      );
      _soon.layout();
      final tw = _soon.width + fs * 1.3;
      final th = fs * 1.7;
      final ty = half + step * 7 + fs * 0.45;
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(-tw / 2, ty, tw, th),
          Radius.circular(th / 2),
        ),
        Paint()
          ..isAntiAlias = true
          ..color = const Color(0xFFFBBF24),
      );
      _soon.paint(canvas, Offset(-_soon.width / 2, ty + (th - _soon.height) / 2));
    }
    canvas.restore();
    if (layered) canvas.restore();
  }

  @override
  bool shouldRepaint(_ScenePainter old) => false;
}
