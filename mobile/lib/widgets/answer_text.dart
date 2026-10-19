// ── lib/widgets/answer_text.dart ───────────────────────────────────
// WHAT: one AI answer, rendered as readable blocks — paragraphs, bullets and
// numbered steps — instead of one flat grey paragraph.
//
// NOT a Markdown engine, deliberately. Every answer already passes through the
// server's cleanReply() first, which strips #, **, backticks, ~~ and [links].
// What it KEEPS is the shape: "• " per option (it rewrites - and + to a
// bullet), "1." per step, and one idea per line. So this reads THAT shape —
// the same parse the web does in frontend/src/lib/rich.jsx, so an answer looks
// the same in both clients. The tiny inline pass for **bold** / `code` is
// defensive only: it never fires today, and costs nothing if it ever does.
import 'package:flutter/material.dart';

/// A block of the answer. `items` carries the lines for lists, one string for
/// paragraphs/quotes/headings.
class _Blk {
  final String t; // 'p' | 'h' | 'ul' | 'ol' | 'q'
  final List<String> items;
  const _Blk(this.t, [this.items = const []]);
}

final _bullet = RegExp(r'^\s*[-\u2013\u2014\u2022\u00B7*+]\s+(.*)$');
final _ordered = RegExp(r'^\s*(\d{1,3})[.)]\s+(.*)$');
final _heading = RegExp(r'^\s*(#{1,4})\s+(.*)$');
final _quote = RegExp(r'^\s*>\s?(.*)$');
final _inline = RegExp(r'(\*\*[^*\n]+\*\*|`[^`\n]+`)');

List<_Blk> _parse(String raw) {
  final out = <_Blk>[];
  List<String>? para;
  List<String>? list;
  var ordered = false;
  List<String>? quote;

  void closePara() {
    if (para != null) {
      out.add(_Blk('p', [para!.join('\n')]));
      para = null;
    }
  }

  void closeList() {
    if (list != null) {
      out.add(_Blk(ordered ? 'ol' : 'ul', list!));
      list = null;
    }
  }

  void closeQuote() {
    if (quote != null) {
      out.add(_Blk('q', [quote!.join('\n')]));
      quote = null;
    }
  }

  void closeAll() {
    closePara();
    closeList();
    closeQuote();
  }

  for (final line0 in raw.replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n')) {
    final line = line0.replaceAll(RegExp(r'\s+$'), '');
    if (line.trim().isEmpty) {
      closeAll();
      continue;
    }

    final h = _heading.firstMatch(line);
    if (h != null) {
      closeAll();
      out.add(_Blk('h', [h.group(2)!]));
      continue;
    }

    final q = _quote.firstMatch(line);
    if (q != null) {
      closePara();
      closeList();
      (quote ??= <String>[]).add(q.group(1)!);
      continue;
    }

    final b = _bullet.firstMatch(line);
    if (b != null) {
      closePara();
      closeQuote();
      if (list == null || ordered) {
        closeList(); // closes with the PREVIOUS orientation, before we flip it
        list = <String>[];
        ordered = false;
      }
      list!.add(b.group(1)!);
      continue;
    }

    final o = _ordered.firstMatch(line);
    if (o != null) {
      closePara();
      closeQuote();
      if (list == null || !ordered) {
        closeList();
        list = <String>[];
        ordered = true;
      }
      list!.add(o.group(2)!);
      continue;
    }

    closeList();
    closeQuote();
    (para ??= <String>[]).add(line.trim());
  }
  closeAll();
  return out;
}

