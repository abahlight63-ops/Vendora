// ── lib/screens/chats_screen.dart ─────────────────────────────────
// WHAT: the phone inbox — the web's Chats.jsx in one column.
//
// Web parity, on frosted glass: the title, search, one row of filters, chats that
// need you first in brighter cards, then the rest in one glass panel. A pushed
// conversation has the same Velo/You switch, bubbles and composer. Customer details
// sit in a bottom sheet behind the header's info key.
//
// Outgoing bubbles carry no sender name: messages do not record yet whether Velo
// or the owner sent them, so the UI must not guess.
//
// Every list comes from /api/me/conversations; every thread from /messages.
// No sample chats, no invented counts.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api.dart';
import '../format.dart';
import '../glass.dart';
import '../motion.dart';
import '../theme.dart';
import '../widgets/brand_ui.dart';
import '../widgets/channel_marks.dart';

/// WhatsApp unless the backend says Telegram. Rows written before the channel
/// column existed come back null; treating those as WhatsApp keeps old chats
/// visible instead of silently vanishing behind a filter nobody set.
SalesChannel _channelOf(Map c) =>
    '${c['channel'] ?? 'whatsapp'}' == 'telegram'
        ? SalesChannel.telegram
        : SalesChannel.whatsapp;


class ChatsScreen extends StatefulWidget {
  const ChatsScreen({super.key});

  @override
  State<ChatsScreen> createState() => _ChatsScreenState();
}

class _ChatsScreenState extends State<ChatsScreen> {
  List<dynamic>? _chats;
  String _filter = 'all'; // 'all' | 'needs' | 'handled'
  String _chan = 'all'; // 'all' | 'whatsapp' | 'telegram'
  String _q = '';
  final _find = TextEditingController();
  String? _err;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _find.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    if (mounted) {
      setState(() {
        _loading = true;
        _err = null;
      });
    }
    try {
      final rows = await ApiClient.instance.conversations();
      if (mounted) setState(() => _chats = rows);
    } on ApiException catch (e) {
      if (mounted) setState(() => _err = e.message);
    } catch (_) {
      if (mounted) setState(() => _err = 'No connection.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<dynamic> get _list {
    final all = _chats ?? [];
    final needle = _q.trim().toLowerCase();
    return all
        .where((c) => _chan == 'all' || _channelOf(c as Map).name == _chan)
        .where((c) => _filter == 'needs'
            ? (c as Map)['needs_human'] == true
            : _filter == 'handled'
                ? (c as Map)['needs_human'] != true
                : true)
        .where((c) => needle.isEmpty ||
            '${(c as Map)['customer_name'] ?? ''} ${c['customer_number'] ?? ''} ${c['last_message'] ?? ''}'
                .toLowerCase()
                .contains(needle))
        .toList();
  }

  int _count(SalesChannel k) =>
      (_chats ?? []).where((c) => _channelOf(c as Map) == k).length;

  int get _needsCount =>
      (_chats ?? []).where((c) => (c as Map)['needs_human'] == true).length;

  Future<void> _open(Map<String, dynamic> chat) async {
    await Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => ThreadScreen(chat: chat),
    ));
    if (mounted) _load(); // flags + previews can change while you were inside
  }

  void _clearFilters() {
    _find.clear();
    setState(() {
      _q = '';
      _filter = 'all';
      _chan = 'all';
    });
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final filtered = _filter != 'all' || _chan != 'all' || _q.trim().isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Expanded(
                child: Text(
                  'Inbox',
                  style: TextStyle(
                    fontSize: 31,
                    height: 1.1,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -1,
                    color: scheme.onSurface,
                  ),
                ),
              ),
              if (_chats != null)
                Text(
                  '${_chats!.length} chat${_chats!.length == 1 ? '' : 's'}',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: VeloSalesTheme.glassInk(context),
                  ),
                ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: _SearchField(
            controller: _find,
            value: _q,
            onChanged: (v) => setState(() => _q = v),
            onClear: () {
              _find.clear();
              setState(() => _q = '');
            },
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 44,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            children: [
              _Pill(
                label: 'All',
                on: _filter == 'all' && _chan == 'all',
                onTap: () => setState(() {
                  _filter = 'all';
                  _chan = 'all';
                }),
              ),
              _Pill(
                label: _chats == null ? 'Needs you' : 'Needs you $_needsCount',
                on: _filter == 'needs',
                hot: true,
                soft: _needsCount > 0,
                onTap: () => setState(
                    () => _filter = _filter == 'needs' ? 'all' : 'needs'),
              ),
              _Pill(
                label: 'Handled',
                on: _filter == 'handled',
                onTap: () => setState(
                    () => _filter = _filter == 'handled' ? 'all' : 'handled'),
              ),
              if (_count(SalesChannel.whatsapp) > 0)
                _Pill(
                  label: 'WhatsApp',
                  on: _chan == 'whatsapp',
                  onTap: () => setState(
                      () => _chan = _chan == 'whatsapp' ? 'all' : 'whatsapp'),
                ),
              if (_count(SalesChannel.telegram) > 0)
                _Pill(
                  label: 'Telegram',
                  on: _chan == 'telegram',
                  onTap: () => setState(
                      () => _chan = _chan == 'telegram' ? 'all' : 'telegram'),
                ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Expanded(
          child: _loading
              ? const _InboxSkeleton()
              : _err != null
                  ? EmptyState("Couldn't load your inbox", _err!, retry: _load)
                  : _list.isEmpty
                      ? _EmptyInbox(filtered: filtered, onClear: _clearFilters)
                      : BrandRefresh(
                          onRefresh: _load,
                          child: _groupedList(),
                        ),
        ),
      ],
    );
  }

  /// Chats that need you first, each in its own bright card. Everything else
  /// shares one glass panel, so the urgent ones are the easy ones to spot.
  Widget _groupedList() {
    final all = [for (final c in _list) (c as Map).cast<String, dynamic>()];
    final needs = all.where((c) => c['needs_human'] == true).toList();
    final rest = all.where((c) => c['needs_human'] != true).toList();
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      children: [
        for (var i = 0; i < needs.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: FadeSlideIn(
              delayMs: (i * 45).clamp(0, 240),
              child: Container(
                decoration: VeloSalesTheme.glass(context, radius: 24, bright: true),
                child: _ChatRow(chat: needs[i], onTap: () => _open(needs[i])),
              ),
            ),
          ),
        if (rest.isNotEmpty)
          Container(
            padding: const EdgeInsets.symmetric(vertical: 4),
            decoration: VeloSalesTheme.glass(context, radius: 24),
            child: Column(
              children: [
                for (var i = 0; i < rest.length; i++) ...[
                  if (i > 0)
                    Divider(
                      height: 1,
                      indent: 14,
                      endIndent: 14,
                      color: Theme.of(context)
                          .colorScheme
                          .onSurface
                          .withValues(alpha: 0.09),
                    ),
                  _ChatRow(chat: rest[i], onTap: () => _open(rest[i])),
                ],
              ],
            ),
          ),
      ],
    );
  }
}

