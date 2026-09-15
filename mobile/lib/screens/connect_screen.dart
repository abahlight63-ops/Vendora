// ── lib/screens/connect_screen.dart ──────────────────────────────
// WHAT: the channel switchboard (web Connect.jsx parity) — WhatsApp via Meta
// (free to start) or own-Twilio (SID/token once, we point the number), Telegram
// via BotFather, per-shop WhatsApp brain picker, TEST-verify to LIVE.
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
  String _road = 'meta'; // 'meta' | 'twilio' | 'telegram' (chips, not pages!)
  int _step = 1;

  final _phoneId = TextEditingController();
  final _metaToken = TextEditingController();
  String? _verifyToken;
  final _sid = TextEditingController();
  final _twToken = TextEditingController();
  List<dynamic>? _numbers;
  String? _picked;
  final _tgToken = TextEditingController();
  String? _tgCode;
  String? _brain;
  bool _testing = false;
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _phoneId.dispose();
    _metaToken.dispose();
    _sid.dispose();
    _twToken.dispose();
    _tgToken.dispose();
    _poll?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _err = null;
    });
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
        if (_phoneId.text.trim().isEmpty || _metaToken.text.trim().isEmpty) {
          showToast(context, 'Paste both values first', type: 'err');
          return;
        }
        final r = await ApiClient.instance.metaConnect(
            _phoneId.text.trim(), _metaToken.text.trim());
        _verifyToken = '${r['verifyToken'] ?? ''}';
        _metaToken.clear(); // token lives server-side now (never keep it on screen!)
        setState(() => _step = 2);
        _load();
        showToast(context, 'Meta checked — now link the webhook.');
      });

  Future<void> _twilioList() => _run(() async {
        if (_sid.text.trim().isEmpty || _twToken.text.trim().isEmpty) {
          showToast(context, 'Paste both values first', type: 'err');
          return;
        }
        final r = await ApiClient.instance.twilioConnect(
            _sid.text.trim(), _twToken.text.trim());
        final nums = List<dynamic>.from(r['numbers'] ?? []);
        if (nums.isEmpty) {
          showToast(context,
              'No numbers on that Twilio account yet.', type: 'err');
          return;
        }
        setState(() {
          _numbers = nums;
          _picked = '${(nums[0] as Map)['sid']}';
          _step = 2;
        });
      });

  Future<void> _twilioAdopt() => _run(() async {
        if (_picked == null) return;
        final r = await ApiClient.instance.twilioSelect(
            _sid.text.trim(), _twToken.text.trim(), _picked!);
        _twToken.clear();
        setState(() => _step = 3);
        _load();
        showToast(context,
            'Connected ${r['phone'] ?? ''} — now send the TEST.');
      });

  Future<void> _tgConnect() => _run(() async {
        if (_tgToken.text.trim().isEmpty) {
          showToast(context, 'Paste your BotFather token first',
              type: 'err');
          return;
        }
        final r =
            await ApiClient.instance.telegramToken(_tgToken.text.trim());
        if (r['connected'] == true) {
          _tgToken.clear();
          setState(() => _step = 2);
          _load();
          showToast(context, 'Telegram connected!');
        } else {
          showToast(context, 'Token rejected.', type: 'err');
        }
      });

  Future<void> _tgLink() => _run(() async {
        final r = await ApiClient.instance.telegramLink();
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
    return RefreshIndicator(
      onRefresh: _load,
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
                        label: const Text('Twilio'),
                        selected: _road == 'twilio',
                        onSelected: (_) {
                          setState(() {
                            _road = 'twilio';
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
                  if (_road == 'twilio') _twilioFlow(webhook),
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
                    initialValue: _brain,
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
        const Text('Step 1 of 3 — paste 2 values from Meta',
            style: TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        const Text(
            'developers.facebook.com → your app → WhatsApp → API Setup.',
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

  Widget _twilioFlow(String webhook) {
    if (_step == 1) {
      return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Step 1 of 3 — paste SID + token',
            style: TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        const Text('Twilio console → Account Info. The token never leaves our server.',
            style: TextStyle(fontSize: 12)),
        const SizedBox(height: 8),
        TextField(
            controller: _sid,
            decoration:
                const InputDecoration(labelText: 'Account SID (AC…)')),
        const SizedBox(height: 8),
        TextField(
            controller: _twToken,
            decoration: const InputDecoration(labelText: 'Auth Token')),
        const SizedBox(height: 10),
        FilledButton(
            onPressed: _busy ? null : _twilioList,
            child: Text(_busy ? 'Checking…' : 'Find my numbers')),
        const SizedBox(height: 8),
        const Text('No Twilio? Point any number at this URL by hand:',
            style: TextStyle(fontSize: 12)),
        _copyRow('Webhook URL', webhook),
      ]);
    }
    if (_step == 2) {
      return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Step 2 of 3 — pick your number',
            style: TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(
          initialValue: _picked,
          decoration:
              const InputDecoration(labelText: 'Your Twilio numbers'),
          items: [
            for (final n in _numbers ?? [])
              DropdownMenuItem(
                  value: '${(n as Map)['sid']}',
                  child: Text('${n['phone'] ?? n['sid']}')),
          ],
          onChanged: (v) => setState(() => _picked = v),
        ),
        const SizedBox(height: 10),
        FilledButton(
            onPressed: _busy ? null : _twilioAdopt,
            child: Text(_busy ? 'Pointing…' : 'Point it at my bot')),
      ]);
    }
    return _testStep();
  }

  Widget _telegramFlow() {
    if (_step == 1) {
      return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Step 1 of 2 — paste your BotFather token',
            style: TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        const Text('Telegram → @BotFather → /newbot → name it → copy token.',
            style: TextStyle(fontSize: 12)),
        const SizedBox(height: 8),
        TextField(
            controller: _tgToken,
            decoration: const InputDecoration(labelText: 'Bot token')),
        const SizedBox(height: 10),
        FilledButton(
            onPressed: _busy ? null : _tgConnect,
            child: Text(_busy ? 'Checking…' : 'Connect bot')),
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
