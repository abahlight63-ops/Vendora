// ── lib/main.dart ────────────────────────────────────────────────
// WHAT: app entry. Splash gate (brand intro ≥1.5s while the session check
// runs — same timing as Splash.jsx) + light/dark themes (same tokens as
// the web app; toggle in the top bar, persisted) + bottom-nav shell.
// Run with: flutter run --dart-define API_BASE_URL=https://<backend>
import 'package:flutter/material.dart';

import 'api.dart';
import 'theme.dart';
import 'splash.dart';
import 'screens/auth_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/chats_screen.dart';
import 'screens/catalog_screen.dart';
import 'screens/ai_screen.dart';
import 'screens/billing_screen.dart';

void main() => runApp(const VendoraApp());

class VendoraApp extends StatefulWidget {
  const VendoraApp({super.key});

  @override
  State<VendoraApp> createState() => _VendoraAppState();
}

class _VendoraAppState extends State<VendoraApp> {
  bool? _authed; // null = checking
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
      VendoraTheme.loadMode(),
      (() async {
        try {
          await ApiClient.instance.me(); // cookie valid?
          return true;
        } catch (_) {
          return false;
        }
      })(),
    ]);
    if (!mounted) return;
    setState(() {
      _mode = results[1] as ThemeMode;
      _authed = results[2] as bool;
    });
  }

  Future<void> _setMode(ThemeMode m) async {
    await VendoraTheme.saveMode(m);
    if (mounted) setState(() => _mode = m);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Vendora',
      theme: VendoraTheme.light,
      darkTheme: VendoraTheme.dark,
      themeMode: _mode,
      home: _authed == null
          ? const SplashView()
          : _authed!
              ? HomeShell(
                  mode: _mode,
                  onMode: _setMode,
                  onLogout: () => setState(() => _authed = false),
                )
              : AuthScreen(onAuthed: () => setState(() => _authed = true)),
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

  static const _titles = [
    'Overview',
    'Chats',
    'Catalog',
    'Vendora AI',
    'Billing'
  ];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      appBar: AppBar(
        title: Text(_titles[_tab]),
        actions: [
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
      body: IndexedStack(index: _tab, children: const [
        DashboardScreen(),
        ChatsScreen(),
        CatalogScreen(),
        AiScreen(),
        BillingScreen(),
      ]),
      bottomNavigationBar: NavigationBar(
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
              icon: Icon(Icons.smart_toy_outlined),
              selectedIcon: Icon(Icons.smart_toy),
              label: 'AI'),
          NavigationDestination(
              icon: Icon(Icons.payments_outlined),
              selectedIcon: Icon(Icons.payments),
              label: 'Billing'),
        ],
      ),
    );
  }
}
