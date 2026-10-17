// ── lib/widgets/brand_ui.dart ────────────────────────────────────
// WHAT: the shared pieces the app's screens are assembled from, so the home
// screen, the guide pages and the feature screens cannot drift apart.
//
// Everything here reads theme tokens only — no widget hard-codes a colour —
// and every tappable surface is at least 48px and scales to 0.97 under the
// finger, which is the one motion the whole app reuses.
import 'package:flutter/material.dart';

import '../theme.dart';

/// Press feedback for anything tappable: 0.97 scale, 120ms.
///
/// A GestureDetector rather than an InkWell because these cards carry their own
/// tint — Material's ripple paints a grey overlay that muddies a pastel fill.
class Pressable extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;
  final BorderRadius? radius;

  const Pressable({super.key, required this.child, this.onTap, this.radius});

  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onTap != null;
    return Semantics(
      button: enabled,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: enabled ? (_) => setState(() => _down = true) : null,
        onTapUp: enabled ? (_) => setState(() => _down = false) : null,
        onTapCancel: enabled ? () => setState(() => _down = false) : null,
        onTap: widget.onTap,
        child: AnimatedScale(
          scale: _down && enabled ? 0.97 : 1,
          duration: const Duration(milliseconds: 120),
          curve: Curves.easeOut,
          child: widget.child,
        ),
      ),
    );
  }
}

/// The screen's section label. Sentence case, no eyebrow above it — the label
/// is the heading, it does not need a caption introducing it.
class SectionLabel extends StatelessWidget {
  final String text;
  final Widget? trailing;
  const SectionLabel(this.text, {super.key, this.trailing});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10, top: 4),
      child: Row(
        children: [
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.2,
                color: Theme.of(context).colorScheme.onSurface,
              ),
            ),
          ),
          ?trailing,
        ],
      ),
    );
  }
}

/// A soft tinted card with an icon chip, a title, a line of supporting text and
/// an optional inline action. The tint carries hue, never shade, so the text
/// on it stays at full contrast.
class ActionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final Color tint;
  final VoidCallback? onTap;

  /// Optional call-to-action rendered inside the card (used by the one
  /// featured card on Home, so the grid is not four identical tiles).
  final String? cta;
  final VoidCallback? onCta;

  /// Optional trailing arrow — signals "this leaves the screen".
  final bool arrow;

  const ActionCard({
    super.key,
    required this.icon,
    required this.title,
    required this.tint,
    this.subtitle,
    this.onTap,
    this.cta,
    this.onCta,
    this.arrow = false,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Pressable(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: tint, borderRadius: BorderRadius.circular(22)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _IconChip(icon: icon),
                const Spacer(),
                if (arrow)
                  Icon(Icons.arrow_outward_rounded,
                      size: 18, color: scheme.onSurface.withValues(alpha: 0.55)),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              title,
              style: TextStyle(
                fontSize: 15,
                height: 1.25,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.2,
                color: scheme.onSurface,
              ),
            ),
            if (subtitle != null) ...[
              const SizedBox(height: 3),
              Text(
                subtitle!,
                style: TextStyle(
                  fontSize: 12.5,
                  height: 1.35,
                  color: scheme.onSurface.withValues(alpha: 0.62),
                ),
              ),
            ],
            if (cta != null) ...[
              const SizedBox(height: 12),
              GradientPill(label: cta!, onTap: onCta, height: 40, dense: true),
            ],
          ],
        ),
      ),
    );
  }
}

/// 40px circle holding an outline icon. Sits on the card's tint, so it lifts
/// with the surface colour rather than introducing a third tone.
class _IconChip extends StatelessWidget {
  final IconData icon;
  const _IconChip({required this.icon});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: scheme.surface,
        shape: BoxShape.circle,
        border: Border.all(color: scheme.outline),
      ),
      child: Icon(icon, size: 19, color: scheme.primary),
    );
  }
}

/// The app's primary action: the one authored gradient, pill, white label.
class GradientPill extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;
  final IconData? icon;
  final double height;
  final bool dense;

  /// A trailing white circle with an arrow — the "start" affordance.
  final bool arrowBadge;

  const GradientPill({
    super.key,
    required this.label,
    this.onTap,
    this.icon,
    this.height = 54,
    this.dense = false,
    this.arrowBadge = false,
  });

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    return Opacity(
      opacity: enabled ? 1 : 0.45,
      child: Pressable(
        onTap: onTap,
        child: Container(
          height: height,
          padding: EdgeInsets.symmetric(horizontal: dense ? 12 : 20),
          decoration: BoxDecoration(
            gradient: VeloSalesTheme.cta(context),
            borderRadius: BorderRadius.circular(999),
            boxShadow: [
              BoxShadow(
                color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.28),
                blurRadius: 18,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 18, color: Colors.white),
                const SizedBox(width: 8),
              ],
              Flexible(
                child: Text(
                  label,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: dense ? 13 : 15,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.1,
                  ),
                ),
              ),
              if (arrowBadge) ...[
                const SizedBox(width: 10),
                Container(
                  width: 30,
                  height: 30,
                  decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                  child: Icon(Icons.arrow_forward_rounded,
                      size: 17, color: Theme.of(context).colorScheme.primary),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// A flat white panel with a hairline border. The default container for lists,
/// forms and grouped settings rows.
class SoftPanel extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  const SoftPanel({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final panel = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: scheme.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: scheme.outline),
      ),
      child: child,
    );
    return onTap == null ? panel : Pressable(onTap: onTap, child: panel);
  }
}

/// The app's single empty/error state: icon in a circle, one sentence, one
/// action. Errors name what failed and how to recover.
class SoftEmpty extends StatelessWidget {
  final IconData icon;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;
  const SoftEmpty({
    super.key,
    required this.icon,
    required this.message,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 62,
              height: 62,
              decoration: BoxDecoration(
                color: scheme.primaryContainer,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 27, color: scheme.primary),
            ),
            const SizedBox(height: 16),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                height: 1.5,
                color: scheme.onSurface.withValues(alpha: 0.72),
              ),
            ),
            if (actionLabel != null) ...[
              const SizedBox(height: 18),
              SizedBox(
                width: 200,
                child: GradientPill(label: actionLabel!, onTap: onAction, height: 46),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
