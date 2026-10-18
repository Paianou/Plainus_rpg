/* ===================================================================
   modelo.js — o que É uma campanha (o navegador e o servidor dividem)

   Duas coisas que os dois lados precisam saber igual:
     estadoVazio()        o molde: todas as chaves que as telas leem,
                          sem conteúdo. Uma campanha nova nasce dele, e
                          uma campanha antiga é aplicada POR CIMA dele
                          (se um dia uma chave nova entrar aqui, as
                          campanhas antigas ganham o valor vazio dela
                          em vez de quebrar a tela).
     conferirCampanha(c)  recebe uma campanha que veio DE FORA (um
                          backup, um arquivo do disco, um pedido pela
                          rede) e devolve a versão limpa — ou um texto
                          dizendo o que está errado.

   Mesmo padrão do acoes.js: no navegador, entra por <script> antes do
   dados.js; no servidor, por require(). Tudo que é interno fica fechado
   no bloco abaixo, e só saem os dois nomes.
   =================================================================== */

const { estadoVazio, conferirCampanha, sortearCodigo, normalizarCodigo, imagemSegura, imagemDaCena, retratoSeguro, regrasPersonagem, LIMITE_RETRATO, marcarAreaNaCena, casasDaArea, RAIO_AREA } = (function () {

function estadoVazio() {
  return {
    campanha: {
      nome: '', sistema: '', codigo: '',
      premissa: '', cenario: '', tom: '',
      /* Ferramenta de segurança da mesa. Linhas: o que nunca entra no
         jogo. Véus: o que pode acontecer, mas "fora de cena", sem
         descrição. Campanhas antigas têm só 'limites', que a edição
         trata como linhas. */
      linhas: '', veus: '',
      nivelInicial: 1, jogadores: 4,
      regra: '',                 /* as regras da casa — o códice mostra */
      /* Como os jogadores criam o personagem. Lido pela ficha do
         jogador sempre através de regrasPersonagem(), que completa o
         que faltar — campanhas antigas não têm este campo. */
      regrasPersonagem: { atributos: 'compra', pv: 'media', talentos: true, multiclasse: false },
      sessao: 1, capitulo: 'I', nivelMedio: 1
    },
    mestre: { nome: '' },
    grupo: { nome: 'A party' },
    herois: [],
    cenaAtual: null,
    cenas: [],
    combate: {
      ativo: false, rodada: 1, encontro: '', dificuldade: '', nd: '',
      combatentes: [], registro: []
    },
    acoesDaVez: [],
    rolagens: [],
    npc: null,                   /* o gerador da Visão Geral sorteia na hora */
    diario: [],
    segredos: [],
    pendencias: [],
    faccoes: [],
    npcs: [],
    tesouro: '',
    fixadas: [],
    audio: { pista: 'Cripta dos Ancestrais (loop)', volume: 42, tocando: false },
    tabelasMinhas: [],
    monstrosMeus: [],
    fotosMonstros: {},           /* nome do monstro do livro → retrato */
    rolagensTabela: [],
    rolagensMesa: [],            /* as rolagens dos jogadores (visao.js) */
    mensagens: [],               /* o chat: da mesa e privadas (visao.js, chat.js) */
    avisosVistos: []
  };
}

/* null e undefined contam como "não veio"; lista não passa por objeto
   (typeof [] também é 'object'). No molde, null quer dizer "ainda
   nada": cenaAtual guarda o id da cena (texto), npc guarda um objeto. */
function mesmoTipo(valor, modelo) {
  if (valor === null || valor === undefined) return modelo === null;
  if (modelo === null) return typeof valor === 'string' || (typeof valor === 'object' && !Array.isArray(valor));
  if (Array.isArray(modelo)) return Array.isArray(valor);
  if (typeof modelo === 'object') return typeof valor === 'object' && !Array.isArray(valor);
  return typeof valor === typeof modelo;
}

/* Cada parte da campanha tem de ter o MESMO tipo que tem no molde:
   lista onde é lista, texto onde é texto. O que não bater fica com o
   valor do molde. Chaves que o molde não conhece são descartadas — não
   há por que guardar o que nenhuma tela lê (e um "__proto__" vindo de
   fora não entra em lugar nenhum). */
function conferirCampanha(salvo) {
  if (!salvo || typeof salvo !== 'object' || Array.isArray(salvo)
      || !salvo.campanha || typeof salvo.campanha !== 'object'
      || typeof salvo.campanha.nome !== 'string' || !salvo.campanha.nome.trim()) {
    return 'O arquivo está incompleto: falta a campanha, ou o nome dela.';
  }

  const molde = estadoVazio();
  const limpo = {};
  Object.keys(molde).forEach(function (chave) {
    const valor = salvo[chave];
    limpo[chave] = mesmoTipo(valor, molde[chave]) ? valor : molde[chave];
  });

  /* Dentro de "campanha", o mesmo cuidado com os campos principais:
     a lista de campanhas e a entrada leem estes direto. */
  limpo.campanha.nome = limpo.campanha.nome.trim().slice(0, 60);
  if (typeof limpo.campanha.sistema !== 'string') limpo.campanha.sistema = '';
  if (typeof limpo.campanha.codigo !== 'string') limpo.campanha.codigo = '';
  if (!(limpo.campanha.sessao >= 1)) limpo.campanha.sessao = 1;
  if (typeof limpo.mestre.nome !== 'string') limpo.mestre.nome = '';

  conferirPorDentro(limpo);
  return limpo;
}

/* ---------- Por dentro das listas ----------
   Conferir só o primeiro nível ("cenas é uma lista") não basta: as
   telas e a visão do jogador (visao.js) leem DENTRO de cada item —
   cena.paredes.map, mensagem.autor.papel. Um backup com uma cena sem
   paredes, ou um null no meio da lista de mensagens, derrubava o
   servidor no instante em que alguém entrava na mesa.
   Aqui, cada lista fica só com itens do tipo certo, e os pedaços que
   a visão lê por dentro ganham o valor vazio quando faltam. Numa
   campanha que o próprio site gravou, nada muda. */
const LISTAS_DE_OBJETOS = ['herois', 'cenas', 'rolagens', 'diario', 'segredos', 'pendencias', 'faccoes', 'npcs',
  'tabelasMinhas', 'monstrosMeus', 'rolagensTabela', 'rolagensMesa', 'mensagens'];
const LISTAS_DE_TEXTOS = ['acoesDaVez', 'fixadas', 'avisosVistos'];

function ehObjeto(x) {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

function soLista(x) {
  return Array.isArray(x) ? x : [];
}

function conferirPorDentro(limpo) {
  LISTAS_DE_OBJETOS.forEach(function (chave) { limpo[chave] = limpo[chave].filter(ehObjeto); });
  LISTAS_DE_TEXTOS.forEach(function (chave) { limpo[chave] = limpo[chave].filter(function (x) { return typeof x === 'string'; }); });

  /* Cada parede é [coluna, linha, largura, altura]: quatro números. */
  limpo.cenas.forEach(function (cena) {
    cena.paredes = soLista(cena.paredes).filter(function (p) {
      return Array.isArray(p) && p.length === 4 && p.every(function (n) { return typeof n === 'number' && isFinite(n); });
    });
    cena.tokens = soLista(cena.tokens).filter(ehObjeto);
    cena.marcadores = soLista(cena.marcadores).filter(ehObjeto);
    /* Área sem centro ou sem raio em número não tem como ser desenhada. */
    cena.areas = soLista(cena.areas).filter(function (a) {
      return ehObjeto(a) && typeof a.dono === 'string'
        && [a.x, a.y, a.raio].every(function (n) { return typeof n === 'number' && isFinite(n); });
    });
  });

  /* Mensagem sem autor ou sem canal não tem como ser mostrada a ninguém. */
  limpo.mensagens = limpo.mensagens.filter(function (m) { return ehObjeto(m.autor) && typeof m.canal === 'string'; });

  const combate = limpo.combate;
  combate.combatentes = soLista(combate.combatentes).filter(ehObjeto);
  combate.combatentes.forEach(function (x) { if (x.condicoes !== undefined && !Array.isArray(x.condicoes)) x.condicoes = []; });
  combate.registro = soLista(combate.registro).filter(ehObjeto);
}

/* ---------- As imagens ----------
   Uma imagem guardada só vale se for de confiança — senão, null. O site
   só grava imagens que ele mesmo recomprimiu em JPEG (imagens.js). Vale
   de dois jeitos: o JPEG em texto (como sai do navegador) ou o endereço
   img/<resumo>.jpg (como fica depois que o servidor a tira da campanha
   — ver servidor/imagens.js). Esta
   conferência existe porque a imagem vem de fora (do navegador de
   alguém, pela rede) — e um endereço qualquer num <img> ou num <image>
   do SVG não é coisa para aceitar às cegas (um SVG pode levar script).
   `limite` é o tamanho máximo do texto (ver Imagens.PERFIS). */
const LIMITE_IMAGEM_CENA = 700000;
const LIMITE_RETRATO = 160000;

function imagemSegura(imagem, limite) {
  return typeof imagem === 'string'
    && imagem.length <= (limite || LIMITE_IMAGEM_CENA)
    && /^(data:image\/jpeg;base64,[A-Za-z0-9+/=]+|img\/[0-9a-f]{64}\.jpg)$/.test(imagem)
    ? imagem : null;
}

/* A imagem de fundo de uma cena (Mapas e a planta.js). */
function imagemDaCena(cena) {
  return imagemSegura(cena && cena.imagem, LIMITE_IMAGEM_CENA);
}

/* O retrato de um personagem ou de um monstro. */
function retratoSeguro(imagem) {
  return imagemSegura(imagem, LIMITE_RETRATO);
}

/* ---------- As áreas na planta ----------
   A "bola de fogo": um círculo na cena que a mesa inteira vê.
   Uma área: { id, x, y, raio, dono, nome }.
     x, y   o centro, em casas, de meia em meia. 3 é a linha da grade
            entre a casa 2 e a 3 — o canto, onde o livro põe o centro de
            uma esfera; 3,5 é o meio da casa 3, para centrar numa
            criatura.
     raio   em metros, de 1,5 em 1,5 (uma casa = 1,5 m).
     dono   'mestre' ou 'j:' + o id do jogador. Cada um tem UMA área por
            cena: marcar de novo muda a sua, em vez de empilhar. O dono
            nunca vai para o jogador (visao.js manda só "minha").
     nome   quem marcou, para a etiqueta ("Lyra · 6 m").
   O Mestre (acoes.js) e o jogador (visao.js) passam pela MESMA função:
   a regra do que é uma área válida mora num lugar só. O id vem de quem
   chama, porque cada lado tem o seu jeito de sortear. */
const RAIO_AREA = [1.5, 36];
const LIMITE_AREAS = 20;

function marcarAreaNaCena(cena, dono, nome, dados, id) {
  if (!cena) return { erro: 'Nenhuma cena aberta.' };
  function meia(valor, maximo) {
    const n = Number(valor);
    return Number.isFinite(n) ? Math.min(Math.max(Math.round(n * 2) / 2, 0), maximo) : null;
  }
  const x = meia(dados.x, cena.colunas);
  const y = meia(dados.y, cena.linhas);
  if (x === null || y === null) return { erro: 'Escolha o centro da área no mapa.' };
  const pedido = Number(dados.raio);
  if (!Number.isFinite(pedido) || pedido < RAIO_AREA[0] || pedido > RAIO_AREA[1]) return { erro: 'O raio vai de 1,5 a 36 m.' };
  const raio = Math.round(pedido / 1.5) * 1.5;

  cena.areas = Array.isArray(cena.areas) ? cena.areas : [];
  const antiga = cena.areas.find(function (a) { return a.dono === dono; });
  if (!antiga && cena.areas.length >= LIMITE_AREAS) return { erro: 'Áreas demais nesta cena.' };
  const area = { id: antiga ? antiga.id : id, x: x, y: y, raio: raio, dono: dono, nome: String(nome || '').slice(0, 30) || '?' };
  if (antiga) Object.assign(antiga, area);
  else cena.areas.push(area);
  return { id: area.id };
}

/* As casas que a área pega: as que têm o CENTRO dentro do círculo. O
   Guia do Mestre diz que a casa entra se a área cobre metade dela; o
   centro é o jeito simples de contar isso, e o mesmo para todos.
   (A régua usa outra regra — a diagonal conta uma casa —, porque ela
   mede caminho, não área.) */
function casasDaArea(area, cena) {
  const r = area.raio / 1.5;
  const casas = [];
  const c0 = Math.max(0, Math.floor(area.x - r)), c1 = Math.min(cena.colunas - 1, Math.ceil(area.x + r));
  const l0 = Math.max(0, Math.floor(area.y - r)), l1 = Math.min(cena.linhas - 1, Math.ceil(area.y + r));
  for (let lin = l0; lin <= l1; lin++) {
    for (let col = c0; col <= c1; col++) {
      const dx = col + 0.5 - area.x;
      const dy = lin + 0.5 - area.y;
      if (dx * dx + dy * dy <= r * r + 1e-9) casas.push({ col: col, lin: lin });
    }
  }
  return casas;
}

/* As regras de criação de personagem da campanha, sempre completas:
   campanhas criadas antes desta regra existir não têm o objeto, e quem
   lê não deve ter de lembrar disso. */
function regrasPersonagem(estado) {
  const campanha = (estado && estado.campanha) || {};
  return Object.assign(
    { atributos: 'compra', pv: 'media', talentos: true, multiclasse: false },
    campanha.regrasPersonagem
  );
}


/* ---------- O código de convite ----------
   "K7QM-2XRP-9HVD": 12 sorteios num alfabeto de 32 = 32^12 ≈ 10^18
   combinações (a mesa-virtual usava 3 letras + 4 dígitos, adivinhável
   por tentativa — problema 3 do CLAUDE.md). Sem 0/O nem 1/I: o código é
   lido em voz alta e digitado por outra pessoa. crypto, e não
   Math.random (previsível); 256 é múltiplo de 32, então byte % 32 dá a
   mesma chance a cada letra. */
const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function sortearCodigo() {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  let letras = '';
  bytes.forEach(function (byte) { letras += ALFABETO_CODIGO[byte % ALFABETO_CODIGO.length]; });
  return letras.slice(0, 4) + '-' + letras.slice(4, 8) + '-' + letras.slice(8, 12);
}

/* Aceita o código do jeito que a pessoa colar — minúsculo, sem hífen,
   com espaço, ou o LINK de convite inteiro ("…/index.html#convite=
   K7QM-2XRP-9HVD", que é o que o botão de convite copia quando a mesa
   está no ar) — e devolve no formato certo, ou null se não for um
   código possível. Do link, vale só o que vem depois de "convite=":
   as letras do endereço não podem entrar na conta. */
function normalizarCodigo(texto) {
  let bruto = String(texto);
  const doLink = /convite=([^&\s]+)/i.exec(bruto);
  if (doLink) {
    try { bruto = decodeURIComponent(doLink[1]); } catch (erro) { bruto = doLink[1]; }
  }
  const limpo = bruto.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (limpo.length !== 12) return null;
  for (let i = 0; i < limpo.length; i++) {
    if (ALFABETO_CODIGO.indexOf(limpo[i]) === -1) return null;
  }
  return limpo.slice(0, 4) + '-' + limpo.slice(4, 8) + '-' + limpo.slice(8, 12);
}

return { estadoVazio: estadoVazio, conferirCampanha: conferirCampanha, sortearCodigo: sortearCodigo, normalizarCodigo: normalizarCodigo, imagemSegura: imagemSegura, imagemDaCena: imagemDaCena, retratoSeguro: retratoSeguro, regrasPersonagem: regrasPersonagem, LIMITE_RETRATO: LIMITE_RETRATO, marcarAreaNaCena: marcarAreaNaCena, casasDaArea: casasDaArea, RAIO_AREA: RAIO_AREA };
})();


if (typeof module !== 'undefined' && module.exports) {
  module.exports = { estadoVazio: estadoVazio, conferirCampanha: conferirCampanha, sortearCodigo: sortearCodigo, normalizarCodigo: normalizarCodigo, imagemSegura: imagemSegura, imagemDaCena: imagemDaCena, retratoSeguro: retratoSeguro, regrasPersonagem: regrasPersonagem, LIMITE_RETRATO: LIMITE_RETRATO, marcarAreaNaCena: marcarAreaNaCena, casasDaArea: casasDaArea, RAIO_AREA: RAIO_AREA };
}
