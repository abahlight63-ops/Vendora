// ── lib/screens/ai_settings_screen.dart ───────────────────────────
// WHAT: the phone twin of the web's AI settings page. Three jobs, in the order
// an owner cares about them:
//   1. WHICH AI answers customers — Fast / Normal / Smart only. The engines
//      behind those three words are an implementation detail (and they change
//      with price and availability), so the screen never names one.
//   2. HOW it talks — personality, greeting, human handoff, each with a live
//      preview of the bubble the customer actually receives.
//   3. WHAT it's allowed to do about money — SmartDeal % and minimum order.
//
// DATA: /api/me (the current words), /api/me/ai-models (tiers + locks) and
// /api/me/channels (which tier this shop is on today). Saving mirrors the web:
// the business row first (its PUT validates a whole row), then the settings row.
import 'package:flutter/material.dart';

import '../api.dart';
import '../glass.dart';
import '../motion.dart';
import '../theme.dart';
import '../widgets/app_select.dart';
import '../widgets/brand_ui.dart';

/// The shop's voice. Stored values stay plain lower-case text (the server has
/// always accepted free text); the phone only ever shows the readable label.
const _tonePresets = [
  AppSelectOption(
      value: 'warm and friendly',
      label: 'Warm and friendly',
      hint: 'Greets people, never rushes them'),
  AppSelectOption(
      value: 'friendly and helpful',
      label: 'Friendly and helpful',
      hint: 'The balanced default — clear and kind'),
  AppSelectOption(
      value: 'short and businesslike',
      label: 'Short and businesslike',
      hint: 'Price, stock, next step. No small talk'),
  AppSelectOption(
      value: 'playful market aunty',
      label: 'Playful market aunty',
      hint: 'Local warmth and light teasing, always respectful'),
  AppSelectOption(
      value: 'calm and respectful',
      label: 'Calm and respectful',
      hint: 'Gentle and patient — good for premium goods'),
];

String _canonicalTone(String raw) {
  final t = raw.trim();
  for (final o in _tonePresets) {
    if (o.value.toLowerCase() == t.toLowerCase()) return o.value;
  }
  return t.isEmpty ? 'friendly and helpful' : t;
}

/// The three tiers, in the owner's words. One list, so the labels and blurbs
/// cannot drift between the chat, Connect and this page.
const _tiers = [
  (
    key: 'fast',
    label: 'Fast',
    blurb: 'Quickest answers',
    forWhat: [
      'Prices, stock and opening hours',
      '“Where are you?” and “How much?”',
      'When a customer is in a hurry',
    ],
  ),
  (
    key: 'normal',
    label: 'Normal',
    blurb: 'Balanced — the everyday pick',
    forWhat: [
      'Most days, most conversations',
      'Prices, sizes, delivery and follow-ups',
      'The best balance of speed and depth',
    ],
  ),
  (
    key: 'smart',
    label: 'Smart',
    blurb: 'Deepest answers, a little slower',
    forWhat: [
      'Tricky bargaining and long questions',
      'Writing captions and offers for you',
      'When quality matters more than speed',
    ],
  ),
];

String _bucketOf(String? badge) {
  if (badge == 'Premium') return 'smart';
  if (badge == 'Fast') return 'fast';
  return 'normal';
}

class AiSettingsScreen extends StatefulWidget {
  const AiSettingsScreen({super.key});

  @override
  State<AiSettingsScreen> createState() => _AiSettingsScreenState();
}

class _AiSettingsScreenState extends State<AiSettingsScreen> {
  final _tone = TextEditingController();
  final _greeting = TextEditingController();
  final _handoff = TextEditingController();
  final _discount = TextEditingController();
  final _minOrder = TextEditingController();

