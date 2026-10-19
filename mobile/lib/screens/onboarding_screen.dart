// ── lib/screens/onboarding_screen.dart ────────────────────────────
// WHAT: the phone twin of the web's welcome tour — six slides, one idea each,
// seen once after sign-up and then never again (SharedPreferences remembers).
//
// THE ART IS THE PRODUCT. There is no stock photography on this screen: every
// slide draws a phone doing the job the slide is describing — a customer types,
// the answer lands, a LEARN message rewrites the catalog, profile sync builds a
// shelf. A photograph of a smiling stranger sells nothing; a working demo does.
//
// The motion is the teaching, so it is deliberate: the body types itself out
// behind a caret, the customer's message types first, then the answer pops in.
// Both restart on every swipe, which is why the page is a PageView rather than a
// row of cards.
import 'dart:async';

import 'package:flutter/material.dart';

import '../brand_mark.dart';
import '../theme.dart';
import '../widgets/brand_ui.dart';

/// One slide. `art` selects the phone script; `points` is optional (the first
/// slide carries the three promises, later slides let the art speak).
typedef _Slide = ({
  String k,
  String eyebrow,
  String title,
  String body,
  String art,
  String cta,
  String foot,
  List<List<String>> points,
});

const _slides = <_Slide>[
  (
    k: 'welcome',
    eyebrow: 'Welcome to VeloSales Ai',
    title: 'Never miss a customer again.',
    body:
        'Your WhatsApp becomes a 24/7 shop assistant. Customers ask, VeloSales Ai answers from YOUR catalog — even at 2am.',
    art: 'chat1',
    cta: 'See how it works',
    foot: 'Free plan forever. No card needed to start.',
    points: [
      ['chat', 'Replies in seconds'],
      ['spark', 'English or Pidgin'],
      ['shield', 'Never invents prices'],
    ],
  ),
  (
    k: 'flow',
    eyebrow: 'How it works',
    title: 'Message in. Sale out.',
    body:
        'The customer writes like a human. The AI checks your real products, prices and hours — then answers like your best sales rep.',
    art: 'chat2',
    cta: 'Teach it your products',
    foot: 'Every answer cites a real product from your catalog.',
    points: [],
  ),
  (
    k: 'learn',
    eyebrow: 'The LEARN trick · Free forever',
    title: 'Teach it with one message.',
    body:
        'From YOUR WhatsApp number, send the same ad you put on your status. Send the same product again and it simply updates the price.',
    art: 'chat3',
    cta: 'Unlock Pro powers',
    foot: 'Works on the free plan, with a manual catalog.',
    points: [],
  ),
  (
    k: 'sync',
    eyebrow: 'Pro · Profile sync',
    title: 'Verified against your profile.',
    body:
        'Pro builds your whole catalog from your WhatsApp Business profile, then checks every “is it available?” against it. Nothing is guessed.',
    art: 'sync',
    cta: 'See the plans',
    foot: 'Pro only. Your catalog stays yours if you cancel.',
    points: [],
  ),
  (
    k: 'plans',
    eyebrow: 'Free vs Pro',
    title: 'Free forever. Pro when ready.',
    body:
        'A manual catalog stays free forever. Pro adds profile sync, product photos and priority answers — from ₦7,499 / \$5 a month.',
    art: 'plans',
    cta: 'Almost done',
    foot: 'Switch or cancel any time — no contract.',
    points: [],
  ),
  (
    k: 'ready',
    eyebrow: "You're set",
    title: 'Start selling tonight.',
    body:
        'Your 7-day Pro trial is running, profile sync included. Add 3–5 products, test the bot like a customer, then connect WhatsApp.',
    art: 'ready',
    cta: 'Set up my shop',
    foot: 'Most shops connect WhatsApp the same day.',
    points: [],
  ),
];

class OnboardingScreen extends StatefulWidget {
  /// Called on the last slide and on "Skip intro". The caller persists "seen"
  /// and moves to the setup quiz — this screen never decides what comes next.
  final VoidCallback onDone;

  const OnboardingScreen({super.key, required this.onDone});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _pc = PageController();
  int _i = 0;
  // Bumped when the art is tapped: the phone is rebuilt with a new key, which
  // replays the typing demo from frame one. Without this the "tap to replay"
  // affordance was a lie — the widget kept its finished state.
  int _replay = 0;

  @override
  void dispose() {
    _pc.dispose();
    super.dispose();
  }

