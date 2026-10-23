// ── lib/screens/welcome_screen.dart ───────────────────────────────
// WHAT: the phone's front door, before signup.
//
// WHY it looks like this: the first version was paper-flat and read as a form
// with pictures. This one is the product demo — a saturated indigo stage, one
// white card, and six automatic slides that show Velo actually answering:
// a WhatsApp-style thread with typing dots, a typed reply, ticks and a result.
// The last slide is the promise in one object: every channel orbiting the mark.
//
// Motion is deliberate, not decorative: the background drifts slowly, the
// active chat replays when its slide lands, and the carousel advances itself
// every seven seconds. Dragging pauses the clock. Reduced motion keeps the slides
// but stops the drifting background and orbit.
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../brand_mark.dart';
import '../depth.dart';
import '../theme.dart';
import '../widgets/brand_ui.dart';
import '../widgets/channel_marks.dart';

class WelcomeScreen extends StatefulWidget {
  final VoidCallback onCreateAccount;
  final VoidCallback onSignIn;

  const WelcomeScreen({
    super.key,
    required this.onCreateAccount,
    required this.onSignIn,
  });

  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen> {
  // Infinite carousel: start far from zero so the loop never rewinds through
  // five slides when it wraps.
  static const _origin = 6000;
  final _page = PageController(viewportFraction: 0.90, initialPage: _origin);

  late int _pageNo = _origin;
  Timer? _clock;

  @override
  void initState() {
    super.initState();
    _armClock();
  }

  @override
  void dispose() {
    _clock?.cancel();
    _page.dispose();
    super.dispose();
  }

  void _armClock() {
    _clock?.cancel();
    _clock = Timer(const Duration(seconds: 7), _advance);
  }

  void _advance() {
    if (!mounted) return;
    if (!_page.hasClients || _page.position.isScrollingNotifier.value) {
      _armClock();
      return;
    }
    _page.animateToPage(
      _pageNo + 1,
      duration: const Duration(milliseconds: 720),
      curve: Curves.easeInOutCubic,
    );
  }

  bool _onScroll(ScrollNotification n) {
    if (n is ScrollStartNotification && n.dragDetails != null) {
      _clock?.cancel();
    } else if (n is ScrollEndNotification) {
      _armClock();
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    return Scaffold(
      backgroundColor: const Color(0xFF211757),
      body: Stack(
        children: [
          const Positioned.fill(child: _Aurora()),
          SafeArea(
            bottom: false,
            child: LayoutBuilder(
              builder: (context, box) {
                final compact = box.maxHeight < 760;
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _TopBar(onSignIn: widget.onSignIn),
                    Padding(
                      padding: EdgeInsets.fromLTRB(22, compact ? 8 : 14, 22, 0),
                      child: _Hero(compact: compact),
                    ),
                    SizedBox(height: compact ? 10 : 16),
                    Expanded(
                      child: NotificationListener<ScrollNotification>(
                        onNotification: _onScroll,
                        child: PageView.builder(
                          controller: _page,
                          clipBehavior: Clip.none,
                          onPageChanged: (i) {
                            setState(() => _pageNo = i);
                            _armClock();
                          },
                          itemBuilder: (context, i) => _SlideStage(
                            page: _page,
                            index: i,
                            child: _SlideCard(
                              spec: _slides[i % _slides.length],
                              number: i % _slides.length,
                              active: i == _pageNo,
                              compact: compact,
                            ),
                          ),
                        ),
                      ),
                    ),
                    SizedBox(height: compact ? 8 : 12),
                    _Dots(
                      count: _slides.length,
                      index: _pageNo % _slides.length,
                    ),
                    _Footer(
                      bottom: bottom,
                      compact: compact,
                      onGetStarted: widget.onCreateAccount,
                      onSignIn: widget.onSignIn,
                    ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ── stage ────────────────────────────────────────────────────────

class _TopBar extends StatelessWidget {
  final VoidCallback onSignIn;
  const _TopBar({required this.onSignIn});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 16, 0),
      child: Row(
        children: [
          const BrandMark(size: 30, solid: Colors.white, glow: true),
          const SizedBox(width: 10),
          const Text(
            'VeloSales Ai',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.4,
              color: Colors.white,
            ),
          ),
          const Spacer(),
          Pressable(
            onTap: onSignIn,
            radius: BorderRadius.circular(999),
            child: Container(
              padding: const EdgeInsets.fromLTRB(14, 8, 11, 8),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: Colors.white.withValues(alpha: 0.24)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    'Sign in',
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(width: 2),
                  Icon(Icons.arrow_forward_rounded,
                      size: 15, color: Colors.white.withValues(alpha: 0.7)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Hero extends StatelessWidget {
  final bool compact;
  const _Hero({required this.compact});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.fromLTRB(9, 5, 12, 5),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.10),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
          ),
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _LiveDot(),
              SizedBox(width: 7),
              Text(
                'YOUR AI SALES ASSISTANT',
                style: TextStyle(
                  fontSize: 9.5,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.9,
                  color: Colors.white,
                ),
              ),
            ],
          ),
        ),
        SizedBox(height: compact ? 9 : 12),
        Text.rich(
          TextSpan(
            style: TextStyle(
              fontSize: compact ? 29 : 34,
              height: 1.04,
              fontWeight: FontWeight.w800,
              letterSpacing: -1.25,
              color: Colors.white,
            ),
            children: const [
              TextSpan(text: 'Every message\nis a '),
              TextSpan(
                text: 'sale.',
                style: TextStyle(color: Color(0xFFFBBF24)),
              ),
            ],
          ),
        ),
        SizedBox(height: compact ? 6 : 9),
        Text(
          'Velo replies in seconds, takes the order and gets you paid — '
          'in your customer\'s own language.',
          style: TextStyle(
            fontSize: compact ? 12 : 13,
            height: 1.5,
            fontWeight: FontWeight.w500,
            color: Colors.white.withValues(alpha: 0.68),
          ),
        ),
      ],
    );
  }
}

class _LiveDot extends StatefulWidget {
  const _LiveDot();

  @override
  State<_LiveDot> createState() => _LiveDotState();
}

class _LiveDotState extends State<_LiveDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (reducedMotion(context)) {
      return Container(
        width: 7,
        height: 7,
        decoration: const BoxDecoration(
          color: Color(0xFF34D399),
          shape: BoxShape.circle,
        ),
      );
    }
    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) => Container(
        width: 7,
        height: 7,
        decoration: BoxDecoration(
          color: const Color(0xFF34D399),
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF34D399)
                  .withValues(alpha: 0.25 + _c.value * 0.35),
              blurRadius: 6 + _c.value * 7,
              spreadRadius: 1 + _c.value * 2,
            ),
          ],
        ),
      ),
    );
  }
}