  Map<String, dynamic>? _me;
  List<dynamic> _models = const [];
  String _tier = 'normal';
  String _currency = 'NGN';
  bool _loading = true;
  bool _saving = false;
  bool _dirty = false;
  String? _err;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _tone.dispose();
    _greeting.dispose();
    _handoff.dispose();
    _discount.dispose();
    _minOrder.dispose();
    super.dispose();
  }

  /// Keeps an older custom sentence selectable instead of silently replacing
  /// it the first time the sheet opens.
  List<AppSelectOption> get _toneOptions {
    final cur = _tone.text.trim();
    if (cur.isEmpty || _tonePresets.any((o) => o.value == cur)) {
      return _tonePresets;
    }
    return [
      AppSelectOption(
          value: cur,
          label: cur,
          hint: 'Your saved style — pick one to simplify'),
      ..._tonePresets,
    ];
  }

  String get _toneHint {
    final cur = _tone.text.trim();
    for (final o in _toneOptions) {
      if (o.value == cur) return o.hint ?? 'Pick how your shop should sound.';
    }
    return 'Pick how your shop should sound.';
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _err = null;
    });
    try {
      final both = await Future.wait([
        ApiClient.instance.me(),
        ApiClient.instance.channels(),
      ]);
      final me = both[0];
      final ch = both[1];
      final wa = (ch['whatsapp'] as Map?)?.cast<String, dynamic>();
      // Read the models list separately: a plan-gated catalog must not take
      // the whole page down (the tier tiles simply stay unlocked-unknown).
      List<dynamic> models = const [];
      try {
        models = await ApiClient.instance.aiModels();
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _me = me;
        _models = models;
        _currency = '${me['currency'] ?? 'NGN'}';
        _tone.text = _canonicalTone('${me['tone'] ?? ''}');
        _greeting.text = '${me['greeting_msg'] ?? ''}';
        _handoff.text = '${me['handoff_msg'] ?? 'Thanks for your message! A member of our team will get back to you shortly.'}';
        _discount.text = '${_numOr(me['max_discount_pct'], 0)}';
        _minOrder.text = '${_numOr(me['min_order_naira'], 0)}';
        final id = '${wa?['model'] ?? ''}';
        if (id.isNotEmpty) {
          final hit = models.where((m) => (m as Map)['id'] == id).toList();
          if (hit.isNotEmpty) _tier = _bucketOf('${(hit.first as Map)['badge']}');
        }
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _err = e.message);
    } catch (_) {
      if (mounted) setState(() => _err = 'No connection — your settings are safe.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  num _numOr(dynamic v, num fallback) => num.tryParse('$v') ?? fallback;

  /// The concrete engine id a tier sends (first unlocked one in that bucket).
  /// Only the id crosses the wire; no engine name is ever rendered.
  String? _idFor(String key) {
    final badge = key == 'fast' ? 'Fast' : key == 'smart' ? 'Premium' : 'Smart';
    final inBucket = _models
        .where((m) => '${(m as Map)['badge'] ?? 'Smart'}' == badge)
        .toList();
    if (inBucket.isEmpty) return null;
    final open = inBucket.firstWhere(
        (m) => (m as Map)['locked'] != true,
        orElse: () => inBucket.first);
    return '${(open as Map)['id']}';
  }

  bool _locked(String key) {
    if (_models.isEmpty) return false; // unknown ≠ locked (never block on a slow load)
    final badge = key == 'fast' ? 'Fast' : key == 'smart' ? 'Premium' : 'Smart';
    final inBucket =
        _models.where((m) => '${(m as Map)['badge'] ?? 'Smart'}' == badge).toList();
    return inBucket.isEmpty || inBucket.every((m) => (m as Map)['locked'] == true);
  }

  Future<void> _pick(String key) async {
    if (_locked(key)) {
      showToast(context, 'That tier needs the top plan — see Billing.', type: 'err');
      return;
    }
    final id = _idFor(key);
    if (id == null) {
      showToast(context, 'Models are still loading — try again in a moment.', type: 'err');
      return;
    }
    final prev = _tier;
    setState(() => _tier = key); // optimistic: the tile moves under the finger
    try {
      await ApiClient.instance.whatsappModel(id);
      if (!mounted) return;
      showToast(context,
          '${key[0].toUpperCase()}${key.substring(1)} is answering now');
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _tier = prev); // failed → never lie about what is live
      showToast(context, e.message, type: 'err');
    } catch (_) {
      if (!mounted) return;
      setState(() => _tier = prev);
      showToast(context, 'No connection — the old tier is still live.', type: 'err');
    }
  }

  Future<void> _save() async {
    final me = _me;
    if (me == null) return;
    setState(() => _saving = true);
    try {
      // Business row first: its PUT validates the whole record, so every field
      // it owns has to travel with the call (the web does exactly this).
      await ApiClient.instance.updateBusiness({
        'name': me['name'],
        'owner_number': me['owner_number'],
        'hours': me['hours'],
        'faq': me['faq'],
        'tone': _tone.text.trim().isEmpty ? 'friendly and helpful' : _tone.text.trim(),
      });
      await ApiClient.instance.updateSettings({
        'max_discount_pct': _numOr(_discount.text.trim(), 0),
        'min_order_naira': _numOr(_minOrder.text.trim(), 0),
        'greeting_msg': _greeting.text.trim(),
        'handoff_msg': _handoff.text.trim(),
      });
      if (!mounted) return;
      setState(() => _dirty = false);
      showToast(context, 'AI settings saved — your voice is live.');
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, type: 'err');
    } catch (_) {
      if (mounted) showToast(context, 'Could not save — check your connection.', type: 'err');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _edited() {
    if (!_dirty) setState(() => _dirty = true);
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: const Text('AI settings'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: VeloSalesTheme.green.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  '${_tier[0].toUpperCase()}${_tier.substring(1)} live',
                  style: const TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w800,
                      color: VeloSalesTheme.greenDark),
                ),
              ),
            ),
          ),
        ],
      ),
      body: _loading
          ? const _AiSettingsSkeleton()
          : _err != null
              ? EmptyState('Could not load AI settings', _err!, retry: _load)
              : RefreshIndicator(onRefresh: _load, child: _body(scheme)),
      bottomNavigationBar: (_loading || _err != null)
          ? null
          : SafeArea(
              minimum: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: Row(children: [
                Expanded(
                  child: Text(
                    _dirty ? 'Unsaved changes' : 'Everything saved',
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: _dirty ? VeloSalesTheme.gold : scheme.onSurface.withValues(alpha: 0.6),
                    ),
                  ),
                ),
                SizedBox(
                  width: 170,
                  child: GradientPill(
                    label: _saving ? 'Saving…' : 'Save settings',
                    height: 48,
                    onTap: _saving || !_dirty ? null : _save,
                  ),
                ),
              ]),
            ),
    );
  }

  Widget _body(ColorScheme scheme) {
    final symbol = _currency == 'USD' ? '\$' : '₦';
    final pct = _numOr(_discount.text.trim(), 0).toDouble();
    final minOrder = _numOr(_minOrder.text.trim(), 0).toDouble();
    const sample = 21500;
    final discounted = (sample * (1 - pct / 100)).round();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 20),
      children: [
        FadeSlideIn(
          child: Text(
            'Who answers, how they sound, and what they may promise.',
            style: TextStyle(
                fontSize: 13.5,
                height: 1.5,
                color: scheme.onSurface.withValues(alpha: 0.62)),
          ),
        ),
        const SizedBox(height: 16),

        // ── 1. the brain ──────────────────────────────────────────────
        const SectionLabel('Which AI answers your customers'),
        for (var i = 0; i < _tiers.length; i++) ...[
          FadeSlideIn(
            delayMs: 60 + i * 50,
            child: Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _TierTile(
                tier: _tiers[i],
                selected: _tier == _tiers[i].key,
                locked: _locked(_tiers[i].key),
                recommended: _tiers[i].key == 'normal',
                onTap: () => _pick(_tiers[i].key),
              ),
            ),
          ),
        ],
        Padding(
          padding: const EdgeInsets.only(left: 2, top: 2),
          child: Text(
            'Three settings, not thirty models. Locked tiers run the heaviest engines — they come with the top plan.',
            style: TextStyle(
                fontSize: 12,
                height: 1.45,
                color: scheme.onSurface.withValues(alpha: 0.55)),
          ),
        ),
        const SizedBox(height: 22),

        // ── 2. personality ────────────────────────────────────────────
        const SectionLabel('Personality'),
        SoftPanel(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(
              'How the AI talks to customers. Warm and respectful is built in — choose the style closest to your shop.',
              style: TextStyle(
                  fontSize: 13,
                  height: 1.5,
                  color: scheme.onSurface.withValues(alpha: 0.62)),
            ),
            const SizedBox(height: 12),
            // One dropdown, the same control used by catalog and billing.
            // The old free-text box + chips made owners wonder whether their
            // own words counted; now the choice is explicit and one tap.
            AppSelect(
              label: 'Shop personality',
              sheetTitle: 'How should your shop sound?',
              value: _tone.text.trim(),
              options: _toneOptions,
              onChanged: (v) {
                _tone.text = v;
                _edited();
              },
            ),
            const SizedBox(height: 10),
            Text(
              _toneHint,
              style: TextStyle(
                  fontSize: 12,
                  height: 1.45,
                  color: scheme.onSurface.withValues(alpha: 0.55)),
            ),
          ]),
        ),
        const SizedBox(height: 22),

        // ── 3. greeting + the customer's-eye preview ──────────────────
        const SectionLabel('Greeting'),
        SoftPanel(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(
              'What the AI says when someone just says “hey”. Leave it empty for the built-in polite greeting.',
              style: TextStyle(
                  fontSize: 13,
                  height: 1.5,
                  color: scheme.onSurface.withValues(alpha: 0.62)),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _greeting,
              onChanged: (_) => _edited(),
              maxLines: 3,
              maxLength: 300,
              decoration: const InputDecoration(
                labelText: 'Custom greeting (optional)',
                counterText: '',
                hintText: 'Hello and welcome! How can we help you today?',
              ),
            ),
            const SizedBox(height: 12),
            _Preview(
              label: 'Your customer sees this',
              text: _greeting.text.trim().isEmpty
                  ? 'Hello and welcome to ${_me?['name'] ?? 'our shop'}! How can we help you today?'
                  : _greeting.text.trim(),
            ),
          ]),
        ),
        const SizedBox(height: 22),

        // ── 4. money guardrails ───────────────────────────────────────
        const SectionLabel('Negotiation (SmartDeal)'),
        SoftPanel(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(
              'The AI only offers a discount when a customer hesitates on price — never otherwise.',
              style: TextStyle(
                  fontSize: 13,
                  height: 1.5,
                  color: scheme.onSurface.withValues(alpha: 0.62)),
            ),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(
                child: TextField(
                  controller: _discount,
                  onChanged: (_) => _edited(),
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                      labelText: 'Max discount %', hintText: '0'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: _minOrder,
                  onChanged: (_) => _edited(),
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                      labelText: 'Only above $symbol', hintText: '0'),
                ),
              ),
            ]),
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(13),
              decoration: BoxDecoration(
                color: scheme.primaryContainer.withValues(alpha: 0.55),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Text(
                pct > 0
                    ? 'A hesitating customer on a $symbol${_thousands(sample)} dress can be offered up to '
                        '$symbol${_thousands(discounted)} ($pct% off)'
                        '${minOrder > 0 ? ' — but only on orders above $symbol${_thousands(minOrder.round())}' : ''}. '
                        'Below that, Velo holds your price.'
                    : 'Discounts are off. Velo answers every price question with your price and never negotiates.',
                style: const TextStyle(fontSize: 12.5, height: 1.5),
              ),
            ),
          ]),
        ),
        const SizedBox(height: 22),

        // ── 5. human handoff ──────────────────────────────────────────
        const SectionLabel('Human handoff'),
        SoftPanel(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(
              'Sent when the AI is not sure — instead of guessing and losing trust. Always polite, in your words.',
              style: TextStyle(
                  fontSize: 13,
                  height: 1.5,
                  color: scheme.onSurface.withValues(alpha: 0.62)),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _handoff,
              onChanged: (_) => _edited(),
              maxLines: 3,
              maxLength: 500,
              decoration: const InputDecoration(
                  labelText: 'Fallback message', counterText: ''),
            ),
            const SizedBox(height: 12),
            _Preview(
              label: 'Your customer sees this',
              text: _handoff.text.trim().isEmpty
                  ? 'Thanks for your message! A member of our team will get back to you shortly.'
                  : _handoff.text.trim(),
            ),
          ]),
        ),
      ],
    );
  }

  static String _thousands(num n) {
    final s = n.round().toString();
    final buf = StringBuffer();
    for (var i = 0; i < s.length; i++) {
      final rev = s.length - i;
      buf.write(s[i]);
      if (rev > 1 && rev % 3 == 1) buf.write(',');
    }
    return buf.toString();
  }
}

