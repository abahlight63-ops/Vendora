// ── lib/screens/ai_screen.dart ─────────────────────────────────────
// WHAT: Chat with Velo — the general assistant. The same room the web app
// shows (frontend/src/pages/VeloSalesAI.jsx), rebuilt for a thumb:
//
//   · the brain switch in plain words — Fast / Normal / Smart, never a
//     provider name (that is not a decision a shop owner wants to make);
//   · your turn is a purple bubble on the right, the answer is prose on the
//     page itself with the mark beside it — a white card would be invisible
//     on our near-white page, which is why ChatGPT does it this way too;
//   · answers are rendered as real bullets and numbered steps, not one wall
//     of text (lib/widgets/answer_text.dart);
//   · a photo can ride along (POST /api/me/ask { image: { dataUrl } });
//   · the mark itself is the thinking indicator, so the animation always
//     answers the tap you just made.
//
// 402 = locked brain, 429 = daily cap — both shown, never a crash.
import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../brand_mark.dart';
import '../glass.dart';
import '../motion.dart';
import '../theme.dart';
import '../widgets/answer_text.dart';
import '../widgets/brand_ui.dart';

class AiScreen extends StatefulWidget {
  const AiScreen({super.key});

  @override
  State<AiScreen> createState() => _AiScreenState();
}

// ── the three words ───────────────────────────────────────────────────
// badge is the server's own grouping (src/services/aiModels.js): 'Fast' are
// the speed kings, 'Smart' the best free quality, 'Premium' the paid crown
// jewels. So "Normal" is a badge-'Smart' engine — the everyday pick — and our
// "Smart" is the paid tier. One component for both clients, one vocabulary.
class _Brain {
  final String key;
  final String label;
  final String badge;
  final String blurb;
  const _Brain(this.key, this.label, this.badge, this.blurb);
}

const _brains = [
  _Brain('fast', 'Fast', 'Fast', 'quickest answers'),
  _Brain('normal', 'Normal', 'Smart', 'balanced — the everyday pick'),
  _Brain('smart', 'Smart', 'Premium', 'deepest answers'),
];

// Used only until /api/me/ai-models answers (and if it never does): still free
// on every tier, so the chat always works on a cold start.
const _fallbackId = {
  'fast': 'gemini-flash',
  'normal': 'gemini-flash-full',
  'smart': 'gemini-flash-full',
};

_Brain _brainDef(String key) =>
    _brains.firstWhere((b) => b.key == key, orElse: () => _brains[1]);

String _brainLabel(String key) => _brainDef(key).label;

String _bucketOf(String? badge) =>
    badge == 'Premium' ? 'smart' : (badge == 'Fast' ? 'fast' : 'normal');

/// The concrete engine a bucket sends: first unlocked one, else the first.
Map<String, dynamic>? _modelFor(String key, List<dynamic> models) {
  final b = _brainDef(key);
  Map<String, dynamic>? first;
  for (final raw in models) {
    if (raw is! Map) continue;
    final m = raw.cast<String, dynamic>();
    if ('${m['badge'] ?? 'Smart'}' != b.badge) continue;
    first ??= m;
    if (m['locked'] != true) return m;
  }
  return first;
}

String _idFor(String key, List<dynamic> models) =>
    '${_modelFor(key, models)?['id'] ?? _fallbackId[key] ?? _fallbackId['normal']}';

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

/// Which glyph heads a suggestion card. The chips are written per niche, so the
/// icon is inferred from what the asker is asking FOR rather than hard-coded
/// per chip (every lane gets sensible icons for free). Same rules as the web.
IconData _chipIcon(String s) {
  final t = s.toLowerCase();
  if (RegExp(r'\bidea|ideas|brainstorm|content|outline|include|portfolio|should\b')
      .hasMatch(t)) {
    return Icons.lightbulb_outline_rounded;
  }
  if (RegExp(r'\bprice|pricing|cost|charge|rate|quote|profit|package\b').hasMatch(t)) {
    return Icons.sell_outlined;
  }
  if (RegExp(r'\breply|respond|answer|rebook|rebooking|enroll|qualify|buyer|viewing|follow|message\b')
      .hasMatch(t)) {
    return Icons.forum_outlined;
  }
  return Icons.edit_outlined;
}

