// ── lib/screens/legal_screen.dart ─────────────────────────────────
// WHAT: Terms & Conditions and Privacy Policy, readable inside the app.
// WHY IT EXISTS: the signup screen asks people to accept these documents, and
// until now the phone had nothing to link to — the box pointed at text that
// lived only on the website. A consent screen without the document is not
// consent.
//
// The copy mirrors frontend/src/pages/Terms.jsx and Privacy.jsx section for
// section. If the web policy changes, change this file in the same commit.
import 'package:flutter/material.dart';

enum LegalDoc { terms, privacy }

class LegalScreen extends StatefulWidget {
  final LegalDoc initial;

  const LegalScreen({super.key, this.initial = LegalDoc.terms});

  @override
  State<LegalScreen> createState() => _LegalScreenState();
}

class _LegalScreenState extends State<LegalScreen> {
  late LegalDoc _doc = widget.initial;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final isTerms = _doc == LegalDoc.terms;

    return Scaffold(
      appBar: AppBar(title: const Text('Legal')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
        children: [
          _Switch(
            value: _doc,
            onChanged: (d) => setState(() => _doc = d),
          ),
          const SizedBox(height: 18),
          Text(
            isTerms ? 'Terms & Conditions' : 'Privacy Policy',
            style: TextStyle(
              fontSize: 26,
              height: 1.15,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.8,
              color: scheme.onSurface,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Last updated: September 2026',
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
              color: scheme.onSurface.withValues(alpha: 0.5),
            ),
          ),
          const SizedBox(height: 18),
          ...(isTerms ? _terms : _privacy).map((s) => _SectionBlock(s)),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: scheme.primaryContainer.withValues(alpha: 0.55),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(
                isTerms ? 'Questions about these terms?' : 'A data request?',
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 6),
              Text(
                'Write to velosales63@gmail.com from the email on your account, '
                'or open Help in the app. We answer within 7 days.',
                style: TextStyle(
                  fontSize: 13,
                  height: 1.5,
                  color: scheme.onSurface.withValues(alpha: 0.7),
                ),
              ),
            ]),
          ),
          const SizedBox(height: 20),
          Center(
            child: Text(
              '© 2026 VeloSales Ai · Made for shops that never sleep',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 11.5,
                color: scheme.onSurface.withValues(alpha: 0.45),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Two labelled halves in one track. Not a default Material control: this is a
/// document switcher, and it should read as one piece of furniture.
class _Switch extends StatelessWidget {
  final LegalDoc value;
  final ValueChanged<LegalDoc> onChanged;

  const _Switch({required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: dark ? 0.26 : 0.045),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: scheme.outline.withValues(alpha: 0.5)),
      ),
      child: Row(children: [
        _half(context, 'Terms', LegalDoc.terms),
        _half(context, 'Privacy', LegalDoc.privacy),
      ]),
    );
  }

  Widget _half(BuildContext context, String label, LegalDoc d) {
    final scheme = Theme.of(context).colorScheme;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final on = value == d;
    return Expanded(
      child: GestureDetector(
        onTap: () => onChanged(d),
        behavior: HitTestBehavior.opaque,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOut,
          height: 40,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: on ? scheme.surface : Colors.transparent,
            borderRadius: BorderRadius.circular(11),
            boxShadow: on
                ? [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: dark ? 0.3 : 0.08),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : null,
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: on ? FontWeight.w800 : FontWeight.w600,
              color: on
                  ? scheme.onSurface
                  : scheme.onSurface.withValues(alpha: 0.55),
            ),
          ),
        ),
      ),
    );
  }
}

/// One heading + paragraph + optional bullets. Bodies may contain **bold**
/// spans; [_Rich] is the only markup the documents need.
class _Section {
  final String? h;
  final String? p;
  final List<String>? bullets;

  const _Section({this.h, this.p, this.bullets});
}

