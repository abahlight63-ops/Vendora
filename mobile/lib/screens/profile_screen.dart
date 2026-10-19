// ── lib/screens/profile_screen.dart ──────────────────────────────
// WHAT: the business profile editor. Name, the locked WhatsApp identity, the
// owner's own number, hours, currency, timezone, lane, tone, personal contacts
// and FAQs — one PUT to /api/me/business, exactly the fields the web Profile
// page sends.
//
// WHY IT MATTERS: this is the only page where the owner decides what the AI
// KNOWS about the shop. Names, hours and prices spoken here are repeated to
// customers verbatim, so the page is built like a form that is read back:
// grouped, labelled, and saved in one deliberate action at the bottom.
//
// STYLE: the same family as Settings and AI settings — a hero, tinted groups,
// icon chips, one save bar. The old version was three bare Material fields; a
// shop owner who learned the map on the web should recognise this instantly.
import 'package:flutter/material.dart';

import '../api.dart';
import '../glass.dart';
import '../motion.dart';
import '../theme.dart';
import '../widgets/app_select.dart';
import '../widgets/brand_ui.dart';
import 'setup_screen.dart'; // kNiches — the canonical lane labels

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _name = TextEditingController();
  final _owner = TextEditingController();
  final _hours = TextEditingController();
  final _timezone = TextEditingController();
  final _tone = TextEditingController();
  final _personal = TextEditingController();
  final _faq = TextEditingController();

  bool _loading = true;
  bool _saving = false;
  bool _dirty = false;
  bool _botOn = true;
  bool _botBusy = false;
  String? _err;
  String _lockedNumber = '';
  String _currency = 'NGN';
  String _niche = '';
  String? _waLive; // null = still checking
  String? _tgLive;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final c in [_name, _owner, _hours, _timezone, _tone, _personal, _faq]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final me = await ApiClient.instance.me();
      final b = (me['business'] as Map?)?.cast<String, dynamic>() ?? {};
      _name.text = '${b['name'] ?? ''}';
      _owner.text = '${b['owner_number'] ?? ''}';
      _hours.text = '${b['hours'] ?? ''}';
      _timezone.text = '${b['timezone'] ?? 'Africa/Lagos'}';
      _tone.text = '${b['tone'] ?? ''}';
      _lockedNumber = '${b['whatsapp_number'] ?? ''}';
      _currency = '${b['currency'] ?? 'NGN'}';
      _niche = '${b['business_niche'] ?? ''}';
      _botOn = b['bot_enabled'] != false;
      final pc = (b['personal_contacts'] as List?) ?? const [];
      _personal.text = pc.join('\n');
      final faqs = (b['faq'] as List?) ?? const [];
      _faq.text = faqs
          .whereType<Map>()
          .map((x) => '${x['question'] ?? ''} | ${x['answer'] ?? ''}')
          .join('\n');
      if (mounted) setState(() => _dirty = false);
    } on ApiException catch (e) {
      if (mounted) setState(() => _err = e.message);
    } catch (_) {
      if (mounted) setState(() => _err = 'No connection.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
    // Channel health is a separate call so a slow one never blocks the form.
    try {
      final ch = await ApiClient.instance.channels();
      if (!mounted) return;
      setState(() {
        _waLive = (ch['whatsapp'] as Map?)?['connected'] == true
            ? 'LIVE'
            : 'OFF';
        _tgLive = (ch['telegram'] as Map?)?['connected'] == true
            ? 'LIVE'
            : 'OFF';
      });
    } catch (_) {/* the row simply stays out of the way */}
  }

  void _touch() {
    // Rebuild on every keystroke so the hero name follows what is being typed —
    // it is the one place the owner sees the shop's name as customers will.
    setState(() => _dirty = true);
  }

  Future<void> _toggleBot() async {
    setState(() => _botBusy = true);
    try {
      final on = await ApiClient.instance.toggleBot(!_botOn);
      if (!mounted) return;
      setState(() => _botOn = on);
      showToast(context, on ? 'Bot resumed everywhere.' : 'Bot paused everywhere.');
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, type: 'err');
    } finally {
      if (mounted) setState(() => _botBusy = false);
    }
  }

  Future<void> _save() async {
    if (_name.text.trim().isEmpty) {
      showToast(context, 'Business name required', type: 'err');
      return;
    }
    // Parse exactly like the web: one contact per line; a FAQ line is only kept
    // when it has BOTH sides of the pipe (extra pipes stay in the answer).
    final personal = _personal.text
        .split('\n')
        .map((l) => l.trim())
        .where((l) => l.isNotEmpty)
        .toList();
    final faq = <Map<String, String>>[];
    for (final line in _faq.text.split('\n')) {
      final i = line.indexOf('|');
      if (i <= 0) continue;
      final q = line.substring(0, i).trim();
      final a = line.substring(i + 1).trim();
      if (q.isEmpty || a.isEmpty) continue;
      faq.add({'question': q, 'answer': a});
    }
    setState(() => _saving = true);
    try {
      await ApiClient.instance.updateBusiness({
        'name': _name.text.trim(),
        'owner_number': _owner.text.trim(),
        'hours': _hours.text.trim(),
        'tone': _tone.text.trim(),
        'currency': _currency,
        'timezone':
            _timezone.text.trim().isEmpty ? 'Africa/Lagos' : _timezone.text.trim(),
        'business_niche': _niche,
        'personal_contacts': personal,
        'faq': faq,
      });
      if (!mounted) return;
      setState(() => _dirty = false);
      showToast(context, 'Profile saved — the AI talks with this from now on.');
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, type: 'err');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Business profile')),
      body: _loading
          ? const _ProfileSkeleton()
          : _err != null
              ? EmptyState('Could not load your profile', _err!, retry: _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                    children: [
                      _hero(scheme),
                      const SizedBox(height: 18),
                      const SectionLabel('Assistant & alerts'),
                      _Group(children: [
                        _row(
                          scheme,
                          Icons.smart_toy_outlined,
                          'Bot replies: ${_botOn ? 'ON' : 'OFF'}',
                          _botOn
                              ? 'The AI answers customers.'
                              : 'Silent everywhere — customers get no reply.',
                          trailing: TextButton(
                            onPressed: _botBusy ? null : _toggleBot,
                            child: Text(_botBusy
                                ? '…'
                                : (_botOn ? 'Pause bot' : 'Resume bot')),
                          ),
                        ),
                        _row(
                          scheme,
                          Icons.notifications_none_rounded,
                          'Phone alerts',
                          'The bell in this app only. Browser alerts are switched '
                              'on from the web — this build cannot ring for you.',
                          trailing: _Chip('WEB'),
                        ),
                        if (_waLive != null || _tgLive != null)
                          _row(
                            scheme,
                            Icons.hub_outlined,
                            'Channels',
                            'WhatsApp: ${_waLive ?? '—'} · Telegram: ${_tgLive ?? '—'}',
                            trailing: (_waLive == 'LIVE' || _tgLive == 'LIVE')
                                ? _Chip('LIVE', good: true)
                                : _Chip('OFF'),
                          ),
                      ]),
                      const SizedBox(height: 18),
                      const SectionLabel('Business details'),
                      _Group(children: [
                        _field(scheme, Icons.storefront_outlined, 'Business name',
                            _name,
                            hint: 'Adaeze Fabrics'),
                        _readOnly(scheme, Icons.lock_outline_rounded,
                            'WhatsApp number (locked)',
                            _lockedNumber.isEmpty ? 'Not linked yet' : _lockedNumber,
                            'This is your login identity — it cannot change here.'),
                        _field(scheme, Icons.phone_outlined, 'Your personal WhatsApp',
                            _owner,
                            hint: '0803 123 4567',
                            keyboard: TextInputType.phone,
                            sub: 'Only this number can teach the bot with LEARN:.'),
                        _field(scheme, Icons.schedule_outlined, 'Opening hours',
                            _hours,
                            hint: 'Mon-Sat, 9am - 7pm',
                            sub: 'Used for open and closed replies.'),
                        _select(scheme, Icons.payments_outlined, 'Billing currency',
                            AppSelect(
                              value: _currency,
                              options: const [
                                AppSelectOption(
                                    value: 'NGN',
                                    label: 'Naira (₦)',
                                    hint: 'Nigerian cards and bank transfer'),
                                AppSelectOption(
                                    value: 'USD',
                                    label: 'US Dollar (\$)',
                                    hint: 'International cards'),
                              ],
                              onChanged: (v) {
                                setState(() => _currency = v);
                                _touch();
                              },
                            ),
                            sub: 'Auto-set from your number — change anytime.'),
                        _field(scheme, Icons.public, 'Timezone', _timezone,
                            hint: 'Africa/Lagos',
                            sub: 'e.g. Africa/Lagos, America/New_York, Europe/London.'),
                        _select(
                          scheme,
                          Icons.sell_outlined,
                          'What you sell',
                          AppSelect(
                            value: _niche.isEmpty ? null : _niche,
                            placeholder: 'Pick your lane',
                            options: [
                              // Never strand a saved custom lane: keep it first.
                              if (_niche.isNotEmpty && !kNiches.contains(_niche))
                                AppSelectOption(value: _niche, label: _niche),
                              for (final n in kNiches)
                                AppSelectOption(value: n, label: n),
                            ],
                            onChanged: (v) {
                              setState(() => _niche = v);
                              _touch();
                            },
                          ),
                          sub: 'Your lane — catalog shelves and AI suggestions follow it.',
                        ),
                        _field(scheme, Icons.record_voice_over_outlined,
                            'How the AI should sound', _tone,
                            hint: 'Warm, friendly and brief',
                            sub: 'Plain words, no hard sell.'),
                      ]),
                      const SizedBox(height: 18),
                      const SectionLabel('Who the bot must never pitch'),
                      _Group(children: [
                        _field(
                          scheme,
                          Icons.people_outline_rounded,
                          'Personal contacts',
                          _personal,
                          hint: '0803 123 4567\n0805 987 6543',
                          lines: 3,
                          sub: 'One number per line. Their messages are ignored '
                              'entirely, so the bot never fights your own chats.',
                        ),
                      ]),
                      const SizedBox(height: 18),
                      const SectionLabel('FAQs the AI should know'),
                      _Group(children: [
                        _field(
                          scheme,
                          Icons.help_outline_rounded,
                          'One per line: question | answer',
                          _faq,
                          hint: 'Do you deliver? | Yes — Lagos in 24 hours.\n'
                              'Can I pay on delivery? | Within Lagos, yes.',
                          lines: 4,
                          sub: 'Answers here win before the bot ever guesses.',
                        ),
                      ]),
                    ],
                  ),
                ),
      bottomNavigationBar: _loading || _err != null
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
                      color: _dirty
                          ? VeloSalesTheme.gold
                          : scheme.onSurface.withValues(alpha: 0.6),
                    ),
                  ),
                ),
                SizedBox(
                  width: 160,
                  child: GradientPill(
                    label: _saving ? 'Saving…' : 'Save profile',
                    height: 48,
                    onTap: _saving || !_dirty ? null : _save,
                  ),
                ),
              ]),
            ),
    );
  }

  Widget _hero(ColorScheme scheme) {
    final name = _name.text.trim().isEmpty ? 'Your business' : _name.text.trim();
    final initial = name.trim().isEmpty ? 'V' : name.trim()[0].toUpperCase();
    return SoftPanel(
      padding: const EdgeInsets.all(16),
      child: Row(children: [
        Container(
          width: 54,
          height: 54,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: scheme.primaryContainer,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: scheme.primary.withValues(alpha: 0.25)),
          ),
          child: Text(initial,
              style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: scheme.primary)),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.4)),
            const SizedBox(height: 2),
            Text(
              _lockedNumber.isEmpty
                  ? 'Not linked to WhatsApp yet'
                  : 'WhatsApp $_lockedNumber',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                  fontSize: 12.5,
                  color: scheme.onSurface.withValues(alpha: 0.6)),
            ),
          ]),
        ),
      ]),
    );
  }

  // ── row builders ─────────────────────────────────────────────────
  Widget _row(ColorScheme scheme, IconData icon, String title, String sub,
      {Widget? trailing}) {
    return Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
      _IconChip(icon: icon),
      const SizedBox(width: 12),
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title,
              style:
                  const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
          const SizedBox(height: 2),
          Text(sub,
              style: TextStyle(
                  fontSize: 12,
                  height: 1.4,
                  color: scheme.onSurface.withValues(alpha: 0.6))),
        ]),
      ),
      if (trailing != null) ...[const SizedBox(width: 8), trailing],
    ]);
  }

  Widget _field(
    ColorScheme scheme,
    IconData icon,
    String label,
    TextEditingController c, {
    String? hint,
    String? sub,
    int lines = 1,
    TextInputType? keyboard,
  }) {
    return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Padding(
        padding: EdgeInsets.only(top: lines > 1 ? 0 : 6),
        child: _IconChip(icon: icon),
      ),
      const SizedBox(width: 12),
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label,
              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
          TextField(
            controller: c,
            maxLines: lines,
            keyboardType: keyboard,
            textCapitalization: lines > 1
                ? TextCapitalization.sentences
                : TextCapitalization.words,
            onChanged: (_) => _touch(),
            style: const TextStyle(fontSize: 14, height: 1.4),
            decoration: InputDecoration(
              isDense: true,
              hintText: hint,
              hintStyle: TextStyle(
                  fontSize: 13.5,
                  height: 1.4,
                  color: scheme.onSurface.withValues(alpha: 0.35)),
              contentPadding: const EdgeInsets.only(top: 3, bottom: 4),
              border: InputBorder.none,
              enabledBorder: InputBorder.none,
              focusedBorder: InputBorder.none,
            ),
          ),
          if (sub != null) ...[
            const SizedBox(height: 2),
            Text(sub,
                style: TextStyle(
                    fontSize: 11.5,
                    height: 1.4,
                    color: scheme.onSurface.withValues(alpha: 0.55))),
          ],
        ]),
      ),
    ]);
  }

  Widget _readOnly(ColorScheme scheme, IconData icon, String label, String value,
      String sub) {
    return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _IconChip(icon: icon, muted: true),
      const SizedBox(width: 12),
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label,
              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
          const SizedBox(height: 3),
          Text(value,
              style: TextStyle(
                  fontSize: 14,
                  color: scheme.onSurface.withValues(alpha: 0.72))),
          const SizedBox(height: 2),
          Text(sub,
              style: TextStyle(
                  fontSize: 11.5,
                  height: 1.4,
                  color: scheme.onSurface.withValues(alpha: 0.55))),
        ]),
      ),
    ]);
  }

  Widget _select(ColorScheme scheme, IconData icon, String label, Widget control,
      {String? sub}) {
    return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _IconChip(icon: icon),
      const SizedBox(width: 12),
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label,
              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          control,
          if (sub != null) ...[
            const SizedBox(height: 4),
            Text(sub,
                style: TextStyle(
                    fontSize: 11.5,
                    height: 1.4,
                    color: scheme.onSurface.withValues(alpha: 0.55))),
          ],
        ]),
      ),
    ]);
  }
}

