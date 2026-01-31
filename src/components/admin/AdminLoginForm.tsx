'use client';
import { useActionState } from 'react';
import { loginAdminAction } from '@/server/auth-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';

const initialState = {
    error: '',
};

export function AdminLoginForm() {
    // @ts-ignore
    const [state, formAction, isPending] = useActionState(loginAdminAction, initialState);

    return (
        <Card className="w-full max-w-sm mx-auto mt-10">
            <CardHeader>
                <CardTitle>Acesso Administrativo</CardTitle>
                <CardDescription>Entre com suas credenciais de administrador.</CardDescription>
            </CardHeader>
            <form action={formAction}>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" name="email" type="email" placeholder="admin@exemplo.com" required disabled={isPending} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Senha</Label>
                        <Input id="password" name="password" type="password" required disabled={isPending} />
                    </div>
                    {state?.error && (
                        <p className="text-sm text-red-500 font-medium">{state.error}</p>
                    )}
                </CardContent>
                <CardFooter>
                    <Button type="submit" className="w-full" disabled={isPending}>
                        {isPending ? 'Entrando...' : 'Entrar'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
