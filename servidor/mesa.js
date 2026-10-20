/* ===================================================================
   servidor/mesa.js — a mesa em tempo real (Socket.IO)

   Cada painel aberto (do Mestre ou de um jogador) mantém uma conexão
   ligada com o servidor. Por ela:

     entrar        { campanhaId, papel, jogadorId, chave }
                   A chave é conferida (servidor/armazem.js). Sem ela,
                   nada: nem a campanha, nem a lista de quem está lá.
                   Ao entrar, o Mestre recebe a campanha INTEIRA; o
                   jogador recebe só a VISÃO dele (visao.js) — o que ela
                   tira (PV dos monstros, segredos, notas) nem sai daqui.

     acao          { nome, dados, semente }        — só o Mestre
                   Uma ação do acoes.js. O navegador do Mestre já rodou
                   a mesma ação com a mesma semente (para a tela
                   responder na hora); aqui ela roda na cópia oficial.

     acaoJogador   { nome, dados }                 — jogador (e o chat do Mestre)
                   Uma ação do visao.js, com a sessão que a CHAVE provou.

   Depois de cada mudança, todo mundo na sala recebe o que mudou para
   ele: o Mestre, a campanha; cada jogador, a visão dele — mas só se
   algo que ELE vê mudou (editar um NPC secreto não gera tráfego para
   os jogadores).

   O que chega pela conexão é entrada de usuário: tamanho, formato,
   quantidade por minuto — tudo conferido antes de qualquer coisa.
   =================================================================== */

const { Server } = require('socket.io');
const { aplicarAcao } = require('../publico/acoes.js');
const { visaoDoJogador, aplicarAcaoJogador } = require('../publico/visao.js');
const { quemPede, chaveDoEndereco, doProprioComputador } = require('./api.js');

const LIMITE_POR_SALA = 20;
const PEDIDOS_POR_MINUTO = 600;   /* pintar parede gera várias ações seguidas */
/* O jogador não pinta parede: ficha, rolagem e chat. Cada ação custa ao
   servidor copiar e conferir a campanha inteira — o teto menor impede
   um jogador de ocupar o servidor sozinho. */
const PEDIDOS_POR_MINUTO_JOGADOR = 300;
/* Conexões abertas ao mesmo tempo por pessoa (endereço). Cada painel é
   uma; quinze dá para várias abas. O computador do próprio servidor
   não tem teto (é o Mestre em casa, e os testes). */
const CONEXOES_POR_ENDERECO = 15;
/* Quem conecta e não entra numa mesa (não mostrou chave) em 30 s sai:
   o navegador de verdade manda a chave no primeiro instante. */
const ESPERA_ENTRAR = 30 * 1000;

/* Uma página de OUTRO site, aberta no navegador de alguém, poderia abrir
   uma conexão com a mesa (o "Cross-Site WebSocket Hijacking"). O
   navegador sempre manda o cabeçalho Origin dizendo de que site a página
   veio: só aceitamos este mesmo endereço. Sem Origin (um programa, não
   um navegador), não há vítima a proteger. */
function origemConfere(pedido) {
  const origem = pedido.headers.origin;
  if (!origem) return true;
  try {
    return new URL(origem).host === pedido.headers.host;
  } catch (erro) {
    return false;
  }
}

