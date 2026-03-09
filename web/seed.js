const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seed() {
  try {
    // Verificar se o usuário já existe
    const existingUser = await prisma.user.findUnique({
      where: { email: 'admin@donnagigi.com' }
    });

    if (existingUser) {
      console.log('Usuário de teste já existe');
      process.exit(0);
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash('admin123456', 10);

    // Criar usuário de teste
    const user = await prisma.user.create({
      data: {
        email: 'admin@donnagigi.com',
        username: 'admin',
        name: 'Administrador',
        password: hashedPassword
      }
    });

    console.log('✅ Usuário de teste criado:', user.email);
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao criar usuário:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
