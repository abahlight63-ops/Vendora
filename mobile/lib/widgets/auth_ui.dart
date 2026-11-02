// ── lib/widgets/auth_ui.dart ─────────────────────────────────────
// WHAT: the sign-in / sign-up surface, as its own small kit, in the same premium
// style as the welcome slides: a real photo at the top with a WhatsApp message
// on it, then a dark glass panel with the form. Sign in and Create account are
// two tabs, and the main action is the long coral pill with the white circle.
//
// The screen is dark in both themes, like the welcome: it is the front door, not
// the app. Every tappable thing is a `Pressable`, so the press motion matches.
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../brand_mark.dart';
import '../motion.dart';
import '../theme.dart';
import 'brand_ui.dart';

const authNight = Color(0xFF0B0630);
const _lilac = Color(0xFFC9C2F5);
const _coral = Color(0xFFD03C16);
const _coralBright = Color(0xFFFF8A6B);
const _fieldFill = Color(0x14FFFFFF); // white 8%
const _fieldLine = Color(0x2EFFFFFF); // white 18%

/// The photo at the top: hands on a phone, a WhatsApp message tilted over it,
/// the brand, and a back circle when the welcome sent us here.
class AuthHeader extends StatelessWidget {
  final double height;
  final String tagline;
  final VoidCallback? onBack;

  const AuthHeader({super.key, this.height = 250, required this.tagline, this.onBack});

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return SizedBox(
      height: height + top,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Image.asset('assets/welcome/s1.jpg', fit: BoxFit.cover, alignment: const Alignment(0, -0.2)),
          const ColoredBox(color: Color(0x332A1C7A)),
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0x990B0630), Color(0x110B0630), Color(0xF20B0630)],
                stops: [0, 0.4, 1],
              ),
            ),
          ),
          Positioned(
            top: top + 14,
            left: 16,
            right: 16,
            child: Row(
              children: [
                if (onBack != null) ...[
                  Semantics(
                    button: true,
                    label: 'Back',
                    excludeSemantics: true,
                    child: Pressable(
                      onTap: onBack,
                      radius: BorderRadius.circular(999),
                      child: Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white.withValues(alpha: 0.14),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.24)),
                        ),
                        child: const Icon(Icons.chevron_left_rounded, color: Colors.white, size: 26),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                ],
                const BrandMark(size: 24),
                const SizedBox(width: 8),
                const Text('VeloSales Ai',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white)),
              ],
            ),
          ),
          Positioned(
            left: 20,
            right: 20,
            bottom: 36,
            child: Align(
              alignment: Alignment.centerLeft,
              child: Transform.rotate(
                angle: -8 * math.pi / 180,
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Container(
                    padding: const EdgeInsets.fromLTRB(8, 8, 20, 8),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.95),
                      borderRadius: BorderRadius.circular(999),
                      boxShadow: [
                        BoxShadow(color: Colors.black.withValues(alpha: 0.33), blurRadius: 30, offset: const Offset(0, 16)),
                      ],
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Image.asset('assets/channels/whatsapp.png', width: 42, height: 42),
                        const SizedBox(width: 10),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Velo',
                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xB81E1757))),
                            Text(tagline,
                                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF1E1757))),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The dark glass panel that rises over the photo and scrolls the form.
class AuthPanel extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;

  const AuthPanel({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.fromLTRB(20, 24, 20, 28),
  });

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    return Container(
      decoration: const BoxDecoration(
        borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF231868), Color(0xFF120B4A), authNight],
          stops: [0, 0.45, 1],
        ),
        border: Border(top: BorderSide(color: Color(0x33FFFFFF))),
      ),
      child: ScrollConfiguration(
        behavior: const ScrollBehavior().copyWith(overscroll: false),
        child: SingleChildScrollView(
          padding: padding.add(EdgeInsets.only(bottom: bottom)),
          child: DefaultTextStyle.merge(
            style: const TextStyle(color: Colors.white),
            child: child,
          ),
        ),
      ),
    );
  }
}

/// Sign in | Create account — an outlined pill with the chosen side solid white.
class AuthTabs extends StatelessWidget {
  final int value; // 0 sign in, 1 create account
  final ValueChanged<int>? onChanged;
  const AuthTabs({super.key, required this.value, this.onChanged});

  @override
  Widget build(BuildContext context) {
    Widget tab(int i, String label) => Expanded(
          child: Semantics(
            button: true,
            selected: value == i,
            child: Pressable(
              onTap: onChanged == null ? null : () => onChanged!(i),
              radius: BorderRadius.circular(999),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                height: 48,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: value == i ? Colors.white : Colors.transparent,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: value == i ? const Color(0xFF1E1757) : Colors.white,
                  ),
                ),
              ),
            ),
          ),
        );
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.white.withValues(alpha: 0.36), width: 1.5),
      ),
      child: Row(children: [tab(0, 'Sign in'), tab(1, 'Create account')]),
    );
  }
}

