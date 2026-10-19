// ── lib/main.dart ────────────────────────────────────────────────
// WHAT: app entry. Splash gate (brand intro ≥1.5s while the session check
// runs — same timing as Splash.jsx) + light/dark themes (same tokens as
// the web app; toggle in the top bar, persisted) + bottom-nav shell.
// Run with: flutter run --dart-define API_BASE_URL=https://<backend>
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'brand_mark.dart';
import 'glass.dart';
import 'theme.dart';
import 'splash.dart';
import 'motion.dart';
import 'format.dart';
import 'widgets/sidebar.dart';
import 'screens/auth_screen.dart';
import 'screens/setup_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/home_screen.dart';
import 'screens/help_screen.dart';
import 'screens/chats_screen.dart';
import 'screens/catalog_screen.dart';
import 'screens/connect_screen.dart';
import 'screens/ai_screen.dart';
import 'screens/billing_screen.dart';
import 'screens/refer_earn_screen.dart';
import 'screens/ai_settings_screen.dart';
import 'screens/insights_screen.dart';
import 'screens/onboarding_screen.dart';
import 'screens/settings_screen.dart';

void main() => runApp(const VeloSalesApp());

class VeloSalesApp extends StatefulWidget {
  const VeloSalesApp({super.key});

  @override
  State<VeloSalesApp> createState() => _VeloSalesAppState();
}

class _VeloSalesAppState extends State<VeloSalesApp> {
  bool? _authed; // null = checking
  bool _needsSetup = false; // true = logged in but no niche yet (setup screen!)
  // Starts true so a returning owner never flashes the tour for one frame while
  // the preference loads. The boot read is what turns it off for new accounts.
  bool _seenTour = true;
  ThemeMode _mode = ThemeMode.system;
  String _bizName = '';
  String _niche = '';

  static const _tourKey = 'velosalesai_seen_tour_v1';

  @override
  void initState() {
    super.initState();
    _boot();
  }

  /// The welcome tour runs once per install, before the setup quiz — the same
  /// order as the web (tour → 5 questions → dashboard).
  Future<bool> _loadSeenTour() async {
    final p = await SharedPreferences.getInstance();
    return p.getBool(_tourKey) ?? false;
  }

  Future<void> _finishTour() async {
    final p = await SharedPreferences.getInstance();
    await p.setBool(_tourKey, true);
    if (mounted) setState(() => _seenTour = true);
  }

  Future<void> _boot() async {
    // Web parity: the splash holds for the full reveal. The wordmark's last
    // letter lands at 1.88s, so the floor is 2s — anything shorter cuts the
    // one authored moment in the app in half.
    final wait = Future.delayed(const Duration(milliseconds: 2000));
    final results = await Future.wait([
      wait,
      VeloSalesTheme.loadMode(),
      _checkAuth(),
      _loadSeenTour(),
    ]);
    if (!mounted) return;
    final auth = results[2] as List;
    setState(() {
      _mode = results[1] as ThemeMode;
      _authed = auth[0] as bool;
      _needsSetup = auth[1] as bool;
      _bizName = auth[2] as String;
      _niche = auth[3] as String;
      _seenTour = results[3] as bool;
    });
  }

  /// Session check + setup check + the shop's own name in one call.
  /// Returns [authed, needsSetup, businessName, niche].
  Future<List> _checkAuth() async {
    try {
      final me = await ApiClient.instance.me(); // cookie valid? (+ business row!)
      final biz = (me['business'] as Map?)?.cast<String, dynamic>();
      final niche = '${biz?['business_niche'] ?? ''}'.trim();
      final name = '${biz?['name'] ?? biz?['business_name'] ?? ''}'.trim(); // the business row calls it `name` (business_name is only an alias in the admin/auth joins)
      return [true, niche.isEmpty, name, niche];
    } catch (_) {
      return [false, false, '', ''];
    }
  }

  /// Fresh login/signup just stamped the session → re-check (niche usually
  /// empty for new accounts → setup screen, not the dashboard!).
  Future<void> _onAuthed() async {
    final r = await _checkAuth();
    if (!mounted) return;
    setState(() {
      _authed = r[0] as bool;
      _needsSetup = r[1] as bool;
      _bizName = r[2] as String;
      _niche = r[3] as String;
    });
  }