class _Aurora extends StatefulWidget {
  const _Aurora();

  @override
  State<_Aurora> createState() => _AuroraState();
}

class _AuroraState extends State<_Aurora> with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 18),
    )..repeat(reverse: true);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (reducedMotion(context)) {
      _c.stop();
      _c.value = 0.5;
    } else if (!_c.isAnimating) {
      _c.repeat(reverse: true);
    }
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
      builder: (context, _) {
        final t = _c.value;
        return DecoratedBox(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Color(0xFF1C1350),
                Color(0xFF34238D),
                Color(0xFF5B4BD6),
                Color(0xFF3A2596),
              ],
              stops: [0.0, 0.38, 0.72, 1.0],
            ),
          ),
          child: Stack(
            children: [
              Positioned(
                left: -120 + math.sin(t * math.pi * 2) * 24,
                top: -140 + math.cos(t * math.pi * 2) * 18,
                child: const _Glow(
                    size: 420, color: Color(0xFF8B5CF6), strength: 0.55),
              ),
              Positioned(
                right: -150 + math.cos(t * math.pi * 2) * 30,
                top: 150 + math.sin(t * math.pi * 2) * 26,
                child: const _Glow(
                    size: 360, color: Color(0xFFEC4899), strength: 0.26),
              ),
              Positioned(
                left: 30 + math.cos(t * math.pi * 2) * 20,
                bottom: -170 + math.sin(t * math.pi * 2) * 22,
                child: const _Glow(
                    size: 400, color: Color(0xFF10B981), strength: 0.22),
              ),
              // Fine grain of starlight, so the flat gradient has texture.
              const Positioned.fill(child: _StarField()),
            ],
          ),
        );
      },
    );
  }
}

class _Glow extends StatelessWidget {
  final double size;
  final Color color;
  final double strength;
  const _Glow({
    required this.size,
    required this.color,
    required this.strength,
  });

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(colors: [
            color.withValues(alpha: strength),
            color.withValues(alpha: strength * 0.35),
            color.withValues(alpha: 0),
          ]),
        ),
      ),
    );
  }
}

class _StarField extends StatelessWidget {
  const _StarField();

  @override
  Widget build(BuildContext context) =>
      const IgnorePointer(child: CustomPaint(painter: _StarPainter()));
}

