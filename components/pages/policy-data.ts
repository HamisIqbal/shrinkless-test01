import {
  POLICY_CLAUSES,
  getContentLayer,
  getSiteContent,
  policyEffectiveDate,
  type PolicyId,
} from '@/lib/services/site-content';
import { getStoreSettings } from '@/lib/services/settings';
import { POLICIES_EFFECTIVE } from '@/lib/legal/pages';
import { fillLine, fillParagraphs, policyTokens } from '@/lib/legal/tokens';

export type PolicyClauseView = { heading: string; paragraphs: string[] };

/**
 * Everything a policy page renders, read and filled once.
 *
 * The words come from the content registry, like every other page's, so a
 * clause can be corrected on the Content tab. A blank line in a clause's text
 * is a paragraph break. {{tokens}} are filled from the business details in
 * Settings; see lib/legal/tokens.ts. A clause left with no heading or no
 * paragraphs — every paragraph named a detail not yet entered — is dropped.
 *
 * Shared by PolicyPage and the privacy page, which set the same words out
 * differently.
 */
export async function loadPolicy(id: PolicyId) {
  const [copy, layer, settings, effective] = await Promise.all([
    getSiteContent(),
    getContentLayer(`policy-${id}`),
    getStoreSettings(),
    policyEffectiveDate(id, POLICIES_EFFECTIVE),
  ]);

  const tokens = policyTokens({ ...settings.business, email: settings.storeEmail });

  const clauses: PolicyClauseView[] = Array.from({ length: POLICY_CLAUSES[id] }, (_, index) => ({
    heading: fillLine(copy[`policy.${id}.${index + 1}.heading`] ?? '', tokens),
    paragraphs: fillParagraphs(copy[`policy.${id}.${index + 1}.body`] ?? '', tokens),
  })).filter((clause) => clause.heading && clause.paragraphs.length);

  return {
    title: fillLine(copy[`policy.${id}.title`], tokens),
    lede: fillLine(copy[`policy.${id}.lede`], tokens),
    clauses,
    effective,
    layer,
    email: settings.storeEmail,
    phone: settings.business.phone.trim(),
  };
}
