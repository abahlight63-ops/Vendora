// ── lib/screens/profile_screen.dart ──────────────────────────────
// WHAT: business profile editor (PUT /api/me/business) — name, owner
// WhatsApp number, hours. Mirrors the web Profile page's core fields.
// Reached from the dashboard checklist (not a bottom tab — same as web,
// where Profile lives in nav, not in the mobile bar).
import 'package:flutter/material.dart';

import '../api.dart';
import '../motion.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _name = TextEditingController();
  final _owner = TextEditingController();
  final _hours = TextEditingController();
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _name.dispose();
    _owner.dispose();
    _hours.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final me = await ApiClient.instance.me();
      final b = (me['business'] as Map).cast<String, dynamic>();
      _name.text = '${b['name'] ?? ''}';
      _owner.text = '${b['owner_number'] ?? ''}';
      _hours.text = '${b['hours'] ?? ''}';
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, type: 'err');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    if (_name.text.trim().isEmpty) {
      showToast(context, 'Business name required', type: 'err');
      return;
    }
    setState(() => _saving = true);
    try {
      await ApiClient.instance.updateBusiness({
        'name': _name.text.trim(),
        if (_owner.text.trim().isNotEmpty)
          'owner_number': _owner.text.trim(),
        if (_hours.text.trim().isNotEmpty) 'hours': _hours.text.trim(),
      });
      if (mounted) {
        showToast(context, 'Profile saved.');
        Navigator.of(context).pop(true);
      }
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, type: 'err');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Business profile')),
      body: _loading
          ? ListView(
              padding: const EdgeInsets.all(16),
              children: const [
                Skeleton(height: 56),
                SizedBox(height: 10),
                Skeleton(height: 56),
                SizedBox(height: 10),
                Skeleton(height: 56),
              ],
            )
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const Text(
                    'Closed-hours replies use these to feel human. WhatsApp number login identity stays locked.'),
                const SizedBox(height: 14),
                TextField(
                    controller: _name,
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(
                        labelText: 'Business name')),
                const SizedBox(height: 12),
                TextField(
                    controller: _owner,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(
                        labelText: 'Owner WhatsApp number',
                        hintText: '0803 123 4567')),
                const SizedBox(height: 12),
                TextField(
                    controller: _hours,
                    decoration: const InputDecoration(
                        labelText: 'Hours',
                        hintText: 'Mon–Sat 9am–6pm')),
                const SizedBox(height: 18),
                FilledButton(
                    onPressed: _saving ? null : _save,
                    child:
                        Text(_saving ? 'Saving…' : 'Save profile')),
              ],
            ),
    );
  }
}
