// ── lib/screens/dashboard_screen.dart ────────────────────────────
// WHAT: /api/me → shop name, tier pill, subscription status + bot
// kill-switch (POST /api/me/bot). The at-a-glance owner home.
import 'package:flutter/material.dart';

import '../api.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Map<String, dynamic>? _me;
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
      _me = await ApiClient.instance.me();
    } on ApiException catch (e) {
      _err = e.message;
    } catch (_) {
      _err = 'No connection.';
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
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
    final biz = (_me!['business'] as Map).cast<String, dynamic>();
    final botOn = (biz['bot_enabled'] ?? true) as bool;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Expanded(
                      child: Text('${biz['name'] ?? 'Your shop'}',
                          style: const TextStyle(
                              fontSize: 22, fontWeight: FontWeight.w800)),
                    ),
                    Chip(
                      label: Text(
                          '${biz['tier'] ?? 'free'}'.toUpperCase(),
                          style: const TextStyle(
                              fontWeight: FontWeight.bold, fontSize: 12)),
                    ),
                  ]),
                  const SizedBox(height: 6),
                  Text('${biz['whatsapp_number'] ?? ''}',
                      style: TextStyle(color: Colors.grey[400])),
                  Text('Status: ${biz['subscription_status'] ?? '—'}',
                      style: TextStyle(color: Colors.grey[400])),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: SwitchListTile(
              title: const Text('AI bot replies'),
              subtitle: const Text('Kill-switch: silence every chat instantly'),
              value: botOn,
              onChanged: (v) async {
                final messenger = ScaffoldMessenger.of(context);
                try {
                  await ApiClient.instance
                      .post('/api/me/bot', {'enabled': v});
                  _load();
                } on ApiException catch (e) {
                  messenger.showSnackBar(
                      SnackBar(content: Text(e.message)));
                }
              },
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Text(
                (biz['tier'] == 'pro')
                    ? 'Pro is active — profile sync, priority support, unlimited chats.'
                    : 'Free plan — bot replies from your manual catalog. Upgrade in Billing for Pro.',
                style: TextStyle(color: Colors.grey[300]),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