  Future<void> _setMode(ThemeMode m) async {
    await VeloSalesTheme.saveMode(m);
    if (mounted) setState(() => _mode = m);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'VeloSales Ai',
      theme: VeloSalesTheme.light,
      darkTheme: VeloSalesTheme.dark,
      themeMode: _mode,
      // Liquid glass: mesh-gradient backdrop behind EVERYTHING (scaffolds
      // are transparent by theme, so every frosted surface refracts this).
      builder: (context, child) => Stack(children: [
        const Positioned.fill(child: GlassBackground()),
        child ?? const SizedBox.shrink(),
      ]),
      home: _authed == null
          ? const SplashView()
          : _authed!
              ? _needsSetup
                  ? (_seenTour
                      ? SetupScreen(
                          onDone: () => setState(() => _needsSetup = false))
                      : OnboardingScreen(onDone: _finishTour))
                  : HomeShell(
                      bizName: _bizName,
                      niche: _niche,
                      mode: _mode,
                      onMode: _setMode,
                      onLogout: () => setState(() {
                        _authed = false;
                        _needsSetup = false;
                      }),
                    )
              : AuthScreen(onAuthed: _onAuthed),
    );
  }
}

class HomeShell extends StatefulWidget {
  final VoidCallback onLogout;
  final ThemeMode mode;
  final ValueChanged<ThemeMode> onMode;
  final String bizName;
  final String niche;
  const HomeShell({
    super.key,
    required this.onLogout,
    required this.mode,
    required this.onMode,
    required this.bizName,
    required this.niche,
  });

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _tab = 0;
  int _unread = 0;
  String? _avatar; // the owner's picture (null = the brand mark stands in)

  static const _titles = [
    'Home',
    'Inbox',
    'Catalog',
    'Connect',
    'VeloSales Ai',
    'Billing',
  ];

  @override
  void initState() {
    super.initState();
    _bootExtras();
    _loadAvatar();
  }

  /// The drawer's identity chip. Quiet on failure: no picture is not an error,
  /// the brand mark simply stays.
  Future<void> _loadAvatar() async {
    try {
      final me = await ApiClient.instance.me();
      final b = (me['business'] as Map).cast<String, dynamic>();
      if (!mounted) return;
      setState(() => _avatar = b['avatar_url'] as String?);
    } catch (_) {/* keep whatever we had */}
  }

