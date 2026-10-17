// ── lib/screens/settings_screen.dart ─────────────────────────────
// WHAT: the account screen — who you are, your profile picture, and the
// switches + doors that change how VeloSales Ai behaves.
//
// It mirrors the web's pages/Settings.jsx on purpose: the same two tinted
// groups, the same icon chips, the same wording. A shop owner who learns the
// map in the browser should recognise it on the phone.
//
// THE PICTURE IS REAL. Pick from the gallery → centre-crop to a square and
// shrink to 256px in a canvas → upload as a data URL → the hosted URL comes
// back and is shown immediately. The full-size photo never leaves the device,
// which is why a 6MB camera shot arrives at the server as ~90KB.
import 'dart:convert';
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../api.dart';
import '../format.dart';
import '../motion.dart';
import '../theme.dart';
import '../widgets/brand_ui.dart';
import 'help_screen.dart';
import 'profile_screen.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({
    super.key,
    required this.mode,
    required this.onMode,
    required this.onGoTab,
  });

  /// The shell owns the theme mode; this screen only asks it to change.
  final ThemeMode mode;
  final ValueChanged<ThemeMode> onMode;

  /// Billing lives in the shell's tab 5 — the drawer-sized page cannot own it.
  final ValueChanged<int> onGoTab;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  String _name = 'Your shop';
  String _handle = '';
  String _plan = '';
  String? _avatar;

  bool _bot = true; // the assistant's kill-switch (server default is ON)
  bool _loading = true;
  bool _photoBusy = false;
  bool _botBusy = false;
  late bool _dark = widget.mode == ThemeMode.dark; // its own copy: the pushed route keeps its state

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final me = await ApiClient.instance.me();
      final b = (me['business'] as Map).cast<String, dynamic>();
      final wa = b['whatsapp_number'] ?? b['owner_number'];
      if (!mounted) return;
      setState(() {
        _name = '${b['name'] ?? 'Your shop'}';
        _avatar = b['avatar_url'] as String?;
        _bot = b['bot_enabled'] != false; // undefined must read as ON
        _handle = (wa != null && '$wa'.isNotEmpty)
            ? 'WhatsApp ${prettyPhone(wa)}'
            : '${b['business_niche'] ?? ''}';
        _plan = b['tier'] == 'pro'
            ? (b['subscription_status'] == 'trialing' ? 'Pro trial' : 'Pro')
            : 'Free plan';
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      showToast(context, e.message, type: 'err');
    }
  }

  /// Centre-crop to a square, scale to 256, hand back PNG bytes.
  Future<Uint8List> _squarePng(Uint8List raw) async {
    final codec = await ui.instantiateImageCodec(raw);
    final frame = await codec.getNextFrame();
    final src = frame.image;
    final side = math.min(src.width, src.height).toDouble();
    final rec = ui.PictureRecorder();
    final canvas = Canvas(rec);
    canvas.drawImageRect(
      src,
      Rect.fromLTWH((src.width - side) / 2, (src.height - side) / 2, side, side),
      const Rect.fromLTWH(0, 0, 256, 256),
      Paint()..filterQuality = FilterQuality.high,
    );
    final out = await rec.endRecording().toImage(256, 256);
    final data = await out.toByteData(format: ui.ImageByteFormat.png);
    src.dispose();
    out.dispose();
    if (data == null) throw StateError('Could not encode the picture.');
    return data.buffer.asUint8List();
  }

  Future<void> _pickPhoto() async {
    if (_photoBusy) return;
    setState(() => _photoBusy = true);
    try {
      final picked = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        maxWidth: 1600,
        maxHeight: 1600,
      );
      if (picked == null) return; // cancelled the picker — nothing to do
      final png = await _squarePng(await picked.readAsBytes());
      final url = await ApiClient.instance
          .uploadAvatar('data:image/png;base64,${base64Encode(png)}');
      if (!mounted) return;
      setState(() => _avatar = url);
      showToast(context, 'Profile picture updated.');
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, type: 'err');
    } catch (_) {
      if (mounted) {
        showToast(context, 'Could not read that picture — try another.',
            type: 'err');
      }
    } finally {
      if (mounted) setState(() => _photoBusy = false);
    }
  }

  Future<void> _removePhoto() async {
    setState(() => _photoBusy = true);
    try {
      await ApiClient.instance.uploadAvatar(null);
      if (!mounted) return;
      setState(() => _avatar = null);
      showToast(context, 'Photo removed.');
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, type: 'err');
    } finally {
      if (mounted) setState(() => _photoBusy = false);
    }
  }

  Future<void> _toggleBot(bool next) async {
    setState(() {
      _bot = next; // optimistic: the switch reacts to the tap, not the network
      _botBusy = true;
    });
    try {
      final real = await ApiClient.instance.toggleBot(next);
      if (!mounted) return;
      setState(() => _bot = real);
      showToast(context,
          real ? 'Assistant replies ON' : 'Assistant replies PAUSED');
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _bot = !next); // roll back to the truth
      showToast(context, e.message, type: 'err');
    } finally {
      if (mounted) setState(() => _botBusy = false);
    }
  }

  // ── the profile card ───────────────────────────────────────────────
  Widget _avatarCircle() {
    final initial = (_name.trim().isEmpty ? 'V' : _name.trim()[0]).toUpperCase();
    return GestureDetector(
      onTap: _photoBusy ? null : _pickPhoto,
      child: Container(
        width: 62,
        height: 62,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: VeloSalesTheme.tintLavender(context),
          border: Border.all(color: VeloSalesTheme.purple.withValues(alpha: 0.28)),
        ),
        child: _avatar != null
            ? Image.network(
                _avatar!,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => Center(
                  child: Text(initial,
                      style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          color: VeloSalesTheme.purple)),
                ),
              )
            : Center(
                child: Text(initial,
                    style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: VeloSalesTheme.purple)),
              ),
      ),
    );
  }

  Widget _profileCard(ThemeData theme) {
    final muted = theme.colorScheme.onSurface.withValues(alpha: 0.6);
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 16, 12, 16),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Row(children: [
        _avatarCircle(),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(_name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.3)),
              if (_handle.isNotEmpty) ...[
                const SizedBox(height: 3),
                Text(_handle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 13, color: muted)),
              ],
            ],
          ),
        ),
        const SizedBox(width: 8),
        Pressable(
          onTap: _photoBusy ? null : _pickPhoto,
          radius: BorderRadius.circular(999),
          child: Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: theme.colorScheme.outlineVariant),
            ),
            child: Center(
              child: _photoBusy
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : Icon(Icons.edit_outlined, size: 19, color: muted),
            ),
          ),
        ),
      ]),
    );
  }

  // ── one tinted group ───────────────────────────────────────────────
  Widget _group(String title, bool warm, List<Widget> rows) {
    final accent = warm ? VeloSalesTheme.gold : VeloSalesTheme.purple;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final line = accent.withValues(alpha: 0.22);
    final fill = accent.withValues(alpha: isDark ? 0.12 : 0.07);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 10),
          child: Text(
            title.toUpperCase(),
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.9,
              color: Theme.of(context)
                  .colorScheme
                  .onSurface
                  .withValues(alpha: 0.55),
            ),
          ),
        ),
        Container(
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            color: fill,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: line),
          ),
          child: Column(children: [
            for (var i = 0; i < rows.length; i++) ...[
              if (i > 0) Divider(height: 1, thickness: 1, color: line),
              rows[i],
            ],
          ]),
        ),
      ],
    );
  }

  Widget _row({
    required IconData icon,
    required Color iconColor,
    required String title,
    String? subtitle,
    Widget? trailing,
    VoidCallback? onTap,
  }) {
    final theme = Theme.of(context);
    final body = Padding(
      padding: const EdgeInsets.fromLTRB(14, 13, 14, 13),
      child: Row(children: [
        // the chip is a surface colour, so it lifts off ANY tint
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: theme.colorScheme.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: theme.colorScheme.outlineVariant),
          ),
          child: Icon(icon, size: 19, color: iconColor),
        ),
        const SizedBox(width: 13),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title,
                  style: const TextStyle(
                      fontSize: 14.5, fontWeight: FontWeight.w700)),
              if (subtitle != null) ...[
                const SizedBox(height: 2),
                Text(subtitle,
                    style: TextStyle(
                        fontSize: 12.5,
                        height: 1.45,
                        color: theme.colorScheme.onSurface
                            .withValues(alpha: 0.55))),
              ],
            ],
          ),
        ),
        if (trailing != null) ...[const SizedBox(width: 10), trailing],
      ]),
    );
    return onTap == null ? body : InkWell(onTap: onTap, child: body);
  }

  Widget _chevron() => Icon(Icons.chevron_right_rounded,
      size: 20,
      color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.35));

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Settings'), centerTitle: true),
      body: _loading
          ? ListView(padding: const EdgeInsets.all(16), children: const [
              Skeleton(height: 94),
              SizedBox(height: 20),
              Skeleton(height: 132),
              SizedBox(height: 20),
              Skeleton(height: 196),
            ])
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
              children: [
                _profileCard(theme),
                if (_avatar != null)
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton(
                      onPressed: _photoBusy ? null : _removePhoto,
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.only(left: 4, top: 6),
                        minimumSize: const Size(0, 32),
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        foregroundColor:
                            theme.colorScheme.onSurface.withValues(alpha: 0.6),
                      ),
                      child: const Text('Remove photo',
                          style: TextStyle(
                              fontSize: 13, fontWeight: FontWeight.w600)),
                    ),
                  ),
                const SizedBox(height: 18),

                // ── group one ──
                _group('Shop & account', false, [
                  _row(
                    icon: Icons.forum_outlined,
                    iconColor: VeloSalesTheme.purple,
                    title: 'Assistant replies',
                    subtitle: _bot
                        ? 'Your AI answers customers automatically, day and night.'
                        : 'Paused — customers can still reach you, the AI just stays quiet.',
                    trailing: _Toggle(
                      on: _bot,
                      label: 'Assistant replies',
                      busy: _botBusy,
                      onChanged: _toggleBot,
                    ),
                  ),
                  _row(
                    icon: Icons.storefront_outlined,
                    iconColor: VeloSalesTheme.purple,
                    title: 'Business details',
                    subtitle:
                        'Shop name, WhatsApp number, opening hours and FAQs.',
                    trailing: _chevron(),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const ProfileScreen()),
                    ),
                  ),
                ]),
                const SizedBox(height: 22),

                // ── group two ──
                _group('App & support', true, [
                  _row(
                    icon: Icons.dark_mode_outlined,
                    iconColor: VeloSalesTheme.gold,
                    title: 'Dark mode',
                    subtitle: _dark
                        ? 'On — kinder on the eyes at night.'
                        : 'Off — the light theme is the default.',
                    trailing: _Toggle(
                      on: _dark,
                      label: 'Dark mode',
                      busy: false,
                      onChanged: (v) {
                        setState(() => _dark = v);
                        widget.onMode(v ? ThemeMode.dark : ThemeMode.light);
                      },
                    ),
                  ),
                  _row(
                    icon: Icons.credit_card_outlined,
                    iconColor: const Color(0xFF0284C7),
                    title: 'Plan & billing',
                    subtitle: 'See what you are on, and what a paid plan unlocks.',
                    trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                      Text(_plan,
                          style: TextStyle(
                              fontSize: 12.5,
                              color: theme.colorScheme.onSurface
                                  .withValues(alpha: 0.5))),
                      const SizedBox(width: 4),
                      _chevron(),
                    ]),
                    onTap: () {
                      Navigator.of(context).pop();
                      widget.onGoTab(5); // Billing is a shell tab
                    },
                  ),
                  _row(
                    icon: Icons.menu_book_outlined,
                    iconColor: VeloSalesTheme.green,
                    title: 'How to use VeloSales Ai',
                    subtitle: 'A short guided tour of every screen.',
                    trailing: _chevron(),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => HelpScreen(
                          onGoTab: (i) {
                            Navigator.of(context).pop(); // close the guide…
                            widget.onGoTab(i); // …and land on the tab it named
                          },
                        ),
                      ),
                    ),
                  ),
                ]),
              ],
            ),
    );
  }
}

