// ── lib/screens/catalog_screen.dart ──────────────────────────────
// WHAT: the product catalog — the page the AI is only allowed to sell from.
// Same order as the web Catalog: the product list first (search, stock toggle,
// delete), then Pro profile-sync, then the manual add form.
//
// WHY THE LIST COMES FIRST: a shop owner opens this page to check what the bot
// knows, not to type. The add form used to sit above the list and pushed the
// actual catalog off the first screen — the wrong thing in the best spot.
//
// RULES: every figure (price, stock, availability) is server truth, shown once.
// Blank prices read as "—", never "null". Photos are optional; a dead link
// falls back to a drawn placeholder, never a red box.
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../glass.dart';
import '../motion.dart';
import '../theme.dart';
import '../widgets/app_select.dart';
import '../widgets/brand_ui.dart';

final _webBilling = ApiClient.billingUrl;

const _syncLines = [
  'Paste your WhatsApp Business profile — AI scaffolds your whole catalog',
  'Every "is it available?" verified against your synced profile',
  'Product photos inside WhatsApp + Telegram replies',
  'Zero ads, priority support',
];

const _photoLines = [
  'Your product pictures sent inside the chat bubble with each reply',
  'Works on WhatsApp + Telegram, matched to what the customer asked',
  'Profile sync + verification included',
  'Zero ads, priority support',
];

/// The three fulfilment columns, read the same way the web Catalog reads them.
String _fulfilment(Map<String, dynamic> p) {
  final bits = <String>[];
  for (final k in ['delivery_info', 'location', 'how_to_buy']) {
    final v = '${p[k] ?? ''}'.trim();
    if (v.isNotEmpty) bits.add(v);
  }
  return bits.join(' · ');
}

bool _hasPhoto(Map<String, dynamic> p) {
  final url = p['image_url'];
  return url is String && url.startsWith('https://');
}

class CatalogScreen extends StatefulWidget {
  const CatalogScreen({super.key});

