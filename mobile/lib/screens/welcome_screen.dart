// ── lib/screens/welcome_screen.dart ───────────────────────────────
// WHAT: the phone's front door, before sign-up, and the same six slides as the
// web's frontend/src/pages/Landing.jsx: real sellers with the WhatsApp messages
// Velo sends for them, the channels it works on, the one-tap connect, then the
// free offer. One action on every slide: Try it free.
//
// MOTION: slides change every 7 seconds and stop while a finger is down, or after
// the pause button. Swipe moves between them. Under reduced motion nothing moves
// on its own. Photos: free Unsplash photos (frontend/public/welcome/CREDITS.md).
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../brand_mark.dart';
import '../depth.dart';
import '../widgets/brand_ui.dart';

const _night = Color(0xFF0B0630);
const _coral = Color(0xFFD03C16);
const _lilac = Color(0xFFC9C2F5);
const _step = Duration(seconds: 7);

class _Msg {
  final String who, say;
  final String? coin, thumb;
  final bool naira, gift;
  final double top; // percent of the picture area
  const _Msg(this.who, this.say, this.top,
      {this.coin, this.thumb, this.naira = false, this.gift = false});
}

class _Slide {
  final String? photo;
  final Alignment align;
  final String? art; // 'channels' | 'connect'
  final String title, text;
  final _Msg? a, b;
  const _Slide({
    this.photo,
    this.align = Alignment.center,
    this.art,
    required this.title,
    required this.text,
    this.a,
    this.b,
  });
}

const _slides = [
  _Slide(
    photo: 's1',
    align: Alignment(0, -0.3),
    title: 'Never miss a customer again',
    text: 'Velo answers your WhatsApp in seconds, day and night, with your real prices.',
    a: _Msg('Customer', 'Is this bag still available?', 2, coin: 'whatsapp'),
    b: _Msg('Velo', 'Yes! ₦45,000. We deliver tomorrow.', 25),
  ),
  _Slide(
    photo: 's2',
    align: Alignment.center,
    title: 'Chats that turn into sales',
    text: 'Velo sends the product photo, quotes your price and tells buyers how to pay you.',
    a: _Msg('Photo sent', 'Black leather bag · ₦45,000', 4, thumb: 's2'),
    b: _Msg('New order', '2 bags · ₦90,000', 76, naira: true),
  ),
  _Slide(
    photo: 's3',
    align: Alignment.center,
    title: 'Speaks Pidgin, never guesses',
    text: "Velo answers the way your customers write. It only quotes your prices, and calls you when it isn't sure.",
    a: _Msg('Customer', 'How much be this one?', 4, coin: 'whatsapp'),
    b: _Msg('Velo', 'Na ₦12,500. E still dey!', 82),
  ),
  _Slide(
    art: 'channels',
    title: 'Every chat app, one Velo',
    text: 'WhatsApp and Telegram today. Facebook Messenger and Instagram are coming soon, answered by the same Velo.',
  ),
  _Slide(
    art: 'connect',
    title: 'WhatsApp in one tap',
    text: 'Log in with Facebook, choose your number and Velo starts answering. Telegram takes about a minute.',
  ),
  _Slide(
    photo: 's4',
    align: Alignment.center,
    title: 'Start free and sell more today',
    text: '50 free replies every day. No card needed.',
    a: _Msg('Free plan', '50 replies every day', 8, gift: true),
    b: _Msg('Bonus', 'Pro free for 7 days', 80),
  ),
];

const _channels = [
  ('whatsapp', 'WhatsApp', true),
  ('telegram', 'Telegram', true),
  ('messenger', 'Messenger', false),
  ('instagram', 'Instagram', false),
];

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

