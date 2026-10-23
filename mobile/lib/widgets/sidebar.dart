// ── lib/widgets/sidebar.dart ──────────────────────────────────────
// WHAT: the navigation drawer — the phone's copy of the web's deep-indigo
// sidebar. Same three groups (Sell / Grow / Setup), same words, same order,
// so a shop owner who learns the map in the browser already knows the phone.
//
// The rail is dark in both themes. Everything inside uses the rail tokens,
// never the page scheme: white ink, muted lavender hints, one white .14 active
// fill. No uppercase eyebrows, no second accent.
import 'package:flutter/material.dart';

import '../brand_mark.dart';
import '../theme.dart';
import 'brand_ui.dart';

/// One row in the drawer.
class SidebarItem {
  final IconData icon;
  final String label;
  final String? hint;
  final int? tab; // switch to this shell tab…
  final VoidCallback? push; // …or open a page on top of the shell
  final bool highlight;

  const SidebarItem({
    required this.icon,
    required this.label,
    this.hint,
    this.tab,
    this.push,
    this.highlight = false,
  });
}

/// A titled block of rows (the web's nav-label + nav).
class SidebarGroup {
  final String label;
  final List<SidebarItem> items;

  const SidebarGroup({required this.label, required this.items});
}

class Sidebar extends StatelessWidget {
  final String businessName;
  final String niche;
  final String? avatarUrl; // the owner's picture (null/empty = the brand mark)
  final int tab;
  final List<SidebarGroup> groups;

  /// Called with the target tab index. The drawer closes itself first.
  final ValueChanged<int> onGoTab;

  final bool dark;
  final VoidCallback onToggleTheme;
  final VoidCallback onLogout;

  const Sidebar({
    super.key,
    required this.businessName,
    required this.niche,
    this.avatarUrl,
    required this.tab,
    required this.groups,
    required this.onGoTab,
    required this.dark,
    required this.onToggleTheme,
    required this.onLogout,
  });

