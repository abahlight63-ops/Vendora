// ── lib/screens/airbot_test_screen.dart ──────────────────────────
// WHAT: the development/demo screen for AirBot — press a state, see it
// animate live; type a message and hit Speak to see the bubble + mouth move.
// This is a DEV surface: reachable via a debug-only entry (see main.dart
// "AirBot test" in debug builds). Remove/hide before production if desired.
library;

import 'package:flutter/material.dart';

import '../airbot/airbot_controller.dart';
import '../airbot/airbot_guide.dart';
import '../airbot/airbot_types.dart';

class AirBotTestScreen extends StatefulWidget {
  const AirBotTestScreen({super.key});
  @override
  State<AirBotTestScreen> createState() => _AirBotTestScreenState();
}

class _AirBotTestScreenState extends State<AirBotTestScreen> {
  final TextEditingController _msg = TextEditingController();
  final Map<AirBotState, String> _labels = {
    AirBotState.idle: 'IDLE',
    AirBotState.talking: 'TALKING',
    AirBotState.wave: 'WAVE',
    AirBotState.pointLeft: 'POINT LEFT',
    AirBotState.pointRight: 'POINT RIGHT',
    AirBotState.pointDown: 'POINT DOWN',
    AirBotState.thinking: 'THINKING',
    AirBotState.success: 'SUCCESS',
    AirBotState.confused: 'CONFUSED',
    AirBotState.welcome: 'WELCOME',
    AirBotState.goodbye: 'GOODBYE',
  };

  @override
  void dispose() {
    _msg.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = AirBotController.instance;
    final scheme = Theme.of(context).colorScheme;
    final states = AirBotState.values;

    return Scaffold(
      appBar: AppBar(title: const Text('AirBot test')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              // character stage (large)
              Expanded(
                child: Center(
                  child: AirBotGuide(size: AirBotSize.large),
                ),
              ),
              // message input + speak
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _msg,
                      decoration: const InputDecoration(
                        hintText: 'Message…',
                        isDense: true,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  FilledButton(
                    onPressed: () {
                      if (_msg.text.trim().isNotEmpty) {
                        c.speak(_msg.text.trim());
                      }
                    },
                    child: const Text('Speak'),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              // state buttons grid
              Expanded(
                flex: 2,
                child: GridView.count(
                  crossAxisCount: 3,
                  mainAxisSpacing: 8,
                  crossAxisSpacing: 8,
                  children: states
                      .map((s) => _StateButton(
                            label: _labels[s]!,
                            active: c.state == s,
                            activeColor: scheme.primary,
                            onTap: () => c.play(s),
                          ))
                      .toList(),
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => c.showMessage(
                          'This is a long message to prove the bubble wraps nicely on narrow phones and never covers the buttons below.'),
                      child: const Text('Long msg'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => c.hideMessage(),
                      child: const Text('Clear msg'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => c.guideTo(AirBotTarget('whatsapp',
                          message: 'Tap the highlighted button to connect.')),
                      child: const Text('Guide → WA'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StateButton extends StatelessWidget {
  const _StateButton({
    required this.label,
    required this.active,
    required this.activeColor,
    required this.onTap,
  });
  final String label;
  final bool active;
  final Color activeColor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return FilledButton(
      style: FilledButton.styleFrom(
        backgroundColor: active ? activeColor : null,
        padding: const EdgeInsets.symmetric(horizontal: 4),
      ),
      onPressed: onTap,
      child: Text(label, textAlign: TextAlign.center),
    );
  }
}