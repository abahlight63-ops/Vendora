# Vendora AI Video Ads — Prompts Pack ($10–20 tools)

Goal: 4 launch videos feeding the slots in `index.html`
(`data-slot="hero-916"` = 9:16, `data-slot="how-169"` = 16:9).
Rule for ALL: hook in first 2 seconds, burned-in captions (many watch muted),
end card = logo + "Vendora — Start free" + `vendorabot.vercel.app`.

---

## The $10–20 stack (pick ONE generator + CapCut)

| Tool | ~Price | Use it for |
|---|---|---|
| **CapCut Pro** | ~$8–10/mo | Edit everything, auto-captions, end cards, posting to TikTok/Reels/Shorts. Non-negotiable — get this first. |
| **Hailuo / MiniMax** | ~$10/mo | Cheapest good-looking product/phone-screen clips. Best value generator. |
| **Runway Gen-4** | ~$15/mo | Highest quality short clips (phone close-ups, shop B-roll). Pick instead of Hailuo if budget allows. |
| **InVideo AI** | ~$15–20/mo | All-in-one fallback: script → full video with voiceover when you want zero editing. |
| **Pika** | ~$10/mo | Alt generator, strong on stylized/animated looks. |

Free $0 path: film your own phone screen (real chat!) + CapCut free captions. Honestly converts best for vendor audiences.

Export spec: 9:16 → 1080×1920 · 16:9 → 1920×1080 · ≤30s · MP4 (H.264) · loud first frame.

---

## 1. 15s HERO ad → slot `hero-916` (TikTok / Reels / Shorts)

**Script (Pidgin hook, 3 beats):**
- 0–2s HOOK (text on screen, loud): "Customer message you 2AM — who dey reply? 👀"
- 2–9s Screen recording of WhatsApp: customer "Abeg blue gown still dey?" → Vendora answers price + stock in 2s → customer "Pack am!"
- 9–13s Owner smiling at phone, morning caption: "She slept. Vendora sold."
- 13–15s END CARD: logo + "Start free 7 days Pro — vendorabot.vercel.app"

**Generator prompt (Hailuo/Runway/Pika):**
> Vertical 9:16 phone-screen POV, 2am bedroom glow. Chat bubbles appear with typing dots, then an instant AI reply with a price in naira. Quick cut to a Nigerian market woman smiling at her phone in morning light. Bold yellow caption top: "2AM customer? ANSWERED." Fast cuts, afrobeats-image energy, no real faces in close-up, authentic Lagos shop vibe.

**Voiceover (InVideo/CapCut TTS, female, warm):** "Two AM. Customer dey ask price. Vendora don already answer — and close the sale. Start free today."

---

## 2. 30s HOW-IT-WORKS → slot `how-169` (YouTube + website hero)

**Script:**
- 0–3s: "Your WhatsApp is a shop. But shops close. Vendora doesn't."
- 3–12s STEP 1 Connect: one-tap WhatsApp connect popup, TEST message → LIVE (screen capture, blur secrets).
- 12–20s STEP 2 Teach: owner texts `LEARN: Blue gown ₦45,000` → catalog updates.
- 20–27s STEP 3 Sell: 3 customer questions fly in, instant answers, one HOT lead flagged to owner.
- 27–30s END CARD: "Free 14 days · No card · vendorabot.vercel.app"

**Generator prompt:**
> 16:9 explainer, dark-green tech aesthetic (#0d1f16) with WhatsApp-green accents. Animated phone mockups, chat bubbles sliding in, price tags popping. Three labeled chapters: 1 Connect, 2 Teach, 3 Sell. Clean motion graphics, readable on mobile, English captions throughout, ends on logo card.

---

## 3. UGC TESTIMONIAL → repost everywhere (9:16)

**Script (selfie style, market noise behind):**
- "Before, if customer message me for night, na morning I go see am — sale don go. Now? (shows phone) Vendora don answer, don even reserve the gown. I just wake up see alert. If you dey sell for WhatsApp, try am — first 7 days free."

**Generator prompt (avatar tool or self-film direction):**
> Selfie video, Nigerian boutique owner in her shop, racks of clothes behind, natural daylight. Holds phone showing WhatsApp chat to camera at 0:08. Warm, unscripted energy, slight camera shake ok. Pidgin-English mix. 25 seconds.

Best played REAL (film yourself/a friend) — UGC outperforms AI avatars 3:1 with vendor audiences. Use AI avatar (HeyGen free tier) only as backup.

---

## 4. FOUNDER STORY → pinned post + Play Store video (1:1 + 9:16)

**Script:**
- "I watched my friend lose a ₦95,000 wig sale because she slept. That pain became Vendora — an AI that answers your WhatsApp customers in seconds, in English or Pidgin, straight from your own catalog. Free to start. Your shop never sleeps again."

**Generator prompt:**
> Founder-style direct-to-camera, night-market B-roll behind (shutters closing, phone glowing). Sincere tone, slow push-in. Text overlays: "₦95,000 sale lost" → "→ Vendora" → "Shop never sleeps". 30 seconds, 1:1 and 9:16 crops.

---

## Posting checklist (per video)

- [ ] Hook text in first 2s + burned captions throughout
- [ ] End card 2s: logo + "Start free" + vendorabot.vercel.app
- [ ] Post native to TikTok + Reels + Shorts (9:16) and YouTube (16:9)
- [ ] Pin founder story on all profiles
- [ ] Drop finished MP4 URL into the matching `<source src="">` in `index.html`
- [ ] Reply to every comment in week 1 (algorithm fuel + free user research)
