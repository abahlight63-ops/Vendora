// ── lib/ads.dart ───────────────────────────────────────────────────
// WHAT: the phone's half of the sponsor system (web parity with
// frontend/src/lib/ads.js). Network script tags can't run natively, but
// the DIRECT sponsor (your best rates!) works here: a glass Sponsored
// card, max once/day, with a Watch-video button when SPONSOR_VIDEO_URL
// is set. Every "Visit sponsor" tap is logged to /api/me/ads/click
// BEFORE the visit, so clicks are never lost for sponsor invoicing.
// Ads must NEVER break the app: everything is try/caught, Pro or
// unconfigured backends silently show nothing.
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'glass.dart';

/// Sponsored interstitial, max once/day, clearly labeled, one-tap close.
/// Call after high-attention free-tier moments (product add, AI limit hit
/// — the same two moments the web app uses).
Future<void> maybeShowSponsor(BuildContext context) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final today = DateTime.now().toUtc().toIso8601String().substring(0, 10);
    if (prefs.getString('sponsor_seen') == today) return; // daily cap (same key habit as web localStorage)
    final me = await ApiClient.instance.me();
    final ads = (me as Map)['ads'];
    final sp = ads is Map ? ads['sponsor'] : null;
    if (sp is! Map) return; // Pro / trial / unconfigured → nothing, silently (web parity)
    await prefs.setString('sponsor_seen', today); // mark FIRST: cap holds even on instant dismiss
    if (!context.mounted) return;
    final link = '${sp['link'] ?? ''}';
    final video = '${sp['video'] ?? ''}';
    final scheme = Theme.of(context).colorScheme;
    await glassDialog(
      context,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: scheme.primary.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text('SPONSORED',
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1,
                    color: scheme.primary)),
          ),
          const SizedBox(height: 10),
          Text('${sp['title'] ?? 'Sponsored'}',
              style:
                  const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
          if ('${sp['text'] ?? ''}'.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text('${sp['text']}',
                style: TextStyle(
                    fontSize: 13.5,
                    color: scheme.onSurface.withValues(alpha: 0.75))),
          ],
          const SizedBox(height: 14),
          if (video.isNotEmpty)
            OutlinedButton.icon(
              onPressed: () => launchUrl(Uri.parse(video),
                  mode: LaunchMode.externalApplication),
              icon: const Icon(Icons.play_circle_outline, size: 18),
              label: const Text('Watch video'),
            ),
          FilledButton.icon(
            // THE money event: log FIRST (await = counted before they leave)…
            onPressed: () async {
              try {
                await ApiClient.instance.adClick('sponsor', link);
              } catch (_) {} // …logging never blocks the visit…
              if (link.isNotEmpty) {
                await launchUrl(Uri.parse(link),
                    mode: LaunchMode.externalApplication);
              }
              if (context.mounted) Navigator.of(context).pop();
            },
            icon: const Icon(Icons.open_in_new, size: 17),
            label: const Text('Visit sponsor'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Continue without visiting'),
          ),
          Text('Pro removes sponsors — see Billing',
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 11.5,
                  color: scheme.onSurface.withValues(alpha: 0.55))),
        ],
      ),
    );
  } catch (_) {
    // Ads must never break the app — any failure = no card, no crash.
  }
}
