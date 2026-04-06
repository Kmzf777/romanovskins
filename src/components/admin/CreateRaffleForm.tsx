'use client';
import { useActionState } from 'react';
import { createRaffleAction } from '@/server/raffle-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';

const initialState = { error: '' };

const WEAR_CONDITIONS = [
    'Factory New',
    'Minimal Wear',
    'Field-Tested',
    'Well-Worn',
    'Battle-Scarred',
];

export function CreateRaffleForm() {
    const [state, formAction, isPending] = useActionState(createRaffleAction, initialState);

    return (
        <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle>Criar Nova Rifa</CardTitle>
            </CardHeader>
            <form action={formAction}>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Título</Label>
                        <Input id="title" name="title" required placeholder="Ex: AK-47 Redline" disabled={isPending} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Descrição</Label>
                        <Textarea id="description" name="description" placeholder="Detalhes da skin..." disabled={isPending} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="image_url">URL da Imagem</Label>
                        <Input id="image_url" name="image_url" type="url" required placeholder="https://..." disabled={isPending} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="price_per_ticket">Preço por Cota (R$)</Label>
                            <Input id="price_per_ticket" name="price_per_ticket" type="number" step="0.01" min="0.01" required placeholder="0.50" disabled={isPending} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="total_numbers">Total de Números</Label>
                            <Input id="total_numbers" name="total_numbers" type="number" min="1" max="100000" required placeholder="100" disabled={isPending} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="float_value">Float (opcional)</Label>
                            <Input id="float_value" name="float_value" placeholder="Ex: 0.0123456789" disabled={isPending} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="wear_condition">Condição (opcional)</Label>
                            <select
                                id="wear_condition"
                                name="wear_condition"
                                disabled={isPending}
                                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <option value="">Selecione...</option>
                                {WEAR_CONDITIONS.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    {state?.error && (
                        <p className="text-sm text-red-500 font-medium">{state.error}</p>
                    )}
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={isPending}>
                        {isPending ? 'Criando...' : 'Criar Rifa'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
