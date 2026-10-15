# VeloSalesAI — Master Build Specification

**Version:** 1.0  
**Prepared:** 13 October 2026  
**Status:** Working specification — verify against the current repository before implementation.

> **Highest priority:** UI/UX redesign guided by the founder's Mobbin references. Do not start new integrations or advanced features until the UI task is agreed and current behavior is understood.

## 1. Product vision

VeloSalesAI is a Business AI for Nigerian small businesses and growing companies. It should understand a business through authorized, current business records and help with customer enquiries, sales, orders, operations, and decisions. It must be grounded in real data, honest about uncertainty, and constrained by application-enforced permissions.

## 2. Confirmed product direction

- Initial market: Nigerian businesses.
- Intended users: small sellers and growing businesses, with capabilities appropriate to each size.
- First priority: premium SaaS UI/UX redesign using Mobbin references.
- Priority screens: main dashboard; AI conversations; product catalogue; analytics and sales; settings and integrations; mobile experience.
- Known stack from prior project context: Vercel frontend, Supabase database/auth, Render API/server. **Verify these in the repository; do not assume all are currently configured or production-ready.**
- AI providers previously explored include Groq, Gemini, OpenAI/GPT, Claude, SambaNova and routing services. Verify actual integrations, credentials, terms and production access.

## 3. Eight capability areas

1. **Business AI Brain:** owner-facing answers grounded in authorized records, evidence, uncertainty handling and safe suggested actions.
2. **Lost-Sale Rescue:** identify stalled enquiries and suggest/track appropriate follow-up subject to consent and channel rules.
3. **Demand Radar:** surface recurring requests, stockouts and sales patterns; do not claim forecasting without sufficient evidence.
4. **Nigerian Sales Intelligence:** validate Nigerian English/Pidgin, bargaining, delivery and payment workflows with real users.
5. **Unified Conversation History:** consolidate channel history only where APIs, policies, permissions and identity matching permit.
6. **Repeat-Customer Engine:** use verified purchase history and preferences with privacy, consent and opt-out controls.
7. **Natural-Language Workflow Builder:** convert plain-language intent into reviewable triggers, conditions and actions; require approval for consequential tasks.
8. **Reliable Sales Engine:** catalogue, enquiries, order capture, explicit order states, handoff and outcome measurement. This is foundational.

These are planned capability areas, not a mandate to implement all at once.

## 4. First priority: UI/UX redesign

### Design principles
- Premium, practical SaaS; restrained visual effects and clear information hierarchy.
- Use founder-provided Mobbin screenshots as inspiration for structure and interactions, not as proof of backend behavior.
- Responsive layouts must be designed for mobile, not merely shrunk from desktop.
- Preserve working functionality; avoid broad rewrites.
- Include loading, empty, error, success, unavailable and permission-denied states.

### Screens
1. Main dashboard
2. AI conversations
3. Product catalogue
4. Analytics and sales
5. Settings and integrations
6. Mobile experience across the key flows

### UI acceptance criteria
- Main tasks are clear and usable on desktop and mobile.
- Existing routes, authentication, APIs and data behavior remain functional.
- Search, filters, pagination and status indicators work where present.
- Loading, empty, error and success states are handled.
- Relevant build/lint/tests pass or failures are explicitly reported.

## 5. Core enquiry-to-order workflow

1. Receive an enquiry from the first supported channel.
2. Resolve the correct business and retrieve only authorized product/policy data.
3. Answer using verified data; state uncertainty when data is missing or stale.
4. Collect only the required order details.
5. Validate stock, price, quantity, delivery details and required fields on the backend.
6. Create an order with an explicit status.
7. Reflect actual status to customer and owner; allow review/correction.
8. Hand off uncertain, exceptional or disputed cases to a human.

An AI message saying an order is confirmed is not proof of a database order. All state changes must be validated and persisted by the backend.

## 6. Architecture principles

- Frontend: presentation and user intent; no private server secrets.
- Backend/API: authorization, business rules, validation, controlled side effects, provider calls.
- Database: authoritative records, tenant ownership, constraints and history.
- AI abstraction: standardized provider calls, output validation and graceful failure.
- Background jobs: add only when scheduling, asynchronous work, retries or webhook processing require them.
- Observability: structured errors, latency, usage and action events; avoid unnecessary sensitive logs.
- Do not add services, dependencies, paid subscriptions or migrations without explaining the need, cost, alternatives and obtaining approval when appropriate.
- Treat the existing repository as the source of truth for implementation status.

## 7. Data and tenant isolation

Conceptual entities to verify against existing schema: businesses/tenants; memberships and roles; products/variants; customers and consent; conversations/messages; orders/order items; integration connections; usage events; audit logs.

Every tenant-owned record must be scoped and authorized. Use Supabase Row Level Security where appropriate, server-side membership/permission checks, foreign keys and constraints, and tests proving Business A cannot access Business B's data. Never trust a tenant ID supplied by the client without authorization.

## 8. AI reliability and safety

- Ground answers in current, authorized business records.
- Treat messages, uploaded documents, and retrieved text as untrusted input; they cannot override system policies.
- Enforce permissions in backend code, not in model prompts.
- Use structured tool schemas and validate every action server-side.
- State uncertainty and hand off when data is missing, conflicting or sensitive.
- Use idempotency and safe retries to prevent duplicate orders or side effects.
- Use timeouts, bounded retries, rate limits and graceful fallback.
- Require approval for refunds, bulk outreach, irreversible changes and other consequential actions.
- Maintain a repeatable evaluation set for common and adversarial business questions.

