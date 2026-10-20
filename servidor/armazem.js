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

   A SENHA DO MESTRE
   A chave de Mestre mora no navegador onde a campanha foi criada. Para
   o Mestre abrir a mesa de OUTRO computador, ele define uma senha: quem
   der o código de convite + a senha certa ganha uma chave de Mestre
   nova, só daquele computador (até 10; a mais antiga sai).
   A senha, ao contrário das chaves, é inventada por gente — e gente
   repete senha e usa palavras. Por isso ela é guardada com scrypt: um
   resumo LENTO e com SAL (bytes sorteados por campanha). Lento, para
   cada tentativa de adivinhar custar caro; com sal, para a mesma senha
   em duas campanhas dar resumos diferentes. Errar a senha muitas vezes
   seguidas trava a entrada daquela campanha por um tempo.
   A senha nunca entra na campanha (o Estado) nem no backup.

   AS IMAGENS E OS LIMITES
   Mapas e retratos moram fora da campanha (servidor/imagens.js). Toda
   mudança passa por aplicar(): ela roda a mudança, tira as imagens de
   dentro e confere os limites — imagens demais, ou campanha grande
   demais, e a mudança é DESFEITA, com o motivo. (Problema 4 do
   CLAUDE.md: sem limite, dava para encher a memória e o disco.)

   Este arquivo NÃO sabe nada de rede: só guarda, devolve e confere
   chaves. Quem decide quem pode o quê é o server.js.
   =================================================================== */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { conferirCampanha, sortearCodigo, normalizarCodigo } = require('../publico/modelo.js');
const { criarImagens } = require('./imagens.js');

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
const LIMITE_CHAVES_MESTRE = 10;
/* A campanha em texto, SEM as imagens (que já moram fora): uma mesa de
   verdade, com anos de diário, fica bem abaixo disto. */
const LIMITE_ESTADO = 3 * 1024 * 1024;
const SENHA_MIN = 8;
const SENHA_MAX = 100;
/* Erros de senha seguidos numa campanha, dentro da janela, travam a
   entrada como Mestre — de quem errou, ou da mesa toda se forem muitos
   somando todo mundo — até a janela passar (ver verificarSenha). */
const ERROS_ATE_TRAVAR = 10;          /* por pessoa (endereço) */
const ERROS_ATE_TRAVAR_MESA = 100;    /* somando todo mundo */
const JANELA_ERROS = 15 * 60 * 1000;
/* scrypt: N = 2^14 (custo), r = 8, p = 1 — uns 16 MB e algumas dezenas
   de milissegundos por tentativa. */
const SCRYPT = { N: 16384, r: 8, p: 1 };


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

/* ---------- Senha ---------- */

function senhaValida(senha) {
  if (typeof senha !== 'string' || senha.length < SENHA_MIN) return 'A senha precisa de pelo menos ' + SENHA_MIN + ' caracteres.';
  if (senha.length > SENHA_MAX) return 'A senha pode ter até ' + SENHA_MAX + ' caracteres.';
  return null;
}

function resumoDaSenha(senha, salHex) {
  return new Promise(function (resolver, recusar) {
    crypto.scrypt(senha.normalize('NFC'), Buffer.from(salHex, 'hex'), 32, SCRYPT, function (erro, chave) {
      if (erro) recusar(erro); else resolver(chave.toString('hex'));
    });
  });
}

function acessosVazios() {
  return { mestres: [], senha: null, jogadores: {} };
}

/* O que vem do disco também é conferido: só resumos em hexadecimal,
   ids de jogador no formato do site, nomes curtos. */