// ── the switch ───────────────────────────────────────────────────────
// Drawn by hand rather than using Material's Switch so the ON colour is the
// brand accent (and so the geometry matches the web's 46×27 control). The
// SnackBar-free Semantics wrapper keeps it announced as a switch on Android.
class _Toggle extends StatelessWidget {
  const _Toggle({
    required this.on,
    required this.onChanged,
    required this.busy,
    required this.label,
  });

  final bool on;
  final ValueChanged<bool> onChanged;
  final bool busy;
  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Semantics(
      label: label,
      toggled: on,
      button: true,
      child: GestureDetector(
        onTap: busy ? null : () => onChanged(!on),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
          width: 46,
          height: 27,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(99),
            color: on
                ? VeloSalesTheme.accentSolid
                : theme.colorScheme.surfaceContainerHighest,
            border: Border.all(
              color: on
                  ? VeloSalesTheme.accentSolid
                  : theme.colorScheme.outlineVariant,
            ),
          ),
          child: AnimatedAlign(
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOut,
            alignment: on ? Alignment.centerRight : Alignment.centerLeft,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 3),
              child: Container(
                width: 21,
                height: 21,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white,
                  boxShadow: [
                    BoxShadow(
                        color: Color(0x33000000),
                        blurRadius: 3,
                        offset: Offset(0, 1)),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
