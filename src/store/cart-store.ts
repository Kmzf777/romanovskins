import { create } from 'zustand';

interface CartState {
    selectedNumbers: number[];
    raffleId: string | null;
    toggleNumber: (number: number) => void;
    clearCart: () => void;
    setRaffleId: (id: string) => void;
}

export const useCartStore = create<CartState>((set) => ({
    selectedNumbers: [],
    raffleId: null,
    toggleNumber: (number) => set((state) => {
        if (state.selectedNumbers.includes(number)) {
            return { selectedNumbers: state.selectedNumbers.filter((n) => n !== number) };
        }
        return { selectedNumbers: [...state.selectedNumbers, number] };
    }),
    clearCart: () => set({ selectedNumbers: [], raffleId: null }),
    setRaffleId: (id) => set((state) => {
        if (state.raffleId !== id) {
            return { raffleId: id, selectedNumbers: [] };
        }
        return {};
    }),
}));
