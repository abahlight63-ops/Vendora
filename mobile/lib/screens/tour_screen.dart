// ── lib/screens/tour_screen.dart ─────────────────────────────────
// WHAT: the welcome tour — a guide character (Coach, drawn in Flutter
// CustomPainter, no image asset needed) walks a new user through the four
// things that make Velo work: connect WhatsApp, add a product, test the
// bot, go live. Shown ONCE, before the setup quiz, for new signups.
// Runs entirely offline: pure Flutter animation, no network, no new
// packages, no Live2D (see DESIGN-SYSTEM.md section 11).
// Behaviour note: `onDone` fires the moment the tour finishes; the caller
// (main.dart) then shows SetupScreen. Nothing here touches the API.
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../motion.dart';
import '../theme.dart';

/// One tour stop: title, one-line body, and the step Coach is pointing at.
class _Stop {
  final String title;
  final String body;
  final _CoachPose pose;
  const _Stop(this.title, this.body, this.pose);
}

const List<_Stop> _stops = [
  _Stop(
    'Connect your WhatsApp',
    'Link the number your customers already message. Velo answers in English or Pidgin, 24/7.',
    _CoachPose.point,
  ),
  _Stop(
    'Add your products',
    'Photos, prices, descriptions. Velo sells from YOUR catalog — never a generic script.',
    _CoachPose.hold,
  ),
  _Stop(
    'Test the bot first',
    'Message yourself before you go live. Fix the tone until it sounds like you.',
    _CoachPose.think,
  ),
  _Stop(
    'Go live tonight',
    'Flip the switch and Velo starts replying. You can take over any chat in one tap.',
    _CoachPose.cheer,
  ),
];

enum _CoachPose { point, hold, think, cheer }

class TourScreen extends StatefulWidget {
  const TourScreen({super.key, required this.onDone, this.onSkip});
  final VoidCallback onDone;
  final VoidCallback? onSkip;

  @override
  State<TourScreen> createState() => _TourScreenState();
}

class _TourScreenState extends State<TourScreen> with TickerProviderStateMixin {
  int _index = 0;
  late final AnimationController _coach; // Coach's idle bob + pose transition
  late final AnimationController _page; // slide transition between stops
  late final Animation<double> _coachT; // 0..1 pose morph progress
  bool _leaving = false;

