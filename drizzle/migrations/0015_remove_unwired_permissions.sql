UPDATE "RoleDefinition"
SET "permissions" = array_remove(
  array_remove(
    array_remove(
      array_remove("permissions", 'launchpad.manage'),
      'kpi.manage'
    ),
    'governance.manage'
  ),
  'learning.manage'
), "updatedAt" = now();
