/* ===================================================================
   dados.js — o estado da mesa

   Tudo o que as telas mostram sai daqui. Hoje é um objeto de exemplo;
   amanhã é o que o servidor manda. Nenhuma tela desenha nada que não
   esteja neste objeto — é isso que vai deixar a troca indolor: quando
   o servidor existir, ele vira o dono do Estado e as telas continuam
   iguais.

   Este arquivo é compartilhado: mestre.html (visão geral) e
   combate.html leem daqui. Sem isso, cada tela teria a sua cópia dos
   mesmos heróis, e elas sairiam do ar uma da outra.

   O OBJETO ABAIXO É SÓ O EXEMPLO
   O Estado literal deste arquivo é a campanha de demonstração (A Queda
   de Valkoria). Ao abrir uma página, Memoria.carregar() — no fim do
   arquivo — troca tudo pela campanha da sessão, guardada pelo
   campanhas.js. Por isso este arquivo precisa do campanhas.js
   carregado ANTES dele. Uma campanha nova nasce de estadoVazio() ou
   de estadoDeExemplo(), também definidos aqui.

   Como cada submenu é uma página de verdade, navegar entre elas
   recarrega o JavaScript; é o salvar/carregar que faz o PV tirado no
   Combate continuar tirado na Visão Geral. Quem vai guardar o estado
   de verdade é o servidor — e aí só o campanhas.js muda.
   =================================================================== */


/* ---------- A ESCALA DO MAPA ----------
   Uma célula = 1,5 m (5 pés), a escala do D&D, e CELULA é o lado dela
   em unidades do SVG. Moram aqui, e não no mapas.js, porque a Visão
   Geral desenha a MESMA planta em miniatura: duas telas lendo o mesmo
   número é o que impede um token de aparecer em casas diferentes. */
const CELULA = 40;
const METROS_POR_CELULA = 1.5;

/* Uma imagem guardada, se for de confiança — senão, null.
   O site só grava imagens que ele mesmo recomprimiu em JPEG
   (imagens.js). Esta checagem existe porque o Estado vem do
   localStorage, que qualquer um edita — e um endereço qualquer num
   <img> ou num <image> do SVG não é coisa para aceitar às cegas.
   `limite` é o tamanho máximo do texto (ver Imagens.PERFIS). */
function imagemSegura(imagem, limite) {
  return typeof imagem === 'string'
    && imagem.length <= (limite || 700000)
    && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(imagem)
    ? imagem : null;
}

/* A imagem de fundo de uma cena. Usada pelas duas telas que desenham
   a planta (Mapas e a planta.js). */
function imagemDaCena(cena) {
  return imagemSegura(cena && cena.imagem, 700000);
}

/* O retrato de um personagem ou de um monstro. */
const LIMITE_RETRATO = 160000;
function retratoSeguro(imagem) {
  return imagemSegura(imagem, LIMITE_RETRATO);
}


