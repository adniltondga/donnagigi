const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const integration = await prisma.mLIntegration.findFirst();
    console.log('Token:', integration.accessToken.substring(0, 50));
    console.log('Expirado?', new Date() > integration.expiresAt);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