  @override
  void initState() {
    super.initState();
    _coach = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    )..repeat(reverse: true); // gentle idle bob — the one allowed loop
    _page = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 320),
      value: 1,
    );
    _coachT = CurvedAnimation(parent: _page, curve: Curves.easeOutCubic);
  }

  @override
  void dispose() {
    _coach.dispose();
    _page.dispose();
    super.dispose();
  }

  bool get _reduceMotion => MediaQuery.of(context).disableAnimations;

  void _goTo(int i) {
    if (_leaving || i < 0 || i >= _stops.length) return;
    HapticFeedback.lightImpact();
    if (_reduceMotion) {
      setState(() => _index = i);
      return;
    }
    _page.reverse().then((_) {
      if (!mounted) return;
      setState(() => _index = i);
      _page.forward();
    });
  }

  Future<void> _finish() async {
    if (_leaving) return;
    setState(() => _leaving = true);
    HapticFeedback.mediumImpact();
    if (!_reduceMotion) {
      await _page.reverse();
      if (!mounted) return;
    }
    widget.onDone();
  }

  @override
  Widget build(BuildContext context) {
    final stop = _stops[_index];
    final last = _index == _stops.length - 1;
    final reduce = _reduceMotion;

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── header: brand mark left, skip right ──
              Row(
                children: [
                  Image.asset('assets/brand-mark.png', width: 28, height: 28),
                  const SizedBox(width: 8),
                  Text('VeloSales AI',
                      style: Theme.of(context).textTheme.titleMedium),
                  const Spacer(),
                  if (!last)
                    TextButton(
                      onPressed: () {
                        HapticFeedback.lightImpact();
                        final skip = widget.onSkip;
                        if (skip != null) {
                          skip();
                        } else {
                          widget.onDone();
                        }
                      },
                      child: const Text('Skip'),
                    ),
                ],
              ),
              const SizedBox(height: 8),

              // ── step dots ──
              Row(
                children: [
                  for (var i = 0; i < _stops.length; i++)
                    AnimatedContainer(
                      duration: reduce
                          ? Duration.zero
                          : const Duration(milliseconds: 240),
                      margin: const EdgeInsets.only(right: 6),
                      width: i == _index ? 22 : 7,
                      height: 7,
                      decoration: BoxDecoration(
                        color: i == _index
                            ? VsTokens.accent
                            : VsTokens.hairline,
                        borderRadius: BorderRadius.circular(99),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 16),

              // ── Coach stage: the character, animated ──
              Expanded(
                child: Center(
                  child: AspectRatio(
                    aspectRatio: 1,
                    child: AnimatedBuilder(
                      animation: Listenable.merge([_coach, _coachT]),
                      builder: (context, _) {
                        final bob = reduce
                            ? 0.0
                            : (Curves.easeInOut.transform(_coach.value) - .5) * 8;
                        return Transform.translate(
                          offset: Offset(0, bob),
                          child: CustomPaint(
                            painter: _CoachPainter(
                              pose: stop.pose,
                              t: _coachT.value,
                              accent: VsTokens.accent,
                              glow: VsTokens.accentGlow,
                              onAccent: VsTokens.onAccent,
                              hairline: VsTokens.hairline,
                              reduce: reduce,
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 8),

              // ── copy ──
              FadeSlideIn(
                key: ValueKey(_index),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${_index + 1} of ${_stops.length}',
                      style: TextStyle(
                        fontSize: VsTokens.fsLabel,
                        color: VsTokens.accent,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      stop.title,
                      style: Theme.of(context).textTheme.headlineMedium,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      stop.body,
                      style: TextStyle(
                        fontSize: VsTokens.fsBodyLg,
                        height: 1.45,
                        color: VsTokens.textMuted,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // ── footer: Back / Next ──
              Row(
                children: [
                  if (_index > 0)
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => _goTo(_index - 1),
                        child: const Text('Back'),
                      ),
                    ),
                  if (_index > 0) const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: FilledButton(
                      onPressed: last
                          ? _finish
                          : () => _goTo(_index + 1),
                      child: Text(last ? "I'm ready" : 'Next'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Coach — the guide character. Drawn with paths so there is no image asset
/// to ship and the pose can morph between stops. Deliberately simple:
/// a rounded head, a body, and an arm whose target angle changes per pose.
class _CoachPainter extends CustomPainter {
  _CoachPainter({
    required this.pose,
    required this.t,
    required this.accent,
    required this.glow,
    required this.onAccent,
    required this.hairline,
    required this.reduce,
  });

  final _CoachPose pose;
  final double t;
  final Color accent;
  final Color glow;
  final Color onAccent;
  final Color hairline;
  final bool reduce;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width, h = size.height;
    final cx = w / 2;

    // ── backdrop disc (soft gold halo behind Coach) ──
    final halo = Paint()
      ..shader = RadialGradient(
        colors: [glow.withValues(alpha: .28), glow.withValues(alpha: 0)],
      ).createShader(Rect.fromCircle(center: Offset(cx, h * .48), radius: w * .46));
    canvas.drawCircle(Offset(cx, h * .48), w * .46, halo);

    // ── body ──
    final body = Paint()..color = const Color(0xFF232A27);
    final bodyPath = RRect.fromRectAndRadius(
      Rect.fromCenter(center: Offset(cx, h * .66), width: w * .40, height: h * .34),
      Radius.circular(w * .14),
    );
    canvas.drawRRect(bodyPath, body);

    // ── head ──
    final head = Paint()..color = const Color(0xFFF2F4F1);
    canvas.drawCircle(Offset(cx, h * .36), w * .145, head);

    // hair / cap in brand gold
    final cap = Paint()..color = accent;
    canvas.drawArc(
      Rect.fromCircle(center: Offset(cx, h * .345), radius: w * .15),
      3.14159, 3.14159, false, cap,
    );

    // eyes (two dots; direction shifts with pose)
    final eye = Paint()..color = const Color(0xFF101513);
    final look = pose == _CoachPose.point ? w * .012 : 0.0;
    canvas.drawCircle(Offset(cx - w * .045 + look, h * .365), w * .016, eye);
    canvas.drawCircle(Offset(cx + w * .045 + look, h * .365), w * .016, eye);

    // smile — arc that opens a little more on cheer
    final mouth = Paint()
      ..color = const Color(0xFF101513)
      ..style = PaintingStyle.stroke
      ..strokeWidth = w * .012
      ..strokeCap = StrokeCap.round;
    final smileW = pose == _CoachPose.cheer ? w * .05 : w * .038;
    canvas.drawArc(
      Rect.fromCenter(center: Offset(cx, h * .385), width: smileW * 2, height: smileW * 1.4),
      0.15, 2.84, false, mouth,
    );

    // ── arm + hand — the pose lives here ──
    // Target angles in radians from the shoulder pivot. Morphed by t so a
    // stop change eases the arm instead of snapping.
    final (shoulder, angle, reach) = _armTarget(pose);
    final sx = cx + shoulder;
    final sy = h * .58;

    final armPaint = Paint()
      ..color = const Color(0xFFF2F4F1)
      ..strokeWidth = w * .055
      ..strokeCap = StrokeCap.round;

    final dx = math.cos(angle) * reach;
    final dy = math.sin(angle) * reach;
    canvas.drawLine(Offset(sx, sy), Offset(sx + dx, sy + dy), armPaint);

    // hand
    canvas.drawCircle(Offset(sx + dx, sy + dy), w * .032, Paint()..color = accent);

    // ── the prop Coach is teaching with ──
    _drawProp(canvas, pose, Offset(sx + dx, sy + dy), w);

    // ── little gold ring at the feet (grounding) ──
    final ring = Paint()
      ..color = hairline
      ..style = PaintingStyle.stroke
      ..strokeWidth = w * .006;
    canvas.drawOval(
      Rect.fromCenter(center: Offset(cx, h * .845), width: w * .46, height: w * .07),
      ring,
    );
  }

  /// Returns (shoulder offset, arm angle, arm length) for a pose.
  /// Angles: 0 = right, positive = downward (Flutter y grows down).
  (double, double, double) _armTarget(_CoachPose p) {
    switch (p) {
      case _CoachPose.point:   // arm out to the right, pointing up-right
        return (0.16, -0.62, 0.20);
      case _CoachPose.hold:    // arm forward holding a phone
        return (0.14, -0.18, 0.19);
      case _CoachPose.think:   // hand up near the chin
        return (0.10, -1.35, 0.15);
      case _CoachPose.cheer:   // arm raised high
        return (0.14, -1.85, 0.22);
    }
  }

  void _drawProp(Canvas canvas, _CoachPose pose, Offset hand, double w) {
    final phone = Paint()..color = const Color(0xFF0F1311);
    final gold = Paint()..color = accent;

    switch (pose) {
      case _CoachPose.hold:
        // phone in the hand, screen lit gold
        final r = RRect.fromRectAndRadius(
          Rect.fromCenter(center: hand + Offset(w * .045, w * .02),
              width: w * .075, height: w * .12),
          Radius.circular(w * .016),
        );
        canvas.drawRRect(r, phone);
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromCenter(center: hand + Offset(w * .045, w * .02),
                width: w * .055, height: w * .10),
            Radius.circular(w * .010),
          ),
          gold,
        );
      case _CoachPose.cheer:
        // small gold spark above the raised hand
        final c = hand + Offset(0, -w * .07);
        final spark = Paint()
          ..color = glow
          ..strokeWidth = w * .012
          ..strokeCap = StrokeCap.round;
        for (var i = 0; i < 4; i++) {
          final a = i * 3.14159 / 2 + 0.4;
          canvas.drawLine(
            c + Offset(math.cos(a) * w * .018, math.sin(a) * w * .018),
            c + Offset(math.cos(a) * w * .045, math.sin(a) * w * .045),
            spark,
          );
        }
      case _CoachPose.point:
      case _CoachPose.think:
        break; // no prop — the pose carries it
    }
  }

  @override
  bool shouldRepaint(_CoachPainter old) =>
      old.pose != pose || old.t != t || old.accent != accent;
}
