// ── lib/airbot/airbot_controller.dart ────────────────────────────
// WHAT: a single app-wide voice for AirBot. Screens hold the GUIDE widget,
// but any code can reach this controller to make it play/speak/guide. It is
// a plain ChangeNotifier (the app already avoids state-management packages)
// and auto-attaches to the top-most mounted guide. No API keys, no network,
// no backend — pure presentation (§33).
//
// API (mirrors the spec):
//   AirBotController.instance.play(state)
//   AirBotController.instance.speak(message)
//   AirBotController.instance.guideTo(target)
//   AirBotController.instance.showMessage / hideMessage
//   AirBotController.instance.stop() / reset()
//
// A TTS provider can be connected later by giving this controller a
// `voice` callback returning a Future that completes when audio stops —
// speak() already waits on it before returning air-bot to idle (§31).
library;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'airbot_types.dart';

class AirBotController extends ChangeNotifier {
  AirBotController._();
  static final AirBotController instance = AirBotController._();

  // ── mutable state the guide widget listens to ──
  AirBotState _state = AirBotState.idle;
  AirBotState get state => _state;

  String? _message;
  String? get message => _message;

  /// Non-null when guideTo() is active: the widget highlights this target
  /// container (boxed + dimmed backdrop) instead of painting fake coords.
  AirBotTarget? _activeTarget;
  AirBotTarget? get activeTarget => _activeTarget;

  final Set<String> _knownTargets = {};

  /// The widget registers targets it knows how to measure.
  void registerTarget(String id) => _knownTargets.add(id);

  bool _visible = true;
  bool get visible => _visible;

  // ── voice hook (future TTS; §31 keeps it provider-independent) ──
  Future<void> Function(String text)? voice;

  /// The guide registers itself here so controller calls always reach a
  /// mounted character even across screens. Only the top-most guide wins.
  Listenable? _driver;
  set driver(Listenable? d) {
    if (identical(_driver, d)) return;
    _driver = d;
    notifyListeners();
  }

  // ── API ──
  void play(AirBotState s) {
    if (_state != s) _state = s;
    _notify();
  }

  /// speak(): bubble up, talking animation, optional TTS, auto-return idle.
  Future<void> speak(String message) async {
    _message = message;
    _state = AirBotState.talking;
    _visible = true;
    _notify();
    if (voice != null) {
      try {
        await voice!(message); // audio drives the talking duration
      } catch (_) {
        // audio failed → keep talking briefly, then idle (§34)
        await Future.delayed(const Duration(milliseconds: 900));
      }
    } else {
      // no TTS yet: hold the bubble long enough to read it naturally.
      await Future.delayed(
          Duration(milliseconds: (message.length * 45).clamp(1400, 5200)));
    }
    if (_state == AirBotState.talking) play(AirBotState.idle);
  }

  /// point at a target, highlight it, then wait for the caller to complete.
  /// Uses real layout measurement via the registered guide (§19, §24).
  void guideTo(AirBotTarget target) {
    _activeTarget = target;
    registerTarget(target.id);
    _message = target.message ??
        (target.id.contains('whatsapp')
            ? 'Tap the WhatsApp button to connect it.'
            : 'Tap the highlighted area to continue.');
    _state = AirBotState.pointRight;
    _visible = true;
    _notify();
  }

  void completeGuide() {
    _activeTarget = null;
    _state = AirBotState.success;
    _notify();
  }

  void clearGuide() {
    _activeTarget = null;
    _message = null;
    _notify();
  }

  void showMessage(String m) {
    _message = m;
    _visible = true;
    _notify();
  }

  void hideMessage() {
    _message = null;
    _notify();
  }

  void stop() {
    _state = AirBotState.idle;
    _activeTarget = null;
    _notify();
  }

  void reset() {
    _state = AirBotState.idle;
    _message = null;
    _activeTarget = null;
    _visible = true;
    _notify();
  }

  void setVisible(bool v) {
    _visible = v;
    _notify();
  }

  void _notify() => notifyListeners();
}