  void _go(int n) {
    final next = n.clamp(0, _slides.length - 1);
    if (next == _i) return;
    _pc.animateToPage(next,
        duration: const Duration(milliseconds: 320), curve: Curves.easeOutCubic);
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final s = _slides[_i];
    return Scaffold(
      body: SafeArea(
        child: Column(children: [
          // ── brand + progress ────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 14, 14, 0),
            child: Row(children: [
              const BrandMark(size: 24),
              const SizedBox(width: 10),
              const Expanded(
                child: Text('VELOSALES AI',
                    style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.1)),
              ),
              Text('${_i + 1} of ${_slides.length}',
                  style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w700,
                      color: scheme.onSurface.withValues(alpha: 0.5))),
              TextButton(
                onPressed: widget.onDone,
                style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 8)),
                child: const Text('Skip', style: TextStyle(fontSize: 12.5)),
              ),
            ]),
          ),
          // Six segments, one per slide: a tour should say how long it is.
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 10, 20, 0),
            child: Row(children: [
              for (var d = 0; d < _slides.length; d++)
                Expanded(
                  child: GestureDetector(
                    onTap: () => _go(d),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 240),
                      height: 4,
                      margin: EdgeInsets.only(right: d == _slides.length - 1 ? 0 : 6),
                      decoration: BoxDecoration(
                        color: d <= _i ? scheme.primary : scheme.outline,
                        borderRadius: BorderRadius.circular(99),
                      ),
                    ),
                  ),
                ),
            ]),
          ),

          // ── the slides ──────────────────────────────────────────────
          Expanded(
            child: PageView.builder(
              controller: _pc,
              itemCount: _slides.length,
              onPageChanged: (n) => setState(() => _i = n),
              itemBuilder: (_, n) => _SlideView(
                key: ValueKey(_slides[n].k),
                slide: _slides[n],
                replay: _replay,
                onLeadTap: () => setState(() => _replay++),
              ),
            ),
          ),

          // ── nav ─────────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 16),
            child: Row(children: [
              if (_i > 0) ...[
                TextButton.icon(
                  onPressed: () => _go(_i - 1),
                  icon: const Icon(Icons.arrow_back_rounded, size: 16),
                  label: const Text('Back', style: TextStyle(fontSize: 13)),
                ),
                const SizedBox(width: 10),
              ],
              // The one action fills whatever is left: full-width on slide 1,
              // thumb-width beside Back afterwards. Never a lonely pill pinned
              // to the right with dead space beside it.
              Expanded(
                child: GradientPill(
                  label: s.cta,
                  height: 50,
                  onTap: () =>
                      _i < _slides.length - 1 ? _go(_i + 1) : widget.onDone(),
                ),
              ),
            ]),
          ),
        ]),
      ),
    );
  }
}

