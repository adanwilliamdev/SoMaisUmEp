// Erro "seguro": a mensagem pode ser mostrada ao usuário.
const erro = (msg, status = 400) => Object.assign(new Error(msg), { expose: true, status });
module.exports = { erro };
