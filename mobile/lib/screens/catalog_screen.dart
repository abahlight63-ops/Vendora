// ── lib/screens/catalog_screen.dart ──────────────────────────────
// WHAT: the product catalog on glass. What Velo cannot quote comes first. Swipe a
// row right to edit or left to mark it sold out, with a tick from the phone. Add
// and Edit open one sheet whose questions follow the shop's kind of business
// (product_fields.dart). This data is literally what the AI is allowed to say.
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../glass.dart';
import '../motion.dart';
import '../product_fields.dart';
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
  String _view = 'all'; // 'all' | 'fix' | 'out' | a category name
  bool _importing = false; // the import box is open

  // ── shop context ──
  String _tier = 'free';
  String _currency = 'NGN';
  String _niche = '';
  List<String> _shelves = const ['New Arrivals', 'Best Sellers', 'General', 'Other'];
  String _detailHint = 'Sizes, colours, what makes it special…';
  String _learnExample = 'LEARN: Blue gown ₦45,000';

  // ── profile sync ──
  Map<String, dynamic>? _syncInfo;
  final _syncText = TextEditingController();
  bool _syncing = false;

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
        }
        _niche = '${meta['niche'] ?? ''}';
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

  List<Map<String, dynamic>> get _all => (_items ?? [])
      .map((e) => (e as Map).cast<String, dynamic>())
      .toList();

  bool _noPrice(Map<String, dynamic> p) => '${p['price'] ?? ''}'.trim().isEmpty;
  bool _inStock(Map<String, dynamic> p) => p['available'] != false;

  List<Map<String, dynamic>> get _rows {
    final needle = _q.trim().toLowerCase();
    final out = _all.where((p) {
      final inView = _view == 'all' ||
          (_view == 'fix' && _noPrice(p)) ||
          (_view == 'out' && !_inStock(p)) ||
          p['category'] == _view;
      return inView &&
          (needle.isEmpty ||
              '${p['name'] ?? ''} ${p['category'] ?? ''} ${p['description'] ?? ''}'
                  .toLowerCase()
                  .contains(needle));
    }).toList();
    // What Velo cannot quote comes first. The sort keeps the order otherwise.
    final fix = out.where(_noPrice).toList();
    return [...fix, ...out.where((p) => !_noPrice(p))];
  }

  Future<void> _openSheet([Map<String, dynamic>? product]) async {
    HapticFeedback.selectionClick();
    final result = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ProductSheet(
        product: product,
        fields: fieldsFor(_niche),
        shelves: _shelves,
        detailHint: _detailHint,
        pro: _pro,
        onUpgrade: () => _showUpgrade(title: 'Unlock product photos', lines: _photoLines),
      ),
    );
    if (!mounted || result == null) return;
    if (result == 'remove') {
      await _delete(product!);
      return;
    }
    HapticFeedback.mediumImpact();
    showToast(context, product == null ? 'Product added. Velo can sell it now.' : 'Saved. Velo uses this straight away.');
    await _load();
  }

  Future<void> _toggle(Map<String, dynamic> p) async {
    final wasInStock = p['available'] != false;
    try {
      await ApiClient.instance.toggleProduct(p);
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      showToast(context,
          wasInStock ? 'Marked as sold out.' : 'Back in stock. Velo can sell it.');
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
            title: 'Unlock profile sync', lines: _syncLines);
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
    return BrandRefresh(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 6, 16, 32),
        children: [
          _head(),
          const SizedBox(height: 14),
          _health(),
          const SizedBox(height: 12),
          _search(),
          const SizedBox(height: 10),
          _pills(),
          const SizedBox(height: 12),
          _list(),
          const SizedBox(height: 16),
          _teach(),
          const SizedBox(height: 12),
          _import(),
        ],
      ),
    );
  }

  Widget _head() {
    final good = VeloSalesTheme.goodInk(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(color: good, shape: BoxShape.circle),
                ),
                const SizedBox(width: 7),
                Text(
                  'Velo reads this live',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: good),
                ),
              ]),
              const SizedBox(height: 6),
              const Text(
                'Catalog',
                style: TextStyle(fontSize: 31, height: 1.1, fontWeight: FontWeight.w800, letterSpacing: -1),
              ),
            ],
          ),
        ),
        Semantics(
          button: true,
          label: 'Add product',
          child: Pressable(
            onTap: () => _openSheet(),
            radius: BorderRadius.circular(999),
            child: Container(
              width: 54,
              height: 54,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: VeloSalesTheme.cta(context),
                boxShadow: [
                  BoxShadow(
                    color: VeloSalesTheme.accentSolid.withValues(alpha: 0.34),
                    blurRadius: 18,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Icon(Icons.add_rounded, size: 28, color: VeloSalesTheme.onAccent(context)),
            ),
          ),
        ),
      ],
    );
  }

  Widget _health() {
    final all = _all;
    final fix = all.where(_noPrice).length;
    final ready = all.length - fix;
    final ink = VeloSalesTheme.glassInk(context);
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: VeloSalesTheme.glass(context, radius: 26),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Catalog health', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text.rich(
                  TextSpan(children: [
                    TextSpan(
                      text: _items == null ? '–' : '$ready',
                      style: const TextStyle(fontSize: 31, fontWeight: FontWeight.w800, letterSpacing: -1),
                    ),
                    TextSpan(
                      text: ' of ${all.length} ready',
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                    ),
                  ]),
                ),
                const SizedBox(height: 4),
                Text(
                  fix > 0
                      ? 'Fix the highlighted ${fix == 1 ? 'product' : 'products'} so Velo can sell ${fix == 1 ? 'it' : 'them'}.'
                      : 'Velo only quotes what is here.',
                  style: TextStyle(fontSize: 13, height: 1.35, color: ink),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Semantics(
            label: '${all.isEmpty ? 0 : (ready * 100 / all.length).round()} percent of products ready',
            child: SizedBox(
              width: 62,
              height: 62,
              child: CustomPaint(
                painter: _HealthRing(
                  all.isEmpty ? 0 : ready / all.length,
                  Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.12),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _search() {
    final ink = VeloSalesTheme.glassInk(context);
    return Container(
      height: 50,
      padding: const EdgeInsets.only(left: 14, right: 4),
      decoration: VeloSalesTheme.glass(context, radius: 999, bright: true),
      child: Row(
        children: [
          Icon(Icons.search_rounded, size: 20, color: ink),
          const SizedBox(width: 8),
          Expanded(
            child: TextField(
              controller: _find,
              onChanged: (v) => setState(() => _q = v),
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
              decoration: InputDecoration(
                isCollapsed: true,
                filled: false,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                hintText: 'Search products',
                hintStyle: TextStyle(fontSize: 15, color: ink),
              ),
            ),
          ),
          if (_q.isNotEmpty)
            IconButton(
              tooltip: 'Clear search',
              icon: Icon(Icons.close_rounded, size: 18, color: ink),
              onPressed: () {
                _find.clear();
                setState(() => _q = '');
              },
            ),
        ],
      ),
    );
  }

  Widget _pills() {
    final all = _all;
    final fix = all.where(_noPrice).length;
    final out = all.where((p) => !_inStock(p)).length;
    final cats = <String>{
      for (final p in all)
        if ('${p['category'] ?? ''}'.isNotEmpty) '${p['category']}',
    }.take(6);
    void pick(String v) {
      HapticFeedback.selectionClick();
      setState(() => _view = _view == v ? 'all' : v);
    }

    return SizedBox(
      height: 44,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          _Pill(_items == null ? 'All' : 'All ${all.length}', _view == 'all', () => pick('all')),
          if (fix > 0) _Pill('Needs a fix $fix', _view == 'fix', () => pick('fix'), hot: true),
          if (out > 0) _Pill('Sold out $out', _view == 'out', () => pick('out')),
          for (final c in cats) _Pill(c, _view == c, () => pick(c)),
        ],
      ),
    );
  }

  Widget _list() {
    if (_loading && _items == null) {
      return Container(
        padding: const EdgeInsets.all(14),
        decoration: VeloSalesTheme.glass(context, radius: 26),
        child: Column(
          children: [
            for (var i = 0; i < 5; i++)
              Padding(
                padding: EdgeInsets.only(bottom: i == 4 ? 0 : 14),
                child: const Row(
                  children: [
                    Skeleton(width: 52, height: 52, radius: 16),
                    SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Skeleton(width: 150, height: 14),
                          SizedBox(height: 8),
                          Skeleton(width: 90, height: 11),
                        ],
                      ),
                    ),
                    Skeleton(width: 60, height: 14),
                  ],
                ),
              ),
          ],
        ),
      );
    }
    if (_err != null && _items == null) {
      return SizedBox(
        height: 250,
        child: EmptyState("Couldn't load your catalog", _err!, retry: _load),
      );
    }
    final rows = _rows;
    if (rows.isEmpty) return _emptyRows();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          clipBehavior: Clip.antiAlias,
          decoration: VeloSalesTheme.glass(context, radius: 26),
          child: Column(
            children: [
              for (var i = 0; i < rows.length; i++)
                FadeSlideIn(
                  key: ValueKey('fade-${rows[i]['id']}'),
                  delayMs: (i * 40).clamp(0, 240),
                  child: _productRow(rows[i], last: i == rows.length - 1),
                ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6),
          child: Text(
            'Tap a product to edit it, or swipe it left to mark it sold out.',
            style: TextStyle(fontSize: 13, color: VeloSalesTheme.glassInk(context)),
          ),
        ),
      ],
    );
  }

  Widget _emptyRows() {
    final filtered = _q.trim().isNotEmpty || _view != 'all';
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(20, 26, 20, 24),
      decoration: VeloSalesTheme.glass(context, radius: 26),
      child: Column(
        children: [
          Text(
            filtered ? 'No products match' : 'No products yet',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 4),
          Text(
            filtered ? 'Clear your search or try All.' : 'Add your first product, and Velo can start selling it.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 14, height: 1.4, color: VeloSalesTheme.glassInk(context)),
          ),
          if (!filtered) ...[
            const SizedBox(height: 14),
            GradientPill(label: 'Add product', height: 48, onTap: () => _openSheet()),
          ],
        ],
      ),
    );
  }

  Widget _swipeBack(Alignment at, Color color, IconData icon, String label) {
    return Container(
      color: color,
      alignment: at,
      padding: const EdgeInsets.symmetric(horizontal: 22),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: Colors.white, size: 21),
          const SizedBox(height: 3),
          Text(label, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }

  Widget _productRow(Map<String, dynamic> p, {required bool last}) {
    final fix = _noPrice(p);
    final stocked = _inStock(p);
    final ink = VeloSalesTheme.glassInk(context);
    final coral = VeloSalesTheme.coralText(context);
    final saved = parsePrice('${p['price'] ?? ''}');
    final stockWord = stocked ? 'Mark sold out' : 'Back in stock';
    final cat = '${p['category'] ?? ''}'.trim();
    final sub = [if (cat.isNotEmpty) cat, '${p['quantity'] ?? 0} left'].join(' · ');
    return Semantics(
      customSemanticsActions: {
        CustomSemanticsAction(label: stockWord): () => _toggle(p),
      },
      child: Dismissible(
        key: ValueKey('swipe-${p['id']}'),
        dismissThresholds: const {
          DismissDirection.startToEnd: 0.28,
          DismissDirection.endToStart: 0.28,
        },
        background: _swipeBack(Alignment.centerLeft, VeloSalesTheme.purple, Icons.edit_rounded, 'Edit'),
        secondaryBackground: _swipeBack(
          Alignment.centerRight,
          stocked ? VeloSalesTheme.accentSolid : VeloSalesTheme.greenDark,
          stocked ? Icons.remove_shopping_cart_rounded : Icons.check_rounded,
          stocked ? 'Sold out' : 'In stock',
        ),
        confirmDismiss: (direction) async {
          // The row always springs back: a swipe runs an action, it never removes.
          if (direction == DismissDirection.startToEnd) {
            _openSheet(p);
          } else {
            _toggle(p);
          }
          return false;
        },
        child: Pressable(
          onTap: () => _openSheet(p),
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: fix ? VeloSalesTheme.accentSolid.withValues(alpha: 0.1) : null,
              border: last
                  ? null
                  : Border(
                      bottom: BorderSide(
                        color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.08),
                      ),
                    ),
            ),
            child: Row(
              children: [
                _ProductThumb(url: _hasPhoto(p) ? '${p['image_url']}' : null),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${p['name'] ?? ''}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        fix ? 'Needs a price, so Velo cannot quote it' : sub,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: fix ? FontWeight.w700 : FontWeight.w500,
                          color: fix ? coral : ink,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    if (!fix)
                      Text(
                        _priceLabel(saved.price),
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          fontFeatures: [FontFeature.tabularFigures()],
                        ),
                      ),
                    if (saved.oldPrice.isNotEmpty)
                      Text(
                        saved.oldPrice,
                        style: TextStyle(fontSize: 12, color: ink, decoration: TextDecoration.lineThrough),
                      ),
                    if (!stocked)
                      Text(
                        'Sold out',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: coral),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _teach() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: VeloSalesTheme.glass(context, radius: 26),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Teach from WhatsApp', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text(
            'Send this from your own number and the product appears here.',
            style: TextStyle(fontSize: 14, height: 1.4, color: VeloSalesTheme.glassInk(context)),
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
            decoration: const BoxDecoration(
              color: Color(0xFFDCF8C6),
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(16),
                topRight: Radius.circular(4),
                bottomLeft: Radius.circular(16),
                bottomRight: Radius.circular(16),
              ),
            ),
            child: Text(
              _learnExample,
              style: const TextStyle(fontSize: 14, height: 1.4, fontWeight: FontWeight.w600, color: Color(0xFF111B21)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _import() {
    final last = _syncInfo != null && _syncInfo!['synced'] == true ? _when(_syncInfo!['synced_at']) : null;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(26),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF4F3FC7), Color(0xFF2A1C7A)],
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF4F3FC7).withValues(alpha: 0.32),
            blurRadius: 26,
            offset: const Offset(0, 14),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Import your whole shop',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white),
          ),
          const SizedBox(height: 4),
          const Text(
            'Paste your WhatsApp Business profile and Velo builds the catalog. Photos in replies come with it.',
            style: TextStyle(fontSize: 14, height: 1.4, color: Color(0xFFE0DBFF)),
          ),
          const SizedBox(height: 12),
          if (_pro && _importing) ...[
            TextField(
              controller: _syncText,
              minLines: 3,
              maxLines: 6,
              style: const TextStyle(fontSize: 14, color: Color(0xFF1E1757)),
              decoration: const InputDecoration(
                filled: true,
                fillColor: Color(0xF0FFFFFF),
                labelText: 'Business profile text',
                labelStyle: TextStyle(color: Color(0xFF3F3A63)),
                hintText: 'Amaka Beauty: Bone straight wig ₦95,000',
                hintStyle: TextStyle(color: Color(0xFF5F5A7D)),
              ),
            ),
            const SizedBox(height: 10),
          ],
          _WhitePill(
            label: !_pro
                ? 'See plans'
                : _syncing
                    ? 'Importing'
                    : 'Import products',
            busy: _syncing,
            onTap: !_pro
                ? _openBilling
                : _syncing
                    ? null
                    : () {
                        if (_importing) {
                          _syncProfile();
                        } else {
                          setState(() => _importing = true);
                        }
                      },
          ),
          if (_pro && last != null) ...[
            const SizedBox(height: 8),
            Text('Last import: $last', style: const TextStyle(fontSize: 13, color: Color(0xFFE0DBFF))),
          ],
        ],
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  final String label;
  final bool on;
  final VoidCallback onTap;
  final bool hot;
  const _Pill(this.label, this.on, this.onTap, {this.hot = false});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final dark = scheme.brightness == Brightness.dark;
    final onBg = hot ? VeloSalesTheme.accent(context) : (dark ? Colors.white : const Color(0xFF1E1757));
    final onInk = hot ? VeloSalesTheme.onAccent(context) : (dark ? const Color(0xFF1E1757) : Colors.white);
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Semantics(
        button: true,
        selected: on,
        child: Pressable(
          onTap: onTap,
          radius: BorderRadius.circular(999),
          child: Container(
            constraints: const BoxConstraints(minHeight: 44),
            padding: const EdgeInsets.symmetric(horizontal: 16),
            alignment: Alignment.center,
            decoration: on
                ? BoxDecoration(color: onBg, borderRadius: BorderRadius.circular(999))
                : VeloSalesTheme.glass(context, radius: 999, bright: true),
            child: Text(
              label,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: on ? onInk : (hot ? VeloSalesTheme.coralText(context) : scheme.onSurface),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _WhitePill extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;
  final bool busy;
  const _WhitePill({required this.label, this.onTap, this.busy = false});

  @override
  Widget build(BuildContext context) {
    return Pressable(
      onTap: onTap,
      radius: BorderRadius.circular(999),
      child: Container(
        height: 46,
        width: double.infinity,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(999)),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (busy) ...[
              const OrbitLoader(size: 16),
              const SizedBox(width: 8),
            ],
            Text(
              label,
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF2A1C7A)),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProductThumb extends StatelessWidget {
  final String? url;
  final double size;
  final IconData icon;
  const _ProductThumb({this.url, this.size = 52, this.icon = Icons.image_outlined});

  @override
  Widget build(BuildContext context) {
    final blank = Icon(icon, size: size * 0.46, color: const Color(0xFF4F3FC7));
    return Container(
      width: size,
      height: size,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFFFD9CC), Color(0xFFD9D1FF)],
        ),
      ),
      child: url == null
          ? blank
          : Image.network(url!, fit: BoxFit.cover, errorBuilder: (_, _, _) => blank),
    );
  }
}

class _HealthRing extends CustomPainter {
  final double value;
  final Color track;
  _HealthRing(this.value, this.track);

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 8.0;
    final rect = (Offset.zero & size).deflate(stroke / 2);
    canvas.drawArc(
      rect,
      0,
      6.2832,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..color = track,
    );
    if (value <= 0) return;
    canvas.drawArc(
      rect,
      -1.5708,
      6.2832 * value,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.round
        ..shader = const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF4F3FC7), Color(0xFFD03C16)],
        ).createShader(Offset.zero & size),
    );
  }

  @override
  bool shouldRepaint(_HealthRing old) => old.value != value || old.track != track;
}

