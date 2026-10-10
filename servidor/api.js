/* ===================================================================
   servidor/api.js — as perguntas da tela de entrada (HTTP)

   A entrada faz perguntas de "uma pergunta, uma resposta" — criar uma
   campanha, entrar com o código —, e para isso HTTP basta. O tempo
   real (a mesa em jogo) é com o Socket.IO, no servidor/mesa.js.

     POST /api/campanhas   criar (da criação em etapas, ou de um backup)
                           → { id, codigo, chave }   a chave do Mestre
     POST /api/entrar      entrar com o código, como jogador
                           → { campanhaId, jogadorId, chave, nome }
     POST /api/cartoes     o que mostrar em cada cartão de "Suas mesas"
                           (só das mesas cuja chave o navegador tem)
     POST /api/backup      baixar o backup (só o Mestre)

   Tudo é POST com JSON, e nenhuma resposta usa cookie: a "credencial"
   é a chave que vai no corpo do pedido. Por isso um site de fora não
   consegue pedir nada em nome de quem está com a mesa aberta (o
   navegador só manda JSON para outro endereço com permissão — e este
   servidor não dá permissão a ninguém).

   LIMITES
   Cada endereço (IP) tem um número de pedidos por minuto. O que mais
   importa é o /api/entrar: sem limite, dava para tentar códigos de
   convite em massa (mesmo com 10^18 combinações, não custa fechar a
   porta). O tamanho do corpo também tem teto — um backup com mapas cabe;
   um arquivo de gigabytes, não.
   =================================================================== */

const express = require('express');
const { imagemDaCena, retratoSeguro } = require('../modelo.js');

/* Um contador por endereço, que zera a cada minuto. Simples e em
   memória: para uma mesa de amigos, é o bastante. */
function limitador(porMinuto) {
  const contas = new Map();
  setInterval(function () { contas.clear(); }, 60 * 1000).unref();
  return function (pedido, resposta, seguir) {
    const quem = pedido.ip || 'desconhecido';
    const n = (contas.get(quem) || 0) + 1;
    contas.set(quem, n);
    if (n > porMinuto) return resposta.status(429).json({ erro: 'Pedidos demais. Espere um minuto e tente de novo.' });
    seguir();
  };
}

function criarApi(armazem) {
  const api = express.Router();

  /* Criar campanha (inclusive de um backup, que pode trazer mapas): 8 MB. */
  api.post('/campanhas', limitador(10), express.json({ limit: '8mb' }), function (pedido, resposta) {
    const estado = pedido.body && pedido.body.estado;
    const r = armazem.criar(estado);
    if (r.erro) return resposta.status(400).json({ erro: r.erro });
    resposta.json({ id: r.id, codigo: r.codigo, chave: r.chave });
  });

  /* Entrar com o código. */
  api.post('/entrar', limitador(20), express.json({ limit: '10kb' }), function (pedido, resposta) {
    const corpo = pedido.body || {};
    const id = armazem.acharPorCodigo(corpo.codigo);
    if (!id) return resposta.status(404).json({ erro: 'Nenhuma campanha com esse código. Confira com o Mestre.' });
    const r = armazem.entrarComoJogador(id, corpo.nome);
    if (r.erro) return resposta.status(409).json({ erro: r.erro });
    resposta.json({ campanhaId: id, jogadorId: r.jogadorId, chave: r.chave, nome: r.nome, campanha: armazem.ler(id).campanha.nome });
  });

  /* Os cartões de "Suas mesas". O navegador manda as mesas que ele
     conhece, cada uma com a chave; só as que abrem voltam com dados. O
     que vai no cartão é o que qualquer um da mesa já vê: nome, sessão,
     a party (nomes e retratos) e a cena atual. */
  api.post('/cartoes', limitador(60), express.json({ limit: '20kb' }), function (pedido, resposta) {
    const mesas = Array.isArray(pedido.body && pedido.body.mesas) ? pedido.body.mesas.slice(0, 30) : [];
    resposta.json({
      cartoes: mesas.map(function (m) {
        m = m || {};
        const papel = m.papel === 'mestre' ? 'mestre' : 'jogador';
        if (!armazem.conferirAcesso(m.campanhaId, papel, m.jogadorId, m.chave)) {
          return { campanhaId: String(m.campanhaId || '').slice(0, 40), jogadorId: m.jogadorId || null, papel: papel, semAcesso: true };
        }
        const estado = armazem.ler(m.campanhaId);
        const resumo = armazem.resumo(m.campanhaId);
        const cena = (estado.cenas || []).find(function (c) { return c.id === estado.cenaAtual; }) || (estado.cenas || [])[0];
        return {
          campanhaId: m.campanhaId,
          jogadorId: papel === 'jogador' ? m.jogadorId : null,
          papel: papel,
          nome: resumo.nome,
          sistema: resumo.sistema,
          mestre: resumo.mestre,
          sessao: resumo.sessao,
          atualizadaEm: resumo.atualizadaEm,
          /* O código vai para o Mestre (é ele quem convida). */
          codigo: papel === 'mestre' ? resumo.codigo : null,
          meuNome: papel === 'jogador' ? armazem.nomeDoJogador(m.campanhaId, m.jogadorId) : resumo.mestre,
          party: (estado.herois || []).map(function (h) {
            return { nome: h.nome, dono: papel === 'jogador' && h.dono === m.jogadorId, foto: h.ficha ? retratoSeguro(h.ficha.foto) : null };
          }),
          fundo: imagemDaCena(cena)
        };
      })
    });
  });

  /* Baixar o backup: só com a chave do Mestre (o backup leva os
     segredos da campanha). */
  api.post('/backup', limitador(20), express.json({ limit: '10kb' }), function (pedido, resposta) {
    const corpo = pedido.body || {};
    if (!armazem.conferirAcesso(corpo.campanhaId, 'mestre', null, corpo.chave)) {
      return resposta.status(403).json({ erro: 'Só o Mestre desta campanha baixa o backup.' });
    }
    resposta.json(armazem.envelopeDeBackup(corpo.campanhaId));
  });

  /* JSON quebrado ou grande demais: uma resposta clara, não uma página de erro. */
  api.use(function (erro, pedido, resposta, seguir) {
    if (erro && erro.type === 'entity.too.large') return resposta.status(413).json({ erro: 'Grande demais.' });
    if (erro && erro.type === 'entity.parse.failed') return resposta.status(400).json({ erro: 'Pedido mal formado.' });
    seguir(erro);
  });

  return api;
}

module.exports = { criarApi };
