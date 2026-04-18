import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminHash = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@loja.vera" },
    update: { role: "ADMIN" },
    create: {
      email: "admin@loja.vera",
      passwordHash: adminHash,
      nome: "Administrador",
      role: "ADMIN",
    },
  });
  const mobileHash = await bcrypt.hash("mobile123", 10);
  await prisma.user.upsert({
    where: { email: "mobile@loja.vera" },
    update: { role: "MOBILE" },
    create: {
      email: "mobile@loja.vera",
      passwordHash: mobileHash,
      nome: "Cadastro mobile",
      role: "MOBILE",
    },
  });
  console.log("Usuário admin: admin@loja.vera / admin123");
  console.log("Usuário mobile: mobile@loja.vera / mobile123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
