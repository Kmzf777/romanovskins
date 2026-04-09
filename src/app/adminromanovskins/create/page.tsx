import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isAdminTokenValid } from '@/lib/admin-auth';
import { CreateRaffleForm } from '@/components/admin/CreateRaffleForm';

export default async function CreateRafflePage() {
    const cookieStore = await cookies();
    const adminToken = cookieStore.get('admin_session')?.value;

    if (!isAdminTokenValid(adminToken)) {
        redirect('/adminromanovskins');
    }

    return (
        <div className="container mx-auto p-4 relative z-10 text-white">
            <h2 className="text-2xl font-bold mb-4">Nova Rifa</h2>
            <CreateRaffleForm />
        </div>
    );
}
