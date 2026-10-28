import { describe, expect, it } from 'vitest';
import { isDifferentDocument, rowDescription } from '../../src/site/documentList';

describe('rowDescription', () => {
  it('drops the button captions and collapses whitespace', () => {
    expect(rowDescription('102674\nBoard Order\n07/08/2026\nPublic\nPreview\nGO GET IT\n.pdf')).toBe(
      '102674 Board Order 07/08/2026 Public .pdf',
    );
  });
});

describe('isDifferentDocument', () => {
  it('accepts a file whose ID is in the clicked row', () => {
    expect(isDifferentDocument('102674.pdf', '102674 Board Order 07/08/2026 Public .pdf')).toBe(false);
    expect(isDifferentDocument('D-1.pdf', 'Part 1: Non-Confidential 02/08/2021 Public D-1 .pdf')).toBe(false);
  });

  it('rejects a file whose ID belongs to another row', () => {
    expect(isDifferentDocument('102202.pdf', '102295 HRWC Confidentiality Undertaking 06/05/2026 Public .pdf')).toBe(
      true,
    );
  });

  it('does not check captions that contain spaces, like transcripts', () => {
    expect(isDifferentDocument('NSUARB-M10431-September 12, 2022.pdf', '09/12/2022 September 12, 2022 Pdf Public')).toBe(
      false,
    );
  });
});
