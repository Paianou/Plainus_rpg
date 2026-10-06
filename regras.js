/* ===================================================================
   regras.js — o catálogo do sistema (D&D 5e)

   Diferença para o dados.js, que é fácil de confundir:

     dados.js   o ESTADO da mesa. Muda durante o jogo: PV, iniciativa,
                quem está enfeitiçado, o que já saqueamos.
     regras.js  a REFERÊNCIA do sistema. Não muda nunca: o que Bola de
                Fogo faz, quanto pesa uma Cota de Malha.

   Por isso só o dados.js é salvo no sessionStorage. Guardar o catálogo
   junto seria copiar o livro de regras inteiro a cada clique.

   As armas e armaduras vieram de mesa-virtual/public/js/dados-jogo.js,
   para os dois projetos falarem a mesma língua. As magias são novas —
   a referência não tinha nenhuma.

   Campos de uma magia:
     nivel .......... 0 é truque
     concentracao ... exige concentração (uma por vez!)
     ritual ......... pode ser lançada como ritual, sem gastar espaço
     superior ....... o que muda ao usar um espaço de nível mais alto
   =================================================================== */

const ESCOLAS = ['Abjuração', 'Adivinhação', 'Conjuração', 'Encantamento', 'Evocação', 'Ilusão', 'Necromancia', 'Transmutação'];

const CLASSES_CONJURADORAS = ['Bardo', 'Bruxo', 'Clérigo', 'Druida', 'Feiticeiro', 'Mago', 'Paladino', 'Patrulheiro'];

