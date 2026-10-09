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