class _WelcomeScreenState extends State<WelcomeScreen>
    with SingleTickerProviderStateMixin {
  int _cur = 0;
  bool _paused = false;
  bool _held = false;
  Timer? _timer;
  late final AnimationController _float = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 7),
  );

  bool get _still => reducedMotion(context);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_still) {
      _float.stop();
    } else if (!_float.isAnimating) {
      _float.repeat(reverse: true);
    }
    _arm();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _float.dispose();
    super.dispose();
  }

  void _arm() {
    _timer?.cancel();
    if (_paused || _held || _still) return;
    _timer = Timer(_step, () => _go(_cur + 1));
  }

  void _go(int i) {
    if (!mounted) return;
    setState(() => _cur = (i % _slides.length + _slides.length) % _slides.length);
    _arm();
  }

  void _hold(bool on) {
    if (_held == on) return;
    _held = on;
    _arm();
  }

  @override
  Widget build(BuildContext context) {
    final pad = MediaQuery.paddingOf(context);
    final size = MediaQuery.sizeOf(context);
    final short = size.height < 700;
    return Scaffold(
      backgroundColor: _night,
      body: Listener(
        onPointerDown: (_) => _hold(true),
        onPointerUp: (_) => _hold(false),
        onPointerCancel: (_) => _hold(false),
        child: GestureDetector(
          onHorizontalDragEnd: (d) {
            final v = d.primaryVelocity ?? 0;
            if (v.abs() < 200) return;
            HapticFeedback.selectionClick();
            _go(_cur + (v < 0 ? 1 : -1));
          },
          child: Stack(
            children: [
              for (var i = 0; i < _slides.length; i++)
                Positioned.fill(
                  child: IgnorePointer(
                    ignoring: i != _cur,
                    child: ExcludeSemantics(
                      excluding: i != _cur,
                      child: AnimatedOpacity(
                        opacity: i == _cur ? 1 : 0,
                        duration: Duration(milliseconds: _still ? 0 : 700),
                        child: _SlideView(
                          slide: _slides[i],
                          active: i == _cur,
                          still: _still,
                          float: _float,
                          top: pad.top + (short ? 76 : 84),
                          bottom: pad.bottom + (short ? 132 : 150),
                          short: short,
                        ),
                      ),
                    ),
                  ),
                ),
              Positioned(
                top: pad.top + 16,
                left: 16,
                right: 16,
                child: _TopNav(
                  count: _slides.length,
                  current: _cur,
                  paused: _paused,
                  showPause: !_still,
                  onBack: () => _go(_cur - 1),
                  onNext: () => _go(_cur + 1),
                  onDot: _go,
                  onPause: () {
                    setState(() => _paused = !_paused);
                    _arm();
                  },
                ),
              ),
              Positioned(
                left: 16,
                right: 16,
                bottom: pad.bottom + 18,
                child: _Actions(
                  short: short,
                  still: _still,
                  onTry: widget.onCreateAccount,
                  onSignIn: widget.onSignIn,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SlideView extends StatelessWidget {
  final _Slide slide;
  final bool active, still, short;
  final Animation<double> float;
  final double top, bottom;
  const _SlideView({
    required this.slide,
    required this.active,
    required this.still,
    required this.float,
    required this.top,
    required this.bottom,
    required this.short,
  });

  @override
  Widget build(BuildContext context) {
    final w = MediaQuery.sizeOf(context).width;
    final titleSize = short ? 34.0 : (w < 380 ? 40.0 : 46.0);
    return Stack(
      fit: StackFit.expand,
      children: [
        if (slide.photo != null) ...[
          AnimatedScale(
            scale: active || still ? 1 : 1.08,
            duration: Duration(milliseconds: still ? 0 : (active ? 8000 : 700)),
            curve: Curves.easeOut,
            child: Image.asset(
              'assets/welcome/${slide.photo}.jpg',
              fit: BoxFit.cover,
              alignment: slide.align,
            ),
          ),
          const ColoredBox(color: Color(0x262A1C7A)),
        ] else
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: Alignment(0, -0.32),
                radius: 1.1,
                colors: [Color(0xFF3A2A9A), Color(0xFF2A1C7A), Color(0xFF120B4A), _night],
                stops: [0, 0.3, 0.66, 1],
              ),
            ),
          ),
        DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: slide.photo != null
                  ? const [Color(0x8C0B0630), Color(0x000B0630), Color(0x000B0630), Color(0xCC120B4A), _night]
                  : const [Color(0x000B0630), Color(0x000B0630), _night],
              stops: slide.photo != null ? const [0, 0.18, 0.42, 0.6, 0.82] : const [0, 0.55, 0.82],
            ),
          ),
        ),
        Padding(
          padding: EdgeInsets.only(top: top, bottom: bottom),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: LayoutBuilder(
                  builder: (context, box) => Stack(
                    clipBehavior: Clip.none,
                    children: [
                      if (slide.a != null) _pill(slide.a!, box, true),
                      if (slide.b != null) _pill(slide.b!, box, false),
                      if (slide.art == 'channels')
                        Center(child: _fit(box, 300, _ChannelsArt(still: still))),
                      if (slide.art == 'connect')
                        Center(child: _fit(box, 360, _ConnectArt(still: still, float: float))),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      slide.title,
                      style: TextStyle(
                        fontSize: titleSize,
                        height: 1.04,
                        fontWeight: FontWeight.w600,
                        letterSpacing: titleSize > 40 ? -1.8 : -1.2,
                        color: Colors.white,
                      ),
                    ),
                    SizedBox(height: short ? 8 : 12),
                    Text(
                      slide.text,
                      style: TextStyle(
                        fontSize: 14,
                        height: 1.5,
                        color: Colors.white.withValues(alpha: 0.78),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _fit(BoxConstraints box, double size, Widget child) {
    final s = math.min(1.0, math.min(box.maxHeight, box.maxWidth) / size);
    return Transform.scale(scale: s, child: SizedBox(width: size, height: size, child: child));
  }

  Widget _pill(_Msg m, BoxConstraints box, bool first) {
    final pill = AnimatedBuilder(
      animation: float,
      builder: (_, child) => Transform.translate(
        offset: Offset(0, (first ? -8 : 7) * Curves.easeInOut.transform(float.value)),
        child: child,
      ),
      child: Transform.rotate(
        angle: (first ? -11 : 12) * math.pi / 180,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: box.maxWidth - 28),
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: _MessagePill(m: m, first: first),
          ),
        ),
      ),
    );
    return Positioned(
      top: box.maxHeight * m.top / 100,
      left: first ? box.maxWidth * 0.05 : null,
      right: first ? null : box.maxWidth * 0.03,
      child: pill,
    );
  }
}

class _MessagePill extends StatelessWidget {
  final _Msg m;
  final bool first;
  const _MessagePill({required this.m, required this.first});

  @override
  Widget build(BuildContext context) {
    final ink = first ? const Color(0xFF1E1757) : Colors.white;
    Widget icon;
    if (m.coin != null) {
      icon = Image.asset('assets/channels/${m.coin}.png', width: 46, height: 46);
    } else if (m.thumb != null) {
      icon = ClipOval(child: Image.asset('assets/welcome/${m.thumb}.jpg', width: 46, height: 46, fit: BoxFit.cover));
    } else {
      icon = Container(
        width: 46,
        height: 46,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: _coral,
          shape: BoxShape.circle,
          boxShadow: [BoxShadow(color: const Color(0xFFFF8A6B).withValues(alpha: 0.3), spreadRadius: 4)],
        ),
        child: m.naira
            ? const Text('₦', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white))
            : Icon(m.gift ? Icons.card_giftcard_rounded : Icons.check_rounded, size: 22, color: Colors.white),
      );
    }
    final words = Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(m.who, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: ink.withValues(alpha: 0.72))),
        Text(m.say, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: ink)),
      ],
    );
    return Container(
      padding: first ? const EdgeInsets.fromLTRB(8, 8, 22, 8) : const EdgeInsets.fromLTRB(22, 8, 8, 8),
      decoration: BoxDecoration(
        color: first ? Colors.white.withValues(alpha: 0.95) : const Color(0xB31E1757),
        borderRadius: BorderRadius.circular(999),
        border: first ? null : Border.all(color: Colors.white.withValues(alpha: 0.28)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.33), blurRadius: 40, offset: const Offset(0, 24))],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: first
            ? [icon, const SizedBox(width: 12), words]
            : [words, const SizedBox(width: 12), icon],
      ),
    );
  }
}

