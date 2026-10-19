// ── lib/screens/billing_screen.dart ──────────────────────────────
// WHAT: subscriptions on the phone, laid out like the web page: your CURRENT
// PLAN beside "this plan, in numbers", then the tiers, then the receipts table
// and the payment-method card, then Enterprise.
//
// CARD CHECKOUT STAYS IN THE BROWSER. A secure checkout needs a full page and
// a verified return URL, so this screen deep-links there in one tap — same
// account, same session, same server-side truth.
//
// HISTORY IS NEVER INVENTED. The server may not send any rows yet; the table
// then says so plainly. A fake receipt is worse than an empty list.
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../glass.dart';
import '../motion.dart';
import '../theme.dart';
import '../widgets/brand_ui.dart';

final _webBilling = ApiClient.billingUrl;
const _fallbackSalesEmail = 'velosales63@gmail.com';

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
  String _period = 'yearly';

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
      final b = await ApiClient.instance.billing();
      if (mounted) setState(() => _bill = b);
    } on ApiException catch (e) {
      if (mounted) setState(() => _err = e.message);
    } catch (_) {
      if (mounted) setState(() => _err = 'No connection.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _money(dynamic amount, String cur) {
    final n = num.tryParse('$amount') ?? 0;
    final s = n.toStringAsFixed(n.truncateToDouble() == n ? 0 : 2);
    final parts = s.split('.');
    final buf = StringBuffer();
    for (var i = 0; i < parts[0].length; i++) {
      final rev = parts[0].length - i;
      buf.write(parts[0][i]);
      if (rev > 1 && rev % 3 == 1) buf.write(',');
    }
    return '${cur == 'USD' ? '\$' : '₦'}$buf${parts.length > 1 ? '.${parts[1]}' : ''}';
  }

  String? _saveLine(Map<String, dynamic>? tierYearly, String cur) {
    if (tierYearly == null) return null;
    final save = tierYearly['save'] ?? tierYearly['save_naira'];
    final pct = tierYearly['save_pct'];
    if (save == null) return null;
    return 'Save ${_money(save, cur)}${pct != null ? ' — $pct% off monthly' : ''}';
  }

  Future<void> _checkout() async {
    final ok = await launchUrl(Uri.parse(_webBilling),
        mode: LaunchMode.externalApplication);
    if (!ok && mounted) {
      showToast(context, 'Could not open the browser — try again.', type: 'err');
    }
  }

  static String _date(dynamic raw) {
    if (raw == null) return '—';
    final t = DateTime.tryParse('$raw');
    if (t == null) return '$raw';
    const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${t.day} ${m[t.month - 1]} ${t.year}';
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return ListView(padding: const EdgeInsets.all(16), children: const [
        Skeleton(height: 150, radius: 18),
        SizedBox(height: 12),
        Skeleton(height: 96, radius: 18),
        SizedBox(height: 12),
        Skeleton(height: 210, radius: 18),
        SizedBox(height: 12),
        Skeleton(height: 210, radius: 18),
      ]);
    }
    if (_err != null) {
      return EmptyState('Could not load billing', _err!, retry: _load);
    }

    final scheme = Theme.of(context).colorScheme;
    final bill = _bill!;
    final cur = '${bill['currency'] ?? 'NGN'}';
    final status = '${bill['status'] ?? 'free'}';
    final trialLeft = bill['trial_days_left'];
    final plans = (bill['plans'] as Map? ?? {}).cast<String, dynamic>();

    Map<String, dynamic> tierOf(String key) {
      final nested = plans[key];
      if (nested is Map) return nested.cast<String, dynamic>();
      final m = plans['monthly'];
      final y = plans['yearly'];
      return {
        'monthly': m is Map ? m : {'amount': key == 'plus' ? 14999 : 7499},
        'yearly': y is Map ? y : {'amount': key == 'plus' ? 119999 : 69999},
      };
    }

    final pro = tierOf('pro');
    final plus = tierOf('plus');
    final planName = bill['tier'] == 'plus'
        ? 'Pro Plus'
        : bill['tier'] == 'pro'
            ? 'Pro'
            : 'Free';
    final allowance = bill['tier'] == 'plus'
        ? 'Unlimited'
        : bill['tier'] == 'pro'
            ? '500 per day'
            : '50 per day';
    final renewal = status == 'active'
        ? _date(bill['expires'])
        : status == 'trialing'
            ? _date(bill['trial_ends'])
            : '—';
    final history = (bill['history'] is List)
        ? (bill['history'] as List)
        : (bill['invoices'] is List)
            ? (bill['invoices'] as List)
            : const [];
    final paidTotal = history.where((h) {
      final st = '${(h as Map)['status'] ?? h['state'] ?? 'paid'}'.toLowerCase();
      return st == 'paid' || st == 'successful' || st == 'success';
    }).fold<num>(0, (n, h) => n + (num.tryParse('${(h as Map)['amount']}') ?? 0));

    String amt(Map<String, dynamic> tier, String p) =>
        _money((tier[p] as Map?)?['amount'] ?? 0, cur);

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
        children: [
          // ── where you are + what it costs ───────────────────────────
          SoftPanel(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('CURRENT PLAN'.toUpperCase(),
                        style: TextStyle(
                            fontSize: 9.5,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1,
                            color: scheme.onSurface.withValues(alpha: 0.45))),
                    const SizedBox(height: 4),
                    Text(planName,
                        style: const TextStyle(
                            fontSize: 27,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.9)),
                    const SizedBox(height: 4),
                    Text(
                      status == 'active'
                          ? 'Active until $renewal. Photos, sync and priority support are on.'
                          : status == 'trialing'
                              ? 'Pro trial${trialLeft is num ? ' — $trialLeft day${trialLeft == 1 ? '' : 's'} left' : ''}. Ends $renewal.'
                              : status == 'pending'
                                  ? 'Payment received — activation is in progress.'
                                  : 'Free plan — the bot keeps replying from your catalog.',
                      style: TextStyle(
                          fontSize: 12.5,
                          height: 1.45,
                          color: scheme.onSurface.withValues(alpha: 0.66)),
                    ),
                  ]),
                ),
                const SizedBox(width: 10),
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  _StatusPill(status: status),
                  const SizedBox(height: 6),
                  Text(cur == 'USD' ? 'USD \$' : 'NGN ₦',
                      style: TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w700,
                          color: scheme.onSurface.withValues(alpha: 0.5))),
                ]),
              ]),
              const SizedBox(height: 14),
              Row(children: [
                Expanded(
                  child: GradientPill(
                    label: status == 'active' ? 'Renew now' : 'Upgrade to Pro',
                    height: 46,
                    onTap: _checkout,
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  width: 118,
                  height: 46,
                  child: OutlinedButton(
                    onPressed: _checkout,
                    style: OutlinedButton.styleFrom(
                      padding: EdgeInsets.zero,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(999)),
                    ),
                    child: const Text('All plans',
                        style: TextStyle(fontSize: 12.5)),
                  ),
                ),
              ]),
            ]),
          ),
          const SizedBox(height: 12),

          // ── this plan, in numbers ──────────────────────────────────
          SoftPanel(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('THIS PLAN, IN NUMBERS',
                  style: TextStyle(
                      fontSize: 9.5,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1,
                      color: scheme.onSurface.withValues(alpha: 0.45))),
              const SizedBox(height: 4),
              _NumRow('Bot replies', allowance),
              _NumRow('Billing cycle',
                  status == 'trialing'
                      ? 'Trial'
                      : status == 'active'
                          ? 'Monthly or yearly'
                          : 'Free — no charge'),
              _NumRow(
                  status == 'trialing'
                      ? 'Trial ends'
                      : status == 'active'
                          ? 'Renews on'
                          : 'Next charge',
                  renewal),
              _NumRow('Paid so far', history.isEmpty ? '—' : _money(paidTotal, cur)),
              const SizedBox(height: 6),
              Text('Your catalog, inbox and chat history are yours forever — on any plan.',
                  style: TextStyle(
                      fontSize: 11.5,
                      height: 1.45,
                      color: scheme.onSurface.withValues(alpha: 0.5))),
            ]),
          ),
          const SizedBox(height: 18),

          // ── period + tiers ─────────────────────────────────────────
          Row(children: [
            const SectionLabel('Plans'),
            const Spacer(),
            _Segment(
              label: 'Monthly',
              on: _period == 'monthly',
              onTap: () => setState(() => _period = 'monthly'),
            ),
            const SizedBox(width: 6),
            _Segment(
              label: 'Yearly',
              on: _period == 'yearly',
              onTap: () => setState(() => _period = 'yearly'),
            ),
          ]),
          _TierCard(
            tier: 'Free',
            amount: _money(0, cur),
            period: 'forever',
            feats: const [
              'AI replies from products you add',
              'Catalog LEARN mode',
              'Full inbox + history',
              'Instant owner alerts',
              '50 bot replies per day',
            ],
            badge: 'FREE FOREVER',
            onTap: null,
          ),
          _TierCard(
            tier: 'Pro',
            amount: amt(pro, _period),
            period: _period == 'monthly' ? 'month' : 'year',
            save: _period == 'yearly'
                ? _saveLine(pro['yearly'] as Map<String, dynamic>?, cur)
                : null,
            feats: _proFeats,
            onTap: _checkout,
          ),
          _TierCard(
            tier: 'Pro Plus',
            amount: amt(plus, _period),
            period: _period == 'monthly' ? 'month' : 'year',
            save: _period == 'yearly'
                ? _saveLine(plus['yearly'] as Map<String, dynamic>?, cur)
                : null,
            feats: [..._proFeats.sublist(0, 4), ..._plusExtras, ..._proFeats.sublist(4)],
            hot: true,
            badge: 'MOST POWER',
            onTap: _checkout,
          ),
          const SizedBox(height: 20),

          // ── receipts ───────────────────────────────────────────────
          SectionLabel('Billing history',
              trailing: Text(
                '${history.length} record${history.length == 1 ? '' : 's'}',
                style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w700,
                    color: scheme.onSurface.withValues(alpha: 0.5)),
              )),
          SoftPanel(
            padding: const EdgeInsets.all(14),
            child: history.isEmpty
                ? Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Text('No payments yet',
                        style: TextStyle(
                            fontSize: 13.5, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 4),
                    Text(
                      'Every attempt lands here with its result — including failed ones, so nothing is ever a surprise.',
                      style: TextStyle(
                          fontSize: 12.5,
                          height: 1.5,
                          color: scheme.onSurface.withValues(alpha: 0.62)),
                    ),
                  ])
                : Column(children: [
                    for (var i = 0; i < history.length; i++) ...[
                      _HistoryRow(row: history[i] as Map, money: _money, cur: cur),
                      if (i != history.length - 1) const Divider(height: 18),
                    ],
                  ]),
          ),
          const SizedBox(height: 18),

          // ── how you pay ────────────────────────────────────────────
          const SectionLabel('Payment method'),
          _PaymentCard(bill: bill, cur: cur, onPay: _checkout),
          const SizedBox(height: 20),

          // ── enterprise ─────────────────────────────────────────────
          const SectionLabel('Enterprise'),
          SoftPanel(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('For chains, franchises and high-volume shops. Everything in Pro Plus, plus:',
                  style: TextStyle(
                      fontSize: 12.5,
                      height: 1.5,
                      color: scheme.onSurface.withValues(alpha: 0.66))),
              const SizedBox(height: 10),
              for (final f in const [
                'Multiple branches, one dashboard',
                'Dedicated onboarding call + team training',
                'Priority support, same-day response',
                'Custom integrations and reports',
                'Annual invoicing — card or transfer',
              ])
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Padding(
                      padding: EdgeInsets.only(top: 1),
                      child: Icon(Icons.check_circle,
                          size: 14, color: VeloSalesTheme.green),
                    ),
                    const SizedBox(width: 8),
                    Expanded(child: Text(f, style: const TextStyle(fontSize: 12.5))),
                  ]),
                ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () => launchUrl(
                    Uri.parse(
                        'mailto:${bill['sales_email'] ?? plans['sales_email'] ?? _fallbackSalesEmail}'
                        '?subject=${Uri.encodeComponent('VeloSales Ai Enterprise enquiry')}'
                        '&body=${Uri.encodeComponent('Hello VeloSales Ai team,\n\nShop name:\nNumber of branches:\nWhatsApp numbers to connect:\n\nThanks!')}'),
                  ),
                  icon: const Icon(Icons.mail_outline, size: 17),
                  label: const Text('Contact sales'),
                ),
              ),
            ]),
          ),
          const SizedBox(height: 14),
          Text(
            'Secure card checkout — ${cur == 'USD' ? 'international cards welcome' : 'all Nigerian cards + bank channels'}. Activation is instant.',
            textAlign: TextAlign.center,
            style: TextStyle(
                fontSize: 11.5,
                height: 1.5,
                color: scheme.onSurface.withValues(alpha: 0.5)),
          ),
        ],
      ),
    );
  }
}