  @override
  State<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends State<CatalogScreen> {
  // ── list state ──
  List<dynamic>? _items;
  String? _err;
  bool _loading = true;
  final _find = TextEditingController();
  String _q = '';

  // ── shop context ──
  String _tier = 'free';
  String _currency = 'NGN';
  List<String> _shelves = const ['New Arrivals', 'Best Sellers', 'General', 'Other'];
  String _detailHint = 'Sizes, colours, what makes it special…';
  String _learnExample = 'LEARN: Blue gown ₦45,000';

  // ── profile sync ──
  Map<String, dynamic>? _syncInfo;
  final _syncText = TextEditingController();
  bool _syncing = false;

  // ── add form ──
  final _name = TextEditingController();
  final _price = TextEditingController();
  final _desc = TextEditingController();
  final _photo = TextEditingController();
  final _qty = TextEditingController();
  final _delivery = TextEditingController();
  final _location = TextEditingController();
  final _howtobuy = TextEditingController();
  String? _cat;
  bool _uploading = false;
  bool _saving = false;

  bool get _pro => _tier == 'pro';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _find.dispose();
    _syncText.dispose();
    _name.dispose();
    _price.dispose();
    _desc.dispose();
    _photo.dispose();
    _qty.dispose();
    _delivery.dispose();
    _location.dispose();
    _howtobuy.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _err = null;
    });
    try {
      final items = await ApiClient.instance.products();
      if (!mounted) return;
      setState(() => _items = items);
    } on ApiException catch (e) {
      if (mounted) setState(() => _err = e.message);
    } catch (_) {
      if (mounted) setState(() => _err = 'No connection.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }

    // Garnish: the page works without any of these finishing.
    try {
      final meta = await ApiClient.instance.catalogMeta();
      final cats = meta['categories'];
      final hint = meta['detailHint'];
      final example = meta['learnExample'];
      if (!mounted) return;
      setState(() {
        if (cats is List && cats.isNotEmpty) {
          _shelves = cats.map((c) => '$c').toList();
          if (_cat != null && !_shelves.contains(_cat)) _cat = null;
        }
        if (hint is String && hint.isNotEmpty) _detailHint = hint;
        if (example is String && example.isNotEmpty) _learnExample = example;
      });
    } catch (_) {}

    try {
      final bill = await ApiClient.instance.billing();
      if (!mounted) return;
      setState(() {
        _tier = '${bill['tier'] ?? 'free'}';
        final cur = '${bill['currency'] ?? 'NGN'}';
        _currency = cur == 'USD' ? 'USD' : 'NGN';
      });
    } catch (_) {}

    try {
      final sync = await ApiClient.instance.profileSync();
      if (mounted) setState(() => _syncInfo = sync);
    } catch (_) {}
  }

  // ── money + text helpers ───────────────────────────────────────
  String _grouped(num n) {
    final s = n.toStringAsFixed(n.truncateToDouble() == n ? 0 : 2);
    final parts = s.split('.');
    final buf = StringBuffer();
    for (var i = 0; i < parts[0].length; i++) {
      final rev = parts[0].length - i;
      buf.write(parts[0][i]);
      if (rev > 1 && rev % 3 == 1) buf.write(',');
    }
    return '$buf${parts.length > 1 ? '.${parts[1]}' : ''}';
  }

  /// A typed price like "12500" becomes "₦12,500". Anything the owner wrote as
  /// words ("From ₦8k", "Call for price") is shown exactly as typed.
  String _priceLabel(dynamic raw) {
    final s = '${raw ?? ''}'.trim();
    if (s.isEmpty) return '';
    if (RegExp(r'^\d+(\.\d+)?$').hasMatch(s)) {
      final n = num.tryParse(s);
      if (n != null) return '${_currency == 'USD' ? '\$' : '₦'}${_grouped(n)}';
    }
    return s;
  }

  String _when(dynamic raw) {
    final t = DateTime.tryParse('$raw')?.toLocal();
    if (t == null) return 'yes';
    const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    final hh = t.hour.toString().padLeft(2, '0');
    final mm = t.minute.toString().padLeft(2, '0');
    return '${t.day} ${m[t.month - 1]}, $hh:$mm';
  }

  List<Map<String, dynamic>> get _rows {
    final all = (_items ?? [])
        .map((e) => (e as Map).cast<String, dynamic>())
        .toList();
    final needle = _q.trim().toLowerCase();
    if (needle.isEmpty) return all;
    return all
        .where((p) => '${p['name'] ?? ''} ${p['category'] ?? ''} '
                '${p['description'] ?? ''}'
            .toLowerCase()
            .contains(needle))
        .toList();
  }

  // ── actions ────────────────────────────────────────────────────
  Future<void> _add() async {
    if (_name.text.trim().isEmpty) {
      showToast(context, 'Product name is required', type: 'err');
      return;
    }
    setState(() => _saving = true);
    try {
      await ApiClient.instance.addProduct(_name.text.trim(), _price.text,
          _desc.text, _photo.text, _qty.text, _cat, _delivery.text,
          _location.text, _howtobuy.text);
      _name.clear();
      _price.clear();
      _desc.clear();
      _photo.clear();
      _qty.clear();
      _delivery.clear();
      _location.clear();
      _howtobuy.clear();
      if (!mounted) return;
      setState(() => _cat = null);
      FocusScope.of(context).unfocus();
      showToast(context, 'Product added — the AI can sell it now.');
      await _load();
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, type: 'err');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _toggle(Map<String, dynamic> p) async {
    final wasInStock = p['available'] != false;
    try {
      await ApiClient.instance.toggleProduct(p);
      if (!mounted) return;
      showToast(context,
          wasInStock ? 'Marked out of stock.' : 'Back in stock — AI can sell it.');
      await _load();
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, type: 'err');
    }
  }

  Future<bool> _confirm({
    required String title,
    required String body,
    required String action,
  }) async {
    final out = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(title),
        content: Text(body),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(c).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(c).colorScheme.error,
            ),
            onPressed: () => Navigator.of(c).pop(true),
            child: Text(action),
          ),
        ],
      ),
    );
    return out == true;
  }

  Future<void> _clearPhoto(Map<String, dynamic> p) async {
    final ok = await _confirm(
      title: 'Remove the photo?',
      body: '"${p['name']}" keeps its name, price and stock — only the picture goes.',
      action: 'Remove photo',
    );
    if (!ok || !mounted) return;
    try {
      await ApiClient.instance.clearProductPhoto(p);
      if (!mounted) return;
      showToast(context, 'Photo removed.');
      await _load();
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, type: 'err');
    }
  }

  Future<void> _delete(Map<String, dynamic> p) async {
    final ok = await _confirm(
      title: 'Remove this product?',
      body: '"${p['name']}" will stop being sold by the AI. You can add it again any time.',
      action: 'Remove',
    );
    if (!ok || !mounted) return;
    try {
      await ApiClient.instance.deleteProduct(p['id']);
      if (!mounted) return;
      showToast(context, 'Product removed.');
      await _load();
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, type: 'err');
    }
  }

  Future<void> _syncProfile() async {
    if (_syncText.text.trim().isEmpty) {
      showToast(context, 'Paste your business profile text first', type: 'err');
      return;
    }
    setState(() => _syncing = true);
    try {
      final data = await ApiClient.instance.syncProfile(_syncText.text.trim());
      final added = (data['added'] as List?) ?? const [];
      final updated = (data['updated'] as List?) ?? const [];
      final unmentioned = (data['unmentioned'] as List?) ?? const [];
      var detail = '${added.length} new, ${updated.length} updated.';
      if (unmentioned.isNotEmpty) {
        final names = unmentioned.take(8).join(', ');
        detail += ' Not in this profile (still in your catalog): $names'
            '${unmentioned.length > 8 ? ' +${unmentioned.length - 8} more' : ''}'
            ' — mark them out of stock or delete them below.';
      }
      if (data['truncated'] == true) {
        detail += ' The profile was longer than kept — the first part synced only.';
      }
      if (!mounted) return;
      _syncText.clear();
      setState(() => _syncInfo = {
            'synced': true,
            'synced_at': data['synced_at'],
          });
      await _load();
      if (!mounted) return;
      await _showReport(detail);
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.status == 402) {
        await _showUpgrade(
            title: 'Profile sync is premium', lines: _syncLines);
      } else {
        showToast(context, e.message, type: 'err');
      }
    } finally {
      if (mounted) setState(() => _syncing = false);
    }
  }

  Future<void> _showReport(String detail) {
    return showDialog<void>(
      context: context,
      builder: (c) => AlertDialog(
        icon: const Icon(Icons.check_circle_outline_rounded),
        title: const Text('Profile synced!'),
        content: Text(detail),
        actions: [
          FilledButton(
            onPressed: () => Navigator.of(c).pop(),
            child: const Text('Done'),
          ),
        ],
      ),
    );
  }

  Future<void> _uploadPhoto() async {
    if (_uploading) return;
    setState(() => _uploading = true);
    try {
      final picked = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        maxWidth: 1600,
        maxHeight: 1600,
        imageQuality: 85,
      );
      if (picked == null) return;
      final bytes = await picked.readAsBytes();
      if (bytes.length > 2500000) {
        if (mounted) {
          showToast(context, 'Image too large — max 2.5MB', type: 'err');
        }
        return;
      }
      final name = picked.name.toLowerCase();
      final mime = name.endsWith('.png')
          ? 'image/png'
          : name.endsWith('.webp')
              ? 'image/webp'
              : 'image/jpeg';
      final url = await ApiClient.instance.uploadProductPhoto(
        picked.name,
        'data:$mime;base64,${base64Encode(bytes)}',
      );
      if (!mounted) return;
      if (url == null || url.isEmpty) {
        showToast(context, 'Upload failed — try another image.', type: 'err');
        return;
      }
      setState(() {
        _photo.text = url;
      });
      showToast(context, 'Photo uploaded.');
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, type: 'err');
    } catch (_) {
      if (mounted) {
        showToast(context, 'Could not read that image — try another.',
            type: 'err');
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _openBilling() async {
    final ok = await launchUrl(Uri.parse(_webBilling),
        mode: LaunchMode.externalApplication);
    if (!ok && mounted) {
      showToast(context, 'Could not open the browser — try again.', type: 'err');
    }
  }

  Future<void> _showUpgrade({
    required String title,
    required List<String> lines,
  }) {
    return glassSheet(
      context,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(Icons.lock_outline_rounded,
                size: 19, color: Theme.of(context).colorScheme.primary),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                title,
                style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.3),
              ),
            ),
          ]),
          const SizedBox(height: 14),
          for (final line in lines)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Padding(
                    padding: EdgeInsets.only(top: 2),
                    child: Icon(Icons.check_rounded,
                        size: 16, color: VeloSalesTheme.green),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(line,
                        style: const TextStyle(fontSize: 13, height: 1.45)),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: GradientPill(
              label: 'See upgrade options',
              onTap: () {
                Navigator.of(context).pop();
                _openBilling();
              },
              height: 48,
            ),
          ),
          const SizedBox(height: 6),
          SizedBox(
            width: double.infinity,
            child: TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Not now'),
            ),
          ),
        ],
      ),
    );
  }

  // ── build ──────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return BrandRefresh(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 6, 16, 32),
        children: [
          _head(scheme),
          const SizedBox(height: 18),
          _productsCard(scheme),
          const SizedBox(height: 14),
          _syncCard(scheme),
          const SizedBox(height: 14),
          _addCard(scheme),
        ],
      ),
    );
  }

  Widget _head(ColorScheme scheme) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Catalog',
                style: TextStyle(
                  fontSize: 26,
                  height: 1.1,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.8,
                  color: scheme.onSurface,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
              decoration: BoxDecoration(
                color: VeloSalesTheme.green.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(999),
                border: Border.all(
                    color: VeloSalesTheme.green.withValues(alpha: 0.30)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 5,
                    height: 5,
                    decoration: BoxDecoration(
                      color: VeloSalesTheme.successColor(context),
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 5),
                  Text(
                    'AI reads this live',
                    style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w800,
                      color: VeloSalesTheme.successColor(context),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 5),
        Text(
          'The single source of truth. If it is not here, the AI will not '
          'promise it.',
          style: TextStyle(
            fontSize: 12.5,
            height: 1.45,
            fontWeight: FontWeight.w500,
            color: scheme.onSurface.withValues(alpha: 0.58),
          ),
        ),
      ],
    );
  }

  // ── products ───────────────────────────────────────────────────
  Widget _productsCard(ColorScheme scheme) {
    final rows = _rows;
    return Container(
      decoration: BoxDecoration(
        color: scheme.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: scheme.outline),
        boxShadow: [
          BoxShadow(
            color: Colors.black
                .withValues(alpha: Theme.of(context).brightness ==
                        Brightness.dark
                    ? 0.28
                    : 0.035),
            blurRadius: 3,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Products',
                        style: TextStyle(
                          fontSize: 16.5,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.3,
                        ),
                      ),
                    ),
                    if (_items != null)
                      Text(
                        _q.trim().isEmpty
                            ? '${_items!.length}'
                            : '${rows.length} of ${_items!.length}',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: scheme.onSurface.withValues(alpha: 0.45),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 5),
                _learnTip(scheme),
                const SizedBox(height: 12),
                _Search(
                  controller: _find,
                  value: _q,
                  onChanged: (v) => setState(() => _q = v),
                  onClear: () {
                    _find.clear();
                    setState(() => _q = '');
                  },
                ),
              ],
            ),
          ),
          Divider(height: 1, thickness: 1, color: scheme.outline),
          if (_loading && _items == null)
            Column(
              children: [
                for (var i = 0; i < 3; i++)
                  const Padding(
                    padding: EdgeInsets.fromLTRB(16, 12, 16, 4),
                    child: Skeleton(height: 74, radius: 12),
                  ),
                const SizedBox(height: 10),
              ],
            )
          else if (_err != null && _items == null)
            SizedBox(
              height: 250,
              child: EmptyState("Couldn't load your catalog", _err!,
                  retry: _load),
            )
          else if (rows.isEmpty)
            _emptyRows(scheme)
          else
            Column(
              children: [
                for (var i = 0; i < rows.length; i++)
                  FadeSlideIn(
                    delayMs: (i * 45).clamp(0, 240),
                    child: _productRow(rows[i], scheme, first: i == 0),
                  ),
                const SizedBox(height: 6),
              ],
            ),
        ],
      ),
    );
  }

  Widget _learnTip(ColorScheme scheme) {
    final muted = scheme.onSurface.withValues(alpha: 0.55);
    const b = TextStyle(fontWeight: FontWeight.w800);
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(text: 'Tip: from your WhatsApp send ', style: TextStyle(color: muted)),
          TextSpan(text: _learnExample, style: TextStyle(color: scheme.onSurface).merge(b)),
          TextSpan(text: ' — same result, no dashboard needed.', style: TextStyle(color: muted)),
        ],
      ),
      style: const TextStyle(fontSize: 11.5, height: 1.5),
    );
  }

  Widget _emptyRows(ColorScheme scheme) {
    final searching = _q.trim().isNotEmpty;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 26, 20, 28),
      child: Column(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: scheme.primaryContainer,
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.inventory_2_outlined,
                size: 22, color: scheme.primary),
          ),
          const SizedBox(height: 12),
          Text(
            searching ? 'No matches' : 'No products yet',
            style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 4),
          Text(
            searching
                ? 'Clear the search — or add it below.'
                : 'Add your first one below — it takes 10 seconds.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12.5,
              height: 1.45,
              color: scheme.onSurface.withValues(alpha: 0.6),
            ),
          ),
          if (searching) ...[
            const SizedBox(height: 10),
            TextButton(
              onPressed: () {
                _find.clear();
                setState(() => _q = '');
              },
              child: const Text('Clear search'),
            ),
          ],
        ],
      ),
    );
  }

  Widget _productRow(Map<String, dynamic> p, ColorScheme scheme,
      {bool first = false}) {
    final photo = _hasPhoto(p);
    final price = _priceLabel(p['price']);
    final qty = p['quantity'];
    final desc = '${p['description'] ?? ''}'.trim();
    final category = '${p['category'] ?? ''}'.trim();
    final fulfil = _fulfilment(p);
    final available = p['available'] != false;
    final faint = scheme.onSurface.withValues(alpha: 0.55);

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 13, 12, 6),
      decoration: BoxDecoration(
        border: first
            ? null
            : Border(top: BorderSide(color: scheme.outline)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _thumb(
                photo ? '${p['image_url']}' : null,
                '${p['name'] ?? ''}',
                scheme,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${p['name'] ?? 'Product'}',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 14.5,
                        height: 1.25,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.2,
                      ),
                    ),
                    if (category.isNotEmpty || price.isEmpty) ...[
                      const SizedBox(height: 5),
                      Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        children: [
                          if (category.isNotEmpty)
                            _Tag(label: category),
                          if (price.isEmpty)
                            _Tag(
                              label: 'needs price',
                              fg: VeloSalesTheme.goldColor(context),
                              bg: VeloSalesTheme.goldColor(context)
                                  .withValues(alpha: 0.12),
                            ),
                        ],
                      ),
                    ],
                    if (desc.isNotEmpty) ...[
                      const SizedBox(height: 5),
                      Text(
                        desc,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 12,
                          height: 1.4,
                          color: scheme.onSurface.withValues(alpha: 0.62),
                        ),
                      ),
                    ],
                    if (fulfil.isNotEmpty) ...[
                      const SizedBox(height: 5),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Padding(
                            padding: const EdgeInsets.only(top: 1),
                            child: Icon(Icons.local_shipping_outlined,
                                size: 12.5, color: faint),
                          ),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              fulfil,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 11,
                                height: 1.4,
                                color: faint,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    price.isEmpty ? '—' : price,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.3,
                      color: price.isEmpty
                          ? scheme.onSurface.withValues(alpha: 0.4)
                          : scheme.onSurface,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    qty == null ? '—' : '$qty in stock',
                    style: TextStyle(fontSize: 10.5, color: faint),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Pressable(
                onTap: () => _toggle(p),
                radius: BorderRadius.circular(999),
                child: Tooltip(
                  message: 'Tap to change stock',
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                    decoration: BoxDecoration(
                      color: (available
                              ? VeloSalesTheme.successColor(context)
                              : VeloSalesTheme.goldColor(context))
                          .withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(
                        color: (available
                                ? VeloSalesTheme.successColor(context)
                                : VeloSalesTheme.goldColor(context))
                            .withValues(alpha: 0.28),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 5,
                          height: 5,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: available
                                ? VeloSalesTheme.successColor(context)
                                : VeloSalesTheme.goldColor(context),
                          ),
                        ),
                        const SizedBox(width: 5),
                        Text(
                          available ? 'In stock' : 'Out of stock',
                          style: TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w800,
                            color: available
                                ? VeloSalesTheme.successColor(context)
                                : VeloSalesTheme.goldColor(context),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const Spacer(),
              if (photo)
                _RowAction(
                  icon: Icons.hide_image_outlined,
                  tooltip: 'Remove photo',
                  onTap: () => _clearPhoto(p),
                ),
              _RowAction(
                icon: Icons.delete_outline_rounded,
                tooltip: 'Remove product',
                onTap: () => _delete(p),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _thumb(String? url, String name, ColorScheme scheme) {
    final trimmed = name.trim();
    final initial =
        trimmed.isEmpty ? '?' : String.fromCharCode(trimmed.runes.first).toUpperCase();
    final placeholder = Container(
      width: 46,
      height: 46,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: scheme.primaryContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        initial,
        style: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w800,
          color: scheme.primary,
        ),
      ),
    );
    if (url == null) return placeholder;
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Image.network(
        url,
        width: 46,
        height: 46,
        cacheWidth: 92,
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => placeholder,
      ),
    );
  }

  // ── profile sync ───────────────────────────────────────────────
  Widget _syncCard(ColorScheme scheme) {
    final synced = _syncInfo?['synced'] == true;
    final faded = scheme.onSurface.withValues(alpha: 0.58);
    return SoftPanel(
      padding: const EdgeInsets.fromLTRB(16, 15, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Sync from WhatsApp Business profile',
                      style: TextStyle(
                        fontSize: 14.5,
                        height: 1.3,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.25,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Paste your business profile text — the AI scaffolds your '
                      'whole catalog and verifies products against it.',
                      style: TextStyle(
                          fontSize: 12, height: 1.5, color: faded),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              if (_pro)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                  decoration: BoxDecoration(
                    color: VeloSalesTheme.successColor(context)
                        .withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    'On',
                    style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w800,
                      color: VeloSalesTheme.successColor(context),
                    ),
                  ),
                )
              else
                _LockButton(
                  tooltip: 'Unlock profile sync',
                  onTap: () =>
                      _showUpgrade(title: 'Unlock profile sync', lines: _syncLines),
                ),
            ],
          ),
          const SizedBox(height: 12),
          if (_pro) ...[
            const _FieldLabel('Business profile text'),
            TextField(
              controller: _syncText,
              minLines: 3,
              maxLines: 5,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                hintText: 'Amaka Beauty — bone straight wig ₦95,000, silk press '
                    '₦15,000, open Mon–Sat 9am–7pm…',
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                FilledButton(
                  onPressed: _syncing ? null : _syncProfile,
                  child: _syncing
                      ? const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white),
                            ),
                            SizedBox(width: 8),
                            Text('Syncing…'),
                          ],
                        )
                      : const Text('Sync profile'),
                ),
                if (synced) ...[
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Last synced: ${_when(_syncInfo?['synced_at'])}',
                      style: TextStyle(fontSize: 11, color: faded),
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'Tip: from WhatsApp you can also send SYNC: followed by the same text.',
              style: TextStyle(fontSize: 11, height: 1.45, color: faded),
            ),
          ] else
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: scheme.surfaceContainerLowest,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: scheme.outline),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.lock_outline_rounded, size: 15, color: faded),
                      const SizedBox(width: 7),
                      Expanded(
                        child: Text(
                          'Profile sync is a premium feature. Manual teaching '
                          'with LEARN: stays free forever.',
                          style: TextStyle(
                              fontSize: 12, height: 1.5, color: faded),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton(
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        minimumSize: const Size(0, 36),
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      onPressed: () => _showUpgrade(
                          title: 'Unlock profile sync', lines: _syncLines),
                      child: const Text('See upgrade options'),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  // ── add form ───────────────────────────────────────────────────
  Widget _addCard(ColorScheme scheme) {
    final faded = scheme.onSurface.withValues(alpha: 0.58);
    final photo = _photo.text.trim();
    return SoftPanel(
      padding: const EdgeInsets.fromLTRB(16, 15, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Add a product',
            style: TextStyle(
              fontSize: 16.5,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 4),
          Text.rich(
            TextSpan(
              children: [
                const TextSpan(text: 'Free forever — or send '),
                TextSpan(
                  text: _learnExample,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                const TextSpan(text: ' from your WhatsApp.'),
              ],
            ),
            style: TextStyle(fontSize: 12, height: 1.5, color: faded),
          ),
          const SizedBox(height: 14),
          const _FieldLabel('Product name'),
          TextField(
            controller: _name,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(hintText: 'Blue gown'),
          ),
          const SizedBox(height: 12),
          const _FieldLabel('Price'),
          TextField(
            controller: _price,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(hintText: '₦45,000'),
          ),
          const SizedBox(height: 12),
          const _FieldLabel('Number in stock'),
          TextField(
            controller: _qty,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(hintText: 'e.g. 20'),
          ),
          const SizedBox(height: 12),
          AppSelect(
            label: 'Category',
            value: _cat,
            placeholder: 'No category',
            sheetTitle: 'Which shelf?',
            options: [
              const AppSelectOption(value: '', label: 'No category'),
              for (final s in _shelves)
                AppSelectOption(value: s, label: s),
            ],
            onChanged: (v) => setState(() => _cat = v.isEmpty ? null : v),
          ),
          const SizedBox(height: 12),
          const _FieldLabel('Details (optional)'),
          TextField(
            controller: _desc,
            textCapitalization: TextCapitalization.sentences,
            maxLines: 2,
            minLines: 1,
            decoration: InputDecoration(hintText: _detailHint),
          ),
          const SizedBox(height: 14),
          // Fulfilment: the bot quotes these VERBATIM — it never invents a
          // delivery time or a pickup address.
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: scheme.outline),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const _FieldLabel('Delivery & how to buy'),
                Text(
                  'Optional — the AI answers "how do I get it?" from these '
                  'lines, and never invents an answer.',
                  style: TextStyle(fontSize: 11, height: 1.45, color: faded),
                ),
                const SizedBox(height: 10),
                const _FieldLabel('Delivery time'),
                TextField(
                  controller: _delivery,
                  maxLength: 300,
                  decoration: const InputDecoration(
                    hintText: 'e.g. Lagos 24–48hrs, nationwide 3–5 days',
                    counterText: '',
                  ),
                ),
                const SizedBox(height: 10),
                const _FieldLabel('Pickup location'),
                TextField(
                  controller: _location,
                  maxLength: 300,
                  decoration: const InputDecoration(
                    hintText: 'e.g. Maitama, Abuja',
                    counterText: '',
                  ),
                ),
                const SizedBox(height: 10),
                const _FieldLabel('How to buy'),
                TextField(
                  controller: _howtobuy,
                  maxLength: 300,
                  decoration: const InputDecoration(
                    hintText: 'e.g. Chat to order, pay on delivery',
                    counterText: '',
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          // Photo: pick from the phone (hosted, then sent in replies on Pro).
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: VeloSalesTheme.green.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                  color: VeloSalesTheme.green.withValues(alpha: 0.32)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.photo_camera_outlined,
                        size: 15, color: VeloSalesTheme.successColor(context)),
                    const SizedBox(width: 6),
                    const Text(
                      'Product photo',
                      style:
                          TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
                    ),
                    if (!_pro) ...[
                      const SizedBox(width: 4),
                      _LockButton(
                        small: true,
                        tooltip: 'Unlock product photos',
                        onTap: () => _showUpgrade(
                            title: 'Unlock product photos', lines: _photoLines),
                      ),
                    ],
                    const Spacer(),
                    if (photo.isNotEmpty)
                      TextButton(
                        style: TextButton.styleFrom(
                          minimumSize: const Size(0, 32),
                          padding: const EdgeInsets.symmetric(horizontal: 6),
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        onPressed: () => setState(() => _photo.clear()),
                        child: const Text('Clear',
                            style: TextStyle(fontSize: 12)),
                      ),
                  ],
                ),
                const SizedBox(height: 4),
                Align(
                  alignment: Alignment.centerLeft,
                  child: OutlinedButton.icon(
                    onPressed: _uploading ? null : _uploadPhoto,
                    icon: _uploading
                        ? const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.photo_camera_outlined, size: 16),
                    label: Text(_uploading ? 'Uploading…' : 'Upload media'),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(0, 40),
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  '…or paste an image link below',
                  style: TextStyle(fontSize: 11, color: faded),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _photo,
                  keyboardType: TextInputType.url,
                  autocorrect: false,
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(
                    hintText: 'Paste a public image link: https://…',
                  ),
                ),
                if (photo.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: Image.network(
                          photo,
                          width: 58,
                          height: 58,
                          cacheWidth: 116,
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) => Container(
                            width: 58,
                            height: 58,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: scheme.surfaceContainerLowest,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: scheme.outline),
                            ),
                            child: Icon(Icons.image_not_supported_outlined,
                                size: 18, color: faded),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _pro
                              ? 'Looks good — the bot sends this photo with its '
                                  'reply on WhatsApp + Telegram.'
                              : 'Saved for you. Upgraded shops send the photo '
                                  'inside the reply bubble.',
                          style: TextStyle(
                              fontSize: 11, height: 1.45, color: faded),
                        ),
                      ),
                    ],
                  ),
                ] else ...[
                  const SizedBox(height: 8),
                  Text(
                    _pro
                        ? 'Pick from your files or paste any public https link '
                            '— customers see it inside the chat bubble.'
                        : 'Free shops save the photo; upgraded shops send it. '
                            'Nothing is lost by uploading now.',
                    style: TextStyle(fontSize: 11, height: 1.45, color: faded),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),
          GradientPill(
            label: _saving ? 'Adding…' : 'Add product',
            icon: _saving ? null : Icons.add_rounded,
            height: 50,
            onTap: _saving ? null : _add,
          ),
        ],
      ),
    );
  }
}

