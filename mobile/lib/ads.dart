// ── lib/ads.dart ───────────────────────────────────────────────────
// WHAT: the phone's half of the video-ad system (web parity with
// frontend/src/lib/ads.js — same slots soul, native body). NATIVE PLAYS
// SPONSOR MP4s ONLY (direct files!): network VAST/.js tags need the web IMA
// player, so on phones those layers simply don't exist — the house promo +
// paying sponsor mp4s play fullscreen 9:16 here, which is also the best
// money (zero rev-share, zero approval!). 30s full view, skip at 25s,
// 10/day/section with 5-min gaps — same timetable as web.
// Per-view network tags can't run natively (no script engine!) — that income
// is web-only. Ads must NEVER break the app: everything is try/caught, Pro
// or unconfigured backends silently show nothing.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:video_player/video_player.dart';

import 'api.dart';

const _perDay = 10; // per section per day (web parity!)
const _gapMin = 5; // minutes between two gates on the SAME section
const _lenSec = 30; // FULL 30 seconds of attention (sponsor invoice unit!)
const _skipAt = 25; // skip unlocks at 25s (5s left!)

/// Per-section daily tally {c, t} — tolerant reader (corrupt JSON → fresh,
/// never crash!).
Future<Map<String, int>> _tally(String slot) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final day = DateTime.now().toUtc().toIso8601String().substring(0, 10);
    final raw = prefs.getString('advideo:$slot:$day');
    if (raw == null || raw.isEmpty) return {'c': 0, 't': 0};
    final m = RegExp(r'"c":(\d+),"t":(\d+)').firstMatch(raw);
    if (m == null) return {'c': 0, 't': 0};
    return {'c': int.parse(m.group(1)!), 't': int.parse(m.group(2)!)};
  } catch (_) {
    return {'c': 0, 't': 0};
  }
}

Future<bool> _capped(String slot) async {
  try {
    final t = await _tally(slot);
    if (t['c']! >= _perDay) return true; // today's 10 for this section are done
    final last = t['t']!;
    if (last > 0 &&
        DateTime.now().millisecondsSinceEpoch - last <
            _gapMin * 60 * 1000) return true; // cooling down (5-min breather!)
    return false;
  } catch (_) {
    return true; // storage broken → pretend seen (fewer ads, never errors!)
  }
}

Future<void> _mark(String slot) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final day = DateTime.now().toUtc().toIso8601String().substring(0, 10);
    final t = await _tally(slot);
    await prefs.setString('advideo:$slot:$day',
        '{"c":${t['c']! + 1},"t":${DateTime.now().millisecondsSinceEpoch}}');
  } catch (_) {} // mark FIRST (even instant closes consume one of the 10!)
}

/// Clears one section's tally (preview/testing bypass!).
Future<void> clearVideoSeen(String slot) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final day = DateTime.now().toUtc().toIso8601String().substring(0, 10);
    await prefs.remove('advideo:$slot:$day');
  } catch (_) {}
}

Future<void> _log(String slot, String source, String event) async {
  try {
    await ApiClient.instance.videoEvent(slot, source, event);
  } catch (_) {} // funnel gaps beat frozen gates (web parity!)
}

/// In-memory ads payload (warmed after login — gates then skip network entirely!).
Map<String, dynamic>? _adsMem;
int _adsMemAt = 0;
const _adsTtlMs = 10 * 60 * 1000;

/// Seed the cache from an existing /api/me response (call after login —
/// zero extra HTTP, same trick as web setAdsCache!).
void seedAdsCache(Map<String, dynamic> me) {
  try {
    final a = me['ads'];
    if (a is Map) {
      _adsMem = Map<String, dynamic>.from(a);
      _adsMemAt = DateTime.now().millisecondsSinceEpoch;
    }
  } catch (_) {}
}

/// Warm the cache (call once after login — next gate opens with zero HTTP!).
Future<void> warmAdsCache() async {
  try {
    final me = await ApiClient.instance
        .me()
        .timeout(const Duration(seconds: 5), onTimeout: () => <String, dynamic>{});
    if (me['ads'] is Map) {
      _adsMem = Map<String, dynamic>.from(me['ads'] as Map);
      _adsMemAt = DateTime.now().millisecondsSinceEpoch;
    }
  } catch (_) {}
}

