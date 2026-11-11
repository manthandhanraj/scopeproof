import { createHmac, timingSafeEqual } from 'node:crypto';

const cookieName = 'scopeproof_session';
const fail = (status, message) => Object.assign(new Error(message), { status });

export function authentication(secret, secure) {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (supabaseUrl && new URL(supabaseUrl).protocol !== 'https:') throw new Error('SUPABASE_URL must use HTTPS.');
  const configured = Boolean(supabaseUrl && supabaseKey);
  const sign = payload => createHmac('sha256', secret).update(payload).digest('hex');
  const cookie = (value, age) => `${cookieName}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${secure ? '; Secure' : ''}`;

  function user(req) {
    const value = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    if (!value) return null;
    const [payload, signature = ''] = value.split('.');
    if (!/^[a-f0-9]{64}$/.test(signature) || !timingSafeEqual(Buffer.from(sign(payload)), Buffer.from(signature))) return null;
    try {
      const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
      return typeof data.id === 'string' && data.exp > Date.now() ? data : null;
    } catch { return null; }
  }

  function enter(res, identity) {
    const session = { ...identity, exp: Date.now() + 12 * 60 * 60 * 1000 };
    const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
    res.setHeader('Set-Cookie', cookie(`${payload}.${sign(payload)}`, 12 * 60 * 60));
  }

  async function action(path, input, res) {
    if (path === '/api/auth/demo') {
      enter(res, { id: 'demo', name: 'Demo workspace', demo: true });
      return { signedIn: true };
    }
    if (path === '/api/auth/logout') {
      res.setHeader('Set-Cookie', cookie('', 0));
      return { signedIn: false };
    }
    if (!['/api/auth/signup', '/api/auth/login'].includes(path)) throw fail(404, 'Account action not found.');
    if (!configured) throw fail(503, 'Account sign-in is being configured. You can try the demo now.');
    const { email, password } = input;
    if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        typeof password !== 'string' || password.length < 8 || password.length > 128) {
      throw fail(400, 'Enter a valid email and a password of 8 to 128 characters.');
    }
    const signup = path.endsWith('/signup');
    let response;
    try {
      response = await fetch(`${supabaseUrl}/auth/v1/${signup ? 'signup' : 'token?grant_type=password'}`, {
        method: 'POST', headers: { apikey: supabaseKey, 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }), signal: AbortSignal.timeout(20_000), redirect: 'error',
      });
    } catch { throw fail(502, 'Account service is temporarily unavailable. Please try again.'); }
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 429) throw fail(429, 'Too many attempts. Please wait a moment before trying again.');
      throw fail(400, signup ? 'Account creation could not be completed. Try signing in or check your email confirmation settings.' : 'Sign-in failed. Check your email, password, and email confirmation.');
    }
    if (signup && !result?.access_token) return { signedIn: false, message: 'Check your email to confirm your account, then return here to sign in.' };
    if (!result?.access_token || !result.user?.id) throw fail(502, 'Account service returned an incomplete response. Please try again.');
    enter(res, { id: result.user.id, name: result.user.email || email, demo: false });
    return { signedIn: true };
  }

  return { user, action, configured };
}
