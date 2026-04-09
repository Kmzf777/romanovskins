'use client';
import { useActionState } from 'react';
import { verifyOtpAction } from '@/server/auth-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShieldCheck } from 'lucide-react';

const initialState = { error: '' };

interface Props {
  email: string;
  name: string;
  whatsapp: string;
  next: string;
}

export function VerifyOtpForm({ email, name, whatsapp, next }: Props) {
  const [state, formAction, isPending] = useActionState(verifyOtpAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="whatsapp" value={whatsapp} />
      <input type="hidden" name="next" value={next} />

      <div className="space-y-1.5">
        <label
          htmlFor="token"
          className="block text-sm font-medium"
          style={{ color: '#7A7A8A' }}
        >
          Código de 6 dígitos
        </label>
        <Input
          id="token"
          name="token"
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="000000"
          required
          disabled={isPending}
          autoFocus
          className="h-14 text-center text-2xl tracking-[0.5em] font-mono rounded-xl border-[#2A2A32] bg-[#111114] text-[#F5C518] placeholder:text-[#4A4A5A] focus:border-[#F5C518] focus:ring-[#F5C518]/20"
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
        <ShieldCheck size={18} className="mr-2" />
        {isPending ? 'Verificando...' : 'Confirmar Código'}
      </Button>
    </form>
  );
}
