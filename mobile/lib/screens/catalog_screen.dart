// ── lib/screens/catalog_screen.dart ──────────────────────────────
// WHAT: products list (GET /api/me/products → array) + add
// (POST → 201 row) + delete (DELETE → 204). Same rules as web Catalog.
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../ads.dart';
import '../api.dart';
import '../glass.dart';
import '../motion.dart';

const _webBilling = 'https://vendorabot.vercel.app/billing'; // checkout lives in the browser (same as Billing tab!)

class CatalogScreen extends StatefulWidget {
  const CatalogScreen({super.key});

  @override
  State<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends State<CatalogScreen> {
  List<dynamic>? _items;
  String? _err;
  bool _loading = true;
  final _name = TextEditingController();
  final _price = TextEditingController();
  final _desc = TextEditingController();
  final _photo = TextEditingController(); // optional photo link (upgraded shops: bot sends it!)
  final _qty = TextEditingController(); // number in stock (whole units!)
  String? _cat; // picked shelf (null = no category)
  List<String> _shelves = const ['New Arrivals', 'Best Sellers', 'General', 'Other']; // niche shelves (replaced by catalog-meta!)
  String _detailHint = 'Note (optional)'; // details hint in the lane's words

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _name.dispose();
    _price.dispose();
    _desc.dispose();
    _photo.dispose();
    _qty.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _err = null;
    });
    try {
      _items = await ApiClient.instance.products();
      try {
        final meta = await ApiClient.instance.catalogMeta(); // niche shelves (same as web!)
        final cats = meta['categories'];
        if (cats is List && cats.isNotEmpty) {
          _shelves =
              cats.map((c) => '$c').toList(); // '$c' stringifies each entry
          if (_cat != null && !_shelves.contains(_cat)) _cat = null; // stale pick (niche changed) → reset
        }
        final hint = meta['detailHint'];
        if (hint is String && hint.isNotEmpty) _detailHint = hint;
      } catch (_) {} // meta optional: shelves stay default (offline-safe!)
    } on ApiException catch (e) {
      _err = e.message;
    } catch (_) {
      _err = 'No connection.';
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _add() async {
    if (_name.text.trim().isEmpty) {
      showToast(context, 'Product name required', type: 'err');
      return;
    }
    try {
      await ApiClient.instance.addProduct(_name.text.trim(), _price.text,
          _desc.text, _photo.text, _qty.text, _cat);
      _name.clear();
      _price.clear();
      _desc.clear();
      _photo.clear();
      _qty.clear();
      setState(() => _cat = null);
      if (mounted) FocusScope.of(context).unfocus();
      _load();
      if (mounted) unawaited(maybeShowSponsor(context)); // web parity: sponsor moment after adds (free tier, max once/day)
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, type: 'err');
    }
  }

  /// Lock tap → upgrade card (glass bottom sheet). The ONLY paywall
  /// affordance: a drawn padlock, never "PRO" text on the feature.
  Future<void> _showUpgrade() {
    return glassSheet(
      context,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(children: [
            Icon(Icons.lock_outline, size: 20),
            SizedBox(width: 8),
            Text('Unlock product photos',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
          ]),
          const SizedBox(height: 10),
          const Text(
              'Upgraded shops send catalog pictures inside the chat bubble with each reply — WhatsApp + Telegram.'),
          const SizedBox(height: 6),
          const Text('• Photo replies that sell while you sleep'),
          const Text('• Profile sync + verified products'),
          const Text('• Zero ads, priority support'),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () =>
                  launchUrl(Uri.parse(_webBilling), mode: LaunchMode.externalApplication),
              child: const Text('See upgrade options'),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _toggle(Map<String, dynamic> p) async {
    try {
      await ApiClient.instance.toggleProduct(p); // image_url omitted = photo preserved (web parity!)
      if (mounted) {
        showToast(context,
            (p['available'] != false) ? 'Marked out of stock.' : 'Back in stock — AI can sell it.');
      }
      _load();
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, type: 'err');
    }
  }

  Future<void> _clearPhoto(Map<String, dynamic> p) async {
    try {
      await ApiClient.instance.clearProductPhoto(p); // explicit null = clear just the photo!
      if (mounted) showToast(context, 'Photo removed.');
      _load();
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, type: 'err');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Padding(
        padding: const EdgeInsets.all(12),
        child: GlassCard(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(children: [
              TextField(
                  controller: _name,
                  decoration:
                      const InputDecoration(labelText: 'Product name')),
              const SizedBox(height: 8),
              Row(children: [
                Expanded(
                    child: TextField(
                        controller: _price,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                            labelText: 'Price (numbers)'))),
                const SizedBox(width: 8),
                Expanded(
                    child: TextField(
                        controller: _qty,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                            labelText: 'In stock (qty)'))),
              ]),
              const SizedBox(height: 8),
              Row(children: [
                Expanded(
                    child: TextField(
                        controller: _desc,
                        decoration: InputDecoration(
                            labelText: _detailHint))),
                const SizedBox(width: 8),
                Expanded(
                    child: DropdownButtonFormField<String>(
                        value: _cat,
                        isExpanded: true, // long shelf names (Laptops & Computers) wrap instead of overflowing!
                        hint: const Text('Category'),
                        items: _shelves
                            .map((s) => DropdownMenuItem(
                                value: s, child: Text(s)))
                            .toList(),
                        onChanged: (v) => setState(() => _cat = v),
                      )),
              ]),
              const SizedBox(height: 8),
              // Photo box: Upload-media on web, https link here — the bot sends it
              // with its reply (upgraded shops). Free shops: saved, not sent.
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  border: Border.all(
                      color: Theme.of(context)
                          .colorScheme
                          .primary
                          .withValues(alpha: 0.4)),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      const Icon(Icons.photo_camera_outlined, size: 16),
                      const SizedBox(width: 6),
                      const Text('Product photo',
                          style: TextStyle(fontWeight: FontWeight.w700)),
                      const SizedBox(width: 6),
                      IconButton(
                        tooltip: 'Locked — tap to see upgrade options',
                        onPressed: _showUpgrade,
                        icon: const Icon(Icons.lock_outline, size: 16),
                      ),
                      const Spacer(),
                      if (_photo.text.trim().startsWith('https://'))
                        TextButton(
                          onPressed: () =>
                              setState(() => _photo.clear()),
                          child: const Text('Clear',
                              style: TextStyle(fontSize: 12)),
                        ),
                    ]),
                    TextField(
                        controller: _photo,
                        keyboardType: TextInputType.url,
                        onChanged: (_) =>
                            setState(() {}), // refresh preview as they paste!
                        decoration: const InputDecoration(
                            labelText: 'Photo link (https://…)',
                            hintText: 'https://… public image link')),
                    if (_photo.text.trim().startsWith('https://'))
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Row(children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: Image.network(
                              _photo.text.trim(),
                              width: 56,
                              height: 56,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => const Icon(
                                  Icons.image_not_supported_outlined),
                            ),
                          ),
                          const SizedBox(width: 8),
                          const Expanded(
                            child: Text(
                              'Photo attached: the bot sends it with its reply on WhatsApp + Telegram.',
                              style: TextStyle(fontSize: 11),
                            ),
                          ),
                        ]),
                      )
                    else
                      const Padding(
                        padding: EdgeInsets.only(top: 6),
                        child: Text(
                          'Saved for you — upgraded shops send the photo inside the chat bubble. Tap the lock above to switch it on.',
                          style: TextStyle(fontSize: 11),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              FilledButton.icon(
                  onPressed: _add,
                  icon: const Icon(Icons.add),
                  label: const Text('Add product')),
            ]),
          ),
        ),
      ),
      Expanded(
        child: _loading
            ? ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                itemCount: 4,
                itemBuilder: (_, i) => const Padding(
                  padding: EdgeInsets.only(bottom: 8),
                  child: Skeleton(height: 64),
                ),
              )
            : _err != null
                ? Center(child: Text(_err!))
                : _items!.isEmpty
                    ? const Center(
                        child: Text(
                            'Empty shelf — add your first product above.'))
                    : RefreshIndicator(
                        onRefresh: _load,
                        child: ListView.builder(
                          itemCount: _items!.length,
                          itemBuilder: (c, i) {
                            final p =
                                (_items![i] as Map).cast<String, dynamic>();
                            return FadeSlideIn(
                              delayMs: (i * 60).clamp(0, 300),
                              child: GlassCard(
                                radius: 16,
                                margin: const EdgeInsets.symmetric(
                                    horizontal: 12, vertical: 5),
                                child: ListTile(
                                  leading: (p['image_url'] is String &&
                                          (p['image_url'] as String)
                                              .startsWith('https://'))
                                      ? ClipRRect(
                                          borderRadius:
                                              BorderRadius.circular(8),
                                          child: Image.network(
                                            p['image_url'] as String,
                                            width: 44,
                                            height: 44,
                                            cacheWidth:
                                                88, // 44pt × 2x screen (tiny RAM, sharp on retina!)
                                            fit: BoxFit.cover,
                                            errorBuilder: (_, __, ___) =>
                                                const Icon(Icons
                                                    .image_not_supported_outlined),
                                          ),
                                        )
                                      : null, // no photo → no leading (dead links fall back to an icon, never a red box!)
                                  title: Text(
                                      '${p['name']}${p['category'] is String && (p['category'] as String).isNotEmpty ? ' · ${p['category']}' : ''}'),
                                  subtitle: Text(
                                      '${p['price'] ?? ''}${p['quantity'] != null ? ' · ×${p['quantity']}' : ''} ${p['description'] ?? ''}'
                                          .trim()),
                                  trailing: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      // Stock toggle (web parity: pill-as-button flips in/out of stock, photo preserved!)
                                      TextButton(
                                        onPressed: () => _toggle(p),
                                        child: Text(
                                          (p['available'] != false)
                                              ? 'in stock'
                                              : 'out of stock',
                                          style: TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w700,
                                            color: (p['available'] != false)
                                                ? Colors.green
                                                : Colors.orange,
                                          ),
                                        ),
                                      ),
                                      // Remove photo only (visible when a photo exists — keeps name/price/stock!)
                                      if (p['image_url'] is String &&
                                          (p['image_url'] as String)
                                              .startsWith('https://'))
                                        IconButton(
                                          icon: const Icon(
                                              Icons.hide_image_outlined),
                                          tooltip: 'Remove photo',
                                          onPressed: () => _clearPhoto(p),
                                        ),
                                      IconButton(
                                        icon:
                                            const Icon(Icons.delete_outline),
                                        onPressed: () async {
                                          try {
                                            await ApiClient.instance
                                                .deleteProduct(p['id']);
                                            _load();
                                          } on ApiException catch (e) {
                                            if (context.mounted) {
                                              showToast(context, e.message,
                                                  type: 'err');
                                            }
                                          }
                                        },
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                      ),
      ),
    ]);
  }
}
