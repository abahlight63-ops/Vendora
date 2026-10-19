// ── lib/screens/insights_screen.dart ──────────────────────────────
// WHAT: the phone twin of the web Insights page. Four KPIs, a 14-day volume
// line, the AI-vs-you ring, peak hours, the INACTIVITY RECORD (customers who
// have gone quiet, banded by how long, each with a one-tap WhatsApp nudge) and
// the flag reasons as bars.
//
// DATA: crunched from /api/me/conversations on the phone, exactly like the web
// page — no extra endpoint, and nothing invented. If the list is empty the
// screen says so instead of drawing a flat line at zero.
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../glass.dart';
import '../motion.dart';
import '../theme.dart';
import '../widgets/brand_ui.dart';

/// `List<int>.reduce(math.max)` does not type-check (math.max is num→num), so
/// the app keeps one tiny int-max helper instead of casting at every call.
int _maxInt(List<int> xs) => xs.reduce((a, b) => a > b ? a : b);

class InsightsScreen extends StatefulWidget {
  const InsightsScreen({super.key});

  @override
  State<InsightsScreen> createState() => _InsightsScreenState();
}

class _InsightsScreenState extends State<InsightsScreen> {
  Map<String, dynamic>? _d;
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
      final raw = await ApiClient.instance.conversations();
      if (!mounted) return;
      setState(() => _d = _crunch(raw));
    } on ApiException catch (e) {
      if (mounted) setState(() => _err = e.message);
    } catch (_) {
      if (mounted) setState(() => _err = 'No connection — nothing was lost.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Everything on this page comes from the same list, so it is computed once
  /// and kept in a plain map (no hidden state, no second fetch).
  Map<String, dynamic> _crunch(List<dynamic> rows) {
    final list = rows.map((e) => (e as Map).cast<String, dynamic>()).toList();

    // 14 noon-anchored days (DST-safe, and the label matches the web build).
    final today = DateTime.now();
    final days = List.generate(14, (i) {
      final t = DateTime(today.year, today.month, today.day - (13 - i), 12);
      return t;
    });
    final perDay = List.generate(14, (_) => [0, 0]); // [total, needsHuman]
    final hours = List.filled(24, 0);
    final now = DateTime.now();

    for (final c in list) {
      final raw = c['updated_at'] ?? c['created_at'];
      final t = DateTime.tryParse('$raw')?.toLocal();
      if (t == null) continue;
      hours[t.hour]++;
      final key = '${t.year}-${t.month}-${t.day}';
      final i = days.indexWhere((d) => '${d.year}-${d.month}-${d.day}' == key);
      if (i >= 0) {
        perDay[i][0]++;
        if (c['needs_human'] == true) perDay[i][1]++;
      }
    }

    final vol = perDay.map((p) => p[0]).toList();
    final labels = days
        .map((d) => '${d.day} ${_month(d.month)}')
        .toList();

    // AI resolution: carry the last real rate across quiet days (a day with no
    // chats has no resolution rate — 100% would be a lie).
    var carry = 100;
    final res = perDay.map((p) {
      if (p[0] > 0) carry = (((p[0] - p[1]) / p[0]) * 100).round();
      return carry;
    }).toList();

    final last7 = vol.skip(7).fold<int>(0, (a, b) => a + b);
    final prev7 = vol.take(7).fold<int>(0, (a, b) => a + b);
    final delta = prev7 > 0
        ? (((last7 - prev7) / prev7) * 100).round()
        : (last7 > 0 ? 100 : 0);

    final needs = list.where((c) => c['needs_human'] == true).length;
    final rate = list.isEmpty
        ? 100
        : (((list.length - needs) / list.length) * 100).round();

    final reasons = <String, int>{};
    for (final c in list.where((c) => c['needs_human'] == true)) {
      final r = '${c['flag_reason'] ?? 'Other'}';
      final key = r.length > 60 ? r.substring(0, 60) : r;
      reasons[key] = (reasons[key] ?? 0) + 1;
    }
    final top = reasons.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    // Quiet customers: measured from their last message, never from the fetch.
    final quiet = <Map<String, dynamic>>[];
    for (final c in list) {
      final raw = c['updated_at'] ?? c['created_at'];
      final t = DateTime.tryParse('$raw')?.toLocal();
      if (t == null) continue;
      final daysQuiet = math.max(0, now.difference(t).inDays);
      if (daysQuiet >= 7) quiet.add({...c, 'days': daysQuiet});
    }
    quiet.sort((a, b) => (b['days'] as int).compareTo(a['days'] as int));

    return {
      'total': list.length,
      'needs': needs,
      'rate': rate,
      'vol': vol,
      'res': res,
      'labels': labels,
      'hours': hours,
      'delta': delta,
      'last7': last7,
      'peakH': hours.indexOf(_maxInt(hours)),
      'activeDays': perDay.where((p) => p[0] > 0).length,
      'quiet': quiet.take(6).toList(),
      'quietTotal': quiet.length,
      'cooling': quiet.where((q) => (q['days'] as int) < 14).length,
      'cold': quiet.where((q) => (q['days'] as int) >= 14 && (q['days'] as int) < 30).length,
      'lost': quiet.where((q) => (q['days'] as int) >= 30).length,
      'top': top.take(5).toList(),
    };
  }

  static String _month(int m) =>
      const ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1];

  static String _pad(int n) => n.toString().padLeft(2, '0');

  Future<void> _nudge(Map<String, dynamic> c) async {
    final digits = '${c['customer_number'] ?? ''}'.replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.length < 8) {
      showToast(context, 'No WhatsApp number saved for this customer.', type: 'err');
      return;
    }
    final first = '${c['customer_name'] ?? ''}'.trim().split(' ').first;
    final asked = '${c['last_message'] ?? ''}';
    final quote = asked.length > 60 ? asked.substring(0, 60) : asked;
    final msg = 'Hello ${first.isEmpty ? 'there' : first}! Just checking in'
        '${quote.isEmpty ? '' : ' — you asked about “$quote”'}. '
        'Want me to send the latest price and photos?';
    final ok = await launchUrl(
      Uri.parse('https://wa.me/$digits?text=${Uri.encodeComponent(msg)}'),
      mode: LaunchMode.externalApplication,
    );
    if (!ok && mounted) {
      showToast(context, 'Could not open WhatsApp — is it installed?', type: 'err');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Insights'),
        actions: [
          IconButton(
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: _loading
          ? const _InsightsSkeleton()
          : _err != null
              ? EmptyState('Could not load insights', _err!, retry: _load)
              : _d!['total'] == 0
                  ? const EmptyState(
                      'No chats yet',
                      'Charts build themselves from your first conversations — share your WhatsApp number and come back.',
                    )
                  : RefreshIndicator(onRefresh: _load, child: _body(_d!)),
    );
  }

  Widget _body(Map<String, dynamic> d) {
    final scheme = Theme.of(context).colorScheme;
    final total = d['total'] as int;
    final needs = d['needs'] as int;
    final rate = d['rate'] as int;
    final quietTotal = d['quietTotal'] as int;
    final quietPct = total == 0 ? 0 : ((quietTotal / total) * 100).round();
    final hours = (d['hours'] as List).cast<int>();
    final hmax = _maxInt(hours) == 0 ? 1 : _maxInt(hours);
    final vol = (d['vol'] as List).cast<int>();
    final labels = (d['labels'] as List).cast<String>();
    final up = (d['delta'] as int) >= 0;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        FadeSlideIn(
          child: Text(
            'What customers ask, what the AI nails, and where you lose money.',
            style: TextStyle(
                fontSize: 13.5,
                height: 1.5,
                color: scheme.onSurface.withValues(alpha: 0.62)),
          ),
        ),
        const SizedBox(height: 16),

        // ── KPI grid (2×2 on a phone) ─────────────────────────────────
        Row(children: [
          Expanded(child: _Kpi('Total chats', '$total', '${d['activeDays']} active of 14 days')),
          const SizedBox(width: 10),
          Expanded(child: _Kpi('Resolved by AI', '$rate%', '${total - needs} answered alone', tone: 'good')),
        ]),
        const SizedBox(height: 10),
        Row(children: [
          Expanded(child: _Kpi('Needed you', '$needs', 'Flagged for a human', tone: 'warn')),
          const SizedBox(width: 10),
          Expanded(child: _Kpi('Gone quiet', '$quietTotal', '$quietPct% silent 7+ days')),
        ]),
        const SizedBox(height: 22),

        // ── 14-day volume ─────────────────────────────────────────────
        const SectionLabel('Chats · last 14 days'),
        SoftPanel(
          padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Text('$total',
                  style: const TextStyle(
                      fontSize: 30,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -1)),
              const SizedBox(width: 6),
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text('total',
                    style: TextStyle(
                        fontSize: 12.5,
                        color: scheme.onSurface.withValues(alpha: 0.55))),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                decoration: BoxDecoration(
                  color: (up ? VeloSalesTheme.green : VeloSalesTheme.gold)
                      .withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  '${up ? '▲' : '▼'} ${(d['delta'] as int).abs()}% vs prior wk',
                  style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w800,
                      color: up ? VeloSalesTheme.greenDark : VeloSalesTheme.gold),
                ),
              ),
            ]),
            const SizedBox(height: 10),
            SizedBox(
              height: 132,
              child: CustomPaint(
                painter: _LinePainter(
                  values: vol,
                  labels: labels,
                  line: scheme.primary,
                  grid: scheme.outline,
                  text: scheme.onSurface.withValues(alpha: 0.45),
                ),
                size: Size.infinite,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              '${d['last7']} chats in the last 7 days · peak ${_pad(d['peakH'] as int)}:00.',
              style: TextStyle(
                  fontSize: 11.5,
                  color: scheme.onSurface.withValues(alpha: 0.55)),
            ),
          ]),
        ),
        const SizedBox(height: 22),

        // ── who answered + peak hours ─────────────────────────────────
        const SectionLabel('Who answered'),
        SoftPanel(
          child: Row(children: [
            _Donut(rate: rate, size: 112),
            const SizedBox(width: 16),
            Expanded(
              child: Column(children: [
                _Legend(
                    color: VeloSalesTheme.green,
                    label: 'Answered by Velo',
                    value: '${total - needs}'),
                const SizedBox(height: 10),
                _Legend(
                    color: scheme.primary.withValues(alpha: 0.35),
                    label: 'Passed to you',
                    value: '$needs'),
              ]),
            ),
          ]),
        ),
        const SizedBox(height: 22),

        const SectionLabel('Peak hours'),
        SoftPanel(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SizedBox(
              height: 78,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  for (var i = 0; i < 24; i++)
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 1.5),
                        child: AnimatedContainer(
                          duration: Duration(milliseconds: 320 + i * 12),
                          height: math.max(4, (hours[i] / hmax) * 78),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(4),
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [
                                scheme.primary,
                                scheme.primary.withValues(alpha: 0.55),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Text('00 → 23. Your customers’ clock — staff the rush.',
                style: TextStyle(
                    fontSize: 11.5,
                    color: scheme.onSurface.withValues(alpha: 0.55))),
          ]),
        ),
        const SizedBox(height: 22),

        // ── the inactivity record ─────────────────────────────────────
        SectionLabel('Inactivity record',
            trailing: Text('$quietTotal quiet',
                style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w700,
                    color: scheme.onSurface.withValues(alpha: 0.5)))),
        SoftPanel(
          padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(
              'Customers whose last message is 7 days old or more. A quiet customer is not a lost one — most just need a reason to come back.',
              style: TextStyle(
                  fontSize: 13,
                  height: 1.5,
                  color: scheme.onSurface.withValues(alpha: 0.62)),
            ),
            const SizedBox(height: 12),
            Wrap(spacing: 8, runSpacing: 8, children: [
              _Band('Cooling · 7–13d', d['cooling'] as int, VeloSalesTheme.gold),
              _Band('Cold · 14–29d', d['cold'] as int, const Color(0xFFEA8A2E)),
              _Band('Lost · 30d+', d['lost'] as int, VeloSalesTheme.red),
            ]),
            const SizedBox(height: 14),
            if ((d['quiet'] as List).isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 10),
                child: Text('Nobody has gone quiet. Every conversation is under a week old.',
                    style: TextStyle(
                        fontSize: 13,
                        color: scheme.onSurface.withValues(alpha: 0.62))),
              )
            else
              for (final q in (d['quiet'] as List)) ...[
                _QuietRow(
                  row: q as Map<String, dynamic>,
                  onNudge: () => _nudge(q),
                ),
                const Divider(height: 18),
              ],
            Text(
              'Counted from your $total most recent conversations. Nudge opens WhatsApp with a message you can edit before sending.',
              style: TextStyle(
                  fontSize: 11.5,
                  height: 1.45,
                  color: scheme.onSurface.withValues(alpha: 0.5)),
            ),
          ]),
        ),
        const SizedBox(height: 22),

        // ── why humans were needed ────────────────────────────────────
        const SectionLabel('Top reasons humans were needed'),
        SoftPanel(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(
              'Fix these in your catalog or FAQs and the AI handles more alone.',
              style: TextStyle(
                  fontSize: 13,
                  height: 1.5,
                  color: scheme.onSurface.withValues(alpha: 0.62)),
            ),
            const SizedBox(height: 12),
            if ((d['top'] as List).isEmpty)
              Text('No flags yet — when the AI is unsure, the reason shows up here.',
                  style: TextStyle(
                      fontSize: 13,
                      color: scheme.onSurface.withValues(alpha: 0.62)))
            else
              for (final e in (d['top'] as List))
                _ReasonBar(
                  label: (e as MapEntry<String, int>).key,
                  count: e.value,
                  max: _maxInt((d['top'] as List)
                      .map((x) => (x as MapEntry<String, int>).value)
                      .toList()),
                ),
          ]),
        ),
      ],
    );
  }
}

