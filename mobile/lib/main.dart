// ── lib/main.dart ────────────────────────────────────────────────
// WHAT: app entry. Splash gate (brand intro ≥1.5s while the session check
// runs — same timing as Splash.jsx) + light/dark themes (same tokens as
// the web app; toggle in the top bar, persisted) + bottom-nav shell.
// Run with: flutter run --dart-define API_BASE_URL=https://<backend>
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'glass.dart';
import 'theme.dart';
import 'splash.dart';
import 'motion.dart';
import 'format.dart';
import 'widgets/brand_ui.dart';
import 'widgets/sidebar.dart';
import 'widgets/error_art.dart';
import 'screens/auth_screen.dart';
import 'screens/welcome_screen.dart';
import 'screens/setup_screen.dart';
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
import 'screens/profile_screen.dart';
import 'screens/settings_screen.dart';

void main() => runApp(const VeloSalesApp());

class VeloSalesApp extends StatefulWidget {
  const VeloSalesApp({super.key});

  @override
  State<VeloSalesApp> createState() => _VeloSalesAppState();
}

class _VeloSalesAppState extends State<VeloSalesApp> {
  bool? _authed; // null = checking
  bool _offline = false; // true = the session check could not reach the server (NOT a sign-out!)
  bool _needsSetup = false; // true = logged in but no niche yet (setup screen!)
  // Starts true so a returning owner never flashes the tour for one frame while
  // the preference loads. The boot read is what turns it off for new accounts.
  bool _seenTour = true;
  // Pre-signup: the welcome page is the front door. Auth only opens after the
  // guest chooses sign in or create — never as the first thing they see.
  bool _authOpen = false;
  int _authMode = 0; // 0 = sign in, 1 = create account (welcome picks it)
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
      _offline = auth[4] as bool;
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
      return [true, niche.isEmpty, name, niche, false];
    } on ApiException catch (e) {
      // status 0 = the request never reached the server (offline, no route,
      // dead Wi-Fi); 5xx = the server itself is down or waking. Neither is a
      // 401 sign-out, and showing the login form would be a lie — show the
      // retry screen instead.
      return [false, false, '', '', e.status == 0 || e.status >= 500];
    } catch (_) {
      return [false, false, '', '', true];
    }
  }

  /// Retry after the offline screen: show the splash again, then re-ask.
  Future<void> _retryBoot() async {
    setState(() {
      _offline = false;
      _authed = null;
    });
    await _boot();
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
      _offline = r[4] as bool;
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
      home: _offline
          ? OfflineBoot(onRetry: _retryBoot)
          : _authed == null
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
                            _authOpen = false;
                            _authMode = 0;
                          }),
                        )
                  : !_authOpen
                      ? WelcomeScreen(
                          onCreateAccount: () => setState(() {
                            _authMode = 1;
                            _authOpen = true;
                          }),
                          onSignIn: () => setState(() {
                            _authMode = 0;
                            _authOpen = true;
                          }),
                        )
                      : AuthScreen(
                          initialMode: _authMode,
                          onAuthed: _onAuthed,
                          onBack: () => setState(() => _authOpen = false),
                        ),
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
    'Channels',
    'Chat with Velo',
    'Plan and usage',
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

  void _openHelp() {
    _open(HelpScreen(
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
    ));
  }

  Widget _sidebar() {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Sidebar(
      businessName: widget.bizName,
      niche: widget.niche,
      avatarUrl: _avatar,
      tab: _tab,
      groups: [
        // The same words and order as the web: five daily jobs, then More.
        SidebarGroup(label: 'Your shop', items: [
          const SidebarItem(
              icon: Icons.grid_view_outlined,
              label: 'Home',
              hint: 'Your shop at a glance',
              tab: 0),
          const SidebarItem(
              icon: Icons.forum_outlined,
              label: 'Inbox',
              hint: 'Reply to your customers',
              tab: 1),
          const SidebarItem(
              icon: Icons.inventory_2_outlined,
              label: 'Catalog',
              hint: 'The only prices the bot may quote',
              tab: 2),
          const SidebarItem(
              icon: Icons.link_outlined,
              label: 'Channels',
              hint: 'WhatsApp and Telegram',
              tab: 3),
          SidebarItem(
            icon: Icons.query_stats_outlined,
            label: 'Insights',
            hint: 'Chats, quiet customers, busy hours',
            push: () => _open(const InsightsScreen()),
          ),
        ]),
        SidebarGroup(label: 'More', items: [
          const SidebarItem(
              icon: Icons.payments_outlined,
              label: 'Plan and usage',
              hint: 'Plan, trial and receipts',
              tab: 5),
          SidebarItem(
            icon: Icons.science_outlined,
            label: 'Test bot',
            hint: 'See what a customer sees',
            push: () => _open(Scaffold(
              appBar: AppBar(
                title: const Text('Test bot',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
              ),
              body: const AiScreen(startInTestBot: true),
            )),
          ),
          const SidebarItem(
              icon: Icons.smart_toy_outlined,
              label: 'Chat with Velo',
              hint: 'Ask it anything',
              tab: 4),
          SidebarItem(
            icon: Icons.card_giftcard_outlined,
            label: 'Refer & Earn',
            hint: 'Invite sellers — you both win',
            push: () => _open(const ReferEarnScreen()),
          ),
          SidebarItem(
            icon: Icons.storefront_outlined,
            label: 'Business',
            hint: 'What the AI knows about your shop',
            push: () => _open(const ProfileScreen()),
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
            label: 'Help',
            hint: 'A short guided tour',
            push: _openHelp,
          ),
        ]),
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
            title: const Text('Sign out of VeloSales Ai?'),
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
    return VeloSalesTheme.glow(context, child: Scaffold(
      backgroundColor: Colors.transparent,
      drawer: _sidebar(),
      appBar: AppBar(
        toolbarHeight: 64,
        backgroundColor: Colors.transparent,
        leading: Builder(
          builder: (c) => IconButton(
            icon: const Icon(Icons.menu_rounded),
            tooltip: 'Menu',
            onPressed: () => Scaffold.of(c).openDrawer(),
          ),
        ),
        titleSpacing: 0,
        title: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'VeloSales Ai / ${_titles[_tab]}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 10.5,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.1,
                color: Theme.of(context)
                    .colorScheme
                    .onSurface
                    .withValues(alpha: 0.45),
              ),
            ),
            const SizedBox(height: 2),
            Text(
              widget.bizName.isEmpty ? 'Your business' : widget.bizName,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 16.5,
                height: 1.1,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.35,
                color: Theme.of(context).colorScheme.onSurface,
              ),
            ),
          ],
        ),
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
            // Use the theme actually on screen, not the preference. If the
            // phone is in system-dark and the preference is `system`, the moon
            // must still switch to light on the first tap (not set dark again).
            icon: Icon(Theme.of(context).brightness == Brightness.dark
                ? Icons.light_mode_outlined
                : Icons.dark_mode_outlined),
            tooltip: 'Toggle theme',
            onPressed: () => widget.onMode(
                Theme.of(context).brightness == Brightness.dark
                    ? ThemeMode.light
                    : ThemeMode.dark),
          ),
          Builder(
            builder: (c) => Semantics(
              button: true,
              label: 'Open menu',
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => Scaffold.of(c).openDrawer(),
                child: SizedBox(
                  width: 42,
                  height: 42,
                  child: Center(
                    child: _TopAvatar(url: _avatar, name: widget.bizName),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 6),
        ],
      ),
      body: Column(children: [
        // The connection state lives above every tab, so it is visible before
        // the owner taps anything — not discovered after a failed save.
        ValueListenableBuilder<bool>(
          valueListenable: ApiClient.offline,
          builder: (_, isOffline, _) => AnimatedSwitcher(
            duration: const Duration(milliseconds: 220),
            child: isOffline
                ? const OfflineStrip()
                : const SizedBox.shrink(key: ValueKey('online')),
          ),
        ),
        Expanded(
          child: IndexedStack(index: _tab, children: [
            HomeScreen(onGoTab: _go),
            const ChatsScreen(),
            const CatalogScreen(),
            const ConnectScreen(),
            const AiScreen(),
            const BillingScreen(),
          ]),
        ),
      ]),
      // The web's floating mobile bar — same five destinations, same active
      // pill. More opens the drawer, which holds Insights and everything else.
      bottomNavigationBar: Builder(
        builder: (c) => _Dock(
          tab: _tab,
          onTab: _go,
          onMore: () => Scaffold.of(c).openDrawer(),
        ),
      ),
    ));
  }
}

