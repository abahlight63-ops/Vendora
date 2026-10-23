// ── lib/screens/home_screen.dart ──────────────────────────────────
// WHAT: the Overview — the phone's copy of the web's Dashboard.jsx.
//
// Same order as the browser: greeting + bot status + the two actions, the
// trial strip, four real KPIs, Activity, Reply mix, Needs your attention, the
// first-15-minutes checklist (or Recent chats once it is done), and Refer &
// Earn. No invented numbers, no fake charts: every value is a real API answer,
// and a failed load is a retry wall, never a page of zeroes.
//
// The phone is allowed one thing the browser is not: depth. Cards tilt toward
// the thumb and rise on entry (lib/depth.dart). Nothing loops.
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../depth.dart';
import '../format.dart';
import '../motion.dart';
import '../theme.dart';
import '../widgets/brand_ui.dart';
import '../widgets/error_art.dart';
import 'insights_screen.dart';
import 'profile_screen.dart';
import 'refer_earn_screen.dart';

class HomeScreen extends StatefulWidget {
  /// Jumps to another tab in the shell (0 Overview · 1 Inbox · 2 Catalog ·
  /// 3 Connect · 4 VeloSales Ai · 5 Billing).
  final ValueChanged<int> onGoTab;

  const HomeScreen({super.key, required this.onGoTab});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic> _biz = const {};
  Map<String, dynamic> _bill = const {};
  Map<String, dynamic> _channels = const {};
  List<Map<String, dynamic>> _convos = const [];
  List<dynamic> _products = const [];
  bool _guideOff = false;

  static const _guideKey = 'velosalesai_guide_off';

