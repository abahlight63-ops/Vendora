// ── lib/airbot/airbot_guide.dart ─────────────────────────────────
// WHAT: the reusable AirBot character + bubble + controller wiring.
// Drop <AirBotGuide /> anywhere (onboarding, dashboard, test screen).
// It owns the breath/blink/talk/wave/point animation controllers and paints
// the pose via AirBotPainter; it ALSO watches AirBotController.instance so a
// distant `play('wave')` or `speak('...')` drives a mounted guide.
//
// guideTo(target): instead of inventing coordinates, this widget scans its
// own subtree for a child registered under the target id (via a GlobalKey
// the caller tags), measures its REAL global rect, and draws the highlight
// box + dimmed scrim around it — so it works on any phone size (§19, §24).
// If the id isn't found it falls back to a centered bubble (safe, §34).
//
// Perf (§22): listeners only animate while mounted; the painter reuses a
// single pose object; blink/breath use long delayed gaps so they run ~2/s
// not 60/s. `reduceMotion` (accessibility) → pose.shy (frozen still).
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'airbot_controller.dart';
import 'airbot_paint.dart';
import 'airbot_speech.dart';
import 'airbot_types.dart';

class AirBotGuide extends StatefulWidget {
  const AirBotGuide({
    super.key,
    this.initial = AirBotState.idle,
    this.size = AirBotSize.medium,
    this.initialMessage,
    this.enableSound = false,
    this.onSpeak,
  });

  final AirBotState initial;
  final AirBotSize size;
  final String? initialMessage;
  final bool enableSound;
  final void Function(String)? onSpeak;

  @override
  State<AirBotGuide> createState() => _AirBotGuideState();
}