// ── list furniture ───────────────────────────────────────────────

class _SearchField extends StatelessWidget {
  final TextEditingController controller;
  final String value;
  final ValueChanged<String> onChanged;
  final VoidCallback onClear;

  const _SearchField({
    required this.controller,
    required this.value,
    required this.onChanged,
    required this.onClear,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SizedBox(
      height: 48,
      child: TextField(
        controller: controller,
        onChanged: onChanged,
        textInputAction: TextInputAction.search,
        style: TextStyle(fontSize: 14, color: scheme.onSurface),
        decoration: InputDecoration(
          hintText: 'Search chats',
          hintStyle: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w600,
            color: VeloSalesTheme.glassInk(context),
          ),
          isDense: true,
          filled: true,
          fillColor: scheme.surface.withValues(alpha: 0.46),
          prefixIcon: Icon(Icons.search_rounded,
              size: 18, color: VeloSalesTheme.glassInk(context)),
          prefixIconConstraints:
              const BoxConstraints(minWidth: 38, minHeight: 38),
          suffixIcon: value.isEmpty
              ? null
              : InkWell(
                  onTap: onClear,
                  borderRadius: BorderRadius.circular(999),
                  child: Icon(Icons.close_rounded,
                      size: 17,
                      color: scheme.onSurface.withValues(alpha: 0.55)),
                ),
          suffixIconConstraints:
              const BoxConstraints(minWidth: 38, minHeight: 38),
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
          border: _border(Colors.white.withValues(alpha: 0.7), 1.5),
          enabledBorder: _border(Colors.white.withValues(alpha: 0.7), 1.5),
          focusedBorder: _border(scheme.primary, 1.4),
        ),
      ),
    );
  }