class _AiMsg {
  final bool mine;
  final String text;
  final Uint8List? image; // the photo you sent (memory bytes — no file paths)
  final String? note; // the ONLY caption we show: your pick was busy
  final bool live; // still streaming in
  final bool error; // an error bubble, styled — never a bare stack trace
  const _AiMsg(
    this.mine,
    this.text, {
    this.image,
    this.note,
    this.live = false,
    this.error = false,
  });
}

class _Photo {
  final Uint8List bytes;
  final String dataUrl;
  final String name;
  const _Photo(this.bytes, this.dataUrl, this.name);
}

class _AiScreenState extends State<AiScreen> {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  final List<_AiMsg> _msgs = [];
  List<dynamic> _models = [];
  String _brain = 'normal';
  _Photo? _photo;
  bool _busy = false;
  bool _stick = true; // true = follow the answer down; false = you scrolled up
  bool _testBot = false; // false = VeloSales Ai (/ask), true = shop test-bot
  Timer? _reveal; // typewriter ticker (web parity: answers write small-small)
  List<String> _chips = _defaultChips; // niche starters (loaded below!)

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
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
    _reveal?.cancel(); // stop typing on exit (no setState on a dead widget)
    _scroll.dispose();
    _input.dispose();
    super.dispose();
  }

  Future<void> _loadModels() async {
    try {
      final models = await ApiClient.instance.aiModels();
      if (mounted) setState(() => _models = models);
    } catch (_) {
      // Models optional — the fallback id still chats.
    }
  }

  void _onScroll() {
    if (!_scroll.hasClients) return;
    final p = _scroll.position;
    if (p.maxScrollExtent - p.pixels < 90) _stick = true;
  }

  /// Follow the conversation down — but only while you are already at the
  /// bottom, so re-reading an old answer never gets yanked away mid-scroll.
  void _follow({bool force = false}) {
    if (force) _stick = true;
    if (!_stick) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_scroll.hasClients) return;
      _scroll.jumpTo(_scroll.position.maxScrollExtent);
    });
  }

  // ── photos ──────────────────────────────────────────────────────────
  Future<void> _pickPhoto() async {
    if (_busy) return;
    try {
      final picked = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        maxWidth: 1280, // 1280px on the long edge — plenty for the model,
        maxHeight: 1280, // and it keeps the JSON payload small
        imageQuality: 82,
      );
      if (picked == null) return; // cancelled the picker — nothing to do
      final bytes = await picked.readAsBytes();
      if (bytes.length > 12 * 1024 * 1024) {
        if (mounted) showToast(context, 'That photo is too large (max 12MB)', type: 'err');
        return;
      }
      if (!mounted) return;
      setState(() => _photo = _Photo(
            bytes,
            'data:${_mimeOf(picked)};base64,${base64Encode(bytes)}',
            picked.name,
          ));
    } catch (_) {
      if (mounted) showToast(context, 'Could not read that photo — try another.', type: 'err');
    }
  }

  /// The server accepts jpeg / png / webp / gif. Pickers sometimes hand back a
  /// null mimeType, so the filename is the fallback rather than a blind guess.
  String _mimeOf(XFile f) {
    final m = f.mimeType;
    if (m != null && m.startsWith('image/')) return m;
    final n = f.name.toLowerCase();
    if (n.endsWith('.png')) return 'image/png';
    if (n.endsWith('.webp')) return 'image/webp';
    if (n.endsWith('.gif')) return 'image/gif';
    return 'image/jpeg';
  }

  // ── sending ─────────────────────────────────────────────────────────
  Future<void> _send() async {
    final text = _input.text.trim();
    final photo = _photo;
    if ((text.isEmpty && photo == null) || _busy) return;
    _input.clear();
    setState(() => _photo = null);
    await _sendWith(text, List<_AiMsg>.from(_msgs), photo: photo);
  }

  /// Progressive reveal (web parity): the answer writes small-small instead
  /// of dumping all at once. [_busy] stays true until typing finishes, so
  /// send/regenerate stay locked and the scroll keeps following downward.
  void _revealReply(String full, String? note) {
    _reveal?.cancel();
    var n = 0;
    final idx = _msgs.length; // the answer lands exactly here
    setState(() => _msgs.add(_AiMsg(false, '', note: note, live: true)));
    _follow(force: true);
    _reveal = Timer.periodic(const Duration(milliseconds: 22), (t) {
      n += 18;
      if (!mounted || idx >= _msgs.length) {
        t.cancel();
        return;
      }
      if (n >= full.length) {
        t.cancel();
        setState(() {
          _msgs[idx] = _AiMsg(false, full, note: note);
          _busy = false;
        });
      } else {
        setState(() => _msgs[idx] = _AiMsg(false, full.substring(0, n),
            note: note, live: true));
      }
      _follow();
    });
  }

  /// Shared sender: [base] = bubbles BEFORE this question (no duplication),
  /// history = last 12 of base so the brain sees the conversation like web.
  Future<void> _sendWith(String text, List<_AiMsg> base, {_Photo? photo}) async {
    _reveal?.cancel(); // new question kills any in-progress typing
    final pickedKey = _brain;
    setState(() {
      _msgs
        ..clear()
        ..addAll([
          ...base,
          _AiMsg(true, text, image: photo?.bytes),
        ]);
      _busy = true;
    });
    _follow(force: true);

    final window = base.where((m) => !m.error).toList(); // error bubbles teach nothing
    final tail = window.length > 12 ? window.sublist(window.length - 12) : window;

    try {
      if (_testBot) {
        // Shop test-bot: answers AS your catalog (like a customer).
        final r = await ApiClient.instance.playground(text);
        final reply = r['reply'];
        setState(() => _msgs.add(_AiMsg(
              false,
              '${reply ?? r['reason'] ?? '…'}',
              note: reply == null ? 'handed to a human' : null,
            )));
      } else {
        final r = await ApiClient.instance.ask(
          text,
          _idFor(pickedKey, _models),
          [
            for (final m in tail)
              {'from': m.mine ? 'you' : 'ai', 'text': m.text},
          ],
          photo == null ? null : {'dataUrl': photo.dataUrl},
        );
        final reply = '${r['reply'] ?? ''}';
        if (reply.isEmpty) {
          setState(() => _msgs.add(const _AiMsg(
              false, 'The answer came back empty — try asking again.',
              error: true)));
        } else {
          _revealReply(reply, _fallbackNote(r, pickedKey));
          return; // typing owns _busy now
        }
      }
    } on ApiException catch (e) {
      setState(() => _msgs.add(_AiMsg(false, e.message, error: true)));
      if (e.status == 429 && mounted && !_testBot) _showUpgrade();
    } catch (_) {
      setState(() => _msgs.add(const _AiMsg(
          false, 'No connection — check your data and try again.',
          error: true)));
    } finally {
      // A live typewriter owns _busy until it finishes — don't unlock early.
      if (_reveal == null || !_reveal!.isActive) {
        if (mounted) setState(() => _busy = false);
      }
      _follow();
    }
  }

  /// Only one caption ever appears: when the server had to swap the brain out.
  /// A normal answer speaks for itself (no "via Gemini" noise).
  String? _fallbackNote(Map<String, dynamic> r, String pickedKey) {
    if (r['fallback'] != true) return null;
    final via = '${r['via'] ?? ''}';
    String? viaKey;
    for (final raw in _models) {
      if (raw is! Map) continue;
      if ('${raw['label']}' == via) {
        viaKey = _bucketOf('${raw['badge']}');
        break;
      }
    }
    if (viaKey != null && viaKey != pickedKey) {
      return '${_brainLabel(pickedKey)} was busy — ${_brainLabel(viaKey)} answered instead.';
    }
    return 'Your pick was busy — a backup brain answered.';
  }

  /// Web parity: short/weak answer → re-ask the last question.
  Future<void> _regenerate() async {
    if (_busy || _msgs.isEmpty || _testBot) return;
    final idx = _msgs.lastIndexWhere((m) => m.mine);
    if (idx < 0) return;
    await _sendWith(_msgs[idx].text, _msgs.sublist(0, idx));
  }

  void _newChat() {
    _reveal?.cancel();
    setState(() {
      _msgs.clear();
      _photo = null;
      _busy = false;
      _input.clear();
    });
    _stick = true;
  }

  Future<void> _copy(String text) async {
    await Clipboard.setData(ClipboardData(text: text));
    if (mounted) showToast(context, 'Copied');
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
          const Text('• Smart, Normal and Fast modes included'),
          const Text('• Zero ads, priority support'),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () => launchUrl(Uri.parse(ApiClient.billingUrl),
                  mode: LaunchMode.externalApplication),
              child: const Text('See upgrade options'),
            ),
          ),
        ],
      ),
    );
  }

  // ── build ───────────────────────────────────────────────────────────
  bool get _waiting => _busy && (_msgs.isEmpty || _msgs.last.mine);

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final wide = MediaQuery.of(context).size.width;
    // On a tablet (or the web build) the room stops growing at 780px — the same
    // reading column the desktop web app uses.
    final gutter = wide > 820 ? (wide - 780) / 2 : 14.0;

    return Column(
      children: [
        _topBar(context),
        Expanded(
          child: _msgs.isEmpty && !_testBot
              ? _emptyState(context)
              : _testBot && _msgs.isEmpty
                  ? _testEmptyState(context)
                  : NotificationListener<ScrollNotification>(
                      onNotification: (n) {
                        if (n is ScrollUpdateNotification &&
                            (n.dragDetails != null || n.scrollDelta != null)) {
                          final p = _scroll.position;
                          _stick = p.maxScrollExtent - p.pixels < 90;
                        }
                        return false;
                      },
                      child: ListView.builder(
                        controller: _scroll,
                        padding: EdgeInsets.fromLTRB(gutter, 10, gutter, 10),
                        itemCount: _msgs.length + (_waiting ? 1 : 0),
                        itemBuilder: (c, i) {
                          if (i >= _msgs.length) return const _ThinkingRow();
                          final m = _msgs[i];
                          final last = i == _msgs.length - 1;
                          return Padding(
                            padding: EdgeInsets.only(bottom: last ? 2 : 20),
                            child: FadeSlideIn(
                              key: ValueKey('m$i'),
                              child: m.mine
                                  ? _YouBubble(m)
                                  : _AiAnswer(
                                      m,
                                      isLast: last,
                                      onCopy: () => _copy(m.text),
                                      onRegenerate:
                                          _busy || _testBot ? null : _regenerate,
                                    ),
                            ),
                          );
                        },
                      ),
                    ),
        ),
        _composer(context),
        // A quiet line, exactly like the web: the assistant is useful, not
        // infallible, and the chat is not stored.
        Padding(
          padding: EdgeInsets.fromLTRB(gutter, 0, gutter, 2),
          child: Text(
            'VeloSales Ai can make mistakes — double-check important facts.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 11, color: scheme.onSurface.withValues(alpha: 0.42)),
          ),
        ),
        SizedBox(height: 6),
      ],
    );
  }

  // ── the top row: which brain, and the way back out of test mode ──────
  Widget _topBar(BuildContext context) {
    if (_testBot) {
      final scheme = Theme.of(context).colorScheme;
      return Padding(
        padding: const EdgeInsets.fromLTRB(14, 8, 8, 0),
        child: Container(
          padding: const EdgeInsets.fromLTRB(12, 4, 4, 4),
          decoration: BoxDecoration(
            color: VeloSalesTheme.tintSky(context),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Row(children: [
            Icon(Icons.smart_toy_outlined, size: 17, color: scheme.primary),
            const SizedBox(width: 8),
            const Expanded(
              child: Text('Customer view — this is what your bot answers',
                  style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600)),
            ),
            TextButton(
              onPressed: () => setState(() {
                _testBot = false;
                _msgs.clear();
              }),
              child: const Text('Exit', style: TextStyle(fontSize: 12.5)),
            ),
          ]),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 8, 6, 0),
      child: Row(children: [
        _BrainSwitch(
          models: _models,
          value: _brain,
          onPick: (k) {
            setState(() => _brain = k);
            showToast(context, '${_brainLabel(k)} answers');
          },
          onLocked: _showUpgrade,
        ),
        const Spacer(),
        if (_msgs.isNotEmpty)
          IconButton(
            tooltip: 'New chat',
            visualDensity: VisualDensity.compact,
            icon: const Icon(Icons.add_comment_outlined, size: 19),
            onPressed: _busy ? null : _newChat,
          ),
        IconButton(
          tooltip: 'Test your bot as a customer',
          visualDensity: VisualDensity.compact,
          icon: const Icon(Icons.smart_toy_outlined, size: 20),
          onPressed: () => setState(() {
            _testBot = true;
            _msgs.clear();
          }),
        ),
      ]),
    );
  }

  // ── empty state ─────────────────────────────────────────────────────
  Widget _emptyState(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(18, 12, 18, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const _Orb(size: 72),
            const SizedBox(height: 18),
            Text(
              "Hello! I'm VeloSales Ai",
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 21,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.5,
                color: scheme.onSurface,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'How can I help your business today? Ask about pricing, captions or customers — or send a photo.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13.5,
                height: 1.5,
                color: scheme.onSurface.withValues(alpha: 0.62),
              ),
            ),
            const SizedBox(height: 26),
            Align(
              alignment: Alignment.centerLeft,
              child: Padding(
                padding: const EdgeInsets.only(left: 4, bottom: 10),
                child: Text(
                  'SUGGESTED',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.9,
                    color: scheme.onSurface.withValues(alpha: 0.42),
                  ),
                ),
              ),
            ),
            for (var i = 0; i < _chips.length; i++)
              Padding(
                padding: EdgeInsets.only(bottom: i == _chips.length - 1 ? 0 : 10),
                child: FadeSlideIn(
                  delayMs: i * 55,
                  child: _SuggestCard(
                    label: _chips[i],
                    onTap: () => _sendWith(_chips[i], List<_AiMsg>.from(_msgs)),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _testEmptyState(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const _Orb(size: 62),
            const SizedBox(height: 16),
            Text('Ask like a customer',
                style: TextStyle(
                    fontSize: 19,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.4,
                    color: scheme.onSurface)),
            const SizedBox(height: 7),
            Text(
              'Prices, stock and delivery — answered from your catalog, exactly as a buyer would hear it.',
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 13.5,
                  height: 1.5,
                  color: scheme.onSurface.withValues(alpha: 0.62)),
            ),
          ],
        ),
      ),
    );
  }

  // ── composer ────────────────────────────────────────────────────────
  Widget _composer(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 6, 14, 0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_photo != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Container(
                    padding: const EdgeInsets.fromLTRB(8, 6, 4, 6),
                    decoration: BoxDecoration(
                      color: scheme.surface,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: scheme.outline),
                    ),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(9),
                        child: Image.memory(_photo!.bytes,
                            width: 40, height: 40, fit: BoxFit.cover),
                      ),
                      const SizedBox(width: 10),
                      ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 170),
                        child: Text(
                          _photo!.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontSize: 12.5, fontWeight: FontWeight.w600),
                        ),
                      ),
                      IconButton(
                        visualDensity: VisualDensity.compact,
                        tooltip: 'Remove photo',
                        icon: const Icon(Icons.close_rounded, size: 17),
                        onPressed: () => setState(() => _photo = null),
                      ),
                    ]),
                  ),
                ),
              ),
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: scheme.surface,
                borderRadius: BorderRadius.circular(22),
                border: Border.all(color: scheme.outline),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 12,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  IconButton(
                    tooltip: 'Attach a photo',
                    visualDensity: VisualDensity.compact,
                    onPressed: _busy || _testBot ? null : _pickPhoto,
                    icon: Icon(Icons.photo_camera_outlined,
                        size: 20,
                        color: scheme.onSurface.withValues(alpha: 0.62)),
                  ),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      child: TextField(
                        controller: _input,
                        minLines: 1,
                        maxLines: 5,
                        textCapitalization: TextCapitalization.sentences,
                        decoration: InputDecoration.collapsed(
                          hintText: 'Ask anything…',
                          hintStyle: TextStyle(
                            fontSize: 14.5,
                            color: scheme.onSurface.withValues(alpha: 0.46),
                          ),
                        ),
                        style: const TextStyle(fontSize: 14.5, height: 1.45),
                        onChanged: (_) => setState(() {}), // enables the send button
                        onTapOutside: (_) =>
                            FocusManager.instance.primaryFocus?.unfocus(),
                      ),
                    ),
                  ),
                  const SizedBox(width: 4),
                  _SendButton(
                    enabled: !_busy && (_input.text.trim().isNotEmpty || _photo != null),
                    onTap: _send,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── pieces ────────────────────────────────────────────────────────────

/// The brand's single hero highlight: the ramp in a circle with the mark in
/// white — the same treatment, and the same numbers, as the web's chat orb.
class _Orb extends StatelessWidget {
  final double size;
  const _Orb({required this.size});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: const LinearGradient(
          begin: Alignment(-0.6, -1),
          end: Alignment(0.6, 1),
          stops: [0, 0.38, 1],
          colors: [Color(0xFF818CF8), Color(0xFF6366F1), Color(0xFF4338CA)],
        ),
        boxShadow: [
          BoxShadow(
            color: VeloSalesTheme.purple.withValues(alpha: 0.45),
            blurRadius: 26,
            spreadRadius: -6,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Center(child: BrandMark(size: size * 0.45, solid: Colors.white)),
    );
  }
}

/// Fast / Normal / Smart as one segmented pill. A locked bucket is SHOWN with
/// a lock, never silently swapped — tapping it opens the upgrade card.
class _BrainSwitch extends StatelessWidget {
  final List<dynamic> models;
  final String value;
  final ValueChanged<String> onPick;
  final VoidCallback onLocked;

  const _BrainSwitch({
    required this.models,
    required this.value,
    required this.onPick,
    required this.onLocked,
  });

  /// The track behind the three words. It has to sit BELOW the active pill in
  /// both themes: light darkens the page colour slightly, but dark already has
  /// the darkest page in the palette, so the track IS the page there.
  Color _track(BuildContext c) {
    final s = Theme.of(c).colorScheme;
    return Theme.of(c).brightness == Brightness.dark
        ? s.surfaceContainerLowest
        : Color.lerp(s.surfaceContainerLowest, s.onSurface, 0.055)!;
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final ready = models.isNotEmpty;

    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: _track(context),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: scheme.outline.withValues(alpha: 0.7)),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        for (final b in _brains)
          Builder(builder: (context) {
            final m = _modelFor(b.key, models);
            final locked = ready && (m == null || m['locked'] == true);
            final on = value == b.key;
            return Pressable(
              onTap: locked ? onLocked : () => onPick(b.key),
              radius: BorderRadius.circular(999),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 160),
                curve: Curves.easeOut,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                height: 32,
                decoration: BoxDecoration(
                  color: on ? scheme.surface : Colors.transparent,
                  borderRadius: BorderRadius.circular(999),
                  boxShadow: on
                      ? [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.06),
                            blurRadius: 6,
                            offset: const Offset(0, 1),
                          ),
                        ]
                      : null,
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Text(
                    b.label,
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: on
                          ? scheme.primary
                          : scheme.onSurface.withValues(alpha: locked ? 0.4 : 0.6),
                    ),
                  ),
                  if (locked) ...[
                    const SizedBox(width: 4),
                    Icon(Icons.lock_outline,
                        size: 11, color: VeloSalesTheme.gold.withValues(alpha: 0.9)),
                  ],
                ]),
              ),
            );
          }),
      ]),
    );
  }
}

