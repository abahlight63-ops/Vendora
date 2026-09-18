// ── lib/screens/ai_screen.dart ─────────────────────────────────────
// WHAT: Vendora AI chat (POST /api/me/ask {message, model?} →
// {reply, via, model, fallback}) + model picker (GET /api/me/ai-models).
// 402 = locked premium model, 429 = daily cap — both shown, never crash.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../ads.dart';
import '../api.dart';
import '../glass.dart';
import '../motion.dart';

class AiScreen extends StatefulWidget {
  const AiScreen({super.key});

  @override
  State<AiScreen> createState() => _AiScreenState();
}

class _AiMessage {
  final bool mine;
  final String text;
  final String? meta;
  _AiMessage(this.mine, this.text, [this.meta]);
}

// Per-niche starter chips (web parity: freelancer sees gigs, baker sees
// orders — never generic examples for the wrong hustle!). Unknown niches
// fall back to _defaultChips (custom "Other" entries never break!).
const _nicheChips = {
  'Clothing, Fashion & Accessories': [
    'Write a sales caption for my new drop',
    'How do I price my outfits?',
    'Draft a reply about sizes and returns',
    'Give me 5 content ideas for this week',
  ],
  'Freelance Services': [
    'Help me price my next gig',
    'Draft a proposal for a client',
    'What should my portfolio include?',
    'Draft a reply to a late-paying client',
  ],
  'Baking, Catering & Homemade Food': [
    'Help me price per tray',
    'Write an order-deadline caption',
    'Draft a reply about custom orders',
    'Give me 5 content ideas for this week',
  ],
};

const _defaultChips = [
  'Write a sales caption for my new product',
  'Give me 5 business name ideas',
  'How do I price my products?',
  'Draft a reply to a difficult customer',
];

class _AiScreenState extends State<AiScreen> {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  final List<_AiMessage> _msgs = [];
  List<dynamic> _models = [];
  // Web parity: full-model default (complete answers, still free).
  // Server resolves null → Lite, so we pin full explicitly like the web app.
  String? _model = 'gemini-flash-full';
  bool _busy = false;
  bool _testBot = false; // false = Vendora AI (/ask), true = shop test-bot (/playground)
  Timer? _reveal; // typewriter ticker (web parity: answers write small-small)
  List<String> _chips = _defaultChips; // niche starters (loaded below!)

  @override
  void initState() {
    super.initState();
    _loadModels();
    _loadChips();
  }

  /// Niche starters: same labels as the setup picker (exact match, else
  /// generic — the backend ALSO seeds examples from the niche, belt + braces!).
  Future<void> _loadChips() async {
    try {
      final me = await ApiClient.instance.me();
      final biz = (me['business'] as Map?)?.cast<String, dynamic>();
      final niche = '${biz?['business_niche'] ?? ''}';
      final hit = _nicheChips[niche];
      if (mounted && hit != null) setState(() => _chips = hit);
    } catch (_) {
      // Offline → generic chips (never block the screen!).
    }
  }