class _SlideView extends StatelessWidget {
  final _Slide slide;
  final int replay;
  final VoidCallback onLeadTap;
  const _SlideView({
    super.key,
    required this.slide,
    required this.replay,
    required this.onLeadTap,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return LayoutBuilder(
      builder: (context, box) => SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
        // Centre the slide when it is shorter than the screen, but keep it
        // scrollable when phone + copy run long. A plain ListView left a third
        // of a modern phone blank under the chips.
        child: ConstrainedBox(
          constraints: BoxConstraints(
              minHeight: (box.maxHeight - 24).clamp(0.0, double.infinity)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisAlignment: MainAxisAlignment.start,
            children: [
              GestureDetector(
                  onTap: onLeadTap,
                  child: _PhoneArt(
                      key: ValueKey('${slide.art}-$replay'),
                      variant: slide.art)),
              // The art is interactive but that is invisible. Say it once, in
              // the smallest type on the page, instead of hoping someone taps.
              const SizedBox(height: 6),
              Text('Tap the phone to replay',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      fontSize: 10.5,
                      letterSpacing: 0.2,
                      color: scheme.onSurface.withValues(alpha: 0.38))),
              const SizedBox(height: 16),
              Text(slide.eyebrow.toUpperCase(),
                  style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.1,
                      color: scheme.primary)),
              const SizedBox(height: 6),
              Text(slide.title,
                  style: const TextStyle(
                      fontSize: 25,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.9,
                      height: 1.15)),
              const SizedBox(height: 10),
              _Typed(
                text: slide.body,
                style: TextStyle(
                    fontSize: 14,
                    height: 1.55,
                    color: scheme.onSurface.withValues(alpha: 0.66)),
              ),
              if (slide.points.isNotEmpty) ...[
                const SizedBox(height: 16),
                Wrap(spacing: 8, runSpacing: 8, children: [
                  for (final p in slide.points)
                    Container(
                      padding:
                          const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: scheme.primaryContainer.withValues(alpha: 0.6),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(
                            color: scheme.primary.withValues(alpha: 0.28)),
                      ),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        Icon(_pointIcon(p[0]), size: 14, color: scheme.primary),
                        const SizedBox(width: 6),
                        Text(p[1],
                            style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: scheme.primary)),
                      ]),
                    ),
                ]),
              ],
              if (slide.k == 'plans') ...[
                const SizedBox(height: 16),
                const _MiniRow(
                  icon: Icons.check_circle_rounded,
                  title: 'Free forever',
                  sub: 'Manual catalog + AI replies',
                  trailing: '₦0',
                ),
                const SizedBox(height: 8),
                const _MiniRow(
                  icon: Icons.bolt_rounded,
                  title: 'Pro — from ₦7,499/mo',
                  sub: 'Profile sync · photos · priority',
                  trailing: 'TRIAL ON',
                  highlight: true,
                ),
              ],
              if (slide.k == 'ready') ...[
                const SizedBox(height: 16),
                const _MiniRow(
                    icon: Icons.inventory_2_outlined,
                    title: 'Add your products',
                    sub: '3–5 to start is plenty'),
                const SizedBox(height: 8),
                const _MiniRow(
                    icon: Icons.link_outlined,
                    title: 'Connect WhatsApp + Telegram',
                    sub: 'TEST to LIVE in minutes'),
                const SizedBox(height: 8),
                const _MiniRow(
                    icon: Icons.play_circle_outline_rounded,
                    title: 'Test like a customer',
                    sub: 'Ask for prices, then chaos'),
              ],
              if (slide.foot.isNotEmpty) ...[
                const SizedBox(height: 18),
                Container(height: 1, color: scheme.outline),
                const SizedBox(height: 12),
                Text(slide.foot,
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: scheme.onSurface.withValues(alpha: 0.48))),
              ],
            ],
          ),
        ),
      ),
    );
  }

  IconData _pointIcon(String k) => switch (k) {
        'chat' => Icons.chat_bubble_outline_rounded,
        'spark' => Icons.auto_awesome,
        'shield' => Icons.verified_user_outlined,
        _ => Icons.circle_outlined,
      };
}

class _MiniRow extends StatelessWidget {
  final IconData icon;
  final String title;
  final String sub;
  final String? trailing;
  final bool highlight;
  const _MiniRow({
    required this.icon,
    required this.title,
    required this.sub,
    this.trailing,
    this.highlight = false,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: highlight
            ? scheme.primaryContainer.withValues(alpha: 0.55)
            : scheme.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
            color: highlight ? scheme.primary.withValues(alpha: 0.4) : scheme.outline),
      ),
      child: Row(children: [
        Icon(icon, size: 18, color: scheme.primary),
        const SizedBox(width: 11),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title,
                style: const TextStyle(
                    fontSize: 13.5, fontWeight: FontWeight.w700)),
            Text(sub,
                style: TextStyle(
                    fontSize: 11.5,
                    color: scheme.onSurface.withValues(alpha: 0.6))),
          ]),
        ),
        if (trailing != null)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: scheme.primary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(trailing!,
                style: TextStyle(
                    fontSize: 9.5,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.4,
                    color: scheme.primary)),
          ),
      ]),
    );
  }
}

/// Types its text out once, behind a caret. Deliberately simple: this is a
/// six-second teaching moment, not a typewriter people will wait on.
class _Typed extends StatefulWidget {
  final String text;
  final TextStyle style;
  const _Typed({required this.text, required this.style});

  @override
  State<_Typed> createState() => _TypedState();
}

class _TypedState extends State<_Typed> {
  Timer? _t;
  int _n = 0;

  @override
  void initState() {
    super.initState();
    _start();
  }

  @override
  void didUpdateWidget(covariant _Typed old) {
    super.didUpdateWidget(old);
    if (old.text != widget.text) _start();
  }

  void _start() {
    _t?.cancel();
    _n = 0;
    _t = Timer.periodic(const Duration(milliseconds: 11), (t) {
      if (!mounted) return t.cancel();
      _n++;
      if (_n >= widget.text.length) t.cancel();
      setState(() {});
    });
  }