class _StarPainter extends CustomPainter {
  const _StarPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()..color = Colors.white.withValues(alpha: 0.10);
    // A fixed scatter, not random: the same sky every launch.
    const points = [
      [0.08, 0.12, 1.2], [0.21, 0.28, 0.8], [0.34, 0.07, 1.0],
      [0.47, 0.19, 0.7], [0.63, 0.10, 1.1], [0.78, 0.24, 0.8],
      [0.91, 0.13, 1.3], [0.13, 0.46, 0.7], [0.29, 0.62, 1.0],
      [0.55, 0.52, 0.8], [0.72, 0.44, 1.2], [0.88, 0.63, 0.7],
      [0.06, 0.77, 1.0], [0.24, 0.91, 0.8], [0.41, 0.84, 1.1],
      [0.66, 0.79, 0.7], [0.83, 0.92, 1.0], [0.96, 0.74, 0.8],
    ];
    for (final s in points) {
      canvas.drawCircle(
          Offset(size.width * s[0], size.height * s[1]), s[2], p);
    }
  }

  @override
  bool shouldRepaint(_StarPainter old) => false;
}

class _SlideStage extends StatelessWidget {
  final PageController page;
  final int index;
  final Widget child;

  const _SlideStage({
    required this.page,
    required this.index,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    if (reducedMotion(context)) return child;
    return AnimatedBuilder(
      animation: page,
      builder: (context, _) {
        final at = page.hasClients && page.position.haveDimensions
            ? (page.page ?? index.toDouble())
            : index.toDouble();
        final delta = (at - index).clamp(-1.0, 1.0);
        final away = delta.abs();
        final m = Matrix4.identity()
          ..setEntry(3, 2, 0.0015)
          ..rotateY(delta * 0.10)
          ..scaleByDouble(1 - away * 0.05, 1 - away * 0.05, 1.0, 1.0);
        return Transform(
          alignment: Alignment.center,
          transform: m,
          child: Opacity(opacity: 1 - away * 0.30, child: child),
        );
      },
      child: child,
    );
  }
}

// ── slides ───────────────────────────────────────────────────────

class _SlideCard extends StatelessWidget {
  final _Slide spec;
  final int number;
  final bool active;
  final bool compact;

  const _SlideCard({
    required this.spec,
    required this.number,
    required this.active,
    required this.compact,
  });

  // The card is always white, even when the app is in dark mode: this is a
  // WhatsApp window, and a beige chat cannot sit in a dark shell. So its text
  // colours are fixed ink, never theme.onSurface.
  static const _ink = Color(0xFF17123A);
  static const _inkSoft = Color(0xFF6B6485);

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 6),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFDFB),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.30),
            blurRadius: 28,
            offset: const Offset(0, 16),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              height: 4,
              decoration: const BoxDecoration(
                gradient: LinearGradient(colors: [
                  Color(0xFF6D5BF6),
                  Color(0xFFA78BFA),
                  Color(0xFFFBBF24),
                ]),
              ),
            ),
            Expanded(
              child: Padding(
                padding: EdgeInsets.fromLTRB(
                    compact ? 13 : 15, compact ? 11 : 13, compact ? 13 : 15, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.fromLTRB(8, 4, 9, 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEFEBFE),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (spec.languages) ...[
                                const _NaijaFlag(width: 15, height: 10),
                                const SizedBox(width: 5),
                              ] else ...[
                                const Icon(Icons.auto_awesome_rounded,
                                    size: 11,
                                    color: VeloSalesTheme.purpleDark),
                                const SizedBox(width: 4),
                              ],
                              Text(
                                spec.tag,
                                style: const TextStyle(
                                  fontSize: 8.5,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 0.7,
                                  color: VeloSalesTheme.purpleDark,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const Spacer(),
                        Text(
                          '${(number + 1).toString().padLeft(2, '0')} / '
                          '${_slides.length.toString().padLeft(2, '0')}',
                          style: TextStyle(
                            fontSize: 9.5,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.4,
                            color: _inkSoft.withValues(alpha: 0.70),
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: compact ? 7 : 9),
                    Text(
                      spec.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: compact ? 18 : 20,
                        height: 1.12,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.55,
                        color: _ink,
                      ),
                    ),
                    SizedBox(height: compact ? 8 : 10),
                    Expanded(
                      child: spec.orbit
                          ? _OrbitSlide(active: active, compact: compact)
                          : _ChatSlide(
                              spec: spec,
                              active: active,
                              compact: compact,
                            ),
                    ),
                    SizedBox(height: compact ? 7 : 9),
                    _Result(
                      spec: spec,
                      compact: compact,
                      active: active,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// WhatsApp, rebuilt inside the card: teal header, wallpaper, tails, times,
/// blue ticks, typing dots and a reply that types itself.
class _ChatSlide extends StatefulWidget {
  final _Slide spec;
  final bool active;
  final bool compact;

  const _ChatSlide({
    required this.spec,
    required this.active,
    required this.compact,
  });

  @override
  State<_ChatSlide> createState() => _ChatSlideState();
}

class _ChatSlideState extends State<_ChatSlide>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3300),
      value: 1,
    );
    if (widget.active) _c.forward(from: 0);
  }

  @override
  void didUpdateWidget(_ChatSlide old) {
    super.didUpdateWidget(old);
    if (widget.active && !old.active) _c.forward(from: 0);
    if (!widget.active && old.active) _c.value = 1;
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (reducedMotion(context)) {
      // No typing theatre; the finished exchange is still the point.
      return _ChatFrame(spec: widget.spec, compact: widget.compact, at: 1);
    }
    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) => _ChatFrame(
        spec: widget.spec,
        compact: widget.compact,
        at: _c.value,
      ),
    );
  }
}

