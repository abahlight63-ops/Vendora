// ── lib/screens/ai_screen.dart ─────────────────────────────────────
// WHAT: Vendora AI chat (POST /api/me/ask {message, model?} →
// {reply, via, model, fallback}) + model picker (GET /api/me/ai-models).
// 402 = locked premium model, 429 = daily cap — both shown, never crash.
import 'package:flutter/material.dart';

import '../api.dart';
import '../motion.dart';

class AiScreen extends StatefulWidget {
  const AiScreen({super.key});

  @override
  State<AiScreen> createState() => _AiScreenState();
}

class _AiMessage {
  final bool mine;
  final String text;
  final String? meta;
  _AiMessage(this.mine, this.text, [this.meta]);
}

class _AiScreenState extends State<AiScreen> {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  final List<_AiMessage> _msgs = [];
  List<dynamic> _models = [];
  String? _model; // null = server default (Lite)
  bool _busy = false;
  bool _testBot = false; // false = Vendora AI (/ask), true = shop test-bot (/playground)

  @override
  void initState() {
    super.initState();
    _loadModels();
  }

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _loadModels() async {
    try {
      _models = await ApiClient.instance.aiModels();
      if (mounted) setState(() {});
    } catch (_) {
      // Models optional — default still chats.
    }
  }

  void _jump() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(_scroll.position.maxScrollExtent,
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeOut);
      }
    });
  }

  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.isEmpty || _busy) return;
    setState(() {
      _msgs.add(_AiMessage(true, text));
      _busy = true;
    });
    _input.clear();
    _jump();
    try {
      if (_testBot) {
        // Shop test-bot: answers AS your catalog (like a customer).
        final r = await ApiClient.instance.playground(text);
        final reply = r['reply'];
        setState(() => _msgs.add(_AiMessage(
            false,
            '${reply ?? r['reason'] ?? '…'}',
            reply == null ? 'handed to human' : null)));
      } else {
        final r = await ApiClient.instance.ask(text, _model);
        final meta = [
          if (r['via'] != null) 'via ${r['via']}',
          if (r['fallback'] == true) 'fallback brain',
        ].join(' · ');
        setState(() => _msgs.add(_AiMessage(
            false, '${r['reply'] ?? '…'}', meta.isEmpty ? null : meta)));
      }
    } on ApiException catch (e) {
      setState(() => _msgs.add(_AiMessage(false, e.message, 'error')));
    } catch (_) {
      setState(() =>
          _msgs.add(_AiMessage(false, 'No connection — try again.', 'error')));
    } finally {
      if (mounted) setState(() => _busy = false);
      _jump();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      // Mode toggle (web: /vendora-ai vs /playground pages).
      Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
        child: SegmentedButton<bool>(
          segments: const [
            ButtonSegment(value: false, label: Text('Vendora AI')),
            ButtonSegment(value: true, label: Text('Test bot')),
          ],
          selected: {_testBot},
          onSelectionChanged: (s) => setState(() {
            _testBot = s.first;
            if (_testBot) _model = null;
          }),
        ),
      ),
      if (_models.isNotEmpty && !_testBot)
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
          child: DropdownButtonFormField<String>(
            initialValue: _model,
            decoration: const InputDecoration(labelText: 'Brain (optional)'),
            items: [
              const DropdownMenuItem(
                  value: null, child: Text('Auto (recommended)')),
              for (final m in _models)
                DropdownMenuItem(
                  value: '${(m as Map)['id']}',
                  enabled: (m['locked'] != true),
                  child: Text(
                      '${m['label'] ?? m['id']}${m['locked'] == true ? ' 🔒 Pro' : ''}'),
                ),
            ],
            onChanged: (v) => setState(() => _model = v),
          ),
        ),
      Expanded(
        child: _msgs.isEmpty
            ? Center(
                child: Text(_testBot
                    ? 'Ask like a customer — prices, stock, delivery.'
                    : 'Ask anything — stock, prices, advice.'))
            : ListView.builder(
                controller: _scroll,
                padding: const EdgeInsets.all(12),
                itemCount: _msgs.length + (_busy ? 1 : 0),
                itemBuilder: (c, i) {
                  // Web parity: typing dots while the brain thinks.
                  if (i >= _msgs.length) {
                    return const Align(
                      alignment: Alignment.centerLeft,
                      child: _TypingBubble(),
                    );
                  }
                  final m = _msgs[i];
                  return FadeSlideIn(
                    child: Align(
                      alignment: m.mine
                          ? Alignment.centerRight
                          : Alignment.centerLeft,
                      child: Container(
                        margin: const EdgeInsets.symmetric(vertical: 4),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 10),
                        constraints: BoxConstraints(
                            maxWidth:
                                MediaQuery.of(context).size.width * 0.82),
                        decoration: BoxDecoration(
                          color: m.mine
                              ? Theme.of(context).colorScheme.primary
                              : Theme.of(context).colorScheme.surface,
                          border: m.mine
                              ? null
                              : Border.all(
                                  color: Theme.of(context)
                                      .colorScheme
                                      .outline
                                      .withValues(alpha: 0.4)),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(m.text),
                              if (m.meta != null) ...[
                                const SizedBox(height: 4),
                                Text(m.meta!,
                                    style: TextStyle(
                                        fontSize: 11,
                                        color: Theme.of(context)
                                            .colorScheme
                                            .onSurface
                                            .withValues(alpha: 0.55))),
                              ],
                            ]),
                      ),
                    ),
                  );
                },
              ),
      ),
      Padding(
        padding: const EdgeInsets.all(12),
        child: Row(children: [
          Expanded(
            child: TextField(
              controller: _input,
              minLines: 1,
              maxLines: 4,
              decoration:
                  const InputDecoration(hintText: 'Ask Vendora AI…'),
              onSubmitted: (_) => _send(),
            ),
          ),
          const SizedBox(width: 8),
          IconButton.filled(
            onPressed: _busy ? null : _send,
            icon: _busy
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.send),
          ),
        ]),
      ),
    ]);
  }
}

// Web-parity typing bubble (typing dots while the brain thinks).
class _TypingBubble extends StatelessWidget {
  const _TypingBubble();

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          border: Border.all(
              color: Theme.of(context)
                  .colorScheme
                  .outline
                  .withValues(alpha: 0.4)),
          borderRadius: BorderRadius.circular(14),
        ),
        child: const TypingDots(),
      ),
    );
  }
}
