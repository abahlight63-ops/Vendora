// ── lib/main.dart ────────────────────────────────────────────────
// WHAT: app entry. Splash gate (brand intro ≥1.5s while the session check
// runs — same timing as Splash.jsx) + light/dark themes (same tokens as
// the web app; toggle in the top bar, persisted) + bottom-nav shell.
// Run with: flutter run --dart-define API_BASE_URL=https://<backend>
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'glass.dart';
import 'theme.dart';
import 'splash.dart';
import 'motion.dart';
import 'format.dart';
import 'screens/auth_screen.dart';
import 'screens/setup_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/chats_screen.dart';
import 'screens/catalog_screen.dart';
import 'screens/connect_screen.dart';
import 'screens/ai_screen.dart';
import 'screens/billing_screen.dart';

void main() => runApp(const VeloSalesApp());

class VeloSalesApp extends StatefulWidget {
  const VeloSalesApp({super.key});

  @override
  State<VeloSalesApp> createState() => _VeloSalesAppState();
}

class _VeloSalesAppState extends State<VeloSalesApp> {
  bool? _authed; // null = checking
  bool _needsSetup = false; // true = logged in but no niche yet (setup screen!)
  ThemeMode _mode = ThemeMode.system;

  @override
  void initState() {
    super.initState();
    _boot();
  }

  Future<void> _boot() async {
    // Web parity: splash never shorter than 1.5s (Splash.jsx timing).
    final wait = Future.delayed(const Duration(milliseconds: 1500));
    final results = await Future.wait([
      wait,
      VeloSalesTheme.loadMode(),
      _checkAuth(),
    ]);
    if (!mounted) return;
    setState(() {
      _mode = results[1] as ThemeMode;
      _authed = (results[2] as List)[0] as bool;
      _needsSetup = (results[2] as List)[1] as bool;
    });
  }

  /// Session check + setup check in one: returns [authed, needsSetup].
  /// needsSetup = logged in but business_niche empty (new signup!).
  Future<List> _checkAuth() async {
    try {
      final me = await ApiClient.instance.me(); // cookie valid? (+ business row!)
      final biz = (me['business'] as Map?)?.cast<String, dynamic>();
      final niche = '${biz?['business_niche'] ?? ''}'.trim();
      return [true, niche.isEmpty];
    } catch (_) {
      return [false, false];
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
                  ? SetupScreen(
                      onDone: () => setState(() => _needsSetup = false))
                  : HomeShell(
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
  const HomeShell(
      {super.key,
      required this.onLogout,
      required this.mode,
      required this.onMode});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _tab = 0;
  int _unread = 0;

  static const _titles = [
    'Overview',
    'Chats',
    'Catalog',
    'Connect',
    'VeloSales Ai',
    'Billing'
  ];

  @override
  void initState() {
    super.initState();
    _bootExtras();
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
                                  errorBuilder: (_, __, ___) => const Icon(
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
                  errorBuilder: (_, __, ___) =>
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

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      appBar: AppBar(
        title: Text(_titles[_tab]),
        // Liquid glass: blur whatever scrolls beneath the frosted bar.
        flexibleSpace: ClipRect(
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: Glass.cardBlur, sigmaY: Glass.cardBlur),
            child: const SizedBox.expand(),
          ),
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
          // Same dark/light switch as the web nav (ThemeToggle).
          IconButton(
            icon: Icon(isDark ? Icons.light_mode : Icons.dark_mode),
            tooltip: 'Toggle theme',
            onPressed: () => widget.onMode(
                isDark ? ThemeMode.light : ThemeMode.dark),
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Sign out',
            onPressed: () async {
              await ApiClient.instance.logout();
              widget.onLogout();
            },
          ),
        ],
      ),
      body: IndexedStack(index: _tab, children: [
        DashboardScreen(onGoTab: (i) => setState(() => _tab = i)),
        const ChatsScreen(),
        const CatalogScreen(),
        const ConnectScreen(),
        const AiScreen(),
        const BillingScreen(),
      ]),
      // Liquid glass: the bottom nav floats frosted over the mesh backdrop.
      bottomNavigationBar: ClipRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: Glass.cardBlur, sigmaY: Glass.cardBlur),
          child: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        destinations: const [
          NavigationDestination(
              icon: Icon(Icons.dashboard_outlined),
              selectedIcon: Icon(Icons.dashboard),
              label: 'Home'),
          NavigationDestination(
              icon: Icon(Icons.chat_outlined),
              selectedIcon: Icon(Icons.chat),
              label: 'Chats'),
          NavigationDestination(
              icon: Icon(Icons.inventory_2_outlined),
              selectedIcon: Icon(Icons.inventory_2),
              label: 'Catalog'),
          NavigationDestination(
              icon: Icon(Icons.link_outlined),
              selectedIcon: Icon(Icons.link),
              label: 'Connect'),
          NavigationDestination(
              icon: Icon(Icons.smart_toy_outlined),
              selectedIcon: Icon(Icons.smart_toy),
              label: 'AI'),
          NavigationDestination(
              icon: Icon(Icons.payments_outlined),
              selectedIcon: Icon(Icons.payments),
              label: 'Billing'),
            ],
          ),
        ),
      ),
    );
  }
}
