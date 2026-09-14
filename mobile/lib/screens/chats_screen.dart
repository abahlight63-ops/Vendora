// ── lib/screens/chats_screen.dart ────────────────────────────────
// WHAT: inbox (GET /api/me/conversations) + thread
// (GET /api/me/conversations/:id/messages) + per-chat takeover
// (POST .../takeover {paused}). direction=in → customer (left),
// anything else → AI/owner (right).
import 'package:flutter/material.dart';

import '../api.dart';
import '../motion.dart';

class ChatsScreen extends StatefulWidget {
  const ChatsScreen({super.key});

  @override
  State<ChatsScreen> createState() => _ChatsScreenState();
}

class _ChatsScreenState extends State<ChatsScreen> {
  List<dynamic>? _chats;
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

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: 5,
        itemBuilder: (_, i) => const Padding(
          padding: EdgeInsets.only(bottom: 8),
          child: Skeleton(height: 76),
        ),
      );
    }
    if (_err != null) {
      return Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
        Text(_err!),
        const SizedBox(height: 12),
        FilledButton(onPressed: _load, child: const Text('Retry')),
      ]));
    }
    if (_chats!.isEmpty) {
      return const Center(
          child: Text('No chats yet — message your business number.'));
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        itemCount: _chats!.length,
        itemBuilder: (c, i) {
          final m = (_chats![i] as Map).cast<String, dynamic>();
          final needsHuman = m['needs_human'] == true;
          final paused = m['bot_paused'] == true;
          return FadeSlideIn(
            delayMs: (i * 60).clamp(0, 300),
            child: Card(
            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            child: ListTile(
              leading: CircleAvatar(
                  child: Text('${m['customer_name'] ?? '?'}'
                      .substring(0, 1)
                      .toUpperCase())),
              title: Text('${m['customer_name'] ?? m['customer_number']}'),
              subtitle: Text('${m['last_message'] ?? ''}',
                  maxLines: 1, overflow: TextOverflow.ellipsis),
              trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                if (needsHuman)
                  const Chip(
                      label: Text('HUMAN',
                          style: TextStyle(fontSize: 10)),
                      backgroundColor: Colors.redAccent),
                if (paused) const Icon(Icons.pause_circle, size: 18),
                const Icon(Icons.chevron_right),
              ]),
              onTap: () => Navigator.of(context)
                  .push(MaterialPageRoute(
                      builder: (_) => ThreadScreen(chat: m)))
                  .then((_) => _load()),
            ),
          ));
        },
      ),
    );
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
  bool _paused = false;

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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
            '${widget.chat['customer_name'] ?? widget.chat['customer_number']}'),
        actions: [
          Row(children: [
            const Text('You reply', style: TextStyle(fontSize: 12)),
            Switch(
              value: _paused,
              onChanged: (v) async {
                try {
                  await ApiClient.instance
                      .takeover(widget.chat['id'], v);
                  setState(() => _paused = v);
                } on ApiException catch (e) {
                  if (context.mounted) {
                    showToast(context, e.message, type: 'err');
                  }
                }
              },
            ),
          ]),
        ],
      ),
      body: _err != null
          ? Center(child: Text(_err!))
          : _msgs == null
              ? ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: 6,
                  itemBuilder: (_, i) => Align(
                    alignment: i.isEven
                        ? Alignment.centerLeft
                        : Alignment.centerRight,
                    child: Container(
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      child: Skeleton(
                        height: 44,
                        width: MediaQuery.of(context).size.width *
                            (0.5 + (i % 3) * 0.1),
                        radius: 14,
                      ),
                    ),
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: _msgs!.length,
                  itemBuilder: (c, i) {
                    final m = (_msgs![i] as Map).cast<String, dynamic>();
                    final incoming = m['direction'] == 'in';
                    return FadeSlideIn(
                      child: Align(
                        alignment: incoming
                            ? Alignment.centerLeft
                            : Alignment.centerRight,
                        child: Container(
                          margin: const EdgeInsets.symmetric(vertical: 4),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 10),
                          constraints: BoxConstraints(
                              maxWidth:
                                  MediaQuery.of(context).size.width * 0.8),
                          decoration: BoxDecoration(
                            color: incoming
                                ? Theme.of(context).colorScheme.surface
                                : Theme.of(context).colorScheme.primary,
                            border: incoming
                                ? Border.all(
                                    color: Theme.of(context)
                                        .colorScheme
                                        .outline
                                        .withValues(alpha: 0.4))
                                : null,
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Text('${m['body'] ?? ''}'),
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
