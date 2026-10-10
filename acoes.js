/* ===================================================================
   acoes.js — tudo o que o Mestre pode MUDAR na campanha, com nome

   POR QUE ESTE ARQUIVO EXISTE (Fase 0, preparação para o servidor)
   Antes, cada tela mexia no Estado direto (Estado.npcs = ...) e
   chamava Memoria.salvar(). Funciona com um navegador só. Com servidor,
   não: o servidor precisa receber um PEDIDO com nome — "apague o NPC
   n4" — conferir se quem pediu pode, e aplicar na cópia oficial dele.
   Se o Mestre mandasse o Estado inteiro, apagaria o que um jogador
   mudou no mesmo segundo (o Mestre dá dano na Lyra enquanto a Ana
   edita a ficha dela).

   COMO FUNCIONA
     ACOES       a tabela: nome → função (estado, dados) → resultado.
                 A função SÓ mexe nos dados — não desenha, não salva,
                 não conhece tela nem navegador. Por isso ela vai rodar,
                 igualzinha, no servidor.
     Acoes.executar(nome, dados)
                 o que as telas chamam. Hoje: roda a ação aqui e salva
                 no navegador. Com servidor: manda o pedido pelo
                 Socket.IO, e o servidor roda a MESMA função.

   O RESULTADO
   Cada ação devolve um objeto. { erro: 'texto' } quer dizer que nada
   mudou, e o texto é para mostrar à pessoa. Sem erro, pode trazer o
   que a tela precisa saber (se o item é novo, o que foi apagado...).

   OS DADOS SÃO UMA CÓPIA
   executar() copia os dados antes de entregar à ação, então ela nunca
   segura um objeto da tela (o rascunho de um formulário, por exemplo).
   Com servidor é assim de qualquer jeito — os dados chegam pela rede,
   como texto. Copiar agora faz a diferença aparecer hoje, e não no
   dia da troca.

   O QUE AINDA NÃO ESTÁ AQUI
   As telas estão sendo trazidas aos poucos (NPCs, diário e tabelas
   primeiro). Para ver o que falta: procure "Memoria.salvar" fora
   deste arquivo — cada ocorrência é uma mudança que ainda não tem nome.
   =================================================================== */


/* As listas do Estado que são do Mestre, com o tamanho máximo de cada
   item (em caracteres de JSON) e o campo de texto que não pode faltar.
   Uma lista fora daqui não aceita "salvarItem": é a lista branca que o
   servidor vai usar para recusar pedidos inventados. */
/* TUDO DAQUI ATÉ O 'return' FICA FECHADO NESTE BLOCO.

   No navegador, os scripts comuns dividem um espaço de nomes só: uma
   'const LIMITE_RETRATO' aqui e outra no dados.js derrubam o arquivo
   inteiro ('já foi declarado'), e uma 'function texto' aqui substituiria
   em silêncio uma 'function texto' de outro arquivo. Dentro desta
   função que roda na hora, os ajudantes (inteiro, texto, sortear,
   combateDe...) são só deste arquivo. Para fora saem apenas a tabela
   ACOES e a LISTAS_DO_MESTRE. (O conteúdo não foi reindentado de
   propósito, para a mudança ficar fácil de ler no histórico.) */
