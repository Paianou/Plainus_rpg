/* ===================================================================
   servidor/contas.js — as contas de Mestre e os convites

   POR QUE EXISTE
   Até aqui, quem criava campanha pelo link do túnel provava que era o
   dono do servidor com a senha do .env. Isso serve a UM dono — não a um
   site aberto, onde cada Mestre tem de ser alguém. Daqui em diante, o
   Mestre tem uma CONTA (usuário + senha), e uma conta nova só nasce de
   um CONVITE que o administrador (o dono do servidor) gera.
   Os jogadores não têm conta: entram com o código da campanha e o nome,
   como sempre (armazem.js, entrarComoJogador).

   O QUE MORA AQUI (data/contas.json, fora do Git como todo o data/)
     contas     [{ id, usuario, admin, ativa, senha: { sal, resumo },
                   chaves: [resumo...], criadaEm }]
     convites   [{ id, resumo, tipo, criadoEm, expiraEm, usadoEm,
                   usadoPor, paraConta }]
   Nada aqui guarda um segredo em texto: a senha é o resumo scrypt, cada
   chave de sessão é o resumo sha256 (como as chaves das campanhas), e o
   convite também — quem ler o arquivo não consegue usar nenhum código.

   OS DOIS TIPOS DE CONVITE
     'mestre'  cria uma conta nova (uso único, 7 dias)
     'senha'   troca a senha de UMA conta — para quem esqueceu. É o
               "esqueci minha senha" sem e-mail: o administrador gera, e
               entrega à pessoa como entregaria um convite.

   A PRIMEIRA CONTA
   Sem nenhum administrador ainda, a primeira conta nasce sem convite e
   é a de administrador. Quem chama (a /api) só deixa isso acontecer no
   computador do servidor (doProprioComputador): quem está sentado nele
   é o dono.

   AS PEÇAS DE CHAVE E DE SENHA vêm do armazem.js (novaChave, scrypt,
   comparação em tempo constante): uma regra, um lugar.
   =================================================================== */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { sortearCodigo, normalizarCodigo } = require('../publico/modelo.js');
const { senhaValida, novaChave, resumoDaChave, chaveConfere, resumoDaSenha, limparNome, mesmoNome, SENHA_MAX } = require('./armazem.js');

const FORMATO = 'plainus-contas';
const VERSAO = 1;
const ID_CONTA = /^u[0-9a-f]{16}$/;
const ID_CONVITE = /^v[0-9a-f]{16}$/;

const LIMITE_CONTAS = 500;
const LIMITE_CHAVES = 10;              /* computadores por conta */
const LIMITE_CONVITES_ABERTOS = 50;    /* ainda não usados nem vencidos */
const VALIDADE_CONVITE = 7 * 24 * 60 * 60 * 1000;
const USUARIO_MIN = 3;

/* A mesma trava das senhas de campanha (armazem.js, verificarSenha):
   errou demais, espera — por pessoa (endereço) e por conta. */
const ERROS_ATE_TRAVAR = 10;
const ERROS_ATE_TRAVAR_CONTA = 100;
const JANELA_ERROS = 15 * 60 * 1000;

const RECUSA_ENTRAR = { erro: 'Usuário ou senha não conferem.' };
const RECUSA_CONVITE = { erro: 'Esse convite não vale: confira o código, ou peça outro (cada um vale uma vez, por 7 dias).' };
const TRAVADA = { erro: 'Tentativas erradas demais. Espere 15 minutos e tente de novo.' };


function vazio() {
  return { contas: [], convites: [] };
}

/* O arquivo vem do disco: confere por dentro, e o que não tem a forma
   certa fica de fora (como o modelo.js faz com as campanhas). */
