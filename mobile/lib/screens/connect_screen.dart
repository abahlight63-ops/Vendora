// ── lib/screens/connect_screen.dart ──────────────────────────────
// WHAT: the channel switchboard (web Connect parity) — WhatsApp via Meta
// (Embedded Signup one-tap on web, manual paste here), Telegram via a
// BotFather token, per-shop WhatsApp brain picker, TEST-verify to LIVE.
// One action per screen: road chips → credentials → webhook → TEST.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../glass.dart';
import '../motion.dart';

const _webBilling = 'https://vendorabot.vercel.app/billing'; // locked-brain upsell opens here (same as Billing tab!)

class ConnectScreen extends StatefulWidget {
  const ConnectScreen({super.key});

  @override
  State<ConnectScreen> createState() => _ConnectScreenState();
}

class _ConnectScreenState extends State<ConnectScreen> {
  Map<String, dynamic>? _st;
  List<dynamic> _models = [];
  String? _err;
  bool _loading = true;
  bool _busy = false;
  String _road = 'meta'; // 'meta' | 'telegram' (chips, not pages!)
  int _step = 1;

  final _phoneId = TextEditingController();
  final _metaToken = TextEditingController();
  String? _verifyToken;
  final _tgToken = TextEditingController();
  String? _tgCode;
  String? _tgShared; // shared-bot result text (Pro road — code + link + note!)
  String? _waHealth; // Verify WhatsApp verdict line (token alive? or what to fix!)
  String? _tgHealth; // Verify Telegram verdict line (webhook OK? or what to fix!)
  bool _tgNeedsRepair = false; // verify/repair found a broken hook → offer the one-tap fix
  bool _awaitingMeta = false; // handed the phone to Meta — poll for the return link
  String? _brain;
  bool _testing = false;
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    _load();
  }

  /// Meta redirect road (the only road that works on a phone): ask the server
  /// for a signed single-use state + the Facebook OAuth URL, hand the phone to
  /// the REAL browser, then poll for the return. The Meta popup can never work
  /// in an installed app or an in-app webview — that is why connecting from
  /// Android kept failing.
  Future<void> _metaOauth() => _run(() async {
        final r = await ApiClient.instance.metaOauthStart();
        final url = '${r['url'] ?? ''}';
        if (url.isEmpty) {
          setState(() => _err =
              'Meta redirect is not set up on the server yet — paste your details below, it works today.');
          return;
        }
        final opened = await launchUrl(Uri.parse(url),
            mode: LaunchMode.externalApplication);
        if (!mounted) return;
        if (opened != true) {
          setState(() => _err =
              'Could not open your browser. Paste your details below instead — same result.');
          return;
        }
        setState(() {
          _awaitingMeta = true;
          _err = null;
        });
        _poll?.cancel();
        _poll = Timer.periodic(const Duration(seconds: 6), (t) async {
          try {
            final s = await ApiClient.instance.channels();
            if (!mounted) return t.cancel();
            final wa = s['whatsapp'] as Map?;
            if (wa != null && wa['metaConnected'] == true) {
              t.cancel();
              _load(silent: true); // webhook + number for step 2
              setState(() {
                _awaitingMeta = false;
                _step = 2;
              });
              showToast(context, 'WhatsApp connected! Paste the two values in Meta next.');
            }
          } catch (_) {/* keep polling — the phone is still with Meta */}
        });
      });

  @override
  void dispose() {
    _phoneId.dispose();
    _metaToken.dispose();
    _tgToken.dispose();
    _poll?.cancel();
    super.dispose();
  }

  /// BotFather reality (web parity!): numeric bot id + colon + ~35-char
  /// secret. Finger-selected pastes that FAIL this are truncated — caught
  /// HERE with a helpful message, not at Telegram!
  bool _tgShapeOk(String clean) =>
      RegExp(r'^\d+:[\w-]{30,}$').hasMatch(clean);

  Future<void> _load({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _loading = true;
        _err = null;
      });
    }
    try {
      final results = await Future.wait([
        ApiClient.instance.channels(),
        ApiClient.instance.aiModels(),
      ]);
      _st = (results[0] as Map).cast<String, dynamic>();
      _models = results[1] as List<dynamic>;
      final wa = (_st!['whatsapp'] as Map? ?? {});
      _brain ??= '${wa['model'] ?? 'gemini-flash-full'}';
    } on ApiException catch (e) {
      _err = e.message;
    } catch (_) {
      _err = 'No connection.';
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Map<String, dynamic> get _wa =>
      ((_st?['whatsapp'] as Map?) ?? {}).cast<String, dynamic>();
  bool get _waLive => _wa['live'] == true;
  bool get _tgOn =>
      ((_st?['telegram'] as Map?)?['connected'] == true);

  Future<void> _run(Future<void> Function() fn) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await fn();
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, type: 'err');
    } catch (_) {
      if (mounted) showToast(context, 'No connection.', type: 'err');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _metaConnect() => _run(() async {
        final pid = _phoneId.text.trim();
        if (pid.isEmpty || _metaToken.text.trim().isEmpty) {
          showToast(context, 'Paste both values first', type: 'err');
          return;
        }
        if (!RegExp(r'^\d{5,}$').hasMatch(pid)) {
          showToast(context,
              'Phone Number ID is all digits (e.g. 123456789012345) — re-copy it from Meta → WhatsApp → API testing.',
              type: 'err');
          return;
        }
        final r = await ApiClient.instance.metaConnect(
            pid, _metaToken.text.trim());
        if (!mounted) return; // network wait outlived the screen (back-swipe, rotation) — touching context/setState now CRASHES
        _verifyToken = '${r['verifyToken'] ?? ''}';
        _metaToken.clear(); // token lives server-side now (never keep it on screen!)
        setState(() => _step = 2);
        _load(silent: true); // silent (no skeleton flash — step 2 stays put!)
        showToast(context, 'Meta checked — now link the webhook.');
      });

  Future<void> _tgConnect() => _run(() async {
        // Strip invisible code units by NUMBER (ASCII-only source — same set the web app strips: 200B-200F, 2028-202F, FEFF, 00AD)!
        bool visible(String c) {
          final u = c.codeUnitAt(0);
          return !((u >= 0x200B && u <= 0x200F) ||
              (u >= 0x2028 && u <= 0x202F) ||
              u == 0xFEFF ||
              u == 0x00AD);
        }
        final clean = _tgToken.text
            .split('')
            .where(visible)
            .join('')
            .replaceAll(RegExp(r'\s+'), ''); // BotFather wraps lines — rejoin first!
        if (clean.isEmpty) {
          showToast(context, 'Paste your BotFather token first',
              type: 'err');
          return;
        }
        if (!_tgShapeOk(clean)) {
          showToast(context,
              'Token looks incomplete — TAP-copy it in BotFather with /token (finger-selecting drops characters).',
              type: 'err');
          return;
        }
        final r = await ApiClient.instance.telegramToken(clean);
        if (!mounted) return; // network wait outlived the screen (back-swipe, rotation) — touching context/setState now CRASHES
        if (r['connected'] == true) {
          _tgToken.clear();
          setState(() => _step = 2);
          _load(silent: true); // silent (no skeleton flash!)
          showToast(context, 'Telegram connected!');
        } else {
          showToast(context,
              'Saved but not connected — sign out and in again.', type: 'err');
        }
      });

  /// Shared-bot road (Pro/testers, no BotFather paste — web parity!).
  Future<void> _tgSharedConnect() => _run(() async {
        try {
          final r = await ApiClient.instance.telegramShared();
          if (!mounted) return; // network wait outlived the screen — context/setState now CRASHES
          if (r['connected'] == true) {
            setState(() {
              _tgShared =
                  'Customer link: ${r['deepLink'] ?? ''}\nCode: ${r['code'] ?? ''}\n${r['note'] ?? ''}';
              _step = 2;
            });
            _load(silent: true); // silent (no skeleton flash!)
            showToast(context, 'Shared bot connected!');
          } else {
            showToast(context, 'Shared bot unavailable.', type: 'err');
          }
        } on ApiException catch (e) {
          // 402 = free tier → upgrade card (same as locked brains, never a dead button!)
          if (e.status == 402) {
            _upsellShared();
          } else {
            rethrow; // _run toasts everything else (session, server, network!)
          }
        }
      });

  void _upsellShared() {
    glassSheet(
      context,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(children: [
            Icon(Icons.lock_outline, size: 20),
            SizedBox(width: 8),
            Text('Shared bot is Pro',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
          ]),
          const SizedBox(height: 10),
          const Text(
              'One tap, no BotFather, customers bind with your link. Free plan? Your own bot above stays free forever.'),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () => launchUrl(Uri.parse(_webBilling),
                  mode: LaunchMode.externalApplication),
              child: const Text('See upgrade options'),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _tgSharedOff() => _run(() async {
        await ApiClient.instance.telegramSharedOff();
        if (!mounted) return; // network wait outlived the screen — context/setState now CRASHES
        setState(() {
          _tgShared = null;
          _step = 1;
        });
        _load(silent: true); // silent (no skeleton flash!)
        showToast(context, 'Shared bot switched off.');
      });

  /// Verify buttons (web parity!): token alive? webhook registered? Exact fix named.
  Future<void> _waVerify() => _run(() async {
        final r = await ApiClient.instance.waHealth();
        if (!mounted) return; // setState on an unmounted screen throws — guard every post-await hop
        setState(() => _waHealth = r['connected'] == true
            ? 'Token alive${'${r['phone'] ?? ''}'.isNotEmpty ? ' · ${r['phone']}' : ''}. TEST not flipping? The webhook paste in Meta is missing — not credentials.'
            : 'Needs attention: ${(r['reason'] ?? '') == 'token-dead' ? 'Meta token expired — reconnect with a fresh token.' : 'not connected yet.'}');
      });

  Future<void> _tgVerify() => _run(() async {
        final r = await ApiClient.instance.telegramHealth();
        if (!mounted) return; // setState on an unmounted screen throws — guard every post-await hop
        setState(() {
          _tgNeedsRepair = false;
          if (r['configured'] != true) {
            _tgHealth = 'No bot saved yet — connect below first.';
          } else if (r['ok'] == true) {
            _tgHealth = 'Webhook OK. Message the bot — it answers.';
          } else if (r['matches'] == false) {
            _tgNeedsRepair = true;
            _tgHealth =
                'Your bot is delivering somewhere else (usually our server moved since you connected). Tap Repair — it re-registers the hook in seconds, no token needed.';
          } else {
            _tgNeedsRepair = true;
            _tgHealth =
                'Needs attention: ${r['lastError'] ?? 'webhook not registered'} — tap Repair, and if that fails the token itself is dead: create a new bot in BotFather and re-save it.';
          }
        });
      });

  Future<void> _tgRepair() => _run(() async {
        final r = await ApiClient.instance.telegramRepair();
        if (!mounted) return; // setState on an unmounted screen throws — guard every post-await hop
        final rep = r['repaired'];
        setState(() {
          if (rep is Map && rep['healed'] == true) {
            _tgNeedsRepair = false;
            _tgHealth =
                'Repaired just now — your bot is delivering to us again. Nothing queued was dropped.';
          } else if (r['ok'] == true) {
            _tgNeedsRepair = false;
            _tgHealth = 'Already healthy — nothing to fix.';
          } else {
            _tgNeedsRepair = true;
            _tgHealth =
                'Repair failed: ${(rep is Map ? rep['detail'] : null) ?? r['lastError'] ?? 'Telegram refused the hook'}. If it keeps failing, tell support with your bot username.';
          }
        });
      });

  Future<void> _tgLink() => _run(() async {
        final r = await ApiClient.instance.telegramLink();
        if (!mounted) return; // setState on an unmounted screen throws — guard every post-await hop
        setState(() => _tgCode = '${r['code'] ?? ''}\n${r['note'] ?? ''}');
      });

  Future<void> _saveBrain(String? id) async {
    if (id == null) return;
    Map? found;
    for (final m in _models) {
      if (m is Map && '${m['id']}' == id) {
        found = m;
        break;
      }
    }
    if (found != null && found['locked'] == true) {
      _upsell();
      return;
    }
    setState(() => _brain = id);
    try {
      final r = await ApiClient.instance.whatsappModel(id);
      if (mounted) showToast(context, 'WhatsApp brain: ${r['label'] ?? id}');
    } on ApiException {
      if (mounted) _upsell(); // 402 → locked (downgraded plan?) → upgrade card!
    } catch (_) {
      if (mounted) showToast(context, 'No connection.', type: 'err');
    }
  }

  void _upsell() {
    glassSheet(
      context,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(children: [
            Icon(Icons.lock_outline, size: 20),
            SizedBox(width: 8),
            Text('Unlock this brain',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
          ]),
          const SizedBox(height: 10),
          const Text(
              'Premium brains answer sharper and never queue behind free traffic.'),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () => launchUrl(Uri.parse(_webBilling),
                  mode: LaunchMode.externalApplication),
              child: const Text('See upgrade options'),
            ),
          ),
        ],
      ),
    );
  }

  void _startWatch() {
    setState(() => _testing = true);
    _poll?.cancel();
    var ticks = 0;
    _poll = Timer.periodic(const Duration(seconds: 5), (_) async {
      ticks++;
      try {
        final s = await ApiClient.instance.channels();
        final live = ((s['whatsapp'] as Map?)?['live'] == true);
        if (live && mounted) {
          _poll?.cancel();
          setState(() {
            _st = s.cast<String, dynamic>();
            _testing = false;
          });
          showToast(context, 'Connected — you are LIVE!');
        } else if (ticks >= 24 && mounted) {
          // 24 × 5s = 2 minutes (never poll forever!)
          _poll?.cancel();
          setState(() => _testing = false);
          showToast(context, 'Still waiting — check the number and retry.',
              type: 'err');
        }
      } catch (_) {}
    });
  }

  void _copy(String text) {
    Clipboard.setData(ClipboardData(text: text));
    showToast(context, 'Copied.');
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          Skeleton(height: 90),
          SizedBox(height: 12),
          Skeleton(height: 200),
        ],
      );
    }
    if (_err != null) {
      return Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
        Text(_err!),
        const SizedBox(height: 12),
        FilledButton(onPressed: _load, child: const Text('Retry')),
      ]));
    }
    final webhook = '${_st?['webhookUrl'] ?? ''}';
    // Dropdown guard: saved brain missing from the fetched list (empty/failed
    // models) → null, never a crash ("exactly one item with value"!).
    final brainIds = {
      for (final m in _models)
        if (m is Map) '${m['id']}',
    };
    final brainValue =
        (_brain != null && brainIds.contains(_brain)) ? _brain : null;
    return RefreshIndicator(
      onRefresh: () => _load(silent: true), // RefreshIndicator spins itself (no skeleton flash!)
      child: ListView(padding: const EdgeInsets.all(16), children: [
        // Status board.
        GlassCard(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Wrap(spacing: 8, runSpacing: 8, children: [
              Chip(
                avatar: Icon(
                    _waLive ? Icons.check_circle : Icons.circle_outlined,
                    size: 16),
                label: Text('WhatsApp: ${_waLive ? 'LIVE' : 'OFF'}'),
              ),
              Chip(
                avatar: Icon(_tgOn ? Icons.check_circle : Icons.circle_outlined,
                    size: 16),
                label: Text('Telegram: ${_tgOn ? 'LIVE' : 'OFF'}'),
              ),
              if ('${_wa['number'] ?? ''}'.isNotEmpty)
                Text('Shop number: ${_wa['number']}',
                    style: const TextStyle(fontSize: 12)),
              if (_wa['metaConnected'] == true)
                const Text('Meta linked — no credentials needed from you.',
                    style: TextStyle(fontSize: 12)),
            ]),
          ),
        ),
        const SizedBox(height: 12),
        // Verify row: token alive? webhook registered? Exact fix named (web parity!).
        GlassCard(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Connection health',
                      style: TextStyle(
                          fontSize: 16, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 8),
                  Wrap(spacing: 8, runSpacing: 8, children: [
                    OutlinedButton(
                        onPressed: _busy ? null : _waVerify,
                        child: const Text('Verify WhatsApp',
                            style: TextStyle(fontSize: 13))),
                    OutlinedButton(
                        onPressed: _busy ? null : _tgVerify,
                        child: const Text('Verify Telegram',
                            style: TextStyle(fontSize: 13))),
                    if (_tgNeedsRepair)
                      FilledButton(
                          onPressed: _busy ? null : _tgRepair,
                          child: Text(_busy ? 'Repairing…' : 'Repair Telegram hook',
                              style: const TextStyle(fontSize: 13))),
                  ]),
                  if ((_waHealth ?? '').isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text('WhatsApp: $_waHealth',
                        style: const TextStyle(fontSize: 12)),
                  ],
                  if ((_tgHealth ?? '').isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text('Telegram: $_tgHealth',
                        style: const TextStyle(fontSize: 12)),
                  ],
                ]),
          ),
        ),
        const SizedBox(height: 12),
        // Road picker.
        GlassCard(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Pick your road',
                      style:
                          TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 8),
                  Wrap(spacing: 8, children: [
                    ChoiceChip(
                        label: const Text('Meta (free)'),
                        selected: _road == 'meta',
                        onSelected: (_) {
                          setState(() {
                            _road = 'meta';
                            _step = 1;
                          });
                        }),
                    ChoiceChip(
                        label: const Text('Telegram'),
                        selected: _road == 'telegram',
                        onSelected: (_) {
                          setState(() {
                            _road = 'telegram';
                            _step = 1;
                          });
                        }),
                  ]),
                  const SizedBox(height: 12),
                  if (_road == 'meta') _metaFlow(webhook),
                  if (_road == 'telegram') _telegramFlow(),
                ]),
          ),
        ),
        const SizedBox(height: 12),
        // Brain picker.
        GlassCard(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Which AI answers WhatsApp?',
                      style:
                          TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 4),
                  const Text(
                      'Locked brains need their plan — tap to see options.',
                      style: TextStyle(fontSize: 12)),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(
                    initialValue: brainValue,
                    decoration: const InputDecoration(
                        labelText: 'WhatsApp brain'),
                    items: [
                      for (final m in _models)
                        DropdownMenuItem(
                          value: '${(m as Map)['id']}',
                          child: Text(
                              '${m['label'] ?? m['id']}${m['locked'] == true ? ' (Locked)' : ''}'),
                        ),
                    ],
                    onChanged: _saveBrain,
                  ),
                ]),
          ),
        ),
      ]),
    );
  }

  Widget _metaFlow(String webhook) {
    if (_step == 1) {
      return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Step 1 of 3 — link your WhatsApp number',
            style: TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        const Text(
            'Fastest: tap Continue — your browser opens the official Meta page, you sign in, pick your number, and it links itself. Nothing to copy. (The old popup cannot work inside an installed app — that is why it kept failing.)',
            style: TextStyle(fontSize: 12)),
        const SizedBox(height: 8),
        FilledButton(
            onPressed: _busy || _awaitingMeta ? null : _metaOauth,
            child: Text(_busy
                ? 'Opening Meta…'
                : (_awaitingMeta ? 'Waiting for Meta…' : 'Continue to Meta'))),
        if (_awaitingMeta) ...[
          const SizedBox(height: 6),
          const Text(
              'Finish in the browser tab that just opened. This screen updates itself the moment your number is linked.',
              style: TextStyle(fontSize: 12)),
        ],
        if ((_err ?? '').isNotEmpty) ...[
          const SizedBox(height: 6),
          Text(_err!, style: const TextStyle(fontSize: 12)),
        ],
        const SizedBox(height: 10),
        const Text('Or paste both values (from Meta app → WhatsApp → API testing):',
            style: TextStyle(fontSize: 12)),
        const SizedBox(height: 8),
        TextField(
            controller: _phoneId,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
                labelText: 'Phone Number ID (all digits)')),
        const SizedBox(height: 8),
        TextField(
            controller: _metaToken,
            decoration:
                const InputDecoration(labelText: 'Access token')),
        const SizedBox(height: 10),
        FilledButton(
            onPressed: _busy ? null : _metaConnect,
            child: Text(_busy ? 'Checking…' : 'Check + continue')),
      ]);
    }
    if (_step == 2) {
      return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Step 2 of 3 — link our app to Meta',
            style: TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        const Text(
            'In Meta: WhatsApp → Configuration → paste BOTH → Verify and save.',
            style: TextStyle(fontSize: 12)),
        const SizedBox(height: 8),
        _copyRow('Webhook URL', webhook),
        if ((_verifyToken ?? '').isNotEmpty)
          _copyRow('Verify code', _verifyToken!),
        const SizedBox(height: 10),
        FilledButton(
            onPressed: () => setState(() => _step = 3),
            child: const Text("I've pasted in Meta — continue")),
      ]);
    }
    return _testStep();
  }

  Widget _telegramFlow() {
    if (_step == 1) {
      return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Step 1 of 2 — get a free token from Telegram',
            style: TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        const Text(
            'Open Telegram → search @BotFather → /newbot → name it → username ending in "bot" → copy the token (like 123456789:ABCdef…) and paste it below. Keep it private — anyone with it can control your bot.',
            style: TextStyle(fontSize: 12)),
        const SizedBox(height: 8),
        TextField(
            controller: _tgToken,
            decoration: const InputDecoration(labelText: 'Bot token')),
        const SizedBox(height: 10),
        FilledButton(
            onPressed: _busy ? null : _tgConnect,
            child: Text(_busy ? 'Checking…' : 'Connect bot')),
        const SizedBox(height: 4),
        const Text('We check the token with Telegram instantly.',
            style: TextStyle(fontSize: 12)),
        const SizedBox(height: 12),
        const Text('Or skip BotFather — shared bot (Pro)',
            style: TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        const Text(
            'Pro shops ride our house bot: one tap, no tokens, nothing to revoke. Free plan? Your own bot above stays free forever.',
            style: TextStyle(fontSize: 12)),
        const SizedBox(height: 8),
        FilledButton.tonal(
            onPressed: _busy ? null : _tgSharedConnect,
            child: const Text('Connect shared bot')),
      ]);
    }
    // Shared-mode step 2 (fresh tap OR earlier session!): customer link card.
    final sharedOn =
        _tgShared != null || ((_st?['telegram'] as Map?)?['shared'] == true);
    if (sharedOn) {
      return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Shared bot is live — give customers this link',
            style: TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        const Text(
            'Anyone who opens it once is bound to your shop forever. Owner commands stay in your dashboard.',
            style: TextStyle(fontSize: 12)),
        const SizedBox(height: 8),
        if ((_tgShared ?? '').isNotEmpty)
          Text(_tgShared!, style: const TextStyle(fontSize: 13)),
        if ((_tgShared ?? '').isEmpty &&
            '${((_st?['telegram'] as Map?)?['sharedBot'] ?? '')}'
                .isNotEmpty)
          Text(
              'Connected via @${(_st?['telegram'] as Map?)?['sharedBot']} — generate a fresh link below.',
              style: const TextStyle(fontSize: 13)),
        const SizedBox(height: 8),
        Wrap(spacing: 8, runSpacing: 8, children: [
          FilledButton.tonal(
              onPressed: _busy ? null : _tgSharedConnect,
              child: const Text('Get customer link')),
          OutlinedButton(
              onPressed: _busy ? null : _tgSharedOff,
              child: const Text('Switch off',
                  style: TextStyle(fontSize: 13))),
        ]),
      ]);
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Telegram is live — link yourself (optional)',
          style: TextStyle(fontWeight: FontWeight.w700)),
      const SizedBox(height: 4),
      const Text('Owner commands (LEARN:, PAUSE) work from your phone after linking.',
          style: TextStyle(fontSize: 12)),
      const SizedBox(height: 8),
      FilledButton.tonal(
          onPressed: _busy ? null : _tgLink,
          child: const Text('Get my link code')),
      if ((_tgCode ?? '').isNotEmpty) ...[
        const SizedBox(height: 8),
        Text(_tgCode!, style: const TextStyle(fontSize: 13)),
      ],
    ]);
  }

  Widget _testStep() {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Send TEST — we watch for it live',
          style: TextStyle(fontWeight: FontWeight.w700)),
      const SizedBox(height: 4),
      Text(
          'From ANY phone, message ${_wa['number'] ?? 'your shop number'}. The moment it lands, you go LIVE.',
          style: const TextStyle(fontSize: 12)),
      const SizedBox(height: 10),
      FilledButton(
          onPressed: _testing ? null : _startWatch,
          child: Text(_testing ? 'Watching… send it now' : 'Start watching')),
      const SizedBox(height: 8),
      const Text(
          'Still waiting? Wrong number messaged · webhook not saved · token expired. Stuck? Talk to support from Help.',
          style: TextStyle(fontSize: 12)),
    ]);
  }

  Widget _copyRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Row(children: [
        Expanded(
            child: Text('$label: $value',
                style: const TextStyle(fontSize: 12))),
        IconButton(
          icon: const Icon(Icons.copy, size: 18),
          tooltip: 'Copy $label',
          onPressed: () => _copy(value),
        ),
      ]),
    );
  }
}
