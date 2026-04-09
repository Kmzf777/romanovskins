'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const emailSchema = z.object({
  email: z.string().email('Email inválido'),
});

const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  whatsapp: z.string().min(10, 'WhatsApp inválido'),
});

function normalizeWhatsApp(raw: string): string {
  return raw.replace(/\D/g, '');
}

async function sendOtp(email: string): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) {
    console.error('OTP send error:', error);
    return 'Erro ao enviar código. Tente novamente.';
  }
  return null;
}

// Login: email only — for returning users
export async function loginAction(prevState: any, formData: FormData) {
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const redirectTo = (formData.get('redirectTo') as string) || '/';

  const valid = emailSchema.safeParse({ email });
  if (!valid.success) {
    return { error: valid.error.issues[0]?.message ?? 'Email inválido' };
  }

  const err = await sendOtp(email);
  if (err) return { error: err };

  redirect(`/login/verify?${new URLSearchParams({ email, next: redirectTo }).toString()}`);
}

// Register: name + email + whatsapp — for new users
export async function registerAction(prevState: any, formData: FormData) {
  const name = (formData.get('name') as string)?.trim();
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const whatsapp = normalizeWhatsApp(formData.get('whatsapp') as string);
  const redirectTo = (formData.get('redirectTo') as string) || '/';

  const valid = registerSchema.safeParse({ name, email, whatsapp });
  if (!valid.success) {
    return { error: valid.error.issues[0]?.message ?? 'Dados inválidos' };
  }

  const err = await sendOtp(email);
  if (err) return { error: err };

  redirect(`/login/verify?${new URLSearchParams({ email, name, whatsapp, next: redirectTo }).toString()}`);
}

// Verify OTP — shared by login and register flows
export async function verifyOtpAction(prevState: any, formData: FormData) {
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const token = (formData.get('token') as string)?.trim();
  const name = (formData.get('name') as string)?.trim() || '';
  const whatsapp = (formData.get('whatsapp') as string)?.trim() || '';
  const next = (formData.get('next') as string) || '/';

  if (!email || !token || token.length !== 6) {
    return { error: 'Código inválido. Deve ter 6 dígitos.' };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) {
    console.error('OTP verify error:', error);
    return { error: 'Código inválido ou expirado. Solicite um novo.' };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Sessão inválida. Tente novamente.' };

  // Register flow: create/update profile
  if (name && whatsapp) {
    const { error: upsertError } = await supabase.from('profiles').upsert({
      id: user.id,
      name,
      whatsapp: normalizeWhatsApp(whatsapp),
    });
    if (upsertError) {
      console.error('Profile upsert error:', upsertError);
      return { error: 'Erro ao salvar perfil. Tente novamente.' };
    }
    redirect(next);
  }

  // Login flow: check if profile exists
  const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
  if (!profile) {
    // Auth user exists but no profile — send to register to complete
    redirect(`/register?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}&incomplete=true`);
  }

  redirect(next);
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) return null;

  return {
    id: user.id,
    email: user.email ?? '',
    name: profile.name,
    whatsapp: profile.whatsapp,
    created_at: profile.created_at,
  };
}

// Admin login remains unchanged
const adminSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
});

export async function loginAdminAction(prevState: any, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const valid = adminSchema.safeParse({ email, password });
  if (!valid.success) {
    return { error: 'Dados inválidos.' };
  }

  if (email !== process.env.User || password !== process.env.Password) {
    return { error: 'Credenciais inválidas.' };
  }

  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  cookieStore.set('admin_session', 'true', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24,
    path: '/',
  });

  redirect('/adminromanovskins');
}
