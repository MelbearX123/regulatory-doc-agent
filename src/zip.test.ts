import AdmZip from 'adm-zip';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { zipFiles } from './zip';

describe('zipFiles', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'zip-test-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('zips the files flat, by file name', async () => {
    const files = ['a.pdf', 'b.pdf'].map((name) => path.join(dir, name));
    await writeFile(files[0]!, 'first');
    await writeFile(files[1]!, 'second');

    const zip = await zipFiles(files, path.join(dir, 'out.zip'));

    const entries = new AdmZip(zip.filePath).getEntries();
    expect(entries.map((entry) => entry.entryName).sort()).toEqual(['a.pdf', 'b.pdf']);
    expect(entries.find((entry) => entry.entryName === 'b.pdf')?.getData().toString()).toBe('second');
    expect(zip.fileName).toBe('out.zip');
    expect(zip.sizeBytes).toBe((await stat(zip.filePath)).size);
  });
});
