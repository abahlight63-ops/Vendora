// ── lib/screens/chats_screen.dart ────────────────────────────────
// WHAT: inbox + thread — mirrors Chats.jsx: filter tabs (All / Needs you
// / Handled), status pills (needs you / handled / you talk), timestamps,
// photo bubbles, takeover BUTTONS (not a switch) with the paused explainer.
// direction=in → customer (left), anything else → AI/owner (right).
import 'package:flutter/material.dart';

import '../api.dart';
import '../format.dart';
import '../motion.dart';

class ChatsScreen extends StatefulWidget {
  const ChatsScreen({super.key});

  @override
  State<ChatsScreen> createState() => _ChatsScreenState();
}

class _ChatsScreenState extends State<ChatsScreen> {
  List<dynamic>? _chats;
  String _filter = 'all'; // 'all' | 'needs' | 'handled'
  String? _err;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _err = null;
    });
    try {
      _chats = await ApiClient.instance.conversations();
    } on ApiException catch (e) {
      _err = e.message;
    } catch (_) {
      _err = 'No connection.';
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<dynamic> get _list {
    final all = _chats ?? [];
    if (_filter == 'needs') {
      return all.where((c) => (c as Map)['needs_human'] == true).toList();
    }
    if (_filter == 'handled') {
      return all.where((c) => (c as Map)['needs_human'] != true).toList();
    }
    return all;
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Column(children: [
      // Filter tabs (same three as web).
      Padding(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
        child: Row(children: [
          for (final e in [
            ['all', 'All'],
            ['needs', 'Needs you'],
            ['handled', 'Handled']
          ])
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: _filter == e[0]
                  ? FilledButton(
                      onPressed: () {},
                      style: FilledButton.styleFrom(
                          minimumSize: const Size(0, 36),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16)),
                      child: Text(e[1],
                          style: const TextStyle(fontSize: 13)),
                    )
                  : OutlinedButton(
                      onPressed: () => setState(() => _filter = e[0]),
                      style: OutlinedButton.styleFrom(
                          minimumSize: const Size(0, 36),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16)),
                      child: Text(e[1],
                          style: const TextStyle(fontSize: 13)),
                    ),
            ),
        ]),
      ),
      Expanded(
        child: _loading
            ? ListView.builder(
                padding: const EdgeInsets.all(12),
                itemCount: 4,
                itemBuilder: (_, i) => const Padding(
                  padding: EdgeInsets.only(bottom: 8),
                  child: Skeleton(height: 76),
                ),
              )
            : _err != null
                ? Center(
                    child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                        Text(_err!),
                        const SizedBox(height: 12),
                        FilledButton(
                            onPressed: _load,
                            child: const Text('Retry')),
                      ]))
                : _list.isEmpty
                    ? Center(
                        child: Text(_filter == 'all'
                            ? 'Chats appear once WhatsApp is connected.'
                            : 'No chats match this filter.'))
                    : RefreshIndicator(
                        onRefresh: _load,
                        child: ListView.builder(
                          itemCount: _list.length,
                          itemBuilder: (c, i) {
                            final m =
                                (_list[i] as Map).cast<String, dynamic>();
                            final needsHuman =
                                m['needs_human'] == true;
                            final paused = m['bot_paused'] == true;
                            return FadeSlideIn(
                              delayMs: (i * 60).clamp(0, 300),
                              child: Card(
                                margin: const EdgeInsets.symmetric(
                                    horizontal: 12, vertical: 5),
                                child: ListTile(
                                  leading: CircleAvatar(
                                      child: Text(
                                          '${m['customer_name'] ?? '?'}'
                                              .substring(0, 1)
                                              .toUpperCase())),
                                  title: Text(
                                      '${m['customer_name'] ?? m['customer_number']}'),
                                  subtitle: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                          '${m['last_message'] ?? ''}',
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis),
                                      Text(fmtTime(m['updated_at']),
                                          style: TextStyle(
                                              fontSize: 11,
                                              color: scheme.onSurface
                                                  .withValues(
                                                      alpha: 0.55))),
                                    ],
                                  ),
                                  trailing: Column(
                                    mainAxisAlignment:
                                        MainAxisAlignment.center,
                                    crossAxisAlignment:
                                        CrossAxisAlignment.end,
                                    children: [
                                      // Pills: needs-you (gold) / handled (green).
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 10, vertical: 3),
                                        decoration: BoxDecoration(
                                          color: needsHuman
                                              ? const Color(0xFFFFFAEB)
                                              : scheme.primary.withValues(
                                                  alpha: 0.12),
                                          borderRadius:
                                              BorderRadius.circular(999),
                                        ),
                                        child: Text(
                                          needsHuman
                                              ? 'needs you'
                                              : 'handled',
                                          style: TextStyle(
                                              fontSize: 11,
                                              fontWeight: FontWeight.w700,
                                              color: needsHuman
                                                  ? const Color(0xFFB54708)
                                                  : scheme.primary),
                                        ),
                                      ),
                                      if (paused)
                                        const Padding(
                                          padding:
                                              EdgeInsets.only(top: 4),
                                          child: Text('you talk',
                                              style: TextStyle(
                                                  fontSize: 11,
                                                  color: Colors.blue)),
                                        ),
                                    ],
                                  ),
                                  onTap: () =>
                                      Navigator.of(context)
                                          .push(MaterialPageRoute(
                                              builder: (_) =>
                                                  ThreadScreen(chat: m)))
                                          .then((_) => _load()),
                                ),
                              ),
                            );
                          },
                        ),
                      ),
      ),
    ]);
  }
}

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

  @override
  void initState() {
    super.initState();
    _paused = widget.chat['bot_paused'] == true;
    _load();
  }

  Future<void> _load() async {
    try {
      _msgs = await ApiClient.instance.messages(widget.chat['id']);
      if (mounted) setState(() {});
    } on ApiException catch (e) {
      if (mounted) setState(() => _err = e.message);
    } catch (_) {
      if (mounted) setState(() => _err = 'No connection.');
    }
  }

  Future<void> _takeover(bool paused) async {
    try {
      await ApiClient.instance.takeover(widget.chat['id'], paused);
      if (mounted) setState(() => _paused = paused);
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, type: 'err');
    }
  }

  @override
  Widget build(BuildContext context) {
    final needsHuman = widget.chat['needs_human'] == true;
    return Scaffold(
      appBar: AppBar(
        title: Text(
            '${widget.chat['customer_name'] ?? widget.chat['customer_number']}'),
      ),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
          child: Row(children: [
            OutlinedButton.icon(
              onPressed: () => Navigator.of(context).pop(),
              icon: const Icon(Icons.arrow_back, size: 14),
              label: const Text('Inbox', style: TextStyle(fontSize: 13)),
            ),
            const SizedBox(width: 8),
            // Paused → green "Hand back to AI", else ghost "Take over".
            _paused
                ? FilledButton(
                    onPressed: () => _takeover(false),
                    style: FilledButton.styleFrom(
                        minimumSize: const Size(0, 36),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16)),
                    child: const Text('Hand back to AI',
                        style: TextStyle(fontSize: 13)),
                  )
                : OutlinedButton(
                    onPressed: () => _takeover(true),
                    style: OutlinedButton.styleFrom(
                        minimumSize: const Size(0, 36),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16)),
                    child: const Text('Take over (pause bot)',
                        style: TextStyle(fontSize: 13)),
                  ),
          ]),
        ),
        if (_paused)
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Text(
              'Bot paused on this chat — the customer hears only you. Hand back anytime.',
              style: TextStyle(fontSize: 12),
            ),
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Text(
              '${widget.chat['customer_number'] ?? ''} ${needsHuman ? '· needs you' : '· handled by AI'}',
              style: TextStyle(
                  fontSize: 13,
                  color: Theme.of(context)
                      .colorScheme
                      .onSurface
                      .withValues(alpha: 0.6)),
            ),
          ),
        ),
        Expanded(
          child: _err != null
              ? Center(child: Text(_err!))
              : _msgs == null
                  ? ListView(
                      padding: const EdgeInsets.all(12),
                      children: const [
                        Align(
                            alignment: Alignment.centerLeft,
                            child: Skeleton(
                                height: 44,
                                width: 220,
                                radius: 14)),
                        SizedBox(height: 8),
                        Align(
                            alignment: Alignment.centerRight,
                            child: Skeleton(
                                height: 44,
                                width: 190,
                                radius: 14)),
                        SizedBox(height: 8),
                        Align(
                            alignment: Alignment.centerLeft,
                            child: Skeleton(
                                height: 44,
                                width: 150,
                                radius: 14)),
                      ],
                    )
                  : _msgs!.isEmpty
                      ? const Center(child: Text('No messages.'))
                      : ListView.builder(
                          padding: const EdgeInsets.all(12),
                          itemCount: _msgs!.length,
                          itemBuilder: (c, i) {
                            final m = (_msgs![i] as Map)
                                .cast<String, dynamic>();
                            final incoming = m['direction'] == 'in';
                            final media = '${m['media_url'] ?? ''}';
                            return FadeSlideIn(
                              child: Align(
                                alignment: incoming
                                    ? Alignment.centerLeft
                                    : Alignment.centerRight,
                                child: Container(
                                  margin: const EdgeInsets.symmetric(
                                      vertical: 4),
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 14, vertical: 10),
                                  constraints: BoxConstraints(
                                      maxWidth:
                                          MediaQuery.of(context)
                                                  .size
                                                  .width *
                                              0.8),
                                  decoration: BoxDecoration(
                                    color: incoming
                                        ? Theme.of(context)
                                            .colorScheme
                                            .surface
                                        : Theme.of(context)
                                            .colorScheme
                                            .primary,
                                    border: incoming
                                        ? Border.all(
                                            color: Theme.of(context)
                                                .colorScheme
                                                .outline
                                                .withValues(
                                                    alpha: 0.4))
                                        : null,
                                    borderRadius:
                                        BorderRadius.circular(14),
                                  ),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      if (media.isNotEmpty)
                                        Padding(
                                          padding: const EdgeInsets.only(
                                              bottom: 6),
                                          child: ClipRRect(
                                            borderRadius:
                                                BorderRadius.circular(
                                                    8),
                                            child: Image.network(
                                              media,
                                              width: 200,
                                              errorBuilder: (_, _, _) =>
                                                  const Text(
                                                      '[photo could not load]',
                                                      style: TextStyle(
                                                          fontSize:
                                                              11)),
                                            ),
                                          ),
                                        ),
                                      Text('${m['body'] ?? ''}'),
                                      const SizedBox(height: 2),
                                      Text(fmtTime(m['created_at']),
                                          style: TextStyle(
                                              fontSize: 10,
                                              color: incoming
                                                  ? Theme.of(context)
                                                      .colorScheme
                                                      .onSurface
                                                      .withValues(
                                                          alpha:
                                                              0.5)
                                                  : Theme.of(context)
                                                      .colorScheme
                                                      .onPrimary
                                                      .withValues(
                                                          alpha:
                                                              0.8))),
                                    ],
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
        ),
      ]),
    );
  }
}
