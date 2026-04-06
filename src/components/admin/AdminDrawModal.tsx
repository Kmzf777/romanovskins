'use client';

// Full implementation coming in Task 11
export function AdminDrawModal({ raffleId, raffleTitle }: { raffleId: string; raffleTitle: string }) {
    return (
        <button className="text-xs h-7 px-3 rounded border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10">
            Sortear
        </button>
    );
}