class _SuggestCard extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  const _SuggestCard({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final icon = _chipIcon(label);
    late final Color chip;
    late final Color ink;
    if (icon == Icons.sell_outlined) {
      chip = VeloSalesTheme.gold.withValues(alpha: 0.13); // money → amber
      ink = VeloSalesTheme.gold;
    } else if (icon == Icons.lightbulb_outline_rounded) {
      chip = VeloSalesTheme.tintSky(context); // ideas → sky
      ink = const Color(0xFF0284C7);
    } else {
      chip = VeloSalesTheme.tintLavender(context); // writing & replies → purple
      ink = scheme.primary;
    }

    return Pressable(
      onTap: onTap,
      radius: BorderRadius.circular(16),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
        decoration: BoxDecoration(
          color: scheme.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: scheme.outline),
        ),
        child: Row(children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: chip,
              borderRadius: BorderRadius.circular(11),
            ),
            child: Icon(icon, size: 18, color: ink),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 13.5,
                height: 1.35,
                fontWeight: FontWeight.w500,
                color: scheme.onSurface,
              ),
            ),
          ),
          const SizedBox(width: 6),
          Icon(Icons.arrow_forward_rounded,
              size: 15, color: scheme.onSurface.withValues(alpha: 0.34)),
        ]),
      ),
    );
  }
}