  @override
  void initState() {
    super.initState();
    _load();
    SharedPreferences.getInstance().then((p) {
      if (!mounted) return;
      setState(() => _guideOff = p.getBool(_guideKey) ?? false);
    });
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      // Five parallel calls, one wait — the same shape as the web dashboard.
      final r = await Future.wait<dynamic>([
        ApiClient.instance.me(),
        ApiClient.instance.products(),
        ApiClient.instance.conversations(),
        ApiClient.instance.billing(),
        ApiClient.instance.channels(),
      ]);
      if (!mounted) return;
      final me = (r[0] as Map).cast<String, dynamic>();
      final convos = List<dynamic>.from(r[2] as List)
          .map((e) => (e as Map).cast<String, dynamic>())
          .toList()
        ..sort((a, b) => _stamp(b).compareTo(_stamp(a)));
      setState(() {
        _biz = (me['business'] as Map?)?.cast<String, dynamic>() ?? const {};
        _products = List<dynamic>.from(r[1] as List);
        _convos = convos;
        _bill = (r[3] as Map).cast<String, dynamic>();
        _channels = (r[4] as Map).cast<String, dynamic>();
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'We could not reach your shop. Check your connection and try again.';
      });
    }
  }

  int _stamp(Map<String, dynamic> c) {
    final raw = c['last_message_at'] ?? c['updated_at'] ?? c['created_at'];
    return DateTime.tryParse('${raw ?? ''}')?.millisecondsSinceEpoch ?? 0;
  }

  Future<void> _dismissGuide() async {
    setState(() => _guideOff = true);
    try {
      final p = await SharedPreferences.getInstance();
      await p.setBool(_guideKey, true);
    } catch (_) {}
  }

  Future<void> _openProfile() async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const ProfileScreen()),
    );
    if (mounted) _load();
  }

  void _openInsights() {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const InsightsScreen()),
    );
  }

  void _openRefer() {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const ReferEarnScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const _HomeSkeleton();
    if (_error != null) {
      final offline = ApiClient.offline.value ||
          _error!.toLowerCase().contains('offline') ||
          _error!.toLowerCase().contains('connection');
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(24, 36, 24, 28),
        children: [
          Center(child: ErrorArt(offline: offline, size: 128)),
          const SizedBox(height: 8),
          const Text(
            "Couldn't load overview",
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, letterSpacing: -0.3),
          ),
          const SizedBox(height: 6),
          Text(
            _error!,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              height: 1.5,
              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.65),
            ),
          ),
          const SizedBox(height: 16),
          Center(
            child: FilledButton.icon(
              onPressed: _load,
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text('Try again'),
            ),
          ),
        ],
      );
    }

    final scheme = Theme.of(context).colorScheme;
    final name = '${_biz['name'] ?? _biz['business_name'] ?? ''}'.trim();
    final first = name.isEmpty ? 'there' : name.split(RegExp(r'\s+')).first;
    final needs = _convos
        .where((c) => c['needs_human'] == true || c['needs_human'] == 1)
        .toList();
    final pct = _convos.isEmpty
        ? 100
        : (((_convos.length - needs.length) / _convos.length) * 100).round();
    final needsPct =
        _convos.isEmpty ? 0 : ((needs.length / _convos.length) * 100).round();
    final catalogPct = math.max(0, 100 - pct - needsPct).toInt();
    final days = _sevenDays();
    final waLive = ((_channels['whatsapp'] as Map?)?['live'] == true);
    final tgOn = ((_channels['telegram'] as Map?)?['connected'] == true);
    final live = waLive || tgOn;
    final botOn = _biz['bot_enabled'] != false;
    final trialLeft = _bill['status'] == 'trialing'
        ? trialDaysLeft(_bill['trial_ends'])
        : null;
    final steps = _steps(live);
    final doneCount = steps.where((s) => s.done).length;
    final showGuide = !_guideOff && doneCount < steps.length;

    return RefreshIndicator(
      onRefresh: _load,
      color: scheme.primary,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
        children: [
          // ── hero: greeting, truth about the bot, two actions ──
          DepthReveal(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${greeting()}, $first.',
                  style: TextStyle(
                    fontSize: 27,
                    height: 1.14,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.8,
                    color: scheme.onSurface,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  botOn
                      ? (live
                          ? 'Your bot is live and answering customers.'
                          : 'Add a product and connect a channel to go live.')
                      : 'Your bot is paused — switch it back on in Settings.',
                  style: TextStyle(
                    fontSize: 14,
                    height: 1.45,
                    color: scheme.onSurface.withValues(alpha: 0.62),
                  ),
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    _StatusPill(
                      live: live,
                      paused: !botOn,
                      label: !botOn ? 'Bot paused' : (live ? 'Bot online' : 'Bot ready'),
                    ),
                    FilledButton.icon(
                      onPressed: () => widget.onGoTab(4),
                      style: _smallButton,
                      icon: const Icon(Icons.smart_toy_outlined, size: 17),
                      label: const Text('Test bot'),
                    ),
                    OutlinedButton.icon(
                      onPressed: () => widget.onGoTab(2),
                      style: _smallGhost,
                      icon: const Icon(Icons.add_rounded, size: 18),
                      label: const Text('Add product'),
                    ),
                  ],
                ),
              ],
            ),
          ),

          if (trialLeft != null) ...[
            const SizedBox(height: 14),
            DepthReveal(
              delayMs: 50,
              child: _TrialStrip(
                days: trialLeft,
                onTap: () => widget.onGoTab(5),
              ),
            ),
          ],

          const SizedBox(height: 18),

          // ── four real KPIs ──
          DepthReveal(delayMs: 90, child: _StatsGrid(
            convos: _convos.length,
            products: _products.length,
            pct: pct,
            needs: needs.length,
            days: days,
            onInbox: () => widget.onGoTab(1),
            onCatalog: () => widget.onGoTab(2),
          )),

          const SizedBox(height: 14),

          // ── Activity ──
          DepthReveal(
            delayMs: 130,
            child: _ActivityCard(days: days, onTap: _openInsights),
          ),

          const SizedBox(height: 14),

          // ── Reply mix ──
          DepthReveal(
            delayMs: 160,
            child: _ReplyMixCard(
              total: _convos.length,
              handled: pct,
              catalog: catalogPct,
              needs: needsPct,
              onTap: _openInsights,
            ),
          ),

          const SizedBox(height: 14),

          // ── Needs your attention ──
          DepthReveal(
            delayMs: 190,
            child: _ThreadsCard(
              title: 'Needs your attention',
              action: 'Inbox',
              emptyTitle: 'Nothing needs you right now',
              emptyBody: 'Flagged chats land here when the bot hands off.',
              emptyIcon: Icons.check_circle_outline_rounded,
              rows: needs.take(3).toList(),
              warn: true,
              onAction: () => widget.onGoTab(1),
              onRow: (_) => widget.onGoTab(1),
            ),
          ),

          const SizedBox(height: 14),

          // ── checklist until it is done, then recent chats ──
          DepthReveal(
            delayMs: 220,
            child: showGuide
                ? _GuideCard(
                    steps: steps,
                    done: doneCount,
                    onDismiss: _dismissGuide,
                    onStep: (s) {
                      if (s.profile) {
                        _openProfile();
                      } else if (s.tab != null) {
                        widget.onGoTab(s.tab!);
                      }
                    },
                  )
                : _ThreadsCard(
                    title: 'Recent chats',
                    action: 'Inbox',
                    emptyTitle: 'No chats yet',
                    emptyBody:
                        'Share your WhatsApp number — conversations land here.',
                    emptyIcon: Icons.forum_outlined,
                    rows: _convos.take(3).toList(),
                    warn: false,
                    onAction: () => widget.onGoTab(1),
                    onRow: (_) => widget.onGoTab(1),
                  ),
          ),

          const SizedBox(height: 14),
          _ReferCard(onOpen: _openRefer),

          const SizedBox(height: 8),
          Center(
            child: Text(
              'AI replies 24/7 — even at 2am.',
              style: TextStyle(
                fontSize: 11,
                color: scheme.onSurface.withValues(alpha: 0.35),
              ),
            ),
          ),
        ],
      ),
    );
  }

  static final ButtonStyle _smallButton = FilledButton.styleFrom(
    minimumSize: const Size(0, 40),
    padding: const EdgeInsets.symmetric(horizontal: 15),
    textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
  );

  static final ButtonStyle _smallGhost = OutlinedButton.styleFrom(
    minimumSize: const Size(0, 40),
    padding: const EdgeInsets.symmetric(horizontal: 15),
    textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
  );

  /// Seven buckets, oldest → today. Real timestamps only; a conversation with
  /// no parseable date is left out rather than guessed into today.
  List<int> _sevenDays() {
    final days = List<int>.filled(7, 0);
    final now = DateTime.now();
    for (final c in _convos) {
      final raw = c['updated_at'] ?? c['created_at'];
      final t = DateTime.tryParse('${raw ?? ''}')?.toLocal();
      if (t == null) continue;
      final d = DateTime(now.year, now.month, now.day)
          .difference(DateTime(t.year, t.month, t.day))
          .inDays;
      if (d >= 0 && d < 7) days[6 - d] += 1;
    }
    return days;
  }

  List<_Step> _steps(bool live) => [
        _Step(
          done: _products.isNotEmpty,
          label: 'Add your first product',
          hint: 'The AI only quotes your catalog',
          tab: 2,
        ),
        _Step(
          done: live,
          label: 'Connect your channels',
          hint: 'WhatsApp + Telegram — TEST to LIVE',
          tab: 3,
        ),
        _Step(
          done: _convos.isNotEmpty,
          label: 'Test like a customer',
          hint: 'Ask prices in Velo',
          tab: 4,
        ),
        _Step(
          done: '${_biz['hours'] ?? ''}'.isNotEmpty &&
              '${_biz['owner_number'] ?? ''}'.isNotEmpty,
          label: 'Set hours + owner number',
          hint: 'So closed-hours replies feel human',
          profile: true,
        ),
        _Step(
          done: _convos.isNotEmpty,
          label: 'Get your first real chat',
          hint: 'Share your WhatsApp number',
          tab: 1,
        ),
      ];
}

