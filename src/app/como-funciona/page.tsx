import type { Metadata } from 'next';
import Link from 'next/link';
import { HowItWorksSection } from '@/components/ui/how-it-works-section';
import { ShieldCheck, Scale, Zap, ChevronDown, ChevronUp } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Como Funciona',
  description: 'Entenda como funcionam as rifas Romanov: compre cotas, aguarde o sorteio pela Loteria Federal e receba sua skin CS2 imediatamente.',
  openGraph: {
    title: 'Como Funciona | Romanov Rifas',
    description: 'Processo 100% transparente: sorteio pela Loteria Federal, pagamento via PIX e entrega garantida da skin.',
    type: 'website',
  },
};

const faqs = [
    {
        q: 'Como funciona o sorteio?',
        a: 'O sorteio é realizado com base no resultado da Loteria Federal Brasileira. Calculamos o número vencedor usando o primeiro prêmio do concurso mais recente modulo o total de cotas da rifa. O resultado é 100% verificável por qualquer pessoa no site da Caixa Econômica Federal.',
    },
    {
        q: 'Como recebo a skin se ganhar?',
        a: 'Após o sorteio, nossa equipe entrará em contato pelo WhatsApp cadastrado. Você deve ter o Steam com inventário aberto para receber a skin por trade. A entrega é realizada em até 24 horas após o contato.',
    },
    {
        q: 'O pagamento é seguro?',
        a: 'Sim. Utilizamos PIX através de plataformas de pagamento certificadas. Seus dados financeiros nunca são armazenados em nossos servidores.',
    },
    {
        q: 'Posso comprar mais de uma cota?',
        a: 'Sim! Você pode comprar quantas cotas quiser em uma única rifa, aumentando suas chances de ganhar. Cada cota é um número único no sorteio.',
    },
    {
        q: 'O que acontece se eu não for sorteado?',
        a: 'As cotas adquiridas ficam registradas e você pode acompanhar o resultado pelo nosso site. Se não ganhar, fique de olho nas próximas rifas — sempre há novas skins disponíveis!',
    },
];

export default function ComoFuncionaPage() {
    return (
        <div className="relative z-10 pb-24">
            {/* Hero */}
            <section className="max-w-4xl mx-auto px-6 md:px-10 py-20 text-center">
                <h1
                    className="mb-4"
                    style={{
                        fontFamily: 'var(--font-bebas-neue)',
                        fontSize: 'clamp(52px, 8vw, 88px)',
                        color: '#F0EAD6',
                        lineHeight: 0.95,
                    }}
                >
                    COMO<br />
                    <span style={{ color: '#F5C518' }}>FUNCIONA</span>
                </h1>
                <p className="text-base md:text-lg max-w-xl mx-auto" style={{ color: '#7A7A8A' }}>
                    Entenda como as rifas funcionam, como o sorteio é realizado e como você recebe sua skin.
                </p>
            </section>

            {/* 3 Steps */}
            <HowItWorksSection />

            {/* Transparency Section */}
            <section className="max-w-4xl mx-auto px-6 md:px-10 py-20">
                <h2
                    className="mb-12 text-center"
                    style={{ fontFamily: 'var(--font-bebas-neue)', fontSize: '48px', color: '#F0EAD6' }}
                >
                    TRANSPARÊNCIA TOTAL
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        {
                            icon: ShieldCheck,
                            title: 'Loteria Federal',
                            desc: 'O número vencedor é derivado do primeiro prêmio do sorteio oficial da Caixa Econômica Federal. Verificável por qualquer pessoa.',
                        },
                        {
                            icon: Scale,
                            title: 'Imparcial',
                            desc: 'Nós não controlamos o resultado da Loteria Federal. O sorteio é feito por um órgão governamental independente.',
                        },
                        {
                            icon: Zap,
                            title: 'Instantâneo',
                            desc: 'Assim que o resultado da Loteria é publicado, calculamos e divulgamos o ganhador na mesma hora. Sem atrasos.',
                        },
                    ].map(item => {
                        const Icon = item.icon;
                        return (
                            <div
                                key={item.title}
                                className="p-6 rounded-2xl space-y-4"
                                style={{ backgroundColor: '#111114', border: '1px solid #2A2A32' }}
                            >
                                <div
                                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                                    style={{ backgroundColor: 'rgba(245,197,24,0.1)', border: '1px solid rgba(245,197,24,0.2)' }}
                                >
                                    <Icon size={22} style={{ color: '#F5C518' }} />
                                </div>
                                <h3 className="font-bold text-lg" style={{ color: '#F0EAD6' }}>{item.title}</h3>
                                <p className="text-sm leading-relaxed" style={{ color: '#7A7A8A' }}>{item.desc}</p>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* FAQ */}
            <section className="max-w-2xl mx-auto px-6 md:px-10 pb-20">
                <h2
                    className="mb-10 text-center"
                    style={{ fontFamily: 'var(--font-bebas-neue)', fontSize: '48px', color: '#F0EAD6' }}
                >
                    PERGUNTAS FREQUENTES
                </h2>
                <div className="space-y-3">
                    {faqs.map((faq, i) => (
                        <details
                            key={i}
                            className="group rounded-xl overflow-hidden"
                            style={{ backgroundColor: '#111114', border: '1px solid #2A2A32' }}
                        >
                            <summary
                                className="flex items-center justify-between px-6 py-4 cursor-pointer list-none font-bold"
                                style={{ color: '#F0EAD6' }}
                            >
                                {faq.q}
                                <ChevronDown
                                    size={16}
                                    className="group-open:hidden shrink-0 ml-4"
                                    style={{ color: '#7A7A8A' }}
                                />
                                <ChevronUp
                                    size={16}
                                    className="hidden group-open:block shrink-0 ml-4"
                                    style={{ color: '#F5C518' }}
                                />
                            </summary>
                            <div className="px-6 pb-5">
                                <p className="text-sm leading-relaxed" style={{ color: '#7A7A8A' }}>{faq.a}</p>
                            </div>
                        </details>
                    ))}
                </div>
            </section>

            {/* CTA */}
            <div className="text-center pb-10">
                <h3
                    className="mb-4"
                    style={{ fontFamily: 'var(--font-bebas-neue)', fontSize: '36px', color: '#F0EAD6' }}
                >
                    PRONTO PARA PARTICIPAR?
                </h3>
                <Link
                    href="/#rifas"
                    className="inline-block px-10 py-4 rounded-xl font-black uppercase tracking-widest text-base transition-all hover:scale-105"
                    style={{ backgroundColor: '#F5C518', color: '#0A0A0B', boxShadow: '0 0 30px rgba(245,197,24,0.25)' }}
                >
                    Ver Rifas Ativas →
                </Link>
            </div>
        </div>
    );
}
