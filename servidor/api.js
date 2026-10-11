/* ===================================================================
   servidor/api.js — as perguntas da tela de entrada (HTTP)

   A entrada faz perguntas de "uma pergunta, uma resposta" — criar uma
   campanha, entrar com o código —, e para isso HTTP basta. O tempo
   real (a mesa em jogo) é com o Socket.IO, no servidor/mesa.js.

     POST /api/campanhas   criar (da criação em etapas, ou de um backup)
                           → { id, codigo, chave }   a chave do Mestre
     POST /api/convite     o nome da mesa de um código (o link de convite)
     POST /api/entrar      entrar com o código, como jogador
                           → { campanhaId, jogadorId, chave, nome }
     POST /api/cartoes     o que mostrar em cada cartão de "Suas mesas"
                           (só das mesas cuja chave o navegador tem)
     POST /api/backup      baixar o backup (só o Mestre)
     POST /api/senha       o Mestre define (ou troca) a senha da mesa
     POST /api/tem-senha   a mesa já tem senha? (só o Mestre pergunta)
     POST /api/mestre      entrar como Mestre noutro computador:
                           código + senha → uma chave de Mestre nova
     POST /api/acessos     quem tem acesso à mesa (só o Mestre)
     POST /api/liberar     o Mestre libera o lugar de um jogador
     POST /api/sair-dos-outros   só este computador fica como Mestre
     POST /api/apagar      o Mestre apaga a campanha (com a senha)

   As três últimas tiram acesso de quem pode estar com a mesa aberta: a
   mesa (servidor/mesa.js) reconfere as conexões e desconecta quem saiu.

   Tudo é POST com JSON, e nenhuma resposta usa cookie: a "credencial"
   é a chave que vai no corpo do pedido. Por isso um site de fora não
   consegue pedir nada em nome de quem está com a mesa aberta (o
   navegador só manda JSON para outro endereço com permissão — e este
   servidor não dá permissão a ninguém).

   LIMITES
   Cada endereço (IP) tem um número de pedidos por minuto. O que mais
   importa é o /api/entrar: sem limite, dava para tentar códigos de
   convite em massa (mesmo com 10^18 combinações, não custa fechar a
   porta). O /api/mestre tem o limite mais apertado de todos — é ali que
   alguém tentaria adivinhar a senha do Mestre (e o armazém ainda trava
   a campanha depois de muitos erros seguidos). O tamanho do corpo também tem teto — um backup com mapas cabe;
   um arquivo de gigabytes, não.
   =================================================================== */

const express = require('express');
const { senhaValida } = require('./armazem.js');
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

/* opcoes.semLimite: só para os testes do navegador, que criam dezenas
   de campanhas por minuto do mesmo endereço (testes/rotas-de-teste.cjs). */
