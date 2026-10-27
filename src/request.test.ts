import { describe, expect, it } from 'vitest';
import { normalizeMatterNumber, requestSlug } from './request';
import { DocType } from './types';

describe('normalizeMatterNumber', () => {
  it.each([
    ['M12205', 'M12205'],
    ['m12205', 'M12205'],
    ['M 12205', 'M12205'],
    ['M-12205', 'M12205'],
    ['12205', 'M12205'],
    ['  m12205  ', 'M12205'],
  ])('normalizes %j to %j', (input, expected) => {
    expect(normalizeMatterNumber(input)).toBe(expected);
  });

  it.each(['M123', 'M123456', 'X12205', 'M1220a', ''])('rejects %j', (input) => {
    expect(normalizeMatterNumber(input)).toBeNull();
  });
});

describe('requestSlug', () => {
  it('joins the matter number and a kebab-case document type', () => {
    expect(requestSlug({ matterNumber: 'M12205', docType: DocType.OTHER_DOCUMENTS })).toBe('M12205-other-documents');
  });
});
