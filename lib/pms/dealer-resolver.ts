import { createDownstreamOrg } from '@/lib/auth/organizations';
import {
  isYonyouCustomerConfigured,
  listYonyouCustomerDealerProfiles,
} from '@/lib/integrations/yonyou-customer';
import { getStore } from '@/lib/storage/repository';
import type { Organization } from '@/lib/types/organization';
import type { PmsAuthResult } from './pms-auth';

export function normalizeDealerRef(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function dealerRefCandidates(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  const source = value as Record<string, unknown>;
  return [
    source.orgId,
    source.orgName,
    source.name,
    source.code,
    source.id,
  ]
    .map(normalizeDealerRef)
    .filter(Boolean);
}

function isActiveDealerOrg(org: Organization): boolean {
  return org.status === 'active' && org.type !== 'anchor' && (!org.category || org.category === 'dealer');
}

function findLocalDealerOrg(orgs: Organization[], targets: string[]): Organization | undefined {
  return orgs.find((org) => (
    isActiveDealerOrg(org) &&
    (
      targets.includes(normalizeDealerRef(org.id)) ||
      targets.includes(normalizeDealerRef(org.name))
    )
  ));
}

async function findYonyouDealer(rawTargets: string[], targets: string[]) {
  if (targets.length === 0 || !isYonyouCustomerConfigured()) return null;

  const variants = rawTargets.flatMap((target) => [
    { code: target },
    { name: target },
  ]);

  for (const variant of variants) {
    const result = await listYonyouCustomerDealerProfiles({
      ...variant,
      pageIndex: 1,
      pageSize: 10,
      stopStatus: false,
    });
    const matched = result.profiles.find((profile) => (
      profile.status !== 'stopped' &&
      dealerRefCandidates(profile).some((candidate) => targets.includes(candidate))
    ));
    if (matched) return matched;
  }

  return null;
}

export async function resolveDealerOrgId(
  auth: PmsAuthResult,
  ref: unknown,
  options: { dealerName?: unknown; dealerCode?: unknown; dealerSource?: unknown } = {},
): Promise<string | null> {
  const rawTargets = [ref, options.dealerName, options.dealerCode].filter((value) => String(value ?? '').trim());
  const rawRefs = Array.from(new Set(rawTargets.map((value) => String(value).trim()).filter(Boolean)));
  const targets = Array.from(new Set(rawRefs.map(normalizeDealerRef).filter(Boolean)));
  if (targets.length === 0) return null;

  const orgs = await getStore().organizations.list({ tenantId: auth.tenantId });
  const matched = findLocalDealerOrg(orgs, targets);
  if (matched) return matched.id;

  const yonyouDealer = await findYonyouDealer(rawRefs, targets);
  if (!yonyouDealer && options.dealerSource !== 'ys') return null;

  const name = String(
    options.dealerName ||
    yonyouDealer?.name ||
    yonyouDealer?.code ||
    ref ||
    '',
  ).trim();
  if (!name) return null;

  const created = await createDownstreamOrg({
    name,
    type: 'downstream',
    category: 'dealer',
    createdBy: auth.userId,
    tenantId: auth.tenantId,
  });
  return created.id;
}
