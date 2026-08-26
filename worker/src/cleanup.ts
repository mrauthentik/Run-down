import fs from 'fs';

/**
 * Safely deletes a file. Logs but does NOT throw on failure — cleanup errors
 * should never crash the worker or mask the real job result.
 */
export function safeDelete(filePath: string, label = ''): void {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[cleanup] Deleted ${label} ${filePath}`);
    }
  } catch (err) {
    console.error(`[cleanup] Failed to delete ${label} ${filePath}:`, err);
  }
}

export function deleteInputFile(inputPath: string): void {
  safeDelete(inputPath, 'input');
}

export function deleteOutputFile(outputPath: string): void {
  safeDelete(outputPath, 'output');
}