// ── small pieces ─────────────────────────────────────────────────

class _FieldLabel extends StatelessWidget {
  final String text;
  const _FieldLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 12.5,
          fontWeight: FontWeight.w700,
          color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.62),
        ),
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  final String label;
  final Color? fg;
  final Color? bg;

  const _Tag({required this.label, this.fg, this.bg});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final color = fg ?? scheme.primary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
      decoration: BoxDecoration(
        color: bg ?? scheme.primaryContainer,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.1,
          color: color,
        ),
      ),
    );
  }
}

class _RowAction extends StatelessWidget {
  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;

  const _RowAction({
    required this.icon,
    required this.tooltip,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Tooltip(
      message: tooltip,
      child: Semantics(
        button: true,
        label: tooltip,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(999),
          child: SizedBox(
            width: 38,
            height: 32,
            child: Icon(
              icon,
              size: 18,
              color: scheme.onSurface.withValues(alpha: 0.42),
            ),
          ),
        ),
      ),
    );
  }
}

class _LockButton extends StatelessWidget {
  final String tooltip;
  final VoidCallback onTap;
  final bool small;

  const _LockButton({
    required this.tooltip,
    required this.onTap,
    this.small = false,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final size = small ? 26.0 : 34.0;
    return Tooltip(
      message: tooltip,
      child: Pressable(
        onTap: onTap,
        radius: BorderRadius.circular(999),
        child: Container(
          width: size,
          height: size,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: scheme.surfaceContainerLowest,
            border: Border.all(color: scheme.outline),
          ),
          child: Icon(
            Icons.lock_outline_rounded,
            size: small ? 13 : 16,
            color: scheme.onSurface.withValues(alpha: 0.55),
          ),
        ),
      ),
    );
  }
}