/// Inline runs: **bold** and `code`. Everything else is plain text.
List<InlineSpan> _runs(String text, TextStyle base, {Widget? tail}) {
  final spans = <InlineSpan>[];
  var last = 0;
  for (final m in _inline.allMatches(text)) {
    if (m.start > last) {
      spans.add(TextSpan(text: text.substring(last, m.start), style: base));
    }
    final tok = m.group(0)!;
    if (tok.startsWith('**')) {
      spans.add(TextSpan(
        text: tok.substring(2, tok.length - 2),
        style: base.copyWith(fontWeight: FontWeight.w700),
      ));
    } else {
      spans.add(TextSpan(
        text: tok.substring(1, tok.length - 1),
        style: base.copyWith(
          fontFamily: 'monospace',
          fontSize: (base.fontSize ?? 15) - 1,
        ),
      ));
    }
    last = m.end;
  }
  if (last < text.length) {
    spans.add(TextSpan(text: text.substring(last), style: base));
  }
  if (tail != null) spans.add(WidgetSpan(alignment: PlaceholderAlignment.middle, child: tail));
  return spans;
}

class AnswerText extends StatelessWidget {
  /// The answer's plain text, exactly as the API returned it.
  final String text;

  /// True while the answer is still arriving — a caret trails the last line.
  final bool live;

  const AnswerText(this.text, {super.key, this.live = false});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final base = TextStyle(
      fontSize: 14.5,
      height: 1.62,
      color: scheme.onSurface,
    );
    final blocks = _parse(text);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < blocks.length; i++)
          Padding(
            padding: EdgeInsets.only(bottom: i == blocks.length - 1 ? 0 : 12),
            child: _build(context, blocks[i], base,
                trailing: live && i == blocks.length - 1),
          ),
      ],
    );
  }

  Widget _build(BuildContext context, _Blk b, TextStyle base,
      {bool trailing = false}) {
    final scheme = Theme.of(context).colorScheme;
    final caret = trailing ? const _Caret() : null;

    switch (b.t) {
      case 'h':
        return Text.rich(TextSpan(
          children: _runs(b.items.first, base.copyWith(
            fontSize: 15.5,
            height: 1.35,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.2,
          ), tail: caret),
        ));

      case 'q':
        return Container(
          padding: const EdgeInsets.only(left: 12),
          decoration: BoxDecoration(
            border: Border(
              left: BorderSide(
                color: scheme.primary.withValues(alpha: 0.45),
                width: 3,
              ),
            ),
          ),
          child: Text.rich(TextSpan(
            children: _runs(
              b.items.first,
              base.copyWith(color: scheme.onSurface.withValues(alpha: 0.68)),
              tail: caret,
            ),
          )),
        );

      case 'ul':
      case 'ol':
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (var i = 0; i < b.items.length; i++)
              Padding(
                padding: EdgeInsets.only(top: i == 0 ? 0 : 7),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      width: 20,
                      child: b.t == 'ol'
                          ? Text(
                              '${i + 1}.',
                              style: base.copyWith(
                                fontWeight: FontWeight.w700,
                                color: scheme.primary,
                                height: 1.62,
                              ),
                            )
                          : Padding(
                              padding: const EdgeInsets.only(top: 8),
                              child: Container(
                                width: 5,
                                height: 5,
                                decoration: BoxDecoration(
                                  color: scheme.primary,
                                  shape: BoxShape.circle,
                                ),
                              ),
                            ),
                    ),
                    Expanded(
                      child: Text.rich(TextSpan(
                        children: _runs(
                          b.items[i],
                          base,
                          tail: trailing && i == b.items.length - 1 ? caret : null,
                        ),
                      )),
                    ),
                  ],
                ),
              ),
          ],
        );

      default:
        // white-space: pre-line — one idea per line survives, which is what the
        // prompt asks the model to produce.
        return Text.rich(TextSpan(children: _runs(b.items.first, base, tail: caret)));
    }
  }
}

/// The blinking bar that trails a streaming answer. It exists only while words
/// are actually arriving, so it reads as a state, not as decoration.
class _Caret extends StatefulWidget {
  const _Caret();

  @override
  State<_Caret> createState() => _CaretState();
}

class _CaretState extends State<_Caret> with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1050))
      ..repeat();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) => Opacity(
        opacity: _c.value < 0.5 ? 1 : 0,
        child: Container(
          width: 2,
          height: 15,
          margin: const EdgeInsets.only(left: 3),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.primary,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
      ),
    );
  }
}
