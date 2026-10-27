import type { MatterRequest } from './types';

const MATTER_NUMBER = /^M?[\s-]*(\d{5})$/i;

export function normalizeMatterNumber(input: string): string | null {
  const match = MATTER_NUMBER.exec(input.trim());
  return match ? `M${match[1]}` : null;
}

export function requestSlug({ matterNumber, docType }: MatterRequest): string {
  return `${matterNumber}-${docType.toLowerCase().replace(/\s+/g, '-')}`;
}