class _Kpi extends StatelessWidget {
  final String label;
  final String value;
  final String sub;
  final String? tone; // 'good' | 'warn'
  const _Kpi(this.label, this.value, this.sub, {this.tone});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final color = tone == 'good'
        ? VeloSalesTheme.greenDark
        : tone == 'warn'
            ? VeloSalesTheme.gold
            : scheme.onSurface;
    return SoftPanel(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label.toUpperCase(),
            style: TextStyle(
                fontSize: 9.5,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.8,
                color: scheme.onSurface.withValues(alpha: 0.45))),
        const SizedBox(height: 4),
        Text(value,
            style: TextStyle(
                fontSize: 26,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.8,
                height: 1.15,
                color: color)),
        const SizedBox(height: 2),
        Text(sub,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
                fontSize: 11,
                color: scheme.onSurface.withValues(alpha: 0.55))),
      ]),
    );
  }
}

class _Band extends StatelessWidget {
  final String label;
  final int count;
  final Color color;
  const _Band(this.label, this.count, this.color);

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: scheme.outline),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 7),
        Text('$count',
            style:
                const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800)),
        const SizedBox(width: 6),
        Text(label,
            style: TextStyle(
                fontSize: 11.5,
                color: scheme.onSurface.withValues(alpha: 0.6))),
      ]),
    );
  }
}