class _SectionBlock extends StatelessWidget {
  final _Section s;
  const _SectionBlock(this.s);

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        if (s.h != null) ...[
          Text(
            s.h!,
            style: TextStyle(
              fontSize: 15,
              height: 1.3,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.2,
              color: scheme.onSurface,
            ),
          ),
          const SizedBox(height: 7),
        ],
        if (s.p != null)
          _Rich(
            s.p!,
            style: TextStyle(
              fontSize: 13.5,
              height: 1.6,
              color: scheme.onSurface.withValues(alpha: 0.76),
            ),
          ),
        if (s.bullets != null)
          ...s.bullets!.map((b) => Padding(
                padding: const EdgeInsets.only(top: 7),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Container(
                      width: 5,
                      height: 5,
                      decoration: BoxDecoration(
                        color: scheme.primary.withValues(alpha: 0.6),
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _Rich(
                      b,
                      style: TextStyle(
                        fontSize: 13.5,
                        height: 1.55,
                        color: scheme.onSurface.withValues(alpha: 0.76),
                      ),
                    ),
                  ),
                ]),
              )),
      ]),
    );
  }
}

class _Rich extends StatelessWidget {
  final String text;
  final TextStyle style;
  const _Rich(this.text, {required this.style});

  @override
  Widget build(BuildContext context) {
    final parts = text.split('**');
    return Text.rich(
      TextSpan(
        style: style,
        children: [
          for (var i = 0; i < parts.length; i++)
            TextSpan(
              text: parts[i],
              style: i.isOdd
                  ? style.copyWith(
                      fontWeight: FontWeight.w800,
                      color: Theme.of(context).colorScheme.onSurface,
                    )
                  : null,
            ),
        ],
      ),
    );
  }
}

// ── THE DOCUMENTS ──────────────────────────────────────────────────
// Keep in sync with frontend/src/pages/Terms.jsx (13 sections) and
// frontend/src/pages/Privacy.jsx (13 sections).