class AuthPanelTitle extends StatelessWidget {
  final String title;
  final String? subtitle;
  const AuthPanelTitle({super.key, required this.title, this.subtitle});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 34,
            height: 1.05,
            fontWeight: FontWeight.w600,
            letterSpacing: -1.2,
            color: Colors.white,
          ),
        ),
        if (subtitle != null) ...[
          const SizedBox(height: 8),
          Text(
            subtitle!,
            style: TextStyle(fontSize: 14, height: 1.5, color: Colors.white.withValues(alpha: 0.74)),
          ),
        ],
      ],
    );
  }
}

/// A dark glass field: icon, words, and an eye for passwords. The border turns
/// coral while the field has focus.
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
    final muted = Colors.white.withValues(alpha: 0.6);
    return AnimatedContainer(
      duration: const Duration(milliseconds: 140),
      curve: Curves.easeOut,
      constraints: const BoxConstraints(minHeight: 58),
      decoration: BoxDecoration(
        color: _focused ? const Color(0x1FFFFFFF) : _fieldFill,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _focused ? _coralBright : _fieldLine, width: 1.5),
      ),
      child: Row(
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 16, right: 4),
            child: Icon(widget.icon, size: 20, color: _focused ? _coralBright : muted),
          ),
          Expanded(
            child: TextField(
              controller: widget.controller,
              focusNode: _focus,
              obscureText: _hidden,
              keyboardType: widget.keyboardType,
              textCapitalization: widget.textCapitalization,
              maxLength: widget.maxLength,
              textAlign: widget.textAlign,
              cursorColor: _coralBright,
              onChanged: widget.onChanged,
              onEditingComplete: widget.onEditingComplete,
              style: widget.textStyle ??
                  const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w600, color: Colors.white),
              decoration: InputDecoration(
                isDense: true,
                counterText: '',
                filled: false,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                errorBorder: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 18),
                hintText: widget.hint,
                hintStyle: TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: Colors.white.withValues(alpha: 0.5)),
              ),
            ),
          ),
          if (widget.obscure)
            IconButton(
              onPressed: () => setState(() => _hidden = !_hidden),
              icon: Icon(_hidden ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 20),
              color: muted,
              tooltip: _hidden ? 'Show password' : 'Hide password',
            )
          else if (widget.suffix != null)
            Padding(padding: const EdgeInsets.only(right: 10), child: widget.suffix),
        ],
      ),
    );
  }
}

/// The main action: the long coral pill with the white circle and arrow. Busy
/// is a state of the same button, so it never jumps.
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
    final lit = enabled || busy;
    return Semantics(
      button: true,
      label: busy ? (busyLabel ?? label) : label,
      excludeSemantics: true,
      child: Pressable(
        onTap: enabled ? onPressed : null,
        radius: BorderRadius.circular(999),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 140),
          height: 66,
          padding: const EdgeInsets.only(left: 26, right: 7),
          decoration: BoxDecoration(
            color: lit ? _coral : _coral.withValues(alpha: 0.42),
            borderRadius: BorderRadius.circular(999),
            boxShadow: lit
                ? [BoxShadow(color: _coral.withValues(alpha: 0.38), blurRadius: 26, offset: const Offset(0, 12))]
                : null,
          ),
          child: Row(
            children: [
              if (busy) ...[
                const OrbitLoader(size: 18, color: Colors.white),
                const SizedBox(width: 10),
              ],
              Expanded(
                child: Text(
                  busy ? (busyLabel ?? label) : label,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w600),
                ),
              ),
              if (!busy)
                for (final o in const [0.35, 0.65, 1.0])
                  Icon(Icons.chevron_right_rounded, size: 18, color: Colors.white.withValues(alpha: o)),
              const SizedBox(width: 10),
              Container(
                width: 52,
                height: 52,
                decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                child: Icon(icon ?? Icons.arrow_forward_rounded, color: _coral, size: 24),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class AuthOrDivider extends StatelessWidget {
  final String label;
  const AuthOrDivider({super.key, this.label = 'or'});

  @override
  Widget build(BuildContext context) {
    final rule = Container(height: 1, color: Colors.white.withValues(alpha: 0.16));
    return Row(
      children: [
        Expanded(child: rule),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _lilac)),
        ),
        Expanded(child: rule),
      ],
    );
  }
}

/// Continue with Google: a white pill. Not wired on the phone yet; the screen
/// says so plainly when tapped.
class AuthSocialRow extends StatelessWidget {
  final VoidCallback? onGoogle;
  const AuthSocialRow({super.key, this.onGoogle});