const Estado = {

  campanha: {
    nome: 'A Queda de Valkoria',
    sessao: 12,
    capitulo: 'IV',
    nivelMedio: 8,
    codigo: 'VLK-4821',
    sistema: 'D&D 5.5e',
    regra: 'Sessão corrente: clima de tempestade arcana, visibilidade limitada.'
  },

  mestre: { nome: 'Mestre Arthur' },

  grupo: { nome: 'Aventureiros de Valkoria' },

  /* As fichas dos jogadores. O combate referencia estes heróis pelo
     id, para o PV não viver em dois lugares diferentes. */
  herois: [
    {
      id: 'kaelen', nome: 'Kaelen Valerius', classe: 'Guerreiro Campeão (Humano)',
      nivel: 8, estado: 'Vigília', ca: 19, pp: 14, bonusIniciativa: 2,
      terceira: { rotulo: 'Iniciativa', valor: '+2 (16)' },
      pv: 42, pvMax: 50, rodape: 'Surto de ação: 1/1 disponível'
    },
    {
      id: 'lyanna', nome: 'Lyanna Lunavento', classe: 'Maga Evocadora (Elfa)',
      nivel: 8, estado: 'Parede de Fogo', estadoPerigo: true, ca: 15, pp: 12, bonusIniciativa: 3,
      terceira: { rotulo: 'Espaços 4º', valor: '1 / 2' },
      pv: 18, pvMax: 30, recursos: { rotulo: 'Espaços', usados: 3, total: 6 },
      rodape: 'Concentrando — CD 10 ao sofrer dano'
    },
    {
      id: 'dorian', nome: 'Dorian Corvo', classe: 'Ladino Trapaceiro (Meio-Elfo)',
      nivel: 8, estado: 'Furtivo (24)', ca: 17, pp: 18, bonusIniciativa: 5,
      terceira: { rotulo: 'Iniciativa', valor: '+5 (22)' },
      pv: 28, pvMax: 28, rodape: 'Ataque furtivo 4d6 · Esquiva sobrenatural'
    },
    {
      id: 'tharivol', nome: 'Tharivol Aurora', classe: 'Clérigo da Luz (Humano)',
      nivel: 8, estado: 'Abençoado', ca: 20, pp: 15, bonusIniciativa: 1,
      terceira: { rotulo: 'Canalizar', valor: '2 / 2' },
      pv: 35, pvMax: 35, rodape: 'Gastos: 2× 1º · 1× 3º'
    }
  ],



  /* ---------- AS CENAS ----------
     Cada cena é uma planta em GRADE. Tudo aqui é contado em células,
     nunca em pixels: uma parede em [3, 2, 6, 1] ocupa 6 células de
     largura por 1 de altura, a partir da coluna 3, linha 2.

     O motivo é simples: o mapa é desenhado em SVG e se estica com a
     tela. Se as posições fossem em pixels, um token colocado no
     notebook estaria no lugar errado no monitor grande. Em células,
     ele fica na mesma casa em qualquer tamanho.

     A escala é a do D&D: uma célula = 1,5 metro (5 pés). É o que faz
     a régua da tela poder dizer "9 m" com sentido. */
  cenaAtual: 'cripta',

  cenas: [
    {
      id: 'cripta',
      nome: 'Cripta do Rei Esquecido',
      visibilidade: 'Penumbra — tochas a 6 m',
      colunas: 24, linhas: 14,
      /* [coluna, linha, largura, altura] */
      paredes: [
        [0, 0, 24, 1], [0, 13, 24, 1], [0, 1, 1, 12], [23, 1, 1, 12],
        [5, 3, 1, 4], [5, 8, 1, 3],
        [18, 3, 1, 4], [18, 8, 1, 3],
        [10, 1, 1, 3], [13, 1, 1, 3],
        [10, 10, 1, 3], [13, 10, 1, 3],
        [11, 6, 2, 2]
      ],
      tokens: [
        { id: 't1', nome: 'Kaelen Valerius', inicial: 'K', tipo: 'heroi', col: 8, lin: 7 },
        { id: 't2', nome: 'Dorian Corvo', inicial: 'D', tipo: 'heroi', col: 6, lin: 9 },
        /* O nome precisa bater com o do combatente em Estado.combate —
           é por ele que "Trazer combatentes" sabe quem já está no
           mapa, e é por ele que o painel acha a vida do token. */
        /* Tharivol e Lyanna estavam na ordem de iniciativa, com PV
           contados, e não estavam no mapa: o painel afirmava duas
           coisas ao mesmo tempo. A Lyanna fica atrás da coluna de
           [10,10] porque é o que a nota dela em Estado.combate diz. */
        { id: 't5', nome: 'Tharivol Aurora', inicial: 'T', tipo: 'heroi', col: 7, lin: 5 },
        { id: 't6', nome: 'Lyanna Lunavento', inicial: 'L', tipo: 'heroi', col: 9, lin: 11 },
        { id: 't3', nome: 'Aparição Sombria Alpha', inicial: 'A', tipo: 'inimigo', col: 16, lin: 5 },
        { id: 't4', nome: 'Carniçal de Armadura', inicial: 'C', tipo: 'inimigo', col: 19, lin: 8 }
      ],
      marcadores: [
        { id: 'm1', col: 12, lin: 9, tipo: 'perigo', texto: 'Glifo de Chamas (CD 15)' },
        { id: 'm2', col: 12, lin: 3, tipo: 'nota', texto: 'Trono — a coroa partida está aqui' }
      ]
    },
    {
      id: 'taverna',
      nome: 'Taverna Sombria',
      visibilidade: 'Luz plena — lareira e velas',
      colunas: 20, linhas: 12,
      paredes: [
        [0, 0, 20, 1], [0, 11, 20, 1], [0, 1, 1, 10], [19, 1, 1, 10],
        [1, 1, 7, 1],
        [4, 4, 2, 2], [9, 4, 2, 2], [14, 4, 2, 2],
        [4, 8, 2, 2], [9, 8, 2, 2], [14, 8, 2, 2]
      ],
      tokens: [
        { id: 't5', nome: 'Madame Selis', inicial: 'S', tipo: 'npc', col: 3, lin: 2 }
      ],
      marcadores: [
        { id: 'm3', col: 17, lin: 2, tipo: 'nota', texto: 'Porta dos fundos — sempre destrancada' }
      ]
    },
    {
      id: 'portao',
      nome: 'Portão Leste',
      visibilidade: 'Noite — tochas na muralha',
      colunas: 22, linhas: 12,
      paredes: [
        [0, 4, 9, 2], [13, 4, 9, 2],
        [8, 0, 1, 4], [13, 0, 1, 4],
        [8, 6, 1, 6], [13, 6, 1, 6]
      ],
      tokens: [
        { id: 't6', nome: 'Capitã Yvette', inicial: 'Y', tipo: 'npc', col: 10, lin: 7 }
      ],
      marcadores: [
        { id: 'm4', col: 10, lin: 2, tipo: 'nota', texto: 'Guarita — troca de turno à meia-noite' }
      ]
    }
  ],


  /* ---------- O COMBATE ----------
     'combatentes' já vem na ordem de iniciativa (maior para menor).
     Quem é herói carrega heroiId, para o dano chegar na ficha. */
  combate: {
    ativo: true,
    rodada: 3,
    encontro: 'Emboscada na Cripta do Rei Esquecido',
    /* Dificuldade e ND descrevem o ENCONTRO, não a sala: a mesma
       cripta pode hospedar uma emboscada difícil hoje e uma conversa
       amanhã. Antes moravam em Estado.cena, que não existe mais. */
    dificuldade: 'Desafio difícil',
    nd: 8,

    combatentes: [
      {
        id: 'c1', heroiId: 'dorian', nome: 'Dorian Corvo', tipo: 'heroi',
        iniciativa: 22, ca: 17, pv: 28, pvMax: 28, agiu: true,
        condicoes: [], nota: 'Ação completa · reação disponível'
      },
      {
        id: 'c2', nome: 'Aparição Sombria Alpha', tipo: 'inimigo',
        iniciativa: 19, ca: 12, pv: 38, pvMax: 60, agiu: true,
        condicoes: [], nota: 'Drenar Vida usado'
      },
      {
        id: 'c3', heroiId: 'kaelen', nome: 'Kaelen Valerius', tipo: 'heroi',
        iniciativa: 16, ca: 19, pv: 42, pvMax: 50, agiu: false,
        condicoes: [], nota: 'Ação, ação bônus e 9m livres'
      },
      {
        id: 'c4', heroiId: 'tharivol', nome: 'Tharivol Aurora', tipo: 'heroi',
        iniciativa: 14, ca: 20, pv: 35, pvMax: 35, agiu: false,
        condicoes: ['Abençoado'], nota: 'Em espera — Canalizar pronto'
      },
      {
        id: 'c5', nome: 'Carniçal de Armadura', tipo: 'inimigo',
        iniciativa: 11, ca: 16, pv: 22, pvMax: 22, agiu: false,
        condicoes: [], nota: 'Garras paralisantes'
      },
      {
        id: 'c6', heroiId: 'lyanna', nome: 'Lyanna Lunavento', tipo: 'heroi',
        iniciativa: 9, ca: 15, pv: 18, pvMax: 30, agiu: false,
        condicoes: ['Concentrando'], nota: 'Atrás da coluna'
      }
    ],

    /* O que aconteceu, do mais novo para o mais velho. */
    registro: [
      { texto: 'Aparição Sombria acerta Lyanna — 12 de dano necrótico.', tipo: 'dano' },
      { texto: 'Lyanna conjura Parede de Fogo. Concentração ativa.', tipo: 'magia' },
      { texto: 'Rodada 3 começou.', tipo: 'turno' }
    ]
  },

  acoesDaVez: ['Golpe Devastador', 'Postura Defensiva', 'Surto de Ação'],

  rolagens: [
    /* O dado precisa mostrar 20 NATURAL para ser crítico — não basta
       o total ser alto. Este exemplo já disse "23 · acerto crítico"
       num d20 + 6, ou seja, um 17 no dado: a tela ensinava a regra
       errada enquanto o rolador, logo ali, aplicava a certa. */
    { texto: 'Ataque — Aparição', formula: 'd20 (20) + 6', total: 26, marca: 'critico' },
    { texto: 'Salvaguarda DES — Lyanna', formula: '14 + 1', total: 15, nota: 'Sucesso' },
    { texto: 'Dano — Parede de Fogo', formula: '5d8', total: 24, nota: 'Ígneo' }
  ],

  npc: {
    nome: 'Boran, o Ferreiro Caolho',
    traco: 'Anão da Montanha · desconfiado com arcanistas',
    segredo: 'Esconde a chave da cripta selada.'
  },


  /* ---------- O ELENCO ----------
     Diferente de magias e monstros, que são catálogo (regras.js),
     NPC é conteúdo DESTA campanha: o mestre inventa, edita e mata.
     Por isso mora no Estado e é salvo.

     'segredo' é o campo mais delicado do sistema inteiro. Quando
     houver servidor, ele é o exemplo perfeito do que NÃO pode ser
     mandado ao navegador de um jogador — nem escondido com CSS,
     simplesmente não enviado. Ver o aviso no topo do layout.js. */

  /* ---------- O DIÁRIO ----------
     Três coisas diferentes moram aqui, e vale separar por quê:

     diario      o que aconteceu em cada sessão. Tem uma parte que a
                 party pode ler (resumo) e uma que é só sua (notas).
     segredos    verdades da campanha, cada uma com o estado de já ter
                 sido revelada ou não. Um segredo revelado deixa de ser
                 perigoso e vira história.
     pendencias  o que ficou em aberto e você não pode esquecer. As que
                 têm prazo aparecem primeiro.

     Tudo isto é conteúdo SEU, então mora no Estado e é salvo — a mesma
     divisão de NPCs e tabelas próprias. */
  diario: [
    {
      id: 'd12', sessao: 12, data: '2026-09-26', titulo: 'Emboscada na cripta',
      emAberto: true,
      resumo: 'A party desceu pela entrada dos fundos e caiu numa emboscada montada por aparições. Lyanna ergueu uma parede de fogo para fechar o corredor leste; Kaelen segurou a linha sozinho por duas rodadas.',
      notas: 'Deixei o Carniçal entrar tarde de propósito, para a Lyanna ter que escolher entre manter a concentração e curar. Funcionou: ela manteve, e quase caiu por isso. Se o combate se arrastar, o Encapuzado observa de longe e depois recua sem lutar.'
    },
    {
      id: 'd11', sessao: 11, data: '2026-09-19', titulo: 'O ferreiro e a dívida',
      resumo: 'Boran pediu ajuda com a dívida da forja. Em troca, contou que a cripta foi selada há trinta anos — e que ele estava lá. Torvin foi encontrado morto na própria loja, sem ferimento visível.',
      notas: 'A party ainda não ligou a morte do Torvin ao Culto. O corpo sem marca foi de propósito: foi um espectro, não uma faca. Se investigarem, um teste de Medicina CD 14 revela que ele morreu com o máximo de PV drenado.'
    },
    {
      id: 'd10', sessao: 10, data: '2026-09-12', titulo: 'A noite do desaparecimento',
      resumo: 'Três moradores sumiram na mesma noite, todos devedores da guilda. A Guarda arquivou o caso rápido demais. Nessa ofereceu guiar a party pelas ruas baixas.',
      notas: 'A capitã Yvette arquivou porque recebe do Culto. Ela entrega tudo se for confrontada com prova — não antes.'
    },
    {
      id: 'd9', sessao: 9, data: '2026-09-05', titulo: 'Chegada a Valkoria',
      resumo: 'A party chegou à cidade atrás de trabalho e ouviu, na Taverna Sombria, a primeira menção ao rei que não morreu direito.',
      notas: 'Sessão de apresentação. Madame Selis marcou cada um deles mentalmente; ela já vendeu os nomes da party para o Culto.'
    }
  ],

  segredos: [
    {
      id: 's1', titulo: 'Boran tem a chave da cripta selada',
      texto: 'Ele ajudou a selá-la há trinta anos e guardou a chave por medo. Entrega se a dívida da forja for paga — ou se alguém morrer por causa dela.',
      revelado: false, ligadoA: 'Boran, o Ferreiro Caolho'
    },
    {
      id: 's2', titulo: 'O Encapuzado é irmão de Kaelen',
      texto: 'Desaparecido há sete anos. Entrou no Culto por vontade própria e já poupou a party uma vez, sem explicar.',
      revelado: false, ligadoA: 'O Encapuzado'
    },
    {
      id: 's3', titulo: 'A capitã Yvette recebe do Culto',
      texto: 'Desvia as patrulhas da cripta às quintas. Não sabe para que serve o dinheiro, e prefere não saber.',
      revelado: false, ligadoA: 'Capitã Yvette Mordrek'
    },
    {
      id: 's4', titulo: 'Torvin vendia armas ao Culto',
      texto: 'Vendia para os dois lados. Foi morto quando tentou aumentar o preço.',
      revelado: true, reveladoEm: 11, ligadoA: 'Torvin Casca-Grossa'
    },
    {
      id: 's5', titulo: 'A coroa precisa das duas metades',
      texto: 'Vhalor só pode ser destruído com as duas metades reunidas. O Culto tem uma; a outra está com Boran, sem que ele saiba o que é.',
      revelado: false, ligadoA: 'Vhalor, o Rei Esquecido'
    }
  ],

  pendencias: [
    {
      id: 'p1', texto: 'O ritual do Culto acontece na lua nova.',
      prazo: 'Faltam 6 dias de jogo', resolvida: false, urgente: true
    },
    {
      id: 'p2', texto: 'A dívida da forja de Boran vence e a guilda toma a oficina.',
      prazo: 'Faltam 10 dias de jogo', resolvida: false, urgente: true
    },
    {
      id: 'p3', texto: 'Nessa quer encontrar a irmã — que está no Culto por vontade própria.',
      prazo: '', resolvida: false, urgente: false
    },
    {
      id: 'p4', texto: 'Descobrir quem soltou o prisioneiro da cela 4.',
      prazo: '', resolvida: false, urgente: false
    },
    {
      id: 'p5', texto: 'Levar o corpo de Torvin ao templo para exame.',
      prazo: '', resolvida: true, urgente: false
    }
  ],


  faccoes: [
    {
      id: 'culto', nome: 'Culto do Rei Esquecido', tipo: 'Culto',
      relacao: 'inimiga', sede: 'Cripta subterrânea',
      objetivo: 'Despertar Vhalor e devolver a coroa partida ao trono.',
      influencia: 'Cresce nas ruas baixas; já comprou dois guardas.'
    },
    {
      id: 'aurora', nome: 'Ordem da Aurora', tipo: 'Ordem religiosa',
      relacao: 'aliada', sede: 'Templo da Luz Primeira',
      objetivo: 'Purgar os mortos-vivos das terras de Valkoria.',
      influencia: 'Poucos membros, mas com autoridade sobre o templo.'
    },
    {
      id: 'guarda', nome: 'Guarda de Valkoria', tipo: 'Militar',
      relacao: 'neutra', sede: 'Quartel do Portão Leste',
      objetivo: 'Manter a ordem — e não fazer perguntas demais.',
      influencia: 'Controla os portões e as patrulhas noturnas.'
    },
    {
      id: 'ferreiros', nome: 'Guilda dos Ferreiros', tipo: 'Guilda',
      relacao: 'neutra', sede: 'Rua das Bigornas',
      objetivo: 'Manter o monopólio do aço na região.',
      influencia: 'Todo equipamento decente passa por eles.'
    }
  ],

  npcs: [
    {
      id: 'n1', nome: 'Boran, o Ferreiro Caolho', papel: 'Ferreiro da guilda',
      raca: 'Anão da Montanha', local: 'Rua das Bigornas', faccao: 'ferreiros',
      atitude: 'aliado', status: 'vivo', conhecido: true,
      aparencia: 'Um olho leitoso, mãos queimadas, fala pouco e alto.',
      objetivo: 'Pagar a dívida da forja antes que a guilda a tome.',
      segredo: 'Esconde a chave da cripta selada — ele mesmo ajudou a selá-la, há trinta anos.',
      notas: 'Conserta equipamento com desconto se a party ajudar com a dívida.'
    },
    {
      id: 'n2', nome: 'Madame Selis', papel: 'Dona da Taverna Sombria',
      raca: 'Humana de Valkoria', local: 'Taverna Sombria', faccao: null,
      atitude: 'neutro', status: 'vivo', conhecido: true,
      aparencia: 'Alta, de luto permanente, nunca senta.',
      objetivo: 'Saber de tudo antes de todo mundo.',
      segredo: 'Vende a mesma informação para o Culto, para a Guarda e para a Ordem.',
      notas: 'Troca rumor por rumor — não aceita ouro.'
    },
    {
      id: 'n3', nome: 'Irmão Aldric', papel: 'Clérigo da Ordem',
      raca: 'Humano de Valkoria', local: 'Templo da Luz Primeira', faccao: 'aurora',
      atitude: 'aliado', status: 'vivo', conhecido: true,
      aparencia: 'Jovem demais para o cargo, mãos sempre trêmulas.',
      objetivo: 'Provar que a cripta pode ser purificada sem ser destruída.',
      segredo: 'Perdeu a fé depois do que viu lá embaixo. Ainda conjura, e não sabe como.',
      notas: 'Cura a party de graça, mas cobra que contem o que viram.'
    },
    {
      id: 'n4', nome: 'Capitã Yvette Mordrek', papel: 'Capitã da Guarda',
      raca: 'Meio-elfa do Porto', local: 'Quartel do Portão Leste', faccao: 'guarda',
      atitude: 'neutro', status: 'vivo', conhecido: true,
      aparencia: 'Armadura impecável, olheiras de três noites.',
      objetivo: 'Terminar o turno sem mais um desaparecido.',
      segredo: 'Recebe do Culto para desviar as patrulhas da cripta às quintas.',
      notas: 'Se confrontada com prova, entrega o Culto para salvar a própria pele.'
    },
    {
      id: 'n5', nome: 'Nessa Pena-Rápida', papel: 'Batedora',
      raca: 'Halfling Pé-Leve', local: 'Onde for preciso', faccao: null,
      atitude: 'aliado', status: 'vivo', conhecido: true,
      aparencia: 'Fala rápido, come mais rápido ainda.',
      objetivo: 'Encontrar a irmã, sumida há dois meses.',
      segredo: 'A irmã está no Culto — por vontade própria.',
      notas: 'Guia barato pelas ruas baixas. Não entra na cripta por nada.'
    },
    {
      id: 'n6', nome: 'O Encapuzado', papel: 'Líder do Culto',
      raca: 'Desconhecida', local: 'Cripta subterrânea', faccao: 'culto',
      atitude: 'hostil', status: 'vivo', conhecido: false,
      aparencia: 'Nunca mostra o rosto. Voz jovem, mãos de velho.',
      objetivo: 'Completar o ritual antes da lua nova.',
      segredo: 'É o irmão desaparecido de Kaelen Valerius.',
      notas: 'Sabe o nome de cada um da party. Já os poupou uma vez.'
    },
    {
      id: 'n7', nome: 'Vhalor, o Rei Esquecido', papel: 'Rei morto-vivo',
      raca: 'Morto-vivo', local: 'Câmara do trono, cripta', faccao: 'culto',
      atitude: 'hostil', status: 'vivo', conhecido: false,
      aparencia: 'Coroa partida ao meio, cravada na própria testa.',
      objetivo: 'Recuperar a metade que falta da coroa.',
      segredo: 'Só pode ser destruído com as duas metades da coroa reunidas — e uma delas está com Boran.',
      notas: 'Ainda dorme. O ritual do Culto é o que vai acordá-lo.'
    },
    {
      id: 'n8', nome: 'Torvin Casca-Grossa', papel: 'Mercador',
      raca: 'Anão da Montanha', local: 'Mercado do Portão', faccao: null,
      atitude: 'neutro', status: 'morto', conhecido: true,
      aparencia: 'Era gordo, risonho e falso.',
      objetivo: 'Vender para os dois lados enquanto durasse.',
      segredo: 'Vendia armas ao Culto. Foi morto por isso, e não pela party.',
      notas: 'Encontrado na própria loja, sem marca de ferimento.'
    }
  ],

  tesouro: '42 PO · 150 PP · granada polida (50 PO) · pergaminho de Identificação',

  /* O que o mestre fixou no compêndio para ter à mão nesta campanha.
     É escolha DELE (estado), não conteúdo do livro (regras.js). */
  fixadas: ['Parede de Fogo', 'Contramágica'],

  audio: { pista: 'Cripta dos Ancestrais (loop)', volume: 42, tocando: true }
};


