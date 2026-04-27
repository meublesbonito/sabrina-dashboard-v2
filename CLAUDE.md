# Sabrina Dashboard V2 — Claude Code Handoff

## 1. Project identity

Project name: Sabrina Dashboard V2  
Business: Meubles Bonito, Montreal furniture liquidation store  
Owner: Oussama  
Purpose: Internal operations dashboard to monitor and take over Messenger conversations handled by Sabrina bot.

Production URL:
https://sabrina-dashboardv2.vercel.app

GitHub repo:
meublesbonito/sabrina-dashboard-v2

Hosting:
Vercel

## 2. Stack

Frontend:
- Vanilla HTML/CSS/JS
- No React
- No Next.js
- No framework migration
- No build step

Backend:
- Vercel serverless functions under /api/**

Database:
- Airtable

AI:
- OpenAI only when explicitly required
- No OpenAI for Lot 5.1

Auth:
- Backend session cookie
- HMAC-style signed session
- 24h session duration

## 3. Security rules

Never expose secrets.

Never hardcode:
- AIRTABLE_TOKEN
- OPENAI_KEY
- SESSION_SECRET
- DASHBOARD_PASSWORD
- Any Vercel environment variable value

Never edit:
- .env
- Vercel environment variables
- production secrets
- tokens
- passwords

Secrets live only in Vercel Environment Variables.

If a secret is needed, do not ask Oussama to paste it. Say which environment variable must exist.

## 4. Working rules

- Never work directly on main.
- Work only on the current Git branch.
- Before coding, read the real files.
- Before coding, explain exactly which files will be modified.
- Wait for Oussama validation before coding.
- Apply minimal patches.
- Do not refactor unrelated code.
- Do not change architecture unless explicitly approved.
- After coding, summarize the diff.
- After coding, give exact tests.
- Do not start Lot 6 before Lot 5.1 is validated.
- Do not break Today.
- Do not break ?demo=1.

## 5. Current completed lots

Completed:
- Lot 1: Foundations and authentication.
- Lot 2: Design system and UI components.
- Lot 3: Backend read-only APIs.
- Lot 4: Core logic with buildActionQueue.
- Lot 5: Today page operational in production.

Not completed / pending:
- Lot 5.1: Facebook ad-template noise filter.
- Lot 6: Clients + Drawer.
- Lot 7: Health + polish.

## 6. Lot 5 status

Today is operational in production.

Today currently includes:
- KPI hero: money at risk.
- Four action cards: À appeler / Frustrés / COD / Bloqués.
- Unified ActionRow list.
- Header urgent badge.
- Buttons that write to Airtable.
- Optimistic UI + rollback.
- Auto-refresh every 2 minutes.
- “Pas répondu” modal.
- “Perdu” modal.
- `next_followup_at` cleared for done / converted / lost.
- `next_followup_at` required for no_answer.
- `traite_note` required for lost.

Workflow fields written to Airtable:
- traite_status
- traite_by
- traite_at
- traite_action
- next_followup_at
- traite_note

## 7. Important distinction: three statuses

Do not confuse these fields:

1. `status`
   - Sabrina control status.
   - Examples: active, handed_off, human_only, closed.

2. `traite_status`
   - Dashboard human workflow status.
   - Values: open, done, converted, called_no_answer, lost.

3. `conversion_status`
   - Sales funnel status.
   - This field may be polluted.
   - Do not use as single source of truth.

## 8. Airtable main tables

Base:
- Bot_Bonito_Messenger
- BASE_BOT environment variable points to it.

Main tables:
- CONVERSATIONS
- SIGNAUX
- tblErrors

Important CONVERSATIONS fields:
- psid
- platform
- fb_first_name
- fb_last_name
- customer_name
- customer_phone
- customer_city
- customer_province
- customer_zip
- nb_messages
- last_action
- all_actions
- context_window
- last_message_time
- Last Modified Time
- conversation_started_at
- status
- sales_stage
- opp_status
- conversion_status
- cart_value
- cart_created_at
- checkout_sent_at
- checkout_completed_at
- draft_order_id
- invoice_url
- confirmed_category
- confirmed_budget
- confirmed_size
- confirmed_firmness
- confirmed_product_name
- confirmed_product_id
- confirmed_payment_method
- traite_status
- traite_by
- traite_at
- traite_action
- next_followup_at
- traite_note

Important:
- `context_window` is the full conversation text.
- It follows patterns like:
  CLIENT: ... ||| BOT: ... ||| CLIENT: ...
- `/api/data/convos` must not return full `context_window`.
- `/api/data/convo?id=recXXXX` can return full context for a single drawer/detail view.

## 9. Repo architecture

Expected repo structure:

api/
  _helpers/
    auth-check.js
    api-response.js
    airtable.js
    airtable-write.js
    session.js
  auth/
    login.js
    logout.js
    me.js
  data/
    ping.js
    convos.js
    convo.js
    signals.js
    errors.js
  actions/
    update.js

js/
  lib/
    action-shape.js
    api.js
    build-action-queue.js
    dedupe.js
    phone-filter.js
    priorities.js
    queue-manager.js
    risk-value.js
    fixtures/
  components/
    action-row.js
    action-card.js
    card.js
    empty-state.js
    error-banner.js
    modal.js
    sla-badge.js
    toast.js
  pages/
    demo.js
    today.js
  auth-ui.js
  main.js
  theme.js

styles/
  tokens.css
  base.css
  components.css
  today.css

index.html
package.json
vercel.json
README.md
CLAUDE.md

## 10. Code conventions

- Prefer snake_case API response fields.
- UI components must avoid unsafe innerHTML.
- Use createElement + textContent for user/content data.
- Endpoints must use requireAuth where relevant.
- API response format should stay:
  { ok, data, count, fetched_at, nextOffset }
- Dates are normalized server-side.
- API returns ISO fields like `last_message_time` and raw debug fields like `last_message_time_raw`.
- Before using `listRecords`, read `api/_helpers/airtable.js` and follow the real return shape.
- Do not assume whether `listRecords` returns an array or `{ records, nextOffset }`.

## 11. Core logic: buildActionQueue

`js/lib/build-action-queue.js` transforms:

convos + signals + errors → actions[]

It is pure logic:
- no fetch
- no Airtable calls
- no OpenAI
- no writes

Detection order:
1. FOLLOWUP_DUE
2. CALL_NOW
3. FRUSTRATED
4. BOT_BLOCKED
5. COD_CONFIRM
6. ABANDONED_CART
7. MESSENGER_FOLLOWUP

Rules:
- Deduplicate by PSID.
- One client = one displayed action.
- Keep the most urgent action.
- Sort by priority, then wait time.
- Store phone number 4383373296 must be excluded everywhere.
- `phone-filter.js` handles phone extraction and store phone filtering.

## 12. Current business insight

Today is polluted by Facebook Messenger ad-template messages.

Examples:
- “Je veux acheter un Sofa”
- “Je veux acheter un matelas”
- “Je veux acheter un combo base de lit + matelas”

These are often automatic Facebook ad starter messages when a user clicks “Send message”.

They are not necessarily real purchase intent.

Current problem:
- Today may show around 65 actions and 37,747$ money at risk.
- Real actionable opportunities may be closer to 15–20.

## 13. Lot 5.1 objective

Lot 5.1 must add a conservative ad-template noise filter.

Goal:
Remove weak Facebook template-only leads from Today without hiding real leads.

Expected files to modify:
- api/data/convos.js
- js/lib/build-action-queue.js

Do not modify other files unless a real technical necessity is found and explained first.

No OpenAI.
No new endpoint.
No UI redesign.
No Lot 6 work.

## 14. Lot 5.1 backend requirement: api/data/convos.js

In `/api/data/convos`:

Add server-side analysis of `record.fields.context_window`.

Return two new fields:
- nb_messages_client
- nb_substantial_messages

Important:
- Analyze full `record.fields.context_window`, not `context_preview`.
- Do not return full context_window in `/api/data/convos`.
- Keep existing `context_preview` behavior.
- Parsing must never crash the endpoint.
- If parsing fails, return:
  - nb_messages_client: 0
  - nb_substantial_messages: 0
- If context_window is extremely large, cap the text to a safe max length before parsing.

Suggested safe cap:
- 50,000 characters

## 15. analyzeContextWindow logic

Add a helper similar to:

- Input: contextWindow string
- Output: `{ nbClient, nbSubstantial }`

Logic:
1. If contextWindow missing or not a string, return `{ nbClient: 0, nbSubstantial: 0 }`.
2. Optionally cap contextWindow to 50,000 chars.
3. Split on `/CLIENT:/i`.
4. Ignore the first part before the first CLIENT.
5. For each client part:
   - cut at next `BOT:` or `|||`
   - trim it
   - this is one client message
6. `nbClient = number of client messages`
7. A client message is substantial if:
   - word count > 4
   OR
   - phone regex matches
   OR
   - it contains a strong keyword.
8. Return `{ nbClient, nbSubstantial }`.

Phone regex:
`/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/`

## 16. Strong keywords for substantial message

Use only these strong keywords:

- oui
- je prends
- ok
- combien
- prix
- cher
- budget
- coute
- coût
- livraison
- livrer
- apporter
- transport
- adresse
- magasin
- visite
- passer
- venir
- disponible
- dispo
- quand
- aujourd'hui
- demain
- confirme
- paiement
- payer
- affirm
- cod
- téléphone
- numéro
- mon nom
- tel

Do NOT use these weak keywords:
- je veux
- acheter
- commander
- réserver

Reason:
Those weak words can appear in Facebook ad templates and would neutralize the filter.

## 17. Lot 5.1 frontend requirement: build-action-queue.js

In `js/lib/build-action-queue.js`:

Add an index:
- `convosByPsid`

Apply the ad-template filter:
- after `dedupeByPsid(candidates)`
- before final sort
- before return

Use `isAdTemplateNoise(action, convo)`.

## 18. isAdTemplateNoise final rule

Exclude an action only if:

A. No business guardrail exists  
AND  
B. Engagement is weak.

Never exclude if any guardrail exists:
1. action.phone exists
2. cart_value > 0
3. draft_order_id exists
4. checkout_sent_at exists
5. checkout_completed_at exists
6. confirmed_product_name exists
7. confirmed_payment_method exists
8. confirmed_budget exists
9. invoice_url exists

Weak engagement:
- nb_messages_client < 3
OR
- nb_substantial_messages < 2

If convo is missing:
- return false
- keep the action
- fail safe toward not hiding a possible lead.

## 19. Lot 5.1 expected tests

API tests:
- `api.getConvos({ limit: 5 })` returns:
  - nb_messages_client
  - nb_substantial_messages
- `/api/data/convos?limit=3` returns 200.
- Response does not include full `context_window`.
- `context_preview` still exists.

Today tests:
- Today should drop from around 65 actions toward 15–20 realistic actions.
- Money at risk should drop toward a more realistic amount.
- KPI cards recalculate.
- Urgent badge recalculates.
- Leads with phone stay.
- Leads with cart_value stay.
- Leads with confirmed_budget stay.
- Leads with confirmed_payment_method stay.
- Template-only “Je veux acheter un Sofa” should be excluded.
- Template + one weak short reply should be excluded.
- ?demo=1 still works.
- Action buttons still write to Airtable.
- No red console errors.

## 20. Known technical debt

For Lot 7:
- Normalize `resolved === true || resolved === 'checked'` in errors.

After Lot 7:
- Improve DETECTOR anti-duplication.
- Review Make.com DETECTOR dedupe.

Business-side:
- Oussama should eventually rewrite Facebook ad templates to reduce noisy starter messages.

## 21. Lot 6 preview

Do not start Lot 6 until Lot 5.1 is validated.

Lot 6 goal:
- Clients page.
- Search by name, phone, PSID, city.
- Drawer with full conversation.
- Use `/api/data/convo?id=recXXXX` for full record.
- Show linked signals.
- Show cart / checkout info.
- Show workflow history.
- One AI button: “Suggérer une action”.
- Today remains the operational center.

## 22. Lot 7 preview

Lot 7 goal:
- Health page.
- tblErrors list.
- DETECTOR signals list.
- Simple funnel.
- Normalize resolved field.
- General polish.

## 23. Hard rules recap

Never:
- expose secrets
- modify main directly
- start Lot 6 before Lot 5.1
- break Today
- break ?demo=1
- use OpenAI for Lot 5.1
- create new endpoint for Lot 5.1
- refactor unrelated files

Always:
- read real files first
- announce plan before coding
- apply minimal diff
- provide tests
- wait for Oussama validation before moving to the next lot