const MAGIAS = [

  /* ---------- Truques ---------- */
  {
    nome: 'Raio de Fogo', nivel: 0, escola: 'Evocação',
    tempo: 'Ação', alcance: '36 metros', componentes: 'V, S', duracao: 'Instantânea',
    classes: ['Mago', 'Feiticeiro', 'Bruxo'],
    texto: 'Você arremessa uma chama contra uma criatura ou objeto. Faça um ataque à distância com magia. Se acertar, o alvo sofre 1d10 de dano ígneo. Objetos inflamáveis que ninguém esteja segurando pegam fogo.',
    superior: 'O dano aumenta em 1d10 nos níveis 5, 11 e 17.'
  },
  {
    nome: 'Toque Gélido', nivel: 0, escola: 'Necromancia',
    tempo: 'Ação', alcance: '36 metros', componentes: 'V, S', duracao: '1 rodada',
    classes: ['Mago', 'Feiticeiro', 'Bruxo'],
    texto: 'Uma mão esquelética atravessa o alvo. Faça um ataque à distância com magia; se acertar, causa 1d8 de dano necrótico e o alvo não pode recuperar pontos de vida até o começo do seu próximo turno. Se o alvo for morto-vivo, ele também tem desvantagem em ataques contra você.',
    superior: 'O dano aumenta em 1d8 nos níveis 5, 11 e 17.'
  },
  {
    nome: 'Orientação', nivel: 0, escola: 'Adivinhação',
    tempo: 'Ação', alcance: 'Toque', componentes: 'V, S', duracao: 'Concentração, até 1 minuto',
    classes: ['Clérigo', 'Druida'], concentracao: true,
    texto: 'Toque uma criatura voluntária. Uma vez antes da magia acabar, ela pode rolar 1d4 e somar ao resultado de um teste de habilidade à sua escolha. Pode rolar o dado antes ou depois do teste, mas antes de saber se passou.'
  },
  {
    nome: 'Luz', nivel: 0, escola: 'Evocação',
    tempo: 'Ação', alcance: 'Toque', componentes: 'V, M (um vaga-lume ou musgo fosforescente)', duracao: '1 hora',
    classes: ['Bardo', 'Clérigo', 'Feiticeiro', 'Mago'],
    texto: 'Um objeto que não exceda 3 metros em qualquer dimensão passa a emitir luz plena em um raio de 6 metros e penumbra por mais 6. A luz pode ter a cor que você quiser. Cobrir o objeto bloqueia a luz. A magia acaba se você conjurá-la de novo ou dispensá-la com uma ação.'
  },
  {
    nome: 'Prestidigitação', nivel: 0, escola: 'Transmutação',
    tempo: 'Ação', alcance: '3 metros', componentes: 'V, S', duracao: 'Até 1 hora',
    classes: ['Bardo', 'Feiticeiro', 'Mago', 'Bruxo'],
    texto: 'Um truque mágico menor: acender ou apagar uma chama pequena, limpar ou sujar um objeto, gelar ou aquecer até 0,5 kg de matéria, fazer aparecer uma marca ou símbolo por 1 hora, ou criar uma bugiganga que cabe na mão e dura 1 rodada. Você pode ter até três efeitos ativos ao mesmo tempo.'
  },

  /* ---------- 1º nível ---------- */
  {
    nome: 'Mísseis Mágicos', nivel: 1, escola: 'Evocação',
    tempo: 'Ação', alcance: '36 metros', componentes: 'V, S', duracao: 'Instantânea',
    classes: ['Feiticeiro', 'Mago'],
    texto: 'Três dardos de energia brilhante atingem alvos à sua escolha, que você possa ver. Cada dardo causa 1d4+1 de dano de força e acerta automaticamente — não existe rolagem de ataque nem salvaguarda. Você pode concentrar vários dardos num alvo só.',
    superior: 'Um dardo a mais para cada nível de espaço acima do 1º.'
  },
  {
    nome: 'Escudo Arcano', nivel: 1, escola: 'Abjuração',
    tempo: 'Reação, quando você é atingido por um ataque ou alvo de Mísseis Mágicos',
    alcance: 'Pessoal', componentes: 'V, S', duracao: '1 rodada',
    classes: ['Feiticeiro', 'Mago'],
    texto: 'Uma barreira invisível aparece e protege você. Até o começo do seu próximo turno, você recebe +5 de CA — inclusive contra o ataque que disparou a reação — e não sofre dano de Mísseis Mágicos.'
  },
  {
    nome: 'Curar Ferimentos', nivel: 1, escola: 'Evocação',
    tempo: 'Ação', alcance: 'Toque', componentes: 'V, S', duracao: 'Instantânea',
    classes: ['Bardo', 'Clérigo', 'Druida', 'Paladino', 'Patrulheiro'],
    texto: 'Uma criatura que você toque recupera pontos de vida iguais a 1d8 + seu modificador de habilidade de conjuração. Não funciona em mortos-vivos nem em constructos.',
    superior: 'A cura aumenta em 1d8 para cada nível de espaço acima do 1º.'
  },
  {
    nome: 'Palavra Curativa', nivel: 1, escola: 'Evocação',
    tempo: 'Ação bônus', alcance: '18 metros', componentes: 'V', duracao: 'Instantânea',
    classes: ['Bardo', 'Clérigo', 'Druida'],
    texto: 'Uma criatura que você possa ver recupera 1d4 + seu modificador de conjuração em pontos de vida. Por ser ação bônus e ter alcance, é a magia que tira alguém de 0 PV do outro lado da sala.',
    superior: 'A cura aumenta em 1d4 para cada nível de espaço acima do 1º.'
  },
  {
    nome: 'Bênção', nivel: 1, escola: 'Encantamento',
    tempo: 'Ação', alcance: '9 metros', componentes: 'V, S, M (um pouco de água benta)',
    duracao: 'Concentração, até 1 minuto',
    classes: ['Clérigo', 'Paladino'], concentracao: true,
    texto: 'Até três criaturas à sua escolha somam 1d4 a cada jogada de ataque e a cada salvaguarda que fizerem enquanto a magia durar.',
    superior: 'Uma criatura a mais para cada nível de espaço acima do 1º.'
  },
  {
    nome: 'Sono', nivel: 1, escola: 'Encantamento',
    tempo: 'Ação', alcance: '27 metros', componentes: 'V, S, M (uma pitada de areia fina)',
    duracao: '1 minuto',
    classes: ['Bardo', 'Feiticeiro', 'Mago'],
    texto: 'Role 5d8: esse é o total de pontos de vida que a magia afeta. Começando pela criatura com menos PV atuais na área, cada uma cai inconsciente até a magia acabar, sofrer dano ou alguém gastar uma ação para acordá-la. Subtraia os PV de cada criatura do total antes de passar para a próxima. Mortos-vivos e quem for imune a encantamento não são afetados.',
    superior: 'Role 2d8 a mais para cada nível de espaço acima do 1º.'
  },
  {
    nome: 'Enfeitiçar Pessoa', nivel: 1, escola: 'Encantamento',
    tempo: 'Ação', alcance: '9 metros', componentes: 'V, S', duracao: '1 hora',
    classes: ['Bardo', 'Bruxo', 'Druida', 'Feiticeiro', 'Mago'],
    texto: 'Um humanoide que você possa ver faz uma salvaguarda de Sabedoria — com vantagem se você ou seus aliados estiverem lutando contra ele. Se falhar, fica enfeitiçado por você e passa a tratá-lo como conhecido amistoso. Quando a magia acaba, ele sabe que foi enfeitiçado.',
    superior: 'Um alvo a mais para cada nível de espaço acima do 1º; eles precisam estar a até 9 metros um do outro.'
  },
  {
    nome: 'Detectar Magia', nivel: 1, escola: 'Adivinhação',
    tempo: 'Ação', alcance: 'Pessoal (raio de 9 metros)', componentes: 'V, S',
    duracao: 'Concentração, até 10 minutos',
    classes: ['Bardo', 'Clérigo', 'Druida', 'Feiticeiro', 'Mago', 'Paladino', 'Patrulheiro'],
    concentracao: true, ritual: true,
    texto: 'Você sente a presença de magia a até 9 metros. Gastando uma ação, pode ver uma aura fraca ao redor do que for mágico e descobrir a escola de magia, se houver. A magia atravessa a maioria das barreiras, mas é bloqueada por 30 cm de pedra, 2,5 cm de metal comum, uma lâmina fina de chumbo ou 90 cm de madeira ou terra.'
  },

  /* ---------- 2º nível ---------- */
  {
    nome: 'Invisibilidade', nivel: 2, escola: 'Ilusão',
    tempo: 'Ação', alcance: 'Toque', componentes: 'V, S, M (um cílio em goma arábica)',
    duracao: 'Concentração, até 1 hora',
    classes: ['Bardo', 'Bruxo', 'Feiticeiro', 'Mago'], concentracao: true,
    texto: 'A criatura tocada fica invisível, junto com o que estiver vestindo e carregando. A magia acaba no instante em que o alvo ataca ou conjura uma magia.',
    superior: 'Um alvo a mais para cada nível de espaço acima do 2º.'
  },
  {
    nome: 'Imobilizar Pessoa', nivel: 2, escola: 'Encantamento',
    tempo: 'Ação', alcance: '18 metros', componentes: 'V, S, M (um pedaço reto de ferro)',
    duracao: 'Concentração, até 1 minuto',
    classes: ['Bardo', 'Bruxo', 'Clérigo', 'Druida', 'Feiticeiro', 'Mago'], concentracao: true,
    texto: 'Um humanoide faz uma salvaguarda de Sabedoria ou fica paralisado. No fim de cada turno dele, pode tentar de novo. Lembre que quem está paralisado sofre crítico automático de qualquer ataque a até 1,5 metro — é uma das magias mais perigosas de 2º nível.',
    superior: 'Um alvo a mais para cada nível de espaço acima do 2º; eles precisam estar a até 9 metros um do outro.'
  },
  {
    nome: 'Raio Ardente', nivel: 2, escola: 'Evocação',
    tempo: 'Ação', alcance: '36 metros', componentes: 'V, S', duracao: 'Instantânea',
    classes: ['Feiticeiro', 'Mago'],
    texto: 'Três raios de fogo saem das suas mãos. Você pode mandá-los para o mesmo alvo ou para alvos diferentes. Faça uma rolagem de ataque à distância para cada raio; cada acerto causa 2d6 de dano ígneo.',
    superior: 'Um raio a mais para cada nível de espaço acima do 2º.'
  },
  {
    nome: 'Passo Nebuloso', nivel: 2, escola: 'Conjuração',
    tempo: 'Ação bônus', alcance: 'Pessoal', componentes: 'V', duracao: 'Instantânea',
    classes: ['Bruxo', 'Feiticeiro', 'Mago'],
    texto: 'Envolto por uma névoa prateada, você se teletransporta até 9 metros para um espaço desocupado que possa ver. Por ser ação bônus, cabe no mesmo turno de um ataque ou de outra magia.'
  },
  {
    nome: 'Restauração Menor', nivel: 2, escola: 'Abjuração',
    tempo: 'Ação', alcance: 'Toque', componentes: 'V, S', duracao: 'Instantânea',
    classes: ['Bardo', 'Clérigo', 'Druida', 'Paladino', 'Patrulheiro'],
    texto: 'Você toca uma criatura e acaba com uma doença ou uma condição que a esteja afligindo: cego, surdo, paralisado ou envenenado.'
  },

  /* ---------- 3º nível ---------- */
  {
    nome: 'Bola de Fogo', nivel: 3, escola: 'Evocação',
    tempo: 'Ação', alcance: '45 metros', componentes: 'V, S, M (uma bolinha de guano e enxofre)',
    duracao: 'Instantânea',
    classes: ['Feiticeiro', 'Mago'],
    texto: 'Um clarão parte do seu dedo e explode em uma esfera de 6 metros de raio no ponto escolhido. Cada criatura na área faz uma salvaguarda de Destreza: sofre 8d6 de dano ígneo, ou metade disso se passar. O fogo contorna esquinas e incendeia objetos inflamáveis que ninguém esteja segurando.',
    superior: 'O dano aumenta em 1d6 para cada nível de espaço acima do 3º.'
  },
  {
    nome: 'Contramágica', nivel: 3, escola: 'Abjuração',
    tempo: 'Reação, quando você vê uma criatura a até 18 metros conjurando uma magia',
    alcance: '18 metros', componentes: 'S', duracao: 'Instantânea',
    classes: ['Bruxo', 'Feiticeiro', 'Mago'],
    texto: 'Você interrompe a magia do alvo. Se ela for de 3º nível ou menor, falha automaticamente. Se for de 4º ou mais, faça um teste de habilidade de conjuração contra CD 10 + o nível da magia; se passar, ela falha.',
    superior: 'Usando um espaço de 4º ou mais, a magia é interrompida automaticamente se o nível dela for igual ou menor que o do espaço gasto.'
  },
  {
    nome: 'Relâmpago', nivel: 3, escola: 'Evocação',
    tempo: 'Ação', alcance: 'Pessoal (linha de 30 metros)',
    componentes: 'V, S, M (um punhado de pelo e um bastão de âmbar)', duracao: 'Instantânea',
    classes: ['Feiticeiro', 'Mago'],
    texto: 'Um raio em linha de 30 metros de comprimento por 1,5 de largura parte de você. Cada criatura na linha faz uma salvaguarda de Destreza: sofre 8d6 de dano elétrico, ou metade se passar.',
    superior: 'O dano aumenta em 1d6 para cada nível de espaço acima do 3º.'
  },
  {
    nome: 'Voo', nivel: 3, escola: 'Transmutação',
    tempo: 'Ação', alcance: 'Toque', componentes: 'V, S, M (uma pena de ave)',
    duracao: 'Concentração, até 10 minutos',
    classes: ['Bruxo', 'Feiticeiro', 'Mago'], concentracao: true,
    texto: 'A criatura tocada ganha deslocamento de voo de 18 metros. Quando a magia acaba, o alvo cai se ainda estiver no ar — a menos que consiga evitar a queda de outro jeito.',
    superior: 'Um alvo a mais para cada nível de espaço acima do 3º.'
  },
  {
    nome: 'Reviver', nivel: 3, escola: 'Necromancia',
    tempo: 'Ação', alcance: 'Toque',
    componentes: 'V, S, M (diamantes no valor de 300 po, consumidos)', duracao: 'Instantânea',
    classes: ['Clérigo', 'Paladino'],
    texto: 'Você toca uma criatura que morreu no último minuto e ela volta à vida com 1 ponto de vida. A magia não devolve membros perdidos nem funciona em quem morreu de velhice.'
  },

  /* ---------- 4º nível ---------- */
  {
    nome: 'Parede de Fogo', nivel: 4, escola: 'Evocação',
    tempo: 'Ação', alcance: '36 metros', componentes: 'V, S, M (um pedaço de fósforo)',
    duracao: 'Concentração, até 1 minuto',
    classes: ['Druida', 'Feiticeiro', 'Mago'], concentracao: true,
    texto: 'Você ergue uma parede de chamas de até 18 metros de comprimento, 6 de altura e 30 cm de espessura — ou um anel de 6 metros de diâmetro. Quem estiver na área quando ela aparece faz salvaguarda de Destreza e sofre 5d8 de dano ígneo, metade se passar. Um dos lados da parede, à sua escolha, causa 5d8 a quem terminar o turno a até 3 metros dele.',
    superior: 'O dano aumenta em 1d8 para cada nível de espaço acima do 4º.'
  },
  {
    nome: 'Polimorfia', nivel: 4, escola: 'Transmutação',
    tempo: 'Ação', alcance: '18 metros', componentes: 'V, S, M (um casulo de lagarta)',
    duracao: 'Concentração, até 1 hora',
    classes: ['Bardo', 'Druida', 'Feiticeiro', 'Mago'], concentracao: true,
    texto: 'Uma criatura que você possa ver vira uma fera cujo nível de desafio não passe do nível dela. Salvaguarda de Sabedoria para resistir. A ficha é substituída pela da fera, mantendo alinhamento e personalidade. Quando os PV da nova forma chegam a zero, ela volta ao normal com os PV que tinha antes.'
  },

  /* ---------- 5º nível ---------- */
  {
    nome: 'Nuvem Mortal', nivel: 5, escola: 'Conjuração',
    tempo: 'Ação', alcance: '36 metros', componentes: 'V, S',
    duracao: 'Concentração, até 10 minutos',
    classes: ['Bruxo', 'Feiticeiro', 'Mago'], concentracao: true,
    texto: 'Uma esfera de névoa venenosa com 6 metros de raio se espalha pelo ponto escolhido. A área fica totalmente encoberta. Quem começa o turno ali faz salvaguarda de Constituição e sofre 5d8 de dano de veneno, metade se passar — mesmo prendendo a respiração. A nuvem desce 3 metros por rodada e o vento forte a dispersa.',
    superior: 'O dano aumenta em 1d8 para cada nível de espaço acima do 5º.'
  },
  {
    nome: 'Erguer Mortos', nivel: 5, escola: 'Necromancia',
    tempo: '1 hora', alcance: 'Toque',
    componentes: 'V, S, M (um diamante de 500 po, consumido)', duracao: 'Instantânea',
    classes: ['Bardo', 'Clérigo', 'Paladino'],
    texto: 'Você traz de volta uma criatura morta há até 10 dias, com 1 ponto de vida. A magia não devolve membros perdidos e a alma precisa estar livre e disposta. Quem volta sofre −4 em todas as jogadas de ataque, testes e salvaguardas; a penalidade diminui em 1 a cada descanso longo, até sumir.'
  }
];


