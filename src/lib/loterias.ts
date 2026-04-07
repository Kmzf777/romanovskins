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
            throw new Error('Formato inesperado da API primária — sem campo de prêmio');
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

/**
 * Calculates the UTC datetime of the next Loteria Federal draw.
 * Draws happen every Wednesday (3) and Saturday (6) at 20:00 BRT (UTC-3).
 */
function getNextLotoFederalDrawDate(): Date {
    const now = new Date();
    // Shift to BRT (UTC-3) for day-of-week and hour comparison
    const nowBRT = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const dayBRT = nowBRT.getUTCDay(); // 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
    const hourBRT = nowBRT.getUTCHours();

    const DRAW_DAYS = [3, 6]; // Wed, Sat
    let minDays = 7;

    for (const d of DRAW_DAYS) {
        let diff = (d - dayBRT + 7) % 7;
        // If today is a draw day but 20:00 BRT already passed, push to next week
        if (diff === 0 && hourBRT >= 20) diff = 7;
        if (diff < minDays) minDays = diff;
    }

    // Build draw time in BRT: target day at 20:00:00
    const drawBRT = new Date(nowBRT);
    drawBRT.setUTCDate(nowBRT.getUTCDate() + minDays);
    drawBRT.setUTCHours(20, 0, 0, 0);

    // Convert BRT back to UTC (+3h)
    return new Date(drawBRT.getTime() + 3 * 60 * 60 * 1000);
}

/**
 * Returns the next concurso number (current + 1) and the datetime of its draw.
 * Used when opening a draw room to commit to a future result.
 */
export async function getNextLotoFederalInfo(): Promise<{
    currentConcurso: number;
    nextConcurso: number;
    drawAt: Date;
}> {
    const latest = await getLatestLotoFederal();
    return {
        currentConcurso: latest.concurso,
        nextConcurso: latest.concurso + 1,
        drawAt: getNextLotoFederalDrawDate(),
    };
}

/**
 * Fetches a specific Loteria Federal concurso by number.
 * Throws 'CONCURSO_NOT_AVAILABLE' if the result hasn't been published yet.
 */
export async function getLotoFederalByConcurso(concurso: number): Promise<LotoFederalResult> {
    // Attempt 1: guidi community API
    try {
        const res = await fetch(`https://api.guidi.dev.br/loteria/federal/${concurso}`, {
            next: { revalidate: 0 },
            signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
            const data = await res.json();
            const primeiroPremio =
                data.premios?.[0]?.numero ??
                data.listaDezenas?.[0] ??
                data.listaPremios?.[0]?.numeroCerteSorte;
            if (primeiroPremio) {
                return {
                    concurso: data.concurso ?? data.numero ?? concurso,
                    dataApuracao: data.data ?? data.dataApuracao ?? '',
                    primeiroPremio: String(primeiroPremio).trim(),
                };
            }
        }
        if (res.status === 404) throw new Error('CONCURSO_NOT_AVAILABLE');
    } catch (err) {
        if (String(err).includes('CONCURSO_NOT_AVAILABLE')) throw err;
        // fallback to Caixa
    }

    // Attempt 2: Caixa direct API
    const res2 = await fetch(
        `https://servicebus2.caixa.gov.br/portaldeloterias/api/federal/${concurso}`,
        {
            next: { revalidate: 0 },
            headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
            signal: AbortSignal.timeout(8000),
        }
    );

    if (res2.status === 404 || res2.status === 204) {
        throw new Error('CONCURSO_NOT_AVAILABLE');
    }
    if (!res2.ok) {
        throw new Error(`Loteria Federal API error: ${res2.status}`);
    }

    const data2 = await res2.json();
    const primeiroPremio =
        data2.listaDezenas?.[0] ??
        data2.listaPremios?.[0]?.numeroCerteSorte ??
        data2.premios?.[0]?.numero;

    if (!primeiroPremio) throw new Error('CONCURSO_NOT_AVAILABLE');

    return {
        concurso: data2.numero ?? concurso,
        dataApuracao: data2.dataApuracao ?? '',
        primeiroPremio: String(primeiroPremio).trim(),
    };
}