class _Step {
  final bool done;
  final String label;
  final String hint;
  final int? tab;
  final bool profile;

  const _Step({
    required this.done,
    required this.label,
    required this.hint,
    this.tab,
    this.profile = false,
  });
}

// ── hero status ─────────────────────────────────────────────────────
class _StatusPill extends StatelessWidget {
  final bool live;
  final bool paused;
  final String label;

  const _StatusPill({
    required this.live,
    required this.paused,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final Color fg;
    final Color bg;
    final Color line;
    final Color dot;
    if (paused) {
      fg = VeloSalesTheme.goldColor(context);
      bg = VeloSalesTheme.gold.withValues(alpha: dark ? 0.16 : 0.10);
      line = VeloSalesTheme.gold.withValues(alpha: 0.35);
      dot = VeloSalesTheme.goldColor(context);
    } else if (live) {
      fg = dark ? const Color(0xFF34D399) : const Color(0xFF047857);
      bg = dark
          ? const Color(0xFF34D399).withValues(alpha: 0.12)
          : const Color(0xFFD1FAE5);
      line = const Color(0xFF34D399).withValues(alpha: 0.30);
      dot = const Color(0xFF10B981);
    } else {
      fg = scheme.onSurface.withValues(alpha: 0.62);
      bg = scheme.onSurface.withValues(alpha: 0.04);
      line = scheme.outline;
      dot = scheme.onSurface.withValues(alpha: 0.35);
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: line),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(shape: BoxShape.circle, color: dot),
          ),
          const SizedBox(width: 7),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: fg,
            ),
          ),
        ],
      ),
    );
  }
}

// ── trial strip ────────────────────────────────────────────────────
class _TrialStrip extends StatelessWidget {
  final int days;
  final VoidCallback onTap;

