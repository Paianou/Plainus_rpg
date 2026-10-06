/* ===================================================================
   campanhas.js — onde as campanhas e a sessão ficam guardadas

   Até aqui o Estado vivia no sessionStorage e morria com a aba. Agora
   existe "campanha": cada uma com id, código de convite e os próprios
   dados, guardados no localStorage — que sobrevive a fechar o
   navegador. É o que permite ter mais de uma campanha e continuar
   amanhã de onde parou.

   Este arquivo é o ÚNICO que sabe os nomes das chaves e o formato do
   que está guardado. A entrada (app.js), a criação de campanha e o
   painel (dados.js, layout.js) só chamam as funções daqui. Quando o
   servidor chegar, é este arquivo que troca o localStorage por
   pedidos ao servidor — e o resto do site nem percebe.


   O QUE FICA GUARDADO

     plainus:sessao            quem está usando agora
                                 { papel: 'mestre', campanhaId }
                                 { papel: 'jogador', campanhaId, nome }

     plainus:campanhas         o ÍNDICE: uma lista curta, uma linha por
                               campanha (nome, sistema, mestre, código,
                               sessão). É o que a tela de entrada lista.

     plainus:campanha:<id>     o Estado inteiro de UMA campanha.

   Por que separar índice e Estado: para listar as campanhas na
   entrada não é preciso abrir o Estado de todas — que tem heróis,
   NPCs, diário, mapas. A lista lê uma chave pequena.

   O índice é DERIVADO do Estado (ver resumoDe): ele é atualizado toda
   vez que o Estado é salvo. Assim o nome na lista nunca discorda do
   nome dentro da campanha.


   LIMITE HONESTO
   localStorage é do navegador, não da mesa. A campanha criada neste
   computador só existe neste computador — o código de convite só
   funciona aqui. É andaime: o passo do servidor (CLAUDE.md, passo 8)
   leva isto para o disco dele, e aí o código vale para todo mundo.
   =================================================================== */

const CHAVE_SESSAO = 'plainus:sessao';
const CHAVE_INDICE = 'plainus:campanhas';
const PREFIXO_CAMPANHA = 'plainus:campanha:';

/* Sem 0/O nem 1/I: o código é lido em voz alta e digitado por outra
   pessoa, e esses pares se confundem. 32 letras — ver gerarCodigo(). */
const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';


/* ---------- Ler e gravar sem quebrar ----------
   O localStorage pode falhar: aba anônima com armazenamento bloqueado,
   espaço cheio, ou um valor que alguém editou à mão no DevTools e não
   é mais JSON. Nenhuma dessas situações pode derrubar a página. */

const Armazem = {

  ler: function (chave) {
    try {
      const bruto = localStorage.getItem(chave);
      return bruto ? JSON.parse(bruto) : null;
    } catch (erro) {
      return null;
    }
  },

  /* Devolve false se não conseguiu — quem chamou decide como avisar. */
  gravar: function (chave, valor) {
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
      return true;
    } catch (erro) {
      return false;
    }
  },

  apagar: function (chave) {
    try { localStorage.removeItem(chave); } catch (erro) { /* nada a fazer */ }
  }
};


/* ===================================================================
   SESSÃO — quem está usando o site agora
   =================================================================== */

const Sessao = {

  /* Só aceita o formato esperado. O que vem do localStorage é texto
     que qualquer um edita, então é tratado como entrada de usuário. */
  ler: function () {
    const dados = Armazem.ler(CHAVE_SESSAO);
    if (!dados || typeof dados !== 'object') return null;
    if (dados.papel !== 'mestre' && dados.papel !== 'jogador') return null;
    if (typeof dados.campanhaId !== 'string') return null;
    return dados;
  },

  gravar: function (sessao) {
    return Armazem.gravar(CHAVE_SESSAO, sessao);
  },

  limpar: function () {
    Armazem.apagar(CHAVE_SESSAO);
  }
};


/* ===================================================================
   CAMPANHAS
   =================================================================== */