/* ===================================================================
   BESTIÁRIO

   As fichas de monstro. Campos seguem a ordem do livro, porque é a
   ordem em que o mestre lê durante a luta: defesas primeiro (CA, PV),
   depois como ele se move, depois o que ele aguenta, e só então o que
   ele faz.

   'nd' é o nível de desafio; 'xp' anda junto porque é o que se usa
   para montar encontro. Os modificadores de atributo NÃO estão
   escritos — são calculados por modificador(), logo abaixo, que é a
   fórmula do sistema: (valor - 10) / 2, arredondado para baixo.
   =================================================================== */

const BESTIARIO = [
  {
    nome: 'Rato Gigante', tamanho: 'Pequeno', tipo: 'Fera', alinhamento: 'não alinhado',
    ca: 12, fonteCa: '', pv: 7, dadosVida: '2d6', deslocamento: '9 m',
    atributos: { for: 7, des: 15, con: 11, int: 2, sab: 10, car: 4 },
    sentidos: 'Visão no escuro 18 m, Percepção passiva 10',
    idiomas: '—', nd: '1/8', xp: 25,
    tracos: [
      { nome: 'Faro Apurado', texto: 'Vantagem em testes de Percepção que dependam de olfato.' },
      { nome: 'Táticas de Matilha', texto: 'Vantagem no ataque se um aliado estiver a até 1,5 m do alvo e não estiver incapacitado.' }
    ],
    acoes: [
      { nome: 'Mordida', texto: '+4 para acertar, alcance 1,5 m. Dano: 1d4+2 perfurante.' }
    ]
  },
  {
    nome: 'Bandido', tamanho: 'Médio', tipo: 'Humanoide', alinhamento: 'qualquer não-leal',
    ca: 12, fonteCa: 'armadura de couro', pv: 11, dadosVida: '2d8+2', deslocamento: '9 m',
    atributos: { for: 11, des: 12, con: 12, int: 10, sab: 10, car: 10 },
    sentidos: 'Percepção passiva 10', idiomas: 'Comum', nd: '1/8', xp: 25,
    acoes: [
      { nome: 'Cimitarra', texto: '+3 para acertar, alcance 1,5 m. Dano: 1d6+1 cortante.' },
      { nome: 'Besta Leve', texto: '+3 para acertar, alcance 24/96 m. Dano: 1d8+1 perfurante.' }
    ]
  },
  {
    nome: 'Cultista', tamanho: 'Médio', tipo: 'Humanoide', alinhamento: 'qualquer mau',
    ca: 12, fonteCa: 'armadura de couro', pv: 9, dadosVida: '2d8', deslocamento: '9 m',
    atributos: { for: 11, des: 12, con: 10, int: 10, sab: 11, car: 10 },
    pericias: 'Enganação +2, Religião +2',
    sentidos: 'Percepção passiva 10', idiomas: 'Comum', nd: '1/8', xp: 25,
    tracos: [
      { nome: 'Devoção Fanática', texto: 'Vantagem em salvaguardas contra ficar enfeitiçado ou amedrontado.' }
    ],
    acoes: [
      { nome: 'Cimitarra', texto: '+3 para acertar, alcance 1,5 m. Dano: 1d6+1 cortante.' }
    ]
  },
  {
    nome: 'Esqueleto', tamanho: 'Médio', tipo: 'Morto-vivo', alinhamento: 'leal e mau',
    ca: 13, fonteCa: 'armadura de retalhos', pv: 13, dadosVida: '2d8+4', deslocamento: '9 m',
    atributos: { for: 10, des: 14, con: 15, int: 6, sab: 8, car: 5 },
    vulnerabilidades: 'Concussão',
    imunidades: 'Veneno',
    imunidadesCondicao: 'Envenenado, exaustão',
    sentidos: 'Visão no escuro 18 m, Percepção passiva 9',
    idiomas: 'Entende os idiomas que conhecia em vida, mas não fala',
    nd: '1/4', xp: 50,
    acoes: [
      { nome: 'Espada Curta', texto: '+4 para acertar, alcance 1,5 m. Dano: 1d6+2 perfurante.' },
      { nome: 'Arco Curto', texto: '+4 para acertar, alcance 24/96 m. Dano: 1d6+2 perfurante.' }
    ]
  },
  {
    nome: 'Zumbi', tamanho: 'Médio', tipo: 'Morto-vivo', alinhamento: 'neutro e mau',
    ca: 8, fonteCa: '', pv: 22, dadosVida: '3d8+9', deslocamento: '6 m',
    atributos: { for: 13, des: 6, con: 16, int: 3, sab: 6, car: 5 },
    salvaguardas: 'SAB +0',
    imunidades: 'Veneno', imunidadesCondicao: 'Envenenado',
    sentidos: 'Visão no escuro 18 m, Percepção passiva 8',
    idiomas: 'Entende o que conhecia em vida, mas não fala', nd: '1/4', xp: 50,
    tracos: [
      { nome: 'Fortitude Morta-Viva', texto: 'Se o dano reduzir o zumbi a 0 PV, ele faz uma salvaguarda de Constituição com CD 5 + o dano sofrido. Se passar, fica com 1 PV. Não funciona contra dano radiante nem crítico.' }
    ],
    acoes: [
      { nome: 'Pancada', texto: '+3 para acertar, alcance 1,5 m. Dano: 1d6+1 concussão.' }
    ]
  },
  {
    nome: 'Lobo', tamanho: 'Médio', tipo: 'Fera', alinhamento: 'não alinhado',
    ca: 13, fonteCa: 'armadura natural', pv: 11, dadosVida: '2d8+2', deslocamento: '12 m',
    atributos: { for: 12, des: 15, con: 12, int: 3, sab: 12, car: 6 },
    pericias: 'Percepção +3, Furtividade +4',
    sentidos: 'Percepção passiva 13', idiomas: '—', nd: '1/4', xp: 50,
    tracos: [
      { nome: 'Audição e Olfato Apurados', texto: 'Vantagem em testes de Percepção que dependam de audição ou olfato.' },
      { nome: 'Táticas de Matilha', texto: 'Vantagem no ataque se um aliado estiver a até 1,5 m do alvo e não estiver incapacitado.' }
    ],
    acoes: [
      { nome: 'Mordida', texto: '+4 para acertar, alcance 1,5 m. Dano: 2d4+2 perfurante. O alvo faz salvaguarda de Força CD 11 ou cai no chão.' }
    ]
  },
  {
    nome: 'Orc', tamanho: 'Médio', tipo: 'Humanoide', alinhamento: 'caótico e mau',
    ca: 13, fonteCa: 'armadura de peles', pv: 15, dadosVida: '2d8+6', deslocamento: '9 m',
    atributos: { for: 16, des: 12, con: 16, int: 7, sab: 11, car: 10 },
    pericias: 'Intimidação +2',
    sentidos: 'Visão no escuro 18 m, Percepção passiva 10',
    idiomas: 'Comum, Orc', nd: '1/2', xp: 100,
    tracos: [
      { nome: 'Agressivo', texto: 'Como ação bônus, move-se até seu deslocamento em direção a um inimigo hostil que possa ver.' }
    ],
    acoes: [
      { nome: 'Machado Grande', texto: '+5 para acertar, alcance 1,5 m. Dano: 1d12+3 cortante.' },
      { nome: 'Azagaia', texto: '+5 para acertar, alcance 1,5 m ou 9/36 m. Dano: 1d6+3 perfurante.' }
    ]
  },
  {
    nome: 'Carniçal', tamanho: 'Médio', tipo: 'Morto-vivo', alinhamento: 'caótico e mau',
    ca: 12, fonteCa: '', pv: 22, dadosVida: '5d8', deslocamento: '9 m',
    atributos: { for: 13, des: 15, con: 10, int: 7, sab: 10, car: 6 },
    imunidades: 'Veneno',
    imunidadesCondicao: 'Enfeitiçado, exaustão, envenenado',
    sentidos: 'Visão no escuro 18 m, Percepção passiva 10',
    idiomas: 'Comum', nd: 1, xp: 200,
    acoes: [
      { nome: 'Mordida', texto: '+2 para acertar, alcance 1,5 m. Dano: 2d6+2 perfurante.' },
      { nome: 'Garras', texto: '+4 para acertar, alcance 1,5 m. Dano: 2d4+2 cortante. Se o alvo não for elfo nem morto-vivo, faz salvaguarda de Constituição CD 10 ou fica paralisado por 1 minuto, repetindo no fim de cada turno dele.' }
    ]
  },
  {
    nome: 'Aranha Gigante', tamanho: 'Grande', tipo: 'Fera', alinhamento: 'não alinhado',
    ca: 14, fonteCa: 'armadura natural', pv: 26, dadosVida: '4d10+4',
    deslocamento: '9 m, escalada 9 m',
    atributos: { for: 14, des: 16, con: 12, int: 2, sab: 11, car: 4 },
    pericias: 'Furtividade +7',
    sentidos: 'Visão no escuro 18 m, percepção às cegas 3 m, Percepção passiva 10',
    idiomas: '—', nd: 1, xp: 200,
    tracos: [
      { nome: 'Escalar em Teias', texto: 'Ignora restrições de movimento causadas por teias.' },
      { nome: 'Sentido de Teia', texto: 'Enquanto em contato com uma teia, sabe a localização exata de qualquer criatura em contato com a mesma teia.' }
    ],
    acoes: [
      { nome: 'Mordida', texto: '+5 para acertar, alcance 1,5 m. Dano: 1d8+3 perfurante, e salvaguarda de Constituição CD 11 ou mais 2d8 de veneno (metade se passar). Se o veneno reduzir o alvo a 0 PV, ele fica estável mas envenenado e paralisado por 1 hora.' },
      { nome: 'Teia (recarga 5-6)', texto: 'Ataque à distância +5, alcance 9/18 m. O alvo fica agarrado pela teia (escapar: CD 12). A teia tem CA 10, 5 PV, e é imune a concussão, veneno e psíquico.' }
    ]
  },
  {
    nome: 'Armadura Animada', tamanho: 'Médio', tipo: 'Constructo', alinhamento: 'não alinhado',
    ca: 18, fonteCa: 'armadura natural', pv: 33, dadosVida: '6d8+6', deslocamento: '7,5 m',
    atributos: { for: 14, des: 11, con: 13, int: 1, sab: 3, car: 1 },
    imunidades: 'Veneno, psíquico',
    imunidadesCondicao: 'Cego, enfeitiçado, surdo, amedrontado, paralisado, petrificado, envenenado',
    sentidos: 'Percepção às cegas 18 m (cega além disso), Percepção passiva 6',
    idiomas: '—', nd: 1, xp: 200,
    tracos: [
      { nome: 'Antimagia Suscetível', texto: 'Fica incapacitada dentro de um campo antimagia. Se for alvo de Toque Dissipador, faz salvaguarda de Constituição CD 15 ou cai inconsciente por 1 minuto.' },
      { nome: 'Falsa Aparência', texto: 'Parada, é indistinguível de uma armadura comum.' }
    ],
    acoes: [
      { nome: 'Multiataque', texto: 'Faz dois ataques de golpe.' },
      { nome: 'Golpe', texto: '+4 para acertar, alcance 1,5 m. Dano: 1d6+2 concussão.' }
    ]
  },
  {
    nome: 'Espectro', tamanho: 'Médio', tipo: 'Morto-vivo', alinhamento: 'caótico e mau',
    ca: 12, fonteCa: '', pv: 22, dadosVida: '5d8', deslocamento: '0 m, voo 15 m (pairar)',
    atributos: { for: 1, des: 14, con: 11, int: 10, sab: 10, car: 11 },
    resistencias: 'Ácido, frio, ígneo, elétrico, trovejante; concussão, perfurante e cortante de armas não mágicas',
    imunidades: 'Necrótico, veneno',
    imunidadesCondicao: 'Enfeitiçado, exaustão, agarrado, paralisado, petrificado, envenenado, caído, contido, inconsciente',
    sentidos: 'Visão no escuro 18 m, Percepção passiva 10',
    idiomas: 'Entende o que conhecia em vida, mas não fala', nd: 1, xp: 200,
    tracos: [
      { nome: 'Movimentação Incorpórea', texto: 'Atravessa criaturas e objetos como se fossem terreno difícil. Sofre 1d10 de dano de força se terminar o turno dentro de um objeto.' },
      { nome: 'Sensibilidade à Luz do Sol', texto: 'Sob luz solar direta, tem desvantagem em ataques e em testes de Percepção que dependam de visão.' }
    ],
    acoes: [
      { nome: 'Toque Vital', texto: '+4 para acertar, alcance 1,5 m. Dano: 3d6 necrótico. O máximo de pontos de vida do alvo diminui no mesmo valor até ele terminar um descanso longo. O alvo morre se isso reduzir seu máximo a 0.' }
    ]
  },
  {
    nome: 'Ogro', tamanho: 'Grande', tipo: 'Gigante', alinhamento: 'caótico e mau',
    ca: 11, fonteCa: 'armadura de peles', pv: 59, dadosVida: '7d10+21', deslocamento: '12 m',
    atributos: { for: 19, des: 8, con: 16, int: 5, sab: 7, car: 7 },
    sentidos: 'Visão no escuro 18 m, Percepção passiva 8',
    idiomas: 'Comum, Gigante', nd: 2, xp: 450,
    acoes: [
      { nome: 'Clava Grande', texto: '+6 para acertar, alcance 1,5 m. Dano: 2d8+4 concussão.' },
      { nome: 'Azagaia', texto: '+6 para acertar, alcance 1,5 m ou 9/36 m. Dano: 2d6+4 perfurante.' }
    ]
  },
  {
    nome: 'Aparição', tamanho: 'Médio', tipo: 'Morto-vivo', alinhamento: 'neutro e mau',
    ca: 13, fonteCa: '', pv: 67, dadosVida: '9d8+27', deslocamento: '0 m, voo 18 m (pairar)',
    atributos: { for: 6, des: 16, con: 16, int: 12, sab: 14, car: 15 },
    resistencias: 'Ácido, frio, ígneo, elétrico, trovejante; concussão, perfurante e cortante de armas não mágicas',
    imunidades: 'Necrótico, veneno',
    imunidadesCondicao: 'Enfeitiçado, exaustão, agarrado, paralisado, petrificado, envenenado, caído, contido',
    sentidos: 'Visão no escuro 18 m, Percepção passiva 12',
    idiomas: 'Os idiomas que conhecia em vida', nd: 5, xp: 1800,
    tracos: [
      { nome: 'Movimentação Incorpórea', texto: 'Atravessa criaturas e objetos como se fossem terreno difícil. Sofre 1d10 de dano de força se terminar o turno dentro de um objeto.' },
      { nome: 'Sensibilidade à Luz do Sol', texto: 'Sob luz solar direta, tem desvantagem em ataques e em testes de Percepção que dependam de visão.' }
    ],
    acoes: [
      { nome: 'Dreno de Vida', texto: '+6 para acertar, alcance 1,5 m. Dano: 4d8+3 necrótico. O alvo faz salvaguarda de Constituição CD 14 ou seu máximo de pontos de vida diminui no valor do dano até um descanso longo.' },
      { nome: 'Criar Espectro', texto: 'Escolhe um humanoide morto há menos de 1 minuto a até 3 m. O morto se ergue como espectro sob o controle da aparição. Ela pode ter até sete espectros ao mesmo tempo.' }
    ]
  },
  {
    nome: 'Troll', tamanho: 'Grande', tipo: 'Gigante', alinhamento: 'caótico e mau',
    ca: 15, fonteCa: 'armadura natural', pv: 84, dadosVida: '8d10+40', deslocamento: '9 m',
    atributos: { for: 18, des: 13, con: 20, int: 7, sab: 9, car: 7 },
    pericias: 'Percepção +2',
    sentidos: 'Visão no escuro 18 m, Percepção passiva 12',
    idiomas: 'Gigante', nd: 5, xp: 1800,
    tracos: [
      { nome: 'Olfato Apurado', texto: 'Vantagem em testes de Percepção que dependam de olfato.' },
      { nome: 'Regeneração', texto: 'Recupera 10 pontos de vida no início do turno dele. Se sofrer dano ácido ou ígneo, isso não acontece no início do próximo turno. Só morre se começar o turno com 0 PV e não regenerar.' }
    ],
    acoes: [
      { nome: 'Multiataque', texto: 'Faz três ataques: uma mordida e duas garras.' },
      { nome: 'Mordida', texto: '+7 para acertar, alcance 1,5 m. Dano: 1d6+4 perfurante.' },
      { nome: 'Garra', texto: '+7 para acertar, alcance 1,5 m. Dano: 2d6+4 cortante.' }
    ]
  },
  {
    nome: 'Elemental da Terra', tamanho: 'Grande', tipo: 'Elemental', alinhamento: 'neutro',
    ca: 17, fonteCa: 'armadura natural', pv: 126, dadosVida: '12d10+60',
    deslocamento: '9 m, escavação 9 m',
    atributos: { for: 20, des: 8, con: 20, int: 5, sab: 10, car: 5 },
    vulnerabilidades: 'Trovejante',
    resistencias: 'Concussão, perfurante e cortante de armas não mágicas',
    imunidades: 'Veneno',
    imunidadesCondicao: 'Exaustão, paralisado, petrificado, envenenado, caído, inconsciente',
    sentidos: 'Visão no escuro 18 m, sentido sísmico 18 m, Percepção passiva 10',
    idiomas: 'Terrano', nd: 5, xp: 1800,
    tracos: [
      { nome: 'Deslizar pela Terra', texto: 'Pode escavar rocha sólida na metade do deslocamento, sem deixar buraco.' },
      { nome: 'Emboscador de Pedra', texto: 'Pode se esconder em terreno rochoso sem sofrer desvantagem.' }
    ],
    acoes: [
      { nome: 'Multiataque', texto: 'Faz dois ataques de golpe.' },
      { nome: 'Golpe', texto: '+8 para acertar, alcance 3 m. Dano: 2d8+5 concussão.' }
    ]
  },
  {
    nome: 'Dragão Branco Jovem', tamanho: 'Grande', tipo: 'Dragão', alinhamento: 'caótico e mau',
    ca: 17, fonteCa: 'armadura natural', pv: 133, dadosVida: '14d10+56',
    deslocamento: '12 m, escavação 6 m, voo 24 m, natação 12 m',
    atributos: { for: 18, des: 10, con: 18, int: 6, sab: 11, car: 12 },
    salvaguardas: 'DES +3, CON +7, SAB +3, CAR +4',
    pericias: 'Percepção +6, Furtividade +3',
    imunidades: 'Frio',
    sentidos: 'Visão às cegas 9 m, visão no escuro 36 m, Percepção passiva 16',
    idiomas: 'Comum, Dracônico', nd: 6, xp: 2300,
    acoes: [
      { nome: 'Multiataque', texto: 'Faz três ataques: uma mordida e duas garras.' },
      { nome: 'Mordida', texto: '+7 para acertar, alcance 3 m. Dano: 2d10+4 perfurante mais 1d8 de frio.' },
      { nome: 'Garra', texto: '+7 para acertar, alcance 1,5 m. Dano: 2d6+4 cortante.' },
      { nome: 'Sopro Congelante (recarga 5-6)', texto: 'Cone de 9 m de ar glacial. Cada criatura na área faz salvaguarda de Constituição CD 15 e sofre 10d8 de dano de frio, metade se passar.' }
    ]
  },
  {
    nome: 'Golem de Pedra', tamanho: 'Grande', tipo: 'Constructo', alinhamento: 'não alinhado',
    ca: 17, fonteCa: 'armadura natural', pv: 178, dadosVida: '17d10+85', deslocamento: '9 m',
    atributos: { for: 22, des: 9, con: 20, int: 3, sab: 11, car: 1 },
    imunidades: 'Veneno, psíquico; concussão, perfurante e cortante de armas não mágicas que não sejam adamantinas',
    imunidadesCondicao: 'Enfeitiçado, exaustão, amedrontado, paralisado, petrificado, envenenado',
    sentidos: 'Visão no escuro 36 m, Percepção passiva 10',
    idiomas: 'Entende o criador, mas não fala', nd: 10, xp: 5900,
    tracos: [
      { nome: 'Imutável', texto: 'Imune a qualquer magia que mude sua forma.' },
      { nome: 'Resistência Mágica', texto: 'Vantagem em salvaguardas contra magias e outros efeitos mágicos.' },
      { nome: 'Ataques Mágicos', texto: 'Os ataques dele contam como mágicos.' }
    ],
    acoes: [
      { nome: 'Multiataque', texto: 'Faz dois ataques de golpe.' },
      { nome: 'Golpe', texto: '+10 para acertar, alcance 1,5 m. Dano: 3d8+6 concussão.' },
      { nome: 'Lentidão (recarga 5-6)', texto: 'Escolhe uma ou mais criaturas a até 3 m. Cada uma faz salvaguarda de Sabedoria CD 17 ou fica sob efeito de Lentidão por 1 minuto, repetindo no fim de cada turno.' }
    ]
  }
];


