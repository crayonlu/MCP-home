import { describe, expect, it } from 'vitest';
import { createTestRuntime, controlRequest, jsonResponse } from '../tests/support/runtime.js';

describe('debug', () => {
  it('prints runtime shape', async () => {
    const { runtime, controlKey, close } = createTestRuntime();
    try {
      console.log('runtime keys:', Object.keys(runtime));
      console.log('has config:', Boolean((runtime as { config?: unknown }).config));
      const res = await controlRequest(runtime, controlKey, 'GET', '/api/v1/market');
      console.log('status:', res.status);
      const body = await jsonResponse(res);
      console.log('body keys:', Object.keys(body as object).slice(0, 5));
      expect(res.status).toBe(200);
    } finally {
      await close();
    }
  });
});
