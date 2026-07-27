# Dynamic RBAC Permissions PRD

> Status: Ready for issue breakdown
> Triage: `ready-for-agent`
> Date: 2026-07-27
> Product: Rhautt Nexus / Rhautt Comfort
> Scope: operations and marketing backend account permissions

## Problem Statement

Rhautt Nexus currently has account authorization centered on a single `role` value and scattered hard-coded role checks. This is enough for simple administrator separation, but it does not support the way the operations and marketing team needs to manage backend access.

Administrators need to assign one or more roles to a user, adjust each role's page access and CRUD actions dynamically, and have the final access rights take effect without code changes. The current model also makes it hard to explain why a user can see a page or perform an operation, because permissions are not managed as a first-class configurable product capability.

For this phase, the platform does not need complex dealer, store, region, or field-service data-range authorization. The immediate need is a maintainable internal permission system for backend pages and operations/marketing CRUD workflows, with the backend remaining the final enforcement point and the frontend using the same permissions for menu and button visibility.

## Solution

Build a configurable RBAC foundation for the Rhautt Nexus backend:

1. Users can be assigned one or more roles.
2. A user's effective permissions are the union of all active permissions from all active assigned roles.
3. Roles and role-permission assignments are stored in the database and managed through admin APIs, not hard-coded in application logic.
4. Permissions are modeled as stable permission keys covering page visibility and CRUD-style operations.
5. The frontend receives effective permissions and renders menus, pages, tabs, buttons, and actions accordingly.
6. The backend validates permissions before executing protected APIs.
7. Existing single-role behavior remains compatible during migration by keeping a primary role/current role value while adding multi-role capability.

The first release should focus on the operations and marketing management surface: user management, role management, permission assignment, page access, and CRUD action enforcement. Organization-level data scoping can remain outside this phase except for preserving existing tenant isolation.

## User Stories

1. As a platform administrator, I want to create a role in the backend UI, so that I can model new job responsibilities without code changes.
2. As a platform administrator, I want to edit a role's name, description, status, and permission assignments, so that permission changes can be managed operationally.
3. As a platform administrator, I want to disable a role, so that users stop receiving its permissions without deleting historical configuration.
4. As a platform administrator, I want to assign one or more roles to a user, so that cross-functional operations and marketing staff can receive combined access.
5. As a platform administrator, I want to remove a role from a user, so that access can be reduced immediately when responsibilities change.
6. As a platform administrator, I want one role to be marked as a user's primary role, so that legacy single-role checks and display labels remain stable during migration.
7. As an operations administrator, I want to grant page visibility permissions, so that users only see the backend pages relevant to their work.
8. As an operations administrator, I want to grant operation permissions such as create, read, update, delete, publish, approve, export, and import, so that buttons and APIs match a role's responsibilities.
9. As a marketing administrator, I want marketing staff to access campaign, content, and brand material pages without receiving account-management permissions, so that daily marketing work is separated from system administration.
10. As an operations specialist, I want to see only the pages I can access, so that the backend navigation is clear and avoids unauthorized entry points.
11. As an operations specialist, I want unavailable actions to be hidden or disabled, so that I understand which work I am allowed to perform.
12. As an API user, I want forbidden operations to return a clear authorization error, so that frontend and operations staff can distinguish permission failures from system failures.
13. As a platform administrator, I want to preview a user's effective permissions, so that I can verify the result of multiple role assignments before troubleshooting access issues.
14. As a platform administrator, I want role and permission changes to take effect predictably, so that newly assigned or removed access does not wait for a deployment.
15. As a security reviewer, I want permissions enforced on the backend, so that hiding frontend pages or buttons is never the only protection.
16. As a maintainer, I want permission keys to be stable and named consistently, so that new backend modules can adopt the same permission model.
17. As a maintainer, I want existing `role`-based code to continue working during rollout, so that the RBAC migration does not break current production flows.
18. As a maintainer, I want tests around effective permission calculation and guards, so that future permission changes do not silently weaken access control.