  @override
  void dispose() {
    _t?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final done = _n >= widget.text.length;
    return RichText(
      text: TextSpan(style: widget.style, children: [
        TextSpan(text: widget.text.substring(0, _n.clamp(0, widget.text.length))),
        if (!done)
          TextSpan(
            text: '│',
            style: widget.style.copyWith(
                color: Theme.of(context).colorScheme.primary),
          ),
      ]),
    );
  }
}

/// The phone that does the talking.
///
/// Stage 0: the customer (or the owner) types. Stage 2: the answer lands.
/// A restarted widget (new key per slide) replays it, so every swipe shows the
/// product working instead of a frozen screenshot.
class _PhoneArt extends StatefulWidget {
  final String variant;
  const _PhoneArt({super.key, required this.variant});

  @override
  State<_PhoneArt> createState() => _PhoneArtState();
}

class _PhoneArtState extends State<_PhoneArt> {
  Timer? _t;
  String _lead = '';
  int _stage = 0;

  static const _scripts = {
    'chat1': 'Good evening! Do you have the blue gown?',
    'chat2': 'How much for 3? And do you deliver to Yaba?',
    'chat3': 'LEARN: New stock! Blue gown ₦45,000',
  };

  @override
  void initState() {
    super.initState();
    _run();
  }

  @override
  void didUpdateWidget(covariant _PhoneArt old) {
    super.didUpdateWidget(old);
    if (old.variant != widget.variant) _run();
  }

  void _run() {
    _t?.cancel();
    final script = _scripts[widget.variant];
    if (script == null) {
      // sync / plans / ready draw rows, not a conversation.
      setState(() {
        _lead = '';
        _stage = 2;
      });
      return;
    }
    setState(() {
      _lead = '';
      _stage = 0;
    });
    var i = 0;
    _t = Timer.periodic(const Duration(milliseconds: 34), (t) {
      if (!mounted) return t.cancel();
      i++;
      setState(() => _lead = script.substring(0, i));
      if (i >= script.length) {
        t.cancel();
        Future.delayed(const Duration(milliseconds: 480), () {
          if (mounted) setState(() => _stage = 2);
        });
      }
    });
  }

