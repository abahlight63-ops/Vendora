// ── lib/airbot/airbot_types.dart ─────────────────────────────────
// WHAT: the two public vocabularies of the AirBot system — the states a
// character can be in, and the sizes it can render at. Everything else
// (painting, animation, bubbles, controller) imports these so the types
// stay the single source of truth for the public API.
// CONVENTION: plain Dart enums match the web/Tour style — no packages.
library;

/// Every behaviour AirBot can perform. The controller's `play(state)`
/// accepts these; the painter + animation layer switch on them.
enum AirBotState {
  idle, // calm baseline: slow breath, rare blink (never frozen, never busy)
  talking, // mouth movement + subtle head bob + small hand gesture
  wave, // raise one hand, wave 2-3 times, smooth return
  pointLeft, // arm forward pointing screen-left (onboarding "tap there")
  pointRight, // arm forward pointing screen-right
  pointDown, // arm down-forward (mobile "scroll down / tap below")
  thinking, // head tilt + slow eye shift, relaxed posture
  success, // small fist-pump + warm flash (restrained, zero confetti)
  confused, // head tilt + question expression (then a helpful message)
  goodbye, // friendly wave + scale-down exit
  welcome, // appear-naturally entrance (fade + rise, no pop)
}

/// Configurable sizing — `small` for inline/chips, `medium` default for
/// onboarding, `large` for hero moments. Never absolute px in the widget:
/// sizes scale from the screen width so phones differ and nothing breaks.
enum AirBotSize { small, medium, large }

/// One subscription/target pair for guideTo().
class AirBotTarget {
  final String id; // stable id (e.g. 'connect-whatsapp') — NOT a coordinate
  final String? message;
  AirBotTarget(this.id, {this.message});
}

/// Timing vocabulary (milliseconds) — single place to tune the feel.
/// Targets the spec's guidance: enter 400-700, gestures 300-600,
/// majors 600-1200, idle slow+subtle.
class AirBotDurations {
  AirBotDurations._();
  static const enter = Duration(milliseconds: 550);
  static const gesture = Duration(milliseconds: 420);
  static const major = Duration(milliseconds: 850);
  static const blink = Duration(milliseconds: 90); // per blink-close
  static const blinkGap = Duration(milliseconds: 2700); // between blinks
  static const breath = Duration(milliseconds: 3200); // one breath cycle
  static const talkStep = Duration(milliseconds: 130); // mouth floor per step
  static const hold = Duration(milliseconds: 900); // success/goodbye hold
  static const hide = Duration(milliseconds: 450); // goodbye fade-out
}