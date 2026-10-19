// ── lib/widgets/app_select.dart ───────────────────────────────────
// WHAT: the phone's ONE dropdown. Replaces Material's DropdownButtonFormField,
// which opens the platform's own menu (a cramped list pinned to the field with
// the OS's highlight) and made every form look a decade older than the rest of
// the app. This opens a real sheet: full-width rows, room for a hint line, a
// tick on the current choice and a lock on anything the plan does not cover.
// It matches the web's components/Select.jsx in look and behaviour.
import 'package:flutter/material.dart';

import '../glass.dart';
import '../theme.dart';

class AppSelectOption {
  /// Stored value (what the API wants).
  final String value;

  /// What the owner reads. For AI brains this is deliberately the *tier name*
  /// (Fast / Normal / Smart), never the engine's real name.
  final String label;

  /// One line under the label — what this choice actually does.
  final String? hint;

  /// Needs a bigger plan — shown with a lock, still tappable (the caller's save
  /// path is where a plan is enforced, and it explains itself).
  final bool locked;

  const AppSelectOption({
    required this.value,
    required this.label,
    this.hint,
    this.locked = false,
  });
}

class AppSelect extends StatelessWidget {
  final String? label; // the field label, above the control
  final String? placeholder; // shown when nothing is selected
  final String? value; // selected value (null = placeholder)
  final List<AppSelectOption> options;
  final ValueChanged<String> onChanged;
  final String? sheetTitle; // heading inside the sheet
  final bool enabled;

  const AppSelect({
    super.key,
    this.label,
    this.placeholder = 'Choose…',
    this.value,
    required this.options,
    required this.onChanged,
    this.sheetTitle,
    this.enabled = true,
  });

  AppSelectOption? get _selected {
    for (final o in options) {
      if (o.value == value) return o;
    }
    return null;
  }

  Future<void> _open(BuildContext context) async {
    final picked = await glassSheet<String>(
      context,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 4, 4, 12),
            child: Text(
              sheetTitle ?? label ?? placeholder ?? 'Choose',
              style: const TextStyle(fontSize: 16.5, fontWeight: FontWeight.w800),
            ),
          ),
          Flexible(
            child: ListView(
              shrinkWrap: true,
              padding: EdgeInsets.zero,
              children: [
                for (final o in options)
                  _OptionRow(
                    option: o,
                    selected: o.value == value,
                    onTap: () => Navigator.of(context).pop(o.value),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
    if (picked != null) onChanged(picked);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final sel = _selected;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (label != null) ...[
          Padding(
            padding: const EdgeInsets.only(left: 2, bottom: 6),
            child: Text(
              label!,
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
                color: theme.colorScheme.onSurface.withValues(alpha: 0.62),
              ),
            ),
          ),
        ],
        Material(
          color: theme.colorScheme.surface,
          borderRadius: BorderRadius.circular(VeloSalesTheme.radiusSmall),
          child: InkWell(
            onTap: enabled ? () => _open(context) : null,
            borderRadius: BorderRadius.circular(VeloSalesTheme.radiusSmall),
            child: Container(
              height: 54,
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(VeloSalesTheme.radiusSmall),
                border: Border.all(color: theme.colorScheme.outline),
              ),
              child: Row(children: [
                Expanded(
                  child: Text(
                    sel?.label ?? placeholder ?? 'Choose…',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 14.5,
                      fontWeight: sel == null ? FontWeight.w400 : FontWeight.w600,
                      color: enabled
                          ? (sel == null
                              ? VeloSalesTheme.purpleDark.withValues(alpha: 0.55)
                              : theme.colorScheme.onSurface)
                          : theme.colorScheme.onSurface.withValues(alpha: 0.45),
                    ),
                  ),
                ),
                Icon(Icons.keyboard_arrow_down_rounded,
                    size: 22,
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.45)),
              ]),
            ),
          ),
        ),
      ],
    );
  }
}

class _OptionRow extends StatelessWidget {
  const _OptionRow({required this.option, required this.selected, required this.onTap});

  final AppSelectOption option;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Material(
        color: selected
            ? (dark ? const Color(0xFF221C4D) : VeloSalesTheme.purpleSoft)
            : Colors.transparent,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            child: Row(children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      option.label,
                      style: TextStyle(
                        fontSize: 14.5,
                        fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                        color: selected
                            ? (dark ? const Color(0xFFB9AFFF) : VeloSalesTheme.purpleDark)
                            : theme.colorScheme.onSurface,
                      ),
                    ),
                    if (option.hint != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        option.hint!,
                        style: TextStyle(
                          fontSize: 12,
                          height: 1.35,
                          color: theme.colorScheme.onSurface.withValues(alpha: 0.55),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (option.locked) ...[
                const SizedBox(width: 8),
                Icon(Icons.lock_outline_rounded,
                    size: 16, color: theme.colorScheme.onSurface.withValues(alpha: 0.4)),
              ],
              if (selected) ...[
                const SizedBox(width: 8),
                Icon(Icons.check_circle_rounded,
                    size: 20, color: theme.colorScheme.primary),
              ],
            ]),
          ),
        ),
      ),
    );
  }
}
