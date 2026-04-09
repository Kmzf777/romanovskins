import { LoginForm } from '@/components/auth/LoginForm';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

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
            Entrar
          </h1>
          <p className="mt-1 text-sm" style={{ color: '#7A7A8A' }}>
            Insira seus dados para receber o código de acesso.
          </p>
        </div>
        <LoginForm redirectTo={next} />
      </div>
    </div>
  );
}
