import { VerifyOtpForm } from '@/components/auth/VerifyOtpForm';
import { redirect } from 'next/navigation';

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; name?: string; whatsapp?: string; next?: string }>;
}) {
  const { email, name, whatsapp, next } = await searchParams;

  if (!email || !name || !whatsapp) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative z-10">
      <div
        className="w-full max-w-md p-8 rounded-2xl"
        style={{
          backgroundColor: 'rgba(17,17,20,0.95)',
          border: '1px solid #2A2A32',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div className="mb-8">
          <h1
            className="text-4xl font-black uppercase"
            style={{ fontFamily: 'var(--font-bebas-neue)', color: '#F0EAD6' }}
          >
            Verificar Email
          </h1>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: '#7A7A8A' }}>
            Enviamos um código de 6 dígitos para{' '}
            <span className="font-semibold" style={{ color: '#F0EAD6' }}>{email}</span>.
            Verifique sua caixa de entrada.
          </p>
        </div>
        <VerifyOtpForm
          email={email}
          name={name}
          whatsapp={whatsapp}
          next={next || '/'}
        />
        <p className="mt-6 text-center text-xs" style={{ color: '#4A4A5A' }}>
          Não recebeu?{' '}
          <a href="/login" className="underline" style={{ color: '#7A7A8A' }}>
            Solicitar novo código
          </a>
        </p>
      </div>
    </div>
  );
}
