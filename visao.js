/* ===================================================================
   visao.js — a fronteira entre a mesa e o jogador

   Este arquivo é o desenho do SERVIDOR, escrito antes de o servidor
   existir. Tudo o que o jogador pode ver e tudo o que ele pode fazer
   passa por aqui, e só por aqui:

     visaoDoJogador()  O QUE ele vê. O painel do jogador desenha só o
                       que sai desta função — nunca lê o Estado direto.
     enviarMeuHeroi()  salvar a PRÓPRIA ficha.
     enviarRolagem()   registrar uma rolagem no registro da mesa.

   Hoje roda no navegador, então é uma placa: quem abre o DevTools lê
   o Estado inteiro. Quando o servidor chegar, este arquivo muda de
   lugar — vai para o servidor —, e aí:
     - visaoDoJogador() roda ANTES de enviar: o que ela tira não chega
       ao navegador do jogador (problema 5 do CLAUDE.md: dado de mestre
       não é escondido, é não enviado);
     - as ações viram mensagens que o servidor confere antes de gravar.
   O painel do jogador não precisa mudar nada.


   LISTA BRANCA, SEMPRE
   Cada campo público é copiado UM A UM. O contrário — copiar tudo e
   apagar os segredos — vazaria o primeiro campo secreto que alguém
   criasse e esquecesse de apagar aqui. Com lista branca, um campo
   novo nasce escondido até alguém decidir mostrá-lo.
   =================================================================== */


/* O que se vê de um inimigo de longe: o estado, não o número. "Está
   sangrando" é o que o Mestre diria em voz alta; "faltam 7 PV" não. */
function palavraDeVida(pv, pvMax) {
  if (pv <= 0) return 'Abatido';
  const proporcao = pvMax ? pv / pvMax : 1;
  if (proporcao <= 0.25) return 'Quase caindo';
  if (proporcao <= 0.5) return 'Sangrando';
  if (proporcao < 1) return 'Ferido';
  return 'Ileso';
}


function visaoDoJogador(estado, jogadorId) {
  const c = estado.campanha;
  const herois = estado.herois || [];
  const meu = herois.find(function (h) { return h.dono === jogadorId; }) || null;
  const combate = estado.combate || { combatentes: [] };
  const combatentes = combate.combatentes || [];

  /* As condições de cada herói vêm do combate (é lá que o Mestre as
     aplica). Visíveis para todos: ninguém esconde que está caído. */
  function condicoesDe(heroiId) {
    const noCombate = combatentes.find(function (x) { return x.heroiId === heroiId; });
    return noCombate ? (noCombate.condicoes || []).slice() : [];
  }

  return {
    campanha: {
      nome: c.nome, sistema: c.sistema, sessao: c.sessao,
      premissa: c.premissa, cenario: c.cenario, tom: c.tom,
      /* Linhas e véus são justamente para os jogadores verem. */
      linhas: c.linhas || c.limites, veus: c.veus,
      nivelInicial: c.nivelInicial, regra: c.regra
    },
    mestre: estado.mestre.nome,
    grupo: estado.grupo ? estado.grupo.nome : '',
    regras: regrasPersonagem(estado),

    /* A própria ficha vem inteira — é dele. Cópia, para a tela não
       mexer no Estado por engano. */
    meuHeroi: meu ? JSON.parse(JSON.stringify(meu)) : null,

    /* Os companheiros: o que se vê olhando para o lado. A vida dos
       aliados é pública na mesa — é o que decide quem curar. */
    party: herois.filter(function (h) { return h !== meu; }).map(function (h) {
      return {
        id: h.id, nome: h.nome, classe: h.classe, nivel: h.nivel, jogador: h.jogador || '',
        pv: h.pv, pvMax: h.pvMax, condicoes: condicoesDe(h.id)
      };
    }),

    cena: cenaPublica(estado),
    combate: combatePublico(estado, meu),

    /* Do diário, só o que a party viveu: o resumo. As notas do Mestre
       ficam de fora, e as pendências também (são a lista de afazeres
       dele, e várias contam o que ainda vai acontecer). */
    diario: (estado.diario || []).map(function (d) {
      return { id: d.id, sessao: d.sessao, data: d.data, titulo: d.titulo, resumo: d.resumo, emAberto: !!d.emAberto };
    }).sort(function (a, b) { return b.sessao - a.sessao; }),

    /* Segredo só vira público quando o Mestre marca como revelado. */
    segredos: (estado.segredos || []).filter(function (s) { return s.revelado; }).map(function (s) {
      return { id: s.id, titulo: s.titulo, texto: s.texto, reveladoEm: s.reveladoEm || null };
    }),

    /* NPCs que a party já conheceu: quem são e como são. Objetivo,
       atitude, facção, segredo e notas são do Mestre. */
    conhecidos: (estado.npcs || []).filter(function (n) { return n.conhecido; }).map(function (n) {
      return { id: n.id, nome: n.nome, papel: n.papel, local: n.local, aparencia: n.aparencia, morto: n.status === 'morto' };
    }),

    rolagensMesa: (estado.rolagensMesa || []).slice(0, 15).map(function (r) {
      return { id: r.id, autor: r.autor, personagem: r.personagem, texto: r.texto, formula: r.formula, total: r.total, marca: r.marca };
    })
  };
}