  const _TrialStrip({required this.days, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final gold = VeloSalesTheme.goldColor(context);
    return Container(
      padding: const EdgeInsets.fromLTRB(13, 11, 8, 11),
      decoration: BoxDecoration(
        color: VeloSalesTheme.gold.withValues(alpha: dark ? 0.12 : 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: VeloSalesTheme.gold.withValues(alpha: 0.30)),
      ),
      child: Row(
        children: [
          Icon(Icons.schedule_rounded, size: 17, color: gold),
          const SizedBox(width: 9),
          Expanded(
            child: Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text: '$days day${days == 1 ? '' : 's'} of Pro trial left. ',
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  const TextSpan(
                    text: 'Keep Pro sync, or stay free forever with manual catalog.',
                  ),
                ],
              ),
              style: TextStyle(
                fontSize: 12.5,
                height: 1.42,
                color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.82),
              ),
            ),
          ),
          TextButton(
            onPressed: onTap,
            style: TextButton.styleFrom(
              minimumSize: const Size(0, 34),
              padding: const EdgeInsets.symmetric(horizontal: 9),
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: const Text('Billing'),
          ),
        ],
      ),
    );
  }
}

// ── KPIs ───────────────────────────────────────────────────────────
class _StatsGrid extends StatelessWidget {
  final int convos;
  final int products;
  final int pct;
  final int needs;
  final List<int> days;
  final VoidCallback onInbox;
  final VoidCallback onCatalog;

  const _StatsGrid({
    required this.convos,
    required this.products,
    required this.pct,
    required this.needs,
    required this.days,
    required this.onInbox,
    required this.onCatalog,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, c) {
      final two = c.maxWidth >= 330;
      final w = two ? (c.maxWidth - 12) / 2 : c.maxWidth;
      return Wrap(
        spacing: 12,
        runSpacing: 12,
        children: [
          SizedBox(
            width: w,
            child: _StatCard(
              label: 'Conversations',
              value: '$convos',
              sub: 'Last 7 days',
              spark: days,
              onTap: onInbox,
            ),
          ),
          SizedBox(
            width: w,
            child: _StatCard(
              label: 'Products live',
              value: '$products',
              sub: products == 0 ? 'Add your first one' : 'In your catalog',
              onTap: onCatalog,
            ),
          ),
          SizedBox(
            width: w,
            child: _StatCard(
              label: 'Handled by AI',
              value: '$pct%',
              sub: 'No human needed',
              good: pct >= 80,
              onTap: onInbox,
            ),
          ),
          SizedBox(
            width: w,
            child: _StatCard(
              label: 'Needs you',
              value: '$needs',
              sub: needs == 0 ? 'All clear' : 'Flagged chats',
              warn: needs > 0,
              onTap: onInbox,
            ),
          ),
        ],
      );
    });
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final String sub;
  final bool good;
  final bool warn;
  final List<int>? spark;
  final VoidCallback onTap;

