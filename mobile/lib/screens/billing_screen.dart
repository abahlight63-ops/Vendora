// ── lib/screens/billing_screen.dart ──────────────────────────────
// WHAT: subscription status + plans (GET /api/me/billing) + bank-transfer
// details. Card checkout + transfer form stay in the BROWSER (Paystack
// redirect + receipt flow need a full web page) — this screen deep-links
// there with one tap. Same account, same session state server-side.
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../glass.dart';
import '../motion.dart';

const _webBilling = 'https://vendorabot.vercel.app/billing';

// Same shared feature list as the web Billing page.
const _coreFeats = [
  'Unlimited AI replies, Pidgin + English',
  'Instant owner alerts for hot orders',
  'Full inbox + chat history',
  'ComeBack follow-ups for abandoned buyers',
  'Catalog LEARN mode from WhatsApp',
  'Insights: handled %, peak hours',
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

  /// "Save ₦40,000 — 44% off monthly" (web plan-save pill math).
  String? _saveLine(dynamic yearly, String cur) {
    if (yearly is! Map) return null;
    final save = yearly['save'] ?? yearly['save_naira'];
    final pct = yearly['save_pct'];
    if (save == null) return null;
    return 'Save ${_money(save, cur)}${pct != null ? ' — $pct% off monthly' : ''}';
  }

  /// "Pays for itself in ~N months vs monthly" (web lifetime math).
  String? _payback(Map<String, dynamic> plans) {
    final life = (plans['lifetime'] as Map?)?['amount'];
    final monthly = (plans['monthly'] as Map?)?['amount'];
    final l = num.tryParse('$life');
    final m = num.tryParse('$monthly');
    if (l == null || m == null || m <= 0) return null;
    final n = (l / m).round().clamp(1, 9999);
    return 'Pays for itself in ~$n months vs monthly';
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
    final plans = (_bill!['plans'] as Map? ?? {}).cast<String, dynamic>();
    final t = (_bill!['transfer'] as Map? ?? {}).cast<String, dynamic>();
    String amt(String k) =>
        _money((plans[k] as Map?)?['amount'] ?? 0, cur);
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
                  if (_bill!['expires'] != null)
                    Text('Pro until: ${_bill!['expires']}'),
                  if (_bill!['trial_ends'] != null)
                    Text('Trial ends: ${_bill!['trial_ends']}'),
                ]),
          ),
        ),
        const SizedBox(height: 12),
        for (final p in ['monthly', 'yearly', 'lifetime'])
          _PlanCard(
            plan: p,
            amount: amt(p),
            save: p == 'yearly'
                ? _saveLine(plans['yearly'], cur)
                : p == 'lifetime'
                    ? _payback(plans)
                    : null,
            hot: p == 'yearly',
          ),
        if ('${t['bank'] ?? ''}'.isNotEmpty) ...[
          const SizedBox(height: 4),
          GlassCard(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Pay by bank transfer',
                        style: TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 6),
                    Text('Bank: ${t['bank']}'),
                    Text('Account: ${t['account_number']}'),
                    Text('Name: ${t['account_name']}'),
                    const SizedBox(height: 6),
                    const Text(
                        'Send the exact plan amount, then complete verification in the browser checkout.'),
                  ]),
            ),
          ),
        ],
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
// line, shared feature list. Tap opens the browser checkout.
class _PlanCard extends StatelessWidget {
  final String plan;
  final String amount;
  final String? save;
  final bool hot;
  const _PlanCard(
      {required this.plan,
      required this.amount,
      this.save,
      this.hot = false});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final feats = [
      ..._coreFeats,
      if (plan != 'monthly') 'Priority support — jump the queue',
      if (plan == 'lifetime') 'Locked price forever',
    ];
    return GlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      radius: 16,
      // Hot plan keeps its accent rim (glass edge overridden, not removed).
      border: Border.all(
          color: hot ? scheme.primary : Glass.edge(context),
          width: hot ? 1.5 : 1),
      onTap: () => launchUrl(Uri.parse(_webBilling),
          mode: LaunchMode.externalApplication),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (hot)
              Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                    color: scheme.primary,
                    borderRadius: BorderRadius.circular(6)),
                child: Text(
                    plan == 'yearly' ? 'MOST POPULAR' : 'BEST VALUE',
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: scheme.onPrimary)),
              ),
            Text(plan[0].toUpperCase() + plan.substring(1),
                style:
                    const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text(amount,
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
