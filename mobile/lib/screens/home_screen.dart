// ── lib/screens/home_screen.dart ──────────────────────────────────
// WHAT: the home tab. Greeting, the three things an owner actually does, their
// most recent customer threads, and one primary action.
//
// Every number and name here comes from the API — there are no placeholder
// metrics. If a call fails we say so and offer a retry rather than showing a
// zero, because a wrong zero is worse than an honest error.
import 'package:flutter/material.dart';

import '../api.dart';
import '../format.dart';
import '../motion.dart';
import '../theme.dart';
import '../widgets/brand_ui.dart';

class HomeScreen extends StatefulWidget {
  /// Jumps to another tab in the shell (0 Overview · 1 Chats · 2 Catalog ·
  /// 3 Connect · 4 VeloSales Ai · 5 Billing).
  final ValueChanged<int> onGoTab;

  const HomeScreen({super.key, required this.onGoTab});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _loading = true;
  String? _error;
  String _bizName = '';
  String _niche = '';
  int _needsYou = 0;
  List<Map<String, dynamic>> _recent = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      // Both calls fly together — one wait, not two.
      final results = await Future.wait<dynamic>([
        ApiClient.instance.me(),
        ApiClient.instance.conversations().then((c) => c, onError: (_) => <dynamic>[]),
      ]);
      if (!mounted) return;
      final me = (results[0] as Map).cast<String, dynamic>();
      final biz = (me['business'] as Map?)?.cast<String, dynamic>() ?? const {};
      final convos = List<dynamic>.from(results[1] as List);

      final threads = convos
          .map((e) => (e as Map).cast<String, dynamic>())
          .toList()
        ..sort((a, b) {
          final ta = '${a['last_message_at'] ?? a['updated_at'] ?? a['created_at'] ?? ''}';
          final tb = '${b['last_message_at'] ?? b['updated_at'] ?? b['created_at'] ?? ''}';
          return tb.compareTo(ta);
        });

      setState(() {
        _bizName = '${biz['business_name'] ?? ''}'.trim();
        _niche = '${biz['business_niche'] ?? ''}'.trim();
        _needsYou = convos
            .where((e) => (e as Map)['needs_human'] == true || (e as Map)['needs_human'] == 1)
            .length;
        _recent = threads.take(3).toList();
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'We could not load your shop. Check your connection and try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.all(20),
        child: Column(children: [
          Skeleton(height: 26, width: 180),
          SizedBox(height: 10),
          Skeleton(height: 16, width: 240),
          SizedBox(height: 22),
          Skeleton(height: 150),
          SizedBox(height: 14),
          Skeleton(height: 150),
        ]),
      );
    }
    if (_error != null) {
      return SoftEmpty(
        icon: Icons.wifi_off_rounded,
        message: _error!,
        actionLabel: 'Try again',
        onAction: _load,
      );
    }

