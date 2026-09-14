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
  // mode: 0 login · 1 signup · 2 otp
  int _mode = 0;
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _pass = TextEditingController();
  final _phone = TextEditingController();
  final _code = TextEditingController();
  bool _busy = false;
  String? _err;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _pass.dispose();
    _phone.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _run(Future<void> Function() fn) async {
    setState(() {
      _busy = true;
      _err = null;
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
                const Text('VENDORA',
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
                          : 'Check your inbox for the 6-digit code.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey[400]),
                ),
                const SizedBox(height: 24),
                if (_mode != 2)
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
                if (_mode != 2)
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
                if (_err != null) ...[
                  const SizedBox(height: 12),
                  Text(_err!,
                      style: const TextStyle(color: Colors.redAccent)),
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
                              );
                              // Dev-mode auto-login (email service off) skips OTP.
                              if (b['auto'] == true) {
                                widget.onAuthed();
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
                              : 'Verify & enter'),
                ),
                if (_mode == 2)
                  TextButton(
                    onPressed: _busy
                        ? null
                        : () => _run(() => ApiClient.instance
                            .resendOtp(_email.text.trim())),
                    child: const Text('Resend code'),
                  ),
                if (_mode != 2)
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
