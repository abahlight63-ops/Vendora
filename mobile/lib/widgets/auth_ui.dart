// ── lib/widgets/auth_ui.dart ─────────────────────────────────────
// WHAT: the sign-in / sign-up surface, as its own small kit.
//
// WHY: this is the first screen anyone sees, so it gets real furniture rather
// than four bare TextFields. A coloured band carries the brand, a white panel
// rises out of it, each field leads with its own icon behind a hairline, and
// the three states a form actually has — busy, wrong, done — each get a shape
// instead of a line of coloured text.
//
// Every colour here is a theme token. Every tappable thing is a `Pressable`
// from brand_ui.dart, so the press motion matches the rest of the app.
import 'package:flutter/material.dart';

import '../brand_mark.dart';
import '../motion.dart';
import '../theme.dart';
import 'brand_ui.dart';

/// The purple band the panel rises out of. Edge-to-edge under the status bar,
/// so the page reads as one surface rather than a header floating in a gutter.
class AuthHeader extends StatelessWidget {
  final double height;
  final String wordmark;
  final String tagline;
  final double markSize;

  const AuthHeader({
    super.key,
    this.height = 226,
    this.wordmark = 'VeloSales Ai',
    this.tagline = 'Your shop, open 24/7',
    this.markSize = 52,
  });

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return SizedBox(
      height: height + top,
      width: double.infinity,
      child: DecoratedBox(
        // The one authored gradient on this screen. Indigo → violet → periwinkle:
        // the same family as the buttons, so the header belongs to the app and
        // does not read as a stock "purple hero".
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF6D5BF6), Color(0xFF7C4DF0), Color(0xFF5B5BF0)],
          ),
        ),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            // Two off-canvas circles give the band depth without a pattern.
            const Positioned(top: -40, left: -54, child: _Bubble(196, 0.10)),
            const Positioned(bottom: -52, right: -38, child: _Bubble(158, 0.08)),
            const Positioned(top: 22, right: 30, child: _Bubble(74, 0.10)),
            Padding(
              padding: EdgeInsets.only(top: top),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  BrandMark(size: markSize, solid: Colors.white),
                  const SizedBox(height: 12),
                  Text(
                    wordmark,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 21,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.4,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 32),
                    child: Text(
                      tagline,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.84),
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  final double size;
  final double alpha;
  const _Bubble(this.size, this.alpha);

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: Colors.white.withValues(alpha: alpha),
        ),
      );
}

/// The white sheet the form lives on. Rounded on top only and pulled up over
/// the band by [overlap], so it reads as a page turning up rather than a card
/// floating in the middle of nowhere.
class AuthPanel extends StatelessWidget {
  static const overlap = 26.0;
  static const _radius = Radius.circular(30);

  final Widget child;
  final EdgeInsetsGeometry padding;

  const AuthPanel({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.fromLTRB(22, 30, 22, 34),
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Transform.translate(
      offset: const Offset(0, -overlap),
      child: Container(
        width: double.infinity,
        decoration: BoxDecoration(
          color: scheme.surface,
          borderRadius: const BorderRadius.vertical(top: _radius),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.07),
              blurRadius: 26,
              offset: const Offset(0, -8),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: const BorderRadius.vertical(top: _radius),
          child: SingleChildScrollView(
            padding: padding,
            child: child,
          ),
        ),
      ),
    );
  }
}

/// "Create An Account" + one line under it. The line always says what the form
/// is FOR, not a greeting.
class AuthPanelTitle extends StatelessWidget {
  final String title;
  final String? subtitle;
  const AuthPanelTitle({super.key, required this.title, this.subtitle});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: TextStyle(
            fontSize: 24,
            height: 1.15,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.7,
            color: scheme.onSurface,
          ),
        ),
        if (subtitle != null) ...[
          const SizedBox(height: 7),
          Text(
            subtitle!,
            style: TextStyle(
              fontSize: 13.5,
              height: 1.45,
              color: scheme.onSurface.withValues(alpha: 0.58),
            ),
          ),
        ],
      ],
    );
  }
}