/* ---------- O exemplo, guardado à parte ----------
   Uma cópia do objeto acima, tirada ANTES de Memoria.carregar() (lá
   embaixo) trocar o Estado pela campanha aberta. É dela que sai a
   opção "começar com o exemplo" da criação de campanha.

   JSON.parse(JSON.stringify(...)) é a cópia profunda mais simples:
   sem ela, mexer no herói da campanha nova mexeria também no exemplo,
   porque os dois apontariam para o mesmo objeto. */
const EXEMPLO = JSON.parse(JSON.stringify(Estado));

function estadoDeExemplo() {
  return JSON.parse(JSON.stringify(EXEMPLO));
}


/* ---------- O molde de uma campanha vazia ----------
   Tem TODAS as chaves que as telas leem, só que sem conteúdo. Ele é
   também o "formato oficial" do Estado: ao carregar uma campanha, o
   salvo é aplicado POR CIMA deste molde (ver Memoria.carregar). Assim,
   se um dia uma chave nova entrar aqui, as campanhas antigas ganham o
   valor vazio dela em vez de quebrar a tela. */
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


/* As regras de criação de personagem da campanha, sempre completas.
   O carregar() junta o salvo por cima do molde só no primeiro nível
   (Estado.campanha inteiro vem do salvo), então uma campanha criada
   antes desta regra existir não tem o objeto — e quem lê não deve
   ter de lembrar disso. */
