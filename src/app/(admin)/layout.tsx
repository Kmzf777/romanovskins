import { getCurrentUser } from '@/server/auth-actions';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const user = await getCurrentUser();

    if (!user) {
        redirect('/login');
    }

    if (user.whatsapp !== process.env.ADMIN_WHATSAPP) {
        redirect('/'); // Not admin
    }

    return (
        <div className="min-h-screen bg-gray-100">
            <header className="bg-white shadow p-4 mb-6">
                <h1 className="text-xl font-bold">Painel Administrativo</h1>
            </header>
            <main className="container mx-auto p-4">
                {children}
            </main>
        </div>
    );
}