/// Your turn: the purple bubble. Purple is your voice — the answer does not
/// get one, because a white bubble on a near-white page is invisible.
class _YouBubble extends StatelessWidget {
  final _AiMsg m;
  const _YouBubble(this.m);

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final width = MediaQuery.of(context).size.width;
    return Align(
      alignment: Alignment.centerRight,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: width * 0.82),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
          decoration: BoxDecoration(
            color: VeloSalesTheme.tintLavender(context),
            border: Border.all(color: scheme.primary.withValues(alpha: 0.3)),
            borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(18),
              topRight: Radius.circular(18),
              bottomLeft: Radius.circular(18),
              bottomRight: Radius.circular(6),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (m.image != null) ...[
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 230, maxHeight: 230),
                    child: Image.memory(m.image!, fit: BoxFit.cover),
                  ),
                ),
                if (m.text.isNotEmpty) const SizedBox(height: 9),
              ],
              if (m.text.isNotEmpty)
                Text(
                  m.text,
                  style: TextStyle(
                    fontSize: 14.5,
                    height: 1.55,
                    color: scheme.onSurface,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The answer: the mark, then prose with Copy / Regenerate underneath.
class _AiAnswer extends StatelessWidget {
  final _AiMsg m;
  final bool isLast;
  final VoidCallback onCopy;
  final VoidCallback? onRegenerate;

  const _AiAnswer(
    this.m, {
    required this.isLast,
    required this.onCopy,
    this.onRegenerate,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.only(top: 2),
          child: BrandMark(size: 25),
        ),
        const SizedBox(width: 11),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (m.error)
                _ErrorNote(m.text)
              else
                AnswerText(m.text, live: m.live),
              if (m.note != null) ...[
                const SizedBox(height: 10),
                Text(
                  m.note!,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: VeloSalesTheme.gold,
                  ),
                ),
              ],
              if (!m.live && m.text.isNotEmpty && !m.error)
                Padding(
                  padding: const EdgeInsets.only(top: 4, left: 0),
                  child: Row(children: [
                    _Act(
                      icon: Icons.copy_rounded,
                      label: 'Copy',
                      onTap: onCopy,
                    ),
                    if (isLast && onRegenerate != null)
                      _Act(
                        icon: Icons.refresh_rounded,
                        label: 'Regenerate',
                        onTap: onRegenerate!,
                      ),
                  ]),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Act extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _Act({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final muted = scheme.onSurface.withValues(alpha: 0.45);
    return Pressable(
      onTap: onTap,
      radius: BorderRadius.circular(9),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 14, color: muted),
          const SizedBox(width: 5),
          Text(label,
              style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: muted)),
        ]),
      ),
    );
  }
}

