// ── lib/screens/setup_screen.dart ────────────────────────────────
// WHAT: post-signup setup — 5-question animated quiz (niche → catalog size
// → channels → chat volume → heard-from). Saves ONCE at the end via
// POST /api/me/setup, then onDone (main.dart → HomeShell).
// Shown only when business_niche is empty (never nags twice!).
// Only Q1 is required — the rest skip freely (backend stores NULL!).
// Answers drive the app: niche → catalog shelves + AI suggestions,
// size → dashboard checklist, channels → Connect hints, volume → plan hint.
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

// value (stored) + title + encouraging sub (each pick tells them what the
// app will do with it — answers feel powerful, not bureaucratic!).
const _sizes = [
  ['starting', 'Just starting', 'Zero products? We walk you from 0 to 5.'],
  ['under-20', 'Under 20', 'Small and mighty — manual catalog fits you.'],
  ['20-100', '20 – 100', 'Growing fast — bulk tricks like Pro SYNC await.'],
  ['100-plus', '100+', 'Serious shelves — built for Pro SYNC.'],
];

const _channelOpts = [
  ['whatsapp', 'WhatsApp', 'The main stage — connect it first.'],
  ['telegram', 'Telegram', 'Nice — we highlight the Telegram card.'],
  ['instagram', 'Instagram DMs', 'Post there, sell on WhatsApp.'],
  ['walkin', 'Walk-in / market', 'Physical hustle — the bot covers overflow.'],
];

const _volumes = [
  ['few', 'Just a few', 'Quiet and cozy — Free carries you far.'],
  ['10-50', '10 – 50', 'Healthy flow — right in the sweet spot.'],
  ['50-plus', '50+', 'Big energy — we point you at the right plan.'],
];

class SetupScreen extends StatefulWidget {
  final VoidCallback onDone;
  const SetupScreen({super.key, required this.onDone});

  @override
  State<SetupScreen> createState() => _SetupScreenState();
}