/* A cena em jogo, sem os marcadores: eles são as notas do Mestre
   sobre a sala ("Glifo de Chamas, CD 15", "a coroa está aqui"). Um
   jogador que visse o marcador de armadilha nunca cairia nela. */
function cenaPublica(estado) {
  const cenas = estado.cenas || [];
  const cena = cenas.find(function (x) { return x.id === estado.cenaAtual; }) || cenas[0];
  if (!cena) return null;

  return {
    id: cena.id, nome: cena.nome, visibilidade: cena.visibilidade,
    colunas: cena.colunas, linhas: cena.linhas,
    paredes: cena.paredes.map(function (p) { return p.slice(); }),
    imagem: cena.imagem,
    marcadores: [],
    tokens: cena.tokens.map(function (t) {
      return { id: t.id, nome: t.nome, inicial: t.inicial, tipo: t.tipo, col: t.col, lin: t.lin };
    })
  };
}


/* A ordem de iniciativa como a mesa a vê:
     - de aliados, o PV de verdade; de inimigos, só a palavra;
     - CA de inimigo, nunca (é o que se descobre errando o ataque);
     - a 'nota' de cada combatente fica de fora: é anotação do Mestre
       ("Drenar Vida usado", "Garras paralisantes");
     - as condições ficam: estar caído ou amedrontado se vê. */
function combatePublico(estado, meu) {
  const combate = estado.combate;
  if (!combate || (!combate.ativo && !(combate.combatentes || []).length)) return null;

  const lista = combate.combatentes || [];
  /* De quem é a vez: o primeiro que ainda não agiu e está de pé — a
     mesma regra da tela de Combate. Calculado aqui porque o PV dos
     inimigos não sai desta função. */
  const vez = lista.find(function (x) { return !x.agiu && x.pv > 0; });

  return {
    ativo: !!combate.ativo,
    rodada: combate.rodada,
    encontro: combate.encontro || '',
    combatentes: lista.map(function (x) {
      const aliado = x.tipo === 'heroi';
      const publico = {
        id: x.id, nome: x.nome, tipo: aliado ? 'heroi' : 'inimigo',
        iniciativa: x.iniciativa, agiu: !!x.agiu,
        vez: !!combate.ativo && vez === x, meu: !!(meu && x.heroiId === meu.id),
        caido: x.pv <= 0,
        condicoes: (x.condicoes || []).slice()
      };
      if (aliado) {
        publico.pv = x.pv;
        publico.pvMax = x.pvMax;
      } else {
        publico.vida = palavraDeVida(x.pv, x.pvMax);
      }
      return publico;
    })
  };
}