/// The one Add and Edit sheet. Pops 'saved' after a save, or 'remove' to ask the
/// list to remove the product (the list owns that confirmation).
class _ProductSheet extends StatefulWidget {
  final Map<String, dynamic>? product;
  final List<ProductField> fields;
  final List<String> shelves;
  final String detailHint;
  final bool pro;
  final VoidCallback onUpgrade;
  const _ProductSheet({
    this.product,
    required this.fields,
    required this.shelves,
    required this.detailHint,
    required this.pro,
    required this.onUpgrade,
  });

  @override
  State<_ProductSheet> createState() => _ProductSheetState();
}

class _ProductSheetState extends State<_ProductSheet> {
  late final TextEditingController _name, _price, _old, _qty, _desc, _delivery, _location, _how;
  final Map<String, TextEditingController> _boxes = {}; // typed answers
  final Map<String, String> _picked = {}; // chosen answers
  String _cat = '';
  String _photo = '';
  bool _inStock = true;
  bool _more = false;
  bool _saving = false;
  bool _uploading = false;

  Map<String, dynamic>? get _p => widget.product;
  bool get _editing => _p != null;
  String _text(String key) => '${_p?[key] ?? ''}';

  @override
  void initState() {
    super.initState();
    final price = parsePrice(_text('price'));
    final details = parseDetails(_text('description'), widget.fields);
    _name = TextEditingController(text: _text('name'));
    _price = TextEditingController(text: price.price);
    _old = TextEditingController(text: price.oldPrice);
    _qty = TextEditingController(text: _editing ? _text('quantity') : '');
    _desc = TextEditingController(text: details.details);
    _delivery = TextEditingController(text: _text('delivery_info'));
    _location = TextEditingController(text: _text('location'));
    _how = TextEditingController(text: _text('how_to_buy'));
    for (final f in widget.fields) {
      if (f.options == null) {
        _boxes[f.label] = TextEditingController(text: details.answers[f.label] ?? '');
      } else if (details.answers[f.label] != null) {
        _picked[f.label] = details.answers[f.label]!;
      }
    }
    _cat = _text('category');
    _photo = _hasPhoto(_p ?? const {}) ? _text('image_url') : '';
    _inStock = _p?['available'] != false;
    _more = _delivery.text.isNotEmpty || _location.text.isNotEmpty || _how.text.isNotEmpty;
  }