/// One tier: name, plan pill, radio, promise and three concrete uses.
class _TierTile extends StatelessWidget {
  final ({String key, String label, String blurb, List<String> forWhat}) tier;
  final bool selected;
  final bool locked;
  final bool recommended;
  final VoidCallback onTap;

  const _TierTile({
    required this.tier,
    required this.selected,
    required this.locked,
    required this.recommended,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Pressable(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: locked ? scheme.surfaceContainerLowest : scheme.surface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: selected ? scheme.primary : scheme.outline,
            width: selected ? 1.6 : 1,
          ),
          boxShadow: selected
              ? [
                  BoxShadow(
                      color: scheme.primary.withValues(alpha: 0.16),
                      blurRadius: 18,
                      offset: const Offset(0, 8)),
                ]
              : null,
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Text(tier.label,
                style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.3)),
            const SizedBox(width: 8),
            _Pill(
              text: locked ? 'Pro Plus' : 'Included',
              tone: locked ? 'warn' : 'ok',
              icon: locked ? Icons.lock_outline_rounded : null,
            ),
            const Spacer(),
            AnimatedContainer(
              duration: const Duration(milliseconds: 160),
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: selected ? scheme.primary : Colors.transparent,
                border: Border.all(
                    color: selected ? scheme.primary : scheme.outline,
                    width: 1.8),
              ),
              child: selected
                  ? const Icon(Icons.check_rounded, size: 14, color: Colors.white)
                  : null,
            ),
          ]),
          const SizedBox(height: 6),
          Text(tier.blurb,
              style: TextStyle(
                  fontSize: 13,
                  color: scheme.onSurface.withValues(alpha: 0.66))),
          const SizedBox(height: 10),
          for (final line in tier.forWhat)
            Padding(
              padding: const EdgeInsets.only(bottom: 5),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Padding(
                  padding: EdgeInsets.only(top: 1),
                  child: Icon(Icons.check_rounded,
                      size: 14, color: VeloSalesTheme.green),
                ),
                const SizedBox(width: 7),
                Expanded(
                  child: Text(line,
                      style: TextStyle(
                          fontSize: 12.5,
                          height: 1.4,
                          color: scheme.onSurface.withValues(alpha: 0.7))),
                ),
              ]),
            ),
          if (recommended) ...[
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
              decoration: BoxDecoration(
                color: scheme.primaryContainer,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text('Most owners keep this',
                  style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.3,
                      color: scheme.primary)),
            ),
          ],
        ]),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  final String text;
  final String tone; // 'ok' | 'warn'
  final IconData? icon;
  const _Pill({required this.text, required this.tone, this.icon});

  @override
  Widget build(BuildContext context) {
    final ok = tone == 'ok';
    final c = ok ? VeloSalesTheme.greenDark : VeloSalesTheme.gold;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (icon != null) ...[
          Icon(icon, size: 11, color: c),
          const SizedBox(width: 4),
        ],
        Text(text,
            style: TextStyle(
                fontSize: 10.5, fontWeight: FontWeight.w800, color: c)),
      ]),
    );
  }
}

