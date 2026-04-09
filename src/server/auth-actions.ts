'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const loginSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  whatsapp: z.string().min(10, 'WhatsApp inválido'),
});

// Normalize WhatsApp: keep only digits
function normalizeWhatsApp(raw: string): string {
  return raw.replace(/\D/g, '');
}

// Step 1: Send OTP to email
export async function loginAction(prevState: any, formData: FormData) {
  const name = (formData.get('name') as string)?.trim();
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const whatsapp = normalizeWhatsApp(formData.get('whatsapp') as string);
  const redirectTo = (formData.get('redirectTo') as string) || '/';

  const valid = loginSchema.safeParse({ name, email, whatsapp });
  if (!valid.success) {
    return { error: valid.error.errors[0].message };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
    },
  });

  if (error) {
    console.error('OTP send error:', error);
    return { error: 'Erro ao enviar código. Tente novamente.' };
  }

  // Store pending profile data in search params for verify step
  const params = new URLSearchParams({
    email,
    name,
    whatsapp,
    next: redirectTo,
  });

  redirect(`/login/verify?${params.toString()}`);
}

// Step 2: Verify OTP and create/update profile
export async function verifyOtpAction(prevState: any, formData: FormData) {
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const token = (formData.get('token') as string)?.trim();
  const name = (formData.get('name') as string)?.trim();
  const whatsapp = (formData.get('whatsapp') as string)?.trim();
  const next = (formData.get('next') as string) || '/';

  if (!email || !token || token.length !== 6) {
    return { error: 'Código inválido. Deve ter 6 dígitos.' };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });

  if (error) {
    console.error('OTP verify error:', error);
    return { error: 'Código inválido ou expirado. Solicite um novo.' };
  }

  // Upsert profile (create or update name/whatsapp)
  const { data: { user } } = await supabase.auth.getUser();
  if (user && name && whatsapp) {
    await supabase.from('profiles').upsert({
      id: user.id,
      name,
      whatsapp,
    });
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
