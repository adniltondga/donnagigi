#!/usr/bin/env node
// Script para gerar um JWT_SECRET seguro

const crypto = require('crypto');

const secret = crypto.randomBytes(32).toString('hex');

console.log('\n🔐 JWT Secret gerado com sucesso:\n');
console.log(`JWT_SECRET=${secret}\n`);
console.log('📋 Copie o valor acima para:\n');
console.log('   1. .env.local (desenvolvimento)');
console.log('   2. Environment Variables do Vercel (produção)\n');
