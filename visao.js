/* ===================================================================
   visao.js — a fronteira entre a mesa e o jogador

   Tudo o que o jogador pode VER e tudo o que ele pode FAZER passa por
   aqui, e só por aqui:

     visaoDoJogador()     O QUE ele vê. O painel do jogador desenha só o
                          que sai desta função — nunca a campanha inteira.
     ACOES_JOGADOR        o que ele pode FAZER, com nome — como as ações
                          do Mestre no acoes.js:
                            salvarHeroi    a PRÓPRIA ficha
                            concentracao   "Concentrando" no próprio combatente
                            rolagem        uma rolagem no registro da mesa
                            mensagem       o chat (serve ao Mestre também,
                                           com as regras dele)

   RODA NOS DOIS LADOS (como o acoes.js e o modelo.js)
   No servidor, visaoDoJogador() roda ANTES de enviar: o que ela tira
   não chega ao navegador do jogador (problema 5 do CLAUDE.md: dado de
   Mestre não é escondido, é NÃO ENVIADO). E as ações rodam lá, com a
   SESSÃO que o servidor conferiu pela chave — nunca com quem o
   navegador diz ser.

   Enquanto o site ainda guarda a campanha no navegador, enviarMeuHeroi()
   e companhia (no fim do arquivo) aplicam as mesmas ações no
   armazenamento local. Na troca para o servidor, só elas mudam.


   LISTA BRANCA, SEMPRE
   Cada campo público é copiado UM A UM. O contrário — copiar tudo e
   apagar os segredos — vazaria o primeiro campo secreto que alguém
   criasse e esquecesse de apagar aqui. Com lista branca, um campo
   novo nasce escondido até alguém decidir mostrá-lo.
   =================================================================== */

