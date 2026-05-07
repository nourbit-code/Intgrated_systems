import { API_BASE_URL, apiRequest, toIsoDateOnly } from '@/utils/api';

describe('api utilities', () => {
  test('uses configured base URL', () => {
    expect(API_BASE_URL).toBeTruthy();
    expect(API_BASE_URL.startsWith('http')).toBe(true);
  });

  test('toIsoDateOnly formats date as yyyy-mm-dd', () => {
    const value = toIsoDateOnly(new Date('2026-04-25T12:34:56.000Z'));
    expect(value).toBe('2026-04-25');
  });

  test('apiRequest parses JSON response', async () => {
    const mockJson = { ok: true };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => mockJson,
    } as unknown as Response);

    const result = await apiRequest<{ ok: boolean }>('/api/v1/reports/revenue');

    expect(result).toEqual(mockJson);
    expect(global.fetch).toHaveBeenCalled();
  });
});