/// An error is a styled note in the conversation, not a broken screen.
class _ErrorNote extends StatelessWidget {
  final String text;
  const _ErrorNote(this.text);

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: scheme.error.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: scheme.error.withValues(alpha: 0.28)),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(Icons.error_outline, size: 17, color: scheme.error),
        const SizedBox(width: 9),
        Expanded(
          child: Text(
            text,
            style: TextStyle(fontSize: 13.5, height: 1.5, color: scheme.onSurface),
          ),
        ),
      ]),
    );
  }
}

/// Thinking: the mark, exhaling. It answers the send you just made and stops
/// the moment words start arriving, so it reads as a state, not decoration.
class _ThinkingRow extends StatefulWidget {
  const _ThinkingRow();

  @override
  State<_ThinkingRow> createState() => _ThinkingRowState();
}

class _ThinkingRowState extends State<_ThinkingRow>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 1700))
      ..repeat();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final faint = scheme.onSurface.withValues(alpha: 0.55);
    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        final t = _c.value;
        // 0 → 1 → 0, eased: a breath, not a throb.
        final pulse = Curves.easeInOut.transform(t < 0.5 ? t * 2 : (1 - t) * 2);
        return Row(children: [
          Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const LinearGradient(
                begin: Alignment(-0.6, -1),
                end: Alignment(0.6, 1),
                stops: [0, 0.38, 1],
                colors: [Color(0xFF818CF8), Color(0xFF6366F1), Color(0xFF4338CA)],
              ),
              boxShadow: [
                BoxShadow(
                  color: VeloSalesTheme.purple.withValues(alpha: 0.4 * (1 - pulse)),
                  blurRadius: 2 + 12 * pulse,
                  spreadRadius: 1 + 6 * pulse,
                ),
              ],
            ),
            child: Transform.scale(
              scale: 1 + 0.05 * pulse,
              child: Center(child: BrandMark(size: 14, solid: Colors.white)),
            ),
          ),
          const SizedBox(width: 12),
          ShaderMask(
            blendMode: BlendMode.srcIn,
            shaderCallback: (r) => LinearGradient(
              begin: Alignment(-1.6 + 3.2 * t, 0),
              end: Alignment(-0.6 + 3.2 * t, 0),
              colors: [faint, faint, scheme.primary, faint, faint],
              stops: const [0, 0.30, 0.5, 0.70, 1],
            ).createShader(r),
            child: Text(
              'Thinking…',
              style: TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w700,
                color: scheme.onSurface, // masked to the gradient above
              ),
            ),
          ),
        ]);
      },
    );
  }
}

class _SendButton extends StatelessWidget {
  final bool enabled;
  final VoidCallback onTap;
  const _SendButton({required this.enabled, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return AnimatedOpacity(
      duration: const Duration(milliseconds: 150),
      opacity: enabled ? 1 : 0.35,
      child: Pressable(
        onTap: enabled ? onTap : null,
        radius: BorderRadius.circular(999),
        child: Container(
          width: 38,
          height: 38,
          decoration: const BoxDecoration(
            color: VeloSalesTheme.accentSolid, // white text/icon works in both themes
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.arrow_upward_rounded,
              size: 19, color: Colors.white),
        ),
      ),
    );
  }
}
