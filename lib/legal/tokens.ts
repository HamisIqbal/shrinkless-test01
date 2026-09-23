import type { BusinessDetailsDTO } from '@/types/dto';

/**
 * Fills the {{tokens}} in a policy from the store's settings.
 *
 * Works a paragraph at a time: a paragraph that names a detail the owner has
 * not entered yet is dropped whole, so a policy never prints "our address is ."
 * or a raw token. {{legalName}} alone always has a value — the brand stands in
 * until the legal name is set.
 *
 * Pure, so the rule is testable without a database.
 */
export type PolicyFacts = BusinessDetailsDTO & { email: string };

export function policyTokens(facts: PolicyFacts): Record<string, string> {
  return {
    legalName: facts.legalName.trim() || 'Shrinkless',
    email: facts.email.trim(),
    address: facts.address.trim(),
    phone: facts.phone.trim(),
    state: facts.governingState.trim(),
  };
}

const TOKEN = /\{\{\s*(\w+)\s*\}\}/g;

export function fillParagraphs(text: string, tokens: Record<string, string>): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .flatMap((paragraph) => {
      let complete = true;

      const filled = paragraph.replace(TOKEN, (_, name: string) => {
        const value = tokens[name];
        if (!value) complete = false;
        return value ?? '';
      });

      return complete ? [filled] : [];
    });
}

/** For a single line — a title or a lede — where dropping is not an option. */
export function fillLine(text: string, tokens: Record<string, string>): string {
  return text.replace(TOKEN, (_, name: string) => tokens[name] ?? '');
}