const List<_Section> _terms = [
  _Section(
    p: 'Welcome to VeloSales Ai. These Terms & Conditions constitute a binding '
        'legal agreement between you, the business owner ("you", "your"), and '
        'VeloSales Ai ("we", "us", "our") governing your access to and use of '
        'the VeloSales Ai platform, website, and AI-powered WhatsApp customer '
        'support services (collectively, the "Service"). By creating an account, '
        'accessing, or using the Service, you acknowledge that you have read, '
        'understood, and agree to be bound by these Terms.',
  ),
  _Section(
    h: '1. Description of the Service',
    p: 'VeloSales Ai provides an artificial intelligence assistant that '
        'automatically responds to your WhatsApp customers on the basis of your '
        'product catalog and business information. The Service drafts replies '
        'from information you supply, escalates uncertain inquiries to you for '
        'human handling rather than speculating, and does not generate prices or '
        'product claims independently. You remain solely responsible for the '
        'accuracy of your catalog, pricing, availability representations, and '
        'all commercial promises made in connection with your business. The '
        'Service is a software tool and does not constitute an employee, agent, '
        'or representative of your business.',
  ),
  _Section(
    h: '2. Who can use it',
    bullets: [
      'You must be 18+ and able to enter contracts under Nigerian law.',
      'One account per business WhatsApp number. Keep your password private — '
          'anything done under your login counts as done by you.',
      'Your catalog must be yours to publish: real products, real prices, real '
          'availability.',
    ],
  ),
  _Section(
    h: '3. Free plan, Pro trial & paid plans',
    bullets: [
      '**Free forever:** manual catalog (dashboard adds + LEARN: messages) with '
          'AI replies. No card, no expiry.',
      '**7-day Pro trial:** every new account gets full Pro (profile sync + '
          'verification) free for 7 days, no card required. The countdown shows '
          'in-app and your bell warns you before it ends; afterwards you drop to '
          'free automatically.',
      '**Paid plans:** Pro ₦7,499 / \$5 monthly, ₦69,999 / \$47 yearly (save '
          '~22%) · Pro Plus ₦14,999 / \$10 monthly, ₦119,999 / \$80 yearly (save '
          '~33%, adds voice-note transcription + heavy work models). Currency is '
          'set automatically from your WhatsApp number (+234 → Naira, else US '
          'Dollar) and can be changed in Business profile. You pay by card on a '
          'secure checkout page. Enterprise plans are handled personally through '
          'sales.',
      '**After trial / expiry / cancellation:** you drop to the free plan. Your '
          'catalog, chats and history stay. The bot keeps replying from your '
          'manual catalog — we never hold your data hostage.',
    ],
  ),
  _Section(
    h: '4. Payments, renewals & refunds',
    bullets: [
      'Card payments activate instantly on our secure checkout. Bank transfer is '
          'retired — pay by card on the Billing page.',
      'Subscriptions renew for the same plan length. Cancel anytime from the '
          'Billing page — you keep Pro until the paid period ends.',
      '**Refunds:** first-ever payment refundable within 7 days if the service '
          'genuinely didn\'t work for you (write us from Help with details). '
          'Renewals are non-refundable after 7 days, except where the law says '
          'otherwise. Failed duplicate charges are always refunded in full.',
      'Prices show in your currency (NGN or USD) and may change for NEW '
          'purchases; your active paid period always keeps the price you paid.',
    ],
  ),
  _Section(
    h: '5. Acceptable use',
    bullets: [
      'No spam, bulk unsolicited messaging, fraud, counterfeit goods, or '
          'anything illegal under Nigerian law.',
      'No teaching the AI false prices to bait customers, and no using VeloSales '
          'Ai to impersonate another business.',
      'LEARN: / SYNC: only work from your registered owner number — if someone '
          'else gets your phone, tell us immediately.',
      'Don\'t probe, scrape or attack the service. Automated abuse gets accounts '
          'paused without refund.',
    ],
  ),
  _Section(
    h: '6. Accuracy of AI-generated responses',
    p: 'Artificial intelligence systems may occasionally produce inaccurate, '
        'incomplete, or contextually inappropriate responses, including errors '
        'of tone, misinterpretation of colloquial language, or confidently stated '
        'inaccuracies. To mitigate this risk, the Service escalates uncertain '
        'inquiries to you for human handling rather than speculating, and issues '
        'owner alerts for flagged conversations. You agree to review flagged '
        'conversations promptly and to maintain accurate catalog and business '
        'information at all times. We shall not be liable for commercial losses '
        'arising from unanswered flagged conversations or from responses '
        'generated on the basis of inaccurate information you provided. The '
        'quality of AI responses depends directly on the accuracy of your '
        'catalog.',
  ),
  _Section(
    h: '7. Dependencies beyond our control',
    p: 'VeloSales Ai rides on WhatsApp/Meta, Telegram, AI providers, Paystack, '
        'Flutterwave, and our hosts. If any of them has an outage, changes '
        'prices, or changes rules, parts of VeloSales Ai may degrade — and that '
        'isn\'t our breach. We\'ll always fail safe (flag to human, never invent '
        'answers) and post status in the dashboard when we can.',
  ),
  _Section(
    h: '8. Your content & our license',
    p: 'You own your catalog, profile and chats outright. You grant us only the '
        'narrow license needed to store them and feed them to the AI to serve '
        'your customers. We claim no ownership, run no ads against your content, '
        'and never sell it. Delete your account and the license ends (subject to '
        'legal retention in the Privacy Policy).',
  ),
  _Section(
    h: '9. Suspension & termination',
    bullets: [
      'We may pause accounts for abuse, fraud, non-payment investigation, or '
          'legal orders — usually with a warning first, instantly for serious '
          'abuse.',
      'You may leave anytime: cancel paid plans (keep Pro till period end), then '
          'delete your account from Settings or via Help. Export your catalog '
          'first — deletion is permanent after 14 days.',
    ],
  ),
  _Section(
    h: '10. Limitation of liability',
    p: 'To the maximum extent permitted by law, VeloSales Ai is provided "as is" '
        'without warranties of any kind. Our total liability for anything arising '
        'from the service is capped at the amount you paid us in the 3 months '
        'before the claim (or ₦10,000 / \$7 if you never paid). We are never '
        'liable for indirect losses: lost profits, lost customers, or '
        'Meta/WhatsApp restricting your number for policy breaches on your side.',
  ),
  _Section(
    h: '11. Indemnity',
    p: 'You agree to cover us if your use of VeloSales Ai (your catalog content, '
        'your messages, your breach of these terms or of WhatsApp\'s policies) '
        'gets us into legal trouble with a third party. We\'ll notify you '
        'promptly and let you lead the defense.',
  ),
  _Section(
    h: '12. Governing law & disputes',
    p: 'These terms are governed by the laws of the Federal Republic of Nigeria. '
        'Disputes first go to good-faith negotiation for 30 days (write us from '
        'Help), then to mediation/arbitration in Lagos under the Arbitration and '
        'Mediation Act 2023 before any court action. If any clause is found '
        'unenforceable, the rest stands.',
  ),
  _Section(
    h: '13. Changes',
    p: 'We\'ll post updates here with a new date and flag material changes in '
        'the dashboard or by email at least 7 days before they bite. Keep using '
        'VeloSales Ai after that and you\'ve accepted them; the version in force '
        'when you paid governs that payment.',
  ),
];