  @override
  void dispose() {
    _t?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            scheme.primaryContainer.withValues(alpha: 0.55),
            scheme.surface,
          ],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: scheme.outline),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        // header
        Row(children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
                color: scheme.surface,
                shape: BoxShape.circle,
                border: Border.all(color: scheme.outline)),
            child: const Center(child: BrandMark(size: 17)),
          ),
          const SizedBox(width: 9),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Adaeze Fabrics',
                  style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
              Row(children: [
                Container(
                    width: 6,
                    height: 6,
                    decoration: const BoxDecoration(
                        color: VeloSalesTheme.green, shape: BoxShape.circle)),
                const SizedBox(width: 5),
                Text('online',
                    style: TextStyle(
                        fontSize: 10.5,
                        color: scheme.onSurface.withValues(alpha: 0.6))),
              ]),
            ]),
          ),
          Text('9:41',
              style: TextStyle(
                  fontSize: 10.5,
                  color: scheme.onSurface.withValues(alpha: 0.45))),
        ]),
        const SizedBox(height: 12),
        if (_scripts.containsKey(widget.variant))
          _thread(scheme)
        else
          _rows(scheme),
      ]),
    );
  }

  Widget _thread(ColorScheme scheme) {
    final typing = _stage == 0;
    switch (widget.variant) {
      case 'chat1':
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _bubble(scheme, _lead, mine: false, caret: typing),
          if (_stage == 2) ...[
            const SizedBox(height: 8),
            _bubble(scheme,
                'Yes — the blue gown is ₦45,000, in stock. Want me to reserve it for tomorrow?',
                mine: true),
            const SizedBox(height: 8),
            _meta(scheme, 'checked 12 products · 9am–7pm'),
          ],
        ]);
      case 'chat2':
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _bubble(scheme, _lead, mine: false, caret: typing),
          if (_stage == 2) ...[
            const SizedBox(height: 8),
            _bubble(scheme,
                '3 gowns come to ₦126,000. Delivery to Yaba is free and lands tomorrow before noon.',
                mine: true),
            const SizedBox(height: 8),
            _meta(scheme, 'matched 3 items · free delivery'),
          ],
        ]);
      default: // chat3 — the owner teaching the catalog
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('YOU, FROM YOUR OWN WHATSAPP',
              style: TextStyle(
                  fontSize: 9.5,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.9,
                  color: scheme.onSurface.withValues(alpha: 0.45))),
          const SizedBox(height: 6),
          _bubble(scheme, _lead, mine: true, caret: typing),
          if (_stage == 2) ...[
            const SizedBox(height: 8),
            _meta(scheme, 'Catalog updated — 1 item. I’ll use this from now on.'),
            const SizedBox(height: 8),
            _bubble(scheme, 'Yes — ₦45,000, in stock.', mine: true),
          ],
        ]);
    }
  }

  Widget _rows(ColorScheme scheme) {
    final List<List<String>> rows = switch (widget.variant) {
      'sync' => [
          ['Blue Ankara gown', '₦45,000'],
          ['Two-piece set', '₦38,500'],
          ['Head wrap', '₦7,500'],
          ['Bridal lace', '₦92,000'],
        ],
      'plans' => [
          ['Free · manual catalog', '₦0'],
          ['Pro · sync + photos', '₦7,499'],
        ],
      _ => [
          ['Add 3–5 products', 'Catalog'],
          ['Test the bot yourself', 'Test bot'],
          ['Connect WhatsApp', 'Connect'],
        ],
    };
    final label = switch (widget.variant) {
      'sync' => 'SCAFFOLDED FROM YOUR PROFILE',
      'plans' => 'FREE VS PRO',
      _ => 'THREE THINGS, THEN YOU ARE LIVE',
    };
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label,
          style: TextStyle(
              fontSize: 9.5,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.9,
              color: scheme.onSurface.withValues(alpha: 0.45))),
      const SizedBox(height: 8),
      for (var i = 0; i < rows.length; i++) ...[
        if (widget.variant == 'ready')
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 9),
            decoration: BoxDecoration(
              color: scheme.surface,
              borderRadius: BorderRadius.circular(11),
              border: Border.all(color: scheme.outline),
            ),
            child: Row(children: [
              Container(
                width: 18,
                height: 18,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                    color: scheme.primaryContainer, shape: BoxShape.circle),
                child: Text('${i + 1}',
                    style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: scheme.primary)),
              ),
              const SizedBox(width: 9),
              Expanded(
                  child: Text(rows[i][0],
                      style: const TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w600))),
              Text(rows[i][1],
                  style: TextStyle(
                      fontSize: 10,
                      color: scheme.onSurface.withValues(alpha: 0.55))),
            ]),
          )
        else
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 9),
            decoration: BoxDecoration(
              color: widget.variant == 'plans' && i == 1
                  ? scheme.primaryContainer.withValues(alpha: 0.5)
                  : scheme.surface,
              borderRadius: BorderRadius.circular(11),
              border: Border.all(
                  color: widget.variant == 'plans' && i == 1
                      ? scheme.primary.withValues(alpha: 0.4)
                      : scheme.outline),
            ),
            child: Row(children: [
              Icon(Icons.check_circle_rounded,
                  size: 15, color: VeloSalesTheme.green),
              const SizedBox(width: 9),
              Expanded(
                  child: Text(rows[i][0],
                      style: const TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w600))),
              Text(rows[i][1],
                  style: const TextStyle(
                      fontSize: 12, fontWeight: FontWeight.w800)),
            ]),
          ),
        const SizedBox(height: 7),
      ],
      Text(
        switch (widget.variant) {
          'sync' => 'verified before every answer',
          'plans' => 'cancel anytime — the manual catalog never expires',
          _ => 'most shops finish in one evening',
        },
        style: TextStyle(
            fontSize: 10.5, color: scheme.onSurface.withValues(alpha: 0.55)),
      ),
    ]);
  }

  Widget _bubble(ColorScheme scheme, String text,
      {required bool mine, bool caret = false}) {
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 300),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: mine ? scheme.primaryContainer.withValues(alpha: 0.75) : scheme.surface,
          border: Border.all(
              color: mine ? scheme.primary.withValues(alpha: 0.3) : scheme.outline),
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(14),
            topRight: const Radius.circular(14),
            bottomLeft: Radius.circular(mine ? 14 : 4),
            bottomRight: Radius.circular(mine ? 4 : 14),
          ),
        ),
        child: Text(
          caret ? '$text│' : text,
          style: const TextStyle(fontSize: 12.5, height: 1.5),
        ),
      ),
    );
  }

  Widget _meta(ColorScheme scheme, String text) {
    return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Icon(Icons.check_circle_rounded,
          size: 13, color: VeloSalesTheme.green),
      const SizedBox(width: 5),
      Expanded(
        child: Text(text,
            style: TextStyle(
                fontSize: 10.5,
                height: 1.4,
                color: scheme.onSurface.withValues(alpha: 0.6))),
      ),
    ]);
  }
}
