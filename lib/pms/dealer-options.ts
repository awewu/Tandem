import type { Organization } from '@/lib/types/organization';

export interface DealerProfileBase {
  orgId: string;
  status?: string;
  [key: string]: unknown;
}

export interface DealerProfileOption extends DealerProfileBase {
  orgName?: string;
  orgType?: Organization['type'];
  category?: Organization['category'];
  source?: 'pms' | 'organization';
}

function isDealerOrganization(org: Organization): boolean {
  return org.type !== 'anchor' && org.category === 'dealer';
}

export function mergeDealerProfilesWithOrganizations(
  profiles: DealerProfileBase[],
  organizations: Organization[],
): DealerProfileOption[] {
  const orgById = new Map(organizations.map((org) => [org.id, org]));
  const seen = new Set<string>();

  const profileOptions = profiles.map((profile) => {
    seen.add(profile.orgId);
    const org = orgById.get(profile.orgId);
    return {
      ...profile,
      orgName: org?.name,
      orgType: org?.type,
      category: org?.category,
      status: profile.status ?? org?.status,
      source: 'pms' as const,
    };
  });

  const organizationOptions = organizations
    .filter((org) => isDealerOrganization(org) && !seen.has(org.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    .map((org) => ({
      orgId: org.id,
      orgName: org.name,
      orgType: org.type,
      category: org.category,
      status: org.status,
      source: 'organization' as const,
    }));

  return [...profileOptions, ...organizationOptions];
}