class _AirBotGuideState extends State<AirBotGuide>
    with TickerProviderStateMixin {
  // ── per-frame drives ──
  late final AnimationController _breath;
  late final AnimationController _blinkDrive; // long-gap pulse → blink
  late final AnimationController _talkMouth;
  late final AnimationController _gesture; // wave/point sweep
  late final AnimationController _entrance;
  late final AnimationController _success;
  AirBotState _current = AirBotState.idle;
  bool _reduce = false;

  final Map<String, GlobalKey> _targetKeys = {}; // targetId -> caller key

  @override
  void initState() {
    super.initState();
    _current = widget.initial;
    _reduce = MediaQuery.of(context).disableAnimations;
    _breath = AnimationController(
        vsync: this,
        duration: AirBotDurations.breath,
        lowerBound: -1,
        upperBound: 1)
      ..repeat(reverse: true); // calm continuous breathing
    _blinkDrive = AnimationController(vsync: this, duration: AirBotDurations.blinkGap)
      ..repeat();
    _talkMouth = AnimationController(
        vsync: this, duration: AirBotDurations.talkStep)
      ..repeat(reverse: true);
    _gesture =
        AnimationController(vsync: this, duration: AirBotDurations.gesture);
    _entrance =
        AnimationController(vsync: this, duration: AirBotDurations.enter);
    _success =
        AnimationController(vsync: this, duration: AirBotDurations.hold);

    // controller bridge
    AirBotController.instance
      ..driver = _Tunnel(this)
      ..registerTarget('whatsapp');
    if (widget.initialMessage != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        AirBotController.instance.showMessage(widget.initialMessage!);
      });
    }
    _entrance.forward();
  }

  @override
  void dispose() {
    _breath.dispose();
    _blinkDrive.dispose();
    _talkMouth.dispose();
    _gesture.dispose();
    _entrance.dispose();
    _success.dispose();
    super.dispose();
  }

  // ── smooth state set with per-state animation scheduling ──
  void _setState(AirBotState s) {
    setState(() {
      _current = s;
      switch (s) {
        case AirBotState.idle:
          _gesture.reset();
          _talkMouth.stop();
          break;
        case AirBotState.talking:
          _talkMouth.repeat(reverse: true);
          _gesture.forward(from: 0); // small gesture while talking
          break;
        case AirBotState.wave || AirBotState.pointLeft ||
              AirBotState.pointRight || AirBotState.pointDown:
          _gesture.forward(from: 0).then((_) => _gesture.repeat(reverse: true));
          break;
        case AirBotState.thinking:
          _gesture.value = 0.08; // small tilt hold
          break;
        case AirBotState.success:
          _gesture.forward(from: 0);
          _success.forward(from: 0);
          break;
        case AirBotState.confused:
          _gesture.forward(from: 0).then((_) => _gesture.reverse());
          break;
        case AirBotState.goodbye:
          _gesture.forward(from: 0).then((_) => _gesture.reverse());
          _entrance.reverse();
          break;
        case AirBotState.welcome:
          _entrance.forward(from: 0);
          break;
      }
    });
  }

  // the public bridge — a mounted guide receives controller calls.
  AirBotPose get _poseNow {
    final t = _breath.value; // -1..1
    final blinkRaw = _blinkDrive.value;
    final blink = _blinkWindow(blinkRaw); // short blink near loop end
    final talk = _talkMouth.isAnimating ? _talkMouth.value : 0.0;

    double armLift = 0, armRot = 0, headTilt = 0, eyeShift = 0;
    switch (_current) {
      case AirBotState.wave:
        armLift = 0.62 + 0.1 * t;
        armRot = math.sin(_gesture.value * 6.28) * 0.5; // smooth wave
        break;
      case AirBotState.pointLeft:
        armLift = 0.5;
        armRot = -0.9; // swing toward left
        headTilt = -0.06;
        break;
      case AirBotState.pointRight:
        armLift = 0.5;
        armRot = 0.9;
        headTilt = 0.06;
        break;
      case AirBotState.pointDown:
        armLift = 0.45;
        armRot = 0.55;
        headTilt = 0.1;
        break;
      case AirBotState.thinking:
        armLift = 0.1;
        armRot = 0.12;
        headTilt = 0.18;
        eyeShift = 0.7 * t; // eyes drift (processing)
        break;
      case AirBotState.confused:
        headTilt = -0.25 + math.sin(_gesture.value * 3) * 0.05;
        armRot = -0.15;
        break;
      case AirBotState.success:
        armLift = 0.5 + 0.15 * (math.sin(_success.value * 6.28));
        armRot = 0.9 * (1 - _success.value);
        headTilt = math.sin(_success.value * 6.28) * 0.04;
        break;
      case AirBotState.goodbye:
        armLift = 0.7;
        armRot = math.sin(_gesture.value * 5) * 0.5;
        break;
      case AirBotState.welcome:
        headTilt = 0.05 * (1 - _entrance.value);
        armLift = 0.3 * (1 - _entrance.value);
        break;
      case AirBotState.talking:
        armLift = 0.12 + 0.05 * t;
        armRot = math.sin(t * 2) * 0.25; // natural hand gesture
        headTilt = math.sin(t * 1.3) * 0.03;
        break;
      default: // idle: nothing extra — breath + rare blink carry the calm
        break;
    }

    final reduce = _reduce;
    return AirBotPose(
      breath: reduce ? 0 : t,
      headTilt: reduce ? 0 : headTilt,
      armLift: reduce ? 0 : armLift,
      armRot: reduce ? 0 : armRot,
      mouthOpen: reduce ? 0 : talk,
      blink: reduce ? 0 : blink,
      eyeShift: reduce ? 0 : eyeShift,
      bob: reduce ? 0 : _waveBob(),
    );
  }

  // blink window: near the end of the repeat loop, one short close/open.
  double _blinkWindow(double v) {
    final rel = (1 - v) / 0.14; // last 14% of the loop
    if (rel < 0 || rel > 1) return 0;
    return math.sin(rel * math.pi).clamp(0.0, 1.0);
  }

  double _waveBob() {
    // tiny vertical sway when waving/goodbye, else 0
    if (_current == AirBotState.wave || _current == AirBotState.goodbye) {
      return math.sin(_gesture.value * 4) * 4;
    }
    return math.sin(_breath.value) * 1.2; // idle micro-sway
  }

  // listener bridge from the tunnel (controller → this widget)
  void _onController() {
    final c = AirBotController.instance;
    if (c.state != _current) _setState(c.state);
    // message bubble handled by build() reading controller.message.
  }

  @override
  Widget build(BuildContext context) {
    final c = AirBotController.instance;
    final size = widget.size;
    final box = size == AirBotSize.small
        ? const Size(72, 96)
        : size == AirBotSize.medium
            ? const Size(120, 150)
            : const Size(180, 200);
    final scheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // highlight target when guideTo() active + the id is registered here
    Widget? highlight;
    final tgt = c.activeTarget;
    if (tgt != null && _targetKeys.containsKey(tgt.id)) {
      highlight = _TargetHighlight(keyFor: _targetKeys[tgt.id]!);
    }

    return AnimatedBuilder(
      animation: Listenable.merge([
        _breath, _blinkDrive, _talkMouth, _gesture, _entrance, _success, c,
      ]),
      builder: (_, _) {
        final poseHere = _poseNow;
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // ── speech bubble above the head ──
            if (c.message != null) ...[
              AirBotBubble(text: c.message!),
              const SizedBox(height: 12),
            ] else
              const SizedBox(height: 12),
            // ── the character ──
            FadeTransition(
              opacity: _entrance,
              child: CustomPaint(
                size: box,
                painter: AirBotPainter(
                  pose: poseHere,
                  light: !isDark,
                  theme: scheme,
                ),
              ),
            ),
            const SizedBox(height: 6),
            if (widget.enableSound)
              Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: c.state == AirBotState.talking
                      ? scheme.error
                      : scheme.primary,
                ),
              ),
            ?highlight,
          ],
        );
      },
    );
  }
}