const { visaoDoJogador, canalPrivado, mensagensDoJogador, LIMITE_TEXTO_MENSAGEM, ACOES_JOGADOR, aplicarAcaoJogador } = (function () {

/* As regras que vêm do modelo.js: no navegador, ele já foi carregado
   antes deste arquivo; no Node, entra por require(). */
const modelo = (typeof require === 'function' && typeof module !== 'undefined')
  ? require('./modelo.js')
  : { retratoSeguro: retratoSeguro, regrasPersonagem: regrasPersonagem };

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
    regras: modelo.regrasPersonagem(estado),

    /* A própria ficha vem inteira — é dele. Cópia, para a tela não
       mexer no Estado por engano. */
    meuHeroi: meu ? JSON.parse(JSON.stringify(meu)) : null,

    /* Os companheiros: o que se vê olhando para o lado. A vida dos
       aliados é pública na mesa — é o que decide quem curar. */
    party: herois.filter(function (h) { return h !== meu; }).map(function (h) {
      return {
        id: h.id, nome: h.nome, classe: h.classe, nivel: h.nivel, jogador: h.jogador || '',
        pv: h.pv, pvMax: h.pvMax, condicoes: condicoesDe(h.id),
        /* O retrato é o que se vê do companheiro — público. */
        foto: h.ficha ? modelo.retratoSeguro(h.ficha.foto) : null
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

    mensagens: mensagensDoJogador(estado, jogadorId),

    rolagensMesa: (estado.rolagensMesa || []).slice(0, 15).map(function (r) {
      return { id: r.id, autor: r.autor, personagem: r.personagem, texto: r.texto, formula: r.formula, total: r.total, marca: r.marca };
    })
  };
}


/* ===================================================================
   O CHAT

   Três tipos de conversa (o "canal" de cada mensagem):
     'mesa'                 todos leem: o Mestre e os jogadores
     'equipe'               só os jogadores — o Mestre fica de fora
     'privado:<jogadorId>'  só aquele jogador e o Mestre

   Do jogador, saem a mesa, a equipe e a conversa DELE com o Mestre.
   A conversa privada de outro jogador não sai daqui — com o servidor,
   não chega ao navegador dele. Do mesmo jeito, a conversa da equipe
   não vai para o Mestre (hoje o painel dele simplesmente não a mostra;
   sem servidor, ela está no mesmo armazenamento, e quem souber abrir o
   DevTools a lê).

   O AUTOR, NA VISÃO DO JOGADOR
   Sai o nome, o personagem e se a mensagem é dele mesmo — mas NÃO o
   jogadorId de quem escreveu. Sem servidor, esse id é o que identifica
   cada jogador; quem soubesse o id de outro poderia se passar por ele.
   =================================================================== */

const LIMITE_MENSAGENS = 300;
const LIMITE_TEXTO_MENSAGEM = 500;

function canalPrivado(jogadorId) {
  return 'privado:' + jogadorId;
}

function mensagensDoJogador(estado, jogadorId) {
  const meu = canalPrivado(jogadorId);
  return (estado.mensagens || [])
    .filter(function (m) { return m.canal === 'mesa' || m.canal === 'equipe' || m.canal === meu; })
    .map(function (m) {
      return {
        id: m.id, canal: m.canal, texto: m.texto, quando: m.quando,
        autor: {
          papel: m.autor.papel, nome: m.autor.nome, personagem: m.autor.personagem || '',
          eu: m.autor.papel === 'jogador' && m.autor.jogadorId === jogadorId
        }
      };
    });
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

   Mesmo roteiro do acoes.js: cada ação recebe a campanha, a SESSÃO de
   quem pede e os dados do pedido; confere se aquela pessoa pode fazer
   aquilo; muda só o pedaço dela. Devolve {} se deu certo, ou
   { erro: 'texto' } — e aí não mudou nada.

   A sessão: { papel: 'jogador' | 'mestre', jogadorId, nome }. No
   servidor ela vem da CHAVE conferida, nunca do que o navegador diz.
   =================================================================== */

const LIMITE_HEROI = 260000;      /* a ficha inteira, com o retrato */
const LIMITE_HEROIS = 12;
const ID = /^[A-Za-z0-9_-]{1,40}$/;

function inteiro(valor, minimo, maximo, padrao) {
  const n = parseInt(valor, 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, minimo), maximo) : padrao;
}

const ACOES_JOGADOR = {

  /* Salvar a própria ficha. O PV ATUAL não vem da ficha: quem tira e
     dá PV na mesa é o Mestre, no combate. A ficha só muda o máximo. */
  salvarHeroi: function (estado, sessao, dados) {
    if (sessao.papel !== 'jogador') return { erro: 'Só jogador salva a própria ficha.' };
    const heroi = dados.heroi;
    if (!heroi || typeof heroi !== 'object' || Array.isArray(heroi) || !ID.test(String(heroi.id))) return { erro: 'Ficha inválida.' };
    if (JSON.stringify(heroi).length > LIMITE_HEROI) return { erro: 'A ficha ficou grande demais (a foto, talvez).' };
    /* A foto vem do navegador do jogador: só entra se for o JPEG que o
       site gera, no tamanho de retrato — nunca 5 MB, nunca um SVG. */
    if (heroi.ficha && heroi.ficha.foto && !modelo.retratoSeguro(heroi.ficha.foto)) {
      return { erro: 'Essa foto não é válida. Escolha outra imagem.' };
    }

    /* Quem é o dono sai da SESSÃO: o navegador não escolhe de quem é o
       personagem. Os números que a mesa inteira vê chegam conferidos. */
    heroi.dono = sessao.jogadorId;
    heroi.jogador = String(sessao.nome || 'Jogador').slice(0, 30);
    heroi.nome = typeof heroi.nome === 'string' && heroi.nome.trim() ? heroi.nome.trim().slice(0, 40) : 'Sem nome';
    heroi.nivel = inteiro(heroi.nivel, 1, 20, 1);
    heroi.ca = inteiro(heroi.ca, 0, 40, 10);
    heroi.pvMax = inteiro(heroi.pvMax, 1, 999, 1);
    heroi.bonusIniciativa = inteiro(heroi.bonusIniciativa, -10, 20, 0);

    estado.herois = estado.herois || [];
    const posicao = estado.herois.findIndex(function (h) { return h.id === heroi.id; });

    if (posicao === -1) {
      if (estado.herois.some(function (h) { return h.dono === sessao.jogadorId; })) return { erro: 'Você já tem um personagem nesta campanha.' };
      if (estado.herois.length >= LIMITE_HEROIS) return { erro: 'Esta mesa já está cheia.' };
      heroi.pv = heroi.pvMax;
      estado.herois.push(heroi);
      return { novo: true };
    }

    const antigo = estado.herois[posicao];
    if (antigo.dono !== sessao.jogadorId) return { erro: 'Esse personagem não é seu.' };

    /* Estava com a vida cheia? Continua cheio com o máximo novo (subir
       de nível não deixa ninguém ferido). Estava ferido? O atual fica
       como estava — curar é com o Mestre. */
    heroi.pv = antigo.pv >= antigo.pvMax ? heroi.pvMax : Math.min(antigo.pv, heroi.pvMax);
    estado.herois[posicao] = Object.assign({}, antigo, heroi);

    /* Se ele estiver no combate, nome, CA e PV máximo acompanham. */
    ((estado.combate && estado.combate.combatentes) || []).forEach(function (c) {
      if (c.heroiId !== heroi.id) return;
      c.nome = heroi.nome;
      c.ca = heroi.ca;
      c.pvMax = heroi.pvMax;
      c.pv = Math.min(c.pv, heroi.pvMax);
    });
    return { novo: false };
  },

  /* Começar ou parar de manter uma magia de concentração. A ficha
     guarda QUAL magia (é do jogador); a condição "Concentrando" vai
     para o combatente dele, se estiver no combate — é ela que o Mestre
     e o sino de avisos enxergam. Só mexe no PRÓPRIO combatente. */
  concentracao: function (estado, sessao, dados) {
    if (sessao.papel !== 'jogador') return { erro: 'Só jogador.' };
    const meu = (estado.herois || []).find(function (h) { return h.dono === sessao.jogadorId; });
    if (!meu) return { erro: 'Você ainda não tem personagem nesta campanha.' };
    ((estado.combate && estado.combate.combatentes) || []).forEach(function (c) {
      if (c.heroiId !== meu.id) return;
      c.condicoes = (c.condicoes || []).filter(function (x) { return x !== 'Concentrando'; });
      if (dados.concentrando) c.condicoes.push('Concentrando');
    });
    return {};
  },

  /* Uma rolagem no registro da mesa, que todos veem. O autor sai da
     SESSÃO, e o texto é cortado. O resultado ainda vem do navegador do
     jogador (os dados dele); num passo seguinte, o servidor rola. */
  rolagem: function (estado, sessao, dados) {
    if (sessao.papel !== 'jogador') return { erro: 'Só jogador.' };
    const rolagem = dados.rolagem || {};
    const meu = (estado.herois || []).find(function (h) { return h.dono === sessao.jogadorId; });
    const registro = {
      id: 'r' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
      autor: String(sessao.nome || 'Jogador').slice(0, 30),
      personagem: meu ? meu.nome : '',
      texto: String(rolagem.texto || '').slice(0, 60),
      formula: String(rolagem.formula || '').slice(0, 60),
      total: inteiro(rolagem.total, -999, 9999, 0),
      marca: rolagem.marca === 'critico' || rolagem.marca === 'falha' ? rolagem.marca : null,
      quando: Date.now()
    };
    estado.rolagensMesa = [registro].concat(estado.rolagensMesa || []).slice(0, 30);
    return {};
  },

  /* Mandar uma mensagem. Serve aos dois papéis, com regras diferentes:
       jogador   na mesa, na equipe, ou na conversa DELE com o Mestre
       mestre    na mesa ou na conversa com qualquer jogador que tenha
                 personagem nesta campanha — na equipe, não
     O autor sai da SESSÃO, nunca do que veio na mensagem. */
  mensagem: function (estado, sessao, dados) {
    const limpo = String(dados.texto || '').trim();
    const canal = String(dados.canal || '');
    if (!limpo) return { erro: 'Escreva alguma coisa.' };
    if (limpo.length > LIMITE_TEXTO_MENSAGEM) return { erro: 'A mensagem pode ter até ' + LIMITE_TEXTO_MENSAGEM + ' caracteres.' };

    const herois = estado.herois || [];
    let autor;
    if (sessao.papel === 'mestre') {
      const donos = herois.filter(function (h) { return h.dono; }).map(function (h) { return canalPrivado(h.dono); });
      if (canal === 'equipe') return { erro: 'A conversa da equipe é só dos jogadores.' };
      if (canal !== 'mesa' && donos.indexOf(canal) === -1) return { erro: 'Essa conversa não existe.' };
      autor = { papel: 'mestre', nome: (estado.mestre && estado.mestre.nome) || 'Mestre' };
    } else if (sessao.papel === 'jogador') {
      if (canal !== 'mesa' && canal !== 'equipe' && canal !== canalPrivado(sessao.jogadorId)) return { erro: 'Você não participa dessa conversa.' };
      const meu = herois.find(function (h) { return h.dono === sessao.jogadorId; });
      autor = {
        papel: 'jogador', jogadorId: sessao.jogadorId,
        nome: String(sessao.nome || 'Jogador').slice(0, 30), personagem: meu ? meu.nome : ''
      };
    } else {
      return { erro: 'Sessão inválida.' };
    }

    estado.mensagens = (estado.mensagens || []).concat([{
      id: 'msg' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
      canal: canal, autor: autor, texto: limpo, quando: Date.now()
    }]).slice(-LIMITE_MENSAGENS);
    return {};
  }
};

/* Roda uma ação de jogador (ou a mensagem do Mestre). É o que o
   servidor chama, com a sessão que ELE conferiu. */
function aplicarAcaoJogador(nome, estado, sessao, dados) {
  if (!Object.prototype.hasOwnProperty.call(ACOES_JOGADOR, nome)) return { erro: 'Ação desconhecida.' };
  if (!sessao || (sessao.papel !== 'jogador' && sessao.papel !== 'mestre')) return { erro: 'Sessão inválida.' };
  return ACOES_JOGADOR[nome](estado, sessao, dados || {}) || {};
}

return { visaoDoJogador: visaoDoJogador, canalPrivado: canalPrivado, mensagensDoJogador: mensagensDoJogador,
  LIMITE_TEXTO_MENSAGEM: LIMITE_TEXTO_MENSAGEM, ACOES_JOGADOR: ACOES_JOGADOR, aplicarAcaoJogador: aplicarAcaoJogador };
})();


/* ===================================================================
   NO NAVEGADOR, ENQUANTO A CAMPANHA MORA NELE

   As telas chamam estas quatro. Cada uma lê a campanha FRESCA do
   armazenamento (não a da memória, que pode estar velha — o Mestre
   pode ter mexido em outra aba), aplica a ação acima e grava. Devolvem
   null se deu certo, ou o texto do problema. Na troca para o servidor,
   só elas mudam: passam a mandar o pedido pela conexão.
   =================================================================== */

function acaoNoNavegador(sessao, nome, dados) {
  const estado = Campanhas.lerEstado(sessao.campanhaId);
  if (!estado) return 'Esta campanha não está mais guardada neste navegador.';
  const r = aplicarAcaoJogador(nome, estado, sessao, dados);
  if (r.erro) return r.erro;
  if (!Campanhas.salvarEstado(sessao.campanhaId, estado)) return 'O navegador não deixou guardar.';
  Memoria.carregar();         /* a memória desta aba passa a ser a gravada */
  return null;
}

function enviarMeuHeroi(sessao, heroi) { return acaoNoNavegador(sessao, 'salvarHeroi', { heroi: heroi }); }
function enviarConcentracao(sessao, concentrando) { return acaoNoNavegador(sessao, 'concentracao', { concentrando: concentrando }); }
function enviarRolagem(sessao, rolagem) { return acaoNoNavegador(sessao, 'rolagem', { rolagem: rolagem }); }
function enviarMensagem(sessao, canal, texto) { return acaoNoNavegador(sessao, 'mensagem', { canal: canal, texto: texto }); }


if (typeof module !== 'undefined' && module.exports) {
  module.exports = { visaoDoJogador: visaoDoJogador, canalPrivado: canalPrivado, mensagensDoJogador: mensagensDoJogador, ACOES_JOGADOR: ACOES_JOGADOR, aplicarAcaoJogador: aplicarAcaoJogador };
}
