'use server';

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { generateAdminToken } from '@/lib/admin-auth';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  whatsapp: z.string().min(10, 'WhatsApp inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

function normalizeWhatsApp(raw: string): string {
  return raw.replace(/\D/g, '');
}

/** Aceita apenas paths internos para evitar open redirect */
function safeRedirectPath(redirectTo: string | null | undefined): string {
  if (!redirectTo || !redirectTo.startsWith('/')) return '/';
  // Bloqueia //evil.com (protocol-relative)
  if (redirectTo.startsWith('//')) return '/';
  return redirectTo;
}

// Login: email + password
export async function loginAction(prevState: any, formData: FormData) {
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;
  const redirectTo = safeRedirectPath(formData.get('redirectTo') as string);

  const valid = loginSchema.safeParse({ email, password });
  if (!valid.success) {
    return { error: valid.error.issues[0]?.message ?? 'Dados inválidos' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message.includes('Invalid login credentials') || error.message.includes('invalid_credentials')) {
      return { error: 'Email ou senha incorretos.' };
    }
    if (error.message.includes('Email not confirmed')) {
      return { error: 'Email não confirmado. Verifique sua caixa de entrada.' };
    }
    return { error: 'Erro ao entrar. Tente novamente.' };
  }

  if (!data.user) return { error: 'Erro ao entrar. Tente novamente.' };

  // Verifica se perfil existe na tabela users
  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('id', data.user.id)
    .maybeSingle();

  if (!profile) {
    redirect(`/register?email=${encodeURIComponent(email)}&next=${encodeURIComponent(redirectTo)}&incomplete=true`);
  }

  redirect(redirectTo);
}

// Register: name + email + whatsapp + password
export async function registerAction(prevState: any, formData: FormData) {
  const name = (formData.get('name') as string)?.trim();
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const whatsapp = normalizeWhatsApp(formData.get('whatsapp') as string);
  const password = formData.get('password') as string;
  const redirectTo = safeRedirectPath(formData.get('redirectTo') as string);

  const valid = registerSchema.safeParse({ name, email, whatsapp, password });
  if (!valid.success) {
    return { error: valid.error.issues[0]?.message ?? 'Dados inválidos' };
  }

  const supabase = await createClient();
  const adminClient = createAdminClient();

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    if (error.message.includes('already registered') || error.message.includes('User already registered')) {
      return { error: 'Este email já está cadastrado. Faça login.' };
    }
    return { error: 'Erro ao criar conta. Tente novamente.' };
  }

  if (!data.user) {
    return { error: 'Erro ao criar conta. Tente novamente.' };
  }

  // Usa admin client para criar o perfil — ignora RLS (sessão ainda não está no cookie)
  const { error: profileError } = await adminClient.from('users').upsert({
    id: data.user.id,
    name,
    whatsapp,
  });

  if (profileError) {
    console.error('Profile upsert error:', profileError);
    await adminClient.auth.admin.deleteUser(data.user.id);
    return { error: 'Erro ao salvar perfil. Tente novamente.' };
  }

  redirect(redirectTo);
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
    .from('users')
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

// Admin login com cookie HMAC assinado
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

  const crypto = await import('crypto');
  const adminEmail = process.env.ADMIN_EMAIL ?? '';
  const adminPassword = process.env.ADMIN_PASSWORD ?? '';
  const emailMatch = email.length === adminEmail.length &&
    crypto.timingSafeEqual(Buffer.from(email), Buffer.from(adminEmail));
  const passwordMatch = password.length === adminPassword.length &&
    crypto.timingSafeEqual(Buffer.from(password), Buffer.from(adminPassword));
  if (!emailMatch || !passwordMatch) {
    return { error: 'Credenciais inválidas.' };
  }

  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();

  cookieStore.set('admin_session', generateAdminToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24,
    path: '/',
  });

  redirect('/adminromanovskins');
}

export async function verifyOtpAction(prevState: any, formData: FormData) {
  return { error: 'Método não suportado.' };
}
