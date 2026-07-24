# Mobile App Scope and Home Dashboard

> Status: accepted working baseline
> Date: 2026-07-22
> Owner note: App Android/iOS should not mirror every PC feature. Mobile is a focused work cockpit controlled from PC admin configuration.

## 1. Decision

Tandem mobile App is not the PC product squeezed onto a small screen. Android and iOS should be a focused cockpit:

- Home dashboard as the first screen.
- A small set of high-frequency mobile entries.
- Central AI available globally.
- PC admin can enable or disable mobile features by checkbox.
- Mobile changes should be configuration-driven where possible, not require App package rebuilds.

The current reserved mobile feature set is:

| Feature | Product name | Route / surface | Mobile role |
|---|---|---|---|
| Home dashboard | 首页 / 整体看板 | `/` or mobile home route | First screen, daily overview |
| Central AI | 中央 AI | Global `BossAiMount` / AI button | Always-available assistant |
| Shouchao | 搭子手抄 | `/shouchao` | Capture and organize personal notes |
| Mail | 邮箱 | `/mail` | Important messages, replies, drafts |
| Calendar | 日程 | `/calendar` | Today schedule and meeting rhythm |
| Daily report | 事半中的日报 | `/report` | Daily OKR progress input |
| Naba | 拿捏 | `/persona` and related Naba routes | Persona growth and delegated actions |

This list is configurable, not hard-coded as a final forever scope.

## 2. Product Principle

Mobile should answer one question:

> What should I look at or do today?

PC remains the complete operating console. Mobile is for daily action, quick review, lightweight capture, and asking Central AI.

Avoid exposing every module on mobile by default. If a function is not useful in short, repeated, on-the-go sessions, it should stay on PC unless explicitly enabled.

## 3. Mobile Navigation

Recommended default bottom navigation:

| Position | Entry | Route | Reason |
|---|---|---|---|
| 1 | 首页 | `/` or mobile dashboard route | Default landing page |
| 2 | 手抄 | `/shouchao` | Fast personal capture |
| 3 | 日报 | `/report` | Highest-frequency OKR input |
| 4 | 日程 | `/calendar` | Time-sensitive work |
| 5 | 拿捏 | `/persona` | Personal AI growth and agency |

Central AI should not consume a bottom tab. It should remain a global floating action button, visible across enabled mobile surfaces.

Mail can be handled in either of two ways:

| Option | Shape | When to choose |
|---|---|---|
| Recommended | Show mail as a prominent Home dashboard card and quick action | Mail is important, but dashboard summary is enough for daily triage |
| Alternative | Put Mail in bottom nav and move Naba into Home | Boss explicitly treats mail as a primary daily App tab |

Default recommendation:

```text
Bottom tabs: 首页 / 手抄 / 日报 / 日程 / 拿捏
Global action: 中央 AI
Home card: 邮箱
```

## 4. Home Dashboard

The Home dashboard is the mobile command center. It should be compact, scan-friendly, and action-oriented.

Recommended dashboard sections:

| Section | Content | Primary actions |
|---|---|---|
| Today overview | Today's schedule count, unread mail count, daily report status, pending actions | Open next item |
| AI briefing | Central AI summary of focus, risks, and suggested next steps | Ask AI |
| Calendar card | Next meeting and today's agenda | Open calendar, create event |
| Mail card | Important unread mail, pending replies, AI draft status | Open inbox, draft reply |
| Daily report card | Whether today's report is done, draft progress, OKR check-in hints | Write or continue report |
| Shouchao card | Recent notes, unsorted captures, continue writing | Open Shouchao |
| Naba card | Persona stage, training progress, delegated actions needing confirmation | Open Naba |
| Quick actions | Write report, ask AI, write note, send mail, create event | Direct action |

The dashboard may show only cards for enabled features. If Mail is disabled in mobile configuration, the Mail card disappears. If Naba is disabled, the Naba card disappears.

## 5. PC Configuration

Add a PC admin page for mobile feature control.

Recommended location:

```text
管理后台 -> 移动端功能
```

Recommended controls:

| Checkbox | Feature key | Default |
|---|---|---|
| 首页 / 整体看板 | `home_dashboard` | on |
| 中央 AI | `central_ai` | on |
| 搭子手抄 | `shouchao` | on |
| 邮箱 | `mail` | on |
| 日程 | `calendar` | on |
| 日报 | `daily_report` | on |
| 拿捏 | `naba` | on |

Future optional controls:

| Control | Purpose |
|---|---|
| Bottom nav order | Allow admin to choose which 5 entries are pinned |
| Dashboard card visibility | Let Home cards be enabled separately from routes |
| Role / department rules | Different mobile surfaces for employee, manager, external partner |
| Emergency disable | Turn off a mobile feature without redeploying |

