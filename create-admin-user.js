const { PrismaClient } = require("@prisma/client")
const bcrypt = require("bcryptjs")

const prisma = new PrismaClient()

async function main() {
  try {
    const email = "giovana.coutinho@donnagigi.com.br"
    const password = "md98yp121556"
    const hashedPassword = await bcrypt.hash(password, 10)

    // Verificar se usuário já existe
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      console.log("Usuário já existe:", email)
      process.exit(0)
    }

    // Criar usuário
    const user = await prisma.user.create({
      data: {
        email,
        username: "adnilton",
        password: hashedPassword,
        name: "Adnilton Santos"
      }
    })

    console.log("✅ Usuário criado com sucesso:")
    console.log(`   Email: ${user.email}`)
    console.log(`   Username: ${user.username}`)
    console.log(`   Nome: ${user.name}`)
  } catch (error) {
    console.error("Erro ao criar usuário:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
