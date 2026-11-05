#!/usr/bin/env node
// Gera o par de chaves VAPID dos avisos por push (npm run vapid). Cole as três linhas nas variáveis de ambiente da Vercel
// (e em .env.local, se rodar localmente). Guarde a chave PRIVADA como segredo; trocar o par exige que cada pessoa ative os avisos de novo.
const crypto = require('crypto');

function gerar() {
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const j = privateKey.export({ format: 'jwk' }); // x, y e d em base64url
  const publica = Buffer.concat([Buffer.from([4]), Buffer.from(j.x, 'base64url'), Buffer.from(j.y, 'base64url')]); // ponto não comprimido, 65 bytes
  return { VAPID_PUBLIC_KEY: publica.toString('base64url'), VAPID_PRIVATE_KEY: j.d };
}

module.exports = { gerar };

if (require.main === module) {
  const k = gerar();
  console.log(`VAPID_PUBLIC_KEY=${k.VAPID_PUBLIC_KEY}\nVAPID_PRIVATE_KEY=${k.VAPID_PRIVATE_KEY}\nVAPID_SUBJECT=mailto:troque-por-seu-email@exemplo.com`);
}