/* ===================================================================
   AS AÇÕES DO JOGADOR

   As duas seguem o mesmo roteiro, que é o roteiro do servidor:
     1. ler a campanha FRESCA do armazenamento (não a da memória, que
        pode estar velha — o Mestre pode ter mexido em outra aba);
     2. conferir se o jogador PODE fazer aquilo;
     3. mudar só o pedaço dele, e gravar.
   Devolvem null se deu certo, ou o texto do problema.
   =================================================================== */

/* Salvar a própria ficha. O PV ATUAL não vem da ficha: quem tira e dá
   PV na mesa é o Mestre, no combate. A ficha só muda o máximo. */
function enviarMeuHeroi(sessao, heroi) {
  const estado = Campanhas.lerEstado(sessao.campanhaId);
  if (!estado) return 'Esta campanha não está mais guardada neste navegador.';

  estado.herois = estado.herois || [];
  const posicao = estado.herois.findIndex(function (h) { return h.id === heroi.id; });

  if (posicao === -1) {
    heroi.pv = heroi.pvMax;
    estado.herois.push(heroi);
  } else {
    const antigo = estado.herois[posicao];
    if (antigo.dono !== sessao.jogadorId) return 'Esse personagem não é seu.';

    /* Estava com a vida cheia? Continua cheio com o máximo novo (subir
       de nível não deixa ninguém ferido). Estava ferido? O atual fica
       como estava — curar é com o Mestre. */
    heroi.pv = antigo.pv >= antigo.pvMax ? heroi.pvMax : Math.min(antigo.pv, heroi.pvMax);
    estado.herois[posicao] = Object.assign({}, antigo, heroi);

    /* Se ele estiver no combate, nome, CA e PV máximo acompanham. */
    (estado.combate.combatentes || []).forEach(function (c) {
      if (c.heroiId !== heroi.id) return;
      c.nome = heroi.nome;
      c.ca = heroi.ca;
      c.pvMax = heroi.pvMax;
      c.pv = Math.min(c.pv, heroi.pvMax);
    });
  }

  if (!Campanhas.salvarEstado(sessao.campanhaId, estado)) {
    return 'O navegador não deixou guardar a ficha.';
  }

  Memoria.carregar();         /* a memória desta aba passa a ser a gravada */
  return null;
}


/* Registrar uma rolagem no registro da mesa, que todos veem. O jogador
   manda o que rolou; quem monta o registro é esta função — o autor sai
   da SESSÃO, não do que veio na mensagem, e o texto é cortado. Com
   servidor, ele mesmo rolaria o dado (aí nem o resultado seria
   confiado ao navegador). */
function enviarRolagem(sessao, rolagem) {
  const estado = Campanhas.lerEstado(sessao.campanhaId);
  if (!estado) return 'Esta campanha não está mais guardada neste navegador.';

  const meu = (estado.herois || []).find(function (h) { return h.dono === sessao.jogadorId; });

  const registro = {
    id: 'r' + Date.now() + Math.floor(Math.random() * 1000),
    autor: String(sessao.nome || 'Jogador').slice(0, 30),
    personagem: meu ? meu.nome : '',
    texto: String(rolagem.texto || '').slice(0, 60),
    formula: String(rolagem.formula || '').slice(0, 60),
    total: Number(rolagem.total) || 0,
    marca: rolagem.marca === 'critico' || rolagem.marca === 'falha' ? rolagem.marca : null,
    quando: Date.now()
  };

  estado.rolagensMesa = [registro].concat(estado.rolagensMesa || []).slice(0, 30);

  if (!Campanhas.salvarEstado(sessao.campanhaId, estado)) {
    return 'O navegador não deixou guardar a rolagem.';
  }

  Memoria.carregar();
  return null;
}
