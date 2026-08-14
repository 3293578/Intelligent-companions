import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { normalizeModelSelection } from './modelConfig.js';

const MAX_API_KEY_LENGTH = 512;

function normalizeApiKey(value) {
  const key = String(value || '').trim();
  if (!key) return '';
  if (key.length > MAX_API_KEY_LENGTH || /[\r\n\0]/.test(key)) throw new Error('Invalid API key.');
  return key;
}

function normalizeStoredConfig(value = {}) {
  const apiKeys = value.apiKeys && typeof value.apiKeys === 'object' ? value.apiKeys : {};
  return {
    version: 1,
    selection: normalizeModelSelection(value.selection),
    apiKeys: Object.fromEntries(
      Object.entries(apiKeys)
        .filter(([provider]) => ['deepseek', 'openai', 'openai_compatible'].includes(provider))
        .map(([provider, key]) => [provider, normalizeApiKey(key)])
        .filter(([, key]) => key)
    )
  };
}

export function createModelConfigStore(filePath) {
  async function load() {
    try {
      return normalizeStoredConfig(JSON.parse(await readFile(filePath, 'utf8')));
    } catch (error) {
      if (error?.code === 'ENOENT' || error instanceof SyntaxError) {
        return { version: 1, selection: null, apiKeys: {} };
      }
      throw error;
    }
  }

  async function save({ selection, apiKey }) {
    const current = await load();
    const normalizedSelection = normalizeModelSelection(selection);
    const normalizedKey = normalizeApiKey(apiKey);
    const next = normalizeStoredConfig({
      selection: normalizedSelection,
      apiKeys: {
        ...current.apiKeys,
        ...(normalizedKey ? { [normalizedSelection.provider]: normalizedKey } : {})
      }
    });
    await mkdir(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(next, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    await rename(temporaryPath, filePath);
    return next;
  }

  return { load, save };
}