function acessosConferidos(a) {
  const limpo = acessosVazios();
  if (!a || typeof a !== 'object') return limpo;
  const hex64 = function (x) { return typeof x === 'string' && /^[0-9a-f]{64}$/.test(x); };
  /* Arquivos de antes da senha tinham uma chave de Mestre só ("mestre"). */
  const mestres = Array.isArray(a.mestres) ? a.mestres : [a.mestre];
  limpo.mestres = mestres.filter(hex64).slice(-LIMITE_CHAVES_MESTRE);
  if (a.senha && hex64(a.senha.resumo) && typeof a.senha.sal === 'string' && /^[0-9a-f]{32}$/.test(a.senha.sal)) {
    limpo.senha = { sal: a.senha.sal, resumo: a.senha.resumo };
  }
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
/* Um nome como ele é guardado: sem caracteres invisíveis (largura zero,
   controle) e com os espaços juntados — senão "Ana" e "Ana" com um
   caractere invisível no meio seriam duas pessoas diferentes para o
   servidor e a mesma para quem lê o chat. Até 30 letras. */
function limparNome(x) {
  return String(x || '').replace(/[\p{Cf}\p{Cc}]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 30);
}

function mesmoNome(a, b) {
  const n = function (x) { return limparNome(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); };
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
  const imagens = criarImagens(pastaDados, log);
  const todosOsEstados = function () { return Array.from(campanhas.values()).map(function (c) { return c.estado; }); };

  /* Imagem que nenhuma campanha usa: apagada ao ligar, ao apagar uma
     campanha, e de hora em hora (um mapa trocado deixa o antigo sem uso). */
  function limparImagens() {
    try { return imagens.limpar(todosOsEstados()); } catch (erro) { log('Não consegui limpar as imagens: ' + erro.message); return 0; }
  }
  setInterval(limparImagens, 60 * 60 * 1000).unref();


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
        if (!acessos.mestres.length) log('Aviso: ' + nome + ' não tem chave de Mestre (arquivo copiado à mão?). Traga campanhas pelo "Restaurar backup" da entrada.');
        campanhas.set(id, {
          estado: estado,
          acessos: acessos,
          criadaEm: Number(envelope.criadaEm) || Date.now(),
          atualizadaEm: Number(envelope.atualizadaEm) || Date.now()
        });
        /* Campanha de antes das imagens irem para fora: elas saem agora,
           uma vez, e o arquivo é regravado já leve. */
        if (imagens.extrair(estado).mudou) gravarAgora(id);
      } catch (erro) {
        log('Deixei de lado ' + nome + ' (' + erro.message + '). O arquivo continua lá.');
      }
    });
    limparImagens();
    return campanhas.size;
  }


  /* ---------- Gravar ---------- */

  /* Grava já. Se der erro, ele sobe para quem chamou — e a gravação
     agrupada que estivesse esperando CONTINUA esperando: o relógio só é
     desligado depois que o arquivo foi trocado de verdade. (Antes, ele
     era desligado primeiro; um erro no meio — no Windows, o antivírus
     segurando o arquivo — deixava a mudança só na memória, sem nova
     tentativa, nem ao desligar.) */
  function gravarAgora(id) {
    const c = campanhas.get(id);
    if (!c) return;
    /* O envelope do disco leva os RESUMOS das chaves; o backup que a
       pessoa baixa (envelopeDeBackup) não leva nem isso. */
    const envelope = { formato: FORMATO, versao: VERSAO, criadaEm: c.criadaEm, atualizadaEm: c.atualizadaEm, acessos: c.acessos, estado: c.estado };
    const final = arquivoDe(id);
    const temporario = final + '.tmp';
    fs.writeFileSync(temporario, JSON.stringify(envelope));
    fs.renameSync(temporario, final);
    const relogio = aGravar.get(id);
    if (relogio) { clearTimeout(relogio); aGravar.delete(id); }
  }

  /* Marca a campanha para gravar daqui a `espera` ms. Se a gravação
     falhar, marca de novo — até conseguir. */
  const ESPERA_NOVA_TENTATIVA = 5000;
  function agendar(id, espera) {
    if (aGravar.has(id)) return;
    aGravar.set(id, setTimeout(function () {
      aGravar.delete(id);
      try {
        gravarAgora(id);
      } catch (erro) {
        log('Não consegui gravar ' + id + ' (' + erro.message + '). Tento de novo em ' + ESPERA_NOVA_TENTATIVA / 1000 + ' s.');
        agendar(id, ESPERA_NOVA_TENTATIVA);
      }
    }, espera));
  }

  /* "Esta campanha mudou": grava daqui a pouco, junto com o que mais mudar. */
  function mudou(id) {
    const c = campanhas.get(id);
    if (!c) return;
    c.atualizadaEm = Date.now();
    agendar(id, ESPERA_GRAVAR);
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
    imagens.extrair(estado);
    const problema = passouDosLimites(estado);
    if (problema) return { erro: problema };

    const codigo = normalizarCodigo(estado.campanha.codigo);
    estado.campanha.codigo = codigo && !acharPorCodigo(codigo) ? codigo : codigoLivre();

    const id = novoId();
    const agora = Date.now();
    const chave = novaChave();
    const acessos = acessosVazios();
    acessos.mestres = [resumoDaChave(chave)];
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


  /* ---------- Mudar, com limites ---------- */

  function passouDosLimites(estado) {
    if (imagens.espacoDe(estado) > imagens.ESPACO_POR_CAMPANHA) {
      return 'As imagens desta campanha passariam de ' + Math.round(imagens.ESPACO_POR_CAMPANHA / 1048576) + ' MB. Tire mapas ou retratos que não usa mais.';
    }
    if (JSON.stringify(estado).length > LIMITE_ESTADO) return 'A campanha ficaria grande demais. Apague o que não usa mais (rolagens antigas, cenas, anotações).';
    return null;
  }

  /* O ÚNICO jeito de mudar uma campanha que já existe (as ações do
     Mestre e dos jogadores, pela mesa). `mudanca(estado)` muda o estado
     no lugar e devolve o resultado da ação ({ erro } recusa). Depois:
     as imagens saem para data/imagens, os limites são conferidos e, se
     algo der errado, o estado volta a ser o de antes. */
  function aplicar(id, mudanca) {
    const c = ID_CAMPANHA.test(String(id)) && campanhas.get(id);
    if (!c) return { erro: 'Campanha não encontrada.' };
    const antes = JSON.stringify(c.estado);
    const voltar = function () {
      const velho = JSON.parse(antes);
      Object.keys(c.estado).forEach(function (k) { delete c.estado[k]; });
      Object.assign(c.estado, velho);
    };
    let resultado;
    try {
      resultado = mudanca(c.estado) || {};
    } catch (erro) {
      voltar();
      throw erro;
    }
    if (resultado.erro) { voltar(); return resultado; }
    if (imagens.extrair(c.estado).recusadas) { voltar(); return { erro: 'Essa imagem não foi aceita: o site só guarda JPEG de até ' + Math.round(imagens.TAMANHO_MAXIMO / 1024) + ' KB.' }; }
    const problema = passouDosLimites(c.estado);
    if (problema) { voltar(); return { erro: problema }; }
    mudou(id);
    return resultado;
  }


  /* ---------- Acesso ---------- */

  /* Esta chave abre esta campanha neste papel? */
  function conferirAcesso(id, papel, jogadorId, chave) {
    const c = ID_CAMPANHA.test(String(id)) && campanhas.get(id);
    if (!c) return false;
    if (papel === 'mestre') return c.acessos.mestres.some(function (r) { return chaveConfere(chave, r); });
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
    const nome = limparNome(nomeDigitado);
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

  /* ---------- A senha do Mestre ---------- */

  function temSenha(id) {
    const c = campanhas.get(id);
    return !!(c && c.acessos.senha);
  }

  /* Define (ou troca) a senha. Quem chama já conferiu que é o Mestre.
     Devolve uma Promise com {} ou { erro }. */
  function definirSenha(id, senha) {
    const c = ID_CAMPANHA.test(String(id)) && campanhas.get(id);
    if (!c) return Promise.resolve({ erro: 'Campanha não encontrada.' });
    const problema = senhaValida(senha);
    if (problema) return Promise.resolve({ erro: problema });
    const sal = crypto.randomBytes(16).toString('hex');
    return resumoDaSenha(senha, sal).then(function (resumo) {
      const antes = c.acessos.senha;
      c.acessos.senha = { sal: sal, resumo: resumo };
      try {
        gravarAgora(id);
      } catch (erro) {
        c.acessos.senha = antes;
        return { erro: 'Não consegui gravar a senha no disco.' };
      }
      return {};
    });
  }

  /* id → { desde, total, porQuem: Map(endereço → erros) }: as tentativas
     erradas recentes de cada campanha.

     A TRAVA É POR PESSOA, COM UM TETO PARA A MESA
     Antes, 10 erros de QUALQUER um travavam a campanha — e todo jogador
     tem o código: bastava errar 10 vezes de propósito para o Mestre não
     conseguir entrar de outro computador. Agora cada endereço tem os
     seus 10 erros; quem erra trava só a si. E, somando todo mundo, 100
     erros na janela travam a mesa: é o que segura quem tentasse de
     muitos endereços ao mesmo tempo.

     A TENTATIVA CONTA ANTES DE CONFERIR
     O scrypt leva dezenas de milissegundos, sem segurar o servidor.
     Se o erro só fosse contado no fim, vinte tentativas mandadas JUNTAS
     leriam todas "zero erros" e passariam pela trava. Contada na
     entrada, cada uma já enxerga as outras; a que acerta é descontada. */
  const errosDeSenha = new Map();
  const TRAVADA = { erro: 'Senha errada vezes demais. A entrada como Mestre desta mesa está travada por alguns minutos.' };

  /* A senha confere? Conta os erros e trava depois de muitos seguidos.
     `quem` é o endereço de quem tenta (servidor/api.js). Devolve uma
     Promise com { ok: true } ou { erro } — o erro de senha errada é
     `recusa`, para quem chama escolher as palavras. */
  function verificarSenha(id, senha, recusa, quem) {
    const c = campanhas.get(id);
    if (!c || !c.acessos.senha) return Promise.resolve(recusa);
    if (typeof senha !== 'string' || !senha || senha.length > SENHA_MAX) return Promise.resolve(recusa);

    const agora = Date.now();
    let conta = errosDeSenha.get(id);
    if (conta && agora - conta.desde > JANELA_ERROS) { errosDeSenha.delete(id); conta = null; }
    if (!conta) { conta = { desde: agora, total: 0, porQuem: new Map() }; errosDeSenha.set(id, conta); }
    const pessoa = String(quem || '');
    const meus = conta.porQuem.get(pessoa) || 0;
    if (meus >= ERROS_ATE_TRAVAR || conta.total >= ERROS_ATE_TRAVAR_MESA) return Promise.resolve(TRAVADA);

    conta.porQuem.set(pessoa, meus + 1);
    conta.total += 1;
    /* Esta tentativa não era erro (acertou, ou o servidor falhou):
       sai da conta — se a conta ainda for a mesma janela. */
    const descontar = function () {
      if (errosDeSenha.get(id) !== conta) return;
      conta.porQuem.set(pessoa, Math.max(0, (conta.porQuem.get(pessoa) || 0) - 1));
      conta.total = Math.max(0, conta.total - 1);
    };

    const guardada = c.acessos.senha;
    return resumoDaSenha(senha, guardada.sal).then(function (resumo) {
      const a = Buffer.from(resumo, 'hex');
      const b = Buffer.from(guardada.resumo, 'hex');
      if (!crypto.timingSafeEqual(a, b)) return recusa;
      /* Acertou: os erros SEGUIDOS desta pessoa zeram. */
      descontar();
      if (errosDeSenha.get(id) === conta) {
        conta.total = Math.max(0, conta.total - (conta.porQuem.get(pessoa) || 0));
        conta.porQuem.delete(pessoa);
        if (!conta.total) errosDeSenha.delete(id);
      }
      return { ok: true };
    }, function (erro) {
      descontar();
      throw erro;
    });
  }

  /* Entrar como Mestre num computador novo: código de convite + senha.
     Devolve uma Promise com { campanhaId, chave, nome } ou { erro }. A
     mensagem de erro é a mesma para "código errado" e "senha errada":
     não conta a quem tenta qual dos dois acertou. */
  function entrarComoMestre(codigo, senha, quem) {
    const recusa = { erro: 'Código ou senha não conferem.' };
    const id = acharPorCodigo(codigo);
    if (!id) return Promise.resolve(recusa);
    const c = campanhas.get(id);
    if (!c.acessos.senha) return Promise.resolve({ erro: 'Esta mesa ainda não tem senha de Mestre. Defina uma em "Editar campanha", no computador onde a mesa foi criada.' });

    return verificarSenha(id, senha, recusa, quem).then(function (v) {
      if (v.erro) return v;
      const chave = novaChave();
      c.acessos.mestres = c.acessos.mestres.concat(resumoDaChave(chave)).slice(-LIMITE_CHAVES_MESTRE);
      try {
        gravarAgora(id);
      } catch (erro) {
        return { erro: 'Não consegui gravar a entrada no disco.' };
      }
      return { campanhaId: id, chave: chave, nome: c.estado.mestre.nome };
    });
  }

  /* ---------- O Mestre cuida dos acessos ---------- */

  /* Quem tem acesso: quantos computadores de Mestre, e cada jogador com
     o personagem dele. Os resumos das chaves não saem daqui. */
  function listarAcessos(id) {
    const c = campanhas.get(id);
    if (!c) return null;
    const jogadores = c.acessos.jogadores;
    return {
      nome: c.estado.campanha.nome,
      temSenha: !!c.acessos.senha,
      computadoresDoMestre: c.acessos.mestres.length,
      jogadores: Object.keys(jogadores).map(function (jid) {
        const heroi = (c.estado.herois || []).find(function (h) { return h.dono === jid; });
        return { jogadorId: jid, nome: jogadores[jid].nome, personagem: heroi ? heroi.nome : null };
      })
    };
  }

  /* Libera o lugar de um jogador (perdeu o navegador, trocou de
     computador): a chave dele deixa de valer e o nome fica livre. O
     personagem continua na campanha — e quem entrar de novo com o mesmo
     nome o reivindica (ver entrarComoJogador). */
  function liberarJogador(id, jogadorId) {
    const c = campanhas.get(id);
    if (!c || !Object.prototype.hasOwnProperty.call(c.acessos.jogadores, jogadorId)) return { erro: 'Esse jogador não está nesta mesa.' };
    const antes = c.acessos.jogadores[jogadorId];
    delete c.acessos.jogadores[jogadorId];
    try {
      gravarAgora(id);
    } catch (erro) {
      c.acessos.jogadores[jogadorId] = antes;
      return { erro: 'Não consegui gravar no disco.' };
    }
    return { nome: antes.nome };
  }

  /* O jogador troca o próprio nome (o Perfil dele). O nome mora em DOIS
     lugares, e os dois mudam juntos:
       - acessos.jogadores[jogadorId].nome   o nome com que ele entrou
       - heroi.jogador, em cada herói dele   é por este que, depois de o
         Mestre liberar o lugar, quem entra com o MESMO nome recupera o
         personagem (entrarComoJogador)
     Por isso o nome novo não pode ser o de outra pessoa da mesa — nem o
     de um personagem esperando o dono voltar: quem entrasse com ele
     levaria o personagem errado. Se gravar falhar, nada muda. */
  function renomearJogador(id, jogadorId, nomeDigitado) {
    const c = ID_CAMPANHA.test(String(id)) && campanhas.get(id);
    if (!c || !Object.prototype.hasOwnProperty.call(c.acessos.jogadores, jogadorId)) return { erro: 'Esse jogador não está nesta mesa.' };
    const nome = limparNome(nomeDigitado);
    if (!nome) return { erro: 'Diga como a mesa te chama.' };

    const jogadores = c.acessos.jogadores;
    /* O mesmo nome de agora, letra por letra: nada a gravar. */
    if (jogadores[jogadorId].nome === nome) return { nome: nome, igual: true };
    const deOutro = Object.keys(jogadores).some(function (jid) { return jid !== jogadorId && mesmoNome(jogadores[jid].nome, nome); });
    const esperando = (c.estado.herois || []).some(function (h) {
      return h.dono && h.dono !== jogadorId && !Object.prototype.hasOwnProperty.call(jogadores, h.dono) && mesmoNome(h.jogador, nome);
    });
    if (deOutro || esperando) return { erro: 'Já tem alguém com esse nome nesta mesa. Escolha outro.' };

    const antes = jogadores[jogadorId].nome;
    const heroisAntes = (c.estado.herois || []).map(function (h) { return h.jogador; });
    jogadores[jogadorId].nome = nome;
    (c.estado.herois || []).forEach(function (h) { if (h.dono === jogadorId) h.jogador = nome; });
    const atualizadaAntes = c.atualizadaEm;
    c.atualizadaEm = Date.now();
    try {
      gravarAgora(id);
    } catch (erro) {
      jogadores[jogadorId].nome = antes;
      (c.estado.herois || []).forEach(function (h, i) { h.jogador = heroisAntes[i]; });
      c.atualizadaEm = atualizadaAntes;
      return { erro: 'Não consegui gravar no disco.' };
    }
    return { nome: nome };
  }

  /* Só ESTA chave de Mestre continua valendo: os outros computadores do
     Mestre saem (um computador perdido, uma senha que vazou). */
  function manterSoEstaChave(id, chave) {
    const c = campanhas.get(id);
    if (!c || !conferirAcesso(id, 'mestre', null, chave)) return { erro: 'Só o Mestre desta campanha faz isso.' };
    const antes = c.acessos.mestres;
    c.acessos.mestres = [resumoDaChave(chave)];
    try {
      gravarAgora(id);
    } catch (erro) {
      c.acessos.mestres = antes;
      return { erro: 'Não consegui gravar no disco.' };
    }
    return { sairam: antes.length - 1 };
  }

  /* O que vai num backup baixado: a campanha, sem chave nenhuma. */
  function envelopeDeBackup(id) {
    const c = campanhas.get(id);
    if (!c) return null;
    /* As imagens voltam para dentro: o backup é um arquivo só. */
    return { formato: FORMATO, versao: VERSAO, exportadoEm: new Date().toISOString(), estado: imagens.embutir(c.estado) };
  }

  function apagar(id) {
    if (!campanhas.has(id)) return false;
    const relogio = aGravar.get(id);
    if (relogio) { clearTimeout(relogio); aGravar.delete(id); }
    campanhas.delete(id);
    try { fs.unlinkSync(arquivoDe(id)); } catch (erro) { /* já não estava lá */ }
    limparImagens();
    return true;
  }

  return { carregar, listar, ler, resumo, acharPorCodigo, criar, apagar, mudou, gravarPendentes, gravarAgora,
    conferirAcesso, nomeDoJogador, entrarComoJogador, envelopeDeBackup, temSenha, definirSenha, entrarComoMestre,
    verificarSenha, listarAcessos, liberarJogador, renomearJogador, manterSoEstaChave, aplicar, limparImagens, arquivoDeImagem: imagens.arquivo };
}

module.exports = { criarArmazem, ID_CAMPANHA, senhaValida };
