export interface LotoFederalResult {
    concurso: number;
    dataApuracao: string;
    primeiroPremio: string; // Número do bilhete vencedor (ex: "097680")
}

export async function getLatestLotoFederal(): Promise<LotoFederalResult> {
    // Tentativa 1: API comunitária com resposta previsível
    try {
        const res = await fetch('https://api.guidi.dev.br/loteria/federal/ultimo', {
            next: { revalidate: 0 },
            signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
            const data = await res.json();
            // Estrutura: { concurso, data, premios: [{ numero, valor }] }
            const primeiroPremio = data.premios?.[0]?.numero
                ?? data.listaDezenas?.[0]
                ?? data.listaPremios?.[0]?.numeroCerteSorte;
            if (primeiroPremio) {
                return {
                    concurso: data.concurso ?? data.numero ?? 0,
                    dataApuracao: data.data ?? data.dataApuracao ?? '',
                    primeiroPremio: String(primeiroPremio).trim(),
                };
            }
        }
    } catch {
        // Fallback para API direta da Caixa
    }

    // Tentativa 2: API direta da Caixa
    const res2 = await fetch('https://servicebus2.caixa.gov.br/portaldeloterias/api/federal/', {
        next: { revalidate: 0 },
        headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' },
        signal: AbortSignal.timeout(8000),
    });

    if (!res2.ok) {
        throw new Error(`Loteria Federal API error: ${res2.status}`);
    }

    const data2 = await res2.json();

    const primeiroPremio = data2.listaDezenas?.[0]
        ?? data2.listaPremios?.[0]?.numeroCerteSorte
        ?? data2.premios?.[0]?.numero;

    if (!primeiroPremio) {
        throw new Error('Não foi possível obter o 1º prêmio da Loteria Federal. Verifique o site da Caixa.');
    }

    return {
        concurso: data2.numero ?? 0,
        dataApuracao: data2.dataApuracao ?? '',
        primeiroPremio: String(primeiroPremio).trim(),
    };
}

/**
 * Calcula o número vencedor da rifa com base no bilhete da Loteria Federal.
 * Usa os 2 últimos dígitos do 1º prêmio.
 *
 * Exemplo: 1º prêmio "097680", total_numbers=100
 * ultimos2 = 80
 * winner = (80 % 100) + 1 = 81
 */
export function calcularNumeroVencedor(primeiroPremio: string, totalNumbers: number): number {
    const digits = primeiroPremio.replace(/\D/g, '');
    const lastTwo = parseInt(digits.slice(-2), 10);
    return (lastTwo % totalNumbers) + 1;
}