/// Gated 30s video (sponsor mp4s: house promo + paying sponsors).
/// Outcomes mirror web: completed | skipped | visited | skipped-empty |
/// skipped-cap | failed-all. Callers ALWAYS proceed afterwards!
/// FAST PATH: cap checked FIRST (no network when capped!); cached ads used
/// instantly; /api/me has a 3.5s cap (slow server → skip, never a stuck gate!).
Future<String> maybeShowVideoAd(BuildContext context,
    {String slot = 'mobile', bool force = false}) async {
  try {
    if (!force && await _capped(slot)) return 'skipped-cap'; // capped? <50ms exit — ZERO network (the #1 slow-ads cause on phones!)
    Map<String, dynamic>? ads = _adsMem;
    final fresh =
        ads != null && DateTime.now().millisecondsSinceEpoch - _adsMemAt < _adsTtlMs;
    if (!fresh) {
      try {
        final me = await ApiClient.instance
            .me()
            .timeout(const Duration(milliseconds: 3500),
                onTimeout: () => <String, dynamic>{});
        if (me['ads'] is Map) {
          ads = Map<String, dynamic>.from(me['ads'] as Map);
          _adsMem = ads;
          _adsMemAt = DateTime.now().millisecondsSinceEpoch;
        } else if (!fresh) {
          ads = null;
        }
      } catch (_) {
        if (!fresh) ads = null; // offline → use stale cache or skip (never trap!)
      }
    }
    final v = ads is Map ? (ads as Map)['video'] : null;
    if (v is! Map) return 'skipped-empty'; // Pro / logged-out / ads off
    final url = '${v['sponsorVideo'] ?? ''}';
    final link = '${v['sponsorLink'] ?? ''}';
    final title = '${v['sponsorTitle'] ?? 'Sponsored'}';
    if (url.isEmpty || link.isEmpty) {
      return 'skipped-empty'; // native plays sponsor mp4s ONLY (VAST/.js need web IMA — those layers live on web!)
    }
    Uri? uri;
    try {
      uri = Uri.parse(url);
      if (!uri.hasScheme) return 'skipped-empty'; // bad config → straight through (never a trap!)
    } catch (_) {
      return 'skipped-empty';
    }
    if (!force) await _mark(slot);
    if (!context.mounted) return 'skipped-empty';
    // ignore: use_build_context_synchronously (guarded above + inside!)
    // FULLSCREEN route (not showDialog!): Dialog boxes constrain + center
    // their child, so tall reel + header + buttons overflowed and rendered
    // "halfway"/clipped on small phones. A fullscreen opaque route gives the
    // gate the whole screen — nothing can be cut off (scroll-safe inside!).
    final out = await Navigator.of(context).push<String>(
      PageRouteBuilder<String>(
        fullscreenDialog: true,
        opaque: true, // solid black (no ghost of the page behind!)
        barrierDismissible: false, // no tap-out dodge (skip button at 25s is the exit!)
        transitionDuration: const Duration(milliseconds: 250),
        pageBuilder: (_, __, ___) => _ReelGate(
            url: url, link: link, title: title, slot: slot, log: _log),
        transitionsBuilder: (_, anim, __, child) =>
            FadeTransition(opacity: anim, child: child),
      ),
    );
    return out ?? 'skipped';
  } catch (_) {
    return 'skipped-empty'; // any failure = straight through (buttons always work!)
  }
}

/// Fullscreen 9:16 reel: countdown 30 → 0, skip unlocks at 25s, Visit opens
/// the sponsor (logged BEFORE leaving, like web!). Muted autoplay (store
/// policy + politeness — sound needs the advertiser's own player!).
class _ReelGate extends StatefulWidget {
  final String url;
  final String link;
  final String title;
  final String slot;
  final Future<void> Function(String slot, String source, String event) log;
  const _ReelGate(
      {required this.url,
      required this.link,
      required this.title,
      required this.slot,
      required this.log});