  @override
  void dispose() {
    _reveal?.cancel(); // stop typing on exit (no setState on dead widget)
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _loadModels() async {
    try {
      _models = await ApiClient.instance.aiModels();
      // Backend without our default id (older server) → fall back to Auto
      // instead of sending an id the server calls "Unknown AI".
      final ids = {for (final m in _models) '${(m as Map)['id']}'};
      if (_model != null && !ids.contains(_model)) _model = null;
      if (mounted) setState(() {});
    } catch (_) {
      // Models optional — default still chats.
    }
  }

  void _jump() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(_scroll.position.maxScrollExtent,
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeOut);
      }
    });
  }

  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.isEmpty || _busy) return;
    _input.clear();
    await _sendWith(text, List<_AiMessage>.from(_msgs));
  }

  /// Progressive reveal (web parity): the answer writes small-small instead
  /// of dumping all at once. [_busy] stays true until typing finishes, so
  /// send/regenerate stay locked and the scroll keeps following downward.
  void _revealReply(String full, String? meta) {
    _reveal?.cancel();
    var n = 0;
    final idx = _msgs.length; // bubble appended below lands exactly here
    setState(() => _msgs.add(_AiMessage(false, '', meta)));
    _jump();
    _reveal = Timer.periodic(const Duration(milliseconds: 24), (t) {
      n += 14;
      if (!mounted || idx >= _msgs.length) {
        t.cancel();
        return;
      }
      if (n >= full.length) {
        t.cancel();
        setState(() {
          _msgs[idx] = _AiMessage(false, full, meta);
          _busy = false;
        });
      } else {
        setState(
            () => _msgs[idx] = _AiMessage(false, full.substring(0, n), meta));
      }
      _jump();
    });
  }

  /// Shared sender: [base] = bubbles BEFORE this question (no duplication),
  /// history = last 12 of base so the brain sees the conversation like web.
  Future<void> _sendWith(String text, List<_AiMessage> base) async {
    _reveal?.cancel(); // new question kills any in-progress typing
    setState(() {
      _msgs
        ..clear()
        ..addAll([...base, _AiMessage(true, text)]);
      _busy = true;
    });
    _jump();
    final window =
        base.where((m) => m.meta != 'error').toList(); // error bubbles teach nothing
    final tail = window.length > 12 ? window.sublist(window.length - 12) : window;
    try {
      if (_testBot) {
        // Shop test-bot: answers AS your catalog (like a customer).
        final r = await ApiClient.instance.playground(text);
        final reply = r['reply'];
        setState(() => _msgs.add(_AiMessage(
            false,
            '${reply ?? r['reason'] ?? '…'}',
            reply == null ? 'handed to human' : null)));
      } else {
        final r = await ApiClient.instance.ask(text, _model, [
          for (final m in tail)
            {'from': m.mine ? 'you' : 'ai', 'text': m.text},
        ]);
        final meta = [
          if (r['via'] != null) 'via ${r['via']}',
          if (r['fallback'] == true) 'fallback brain',
        ].join(' · ');
        final reply = '${r['reply'] ?? ''}';
        if (reply.isEmpty) {
          setState(() =>
              _msgs.add(_AiMessage(false, '…', 'empty reply')));
        } else {
          _revealReply(reply, meta.isEmpty ? null : meta); // types out small-small; clears _busy when done
          return; // skip the finally below — typing owns _busy now
        }
      }
    } on ApiException catch (e) {
      setState(() => _msgs.add(_AiMessage(false, e.message, 'error')));
      // Web parity: daily-limit wall doubles as the sponsor moment (free tier, max once/day).
      if (e.status == 429 && mounted && !_testBot) {
        unawaited(maybeShowSponsor(context));
        _showUpgrade(); // quota wall = upgrade moment (same as the web Pro card!)
      }
    } catch (_) {
      setState(() =>
          _msgs.add(_AiMessage(false, 'No connection — try again.', 'error')));
    } finally {
      // A live typewriter owns _busy until it finishes — don't unlock early.
      if (_reveal == null || !_reveal!.isActive) {
        if (mounted) setState(() => _busy = false);
      }
      _jump();
    }
  }

  /// Quota-hit upgrade card (web GlassUpsell parity): quota context lines +
  /// billing link. The ONLY paywall affordance here — drawn, never pushy.
  Future<void> _showUpgrade() {
    return glassSheet(
      context,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(children: [
            Icon(Icons.lock_outline, size: 20),
            SizedBox(width: 8),
            Text('Daily free chats used up',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
          ]),
          const SizedBox(height: 10),
          const Text(
              '50 free chats a day — Pro never queues, and unlocks the premium brains.'),
          const SizedBox(height: 6),
          const Text('• Unlimited free AIs + 50 premium chats daily'),
          const Text('• Kimi K2, Claude + GPT-4o mini included'),
          const Text('• Zero ads, priority support'),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () => launchUrl(
                  Uri.parse('https://vendorabot.vercel.app/billing'),
                  mode: LaunchMode.externalApplication),
              child: const Text('See upgrade options'),
            ),
          ),
        ],
      ),
    );
  }

  /// Web parity: short/weak answer → re-ask the last question.
  Future<void> _regenerate() async {
    if (_busy || _msgs.isEmpty || _testBot) return;
    final idx = _msgs.lastIndexWhere((m) => m.mine);
    if (idx < 0) return;
    await _sendWith(_msgs[idx].text, _msgs.sublist(0, idx));
  }

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      // Mode toggle (web: /vendora-ai vs /playground pages).
      Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
        child: SegmentedButton<bool>(
          segments: const [
            ButtonSegment(value: false, label: Text('Vendora AI')),
            ButtonSegment(value: true, label: Text('Test bot')),
          ],
          selected: {_testBot},
          onSelectionChanged: (s) => setState(() {
            _testBot = s.first;
            if (_testBot) {
              _model = null; // test-bot takes no model (server catalog chain)
            } else if (_model == null) {
              _model = 'gemini-flash-full'; // back to AI → restore full default
            }
          }),
        ),
      ),
      if (_models.isNotEmpty && !_testBot)
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
          child: DropdownButtonFormField<String>(
            initialValue: _model,
            decoration: const InputDecoration(labelText: 'Brain (optional)'),
            items: [
              const DropdownMenuItem(
                  value: null, child: Text('Auto (recommended)')),
              for (final m in _models)
                DropdownMenuItem(
                  value: '${(m as Map)['id']}',
                  enabled: (m['locked'] != true),
                  child: Text(
                      '${m['label'] ?? m['id']}${m['locked'] == true ? ' (Locked)' : ''}'),
                ),
            ],
            onChanged: (v) => setState(() => _model = v),
          ),
        ),
      Expanded(
        child: _msgs.isEmpty
            ? Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_testBot
                          ? 'Ask like a customer — prices, stock, delivery.'
                          : 'Ask anything — stock, prices, advice.'),
                      if (!_testBot) ...[
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          alignment: WrapAlignment.center,
                          children: [
                            for (final c in _chips)
                              ActionChip(
                                label: Text(c,
                                    style:
                                        const TextStyle(fontSize: 12)),
                                onPressed: _busy
                                    ? null
                                    : () => _sendWith(
                                        c, List<_AiMessage>.from(_msgs)),
                              ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              )
            : ListView.builder(
                controller: _scroll,
                padding: const EdgeInsets.all(12),
                itemCount: _msgs.length + (_busy ? 1 : 0),
                itemBuilder: (c, i) {
                  // Web parity: typing dots while the brain thinks.
                  if (i >= _msgs.length) {
                    return const Align(
                      alignment: Alignment.centerLeft,
                      child: _TypingBubble(),
                    );
                  }
                  final m = _msgs[i];
                  return FadeSlideIn(
                    child: Align(
                      alignment: m.mine
                          ? Alignment.centerRight
                          : Alignment.centerLeft,
                      child: Container(
                        margin: const EdgeInsets.symmetric(vertical: 4),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 10),
                        constraints: BoxConstraints(
                            maxWidth:
                                MediaQuery.of(context).size.width * 0.82),
                        decoration: BoxDecoration(
                          color: m.mine
                              ? Theme.of(context).colorScheme.primary
                              : Theme.of(context).colorScheme.surface,
                          border: m.mine
                              ? null
                              : Border.all(
                                  color: Theme.of(context)
                                      .colorScheme
                                      .outline
                                      .withValues(alpha: 0.4)),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(m.text),
                              if (m.meta != null) ...[
                                const SizedBox(height: 4),
                                Text(m.meta!,
                                    style: TextStyle(
                                        fontSize: 11,
                                        color: Theme.of(context)
                                            .colorScheme
                                            .onSurface
                                            .withValues(alpha: 0.55))),
                              ],
                            ]),
                      ),
                    ),
                  );
                },
              ),
      ),
      // Web parity: manual override for short/weak replies.
      if (!_busy &&
          _msgs.isNotEmpty &&
          !_msgs.last.mine &&
          !_testBot &&
          _msgs.last.meta != 'error')
        Padding(
          padding: const EdgeInsets.only(bottom: 2),
          child: TextButton.icon(
            onPressed: _regenerate,
            icon: const Icon(Icons.refresh, size: 15),
            label: const Text('Regenerate answer',
                style: TextStyle(fontSize: 12.5)),
          ),
        ),
      Padding(
        padding: const EdgeInsets.all(12),
        child: Row(children: [
          Expanded(
            child: TextField(
              controller: _input,
              minLines: 1,
              maxLines: 4,
              decoration:
                  const InputDecoration(hintText: 'Ask Vendora AI…'),
              onSubmitted: (_) => _send(),
            ),
          ),
          const SizedBox(width: 8),
          IconButton.filled(
            onPressed: _busy ? null : _send,
            icon: _busy
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.send),
          ),
        ]),
      ),
    ]);
  }
}

// Web-parity typing bubble (typing dots while the brain thinks).
class _TypingBubble extends StatelessWidget {
  const _TypingBubble();

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          border: Border.all(
              color: Theme.of(context)
                  .colorScheme
                  .outline
                  .withValues(alpha: 0.4)),
          borderRadius: BorderRadius.circular(14),
        ),
        child: const TypingDots(),
      ),
    );
  }
}