## Implementation Decisions

- Keep the existing authenticated user shape compatible by preserving a single primary/current `role` field while adding `roles` and effective `permissions`.
- Store dynamic RBAC configuration in database tables for roles, permissions, role-permission bindings, and user-role bindings.
- Treat role permissions as additive. If any active assigned role grants a permission, the user has that permission.
- Model permissions with stable keys, grouped by domain and action, such as `admin.users.read`, `admin.users.create`, `marketing.campaigns.update`, and `analytics.dashboard.view`.
- Separate page permissions from operation permissions by convention, not by separate engines. Example: page visibility can use `.view`; CRUD actions can use `.read`, `.create`, `.update`, `.delete`, `.publish`, `.export`.
- Add permission-management APIs for listing permissions, managing roles, assigning permissions to roles, assigning roles to users, and resolving a user's effective permissions.
- Add a backend permission guard/decorator that checks permission keys. Existing role decorators can remain during migration, but new backend endpoints should prefer permission checks.
- Return effective permissions from login, token refresh, and current-user APIs so the frontend can render navigation and controls from backend-derived authorization state.
- Keep tenant isolation intact. This PRD does not replace existing tenant scope rules; it only adds dynamic role and permission evaluation inside the authenticated tenant context.
- Avoid hard-coding operations/marketing role matrices in code. Seed data may provide starter roles, but administrators must be able to change assignments through APIs/UI.
- Permission changes should be auditable at the API/service layer when audit infrastructure is available, especially role creation, permission assignment, and user-role changes.

## Suggested Permission Domains

- `admin.users.*`: user list, create, update, disable, reset password, assign roles.
- `admin.roles.*`: role list, create, update, disable, assign permissions.
- `admin.permissions.read`: permission catalog visibility.
- `marketing.content.*`: content page view and CRUD actions.
- `marketing.campaigns.*`: campaign page view and CRUD actions.
- `marketing.assets.*`: marketing asset page view and CRUD actions.
- `analytics.dashboard.view`: analytics dashboard visibility.
- `analytics.export`: analytics export action.
- `system.audit.read`: audit log visibility.

## Testing Decisions

- Test effective permission resolution as external behavior: multiple roles should produce a union of permissions, disabled roles should not contribute permissions, and duplicate permissions should collapse to one key.
- Test authorization guards by asserting that a request with a required permission passes and a request without it fails with a forbidden response.
- Test compatibility by asserting existing single-role payload fields still exist after login or token refresh while `roles` and `permissions` are also present.
- Test admin APIs for role creation, role update, permission assignment, user-role assignment, and effective permission preview.
- Test frontend permission helpers, where present, against menu visibility and CRUD button visibility behavior.
- Use existing NestJS module tests and auth-related tests as prior art. Start with focused auth/RBAC tests before running broader production readiness gates.

## Out of Scope

- Dealer, store, region, project-owner, or field-service data-range authorization beyond existing tenant isolation.
- Approval workflows for permission changes.
- Custom data policies or row-level business filters created by administrators.
- External IdP role mapping beyond preserving existing SSO behavior.
- Replacing every existing hard-coded role check in one release.
- A full enterprise IAM product with groups, departments, ABAC rules, or policy scripting.

## Further Notes

- The first implementation should be backward-compatible and incremental because current backend modules directly read `user.role`.
- The UI should treat backend permissions as the source of truth. Frontend hiding improves usability, but backend guards decide access.
- Starter roles can be seeded for convenience, such as platform administrator, operations administrator, operations specialist, marketing administrator, marketing specialist, and analytics viewer. These starter roles are editable configuration, not permanent hard-coded policy.
- A useful rollout path is: schema and resolver first, login/current-user payload second, permission guard third, admin management APIs fourth, frontend menu/button integration fifth.