    final scheme = Theme.of(context).colorScheme;
    final name = _bizName.isEmpty ? 'there' : _bizName.split(' ').first;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 6, 20, 32),
        children: [
          FadeSlideIn(
            child: Text(
              '${greeting()}, $name.',
              style: TextStyle(
                fontSize: 27,
                height: 1.15,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.8,
                color: scheme.onSurface,
              ),
            ),
          ),
          const SizedBox(height: 6),
          FadeSlideIn(
            delayMs: 40,
            child: Text(
              _niche.isEmpty
                  ? 'What would you like to get done today?'
                  : 'What would you like to get done for $_niche today?',
              style: TextStyle(
                fontSize: 14.5,
                height: 1.45,
                color: scheme.onSurface.withValues(alpha: 0.62),
              ),
            ),
          ),

          // Only when there is something real to shout about.
          if (_needsYou > 0) ...[
            const SizedBox(height: 18),
            FadeSlideIn(
              delayMs: 80,
              child: Pressable(
                onTap: () => widget.onGoTab(1),
                child: Container(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
                  decoration: BoxDecoration(
                    color: scheme.primaryContainer,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: scheme.primary.withValues(alpha: 0.25)),
                  ),
                  child: Row(children: [
                    Icon(Icons.notifications_active_outlined,
                        size: 20, color: scheme.primary),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        '$_needsYou ${_needsYou == 1 ? 'customer is' : 'customers are'} waiting on you.',
                        style: TextStyle(
                          fontSize: 13.5,
                          height: 1.35,
                          fontWeight: FontWeight.w700,
                          color: scheme.onPrimaryContainer,
                        ),
                      ),
                    ),
                    Icon(Icons.chevron_right_rounded, size: 20, color: scheme.primary),
                  ]),
                ),
              ),
            ),
          ],

          const SizedBox(height: 24),
          const FadeSlideIn(delayMs: 120, child: SectionLabel('Get something done')),

          // Asymmetric on purpose: one featured tile that carries the primary
          // action, then two quiet ones. Four identical cards is the pattern
          // that makes an app look assembled.
          FadeSlideIn(
            delayMs: 160,
            child: IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(
                    child: ActionCard(
                      icon: Icons.smart_toy_outlined,
                      title: 'Talk to VeloSales Ai',
                      subtitle: 'Stock, prices, or a second opinion',
                      tint: VeloSalesTheme.tintLavender(context),
                      onTap: () => widget.onGoTab(4),
                      cta: 'Start talking',
                      onCta: () => widget.onGoTab(4),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(children: [
                      ActionCard(
                        icon: Icons.forum_outlined,
                        title: 'Inbox',
                        tint: VeloSalesTheme.tintSky(context),
                        onTap: () => widget.onGoTab(1),
                        arrow: true,
                      ),
                      const SizedBox(height: 12),
                      ActionCard(
                        icon: Icons.inventory_2_outlined,
                        title: 'Catalog',
                        tint: VeloSalesTheme.tintMint(context),
                        onTap: () => widget.onGoTab(2),
                        arrow: true,
                      ),
                    ]),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 26),
          SectionLabel(
            'Recent chats',
            trailing: _recent.isEmpty
                ? null
                : Pressable(
                    onTap: () => widget.onGoTab(1),
                    child: Text('See all',
                        style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: scheme.primary)),
                  ),
          ),
          if (_recent.isEmpty)
            SoftPanel(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
              child: Row(children: [
                Icon(Icons.forum_outlined, size: 20, color: scheme.onSurface.withValues(alpha: 0.4)),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'No customer chats yet. Once someone messages your WhatsApp number, they land here.',
                    style: TextStyle(
                        fontSize: 13,
                        height: 1.45,
                        color: scheme.onSurface.withValues(alpha: 0.6)),
                  ),
                ),
              ]),
            )
          else
            ..._recent.asMap().entries.map((e) {
              final c = e.value;
              final last = '${c['last_message'] ?? c['last_text'] ?? ''}'.trim();
              final who = '${c['name'] ?? c['customer_name'] ?? c['wa_id'] ?? 'Customer'}'.trim();
              return FadeSlideIn(
                delayMs: 200 + e.key * 40,
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: SoftPanel(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
                    onTap: () => widget.onGoTab(1),
                    child: Row(children: [
                      Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: scheme.primaryContainer,
                          shape: BoxShape.circle,
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          who.isEmpty ? '?' : who.characters.first.toUpperCase(),
                          style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                              color: scheme.primary),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(children: [
                              Expanded(
                                child: Text(who,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                        fontSize: 14, fontWeight: FontWeight.w700)),
                              ),
                              Text(fmtTime(c['last_message_at'] ?? c['created_at']),
                                  style: TextStyle(
                                      fontSize: 11,
                                      color: scheme.onSurface.withValues(alpha: 0.45))),
                            ]),
                            const SizedBox(height: 3),
                            Text(
                              last.isEmpty ? 'No messages yet' : last,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                  fontSize: 12.5,
                                  height: 1.35,
                                  color: scheme.onSurface.withValues(alpha: 0.6)),
                            ),
                          ],
                        ),
                      ),
                    ]),
                  ),
                ),
              );
            }),

          const SizedBox(height: 12),
          FadeSlideIn(
            delayMs: 340,
            child: GradientPill(
              label: 'Start a new chat',
              icon: Icons.auto_awesome_outlined,
              arrowBadge: true,
              onTap: () => widget.onGoTab(4),
            ),
          ),
        ],
      ),
    );
  }
}