const { ACOES, LISTAS_DO_MESTRE } = (function () {

const LISTAS_DO_MESTRE = {
  npcs:          { limite: 20000, obrigatorio: 'nome' },
  faccoes:       { limite: 10000, obrigatorio: 'nome' },
  diario:        { limite: 40000, obrigatorio: 'titulo' },
  segredos:      { limite: 10000, obrigatorio: 'titulo' },
  pendencias:    { limite: 2000,  obrigatorio: 'texto' },
  tabelasMinhas: { limite: 30000, obrigatorio: 'nome' },
  /* O monstro pode levar a foto dentro (até LIMITE_RETRATO). */
  monstrosMeus:  { limite: 220000, obrigatorio: 'nome' }
};

/* O retrato (de herói ou monstro): o mesmo JPEG que o imagens.js gera,
   em texto base64, e não maior que isto. É a mesma regra do
   retratoSeguro() do dados.js — repetida aqui porque este arquivo
   precisa rodar sozinho no servidor. */
const LIMITE_RETRATO = 160000;
function retratoValido(imagem) {
  return typeof imagem === 'string' && imagem.length <= LIMITE_RETRATO
    && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(imagem);
}

/* O histórico de rolagens de tabela guarda só as últimas. */
const LIMITE_ROLAGENS_TABELA = 30;


/* ---------- Conferências que várias ações usam ---------- */

function listaDoMestre(estado, nome) {
  if (!Object.prototype.hasOwnProperty.call(LISTAS_DO_MESTRE, nome)) return null;
  if (!Array.isArray(estado[nome])) estado[nome] = [];
  return estado[nome];
}

/* Um id como os que o site gera: 'n1712345678901', 'p17...'. Nada de
   espaço, barra ou texto enorme — o id vai para atributos e endereços. */
function idValido(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(id);
}

function acharPorId(lista, id) {
  return lista.findIndex(function (x) { return x && x.id === id; });
}

/* Um número inteiro dentro de limites — o que vier fora vira o padrão.
   Texto, NaN, Infinity e 1e9 param aqui. */
function inteiro(valor, minimo, maximo, padrao) {
  const n = parseInt(valor, 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, minimo), maximo) : padrao;
}

/* O irmão do inteiro(): em vez de PRENDER nos limites, diz que está
   fora (null). Para quando um valor fora da faixa é um erro, e não um
   exagero a corrigir — uma parede na coluna 50 de uma cena de 10
   colunas não existe; ela não vira uma parede na coluna 9. */
function naFaixa(valor, minimo, maximo) {
  const n = Number(valor);
  return Number.isInteger(n) && n >= minimo && n <= maximo ? n : null;
}

function texto(valor, limite) {
  return typeof valor === 'string' ? valor.trim().slice(0, limite) : '';
}

/* O sorteio dos dados que as AÇÕES rolam (a iniciativa, por exemplo).
   crypto, quando existe — o navegador e o Node 18+ têm —, porque no
   servidor é ele quem sorteia, e Math.random é previsível. */
function sortear(faces) {
  const cripto = typeof globalThis !== 'undefined' && globalThis.crypto;
  if (cripto && cripto.getRandomValues) {
    /* Descarta os valores do fim da faixa que dariam mais chance a
       algumas faces (2^32 não é múltiplo de 20). */
    const teto = Math.floor(0x100000000 / faces) * faces;
    const caixa = new Uint32Array(1);
    do { cripto.getRandomValues(caixa); } while (caixa[0] >= teto);
    return (caixa[0] % faces) + 1;
  }
  return Math.floor(Math.random() * faces) + 1;
}


/* ---------- O combate ----------
   Era o objeto Mesa, no dados.js: as operações de combate que mais de
   uma tela usa (o Combate e o Bestiário põem gente na ordem). Viraram
   ajudantes das ações, que recebem o estado em vez de usar o global. */

const LIMITE_REGISTRO_COMBATE = 40;

function combateDe(estado) {
  if (!estado.combate || typeof estado.combate !== 'object') {
    estado.combate = { ativo: false, rodada: 1, encontro: '', dificuldade: '', nd: '', combatentes: [], registro: [] };
  }
  if (!Array.isArray(estado.combate.combatentes)) estado.combate.combatentes = [];
  if (!Array.isArray(estado.combate.registro)) estado.combate.registro = [];
  return estado.combate;
}

function registrarNoCombate(combate, frase, tipo) {
  combate.registro.unshift({ texto: frase, tipo: tipo });
  combate.registro = combate.registro.slice(0, LIMITE_REGISTRO_COMBATE);
}

/* Maior iniciativa primeiro; empate desempata pelo nome, para a ordem
   não ficar dançando a cada redesenho. */
function ordenarIniciativa(combate) {
  combate.combatentes.sort(function (a, b) {
    if (b.iniciativa !== a.iniciativa) return b.iniciativa - a.iniciativa;
    return a.nome.localeCompare(b.nome);
  });
}

/* Dois "Esqueleto" no mesmo combate precisam de nomes distintos, senão
   o Mestre não sabe qual está com 3 PV. */
function nomeLivre(combate, nome) {
  const iguais = combate.combatentes.filter(function (c) {
    return c.nome === nome || c.nome.indexOf(nome + ' ') === 0;
  }).length;
  return iguais === 0 ? nome : nome + ' ' + (iguais + 1);
}

/* De quem é a vez: o primeiro da ordem que ainda não agiu e está de pé. */
function indiceDaVez(combate) {
  return combate.combatentes.findIndex(function (c) { return !c.agiu && c.pv > 0; });
}

function acharCombatente(combate, id) {
  return combate.combatentes.find(function (c) { return c.id === id; }) || null;
}

function acharHeroi(estado, id) {
  return (estado.herois || []).find(function (h) { return h.id === id; }) || null;
}


/* ---------- As cenas (mapas.js) ----------
   Uma cena: { id, nome, visibilidade, colunas, linhas, imagem?,
   paredes: [[col, lin, largura, altura]...], tokens: [...],
   marcadores: [...] }. */

const COLUNAS = [5, 60];
const LINHAS = [5, 40];
const LIMITE_IMAGEM_CENA = 700000;   /* o mesmo do imagemDaCena() do dados.js */

function imagemDeCenaValida(imagem) {
  return typeof imagem === 'string' && imagem.length <= LIMITE_IMAGEM_CENA
    && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(imagem);
}

function acharCena(estado, id) {
  return (Array.isArray(estado.cenas) ? estado.cenas : []).find(function (c) { return c && c.id === id; }) || null;
}

/* As quatro paredes de borda de uma cena nova. */
function contorno(colunas, linhas) {
  return [
    [0, 0, colunas, 1], [0, linhas - 1, colunas, 1],
    [0, 1, 1, linhas - 2], [colunas - 1, 1, 1, linhas - 2]
  ];
}

/* Paredes conferidas: cada uma é [col, lin, largura, altura] inteiros,
   dentro da cena. O que passar da borda é cortado; o que sobrar vazio
   sai. Uma cena 60 × 40 tem 2400 células — mais paredes que isso é lixo. */
function paredesValidas(paredes, cena) {
  if (!Array.isArray(paredes) || paredes.length > 2400) return null;
  const limpas = [];
  for (let i = 0; i < paredes.length; i++) {
    const p = paredes[i];
    if (!Array.isArray(p) || p.length !== 4) return null;
    const col = naFaixa(p[0], 0, cena.colunas - 1);
    const lin = naFaixa(p[1], 0, cena.linhas - 1);
    const largura = naFaixa(p[2], 1, 60);
    const altura = naFaixa(p[3], 1, 40);
    if (col === null || lin === null || largura === null || altura === null) continue;
    const larg = Math.min(largura, cena.colunas - col);
    const alt = Math.min(altura, cena.linhas - lin);
    if (larg > 0 && alt > 0) limpas.push([col, lin, larg, alt]);
  }
  return limpas;
}

/* Mudar o tamanho de uma cena que já tem coisas dentro. Encolher corta
   as paredes que passariam da borda e puxa para dentro os tokens e
   marcadores que ficariam fora — nada some sem aviso, só muda de casa. */
function redimensionar(cena, colunas, linhas) {
  cena.paredes = cena.paredes
    .map(function (p) { return [p[0], p[1], Math.min(p[2], colunas - p[0]), Math.min(p[3], linhas - p[1])]; })
    .filter(function (p) { return p[2] > 0 && p[3] > 0; });
  cena.tokens.concat(cena.marcadores).forEach(function (coisa) {
    coisa.col = Math.min(coisa.col, colunas - 1);
    coisa.lin = Math.min(coisa.lin, linhas - 1);
  });
  cena.colunas = colunas;
  cena.linhas = linhas;
}

/* Uma célula sem parede e sem token. Varre de dentro para fora,
   começando perto do meio. */
function celulaLivre(cena) {
  function ocupada(col, lin) {
    const temParede = cena.paredes.some(function (p) {
      return col >= p[0] && col < p[0] + p[2] && lin >= p[1] && lin < p[1] + p[3];
    });
    return temParede || cena.tokens.some(function (t) { return t.col === col && t.lin === lin; });
  }
  const meioCol = Math.floor(cena.colunas / 2);
  const meioLin = Math.floor(cena.linhas / 2);
  for (let raio = 0; raio < Math.max(cena.colunas, cena.linhas); raio++) {
    for (let dc = -raio; dc <= raio; dc++) {
      for (let dl = -raio; dl <= raio; dl++) {
        const col = meioCol + dc;
        const lin = meioLin + dl;
        if (col < 0 || lin < 0 || col >= cena.colunas || lin >= cena.linhas) continue;
        if (!ocupada(col, lin)) return { col: col, lin: lin };
      }
    }
  }
  return null;
}

/* Uma cena inteira conferida — para o "Desfazer" de apagar cena, que
   devolve uma cena que veio de fora (da tela, ou pela rede). */
function cenaValida(c) {
  if (!c || typeof c !== 'object' || !idValido(c.id)) return null;
  const nome = texto(c.nome, 60);
  const colunas = naFaixa(c.colunas, COLUNAS[0], COLUNAS[1]);
  const linhas = naFaixa(c.linhas, LINHAS[0], LINHAS[1]);
  if (!nome || !colunas || !linhas) return null;
  const cena = { id: c.id, nome: nome, visibilidade: texto(c.visibilidade, 60), colunas: colunas, linhas: linhas, paredes: [], tokens: [], marcadores: [] };
  cena.paredes = paredesValidas(c.paredes || [], cena);
  if (!cena.paredes) return null;
  if (c.imagem !== undefined) {
    if (!imagemDeCenaValida(c.imagem)) return null;
    cena.imagem = c.imagem;
  }
  const dentro = function (x) { return { col: inteiro(x.col, 0, colunas - 1, 0), lin: inteiro(x.lin, 0, linhas - 1, 0) }; };
  cena.tokens = (Array.isArray(c.tokens) ? c.tokens : []).slice(0, 200).filter(function (t) { return t && idValido(t.id); }).map(function (t) {
    const nomeToken = texto(t.nome, 60) || '?';
    return Object.assign({ id: t.id, nome: nomeToken, inicial: nomeToken.charAt(0).toUpperCase(), tipo: t.tipo === 'heroi' ? 'heroi' : 'inimigo' }, dentro(t));
  });
  cena.marcadores = (Array.isArray(c.marcadores) ? c.marcadores : []).slice(0, 200).filter(function (m) { return m && idValido(m.id); }).map(function (m) {
    return Object.assign({ id: m.id, tipo: m.tipo === 'perigo' ? 'perigo' : 'nota', texto: texto(m.texto, 200) || 'Marcador' }, dentro(m));
  });
  return cena;
}

function novoId(prefixo) {
  return prefixo + Date.now().toString(36) + sortear(1e6).toString(36);
}


/* ===================================================================
   AS AÇÕES
   =================================================================== */

const ACOES = {

  /* ----- Listas: salvar, apagar, devolver (o desfazer) ----- */

  /* Novo ou editado: se já existe um item com esse id, ele é trocado
     pelo que veio; senão, entra no fim da lista. */
  salvarItem: function (estado, dados) {
    const regra = LISTAS_DO_MESTRE[dados.lista];
    const lista = listaDoMestre(estado, dados.lista);
    const item = dados.item;
    if (!lista) return { erro: 'Lista desconhecida.' };
    if (!item || typeof item !== 'object' || Array.isArray(item) || !idValido(item.id)) return { erro: 'Item inválido.' };
    if (typeof item[regra.obrigatorio] !== 'string' || !item[regra.obrigatorio].trim()) return { erro: 'Falta o ' + regra.obrigatorio + '.' };
    if (JSON.stringify(item).length > regra.limite) return { erro: 'Grande demais para guardar.' };

    const posicao = acharPorId(lista, item.id);
    if (posicao === -1) lista.push(item);
    else lista[posicao] = item;
    return { novo: posicao === -1 };
  },

  /* Devolve o item tirado e a posição em que estava: é o que o
     "Desfazer" precisa para pôr de volta no mesmo lugar. */
  apagarItem: function (estado, dados) {
    const lista = listaDoMestre(estado, dados.lista);
    if (!lista) return { erro: 'Lista desconhecida.' };
    const posicao = acharPorId(lista, dados.id);
    if (posicao === -1) return { erro: 'Não encontrado — talvez já tenha sido apagado.' };
    const item = lista.splice(posicao, 1)[0];
    return { item: item, posicao: posicao };
  },

  /* O "Desfazer": põe o item de volta na posição em que estava — se
     ele não tiver voltado por outro caminho. Passa pelas mesmas
     conferências do salvarItem: um "desfazer" não é porta dos fundos. */
  devolverItem: function (estado, dados) {
    const lista = listaDoMestre(estado, dados.lista);
    if (!lista) return { erro: 'Lista desconhecida.' };
    if (!dados.item || acharPorId(lista, dados.item.id) !== -1) return { erro: 'Já está de volta.' };
    const conferido = ACOES.salvarItem(estado, { lista: dados.lista, item: dados.item });
    if (conferido.erro) return conferido;
    /* salvarItem pôs no fim; leva para a posição de antes. */
    const item = lista.pop();
    const posicao = Math.min(Math.max(Number(dados.posicao) || 0, 0), lista.length);
    lista.splice(posicao, 0, item);
    return {};
  },


  /* ----- NPCs ----- */

  alternarStatusNpc: function (estado, dados) {
    const npc = (estado.npcs || []).find(function (n) { return n.id === dados.id; });
    if (!npc) return { erro: 'NPC não encontrado.' };
    npc.status = npc.status === 'morto' ? 'vivo' : 'morto';
    return { status: npc.status, nome: npc.nome };
  },


  /* ----- Diário ----- */

  /* Revelar guarda em QUAL sessão foi revelado — meses depois, essa é
     a informação que reconstrói a linha do tempo da campanha. */
  alternarSegredo: function (estado, dados) {
    const segredo = (estado.segredos || []).find(function (s) { return s.id === dados.id; });
    if (!segredo) return { erro: 'Segredo não encontrado.' };
    segredo.revelado = !segredo.revelado;
    if (segredo.revelado) {
      const ultima = (estado.diario || []).slice().sort(function (a, b) { return b.sessao - a.sessao; })[0];
      segredo.reveladoEm = ultima ? ultima.sessao : null;
    } else {
      delete segredo.reveladoEm;
    }
    return { revelado: segredo.revelado, titulo: segredo.titulo };
  },

  alternarPendencia: function (estado, dados) {
    const pendencia = (estado.pendencias || []).find(function (p) { return p.id === dados.id; });
    if (!pendencia) return { erro: 'Pendência não encontrada.' };
    pendencia.resolvida = !pendencia.resolvida;
    return { resolvida: pendencia.resolvida };
  },


  /* ----- Tabelas ----- */

  /* Quem sorteia é a tela do Mestre (as tabelas prontas moram no
     tabelas.js); aqui só se registra o que saiu, com conferência de
     forma e o limite do histórico. */
  registrarRolagensTabela: function (estado, dados) {
    const novas = Array.isArray(dados.rolagens) ? dados.rolagens : [];
    if (!novas.length || novas.length > 20) return { erro: 'Rolagens inválidas.' };
    const limpas = novas.map(function (r) {
      return {
        tabela: String(r.tabela || '').slice(0, 40),
        nome: String(r.nome || '').slice(0, 80),
        face: Math.max(1, Math.min(1000, parseInt(r.face, 10) || 1)),
        texto: String(r.texto || '').slice(0, 500)
      };
    });
    estado.rolagensTabela = limpas.slice().reverse().concat(estado.rolagensTabela || []).slice(0, LIMITE_ROLAGENS_TABELA);
    return {};
  },

  limparRolagensTabela: function (estado) {
    estado.rolagensTabela = [];
    return {};
  },


  /* ----- Combate: turnos ----- */

  proximoTurno: function (estado) {
    const combate = combateDe(estado);
    const vez = indiceDaVez(combate);
    if (vez === -1) return { erro: 'Todos já agiram. Avance a rodada para recomeçar a ordem.' };
    combate.combatentes[vez].agiu = true;
    const proxima = indiceDaVez(combate);
    return { proximo: proxima === -1 ? null : combate.combatentes[proxima].nome, rodada: combate.rodada };
  },

  avancarRodada: function (estado) {
    const combate = combateDe(estado);
    combate.rodada = inteiro(combate.rodada, 1, 9999, 1) + 1;
    combate.combatentes.forEach(function (c) { c.agiu = false; });
    registrarNoCombate(combate, 'Rodada ' + combate.rodada + ' começou.', 'turno');
    const primeiro = combate.combatentes[indiceDaVez(combate)];
    return { rodada: combate.rodada, primeiro: primeiro ? primeiro.nome : null };
  },

  /* O dado sai daqui, e não da tela: com servidor, quem sorteia é ele. */
  rolarIniciativa: function (estado) {
    const combate = combateDe(estado);
    combate.combatentes.forEach(function (c) {
      /* O bônus do herói vem da ficha; o do monstro ficou salvo nele. */
      let bonus = c.bonusIniciativa || 0;
      const heroi = c.heroiId ? acharHeroi(estado, c.heroiId) : null;
      if (heroi) bonus = heroi.bonusIniciativa || 0;
      c.iniciativa = sortear(20) + bonus;
      c.agiu = false;
    });
    ordenarIniciativa(combate);
    combate.rodada = 1;
    registrarNoCombate(combate, 'Iniciativa rolada de novo. A ordem mudou.', 'turno');
    return {};
  },

  iniciarCombate: function (estado) {
    const combate = combateDe(estado);
    combate.ativo = true;
    combate.rodada = 1;
    combate.combatentes.forEach(function (c) { c.agiu = false; });
    registrarNoCombate(combate, 'Combate iniciado.', 'turno');
    return {};
  },

  encerrarCombate: function (estado) {
    const combate = combateDe(estado);
    combate.ativo = false;
    registrarNoCombate(combate, 'Combate encerrado.', 'turno');
    return {};
  },


  /* ----- Combate: vida e condições ----- */

  /* delta negativo é dano, positivo é cura. O PV de herói mora na
     FICHA (estado.herois): as duas cópias andam juntas, senão a cura no
     combate não apareceria na Visão Geral nem no painel do jogador. */
  mudarPVCombatente: function (estado, dados) {
    const combate = combateDe(estado);
    const alvo = acharCombatente(combate, dados.id);
    if (!alvo) return { erro: 'Combatente não encontrado.' };
    const delta = inteiro(dados.delta, -9999, 9999, 0);

    const antes = alvo.pv;
    alvo.pv = Math.max(0, Math.min(alvo.pvMax, alvo.pv + delta));
    if (alvo.pv === antes) return { mudou: false };

    const heroi = alvo.heroiId ? acharHeroi(estado, alvo.heroiId) : null;
    if (heroi) heroi.pv = alvo.pv;

    registrarNoCombate(combate, alvo.nome + ' ' + (delta < 0 ? 'sofre' : 'recupera') + ' ' + Math.abs(alvo.pv - antes) + ' PV.', delta < 0 ? 'dano' : 'cura');

    let aviso = null;
    if (alvo.pv === 0) {
      aviso = alvo.tipo === 'inimigo'
        ? alvo.nome + ' foi abatido.'
        : alvo.nome + ' caiu a 0 PV — testes de morte a partir do próximo turno.';
      registrarNoCombate(combate, aviso, 'dano');
    }
    return { mudou: true, nome: alvo.nome, antes: antes, depois: alvo.pv, aviso: aviso };
  },

  /* Põe a condição se não tem, tira se tem. Só pôr vai para o registro
     (tirar pelo "x" da etiqueta é o tirarCondicao, que registra). */
  alternarCondicao: function (estado, dados) {
    const alvo = acharCombatente(combateDe(estado), dados.id);
    const condicao = texto(dados.condicao, 30);
    if (!alvo || !condicao) return { erro: 'Condição inválida.' };
    if (!Array.isArray(alvo.condicoes)) alvo.condicoes = [];
    const posicao = alvo.condicoes.indexOf(condicao);
    if (posicao === -1) {
      if (alvo.condicoes.length >= 15) return { erro: 'Condições demais.' };
      alvo.condicoes.push(condicao);
      registrarNoCombate(estado.combate, alvo.nome + ' está ' + condicao.toLowerCase() + '.', 'magia');
    } else {
      alvo.condicoes.splice(posicao, 1);
    }
    return { posta: posicao === -1 };
  },

  tirarCondicao: function (estado, dados) {
    const alvo = acharCombatente(combateDe(estado), dados.id);
    if (!alvo || !Array.isArray(alvo.condicoes)) return { erro: 'Condição inválida.' };
    const posicao = alvo.condicoes.indexOf(dados.condicao);
    if (posicao === -1) return { erro: 'Essa condição já tinha saído.' };
    alvo.condicoes.splice(posicao, 1);
    registrarNoCombate(estado.combate, alvo.nome + ' não está mais ' + String(dados.condicao).toLowerCase() + '.', 'cura');
    return {};
  },


  /* ----- Combate: entrar e sair ----- */

  /* molde: { nome, ca, pv, bonusIniciativa, nota } para monstro ou
     avulso; { heroiId } para herói. Herói: nome, CA, PV e bônus vêm da
     FICHA dele no estado, nunca do que a tela mandou — no servidor,
     isso impede um herói de entrar no combate com 999 PV. A iniciativa
     é sorteada aqui. */
  entrarNoCombate: function (estado, dados) {
    const combate = combateDe(estado);
    const molde = dados.molde || {};
    let novo;

    if (molde.heroiId) {
      const heroi = acharHeroi(estado, molde.heroiId);
      if (!heroi) return { erro: 'Herói não encontrado.' };
      if (combate.combatentes.some(function (c) { return c.heroiId === heroi.id; })) return { erro: heroi.nome + ' já está no combate.' };
      novo = {
        heroiId: heroi.id, nome: heroi.nome, tipo: 'heroi',
        ca: inteiro(heroi.ca, 0, 99, 10), pv: inteiro(heroi.pv, 0, 9999, 1), pvMax: inteiro(heroi.pvMax, 1, 9999, 1),
        bonusIniciativa: inteiro(heroi.bonusIniciativa, -20, 30, 0), nota: texto(heroi.classe, 120)
      };
    } else {
      const nome = texto(molde.nome, 60);
      if (!nome) return { erro: 'Dê um nome a quem está entrando no combate.' };
      const pv = inteiro(molde.pv, 1, 9999, 10);
      novo = {
        heroiId: null, nome: nomeLivre(combate, nome), tipo: 'inimigo',
        ca: inteiro(molde.ca, 1, 99, 12), pv: pv, pvMax: pv,
        bonusIniciativa: inteiro(molde.bonusIniciativa, -20, 30, 0), nota: texto(molde.nota, 120)
      };
    }
    if (combate.combatentes.length >= 60) return { erro: 'O combate já tem gente demais.' };

    const combatente = Object.assign({
      id: 'c' + Date.now().toString(36) + sortear(1e6).toString(36),
      iniciativa: sortear(20) + novo.bonusIniciativa,
      agiu: false,
      condicoes: []
    }, novo);

    combate.combatentes.push(combatente);
    registrarNoCombate(combate, combatente.nome + ' entra no combate (iniciativa ' + combatente.iniciativa + ').', 'entrada');
    ordenarIniciativa(combate);
    return { combatente: { id: combatente.id, nome: combatente.nome, iniciativa: combatente.iniciativa } };
  },

  /* Os heróis que ainda não estão no combate. */
  trazerParty: function (estado) {
    let entraram = 0;
    (estado.herois || []).forEach(function (heroi) {
      if (!ACOES.entrarNoCombate(estado, { molde: { heroiId: heroi.id } }).erro) entraram += 1;
    });
    if (!entraram) return { erro: 'A party inteira já está no combate.' };
    return { entraram: entraram };
  },

  sairDoCombate: function (estado, dados) {
    const combate = combateDe(estado);
    const posicao = combate.combatentes.findIndex(function (c) { return c.id === dados.id; });
    if (posicao === -1) return { erro: 'Combatente não encontrado.' };
    const saiu = combate.combatentes.splice(posicao, 1)[0];
    registrarNoCombate(combate, saiu.nome + ' saiu do combate.', 'saida');
    return { nome: saiu.nome };
  },


  /* ----- Visão Geral ----- */

  /* O PV de um herói, mexido pelo Mestre na Visão Geral. O herói é do
     jogador, mas o PV é dos dois: por isso é uma ação que muda SÓ o PV
     (e o combatente dele, se estiver no combate), e não "salvar o
     herói" — a ficha que a Ana está editando não é tocada. */
  mudarPVHeroi: function (estado, dados) {
    const heroi = acharHeroi(estado, dados.id);
    if (!heroi) return { erro: 'Herói não encontrado.' };
    const delta = inteiro(dados.delta, -9999, 9999, 0);
    const antes = heroi.pv;
    heroi.pv = Math.max(0, Math.min(heroi.pvMax, heroi.pv + delta));
    if (heroi.pv === antes) return { mudou: false };

    const combatente = combateDe(estado).combatentes.find(function (c) { return c.heroiId === heroi.id; });
    if (combatente) combatente.pv = heroi.pv;
    return { mudou: true, nome: heroi.nome, antes: antes, depois: heroi.pv };
  },

  /* As rolagens do rolador do Mestre (as últimas 8). O dado é da tela:
     é o rolador DELE, e a rolagem secreta nem sai do painel. */
  registrarRolagemMestre: function (estado, dados) {
    const r = dados.rolagem || {};
    const limpa = {
      texto: texto(r.texto, 120),
      formula: texto(r.formula, 120),
      total: inteiro(r.total, -999, 9999, 0),
      marca: r.marca === 'critico' || r.marca === 'falha' ? r.marca : null
    };
    estado.rolagens = [limpa].concat(Array.isArray(estado.rolagens) ? estado.rolagens : []).slice(0, 8);
    return {};
  },

  /* O NPC de improviso e o saque: sorteados pela tela (as listas do
     gerador são de lá); aqui só se guarda, com limite de tamanho. */
  guardarNpcSorteado: function (estado, dados) {
    const npc = dados.npc || {};
    estado.npc = { nome: texto(npc.nome, 120), traco: texto(npc.traco, 200), segredo: texto(npc.segredo, 300) };
    if (!estado.npc.nome) return { erro: 'NPC sem nome.' };
    return {};
  },

  guardarTesouro: function (estado, dados) {
    estado.tesouro = texto(dados.texto, 300);
    return {};
  },

  /* O som ambiente: só muda o que veio (volume, pista, tocando). */
  ajustarAudio: function (estado, dados) {
    if (!estado.audio || typeof estado.audio !== 'object') estado.audio = { pista: '', volume: 42, tocando: false };
    if (dados.volume !== undefined) estado.audio.volume = inteiro(dados.volume, 0, 100, estado.audio.volume);
    if (dados.pista !== undefined) {
      const pista = texto(dados.pista, 80);
      if (!pista) return { erro: 'Pista inválida.' };
      estado.audio.pista = pista;
    }
    if (dados.tocando !== undefined) estado.audio.tocando = !!dados.tocando;
    return { audio: { pista: estado.audio.pista, volume: estado.audio.volume, tocando: estado.audio.tocando } };
  },


  /* ----- Sessões (o seletor da barra do topo) ----- */

  /* Dá nome e número à sessão em jogo. Se o diário já tem a entrada
     dela, atualiza; senão, cria — nomear pela barra também registra. */
  salvarSessao: function (estado, dados) {
    const numero = inteiro(dados.numero, 0, 9999, 0);
    if (numero < 1) return { erro: 'O número da sessão precisa ser 1 ou mais.' };
    const titulo = texto(dados.titulo, 120);
    if (!Array.isArray(estado.diario)) estado.diario = [];

    const anterior = estado.campanha.sessao;
    const outra = estado.diario.find(function (e) { return e.sessao === numero && e.sessao !== anterior; });
    if (outra) return { erro: 'Já existe uma sessão ' + numero + '. Escolha outro número.' };

    estado.campanha.sessao = numero;
    const entrada = estado.diario.find(function (e) { return e.sessao === anterior; });
    if (entrada) {
      entrada.sessao = numero;
      entrada.titulo = titulo;
    } else {
      estado.diario.push(novaEntradaDeDiario(numero, titulo));
    }
    return {};
  },

  /* Uma sessão nova: a que estava em jogo deixa de estar aberta. */
  comecarSessao: function (estado, dados) {
    const numero = inteiro(dados.numero, 0, 9999, 0);
    if (numero < 1) return { erro: 'O número da sessão precisa ser 1 ou mais.' };
    const titulo = texto(dados.titulo, 120);
    if (!Array.isArray(estado.diario)) estado.diario = [];
    if (estado.diario.some(function (e) { return e.sessao === numero; })) {
      return { erro: 'Já existe uma sessão ' + numero + '. Escolha outro número.' };
    }
    const corrente = estado.diario.find(function (e) { return e.sessao === estado.campanha.sessao; });
    if (corrente) corrente.emAberto = false;
    estado.diario.push(novaEntradaDeDiario(numero, titulo));
    estado.campanha.sessao = numero;
    return {};
  },

  /* Voltar a uma sessão já registrada, caso tenha se enganado. */
  irParaSessao: function (estado, dados) {
    const numero = inteiro(dados.numero, 0, 9999, 0);
    if (numero < 1) return { erro: 'Sessão inválida.' };
    if (numero === estado.campanha.sessao) return { mesma: true };
    estado.campanha.sessao = numero;
    const entrada = (estado.diario || []).find(function (e) { return e.sessao === numero; });
    return { titulo: entrada ? entrada.titulo : '' };
  },


  /* ----- Avisos e compêndio ----- */

  /* Os avisos do sino que o Mestre já viu (as chaves, calculadas pelo
     avisos.js). Lista inteira trocada de uma vez. */
  marcarAvisosVistos: function (estado, dados) {
    const chaves = Array.isArray(dados.chaves) ? dados.chaves : [];
    if (chaves.length > 300) return { erro: 'Avisos demais.' };
    estado.avisosVistos = chaves.map(function (c) { return texto(c, 120); }).filter(Boolean);
    return {};
  },

  /* A foto de um monstro. Do seu (meuId): vai na ficha dele. Do livro:
     vai para estado.fotosMonstros, pelo nome, porque o livro (regras.js)
     não muda. foto null tira a foto. */
  mudarFotoMonstro: function (estado, dados) {
    const foto = dados.foto === null ? null : dados.foto;
    if (foto !== null && !retratoValido(foto)) return { erro: 'Essa imagem não é válida. Escolha outra.' };

    if (dados.meuId) {
      const meu = (estado.monstrosMeus || []).find(function (m) { return m.id === dados.meuId; });
      if (!meu) return { erro: 'Monstro não encontrado.' };
      if (foto) meu.foto = foto; else delete meu.foto;
      return {};
    }
    const nome = texto(dados.nome, 80);
    /* O nome vira CHAVE de objeto: __proto__ e companhia mexeriam no
       próprio objeto em vez de guardar a foto. */
    if (!nome || nome === '__proto__' || nome === 'constructor' || nome === 'prototype') return { erro: 'Monstro não encontrado.' };
    if (!estado.fotosMonstros || typeof estado.fotosMonstros !== 'object' || Array.isArray(estado.fotosMonstros)) estado.fotosMonstros = {};
    if (foto) {
      if (!(nome in estado.fotosMonstros) && Object.keys(estado.fotosMonstros).length >= 100) return { erro: 'Fotos de monstros demais.' };
      estado.fotosMonstros[nome] = foto;
    } else {
      delete estado.fotosMonstros[nome];
    }
    return {};
  },

  /* ----- Mapas & Cenas ----- */

  /* Nova (sem dados.id) ou editada. A imagem: undefined = não mexe,
     null = tira, texto = a imagem nova (o JPEG que o imagens.js gera). */
  salvarCena: function (estado, dados) {
    const nome = texto(dados.nome, 60);
    const visibilidade = texto(dados.visibilidade, 60);
    const colunas = inteiro(dados.colunas, 0, 999, 0);
    const linhas = inteiro(dados.linhas, 0, 999, 0);
    if (!nome) return { erro: 'Dê um nome à cena.' };
    if (colunas < COLUNAS[0] || colunas > COLUNAS[1]) return { erro: 'Colunas: um número inteiro de 5 a 60.' };
    if (linhas < LINHAS[0] || linhas > LINHAS[1]) return { erro: 'Linhas: um número inteiro de 5 a 40.' };
    if (dados.imagem !== undefined && dados.imagem !== null && !imagemDeCenaValida(dados.imagem)) return { erro: 'Essa imagem não é válida.' };
    if (!Array.isArray(estado.cenas)) estado.cenas = [];

    if (!dados.id) {
      if (estado.cenas.length >= 60) return { erro: 'Cenas demais nesta campanha.' };
      const cena = { id: novoId('cena'), nome: nome, visibilidade: visibilidade, colunas: colunas, linhas: linhas,
        paredes: dados.contorno ? contorno(colunas, linhas) : [], tokens: [], marcadores: [] };
      if (dados.imagem) cena.imagem = dados.imagem;
      estado.cenas.push(cena);
      estado.cenaAtual = cena.id;
      return { id: cena.id, nova: true };
    }

    const cena = acharCena(estado, dados.id);
    if (!cena) return { erro: 'Cena não encontrada.' };
    cena.nome = nome;
    cena.visibilidade = visibilidade;
    if (colunas !== cena.colunas || linhas !== cena.linhas) redimensionar(cena, colunas, linhas);
    if (dados.imagem === null) delete cena.imagem;
    else if (dados.imagem) cena.imagem = dados.imagem;
    return { id: cena.id, nova: false };
  },

  apagarCena: function (estado, dados) {
    const cenas = Array.isArray(estado.cenas) ? estado.cenas : [];
    const posicao = cenas.findIndex(function (c) { return c.id === dados.id; });
    if (posicao === -1) return { erro: 'Cena não encontrada.' };
    const cena = cenas.splice(posicao, 1)[0];
    const eraAtual = estado.cenaAtual === cena.id;
    if (eraAtual) estado.cenaAtual = cenas.length ? cenas[0].id : null;
    return { item: cena, posicao: posicao };
  },

  /* O "Desfazer": a cena volta inteira — paredes, tokens, marcadores — e
     volta a ser a atual. Conferida peça por peça (cenaValida): um
     desfazer não é porta dos fundos. */
  devolverCena: function (estado, dados) {
    const cena = cenaValida(dados.item);
    if (!cena) return { erro: 'Cena inválida.' };
    if (!Array.isArray(estado.cenas)) estado.cenas = [];
    if (acharCena(estado, cena.id)) return { erro: 'Já está de volta.' };
    estado.cenas.splice(Math.min(inteiro(dados.posicao, 0, 999, 0), estado.cenas.length), 0, cena);
    estado.cenaAtual = cena.id;
    return {};
  },

  escolherCena: function (estado, dados) {
    const cena = acharCena(estado, dados.id);
    if (!cena) return { erro: 'Cena não encontrada.' };
    estado.cenaAtual = cena.id;
    return { nome: cena.nome };
  },

  /* Uma pincelada inteira de parede, ao soltar o botão. */
  definirParedes: function (estado, dados) {
    const cena = acharCena(estado, dados.cenaId);
    if (!cena) return { erro: 'Cena não encontrada.' };
    const paredes = paredesValidas(dados.paredes, cena);
    if (!paredes) return { erro: 'Paredes inválidas.' };
    cena.paredes = paredes;
    return {};
  },

  /* Token solto numa célula (ou levado ao centro). Fora da cena, encosta na borda. */
  moverToken: function (estado, dados) {
    const cena = acharCena(estado, dados.cenaId);
    const token = cena && cena.tokens.find(function (t) { return t.id === dados.id; });
    if (!token) return { erro: 'Token não encontrado.' };
    token.col = inteiro(dados.col, 0, cena.colunas - 1, token.col);
    token.lin = inteiro(dados.lin, 0, cena.linhas - 1, token.lin);
    return {};
  },

  tirarToken: function (estado, dados) {
    const cena = acharCena(estado, dados.cenaId);
    if (!cena) return { erro: 'Cena não encontrada.' };
    const posicao = cena.tokens.findIndex(function (t) { return t.id === dados.id; });
    if (posicao === -1) return { erro: 'Token não encontrado.' };
    return { nome: cena.tokens.splice(posicao, 1)[0].nome };
  },

  /* Quem está no combate (de pé) e ainda não tem token entra no mapa,
     cada um numa célula livre perto do meio. */
  trazerCombatentesAoMapa: function (estado, dados) {
    const cena = acharCena(estado, dados.cenaId);
    if (!cena) return { erro: 'Cena não encontrada.' };
    let entraram = 0;
    combateDe(estado).combatentes.forEach(function (combatente) {
      if (combatente.pv <= 0) return;
      if (cena.tokens.some(function (t) { return t.nome === combatente.nome; })) return;
      if (cena.tokens.length >= 200) return;
      const livre = celulaLivre(cena);
      if (!livre) return;
      cena.tokens.push({
        id: novoId('t'), nome: combatente.nome, inicial: combatente.nome.charAt(0).toUpperCase(),
        tipo: combatente.tipo === 'heroi' ? 'heroi' : 'inimigo', col: livre.col, lin: livre.lin
      });
      entraram += 1;
    });
    if (!entraram) return { erro: 'Todo mundo do combate já está no mapa.' };
    return { entraram: entraram };
  },

  criarMarcador: function (estado, dados) {
    const cena = acharCena(estado, dados.cenaId);
    if (!cena) return { erro: 'Cena não encontrada.' };
    if (cena.marcadores.length >= 200) return { erro: 'Marcadores demais nesta cena.' };
    const marcador = { id: novoId('m'), col: inteiro(dados.col, 0, cena.colunas - 1, 0), lin: inteiro(dados.lin, 0, cena.linhas - 1, 0), tipo: 'nota', texto: 'Novo marcador' };
    cena.marcadores.push(marcador);
    return { id: marcador.id };
  },

  /* O texto do marcador. Um marcador que fala de armadilha vira
     vermelho sozinho — a regra mora aqui, não na tela. */
  editarMarcador: function (estado, dados) {
    const cena = acharCena(estado, dados.cenaId);
    const marcador = cena && cena.marcadores.find(function (m) { return m.id === dados.id; });
    if (!marcador) return { erro: 'Marcador não encontrado.' };
    marcador.texto = texto(dados.texto, 200) || 'Marcador';
    marcador.tipo = /armadilha|perigo|glifo|veneno|fogo/i.test(marcador.texto) ? 'perigo' : 'nota';
    return {};
  },

  tirarMarcador: function (estado, dados) {
    const cena = acharCena(estado, dados.cenaId);
    if (!cena) return { erro: 'Cena não encontrada.' };
    const antes = cena.marcadores.length;
    cena.marcadores = cena.marcadores.filter(function (m) { return m.id !== dados.id; });
    if (cena.marcadores.length === antes) return { erro: 'Marcador não encontrado.' };
    return {};
  },


  /* Magia fixada no acesso rápido do painel: põe se não está, tira se está. */
  alternarFixada: function (estado, dados) {
    const nome = texto(dados.nome, 80);
    if (!nome) return { erro: 'Nome inválido.' };
    if (!Array.isArray(estado.fixadas)) estado.fixadas = [];
    const posicao = estado.fixadas.indexOf(nome);
    if (posicao === -1) {
      if (estado.fixadas.length >= 50) return { erro: 'Fixadas demais.' };
      estado.fixadas.push(nome);
    } else {
      estado.fixadas.splice(posicao, 1);
    }
    return { fixada: posicao === -1 };
  }
};


/* A data de hoje, no fuso de quem roda (aaaa-mm-dd). */
function hojeISO() {
  const hoje = new Date();
  return hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0') + '-' + String(hoje.getDate()).padStart(2, '0');
}

function novaEntradaDeDiario(numero, titulo) {
  return { id: 'd' + Date.now().toString(36) + sortear(1e6).toString(36), sessao: numero, data: hojeISO(), titulo: titulo, resumo: '', notas: '', emAberto: true };
}


return { ACOES: ACOES, LISTAS_DO_MESTRE: LISTAS_DO_MESTRE };
})();


