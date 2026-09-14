// ── lib/screens/catalog_screen.dart ──────────────────────────────
// WHAT: products list (GET /api/me/products → array) + add
// (POST → 201 row) + delete (DELETE → 204). Same rules as web Catalog.
import 'package:flutter/material.dart';

import '../api.dart';

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
    final messenger = ScaffoldMessenger.of(context);
    if (_name.text.trim().isEmpty) {
      messenger.showSnackBar(
          const SnackBar(content: Text('Product name required')));
      return;
    }
    try {
      await ApiClient.instance
          .addProduct(_name.text.trim(), _price.text, _desc.text);
      _name.clear();
      _price.clear();
      _desc.clear();
      if (mounted) FocusScope.of(context).unfocus();
      _load();
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Padding(
        padding: const EdgeInsets.all(12),
        child: Card(
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
            ? const Center(child: CircularProgressIndicator())
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
                            return Card(
                              margin: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 5),
                              child: ListTile(
                                title: Text('${p['name']}'),
                                subtitle: Text(
                                    '${p['price'] ?? ''} ${p['description'] ?? ''}'
                                        .trim()),
                                trailing: IconButton(
                                  icon: const Icon(Icons.delete_outline),
                                  onPressed: () async {
                                    final messenger =
                                        ScaffoldMessenger.of(context);
                                    try {
                                      await ApiClient.instance
                                          .deleteProduct(p['id']);
                                      _load();
                                    } on ApiException catch (e) {
                                      messenger.showSnackBar(SnackBar(
                                          content: Text(e.message)));
                                    }
                                  },
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