  @override
  State<_ReelGate> createState() => _ReelGateState();
}

class _ReelGateState extends State<_ReelGate> {
  late final VideoPlayerController _ctl;
  Timer? _tick;
  Timer? _watchdog;
  int _el = 0; // seconds VIEWED (frozen till first pixels move, like web!)
  int? _t0ms; // viewing clock start (set on first playback — loading never counts!)
  bool _started = false;
  bool _done = false;
  final _q = <String>{}; // fired quartiles (q25/q50/q75 once each!)

  @override
  void initState() {
    super.initState();
    _ctl = VideoPlayerController.networkUrl(Uri.parse(widget.url))
      ..setVolume(0.0); // muted (autoplay-legal everywhere!)
    // Init has a 10s cap: slow/dead files fail FAST to 'failed-all' instead
    // of holding the user on a spinner (the "ads take forever" complaint!).
    _ctl
        .initialize()
        .timeout(const Duration(seconds: 10),
            onTimeout: () => throw TimeoutException('video-init'))
        .then((_) {
      if (!mounted) return;
      setState(() {}); // first frame → rebuild (loading spinner out!)
      _ctl.play();
    }).catchError((_) {
      _finish('failed-all'); // dead file → next layer would go here (single layer: straight through!)
    });
    _tick = Timer.periodic(const Duration(milliseconds: 250), (_) {
      if (_done || !mounted) return;
      if (!_started) {
        if (_ctl.value.isInitialized && _ctl.value.isPlaying) {
          _started = true; // first pixels move (loading never billed as viewing!)
          _t0ms = DateTime.now().millisecondsSinceEpoch;
        } else {
          return;
        }
      }
      final el =
          ((DateTime.now().millisecondsSinceEpoch - (_t0ms ?? 0)) / 1000)
              .floor()
              .clamp(0, _lenSec); // wall-clock VIEWING seconds (buffering included — fair!)
      _el = el;
      // quartiles at 7.5/15/22.5s of 30 (completion RATE = attention quality!)
      for (final e in [
        [7.5, 'q25'],
        [15, 'q50'],
        [22.5, 'q75']
      ]) {
        if (_el >= (e[0] as double) && _q.add(e[1] as String)) {
          unawaited(widget.log(widget.slot, 'sponsor', e[1] as String));
        }
      }
      if (_el >= _lenSec) _finish('completed'); // full 30s WATCHED → invoice it!
      if (mounted) setState(() {});
    });
    _watchdog = Timer(const Duration(seconds: 90), () {
      _finish('completed'); // absolute backstop (nothing traps, ever!)
    });
    unawaited(widget.log(widget.slot, 'sponsor', 'start')); // funnel opens!
  }

  void _finish(String outcome) {
    if (_done) return; // settled once (timers race — first wins!)
    _done = true;
    _tick?.cancel();
    _watchdog?.cancel();
    if (outcome == 'completed') {
      unawaited(widget.log(widget.slot, 'sponsor', 'complete'));
    }
    if (mounted) Navigator.of(context).pop(outcome);
  }

