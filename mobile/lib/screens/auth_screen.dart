// ── lib/screens/auth_screen.dart ─────────────────────────────────
// WHAT: login + signup + OTP in ONE screen (segmented modes). Mirrors the
// web Login page flow: signup → OTP emailed → verify-otp → in. Login with
// an unverified email drops you to OTP automatically (backend 403 pattern).
import 'package:flutter/material.dart';

import '../api.dart';

class AuthScreen extends StatefulWidget {
  final VoidCallback onAuthed;
  const AuthScreen({super.key, required this.onAuthed});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  // mode: 0 login · 1 signup · 2 otp · 3 forgot (reset link via email,
  // opened in the browser — deep links are phase 2, the email works today!)
  int _mode = 0;
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _pass = TextEditingController();
  final _phone = TextEditingController();
  final _code = TextEditingController();
  final _ref = TextEditingController(); // referral/promo code (optional — bonus for both sides!)
  bool _busy = false;
  String? _err;
  String? _ok; // green confirmation line (link sent, code resent — success needs a voice too!)
  String? _refMsg; // live reward preview ("Reward attached…") or null
  bool _refOk = false; // green (attached!) vs red (unknown code — signup still works!)

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _pass.dispose();
    _phone.dispose();
    _code.dispose();
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
      setState(() => _err = 'No connection — check internet and retry.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text('VELOSALES AI',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 6)),
                const SizedBox(height: 6),
                Text(
                  _mode == 0
                      ? 'Welcome back — your shop never slept.'
                      : _mode == 1
                          ? 'Open your 24/7 shop in minutes.'
                          : _mode == 3
                              ? 'Locked out? We all forget things.'
                              : 'Check your inbox for the 6-digit code.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey[400]),
                ),
                const SizedBox(height: 24),
                if (_mode == 0 || _mode == 1)
                  SegmentedButton<int>(
                    segments: const [
                      ButtonSegment(value: 0, label: Text('Sign in')),
                      ButtonSegment(value: 1, label: Text('Sign up')),
                    ],
                    selected: {_mode},
                    onSelectionChanged: (s) =>
                        setState(() => _mode = s.first),
                  ),
                const SizedBox(height: 16),
                if (_mode == 1)
                  TextField(
                      controller: _name,
                      textCapitalization: TextCapitalization.words,
                      decoration:
                          const InputDecoration(labelText: 'Shop name')),
                if (_mode == 1) const SizedBox(height: 12),
                if (_mode != 2)
                  TextField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      decoration:
                          const InputDecoration(labelText: 'Email')),
                if (_mode != 2) const SizedBox(height: 12),
                if (_mode == 0 || _mode == 1)
                  TextField(
                      controller: _pass,
                      obscureText: true,
                      decoration: InputDecoration(
                          labelText: _mode == 1
                              ? 'Password (min 8 chars)'
                              : 'Password')),
                if (_mode == 1) const SizedBox(height: 12),
                if (_mode == 1)
                  TextField(
                      controller: _phone,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(
                          labelText: 'WhatsApp number',
                          hintText: '0803 123 4567')),
                if (_mode == 1) const SizedBox(height: 12),
                if (_mode == 1)
                  TextField(
                      controller: _ref,
                      textCapitalization: TextCapitalization.characters,
                      onChanged: (_) => setState(() {
                        _refMsg = null; // typing clears the preview (recheck on blur!)
                        _refOk = false;
                      }),
                      onEditingComplete: _checkRef, // done typing → validate + show the reward!
                      decoration: const InputDecoration(
                          labelText: 'Referral code (optional)',
                          hintText: 'e.g. AMAKA-4F2K')),
                if (_mode == 1 && _refMsg != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(_refMsg!,
                        style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600,
                            color: _refOk ? Colors.green : Colors.orange)),
                  ),
                if (_mode == 2)
                  TextField(
                      controller: _code,
                      keyboardType: TextInputType.number,
                      maxLength: 6,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                          fontSize: 28,
                          letterSpacing: 8,
                          fontWeight: FontWeight.bold),
                      decoration:
                          const InputDecoration(labelText: '6-digit code')),
                if (_mode == 3)
                  const Padding(
                    padding: EdgeInsets.only(top: 6),
                    child: Text(
                        'Type your account email — we send a reset link (1 hour). Open it in your browser, set a new password, then sign in here.',
                        style: TextStyle(fontSize: 12.5)),
                  ),
                if (_err != null) ...[
                  const SizedBox(height: 12),
                  Text(_err!,
                      style: const TextStyle(color: Colors.redAccent)),
                ],
                if (_ok != null) ...[
                  const SizedBox(height: 12),
                  Text(_ok!, style: const TextStyle(color: Colors.green)),
                ],
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: _busy
                      ? null
                      : () => _run(() async {
                            if (_mode == 0) {
                              await ApiClient.instance.login(
                                  _email.text.trim(), _pass.text);
                              widget.onAuthed();
                            } else if (_mode == 1) {
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
                              if (b['auto'] == true) {
                                widget.onAuthed();
                              } else if (_mode == 3) {
                                await ApiClient.instance
                                    .forgot(_email.text.trim());
                                if (!mounted) return;
                                setState(() => _ok =
                                    'Reset link sent — check your inbox (and spam). Open it, set a password, then sign in here.');
                              } else {
                                setState(() => _mode = 2);
                              }
                            } else {
                              await ApiClient.instance.verifyOtp(
                                  _email.text.trim(), _code.text.trim());
                              widget.onAuthed();
                            }
                          }),
                  child: Text(_busy
                      ? 'Please wait…'
                      : _mode == 0
                          ? 'Sign in'
                          : _mode == 1
                              ? 'Create shop — free trial'
                              : _mode == 3
                                  ? 'Send reset link'
                                  : 'Verify & enter'),
                ),
                if (_mode == 2) ...[
                  TextButton(
                    onPressed: _busy
                        ? null
                        : () => _run(() => ApiClient.instance
                            .resendOtp(_email.text.trim())),
                    child: const Text('Resend code'),
                  ),
                  TextButton(
                    onPressed: _busy
                        ? null
                        : () => _run(() async {
                              final r = await ApiClient.instance
                                  .otpLink(_email.text.trim());
                              if (!mounted) return;
                              setState(() => _ok =
                                  '${r['message'] ?? 'Link sent — check your inbox AND spam folder.'}');
                            }),
                    child: const Text('Email didn\'t arrive? Send a link instead'),
                  ),
                ],
                if (_mode == 0)
                  TextButton(
                    onPressed: () => setState(() => _mode = 3),
                    child: const Text('Forgot password?'),
                  ),
                if (_mode == 3)
                  TextButton(
                    onPressed: () => setState(() => _mode = 0),
                    child: const Text('Back to sign in'),
                  ),
                if (_mode == 0 || _mode == 1)
                  TextButton(
                    onPressed: () =>
                        setState(() => _mode = _mode == 0 ? 1 : 0),
                    child: Text(_mode == 0
                        ? 'New here? Create a shop'
                        : 'Have an account? Sign in'),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