  @override
  void dispose() {
    for (final c in [_name, _price, _old, _qty, _desc, _delivery, _location, _how, ..._boxes.values]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _pickPhoto() async {
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
        if (mounted) showToast(context, 'That photo is too large. Please choose one under 2.5MB.', type: 'err');
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
        showToast(context, 'That upload failed. Please try another photo.', type: 'err');
        return;
      }
      setState(() => _photo = url);
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, type: 'err');
    } catch (_) {
      if (mounted) showToast(context, 'Could not read that photo. Please try another.', type: 'err');
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _save() async {
    final name = _name.text.trim();
    if (name.isEmpty) {
      showToast(context, 'Please give the product a name.', type: 'err');
      return;
    }
    final answers = <String, String>{
      ..._picked,
      for (final e in _boxes.entries) e.key: e.value.text,
    };
    final description = buildDetails(answers, widget.fields, _desc.text);
    final price = buildPrice(_price.text, _old.text);
    final qty = _qty.text.trim();
    // Adding: blank keys stay out, so re-adding a name never wipes its photo or lines.
    // Editing: the sheet shows the whole product, so a blank box means clear it.
    void line(Map<String, dynamic> body, String key, String value) {
      if (value.trim().isNotEmpty || _editing) body[key] = value.trim();
    }

    final body = <String, dynamic>{
      'name': name,
      if (price.isNotEmpty) 'price': price,
      if (description.isNotEmpty) 'description': description,
      'available': _inStock,
      if (qty.isNotEmpty) 'quantity': qty,
    };
    line(body, 'category', _cat);
    line(body, 'delivery_info', _delivery.text);
    line(body, 'location', _location.text);
    line(body, 'how_to_buy', _how.text);
    if (_photo.isNotEmpty) {
      body['image_url'] = _photo;
    } else if (_hasPhoto(_p ?? const {})) {
      body['image_url'] = '';
    }
    setState(() => _saving = true);
    try {
      await ApiClient.instance.saveProduct(body);
      if (mounted) Navigator.of(context).pop('saved');
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, type: 'err');
    } catch (_) {
      if (mounted) showToast(context, 'No connection. Your product was not saved.', type: 'err');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _box(String label, TextEditingController c, String hint,
      {TextInputType? type, bool enabled = true, int maxLines = 1}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
        const SizedBox(height: 6),
        TextField(
          controller: c,
          enabled: enabled,
          keyboardType: type,
          maxLines: maxLines,
          textInputAction: maxLines == 1 ? TextInputAction.next : null,
          decoration: InputDecoration(hintText: hint),
        ),
      ],
    );
  }