  const _StatCard({
    required this.label,
    required this.value,
    required this.sub,
    this.good = false,
    this.warn = false,
    this.spark,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final tone = good
        ? VeloSalesTheme.successColor(context)
        : warn
            ? VeloSalesTheme.goldColor(context)
            : scheme.onSurface;
    return SizedBox(
      height: 124,
      child: DepthCard(
        onTap: onTap,
        padding: const EdgeInsets.all(15),
        semanticLabel: '$label: $value',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.1,
                color: scheme.onSurface.withValues(alpha: 0.58),
              ),
            ),
            const Spacer(),
            Text(
              value,
              style: TextStyle(
                fontSize: 30,
                height: 1,
                fontWeight: FontWeight.w700,
                letterSpacing: -1,
                color: tone,
              ),
            ),
            const SizedBox(height: 5),
            Row(
              children: [
                Expanded(
                  child: Text(
                    sub,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 11.8,
                      color: scheme.onSurface.withValues(alpha: 0.40),
                    ),
                  ),
                ),
                if (spark != null)
                  SizedBox(
                    width: 62,
                    height: 24,
                    child: CustomPaint(
                      painter: _SparkPainter(
                        data: spark!,
                        line: scheme.primary,
                        fill: scheme.primary.withValues(alpha: dark ? 0.18 : 0.10),
                        faint: scheme.onSurface.withValues(alpha: 0.18),
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ── Activity ───────────────────────────────────────────────────────
class _ActivityCard extends StatelessWidget {
  final List<int> days;
  final VoidCallback onTap;

  const _ActivityCard({required this.days, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final maxV = math.max(1, days.fold<int>(0, math.max));
    return DepthCard(
      onTap: onTap,
      padding: const EdgeInsets.all(17),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _CardHead(
            title: 'Activity',
            sub: 'Chats per day, last 7 days',
            action: 'Insights',
            onAction: onTap,
          ),
          const SizedBox(height: 14),
          SizedBox(
            height: 132,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                for (var i = 0; i < 7; i++)
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 3),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          Expanded(
                            child: Align(
                              alignment: Alignment.bottomCenter,
                              child: TweenAnimationBuilder<double>(
                                tween: Tween<double>(
                                  begin: 0,
                                  end: days[i] / maxV,
                                ),
                                duration: const Duration(milliseconds: 520),
                                curve: Curves.easeOutCubic,
                                builder: (_, f, _) => Container(
                                  width: 26,
                                  height: math.max(6, 112 * f),
                                  decoration: BoxDecoration(
                                    color: i == 6
                                        ? scheme.primary
                                        : (dark
                                            ? VeloSalesTheme.skyDark
                                            : VeloSalesTheme.purpleLine),
                                    borderRadius: const BorderRadius.vertical(
                                      top: Radius.circular(8),
                                      bottom: Radius.circular(4),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 7),
                          Text(
                            _dayLabel(i),
                            style: TextStyle(
                              fontSize: 10.5,
                              fontWeight: FontWeight.w600,
                              color: scheme.onSurface.withValues(alpha: 0.38),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _dayLabel(int i) {
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    final d = DateTime.now().subtract(Duration(days: 6 - i));
    return names[d.weekday % 7];
  }
}

// ── Reply mix ──────────────────────────────────────────────────────
class _ReplyMixCard extends StatelessWidget {
  final int total;
  final int handled;
  final int catalog;
  final int needs;
  final VoidCallback onTap;

  const _ReplyMixCard({
    required this.total,
    required this.handled,
    required this.catalog,
    required this.needs,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return DepthCard(
      onTap: onTap,
      padding: const EdgeInsets.all(17),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: _CardHead(
                  title: 'Reply mix',
                  sub: 'How your chats are handled',
                  action: null,
                  onAction: null,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                decoration: BoxDecoration(
                  color: scheme.primaryContainer,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  'Live',
                  style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                    color: scheme.primary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Center(
            child: SizedBox(
              width: 150,
              height: 150,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  CustomPaint(
                    size: const Size(150, 150),
                    painter: _DonutPainter(
                      handled: handled,
                      catalog: catalog,
                      needs: needs,
                      purple: scheme.primary,
                      sky: VeloSalesTheme.skyColor(context),
                      faint: scheme.onSurface.withValues(alpha: 0.34),
                      track: scheme.outline,
                    ),
                  ),
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '$total',
                        style: TextStyle(
                          fontSize: 23,
                          height: 1,
                          fontWeight: FontWeight.w700,
                          letterSpacing: -0.5,
                          color: scheme.onSurface,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Chats',
                        style: TextStyle(
                          fontSize: 10.5,
                          color: scheme.onSurface.withValues(alpha: 0.55),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(
                child: _Legend(
                  color: scheme.primary,
                  pct: handled,
                  label: 'AI handled',
                ),
              ),
              Expanded(
                child: _Legend(
                  color: VeloSalesTheme.skyColor(context),
                  pct: catalog,
                  label: 'Catalog',
                ),
              ),
              Expanded(
                child: _Legend(
                  color: scheme.onSurface.withValues(alpha: 0.34),
                  pct: needs,
                  label: 'Human',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Legend extends StatelessWidget {
  final Color color;
  final int pct;
  final String label;

  const _Legend({required this.color, required this.pct, required this.label});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 7,
              height: 7,
              decoration: BoxDecoration(shape: BoxShape.circle, color: color),
            ),
            const SizedBox(width: 5),
            Text(
              '$pct%',
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
                color: scheme.onSurface,
              ),
            ),
          ],
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: TextStyle(
            fontSize: 10.5,
            color: scheme.onSurface.withValues(alpha: 0.52),
          ),
        ),
      ],
    );
  }
}

// ── thread cards ───────────────────────────────────────────────────
class _ThreadsCard extends StatelessWidget {
  final String title;
  final String action;
  final String emptyTitle;
  final String emptyBody;
  final IconData emptyIcon;
  final List<Map<String, dynamic>> rows;
  final bool warn;
  final VoidCallback onAction;
  final ValueChanged<Map<String, dynamic>> onRow;

  const _ThreadsCard({
    required this.title,
    required this.action,
    required this.emptyTitle,
    required this.emptyBody,
    required this.emptyIcon,
    required this.rows,
    required this.warn,
    required this.onAction,
    required this.onRow,
  });

  @override
  Widget build(BuildContext context) {
    return DepthCard(
      padding: const EdgeInsets.fromLTRB(16, 15, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _CardHead(
            title: title,
            sub: null,
            action: action,
            onAction: onAction,
          ),
          if (rows.isEmpty)
            _EmptyRow(
              icon: emptyIcon,
              title: emptyTitle,
              body: emptyBody,
            )
          else
            for (var i = 0; i < rows.length; i++)
              _ThreadRow(
                row: rows[i],
                warn: warn,
                last: i == rows.length - 1,
                onTap: () => onRow(rows[i]),
              ),
        ],
      ),
    );
  }
}

class _ThreadRow extends StatelessWidget {
  final Map<String, dynamic> row;
  final bool warn;
  final bool last;
  final VoidCallback onTap;

  const _ThreadRow({
    required this.row,
    required this.warn,
    required this.last,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final who = '${row['customer_name'] ?? row['customer_number'] ?? row['wa_id'] ?? 'Customer'}'
        .trim();
    final lastText = '${row['last_message'] ?? row['last_text'] ?? ''}'.trim();
    final at = row['last_message_at'] ?? row['updated_at'] ?? row['created_at'];
    final amber = VeloSalesTheme.goldColor(context);
    final iconColor = warn ? amber : scheme.primary;
    final iconBg = warn
        ? VeloSalesTheme.gold.withValues(alpha: 0.12)
        : scheme.primaryContainer;
    return Pressable(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          border: last
              ? null
              : Border(
                  bottom: BorderSide(
                    color: scheme.onSurface.withValues(alpha: 0.06),
                  ),
                ),
        ),
        child: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(color: iconBg, shape: BoxShape.circle),
              child: Icon(
                warn ? Icons.pan_tool_outlined : Icons.forum_outlined,
                size: 16,
                color: iconColor,
              ),
            ),
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    who.isEmpty ? 'Customer' : who,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                      color: scheme.onSurface,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    lastText.isEmpty ? 'No messages yet' : lastText,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 12,
                      height: 1.35,
                      color: scheme.onSurface.withValues(alpha: 0.56),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Text(
              fmtTime(at),
              style: TextStyle(
                fontSize: 10.5,
                color: scheme.onSurface.withValues(alpha: 0.34),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyRow extends StatelessWidget {
  final IconData icon;
  final String title;
  final String body;

  const _EmptyRow({required this.icon, required this.title, required this.body});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(0, 12, 0, 14),
      child: Column(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: scheme.primaryContainer,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 20, color: scheme.primary),
          ),
          const SizedBox(height: 9),
          Text(
            title,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w700,
              color: scheme.onSurface,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            body,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12,
              height: 1.45,
              color: scheme.onSurface.withValues(alpha: 0.55),
            ),
          ),
        ],
      ),
    );
  }
}

// ── checklist ──────────────────────────────────────────────────────
class _GuideCard extends StatelessWidget {
  final List<_Step> steps;
  final int done;
  final VoidCallback onDismiss;
  final ValueChanged<_Step> onStep;

  const _GuideCard({
    required this.steps,
    required this.done,
    required this.onDismiss,
    required this.onStep,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final remaining = steps.where((s) => !s.done).toList();
    return DepthCard(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'First 15 minutes',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.2,
                    color: scheme.onSurface,
                  ),
                ),
              ),
              TextButton(
                onPressed: onDismiss,
                style: TextButton.styleFrom(
                  minimumSize: const Size(0, 32),
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  foregroundColor: scheme.onSurface.withValues(alpha: 0.52),
                ),
                child: const Text('Dismiss'),
              ),
            ],
          ),
          Text(
            '$done of ${steps.length} done',
            style: TextStyle(
              fontSize: 12.5,
              color: scheme.onSurface.withValues(alpha: 0.55),
            ),
          ),
          const SizedBox(height: 9),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(
              value: steps.isEmpty ? 0 : done / steps.length,
              minHeight: 6,
              backgroundColor: scheme.onSurface.withValues(alpha: 0.08),
              valueColor: AlwaysStoppedAnimation<Color>(scheme.primary),
            ),
          ),
          const SizedBox(height: 6),
          for (final s in remaining)
            Pressable(
              onTap: () => onStep(s),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 9),
                child: Row(
                  children: [
                    Container(
                      width: 26,
                      height: 26,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: scheme.primaryContainer,
                        shape: BoxShape.circle,
                      ),
                      child: Text(
                        '${steps.indexOf(s) + 1}',
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w800,
                          color: scheme.primary,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            s.label,
                            style: TextStyle(
                              fontSize: 13.2,
                              fontWeight: FontWeight.w700,
                              color: scheme.onSurface,
                            ),
                          ),
                          const SizedBox(height: 1),
                          Text(
                            s.hint,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 11.3,
                              color: scheme.onSurface.withValues(alpha: 0.50),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Icon(
                      Icons.chevron_right_rounded,
                      size: 18,
                      color: scheme.onSurface.withValues(alpha: 0.30),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ── Refer & Earn ───────────────────────────────────────────────────
class _ReferCard extends StatefulWidget {
  final VoidCallback onOpen;

  const _ReferCard({required this.onOpen});

  @override
  State<_ReferCard> createState() => _ReferCardState();
}

class _ReferCardState extends State<_ReferCard> {
  Map<String, dynamic>? _r;

  @override
  void initState() {
    super.initState();
    ApiClient.instance.referralStats().then((v) {
      if (mounted) setState(() => _r = v);
    }).catchError((_) {});
  }

  String _naira(dynamic kobo) {
    final v = ((num.tryParse('$kobo') ?? 0) / 100).round().toString();
    final buf = StringBuffer();
    for (var i = 0; i < v.length; i++) {
      if (i > 0 && (v.length - i) % 3 == 0) buf.write(',');
      buf.write(v[i]);
    }
    return '₦$buf';
  }

  Future<void> _share(String code) async {
    final text =
        'I use VeloSales Ai — my WhatsApp shop answers customers 24/7. Start free with my code $code (connect + use it and we BOTH get 14 Pro days free): ${ApiClient.referralUrl(code)}';
    try {
      await launchUrl(
        Uri.parse('https://wa.me/?text=${Uri.encodeComponent(text)}'),
        mode: LaunchMode.externalApplication,
      );
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final r = _r;
    if (r == null) return const SizedBox.shrink();
    final scheme = Theme.of(context).colorScheme;
    final code = '${r['code'] ?? ''}';
    final paying = (r['paying'] as num? ?? 0).toInt();
    final every = (r['milestoneEvery'] as num? ?? 5).toInt();
    final pct = every <= 0 ? 0.0 : (paying % every) / every;
    return DepthCard(
      onTap: widget.onOpen,
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.card_giftcard_outlined, size: 17, color: scheme.primary),
              const SizedBox(width: 7),
              Expanded(
                child: Text(
                  'Refer & Earn',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.2,
                    color: scheme.onSurface,
                  ),
                ),
              ),
              Icon(
                Icons.chevron_right_rounded,
                size: 18,
                color: scheme.onSurface.withValues(alpha: 0.30),
              ),
            ],
          ),
          const SizedBox(height: 5),
          Text(
            'Friends join with your code — you BOTH get 14 Pro days. Every 5th paying friend = ₦500 airtime.',
            style: TextStyle(
              fontSize: 12.2,
              height: 1.4,
              color: scheme.onSurface.withValues(alpha: 0.58),
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: Text(
                  code,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 19,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.5,
                    color: scheme.onSurface,
                  ),
                ),
              ),
              TextButton.icon(
                onPressed: () => _share(code),
                style: TextButton.styleFrom(
                  minimumSize: const Size(0, 34),
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                icon: const Icon(Icons.send_outlined, size: 15),
                label: const Text('Share'),
              ),
            ],
          ),
          const SizedBox(height: 4),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(
              value: pct,
              minHeight: 6,
              backgroundColor: scheme.onSurface.withValues(alpha: 0.08),
              valueColor: AlwaysStoppedAnimation<Color>(scheme.primary),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            '${r['invited'] ?? 0} invited · ${r['qualified'] ?? 0} set up · $paying paying · ${r['nextMilestoneIn'] ?? every} more to ${_naira(r['milestoneAmount'])} airtime',
            maxLines: 2,
            style: TextStyle(
              fontSize: 11,
              height: 1.4,
              color: scheme.onSurface.withValues(alpha: 0.45),
            ),
          ),
        ],
      ),
    );
  }
}

// ── shared bits ────────────────────────────────────────────────────
class _CardHead extends StatelessWidget {
  final String title;
  final String? sub;
  final String? action;
  final VoidCallback? onAction;

  const _CardHead({
    required this.title,
    this.sub,
    this.action,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontSize: 16,
                  height: 1.2,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.2,
                  color: scheme.onSurface,
                ),
              ),
              if (sub != null) ...[
                const SizedBox(height: 3),
                Text(
                  sub!,
                  style: TextStyle(
                    fontSize: 12,
                    color: scheme.onSurface.withValues(alpha: 0.50),
                  ),
                ),
              ],
            ],
          ),
        ),
        if (action != null)
          TextButton(
            onPressed: onAction,
            style: TextButton.styleFrom(
              minimumSize: const Size(0, 32),
              padding: const EdgeInsets.symmetric(horizontal: 6),
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(action!),
                const SizedBox(width: 2),
                const Icon(Icons.arrow_forward_rounded, size: 13),
              ],
            ),
          ),
      ],
    );
  }
}

// ── painters ───────────────────────────────────────────────────────
class _SparkPainter extends CustomPainter {
  final List<int> data;
  final Color line;
  final Color fill;
  final Color faint;

  const _SparkPainter({
    required this.data,
    required this.line,
    required this.fill,
    required this.faint,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (data.isEmpty || size.width <= 0) return;
    final maxV = math.max(1, data.fold<int>(0, math.max));
    final dx = (size.width - 4) / math.max(1, data.length - 1);
    final pts = <Offset>[
      for (var i = 0; i < data.length; i++)
        Offset(2 + dx * i, size.height - 4 - (data[i] / maxV) * (size.height - 10)),
    ];
    final area = Path()
      ..moveTo(pts.first.dx, size.height - 2)
      ..lineTo(pts.first.dx, pts.first.dy);
    for (var i = 1; i < pts.length; i++) {
      area.lineTo(pts[i].dx, pts[i].dy);
    }
    area
      ..lineTo(pts.last.dx, size.height - 2)
      ..close();
    canvas.drawPath(area, Paint()..color = fill);

    final path = Path()..moveTo(pts.first.dx, pts.first.dy);
    for (var i = 1; i < pts.length; i++) {
      path.lineTo(pts[i].dx, pts[i].dy);
    }
    final stroke = Paint()
      ..color = line
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(path, stroke);
    canvas.drawCircle(pts.last, 2.5, Paint()..color = line);
    canvas.drawCircle(pts.last, 5, Paint()..color = faint);
  }

  @override
  bool shouldRepaint(_SparkPainter old) =>
      old.data != data || old.line != line || old.fill != fill || old.faint != faint;
}

class _DonutPainter extends CustomPainter {
  final int handled;
  final int catalog;
  final int needs;
  final Color purple;
  final Color sky;
  final Color faint;
  final Color track;

  const _DonutPainter({
    required this.handled,
    required this.catalog,
    required this.needs,
    required this.purple,
    required this.sky,
    required this.faint,
    required this.track,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final segs = [
      (handled.toDouble(), purple, 54.0),
      (catalog.toDouble(), sky, 42.0),
      (needs.toDouble(), faint, 30.0),
    ];
    for (final s in segs) {
      canvas.drawCircle(
        center,
        s.$3,
        Paint()
          ..color = track.withValues(alpha: 0.55)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 9,
      );
    }
    for (final s in segs) {
      final frac = (s.$1 / 100).clamp(0.0, 0.98);
      if (frac <= 0) continue;
      final rect = Rect.fromCircle(center: center, radius: s.$3);
      canvas.drawArc(
        rect,
        -math.pi / 2,
        frac * 2 * math.pi,
        false,
        Paint()
          ..color = s.$2
          ..style = PaintingStyle.stroke
          ..strokeWidth = 9
          ..strokeCap = StrokeCap.round,
      );
    }
  }

  @override
  bool shouldRepaint(_DonutPainter old) =>
      old.handled != handled ||
      old.catalog != catalog ||
      old.needs != needs ||
      old.purple != purple ||
      old.sky != sky ||
      old.faint != faint ||
      old.track != track;
}

// ── loading ────────────────────────────────────────────────────────
class _HomeSkeleton extends StatelessWidget {
  const _HomeSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 28),
      children: [
        const Skeleton(height: 26, width: 190),
        const SizedBox(height: 8),
        const Skeleton(height: 15, width: 250),
        const SizedBox(height: 16),
        const Skeleton(height: 40, width: 120, radius: 999),
        const SizedBox(height: 18),
        Row(
          children: const [
            Expanded(child: Skeleton(height: 124)),
            SizedBox(width: 12),
            Expanded(child: Skeleton(height: 124)),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: const [
            Expanded(child: Skeleton(height: 124)),
            SizedBox(width: 12),
            Expanded(child: Skeleton(height: 124)),
          ],
        ),
        const SizedBox(height: 14),
        const Skeleton(height: 208),
        const SizedBox(height: 14),
        const Skeleton(height: 250),
        const SizedBox(height: 14),
        const Skeleton(height: 130),
      ],
    );
  }
}