/// A form row: leading icon, hairline, then the field itself. The border and
/// the icon pick up the accent while the field has focus, which is the only
/// "is this the active row" signal the form needs.
class AuthField extends StatefulWidget {
  final IconData icon;
  final String hint;
  final TextEditingController controller;
  final bool obscure;
  final TextInputType? keyboardType;
  final TextCapitalization textCapitalization;
  final int? maxLength;
  final TextAlign textAlign;
  final TextStyle? textStyle;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onEditingComplete;
  final Widget? suffix;

  const AuthField({
    super.key,
    required this.icon,
    required this.hint,
    required this.controller,
    this.obscure = false,
    this.keyboardType,
    this.textCapitalization = TextCapitalization.none,
    this.maxLength,
    this.textAlign = TextAlign.start,
    this.textStyle,
    this.onChanged,
    this.onEditingComplete,
    this.suffix,
  });

  @override
  State<AuthField> createState() => _AuthFieldState();
}

class _AuthFieldState extends State<AuthField> {
  final _focus = FocusNode();
  bool _focused = false;
  late bool _hidden = widget.obscure;

  @override
  void initState() {
    super.initState();
    _focus.addListener(() {
      if (mounted) setState(() => _focused = _focus.hasFocus);
    });
  }

  @override
  void dispose() {
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final muted = scheme.onSurface.withValues(alpha: 0.42);
    return AnimatedContainer(
      duration: const Duration(milliseconds: 140),
      curve: Curves.easeOut,
      decoration: BoxDecoration(
        color: scheme.surface,
        borderRadius: BorderRadius.circular(VeloSalesTheme.radiusSmall),
        border: Border.all(
          color: _focused ? scheme.primary : scheme.outline,
          width: _focused ? 1.6 : 1,
        ),
        // The focus ring is a soft glow, not a hard outline — it lifts the
        // active row off the panel instead of boxing it in.
        boxShadow: _focused
            ? [
                BoxShadow(
                  color: scheme.primary.withValues(alpha: 0.15),
                  blurRadius: 14,
                  offset: const Offset(0, 5),
                ),
              ]
            : null,
      ),
      child: Row(
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 13, right: 11),
            child: Icon(widget.icon,
                size: 19, color: _focused ? scheme.primary : muted),
          ),
          Container(width: 1, height: 20, color: scheme.outline),
          Expanded(
            child: TextField(
              controller: widget.controller,
              focusNode: _focus,
              obscureText: _hidden,
              keyboardType: widget.keyboardType,
              textCapitalization: widget.textCapitalization,
              maxLength: widget.maxLength,
              textAlign: widget.textAlign,
              cursorColor: scheme.primary,
              onChanged: widget.onChanged,
              onEditingComplete: widget.onEditingComplete,
              style: widget.textStyle ??
                  TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w600,
                    color: scheme.onSurface,
                  ),
              // The global input theme is overridden here: this field supplies
              // its own container, so Material must not draw a second border.
              decoration: InputDecoration(
                isDense: true,
                counterText: '',
                filled: false,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                errorBorder: InputBorder.none,
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 15),
                hintText: widget.hint,
                hintStyle: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: scheme.onSurface.withValues(alpha: 0.36),
                ),
              ),
            ),
          ),
          if (widget.obscure)
            IconButton(
              onPressed: () => setState(() => _hidden = !_hidden),
              icon: Icon(
                _hidden
                    ? Icons.visibility_off_outlined
                    : Icons.visibility_outlined,
                size: 19,
              ),
              color: muted,
              tooltip: _hidden ? 'Show password' : 'Hide password',
            )
          else if (widget.suffix != null)
            Padding(
              padding: const EdgeInsets.only(right: 10),
              child: widget.suffix,
            ),
        ],
      ),
    );
  }
}