function criarApi(armazem, opcoes) {
  const api = express.Router();
  /* A mesa em tempo real é ligada DEPOIS da API (server.js): por isso a
     pergunta é uma função, feita na hora de usar. */
  const mesa = function () { return opcoes && opcoes.mesa ? opcoes.mesa() : null; };
  const reconferir = function (id, motivo) { const m = mesa(); if (m) m.reconferir(id, motivo); };
  const soMestre = function (corpo, resposta) {
    if (armazem.conferirAcesso(corpo.campanhaId, 'mestre', null, corpo.chave)) return true;
    resposta.status(403).json({ erro: 'Só o Mestre desta campanha faz isso.' });
    return false;
  };
  const limite = opcoes && opcoes.semLimite ? function () { return function (p, r, seguir) { seguir(); }; } : limitador;

  /* Criar campanha (inclusive de um backup, que pode trazer mapas): 8 MB. */
  /* A senha do Mestre é opcional: sem ela, a mesa só abre no navegador
     que a criou (o que é seguro, só menos prático). Vem conferida ANTES
     de criar — senha recusada não deixa campanha pela metade. */
  api.post('/campanhas', limite(10), express.json({ limit: '8mb' }), function (pedido, resposta) {
    const corpo = pedido.body || {};
    const comSenha = corpo.senha !== undefined && corpo.senha !== null && corpo.senha !== '';
    const problema = comSenha ? senhaValida(corpo.senha) : null;
    if (problema) return resposta.status(400).json({ erro: problema });
    const r = armazem.criar(corpo.estado);
    if (r.erro) return resposta.status(400).json({ erro: r.erro });
    const pronto = function () { resposta.json({ id: r.id, codigo: r.codigo, chave: r.chave, temSenha: armazem.temSenha(r.id) }); };
    if (!comSenha) return pronto();
    armazem.definirSenha(r.id, corpo.senha).then(pronto, pronto);
  });

  /* O código de convite e a entrada dividem o MESMO limite: é por eles
     que alguém tentaria adivinhar códigos. */
  const limiteDoCodigo = limite(20);

  /* O link de convite: de que mesa é este código? Quem tem o código foi
     convidado — o nome da mesa e do Mestre não são segredo para ele. */
  api.post('/convite', limiteDoCodigo, express.json({ limit: '2kb' }), function (pedido, resposta) {
    const id = armazem.acharPorCodigo(pedido.body && pedido.body.codigo);
    if (!id) return resposta.status(404).json({ erro: 'Nenhuma campanha com esse código.' });
    const r = armazem.resumo(id);
    resposta.json({ nome: r.nome, mestre: r.mestre });
  });

  /* Entrar com o código. */
  api.post('/entrar', limiteDoCodigo, express.json({ limit: '10kb' }), function (pedido, resposta) {
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
  api.post('/cartoes', limite(60), express.json({ limit: '20kb' }), function (pedido, resposta) {
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
          temSenha: papel === 'mestre' ? armazem.temSenha(m.campanhaId) : null,
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
  api.post('/backup', limite(20), express.json({ limit: '10kb' }), function (pedido, resposta) {
    const corpo = pedido.body || {};
    if (!armazem.conferirAcesso(corpo.campanhaId, 'mestre', null, corpo.chave)) {
      return resposta.status(403).json({ erro: 'Só o Mestre desta campanha baixa o backup.' });
    }
    resposta.json(armazem.envelopeDeBackup(corpo.campanhaId));
  });

  /* A senha do Mestre: só quem já é Mestre (tem a chave) define ou troca. */
  api.post('/senha', limite(10), express.json({ limit: '2kb' }), function (pedido, resposta) {
    const corpo = pedido.body || {};
    if (!armazem.conferirAcesso(corpo.campanhaId, 'mestre', null, corpo.chave)) {
      return resposta.status(403).json({ erro: 'Só o Mestre desta campanha define a senha.' });
    }
    armazem.definirSenha(corpo.campanhaId, corpo.senha).then(function (r) {
      if (r.erro) return resposta.status(400).json({ erro: r.erro });
      resposta.json({ ok: true });
    }, function () {
      resposta.status(500).json({ erro: 'O servidor não conseguiu guardar a senha.' });
    });
  });

  api.post('/tem-senha', limite(60), express.json({ limit: '2kb' }), function (pedido, resposta) {
    const corpo = pedido.body || {};
    if (!armazem.conferirAcesso(corpo.campanhaId, 'mestre', null, corpo.chave)) {
      return resposta.status(403).json({ erro: 'Só o Mestre desta campanha pergunta isso.' });
    }
    resposta.json({ temSenha: armazem.temSenha(corpo.campanhaId) });
  });

  /* Entrar como Mestre noutro computador. 5 tentativas por minuto por
     endereço — com o scrypt e a trava por campanha, adivinhar uma senha
     razoável leva anos. */
  api.post('/mestre', limite(5), express.json({ limit: '2kb' }), function (pedido, resposta) {
    const corpo = pedido.body || {};
    armazem.entrarComoMestre(corpo.codigo, corpo.senha).then(function (r) {
      if (r.erro) return resposta.status(403).json({ erro: r.erro });
      resposta.json(r);
    }, function () {
      resposta.status(500).json({ erro: 'O servidor não conseguiu conferir a senha.' });
    });
  });

  api.post('/acessos', limite(60), express.json({ limit: '2kb' }), function (pedido, resposta) {
    const corpo = pedido.body || {};
    if (!soMestre(corpo, resposta)) return;
    resposta.json(armazem.listarAcessos(corpo.campanhaId));
  });

  api.post('/liberar', limite(20), express.json({ limit: '2kb' }), function (pedido, resposta) {
    const corpo = pedido.body || {};
    if (!soMestre(corpo, resposta)) return;
    const r = armazem.liberarJogador(corpo.campanhaId, String(corpo.jogadorId || ''));
    if (r.erro) return resposta.status(400).json({ erro: r.erro });
    reconferir(corpo.campanhaId, 'O Mestre liberou o seu lugar nesta mesa. Para voltar, entre de novo pela entrada, com o código e o seu nome.');
    resposta.json({ ok: true, nome: r.nome });
  });

  api.post('/sair-dos-outros', limite(10), express.json({ limit: '2kb' }), function (pedido, resposta) {
    const corpo = pedido.body || {};
    if (!soMestre(corpo, resposta)) return;
    const r = armazem.manterSoEstaChave(corpo.campanhaId, corpo.chave);
    if (r.erro) return resposta.status(400).json({ erro: r.erro });
    reconferir(corpo.campanhaId, 'Este computador foi desconectado do painel do Mestre. Para voltar, entre como Mestre com o código e a senha.');
    resposta.json({ ok: true, sairam: r.sairam });
  });

  /* Apagar não tem volta: com senha, pede a senha (quem achou um
     computador com a mesa aberta não apaga nada); sem senha, pede o nome
     da campanha digitado — para ninguém apagar por um clique errado. */
  api.post('/apagar', limite(10), express.json({ limit: '2kb' }), function (pedido, resposta) {
    const corpo = pedido.body || {};
    if (!soMestre(corpo, resposta)) return;
    const id = corpo.campanhaId;
    const confirmar = armazem.temSenha(id)
      ? armazem.verificarSenha(id, corpo.senha, { erro: 'Senha errada.' })
      : Promise.resolve(String(corpo.confirmacao || '').trim() === armazem.ler(id).campanha.nome ? { ok: true } : { erro: 'Digite o nome da campanha exatamente como ele é.' });
    confirmar.then(function (v) {
      if (v.erro) return resposta.status(403).json({ erro: v.erro });
      armazem.apagar(id);
      reconferir(id, 'O Mestre apagou esta campanha.');
      resposta.json({ ok: true });
    }, function () {
      resposta.status(500).json({ erro: 'O servidor não conseguiu conferir a senha.' });
    });
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
