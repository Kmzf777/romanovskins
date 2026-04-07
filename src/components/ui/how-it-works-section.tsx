import { ShoppingCart, Zap, Trophy } from 'lucide-react';

const steps = [
    {
        number: '01',
        icon: ShoppingCart,
        title: 'ESCOLHA',
        description: 'Selecione a skin que quer ganhar. Compre 1 ou mais cotas pelo valor que achar certo.',
    },
    {
        number: '02',
        icon: Zap,
        title: 'PAGUE',
        description: 'Pagamento via PIX instantâneo. Confirmação em segundos, sem burocracia.',
    },
    {
        number: '03',
        icon: Trophy,
        title: 'TORÇA',
        description: 'Sorteio ao vivo pela Loteria Federal Brasileira. Resultado transparente e verificável.',
    },
];

export function HowItWorksSection() {
    return (
        <section className="relative z-10 py-24" style={{ backgroundColor: 'rgba(10,10,11,0.6)' }}>
            <div className="max-w-6xl mx-auto px-6 md:px-10">
                {/* Header */}
                <div className="text-center mb-16">
                    <h2
                        className="mb-3"
                        style={{
                            fontFamily: 'var(--font-bebas-neue)',
                            fontSize: 'clamp(40px, 5vw, 64px)',
                            color: '#F0EAD6',
                        }}
                    >
                        COMO FUNCIONA
                    </h2>
                    <p className="text-base" style={{ color: '#7A7A8A' }}>
                        Em 3 passos simples, você concorre a skins raras
                    </p>
                </div>

                {/* Steps */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
                    {/* Connector line (desktop) */}
                    <div
                        className="hidden md:block absolute top-10 left-1/6 right-1/6 h-px"
                        style={{
                            background: 'linear-gradient(to right, transparent, rgba(245,197,24,0.2), rgba(245,197,24,0.2), transparent)',
                        }}
                    />

                    {steps.map((step) => {
                        const Icon = step.icon;
                        return (
                            <div key={step.number} className="relative text-center space-y-5">
                                {/* Step number (decorative) */}
                                <div
                                    className="absolute -top-4 left-1/2 -translate-x-1/2 select-none pointer-events-none"
                                    style={{
                                        fontFamily: 'var(--font-bebas-neue)',
                                        fontSize: '100px',
                                        lineHeight: 1,
                                        color: 'rgba(245,197,24,0.06)',
                                        zIndex: 0,
                                    }}
                                >
                                    {step.number}
                                </div>

                                {/* Icon circle */}
                                <div className="relative z-10 flex justify-center">
                                    <div
                                        className="w-16 h-16 rounded-2xl flex items-center justify-center"
                                        style={{
                                            backgroundColor: 'rgba(245,197,24,0.08)',
                                            border: '1px solid rgba(245,197,24,0.2)',
                                        }}
                                    >
                                        <Icon size={28} style={{ color: '#F5C518' }} />
                                    </div>
                                </div>

                                {/* Text */}
                                <div className="relative z-10 space-y-2">
                                    <h3
                                        className="text-xl tracking-wider"
                                        style={{ fontFamily: 'var(--font-bebas-neue)', color: '#F0EAD6' }}
                                    >
                                        {step.title}
                                    </h3>
                                    <p className="text-sm leading-relaxed" style={{ color: '#7A7A8A' }}>
                                        {step.description}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
