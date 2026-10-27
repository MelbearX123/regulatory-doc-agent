import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { saveFetchedFile } from './download';

describe('saveFetchedFile', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'save-test-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('writes the file and reports its size', async () => {
    const saved = await saveFetchedFile({ fileName: '102674.pdf', data: Buffer.from('%PDF-1.7') }, dir);
    expect(saved).toEqual({ fileName: '102674.pdf', filePath: path.join(dir, '102674.pdf'), sizeBytes: 8 });
    expect(await readFile(saved.filePath, 'utf8')).toBe('%PDF-1.7');
  });

  it('numbers duplicate names instead of overwriting', async () => {
    const names: string[] = [];
    for (const content of ['a', 'b', 'c']) {
      names.push((await saveFetchedFile({ fileName: '102197.pdf', data: Buffer.from(content) }, dir)).fileName);
    }
    expect(names).toEqual(['102197.pdf', '102197 (2).pdf', '102197 (3).pdf']);
    expect(await readFile(path.join(dir, '102197.pdf'), 'utf8')).toBe('a');
  });

  it('replaces characters Windows does not allow in file names', async () => {
    const saved = await saveFetchedFile({ fileName: 'Letter: re/attachments?.pdf', data: Buffer.from('x') }, dir);
    expect(saved.fileName).toBe('Letter_ re_attachments_.pdf');
  });
});
