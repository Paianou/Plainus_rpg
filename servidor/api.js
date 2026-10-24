/* ===================================================================
   servidor/api.js — as perguntas da tela de entrada (HTTP)

   A entrada faz perguntas de "uma pergunta, uma resposta" — criar uma
   campanha, entrar com o código —, e para isso HTTP basta. O tempo
   real (a mesa em jogo) é com o Socket.IO, no servidor/mesa.js.

     POST /api/campanhas   criar (da criação em etapas, ou de um backup)
                           → { id, codigo, chave }   a chave do Mestre
                           no computador do servidor, ou com a senha do
                           servidor ({ senhaServidor }, PLAINUS_SENHA_SERVIDOR)
     POST /api/pode-criar  daqui pode criar? → { podeCriar, local, pedeSenha }
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

const net = require('net');
const crypto = require('crypto');
const express = require('express');
const { senhaValida } = require('./armazem.js');
const { imagemDaCena, retratoSeguro } = require('../publico/modelo.js');

/* QUEM ESTÁ PEDINDO, ATRÁS DO TÚNEL
   Pelo Cloudflare Tunnel, todo pedido chega aqui vindo do próprio
   computador (o cloudflared roda nele): o endereço da conexão é sempre
   127.0.0.1, e os limites tratariam a mesa inteira como uma pessoa só —
   cinco senhas erradas de um travariam todo mundo. O Cloudflare conta
   quem pediu de verdade no cabeçalho CF-Connecting-IP.
   Só confiamos nele quando a conexão vem do próprio computador (o
   túnel). Um pedido direto, de outra máquina (HOST=0.0.0.0, na rede de
   casa), poderia escrever o cabeçalho que quisesse — ali vale o
   endereço da conexão. */
const DO_PROPRIO_COMPUTADOR = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
function quemPede(pedido) {
  const conexao = pedido.socket && pedido.socket.remoteAddress;
  const real = pedido.headers['cf-connecting-ip'];
  if (DO_PROPRIO_COMPUTADOR.has(conexao) && typeof real === 'string' && real.length <= 45) return real;
  return conexao || 'desconhecido';
}

/* O PRÓPRIO COMPUTADOR, DE VERDADE
   Conexão de 127.0.0.1 SEM o cabeçalho do Cloudflare: é alguém sentado
   na máquina do servidor (o Mestre, em casa) ou os testes. Pelo túnel
   a conexão também vem de 127.0.0.1 — mas o Cloudflare sempre põe o
   CF-Connecting-IP, e quem está do outro lado não consegue tirá-lo. */
/* E o endereço digitado no navegador (o cabeçalho Host) tem de ser o
   local. Sem isso, uma página maliciosa aberta NESTE computador poderia
   apontar o próprio nome para 127.0.0.1 ("DNS rebinding") e falar com o
   servidor como se fosse daqui — criar o administrador, por exemplo. */
const HOSTS_LOCAIS = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
function doProprioComputador(pedido) {
  const conexao = pedido.socket && pedido.socket.remoteAddress;
  return DO_PROPRIO_COMPUTADOR.has(conexao) && pedido.headers['cf-connecting-ip'] === undefined
    && HOSTS_LOCAIS.test(String(pedido.headers.host || ''));
}

/* A CHAVE DE UM ENDEREÇO, PARA OS LIMITES
   Em IPv4, cada casa costuma ter um endereço. Em IPv6, cada casa recebe
   um BLOCO inteiro (os primeiros 64 bits iguais, o resto livre): quem
   trocasse o fim do endereço a cada pedido ganharia um limite novo a
   cada vez. Por isso, em IPv6, conta o bloco — "2001:db8:1:2::/64". */
function chaveDoEndereco(ip) {
  let texto = String(ip || '');
  if (texto.startsWith('::ffff:') && net.isIPv4(texto.slice(7))) return texto.slice(7);
  texto = texto.split('%')[0];
  if (!net.isIPv6(texto)) return texto;
  const partes = texto.split('::');
  const esquerda = partes[0] ? partes[0].split(':') : [];
  const direita = partes.length > 1 && partes[1] ? partes[1].split(':') : [];
  const grupos = partes.length > 1
    ? esquerda.concat(new Array(Math.max(0, 8 - esquerda.length - direita.length)).fill('0'), direita)
    : esquerda;
  return grupos.slice(0, 4).map(function (g) { return (parseInt(g, 16) || 0).toString(16); }).join(':') + '::/64';
}

