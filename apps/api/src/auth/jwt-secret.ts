/**
 * Lê o segredo de assinatura/verificação do JWT do ambiente.
 *
 * Sem fallback: se `JWT_SECRET` não estiver definido, a aplicação NÃO sobe.
 * Antes havia um literal hardcoded ('chave_super_secreta_aqui') usado tanto na
 * emissão (AuthModule) quanto na verificação (AuthGuard) — um risco vivo: um
 * deploy sem a env aceitaria tokens forjados com um segredo público. Falhar o
 * boot com mensagem clara é preferível a rodar inseguro silenciosamente.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error(
      'JWT_SECRET não definido. Defina a variável de ambiente JWT_SECRET ' +
        '(veja apps/api/.env.example) antes de iniciar a API.',
    );
  }
  return secret;
}