/* ===================================================================
   O LADO DO NAVEGADOR
   =================================================================== */

const Acoes = {

  /* Roda a ação no Estado deste navegador e salva. Com servidor, é
     esta função — e só ela — que passa a mandar o pedido pela rede. */
  executar: function (nome, dados) {
    const acao = ACOES[nome];
    if (!acao) return { erro: 'Ação desconhecida: ' + nome };

    const copia = dados === undefined ? {} : JSON.parse(JSON.stringify(dados));
    const resultado = acao(Estado, copia) || {};
    if (resultado.erro) return resultado;

    /* O navegador pode recusar a gravação (espaço cheio — uma foto
       grande, por exemplo). Aí a mudança é desfeita: o Estado volta a
       ser o último que foi gravado, e a tela recebe um erro como
       qualquer outro. Nenhuma tela precisa desfazer à mão. */
    if (!Memoria.salvar({ silencioso: true })) {
      Memoria.carregar();
      return { erro: 'Não coube no armazenamento do navegador — nada foi mudado. Se for uma imagem, tente uma menor.' };
    }
    return resultado;
  }
};


/* No Node (o futuro server.js), este arquivo é carregado com require()
   e entrega a tabela de ações. No navegador, `module` não existe e
   esta linha não faz nada. É o que deixa o MESMO arquivo servir aos
   dois lados. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ACOES: ACOES, LISTAS_DO_MESTRE: LISTAS_DO_MESTRE };
}