class _ChatFrame extends StatelessWidget {
  final _Slide spec;
  final bool compact;
  final double at;

  const _ChatFrame({
    required this.spec,
    required this.compact,
    required this.at,
  });

  double _seg(double a, double b) =>
      ((at - a) / (b - a)).clamp(0.0, 1.0);

  @override
  Widget build(BuildContext context) {
    final incoming = _seg(0.02, 0.16);
    final typing = at > 0.17 && at < 0.34;
    final replyIn = _seg(0.33, 0.44);
    final typed = _seg(0.38, 0.72);
    final text = spec.reply.substring(
        0, (spec.reply.length * typed).floor().clamp(0, spec.reply.length));
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFEFEAE2),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFD9D2C7)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          _WhatsAppHeader(compact: compact),
          Expanded(
            child: Stack(
              children: [
                const Positioned.fill(
                    child: CustomPaint(painter: _WallpaperPainter())),
                Padding(
                  padding: EdgeInsets.fromLTRB(
                      compact ? 7 : 9, compact ? 6 : 8, compact ? 7 : 9, 6),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Center(child: _DayPill()),
                      if (incoming > 0)
                        Opacity(
                          opacity: incoming,
                          child: Transform.translate(
                            offset: Offset(0, (1 - incoming) * 8),
                            child: _Bubble(
                              text: spec.customer,
                              time: spec.time,
                              incoming: true,
                              compact: compact,
                            ),
                          ),
                        ),
                      if (typing)
                        Padding(
                          padding: const EdgeInsets.only(top: 5),
                          child: Align(
                            alignment: Alignment.centerRight,
                            child: _TypingBubble(at: at, compact: compact),
                          ),
                        ),
                      if (replyIn > 0)
                        Opacity(
                          opacity: replyIn,
                          child: Transform.scale(
                            scale: 0.94 + replyIn * 0.06,
                            alignment: Alignment.topRight,
                            child: _Bubble(
                              text: text +
                                  (typed > 0 && typed < 1 ? ' |' : ''),
                              time: spec.time,
                              incoming: false,
                              compact: compact,
                              ai: true,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          _ComposerBar(compact: compact),
        ],
      ),
    );
  }
}

class _WhatsAppHeader extends StatelessWidget {
  final bool compact;
  const _WhatsAppHeader({required this.compact});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: compact ? 38 : 44,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      color: const Color(0xFF008069),
      child: Row(
        children: [
          Container(
            width: compact ? 25 : 28,
            height: compact ? 25 : 28,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.18),
              shape: BoxShape.circle,
            ),
            child: BrandMark(
                size: compact ? 15 : 17, solid: Colors.white),
          ),
          const SizedBox(width: 7),
          Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Adaeze Fabrics',
                style: TextStyle(
                  fontSize: 10.5,
                  height: 1.2,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
              Text(
                'online',
                style: TextStyle(
                  fontSize: 8,
                  height: 1.2,
                  color: Colors.white.withValues(alpha: 0.72),
                ),
              ),
            ],
          ),
          const Spacer(),
          const Icon(Icons.videocam_outlined,
              size: 15, color: Colors.white70),
          const SizedBox(width: 10),
          const Icon(Icons.call_outlined, size: 14, color: Colors.white70),
          const SizedBox(width: 6),
          const Icon(Icons.more_vert, size: 15, color: Colors.white70),
        ],
      ),
    );
  }
}