class _NumRow extends StatelessWidget {
  final String label;
  final String value;
  const _NumRow(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(
        border: Border(
            bottom: BorderSide(
                color: scheme.outline.withValues(alpha: 0.55))),
      ),
      child: Row(children: [
        Expanded(
          child: Text(label,
              style: TextStyle(
                  fontSize: 12.5,
                  color: scheme.onSurface.withValues(alpha: 0.6))),
        ),
        Text(value,
            style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
      ]),
    );
  }
}

class _StatusPill extends StatelessWidget {
  final String status;
  const _StatusPill({required this.status});

  @override
  Widget build(BuildContext context) {
    final active = status == 'active';
    final trialing = status == 'trialing';
    final color = active
        ? VeloSalesTheme.greenDark
        : trialing
            ? VeloSalesTheme.gold
            : Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.55);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(status, style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: color)),
    );
  }
}

class _Segment extends StatelessWidget {
  final String label;
  final bool on;
  final VoidCallback onTap;
  const _Segment({required this.label, required this.on, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Pressable(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: on ? scheme.primary : scheme.surface,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: on ? scheme.primary : scheme.outline),
        ),
        child: Text(label,
            style: TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w700,
                color: on ? Colors.white : scheme.onSurface.withValues(alpha: 0.66))),
      ),
    );
  }
}

