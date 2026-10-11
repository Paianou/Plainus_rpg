/* ===================================================================
   testes/rotas-de-teste.cjs — duas portas dos fundos, só para os testes

   Os roteiros do navegador precisam, às vezes, olhar a campanha como o
   servidor a tem ("a ação chegou lá?") ou montar uma situação que pela
   tela levaria dezenas de cliques ("um combate na rodada 2, com o
   goblin já tendo agido"). Para isso:

     POST /teste/ler        { campanhaId }           → a campanha oficial
     POST /teste/trocar     { campanhaId, estado }   → troca a campanha
                                                       inteira e espalha

   O server.js só carrega este arquivo com PLAINUS_ROTAS_DE_TESTE=1 —
   que só o testes/rodar.mjs define — e só escutando em 127.0.0.1. No
   npm start de sempre, estas rotas não existem.
   =================================================================== */

const express = require('express');
const { conferirCampanha } = require('../modelo.js');

function ligar(app, armazem, mesa) {
  app.post('/teste/ler', express.json(), function (pedido, resposta) {
    const estado = armazem.ler(pedido.body && pedido.body.campanhaId);
    if (!estado) return resposta.status(404).json({ erro: 'Campanha não encontrada.' });
    resposta.json(estado);
  });

  app.post('/teste/trocar', express.json({ limit: '8mb' }), function (pedido, resposta) {
    const corpo = pedido.body || {};
    const estado = armazem.ler(corpo.campanhaId);
    if (!estado) return resposta.status(404).json({ erro: 'Campanha não encontrada.' });
    const novo = conferirCampanha(corpo.estado);
    if (typeof novo === 'string') return resposta.status(400).json({ erro: novo });
    /* O mesmo objeto (o armazém e as conexões o seguram), com tudo novo
       dentro — menos o código de convite, que é do servidor. Pelo
       armazem.aplicar, como qualquer mudança: imagens e limites. */
    novo.campanha.codigo = estado.campanha.codigo;
    const r = armazem.aplicar(corpo.campanhaId, function (e) {
      Object.keys(e).forEach(function (k) { delete e[k]; });
      Object.assign(e, novo);
      return {};
    });
    if (r.erro) return resposta.status(400).json({ erro: r.erro });
    mesa().espalhar(corpo.campanhaId);
    resposta.json({ ok: true });
  });
}

module.exports = { ligar };
