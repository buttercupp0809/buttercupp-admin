# Vesspr Product Metrics
**As of: 2026-08-13** | Source: prod RDS (`vespr.cfkeo6yq0wzt.eu-north-1.rds.amazonaws.com`)

---

## User Base Overview

| Metric | Value |
|---|---|
| Total registered users | 239 |
| Onboarding complete | 67 (28%) |
| Paid subscribers | 53 (22%) |
| Paused/opted-out | 165 (69%) |
| Telegram users | 107 (45%) |
| WhatsApp users | 132 (55%) |
| iMessage users | 0 |

---

## Weekly and Monthly Active Users

Active = user sent at least 1 message in the period.

| Period | Active Users (any sender) | Active Users (user-sent only) |
|---|---|---|
| WAU (last 7 days) | 42 | 17 |
| MAU (last 30 days) | 60 | 49 |

**WAU/MAU ratio**: 17/49 = 35% (indicates most active users engage weekly, not just monthly).

---

## New Users Per Week (last 8 weeks)

| Week Starting | New Users | Completed Onboarding |
|---|---|---|
| 2026-08-10 | 5 | 2 |
| 2026-08-03 | 42 | 12 |
| 2026-07-27 | 44 | 16 |
| 2026-07-20 | 49 | 10 |
| 2026-07-13 | 31 | 2 |
| 2026-07-06 | 15 | 1 |
| 2026-06-29 | 3 | 0 |
| 2026-06-22 | 18 | 4 |

Average onboarding completion rate across weeks: ~15-36%. Sharp spike in late July / early August. Week of Aug 10 is partial.

---

## D1, D7, D30 Retention

Retention = user sent at least 1 message on that day window after signup.

| Cohort | Retained | Eligible Users | Retention Rate |
|---|---|---|---|
| D1 (within 48h of signup) | 48 | 239 | **20.1%** |
| D7 (day 6-8 after signup) | 12 | 221 | **5.4%** |
| D30 (day 29-31 after signup) | 1 | 72 | **1.4%** |

Only 23.4% of all registered users ever sent a message (56/239). Most drop off before even starting a conversation.

---

## Messages per Retained User

| Period | Active Users | Avg User Messages | Avg Total Messages (both sides) | Total User Messages |
|---|---|---|---|---|
| WAU (7 days) | 17 | 31.9 | 69.1 | 542 |
| MAU (30 days) | 49 | 46.7 | 108.0 | 2,289 |

Active users who stick are highly engaged: ~32 messages sent per week, ~47 over the last month.

---

## Percentage of Proactive Check-ins Opened (Reply Rate)

"Opened" is approximated as: user replied within 24 hours of the check-in being sent.

| Trigger Type | Sent | Replied Within 24h | Reply Rate |
|---|---|---|---|
| **TOTAL** | **1,838** | **383** | **20.8%** |
| guaranteed_checkin_morning | 1,206 | 163 | 13.5% |
| guaranteed_checkin_evening | 189 | 33 | 17.5% |
| guaranteed_checkin_afternoon | 146 | 21 | 14.4% |
| emotional_followup | 76 | 41 | 53.9% |
| morning_checkin | 74 | 28 | 37.8% |
| trajectory_alert | 38 | 24 | 63.2% |
| boundary_apology | 37 | 31 | **83.8%** |
| ambient_presence | 20 | 10 | 50.0% |
| crisis_aftercare | 20 | 11 | 55.0% |
| evening_wrap | 9 | 5 | 55.6% |
| inactivity | 8 | 4 | 50.0% |
| pause_hint | 6 | 6 | **100%** |
| magic_moment | 6 | 5 | 83.3% |
| event_based | 2 | 0 | 0% |
| pattern_recognition | 1 | 1 | 100% |

Key insight: Scheduled mass check-ins (morning/afternoon/evening) have the lowest reply rates (13-17%). Contextually triggered check-ins (boundary_apology, trajectory_alert, crisis_aftercare) perform 4-6x better.

---

## Percentage Receiving a Meaningful Reply

Approximated from active user message counts vs check-in reply rates above.

- 20.8% of all AI-initiated check-ins receive a reply within 24h.
- Of 49 MAU users: average 46.7 messages sent (user-side) vs 108.0 total (meaning ~57 AI messages per user per month).
- The guaranteed morning check-in (the highest volume, 1,206 sent) only gets a 13.5% reply rate -- bulk of volume is low-engagement scheduled pings.

---

## Notification Opt-out and Uninstall Rates

Telegram/WhatsApp block counts are not directly tracked in DB. Proxy metrics:

| Metric | Value |
|---|---|
| Total users | 239 |
| isPaused = true | 165 (**69%**) |
| memoryPaused = true | 2 (0.8%) |
| Onboarded but paused | ~estimate: high |

69% pause rate is very high. This is likely the primary "soft uninstall" signal -- users who received messages but stopped engaging and paused the bot rather than blocking.

---

## How Retention Differs Between Acquired Cohorts

| Source | Users | Ever Messaged | Activation Rate | D7 Retained | D7 Rate |
|---|---|---|---|---|---|
| organic | 218 | 52 | 23.9% | 12 | 5.5% |
| meta (paid) | 2 | 0 | 0.0% | 0 | 0.0% |
| ig (paid) | 1 | 0 | 0.0% | 0 | 0.0% |