class _TierCard extends StatelessWidget {
  final String tier;
  final String amount;
  final String period;
  final String? save;
  final List<String> feats;
  final bool hot;
  final String? badge;
  final VoidCallback? onTap;

  const _TierCard({
    required this.tier,
    required this.amount,
    required this.period,
    required this.feats,
    this.save,
    this.hot = false,
    this.badge,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Pressable(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(17),
          decoration: BoxDecoration(
            color: scheme.surface,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
                color: hot ? scheme.primary : scheme.outline,
                width: hot ? 1.5 : 1),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (badge != null) ...[
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                decoration: BoxDecoration(
                  color: hot ? scheme.primary : VeloSalesTheme.greenDark,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(badge!,
                    style: const TextStyle(
                        fontSize: 9.5,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.5,
                        color: Colors.white)),
              ),
              const SizedBox(height: 8),
            ],
            Text(tier,
                style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.3)),
            const SizedBox(height: 2),
            Text('$amount/$period',
                style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.7)),
            if (save != null) ...[
              const SizedBox(height: 3),
              Text(save!,
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: scheme.primary)),
            ],
            const SizedBox(height: 10),
            for (final f in feats)
              Padding(
                padding: const EdgeInsets.only(bottom: 5),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Padding(
                    padding: EdgeInsets.only(top: 1),
                    child: Icon(Icons.check_circle,
                        size: 14, color: VeloSalesTheme.green),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                      child: Text(f, style: const TextStyle(fontSize: 12.5))),
                ]),
              ),
            if (onTap != null) ...[
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                height: 44,
                child: FilledButton(
                  onPressed: onTap,
                  child: Text(hot ? 'Choose Pro Plus' : 'Choose $tier'),
                ),
              ),
            ],
          ]),
        ),
      ),
    );
  }
}

