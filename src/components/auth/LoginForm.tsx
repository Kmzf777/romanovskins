'use client';
import { useActionState } from 'react';
import { loginAction } from '@/server/auth-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';

const initialState = {
    error: '',
};

export function LoginForm() {
    const [state, formAction, isPending] = useActionState(loginAction, initialState);

    return (
        <Card className="w-full max-w-sm mx-auto mt-10">
            <CardHeader>
                <CardTitle>Entrar</CardTitle>
                <CardDescription>Informe seu celular e nome para continuar.</CardDescription>
            </CardHeader>
            <form action={formAction}>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Nome Completo</Label>
                        <Input id="name" name="name" placeholder="Seu nome" required disabled={isPending} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="whatsapp">WhatsApp (com DDD)</Label>
                        <Input id="whatsapp" name="whatsapp" type="tel" placeholder="11999999999" required disabled={isPending} />
                    </div>
                    {state?.error && (
                        <p className="text-sm text-red-500 font-medium">{state.error}</p>
                    )}
                </CardContent>
                <CardFooter>
                    <Button type="submit" className="w-full" disabled={isPending}>
                        {isPending ? 'Entrando...' : 'Continuar'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
