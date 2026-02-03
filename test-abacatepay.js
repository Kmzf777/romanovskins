/**
 * Script de teste da integração AbacatePay
 * Execute com: node test-abacatepay.js
 */

const API_TOKEN = 'abc_dev_WACL2ZeHTTuC2YsL2mDMdNMj';
const BASE_URL = 'https://api.abacatepay.com/v1';

async function testBilling(testName, customerData) {
    console.log(`\n📋 Teste: ${testName}`);

    const payload = {
        frequency: 'ONE_TIME',
        methods: ['PIX'],
        products: [
            {
                externalId: 'teste-001',
                name: 'Teste de Integração',
                quantity: 1,
                price: 100
            }
        ],
        returnUrl: 'https://romanovdasrifas.vercel.app/teste',
        completionUrl: 'https://romanovdasrifas.vercel.app/teste?success=true',
        customer: customerData
    };

    console.log('📤 Customer:', JSON.stringify(customerData));

    try {
        const response = await fetch(`${BASE_URL}/billing/create`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.data?.url) {
            console.log('✅ SUCESSO!');
            console.log(`   URL: ${data.data.url}`);
            return true;
        } else {
            console.log(`❌ FALHOU: ${JSON.stringify(data.error || data)}`);
            return false;
        }
    } catch (error) {
        console.log(`❌ ERRO: ${error.message}`);
        return false;
    }
}

async function testAPI() {
    console.log('🧪 TESTE FINAL - Simulando exatamente o formato do payment-actions.ts\n');

    // Teste 1: Verificar autenticação
    console.log('📋 Verificando autenticação...');
    try {
        const authResponse = await fetch(`${BASE_URL}/billing/list`, {
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`✅ Autenticação OK (Status: ${authResponse.status})\n`);
    } catch (error) {
        console.log('❌ Erro de conexão:', error.message);
        return;
    }

    // Simular exatamente o que o payment-actions.ts envia
    const phoneDigits = '11999999999';  // Simulando user.whatsapp.replace(/\D/g, '')

    const payload = {
        frequency: 'ONE_TIME',
        methods: ['PIX'],
        products: [
            {
                externalId: 'rifa-teste-123',
                name: 'Rifa: Teste Skin',
                quantity: 2,
                price: 3000  // R$ 30,00 em centavos
            }
        ],
        returnUrl: 'https://romanovdasrifas.com/rifa/teste',
        completionUrl: 'https://romanovdasrifas.com/rifa/teste?success=true',
        customer: {
            name: 'Usuario Teste',
            cellphone: phoneDigits,
            email: `user${phoneDigits}@romanovrifas.com`,
            taxId: '529.982.247-25'
        }
    };

    console.log('📤 Payload (igual ao payment-actions.ts):');
    console.log(JSON.stringify(payload, null, 2));
    console.log('');

    try {
        const response = await fetch(`${BASE_URL}/billing/create`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        console.log('📥 Resposta da API:');
        console.log(JSON.stringify(data, null, 2));
        console.log('');

        if (data.data?.url) {
            console.log('✅ SUCESSO! Billing criado com sucesso!');
            console.log('');
            console.log('📊 Detalhes:');
            console.log(`   ID: ${data.data.id}`);
            console.log(`   URL: ${data.data.url}`);
            console.log(`   Status: ${data.data.status}`);
            console.log(`   Dev Mode: ${data.data.devMode}`);
            console.log(`   Valor: R$ ${(data.data.amount / 100).toFixed(2)}`);
            console.log('');
            console.log('🎉 A integração está funcionando corretamente!');
        } else {
            console.log('❌ FALHOU:');
            console.log(`   Erro: ${JSON.stringify(data.error || data)}`);
        }
    } catch (error) {
        console.log(`❌ ERRO: ${error.message}`);
    }

    console.log('\n🏁 Teste finalizado!');
}

testAPI();