/// A labelled group with hairlines between rows — the phone twin of the web's
/// `.set-rows` panel. One panel per idea, never one giant card.
class _Group extends StatelessWidget {
  final List<Widget> children;
  const _Group({required this.children});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final rows = <Widget>[];
    for (var i = 0; i < children.length; i++) {
      if (i > 0) {
        rows.add(Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Container(height: 1, color: scheme.outline),
        ));
      }
      rows.add(children[i]);
    }
    return SoftPanel(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
      child: Column(children: rows),
    );
  }
}

class _IconChip extends StatelessWidget {
  final IconData icon;
  final bool muted;
  const _IconChip({required this.icon, this.muted = false});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      width: 34,
      height: 34,
      decoration: BoxDecoration(
        color: muted
            ? scheme.surfaceContainerHighest.withValues(alpha: 0.6)
            : scheme.primaryContainer,
        borderRadius: BorderRadius.circular(11),
      ),
      child: Icon(icon,
          size: 17,
          color: muted
              ? scheme.onSurface.withValues(alpha: 0.55)
              : scheme.primary),
    );
  }
}

class _Chip extends StatelessWidget {
  final String label;
  final bool good;
  const _Chip(this.label, {this.good = false});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final color = good
        ? VeloSalesTheme.greenDark
        : scheme.onSurface.withValues(alpha: 0.55);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: good
            ? VeloSalesTheme.green.withValues(alpha: 0.12)
            : scheme.surfaceContainerHighest.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
            color: good
                ? VeloSalesTheme.green.withValues(alpha: 0.35)
                : scheme.outline),
      ),
      child: Text(label,
          style: TextStyle(
              fontSize: 9.5, fontWeight: FontWeight.w800, color: color)),
    );
  }
}

/// The shape of the page before data lands: hero, two groups. Mirrors the real
/// layout so nothing jumps when it fills in.
class _ProfileSkeleton extends StatelessWidget {
  const _ProfileSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        SoftPanel(
          padding: const EdgeInsets.all(16),
          child: Row(children: const [
            Skeleton(height: 54, width: 54, radius: 16),
            SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Skeleton(height: 16, width: 150),
                SizedBox(height: 8),
                Skeleton(height: 11, width: 110),
              ]),
            ),
          ]),
        ),
        const SizedBox(height: 18),
        const Skeleton(height: 11, width: 120),
        const SizedBox(height: 10),
        const Skeleton(height: 150),
        const SizedBox(height: 18),
        const Skeleton(height: 11, width: 140),
        const SizedBox(height: 10),
        const Skeleton(height: 260),
      ],
    );
  }
}