class _DayPill extends StatelessWidget {
  const _DayPill();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: const Color(0xFFFCF5E9).withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(5),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withValues(alpha: 0.06), blurRadius: 2),
        ],
      ),
      child: const Text(
        'TODAY',
        style: TextStyle(
          fontSize: 7.5,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.5,
          color: Color(0xFF6B7B7A),
        ),
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  final String text;
  final String time;
  final bool incoming;
  final bool compact;
  final bool ai;

  const _Bubble({
    required this.text,
    required this.time,
    required this.incoming,
    required this.compact,
    this.ai = false,
  });

  @override
  Widget build(BuildContext context) {
    final bg = incoming ? const Color(0xFFFFFFFF) : const Color(0xFFDCF8C6);
    return Padding(
      padding: const EdgeInsets.only(top: 5),
      child: Align(
        alignment: incoming ? Alignment.centerLeft : Alignment.centerRight,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              constraints: BoxConstraints(
                maxWidth: MediaQuery.sizeOf(context).width * 0.56,
              ),
              padding: EdgeInsets.fromLTRB(
                  compact ? 8 : 9, compact ? 6 : 7, compact ? 8 : 9, 5),
              decoration: BoxDecoration(
                color: bg,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(incoming ? 2 : 8),
                  topRight: Radius.circular(incoming ? 8 : 2),
                  bottomLeft: const Radius.circular(8),
                  bottomRight: const Radius.circular(8),
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.07),
                    blurRadius: 1,
                    offset: const Offset(0, 1),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (ai)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 2),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: const [
                          Icon(Icons.auto_awesome_rounded,
                              size: 9, color: Color(0xFF0A7C66)),
                          SizedBox(width: 3),
                          Text(
                            'VELO AI',
                            style: TextStyle(
                              fontSize: 7,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.5,
                              color: Color(0xFF0A7C66),
                            ),
                          ),
                        ],
                      ),
                    ),
                  Text(
                    text,
                    style: TextStyle(
                      fontSize: compact ? 10 : 10.8,
                      height: 1.38,
                      color: const Color(0xFF111B21),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      Text(
                        time,
                        style: const TextStyle(
                          fontSize: 7.5,
                          color: Color(0xFF667781),
                        ),
                      ),
                      if (!incoming) ...[
                        const SizedBox(width: 3),
                        const Icon(Icons.done_all_rounded,
                            size: 10, color: Color(0xFF53BDEB)),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            Positioned(
              top: 0,
              left: incoming ? -5 : null,
              right: incoming ? null : -5,
              child: CustomPaint(
                size: const Size(6, 8),
                painter: _TailPainter(bg, incoming: incoming),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TailPainter extends CustomPainter {
  final Color color;
  final bool incoming;
  const _TailPainter(this.color, {required this.incoming});

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()..color = color;
    final path = Path();
    if (incoming) {
      path
        ..moveTo(size.width, 0)
        ..lineTo(0, 0)
        ..lineTo(size.width, size.height)
        ..close();
    } else {
      path
        ..moveTo(0, 0)
        ..lineTo(size.width, 0)
        ..lineTo(0, size.height)
        ..close();
    }
    canvas.drawPath(path, p);
  }

  @override
  bool shouldRepaint(_TailPainter old) =>
      old.color != color || old.incoming != incoming;
}

class _TypingBubble extends StatelessWidget {
  final double at;
  final bool compact;
  const _TypingBubble({required this.at, required this.compact});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
          horizontal: compact ? 9 : 11, vertical: compact ? 7 : 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(2),
          topRight: Radius.circular(8),
          bottomLeft: Radius.circular(8),
          bottomRight: Radius.circular(8),
        ),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withValues(alpha: 0.07), blurRadius: 1),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: List.generate(3, (i) {
          final phase = (at * 24 - i).clamp(0.0, 1.0);
          final lift = math.sin(phase * math.pi).abs();
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 1.5),
            child: Transform.translate(
              offset: Offset(0, -3 * lift),
              child: Container(
                width: compact ? 4 : 5,
                height: compact ? 4 : 5,
                decoration: BoxDecoration(
                  color: const Color(0xFF7B8B8A)
                      .withValues(alpha: 0.45 + lift * 0.45),
                  shape: BoxShape.circle,
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}

class _ComposerBar extends StatelessWidget {
  final bool compact;
  const _ComposerBar({required this.compact});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFFF0F2F5),
      padding: EdgeInsets.fromLTRB(6, compact ? 4 : 6, 6, compact ? 5 : 7),
      child: Row(
        children: [
          Expanded(
            child: Container(
              height: compact ? 24 : 28,
              padding: const EdgeInsets.symmetric(horizontal: 9),
              alignment: Alignment.centerLeft,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Text(
                'Message',
                style: TextStyle(
                    fontSize: 9,
                    color: Color(0xFF8696A0)),
              ),
            ),
          ),
          const SizedBox(width: 5),
          Container(
            width: compact ? 24 : 28,
            height: compact ? 24 : 28,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              color: Color(0xFF00A884),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.send_rounded,
                size: 12, color: Colors.white),
          ),
        ],
      ),
    );
  }
}

class _WallpaperPainter extends CustomPainter {
  const _WallpaperPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = const Color(0xFF8C7B67).withValues(alpha: 0.09)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    // A quiet, WhatsApp-like doodle wallpaper. Six shapes repeat on a grid.
    for (double y = 18; y < size.height; y += 54) {
      for (double x = 18; x < size.width; x += 62) {
        final ox = ((y / 54).floor().isEven) ? 0.0 : 14.0;
        _heart(canvas, Offset(x + ox, y), p);
        _cup(canvas, Offset(x + ox + 30, y + 20), p);
        canvas.drawCircle(Offset(x + ox + 4, y + 28), 5, p);
        canvas.drawLine(Offset(x + ox + 20, y + 4),
            Offset(x + ox + 34, y + 4), p);
      }
    }
  }

  void _heart(Canvas c, Offset o, Paint p) {
    final path = Path()
      ..moveTo(o.dx, o.dy + 4)
      ..cubicTo(o.dx - 7, o.dy - 2, o.dx - 1, o.dy - 8, o.dx, o.dy - 3)
      ..cubicTo(o.dx + 1, o.dy - 8, o.dx + 7, o.dy - 2, o.dx, o.dy + 4)
      ..close();
    c.drawPath(path, p);
  }

  void _cup(Canvas c, Offset o, Paint p) {
    c.drawRRect(
      RRect.fromLTRBR(o.dx, o.dy, o.dx + 9, o.dy + 8, const Radius.circular(2)),
      p,
    );
    c.drawArc(
      Rect.fromCircle(center: Offset(o.dx + 10, o.dy + 4), radius: 3),
      -math.pi / 2,
      math.pi,
      false,
      p,
    );
  }

  @override
  bool shouldRepaint(_WallpaperPainter old) => false;
}

class _Result extends StatefulWidget {
  final _Slide spec;
  final bool compact;
  final bool active;
  const _Result({
    required this.spec,
    required this.compact,
    required this.active,
  });

  @override
  State<_Result> createState() => _ResultState();
}

class _ResultState extends State<_Result>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 360),
      value: widget.active ? 0 : 1,
    );
    if (widget.active) _schedule();
  }

  void _schedule() {
    _timer?.cancel();
    // The reply finishes typing around 2.4s; the payoff lands just after it.
    _timer = Timer(const Duration(milliseconds: 2650), () {
      if (mounted) _c.forward();
    });
  }

  @override
  void didUpdateWidget(_Result old) {
    super.didUpdateWidget(old);
    if (widget.active && !old.active) {
      _c.value = 0;
      _schedule();
    } else if (!widget.active && old.active) {
      _timer?.cancel();
      _c.value = 1;
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final content = _card(context);
    if (reducedMotion(context)) return content;
    return AnimatedBuilder(
      animation: _c,
      builder: (context, child) => Opacity(
        opacity: _c.value,
        child: Transform.translate(
          offset: Offset(0, 7 * (1 - _c.value)),
          child: child,
        ),
      ),
      child: content,
    );
  }

  Widget _card(BuildContext context) {
    final spec = widget.spec;
    final compact = widget.compact;
    return Container(
      height: compact ? 30 : 34,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        color: spec.orbit
            ? const Color(0xFFF1EEFE)
            : const Color(0xFFEAF9F1),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: spec.orbit
              ? const Color(0xFFD8D0FA)
              : const Color(0xFFA7F3D0),
        ),
      ),
      child: Row(
        children: [
          if (spec.languages) ...[
            const _NaijaFlag(width: 24, height: 16),
            const SizedBox(width: 7),
            Expanded(
              child: FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Row(
                  children: [
                    for (final lang in const [
                      'Pidgin',
                      'Yorùbá',
                      'Igbo',
                      'Hausa',
                    ])
                      Padding(
                        padding: const EdgeInsets.only(right: 4),
                        child: Container(
                          padding: const EdgeInsets.fromLTRB(6, 3, 6, 3),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(
                                color: const Color(0xFFA7F3D0)),
                          ),
                          child: Text(
                            lang,
                            style: const TextStyle(
                              fontSize: 8,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF047857),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ] else ...[
            Icon(
              spec.orbit
                  ? Icons.hub_rounded
                  : Icons.check_circle_rounded,
              size: 14,
              color: spec.orbit
                  ? VeloSalesTheme.purpleDark
                  : const Color(0xFF059669),
            ),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                spec.result,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: compact ? 9.5 : 10.5,
                  fontWeight: FontWeight.w800,
                  color: spec.orbit
                      ? VeloSalesTheme.purpleDark
                      : const Color(0xFF047857),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _NaijaFlag extends StatelessWidget {
  final double width;
  final double height;
  const _NaijaFlag({this.width = 22, this.height = 15});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(2.5),
        border: Border.all(color: Colors.black.withValues(alpha: 0.12)),
      ),
      child: Row(
        children: const [
          Expanded(child: ColoredBox(color: Color(0xFF008751))),
          Expanded(child: ColoredBox(color: Colors.white)),
          Expanded(child: ColoredBox(color: Color(0xFF008751))),
        ],
      ),
    );
  }
}

// ── all-in-one orbit ─────────────────────────────────────────────

class _OrbitSlide extends StatefulWidget {
  final bool active;
  final bool compact;
  const _OrbitSlide({required this.active, required this.compact});

  @override
  State<_OrbitSlide> createState() => _OrbitSlideState();
}

class _OrbitSlideState extends State<_OrbitSlide>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 14),
    );
    if (widget.active) _c.repeat();
  }

  @override
  void didUpdateWidget(_OrbitSlide old) {
    super.didUpdateWidget(old);
    if (widget.active && !old.active) _c.repeat();
    if (!widget.active && old.active) _c.stop();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = widget.compact ? 190.0 : 220.0;
    return SizedBox.expand(
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(
            width: size * 0.86,
            height: size * 0.86,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(colors: [
                Color(0x33FFFFFF),
                Color(0x00000000),
              ]),
            ),
          ),
          CustomPaint(
            size: Size(size, size),
            painter: _OrbitRingPainter(color: const Color(0xFF6D5BF6)),
          ),
          if (reducedMotion(context))
            _orbitMarks(size, 0)
          else
            AnimatedBuilder(
              animation: _c,
              builder: (context, _) =>
                  _orbitMarks(size, _c.value * math.pi * 2),
            ),
          Container(
            width: widget.compact ? 62 : 72,
            height: widget.compact ? 62 : 72,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF6D5BF6).withValues(alpha: 0.35),
                  blurRadius: 26,
                  spreadRadius: 4,
                ),
              ],
            ),
            child: BrandMark(size: widget.compact ? 34 : 40),
          ),
        ],
      ),
    );
  }

  Widget _orbitMarks(double size, double angle) {
    const marks = [
      SalesChannel.instagram,
      SalesChannel.whatsapp,
      SalesChannel.telegram,
    ];
    final radius = size / 2 - 17;
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          for (var i = 0; i < marks.length; i++)
            Transform.translate(
              offset: Offset(
                math.cos(angle + i * 2 * math.pi / 3) * radius,
                math.sin(angle + i * 2 * math.pi / 3) * radius,
              ),
              child: Transform.rotate(
                angle: -(angle + i * 2 * math.pi / 3),
                child: Container(
                  padding: const EdgeInsets.all(3),
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Color(0x33000000),
                        blurRadius: 8,
                        offset: Offset(0, 3),
                      ),
                    ],
                  ),
                  child: ChannelMark(channel: marks[i], size: 26),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _OrbitRingPainter extends CustomPainter {
  final Color color;
  const _OrbitRingPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = color.withValues(alpha: 0.18)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;
    canvas.drawCircle(size.center(Offset.zero), size.width / 2 - 16, p);
    final dot = Paint()..color = color.withValues(alpha: 0.24);
    for (var i = 0; i < 8; i++) {
      final a = i * math.pi / 4;
      canvas.drawCircle(
        Offset(
          size.width / 2 + math.cos(a) * (size.width / 2 - 16),
          size.height / 2 + math.sin(a) * (size.height / 2 - 16),
        ),
        1.2,
        dot,
      );
    }
  }

  @override
  bool shouldRepaint(_OrbitRingPainter old) => false;
}

