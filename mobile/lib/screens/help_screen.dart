// ── lib/screens/help_screen.dart ──────────────────────────────────
// WHAT: the guide. Every other screen assumes you already know what the
// product does; this is the one that explains it, in the order you actually
// do it, and tells you what "good" looks like at each step.
//
// Static content on purpose — no API call, so it opens instantly even offline.
import 'package:flutter/material.dart';

import '../brand_mark.dart';
import '../theme.dart';
import '../widgets/brand_ui.dart';
import 'legal_screen.dart';

class HelpScreen extends StatelessWidget {
  /// Optional jump into a tab, so a step can take you where it describes.
  final ValueChanged<int>? onGoTab;

  /// Replays the six-slide welcome tour. Optional: the Help page still works
  /// when someone opens it from a context with nowhere to push a route.
  final VoidCallback? onReplayTour;

  const HelpScreen({super.key, this.onGoTab, this.onReplayTour});

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

          const SizedBox(height: 26),
          const _InstallCard(),
          if (onReplayTour != null) ...[
            const SizedBox(height: 12),
            SoftPanel(
              padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
              child: Row(children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: scheme.primaryContainer,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(Icons.play_circle_outline_rounded,
                      size: 21, color: scheme.primary),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('See the tour again',
                            style: TextStyle(
                                fontSize: 13.5, fontWeight: FontWeight.w800)),
                        Text('Six slides — what the bot does, and why',
                            style: TextStyle(fontSize: 11.5)),
                      ]),
                ),
                TextButton(
                  onPressed: onReplayTour,
                  child: const Text('Play', style: TextStyle(fontSize: 12.5)),
                ),
              ]),
            ),
          ],
          const SizedBox(height: 26),
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

          const SizedBox(height: 22),
          SoftPanel(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Row(children: [
                Icon(Icons.gavel_outlined, size: 18, color: VeloSalesTheme.purpleDark),
                SizedBox(width: 7),
                Text('The fine print',
                    style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800)),
              ]),
              const SizedBox(height: 6),
              Text(
                'What you agree to, and exactly what we do with your data. Same '
                'documents as the website — readable here, no browser needed.',
                style: TextStyle(
                    fontSize: 12.5,
                    height: 1.5,
                    color: scheme.onSurface.withValues(alpha: 0.66)),
              ),
              const SizedBox(height: 6),
              Row(children: [
                TextButton(
                  onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) =>
                          const LegalScreen(initial: LegalDoc.terms))),
                  child: const Text('Terms & Conditions',
                      style: TextStyle(fontSize: 12.5)),
                ),
                TextButton(
                  onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) =>
                          const LegalScreen(initial: LegalDoc.privacy))),
                  child: const Text('Privacy Policy',
                      style: TextStyle(fontSize: 12.5)),
                ),
              ]),
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

/// Install-as-app, the phone twin of the web Help card.
///
/// The glyph is an arrow into a tray, never a handset: a phone icon on this
/// button reads as "call us" or "mobile version", which is the opposite of
/// what it does. The art drops our icon into a little home screen once, then a
/// pulse ring breathes slowly around it — motion that explains, then rests.
class _InstallCard extends StatefulWidget {
  const _InstallCard();

  @override
  State<_InstallCard> createState() => _InstallCardState();
}

class _InstallCardState extends State<_InstallCard>
    with TickerProviderStateMixin {
  late final AnimationController _drop;
  late final AnimationController _pulse;

  @override
  void initState() {
    super.initState();
    _drop = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 900))
      ..forward();
    _pulse = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 2600))
      ..repeat();
  }

  @override
  void dispose() {
    _drop.dispose();
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final dropCurve =
        CurvedAnimation(parent: _drop, curve: Curves.easeOutBack);

    return SoftPanel(
      padding: const EdgeInsets.all(16),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(
          width: 96,
          height: 124,
          child: Stack(clipBehavior: Clip.none, children: [
            // the home screen
            Positioned.fill(
              child: Container(
                decoration: BoxDecoration(
                  color: scheme.surfaceContainerLowest,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: scheme.outline),
                ),
                padding: const EdgeInsets.fromLTRB(9, 18, 9, 9),
                child: Column(children: [
                  Container(
                    width: 26,
                    height: 3,
                    decoration: BoxDecoration(
                        color: scheme.outline,
                        borderRadius: BorderRadius.circular(99)),
                  ),
                  const SizedBox(height: 8),
                  Expanded(
                    child: GridView.count(
                      physics: const NeverScrollableScrollPhysics(),
                      crossAxisCount: 4,
                      mainAxisSpacing: 4,
                      crossAxisSpacing: 4,
                      children: [
                        for (var i = 0; i < 12; i++)
                          DecoratedBox(
                            decoration: BoxDecoration(
                              color: scheme.outline.withValues(alpha: i % 3 == 0 ? 0.45 : 0.22),
                              borderRadius: BorderRadius.circular(4),
                            ),
                          ),
                      ],
                    ),
                  ),
                ]),
              ),
            ),
            // our icon, dropping in
            Positioned(
              left: 29,
              top: 44,
              child: ScaleTransition(
                scale: Tween<double>(begin: 0.35, end: 1).animate(dropCurve),
                child: Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    gradient: VeloSalesTheme.cta(context),
                    borderRadius: BorderRadius.circular(11),
                    boxShadow: [
                      BoxShadow(
                          color: scheme.primary.withValues(alpha: 0.4),
                          blurRadius: 14,
                          offset: const Offset(0, 7)),
                    ],
                  ),
                  child: const Center(
                      child: BrandMark(size: 17, onRail: true)),
                ),
              ),
            ),
            // breathing ring
            Positioned(
              left: 20,
              top: 35,
              child: AnimatedBuilder(
                animation: _pulse,
                builder: (_, _) {
                  final t = Curves.easeOut.transform(_pulse.value);
                  return Container(
                    width: 56 + 16 * t,
                    height: 56 + 16 * t,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(
                        color: scheme.primary
                            .withValues(alpha: 0.35 * (1 - _pulse.value)),
                        width: 2,
                      ),
                    ),
                  );
                },
              ),
            ),
          ]),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Row(children: [
              Icon(Icons.system_update_alt_rounded,
                  size: 18, color: VeloSalesTheme.purpleDark),
              SizedBox(width: 7),
              Expanded(
                child: Text('Install as app',
                    style: TextStyle(
                        fontSize: 15.5,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.2)),
              ),
            ]),
            const SizedBox(height: 6),
            Text(
              'Keep VeloSales Ai on your home screen — full-screen, one tap, no browser bar. '
              'Works from Chrome today; the store build is coming.',
              style: TextStyle(
                  fontSize: 12.5,
                  height: 1.5,
                  color: scheme.onSurface.withValues(alpha: 0.66)),
            ),
            const SizedBox(height: 10),
            _installStep('1', 'Open this site in Chrome.'),
            _installStep('2', 'Menu (⋮) → Add to Home screen.'),
            _installStep('3', 'Confirm — then open it from the new icon.'),
          ]),
        ),
      ]),
    );
  }

  Widget _installStep(String n, String text) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: 18,
          height: 18,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: scheme.primaryContainer,
            shape: BoxShape.circle,
          ),
          child: Text(n,
              style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  color: scheme.primary)),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(text,
              style: TextStyle(
                  fontSize: 12,
                  height: 1.4,
                  color: scheme.onSurface.withValues(alpha: 0.72))),
        ),
      ]),
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