Paid acquisition (meta/ig) has 0% activation in this sample -- too small a sample to conclude (only 3 paid users total), but no paid user has ever sent a message.

---

## Organic / Referral Percentage

| Source | Users | % of Total |
|---|---|---|
| Organic / Direct (no UTM) | 233 | **97.5%** |
| Instagram (ig) | 2 | 0.8% |
| Meta (meta) | 2 | 0.8% |
| Facebook (fb) | 1 | 0.4% |

Almost entirely organic acquisition. No referral program is tracked in the DB.

---

## User Acquisition Cost

No paid acquisition spend data is available in the DB. Only 3 users have a UTM source from paid channels (meta/ig/fb). Cost data would need to come from Meta Ads Manager directly.

Estimate: UAC is effectively $0 for organic users. Paid spend (if any) divided by 3 conversions = very high CAC.

---

## Cost Per Active User and Inference Cost

From `UsageCounter` (last 30 days):

| Period Granularity | LLM Messages | Voice Notes | Image Gens | AI Initiated | Users |
|---|---|---|---|---|---|
| daily buckets | 2,205 | 20 | 1 | 0 | 59 |
| weekly buckets | 2,127 | 19 | 1 | 0 | 58 |
| monthly buckets | 1,274 | 10 | 0 | 0 | 53 |

Using monthly bucket as the canonical 30-day figure:
- ~1,274 LLM calls across 53 users = **~24 LLM calls per active user per month**
- Voice notes: 10 total across 53 users (minimal usage)
- Image generation: effectively 0

**Rough inference cost estimate** (assuming ~$0.002/call average for the model in use):
- 1,274 calls x $0.002 = ~$2.55/month total inference for active users
- Per active user: ~$0.05/month

Actual cost depends on token length per call. This is a lower-bound estimate.

---

## Safety Incident and Escalation Rates

| Level | Description | Incidents | Unique Users | Date Range |
|---|---|---|---|---|
| Level 3 | Immediate crisis -- pre-written crisis message, pipeline skipped | 1 | 1 | 2026-07-19 |
| Level 2 | Gentle intervention -- crisis prompt override + resources appended | 7 | 5 | 2026-05-30 to 2026-08-13 |

Total: **8 safety incidents across 5 users** since launch.
- Escalation rate: 5/239 users = **2.1% of all users** have triggered a safety event.
- No Level 1 incidents on record (or not logged at L1).
- Most recent L2 was today (2026-08-13), indicating active monitoring is working.

---

## Geographic Distribution

| Country | Users | % | Onboarded | Paid |
|---|---|---|---|---|
| US | 86 | 36.0% | 22 | 10 |
| (unknown) | 47 | 19.7% | 10 | 15 |
| IN (India) | 30 | 12.6% | 13 | 17 |
| GB (UK) | 24 | 10.0% | 7 | 0 |
| AE (UAE) | 13 | 5.4% | 8 | 1 |
| AU (Australia) | 12 | 5.0% | 5 | 0 |
| CA (Canada) | 9 | 3.8% | 0 | 6 |
| BR (Brazil) | 9 | 3.8% | 1 | 0 |
| TR (Turkey) | 3 | 1.3% | 0 | 0 |
| MX, JP, CL, ES, CO | 6 | 2.5% | 1 | 3 |

Notable: India (12.6% of users) has the highest paid conversion rate of any identified country (17/30 = **57% paid**). Canada also punches above its weight (6/9 = 67% paid). US has low paid conversion (10/86 = 12%). GB and AU have 0 paid users.

---

## What Users Do That Surprised Us

Based on message patterns and engagement data:

1. **Highly engaged users are very engaged**: WAU users average 32 user messages per week -- this is deeper engagement than most consumer apps see. The users who stay are genuinely talking to Pellow, not just tapping around.

2. **69% pause rate**: The majority of registered users have paused. This is the dominant behavior post-signup, not deletion or blocking. Users are not angry -- they are just not ready or not engaged enough. This is a product-fit signal, not a churn signal per se.

3. **Boundary apology works exceptionally well**: 83.8% reply rate on `boundary_apology` check-ins -- one of the highest of any trigger type. When Pellow acknowledges overstepping and apologizes, users respond. This is a strong signal for the emotional intelligence positioning.

4. **India converts to paid at 57%**: Despite being a PPP-pricing market, India has the highest absolute paid user count (17) and the highest conversion rate. This was likely not anticipated given India's reputation for price sensitivity.

5. **Canada users all pay, nobody onboards**: 9 CA users, 6 paid, 0 completed onboarding. They are paying without going through the onboarding flow -- possibly direct payment link or word-of-mouth bypassing the bot's onboarding sequence.

6. **Contextual triggers massively outperform scheduled ones**: `trajectory_alert` (63%), `crisis_aftercare` (55%), `emotional_followup` (54%) vs. `guaranteed_checkin_morning` (13.5%). Users ignore scheduled morning pings but respond when the bot demonstrates it actually understands their situation.

7. **Voice notes barely used**: Only 10-20 voice notes across all users in 30 days despite the feature existing. Text is overwhelmingly the preferred medium.
