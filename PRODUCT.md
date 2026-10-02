# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Node.js + Express backend with React + Vite frontend (Postgres, Meta WhatsApp Cloud API, Claude/Gemini API)

## Users

Primary user: Small business owners (salons, shops, service businesses) in high WhatsApp inquiry volume situations. Their job is to respond quickly to customer questions about prices, availability, hours, and services without hiring full-time support staff.

## Product Purpose

The product enables small businesses to provide instant, accurate WhatsApp customer support 24/7 without manual effort. Success means fewer missed inquiries, faster response times, and reduced workload for business owners while maintaining accurate information.

## Positioning

Grounded AI responses strictly from each business's product catalog with LEARN mode that allows owners to teach the bot by sending ad messages. The bot never invents prices/availability, and hands off to humans when uncertain.

## Operating Context

- Business owners run the admin dashboard to configure their business
- Customers message the business WhatsApp number with product/service questions
- Owners teach the bot via LEARN: messages from their registered number
- Daily digest sends flagged conversations to owners via WhatsApp
- Works in environments with WhatsApp-heavy customer communication

## Capabilities and Constraints

**Confirmed capabilities:**
- WhatsApp webhook processing with auto-replies
- Product catalog management with LEARN mode (owner-driven updates)
- Human handoff for uncertain/confident-low cases (needs_human flag)
- Multi-provider AI support (Claude/Gemini)
- Daily/weekly digests and recovery/winback flows
- Embedded WhatsApp signup for onboarding

**Constraints:**
- Must strictly ground answers in business's catalog (no hallucination)
- LEARN restricted to owner_number only
- Requires WhatsApp Cloud API setup
- Postgres database required

## Brand Commitments

None explicitly established yet.

## Evidence on Hand

- Working codebase with webhook handlers, reply engine, catalog management
- MVP plan documented
- README with setup instructions and usage examples

## Product Principles

1. **Accuracy over speed**: Never invent information; defer to human when uncertain
2. **Owner control**: Business owners teach and curate their catalog directly via WhatsApp
3. **Simplicity for small businesses**: Minimal setup with embedded signup
4. **Graceful handoff**: Escalate to human when AI cannot confidently answer from catalog

## Accessibility & Inclusion

No specific product-level accessibility requirements established yet.
