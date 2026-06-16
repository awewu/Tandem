---
trigger: always_on
---

# Hermes / Tandem — Project Overview

**Product**: Tandem (牛马搭子) — 瑞合瑞德集团企业管理软件 (产研销).  
**Stack**: Next.js 14 App Router · TypeScript · Drizzle ORM · PostgreSQL · TailwindCSS · shadcn/ui.  
**Monorepo root**: `e:\Hermes`  
**Dev server**: `next dev` on **port 3000**.

## Two-tier User Model
| Tier | Registration | Roles | Access |
|---|---|---|---|
| Internal | Corporate email | owner / admin / manager / employee / steward / champion | Full (OKR / 拿捏 / 搭子 / 学院 / 内网 …) |
| External | Phone + invite code / apply | guest / partner / contractor | Only authorised modules (拿捏 / 搭子 / system) |

Role definitions: `lib/auth/roles.ts` (`INTERNAL_ROLES`, `EXTERNAL_ROLES`).  
Module visibility: `lib/services/launchpad-service.ts` `isAppVisibleTo()`.

## Key Identifiers
- **Default tenant**: `tenantId = 'default'`
- **Owner / admin user**: `admin@tandem.local`  
- **Central AI persona**: `userId = '__company__'`