/* O modificador de um atributo: (valor − 10) ÷ 2, arredondado para
   baixo. Guardar o modificador junto do valor seria guardar a mesma
   informação duas vezes — e um dia elas discordariam. */
function modificador(valor) {
  return Math.floor((valor - 10) / 2);
}

/* "+3" / "−1" / "+0" — com o sinal sempre visível, como no livro. */
function comSinal(numero) {
  return (numero >= 0 ? '+' : '−') + Math.abs(numero);
}


/* ---------- Nível de desafio e XP ----------
   A tabela do Livro dos Monstros. O XP de uma criatura é CONSEQUÊNCIA
   do ND, nunca escolha à parte — por isso o formulário de monstro novo
   pede só o ND e lê o XP daqui. Pedir os dois deixaria um "ND 5 que
   vale 25 XP" possível. */
const XP_POR_ND = {
  '0': 10, '1/8': 25, '1/4': 50, '1/2': 100,
  '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800,
  '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900,
  '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000,
  '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000,
  '21': 33000, '22': 41000, '23': 50000, '24': 62000, '25': 75000,
  '26': 90000, '27': 105000, '28': 120000, '29': 135000, '30': 155000
};

/* Os NDs na ordem, para a lista de escolha. Object.keys não serve:
   ele poria '1/8' depois de '1', e '10' antes de '2'. */