class _SetupScreenState extends State<SetupScreen> {
  int _step = 0; // 0 niche · 1 size · 2 channels · 3 volume · 4 heard-from
  String? _niche;
  final _custom = TextEditingController();
  String _size = '';
  final List<String> _channels = []; // multi-pick (max 4!)
  String _volume = '';
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
        setState(() => _err = 'Pick one first — VeloSales AI speaks your hustle.');
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
    if (advance && _step < 4) {
      setState(() {
        _step++;
        _err = null;
      });
      return;
    }
    setState(() {
      _busy = true;
      _err = null;
    });
    try {
      await ApiClient.instance.saveSetup(
        _finalNiche.isEmpty ? _other : _finalNiche,
        _heard ?? '',
        size: _size,
        channels: _channels,
        volume: _volume,
      );
      widget.onDone(); // saved → HomeShell (answers now drive the app!)
    } on ApiException catch (e) {
      if (mounted) setState(() => _err = e.message);
    } catch (_) {
      if (mounted) setState(() => _err = 'No connection — try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _back() {
    if (_step > 0) setState(() => _step--); // drafts live outside the step (nothing lost!)
  }

  @override
  Widget build(BuildContext context) {
    const titles = [
      'What will you use VeloSales AI for?',
      'How many products do you sell?',
      'Where do customers reach you?',
      'How many customer chats a day?',
      'Where did you hear about us?',
    ];
    const ledes = [
      'Pick your hustle — suggestions and answers fit YOUR business.',
      'No wrong answer — this shapes your starting checklist.',
      'Pick all that apply — we highlight the right connections.',
      'Rough guess is fine — keeps plan advice honest.',
      'Optional — skip freely.',
    ];
    return Scaffold(
      appBar: AppBar(title: Text('Step ${_step + 1} of 5')),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(
              value: (_step + 1) / 5, // progress fill (animated by Flutter!)
              minHeight: 8,
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 4),
          child: Text(titles[_step],
              style:
                  const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Text(ledes[_step], style: const TextStyle(fontSize: 13)),
        ),
        if (_err != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
            child: Text(_err!,
                style:
                    const TextStyle(color: Colors.redAccent, fontSize: 13)),
          ),
        Expanded(child: _stepBody()),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Row(children: [
            if (_step > 0)
              Expanded(
                child: OutlinedButton(
                  onPressed: _busy ? null : _back,
                  child: const Text('Back'),
                ),
              ),
            if (_step > 0) const SizedBox(width: 12),
            Expanded(
              child: FilledButton.icon(
                onPressed: _busy
                    ? null
                    : () => _save(advance: _step < 4), // last step saves!
                icon: _busy
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : Icon(_step < 4 ? Icons.arrow_forward : Icons.check),
                label: Text(_busy
                    ? 'Saving…'
                    : _step < 4
                        ? 'Continue'
                        : 'Start selling'),
              ),
            ),
          ]),
        ),
      ]),
    );
  }

  Widget _stepBody() {
    switch (_step) {
      case 1:
        return _optionList(
          _sizes.map((o) => o[0]).toList(),
          _sizes.map((o) => o[1]).toList(),
          _sizes.map((o) => o[2]).toList(),
          (v) => _size == v,
          (v) => setState(() => _size = _size == v ? '' : v), // tap again = unpick (skippable!)
        );
      case 2:
        return _optionList(
          _channelOpts.map((o) => o[0]).toList(),
          _channelOpts.map((o) => o[1]).toList(),
          _channelOpts.map((o) => o[2]).toList(),
          (v) => _channels.contains(v),
          (v) => setState(() {
            if (_channels.contains(v)) {
              _channels.remove(v);
            } else if (_channels.length < 4) {
              _channels.add(v); // cap 4 (backend slices anyway!)
            }
          }),
        );
      case 3:
        return _optionList(
          _volumes.map((o) => o[0]).toList(),
          _volumes.map((o) => o[1]).toList(),
          _volumes.map((o) => o[2]).toList(),
          (v) => _volume == v,
          (v) => setState(() => _volume = _volume == v ? '' : v),
        );
      case 4:
        return _optionList(
          _heardFrom,
          _heardFrom,
          List.filled(_heardFrom.length, ''),
          (v) => _heard == v,
          (v) => setState(() => _heard = _heard == v ? null : v),
        );
      default:
        return _nicheGrid();
    }
  }

  /// Generic animated option list (staggered FadeSlideIn, check on picked).
  Widget _optionList(
    List<String> values,
    List<String> titles,
    List<String> subs,
    bool Function(String) isSel,
    void Function(String) onPick,
  ) {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: values.length,
      itemBuilder: (c, i) {
        final v = values[i];
        final sel = isSel(v);
        return FadeSlideIn(
          delayMs: (i * 60).clamp(0, 300),
          child: GlassCard(
            radius: 14,
            margin: const EdgeInsets.only(bottom: 8),
            border: Border.all(
                color: sel
                    ? Theme.of(context).colorScheme.primary
                    : Glass.edge(context),
                width: sel ? 1.5 : 1),
            onTap: () => onPick(v),
            child: ListTile(
              title: Text(titles[i],
                  style: TextStyle(
                      fontWeight:
                          sel ? FontWeight.w800 : FontWeight.w600)),
              subtitle: subs[i].isEmpty
                  ? null
                  : Text(subs[i], style: const TextStyle(fontSize: 12)),
              trailing: sel
                  ? Icon(Icons.check_circle,
                      color: Theme.of(context).colorScheme.primary)
                  : const Icon(Icons.chevron_right),
            ),
          ),
        );
      },
    );
  }

  Widget _nicheGrid() {
    return Column(children: [
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
            return FadeSlideIn(
              delayMs: (i * 35).clamp(0, 400),
              child: GlassCard(
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
      if (_finalNiche.isNotEmpty)
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
          child: Text('Perfect — from here on, everything speaks $_finalNiche.',
              style: const TextStyle(
                  fontSize: 13, fontWeight: FontWeight.w600)),
        ),
    ]);
  }
}
