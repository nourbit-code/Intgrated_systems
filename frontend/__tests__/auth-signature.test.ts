import { buildUserSignature } from '@/hooks/useAuth';

describe('auth signature', () => {
  test('builds signature for authenticated user', () => {
    const signature = buildUserSignature({
      id: '12',
      name: 'Nour Sameh',
      email: 'nour@example.com',
      role: 'receptionist',
    });
    expect(signature).toBe('Nour Sameh (Receptionist - 12)');
  });

  test('returns fallback for missing user', () => {
    expect(buildUserSignature(null)).toBe('Unknown User');
  });
});