  @override
  void dispose() {
    _tick?.cancel();
    _watchdog?.cancel();
    _ctl.dispose(); // player teardown (no orphan audio, ever!)
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final left = _lenSec - _el;
    // Scaffold + LayoutBuilder (NOT fixed MediaQuery fractions!): the reel is
    // sized from the REAL available space minus header/footer, and the whole
    // column scrolls if the phone is short — the gate can NEVER render halfway.
    return Scaffold(
      backgroundColor: Colors.black, // theatre black, edge to edge
      body: SafeArea(
        child: LayoutBuilder(
          builder: (ctx, constraints) {
            final maxW = constraints.maxWidth;
            final maxH = constraints.maxHeight;
            // Reel width fits the screen with margins (cap 430 like web!);
            // height keeps 9:16 but never exceeds what's left after the
            // header (~120) + footer (~190) — min 220 so it never collapses.
            final reelW = (maxW - 32).clamp(0.0, 430.0);
            var reelH = (reelW * 16 / 9).clamp(220.0, 640.0);
            final room = maxH - 320;
            if (room < reelH && room >= 220) reelH = room;
            return SingleChildScrollView(
              // short screens scroll instead of clipping (the halfway fix!)
              physics: const ClampingScrollPhysics(),
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: maxH),
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 12),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: scheme.primary
                                .withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text('SPONSORED · VIDEO',
                              style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 1,
                                  color: scheme.primary)),
                        ),
                        const SizedBox(height: 6),
                        Text(widget.title,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: Colors.white)),
                        const SizedBox(height: 10),
                        // Gradient-bordered 9:16 reel (mint → gold, the house frame!).
                        Container(
                          padding: const EdgeInsets.all(2.5),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(20),
                            gradient: const LinearGradient(colors: [
                              Color(0xFF25D366),
                              Color(0xFF7EF0C0),
                              Color(0xFFFFCF5C),
                            ], begin: Alignment.topLeft, end: Alignment.bottomRight),
                            boxShadow: [
                              BoxShadow(
                                  color: const Color(0xFF25D366)
                                      .withValues(alpha: 0.28),
                                  blurRadius: 26,
                                  spreadRadius: 1),
                            ],
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(18),
                            child: SizedBox(
                              width: reelW,
                              height: reelH,
                              child: _ctl.value.isInitialized
                                  ? FittedBox(
                                      fit: BoxFit
                                          .cover, // reels crop, never letterbox (full-bleed portrait!)
                                      child: SizedBox(
                                        width: _ctl.value.size.width == 0
                                            ? 360
                                            : _ctl.value.size.width,
                                        height: _ctl.value.size.height == 0
                                            ? 640
                                            : _ctl.value.size.height,
                                        child: VideoPlayer(_ctl),
                                      ),
                                    )
                                  : const Center(
                                      child: Column(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          CircularProgressIndicator(
                                              strokeWidth: 3),
                                          SizedBox(height: 10),
                                          Text('Loading video…',
                                              style: TextStyle(
                                                  fontSize: 13,
                                                  color: Colors.white70)),
                                        ],
                                      ),
                                    ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 10),
                        // Countdown + progress (frozen till playback — loading never counts!).
                        SizedBox(
                          width: reelW,
                          child: Column(children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(99),
                              child: LinearProgressIndicator(
                                value: (_el / _lenSec).clamp(0.0, 1.0),
                                minHeight: 8,
                                backgroundColor: Colors.white12,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Row(
                              mainAxisAlignment:
                                  MainAxisAlignment.spaceBetween,
                              children: [
                                Text('$left s',
                                    style: const TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w800,
                                        color: Colors.white70)),
                                _el >= _skipAt
                                    ? TextButton(
                                        onPressed: () {
                                          unawaited(widget.log(widget.slot,
                                              'sponsor', 'skip'));
                                          _finish('skipped');
                                        },
                                        child: const Text('Skip →',
                                            style:
                                                TextStyle(fontSize: 15)),
                                      )
                                    : const SizedBox(
                                        height:
                                            48), // reserve skip's space (no jump when it unlocks!)
                              ],
                            ),
                            const SizedBox(height: 4),
                            SizedBox(
                              width: double.infinity,
                              child: FilledButton.icon(
                                onPressed: () async {
                                  // THE money event: logged BEFORE leaving (web parity!)…
                                  try {
                                    await ApiClient.instance.adClick(
                                        'video-${widget.slot}',
                                        widget.link);
                                  } catch (_) {} // …logging never blocks the visit…
                                  unawaited(widget.log(widget.slot,
                                      'sponsor', 'click'));
                                  await launchUrl(Uri.parse(widget.link),
                                      mode: LaunchMode
                                          .externalApplication);
                                  _finish('visited');
                                },
                                icon: const Icon(Icons.open_in_new,
                                    size: 17),
                                label: const Text('Visit sponsor'),
                              ),
                            ),
                          ]),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
