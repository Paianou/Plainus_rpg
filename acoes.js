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
const LISTAS_DO_MESTRE = {
  npcs:          { limite: 20000, obrigatorio: 'nome' },
  faccoes:       { limite: 10000, obrigatorio: 'nome' },
  diario:        { limite: 40000, obrigatorio: 'titulo' },
  segredos:      { limite: 10000, obrigatorio: 'titulo' },
  pendencias:    { limite: 2000,  obrigatorio: 'texto' },
  tabelasMinhas: { limite: 30000, obrigatorio: 'nome' }
};

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
  }
};


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

    Memoria.salvar();
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
