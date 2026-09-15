// ── lib/screens/setup_screen.dart ────────────────────────────────
// WHAT: post-signup setup — step 1: "What will you use Vendora for?"
// (niche grid), step 2: "Where did you hear about us?" (heard-from).
// Saves via POST /api/me/setup, then onDone (main.dart → HomeShell).
// Shown only when business_niche is empty (never nags twice!).
import 'package:flutter/material.dart';

import '../api.dart';
import '../glass.dart';
import '../motion.dart';

// Same labels as the web picker (frontend/src/lib/niches.js) — the backend
// stores them verbatim, so both apps MUST spell them identically.
const _niches = [
  'Clothing, Fashion & Accessories',
  'Beauty, Cosmetics & Personal Care',
  'Handmade Crafts & Artisanal Goods',
  'Baking, Catering & Homemade Food',
  'Grocery, Fruits & Fresh Produce',
  'Electronics, Gadgets & Phone Accessories',
  'Home Decor, Furniture & Kitchenware',
  'Dropshipping & General Retail Store',
  'Sneakers & Footwear Reseller',
  'Thrift, Vintage & Pre-loved Items',
  'Freelance Services',
  'Tutoring, Coaching & Digital Info-Products',
  'Event Planning, Cakes & Decor',
  'Photography & Videography Services',
  'Hair Salons, Barbers & Makeup Artists',
  'Fitness Coaching & Health Supplements',
  'Real Estate Agent or Property Broker',
  'Logistics, Delivery & Errand Services',
  'Wholesale Supply & B2B Distribution',
  'Other / Custom Business',
];

const _heardFrom = [
  'WhatsApp broadcast / status',
  'Instagram',
  'TikTok',
  'Facebook',
  'Friend or family',
  'Google search',
  'YouTube',
  'In-person / market',
  'Other',
];

const _other = 'Other / Custom Business';

class SetupScreen extends StatefulWidget {
  final VoidCallback onDone;
  const SetupScreen({super.key, required this.onDone});

  @override
  State<SetupScreen> createState() => _SetupScreenState();
}

class _SetupScreenState extends State<SetupScreen> {
  int _step = 0; // 0 = niche, 1 = heard-from
  String? _niche;
  final _custom = TextEditingController();
  String? _heard;
  bool _busy = false;
  String? _err;

  @override
  void dispose() {
    _custom.dispose();
    super.dispose();
  }

  String get _finalNiche =>
      _niche == _other ? _custom.text.trim() : (_niche ?? '');

  Future<void> _save({required bool advance}) async {
    if (_step == 0) {
      if (_finalNiche.isEmpty) {
        setState(() => _err = 'Pick one first — Vendora speaks your hustle.');
        return;
      }
      if (advance) {
        setState(() {
          _step = 1;
          _err = null;
        });
        return;
      }
    }
    setState(() {
      _busy = true;
      _err = null;
    });
    try {
      await ApiClient.instance.saveSetup(
          _finalNiche.isEmpty ? _other : _finalNiche, _heard ?? '');
      widget.onDone(); // saved → HomeShell (niche now drives AI suggestions!)
    } on ApiException catch (e) {
      if (mounted) setState(() => _err = e.message);
    } catch (_) {
      if (mounted) setState(() => _err = 'No connection — try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Step ${_step + 1} of 2')),
      body: _step == 0 ? _nicheStep() : _heardStep(),
    );
  }

  Widget _nicheStep() {
    return Column(children: [
      const Padding(
        padding: EdgeInsets.fromLTRB(20, 16, 20, 4),
        child: Text('What will you use Vendora for?',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
      ),
      const Padding(
        padding: EdgeInsets.symmetric(horizontal: 20),
        child: Text(
            'Pick your hustle — suggestions and answers fit YOUR business.',
            style: TextStyle(fontSize: 13)),
      ),
      if (_err != null)
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
          child: Text(_err!,
              style: const TextStyle(color: Colors.redAccent, fontSize: 13)),
        ),
      Expanded(
        child: GridView.builder(
          padding: const EdgeInsets.all(16),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2, // 2-col grid (phones rotate → still 2, thumb-sized!)
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            childAspectRatio: 1.6,
          ),
          itemCount: _niches.length,
          itemBuilder: (c, i) {
            final n = _niches[i];
            final sel = _niche == n;
            return GlassCard(
              margin: EdgeInsets.zero,
              radius: 14,
              border: Border.all(
                  color: sel
                      ? Theme.of(context).colorScheme.primary
                      : Glass.edge(context),
                  width: sel ? 1.5 : 1),
              onTap: () => setState(() {
                _niche = n;
                _err = null;
              }),
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(10),
                  child: Text(n,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                          fontSize: 12.5,
                          fontWeight:
                              sel ? FontWeight.w800 : FontWeight.w600)),
                ),
              ),
            );
          },
        ),
      ),
      if (_niche == _other)
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: TextField(
            controller: _custom,
            maxLength: 80,
            decoration: const InputDecoration(
                labelText: 'Describe your business',
                hintText: 'e.g. Car wash in Lekki'),
          ),
        ),
      Padding(
        padding: const EdgeInsets.all(16),
        child: FilledButton.icon(
          onPressed: _busy ? null : () => _save(advance: true),
          icon: const Icon(Icons.arrow_forward),
          label: const Text('Continue'),
        ),
      ),
    ]);
  }

  Widget _heardStep() {
    return Column(children: [
      const Padding(
        padding: EdgeInsets.fromLTRB(20, 16, 20, 4),
        child: Text('Where did you hear about us?',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
      ),
      const Padding(
        padding: EdgeInsets.symmetric(horizontal: 20),
        child: Text('Optional — skip freely.',
            style: TextStyle(fontSize: 13)),
      ),
      if (_err != null)
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
          child: Text(_err!,
              style: const TextStyle(color: Colors.redAccent, fontSize: 13)),
        ),
      Expanded(
        child: ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: _heardFrom.length,
          itemBuilder: (c, i) {
            final h = _heardFrom[i];
            final sel = _heard == h;
            return FadeSlideIn(
              delayMs: (i * 40).clamp(0, 300),
              child: GlassCard(
                radius: 14,
                margin: const EdgeInsets.only(bottom: 8),
                border: Border.all(
                    color: sel
                        ? Theme.of(context).colorScheme.primary
                        : Glass.edge(context),
                    width: sel ? 1.5 : 1),
                onTap: () => setState(
                    () => _heard = sel ? null : h), // tap again = unpick!
                child: ListTile(
                  title: Text(h,
                      style: TextStyle(
                          fontWeight: sel
                              ? FontWeight.w800
                              : FontWeight.w600)),
                  trailing: sel
                      ? Icon(Icons.check_circle,
                          color: Theme.of(context).colorScheme.primary)
                      : const Icon(Icons.chevron_right),
                ),
              ),
            );
          },
        ),
      ),
      Padding(
        padding: const EdgeInsets.all(16),
        child: Row(children: [
          Expanded(
            child: OutlinedButton(
              onPressed: _busy
                  ? null
                  : () => _save(advance: false), // skip STILL saves the niche!
              child: const Text('Skip'),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: FilledButton.icon(
              onPressed: _busy ? null : () => _save(advance: false),
              icon: _busy
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.check),
              label: Text(_busy ? 'Saving…' : 'Start selling'),
            ),
          ),
        ]),
      ),
    ]);
  }
}