/* Um contador por endereço, que zera a cada minuto. Simples e em
   memória: para uma mesa de amigos, é o bastante. */
function limitador(porMinuto) {
  const contas = new Map();
  setInterval(function () { contas.clear(); }, 60 * 1000).unref();
  return function (pedido, resposta, seguir) {
    const quem = chaveDoEndereco(quemPede(pedido));
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
  const contas = opcoes && opcoes.contas;

  /* A conta deste pedido, conferida pelo servidor: { contaId, chave } no
     corpo, como as chaves de campanha. Sem conta válida, null. */
  const contaDoPedido = function (corpo) {
    return contas && corpo ? contas.conferirSessao(corpo.contaId, corpo.chave) : null;
  };
  /* Só uma sessão de ADMINISTRADOR passa. O id do administrador que vai
     para o cofre sai da sessão conferida — nunca do que o corpo diz. */
  const soAdmin = function (corpo, resposta) {
    const conta = contaDoPedido(corpo);
    if (conta && conta.admin) return conta;
    if (!conta) resposta.status(401).json({ erro: 'Esta sessão não vale mais. Entre de novo.' });
    else resposta.status(403).json({ erro: 'Só o administrador faz isso.' });
    return null;
  };
  /* O que vai ao navegador depois de entrar: a conta e a chave nova. */
  const sessaoDaConta = function (r) {
    return { contaId: r.conta.id, chave: r.chave, usuario: r.conta.usuario, admin: r.conta.admin };
  };

  /* A SENHA DO SERVIDOR (server.js, PLAINUS_SENHA_SERVIDOR no .env)
     Pelo link do túnel, quem a digita cria campanha e restaura backup
     como se estivesse no computador do servidor. Comparada pelo resumo
     e em tempo constante (como as chaves no armazem.js): o tempo da
     resposta não conta a quem tenta quantas letras acertou. */
  const senhaServidor = opcoes && opcoes.senhaServidor ? String(opcoes.senhaServidor) : null;
  const resumir = function (texto) { return crypto.createHash('sha256').update(String(texto)).digest(); };
  /* Os espaços nas pontas não contam — o .env também os tira
     (server.js, lerEnv), e um copiar-e-colar costuma trazer um. */
  const senhaDoServidorConfere = function (tentativa) {
    if (!senhaServidor || typeof tentativa !== 'string' || tentativa.length > 200) return false;
    const limpa = tentativa.trim();
    if (!limpa) return false;
    return crypto.timingSafeEqual(resumir(limpa), resumir(senhaServidor.trim()));
  };
  /* Daqui pode criar? No computador do servidor, sempre; de fora, só
     com a senha do servidor certa no corpo do pedido. */
  const podeCriarDaqui = function (pedido) {
    return doProprioComputador(pedido) || senhaDoServidorConfere(pedido.body && pedido.body.senhaServidor);
  };

  /* Criar campanha (inclusive de um backup, que pode trazer mapas): 8 MB. */
  /* A senha do Mestre é opcional: sem ela, a mesa só abre no navegador
     que a criou (o que é seguro, só menos prático). Vem conferida ANTES
     de criar — senha recusada não deixa campanha pela metade. */
  /* QUEM CRIA: só quem está no computador do servidor. Criar não pede
     chave nenhuma — aberto pelo túnel, qualquer um com o endereço
     enchia o servidor de campanhas (até o teto de 200, e aí nem o
     Mestre criava mais), de memória e de disco. Os jogadores entram
     pelo código; quem cria e restaura backup é o Mestre, em casa. */
  /* A ordem importa: limite e leitura do JSON ANTES da trava, porque a
     senha do servidor vem no corpo do pedido. */
  api.post('/campanhas', limite(10), express.json({ limit: '8mb' }), function (pedido, resposta, seguir) {
    if (podeCriarDaqui(pedido)) return seguir();
    /* Diz POR QUE recusou: cada caso pede uma coisa diferente de quem
       está tentando. Com a mesma frase para todos, a pessoa não tinha
       como saber o que mudar. */
    const pelaInternet = pedido.headers['cf-connecting-ip'] !== undefined;
    const tentouSenha = !!(pedido.body && pedido.body.senhaServidor);
    let motivo;
    if (senhaServidor && tentouSenha) motivo = 'A senha do servidor não confere.';
    else if (senhaServidor) motivo = 'Pelo link, criar campanha pede a senha do servidor.';
    else if (pelaInternet) motivo = 'Campanhas novas (e backups restaurados) só são criadas no computador onde o servidor está rodando: abra http://localhost:3000 nele. Para criar pelo link, defina a senha do servidor (PLAINUS_SENHA_SERVIDOR, no arquivo .env — veja o README).';
    else motivo = 'Campanhas novas (e backups restaurados) só são criadas no computador onde o servidor está rodando. Este pedido veio de outro computador (' + String(pedido.socket && pedido.socket.remoteAddress).slice(0, 45) + '): use o computador do servidor, em http://localhost:3000.';
    resposta.status(403).json({ erro: motivo });
  }, function (pedido, resposta) {
    const corpo = pedido.body || {};
    const comSenha = corpo.senha !== undefined && corpo.senha !== null && corpo.senha !== '';
    const problema = comSenha ? senhaValida(corpo.senha) : null;
    if (problema) return resposta.status(400).json({ erro: problema });
    const r = armazem.criar(corpo.estado);
    if (r.erro) return resposta.status(400).json({ erro: r.erro });
    const pronto = function () { resposta.json({ id: r.id, codigo: r.codigo, chave: r.chave, temSenha: armazem.temSenha(r.id) }); };
    if (!comSenha) return pronto();
    /* A senha pedida não foi guardada: a campanha também não fica. Antes,
       a mesa nascia SEM senha e quem criou achava que tinha uma. */
    const desfazer = function () {
      armazem.apagar(r.id);
      resposta.status(500).json({ erro: 'O servidor não conseguiu guardar a senha, e a campanha não foi criada. Tente de novo.' });
    };
    armazem.definirSenha(r.id, corpo.senha).then(function (v) {
      if (v && v.erro) return desfazer();
      pronto();
    }, desfazer);
  });

  /* "Daqui pode criar?" — a MESMA regra do POST /campanhas, para a tela
     avisar ANTES de a pessoa preencher a criação inteira (pelo túnel, o
     aviso só aparecia no fim). Só informa: quem decide continua sendo o
     /campanhas, que recusa do mesmo jeito se alguém pular o aviso. */
  /*   → { podeCriar, local, pedeSenha }
         local       no computador do servidor (senha do Mestre opcional)
         pedeSenha   de fora, com a senha do servidor ligada: a tela pede
                     a senha (e confere aqui, mandando { senhaServidor })
     O limite é o mesmo do /campanhas: é por aqui que alguém tentaria
     adivinhar a senha do servidor. */
  api.post('/pode-criar', limite(10), express.json({ limit: '2kb' }), function (pedido, resposta) {
    const local = doProprioComputador(pedido);
    resposta.json({ podeCriar: podeCriarDaqui(pedido), local: local, pedeSenha: !local && !!senhaServidor });
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
          return { campanhaId: String(m.campanhaId || '').slice(0, 40), jogadorId: typeof m.jogadorId === 'string' ? m.jogadorId.slice(0, 40) : null, papel: papel, semAcesso: true };
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
    armazem.entrarComoMestre(corpo.codigo, corpo.senha, chaveDoEndereco(quemPede(pedido))).then(function (r) {
      if (r.erro) return resposta.status(403).json({ erro: r.erro });
      resposta.json(r);
    }, function () {
      resposta.status(500).json({ erro: 'O servidor não conseguiu conferir a senha.' });
    });
  });

  /* ===================================================================
     AS CONTAS DE MESTRE (servidor/contas.js)
       POST /api/conta/estado      já há administrador? o pedido é daqui?
       POST /api/conta/admin       a PRIMEIRA conta (administrador): só no
                                   computador do servidor, e só sem nenhuma
       POST /api/conta/entrar      usuário + senha → sessão
       POST /api/conta/criar       convite + usuário + senha → conta e sessão
       POST /api/conta/nova-senha  convite de senha + senha nova → sessão
       POST /api/conta/eu          esta sessão ainda vale? → a conta
       POST /api/conta/sair        esta sessão deixa de valer
       POST /api/admin/...         convites e contas — só administrador
     =================================================================== */
  const comConta = function (rota, porMinuto, tratar) {
    api.post(rota, limite(porMinuto), express.json({ limit: '2kb' }), function (pedido, resposta) {
      if (!contas) return resposta.status(503).json({ erro: 'As contas não estão ligadas neste servidor.' });
      /* Só TEXTO passa: um objeto onde se espera um nome ({ toString: 1 })
         quebraria o String() lá dentro. O resto do corpo é jogado fora. */
      const corpo = {};
      const bruto = pedido.body && typeof pedido.body === 'object' ? pedido.body : {};
      Object.keys(bruto).forEach(function (k) { if (typeof bruto[k] === 'string') corpo[k] = bruto[k]; });
      let resultado;
      try {
        resultado = tratar(corpo, pedido, resposta);
      } catch (erro) {
        if (!resposta.headersSent) resposta.status(500).json({ erro: 'O servidor não conseguiu fazer isso.' });
        return;
      }
      if (resultado === undefined) return;
      Promise.resolve(resultado).then(function (r) {
        if (resposta.headersSent) return;
        if (r && r.erro) return resposta.status(400).json({ erro: r.erro });
        resposta.json(r || {});
      }, function () {
        if (!resposta.headersSent) resposta.status(500).json({ erro: 'O servidor não conseguiu fazer isso.' });
      });
    });
  };

  comConta('/conta/estado', 60, function (corpo, pedido) {
    return { temAdmin: contas.temAdmin(), local: doProprioComputador(pedido) };
  });

  comConta('/conta/admin', 10, function (corpo, pedido, resposta) {
    if (!doProprioComputador(pedido)) {
      resposta.status(403).json({ erro: 'A conta de administrador só se cria no computador onde o servidor está rodando (http://localhost:3000/admin.html).' });
      return undefined;
    }
    return contas.criarAdmin(corpo.usuario, corpo.senha).then(function (r) { return r.erro ? r : sessaoDaConta(r); });
  });

  comConta('/conta/entrar', 20, function (corpo, pedido) {
    return contas.entrar(corpo.usuario, corpo.senha, chaveDoEndereco(quemPede(pedido))).then(function (r) { return r.erro ? r : sessaoDaConta(r); });
  });

  comConta('/conta/criar', 10, function (corpo) {
    return contas.criarConta(corpo.convite, corpo.usuario, corpo.senha).then(function (r) { return r.erro ? r : sessaoDaConta(r); });
  });

  comConta('/conta/nova-senha', 10, function (corpo) {
    return contas.trocarSenhaComConvite(corpo.convite, corpo.senha).then(function (r) { return r.erro ? r : sessaoDaConta(r); });
  });

  comConta('/conta/eu', 120, function (corpo, pedido, resposta) {
    const conta = contaDoPedido(corpo);
    if (!conta) { resposta.status(401).json({ erro: 'Esta sessão não vale mais. Entre de novo.' }); return undefined; }
    return { conta: conta };
  });

  comConta('/conta/sair', 30, function (corpo) {
    /* Só grava se a chave era mesmo desta conta (contas.sair confere). */
    return contas.sair(corpo.contaId, corpo.chave);
  });

  comConta('/admin/convites', 60, function (corpo, pedido, resposta) {
    if (!soAdmin(corpo, resposta)) return undefined;
    return { convites: contas.listarConvites() };
  });

  comConta('/admin/convite', 30, function (corpo, pedido, resposta) {
    const admin = soAdmin(corpo, resposta);
    if (!admin) return undefined;
    return contas.criarConvite(admin.id, corpo.tipo === 'senha' ? 'senha' : 'mestre', corpo.paraConta);
  });

  comConta('/admin/revogar', 30, function (corpo, pedido, resposta) {
    const admin = soAdmin(corpo, resposta);
    if (!admin) return undefined;
    return contas.revogarConvite(admin.id, String(corpo.conviteId || ''));
  });

  comConta('/admin/contas', 60, function (corpo, pedido, resposta) {
    if (!soAdmin(corpo, resposta)) return undefined;
    return { contas: contas.listarContas() };
  });

  comConta('/admin/desativar', 20, function (corpo, pedido, resposta) {
    const admin = soAdmin(corpo, resposta);
    if (!admin) return undefined;
    return contas.desativarConta(admin.id, String(corpo.paraConta || ''));
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
      ? armazem.verificarSenha(id, corpo.senha, { erro: 'Senha errada.' }, chaveDoEndereco(quemPede(pedido)))
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
    /* Qualquer outro erro: uma frase, nunca a pilha do Node (que conta
       os caminhos das pastas deste computador). */
    if (!resposta.headersSent) return resposta.status(500).json({ erro: 'O servidor não conseguiu fazer isso.' });
    seguir(erro);
  });

  return api;
}

module.exports = { criarApi, quemPede, chaveDoEndereco, doProprioComputador };
