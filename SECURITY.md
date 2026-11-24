# Política de segurança

## Como reportar uma vulnerabilidade

Encontrou uma falha de segurança? **Não abra uma issue pública.** Use o recurso
[Private vulnerability reporting](https://docs.github.com/pt/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
na aba **Security** do repositório (ou envie um e-mail ao mantenedor, se estiver listado no perfil).

Inclua, se possível:

- o que acontece e qual o impacto (por exemplo: acesso aos dados de outra conta);
- passos para reproduzir;
- versão ou commit afetado.

Respondemos em até 7 dias e avisamos quando a correção for publicada.

## O que já é feito

- Senhas com scrypt (N=2^17), com atualização automática de hashes antigos no login.
- Sessão em cookie `HttpOnly; Secure; SameSite=Strict`, assinada com `SESSION_SECRET` (mínimo de 32 caracteres em produção).
- Checagem de `Origin` em todo pedido que altera dados (defesa extra contra CSRF).
- Limite de tentativas no login, na recuperação de senha, nas ações da conta, no cadastro, na importação e nas consultas ao TMDb.
- CSP restrita (sem `unsafe-inline`), HSTS, `X-Frame-Options: DENY` e `nosniff`.
- Todo texto externo é escapado ao montar HTML, com testes que travam o uso de `innerHTML` sem escape.
- Dependabot, `npm audit` e CodeQL na integração contínua.

## Escopo

Vale para o código deste repositório e para a configuração padrão de implantação (`vercel.json`).
Falhas em serviços de terceiros (Vercel, Neon, TMDb, Resend) devem ser reportadas a eles.