  @override
  Widget build(BuildContext context) {
    return Pressable(
      onTap: onGoogle,
      radius: BorderRadius.circular(999),
      child: Container(
        height: 56,
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(999)),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CustomPaint(size: const Size(20, 20), painter: _GoogleGlyph()),
            const SizedBox(width: 10),
            const Text('Continue with Google',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Color(0xFF1E1757))),
          ],
        ),
      ),
    );
  }
}

/// The Google "G", drawn rather than packaged: four arcs whose angles are the
/// official artwork's, plus the blue bar.
class _GoogleGlyph extends CustomPainter {
  static const _blue = Color(0xFF4285F4);
  static const _red = Color(0xFFEA4335);
  static const _yellow = Color(0xFFFBBC05);
  static const _green = Color(0xFF34A853);

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.shortestSide;
    const stroke = 0.205;
    final ring = Rect.fromCircle(center: Offset(s / 2, s / 2), radius: (s - s * stroke) / 2);
    final p = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * stroke
      ..strokeCap = StrokeCap.butt
      ..isAntiAlias = true;
    void arc(Color c, double startDeg, double sweepDeg) {
      p.color = c;
      canvas.drawArc(ring, startDeg * math.pi / 180, sweepDeg * math.pi / 180, false, p);
    }

    arc(_red, -153.3, 119.3);
    arc(_yellow, 141.9, 64.8);
    arc(_green, 48.9, 93.0);
    arc(_blue, -17.2, 66.1);
    canvas.drawRect(Rect.fromLTRB(s * 0.5, s * 0.4167, s * 0.775, s * 0.605), Paint()..color = _blue);
  }

  @override
  bool shouldRepaint(_GoogleGlyph old) => false;
}

/// A checkbox row whose whole surface toggles.
class AuthCheckRow extends StatelessWidget {
  final bool value;
  final ValueChanged<bool> onChanged;
  final Widget label;

  const AuthCheckRow({super.key, required this.value, required this.onChanged, required this.label});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      checked: value,
      child: Pressable(
        onTap: () => onChanged(!value),
        radius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 2),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 140),
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  color: value ? _coral : Colors.transparent,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: value ? _coral : Colors.white.withValues(alpha: 0.4), width: 1.6),
                ),
                child: value ? const Icon(Icons.check_rounded, size: 16, color: Colors.white) : null,
              ),
              const SizedBox(width: 12),
              Expanded(child: label),
            ],
          ),
        ),
      ),
    );
  }
}

/// Wrong, done or a hint, each with its own colour. Errors say what to do next.
class AuthNotice extends StatelessWidget {
  final String message;
  final AuthNoticeKind kind;
  const AuthNotice({super.key, required this.message, this.kind = AuthNoticeKind.error});

  @override
  Widget build(BuildContext context) {
    final (base, icon) = switch (kind) {
      AuthNoticeKind.error => (const Color(0xFFFF8A8A), Icons.error_outline_rounded),
      AuthNoticeKind.done => (const Color(0xFF86EFAC), Icons.check_circle_outline_rounded),
      AuthNoticeKind.hint => (const Color(0xFFFCD34D), Icons.info_outline_rounded),
    };
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: base.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: base.withValues(alpha: 0.4)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: base),
          const SizedBox(width: 10),
          Expanded(
            child: Text(message,
                style: const TextStyle(fontSize: 13.5, height: 1.42, fontWeight: FontWeight.w600, color: Colors.white)),
          ),
        ],
      ),
    );
  }
}

enum AuthNoticeKind { error, done, hint }

/// A quiet inline link (resend a code, use a link instead).
class AuthInlineLink extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;
  const AuthInlineLink({super.key, required this.label, this.onTap});

  @override
  Widget build(BuildContext context) {
    return Pressable(
      onTap: onTap,
      radius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: onTap == null ? Colors.white.withValues(alpha: 0.35) : _coralBright,
          ),
        ),
      ),
    );
  }
}

/// "Already have an account? Sign in" — used on the code and reset screens.
class AuthFooterPrompt extends StatelessWidget {
  final String prompt;
  final String action;
  final VoidCallback? onTap;

  const AuthFooterPrompt({super.key, required this.prompt, required this.action, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final dim = onTap == null;
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(prompt, style: TextStyle(fontSize: 14, color: Colors.white.withValues(alpha: dim ? 0.3 : 0.7))),
        Pressable(
          onTap: onTap,
          radius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
            child: Text(
              action,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: Colors.white.withValues(alpha: dim ? 0.4 : 1),
                decoration: TextDecoration.underline,
                decorationColor: Colors.white,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Kept for callers that still pass the old brand colours.
Color authInk(BuildContext context) => VeloSalesTheme.nightInk;