/// Slide 4: the channels circling Velo, with messages flowing in from the live ones.
class _ChannelsArt extends StatefulWidget {
  final bool still;
  const _ChannelsArt({required this.still});

  @override
  State<_ChannelsArt> createState() => _ChannelsArtState();
}

class _ChannelsArtState extends State<_ChannelsArt> with TickerProviderStateMixin {
  late final AnimationController _spin = AnimationController(vsync: this, duration: const Duration(seconds: 36));
  late final AnimationController _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 1800));

  @override
  void initState() {
    super.initState();
    if (!widget.still) {
      _spin.repeat();
      _pulse.repeat();
    }
  }

  @override
  void dispose() {
    _spin.dispose();
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: Listenable.merge([_spin, _pulse]),
      builder: (context, _) {
        final turn = _spin.value * 2 * math.pi;
        return Stack(
          clipBehavior: Clip.none,
          children: [
            Positioned.fill(child: CustomPaint(painter: _OrbitPainter(turn, _pulse.value))),
            for (var i = 0; i < _channels.length; i++)
              _sat(i, turn),
            Center(
              child: Container(
                width: 112,
                height: 112,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white.withValues(alpha: 0.3)),
                  gradient: RadialGradient(
                    center: const Alignment(-0.4, -0.48),
                    colors: [
                      Colors.white.withValues(alpha: 0.5),
                      Colors.white.withValues(alpha: 0.08),
                      const Color(0xFFB5A6FF).withValues(alpha: 0.12),
                      const Color(0xFFFF8A6B).withValues(alpha: 0.22),
                    ],
                    stops: const [0, 0.3, 0.65, 1],
                  ),
                  boxShadow: [
                    BoxShadow(color: Colors.black.withValues(alpha: 0.4), blurRadius: 50, offset: const Offset(0, 24)),
                    BoxShadow(color: const Color(0xFFFF8A6B).withValues(alpha: 0.25), blurRadius: 60),
                  ],
                ),
                child: const BrandMark(size: 52),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _sat(int i, double turn) {
    final (id, name, _) = _channels[i];
    final a = (i * 90 - 45) * math.pi / 180 + turn;
    final x = 150 + 150 * math.cos(a), y = 150 + 150 * math.sin(a);
    return Positioned(
      left: x - 29,
      top: y - 29,
      child: Semantics(
        label: name,
        child: Image.asset('assets/channels/$id.png', width: 58, height: 58),
      ),
    );
  }
}

class _OrbitPainter extends CustomPainter {
  final double turn, pulse;
  _OrbitPainter(this.turn, this.pulse);

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final dash = Paint()
      ..color = Colors.white.withValues(alpha: 0.22)
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;
    // The dashed ring.
    for (var k = 0; k < 72; k++) {
      final a0 = k * 2 * math.pi / 72;
      canvas.drawArc(Rect.fromCircle(center: c, radius: 150), a0, math.pi / 72, false, dash);
    }
    for (var i = 0; i < _channels.length; i++) {
      // Every channel orbits the same; the slide text says which are coming.
      final a = (i * 90 - 45) * math.pi / 180 + turn;
      final dir = Offset(math.cos(a), math.sin(a));
      final from = c + dir * 121, to = c + dir * 58;
      canvas.drawLine(
        from,
        to,
        Paint()
          ..strokeWidth = 2
          ..shader = LinearGradient(colors: [
            const Color(0xFFFF8A6B).withValues(alpha: 0.5),
            const Color(0xFFB9AEFB).withValues(alpha: 0.5),
          ]).createShader(Rect.fromPoints(from, to)),
      );
      final p = (pulse + i * 0.5) % 1;
      final dot = Offset.lerp(from, to, p)!;
      final glow = (p < 0.15 ? p / 0.15 : p > 0.85 ? (1 - p) / 0.15 : 1.0).clamp(0.0, 1.0);
      canvas.drawCircle(dot, 8, Paint()..color = const Color(0xFFFF8A6B).withValues(alpha: 0.3 * glow));
      canvas.drawCircle(dot, 4, Paint()..color = const Color(0xFFFF8A6B).withValues(alpha: glow));
    }
  }

  @override
  bool shouldRepaint(_OrbitPainter old) => old.turn != turn || old.pulse != pulse;
}

/// Slide 5: the Connect page, with WhatsApp going from Connect to Live.
class _ConnectArt extends StatefulWidget {
  final bool still;
  final Animation<double> float;
  const _ConnectArt({required this.still, required this.float});

  @override
  State<_ConnectArt> createState() => _ConnectArtState();
}

class _ConnectArtState extends State<_ConnectArt> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 4800));

  @override
  void initState() {
    super.initState();
    if (widget.still) {
      _c.value = 0.8;
    } else {
      _c.repeat();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Transform.rotate(
        angle: -3 * math.pi / 180,
        child: Container(
          width: 340,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(30),
            border: Border.all(color: Colors.white.withValues(alpha: 0.3)),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Colors.white.withValues(alpha: 0.2), const Color(0xFFB9AEFB).withValues(alpha: 0.1)],
            ),
            boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.4), blurRadius: 60, offset: const Offset(0, 30))],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Padding(
                padding: EdgeInsets.fromLTRB(4, 0, 4, 10),
                child: Row(
                  children: [
                    Text('Channels', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Colors.white)),
                    Spacer(),
                    Text('Velo answers on', style: TextStyle(fontSize: 12, color: _lilac)),
                  ],
                ),
              ),
              for (final (id, name, live) in _channels)
                Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    children: [
                      Image.asset('assets/channels/$id.png', width: 42, height: 42),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(id == 'messenger' ? 'Facebook Messenger' : name,
                                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white)),
                            Text(
                              id == 'whatsapp' ? 'Business number' : id == 'telegram' ? 'Your shop bot' : 'Coming soon',
                              style: const TextStyle(fontSize: 12, color: _lilac),
                            ),
                          ],
                        ),
                      ),
                      if (id == 'whatsapp')
                        AnimatedBuilder(animation: _c, builder: (_, _) => _button(_c.value))
                      else
                        _chip(live ? '✓ Live' : 'Soon', live),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _chip(String label, bool live) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: live ? const Color(0x3322C55E) : Colors.white.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(label,
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: live ? const Color(0xFF86EFAC) : _lilac)),
      );

  Widget _button(double t) {
    final Widget face;
    if (t < 0.34) {
      face = _face(_coral, const Text('Connect', style: _btnText));
    } else if (t < 0.62) {
      face = _face(
        Colors.white.withValues(alpha: 0.16),
        const Row(mainAxisSize: MainAxisSize.min, children: [
          SizedBox(width: 12, height: 12, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)),
          SizedBox(width: 6),
          Text('Connecting', style: _btnText),
        ]),
      );
    } else {
      face = _face(const Color(0xFF047857), const Text('✓ Live', style: _btnText));
    }
    final tap = t > 0.24 && t < 0.38 ? (t - 0.24) / 0.14 : -1.0;
    return SizedBox(
      width: 108,
      height: 36,
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.center,
        children: [
          face,
          if (tap >= 0)
            IgnorePointer(
              child: Container(
                width: 46 * (0.5 + tap),
                height: 46 * (0.5 + tap),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: 0.55 * (1 - tap)),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _face(Color bg, Widget child) => Container(
        width: 108,
        height: 36,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
        child: child,
      );
}

const _btnText = TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.white);

class _TopNav extends StatelessWidget {
  final int count, current;
  final bool paused, showPause;
  final VoidCallback onBack, onNext, onPause;
  final ValueChanged<int> onDot;
  const _TopNav({
    required this.count,
    required this.current,
    required this.paused,
    required this.showPause,
    required this.onBack,
    required this.onNext,
    required this.onPause,
    required this.onDot,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _circle(Icons.chevron_left_rounded, 'Previous slide', onBack, white: false),
        const SizedBox(width: 10),
        _circle(Icons.chevron_right_rounded, 'Next slide', onNext, white: true),
        const Spacer(),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.14),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (var i = 0; i < count; i++)
                Semantics(
                  button: true,
                  selected: i == current,
                  label: 'Slide ${i + 1} of $count',
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => onDot(i),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 300),
                      width: i == current ? 30 : 20,
                      height: 32,
                      alignment: Alignment.center,
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 300),
                        width: i == current ? 20 : 7,
                        height: 7,
                        decoration: BoxDecoration(
                          color: i == current ? Colors.white : Colors.white.withValues(alpha: 0.45),
                          borderRadius: BorderRadius.circular(99),
                        ),
                      ),
                    ),
                  ),
                ),
              if (showPause)
                Semantics(
                  button: true,
                  label: paused ? 'Play slides' : 'Pause slides',
                  child: GestureDetector(
                    onTap: onPause,
                    child: Container(
                      width: 32,
                      height: 32,
                      margin: const EdgeInsets.only(left: 2),
                      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.16), shape: BoxShape.circle),
                      child: Icon(paused ? Icons.play_arrow_rounded : Icons.pause_rounded, size: 16, color: Colors.white),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _circle(IconData icon, String label, VoidCallback onTap, {required bool white}) {
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: Pressable(
        onTap: onTap,
        radius: BorderRadius.circular(999),
        child: Container(
          width: 52,
          height: 52,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: white ? Colors.white : Colors.white.withValues(alpha: 0.14),
            border: white ? null : Border.all(color: Colors.white.withValues(alpha: 0.24)),
            boxShadow: white ? [BoxShadow(color: Colors.black.withValues(alpha: 0.25), blurRadius: 24, offset: const Offset(0, 10))] : null,
          ),
          child: Icon(icon, size: 26, color: white ? const Color(0xFF1E1757) : Colors.white),
        ),
      ),
    );
  }
}

