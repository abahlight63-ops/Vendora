// ── lib/screens/home_screen.dart ──────────────────────────────────
// WHAT: Home — the phone's copy of the web's Dashboard.jsx.
//
// Same order as the browser: a greeting, the trial strip, four things to do next
// (chats that need you comes first and turns coral when it is real), today's
// reply meter, the way into Chat with Velo, Needs your attention, and the
// checklist (or Activity once it is done). No invented numbers: every value is a
// real API answer, and a failed load is a retry wall, never a page of zeroes.
//
// The phone is allowed one thing the browser is not: depth. Cards tilt toward
// the thumb and rise on entry (lib/depth.dart). Nothing loops.
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api.dart';
import '../depth.dart';
import '../format.dart';
import '../motion.dart';
import '../theme.dart';
import '../widgets/brand_ui.dart';
import '../widgets/error_art.dart';
import 'insights_screen.dart';
import 'profile_screen.dart';
import 'ai_screen.dart';

class HomeScreen extends StatefulWidget {
  /// Jumps to another tab in the shell (0 Home · 1 Inbox · 2 Catalog ·
  /// 3 Channels · 4 Chat with Velo · 5 Plan and usage).
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

  void _openTestBot() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => Scaffold(
          appBar: AppBar(
            title: const Text('Test bot',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          ),
          body: const AiScreen(startInTestBot: true),
        ),
      ),
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
            "Couldn't load Home",
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
    final days = _sevenDays();
    final wa = (_channels['whatsapp'] as Map?) ?? const {};
    final used = (wa['dailyUsed'] as num?)?.toInt() ?? 0;
    final limit = (wa['dailyLimit'] as num?)?.toInt();
    final hasUsage = _channels['whatsapp'] != null;
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
          // ── the greeting ──
          DepthReveal(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Hi $first,',
                  style: TextStyle(
                    fontSize: 28,
                    height: 1.12,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.7,
                    color: VeloSalesTheme.accent(context),
                  ),
                ),
                Text(
                  'what do you need today?',
                  style: TextStyle(
                    fontSize: 28,
                    height: 1.12,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.8,
                    color: scheme.onSurface,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  botOn
                      ? (live
                          ? 'Velo is answering your customers right now.'
                          : 'Add a product and connect a channel to go live.')
                      : 'Your bot is paused — switch it back on in Settings.',
                  style: TextStyle(
                    fontSize: 14,
                    height: 1.45,
                    color: scheme.onSurface.withValues(alpha: 0.72),
                  ),
                ),
              ],
            ),
          ),

          if (trialLeft != null) ...[
            const SizedBox(height: 16),
            DepthReveal(
              delayMs: 50,
              child: _TrialStrip(
                days: trialLeft,
                onTap: () => widget.onGoTab(5),
              ),
            ),
          ],

          const SizedBox(height: 16),

          // ── four things to do next ──
          DepthReveal(
            delayMs: 90,
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: _ActionCard(
                        hot: needs.isNotEmpty,
                        number: needs.length,
                        label: needs.isEmpty
                            ? 'All chats handled'
                            : (needs.length == 1
                                ? 'Chat needs you'
                                : 'Chats need you'),
                        onTap: () => widget.onGoTab(1),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _ActionCard(
                        icon: Icons.add_rounded,
                        label: 'Add a product',
                        onTap: () => widget.onGoTab(2),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _ActionCard(
                        icon: Icons.chat_bubble_outline_rounded,
                        label: 'Test your bot',
                        onTap: _openTestBot,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _ActionCard(
                        icon: Icons.link_rounded,
                        label: 'Connect a channel',
                        onTap: () => widget.onGoTab(3),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          if (hasUsage) ...[
            const SizedBox(height: 16),
            DepthReveal(
              delayMs: 130,
              child: _UsageMeter(used: used, limit: limit),
            ),
          ],

          const SizedBox(height: 16),
          DepthReveal(
            delayMs: 150,
            child: _AskBar(onTap: () => widget.onGoTab(4)),
          ),

          const SizedBox(height: 24),

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

          const SizedBox(height: 16),

          // ── checklist until it is done, then activity ──
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
                : _ActivityCard(days: days, onTap: _openInsights),
          ),
        ],
      ),
    );
  }

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