const Campanhas = {

  /* ---------- O índice ---------- */

  /* Da mais recente para a mais antiga: quem abre a entrada quase
     sempre quer continuar a última. */
  listar: function () {
    const indice = Armazem.ler(CHAVE_INDICE);
    if (!Array.isArray(indice)) return [];

    return indice
      .filter(function (c) { return c && typeof c.id === 'string'; })
      .sort(function (a, b) { return (b.atualizadaEm || 0) - (a.atualizadaEm || 0); });
  },

  achar: function (id) {
    return this.listar().find(function (c) { return c.id === id; }) || null;
  },

  /* O código chega já normalizado (ver normalizarCodigo). */
  acharPorCodigo: function (codigo) {
    return this.listar().find(function (c) { return c.codigo === codigo; }) || null;
  },

  /* A linha do índice é tirada do próprio Estado — nunca digitada à
     parte. Ver o comentário do topo. */
  resumoDe: function (id, estado, anterior) {
    const agora = Date.now();
    return {
      id: id,
      nome: estado.campanha.nome,
      sistema: estado.campanha.sistema,
      mestre: estado.mestre.nome,
      codigo: estado.campanha.codigo,
      sessao: estado.campanha.sessao,
      criadaEm: anterior && anterior.criadaEm ? anterior.criadaEm : agora,
      atualizadaEm: agora
    };
  },


  /* ---------- O Estado de cada uma ---------- */

  /* Só lê campanhas que estão no índice: um id inventado no endereço
     ou no DevTools não abre uma chave qualquer do localStorage. */
  lerEstado: function (id) {
    if (!this.achar(id)) return null;
    const estado = Armazem.ler(PREFIXO_CAMPANHA + id);
    return estado && typeof estado === 'object' ? estado : null;
  },

  /* Grava o Estado e atualiza a linha do índice. Devolve false se o
     navegador recusar (espaço cheio, armazenamento bloqueado). */
  salvarEstado: function (id, estado) {
    if (!Armazem.gravar(PREFIXO_CAMPANHA + id, estado)) return false;

    const indice = this.listar();
    const posicao = indice.findIndex(function (c) { return c.id === id; });
    const linha = this.resumoDe(id, estado, indice[posicao]);

    if (posicao === -1) indice.push(linha);
    else indice[posicao] = linha;

    return Armazem.gravar(CHAVE_INDICE, indice);
  },

  /* Cria a campanha e devolve o id dela (ou null se não deu para
     gravar). O código de convite já tem que vir no estado. */
  criar: function (estado) {
    const id = this.novoId();
    return this.salvarEstado(id, estado) ? id : null;
  },

  apagar: function (id) {
    Armazem.apagar(PREFIXO_CAMPANHA + id);
    const indice = this.listar().filter(function (c) { return c.id !== id; });
    Armazem.gravar(CHAVE_INDICE, indice);
  },


  /* ---------- Identificadores ---------- */

  /* O id é interno (nunca aparece na tela), mas também é sorteado com
     crypto: ele vai para a sessão, e um id previsível é um id que
     alguém pode chutar. */
  novoId: function () {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return 'c' + Array.prototype.map.call(bytes, function (b) {
      return ('0' + b.toString(16)).slice(-2);
    }).join('');
  },

  /* "K7QM-2XRP-9HVD": 12 sorteios num alfabeto de 32 = 32^12 ≈ 10^18
     combinações. A mesa-virtual usava 3 letras do nome + 4 dígitos,
     que se adivinha por tentativa (problema 3 do CLAUDE.md).

     crypto.getRandomValues, e não Math.random: Math.random é feito
     para jogo, não para segredo, e dá para prever a sequência. E como
     256 é múltiplo de 32, byte % 32 dá a mesma chance a cada letra. */
  gerarCodigo: function () {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);

    let letras = '';
    bytes.forEach(function (byte) {
      letras += ALFABETO_CODIGO[byte % ALFABETO_CODIGO.length];
    });

    /* Um código repetido apontaria duas campanhas para o mesmo convite.
       A chance é desprezível, mas conferir custa uma linha. */
    const codigo = letras.slice(0, 4) + '-' + letras.slice(4, 8) + '-' + letras.slice(8, 12);
    return this.acharPorCodigo(codigo) ? this.gerarCodigo() : codigo;
  },

  /* Aceita o código do jeito que a pessoa colar — minúsculo, sem hífen,
     com espaço — e devolve no formato certo, ou null se não for um
     código possível. */
  normalizarCodigo: function (texto) {
    const limpo = String(texto).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (limpo.length !== 12) return null;

    for (let i = 0; i < limpo.length; i++) {
      if (ALFABETO_CODIGO.indexOf(limpo[i]) === -1) return null;
    }

    return limpo.slice(0, 4) + '-' + limpo.slice(4, 8) + '-' + limpo.slice(8, 12);
  }
};
