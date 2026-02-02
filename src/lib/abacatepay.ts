import axios from 'axios';

export const abacatePay = axios.create({
    baseURL: 'https://api.abacatepay.com/v1',
    headers: {
        'Authorization': `Bearer ${process.env.ABACATEPAY_API_TOKEN}`,
        'Content-Type': 'application/json',
    }
});