/// One of the four things to do next. The "needs you" card is the only one that
/// fills with coral, and only when a real chat is waiting.
class _ActionCard extends StatelessWidget {
  final IconData? icon;
  final int? number;
  final String label;
  final bool hot;
  final VoidCallback onTap;

  const _ActionCard({
    this.icon,
    this.number,
    required this.label,
    this.hot = false,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final fg = hot ? VeloSalesTheme.onAccent(context) : scheme.onSurface;
    return Semantics(
      button: true,
      child: Pressable(
        onTap: onTap,
        radius: BorderRadius.circular(20),
        child: Container(
          height: 124,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: hot ? VeloSalesTheme.accent(context) : scheme.surface,
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF1E1757).withValues(alpha: 0.07),
                blurRadius: 24,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  if (number != null)
                    Text(
                      '$number',
                      style: TextStyle(
                        fontSize: 31,
                        height: 1,
                        fontWeight: FontWeight.w800,
                        color: fg,
                        fontFeatures: const [FontFeature.tabularFigures()],
                      ),
                    )
                  else
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: scheme.primaryContainer,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(icon, size: 18, color: scheme.primary),
                    ),
                  Icon(Icons.north_east_rounded,
                      size: 20,
                      color: hot ? fg : scheme.onSurface.withValues(alpha: 0.72)),
                ],
              ),
              Text(
                label,
                maxLines: 2,
                style: TextStyle(
                  fontSize: 16,
                  height: 1.2,
                  fontWeight: FontWeight.w700,
                  color: fg,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// "32 of 50" replies today. Amber near the limit. Plans with no daily cap just
/// show the count.
class _UsageMeter extends StatelessWidget {
  final int used;
  final int? limit;
  const _UsageMeter({required this.used, required this.limit});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final cap = limit;
    final share = cap == null || cap == 0 ? 0.0 : (used / cap).clamp(0.0, 1.0);
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      decoration: BoxDecoration(
        color: scheme.primaryContainer,
        borderRadius: BorderRadius.circular(VeloSalesTheme.radius),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Replies today',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
              Text(
                cap == null ? '$used' : '$used of $cap',
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  fontFeatures: [FontFeature.tabularFigures()],
                ),
              ),
            ],
          ),
          if (cap != null) ...[
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: LinearProgressIndicator(
                value: share,
                minHeight: 8,
                semanticsLabel: 'Replies used today',
                backgroundColor: scheme.primary.withValues(alpha: 0.22),
                color: share >= 0.8
                    ? VeloSalesTheme.goldColor(context)
                    : scheme.primary,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// The way into Chat with Velo, shaped like the box you will type in.
class _AskBar extends StatelessWidget {
  final VoidCallback onTap;
  const _AskBar({required this.onTap});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Semantics(
      button: true,
      label: 'Ask Velo anything',
      excludeSemantics: true,
      child: Pressable(
        onTap: onTap,
        radius: BorderRadius.circular(999),
        child: Row(
          children: [
            Expanded(
              child: Container(
                height: 52,
                alignment: Alignment.centerLeft,
                padding: const EdgeInsets.symmetric(horizontal: 18),
                decoration: BoxDecoration(
                  color: scheme.surface,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: scheme.outline),
                ),
                child: Text(
                  'Ask Velo anything',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                    color: scheme.onSurface.withValues(alpha: 0.72),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: VeloSalesTheme.accent(context),
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.arrow_upward_rounded,
                  size: 20, color: VeloSalesTheme.onAccent(context)),
            ),
          ],
        ),
      ),
    );
  }
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
            child: const Text('See plans'),
          ),
        ],
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