  /// Settings is pushed (like the dashboard) so the shell and every tab's
  /// scroll position survive — and so a photo uploaded there can refresh the
  /// drawer the moment we come back.
  Future<void> _openSettings() async {
    await Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => SettingsScreen(
        mode: widget.mode,
        onMode: widget.onMode,
        onGoTab: _go,
      ),
    ));
    _loadAvatar();
  }

  /// Shell parity: bell unread count + "VeloSales Ai updated" toast when the
  /// backend version changed since last visit (Shell.jsx does both).
  /// Both calls fly in PARALLEL (one wait, not two — faster cold start!).
  Future<void> _bootExtras() async {
    final results = await Future.wait<dynamic>([
      ApiClient.instance.notifications().then((n) => n, onError: (_) => null),
      ApiClient.instance.version().then((v) => v, onError: (_) => null),
    ]);
    if (!mounted) return;
    final n = results[0] as Map<String, dynamic>?;
    if (n != null) {
      setState(() => _unread = (n['unread'] as num? ?? 0).toInt());
    }
    final v = results[1] as Map<String, dynamic>?;
    if (v == null) return;
    try {
      final cur = '${v['version'] ?? ''}';
      if (cur.isEmpty) return;
      final prefs = await SharedPreferences.getInstance();
      final last = prefs.getString('vendora-version');
      await prefs.setString('vendora-version', cur);
      if (mounted && last != null && last != cur) {
        showToast(context, 'VeloSales Ai updated to v$cur — open the notification bell to see what changed');
        _refreshBell();
      }
    } catch (_) {}
  }

  Future<void> _refreshBell() async {
    try {
      final n = await ApiClient.instance.notifications();
      if (mounted) {
        setState(() => _unread = (n['unread'] as num? ?? 0).toInt());
      }
    } catch (_) {}
  }

  Future<void> _openBell() async {
    List<dynamic> items = [];
    try {
      final n = await ApiClient.instance.notifications();
      items = List<dynamic>.from(n['items'] ?? []);
    } catch (_) {}
    if (!mounted) return;
    await glassSheet(
      context,
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Text('Notifications',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        Flexible(
          child: items.isEmpty
              ? const Padding(
                  padding: EdgeInsets.all(24),
                  child: Text('All caught up. Payment verifications and app updates land here.'),
                )
              : ListView.builder(
                  shrinkWrap: true,
                  itemCount: items.length,
                  itemBuilder: (c, i) {
                    final m =
                        (items[i] as Map).cast<String, dynamic>();
                    final body = '${m['body'] ?? ''}';
                    return GlassCard(
                      radius: 14,
                      margin: const EdgeInsets.symmetric(vertical: 5),
                      child: ListTile(
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 2),
                        leading: (m['image_url'] is String &&
                                (m['image_url'] as String)
                                    .startsWith('https://'))
                            ? ClipRRect(
                                borderRadius: BorderRadius.circular(8),
                                child: Image.network(
                                  m['image_url'] as String,
                                  width: 44,
                                  height: 44,
                                  cacheWidth:
                                      88, // 44pt thumb at 2x (cheap RAM, crisp look!)
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, _, _) => const Icon(
                                      Icons.image_not_supported_outlined),
                                ),
                              )
                            : null, // no photo → no leading (dead links fall back to an icon!)
                        title: Text('${m['title'] ?? 'Update'}',
                            style: const TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 14)),
                        subtitle: Text(
                            '${body.length > 140 ? '${body.substring(0, 140)}… tap to read all' : body}\n${fmtTime(m['created_at'])}',
                            style: const TextStyle(fontSize: 12)),
                        onTap: () => _openNotice(m), // full page (photo/video + long body!)
                      ),
                    );
                  },
                ),
        ),
      ]),
    );
    // Marks all read on open (Notifications.jsx parity).
    try {
      await ApiClient.instance.readNotifications();
    } catch (_) {}
    _refreshBell();
  }

  /// Full notice page (web /notifications/:id parity): photo, video button,
  /// long body. Marks THIS one read (scoped server-side — another shop's id 404s!).
  Future<void> _openNotice(Map<String, dynamic> m) async {
    Map<String, dynamic> full = m;
    try {
      full = await ApiClient.instance.readNotification(m['id']);
    } catch (_) {} // offline: show the preview copy we already have!
    if (!mounted) return;
    final body = '${full['body'] ?? ''}';
    final video = '${full['video_url'] ?? ''}';
    await glassSheet(
      context,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('${full['title'] ?? 'Update'}',
              style:
                  const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text(fmtTime(full['created_at']),
              style: const TextStyle(fontSize: 11)),
          if (full['image_url'] is String &&
              (full['image_url'] as String).startsWith('https://'))
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.network(
                  full['image_url'] as String,
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) =>
                      const Icon(Icons.image_not_supported_outlined),
                ),
              ),
            ),
          if (video.startsWith('https://'))
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: () => launchUrl(Uri.parse(video),
                      mode: LaunchMode.externalApplication), // video plays in their player (no heavy player dep!)
                  icon: const Icon(Icons.play_circle_outline),
                  label: const Text('Watch video'),
                ),
              ),
            ),
          if (body.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Text(body, style: const TextStyle(fontSize: 13, height: 1.6)),
            ),
        ],
      ),
    );
    _refreshBell(); // this one is read now (badge drops!)
  }

  void _go(int i) => setState(() => _tab = i);

  /// Pages the bottom bar cannot hold open on top of the shell, so the shell —
  /// and every tab's scroll position — survives the trip.
  void _open(Widget page) =>
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => page));

  Widget _sidebar() {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Sidebar(
      businessName: widget.bizName,
      niche: widget.niche,
      avatarUrl: _avatar,
      tab: _tab,
      primary: const [
        SidebarItem(icon: Icons.home_outlined, label: 'Home', tab: 0),
        SidebarItem(
            icon: Icons.forum_outlined,
            label: 'Inbox',
            hint: 'Reply to your customers',
            tab: 1),
        SidebarItem(
            icon: Icons.inventory_2_outlined,
            label: 'Catalog',
            hint: 'The only prices the bot may quote',
            tab: 2),
        SidebarItem(
            icon: Icons.link_outlined,
            label: 'Connect',
            hint: 'WhatsApp and Telegram',
            tab: 3),
        SidebarItem(
            icon: Icons.smart_toy_outlined,
            label: 'VeloSales Ai',
            hint: 'Ask it anything',
            tab: 4),
        SidebarItem(icon: Icons.payments_outlined, label: 'Billing', tab: 5),
      ],
      secondary: [
        SidebarItem(
          icon: Icons.insights_outlined,
          label: 'Shop overview',
          hint: 'How your bot is performing',
          push: () => _open(DashboardScreen(onGoTab: _go)),
        ),
        SidebarItem(
          icon: Icons.query_stats_outlined,
          label: 'Insights',
          hint: 'Chats, quiet customers, busy hours',
          push: () => _open(const InsightsScreen()),
        ),
        SidebarItem(
          icon: Icons.card_giftcard_outlined,
          label: 'Refer & Earn',
          hint: 'Invite sellers — you both win',
          push: () => _open(const ReferEarnScreen()),
        ),
        SidebarItem(
          icon: Icons.psychology_outlined,
          label: 'AI settings',
          hint: 'Who answers, and how it sounds',
          push: () => _open(const AiSettingsScreen()),
        ),
        SidebarItem(
          icon: Icons.settings_outlined,
          label: 'Settings',
          hint: 'Your picture, plan and preferences',
          push: _openSettings,
        ),
        SidebarItem(
          icon: Icons.menu_book_outlined,
          label: 'How to use VeloSales Ai',
          hint: 'A short guided tour',
          push: () => _open(HelpScreen(
            onGoTab: (i) {
              Navigator.of(context).pop();
              _go(i);
            },
            onReplayTour: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => OnboardingScreen(
                  onDone: () => Navigator.of(context).pop(),
                ),
              ),
            ),
          )),
        ),
      ],
      onGoTab: _go,
      dark: dark,
      onToggleTheme: () =>
          widget.onMode(dark ? ThemeMode.light : ThemeMode.dark),
      onLogout: () async {
        // Confirm first: signing out is normal, but it should not happen to a
        // thumb that meant "Settings" one row above.
        final out = await showDialog<bool>(
          context: context,
          builder: (c) => AlertDialog(
            icon: const Icon(Icons.logout_rounded),
            title: const Text('Sign out?'),
            content: const Text(
                'Your shop keeps working — the AI answers every customer whether '
                'the app is open or not. You will need your login to come back.'),
            actions: [
              TextButton(
                  onPressed: () => Navigator.of(c).pop(false),
                  child: const Text('Stay signed in')),
              FilledButton(
                  onPressed: () => Navigator.of(c).pop(true),
                  child: const Text('Sign out')),
            ],
          ),
        );
        if (out != true || !mounted) return;
        await ApiClient.instance.logout();
        widget.onLogout();
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      drawer: _sidebar(),
      appBar: AppBar(
        leading: Builder(
          builder: (c) => IconButton(
            icon: const Icon(Icons.menu_rounded),
            tooltip: 'Menu',
            onPressed: () => Scaffold.of(c).openDrawer(),
          ),
        ),
        titleSpacing: 0,
        title: Row(children: [
          const BrandMark(size: 24),
          const SizedBox(width: 9),
          Text(_titles[_tab]),
        ]),
        actions: [
          // Bell (Notifications.jsx parity: badge + mark-read on open).
          Stack(children: [
            IconButton(
              icon: const Icon(Icons.notifications_outlined),
              tooltip: 'Notifications',
              onPressed: _openBell,
            ),
            if (_unread > 0)
              Positioned(
                right: 8,
                top: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                      color: Colors.redAccent,
                      borderRadius: BorderRadius.circular(999)),
                  child: Text('$_unread',
                      style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: Colors.white)),
                ),
              ),
          ]),
          IconButton(
            icon: Icon(widget.mode == ThemeMode.dark
                ? Icons.light_mode_outlined
                : Icons.dark_mode_outlined),
            tooltip: 'Toggle theme',
            onPressed: () => widget.onMode(
                widget.mode == ThemeMode.dark
                    ? ThemeMode.light
                    : ThemeMode.dark),
          ),
        ],
      ),
      body: IndexedStack(index: _tab, children: [
        HomeScreen(onGoTab: _go),
        const ChatsScreen(),
        const CatalogScreen(),
        const ConnectScreen(),
        const AiScreen(),
        const BillingScreen(),
      ]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab > 4 ? 0 : _tab,
        onDestinationSelected: _go,
        destinations: const [
          NavigationDestination(
              icon: Icon(Icons.home_outlined),
              selectedIcon: Icon(Icons.home_rounded),
              label: 'Home'),
          NavigationDestination(
              icon: Icon(Icons.forum_outlined),
              selectedIcon: Icon(Icons.forum_rounded),
              label: 'Inbox'),
          NavigationDestination(
              icon: Icon(Icons.inventory_2_outlined),
              selectedIcon: Icon(Icons.inventory_2_rounded),
              label: 'Catalog'),
          NavigationDestination(
              icon: Icon(Icons.link_outlined),
              selectedIcon: Icon(Icons.link_rounded),
              label: 'Connect'),
          NavigationDestination(
              icon: Icon(Icons.smart_toy_outlined),
              selectedIcon: Icon(Icons.smart_toy_rounded),
              label: 'Ai'),
        ],
      ),
    );
  }
}