  OutlineInputBorder _border(Color c, double w) => OutlineInputBorder(
        borderRadius: BorderRadius.circular(999),
        borderSide: BorderSide(color: c, width: w),
      );
}

/// One filter. Coral when it is the needs-you filter and something is waiting.
class _Pill extends StatelessWidget {
  final String label;
  final bool on;
  final bool hot;
  final bool soft;
  final VoidCallback onTap;

  const _Pill({
    required this.label,
    required this.on,
    this.hot = false,
    this.soft = false,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final Color fg;
    final BoxDecoration deco;
    if (on && hot) {
      fg = VeloSalesTheme.onAccent(context);
      deco = BoxDecoration(
        gradient: VeloSalesTheme.cta(context),
        borderRadius: BorderRadius.circular(999),
      );
    } else if (on) {
      fg = scheme.surface;
      deco = BoxDecoration(
        color: scheme.onSurface,
        borderRadius: BorderRadius.circular(999),
      );
    } else if (hot && soft) {
      fg = VeloSalesTheme.coralText(context);
      deco = BoxDecoration(
        color: dark ? const Color(0xFF2D1730) : const Color(0xFFFFF4EF),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: dark ? const Color(0xFF6E3440) : const Color(0xFFF3C3B3),
        ),
      );
    } else {
      fg = scheme.onSurface;
      deco = BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: dark ? Colors.white.withValues(alpha: 0.36) : const Color(0xFF1E1757).withValues(alpha: 0.26),
          width: 1.5,
        ),
      );
    }
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: Semantics(
        button: true,
        selected: on,
        child: Pressable(
          onTap: onTap,
          radius: BorderRadius.circular(999),
          child: Container(
            height: 44,
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(horizontal: 18),
            decoration: deco.copyWith(boxShadow: const []),
            child: Text(
              label,
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: fg),
            ),
          ),
        ),
      ),
    );
  }
}

class _ChatRow extends StatelessWidget {
  final Map<String, dynamic> chat;
  final VoidCallback onTap;