## 6. Configuration Interface

Use a small configuration interface that can be shared by mobile navigation, Home dashboard, and route guards.

Suggested shape:

```ts
export type MobileFeatureKey =
  | 'home_dashboard'
  | 'central_ai'
  | 'shouchao'
  | 'mail'
  | 'calendar'
  | 'daily_report'
  | 'naba';

export interface MobileFeatureConfig {
  tenantId: string;
  enabledFeatures: MobileFeatureKey[];
  bottomNav: MobileFeatureKey[];
  dashboardCards: MobileFeatureKey[];
  updatedAt: string;
  updatedBy: string;
}
```

Suggested read endpoint:

```text
GET /api/mobile/features
```

Suggested admin endpoint:

```text
GET /api/admin/mobile-features
PUT /api/admin/mobile-features
```

The interface should hide implementation details. Callers should ask "which mobile features are enabled?" instead of manually duplicating route lists.

## 7. Access Control

Do not only hide buttons. Mobile feature configuration must affect two layers:

| Layer | Behavior |
|---|---|
| Navigation layer | Hide disabled bottom tabs, drawer entries, dashboard cards, and quick actions |
| Access layer | If a mobile user deep-links to a disabled route, redirect to Home or a feature-disabled page |

This avoids a false sense of control where the UI hides a feature but the route still works.

PC routes should remain governed by existing PC roles and permissions unless a separate PC feature switch is introduced.

## 8. Current Code Implications

Known implementation touchpoints:

| Area | Current file / surface | Change later |
|---|---|---|
| Mobile bottom nav | `components/mobile-tab-bar.tsx` | Replace hard-coded tabs with config-driven tabs |
| Mobile drawer | `components/mobile-drawer.tsx` | Filter entries by mobile feature config |
| App shell | `components/app-shell.tsx` | Keep Central AI global when enabled |
| Mobile default route | `components/app-shell.tsx` currently redirects Capacitor `/` or `/home` to `/im` | Change mobile default landing to Home dashboard |
| Desktop nav source | `components/nav-modules.ts` | Keep as PC navigation source; map mobile features to route ownership |
| Route guard | `middleware.ts` / module-scope logic | Add mobile feature guard for App/mobile user agent or Capacitor headers |
| Existing admin precedent | `/admin/launchpad` | Reuse the pattern of PC-managed enable/disable and visibility controls |

## 9. Implementation Phases

### Phase 1: Config-driven mobile navigation

- Add mobile feature config storage.
- Add admin checkbox page.
- Add `/api/mobile/features`.
- Update mobile bottom nav and Home dashboard to read config.
- Default enabled set matches this document.

Acceptance:

- Admin can enable or disable mobile features from PC.
- Mobile navigation updates without rebuilding Android/iOS.
- Central AI can be toggled independently.

### Phase 2: Home dashboard

- Build the mobile Home dashboard as the first screen.
- Show only enabled cards.
- Add quick actions for enabled features.
- Change Capacitor default route from IM to Home dashboard.

Acceptance:

- Opening Android/iOS lands on Home dashboard.
- Dashboard shows today's calendar, mail, report, Shouchao, Naba, and AI summary when enabled.
- Disabled feature cards do not render.

### Phase 3: Mobile access guard

- Enforce disabled mobile routes at access level.
- Deep links to disabled features redirect safely.
- Keep PC access unaffected.

Acceptance:

- Disabled mobile feature cannot be opened through bottom nav, drawer, quick action, or direct URL.
- PC users can still use PC-enabled routes according to normal role rules.

### Phase 4: Role and department variants

- Support role-specific mobile feature sets.
- Support external partner mobile scope if needed.
- Add audit trail for admin changes.

Acceptance:

- Employee, manager, admin, and external roles can receive different mobile scopes.
- Admin changes are traceable.

## 10. Open Decisions

| Question | Default until changed |
|---|---|
| Should Mail be a bottom tab? | No. Show Mail on Home dashboard first. |
| Should Naba stay in bottom nav? | Yes. It represents long-running personal AI growth. |
| Should Home route reuse `/`? | Prefer yes if mobile can branch cleanly; otherwise add a dedicated mobile dashboard route. |
| Should PC be affected by mobile feature switches? | No. These switches are mobile-only unless explicitly expanded. |
| Should disabled mobile routes show a page or redirect? | Redirect to Home with a toast or lightweight disabled state. |

## 11. Working Baseline

Until superseded by a newer accepted document, future mobile App work should follow this baseline:

```text
Mobile App = Home dashboard + Central AI + Shouchao + Mail + Calendar + Daily Report + Naba.
PC admin controls mobile feature availability by checkbox.
Mobile UI is config-driven.
Route access is guarded, not merely hidden.
PC remains the full-feature console.
```