function ligarMesa(servidorHttp, armazem, log) {
  const avisar = log || function () {};

  const io = new Server(servidorHttp, {
    /* Só WebSocket: o long-polling enchia a fila de 6 conexões por
       endereço do navegador e travava páginas com várias abas abertas. */
    transports: ['websocket'],
    /* Ações levam imagem às vezes (o mapa de uma cena, até ~700 KB em
       texto; um retrato, ~160 KB). 2 MB é folga; mais que isso, nem é lido. */
    maxHttpBufferSize: 2 * 1024 * 1024,
    allowRequest: function (pedido, responder) { responder(null, origemConfere(pedido)); }
  });

  const sala = function (campanhaId) { return 'campanha:' + campanhaId; };

  /* Quando cada jogador trocou de nome pela última vez (mudarMeuNome). */
  const ESPERA_TROCA_NOME = 10000;
  const ultimaTrocaDeNome = new Map();

  /* Quem está na sala, com os nomes que o SERVIDOR conhece. O do
     Mestre vem da campanha de agora, e não do que ficou guardado na
     conexão quando ele entrou: ele pode ter trocado de nome (Perfil,
     Editar campanha) sem reconectar. */
  function presentes(campanhaId) {
    const lista = [];
    const estado = armazem.ler(campanhaId);
    const doMestre = (estado && estado.mestre && estado.mestre.nome) || 'Mestre';
    const conexoes = io.sockets.adapter.rooms.get(sala(campanhaId)) || new Set();
    conexoes.forEach(function (sid) {
      const s = io.sockets.sockets.get(sid);
      if (!s || !s.data.sessao) return;
      const mestre = s.data.sessao.papel === 'mestre';
      lista.push({ nome: mestre ? doMestre : s.data.sessao.nome, papel: s.data.sessao.papel });
    });
    return lista.sort(function (a, b) {
      if (a.papel !== b.papel) return a.papel === 'mestre' ? -1 : 1;
      return a.nome.localeCompare(b.nome);
    });
  }

  /* Manda a cada conexão da sala o que ela vê — se mudou desde a última
     vez. A comparação é pelo texto JSON do que seria enviado. */
  function espalhar(campanhaId) {
    const estado = armazem.ler(campanhaId);
    if (!estado) return;
    const conexoes = io.sockets.adapter.rooms.get(sala(campanhaId)) || new Set();
    conexoes.forEach(function (sid) {
      const s = io.sockets.sockets.get(sid);
      if (s && s.data.sessao) enviarVista(s, estado);
    });
  }

  function enviarVista(socket, estado) {
    const sessao = socket.data.sessao;
    let pacote, texto;
    /* Um erro aqui dentro (uma campanha com algo que a visão não
       esperava) não pode derrubar o servidor inteiro: no Socket.IO, uma
       exceção num evento vira erro sem dono e o Node sai — a mesa de
       todo mundo cai junto. Fica registrado, e só esta pessoa fica sem
       a atualização. */
    try {
      /* O Mestre recebe a campanha inteira — menos a conversa da EQUIPE,
         que é só dos jogadores (nem chega ao navegador dele). */
      pacote = sessao.papel === 'mestre'
        ? { papel: 'mestre', estado: Object.assign({}, estado, { mensagens: (estado.mensagens || []).filter(function (m) { return m && m.canal !== 'equipe'; }) }) }
        : { papel: 'jogador', visao: visaoDoJogador(estado, sessao.jogadorId) };
      texto = JSON.stringify(pacote);
    } catch (erro) {
      avisar('Não consegui montar a mesa de ' + sessao.nome + ' (' + sessao.campanhaId + '): ' + erro.message);
      return;
    }
    if (texto === socket.data.ultimaVista) return;
    socket.data.ultimaVista = texto;
    socket.emit('mesa', pacote);
  }

  /* endereço → conexões abertas agora */
  const conexoesPorEndereco = new Map();

  io.on('connection', function (socket) {
    /* Teto de conexões por pessoa. */
    const endereco = doProprioComputador(socket.request) ? null : chaveDoEndereco(quemPede(socket.request));
    if (endereco) {
      const abertas = conexoesPorEndereco.get(endereco) || 0;
      if (abertas >= CONEXOES_POR_ENDERECO) { socket.disconnect(true); return; }
      conexoesPorEndereco.set(endereco, abertas + 1);
    }

    let pedidos = 0;
    const contagem = setInterval(function () { pedidos = 0; }, 60 * 1000);
    const passou = function () {
      pedidos += 1;
      const sessao = socket.data.sessao;
      return pedidos > (sessao && sessao.papel === 'jogador' ? PEDIDOS_POR_MINUTO_JOGADOR : PEDIDOS_POR_MINUTO);
    };
    const responder = function (cb, valor) { if (typeof cb === 'function') cb(valor); };
    const semEntrar = setTimeout(function () { if (!socket.data.sessao) socket.disconnect(true); }, ESPERA_ENTRAR);

    /* ---------- entrar ---------- */
    socket.on('entrar', function (dados, cb) {
      if (passou()) return responder(cb, { erro: 'Pedidos demais.' });
      dados = dados && typeof dados === 'object' ? dados : {};
      const papel = dados.papel === 'mestre' ? 'mestre' : 'jogador';
      const campanhaId = String(dados.campanhaId || '');
      const jogadorId = papel === 'jogador' ? String(dados.jogadorId || '') : null;

      if (!armazem.conferirAcesso(campanhaId, papel, jogadorId, dados.chave)) {
        return responder(cb, { erro: 'Esta chave não abre esta mesa. Volte à entrada.' });
      }
      /* Conta os OUTROS: quem está voltando (a mesma conexão entrando de
         novo) não ocupa um lugar a mais. */
      const naSala = io.sockets.adapter.rooms.get(sala(campanhaId));
      const outros = naSala ? naSala.size - (naSala.has(socket.id) ? 1 : 0) : 0;
      if (outros >= LIMITE_POR_SALA) return responder(cb, { erro: 'A mesa está cheia.' });

      const estado = armazem.ler(campanhaId);
      const nome = papel === 'mestre' ? (estado.mestre.nome || 'Mestre') : armazem.nomeDoJogador(campanhaId, jogadorId);

      /* Trocou de campanha na mesma conexão: sai da sala antiga. */
      const antes = socket.data.sessao;
      if (antes && antes.campanhaId !== campanhaId) {
        socket.leave(sala(antes.campanhaId));
        io.to(sala(antes.campanhaId)).emit('presenca', presentes(antes.campanhaId));
      }

      socket.data.sessao = { campanhaId: campanhaId, papel: papel, jogadorId: jogadorId, nome: nome };
      /* A chave fica guardada na conexão (só na memória do servidor) para
         reconferir() — o acesso pode deixar de valer com a mesa aberta. */
      socket.data.chave = dados.chave;
      socket.data.ultimaVista = null;
      socket.join(sala(campanhaId));
      responder(cb, { ok: true, papel: papel, nome: nome });
      enviarVista(socket, estado);
      io.to(sala(campanhaId)).emit('presenca', presentes(campanhaId));
    });

    /* ---------- ação do Mestre ---------- */
    socket.on('acao', function (pedido, cb) {
      if (passou()) return responder(cb, { erro: 'Pedidos demais.' });
      const sessao = socket.data.sessao;
      if (!sessao || sessao.papel !== 'mestre') return responder(cb, { erro: 'Só o Mestre faz isso.' });
      pedido = pedido && typeof pedido === 'object' ? pedido : {};

      if (!armazem.ler(sessao.campanhaId)) return responder(cb, { erro: 'Campanha não encontrada.' });
      let resultado;
      try {
        /* armazem.aplicar: a ação, as imagens para fora e os limites. */
        resultado = armazem.aplicar(sessao.campanhaId, function (estado) {
          return aplicarAcao(String(pedido.nome || ''), estado, pedido.dados && typeof pedido.dados === 'object' ? pedido.dados : {}, pedido.semente);
        });
      } catch (erro) {
        avisar('Ação ' + pedido.nome + ' quebrou: ' + erro.message);
        resultado = { erro: 'O servidor não conseguiu fazer isso.' };
      }
      if (resultado.erro) {
        /* A tela do Mestre já tinha aplicado a ação; o servidor recusou.
           Manda de novo a campanha oficial para a tela voltar a ela. */
        socket.data.ultimaVista = null;
        enviarVista(socket, armazem.ler(sessao.campanhaId));
        return responder(cb, { erro: resultado.erro });
      }
      responder(cb, { resultado: resultado });
      espalhar(sessao.campanhaId);
      /* O Mestre trocou de nome: a lista de quem está na mesa muda junto. */
      if (pedido.nome === 'mudarNomeMestre' || pedido.nome === 'editarCampanha') {
        io.to(sala(sessao.campanhaId)).emit('presenca', presentes(sessao.campanhaId));
      }
    });

    /* ---------- o jogador troca o próprio nome (Perfil) ----------
       Fora do acaoJogador porque mexe nos ACESSOS (armazem), e não só na
       campanha. O jogador vem da SESSÃO desta conexão: só o próprio nome. */
    socket.on('mudarMeuNome', function (pedido, cb) {
      if (passou()) return responder(cb, { erro: 'Pedidos demais.' });
      const sessao = socket.data.sessao;
      if (!sessao || sessao.papel !== 'jogador') return responder(cb, { erro: 'Só o jogador troca o próprio nome.' });
      /* Trocar o nome grava a campanha inteira na hora (o nome mora nos
         acessos): uma troca a cada 10 segundos por jogador, em qualquer
         conexão dele, para ninguém travar o servidor com um script. */
      const chaveTroca = sessao.campanhaId + ':' + sessao.jogadorId;
      const ultima = ultimaTrocaDeNome.get(chaveTroca) || 0;
      if (Date.now() - ultima < ESPERA_TROCA_NOME) return responder(cb, { erro: 'Espere uns segundos para trocar de nome de novo.' });
      const r = armazem.renomearJogador(sessao.campanhaId, sessao.jogadorId, pedido && pedido.nome);
      if (r.erro) return responder(cb, { erro: r.erro });
      if (r.igual) return responder(cb, { resultado: r });
      ultimaTrocaDeNome.set(chaveTroca, Date.now());
      /* Todas as conexões DESTE jogador (outra aba, outro computador)
         passam a usar o nome novo — é ele que vai no chat e na presença. */
      const naSala = io.sockets.adapter.rooms.get(sala(sessao.campanhaId)) || new Set();
      naSala.forEach(function (sid) {
        const s = io.sockets.sockets.get(sid);
        if (s && s.data.sessao && s.data.sessao.jogadorId === sessao.jogadorId) s.data.sessao.nome = r.nome;
      });
      responder(cb, { resultado: r });
      io.to(sala(sessao.campanhaId)).emit('presenca', presentes(sessao.campanhaId));
      espalhar(sessao.campanhaId);
    });

    /* ---------- ação de jogador (e o chat do Mestre) ---------- */
    socket.on('acaoJogador', function (pedido, cb) {
      if (passou()) return responder(cb, { erro: 'Pedidos demais.' });
      const sessao = socket.data.sessao;
      if (!sessao) return responder(cb, { erro: 'Entre na mesa primeiro.' });
      pedido = pedido && typeof pedido === 'object' ? pedido : {};

      if (!armazem.ler(sessao.campanhaId)) return responder(cb, { erro: 'Campanha não encontrada.' });
      let resultado;
      try {
        resultado = armazem.aplicar(sessao.campanhaId, function (estado) {
          return aplicarAcaoJogador(String(pedido.nome || ''), estado, sessao, pedido.dados && typeof pedido.dados === 'object' ? pedido.dados : {});
        });
      } catch (erro) {
        avisar('Ação de jogador ' + pedido.nome + ' quebrou: ' + erro.message);
        resultado = { erro: 'O servidor não conseguiu fazer isso.' };
      }
      if (resultado.erro) {
        /* O jogador já tinha mudado a própria ficha na tela: a visão
           oficial vai de novo, para a tela voltar a ela. */
        socket.data.ultimaVista = null;
        enviarVista(socket, armazem.ler(sessao.campanhaId));
        return responder(cb, { erro: resultado.erro });
      }
      responder(cb, { resultado: resultado });
      espalhar(sessao.campanhaId);
    });

    /* Fechou a aba, caiu a internet: sai da lista, e a sala fica sabendo. */
    socket.on('disconnect', function () {
      clearInterval(contagem);
      clearTimeout(semEntrar);
      if (endereco) {
        const abertas = (conexoesPorEndereco.get(endereco) || 1) - 1;
        if (abertas > 0) conexoesPorEndereco.set(endereco, abertas);
        else conexoesPorEndereco.delete(endereco);
      }
      const sessao = socket.data.sessao;
      if (sessao) io.to(sala(sessao.campanhaId)).emit('presenca', presentes(sessao.campanhaId));
    });
  });

  /* Depois de uma mudança de acesso (o Mestre liberou um jogador, tirou
     os outros computadores dele, apagou a campanha): cada conexão aberta
     desta mesa é conferida de novo, com a chave que ela usou. Quem não
     passa recebe o motivo e é desconectado — e, desconectado pelo
     servidor, o navegador não tenta voltar sozinho. */
  function reconferir(campanhaId, motivo) {
    const conexoes = Array.from(io.sockets.adapter.rooms.get(sala(campanhaId)) || []);
    conexoes.forEach(function (sid) {
      const s = io.sockets.sockets.get(sid);
      const sessao = s && s.data.sessao;
      if (!sessao) return;
      if (armazem.conferirAcesso(campanhaId, sessao.papel, sessao.jogadorId, s.data.chave)) return;
      s.emit('fora', { motivo: String(motivo || 'O seu acesso a esta mesa não vale mais.') });
      s.data.sessao = null;
      s.disconnect(true);
    });
    io.to(sala(campanhaId)).emit('presenca', presentes(campanhaId));
  }

  return { io: io, espalhar: espalhar, reconferir: reconferir };
}

module.exports = { ligarMesa };
