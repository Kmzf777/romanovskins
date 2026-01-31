import { getRaffles } from '@/server/raffle-actions';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

export const dynamic = 'force-dynamic';

export default async function Home() {
    const raffles = await getRaffles();

    return (
        <div className="container mx-auto p-4">
            <header className="mb-8 text-center">
                <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl text-primary">Romanov Rifas</h1>
                <p className="text-lg text-muted-foreground mt-2">Escolha sua skin favorita e boa sorte!</p>
            </header>

            {raffles.length === 0 ? (
                <div className="text-center py-20">
                    <p className="text-xl text-gray-500">Nenhuma rifa ativa no momento.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {raffles.map((raffle: any) => (
                        <Card key={raffle.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                            <div className="relative h-48 w-full bg-gray-100">
                                {/* Image Placeholder or Next/Image if configured domain */}
                                <img
                                    src={raffle.image_url}
                                    alt={raffle.title}
                                    className="object-cover w-full h-full"
                                />
                            </div>
                            <CardHeader>
                                <CardTitle>{raffle.title}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-2xl font-bold text-green-600">
                                    R$ {raffle.price_per_ticket.toFixed(2)} / cota
                                </p>
                                <p className="text-sm text-gray-500 mt-2">
                                    Total de cotas: {raffle.total_numbers}
                                </p>
                            </CardContent>
                            <CardFooter>
                                <Button asChild className="w-full">
                                    <Link href={`/rifa/${raffle.id}`}>Participar</Link>
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
