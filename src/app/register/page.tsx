import { RegisterForm } from '@/components/auth/RegisterForm';

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; email?: string; incomplete?: string }>;
}) {
  const { next, email, incomplete } = await searchParams;

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
            Criar Conta
          </h1>
          {incomplete ? (
            <p className="mt-2 text-sm leading-relaxed px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20" style={{ color: '#F5C518' }}>
              Complete seu cadastro para continuar.
            </p>
          ) : (
            <p className="mt-1 text-sm" style={{ color: '#7A7A8A' }}>
              Crie sua conta para participar das rifas.
            </p>
          )}
        </div>
        <RegisterForm redirectTo={next} prefillEmail={email} />
      </div>
    </div>
  );
}