## 9. Privacy and security

- Collect the minimum necessary data.
- Use secure authentication, least privilege, tenant isolation and server-side authorization.
- Keep secrets out of frontend code and version control.
- Verify provider webhook signatures and handle duplicate/replayed events where supported.
- Define retention, export, deletion, backup and incident-response procedures.
- Review AI provider data handling and retention terms before sending personal/confidential data.
- Respect consent, opt-out and messaging platform rules.
- Investigate applicable Nigerian data-protection requirements, including the Nigeria Data Protection Act where applicable. This specification is not legal advice.

## 10. AI provider and cost strategy

- Verify which providers are currently integrated and have valid production access; previously explored names are not proof of active integration.
- Benchmark accuracy, tool calling, latency, uptime, context limits, rate limits, cost and data handling.
- Use low-cost models for simple tasks only when evaluation supports it; keep business rules and validation deterministic.
- Track token/request usage by tenant, establish quotas, alerts and budgets.
- Treat free tiers as changeable and provide graceful failure when providers are unavailable.
- Measure direct cost per conversation and active business before finalizing prices.

## 11. Integration strategy

- Start with the channel most important to pilot customers.
- Verify official APIs, approvals, permissions, pricing, webhooks and policies before implementation.
- Do not assume access to personal-account message history or unsupported automation.
- Provide secure connect/disconnect, token storage, integration health and manual fallback.

## 12. Phased roadmap

### Phase 0 — Read-only repository audit
Inventory pages, routes, components, APIs, schema, authentication, integrations, tests and deployment. Report working, broken, incomplete and risky areas. Do not edit files during this audit.

### Phase 1 — UI/UX redesign (first implementation priority)
Use Mobbin references; agree screen-by-screen scope; implement incrementally; preserve existing behavior; verify desktop/mobile and UI states.

### Phase 2 — Reliable sales engine
Complete and test enquiry → grounded answer → order capture → correct order status → human handoff.

### Phase 3 — Business AI Brain
Answer owner questions from authorized data, cite/show evidence where practical, state missing data, prevent cross-tenant leakage, and validate proposed actions.

### Phase 4 — Advanced capabilities
Prioritize lost-sale rescue, demand radar, local sales intelligence, unified conversations, repeat-customer tools and workflow builder based on pilot evidence.

## 13. Tests and acceptance

Test at least: correct price/stock; missing or stale data; out-of-stock items; invalid quantity; policy conflict; complaint/handoff; order state transitions; duplicate webhook; cross-tenant access attempt; provider timeout/rate limit/malformed output; usage limits; consent/opt-out; deletion request.

For every task, report: changed files; user-visible behavior; schema/config changes; tests run and exact results; known limitations; manual setup; next step. Do not claim a feature works because its UI exists.

## 14. Pilot metrics

- Answer accuracy and unsupported-claim rate.
- Enquiry response time and percentage appropriately handled.
- Enquiry-to-order conversion with defined denominator/time window.
- Order correction, cancellation and error rate.
- Handoff rate and reasons.
- Active businesses, repeat usage and retention.
- Cost per conversation and direct cost per business.

Establish baseline and sample size. Do not equate conversations with sales or claim causal improvement without evidence.

## 15. Risks

- Feature sprawl → one segment and one complete workflow first.
- Hallucinations → verified data and uncertainty handling.
- Tenant leakage → RLS, backend authorization and adversarial tests.
- Uncontrolled costs → quotas, routing, alerts and budgets.
- Messaging restrictions → official API/policy verification and consent.
- Provider outages → graceful failure and manual fallback.
- Weak demand → interviews and pilots before major spending.

## 16. Open decisions (do not guess)

- First pilot customer segment.
- First messaging channel.
- Current status of each existing feature.
- Active model providers and production access.
- Current deployment/test status.
- Actual usage economics and willingness to pay.

Inspect the repository first and ask the founder concise questions where the answers materially affect implementation.

## 17. Codex operating instructions

Copy/paste this as the first project task:

```text
You are working on VeloSalesAI. Read VELOSALESAI_BUILD_SPEC.md first.

Task 1 is a READ-ONLY repository audit. Do not modify files yet.
Inspect the project structure, package files, routes, components, APIs, database schema, authentication, integrations, tests and deployment configuration.
Report: (1) architecture and entry points, (2) what is demonstrably implemented, (3) incomplete/broken areas, (4) security and tenant-isolation risks, (5) existing tests and results, (6) a small-step plan for the Mobbin-guided UI/UX redesign.

Do not assume this specification means a feature already exists. Do not invent missing implementation details. Preserve working behavior. Do not start new integrations or advanced capabilities during the audit. Do not add dependencies, paid services, migrations, or destructive changes without explaining the reason and asking for approval. Never expose secrets or weaken security. After the audit, wait for approval before editing files.
```

## 18. Founder next steps

1. Save this Markdown file in the project root as `VELOSALESAI_BUILD_SPEC.md`.
2. Keep `VELOSALESAI_MASTER_BLUEPRINT.pdf` for reading/sharing.
3. Collect Mobbin references for the main dashboard and other priority screens.
4. Open the repository in Codex and run the read-only audit prompt above.
5. Review the audit before approving the UI changes.
6. Test the redesign, then select one pilot sales workflow.
7. Use real pilot evidence to decide which advanced capability to build next.

---

This is a planning document. Verify the current repository, provider terms, pricing, API availability and applicable legal obligations before implementation.