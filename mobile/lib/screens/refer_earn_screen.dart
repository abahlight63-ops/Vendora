// ── lib/screens/refer_earn_screen.dart ────────────────────────────
// WHAT: Refer & Earn, the phone twin of the web page. Indigo hero with the
// invite code, four REAL counters, the three rewards, payout history and this
// month's leaderboard. GET /api/me/referral + /api/me/referral/extra in
// parallel; nothing here is invented — an empty list says so.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../glass.dart';
import '../motion.dart';
import '../theme.dart';

class ReferEarnScreen extends StatefulWidget {
  const ReferEarnScreen({super.key});

  @override
  State<ReferEarnScreen> createState() => _ReferEarnScreenState();
}

class _ReferEarnScreenState extends State<ReferEarnScreen> {
  Map<String, dynamic>? _s; // stats (code, funnel, earnings)
  Map<String, dynamic>? _x; // extra (history + leaders)
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
      final both = await Future.wait([
        ApiClient.instance.referralStats(),
        ApiClient.instance.referralExtra(),
      ]);
      if (!mounted) return;
      setState(() {
        _s = both[0];
        _x = both[1];
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _err = e.message);
    } catch (_) {
      if (mounted) setState(() => _err = 'No connection — your code and earnings are safe.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Kobo → "₦500" (the ledger stores minor units).
  String _naira(dynamic kobo) {
    final n = (num.tryParse('$kobo') ?? 0) / 100;
    final s = n.toStringAsFixed(n.truncateToDouble() == n ? 0 : 2);
    final parts = s.split('.');
    final buf = StringBuffer();
    for (var i = 0; i < parts[0].length; i++) {
      final rev = parts[0].length - i;
      buf.write(parts[0][i]);
      if (rev > 1 && rev % 3 == 1) buf.write(',');
    }
    return '₦$buf${parts.length > 1 ? '.${parts[1]}' : ''}';
  }

  void _copy(String text, String label) {
    Clipboard.setData(ClipboardData(text: text));
    showToast(context, '$label copied — go share it!');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Refer & Earn')),
      body: _body(),
    );
  }

  Widget _body() {
    if (_loading) {
      return ListView(padding: const EdgeInsets.all(16), children: const [
        Skeleton(height: 196),
        SizedBox(height: 12),
        Skeleton(height: 82),
        SizedBox(height: 10),
        Skeleton(height: 82),
        SizedBox(height: 10),
        Skeleton(height: 120),
      ]);
    }
    if (_err != null || _s == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.wifi_off_rounded, size: 30),
            const SizedBox(height: 10),
            Text(_err ?? 'Could not load rewards', textAlign: TextAlign.center),
            const SizedBox(height: 12),
            FilledButton(onPressed: _load, child: const Text('Retry')),
          ]),
        ),
      );
    }

    final s = _s!;
    final every = (num.tryParse('${s['milestoneEvery']}') ?? 5).toInt();
    final paying = (num.tryParse('${s['paying']}') ?? 0).toInt();
    final pct = every > 0 ? ((paying % every) / every).clamp(0.0, 1.0) : 0.0;
    final code = '${s['code'] ?? ''}';
    final link = 'https://app.velosalesai.com.ng/login?ref=${Uri.encodeComponent(code)}';
    final text = 'I use VeloSales Ai — my WhatsApp shop answers customers 24/7, even at 2am. '
        'Start free with my code $code (we BOTH get ${s['quizDays'] ?? 14} Pro days free): $link';
    final history = (_x?['history'] as List? ?? const []);
    final leaders = (_x?['leaders'] as List? ?? const []);

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 28), children: [
        _hero(code, link, text, pct, s),
        const SizedBox(height: 14),
        Row(children: [
          Expanded(child: _stat('Invited', '${s['invited'] ?? 0}', 'Friends with your code')),
          const SizedBox(width: 10),
          Expanded(child: _stat('Finished setup', '${s['qualified'] ?? 0}', 'Connected or first chat')),
        ]),
        const SizedBox(height: 10),
        Row(children: [
          Expanded(child: _stat('Paying', '$paying', 'Earning you airtime')),
          const SizedBox(width: 10),
          Expanded(
            child: _stat('Pro earned', '${s['daysEarned'] ?? 0}d', 'Banked on your account',
                tone: VeloSalesTheme.greenDark),
          ),
        ]),
        const SizedBox(height: 18),
        const Text('How you earn',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        _reward(Icons.card_giftcard_rounded, '${s['quizDays'] ?? 14} Pro days × 2',
            'Both shops get real Pro the moment your friend starts using the app.'),
        _reward(Icons.payments_outlined, '₦500 airtime',
            'Every $every paying friend = ₦500 airtime. We track it and alert you.',
            gold: true),
        _reward(Icons.emoji_events_outlined, 'Monthly champion',
            'Top referrer each month wins a free Plus month and a shout-out.'),
        const SizedBox(height: 18),
        Row(children: [
          const Expanded(
            child: Text('My rewards',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
          ),
          Text('${s['daysEarned'] ?? 0} Pro days earned',
              style: TextStyle(
                  fontSize: 12,
                  color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.55))),
        ]),
        const SizedBox(height: 8),
        if (history.isEmpty)
          _empty('Nothing yet', 'Share your code above — every reward lands here the moment it is credited.')
        else
          GlassCard(
            radius: 16,
            child: Column(children: [
              for (var i = 0; i < history.length; i++) ...[
                _historyRow((history[i] as Map).cast<String, dynamic>()),
                if (i != history.length - 1) const Divider(height: 1),
              ],
            ]),
          ),
        const SizedBox(height: 18),
        const Text("This month's leaders",
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        if (leaders.isEmpty)
          _empty('No paying referrals yet', 'Be the first name on this board.')
        else
          GlassCard(
            radius: 16,
            child: Column(children: [
              for (var i = 0; i < leaders.length; i++) ...[
                _leaderRow(i, (leaders[i] as Map).cast<String, dynamic>()),
                if (i != leaders.length - 1) const Divider(height: 1),
              ],
            ]),
          ),
        const SizedBox(height: 12),
        Text(
          'Anti-cheat on: self-referrals blocked, rewards gated behind a real setup, airtime only on paying shops.',
          style: TextStyle(
              fontSize: 11.5,
              height: 1.45,
              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.55)),
        ),
      ]),
    );
  }

  /// The one indigo wash in the app — same gradient as the drawer, so the page
  /// is unmistakably part of the frame. Everything else stays white-on-canvas.
  Widget _hero(String code, String link, String text, double pct, Map<String, dynamic> s) {
    final nextIn = s['nextMilestoneIn'] ?? 0;
    final amount = _naira(s['milestoneAmount']);
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: VeloSalesTheme.railGrad,
        borderRadius: BorderRadius.circular(22),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('YOUR INVITE CODE',
            style: TextStyle(
                fontSize: 10.5,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.2,
                color: VeloSalesTheme.railMuted)),
        const SizedBox(height: 6),
        Row(children: [
          Expanded(
            child: Text(code,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.4,
                    color: Colors.white)),
          ),
          IconButton(
            onPressed: () => _copy(code, 'Code'),
            icon: const Icon(Icons.copy_rounded, size: 18, color: Colors.white),
            tooltip: 'Copy code',
            style: IconButton.styleFrom(
                backgroundColor: Colors.white.withValues(alpha: 0.12)),
          ),
        ]),
        const SizedBox(height: 8),
        Text(
          'A friend joins with your code and starts using it — connects a channel or sends the first chat — and you both get ${s['quizDays'] ?? 14} Pro days.',
          style: const TextStyle(fontSize: 13, height: 1.5, color: Color(0xFFD6D1F4)),
        ),
        const SizedBox(height: 14),
        Row(children: [
          Expanded(
            child: FilledButton.icon(
              onPressed: () => launchUrl(
                  Uri.parse('https://wa.me/?text=${Uri.encodeComponent(text)}'),
                  mode: LaunchMode.externalApplication),
              style: FilledButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: VeloSalesTheme.rail2),
              icon: const Icon(Icons.chat_bubble_outline_rounded, size: 17),
              label: const Text('Share on WhatsApp'),
            ),
          ),
        ]),
        const SizedBox(height: 8),
        Row(children: [
          Expanded(
            child: OutlinedButton.icon(
              onPressed: () => _copy(link, 'Invite link'),
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.white,
                side: BorderSide(color: Colors.white.withValues(alpha: 0.26)),
                backgroundColor: Colors.white.withValues(alpha: 0.10),
              ),
              icon: const Icon(Icons.link_rounded, size: 17),
              label: const Text('Copy invite link'),
            ),
          ),
        ]),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('AIRTIME EARNED',
                style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.2,
                    color: VeloSalesTheme.railMuted)),
            const SizedBox(height: 4),
            Row(children: [
              Text(_naira(s['airtimeDue']),
                  style: const TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w800,
                      color: Colors.white)),
              const SizedBox(width: 8),
              if ((num.tryParse('${s['airtimeDue']}') ?? 0) > 0)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                      color: const Color(0xFFFCD34D),
                      borderRadius: BorderRadius.circular(999)),
                  child: const Text('ON THE WAY',
                      style: TextStyle(
                          fontSize: 9.5,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.6,
                          color: Color(0xFF6B4D16))),
                ),
            ]),
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(99),
              child: LinearProgressIndicator(
                value: pct,
                minHeight: 7,
                backgroundColor: Colors.white.withValues(alpha: 0.18),
                valueColor:
                    const AlwaysStoppedAnimation(Color(0xFFF59E0B)),
              ),
            ),
            const SizedBox(height: 8),
            Text('$nextIn more paying ${nextIn == 1 ? 'friend' : 'friends'} to $amount airtime',
                style: const TextStyle(fontSize: 12, color: Color(0xFFCDC7EE))),
          ]),
        ),
      ]),
    );
  }

  Widget _stat(String label, String value, String sub, {Color? tone}) {
    final theme = Theme.of(context);
    return GlassCard(
      radius: 16,
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label.toUpperCase(),
              style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.9,
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.55))),
          const SizedBox(height: 6),
          Text(value,
              style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.6,
                  color: tone ?? theme.colorScheme.onSurface)),
          const SizedBox(height: 2),
          Text(sub,
              style: TextStyle(
                  fontSize: 11.5,
                  height: 1.35,
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.55))),
        ]),
      ),
    );
  }

  Widget _reward(IconData icon, String title, String body, {bool gold = false}) {
    final theme = Theme.of(context);
    return GlassCard(
      radius: 16,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: gold ? const Color(0xFFFFF7E6) : VeloSalesTheme.purpleSoft,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon,
                size: 20,
                color: gold ? VeloSalesTheme.gold : VeloSalesTheme.purpleDark),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title,
                  style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800)),
              const SizedBox(height: 3),
              Text(body,
                  style: TextStyle(
                      fontSize: 12.5,
                      height: 1.45,
                      color: theme.colorScheme.onSurface.withValues(alpha: 0.6))),
            ]),
          ),
        ]),
      ),
    );
  }

  Widget _historyRow(Map<String, dynamic> h) {
    final theme = Theme.of(context);
    final kind = '${h['kind'] ?? ''}';
    final name = kind == 'pro_days'
        ? 'Pro days'
        : kind == 'airtime'
            ? 'Airtime'
            : kind == 'plus_month'
                ? 'Plus month'
                : kind;
    final pending = '${h['status']}' == 'pending';
    final extra = h['days'] != null
        ? ' +${h['days']} days'
        : h['amount'] != null
            ? ' ${_naira(h['amount'])}'
            : '';
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      child: Row(children: [
        Icon(
          kind == 'airtime'
              ? Icons.payments_outlined
              : kind == 'plus_month'
                  ? Icons.emoji_events_outlined
                  : Icons.card_giftcard_rounded,
          size: 19,
          color: pending ? VeloSalesTheme.gold : VeloSalesTheme.purpleDark,
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('$name$extra',
                style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700)),
            if (h['note'] != null)
              Text('${h['note']}',
                  style: TextStyle(
                      fontSize: 11.5,
                      color: theme.colorScheme.onSurface.withValues(alpha: 0.55))),
          ]),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: pending ? const Color(0xFFFFF7E6) : const Color(0xFFD9F7EA),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text('${h['status'] ?? 'credited'}',
              style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w800,
                  color: pending ? VeloSalesTheme.gold : VeloSalesTheme.greenDark)),
        ),
      ]),
    );
  }

  Widget _leaderRow(int i, Map<String, dynamic> l) {
    final theme = Theme.of(context);
    const medals = [Color(0xFFF59E0B), Color(0xFFB8C2D0), Color(0xFFD09A6A)];
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      child: Row(children: [
        Container(
          width: 24,
          height: 24,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: i < 3 ? medals[i] : theme.colorScheme.surfaceContainerHighest,
          ),
          child: Text('${i + 1}',
              style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: i < 3 ? Colors.white : theme.colorScheme.onSurface)),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${l['name'] ?? 'Seller'}',
                style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700)),
            Text('${l['paying'] ?? 0} paying referral${l['paying'] == 1 ? '' : 's'}',
                style: TextStyle(
                    fontSize: 11.5,
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.55))),
          ]),
        ),
      ]),
    );
  }

  Widget _empty(String title, String body) {
    final theme = Theme.of(context);
    return GlassCard(
      radius: 16,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title,
              style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800)),
          const SizedBox(height: 3),
          Text(body,
              style: TextStyle(
                  fontSize: 12.5,
                  height: 1.45,
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.55))),
        ]),
      ),
    );
  }
}
