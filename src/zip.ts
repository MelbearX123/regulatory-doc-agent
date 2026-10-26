import AdmZip from 'adm-zip';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import type { SavedFile } from './types';

export async function zipFiles(filePaths: string[], zipPath: string): Promise<SavedFile> {
  const zip = new AdmZip();
  for (const filePath of filePaths) {
    zip.addLocalFile(filePath);
  }
  await zip.writeZipPromise(zipPath);
  const { size } = await stat(zipPath);
  return { fileName: path.basename(zipPath), filePath: zipPath, sizeBytes: size };
}
