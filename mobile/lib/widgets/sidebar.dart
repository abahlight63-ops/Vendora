// ── lib/widgets/sidebar.dart ──────────────────────────────────────
// WHAT: the navigation drawer. Holds everything the bottom bar cannot, so the
// bottom bar stays five destinations instead of being crammed with eleven.
import 'package:flutter/material.dart';

import '../brand_mark.dart';
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

class Sidebar extends StatelessWidget {
  final String businessName;
  final String niche;
  final int tab;
  final List<SidebarItem> primary;
  final List<SidebarItem> secondary;

  /// Called with the target tab index. The drawer closes itself first.
  final ValueChanged<int> onGoTab;

  final bool dark;
  final VoidCallback onToggleTheme;
  final VoidCallback onLogout;

  const Sidebar({
    super.key,
    required this.businessName,
    required this.niche,
    required this.tab,
    required this.primary,
    required this.secondary,
    required this.onGoTab,
    required this.dark,
    required this.onToggleTheme,
    required this.onLogout,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Drawer(
      backgroundColor: scheme.surface,
      surfaceTintColor: Colors.transparent,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.only(
          topRight: Radius.circular(24),
          bottomRight: Radius.circular(24),
        ),
      ),
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── who you are ──
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 18),
              child: Row(children: [
                const BrandMark(size: 38),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        businessName.isEmpty ? 'Your shop' : businessName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 15.5,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.3),
                      ),
                      if (niche.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(niche,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                                fontSize: 12,
                                color: scheme.onSurface.withValues(alpha: 0.55))),
                      ],
                    ],
                  ),
                ),
              ]),
            ),
            Divider(height: 1, color: scheme.outline),

            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
                children: [
                  ...primary.map((i) => _row(context, i)),
                  const SizedBox(height: 14),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(10, 0, 10, 6),
                    child: Text(
                      'LEARN AND MANAGE',
                      style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.1,
                        color: scheme.onSurface.withValues(alpha: 0.42),
                      ),
                    ),
                  ),
                  ...secondary.map((i) => _row(context, i)),
                ],
              ),
            ),

            Divider(height: 1, color: scheme.outline),
            _row(
              context,
              SidebarItem(
                icon: dark ? Icons.light_mode_outlined : Icons.dark_mode_outlined,
                label: dark ? 'Light theme' : 'Dark theme',
                push: onToggleTheme,
              ),
            ),
            _row(
              context,
              SidebarItem(
                icon: Icons.logout_rounded,
                label: 'Sign out',
                push: onLogout,
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Widget _row(BuildContext context, SidebarItem item) {
    final scheme = Theme.of(context).colorScheme;
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
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          decoration: BoxDecoration(
            color: selected ? scheme.primaryContainer : Colors.transparent,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(children: [
            Icon(
              item.icon,
              size: 21,
              color: tint ? scheme.primary : scheme.onSurface.withValues(alpha: 0.70),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.label,
                    style: TextStyle(
                      fontSize: 14.5,
                      fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                      color: tint ? scheme.primary : scheme.onSurface,
                    ),
                  ),
                  if (item.hint != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      item.hint!,
                      style: TextStyle(
                          fontSize: 11.5,
                          height: 1.3,
                          color: scheme.onSurface.withValues(alpha: 0.48)),
                    ),
                  ],
                ],
              ),
            ),
            if (selected)
              Icon(Icons.chevron_right_rounded, size: 20, color: scheme.primary),
          ]),
        ),
      ),
    );
  }
}