class _QuietRow extends StatelessWidget {
  final Map<String, dynamic> row;
  final VoidCallback onNudge;
  const _QuietRow({required this.row, required this.onNudge});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final days = row['days'] as int;
    final pillColor = days >= 30
        ? VeloSalesTheme.red
        : days >= 14
            ? VeloSalesTheme.gold
            : scheme.primary;
    final msg = '${row['last_message'] ?? '—'}';
    return Row(children: [
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(
              (row['customer_name'] ?? row['customer_number'] ?? 'Customer')
                  .toString(),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700)),
          const SizedBox(height: 3),
          Text(msg.length > 64 ? '${msg.substring(0, 64)}…' : msg,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                  fontSize: 12,
                  color: scheme.onSurface.withValues(alpha: 0.55))),
        ]),
      ),
      const SizedBox(width: 10),
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: pillColor.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text('$days d',
            style: TextStyle(
                fontSize: 10.5,
                fontWeight: FontWeight.w800,
                color: pillColor)),
      ),
      const SizedBox(width: 6),
      TextButton(
        onPressed: onNudge,
        style: TextButton.styleFrom(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            minimumSize: const Size(0, 34),
            tapTargetSize: MaterialTapTargetSize.shrinkWrap),
        child: const Text('Nudge', style: TextStyle(fontSize: 12.5)),
      ),
    ]);
  }
}