const List<_Section> _privacy = [
  _Section(
    p: 'VeloSales Ai ("we", "us", "our") operates an AI-powered WhatsApp '
        'customer support platform (the "Service"). This Privacy Policy '
        'describes the categories of personal data we collect, the purposes for '
        'which such data is processed, the parties with whom it is shared, and '
        'the rights available to you under applicable data protection law, '
        'including the Nigeria Data Protection Regulation (NDPR). "Business '
        'owner" means a registered VeloSales Ai account holder, and "customers" '
        'means individuals who communicate with a business owner through the '
        'Service.',
  ),
  _Section(
    h: '1. Summary',
    bullets: [
      'We process your catalog, conversation, and account data solely to '
          'provide, maintain, and improve the Service.',
      'We do not sell personal data, display third-party advertising against '
          'your content, or use your content to train publicly available AI '
          'models.',
      'You may request access to, correction of, export of, or deletion of your '
          'personal data at any time via the Help page in your dashboard.',
    ],
  ),
  _Section(
    h: '2. What we collect (and why each item exists)',
    bullets: [
      '**Business profile:** name, WhatsApp numbers, hours, FAQs, tone, discount '
          'guardrails, business niche (what you sell) and where you heard about '
          'us. Purpose: the AI needs to sound like you. Without it there is no '
          'product.',
      '**Product catalog:** names, prices, descriptions, availability, product '
          'photos — everything you add on the dashboard or teach with LEARN: / '
          'SYNC:. Purpose: the single source of truth the AI quotes.',
      '**Conversations:** customer numbers, names (if WhatsApp provides them), '
          'message text, voice notes (transcribed for Pro Plus shops), photos '
          'customers send, AI replies, human-handoff flags. Purpose: your inbox, '
          'chat history, owner alerts and the daily digest.',
      '**Account & billing:** email, login sessions, subscription status, expiry '
          'and purchased tier. Card numbers never touch our servers — Paystack '
          '(Naira) and Flutterwave (US Dollar) handle all of that.',
      '**Technical crumbs:** basic server logs (IP, timestamps, error traces) to '
          'keep the service alive and catch abuse.',
    ],
  ),
  _Section(
    h: '3. Data we do not collect',
    p: 'We do not collect Bank Verification Numbers (BVN), National '
        'Identification Numbers (NIN), payment card numbers, or precise location '
        'data. Passwords are stored exclusively as salted cryptographic hashes '
        'and cannot be retrieved in readable form. We do not create advertising '
        'profiles. As a matter of policy, we do not collect or retain any '
        'personal data that is not reasonably necessary for the provision of the '
        'Service.',
  ),
  _Section(
    h: '4. How the AI uses your data',
    p: 'When a customer messages you, we send the message plus your '
        'catalog/profile to our AI providers to draft the reply. Providers '
        'process this text to generate the answer and are contractually forbidden '
        'from training on it or keeping it beyond their standard short retention. '
        'Customer photos are analyzed the same way — matched against your '
        'catalog, then forgotten.',
  ),
  _Section(
    h: '5. Who else touches your data (our processors)',
    bullets: [
      '**Meta (WhatsApp Cloud API)** — delivers WhatsApp messages both ways.',
      '**Google Gemini / Groq / TokenRouter / SambaNova / Anthropic** — generate '
          'AI replies.',
      '**Paystack** — processes Naira card payments (they see the payer email and '
          'amount, never your catalog).',
      '**Flutterwave** — processes US Dollar card payments for international '
          'shops (same business: email and amount only).',
      '**Resend** — sends verification and account emails.',
      '**Supabase / Railway / Render** — host the database and the app.',
    ],
  ),
  _Section(
    p: 'That\'s the full list. No ad networks, no data brokers, no "analytics '
        'partners". If we ever add one, this page changes first.',
  ),
  _Section(
    h: '6. Your customers\' personal data',
    p: 'As a business owner, you act as an independent controller of your '
        'customers\' data visible in your inbox, and you agree to use such data '
        'solely for legitimate customer service purposes and in compliance with '
        'applicable data protection law, including refraining from unsolicited '
        'marketing communications. For our part, we restrict access to your data '
        'behind your authenticated login, never disclose one business\'s '
        'conversations to another, and never contact your customers directly '
        'except to deliver AI-generated replies you have configured.',
  ),
  _Section(
    h: '7. How long we keep things',
    bullets: [
      'Catalog, profile and chats: while your account is active, so your history '
          'works.',
      'After you delete your account: everything identifiable is removed within '
          '14 days, except payment receipts the law requires us to keep (up to 5 '
          'years under Nigerian tax rules).',
      'Server logs: rolled over within 90 days.',
    ],
  ),
  _Section(
    h: '8. Your rights (NDPR-aligned)',
    p: 'Under Nigeria\'s Data Protection Regulation you may: see everything we '
        'hold on you, correct it, export it, restrict it, or delete it. Write us '
        'from your dashboard Help page with your business name and registered '
        'email — we respond within 7 days. Deleting your account deletes your '
        'catalog, chats and profile snapshot.',
  ),
  _Section(
    h: '9. Security — what we actually do',
    bullets: [
      'Passwords hashed with salted scrypt — we couldn\'t read them if we wanted '
          'to.',
      'Sessions stored server-side; production refuses to boot without its own '
          'session secret.',
      'Login, signup and checkout doors rate-limited against brute force and '
          'spam.',
      'Meta, Telegram, Paystack and Flutterwave webhooks all verified — nobody '
          'can fake a message or a payment.',
      'Security headers on every response; error messages never leak internals.',
      'HTTPS everywhere in production; database connections encrypted.',
    ],
  ),
  _Section(
    p: 'No method of electronic transmission or storage is entirely secure. In '
        'the event of a personal data breach that is likely to affect your '
        'rights, we will notify you and the relevant supervisory authority '
        'without undue delay, in accordance with applicable law.',
  ),
  _Section(
    h: '10. Cookies & sessions',
    p: 'One session cookie keeps you logged in for 7 days. No tracking cookies, '
        'no third-party pixels, no fingerprinting. Clear your cookies and you '
        'simply log in again.',
  ),
  _Section(
    h: '11. Minors',
    p: 'The Service is intended solely for business owners aged 18 and above. We '
        'do not knowingly process personal data of minors. If you are under 18, '
        'you may not create an account.',
  ),
  _Section(
    h: '12. Changes to this policy',
    p: 'We\'ll update the date at the top and, for meaningful changes, email you '
        'or show a notice in the dashboard before they take effect. Continued use '
        'after that means you accept the new version.',
  ),
  _Section(
    h: '13. Contact information',
    p: 'For privacy inquiries, data subject requests (access, correction, '
        'export, or deletion), or complaints regarding our processing of personal '
        'data, please contact us via the Help page in your dashboard or at '
        'velosales63@gmail.com, providing your business name and registered '
        'email address. We respond to all requests within 7 days.',
  ),
];
