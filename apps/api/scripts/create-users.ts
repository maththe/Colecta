/**
 * Script aditivo: garante a existência de um usuário por tipo (UserRole) no banco.
 *
 * Diferente do seed completo, NÃO apaga nenhum dado — apenas faz upsert dos
 * usuários canônicos de cada tipo. Pode ser executado a qualquer momento.
 *
 * Uso: pnpm --filter @colecta/api db:create-users
 */
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const TENANT = '00000000-0000-0000-0000-000000000001';
const DEFAULT_PASSWORD = 'colecta123';

// Um usuário canônico por tipo de função. ADMIN compartilha o e-mail do seed
// (admin@colecta.com) para que o upsert apenas reforce o usuário existente.
const usersByRole: { role: UserRole; email: string; name: string }[] = [
  { role: UserRole.ADMIN, email: 'admin@colecta.com', name: 'Admin Colecta' },
  { role: UserRole.MANUTENCAO, email: 'manutencao@colecta.com', name: 'Usuário Manutenção' },
  { role: UserRole.LIMPEZA, email: 'limpeza@colecta.com', name: 'Usuário Limpeza' },
  { role: UserRole.FINANCEIRO, email: 'financeiro@colecta.com', name: 'Usuário Financeiro' },
  { role: UserRole.SEGURANCA, email: 'seguranca@colecta.com', name: 'Usuário Segurança' },
  { role: UserRole.FUNCIONARIO, email: 'funcionario@colecta.com', name: 'Usuário Funcionário' },
];

async function main(): Promise<void> {
  console.log('Criando/atualizando um usuário por tipo...');

  const hashed = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  for (const { role, email, name } of usersByRole) {
    await prisma.user.upsert({
      where: { email },
      update: { name, role, tenantUuid: TENANT },
      create: { email, name, password: hashed, role, tenantUuid: TENANT },
    });
    console.log(`  ✓ ${role.padEnd(11)} -> ${email}`);
  }

  console.log(`\nConcluído. Senha padrão dos usuários criados: ${DEFAULT_PASSWORD}`);
  console.log('(O admin mantém a senha definida no seed: admin123)');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