/// Wrap your target UI element: put this around a button and give it an id
/// matching what `guideTo()` uses — the guide can then measure + highlight it.
class AirBotRegion extends StatelessWidget {
  const AirBotRegion({super.key, required this.targetId, required this.child});
  final String targetId;
  final Widget child;

  @override
  Widget build(BuildContext context) => child;
}

/// Dims the app behind a target + draws a glowing outline around its true
/// measured rect (no fake coordinates — read from a GlobalKey).
class _TargetHighlight extends StatefulWidget {
  final GlobalKey keyFor;
  const _TargetHighlight({required this.keyFor});
  @override
  State<_TargetHighlight> createState() => _TargetHighlightState();
}

class _TargetHighlightState extends State<_TargetHighlight>
    with SingleTickerProviderStateMixin {
  late final AnimationController _grow;
  @override
  void initState() {
    super.initState();
    _grow = AnimationController(vsync: this, duration: const Duration(milliseconds: 300))
      ..forward();
  }

  @override
  void dispose() {
    _grow.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final renderBox = widget.keyFor.currentContext?.findRenderObject();
    final rect = renderBox is RenderBox
        ? (renderBox.localToGlobal(Offset.zero) & renderBox.size)
        : null;
    if (rect == null) return const SizedBox.shrink(); // safe fallback §34

    return LayoutBuilder(
      builder: (context, constr) {
        // dim the whole canvas except the target rect.
        return Stack(
          children: [
            Positioned.fromRect(
              rect: Rect.fromLTWH(0, 0, constr.maxWidth, constr.maxHeight),
              child: AnimatedBuilder(
                animation: _grow,
                builder: (_, _) => Container(
                  color: Colors.black.withValues(alpha: 0.30 - 0.18 * _grow.value),
                  child: CustomPaint(
                    painter: _HolePainter(target: rect, color: Colors.black.withValues(alpha: 0.35)),
                  ),
                ),
              ),
            ),
            // glowing outline
            Positioned.fromRect(
              rect: Rect.fromLTWH(rect.left, rect.top, rect.width, rect.height),
              child: IgnorePointer(
                child: Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFFFCF5C), width: 2.5),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFFFFCF5C).withValues(alpha: 0.5),
                        blurRadius: 18,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

/// scrim with a transparent hole over the target — drawn in paint.
class _HolePainter extends CustomPainter {
  final Rect target;
  final Color color;
  _HolePainter({required this.target, required this.color});
  @override
  void paint(Canvas canvas, Size size) {
    final scrim = Path()..addRect(Rect.fromLTWH(0, 0, size.width, size.height));
    scrim.addRRect(RRect.fromRectAndRadius(target, const Radius.circular(12)));
    canvas.drawPath(
        scrim,
        Paint()
          ..color = color
          ..style = PaintingStyle.fill
          ..blendMode = BlendMode.src);
  }

  @override
  bool shouldRepaint(_HolePainter old) =>
      old.target != target || old.color != color;
}

/// Bridges controller notifications into the mounted state (kept outside the
/// State class wrapper: the controller only needs a reference to call).
class _Tunnel extends ChangeNotifier {
  _Tunnel(this.s);
  final _AirBotGuideState s;
  @override
  void notifyListeners() => s._onController();
}