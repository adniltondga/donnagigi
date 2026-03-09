#!/usr/bin/env node
// Script para criar usuário admin

const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcryptjs');

const prisma = new PrismaClient();

async function createUser() {
  try {
    // Dados do usuário
    const email = 'giovana.coutinho@donnagigi.com.br';
    const password = 'gi13226014';
    const username = 'giovana.coutinho';
    const name = 'Giovana Coutinho';

    // Hash da senha
    const hashedPassword = await hash(password, 10);

    console.log('🔐 Criando usuário...\n');
    console.log('Email:', email);
    console.log('Username:', username);
    console.log('Nome:', name);
    console.log('\n⏳ Processando...\n');

    // Criar usuário
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        name
      }
    });

    console.log('✅ Usuário criado com sucesso!\n');
    console.log('ID:', user.id);
    console.log('Email:', user.email);
    console.log('Username:', user.username);
    console.log('Nome:', user.name);
    console.log('Data de criação:', user.createdAt);

  } catch (error) {
    console.error('❌ Erro ao criar usuário:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createUser();
