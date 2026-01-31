'use server';

import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const formSchema = z.object({
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
    whatsapp: z.string().min(10, 'WhatsApp inválido'),
});

export async function loginAction(prevState: any, formData: FormData) {
    const name = formData.get('name') as string;
    const whatsapp = formData.get('whatsapp') as string;

    const valid = formSchema.safeParse({ name, whatsapp });
    if (!valid.success) {
        return { error: 'Dados inválidos. Verifique o nome e WhatsApp.' };
    }

    const supabase = await createClient();

    // Check if user exists
    let { data: user, error } = await supabase
        .from('users')
        .select('id')
        .eq('whatsapp', whatsapp)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('Login query error:', error);
        return { error: 'Erro ao buscar usuário' };
    }

    if (!user) {
        // Create user
        const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert({ name, whatsapp })
            .select('id')
            .single();

        if (createError || !newUser) {
            console.error('User creation error:', createError);
            return { error: 'Erro ao cadastrar usuário' };
        }
        user = newUser;
    }

    // Set Cookie
    const cookieStore = await cookies();
    cookieStore.set('romanov_user', user.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
    });

    const redirectTo = (formData.get('redirectTo') as string) || '/';
    redirect(redirectTo);
}

export async function logoutAction() {
    const cookieStore = await cookies();
    cookieStore.delete('romanov_user');
    redirect('/login');
}

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

    // Set Admin Cookie
    const cookieStore = await cookies();
    cookieStore.set('admin_session', 'true', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24, // 1 day
        path: '/',
    });

    redirect('/adminromanovskins');
}

