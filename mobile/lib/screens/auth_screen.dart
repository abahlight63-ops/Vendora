// ── lib/screens/auth_screen.dart ─────────────────────────────────
// WHAT: login + signup + OTP + forgot, in ONE screen (segmented modes).
// Mirrors the web Login page flow: signup → OTP emailed → verify-otp → in.
// Login with an unverified email drops you to OTP automatically (the backend
// answers 403 for that).
//
// The look is built from widgets/auth_ui.dart — a purple band with the brand
// on it, and a white panel that rises out of it. The logic below is the same
// calls the app always made; only the order of the mode-3 branch was wrong
// (it fell through to "verify code"), so it is written out explicitly now.
import 'package:flutter/material.dart';
import 'package:flutter/gestures.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/auth_ui.dart';
import 'legal_screen.dart';

class AuthScreen extends StatefulWidget {
  final VoidCallback onAuthed;
  const AuthScreen({super.key, required this.onAuthed});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  // mode: 0 login · 1 signup · 2 otp · 3 forgot (reset link via email, opened
  // in the browser — deep links are phase 2, the email works today!)
  int _mode = 0;
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _pass = TextEditingController();
  final _phone = TextEditingController();
  final _code = TextEditingController();
  final _ref = TextEditingController(); // referral/promo code (optional — bonus for both sides!)
  final _newPass = TextEditingController(); // forgot-code path: new password (8+ chars!)
  final _newPass2 = TextEditingController(); // forgot-code path: repeat (must match!)
  bool _forReset = false; // true = OTP screen is proving inbox for a PASSWORD RESET (submit sets password, no login!)
  bool _agreed = false; // signup: Terms + Privacy accepted (signup only!)
  bool _busy = false;
  String? _err;
  String? _ok; // green confirmation line (link sent, code resent — success needs a voice too!)
  String? _refMsg; // live reward preview ("Reward attached…") or null
  bool _refOk = false; // green (attached!) vs amber (unknown code — signup still works!)

  // The two links inside the consent line. Created once so a rebuild does not
  // leak a recognizer, and disposed with the screen.
  late final TapGestureRecognizer _termsTap = TapGestureRecognizer()
    ..onTap = () => _openLegal(LegalDoc.terms);
  late final TapGestureRecognizer _privacyTap = TapGestureRecognizer()
    ..onTap = () => _openLegal(LegalDoc.privacy);

