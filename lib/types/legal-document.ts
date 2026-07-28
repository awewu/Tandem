/**
 * Legal documents edited from the Tandem web admin.
 *
 * Stored in KvStore collection `legal_documents` so policy updates do not
 * require code changes or native App rebuilds.
 */

export type LegalDocumentSlug = 'privacy-policy';

export interface LegalDocument {
  id: string;
  tenantId: string;
  slug: LegalDocumentSlug;
  title: string;
  contentMarkdown: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}
