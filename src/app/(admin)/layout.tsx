import { cookies } from 'next/headers';
import { isAdminTokenValid } from '@/lib/admin-auth';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const cookieStore = await cookies();
    const adminToken = cookieStore.get('admin_session')?.value;

    if (!isAdminTokenValid(adminToken)) {
        redirect('/adminromanovskins');
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
