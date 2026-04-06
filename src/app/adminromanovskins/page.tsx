import { cookies } from 'next/headers';
import { AdminLoginForm } from '@/components/admin/AdminLoginForm';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getAdminStats, getAllRafflesAdmin } from '@/server/raffle-actions';
import { AdminRaffleList } from '@/components/admin/AdminRaffleList';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
    const cookieStore = await cookies();
    const adminSession = cookieStore.get('admin_session')?.value;

    if (!adminSession) {
        return (
            <div className="flex min-h-screen items-center justify-center p-4 relative z-10">
                <AdminLoginForm />
            </div>
        );
    }

    const [stats, raffles] = await Promise.all([
        getAdminStats(),
        getAllRafflesAdmin(),
    ]);

    return (
        <div className="min-h-screen relative z-10 text-white">
            <header className="bg-white/10 backdrop-blur-md shadow p-4 mb-6 border-b border-white/10">
                <h1 className="text-xl font-bold">Painel Administrativo</h1>
            </header>
            <main className="container mx-auto p-4 space-y-8">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold">Dashboard</h2>
                    <Link href="/adminromanovskins/create">
                        <Button>Nova Rifa</Button>
                    </Link>
                </div>

                {/* Stats */}
                <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
                    {[
                        { label: 'Total de Rifas', value: stats.totalRaffles },
                        { label: 'Rifas Ativas', value: stats.activeRaffles },
                        { label: 'Cotas Vendidas', value: stats.soldTickets },
                        { label: 'Receita Total', value: `R$ ${stats.totalRevenue.toFixed(2)}` },
                        { label: 'Usuários', value: stats.totalUsers },
                    ].map(s => (
                        <div key={s.label} className="bg-white/5 p-4 rounded-lg border border-white/10">
                            <p className="text-xs text-zinc-400 uppercase tracking-wider">{s.label}</p>
                            <p className="text-2xl font-bold text-white mt-1">{s.value}</p>
                        </div>
                    ))}
                </div>

                {/* Raffle List */}
                <div>
                    <h3 className="text-xl font-semibold mb-4">Rifas</h3>
                    <AdminRaffleList raffles={raffles} />
                </div>
            </main>
        </div>
    );
}