class _Search extends StatelessWidget {
  final TextEditingController controller;
  final String value;
  final ValueChanged<String> onChanged;
  final VoidCallback onClear;

  const _Search({
    required this.controller,
    required this.value,
    required this.onChanged,
    required this.onClear,
  });

  OutlineInputBorder _border(Color color) => OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: color),
      );

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SizedBox(
      height: 40,
      child: TextField(
        controller: controller,
        onChanged: onChanged,
        textInputAction: TextInputAction.search,
        style: TextStyle(fontSize: 14, color: scheme.onSurface),
        decoration: InputDecoration(
          hintText: 'Search products…',
          hintStyle: TextStyle(
            fontSize: 13.5,
            color: scheme.onSurface.withValues(alpha: 0.38),
          ),
          isDense: true,
          filled: true,
          fillColor: scheme.surfaceContainerLowest,
          prefixIcon: Icon(Icons.search_rounded,
              size: 18, color: scheme.onSurface.withValues(alpha: 0.45)),
          prefixIconConstraints:
              const BoxConstraints(minWidth: 38, minHeight: 38),
          suffixIcon: value.isEmpty
              ? null
              : InkWell(
                  onTap: onClear,
                  borderRadius: BorderRadius.circular(999),
                  child: Icon(Icons.close_rounded,
                      size: 17,
                      color: scheme.onSurface.withValues(alpha: 0.55)),
                ),
          suffixIconConstraints:
              const BoxConstraints(minWidth: 38, minHeight: 38),
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
          border: _border(scheme.outline),
          enabledBorder: _border(scheme.outline),
          focusedBorder: _border(scheme.primary),
        ),
      ),
    );
  }
}
