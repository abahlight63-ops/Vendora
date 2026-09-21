// ── lib/screens/billing_screen.dart ──────────────────────────────
// WHAT: subscription status + tiers (GET /api/me/billing) + trial countdown.
// Card checkout stays in the BROWSER (secure checkout redirect needs a full
// web page) — this screen deep-links there with one tap. Same account, same
// session state server-side. Checkout brand names never appear here.
// TIERS: Pro (₦7,499/mo · ₦69,999/yr ≈ 22% off) + Pro Plus (₦14,999/mo ·
// ₦119,999/yr ≈ 33% off, + voice notes + 2 heavy work models). Pay-once
// goes via sales email (no self-serve lifetime checkout).
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../glass.dart';
import '../motion.dart';

const _webBilling = 'https://vendorabot.vercel.app/billing';
const _fallbackSalesEmail = 'vendorabot26@gmail.com';

// Pro tier: the full salesperson (same list as the web Billing page).
const _proFeats = [
  'Unlimited AI replies, Pidgin + English',
  'Suggestive selling — up to 5 options per answer',
  'Product photos inside WhatsApp + Telegram replies',
  'Instant owner alerts for hot orders',
  'Full inbox + chat history',
  'ComeBack follow-ups for abandoned buyers',
  'Catalog LEARN mode from WhatsApp',
  'Profile sync + verified products',
  'Insights: handled %, peak hours',
];

// Pro Plus extras (shown AFTER the first 4 Pro feats, mirroring web).
const _plusExtras = [
  'Voice-note transcription (Whisper AI)',
  '2 heavy work models (Kimi K2 + GPT-4o mini)',
  'Priority support — jump the queue',
];

class BillingScreen extends StatefulWidget {
  const BillingScreen({super.key});

  @override
  State<BillingScreen> createState() => _BillingScreenState();
}

