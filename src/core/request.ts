import type { MatterRequest } from './types';

const MATTER_NUMBER = /^M?[\s-]*(\d{5})$/i;
const MATTER_NUMBER_IN_TEXT = /\bM[\s-]?(\d{5})\b/gi;

export function normalizeMatterNumber(input: string): string | null {
  const match = MATTER_NUMBER.exec(input.trim());
  return match ? `M${match[1]}` : null;
}

export function findMatterNumbers(text: string): string[] {
  return [...new Set(Array.from(text.matchAll(MATTER_NUMBER_IN_TEXT), (match) => `M${match[1]}`))];
}

export function requestSlug({ matterNumber, docType }: MatterRequest): string {
  return `${matterNumber}-${docType.toLowerCase().replace(/\s+/g, '-')}`;
}