  const _ChatRow({required this.chat, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final needsHuman = chat['needs_human'] == true;
    final paused = chat['bot_paused'] == true;
    final channel = _channelOf(chat);
    final name = '${chat['customer_name'] ?? chat['customer_number'] ?? '?'}';
    final preview = '${chat['last_message'] ?? ''}'.trim();
    return Pressable(
      onTap: onTap,
      radius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
        child: Row(
          children: [
            _Avatar(photo: chat['customer_photo']?.toString(), channel: channel),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Expanded(
                        child: Text(
                          name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.15,
                            color: scheme.onSurface,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      needsHuman
                          ? Text(
                              'Needs you, ${waitedShort(chat['updated_at'])}',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w800,
                                color: VeloSalesTheme.coralText(context),
                              ),
                            )
                          : Text(
                              fmtTime(chat['updated_at']),
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                fontFeatures: const [FontFeature.tabularFigures()],
                                color: VeloSalesTheme.glassInk(context),
                              ),
                            ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    preview.isEmpty ? '—' : preview,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: VeloSalesTheme.glassInk(context),
                    ),
                  ),
                  if (paused)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        'You are answering',
                        style: TextStyle(
                          fontSize: 12,
                          color: VeloSalesTheme.glassInk(context),
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

class _Avatar extends StatelessWidget {
  final String? photo;
  final SalesChannel channel;

  const _Avatar({
    required this.photo,
    required this.channel,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SizedBox(
      width: 46,
      height: 46,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          CustomerFace(photo: photo, size: 42),
          Positioned(
            right: 0,
            bottom: 0,
            child: Container(
              padding: const EdgeInsets.all(1.5),
              decoration: BoxDecoration(
                color: scheme.surface,
                borderRadius: BorderRadius.circular(5),
              ),
              child: ChannelMark(channel: channel, size: 14),
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyInbox extends StatelessWidget {
  final bool filtered;
  final VoidCallback onClear;
  const _EmptyInbox({required this.filtered, required this.onClear});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56,
              height: 56,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: VeloSalesTheme.tintLavender(context),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.forum_outlined,
                  size: 25, color: VeloSalesTheme.purpleDark),
            ),
            const SizedBox(height: 14),
            Text(
              'Nothing here',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.25,
                color: scheme.onSurface,
              ),
            ),
            const SizedBox(height: 5),
            Text(
              filtered
                  ? 'No chats match — clear the search or try All.'
                  : 'Chats appear once you connect WhatsApp or Telegram.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12.5,
                height: 1.45,
                color: scheme.onSurface.withValues(alpha: 0.58),
              ),
            ),
            if (filtered) ...[
              const SizedBox(height: 12),
              TextButton(
                onPressed: onClear,
                child: const Text('Clear filters'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _InboxSkeleton extends StatelessWidget {
  const _InboxSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      physics: const NeverScrollableScrollPhysics(),
      children: [
        for (var i = 0; i < 5; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Row(
              children: [
                const Skeleton(height: 42, width: 42, radius: 21),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      Skeleton(height: 11, width: 120, radius: 6),
                      SizedBox(height: 8),
                      Skeleton(height: 9, width: 210, radius: 5),
                      SizedBox(height: 8),
                      Skeleton(height: 12, width: 150, radius: 6),
                    ],
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

// ── thread ───────────────────────────────────────────────────────

class ThreadScreen extends StatefulWidget {
  final Map<String, dynamic> chat;
  const ThreadScreen({super.key, required this.chat});

  @override
  State<ThreadScreen> createState() => _ThreadScreenState();
}

class _ThreadScreenState extends State<ThreadScreen> {
  List<dynamic>? _msgs;
  String? _err;
  late bool _paused;
  bool _needsHuman = false;
  final _draft = TextEditingController();
  bool _sending = false;
  bool _switching = false;
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    _paused = widget.chat['bot_paused'] == true;
    _needsHuman = widget.chat['needs_human'] == true;
    _draft.addListener(_onDraft);
    _load();
  }

  void _onDraft() {
    if (mounted) setState(() {}); // enables the send key the moment there is text
  }

  @override
  void dispose() {
    _draft
      ..removeListener(_onDraft)
      ..dispose();
    _scroll.dispose();
    super.dispose();
  }

  /// A chat opens at the newest message — the oldest is history, not the point.
  void _toLatest() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) return;
      _scroll.jumpTo(_scroll.position.maxScrollExtent);
    });
  }

  Future<void> _load() async {
    try {
      final rows = await ApiClient.instance.messages(widget.chat['id']);
      if (!mounted) return;
      setState(() => _msgs = rows);
      _toLatest();
    } on ApiException catch (e) {
      if (mounted) setState(() => _err = e.message);
    } catch (_) {
      if (mounted) setState(() => _err = 'No connection.');
    }
  }

  Future<void> _takeover(bool paused) async {
    if (_switching || paused == _paused) return;
    setState(() => _switching = true);
    try {
      await ApiClient.instance.takeover(widget.chat['id'], paused);
      if (mounted) {
        setState(() {
          _paused = paused;
          if (!paused) _needsHuman = false; // the bot is answering again
        });
      }
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, type: 'err');
    } catch (_) {
      if (mounted) showToast(context, 'No connection.', type: 'err');
    } finally {
      if (mounted) setState(() => _switching = false);
    }
  }

  Future<void> _send() async {
    final text = _draft.text.trim();
    if (text.isEmpty || _sending) return;
    final capped = text.length > 2000 ? text.substring(0, 2000) : text;
    setState(() => _sending = true);
    try {
      await ApiClient.instance.replyConversation(widget.chat['id'], capped);
      HapticFeedback.mediumImpact();
      _draft.clear();
      if (!mounted) return;
      setState(() {
        _sending = false;
        _paused = true;
        _needsHuman = false;
        (_msgs ??= []).add({
          'direction': 'out',
          'body': capped,
          'created_at': DateTime.now().toUtc().toIso8601String(),
        });
      });
      _toLatest();
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _sending = false);
        showToast(context, e.message, type: 'err');
      }
    } catch (_) {
      if (mounted) {
        setState(() => _sending = false);
        showToast(context, 'No connection.', type: 'err');
      }
    }
  }

  void _showFacts() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => _ContactSheet(
        chat: widget.chat,
        paused: _paused,
        needsHuman: _needsHuman,
        messageCount: _msgs?.length,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final bottom = MediaQuery.paddingOf(context).bottom;
    final canSend = _draft.text.trim().isNotEmpty && !_sending;
    return VeloSalesTheme.glow(context, child: Scaffold(
      backgroundColor: Colors.transparent,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _ThreadHeader(
              chat: widget.chat,
              onBack: () => Navigator.of(context).pop(),
              onFacts: _showFacts,
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
              child: _ModeSwitch(
                paused: _paused,
                busy: _switching,
                onChanged: _takeover,
              ),
            ),
            if (_needsHuman)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: _FlagNote(
                  reason: '${widget.chat['flag_reason'] ?? ''}'.trim(),
                ),
              )
            else if (_paused)
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 8, 18, 0),
                child: Text(
                  'Velo is paused on this chat, so the customer only hears from you. '
                  'Hand back anytime.',
                  style: TextStyle(
                    fontSize: 13,
                    height: 1.4,
                    color: VeloSalesTheme.glassInk(context),
                  ),
                ),
              ),
            Expanded(
              child: _err != null
                  ? EmptyState("Couldn't load this chat", _err!, retry: _load)
                  : _msgs == null
                      ? const _ThreadSkeleton()
                      : _msgs!.isEmpty
                          ? Center(
                              child: Text(
                                'No messages.',
                                style: TextStyle(
                                  fontSize: 13,
                                  color:
                                      scheme.onSurface.withValues(alpha: 0.5),
                                ),
                              ),
                            )
                          : ListView.builder(
                              controller: _scroll,
                              padding:
                                  const EdgeInsets.fromLTRB(16, 14, 16, 10),
                              itemCount: _msgs!.length,
                              itemBuilder: (context, i) {
                                final m = (_msgs![i] as Map)
                                    .cast<String, dynamic>();
                                return _Bubble(message: m);
                              },
                            ),
            ),
            _Composer(
              controller: _draft,
              paused: _paused,
              sending: _sending,
              canSend: canSend,
              firstName: '${widget.chat['customer_name'] ?? widget.chat['customer_number'] ?? 'them'}'
                  .trim()
                  .split(RegExp(r'\s+'))
                  .first,
              bottomInset: bottom,
              onSend: _send,
            ),
          ],
        ),
      ),
    ));
  }
}

/// Why Velo handed this chat to the owner.
class _FlagNote extends StatelessWidget {
  final String reason;
  const _FlagNote({required this.reason});

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: dark ? const Color(0xFF2D1730) : const Color(0xFFFFF4EF),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: dark ? 0.16 : 0.82)),
      ),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: VeloSalesTheme.accent(context),
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.notifications_none_rounded,
                size: 17, color: VeloSalesTheme.onAccent(context)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text.rich(
              TextSpan(
                style: TextStyle(
                  fontSize: 13.5,
                  height: 1.4,
                  color: Theme.of(context).colorScheme.onSurface,
                ),
                children: [
                  const TextSpan(
                    text: 'Velo needs you. ',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                  TextSpan(
                    text: reason.isEmpty
                        ? 'It was not sure how to answer this one.'
                        : reason,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ThreadHeader extends StatelessWidget {
  final Map<String, dynamic> chat;
  final VoidCallback onBack;
  final VoidCallback onFacts;

  const _ThreadHeader({
    required this.chat,
    required this.onBack,
    required this.onFacts,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final name = '${chat['customer_name'] ?? chat['customer_number'] ?? '?'}';
    final channel = _channelOf(chat);
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
      child: Row(
        children: [
          Pressable(
            onTap: onBack,
            radius: BorderRadius.circular(999),
            child: Container(
              width: 44,
              height: 44,
              alignment: Alignment.center,
              decoration: VeloSalesTheme.glass(context, radius: 999)
                  .copyWith(boxShadow: const []),
              child: Icon(Icons.arrow_back_rounded,
                  size: 19, color: scheme.onSurface),
            ),
          ),
          const SizedBox(width: 10),
          _Avatar(photo: chat['customer_photo']?.toString(), channel: channel),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.3,
                    color: scheme.onSurface,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  channel.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: VeloSalesTheme.glassInk(context),
                  ),
                ),
              ],
            ),
          ),
          Pressable(
            onTap: onFacts,
            radius: BorderRadius.circular(999),
            child: Container(
              width: 44,
              height: 44,
              alignment: Alignment.center,
              decoration: VeloSalesTheme.glass(context, radius: 999)
                  .copyWith(boxShadow: const []),
              child: Icon(Icons.info_outline_rounded,
                  size: 19,
                  color: scheme.onSurface.withValues(alpha: 0.62)),
            ),
          ),
        ],
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  final Map<String, dynamic> message;
  const _Bubble({required this.message});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final incoming = message['direction'] == 'in';
    final media = '${message['media_url'] ?? ''}';
    final fg = incoming ? scheme.onSurface : Colors.white;
    return Align(
      alignment: incoming ? Alignment.centerLeft : Alignment.centerRight,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 3),
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
        constraints: BoxConstraints(
            maxWidth: MediaQuery.sizeOf(context).width * 0.82),
        decoration: BoxDecoration(
          color: incoming ? scheme.surface.withValues(alpha: 0.72) : null,
          gradient: incoming
              ? null
              : const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFF4F3FC7), Color(0xFF3B2E9E)],
                ),
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(incoming ? 6 : 20),
            topRight: Radius.circular(incoming ? 20 : 6),
            bottomLeft: const Radius.circular(20),
            bottomRight: const Radius.circular(20),
          ),
          border: incoming
              ? Border.all(color: Colors.white.withValues(alpha: 0.82))
              : null,
          boxShadow: incoming
              ? null
              : [
                  BoxShadow(
                    color: const Color(0xFF4F3FC7).withValues(alpha: 0.3),
                    blurRadius: 24,
                    offset: const Offset(0, 12),
                  ),
                ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (media.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 7),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(9),
                  child: Image.network(
                    media,
                    width: 210,
                    errorBuilder: (_, _, _) => Text(
                      '[photo could not load]',
                      style: TextStyle(
                          fontSize: 11,
                          color: scheme.onSurface.withValues(alpha: 0.5)),
                    ),
                  ),
                ),
              ),
            Text(
              '${message['body'] ?? ''}',
              style: TextStyle(fontSize: 15, height: 1.45, color: fg),
            ),
            const SizedBox(height: 3),
            Text(
              fmtTime(message['created_at']),
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: incoming
                    ? VeloSalesTheme.glassInk(context)
                    : const Color(0xFFE0DBFF),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Composer extends StatelessWidget {
  final TextEditingController controller;
  final bool paused;
  final bool sending;
  final bool canSend;
  final String firstName;
  final double bottomInset;
  final VoidCallback onSend;

  const _Composer({
    required this.controller,
    required this.paused,
    required this.sending,
    required this.canSend,
    required this.firstName,
    required this.bottomInset,
    required this.onSend,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 6, 16, 12 + bottomInset),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(18, 6, 6, 6),
            decoration: VeloSalesTheme.glass(context, radius: 28, bright: true),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: TextField(
                    controller: controller,
                    minLines: 1,
                    maxLines: 4,
                    textInputAction: TextInputAction.send,
                    onSubmitted: (_) => onSend(),
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: scheme.onSurface,
                    ),
                    decoration: InputDecoration(
                      hintText: 'Reply to $firstName',
                      hintStyle: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: VeloSalesTheme.glassInk(context),
                      ),
                      border: InputBorder.none,
                      enabledBorder: InputBorder.none,
                      focusedBorder: InputBorder.none,
                      filled: false,
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Semantics(
                  button: true,
                  label: 'Send',
                  excludeSemantics: true,
                  child: Pressable(
                    onTap: canSend ? onSend : null,
                    radius: BorderRadius.circular(999),
                    child: AnimatedOpacity(
                      duration: const Duration(milliseconds: 150),
                      opacity: canSend || sending ? 1 : 0.45,
                      child: Container(
                        width: 48,
                        height: 48,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          gradient: VeloSalesTheme.cta(context),
                          shape: BoxShape.circle,
                        ),
                        child: sending
                            ? OrbitLoader(
                                size: 17, color: VeloSalesTheme.onAccent(context))
                            : Icon(Icons.arrow_upward_rounded,
                                size: 20, color: VeloSalesTheme.onAccent(context)),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (!paused)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                'Sending pauses Velo on this chat. Hand back when you are done.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: VeloSalesTheme.glassInk(context),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _ThreadSkeleton extends StatelessWidget {
  const _ThreadSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 12),
      physics: const NeverScrollableScrollPhysics(),
      children: const [
        Align(
          alignment: Alignment.centerLeft,
          child: Skeleton(height: 46, width: 220, radius: 14),
        ),
        SizedBox(height: 8),
        Align(
          alignment: Alignment.centerRight,
          child: Skeleton(height: 46, width: 190, radius: 14),
        ),
        SizedBox(height: 8),
        Align(
          alignment: Alignment.centerLeft,
          child: Skeleton(height: 46, width: 160, radius: 14),
        ),
        SizedBox(height: 8),
        Align(
          alignment: Alignment.centerRight,
          child: Skeleton(height: 46, width: 210, radius: 14),
        ),
      ],
    );
  }
}

class _ContactSheet extends StatelessWidget {
  final Map<String, dynamic> chat;
  final bool paused;
  final bool needsHuman;
  final int? messageCount;

  const _ContactSheet({
    required this.chat,
    required this.paused,
    required this.needsHuman,
    required this.messageCount,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final name = '${chat['customer_name'] ?? chat['customer_number'] ?? '?'}';
    final channel = _channelOf(chat);
    final status = needsHuman ? 'Needs you' : paused ? 'You talk' : 'AI handles';
    return Padding(
      padding: EdgeInsets.only(top: MediaQuery.paddingOf(context).top + 40),
      child: Container(
        decoration: BoxDecoration(
          color: scheme.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          border: Border(top: BorderSide(color: scheme.outline)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 10, 20, 24),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: scheme.outline,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              const SizedBox(height: 20),
              _Avatar(
                  photo: chat['customer_photo']?.toString(),
                  channel: channel),
              const SizedBox(height: 10),
              Text(
                name,
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.3,
                  color: scheme.onSurface,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                '${chat['customer_number'] ?? ''}',
                style: TextStyle(
                  fontSize: 12.5,
                  color: scheme.onSurface.withValues(alpha: 0.5),
                ),
              ),
              const SizedBox(height: 16),
              Container(
                decoration: BoxDecoration(
                  border: Border(top: BorderSide(color: scheme.outline)),
                ),
                child: Column(
                  children: [
                    _Fact(label: 'Channel', value: channel.label),
                    _Fact(label: 'Status', value: status),
                    _Fact(
                        label: 'Messages',
                        value: messageCount == null ? '…' : '$messageCount'),
                    _Fact(
                        label: 'Last active',
                        value: fmtTime(chat['updated_at'])),
                  ],
                ),
              ),
              if ('${chat['flag_reason'] ?? ''}'.trim().isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(
                  'Flag: ${chat['flag_reason']}',
                  style: TextStyle(
                    fontSize: 12,
                    height: 1.45,
                    color: VeloSalesTheme.goldColor(context),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Fact extends StatelessWidget {
  final String label;
  final String value;
  const _Fact({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 2),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: scheme.outline)),
      ),
      child: Row(
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 13,
              color: scheme.onSurface.withValues(alpha: 0.55),
            ),
          ),
          const Spacer(),
          Text(
            value,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: scheme.onSurface,
            ),
          ),
        ],
      ),
    );
  }
}

/// AI ↔ human, as one control instead of two competing buttons.
class _ModeSwitch extends StatelessWidget {
  final bool paused;
  final bool busy;
  final ValueChanged<bool> onChanged;

  const _ModeSwitch({
    required this.paused,
    required this.busy,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: busy ? 0.6 : 1,
      child: Container(
        height: 50,
        padding: const EdgeInsets.all(4),
        decoration: VeloSalesTheme.glass(context, radius: 999)
            .copyWith(boxShadow: const []),
        child: Row(children: [
          _seg(context, 'Velo answers', Icons.auto_awesome_rounded, !paused,
              () => onChanged(false)),
          _seg(context, 'You answer', Icons.person_outline_rounded, paused,
              () => onChanged(true)),
        ]),
      ),
    );
  }

  Widget _seg(BuildContext context, String label, IconData icon, bool on,
      VoidCallback tap) {
    final scheme = Theme.of(context).colorScheme;
    final fg = on ? scheme.onPrimary : scheme.onSurface;
    return Expanded(
      child: Semantics(
        button: true,
        selected: on,
        child: GestureDetector(
          onTap: busy ? null : tap,
          behavior: HitTestBehavior.opaque,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            curve: Curves.easeOut,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: on ? scheme.primary : Colors.transparent,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(icon, size: 15, color: fg),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: on ? FontWeight.w800 : FontWeight.w700,
                  color: fg,
                ),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}