const NDS = ['0', '1/8', '1/4', '1/2'].concat(
  Array.from({ length: 30 }, function (_, i) { return String(i + 1); })
);

const TAMANHOS = ['Miúdo', 'Pequeno', 'Médio', 'Grande', 'Enorme', 'Imenso'];


/* ---------- Equipamento ----------
   Copiado de mesa-virtual/public/js/dados-jogo.js. */

const ARMAS = [
  { nome: 'Adaga', categoria: 'Arma', dano: '1d4', tipoDano: 'perfurante', peso: 0.5, valor: '2 po', propriedades: 'Acuidade, leve, arremesso' },
  { nome: 'Espada Curta', categoria: 'Arma', dano: '1d6', tipoDano: 'perfurante', peso: 1, valor: '10 po', propriedades: 'Acuidade, leve' },
  { nome: 'Espada Longa', categoria: 'Arma', dano: '1d8', tipoDano: 'cortante', peso: 1.5, valor: '15 po', propriedades: 'Versátil (1d10)' },
  { nome: 'Machado de Batalha', categoria: 'Arma', dano: '1d8', tipoDano: 'cortante', peso: 2, valor: '10 po', propriedades: 'Versátil (1d10)' },
  { nome: 'Maça', categoria: 'Arma', dano: '1d6', tipoDano: 'concussão', peso: 2, valor: '5 po', propriedades: '—' },
  { nome: 'Arco Curto', categoria: 'Arma', dano: '1d6', tipoDano: 'perfurante', peso: 1, valor: '25 po', propriedades: 'Munição (24/96), duas mãos' },
  { nome: 'Arco Longo', categoria: 'Arma', dano: '1d8', tipoDano: 'perfurante', peso: 1, valor: '50 po', propriedades: 'Munição (45/180), pesada, duas mãos' },
  { nome: 'Besta Leve', categoria: 'Arma', dano: '1d8', tipoDano: 'perfurante', peso: 2.5, valor: '25 po', propriedades: 'Munição (24/96), recarga' },
  { nome: 'Rapieira', categoria: 'Arma', dano: '1d8', tipoDano: 'perfurante', peso: 1, valor: '25 po', propriedades: 'Acuidade' },
  { nome: 'Cajado', categoria: 'Arma', dano: '1d6', tipoDano: 'concussão', peso: 2, valor: '2 pp', propriedades: 'Versátil (1d8)' }
];