// ── dots + footer ────────────────────────────────────────────────

class _Dots extends StatelessWidget {
  final int count;
  final int index;
  const _Dots({required this.count, required this.index});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 18,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          for (var i = 0; i < count; i++)
            AnimatedContainer(
              duration: const Duration(milliseconds: 260),
              curve: Curves.easeOutCubic,
              margin: const EdgeInsets.symmetric(horizontal: 2.5),
              width: i == index ? 22 : 7,
              height: 5,
              decoration: BoxDecoration(
                color: i == index
                    ? Colors.white
                    : Colors.white.withValues(alpha: 0.28),
                borderRadius: BorderRadius.circular(999),
                boxShadow: i == index
                    ? [
                        BoxShadow(
                          color: Colors.white.withValues(alpha: 0.35),
                          blurRadius: 8,
                        ),
                      ]
                    : null,
              ),
            ),
        ],
      ),
    );
  }
}

class _Footer extends StatelessWidget {
  final double bottom;
  final bool compact;
  final VoidCallback onGetStarted;
  final VoidCallback onSignIn;

  const _Footer({
    required this.bottom,
    required this.compact,
    required this.onGetStarted,
    required this.onSignIn,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(22, compact ? 8 : 12, 22, 10 + bottom),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Pressable(
            onTap: onGetStarted,
            radius: BorderRadius.circular(16),
            child: Container(
              height: compact ? 48 : 54,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.24),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text(
                    'Get started',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.3,
                      color: Color(0xFF2A1E6B),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    width: 26,
                    height: 26,
                    alignment: Alignment.center,
                    decoration: const BoxDecoration(
                      color: Color(0xFFEFEBFE),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.arrow_forward_rounded,
                        size: 15, color: Color(0xFF4F3FC7)),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 9),
          Pressable(
            onTap: onSignIn,
            radius: BorderRadius.circular(10),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Text.rich(
                TextSpan(
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: Colors.white.withValues(alpha: 0.62),
                  ),
                  children: const [
                    TextSpan(text: 'Already have a shop? '),
                    TextSpan(
                      text: 'Sign in',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                        decoration: TextDecoration.underline,
                        decorationColor: Colors.white54,
                      ),
                    ),
                  ],
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ),
          const SizedBox(height: 1),
          Text(
            '7 days free  ·  No card  ·  Set up in 3 minutes',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 9.5,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.15,
              color: Colors.white.withValues(alpha: 0.42),
            ),
          ),
        ],
      ),
    );
  }
}

