# 🔧 ANÁLISE DE INTEGRAÇÃO ABACATEPAY - MODO DESENVOLVIMENTO

## 🎯 OBJETIVO
Analisar minha integração com a API da AbacatePay em um site de rifas e identificar por que os pagamentos não estão funcionando corretamente no **DEV MODE** (ambiente de testes).

---

## 📚 DOCUMENTAÇÃO OFICIAL DA ABACATEPAY (Referência)

### 1. AUTENTICAÇÃO
- **Endpoint base**: `https://api.abacatepay.com/v1/`
- **Header obrigatório**: `Authorization: Bearer <abacatepay-api-key>`
- **Content-Type**: `application/json`
- As chaves de API são específicas por ambiente (dev mode vs produção)
- Erro 401 quando: chave não fornecida, chave inválida, ou chave revogada

### 2. DEV MODE - AMBIENTE DE TESTES
- Todas as operações são **SIMULADAS**
- Nenhuma transação real é processada
- Dados isolados do ambiente de produção
- **Importante**: Use a chave de API gerada no dashboard em modo desenvolvimento

### 3. FLUXO CORRETO DE PAGAMENTO (Dev Mode)

#### Passo 1: Criar Cliente (se não existir)
POST /customer/create
{
"name": "Nome do Cliente",
"cellphone": "(11) 99999-9999",
"email": "cliente@email.com",
"taxId": "123.456.789-00"
}
Copy
Retorna: `customer.id` (ex: `cust_abcdefghij`)