function regrasPersonagem(estado) {
  const campanha = (estado || Estado).campanha || {};
  return Object.assign(
    { atributos: 'compra', pv: 'media', talentos: true, multiclasse: false },
    campanha.regrasPersonagem
  );
}


/* ---------- O bestiário inteiro: o do livro + os seus ----------
   Os monstros prontos vêm de BESTIARIO (regras.js) e não se editam.
   Os que o mestre cria ficam em Estado.monstrosMeus e são salvos com a
   campanha — a mesma divisão das tabelas (TABELAS × tabelasMinhas).

   Toda tela que lista monstros (Bestiário, Combate, busca) pergunta
   AQUI, e não ao BESTIARIO direto. Assim um monstro novo aparece em
   todas de uma vez, sem cada tela ter de lembrar que ele existe.

   'meu: true' marca os criados — é o que libera Editar e Apagar. É
   colocado numa CÓPIA, para não gravar a marca junto do monstro. */
function todosMonstros() {
  /* Os do livro não se editam: a foto que o Mestre põe neles fica
     guardada à parte, na campanha, pelo nome (fotosMonstros). */
  const fotos = Estado.fotosMonstros || {};
  const prontos = (typeof BESTIARIO !== 'undefined' ? BESTIARIO : []).map(function (b) {
    return fotos[b.nome] ? Object.assign({}, b, { foto: fotos[b.nome] }) : b;
  });
  const meus = (Estado.monstrosMeus || []).map(function (m) {
    return Object.assign({}, m, { meu: true });
  });
  return prontos.concat(meus);
}

