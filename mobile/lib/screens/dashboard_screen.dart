// ── lib/screens/dashboard_screen.dart ────────────────────────────
// WHAT: the home screen after login — mirrors Dashboard.jsx: greeting
// hero (AI-on-duty pill + quick actions), Pro-trial strip, 4 stat cards,
// flagged chats, setup checklist. Three parallel fetches crunched into
// one summary (same Promise.all pattern as web).
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../format.dart';
import '../glass.dart';
import '../motion.dart';
import 'profile_screen.dart';

class DashboardScreen extends StatefulWidget {
  final ValueChanged<int> onGoTab;
  const DashboardScreen({super.key, required this.onGoTab});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Map<String, dynamic>? _me;
  Map<String, dynamic>? _bill;
  Map<String, dynamic>? _channels; // Connect status (checklist "Connect" step ticks from this!)
  List<dynamic> _products = [];
  List<dynamic> _convos = [];
  String? _err;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _err = null;
    });
    try {
      // Same parallel fetch as web (faster than sequential).
      final results = await Future.wait([
        ApiClient.instance.me(),
        ApiClient.instance.products(),
        ApiClient.instance.conversations(),
        ApiClient.instance.billing(),
        ApiClient.instance.channels(),
      ]);
      _me = (results[0] as Map).cast<String, dynamic>();
      _products = results[1] as List<dynamic>;
      _convos = results[2] as List<dynamic>;
      _bill = (results[3] as Map).cast<String, dynamic>();
      _channels = (results[4] as Map).cast<String, dynamic>();
    } on ApiException catch (e) {
      _err = e.message;
    } catch (_) {
      _err = 'No connection.';
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _toggleBot(bool v) async {
    try {
      await ApiClient.instance.post('/api/me/bot', {'enabled': v});
      _load();
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, type: 'err');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          Skeleton(height: 150),
          SizedBox(height: 12),
          Skeleton(height: 90),
          SizedBox(height: 12),
          Skeleton(height: 90),
          SizedBox(height: 12),
          Skeleton(height: 90),
        ],
      );
    }
    if (_err != null) {
      return Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(_err!),
          const SizedBox(height: 12),
          FilledButton(onPressed: _load, child: const Text('Retry')),
        ]),
      );
    }
    final scheme = Theme.of(context).colorScheme;
    final biz = (_me!['business'] as Map).cast<String, dynamic>();
    final first = ('${biz['name'] ?? 'there'}').split(' ').first;
    final needs =
        _convos.where((c) => (c as Map)['needs_human'] == true).toList();
    final pct = _convos.isEmpty
        ? 100
        : (((_convos.length - needs.length) / _convos.length) * 100).round();
    final trialLeft =
        _bill!['status'] == 'trialing' ? trialDaysLeft(_bill!['trial_ends']) : null;
    final botOn = (biz['bot_enabled'] ?? true) as bool;

    // Setup checklist (self-ticking from REAL data, like web steps).
    final waLive = ((_channels?['whatsapp'] as Map?)?['live'] == true);
    final tgOn = ((_channels?['telegram'] as Map?)?['connected'] == true);
    final steps = [
      _Step(_products.isNotEmpty, 'Add your first product',
          'The AI only quotes your catalog', 2),
      _Step(waLive || tgOn, 'Connect your channels',
          'WhatsApp + Telegram — TEST to LIVE', 3),
      _Step(_convos.isNotEmpty, 'Test like a customer',
          'Ask prices in Vendora AI', 4),
      _Step(
          '${biz['hours'] ?? ''}'.isNotEmpty &&
              '${biz['owner_number'] ?? ''}'.isNotEmpty,
          'Set hours + owner number',
          'So closed-hours replies feel human',
          -1), // -1 = push Profile screen
      _Step(_convos.isNotEmpty, 'Get your first real chat',
          'Share your WhatsApp number', 1),
    ];
    final doneCount = steps.where((s) => s.done).length;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── dash-hero: gradient banner, greeting, live pill, actions ──
          FadeSlideIn(
            child: GlassCard(
              child: Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  gradient: LinearGradient(colors: [
                    scheme.primary.withValues(alpha: 0.22),
                    scheme.primary.withValues(alpha: 0.06),
                  ]),
                ),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: scheme.primary.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(
                              color: scheme.primary
                                  .withValues(alpha: 0.4)),
                        ),
                        child: Row(mainAxisSize: MainAxisSize.min, children: [
                          Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: scheme.primary)),
                          const SizedBox(width: 7),
                          const Text('AI on duty',
                              style: TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w600)),
                        ]),
                      ),
                      const SizedBox(height: 10),
                      Text('${greeting()}, $first.',
                          style: const TextStyle(
                              fontSize: 24, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 4),
                      Text(
                        needs.isNotEmpty
                            ? '${needs.length} chat${needs.length > 1 ? 's need' : ' needs'} your human touch — everything else is handled.'
                            : "Here's what's happening on your WhatsApp while you were away.",
                        style: TextStyle(
                            color: scheme.onSurface
                                .withValues(alpha: 0.7),
                            fontSize: 14),
                      ),
                      const SizedBox(height: 12),
                      Wrap(spacing: 8, children: [
                        FilledButton.icon(
                            onPressed: () => widget.onGoTab(2),
                            icon: const Icon(Icons.add, size: 16),
                            label: const Text('Add product')),
                        OutlinedButton.icon(
                            onPressed: () => widget.onGoTab(4),
                            icon: const Icon(Icons.smart_toy, size: 16),
                            label: const Text('Test bot')),
                      ]),
                    ]),
              ),
            ),
          ),
          // ── trial strip (trialing only) ──
          if (trialLeft != null)
            FadeSlideIn(
              delayMs: 60,
              child: GlassCard(
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Row(children: [
                    const Icon(Icons.schedule, size: 18),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        '$trialLeft day${trialLeft == 1 ? '' : 's'} of Pro trial left. Keep Pro sync, or stay free forever with manual catalog.',
                        style: const TextStyle(fontSize: 13),
                      ),
                    ),
                     TextButton(
                         onPressed: () => widget.onGoTab(5),
                         child: const Text('Billing')),
                  ]),
                ),
              ),
            ),
          const SizedBox(height: 12),
          // ── Refer & Earn card (own fetch — never blocks the dashboard!) ──
          const _ReferCard(),
          const SizedBox(height: 12),
          // ── 4 stat cards (.stat num/lbl pattern) ──
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.5,
            children: [
              _Stat(
                  num: '${_convos.length}',
                  lbl: 'CHATS',
                  delay: 0,
                  onTap: () => widget.onGoTab(1)),
              _Stat(
                  num: '$pct%',
                  lbl: 'AI HANDLED',
                  good: pct >= 80,
                  delay: 60,
                  onTap: () => widget.onGoTab(1)),
              _Stat(
                  num: '${needs.length}',
                  lbl: 'NEEDS YOU',
                  warn: needs.isNotEmpty,
                  delay: 120,
                  onTap: () => widget.onGoTab(1)),
              _Stat(
                  num: '${_products.length}',
                  lbl: 'PRODUCTS',
                  delay: 180,
                  onTap: () => widget.onGoTab(2)),
            ],
          ),
          const SizedBox(height: 12),
          // ── setup checklist (hides when complete) ──
          if (doneCount < steps.length)
            FadeSlideIn(
              delayMs: 120,
              child: GlassCard(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                            'Your first 15 minutes · $doneCount/${steps.length} done',
                            style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600)),
                        const SizedBox(height: 8),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(99),
                          child: LinearProgressIndicator(
                            value: doneCount / steps.length,
                            minHeight: 8,
                          ),
                        ),
                        const SizedBox(height: 8),
                        for (var i = 0; i < steps.length; i++)
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: CircleAvatar(
                              backgroundColor: steps[i].done
                                  ? scheme.primary
                                  : scheme.surfaceContainerHighest,
                              child: Text(
                                  steps[i].done ? '✓' : '${i + 1}',
                                  style: TextStyle(
                                      color: steps[i].done
                                          ? scheme.onPrimary
                                          : scheme.onSurface,
                                      fontWeight: FontWeight.bold)),
                            ),
                            title: Text(steps[i].label,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w600,
                                    fontSize: 14)),
                            subtitle: Text(
                                steps[i].done
                                    ? 'Done — nice.'
                                    : steps[i].hint,
                                style: const TextStyle(fontSize: 12)),
                            onTap: steps[i].done
                                ? null
                                : () {
                                    if (steps[i].tab == -1) {
                                      Navigator.of(context)
                                          .push(MaterialPageRoute(
                                              builder: (_) =>
                                                  const ProfileScreen()))
                                          .then((_) => _load());
                                    } else {
                                      widget.onGoTab(steps[i].tab);
                                    }
                                  },
                          ),
                      ]),
                ),
              ),
            ),
          // ── flagged chats preview ──
          if (needs.isNotEmpty) ...[
            const SizedBox(height: 4),
            FadeSlideIn(
              delayMs: 160,
              child: GlassCard(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Needs your touch',
                            style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600)),
                        const SizedBox(height: 8),
                        for (final c in needs.take(3))
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(
                                '${(c as Map)['customer_name'] ?? c['customer_number']}',
                                style: const TextStyle(fontSize: 14)),
                            subtitle: Text(
                                '${c['last_message'] ?? ''}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontSize: 12)),
                            trailing: const Icon(Icons.chevron_right,
                                size: 18),
                            onTap: () => widget.onGoTab(1),
                          ),
                      ]),
                ),
              ),
            ),
          ],
          const SizedBox(height: 12),
          // ── bot kill-switch (was the old whole screen) ──
          FadeSlideIn(
            delayMs: 200,
            child: GlassCard(
              child: SwitchListTile(
                title: const Text('AI bot replies'),
                subtitle: const Text(
                    'Kill-switch: silence every chat instantly'),
                value: botOn,
                onChanged: _toggleBot,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Step {
  final bool done;
  final String label;
  final String hint;
  final int tab; // target bottom tab, -1 = push Profile
  _Step(this.done, this.label, this.hint, this.tab);
}

/// Refer & Earn card (web ReferCard parity): code + share + live funnel +
/// milestone bar to the N500 airtime. Own fetch (dashboard never waits!).
class _ReferCard extends StatefulWidget {
  const _ReferCard();

  @override
  State<_ReferCard> createState() => _ReferCardState();
}

class _ReferCardState extends State<_ReferCard> {
  Map<String, dynamic>? _r;

  @override
  void initState() {
    super.initState();
    ApiClient.instance.referralStats().then((v) {
      if (mounted) setState(() => _r = v);
    }).catchError((_) {});
  }

  String _naira(num? kobo) {
    final v = ((kobo ?? 0) / 100).round().toString();
    final buf = StringBuffer();
    for (var i = 0; i < v.length; i++) {
      if (i > 0 && (v.length - i) % 3 == 0) buf.write(',');
      buf.write(v[i]);
    }
    return 'N$buf'; // N + grouped digits (no intl dep — same trick as web money()!)
  }

  /// Full Refer & Earn sheet (web /refer-earn parity): big share, 3 rewards,
  /// history, leaderboard. History + leaders load on open (card already has stats!).
  Future<void> _openReferPage() async {
    final r = _r;
    if (r == null) return;
    final code = '${r['code'] ?? ''}';
    final link = 'https://vendorabot.vercel.app/login?ref=$code';
    final text =
        'I use Vendora — my WhatsApp shop answers customers 24/7. Start free with my code $code (we BOTH get 14 Pro days free): $link';
    List<dynamic> history = [];
    List<dynamic> leaders = [];
    try {
      final x = await ApiClient.instance.referralExtra();
      history = List<dynamic>.from(x['history'] ?? []);
      leaders = List<dynamic>.from(x['leaders'] ?? []);
    } catch (_) {} // offline → sheet still opens with stats + share!
    if (!mounted) return;
    await glassSheet(
      context,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Refer & Earn',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text('Code: $code — friends join, you BOTH get 14 Pro days. Every 5th paying friend = N500 airtime.',
              style: const TextStyle(fontSize: 12.5)),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: () => launchUrl(
                  Uri.parse('https://wa.me/?text=${Uri.encodeComponent(text)}'),
                  mode: LaunchMode.externalApplication),
              icon: const Icon(Icons.send, size: 15),
              label: const Text('Share on WhatsApp'),
            ),
          ),
          const SizedBox(height: 12),
          const Text('My rewards',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          if (history.isEmpty)
            const Text('Nothing yet — share your code and rewards land here.',
                style: TextStyle(fontSize: 12)),
          for (final h in history.take(10))
            Builder(builder: (c) {
              final m = (h as Map).cast<String, dynamic>();
              final kind = '${m['kind'] ?? ''}';
              final detail = kind == 'pro_days'
                  ? '+${m['days'] ?? 0}d Pro days'
                  : kind == 'airtime'
                      ? '${_naira(m['amount'])} airtime (${m['status'] ?? ''})'
                      : 'Free Plus month';
              return Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Text('• $detail — ${m['note'] ?? ''}',
                    style: const TextStyle(fontSize: 12.5)),
              );
            }),
          const SizedBox(height: 10),
          const Text("This month's leaders",
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          if (leaders.isEmpty)
            const Text('Nobody yet — be the first name here.',
                style: TextStyle(fontSize: 12)),
          for (var i = 0; i < leaders.length && i < 5; i++)
            Builder(builder: (c) {
              final m = (leaders[i] as Map).cast<String, dynamic>();
              return Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text('${i + 1}. ${m['name'] ?? '?'} — ${m['paying'] ?? 0} paying',
                    style: const TextStyle(fontSize: 12.5)),
              );
            }),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final r = _r;
    if (r == null) return const SizedBox.shrink(); // loading → nothing (pops in when ready!)
    final code = '${r['code'] ?? ''}';
    final paying = (r['paying'] as num? ?? 0).toInt();
    final every = (r['milestoneEvery'] as num? ?? 5).toInt();
    final pct = (paying % every) / every;
    final link = 'https://vendorabot.vercel.app/login?ref=$code'; // web login prefills + validates!
    final text =
        'I use Vendora — my WhatsApp shop answers customers 24/7. Start free with my code $code (we BOTH get 14 Pro days free): $link';
    return FadeSlideIn(
      child: GlassCard(
        onTap: _openReferPage, // full page (history + leaderboard + big share!)
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(children: [
                  Icon(Icons.card_giftcard, size: 18),
                  SizedBox(width: 8),
                  Text('Refer & Earn',
                      style:
                          TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                  Spacer(),
                  Icon(Icons.chevron_right, size: 18),
                ]),
                const SizedBox(height: 6),
                const Text(
                    'Friends join with your code — you BOTH get 14 Pro days. Every 5th paying friend = N500 airtime.',
                    style: TextStyle(fontSize: 12.5)),
                const SizedBox(height: 10),
                Row(children: [
                  Expanded(
                    child: Text(code,
                        style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.5)),
                  ),
                  TextButton.icon(
                    onPressed: () => launchUrl(
                        Uri.parse('https://wa.me/?text=${Uri.encodeComponent(text)}'),
                        mode: LaunchMode.externalApplication),
                    icon: const Icon(Icons.send, size: 15),
                    label: const Text('Share'),
                  ),
                ]),
                const SizedBox(height: 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(99),
                  child: LinearProgressIndicator(value: pct, minHeight: 8),
                ),
                const SizedBox(height: 6),
                Text(
                    '${r['invited'] ?? 0} invited · ${r['qualified'] ?? 0} set up · $paying paying · ${r['nextMilestoneIn'] ?? every} more to ${_naira(r['milestoneAmount'])} airtime',
                    style: const TextStyle(fontSize: 12)),
              ]),
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  final String num;
  final String lbl;
  final bool good;
  final bool warn;
  final int delay;
  final VoidCallback onTap;
  const _Stat(
      {required this.num,
      required this.lbl,
      this.good = false,
      this.warn = false,
      this.delay = 0,
      required this.onTap});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final color = good
        ? scheme.primary
        : warn
            ? const Color(0xFFB54708)
            : scheme.onSurface;
    return FadeSlideIn(
      delayMs: delay,
      child: GlassCard(
        radius: 16,
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(num,
                    style: TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w700,
                        color: color)),
                const SizedBox(height: 2),
                Text(lbl,
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.5,
                        color: scheme.onSurface
                            .withValues(alpha: 0.6))),
              ]),
        ),
      ),
    );
  }
}
