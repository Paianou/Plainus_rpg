/* ===================================================================
   servidor/armazem.js — onde as campanhas moram no servidor

   Na memória, para responder rápido; no disco, para sobreviver ao
   servidor desligar. Uma campanha = um arquivo:

     data/campanhas/c1a2b3c4d5e6f7a8b.json

   O ARQUIVO É UM BACKUP
   O formato é o mesmo do "Baixar backup" da tela de entrada
   ({ formato: 'plainus-campanha', versao, estado }). Então qualquer
   arquivo desta pasta pode ser copiado para um pendrive e restaurado
   em outro lugar — e um backup antigo pode ser trazido para cá.

   GRAVAÇÃO SEGURA
   Escreve num arquivo temporário e só depois troca pelo definitivo
   (rename). Se a luz cair no meio, sobra o arquivo ANTIGO inteiro,
   nunca um arquivo pela metade.

   GRAVAÇÃO AGRUPADA
   Pintar parede gera várias mudanças por segundo. Cada mudança marca a
   campanha como "a gravar", e ela é gravada um instante depois — uma
   vez só, com tudo junto. Ao desligar o servidor, gravarPendentes()
   grava o que faltar antes de sair.

   O QUE VEM DO DISCO TAMBÉM É CONFERIDO
   Um arquivo editado à mão, ou cortado no meio, passa pelo mesmo
   conferirCampanha() do backup (modelo.js). Arquivo que não se salva é
   avisado e deixado de lado — nunca apagado: pode ser recuperado à mão.

   AS CHAVES DE ACESSO
   Quem CRIA a campanha recebe a chave do Mestre; quem ENTRA com o código
   recebe a chave dele, de jogador. As chaves são sorteadas aqui (24
   bytes de crypto) e entregues uma única vez — ao navegador da pessoa.
   O arquivo guarda só o RESUMO de cada chave (sha256), nunca a chave:
   quem copiar a pasta data/ não consegue se passar por ninguém. (Uma
   chave sorteada de 24 bytes não precisa do "sal lento" que uma senha
   inventada por gente precisa — não há dicionário que a adivinhe.)

   Isto resolve dois problemas da lista do CLAUDE.md:
     1. "Qualquer um vira Mestre" — Mestre é quem tem a chave de quem
        criou; o código de convite só faz jogador.
     2. "Identidade autodeclarada" — dizer "sou a Ana" não basta: a Ana
        é quem tem a chave da Ana.

   Este arquivo NÃO sabe nada de rede: só guarda, devolve e confere
   chaves. Quem decide quem pode o quê é o server.js.
   =================================================================== */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { conferirCampanha, sortearCodigo, normalizarCodigo } = require('../modelo.js');

const FORMATO = 'plainus-campanha';
const VERSAO = 1;

/* O id que o site gera: 'c' + 16 caracteres de 0-9a-f. É também o nome
   do arquivo — por isso nunca aceitamos outra forma: um id como
   '../../algo' nunca chega a virar caminho no disco. */
const ID_CAMPANHA = /^c[0-9a-f]{16}$/;

/* A espera da gravação agrupada; os testes usam 0 (grava na hora). */
const ESPERA_GRAVAR = Number.isFinite(Number(process.env.PLAINUS_ESPERA_GRAVAR)) ? Number(process.env.PLAINUS_ESPERA_GRAVAR) : 800;
const LIMITE_CAMPANHAS = 200;
const LIMITE_JOGADORES = 12;


/* ---------- Chaves ---------- */

function novaChave() {
  return crypto.randomBytes(24).toString('base64url');
}

function resumoDaChave(chave) {
  return crypto.createHash('sha256').update(String(chave)).digest('hex');
}

/* Compara em tempo constante: uma comparação comum para no primeiro
   caractere diferente, e o tempo da resposta contaria quantos acertos
   o atacante já tem. */