/// One destination in the floating dock.
class _DockEntry {
  final int tab; // -1 = opens the drawer (More)
  final String label;
  final IconData icon;
  final IconData activeIcon;
  const _DockEntry(this.tab, this.label, this.icon, this.activeIcon);
}

/// The phone's five-item bar. It matches the browser's `@media (max-width:
/// 980px) .mobile-bar`: a floating white card, 20px radius, one shadow, five
/// labels at 10.5px, and a purple-soft pill under the current page. More opens
/// the rail, which holds Insights and everything else (as on the web).
class _Dock extends StatelessWidget {
  final int tab;
  final ValueChanged<int> onTab;
  final VoidCallback onMore;

  const _Dock({required this.tab, required this.onTab, required this.onMore});

  static const _entries = [
    _DockEntry(0, 'Home', Icons.grid_view_outlined, Icons.grid_view_rounded),
    _DockEntry(1, 'Inbox', Icons.forum_outlined, Icons.forum_rounded),
    _DockEntry(
        2, 'Catalog', Icons.inventory_2_outlined, Icons.inventory_2_rounded),
    _DockEntry(3, 'Channels', Icons.link_outlined, Icons.link_rounded),
    _DockEntry(-1, 'More', Icons.more_horiz_rounded, Icons.more_horiz_rounded),
  ];

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
        child: Container(
          height: 66,
          padding: const EdgeInsets.all(6),
          decoration: VeloSalesTheme.glass(context, radius: 26, bright: true),
          child: Row(
            children: [
              for (final e in _entries)
                Expanded(
                  child: _DockItem(
                    entry: e,
                    active: e.tab < 0 ? tab > 3 : e.tab == tab,
                    onTap: e.tab < 0 ? onMore : () => onTab(e.tab),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The topbar avatar: the owner's photo if there is one, otherwise the shop's
/// initial in the accent tint. It is the same object the web topbar shows, not
/// a second sign-out door — tapping it opens the rail, where sign-out lives.
class _TopAvatar extends StatelessWidget {
  final String? url;
  final String name;

  const _TopAvatar({this.url, required this.name});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final trimmed = name.trim();
    final initial = trimmed.isEmpty
        ? 'V'
        : String.fromCharCode(trimmed.runes.first).toUpperCase();
    if (url != null && url!.isNotEmpty) {
      return Container(
        width: 32,
        height: 32,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: scheme.outline),
        ),
        child: Image.network(
          url!,
          fit: BoxFit.cover,
          errorBuilder: (_, _, _) => _initialAvatar(scheme, initial),
        ),
      );
    }
    return _initialAvatar(scheme, initial);
  }

  Widget _initialAvatar(ColorScheme scheme, String initial) {
    return Container(
      width: 32,
      height: 32,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: scheme.primaryContainer,
        shape: BoxShape.circle,
        border: Border.all(color: scheme.outline),
      ),
      child: Text(
        initial,
        style: TextStyle(
          fontSize: 12.5,
          fontWeight: FontWeight.w800,
          color: scheme.primary,
        ),
      ),
    );
  }
}

class _DockItem extends StatelessWidget {
  final _DockEntry entry;
  final bool active;
  final VoidCallback onTap;

  const _DockItem({
    required this.entry,
    required this.active,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final muted = VeloSalesTheme.glassInk(context);
    return Semantics(
      button: true,
      selected: active,
      label: entry.label,
      child: Pressable(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          curve: Curves.easeOutCubic,
          padding: const EdgeInsets.symmetric(vertical: 5, horizontal: 2),
          decoration: BoxDecoration(
            color: active ? scheme.primary : Colors.transparent,
            borderRadius: BorderRadius.circular(18),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                active ? entry.activeIcon : entry.icon,
                size: 20,
                color: active ? scheme.onPrimary : muted,
              ),
              const SizedBox(height: 3),
              Text(
                entry.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 10.5,
                  height: 1,
                  fontWeight: FontWeight.w700,
                  color: active ? scheme.onPrimary : muted,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The phone's offline strip. Amber (attention), never red (nothing broke):
/// the network is down, the shop and its data are untouched. It appears the
/// instant ApiClient sees a dead connection and leaves on the first answer.
class OfflineStrip extends StatelessWidget {
  const OfflineStrip({super.key});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: VeloSalesTheme.gold.withValues(alpha: 0.12),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 8, 8, 8),
          child: Row(children: [
            const Icon(Icons.cloud_off_outlined,
                size: 17, color: VeloSalesTheme.gold),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'You’re offline. We’ll keep this screen as it is — reconnect and carry on.',
                style: TextStyle(
                    fontSize: 12.5,
                    height: 1.4,
                    fontWeight: FontWeight.w600,
                    color: scheme.onSurface),
              ),
            ),
            TextButton(
              onPressed: () async {
                // A real request is the only honest test; success clears the
                // strip in ApiClient (no fake "online" toggle).
                try {
                  await ApiClient.instance.version();
                } catch (_) {}
              },
              child: const Text('Retry'),
            ),
          ]),
        ),
      ),
    );
  }
}

/// Cold start with no network. The session check could not reach the server,
/// which is not the same thing as being signed out — so this screen tells the
/// truth and offers Retry instead of dumping the owner on a login form.
class OfflineBoot extends StatelessWidget {
  final VoidCallback onRetry;
  const OfflineBoot({super.key, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 30, vertical: 24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const ErrorArt(offline: true, size: 132),
            const SizedBox(height: 4),
            const Text(
              'We can’t reach your shop right now',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            Text(
              'The connection (or our server) isn’t answering. Nothing has changed and no message was lost — reconnect, then try again.',
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 13,
                  height: 1.55,
                  color: scheme.onSurface.withValues(alpha: 0.68)),
            ),
            const SizedBox(height: 18),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text('Try again'),
            ),
          ]),
        ),
      ),
    );
  }
}