/// One full-width primary action for the whole screen. Busy is a state of the
/// SAME button, not a second widget, so the button never jumps position.
class AuthPrimaryButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool busy;
  final String? busyLabel;
  final IconData? icon;

  const AuthPrimaryButton({
    super.key,
    required this.label,
    this.onPressed,
    this.busy = false,
    this.busyLabel,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null && !busy;
    // Busy keeps the button lit — it is still the way forward, just working.
    final lit = enabled || busy;
    return Pressable(
      onTap: enabled ? onPressed : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 140),
        height: 54,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: lit
              ? VeloSalesTheme.accentSolid
              : VeloSalesTheme.accentSolid.withValues(alpha: 0.42),
          borderRadius: BorderRadius.circular(15),
          boxShadow: lit
              ? [
                  BoxShadow(
                    color: VeloSalesTheme.accentSolid.withValues(alpha: 0.32),
                    blurRadius: 20,
                    offset: const Offset(0, 9),
                  ),
                ]
              : null,
        ),
        child: busy
            ? Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const OrbitLoader(size: 18, color: Colors.white),
                  const SizedBox(width: 11),
                  Text(
                    busyLabel ?? label,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.2,
                    ),
                  ),
                ],
              )
            : Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (icon != null) ...[
                    Icon(icon, size: 19, color: Colors.white),
                    const SizedBox(width: 9),
                  ],
                  Text(
                    label,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.2,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

/// "Or sign up with" — a label sitting on a rule, so the alternative path is
/// visually second to the button above it.
class AuthOrDivider extends StatelessWidget {
  final String label;
  const AuthOrDivider({super.key, this.label = 'Or sign up with'});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final rule = Container(height: 1, color: scheme.outline);
    return Row(
      children: [
        Expanded(child: rule),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
              color: scheme.onSurface.withValues(alpha: 0.48),
            ),
          ),
        ),
        Expanded(child: rule),
      ],
    );
  }
}

/// The social row. These are visually complete but not wired to a provider
/// yet — see the note on the screen itself; Google needs an Android OAuth
/// client and Apple needs a developer account before either can work.
class AuthSocialRow extends StatelessWidget {
  final VoidCallback? onGoogle;
  final VoidCallback? onApple;
  const AuthSocialRow({super.key, this.onGoogle, this.onApple});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _SocialButton(
          onTap: onGoogle,
          child: CustomPaint(
            size: const Size(21, 21),
            painter: _GoogleGlyph(),
          ),
        ),
        const SizedBox(width: 16),
        _SocialButton(
          onTap: onApple,
          child: Icon(Icons.apple, size: 24, color: scheme.onSurface),
        ),
      ],
    );
  }
}

class _SocialButton extends StatelessWidget {
  final Widget child;
  final VoidCallback? onTap;
  const _SocialButton({required this.child, this.onTap});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Pressable(
      onTap: onTap,
      radius: const BorderRadius.all(Radius.circular(999)),
      child: Container(
        width: 56,
        height: 56,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: scheme.surface,
          shape: BoxShape.circle,
          border: Border.all(color: scheme.outline),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 12,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        child: child,
      ),
    );
  }
}

/// The Google "G", drawn rather than packaged: four arcs whose angles are the
/// official artwork's, plus the blue bar. An icon font would have shipped a
/// 300KB dependency for one glyph.
class _GoogleGlyph extends CustomPainter {
  static const _blue = Color(0xFF4285F4);
  static const _red = Color(0xFFEA4335);
  static const _yellow = Color(0xFFFBBC05);
  static const _green = Color(0xFF34A853);

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.shortestSide;
    const stroke = 0.205;
    final ring = Rect.fromCircle(
      center: Offset(s / 2, s / 2),
      radius: (s - s * stroke) / 2,
    );
    final p = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * stroke
      ..strokeCap = StrokeCap.butt
      ..isAntiAlias = true;

    // Angles are degrees/radians measured from 3 o'clock, clockwise (y is down),
    // which is how the canvas counts — and they are the logo's own sectors.
    void arc(Color c, double startDeg, double sweepDeg) {
      p.color = c;
      canvas.drawArc(ring, startDeg * 3.14159265 / 180, sweepDeg * 3.14159265 / 180,
          false, p);
    }

