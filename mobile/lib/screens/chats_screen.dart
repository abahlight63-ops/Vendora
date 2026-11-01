// ── lib/screens/chats_screen.dart ─────────────────────────────────
// WHAT: the phone inbox — the web's Chats.jsx in one column.
//
// Web parity: page head, search, status tabs with real counts, channel chips,
// conversation rows (avatar + gold dot + channel mark + status tags), then a
// pushed thread with the same AI/human switch, bubbles and composer. The web's
// right-hand contact panel becomes a bottom sheet behind the header's info key,
// because a phone has no third column.
//
// Every list comes from /api/me/conversations; every thread from /messages.
// No sample chats, no invented counts.
import 'package:flutter/material.dart';

import '../api.dart';
import '../depth.dart';
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
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Inbox',
                style: TextStyle(
                  fontSize: 26,
                  height: 1.1,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.8,
                  color: scheme.onSurface,
                ),
              ),
              const SizedBox(height: 5),
              Text(
                'Every chat from your channels, in one place.',
                style: TextStyle(
                  fontSize: 12.5,
                  height: 1.45,
                  fontWeight: FontWeight.w500,
                  color: scheme.onSurface.withValues(alpha: 0.58),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
            child: Container(
              decoration: BoxDecoration(
                color: scheme.surface,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: scheme.outline),
                boxShadow: softShadow(context, lift: 0.35),
              ),
              clipBehavior: Clip.antiAlias,
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
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
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Row(
                      children: [
                        _Tab(
                          label: 'All',
                          count: _chats == null ? '·' : '${_chats!.length}',
                          on: _filter == 'all',
                          onTap: () => setState(() => _filter = 'all'),
                        ),
                        const SizedBox(width: 6),
                        _Tab(
                          label: 'Needs you',
                          count: _chats == null ? '·' : '$_needsCount',
                          on: _filter == 'needs',
                          onTap: () => setState(() => _filter = 'needs'),
                        ),
                        const SizedBox(width: 6),
                        _Tab(
                          label: 'Handled',
                          count: _chats == null
                              ? '·'
                              : '${_chats!.length - _needsCount}',
                          on: _filter == 'handled',
                          onTap: () => setState(() => _filter = 'handled'),
                        ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          _Chip(
                            label: 'All',
                            on: _chan == 'all',
                            onTap: () => setState(() => _chan = 'all'),
                          ),
                          if (_count(SalesChannel.whatsapp) > 0)
                            _Chip(
                              label: 'WhatsApp (${_count(SalesChannel.whatsapp)})',
                              on: _chan == 'whatsapp',
                              onTap: () =>
                                  setState(() => _chan = 'whatsapp'),
                            ),
                          if (_count(SalesChannel.telegram) > 0)
                            _Chip(
                              label: 'Telegram (${_count(SalesChannel.telegram)})',
                              on: _chan == 'telegram',
                              onTap: () =>
                                  setState(() => _chan = 'telegram'),
                            ),
                        ],
                      ),
                    ),
                  ),
                  Divider(height: 1, thickness: 1, color: scheme.outline),
                  Expanded(
                    child: _loading
                        ? const _InboxSkeleton()
                        : _err != null
                            ? EmptyState("Couldn't load your inbox", _err!,
                                retry: _load)
                            : _list.isEmpty
                                ? _EmptyInbox(
                                    filtered: filtered,
                                    onClear: _clearFilters,
                                  )
                                : RefreshIndicator(
                                    onRefresh: _load,
                                    child: ListView.separated(
                                      padding: const EdgeInsets.fromLTRB(
                                          6, 6, 6, 12),
                                      itemCount: _list.length,
                                      separatorBuilder: (_, _) =>
                                          const SizedBox(height: 2),
                                      itemBuilder: (context, i) {
                                        final chat = (_list[i] as Map)
                                            .cast<String, dynamic>();
                                        return FadeSlideIn(
                                          delayMs: (i * 45).clamp(0, 240),
                                          child: _ChatRow(
                                            chat: chat,
                                            onTap: () => _open(chat),
                                          ),
                                        );
                                      },
                                    ),
                                  ),
                  ),
                ],
              ),
            ),
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
      height: 40,
      child: TextField(
        controller: controller,
        onChanged: onChanged,
        textInputAction: TextInputAction.search,
        style: TextStyle(fontSize: 14, color: scheme.onSurface),
        decoration: InputDecoration(
          hintText: 'Search name, number, message…',
          hintStyle: TextStyle(
            fontSize: 13.5,
            color: scheme.onSurface.withValues(alpha: 0.38),
          ),
          isDense: true,
          filled: true,
          fillColor: scheme.surfaceContainerLowest,
          prefixIcon: Icon(Icons.search_rounded,
              size: 18, color: scheme.onSurface.withValues(alpha: 0.45)),
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
          border: _border(scheme.outline, 1),
          enabledBorder: _border(scheme.outline, 1),
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

class _Tab extends StatelessWidget {
  final String label;
  final String count;
  final bool on;
  final VoidCallback onTap;

  const _Tab({
    required this.label,
    required this.count,
    required this.on,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final fg = on ? VeloSalesTheme.purpleDark : scheme.onSurface.withValues(alpha: 0.64);
    return Expanded(
      child: Pressable(
        onTap: onTap,
        radius: BorderRadius.circular(999),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          height: 40,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: on ? VeloSalesTheme.purpleSoft : scheme.surfaceContainerLowest,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
                color: on ? VeloSalesTheme.purpleLine : scheme.outline),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: on ? FontWeight.w800 : FontWeight.w600,
                    color: fg,
                  ),
                ),
              ),
              const SizedBox(width: 4),
              Text(
                count,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: fg.withValues(alpha: 0.66),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final String label;
  final bool on;
  final VoidCallback onTap;

  const _Chip({required this.label, required this.on, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Pressable(
      onTap: onTap,
      radius: BorderRadius.circular(999),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        height: 34,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: on ? scheme.surface : Colors.transparent,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: on ? scheme.primary : scheme.outline,
            width: on ? 1.3 : 1,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11.5,
            fontWeight: FontWeight.w700,
            color: on ? scheme.primary : scheme.onSurface.withValues(alpha: 0.55),
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
        padding: const EdgeInsets.fromLTRB(8, 10, 8, 10),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _Avatar(photo: chat['customer_photo']?.toString(), channel: channel, flagged: needsHuman),
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
                            fontSize: 13.5,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.15,
                            color: scheme.onSurface,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      needsHuman
                          ? Text(
                              'Needs you',
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
                                color: scheme.onSurface.withValues(alpha: 0.65),
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
                      fontSize: 12.5,
                      fontWeight: FontWeight.w500,
                      color: scheme.onSurface.withValues(alpha: 0.58),
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    paused ? '${channel.label}, you are answering' : channel.label,
                    style: TextStyle(
                      fontSize: 12,
                      color: scheme.onSurface.withValues(alpha: 0.65),
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
  final bool flagged;

  const _Avatar({
    required this.photo,
    required this.channel,
    required this.flagged,
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
          if (flagged)
            Positioned(
              top: -1,
              right: 2,
              child: Container(
                width: 11,
                height: 11,
                decoration: BoxDecoration(
                  color: VeloSalesTheme.accent(context),
                  shape: BoxShape.circle,
                  border: Border.all(color: scheme.surface, width: 2),
                ),
              ),
            ),
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
    return Scaffold(
      backgroundColor: scheme.surfaceContainerLowest,
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
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 8, 18, 0),
              child: Text(
                _paused
                    ? 'The bot is paused on this chat — the customer hears only you. '
                        'Hand back anytime.'
                    : '${widget.chat['flag_reason'] ?? ''}'.trim().isNotEmpty
                        ? '${widget.chat['flag_reason']}'
                        : _needsHuman
                            ? 'Flagged for your human touch.'
                            : 'The bot answers this chat. Take over whenever you want.',
                style: TextStyle(
                  fontSize: 12,
                  height: 1.45,
                  fontWeight: FontWeight.w500,
                  color: _paused
                      ? VeloSalesTheme.goldColor(context)
                      : scheme.onSurface.withValues(alpha: 0.52),
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
              needsHuman: _needsHuman,
              bottomInset: bottom,
              onSend: _send,
            ),
          ],
        ),
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
    final needsHuman = chat['needs_human'] == true;
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
      child: Row(
        children: [
          Pressable(
            onTap: onBack,
            radius: BorderRadius.circular(999),
            child: Container(
              width: 38,
              height: 38,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: scheme.surface,
                shape: BoxShape.circle,
                border: Border.all(color: scheme.outline),
              ),
              child: Icon(Icons.arrow_back_rounded,
                  size: 19, color: scheme.onSurface),
            ),
          ),
          const SizedBox(width: 10),
          _Avatar(photo: chat['customer_photo']?.toString(), channel: channel, flagged: needsHuman),
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
                    fontSize: 15.5,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.3,
                    color: scheme.onSurface,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${chat['customer_number'] ?? ''} · ${needsHuman ? 'needs you' : 'handled by AI'}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w500,
                    color: scheme.onSurface.withValues(alpha: 0.5),
                  ),
                ),
              ],
            ),
          ),
          Pressable(
            onTap: onFacts,
            radius: BorderRadius.circular(999),
            child: Container(
              width: 38,
              height: 38,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: scheme.surface,
                shape: BoxShape.circle,
                border: Border.all(color: scheme.outline),
              ),
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
    final fg = scheme.onSurface;
    return Align(
      alignment: incoming ? Alignment.centerLeft : Alignment.centerRight,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 3),
        padding: const EdgeInsets.fromLTRB(13, 10, 13, 8),
        constraints: BoxConstraints(
            maxWidth: MediaQuery.sizeOf(context).width * 0.82),
        decoration: BoxDecoration(
          color: incoming ? scheme.surface : VeloSalesTheme.purpleSoft,
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(incoming ? 4 : 14),
            topRight: Radius.circular(incoming ? 14 : 4),
            bottomLeft: const Radius.circular(14),
            bottomRight: const Radius.circular(14),
          ),
          border: Border.all(
            color: incoming ? scheme.outline : VeloSalesTheme.purpleLine,
          ),
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
              style: TextStyle(fontSize: 14, height: 1.5, color: fg),
            ),
            const SizedBox(height: 3),
            Text(
              fmtTime(message['created_at']),
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w500,
                color: scheme.onSurface.withValues(alpha: 0.42),
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
  final bool needsHuman;
  final double bottomInset;
  final VoidCallback onSend;

  const _Composer({
    required this.controller,
    required this.paused,
    required this.sending,
    required this.canSend,
    required this.needsHuman,
    required this.bottomInset,
    required this.onSend,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: EdgeInsets.fromLTRB(12, 10, 12, 10 + bottomInset),
      decoration: BoxDecoration(
        color: scheme.surface,
        border: Border(top: BorderSide(color: scheme.outline)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Container(
                  constraints: const BoxConstraints(minHeight: 46),
                  decoration: BoxDecoration(
                    color: scheme.surfaceContainerLowest,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: scheme.outline),
                  ),
                  child: TextField(
                    controller: controller,
                    minLines: 1,
                    maxLines: 4,
                    textInputAction: TextInputAction.send,
                    onSubmitted: (_) => onSend(),
                    style: TextStyle(fontSize: 14, color: scheme.onSurface),
                    decoration: InputDecoration(
                      hintText: needsHuman
                          ? 'Answer them here…'
                          : 'Reply as yourself…',
                      hintStyle: TextStyle(
                        fontSize: 13.5,
                        color: scheme.onSurface.withValues(alpha: 0.4),
                      ),
                      border: InputBorder.none,
                      isDense: true,
                      contentPadding:
                          const EdgeInsets.fromLTRB(14, 13, 14, 13),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Pressable(
                onTap: canSend ? onSend : null,
                radius: BorderRadius.circular(14),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  width: 46,
                  height: 46,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: canSend
                        ? VeloSalesTheme.accentSolid
                        : VeloSalesTheme.accentSolid.withValues(alpha: 0.30),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: sending
                      ? const OrbitLoader(size: 17, color: Colors.white)
                      : const Icon(Icons.arrow_upward_rounded,
                          size: 20, color: Colors.white),
                ),
              ),
            ],
          ),
          if (!paused)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                'Sending pauses the bot on this chat — hand back to AI when you are done.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w500,
                  color: scheme.onSurface.withValues(alpha: 0.42),
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
                  channel: channel,
                  flagged: needsHuman),
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
    final scheme = Theme.of(context).colorScheme;
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Opacity(
      opacity: busy ? 0.6 : 1,
      child: Container(
        height: 42,
        padding: const EdgeInsets.all(3),
        decoration: BoxDecoration(
          color: dark
              ? Colors.black.withValues(alpha: 0.26)
              : scheme.surfaceContainerLowest,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: scheme.outline),
        ),
        child: Row(children: [
          _seg(context, 'AI answers', Icons.auto_awesome_rounded, !paused,
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
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Expanded(
      child: GestureDetector(
        onTap: busy ? null : tap,
        behavior: HitTestBehavior.opaque,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOut,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: on ? scheme.surface : Colors.transparent,
            borderRadius: BorderRadius.circular(999),
            boxShadow: on
                ? [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: dark ? 0.3 : 0.08),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : null,
          ),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon,
                size: 15,
                color: on
                    ? scheme.primary
                    : scheme.onSurface.withValues(alpha: 0.45)),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: on ? FontWeight.w800 : FontWeight.w600,
                color: on
                    ? scheme.onSurface
                    : scheme.onSurface.withValues(alpha: 0.5),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}
