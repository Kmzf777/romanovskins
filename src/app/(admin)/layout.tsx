import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createClient();
    const cookieStore = await cookies();
    const userId = cookieStore.get('romanov_user')?.value;

    if (!userId) {
        redirect('/login');
    }

    const { data: user } = await supabase.from('users').select('whatsapp').eq('id', userId).single();

    if (!user || user.whatsapp !== process.env.ADMIN_WHATSAPP) {
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