class _BillingScreenState extends State<BillingScreen> {
  Map<String, dynamic>? _bill;
  String? _err;
  bool _loading = true;
  String _period = 'yearly'; // 'monthly' | 'yearly' (yearly default: shows the savings!)

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
      _bill = await ApiClient.instance.billing();
    } on ApiException catch (e) {
      _err = e.message;
    } catch (_) {
      _err = 'No connection.';
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _money(dynamic amount, String cur) {
    final n = num.tryParse('$amount') ?? 0;
    final s = n.toStringAsFixed(n.truncateToDouble() == n ? 0 : 2);
    // Thousand-separator (manual — no intl dep for one screen).
    final parts = s.split('.');
    final buf = StringBuffer();
    for (var i = 0; i < parts[0].length; i++) {
      final rev = parts[0].length - i;
      buf.write(parts[0][i]);
      if (rev > 1 && rev % 3 == 1) buf.write(',');
    }
    final sym = cur == 'USD' ? '\$' : '₦';
    final dec = parts.length > 1 ? '.${parts[1]}' : '';
    return '$sym$buf$dec';
  }

  /// "Save ₦19,989 — 22% off monthly" (per-tier yearly math from the backend).
  String? _saveLine(Map<String, dynamic>? tierYearly, String cur) {
    if (tierYearly == null) return null;
    final save = tierYearly['save'] ?? tierYearly['save_naira'];
    final pct = tierYearly['save_pct'];
    if (save == null) return null;
    return 'Save ${_money(save, cur)}${pct != null ? ' — $pct% off monthly' : ''}';
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          Skeleton(height: 110),
          SizedBox(height: 12),
          Skeleton(height: 64),
          SizedBox(height: 10),
          Skeleton(height: 64),
          SizedBox(height: 10),
          Skeleton(height: 64),
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
    final cur = '${_bill!['currency'] ?? 'NGN'}';
    final trialLeft = _bill!['trial_days_left']; // whole days left (number when trialing, null otherwise!)
    final plans = (_bill!['plans'] as Map? ?? {}).cast<String, dynamic>();
    // Nested tiers (new backend) with legacy fallback (old backend / cache).
    Map<String, dynamic> tierOf(String key, String legacyKey) {
      final nested = plans[key];
      if (nested is Map) return nested.cast<String, dynamic>();
      final m = plans['monthly'];
      final y = plans['yearly'];
      return {
        'monthly': m is Map ? m : {'amount': key == 'plus' ? 14999 : 7499},
        'yearly': y is Map ? y : {'amount': key == 'plus' ? 119999 : 69999},
      };
    }

    final pro = tierOf('pro', 'monthly');
    final plus = tierOf('plus', 'monthly');
    final salesEmail =
        '${_bill!['sales_email'] ?? plans['sales_email'] ?? _fallbackSalesEmail}';
    String amt(Map<String, dynamic> tier, String p) =>
        _money((tier[p] as Map?)?['amount'] ?? 0, cur);
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(padding: const EdgeInsets.all(16), children: [
        GlassCard(
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Your subscription',
                      style:
                          TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 6),
                  Text('Status: ${_bill!['status'] ?? '—'}'),
                  Text(cur == 'USD'
                      ? 'Secure checkout (intl cards)'
                      : 'Secure checkout (NGN cards + bank)'),
                  if (_bill!['expires'] != null)
                    Text('Pro until: ${_bill!['expires']}'),
                  if (_bill!['status'] == 'trialing' && trialLeft is num)
                    Text(
                        'Pro trial: $trialLeft day${trialLeft == 1 ? '' : 's'} left',
                        style: const TextStyle(fontWeight: FontWeight.w700)),
                  if (_bill!['trial_ends'] != null)
                    Text('Trial ends: ${_bill!['trial_ends']}'),
                ]),
          ),
        ),
        const SizedBox(height: 12),
        // Billing-period toggle (mirrors the web segmented control).
        GlassCard(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(children: [
              const Text('Period:',
                  style: TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(width: 8),
              ChoiceChip(
                label: const Text('Monthly'),
                selected: _period == 'monthly',
                onSelected: (_) => setState(() => _period = 'monthly'),
              ),
              const SizedBox(width: 8),
              ChoiceChip(
                label: const Text('Yearly'),
                selected: _period == 'yearly',
                onSelected: (_) => setState(() => _period = 'yearly'),
              ),
            ]),
          ),
        ),
        const SizedBox(height: 12),
        _TierCard(
          tier: 'Pro',
          amount: amt(pro, _period),
          period: _period,
          save: _period == 'yearly'
              ? _saveLine(pro['yearly'] as Map<String, dynamic>?, cur)
              : null,
          feats: _proFeats,
          hot: false,
          badge: null,
        ),
        _TierCard(
          tier: 'Pro Plus',
          amount: amt(plus, _period),
          period: _period,
          save: _period == 'yearly'
              ? _saveLine(plus['yearly'] as Map<String, dynamic>?, cur)
              : null,
          feats: [..._proFeats.sublist(0, 4), ..._plusExtras, ..._proFeats.sublist(4)],
          hot: true,
          badge: 'MOST POWER',
        ),
        // Enterprise: personal sales conversation (no self-serve checkout).
        GlassCard(
          margin: const EdgeInsets.only(bottom: 12),
          radius: 16,
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Enterprise',
                      style: TextStyle(
                          fontSize: 18, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  const Text(
                      'Chains, franchises, high-volume shops. Everything in Pro Plus, plus:',
                      style: TextStyle(fontSize: 13)),
                  const SizedBox(height: 8),
                  for (final f in const [
                    'Multiple branches, one dashboard',
                    'Dedicated onboarding call + team training',
                    'Priority support, same-day response',
                    'Custom integrations and reports',
                    'Annual invoicing — card or transfer',
                  ])
                    Padding(
                      padding: const EdgeInsets.only(bottom: 5),
                      child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(Icons.check_circle,
                                size: 15,
                                color: Theme.of(context).colorScheme.primary),
                            const SizedBox(width: 8),
                            Expanded(
                                child: Text(f,
                                    style:
                                        const TextStyle(fontSize: 13))),
                          ]),
                    ),
                  const SizedBox(height: 10),
                  FilledButton.tonalIcon(
                    onPressed: () => launchUrl(
                        Uri.parse(
                            'mailto:$salesEmail?subject=${Uri.encodeComponent('VeloSales Ai Enterprise enquiry')}&body=${Uri.encodeComponent('Hello VeloSales Ai team,\n\nShop name:\nNumber of branches:\nWhatsApp numbers to connect:\n\nThanks!')}')),
                    icon: const Icon(Icons.email_outlined),
                    label: Text('Contact sales — $salesEmail'),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                      'Old pay-once buyers keep lifetime access.',
                      style: TextStyle(fontSize: 11)),
                ]),
          ),
        ),
        const SizedBox(height: 12),
        FilledButton.icon(
          onPressed: () => launchUrl(Uri.parse(_webBilling),
              mode: LaunchMode.externalApplication),
          icon: const Icon(Icons.open_in_new),
          label: const Text('Open secure checkout in browser'),
        ),
      ]),
    );
  }
}

// Pricing card — mirrors the web .plan cards: hot badge, price, save
// line, feature list. Tap opens the browser checkout.
class _TierCard extends StatelessWidget {
  final String tier;
  final String amount;
  final String period;
  final String? save;
  final List<String> feats;
  final bool hot;
  final String? badge;
  const _TierCard(
      {required this.tier,
      required this.amount,
      required this.period,
      required this.feats,
      this.save,
      this.hot = false,
      this.badge});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return GlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      radius: 16,
      // Hot tier keeps its accent rim (glass edge overridden, not removed).
      border: Border.all(
          color: hot ? scheme.primary : Glass.edge(context),
          width: hot ? 1.5 : 1),
      onTap: () => launchUrl(Uri.parse(_webBilling),
          mode: LaunchMode.externalApplication),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (hot && badge != null)
              Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                    color: scheme.primary,
                    borderRadius: BorderRadius.circular(6)),
                child: Text(badge!,
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: scheme.onPrimary)),
              ),
            Text(tier,
                style:
                    const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text('$amount/${period == 'monthly' ? 'month' : 'year'}',
                style:
                    const TextStyle(fontSize: 26, fontWeight: FontWeight.w800)),
            if (save != null) ...[
              const SizedBox(height: 4),
              Text(save!,
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: scheme.primary)),
            ],
            const SizedBox(height: 10),
            for (final f in feats)
              Padding(
                padding: const EdgeInsets.only(bottom: 5),
                child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.check_circle,
                          size: 15, color: scheme.primary),
                      const SizedBox(width: 8),
                      Expanded(
                          child: Text(f,
                              style: const TextStyle(fontSize: 13))),
                    ]),
              ),
          ]),
      ),
    );
  }
}