const ARMADURAS = [
  { nome: 'Acolchoada', categoria: 'Armadura', ca: '11 + Des', peso: 4, valor: '5 po', propriedades: 'Leve, desvantagem em Furtividade' },
  { nome: 'Couro', categoria: 'Armadura', ca: '11 + Des', peso: 5, valor: '10 po', propriedades: 'Leve' },
  { nome: 'Couro Batido', categoria: 'Armadura', ca: '12 + Des', peso: 6.5, valor: '45 po', propriedades: 'Leve' },
  { nome: 'Camisão de Malha', categoria: 'Armadura', ca: '13 + Des (máx 2)', peso: 10, valor: '50 po', propriedades: 'Média' },
  { nome: 'Peitoral', categoria: 'Armadura', ca: '14 + Des (máx 2)', peso: 10, valor: '400 po', propriedades: 'Média' },
  { nome: 'Meia Armadura', categoria: 'Armadura', ca: '15 + Des (máx 2)', peso: 20, valor: '750 po', propriedades: 'Média, desvantagem em Furtividade' },
  { nome: 'Cota de Malha', categoria: 'Armadura', ca: '16', peso: 27.5, valor: '75 po', propriedades: 'Pesada, Força 13' },
  { nome: 'Placas', categoria: 'Armadura', ca: '18', peso: 32.5, valor: '1500 po', propriedades: 'Pesada, Força 15, desvantagem em Furtividade' },
  { nome: 'Escudo', categoria: 'Escudo', ca: '+2', peso: 3, valor: '10 po', propriedades: 'Uma mão' }
];