// ── slide copy ───────────────────────────────────────────────────

class _Slide {
  final String tag;
  final String title;
  final String customer;
  final String reply;
  final String result;
  final String time;
  final bool languages;
  final bool orbit;

  const _Slide({
    required this.tag,
    required this.title,
    this.customer = '',
    this.reply = '',
    required this.result,
    this.time = '',
    this.languages = false,
    this.orbit = false,
  });
}

const _slides = [
  _Slide(
    tag: 'REPLIES IN SECONDS',
    title: 'Answer before they scroll away.',
    customer: 'Do you have the Aura tote in black? How much?',
    reply: 'Yes — ₦42,000. Black and tan are in stock. I can send a payment '
        'link right now if you want it.',
    result: 'Replied in 4 seconds · 2:14 AM',
    time: '2:14',
  ),
  _Slide(
    tag: 'KNOWS YOUR CATALOG',
    title: 'Every product. Every price. Memorised.',
    customer: 'What sizes do the cloud sneakers come in?',
    reply: 'Sizes 38 to 45. White and sand are available — black just sold '
        'out. I can reserve your size before it goes.',
    result: 'Checked live stock · no guessing',
    time: '10:03',
  ),
  _Slide(
    tag: 'TAKES THE ORDER',
    title: 'It doesn\'t just chat. It closes.',
    customer: 'Send two glow sets to Lekki tomorrow.',
    reply: 'Done — 2 × Glow set, ₦64,000. Delivery tomorrow before 12. '
        'Confirm the address and I will book it.',
    result: 'Order #1042 created · address saved',
    time: '16:40',
  ),
  _Slide(
    tag: 'NIGERIAN LANGUAGES',
    title: 'Your customer\'s language. Word for word.',
    customer: 'How much be this bag? You get am for black?',
    reply: 'Na ₦42,000. Black and tan dey available. Which one you wan make '
        'I reserve for you?',
    result: 'Pidgin · Yorùbá · Igbo · Hausa',
    time: '09:21',
    languages: true,
  ),
  _Slide(
    tag: 'PAYMENTS',
    title: 'Sends the link. Gets you paid.',
    customer: 'I\'ll take it. How do I pay?',
    reply: 'Here is your secure link — ₦42,000. Card, transfer or USSD. '
        'I will send the receipt the moment it lands.',
    result: 'Paid · receipt sent automatically',
    time: '19:07',
  ),
  _Slide(
    tag: 'ALL IN ONE',
    title: 'Every channel. One brain.',
    result: 'Instagram · WhatsApp · Telegram',
    orbit: true,
  ),
];
