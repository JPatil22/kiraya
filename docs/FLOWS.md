# Kiraya — User & System Flows

## 1. MVP1 — Auth + onboarding state machine

The onboarding step is stored on `profiles.onboarding_step` and enforced by middleware, so any
refresh/deep-link resumes at the correct screen.

```mermaid
flowchart TD
    A[Landing /] -->|Get started| B[/login: enter phone/]
    B -->|signInWithOtp| C[/verify: enter 6-digit OTP/]
    C -->|verifyOtp OK| D{profiles row?}
    D -->|no| E[create profile\nstep = role]
    D -->|yes| F{onboarding_step}
    E --> G[/onboarding/role/]
    F -->|role| G
    F -->|intent| H[/onboarding/intent/]
    F -->|done| I[/dashboard/]

    G -->|tenant| H
    G -->|owner or broker| J[set step = done]
    J --> I
    H -->|submit intent| K[insert tenant_intents\nset step = done]
    K --> I
```

**Middleware guard (every request):**

```mermaid
flowchart LR
    R[Request] --> S{Session?}
    S -->|no| P{Protected route?}
    P -->|yes| L[redirect /login]
    P -->|no| OK[allow]
    S -->|yes| ST{onboarding_step}
    ST -->|role| RR[force /onboarding/role]
    ST -->|intent| RI[force /onboarding/intent]
    ST -->|done| OK
```

## 2. MVP2 — Listing lifecycle & the "truth" render

```mermaid
flowchart TD
    O[Owner/Broker] -->|create| D[listing: draft]
    D -->|submit| PR[pending_review]
    PR -->|admin approve + verify| LIVE[live\nlast_verified_at = now]
    PR -->|admin reject| REJ[rejected]
    LIVE -->|admin/owner re-verify| LIVE
    LIVE -->|mark rented| RENT[availability = rented]
    LIVE -->|archive| ARC[archived]

    subgraph Tenant view of a LIVE listing
      LIVE --> CARD["Card renders:\n• all-in monthly = rent+maint\n• move-in = deposit+brokerage+one_time\n• 'verified N days ago' (or STALE badge)\n• posted-by role badge"]
    end
```

## 3. MVP3 — Update history + mismatch warning

```mermaid
flowchart TD
    subgraph Automatic history
      CH[Any change to rent/deposit/availability/verified] --> TRG[(trigger)]
      TRG --> LOG[insert property_updates row\nfield, old→new, kind, changed_by]
      LOG --> TL[Listing shows update timeline]
    end

    subgraph Tenant-driven mismatch
      T[Tenant on listing] -->|Report mismatch| MR[insert mismatch_report: open]
      MR --> CNT{open reports >= threshold?}
      CNT -->|yes| WARN[Warning badge shown to ALL viewers]
      CNT -->|no| QUEUE[Only in admin queue]
      MR --> AQ[Admin triage queue MVP5]
    end
```

## 4. MVP4 — Broker suggestion (replacing WhatsApp)

```mermaid
sequenceDiagram
    participant B as Broker
    participant S as Kiraya
    participant T as Tenant
    B->>S: Browse verified tenant intents (no PII)
    B->>S: Suggest property X → intent Y (+message)
    S->>S: insert broker_suggestion (status=sent)\nmust reference a LIVE listing
    S-->>T: In-app card: full verified listing + note
    T->>S: Open card (status=viewed)
    alt Interested
      T->>S: Accept (status=accepted)
      S-->>B: Notified; contact exchange unlocked
    else Not interested
      T->>S: Decline / Not relevant
    end
    Note over B,T: Every step logged. No WhatsApp, no off-platform "DM me".
```

## 5. MVP5 — Admin moderation loop

```mermaid
flowchart TD
    subgraph Queues
      Q1[Pending listings] --> A1{Admin}
      Q2[Open mismatch reports] --> A1
      Q3[Broker applications/flags] --> A1
    end
    A1 -->|approve+verify| M1[listing live\n+ moderation_action]
    A1 -->|reject/takedown| M2[listing rejected/archived]
    A1 -->|resolve/dismiss| M3[report closed\n+ maybe force re-verify]
    A1 -->|suspend/reinstate| M4[profile.is_suspended toggled]
    M1 & M2 & M3 & M4 --> DASH[Locality health dashboard\nfresh/stale/live, open mismatches, active tenants]
```

## Route map

| Route | MVP | Access |
|---|---|---|
| `/` | 1 | public |
| `/login`, `/verify` | 1 | public (redirects out if authed) |
| `/onboarding/role`, `/onboarding/intent` | 1 | authed, gated by step |
| `/dashboard` | 1 | authed, onboarding done |
| `/listings`, `/listings/[id]` | 2 | public read (live only) |
| `/listings/new` | 2 | owner/broker/admin |
| update timeline + report action on `/listings/[id]` | 3 | public read / authed report |
| `/suggestions` | 4 | tenant only |
| `/broker/intents` | 4 | broker only |
| `/admin` (health), `/admin/listings`, `/admin/reports`, `/admin/people` | 5 | admin only |