  void _openLegal(LegalDoc d) {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => LegalScreen(initial: d),
    ));
  }

  @override
  void dispose() {
    _termsTap.dispose();
    _privacyTap.dispose();
    _name.dispose();
    _email.dispose();
    _pass.dispose();
    _phone.dispose();
    _code.dispose();
    _newPass.dispose();
    _newPass2.dispose();
    _ref.dispose();
    super.dispose();
  }

  /// Live code check (on blur — no request per keystroke!).
  Future<void> _checkRef() async {
    final c = _ref.text.trim();
    if (c.isEmpty) {
      if (mounted) setState(() { _refMsg = null; _refOk = false; });
      return;
    }
    try {
      final r = await ApiClient.instance.checkReferral(c);
      if (!mounted) return;
      if (r['valid'] == true) {
        setState(() { _refOk = true; _refMsg = '${r['reward'] ?? 'Reward attached!'}'; });
      } else {
        setState(() { _refOk = false; _refMsg = 'Code not recognised — signup still works, just no bonus.'; });
      }
    } catch (_) {
      // Offline → silent (server rechecks at signup anyway!).
    }
  }

  Future<void> _run(Future<void> Function() fn) async {
    setState(() {
      _busy = true;
      _err = null;
      _ok = null;
    });
    try {
      await fn();
    } on ApiException catch (e) {
      // Backend refuses login for unverified emails → park on OTP screen.
      if (_mode == 0 && e.status == 403) {
        setState(() => _mode = 2);
      } else {
        setState(() => _err = e.message);
      }
    } catch (e) {
      setState(() => _err = 'No connection — check your internet and try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _go(int mode) {
    setState(() {
      _mode = mode;
      _err = null;
      _ok = null;
      if (mode != 2) _forReset = false;
    });
  }

  /// What the primary button does, per mode. Same calls as before.
  Future<void> _submit() async {
    FocusScope.of(context).unfocus();

    // The one gate before signup: the box, then the shop exists.
    if (_mode == 1 && !_agreed) {
      setState(() => _err =
          'Tick the box to accept the Terms and Privacy Policy, then create your shop.');
      return;
    }

    await _run(() async {
      if (_mode == 0) {
        await ApiClient.instance.login(_email.text.trim(), _pass.text);
        widget.onAuthed();
        return;
      }

      if (_mode == 1) {
        final b = await ApiClient.instance.signup(
          _name.text.trim(),
          _email.text.trim(),
          _pass.text,
          _phone.text.trim(),
          _ref.text.trim().isEmpty
              ? null
              : _ref.text.trim(), // omitted when blank = organic signup!
        );
        // Dev-mode auto-login (email service off) skips OTP.
        if (!mounted) return;
        if (b['auto'] == true) {
          widget.onAuthed();
        } else {
          setState(() => _mode = 2);
        }
        return;
      }

      if (_mode == 2) {
        if (_forReset) {
          // FORGOT-CODE path: code + NEW password in one call (no login — back to sign in!).
          if (_newPass.text.length < 8) {
            setState(() => _err = 'New password must be at least 8 characters.');
            return;
          }
          if (_newPass.text != _newPass2.text) {
            setState(() => _err = 'Passwords don’t match — retype both.');
            return;
          }
          await ApiClient.instance.resetOtp(
              _email.text.trim(), _code.text.trim(), _newPass.text);
          if (!mounted) return;
          setState(() {
            _forReset = false;
            _mode = 0;
            _ok = 'Password set — sign in with the new one.';
          });
          return;
        }
        await ApiClient.instance.verifyOtp(_email.text.trim(), _code.text.trim());
        widget.onAuthed();
        return;
      }

      // mode 3 — send the reset link to the browser.
      await ApiClient.instance.forgot(_email.text.trim());
      if (!mounted) return;
      setState(() => _ok =
          'Reset link sent — check your inbox (and spam). Open it, set a new password, then sign in here.');
    });
  }

  /// Google/Apple are drawn on the screen but no provider is switched on yet.
  /// Saying so plainly beats a button that silently does nothing.
  void _notWired(String provider) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.lock_clock_outlined, size: 18, color: Colors.white),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  '$provider sign-in is not switched on yet. Use your email — it works today.',
                  style: const TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white),
                ),
              ),
            ],
          ),
          backgroundColor: VeloSalesTheme.purpleDark,
          duration: const Duration(seconds: 4),
        ),
      );
  }

  String get _title => switch (_mode) {
        0 => 'Sign in',
        1 => 'Create An Account',
        2 => _forReset ? 'Set a new password' : 'Verify your email',
        _ => 'Reset your password',
      };

  String get _subtitle => switch (_mode) {
        0 => 'Use the email and password you signed up with.',
        1 => 'Free for 7 days, no card. Your shop is live the moment you are in.',
        2 => _forReset
            ? 'Enter the 6-digit code we emailed, plus the new password you want.'
            : 'We emailed a 6-digit code to ${_email.text.trim().isEmpty ? 'your inbox' : _email.text.trim()}. It can take a minute — check spam too.',
        _ => 'Type your account email and we will send a reset link. Open it in your browser, set a new password, then sign in here.',
      };

  String get _action => switch (_mode) {
        0 => 'Sign in',
        1 => 'Create my shop',
        2 => _forReset ? 'Set new password' : 'Verify and enter',
        _ => 'Send reset link',
      };

  String get _tagline => switch (_mode) {
        0 => 'Welcome back — your shop never slept.',
        1 => 'Your 24/7 shop, live in minutes.',
        2 => _forReset ? 'Almost there — one last step.' : 'One code and you are in.',
        _ => 'We all forget things.',
      };

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final signup = _mode == 1;

    return Scaffold(
      backgroundColor: scheme.surface,
      body: Column(
        children: [
          AuthHeader(tagline: _tagline),
          Expanded(
            child: AuthPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  AuthPanelTitle(title: _title, subtitle: _subtitle),
                  const SizedBox(height: 22),
                  ..._fields(),
                  if (signup) ...[
                    const SizedBox(height: 16),
                    AuthCheckRow(
                      value: _agreed,
                      onChanged: (v) => setState(() {
                        _agreed = v;
                        if (v) _err = null;
                      }),
                      label: _termsLabel(scheme),
                    ),
                  ],
                  if (_err != null) ...[
                    const SizedBox(height: 16),
                    AuthNotice(message: _err!),
                  ],
                  if (_ok != null) ...[
                    const SizedBox(height: 16),
                    AuthNotice(message: _ok!, kind: AuthNoticeKind.done),
                  ],
                  const SizedBox(height: 20),
                  AuthPrimaryButton(
                    label: _action,
                    busy: _busy,
                    busyLabel: 'Please wait…',
                    onPressed: _busy ? null : _submit,
                  ),
                  if (signup) ...[
                    const SizedBox(height: 24),
                    const AuthOrDivider(),
                    const SizedBox(height: 18),
                    AuthSocialRow(
                      onGoogle: () => _notWired('Google'),
                      onApple: () => _notWired('Apple'),
                    ),
                  ],
                  const SizedBox(height: 18),
                  _footer(),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _termsLabel(ColorScheme scheme) => Text.rich(
        TextSpan(
          style: TextStyle(
            fontSize: 12.5,
            height: 1.45,
            color: scheme.onSurface.withValues(alpha: 0.66),
          ),
          children: [
            const TextSpan(text: 'I agree to the '),
            TextSpan(
              text: 'Terms of Service',
              recognizer: _termsTap,
              style: TextStyle(
                  fontWeight: FontWeight.w800,
                  color: scheme.primary,
                  decoration: TextDecoration.underline,
                  decorationColor: scheme.primary.withValues(alpha: 0.45)),
            ),
            const TextSpan(text: ' and '),
            TextSpan(
              text: 'Privacy Policy',
              recognizer: _privacyTap,
              style: TextStyle(
                  fontWeight: FontWeight.w800,
                  color: scheme.primary,
                  decoration: TextDecoration.underline,
                  decorationColor: scheme.primary.withValues(alpha: 0.45)),
            ),
            const TextSpan(text: '.'),
          ],
        ),
      );

  /// The fields for the current mode, top to bottom.
  List<Widget> _fields() {
    final out = <Widget>[];
    void add(Widget w, {double gap = 13}) {
      if (out.isNotEmpty) out.add(SizedBox(height: gap));
      out.add(w);
    }

    if (_mode == 1) {
      add(AuthField(
        icon: Icons.storefront_outlined,
        hint: 'Shop name',
        controller: _name,
        textCapitalization: TextCapitalization.words,
      ));
    }

    if (_mode != 2) {
      add(AuthField(
        icon: Icons.alternate_email_rounded,
        hint: _mode == 3 ? 'Your account email' : 'Email address',
        controller: _email,
        keyboardType: TextInputType.emailAddress,
      ));
    }

    if (_mode == 0 || _mode == 1) {
      add(AuthField(
        icon: Icons.lock_outline_rounded,
        hint: _mode == 1 ? 'Password (8+ characters)' : 'Password',
        controller: _pass,
        obscure: true,
      ));
    }

    if (_mode == 0) {
      add(
        Align(
          alignment: Alignment.centerRight,
          child: AuthInlineLink(
            label: 'Forgot password?',
            onTap: _busy ? null : () => _go(3),
          ),
        ),
        gap: 4,
      );
    }

    if (_mode == 1) {
      add(AuthField(
        icon: Icons.chat_outlined,
        hint: 'WhatsApp number',
        controller: _phone,
        keyboardType: TextInputType.phone,
      ));
      add(Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AuthField(
            icon: Icons.card_giftcard_rounded,
            hint: 'Referral code (optional)',
            controller: _ref,
            textCapitalization: TextCapitalization.characters,
            onChanged: (_) => setState(() {
              _refMsg = null; // typing clears the preview (recheck on blur!)
              _refOk = false;
            }),
            onEditingComplete: _checkRef, // done typing → validate + show the reward!
          ),
          if (_refMsg != null)
            Padding(
              padding: const EdgeInsets.only(top: 9, left: 4, right: 4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    _refOk ? Icons.check_circle_rounded : Icons.info_outline_rounded,
                    size: 15,
                    color: _refOk ? VeloSalesTheme.green : VeloSalesTheme.gold,
                  ),
                  const SizedBox(width: 7),
                  Expanded(
                    child: Text(
                      _refMsg!,
                      style: TextStyle(
                        fontSize: 12.5,
                        height: 1.35,
                        fontWeight: FontWeight.w600,
                        color: _refOk
                            ? VeloSalesTheme.greenDark
                            : VeloSalesTheme.gold,
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ));
    }

    if (_mode == 2) {
      add(AuthField(
        icon: Icons.password_rounded,
        hint: '6-digit code',
        controller: _code,
        keyboardType: TextInputType.number,
        maxLength: 6,
        textAlign: TextAlign.center,
        textStyle: TextStyle(
          fontSize: 24,
          letterSpacing: 10,
          fontWeight: FontWeight.w800,
          color: Theme.of(context).colorScheme.onSurface,
        ),
      ));
      if (_forReset) {
        add(AuthField(
          icon: Icons.lock_outline_rounded,
          hint: 'New password (8+ characters)',
          controller: _newPass,
          obscure: true,
        ));
        add(AuthField(
          icon: Icons.lock_reset_rounded,
          hint: 'Repeat new password',
          controller: _newPass2,
          obscure: true,
        ));
      }
    }

    if (_mode == 3) {
      add(
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.info_outline_rounded,
                size: 15, color: VeloSalesTheme.gold),
            const SizedBox(width: 7),
            Expanded(
              child: Text(
                'The link lasts 1 hour. It opens in your browser, where you set the new password.',
                style: TextStyle(
                  fontSize: 12.5,
                  height: 1.4,
                  fontWeight: FontWeight.w600,
                  color: Theme.of(context)
                      .colorScheme
                      .onSurface
                      .withValues(alpha: 0.58),
                ),
              ),
            ),
          ],
        ),
        gap: 10,
      );
    }

    return out;
  }

  Widget _footer() {
    if (_mode == 0) {
      return AuthFooterPrompt(
        prompt: 'New here?',
        action: 'Create an account',
        onTap: _busy ? null : () => _go(1),
      );
    }
    if (_mode == 1) {
      return AuthFooterPrompt(
        prompt: 'Already have an account?',
        action: 'Sign in',
        onTap: _busy ? null : () => _go(0),
      );
    }
    if (_mode == 2) {
      return Column(
        children: [
          AuthInlineLink(
            label: 'Resend code',
            onTap: _busy
                ? null
                : () => _run(() async {
                      if (_forReset) {
                        await ApiClient.instance.forgotOtp(_email.text.trim());
                      } else {
                        await ApiClient.instance.resendOtp(_email.text.trim());
                      }
                    }),
          ),
          AuthInlineLink(
            label: "Email didn't arrive? Send a link instead",
            onTap: _busy
                ? null
                : () => _run(() async {
                      final r = await ApiClient.instance.otpLink(_email.text.trim());
                      if (!mounted) return;
                      setState(() => _ok =
                          '${r['message'] ?? 'Link sent — check your inbox AND spam folder.'}');
                    }),
          ),
        ],
      );
    }
    return Column(
      children: [
        AuthInlineLink(
          label: 'Send a code instead',
          onTap: _busy
              ? null
              : () => _run(() async {
                    await ApiClient.instance.forgotOtp(_email.text.trim());
                    if (!mounted) return;
                    setState(() {
                      _forReset = true;
                      _mode = 2;
                    });
                  }),
        ),
        AuthInlineLink(
          label: 'Back to sign in',
          onTap: _busy ? null : () => _go(0),
        ),
      ],
    );
  }
}
