// ── lib/screens/billing_screen.dart ──────────────────────────────
// WHAT: subscription status + plans (GET /api/me/billing) + bank-transfer
// details. Card checkout + transfer form stay in the BROWSER (Paystack
// redirect + receipt flow need a full web page) — this screen deep-links
// there with one tap. Same account, same session state server-side.
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';

const _webBilling = 'https://vendorabot.vercel.app/billing';

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

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
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
        Card(
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
          Card(
            margin: const EdgeInsets.only(bottom: 10),
            child: ListTile(
              title: Text(p[0].toUpperCase() + p.substring(1)),
              subtitle: Text(amt(p)),
              trailing: const Icon(Icons.open_in_new),
              onTap: () =>
                  launchUrl(Uri.parse(_webBilling), mode: LaunchMode.externalApplication),
            ),
          ),
        if ('${t['bank'] ?? ''}'.isNotEmpty) ...[
          const SizedBox(height: 4),
          Card(
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
