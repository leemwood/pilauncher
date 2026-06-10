import { invoke } from '@tauri-apps/api/core';

let systemFontsPromise: Promise<string[]> | null = null;

/**
 * Loads system fonts asynchronously in the background.
 * If already triggered, returns the existing loading promise.
 * 
 * @param force If true, forces a reload of the system fonts
 */
export const loadSystemFonts = (force = false): Promise<string[]> => {
  if (!systemFontsPromise || force) {
    systemFontsPromise = invoke<string[]>('get_system_fonts').catch((err) => {
      console.error('Failed to get system fonts:', err);
      // Fallback to empty array on error so it doesn't break the promise chain
      return [];
    });
  }
  return systemFontsPromise;
};