/* O nome é a chave do bestiário (é por ele que o combate e a busca
   acham a ficha), e o formulário não deixa repetir nome. */
function acharMonstro(nome) {
  return todosMonstros().find(function (m) { return m.nome === nome; }) || null;
}


/* ---------- Regras de condições ----------
   O texto é NOSSO (escrito aqui), nunca digitado por um jogador — por
   isso algumas usam <strong> com segurança. */
const CONDICOES = {
  Agarrado:    'Deslocamento vira 0. Termina se o agarrador ficar incapacitado ou a criatura for afastada do alcance.',
  Amedrontado: 'Desvantagem em testes e ataques enquanto enxergar a fonte do medo. Não pode se aproximar dela de bom grado.',
  Caído:       'Só rasteja. Desvantagem nos ataques dela; ataques a até 1,5m contra ela têm vantagem, os demais, desvantagem.',
  Cego:        'Falha em qualquer teste que exija visão. Ataques dela têm desvantagem; ataques contra ela, vantagem.',
  Enfeitiçado: 'Não ataca quem a enfeitiçou. Quem enfeitiçou tem vantagem em testes sociais com ela.',
  Envenenado:  'Desvantagem em ataques e em testes de habilidade.',
  Inconsciente: 'Incapacitada, cai no chão e larga o que segura. Ataques a até 1,5m são <strong>críticos automáticos</strong>.',
  Invisível:   'Não pode ser vista sem magia ou sentido especial. Ataques dela têm vantagem; contra ela, desvantagem.',
  Paralisado:  'Incapacitado, não se move nem fala. Falha automaticamente em salvaguardas de FOR e DES. Ataques a até 1,5m são <strong>críticos automáticos</strong>.',
  Surdo:       'Falha em qualquer teste que exija audição.'
};


