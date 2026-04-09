import crypto from 'crypto';

// Gera o token esperado usando Node.js crypto (chamado somente em Server Components/Actions)
function computeExpected(secret: string): string {
  return crypto.createHmac('sha256', secret).update('admin-session').digest('hex');
}

export function isAdminTokenValid(token: string | undefined): boolean {
  if (!token) return false;
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  try {
    const expected = computeExpected(secret);
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function generateAdminToken(): string {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) throw new Error('ADMIN_SECRET não configurado');
  return computeExpected(secret);
}