class _ReasonBar extends StatelessWidget {
  final String label;
  final int count;
  final int max;
  const _ReasonBar({required this.label, required this.count, required this.max});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(
            child: Text(label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 12.5)),
          ),
          const SizedBox(width: 8),
          Text('$count',
              style:
                  const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800)),
        ]),
        const SizedBox(height: 5),
        ClipRRect(
          borderRadius: BorderRadius.circular(99),
          child: LinearProgressIndicator(
            value: max == 0 ? 0 : count / max,
            minHeight: 8,
            backgroundColor: scheme.surfaceContainerLowest,
            valueColor: const AlwaysStoppedAnimation(VeloSalesTheme.green),
          ),
        ),
      ]),
    );
  }
}

class _Legend extends StatelessWidget {
  final Color color;
  final String label;
  final String value;
  const _Legend({required this.color, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Row(children: [
      Container(
        width: 9,
        height: 9,
        decoration:
            BoxDecoration(color: color, borderRadius: BorderRadius.circular(3)),
      ),
      const SizedBox(width: 8),
      Expanded(
        child: Text(label,
            style: TextStyle(
                fontSize: 12.5,
                color: scheme.onSurface.withValues(alpha: 0.65))),
      ),
      Text(value,
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
    ]);
  }
}

/// The AI-vs-you ring. The empty arc is a neutral lilac — a chat that needed a
/// human is not a failure, so it never wears the error red.
class _Donut extends StatelessWidget {
  final int rate;
  final double size;
  const _Donut({required this.rate, required this.size});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SizedBox(
      width: size,
      height: size,
      child: TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: rate / 100),
        duration: const Duration(milliseconds: 700),
        curve: Curves.easeOutCubic,
        builder: (_, v, _) => Stack(alignment: Alignment.center, children: [
          SizedBox(
            width: size,
            height: size,
            child: CircularProgressIndicator(
              value: v,
              strokeWidth: 14,
              backgroundColor: scheme.primary.withValues(alpha: 0.18),
              valueColor:
                  const AlwaysStoppedAnimation(VeloSalesTheme.green),
              strokeCap: StrokeCap.round,
            ),
          ),
          Column(mainAxisSize: MainAxisSize.min, children: [
            Text('$rate%',
                style: const TextStyle(
                    fontSize: 23,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.8)),
            Text('BY AI',
                style: TextStyle(
                    fontSize: 8.5,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.8,
                    color: scheme.onSurface.withValues(alpha: 0.45))),
          ]),
        ]),
      ),
    );
  }
}