/* Peças soltas para o gerador de NPC. */
const GERADOR = {
  nomes:    ['Boran', 'Selis', 'Marrec', 'Ilvane', 'Dagra', 'Torvin', 'Eskel', 'Mirena', 'Halric', 'Yvette'],
  epitetos: ['o Ferreiro Caolho', 'a Estalajadeira Muda', 'o Coveiro Sorridente', 'a Escriba Sem Sombra', 'o Guarda Endividado', 'a Alquimista Trêmula'],
  racas:    ['Anão da Montanha', 'Humano de Valkoria', 'Meio-Elfo do Porto', 'Halfling Pé-Leve', 'Tiefling do Bairro Baixo', 'Gnomo das Rochas'],
  tracos:   ['desconfiado com arcanistas', 'fala sempre em provérbios', 'deve favores à guilda', 'tem medo de espaços fechados', 'coleciona dentes de monstro', 'nunca olha nos olhos'],
  segredos: ['Esconde a chave da cripta selada.', 'Trabalha para o culto do Rei Esquecido.', 'Viu quem matou o guarda da ponte.', 'Guarda um mapa rasgado do santuário.', 'Está sendo chantageado há meses.', 'É o irmão desaparecido de um dos heróis.']
};


/* ===================================================================
   GUARDAR O ESTADO NA CAMPANHA ABERTA

   Antes isto ia para o sessionStorage e sumia ao fechar a aba. Agora
   o Estado pertence a uma CAMPANHA, guardada pelo campanhas.js no
   localStorage. A sessão diz qual campanha está aberta.

   Quem grava é só o Mestre. Um jogador abre a mesma campanha para
   LER; se o navegador dele também gravasse, qualquer jogador poderia
   reescrever a campanha inteira. Quando houver servidor, essa regra
   passa para ele (só o Mestre manda certas ações).
   =================================================================== */