#### Passo 2: Criar Cobrança (Billing)
POST /billing/create
{
"frequency": "ONE_TIME",           // ou "MULTIPLE_PAYMENTS"
"methods": ["PIX"],                // obrigatório, mínimo 1 método
"products": [
{
"externalId": "rifa-001",      // seu ID interno
"name": "Número da Rifa #123",
"description": "Rifa - 5 números",
"quantity": 1,
"price": 5000                    // valor em CENTAVOS (R$ 50,00)
}
],
"returnUrl": "https://seusite.com/rifas",           // obrigatório
"completionUrl": "https://seusite.com/sucesso",     // obrigatório
"customerId": "cust_abcdefghij",   // opcional se passar objeto customer
"customer": {                      // opcional se passar customerId
"name": "Nome do Cliente",
"cellphone": "(11) 99999-9999",
"email": "cliente@email.com",
"taxId": "123.456.789-00"
},
"externalId": "pedido-123",        // seu ID de pedido (opcional)
"metadata": {}                     // dados extras (opcional)
}
Copy
Retorna:
```json
{
  "data": {
    "id": "bill_xxxxxx",
    "url": "https://pay.abacatepay.com/bill-xxxx",
    "status": "PENDING",
    "devMode": true,
    "amount": 5000
  },
  "error": null
}
Passo 3: Criar QR Code PIX
Copy
POST /pixQrCode/create?id={billing_id}
Body: { "metadata": {} }
Retorna:
JSON
Copy
{
  "data": {
    "id": "pix_xxxxxx",
    "brCode": "000201010212...",
    "brCodeBase64": "data:image/png;base64,...",
    "status": "PENDING",
    "amount": 5000,
    "expiresAt": "2025-03-25T21:50:20.772Z"
  },
  "error": null
}
Passo 4: Simular Pagamento (APENAS DEV MODE)
Copy
POST /pixQrCode/simulate-payment?id={pix_qrcode_id}
Body: { "metadata": {} }
Este passo é ESSENCIAL no dev mode - sem simular, o pagamento nunca muda de status!
Passo 5: Verificar Status
GET /pixQrCode/check?id={pix_qrcode_id}
4. WEBHOOKS (Notificações)
URL deve ser HTTPS
Secret é passado como query param: ?webhookSecret=seu_secret
Evento principal: billing.paid
Payload do webhook:
JSON
Copy
{
  "event": "billing.paid",
  "data": {
    "billingId": "bill_xxxxxx",
    "status": "PAID",
    "amount": 5000,
    "customer": {...}
  }
}
🔍 CHECKLIST DE VERIFICAÇÃO
Compare minha implementação com os pontos abaixo:
✅ Configuração
[ ] Estou usando a chave de API do DEV MODE (não de produção)?
[ ] A chave está sendo enviada no header Authorization: Bearer <token>?
[ ] O Content-Type está como application/json?
✅ Criação da Cobrança
[ ] O campo methods contém ["PIX"] (array com pelo menos 1 método)?
[ ] O campo products é um array com pelo menos 1 produto?
[ ] O preço está em CENTAVOS (ex: R$ 50,00 = 5000)?
[ ] Os campos returnUrl e completionUrl estão preenchidos e são URLs válidas?
[ ] Estou enviando customerId OU objeto customer (pelo menos um)?
✅ Fluxo de Pagamento no Dev Mode
[ ] Após criar a cobrança, estou criando o QR Code PIX?
[ ] Após criar o QR Code, estou SIMULANDO O PAGAMENTO via /pixQrCode/simulate-payment?
[ ] Estou verificando o status após simular?
✅ Webhook (se estiver usando)
[ ] A URL do webhook é HTTPS?
[ ] Estou validando o webhookSecret na query string?
[ ] Estou retornando status 200 para confirmar recebimento?
🐛 PROBLEMAS COMUNS
Table
Copy
Problema	Causa Provável	Solução
Erro 401	Chave de API inválida ou não enviada	Verificar se está usando Bearer token correto
Erro 400	Body da requisição incompleto	Verificar campos obrigatórios (methods, products, urls)
Pagamento fica "PENDENTE" forever	Não simulou o pagamento no dev mode	Chamar endpoint /pixQrCode/simulate-payment
Webhook não chega	URL não é HTTPS ou está incorreta	Usar HTTPS e verificar URL no dashboard
Valor errado	Preço não está em centavos	Multiplicar valor por 100
📁 POR FAVOR, ANALISE OS SEGUINTES ARQUIVOS DO MEU PROJETO
Analise meu código e compare com a documentação acima:
Arquivo de configuração da API (onde defino a chave e base URL)
Arquivo de serviço/payment (onde crio cobrança, QR code, etc.)
Arquivo de controller/rota (onde recebo as requisições do frontend)
Arquivo de webhook (se existir)
Frontend - componente de pagamento (se relevante)
🎯 TAREFAS DO AGENTE
Leia todos os arquivos de integração com a AbacatePay no meu projeto
Compare cada passo com a documentação oficial acima
Identifique discrepâncias entre o que está implementado vs. o correto
Liste todos os erros encontrados com referência à linha do código
Proponha correções com código corrigido
Explique o fluxo correto passo a passo para o dev mode
❓ INFORMAÇÕES ADICIONAIS
Framework/biblioteca usada: [INFORME: React/Next.js/Node/PHP/etc.]
SDK da AbacatePay ou requisições HTTP diretas? [INFORME]
Está usando webhook ou polling de status? [INFORME]
Qual o erro específico que está vendo? [INFORME: mensagem de erro, status HTTP, etc.]
Por favor, faça uma análise completa e me mostre exatamente onde está o problema e como corrigir.
Copy

---

## 💡 Como Usar

1. **Copie o prompt acima**
2. **Abra o Claude Code** no seu projeto
3. **Cole o prompt** e adicione as informações adicionais no final
4. **O Claude vai analisar** todos os seus arquivos de integração
5. **Receba o diagnóstico** completo com correções

---

## 🔗 Referências da Documentação

- [Dev Mode](https://docs.abacatepay.com/pages/devmode)
- [Autenticação](https://docs.abacatepay.com/pages/authentication)
- [Criar Cobrança](https://docs.abacatepay.com/pages/payment/create)
- [Simular Pagamento](https://docs.abacatepay.com/pages/pix-qrcode/simulate-payment)
- [Webhooks](https://docs.abacatepay.com/pages/webhooks)

Se precisar de mais alguma informação específica da documentação, posso buscar para você!