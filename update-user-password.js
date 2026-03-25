const { PrismaClient } = require("@prisma/client")
const bcrypt = require("bcryptjs")

const prisma = new PrismaClient()

async function main() {
  try {
    const userId = "cmn4nv1wn0000sw78o9x28mf6"
    const newPassword = "gi13226014"

    // Verificar se usuário existe
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      console.error("❌ Usuário não encontrado:", userId)
      process.exit(1)
    }

    // Hash da nova senha
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Atualizar senha
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    })

    console.log("✅ Senha alterada com sucesso!")
    console.log(`   ID: ${updated.id}`)
    console.log(`   Email: ${updated.email}`)
    console.log(`   Username: ${updated.username}`)
  } catch (error) {
    console.error("Erro ao atualizar senha:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