function conferido(dados) {
  const limpo = vazio();
  if (!dados || typeof dados !== 'object') return limpo;
  const hex = function (x, n) { return typeof x === 'string' && new RegExp('^[0-9a-f]{' + n + '}$').test(x); };
  (Array.isArray(dados.contas) ? dados.contas : []).forEach(function (c) {
    if (!c || !ID_CONTA.test(c.id) || typeof c.usuario !== 'string' || !c.senha || !hex(c.senha.sal, 32) || !hex(c.senha.resumo, 64)) return;
    limpo.contas.push({
      id: c.id, usuario: limparNome(c.usuario), admin: c.admin === true, ativa: c.ativa !== false,
      senha: { sal: c.senha.sal, resumo: c.senha.resumo },
      chaves: (Array.isArray(c.chaves) ? c.chaves : []).filter(function (r) { return hex(r, 64); }).slice(-LIMITE_CHAVES),
      criadaEm: Number(c.criadaEm) || 0
    });
  });
  (Array.isArray(dados.convites) ? dados.convites : []).forEach(function (v) {
    if (!v || !ID_CONVITE.test(v.id) || !hex(v.resumo, 64) || (v.tipo !== 'mestre' && v.tipo !== 'senha')) return;
    limpo.convites.push({
      id: v.id, resumo: v.resumo, tipo: v.tipo,
      criadoEm: Number(v.criadoEm) || 0, expiraEm: Number(v.expiraEm) || 0,
      usadoEm: Number(v.usadoEm) || null, usadoPor: ID_CONTA.test(v.usadoPor) ? v.usadoPor : null,
      paraConta: ID_CONTA.test(v.paraConta) ? v.paraConta : null
    });
  });
  return limpo;
}

/* O resumo de um código de convite, do jeito que ele for digitado
   (minúsculo, sem hífen...): normalizado antes. */
function resumoDoConvite(codigo) {
  const normal = normalizarCodigo(String(codigo || ''));
  return normal ? resumoDaChave(normal) : null;
}