class _HistoryRow extends StatelessWidget {
  final Map row;
  final String Function(dynamic, String) money;
  final String cur;
  const _HistoryRow({required this.row, required this.money, required this.cur});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final st = '${row['status'] ?? row['state'] ?? 'paid'}'.toLowerCase();
    final ok = st == 'paid' || st == 'successful' || st == 'success';
    final pending = st == 'pending';
    final color = ok
        ? VeloSalesTheme.greenDark
        : pending
            ? VeloSalesTheme.gold
            : VeloSalesTheme.red;
    final when = row['date'] ?? row['created_at'] ?? row['paid_at'];
    final d = DateTime.tryParse('$when');
    const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    final label = d == null ? '—' : '${d.day} ${m[d.month - 1]} ${d.year}';
    return Row(children: [
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${row['description'] ?? row['plan'] ?? 'Subscription'}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
          const SizedBox(height: 2),
          Text(label,
              style: TextStyle(
                  fontSize: 11.5,
                  color: scheme.onSurface.withValues(alpha: 0.5))),
        ]),
      ),
      const SizedBox(width: 10),
      Text(money(num.tryParse('${row['amount']}') ?? 0, '${row['currency'] ?? cur}'),
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
      const SizedBox(width: 8),
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(ok ? 'Paid' : pending ? 'Pending' : 'Failed',
            style: TextStyle(
                fontSize: 10.5, fontWeight: FontWeight.w800, color: color)),
      ),
    ]);
  }
}

