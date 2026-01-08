/**
 * Core library tests
 * Placeholder to prevent bun test from failing with exit code 1
 */

import { describe, test, expect } from 'bun:test';

describe('core', () => {
  test('module exports are defined', async () => {
    const core = await import('./index.ts');
    expect(core).toBeDefined();
  });
});