  @override
  Widget build(BuildContext context) {
    return Drawer(
      // The rail: the phone's sidebar wears the same deep-indigo wash as the
      // web's, so the two clients are unmistakably one product.
      backgroundColor: VeloSalesTheme.rail2,
      surfaceTintColor: Colors.transparent,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.only(
          topRight: Radius.circular(24),
          bottomRight: Radius.circular(24),
        ),
      ),
      child: DecoratedBox(
        decoration: const BoxDecoration(gradient: VeloSalesTheme.railGrad),
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _brandRow(context),
              _identityChip(context),
              const Divider(height: 1, color: VeloSalesTheme.railLine),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 18),
                  children: [
                    for (final g in groups) ...[
                      Padding(
                        padding: const EdgeInsets.fromLTRB(10, 10, 10, 4),
                        child: Text(
                          g.label,
                          style: const TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.2,
                            color: VeloSalesTheme.railFaint,
                          ),
                        ),
                      ),
                      for (final i in g.items) _row(context, i),
                    ],
                    const SizedBox(height: 6),
                    const Divider(height: 1, color: VeloSalesTheme.railLine),
                    const SizedBox(height: 4),
                    // The footer scrolls with the map on a phone: keeping it
                    // pinned was hiding the whole Setup group above it.
                    _footRow(
                      context,
                      icon: dark
                          ? Icons.light_mode_outlined
                          : Icons.dark_mode_outlined,
                      label: dark ? 'Light theme' : 'Dark theme',
                      onTap: onToggleTheme,
                    ),
                    _footRow(
                      context,
                      icon: Icons.logout_rounded,
                      label: 'Sign out',
                      onTap: onLogout,
                    ),
                    const Padding(
                      padding: EdgeInsets.fromLTRB(10, 8, 10, 4),
                      child: Text(
                        'AI replies 24/7 so you never miss a sale.\n© 2026 VeloSales Ai',
                        style: TextStyle(
                          fontSize: 10.5,
                          height: 1.5,
                          color: VeloSalesTheme.railFaint,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _brandRow(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 18, 12, 14),
      child: Row(
        children: [
          const BrandMark(size: 30, onRail: true),
          const SizedBox(width: 10),
          const Expanded(
            child: Text(
              'VeloSales Ai',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 16.5,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.35,
                color: VeloSalesTheme.railInk,
              ),
            ),
          ),
          IconButton(
            tooltip: 'Close menu',
            onPressed: () => Navigator.of(context).pop(),
            icon: const Icon(Icons.close_rounded,
                size: 20, color: VeloSalesTheme.railMuted),
          ),
        ],
      ),
    );
  }

  Widget _identityChip(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
      child: Container(
        padding: const EdgeInsets.fromLTRB(10, 9, 12, 9),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: VeloSalesTheme.railLine),
        ),
        child: Row(
          children: [
            _DrawerAvatar(url: avatarUrl, name: businessName),
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    businessName.isEmpty ? 'Your shop' : businessName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                      color: VeloSalesTheme.railInk,
                    ),
                  ),
                  if (niche.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      niche,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 11,
                        color: VeloSalesTheme.railFaint,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _row(BuildContext context, SidebarItem item) {
    final selected = item.tab != null && item.tab == tab;
    final tint = item.highlight || selected;

    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Pressable(
        // Always close the drawer first, then act — otherwise the page opens
        // behind an open drawer.
        onTap: () {
          Navigator.of(context).pop();
          if (item.tab != null) {
            onGoTab(item.tab!);
          } else {
            item.push?.call();
          }
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 140),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
          decoration: BoxDecoration(
            color: selected ? VeloSalesTheme.railActive : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: selected ? VeloSalesTheme.railLine : Colors.transparent,
            ),
          ),
          child: Row(
            children: [
              Icon(
                item.icon,
                size: 19,
                color: tint ? Colors.white : VeloSalesTheme.railMuted,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.label,
                      style: TextStyle(
                        fontSize: 13.5,
                        height: 1.2,
                        fontWeight:
                            selected ? FontWeight.w700 : FontWeight.w600,
                        color: tint ? Colors.white : VeloSalesTheme.railInk,
                      ),
                    ),
                    if (item.hint != null) ...[
                      const SizedBox(height: 1.5),
                      Text(
                        item.hint!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 10.5,
                          height: 1.25,
                          color: VeloSalesTheme.railFaint,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (selected)
                const Icon(Icons.chevron_right_rounded,
                    size: 18, color: Colors.white),
            ],
          ),
        ),
      ),
    );
  }

  Widget _footRow(
    BuildContext context, {
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return Pressable(
      onTap: () {
        Navigator.of(context).pop();
        onTap();
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 11),
        child: Row(
          children: [
            Icon(icon, size: 19, color: VeloSalesTheme.railMuted),
            const SizedBox(width: 12),
            Text(
              label,
              style: const TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w600,
                color: VeloSalesTheme.railInk,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The drawer's identity chip: the owner's own picture once they have set one,
/// and the shop's initial until then. The brand mark already sits in the header
/// above, so repeating it here would read as two logos stacked on one another.
class _DrawerAvatar extends StatelessWidget {
  const _DrawerAvatar({this.url, this.name = ''});

  final String? url;
  final String name;

  @override
  Widget build(BuildContext context) {
    if (url == null || url!.isEmpty) {
      final trimmed = name.trim();
      final initial = trimmed.isEmpty
          ? 'V'
          : String.fromCharCode(trimmed.runes.first).toUpperCase();
      return Container(
        width: 34,
        height: 34,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: Colors.white.withValues(alpha: 0.10),
          border: Border.all(color: VeloSalesTheme.railLine),
        ),
        child: Text(
          initial,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w800,
            color: VeloSalesTheme.railInk,
          ),
        ),
      );
    }
    return Container(
      width: 34,
      height: 34,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: VeloSalesTheme.railLine),
      ),
      child: Image.network(
        url!,
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => const BrandMark(size: 34, onRail: true),
      ),
    );
  }
}