    arc(_red, -153.3, 119.3); // top
    arc(_yellow, 141.9, 64.8); // left
    arc(_green, 48.9, 93.0); // bottom
    arc(_blue, -17.2, 66.1); // right

    // The crossbar: from the centre out to the blue arc at the vertical middle.
    canvas.drawRect(
      Rect.fromLTRB(s * 0.5, s * 0.4167, s * 0.775, s * 0.605),
      Paint()..color = _blue,
    );
  }

  @override
  bool shouldRepaint(_GoogleGlyph old) => false;
}

/// A checkbox row whose whole surface toggles — a 24px box is a mean target.
class AuthCheckRow extends StatelessWidget {
  final bool value;
  final ValueChanged<bool> onChanged;
  final Widget label;

  const AuthCheckRow({
    super.key,
    required this.value,
    required this.onChanged,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Pressable(
      onTap: () => onChanged(!value),
      radius: BorderRadius.circular(10),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 140),
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                color: value ? VeloSalesTheme.accentSolid : Colors.transparent,
                borderRadius: BorderRadius.circular(7),
                border: Border.all(
                  color: value
                      ? VeloSalesTheme.accentSolid
                      : scheme.onSurface.withValues(alpha: 0.28),
                  width: 1.6,
                ),
              ),
              child: value
                  ? const Icon(Icons.check_rounded, size: 15, color: Colors.white)
                  : null,
            ),
            const SizedBox(width: 11),
            Expanded(child: label),
          ],
        ),
      ),
    );
  }
}

/// The three states the form can be in, each with its own colour and its own
/// lift. Errors say what to do next; successes say what happens now.
class AuthNotice extends StatelessWidget {
  final String message;
  final AuthNoticeKind kind;
  const AuthNotice({super.key, required this.message, this.kind = AuthNoticeKind.error});

  @override
  Widget build(BuildContext context) {
    final (base, icon) = switch (kind) {
      AuthNoticeKind.error => (VeloSalesTheme.red, Icons.error_outline_rounded),
      AuthNoticeKind.done => (VeloSalesTheme.green, Icons.check_circle_outline_rounded),
      AuthNoticeKind.hint => (VeloSalesTheme.gold, Icons.info_outline_rounded),
    };
    return Container(
      padding: const EdgeInsets.fromLTRB(13, 12, 14, 12),
      decoration: BoxDecoration(
        color: base.withValues(alpha: 0.09),
        borderRadius: BorderRadius.circular(VeloSalesTheme.radiusSmall),
        border: Border.all(color: base.withValues(alpha: 0.34)),
        boxShadow: [
          BoxShadow(
            color: base.withValues(alpha: 0.16),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: base),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: TextStyle(
                fontSize: 13,
                height: 1.42,
                fontWeight: FontWeight.w600,
                color: Theme.of(context).colorScheme.onSurface,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

enum AuthNoticeKind { error, done, hint }

/// A quiet inline link (resend a code, use a link instead). Kept separate from
/// the footer prompt because these sit inside the form flow, not under it.
class AuthInlineLink extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;
  const AuthInlineLink({super.key, required this.label, this.onTap});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Pressable(
      onTap: onTap,
      radius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: onTap == null
                    ? scheme.onSurface.withValues(alpha: 0.35)
                    : scheme.primary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// "Already have an account? Sign in" — the switch between the two modes.
class AuthFooterPrompt extends StatelessWidget {
  final String prompt;
  final String action;
  final VoidCallback? onTap;

  const AuthFooterPrompt({
    super.key,
    required this.prompt,
    required this.action,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final dim = onTap == null;
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          prompt,
          style: TextStyle(
            fontSize: 13.5,
            color: scheme.onSurface.withValues(alpha: dim ? 0.30 : 0.58),
          ),
        ),
        Pressable(
          onTap: onTap,
          radius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 6),
            child: Text(
              action,
              style: TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w800,
                color: dim
                    ? scheme.primary.withValues(alpha: 0.40)
                    : scheme.primary,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
