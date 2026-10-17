// ── lib/screens/help_screen.dart ──────────────────────────────────
// WHAT: the guide. Every other screen assumes you already know what the
// product does; this is the one that explains it, in the order you actually
// do it, and tells you what "good" looks like at each step.
//
// Static content on purpose — no API call, so it opens instantly even offline.
import 'package:flutter/material.dart';

import '../brand_mark.dart';
import '../widgets/brand_ui.dart';

class HelpScreen extends StatelessWidget {
  /// Optional jump into a tab, so a step can take you where it describes.
  final ValueChanged<int>? onGoTab;

  const HelpScreen({super.key, this.onGoTab});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text('How to use VeloSales Ai')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 36),
        children: [
          // ── what this is ──
          Center(
            child: Column(children: [
              const BrandMark(size: 78, glow: true),
              const SizedBox(height: 16),
              Text(
                'Your shop, answered 24/7.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 23,
                  height: 1.2,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.6,
                  color: scheme.onSurface,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'VeloSales Ai replies to your customers on WhatsApp using only the '
                'prices and stock you put in your catalog. It never invents a price, '
                'and it hands the chat to you the moment it is unsure.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  height: 1.55,
                  color: scheme.onSurface.withValues(alpha: 0.66),
                ),
              ),
            ]),
          ),

          const SizedBox(height: 30),
          const SectionLabel('Set it up once'),
          _Step(
            n: 1,
            title: 'Add what you sell',
            body: 'Every product needs a name and a price. Add a photo and a short '
                'description and the bot can describe it to customers the way you would.',
            good: 'Good sign: nothing in the catalog is missing a price.',
            action: 'Open catalog',
            onAction: onGoTab == null ? null : () => onGoTab!(2),
          ),
          _Step(
            n: 2,
            title: 'Connect your WhatsApp',
            body: 'Until this is done the bot has nowhere to answer. Connect takes '
                'you through linking your business number.',
            good: 'Good sign: the Connect screen shows a green, connected status.',
            action: 'Open connect',
            onAction: onGoTab == null ? null : () => onGoTab!(3),
          ),
          _Step(
            n: 3,
            title: 'Teach it the tricky answers',
            body: 'Delivery times, return rules, colours you never stock. Message '
                'those from your own number and the bot learns them permanently.',
            good: 'Good sign: customers stop asking questions the bot cannot answer.',
          ),

          const SizedBox(height: 26),
          const SectionLabel('What a normal day looks like'),
          _Point(
            icon: Icons.forum_outlined,
            title: 'Your inbox fills itself',
            body: 'The bot answers instantly. Chats it could not handle are marked '
                '"needs you" and sit at the top.',
          ),
          _Point(
            icon: Icons.bolt_outlined,
            title: 'You only answer the hard ones',
            body: 'Open a flagged chat and reply yourself. Taking over pauses the '
                'bot for that customer so you are never talking over each other.',
          ),
          _Point(
            icon: Icons.insights_outlined,
            title: 'Watch what people actually ask',
            body: 'The overview shows what is being asked most. Those are the '
                'answers worth adding to your catalog first.',
          ),

          const SizedBox(height: 26),
          const SectionLabel('If something looks wrong'),
          SoftPanel(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              _Faq(
                q: 'The bot gave a wrong price.',
                a: 'Fix it in the catalog — the price there is the only one it will '
                    'ever quote. Then check the chat: if it still looks wrong, the '
                    'product may have two entries.',
              ),
              _Faq(
                q: 'It is not replying at all.',
                a: 'Open Connect. If the status is not connected, your WhatsApp link '
                    'has dropped and needs reconnecting.',
              ),
              _Faq(
                q: 'A customer is getting impatient.',
                a: 'Open the chat and take over. The bot steps back immediately and '
                    'you reply as yourself.',
              ),
            ]),
          ),

          const SizedBox(height: 24),
          Text(
            'Still stuck? Reply to any message from us on WhatsApp and a person will '
            'pick it up.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              height: 1.5,
              color: scheme.onSurface.withValues(alpha: 0.55),
            ),
          ),
        ],
      ),
    );
  }
}

/// A numbered setup step. The numbers are earned: this is a real sequence, and
/// doing step 2 before step 1 does not work.
class _Step extends StatelessWidget {
  final int n;
  final String title;
  final String body;
  final String good;
  final String? action;
  final VoidCallback? onAction;

  const _Step({
    required this.n,
    required this.title,
    required this.body,
    required this.good,
    this.action,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: SoftPanel(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(
              width: 26,
              height: 26,
              decoration: BoxDecoration(
                color: scheme.primaryContainer,
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: Text('$n',
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: scheme.primary)),
            ),
            const SizedBox(width: 11),
            Expanded(
              child: Text(title,
                  style: const TextStyle(
                      fontSize: 15.5,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.2)),
            ),
          ]),
          const SizedBox(height: 10),
          Text(body,
              style: TextStyle(
                  fontSize: 13.5,
                  height: 1.55,
                  color: scheme.onSurface.withValues(alpha: 0.72))),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
            decoration: BoxDecoration(
              color: scheme.surfaceContainerLowest,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(children: [
              Icon(Icons.check_circle_outline, size: 15, color: scheme.primary),
              const SizedBox(width: 7),
              Expanded(
                child: Text(good,
                    style: TextStyle(
                        fontSize: 12,
                        height: 1.4,
                        fontWeight: FontWeight.w600,
                        color: scheme.onSurface.withValues(alpha: 0.72))),
              ),
            ]),
          ),
          if (action != null && onAction != null) ...[
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerLeft,
              child: SizedBox(
                width: 190,
                child: GradientPill(
                    label: action!, onTap: onAction, height: 44, dense: true),
              ),
            ),
          ],
        ]),
      ),
    );
  }
}

/// A quiet explanatory row — no card, no border, so a list of these does not
/// read as a stack of identical boxes.
class _Point extends StatelessWidget {
  final IconData icon;
  final String title;
  final String body;
  const _Point({required this.icon, required this.title, required this.body});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: scheme.primaryContainer,
            shape: BoxShape.circle,
          ),
          child: Icon(icon, size: 19, color: scheme.primary),
        ),
        const SizedBox(width: 13),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const SizedBox(height: 2),
            Text(title,
                style: const TextStyle(
                    fontSize: 14.5, fontWeight: FontWeight.w800, letterSpacing: -0.2)),
            const SizedBox(height: 4),
            Text(body,
                style: TextStyle(
                    fontSize: 13.5,
                    height: 1.5,
                    color: scheme.onSurface.withValues(alpha: 0.66))),
          ]),
        ),
      ]),
    );
  }
}

class _Faq extends StatelessWidget {
  final String q;
  final String a;
  const _Faq({required this.q, required this.a});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(q,
            style: const TextStyle(
                fontSize: 14, fontWeight: FontWeight.w800, letterSpacing: -0.2)),
        const SizedBox(height: 4),
        Text(a,
            style: TextStyle(
                fontSize: 13,
                height: 1.55,
                color: scheme.onSurface.withValues(alpha: 0.7))),
      ]),
    );
  }
}
