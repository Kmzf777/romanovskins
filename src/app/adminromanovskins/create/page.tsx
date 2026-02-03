import { CreateRaffleForm } from '@/components/admin/CreateRaffleForm';

export default function CreateRafflePage() {
    return (
        <div className="container mx-auto p-4 relative z-10 text-white">
            <h2 className="text-2xl font-bold mb-4">Nova Rifa</h2>
            <CreateRaffleForm />
        </div>
    );
}
