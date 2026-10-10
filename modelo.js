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

const { estadoVazio, conferirCampanha, sortearCodigo, normalizarCodigo } = (function () {

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

  return limpo;
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
   com espaço — e devolve no formato certo, ou null se não for um
   código possível. */
function normalizarCodigo(texto) {
  const limpo = String(texto).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (limpo.length !== 12) return null;
  for (let i = 0; i < limpo.length; i++) {
    if (ALFABETO_CODIGO.indexOf(limpo[i]) === -1) return null;
  }
  return limpo.slice(0, 4) + '-' + limpo.slice(4, 8) + '-' + limpo.slice(8, 12);
}

return { estadoVazio: estadoVazio, conferirCampanha: conferirCampanha, sortearCodigo: sortearCodigo, normalizarCodigo: normalizarCodigo };
})();


if (typeof module !== 'undefined' && module.exports) {
  module.exports = { estadoVazio: estadoVazio, conferirCampanha: conferirCampanha, sortearCodigo: sortearCodigo, normalizarCodigo: normalizarCodigo };
}