/// The 14-day line, drawn by hand: no chart package, and the same shape the web
/// uses (smooth line + soft fill + four gridlines).
class _LinePainter extends CustomPainter {
  final List<int> values;
  final List<String> labels;
  final Color line;
  final Color grid;
  final Color text;

  _LinePainter({
    required this.values,
    required this.labels,
    required this.line,
    required this.grid,
    required this.text,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (values.isEmpty) return;
    const bottom = 18.0;
    const left = 4.0;
    final w = size.width - left;
    final h = size.height - bottom;
    final maxV = math.max(1, _maxInt(values));
    final step = w / math.max(1, values.length - 1);

    final gridPaint = Paint()
      ..color = grid.withValues(alpha: 0.7)
      ..strokeWidth = 1;
    for (var i = 0; i <= 3; i++) {
      final y = h - (h * i / 3);
      canvas.drawLine(Offset(left, y), Offset(size.width, y), gridPaint);
    }

    final pts = <Offset>[
      for (var i = 0; i < values.length; i++)
        Offset(left + step * i, h - (values[i] / maxV) * (h - 8)),
    ];

    final path = Path()..moveTo(pts.first.dx, pts.first.dy);
    for (var i = 1; i < pts.length; i++) {
      final prev = pts[i - 1];
      final p = pts[i];
      final mid = (prev.dx + p.dx) / 2;
      path.cubicTo(mid, prev.dy, mid, p.dy, p.dx, p.dy);
    }

    final fill = Path.from(path)
      ..lineTo(pts.last.dx, h)
      ..lineTo(pts.first.dx, h)
      ..close();
    canvas.drawPath(
      fill,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [line.withValues(alpha: 0.20), line.withValues(alpha: 0.0)],
        ).createShader(Rect.fromLTWH(0, 0, size.width, h)),
    );
    canvas.drawPath(
      path,
      Paint()
        ..color = line
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.4
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );

    final dot = pts.last;
    canvas.drawCircle(dot, 7, Paint()..color = line.withValues(alpha: 0.25));
    canvas.drawCircle(dot, 4, Paint()..color = line);
    canvas.drawCircle(dot, 2, Paint()..color = Colors.white);

    // Four date labels only — 14 would collide on a phone.
    for (var i = 0; i < labels.length; i += 4) {
      final tp = TextPainter(
        text: TextSpan(
            text: labels[i],
            style: TextStyle(fontSize: 9.5, color: text, fontFamily: 'Manrope')),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas,
          Offset(math.min(left + step * i, size.width - tp.width), h + 5));
    }
  }

  @override
  bool shouldRepaint(_LinePainter old) =>
      old.values != values || old.line != line || old.grid != grid;
}

class _InsightsSkeleton extends StatelessWidget {
  const _InsightsSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(padding: const EdgeInsets.all(16), children: const [
      SizedBox(height: 4),
      Row(children: [
        Expanded(child: Skeleton(height: 74, radius: 16)),
        SizedBox(width: 10),
        Expanded(child: Skeleton(height: 74, radius: 16)),
      ]),
      SizedBox(height: 10),
      Row(children: [
        Expanded(child: Skeleton(height: 74, radius: 16)),
        SizedBox(width: 10),
        Expanded(child: Skeleton(height: 74, radius: 16)),
      ]),
      SizedBox(height: 20),
      Skeleton(height: 180, radius: 18),
      SizedBox(height: 20),
      Skeleton(height: 130, radius: 18),
      SizedBox(height: 20),
      Skeleton(height: 220, radius: 18),
    ]);
  }
}
