SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.rbac_permissions (
  code text PRIMARY KEY,
  name text NOT NULL,
  domain text NOT NULL,
  action text NOT NULL,
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rhautt_nexus.rbac_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  code text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rbac_roles_status_chk CHECK (status IN ('active', 'inactive')),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS rhautt_nexus.rbac_role_permissions (
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  role_id uuid NOT NULL REFERENCES rhautt_nexus.rbac_roles(id) ON DELETE CASCADE,
  permission_code text NOT NULL REFERENCES rhautt_nexus.rbac_permissions(code) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_code)
);

CREATE TABLE IF NOT EXISTS rhautt_nexus.rbac_user_roles (
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  user_id uuid NOT NULL REFERENCES rhautt_nexus.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES rhautt_nexus.rbac_roles(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS rbac_user_roles_one_primary_idx
  ON rhautt_nexus.rbac_user_roles (tenant_id, user_id)
  WHERE is_primary;

CREATE INDEX IF NOT EXISTS rbac_roles_tenant_status_idx
  ON rhautt_nexus.rbac_roles (tenant_id, status, code);

CREATE INDEX IF NOT EXISTS rbac_role_permissions_tenant_idx
  ON rhautt_nexus.rbac_role_permissions (tenant_id, permission_code);

ALTER TABLE rhautt_nexus.rbac_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.rbac_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.rbac_user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rbac_roles_tenant_isolation ON rhautt_nexus.rbac_roles;
CREATE POLICY rbac_roles_tenant_isolation ON rhautt_nexus.rbac_roles
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

DROP POLICY IF EXISTS rbac_role_permissions_tenant_isolation ON rhautt_nexus.rbac_role_permissions;
CREATE POLICY rbac_role_permissions_tenant_isolation ON rhautt_nexus.rbac_role_permissions
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

DROP POLICY IF EXISTS rbac_user_roles_tenant_isolation ON rhautt_nexus.rbac_user_roles;
CREATE POLICY rbac_user_roles_tenant_isolation ON rhautt_nexus.rbac_user_roles
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

ALTER TABLE rhautt_nexus.rbac_roles FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.rbac_role_permissions FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.rbac_user_roles FORCE ROW LEVEL SECURITY;

INSERT INTO rhautt_nexus.rbac_permissions (code, name, domain, action, description, sort_order) VALUES
  ('admin.users.view', 'View account page', 'admin.users', 'view', 'Can open account management page.', 10),
  ('admin.users.read', 'Read accounts', 'admin.users', 'read', 'Can list and inspect backend accounts.', 11),
  ('admin.users.create', 'Create accounts', 'admin.users', 'create', 'Can create backend accounts.', 12),
  ('admin.users.update', 'Update accounts', 'admin.users', 'update', 'Can update backend account profile and status.', 13),
  ('admin.users.delete', 'Delete accounts', 'admin.users', 'delete', 'Can delete backend accounts.', 14),
  ('admin.users.reset_password', 'Reset passwords', 'admin.users', 'reset_password', 'Can reset backend account passwords.', 15),
  ('admin.users.assign_roles', 'Assign user roles', 'admin.users', 'assign_roles', 'Can bind roles to users.', 16),
  ('admin.roles.view', 'View role page', 'admin.roles', 'view', 'Can open role management page.', 20),
  ('admin.roles.read', 'Read roles', 'admin.roles', 'read', 'Can list and inspect roles.', 21),
  ('admin.roles.create', 'Create roles', 'admin.roles', 'create', 'Can create roles.', 22),
  ('admin.roles.update', 'Update roles', 'admin.roles', 'update', 'Can update role details and status.', 23),
  ('admin.roles.assign_permissions', 'Assign role permissions', 'admin.roles', 'assign_permissions', 'Can change permissions on roles.', 24),
  ('admin.permissions.read', 'Read permission catalog', 'admin.permissions', 'read', 'Can inspect available permission keys.', 30),
  ('marketing.content.view', 'View content pages', 'marketing.content', 'view', 'Can open marketing content pages.', 40),
  ('marketing.content.create', 'Create content', 'marketing.content', 'create', 'Can create marketing content.', 41),
  ('marketing.content.update', 'Update content', 'marketing.content', 'update', 'Can update marketing content.', 42),
  ('marketing.content.delete', 'Delete content', 'marketing.content', 'delete', 'Can delete marketing content.', 43),
  ('marketing.campaigns.view', 'View campaigns', 'marketing.campaigns', 'view', 'Can open campaign pages.', 50),
  ('marketing.campaigns.create', 'Create campaigns', 'marketing.campaigns', 'create', 'Can create campaigns.', 51),
  ('marketing.campaigns.update', 'Update campaigns', 'marketing.campaigns', 'update', 'Can update campaigns.', 52),
  ('marketing.campaigns.delete', 'Delete campaigns', 'marketing.campaigns', 'delete', 'Can delete campaigns.', 53),
  ('marketing.assets.view', 'View marketing assets', 'marketing.assets', 'view', 'Can open marketing asset pages.', 60),
  ('marketing.assets.create', 'Create marketing assets', 'marketing.assets', 'create', 'Can create marketing assets.', 61),
  ('marketing.assets.update', 'Update marketing assets', 'marketing.assets', 'update', 'Can update marketing assets.', 62),
  ('marketing.assets.delete', 'Delete marketing assets', 'marketing.assets', 'delete', 'Can delete marketing assets.', 63),
  ('analytics.dashboard.view', 'View analytics dashboard', 'analytics.dashboard', 'view', 'Can open analytics dashboard.', 70),
  ('analytics.export', 'Export analytics', 'analytics', 'export', 'Can export analytics data.', 71),
  ('system.audit.read', 'Read audit logs', 'system.audit', 'read', 'Can read audit logs.', 80)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  domain = EXCLUDED.domain,
  action = EXCLUDED.action,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO rhautt_nexus.rbac_roles (tenant_id, code, name, description, status, is_system)
SELECT DISTINCT u.tenant_id, u.role, u.role, 'Backfilled from users.role', 'active', true
FROM rhautt_nexus.users u
WHERE u.role IS NOT NULL
ON CONFLICT (tenant_id, code) DO NOTHING;

INSERT INTO rhautt_nexus.rbac_user_roles (tenant_id, user_id, role_id, is_primary)
SELECT u.tenant_id, u.id, r.id, true
FROM rhautt_nexus.users u
JOIN rhautt_nexus.rbac_roles r ON r.tenant_id = u.tenant_id AND r.code = u.role
ON CONFLICT (user_id, role_id) DO UPDATE SET
  is_primary = true,
  updated_at = now();

INSERT INTO rhautt_nexus.rbac_role_permissions (tenant_id, role_id, permission_code)
SELECT r.tenant_id, r.id, p.code
FROM rhautt_nexus.rbac_roles r
CROSS JOIN rhautt_nexus.rbac_permissions p
WHERE r.code IN ('platform_admin', 'hq_admin')
ON CONFLICT DO NOTHING;

INSERT INTO rhautt_nexus.rbac_role_permissions (tenant_id, role_id, permission_code)
SELECT r.tenant_id, r.id, p.code
FROM rhautt_nexus.rbac_roles r
JOIN rhautt_nexus.rbac_permissions p ON p.code IN (
  'admin.users.view',
  'admin.users.read',
  'admin.users.create',
  'admin.users.update',
  'admin.users.reset_password',
  'admin.users.assign_roles',
  'admin.roles.view',
  'admin.roles.read',
  'admin.permissions.read',
  'marketing.content.view',
  'marketing.content.create',
  'marketing.content.update',
  'marketing.campaigns.view',
  'marketing.campaigns.create',
  'marketing.campaigns.update',
  'marketing.assets.view',
  'marketing.assets.create',
  'marketing.assets.update',
  'analytics.dashboard.view'
)
WHERE r.code IN ('brand_admin', 'dealer_admin')
ON CONFLICT DO NOTHING;
