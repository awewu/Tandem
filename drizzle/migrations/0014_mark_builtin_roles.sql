UPDATE "RoleDefinition"
SET "system" = true, "updatedAt" = now()
WHERE "key" IN ('owner','admin','champion','intranet_editor','steward','manager','employee','finance','internal_staff','guest','partner','contractor');
