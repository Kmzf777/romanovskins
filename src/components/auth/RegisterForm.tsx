'use client';
import { useActionState } from 'react';
import { registerAction } from '@/server/auth-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Phone, User } from 'lucide-react';
import Link from 'next/link';

const initialState = { error: '' };

interface Props {
  redirectTo?: string;
  prefillEmail?: string;
}

export function RegisterForm({ redirectTo, prefillEmail }: Props) {
  const [state, formAction, isPending] = useActionState(registerAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="redirectTo" value={redirectTo || '/'} />

      <div className="space-y-1.5">
        <Label htmlFor="name" className="text-sm font-medium" style={{ color: '#7A7A8A' }}>
          <User size={14} className="inline mr-1.5" />Nome Completo
        </Label>
        <Input
          id="name"
          name="name"
          placeholder="Seu nome completo"
          required
          disabled={isPending}
          className="h-12 rounded-xl border-[#2A2A32] bg-[#111114] text-[#F0EAD6] placeholder:text-[#4A4A5A] focus:border-[#F5C518] focus:ring-[#F5C518]/20"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-sm font-medium" style={{ color: '#7A7A8A' }}>
          <Mail size={14} className="inline mr-1.5" />Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="seu@email.com"
          defaultValue={prefillEmail || ''}
          required
          disabled={isPending}
          className="h-12 rounded-xl border-[#2A2A32] bg-[#111114] text-[#F0EAD6] placeholder:text-[#4A4A5A] focus:border-[#F5C518] focus:ring-[#F5C518]/20"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="whatsapp" className="text-sm font-medium" style={{ color: '#7A7A8A' }}>
          <Phone size={14} className="inline mr-1.5" />WhatsApp (com DDD)
        </Label>
        <Input
          id="whatsapp"
          name="whatsapp"
          type="tel"
          placeholder="11999999999"
          required
          disabled={isPending}
          className="h-12 rounded-xl border-[#2A2A32] bg-[#111114] text-[#F0EAD6] placeholder:text-[#4A4A5A] focus:border-[#F5C518] focus:ring-[#F5C518]/20"
        />
      </div>

      {state?.error && (
        <p className="text-sm font-medium px-3 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
          {state.error}
        </p>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className="w-full h-12 text-base font-black uppercase tracking-wider rounded-xl transition-all"
        style={{
          backgroundColor: isPending ? '#2A2A32' : '#F5C518',
          color: isPending ? '#7A7A8A' : '#0A0A0B',
        }}
      >
        {isPending ? 'Enviando código...' : 'Criar Conta'}
      </Button>

      <p className="text-center text-sm" style={{ color: '#4A4A5A' }}>
        Já tem conta?{' '}
        <Link
          href={`/login${redirectTo ? `?next=${encodeURIComponent(redirectTo)}` : ''}`}
          className="underline"
          style={{ color: '#7A7A8A' }}
        >
          Entrar
        </Link>
      </p>
    </form>
  );
}