function chaveConfere(chave, resumoGuardado) {
  if (typeof chave !== 'string' || !chave || typeof resumoGuardado !== 'string') return false;
  const a = Buffer.from(resumoDaChave(chave), 'hex');
  const b = Buffer.from(resumoGuardado, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function acessosVazios() {
  return { mestre: null, jogadores: {} };
}

/* O que vem do disco também é conferido: só resumos em hexadecimal,
   ids de jogador no formato do site, nomes curtos. */
function acessosConferidos(a) {
  const limpo = acessosVazios();
  if (!a || typeof a !== 'object') return limpo;
  if (typeof a.mestre === 'string' && /^[0-9a-f]{64}$/.test(a.mestre)) limpo.mestre = a.mestre;
  Object.keys(a.jogadores || {}).forEach(function (id) {
    const j = a.jogadores[id];
    if (/^j[0-9a-f]{16}$/.test(id) && j && typeof j.resumo === 'string' && /^[0-9a-f]{64}$/.test(j.resumo)) {
      limpo.jogadores[id] = { nome: String(j.nome || '').slice(0, 30), resumo: j.resumo };
    }
  });
  return limpo;
}

/* Nomes comparados sem maiúscula, acento nem espaço sobrando: "Ana",
   "ana " e "Ána" são a mesma pessoa na mesa. */
function mesmoNome(a, b) {
  const n = function (x) { return String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase(); };
  return n(a) === n(b);
}


function criarArmazem(pastaDados, avisar) {
  const log = avisar || function () {};
  const pasta = path.join(pastaDados, 'campanhas');
  fs.mkdirSync(pasta, { recursive: true });

  /* id → { estado, criadaEm, atualizadaEm } */
  const campanhas = new Map();
  /* id → o relógio da gravação agrupada */
  const aGravar = new Map();

  const arquivoDe = function (id) { return path.join(pasta, id + '.json'); };


  /* ---------- Ler o disco, ao ligar ---------- */

  function carregar() {
    fs.readdirSync(pasta).forEach(function (nome) {
      const id = nome.replace(/\.json$/, '');
      if (!nome.endsWith('.json') || !ID_CAMPANHA.test(id)) return;   /* .tmp e o que não for nosso */
      try {
        const envelope = JSON.parse(fs.readFileSync(arquivoDe(id), 'utf8'));
        if (!envelope || envelope.formato !== FORMATO) throw new Error('não é uma campanha do Plainus');
        const estado = conferirCampanha(envelope.estado);
        if (typeof estado === 'string') throw new Error(estado);
        const acessos = acessosConferidos(envelope.acessos);
        if (!acessos.mestre) log('Aviso: ' + nome + ' não tem chave de Mestre (arquivo copiado à mão?). Traga campanhas pelo "Restaurar backup" da entrada.');
        campanhas.set(id, {
          estado: estado,
          acessos: acessos,
          criadaEm: Number(envelope.criadaEm) || Date.now(),
          atualizadaEm: Number(envelope.atualizadaEm) || Date.now()
        });
      } catch (erro) {
        log('Deixei de lado ' + nome + ' (' + erro.message + '). O arquivo continua lá.');
      }
    });
    return campanhas.size;
  }


  /* ---------- Gravar ---------- */

  function gravarAgora(id) {
    const relogio = aGravar.get(id);
    if (relogio) { clearTimeout(relogio); aGravar.delete(id); }
    const c = campanhas.get(id);
    if (!c) return;
    /* O envelope do disco leva os RESUMOS das chaves; o backup que a
       pessoa baixa (envelopeDeBackup) não leva nem isso. */
    const envelope = { formato: FORMATO, versao: VERSAO, criadaEm: c.criadaEm, atualizadaEm: c.atualizadaEm, acessos: c.acessos, estado: c.estado };
    const final = arquivoDe(id);
    const temporario = final + '.tmp';
    fs.writeFileSync(temporario, JSON.stringify(envelope));
    fs.renameSync(temporario, final);
  }

  /* "Esta campanha mudou": grava daqui a pouco, junto com o que mais mudar. */
  function mudou(id) {
    const c = campanhas.get(id);
    if (!c) return;
    c.atualizadaEm = Date.now();
    if (aGravar.has(id)) return;
    aGravar.set(id, setTimeout(function () {
      try { gravarAgora(id); } catch (erro) { log('Não consegui gravar ' + id + ': ' + erro.message); }
    }, ESPERA_GRAVAR));
  }

  /* Ao desligar: grava o que ainda estava esperando. */
  function gravarPendentes() {
    Array.from(aGravar.keys()).forEach(function (id) {
      try { gravarAgora(id); } catch (erro) { log('Não consegui gravar ' + id + ': ' + erro.message); }
    });
  }


  /* ---------- Consultar ---------- */

  /* A linha de cada campanha, para listas — tirada do próprio estado,
     nunca guardada à parte (assim o nome na lista nunca discorda do
     nome dentro da campanha). */
  function resumo(id) {
    const c = campanhas.get(id);
    return {
      id: id,
      nome: c.estado.campanha.nome,
      sistema: c.estado.campanha.sistema,
      mestre: c.estado.mestre.nome,
      codigo: c.estado.campanha.codigo,
      sessao: c.estado.campanha.sessao,
      criadaEm: c.criadaEm,
      atualizadaEm: c.atualizadaEm
    };
  }

  function listar() {
    return Array.from(campanhas.keys()).map(resumo)
      .sort(function (a, b) { return b.atualizadaEm - a.atualizadaEm; });
  }

  /* O estado VIVO da campanha (o mesmo objeto que as ações mudam). */
  function ler(id) {
    const c = ID_CAMPANHA.test(String(id)) && campanhas.get(id);
    return c ? c.estado : null;
  }

  function acharPorCodigo(texto) {
    const codigo = normalizarCodigo(texto);
    if (!codigo) return null;
    for (const [id, c] of campanhas) {
      if (c.estado.campanha.codigo === codigo) return id;
    }
    return null;
  }


  /* ---------- Criar e apagar ---------- */

  function novoId() {
    let id;
    do { id = 'c' + crypto.randomBytes(8).toString('hex'); } while (campanhas.has(id));
    return id;
  }

  function codigoLivre() {
    let codigo;
    do { codigo = sortearCodigo(); } while (acharPorCodigo(codigo));
    return codigo;
  }

  /* Cria a partir de um estado que veio de fora (a criação em etapas,
     ou um backup). Devolve { id, codigo } ou { erro }. O código de
     convite é mantido se for válido e estiver livre; senão, sorteia
     outro — dois convites iguais apontariam para duas campanhas. */
  function criar(estadoDeFora) {
    if (campanhas.size >= LIMITE_CAMPANHAS) return { erro: 'Este servidor já tem campanhas demais.' };
    const estado = conferirCampanha(estadoDeFora);
    if (typeof estado === 'string') return { erro: estado };

    const codigo = normalizarCodigo(estado.campanha.codigo);
    estado.campanha.codigo = codigo && !acharPorCodigo(codigo) ? codigo : codigoLivre();

    const id = novoId();
    const agora = Date.now();
    const chave = novaChave();
    const acessos = acessosVazios();
    acessos.mestre = resumoDaChave(chave);
    campanhas.set(id, { estado: estado, acessos: acessos, criadaEm: agora, atualizadaEm: agora });
    try {
      gravarAgora(id);          /* criar é raro e importante: grava na hora */
    } catch (erro) {
      campanhas.delete(id);
      return { erro: 'Não consegui gravar a campanha no disco: ' + erro.message };
    }
    /* A chave sai daqui UMA vez: o servidor não tem como mostrá-la de novo. */
    return { id: id, codigo: estado.campanha.codigo, chave: chave };
  }


  /* ---------- Acesso ---------- */

  /* Esta chave abre esta campanha neste papel? */
  function conferirAcesso(id, papel, jogadorId, chave) {
    const c = ID_CAMPANHA.test(String(id)) && campanhas.get(id);
    if (!c) return false;
    if (papel === 'mestre') return chaveConfere(chave, c.acessos.mestre);
    if (papel === 'jogador') {
      const j = Object.prototype.hasOwnProperty.call(c.acessos.jogadores, jogadorId) && c.acessos.jogadores[jogadorId];
      return !!j && chaveConfere(chave, j.resumo);
    }
    return false;
  }

  function nomeDoJogador(id, jogadorId) {
    const c = campanhas.get(id);
    const j = c && Object.prototype.hasOwnProperty.call(c.acessos.jogadores, jogadorId) && c.acessos.jogadores[jogadorId];
    return j ? j.nome : null;
  }

  /* Entrar com o código como jogador. Devolve { jogadorId, chave, nome }
     ou { erro }.
       - Nome que já tem dono (outra chave) nesta mesa: recusado. Quem é
         dono de verdade volta pelo cartão em "Suas mesas".
       - Personagem que veio de um backup (já existe, mas ninguém tem a
         chave dele ainda): quem entra com o nome do jogador daquele
         personagem o reivindica, uma vez — e daí ele fica protegido.
       - Senão: jogador novo, chave nova. */
  function entrarComoJogador(id, nomeDigitado) {
    const c = ID_CAMPANHA.test(String(id)) && campanhas.get(id);
    if (!c) return { erro: 'Campanha não encontrada.' };
    const nome = String(nomeDigitado || '').trim().slice(0, 30);
    if (!nome) return { erro: 'Diga como a mesa te chama.' };

    const jogadores = c.acessos.jogadores;
    const jaTemDono = Object.keys(jogadores).some(function (jid) { return mesmoNome(jogadores[jid].nome, nome); });
    if (jaTemDono) return { erro: 'Já tem alguém com esse nome nesta mesa. Se é você, volte pelo cartão da mesa em "Suas mesas", no navegador onde entrou da primeira vez.' };
    if (Object.keys(jogadores).length >= LIMITE_JOGADORES) return { erro: 'Esta mesa já está cheia.' };

    const semDono = (c.estado.herois || []).find(function (h) {
      return h.dono && mesmoNome(h.jogador, nome) && !Object.prototype.hasOwnProperty.call(jogadores, h.dono) && /^j[0-9a-f]{16}$/.test(h.dono);
    });
    let jogadorId = semDono ? semDono.dono : null;
    while (!jogadorId || Object.prototype.hasOwnProperty.call(jogadores, jogadorId)) jogadorId = 'j' + crypto.randomBytes(8).toString('hex');

    const chave = novaChave();
    jogadores[jogadorId] = { nome: nome, resumo: resumoDaChave(chave) };
    try {
      gravarAgora(id);
    } catch (erro) {
      delete jogadores[jogadorId];
      return { erro: 'Não consegui gravar a entrada no disco.' };
    }
    return { jogadorId: jogadorId, chave: chave, nome: nome, reivindicou: !!semDono };
  }

  /* O que vai num backup baixado: a campanha, sem chave nenhuma. */
  function envelopeDeBackup(id) {
    const c = campanhas.get(id);
    if (!c) return null;
    return { formato: FORMATO, versao: VERSAO, exportadoEm: new Date().toISOString(), estado: c.estado };
  }

  function apagar(id) {
    if (!campanhas.has(id)) return false;
    const relogio = aGravar.get(id);
    if (relogio) { clearTimeout(relogio); aGravar.delete(id); }
    campanhas.delete(id);
    try { fs.unlinkSync(arquivoDe(id)); } catch (erro) { /* já não estava lá */ }
    return true;
  }

  return { carregar, listar, ler, resumo, acharPorCodigo, criar, apagar, mudou, gravarPendentes, gravarAgora,
    conferirAcesso, nomeDoJogador, entrarComoJogador, envelopeDeBackup };
}

module.exports = { criarArmazem, ID_CAMPANHA };