const Memoria = {

  /* Chamado depois de toda mudança.

     Além de guardar, avisa ('plainus:mudou') que o Estado mudou. Toda
     tela já chama salvar() depois de mexer em algo, então este é o
     único ponto por onde TODA mudança passa — é aqui que o sino fica
     sabendo que um herói caiu, sem cada tela ter que lembrar dele. */
  /* Devolve true se gravou. Quem precisa reagir a uma falha (a janela
     de cena, que pode desfazer uma imagem grande demais) passa
     { silencioso: true } e dá o próprio recado. */
  salvar: function (opcoes) {
    const sessao = Sessao.ler();
    let ok = true;

    if (sessao && sessao.papel === 'mestre') {
      ok = Campanhas.salvarEstado(sessao.campanhaId, Estado);

      /* Falhar em silêncio aqui seria o pior dos mundos: o mestre
         jogaria a sessão inteira achando que estava salvo. */
      if (!ok && !(opcoes && opcoes.silencioso) && typeof Layout !== 'undefined') {
        Layout.recado('Não consegui salvar a campanha — o armazenamento do navegador recusou. O que você mudar agora pode se perder.', true);
      }
    }

    /* Avisa mesmo se a gravação falhou: o Estado na memória mudou, e
       o sino deve refletir o que está na tela. */
    document.dispatchEvent(new CustomEvent('plainus:mudou'));
    return ok;
  },

  /* Chamado uma vez, ao abrir a página. Troca o exemplo pela campanha
     da sessão.

     O salvo é aplicado POR CIMA do molde vazio, e não do exemplo:
     se o salvo não tiver alguma chave, ela fica vazia — e não com os
     heróis de Valkoria vazando para dentro da sua campanha. */
  carregar: function () {
    const sessao = Sessao.ler();
    if (!sessao) return;

    const salvo = Campanhas.lerEstado(sessao.campanhaId);
    if (!salvo) return;

    Object.keys(Estado).forEach(function (chave) { delete Estado[chave]; });
    Object.assign(Estado, estadoVazio(), salvo);
  }
};

