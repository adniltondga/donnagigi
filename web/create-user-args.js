#!/usr/bin/env node
// Script para criar usuários - aceita argumentos

const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcryptjs');

const prisma = new PrismaClient();

async function createUser(email, password, username, name) {
  try {
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

// Pegar argumentos da linha de comando
const args = process.argv.slice(2);

if (args.length < 4) {
  console.error('❌ Uso: node create-user-args.js <email> <password> <username> <name>');
  console.error('   Exemplo: node create-user-args.js adnilton.santos@donnagigi.com.br md98yp121556 adnilton.santos "Adnilton Santos"');
  process.exit(1);
}

const [email, password, username, name] = args;
createUser(email, password, username, name);
