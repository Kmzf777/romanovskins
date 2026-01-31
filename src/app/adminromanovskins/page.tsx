import { cookies } from 'next/headers';
import { AdminLoginForm } from '@/components/admin/AdminLoginForm';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function AdminPage() {
    const cookieStore = await cookies();
    const adminSession = cookieStore.get('admin_session')?.value;

    // State 1: Not logged in -> Show Admin Login Form
    if (!adminSession) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
                <AdminLoginForm />
            </div>
        );
    }

    // State 2: Admin Logged In - Show Dashboard
    return (
        <div className="min-h-screen bg-gray-100">
            <header className="bg-white shadow p-4 mb-6">
                <h1 className="text-xl font-bold">Painel Administrativo</h1>
            </header>
            <main className="container mx-auto p-4">
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-bold">Dashboard</h2>
                        <Link href="/adminromanovskins/create">
                            <Button>Nova Rifa</Button>
                        </Link>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {/* Placeholder for future stats */}
                        <div className="bg-white p-6 rounded-lg shadow">
                            <h3 className="text-lg font-medium text-gray-900">Total de Rifas</h3>
                            <p className="text-3xl font-bold text-gray-600 mt-2">--</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
