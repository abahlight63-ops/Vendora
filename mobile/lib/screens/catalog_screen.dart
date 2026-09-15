// ── lib/screens/catalog_screen.dart ──────────────────────────────
// WHAT: products list (GET /api/me/products → array) + add
// (POST → 201 row) + delete (DELETE → 204). Same rules as web Catalog.
import 'package:flutter/material.dart';

import '../ads.dart';
import '../api.dart';
import '../glass.dart';
import '../motion.dart';

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
  final _photo = TextEditingController(); // optional https photo link (Pro: bot sends it!)

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
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _err = null;
    });
    try {
      _items = await ApiClient.instance.products();
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
      await ApiClient.instance
          .addProduct(_name.text.trim(), _price.text, _desc.text, _photo.text);
      _name.clear();
      _price.clear();
      _desc.clear();
      _photo.clear();
      if (mounted) FocusScope.of(context).unfocus();
      _load();
      if (mounted) unawaited(maybeShowSponsor(context)); // web parity: sponsor moment after adds (free tier, max once/day)
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, type: 'err');
    }
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
                        controller: _desc,
                        decoration: const InputDecoration(
                            labelText: 'Note (optional)'))),
              ]),
              const SizedBox(height: 8),
              TextField(
                  controller: _photo,
                  keyboardType: TextInputType.url,
                  decoration: const InputDecoration(
                      labelText: 'Photo link (optional, Pro)',
                      hintText: 'https://…')),
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
                                            fit: BoxFit.cover,
                                            errorBuilder: (_, __, ___) =>
                                                const Icon(Icons
                                                    .image_not_supported_outlined),
                                          ),
                                        )
                                      : null, // no photo → no leading (dead links fall back to an icon, never a red box!)
                                  title: Text('${p['name']}'),
                                  subtitle: Text(
                                      '${p['price'] ?? ''} ${p['description'] ?? ''}'
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
