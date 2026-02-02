# CODIGO DE ERRO: 500 / 404 - COMO CORRIGIR

Detectamos que o site está apresentando erro. Isso ocorre por dois motivos:

1.  **Falta de Configuração (.env.local)**
    O arquivo `.env.local` está com os valores padrão. O site precisa das chaves reais para conectar no banco de dados.
    **Ação Necessária**: Edite o arquivo `.env.local` e coloque suas chaves do Supabase e AbacatePay.

2.  **Cache Antigo (Erro ENOENT)**
    O terminal mostra que o servidor está procurando arquivos na pasta errada (`/app` em vez de `/src/app`).
    **Ação Necessária**:
    - Pare o servidor (Ctrl + C).
    - Delete a pasta `.next` (rode `rm -rf .next` ou apague manualmente).
    - Reinicie o servidor: `npm run dev`.

Após fazer isso, a atualização da página deve funcionar.