Memoria.carregar();


/* ===================================================================
   QUANDO OUTRA ABA MUDA A CAMPANHA

   Sem servidor, Mestre e jogador dividem o mesmo localStorage — quase
   sempre em abas diferentes. O perigo: o jogador cria o personagem na
   aba dele; o Mestre, com o painel aberto, clica em qualquer coisa; o
   painel grava o Estado que tem NA MEMÓRIA, que não conhece o
   personagem novo — e o apaga.

   O navegador avisa as OUTRAS abas quando o localStorage muda: é o
   evento 'storage' (a aba que gravou não recebe). Ao ouvir que a
   campanha aberta mudou, recarregamos o Estado e avisamos
   'plainus:externo', para a tela que quiser se redesenhar.

   Com o servidor, este papel passa para o Socket.IO: é ele que vai
   empurrar o estado novo para cada navegador.
   =================================================================== */
window.addEventListener('storage', function (evento) {
  const sessao = Sessao.ler();
  if (!sessao || evento.key !== PREFIXO_CAMPANHA + sessao.campanhaId) return;

  Memoria.carregar();
  document.dispatchEvent(new CustomEvent('plainus:externo'));
  document.dispatchEvent(new CustomEvent('plainus:mudou'));
});


/* ===================================================================
   Mesa — operações sobre o Estado que mais de uma tela precisa.

   Nasceu porque a tela de Combate e a do Bestiário fazem a MESMA
   coisa ("põe esta criatura na ordem de iniciativa"), e duas cópias
   da mesma regra é o começo de duas regras diferentes.

   Repare que nada aqui sabe desenhar tela: só mexe no Estado e salva.
   Quem chamou decide o que redesenhar.
   =================================================================== */

const Mesa = {

  /* molde: { nome, tipo, ca, pv, bonusIniciativa, nota, heroiId }
     Devolve o combatente criado, já com a iniciativa rolada. */
  somarAoCombate: function (molde) {
    const combatente = {
      id: 'c' + Date.now() + Math.floor(Math.random() * 1000),
      heroiId: molde.heroiId || null,
      nome: molde.nome,
      tipo: molde.tipo || 'inimigo',
      iniciativa: Math.floor(Math.random() * 20) + 1 + (molde.bonusIniciativa || 0),
      bonusIniciativa: molde.bonusIniciativa || 0,
      ca: molde.ca,
      pv: molde.pv,
      pvMax: molde.pvMax || molde.pv,
      agiu: false,
      condicoes: [],
      nota: molde.nota || ''
    };

    Estado.combate.combatentes.push(combatente);
    this.registrar(combatente.nome + ' entra no combate (iniciativa ' + combatente.iniciativa + ').', 'entrada');
    this.ordenarIniciativa();
    Memoria.salvar();

    return combatente;
  },


  /* Maior iniciativa primeiro; empate desempata pelo nome, para a
     ordem não ficar dançando a cada redesenho. */
  ordenarIniciativa: function () {
    Estado.combate.combatentes.sort(function (a, b) {
      if (b.iniciativa !== a.iniciativa) return b.iniciativa - a.iniciativa;
      return a.nome.localeCompare(b.nome);
    });
  },


  registrar: function (texto, tipo) {
    Estado.combate.registro.unshift({ texto: texto, tipo: tipo });
    Estado.combate.registro = Estado.combate.registro.slice(0, 40);
  },


  /* Dois "Esqueleto" no mesmo combate precisam de nomes distintos,
     senão o mestre não sabe qual está com 3 PV. */
  nomeLivre: function (nome) {
    const iguais = Estado.combate.combatentes.filter(function (c) {
      return c.nome === nome || c.nome.indexOf(nome + ' ') === 0;
    }).length;

    return iguais === 0 ? nome : nome + ' ' + (iguais + 1);
  }
};
