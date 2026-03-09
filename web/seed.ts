import bcrypt from 'bcryptjs'
import prisma from './src/lib/prisma'

async function seed() {
  try {
    // Verificar se o usuário já existe
    const existingUser = await prisma.user.findUnique({
      where: { email: 'admin@donnagigi.com' }
    })

    if (existingUser) {
      console.log('Usuário de teste já existe')
      return
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash('admin123456', 10)

    // Criar usuário de teste
    const user = await prisma.user.create({
      data: {
        email: 'admin@donnagigi.com',
        username: 'admin',
        name: 'Administrador',
        password: hashedPassword
      }
    })

    console.log('✅ Usuário de teste criado:', user.email)
  } catch (error) {
    console.error('❌ Erro ao criar usuário:', error)
  } finally {
    await prisma.$disconnect()
  }
}

seed()