class _Actions extends StatefulWidget {
  final bool short, still;
  final VoidCallback onTry, onSignIn;
  const _Actions({required this.short, required this.still, required this.onTry, required this.onSignIn});

  @override
  State<_Actions> createState() => _ActionsState();
}

class _ActionsState extends State<_Actions> with SingleTickerProviderStateMixin {
  late final AnimationController _nudge = AnimationController(vsync: this, duration: const Duration(milliseconds: 2800));

  @override
  void initState() {
    super.initState();
    if (!widget.still) _nudge.repeat();
  }

  @override
  void dispose() {
    _nudge.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final h = widget.short ? 64.0 : 72.0;
    final knob = h - 14;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Semantics(
          button: true,
          label: 'Try it free',
          excludeSemantics: true,
          child: Pressable(
            onTap: widget.onTry,
            radius: BorderRadius.circular(999),
            child: Container(
              height: h,
              padding: const EdgeInsets.only(left: 26, right: 7),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: Colors.white.withValues(alpha: 0.26)),
              ),
              child: Row(
                children: [
                  const Text('Try it free', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: Colors.white)),
                  const Spacer(),
                  for (final o in const [0.3, 0.6, 1.0])
                    Icon(Icons.chevron_right_rounded, size: 20, color: Colors.white.withValues(alpha: o)),
                  const SizedBox(width: 10),
                  AnimatedBuilder(
                    animation: _nudge,
                    builder: (_, child) {
                      final t = _nudge.value;
                      final dx = t < 0.7 ? 0.0 : t < 0.8 ? -10 * (t - 0.7) / 0.1 : t < 0.9 ? -10 * (0.9 - t) / 0.1 : 0.0;
                      return Transform.translate(offset: Offset(dx, 0), child: child);
                    },
                    child: Container(
                      width: knob,
                      height: knob,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.3), blurRadius: 24, offset: const Offset(0, 10))],
                      ),
                      child: const Icon(Icons.arrow_forward_rounded, color: _coral, size: 26),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 6),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('No card needed · Already selling?', style: TextStyle(fontSize: 14, color: Colors.white.withValues(alpha: 0.74))),
            TextButton(
              onPressed: widget.onSignIn,
              style: TextButton.styleFrom(
                foregroundColor: Colors.white,
                minimumSize: const Size(48, 44),
                padding: const EdgeInsets.symmetric(horizontal: 6),
              ),
              child: const Text(
                'Sign in',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  decoration: TextDecoration.underline,
                  decorationColor: Colors.white,
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