const EQUIPAMENTO = ARMAS.concat(ARMADURAS);


/* ---------- Ajudante de texto ----------
   Tira acento e caixa para a busca achar "ilusao" quando a pessoa
   digita sem acento, e "FOGO" quando digita em maiúsculas. */
function semAcento(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}


/* ===================================================================
   TABELAS DE ROLAGEM

   O material que o mestre rola quando a mesa faz uma pergunta que ele
   não previu: "o que tem no bolso dele?", "quem está na taverna?",
   "o que dá errado agora?".

   Cada tabela declara o dado que usa, e a quantidade de itens tem que
   BATER com as faces desse dado — uma tabela d12 com 11 itens deixaria
   um resultado sem resposta. A tela confere isso ao abrir e avisa,
   em vez de quebrar na hora de rolar.

   Estas ficam aqui, em regras.js, porque são material de referência.
   As que o mestre escrever ficam em Estado (dados.js), porque são
   dele — mesma divisão de sempre.
   =================================================================== */

const TABELAS = [
  {
    id: 'cripta', nome: 'Encontros na cripta', dado: 12, categoria: 'Encontros',
    itens: [
      'Ratazanas fartas demais, e nenhuma foge de você.',
      'Um esqueleto ainda de sentinela, cumprindo ordem de trinta anos atrás.',
      'Pegadas frescas de bota — tamanho grande, alguém vivo passou hoje.',
      'Uma porta selada com cera, e o símbolo do Culto ainda está quente.',
      'Choro de criança vindo de três corredores diferentes ao mesmo tempo.',
      'Dois carniçais disputando um corpo que ainda veste as cores da Guarda.',
      'Uma lasca de coroa cravada na parede, apontando para o fundo.',
      'Névoa fria que apaga tochas e volta a subir quando você recua.',
      'Um cultista perdido do grupo dele, disposto a trocar informação por vida.',
      'O chão cede: 3 m de queda, 1d6 de dano e barulho demais.',
      'Um espectro que repete o próprio nome e espera resposta.',
      'Nada. Silêncio absoluto — e é isso que deveria assustar.'
    ]
  },
  {
    id: 'estrada', nome: 'Encontros na estrada', dado: 12, categoria: 'Encontros',
    itens: [
      'Carroça tombada, cavalo morto, nenhum sinal do condutor.',
      'Três lobos acompanhando o grupo a distância, sem atacar.',
      'Peregrinos da Ordem da Aurora pedindo escolta até o próximo vilarejo.',
      'Cobrador de pedágio com uma autorização obviamente falsificada.',
      'Chuva forte: visibilidade cai pela metade por 1d4 horas.',
      'Um mercador com boa mercadoria e preços bons demais.',
      'Bandidos contando moedas, ainda sem perceber a party.',
      'Corpo de um mensageiro: bolsa intacta, carta sumida.',
      'Ponte quebrada — desvio de meio dia ou um teste de Atletismo.',
      'Patrulha da Guarda fazendo perguntas sobre a cripta.',
      'Fogueira apagada há pouco, comida ainda quente.',
      'Um andarilho que sabe o nome de um dos heróis e não explica como.'
    ]
  },
  {
    id: 'rumores', nome: 'Rumores de taverna', dado: 10, categoria: 'Cidade',
    itens: [
      'A Guarda não patrulha mais a rua das Bigornas às quintas.',
      'O ferreiro caolho chorou na missa de domingo. Ninguém sabe por quê.',
      'Dizem que o rei morto não morreu de verdade, só ficou com sono.',
      'Sumiram três pessoas este mês. Todas deviam à guilda.',
      'Tem gente comprando aço em quantidade, e pagando em prata velha.',
      'O templo mandou buscar relíquias na capital. Chegam semana que vem.',
      'A dona da taverna fala com alguém no porão toda madrugada.',
      'Um garoto entrou na cripta por aposta e saiu sem conseguir falar.',
      'A coroa partida dá sorte a quem tem metade, e azar a quem tem as duas.',
      'O capitão da Guarda vai se aposentar rico, e ninguém sabe de onde vem o dinheiro.'
    ]
  },
  {
    id: 'complicacoes', nome: 'Complicação no meio da cena', dado: 10, categoria: 'Narrativa',
    itens: [
      'A tocha apaga, e ninguém tem como reacender rápido.',
      'Chega gente: 1d4 reforços do lado errado.',
      'Uma parte do chão cede e separa o grupo em dois.',
      'O barulho atrai algo maior, que ainda está a dois cômodos.',
      'Um NPC aliado faz exatamente a coisa errada, com a melhor intenção.',
      'O item que resolveria isso quebra na mão de quem o usa.',
      'Alguém do grupo reconhece um inimigo — e é reconhecido de volta.',
      'A saída por onde vieram já não está onde deveria.',
      'O tempo começa a contar: algo acontece em 3 rodadas, dê no que der.',
      'Uma testemunha inesperada vê tudo e corre para contar.'
    ]
  },
  {
    id: 'bolso', nome: 'O que há no bolso dele', dado: 12, categoria: 'Detalhes',
    itens: [
      '1d10 moedas de cobre e um botão de osso.',
      'Uma carta de amor sem assinatura, lida muitas vezes.',
      'Chave pequena, sem indicação de qual porta.',
      'Um dente de monstro, furado para virar colar.',
      'Bilhete com uma data e a palavra "quinta" sublinhada.',
      'Frasco pela metade, cheiro adocicado, sem rótulo.',
      'Dado de osso viciado, cai em 6 com frequência suspeita.',
      'Medalhão do templo, com o rosto raspado.',
      'Mapa rabiscado de um trecho da cripta, com um X.',
      'Anel de sinete da guilda dos ferreiros — e não é dele.',
      'Punhado de sal grosso, embrulhado com cuidado exagerado.',
      'Nada. Os bolsos foram esvaziados antes de você chegar.'
    ]
  },
  {
    id: 'taverna-nome', nome: 'Nome de taverna', dado: 20, categoria: 'Nomes',
    itens: [
      'O Javali Manco', 'A Âncora Enferrujada', 'Três Corvos', 'O Último Copo',
      'A Coroa Partida', 'O Martelo Frio', 'Casa da Viúva', 'O Porco Dourado',
      'A Sereia Muda', 'Pena e Tinta', 'O Machado Torto', 'A Lua Baixa',
      'O Cão de Duas Cabeças', 'Taverna do Fim da Rua', 'A Bigorna Apagada',
      'O Rato Nobre', 'Sete Chaves', 'A Botina Furada', 'O Sino Rachado',
      'Onde o Caminho Acaba'
    ]
  },
  {
    id: 'pessoa-nome', nome: 'Nome de pessoa', dado: 20, categoria: 'Nomes',
    itens: [
      'Aldric', 'Brenna', 'Corvin', 'Dagna', 'Eskel', 'Fenn', 'Giselle', 'Halric',
      'Ilvane', 'Joren', 'Katrin', 'Lorcan', 'Mirena', 'Nessa', 'Orlin', 'Perrin',
      'Quilla', 'Rhodan', 'Selis', 'Torvin'
    ]
  },
  {
    id: 'saque', nome: 'Saque miúdo', dado: 10, categoria: 'Tesouro',
    itens: [
      '2d6 moedas de prata numa bolsa de couro puída.',
      'Um anel simples de ouro, 25 po, com iniciais gastas por dentro.',
      'Poção de cura, rolha lacrada com cera vermelha.',
      'Pergaminho de Identificação, chamuscado nas bordas.',
      'Adaga bem-feita, cabo de osso, 10 po.',
      'Broche de prata da Ordem da Aurora, 15 po.',
      'Frasco de óleo alquímico, ainda selado.',
      'Corda de seda de 15 m, quase sem uso.',
      'Um livro de contas com vários nomes riscados.',
      'Chave de ferro pesada, dessas de porta grande.'
    ]
  },
  {
    id: 'motivo-npc', nome: 'Por que ele está aqui', dado: 8, categoria: 'Narrativa',
    itens: [
      'Está fugindo de alguém que chega em breve.',
      'Foi mandado, e não sabe direito por quem.',
      'Procura alguém que sumiu há semanas.',
      'Está cobrando uma dívida antiga.',
      'Veio esconder uma coisa, e ainda não escondeu.',
      'Está bêbado e não deveria estar aqui.',
      'Trabalha aqui há anos e é invisível para todos.',
      'Está esperando a party — especificamente.'
    ]
  },
  {
    id: 'reviravolta', nome: 'Reviravolta de missão', dado: 8, categoria: 'Narrativa',
    itens: [
      'Quem contratou a party mentiu sobre o objetivo.',
      'O "monstro" está protegendo alguém inocente.',
      'O item já foi roubado — há duas semanas.',
      'Há um segundo grupo atrás da mesma coisa, e chegou antes.',
      'A recompensa prometida não existe mais.',
      'Um aliado da party passa informação ao outro lado, sem saber.',
      'Resolver o problema cria um problema pior na cidade.',
      'O alvo quer ser encontrado.'
    ]
  },
  {
    id: 'armadilha', nome: 'Armadilha simples', dado: 10, categoria: 'Perigos',
    itens: [
      'Fosso coberto: Percepção CD 13; salvaguarda DES CD 12, 2d6 de queda.',
      'Dardos na parede: gatilho no chão, +5 para acertar, 1d4+2 perfurante.',
      'Placa de pressão ligada a um sino: sem dano, mas acorda o andar inteiro.',
      'Glifo de fogo: salvaguarda DES CD 15, 4d6 ígneo num raio de 3 m.',
      'Teto que desce: 3 rodadas para sair, ou 4d10 de esmagamento.',
      'Lâmina pendular: +6 para acertar, 2d6 cortante; corta corda de quem escala.',
      'Gás sonífero: salvaguarda CON CD 13 ou inconsciente por 1d4 minutos.',
      'Degrau falso: 1d4 de dano e barulho de madeira quebrando.',
      'Rede com peso: salvaguarda DES CD 12 ou fica contido (escapar CD 13).',
      'Fechadura com agulha envenenada: CD 14 para abrir, 1d4 + 2d4 de veneno.'
    ]
  },
  {
    id: 'presagio', nome: 'Clima e presságio', dado: 8, categoria: 'Detalhes',
    itens: [
      'Tempestade arcana: relâmpagos sem trovão, pelos arrepiados.',
      'Névoa densa, que abafa o som a mais de 6 m.',
      'Frio súbito, hálito visível — mesmo dentro de casa.',
      'Cheiro de ferro na água da chuva.',
      'Os cães da cidade uivam juntos, e param juntos.',
      'Céu limpo demais para a época, e ninguém comenta.',
      'Velas queimam com chama azul por alguns minutos.',
      'Silêncio de pássaros desde a madrugada.'
    ]
  }
];