/// The card face: it deliberately looks like a payment card, because that is
/// what the owner is checking. Where the server has no card details, it says
/// "No card on file" instead of inventing a number.
class _PaymentCard extends StatelessWidget {
  final Map<String, dynamic> bill;
  final String cur;
  final VoidCallback onPay;
  const _PaymentCard({required this.bill, required this.cur, required this.onPay});

  @override
  Widget build(BuildContext context) {
    final last4 = bill['card_last4'];
    final brand = '${bill['card_brand'] ?? 'CARD'}'.toUpperCase();
    return SoftPanel(
      padding: const EdgeInsets.all(14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          height: 200,
          width: double.infinity,
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF352A7F), Color(0xFF5B4BD6), Color(0xFF4F3FC7)],
            ),
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                  color: const Color(0xFF171132).withValues(alpha: 0.35),
                  blurRadius: 26,
                  offset: const Offset(0, 14)),
            ],
          ),
          child: Stack(children: [
            Positioned(
              right: -50,
              top: -60,
              child: Container(
                width: 170,
                height: 170,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(colors: [
                    Colors.white.withValues(alpha: 0.22),
                    Colors.white.withValues(alpha: 0),
                  ]),
                ),
              ),
            ),
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Container(
                  width: 32,
                  height: 24,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(5),
                    gradient: const LinearGradient(
                        colors: [Color(0xFFFCD34D), Color(0xFFD97706)]),
                  ),
                ),
                const Spacer(),
                Text(brand,
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.4,
                        color: Colors.white.withValues(alpha: 0.92))),
              ]),
              const Spacer(),
              Text(
                last4 == null
                    ? 'No card on file'
                    : '•••• •••• •••• $last4',
                style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 2,
                    color: Colors.white),
              ),
              const SizedBox(height: 10),
              Row(children: [
                Text(
                  '${bill['business_name'] ?? bill['name'] ?? 'YOUR SHOP'}'
                      .toUpperCase(),
                  style: TextStyle(
                      fontSize: 10,
                      letterSpacing: 1,
                      color: Colors.white.withValues(alpha: 0.78)),
                ),
                const Spacer(),
                Text('${bill['card_expiry'] ?? '—'}',
                    style: TextStyle(
                        fontSize: 10,
                        letterSpacing: 1,
                        color: Colors.white.withValues(alpha: 0.78))),
              ]),
            ]),
          ]),
        ),
        const SizedBox(height: 12),
        Text(
          'Payments happen on a secure checkout page — we never see or store your card details. Your bank sends the receipt.',
          style: TextStyle(
              fontSize: 12,
              height: 1.5,
              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.62)),
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: GradientPill(label: 'Make a payment', height: 46, onTap: onPay),
        ),
      ]),
    );
  }
}