/// The "what the customer gets" bubble. Deliberately looks like the chat, so
/// owners read the preview as a message rather than as a form field.
class _Preview extends StatelessWidget {
  final String label;
  final String text;
  const _Preview({required this.label, required this.text});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: scheme.outline),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label.toUpperCase(),
            style: TextStyle(
                fontSize: 9.5,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.9,
                color: scheme.onSurface.withValues(alpha: 0.45))),
        const SizedBox(height: 9),
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
                color: scheme.primary, shape: BoxShape.circle),
            child: const Icon(Icons.auto_awesome,
                size: 14, color: Colors.white),
          ),
          const SizedBox(width: 9),
          Flexible(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
              decoration: BoxDecoration(
                color: scheme.surface,
                border: Border.all(color: scheme.outline),
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(4),
                  topRight: Radius.circular(14),
                  bottomLeft: Radius.circular(14),
                  bottomRight: Radius.circular(14),
                ),
              ),
              child: Text(text,
                  style: const TextStyle(fontSize: 13, height: 1.5)),
            ),
          ),
        ]),
      ]),
    );
  }
}

class _AiSettingsSkeleton extends StatelessWidget {
  const _AiSettingsSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(padding: const EdgeInsets.all(16), children: const [
      Skeleton(height: 14, width: 240),
      SizedBox(height: 18),
      Skeleton(height: 132, radius: 18),
      SizedBox(height: 10),
      Skeleton(height: 132, radius: 18),
      SizedBox(height: 10),
      Skeleton(height: 132, radius: 18),
      SizedBox(height: 22),
      Skeleton(height: 96, radius: 18),
    ]);
  }
}
