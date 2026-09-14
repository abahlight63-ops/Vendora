// ── lib/main.dart ────────────────────────────────────────────────
// WHAT: app entry. Session gate (cookie present → try /api/me → in;
// 401/empty → AuthScreen) + bottom-nav shell (Dashboard, Chats,
// Catalog, AI, Billing) + logout. Run with:
//   flutter run --dart-define API_BASE_URL=https://<backend>
import 'package:flutter/material.dart';

import 'api.dart';
import 'theme.dart';
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

  @override
  void initState() {
    super.initState();
    _check();
  }

  Future<void> _check() async {
    try {
      await ApiClient.instance.me(); // cookie valid?
      if (mounted) setState(() => _authed = true);
    } catch (_) {
      if (mounted) setState(() => _authed = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Vendora',
      theme: VendoraTheme.dark,
      home: _authed == null
          ? const Scaffold(
              body: Center(child: CircularProgressIndicator()))
          : _authed!
              ? HomeShell(onLogout: () => setState(() => _authed = false))
              : AuthScreen(onAuthed: () => setState(() => _authed = true)),
    );
  }
}

class HomeShell extends StatefulWidget {
  final VoidCallback onLogout;
  const HomeShell({super.key, required this.onLogout});

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
    return Scaffold(
      appBar: AppBar(
        title: Text(_titles[_tab]),
        actions: [
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