  Widget _labelled(String label, Widget child) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          child,
        ],
      );

  Widget _two(Widget a, Widget? b) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: a),
            const SizedBox(width: 10),
            Expanded(child: b ?? const SizedBox.shrink()),
          ],
        ),
      );

  Widget _answer(ProductField f) {
    if (f.options == null) return _box(f.label, _boxes[f.label]!, f.hint);
    return _labelled(
      f.label,
      AppSelect(
        placeholder: 'Choose',
        sheetTitle: f.label,
        value: _picked[f.label],
        options: [for (final o in f.options!) AppSelectOption(value: o, label: o)],
        onChanged: (v) => setState(() => _picked[f.label] = v),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final dark = scheme.brightness == Brightness.dark;
    final ink = VeloSalesTheme.glassInk(context);
    final fields = widget.fields;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        height: MediaQuery.of(context).size.height * 0.9,
        decoration: BoxDecoration(
          borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: dark
                ? const [Color(0xFF261D6E), Color(0xFF120B4A)]
                : const [Color(0xFFFFF6F3), Color(0xFFF1ECFF)],
          ),
        ),
        child: Column(
          children: [
            const SizedBox(height: 10),
            Container(
              width: 44,
              height: 5,
              decoration: BoxDecoration(
                color: scheme.onSurface.withValues(alpha: 0.22),
                borderRadius: BorderRadius.circular(999),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 6, 8, 4),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      _editing ? 'Edit product' : 'Add a product',
                      style: const TextStyle(fontSize: 25, fontWeight: FontWeight.w800, letterSpacing: -0.6),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Close',
                    icon: const Icon(Icons.close_rounded),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                children: [
                  Pressable(
                    onTap: _uploading ? null : _pickPhoto,
                    radius: BorderRadius.circular(22),
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: scheme.onSurface.withValues(alpha: dark ? 0.08 : 0.03),
                        borderRadius: BorderRadius.circular(22),
                        border: Border.all(color: VeloSalesTheme.purple.withValues(alpha: 0.4), width: 1.5),
                      ),
                      child: Row(
                        children: [
                          _ProductThumb(
                            url: _photo.isEmpty ? null : _photo,
                            size: 60,
                            icon: Icons.photo_camera_outlined,
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _uploading
                                      ? 'Uploading'
                                      : _photo.isEmpty
                                          ? 'Add a photo'
                                          : 'Change photo',
                                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  widget.pro
                                      ? "Sent with Velo's replies on WhatsApp and Telegram"
                                      : 'Saved now. Upgraded shops send it in replies',
                                  style: TextStyle(fontSize: 13, height: 1.3, color: ink),
                                ),
                              ],
                            ),
                          ),
                          if (_uploading) const OrbitLoader(size: 20),
                          if (!_uploading && !widget.pro)
                            IconButton(
                              tooltip: 'Unlock product photos',
                              icon: Icon(Icons.lock_outline_rounded, size: 20, color: ink),
                              onPressed: widget.onUpgrade,
                            ),
                        ],
                      ),
                    ),
                  ),
                  if (_photo.isNotEmpty)
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton(
                        onPressed: () => setState(() => _photo = ''),
                        child: Text('Remove photo', style: TextStyle(color: VeloSalesTheme.coralText(context))),
                      ),
                    ),
                  const SizedBox(height: 12),
                  _box('Product name', _name, 'Blue gown', enabled: !_editing),
                  if (_editing) ...[
                    const SizedBox(height: 6),
                    Text(
                      'The name is fixed for now. To rename, remove this product and add it again.',
                      style: TextStyle(fontSize: 13, height: 1.35, color: ink),
                    ),
                  ],
                  const SizedBox(height: 12),
                  _two(
                    _box('Price', _price, '₦45,000'),
                    _box('Old price, if on sale', _old, '₦60,000'),
                  ),
                  _two(
                    _box('Number in stock', _qty, '20', type: TextInputType.number),
                    _labelled(
                      'Category',
                      AppSelect(
                        placeholder: 'Choose',
                        sheetTitle: 'Category',
                        value: _cat.isEmpty ? null : _cat,
                        options: [
                          const AppSelectOption(value: '', label: 'No category'),
                          for (final c in {...widget.shelves, if (_cat.isNotEmpty) _cat})
                            AppSelectOption(value: c, label: c),
                        ],
                        onChanged: (v) => setState(() => _cat = v),
                      ),
                    ),
                  ),
                  if (_editing)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('In stock', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                        value: _inStock,
                        onChanged: (v) {
                          HapticFeedback.selectionClick();
                          setState(() => _inStock = v);
                        },
                      ),
                    ),
                  Container(
                    padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
                    decoration: BoxDecoration(
                      color: VeloSalesTheme.purple.withValues(alpha: dark ? 0.3 : 0.1),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Column(
                      children: [
                        for (var i = 0; i < fields.length; i += 2)
                          _two(
                            _answer(fields[i]),
                            i + 1 < fields.length ? _answer(fields[i + 1]) : null,
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  _box('Anything else customers should know', _desc, widget.detailHint, maxLines: 2),
                  const SizedBox(height: 12),
                  Pressable(
                    onTap: () => setState(() => _more = !_more),
                    radius: BorderRadius.circular(16),
                    child: Container(
                      constraints: const BoxConstraints(minHeight: 52),
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      decoration: BoxDecoration(
                        color: VeloSalesTheme.purple.withValues(alpha: dark ? 0.3 : 0.1),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Row(
                        children: [
                          const Expanded(
                            child: Text(
                              'Delivery, pickup and how to buy',
                              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                            ),
                          ),
                          AnimatedRotation(
                            turns: _more ? 0.5 : 0,
                            duration: const Duration(milliseconds: 180),
                            child: const Icon(Icons.expand_more_rounded),
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (_more) ...[
                    const SizedBox(height: 12),
                    _box('Delivery time', _delivery, 'Lagos 24 to 48 hours, nationwide 3 to 5 days'),
                    const SizedBox(height: 12),
                    _box('Pickup location', _location, 'Maitama, Abuja'),
                    const SizedBox(height: 12),
                    _box('How to buy', _how, 'Chat to order, pay on delivery'),
                    const SizedBox(height: 8),
                    Text(
                      'Velo answers "how do I get it?" from these lines and never invents them.',
                      style: TextStyle(fontSize: 13, height: 1.35, color: ink),
                    ),
                  ],
                ],
              ),
            ),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    SizedBox(
                      width: double.infinity,
                      child: GradientPill(
                        label: _saving
                            ? 'Saving'
                            : _editing
                                ? 'Save changes'
                                : 'Add product',
                        height: 52,
                        onTap: _saving ? null : _save,
                      ),
                    ),
                    const SizedBox(height: 6),
                    if (_editing)
                      TextButton(
                        onPressed: () => Navigator.of(context).pop('remove'),
                        child: const Text('Remove product', style: TextStyle(color: VeloSalesTheme.red)),
                      )
                    else
                      Text(
                        'Velo can sell it as soon as you save.',
                        style: TextStyle(fontSize: 13, color: ink),
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