function criarContas(pastaDados, avisar) {
  const log = avisar || function () {};
  const arquivo = path.join(pastaDados, 'contas.json');
  let dados = vazio();
  const errosDeEntrada = new Map();   /* usuario normalizado → { desde, total, porQuem } */

  /* Só "o arquivo não existe" quer dizer "nenhuma conta ainda". Outro
     erro de leitura (um antivírus segurando o arquivo, uma permissão)
     PARA o servidor: começar vazio faria a próxima gravação apagar
     todas as contas — e reabriria a criação do administrador. Um
     arquivo que não é o nosso (estragado, ou de outro formato) é posto
     de lado (contas.json.ilegivel), nunca apagado. */
  function carregar() {
    fs.mkdirSync(pastaDados, { recursive: true });
    let texto;
    try {
      texto = fs.readFileSync(arquivo, 'utf8');
    } catch (erro) {
      if (erro.code === 'ENOENT') { dados = vazio(); return 0; }
      throw new Error('Não consegui ler ' + arquivo + ' (' + erro.code + '). O servidor não sobe sem as contas: feche o que estiver usando o arquivo e ligue de novo.');
    }
    let lido = null;
    try { lido = JSON.parse(texto); } catch (erro) { lido = null; }
    if (!lido || lido.formato !== FORMATO) {
      const deLado = arquivo + '.ilegivel-' + Date.now();
      fs.renameSync(arquivo, deLado);
      log('contas.json não é um arquivo de contas válido: guardado como ' + path.basename(deLado) + ', e o servidor começa sem contas.');
      dados = vazio();
      return 0;
    }
    dados = conferido(lido);
    return dados.contas.length;
  }

  /* Grava na hora, por um arquivo temporário (como o armazém): um
     desligamento no meio nunca deixa o contas.json pela metade. */
  function gravar() {
    fs.mkdirSync(pastaDados, { recursive: true });
    const temporario = arquivo + '.tmp';
    fs.writeFileSync(temporario, JSON.stringify({ formato: FORMATO, versao: VERSAO, contas: dados.contas, convites: dados.convites }));
    fs.renameSync(temporario, arquivo);
  }

  /* Muda, grava; se GRAVAR falhar, volta ao que era e devolve o erro.
     Uma recusa (r.erro) não chega a mudar nada — toda mudança aqui
     confere antes de mexer —, então não há o que desfazer: e não
     reconstruir os objetos importa, porque um entrar() esperando o
     scrypt ainda segura a conta dele. */
  function mudarEGravar(mudanca) {
    const antes = JSON.stringify(dados);
    const r = mudanca();
    if (r && r.erro) return r;
    try {
      gravar();
    } catch (erro) {
      dados = JSON.parse(antes);
      return { erro: 'Não consegui gravar no disco.' };
    }
    return r;
  }

  function novoId(prefixo) {
    return prefixo + crypto.randomBytes(8).toString('hex');
  }

  function acharConta(id) {
    return dados.contas.find(function (c) { return c.id === id; }) || null;
  }

  function acharPorUsuario(usuario) {
    return dados.contas.find(function (c) { return mesmoNome(c.usuario, usuario); }) || null;
  }

  /* O que sai daqui sobre uma conta: nunca a senha nem as chaves. */
  function publica(c) {
    return { id: c.id, usuario: c.usuario, admin: c.admin, ativa: c.ativa, criadaEm: c.criadaEm, computadores: c.chaves.length };
  }

  /* Usuário: o nome limpo (sem caracteres invisíveis, espaços juntados —
     armazem.js, limparNome), de 3 a 30 letras. */
  function usuarioValido(texto) {
    const usuario = limparNome(texto);
    if (usuario.length < USUARIO_MIN) return { erro: 'O usuário precisa de pelo menos ' + USUARIO_MIN + ' letras.' };
    return { usuario: usuario };
  }

  /* Uma chave de sessão nova para a conta (um computador a mais). */
  function abrirSessao(conta) {
    const chave = novaChave();
    conta.chaves = conta.chaves.concat(resumoDaChave(chave)).slice(-LIMITE_CHAVES);
    return chave;
  }

  function convitesAbertos(agora) {
    return dados.convites.filter(function (v) { return !v.usadoEm && v.expiraEm > agora; });
  }


  /* ---------- A primeira conta (o administrador) ---------- */

  function temAdmin() {
    return dados.contas.some(function (c) { return c.admin && c.ativa; });
  }

  /* Só sem nenhum administrador. Quem chama confere que o pedido vem do
     computador do servidor. Devolve uma Promise com { conta, chave }. */
  function criarAdmin(usuarioDigitado, senha) {
    if (temAdmin()) return Promise.resolve({ erro: 'O administrador já existe.' });
    const u = usuarioValido(usuarioDigitado);
    if (u.erro) return Promise.resolve(u);
    const problema = senhaValida(senha);
    if (problema) return Promise.resolve({ erro: problema });
    const sal = crypto.randomBytes(16).toString('hex');
    return resumoDaSenha(senha, sal).then(function (resumo) {
      let chave;
      const r = mudarEGravar(function () {
        if (temAdmin()) return { erro: 'O administrador já existe.' };
        if (acharPorUsuario(u.usuario)) return { erro: 'Esse usuário já existe.' };
        const conta = { id: novoId('u'), usuario: u.usuario, admin: true, ativa: true, senha: { sal: sal, resumo: resumo }, chaves: [], criadaEm: Date.now() };
        chave = abrirSessao(conta);
        dados.contas.push(conta);
        return { conta: conta };
      });
      return r.erro ? r : { conta: publica(r.conta), chave: chave };
    });
  }


  /* ---------- Convites ---------- */

  /* O administrador gera um convite. O CÓDIGO sai daqui uma vez só (é
     ele que se entrega à pessoa); no disco, fica o resumo.
     tipo 'senha' pede paraConta: a conta cuja senha ele troca. */
  function criarConvite(adminId, tipo, paraConta) {
    const admin = acharConta(adminId);
    if (!admin || !admin.admin || !admin.ativa) return { erro: 'Só o administrador gera convites.' };
    if (tipo !== 'mestre' && tipo !== 'senha') return { erro: 'Tipo de convite desconhecido.' };
    if (tipo === 'senha' && !acharConta(paraConta)) return { erro: 'Essa conta não existe.' };
    const agora = Date.now();
    if (convitesAbertos(agora).length >= LIMITE_CONVITES_ABERTOS) return { erro: 'Convites abertos demais. Revogue algum antes de gerar outro.' };
    const codigo = sortearCodigo();
    const r = mudarEGravar(function () {
      /* Os vencidos ou usados há mais de 30 dias saem da lista. */
      dados.convites = dados.convites.filter(function (v) { return (v.usadoEm || v.expiraEm) > agora - 30 * 24 * 60 * 60 * 1000; });
      const convite = { id: novoId('v'), resumo: resumoDaChave(codigo), tipo: tipo, criadoEm: agora, expiraEm: agora + VALIDADE_CONVITE, usadoEm: null, usadoPor: null, paraConta: tipo === 'senha' ? paraConta : null };
      dados.convites.push(convite);
      return { convite: convite };
    });
    if (r.erro) return r;
    return { id: r.convite.id, codigo: codigo, tipo: tipo, expiraEm: r.convite.expiraEm };
  }

  function listarConvites() {
    const agora = Date.now();
    return dados.convites.map(function (v) {
      const para = v.paraConta ? acharConta(v.paraConta) : null;
      const usou = v.usadoPor ? acharConta(v.usadoPor) : null;
      return {
        id: v.id, tipo: v.tipo, criadoEm: v.criadoEm, expiraEm: v.expiraEm,
        situacao: v.usadoEm ? 'usado' : (v.expiraEm <= agora ? 'vencido' : 'aberto'),
        usadoPor: usou ? usou.usuario : null, para: para ? para.usuario : null
      };
    });
  }

  function revogarConvite(adminId, conviteId) {
    const admin = acharConta(adminId);
    if (!admin || !admin.admin || !admin.ativa) return { erro: 'Só o administrador revoga convites.' };
    return mudarEGravar(function () {
      const antes = dados.convites.length;
      dados.convites = dados.convites.filter(function (v) { return v.id !== conviteId || v.usadoEm; });
      return dados.convites.length === antes ? { erro: 'Convite não encontrado (ou já usado).' } : {};
    });
  }

  /* O convite deste código, se ele ainda vale para este tipo. */
  function conviteValido(codigo, tipo) {
    const resumo = resumoDoConvite(codigo);
    if (!resumo) return null;
    const agora = Date.now();
    return dados.convites.find(function (v) {
      return v.tipo === tipo && !v.usadoEm && v.expiraEm > agora && crypto.timingSafeEqual(Buffer.from(v.resumo, 'hex'), Buffer.from(resumo, 'hex'));
    }) || null;
  }


  /* ---------- Criar conta com convite ---------- */

  /* Devolve uma Promise com { conta, chave } ou { erro }. */
  function criarConta(codigo, usuarioDigitado, senha) {
    if (!conviteValido(codigo, 'mestre')) return Promise.resolve(RECUSA_CONVITE);
    const u = usuarioValido(usuarioDigitado);
    if (u.erro) return Promise.resolve(u);
    if (acharPorUsuario(u.usuario)) return Promise.resolve({ erro: 'Esse usuário já existe. Escolha outro.' });
    const problema = senhaValida(senha);
    if (problema) return Promise.resolve({ erro: problema });
    if (dados.contas.length >= LIMITE_CONTAS) return Promise.resolve({ erro: 'O site já tem contas demais.' });
    const sal = crypto.randomBytes(16).toString('hex');
    return resumoDaSenha(senha, sal).then(function (resumo) {
      let chave;
      /* Confere de novo DEPOIS do scrypt: entre uma coisa e outra, outro
         pedido pode ter usado o mesmo convite ou o mesmo usuário. */
      const r = mudarEGravar(function () {
        const convite = conviteValido(codigo, 'mestre');
        if (!convite) return RECUSA_CONVITE;
        if (acharPorUsuario(u.usuario)) return { erro: 'Esse usuário já existe. Escolha outro.' };
        if (dados.contas.length >= LIMITE_CONTAS) return { erro: 'O site já tem contas demais.' };
        const conta = { id: novoId('u'), usuario: u.usuario, admin: false, ativa: true, senha: { sal: sal, resumo: resumo }, chaves: [], criadaEm: Date.now() };
        chave = abrirSessao(conta);
        dados.contas.push(conta);
        convite.usadoEm = Date.now();
        convite.usadoPor = conta.id;
        return { conta: conta };
      });
      return r.erro ? r : { conta: publica(r.conta), chave: chave };
    });
  }


  /* ---------- Entrar ---------- */

  /* A forma com que dois nomes são comparados (a do mesmoNome, no
     armazem.js): sem acento, sem maiúscula, sem caractere invisível. */
  function formaDoNome(texto) {
    return limparNome(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  /* A trava: conta os erros por CONTA (ou, sem conta, pela forma do
     nome), e dentro dela por pessoa. Pelo id da conta, e não pelo que
     foi digitado: "Bruna", "Brúna" e "BRUNA" chegam à mesma conta, e
     não podem ser três contagens separadas. As contagens velhas saem
     de tempos em tempos — senão um monte de nomes inventados encheria
     a memória. */
  function contaDeErros(usuario) {
    const achada = acharPorUsuario(usuario);
    const chave = achada ? achada.id : 'nome:' + formaDoNome(usuario);
    const agora = Date.now();
    if (errosDeEntrada.size > 1000) {
      errosDeEntrada.forEach(function (c, k) { if (agora - c.desde > JANELA_ERROS) errosDeEntrada.delete(k); });
      /* Ainda muitas: saem as de nomes que NÃO existem. As das contas de
         verdade ficam — senão encher a memória zeraria a trava delas. */
      if (errosDeEntrada.size > 5000) errosDeEntrada.forEach(function (c, k) { if (k.indexOf('nome:') === 0) errosDeEntrada.delete(k); });
    }
    let c = errosDeEntrada.get(chave);
    if (c && agora - c.desde > JANELA_ERROS) { errosDeEntrada.delete(chave); c = null; }
    if (!c) { c = { desde: agora, total: 0, porQuem: new Map() }; errosDeEntrada.set(chave, c); }
    return c;
  }

  /* O scrypt custa memória e uns 50 ms de processador. Pedidos de entrar
     com nomes inventados, em quantidade, ocupariam o servidor inteiro:
     no máximo 2 rodam ao mesmo tempo, mais uns poucos esperam, e o resto
     ouve "tente de novo". */
  const SCRYPT_JUNTOS = 2;
  const SCRYPT_NA_FILA = 20;
  let rodando = 0;
  const fila = [];
  function comVaga(trabalho) {
    if (rodando >= SCRYPT_JUNTOS && fila.length >= SCRYPT_NA_FILA) return Promise.resolve({ erro: 'O servidor está ocupado. Tente de novo em alguns segundos.' });
    return new Promise(function (resolver) {
      const comecar = function () {
        rodando += 1;
        Promise.resolve().then(trabalho).then(function (r) { terminar(); resolver(r); }, function (e) { terminar(); resolver({ erro: 'O servidor não conseguiu conferir a senha.' }); });
      };
      if (rodando < SCRYPT_JUNTOS) comecar(); else fila.push(comecar);
    });
  }
  function terminar() {
    rodando -= 1;
    const proximo = fila.shift();
    if (proximo) proximo();
  }

  /* Usuário + senha. A mesma mensagem para "não existe" e "senha
     errada": não conta a quem tenta quais usuários existem. Devolve uma
     Promise com { conta, chave } ou { erro }. */
  function entrar(usuarioDigitado, senha, quem) {
    return comVaga(function () { return entrarAgora(usuarioDigitado, senha, quem); });
  }

  function entrarAgora(usuarioDigitado, senha, quem) {
    if (typeof senha !== 'string' || !senha || senha.length > SENHA_MAX) return Promise.resolve(RECUSA_ENTRAR);
    const erros = contaDeErros(usuarioDigitado);
    const pessoa = String(quem || '');
    const meus = erros.porQuem.get(pessoa) || 0;
    if (meus >= ERROS_ATE_TRAVAR || erros.total >= ERROS_ATE_TRAVAR_CONTA) return Promise.resolve(TRAVADA);
    erros.porQuem.set(pessoa, meus + 1);
    erros.total += 1;

    const conta = acharPorUsuario(usuarioDigitado);
    /* Sem conta, o scrypt roda do mesmo jeito (com um sal qualquer): o
       tempo da resposta não diz se o usuário existe. */
    const guardada = conta && conta.ativa ? conta.senha : { sal: '0'.repeat(32), resumo: '0'.repeat(64) };
    return resumoDaSenha(senha, guardada.sal).then(function (resumo) {
      const certo = crypto.timingSafeEqual(Buffer.from(resumo, 'hex'), Buffer.from(guardada.resumo, 'hex'));
      if (!certo || !conta || !conta.ativa) return RECUSA_ENTRAR;
      /* Acertou: os erros desta pessoa nesta conta zeram. */
      erros.total = Math.max(0, erros.total - (erros.porQuem.get(pessoa) || 0));
      erros.porQuem.delete(pessoa);
      /* Entre o scrypt e aqui, a senha pode ter sido trocada (convite de
         senha) ou a conta desativada: então esta senha já não vale. */
      let chave;
      let agora;
      const r = mudarEGravar(function () {
        agora = acharConta(conta.id);
        if (!agora || !agora.ativa || agora.senha.resumo !== guardada.resumo) return RECUSA_ENTRAR;
        chave = abrirSessao(agora);
        return {};
      });
      return r.erro ? r : { conta: publica(agora), chave: chave };
    });
  }

  /* Esta chave abre esta conta? Devolve a conta (pública) ou null. */
  function conferirSessao(contaId, chave) {
    const conta = ID_CONTA.test(String(contaId)) ? acharConta(contaId) : null;
    if (!conta || !conta.ativa) return null;
    return conta.chaves.some(function (r) { return chaveConfere(chave, r); }) ? publica(conta) : null;
  }

  /* Sair neste computador: só esta chave deixa de valer. */
  function sair(contaId, chave) {
    const conta = acharConta(contaId);
    if (!conta) return {};
    if (!conta.chaves.some(function (r) { return chaveConfere(chave, r); })) return {};
    return mudarEGravar(function () {
      conta.chaves = conta.chaves.filter(function (r) { return !chaveConfere(chave, r); });
      return {};
    });
  }


  /* ---------- Nova senha (convite do tipo 'senha') ---------- */

  /* Quem esqueceu a senha recebe do administrador um convite de senha.
     Trocar derruba todas as sessões da conta: um computador que alguém
     achou com a conta aberta deixa de valer. Devolve uma Promise com
     { conta, chave } (já entra) ou { erro }. */
  function trocarSenhaComConvite(codigo, senha) {
    const convite = conviteValido(codigo, 'senha');
    if (!convite) return Promise.resolve(RECUSA_CONVITE);
    const problema = senhaValida(senha);
    if (problema) return Promise.resolve({ erro: problema });
    const sal = crypto.randomBytes(16).toString('hex');
    return resumoDaSenha(senha, sal).then(function (resumo) {
      let chave;
      let conta;
      const r = mudarEGravar(function () {
        const ainda = conviteValido(codigo, 'senha');
        conta = ainda && acharConta(ainda.paraConta);
        /* Conta desativada não volta por um convite de senha: desativar
           é decisão do administrador, e se desfaz só por ele. */
        if (!ainda || !conta || !conta.ativa) return RECUSA_CONVITE;
        conta.senha = { sal: sal, resumo: resumo };
        conta.chaves = [];
        chave = abrirSessao(conta);
        ainda.usadoEm = Date.now();
        ainda.usadoPor = conta.id;
        return {};
      });
      return r.erro ? r : { conta: publica(conta), chave: chave };
    });
  }


  /* ---------- O administrador cuida das contas ---------- */

  function listarContas() {
    return dados.contas.map(publica);
  }

  /* Desativar: a conta não entra mais, e as sessões dela caem. O
     administrador não desativa a si mesmo (o site ficaria sem dono). */
  function desativarConta(adminId, contaId) {
    const admin = acharConta(adminId);
    if (!admin || !admin.admin || !admin.ativa) return { erro: 'Só o administrador desativa contas.' };
    if (adminId === contaId) return { erro: 'O administrador não desativa a própria conta.' };
    return mudarEGravar(function () {
      const conta = acharConta(contaId);
      if (!conta) return { erro: 'Essa conta não existe.' };
      conta.ativa = false;
      conta.chaves = [];
      /* Os convites de senha abertos para ela caem junto. */
      dados.convites = dados.convites.filter(function (v) { return !(v.tipo === 'senha' && v.paraConta === contaId && !v.usadoEm); });
      return {};
    });
  }

  return {
    carregar, temAdmin, criarAdmin, criarConvite, listarConvites, revogarConvite,
    criarConta, entrar, conferirSessao, sair, trocarSenhaComConvite, listarContas, desativarConta
  };
}

module.exports = { criarContas, ID_CONTA };
