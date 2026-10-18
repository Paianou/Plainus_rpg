/* ===================================================================
   mestre.js — a Visão Geral

   Esta tela é o PANORAMA: o grupo, a cena e as ferramentas de
   consulta rápida. Ela mostra a ordem de iniciativa, mas só para
   leitura — mexer no combate (dano, condições, adicionar monstro) é
   trabalho da tela de Combate, em combate.html. Cada coisa num lugar:
   é o que evita duas telas fazendo a mesma coisa de jeitos diferentes.

   O que NÃO está aqui, porque é compartilhado:
     Estado, MONSTROS, GERADOR, Memoria ... dados.js
     criar(), Layout, a moldura, a guarda .. layout.js
     Icone .................................. icones.js
   =================================================================== */

const Painel = {

  /* Qual recorte da tela está em foco. Isto é estado de VISTA, não da
     mesa: não vai para o dados.js nem para o sessionStorage, porque não
     descreve a campanha — descreve o que eu estou olhando agora. Por
     isso recarregar a página volta para o Panorama, e está certo. */
  aba: 'panorama',
  modoRolagem: 'normal',        /* 'vantagem' | 'normal' | 'desvantagem' */
  condicaoAberta: 'Paralisado',

  /* Quanto PV cada ficha vai tirar ou dar. Fica aqui, e não no Estado,
     porque é o que EU digitei agora — some quando a página recarrega, e
     deve mesmo sumir. Guardado por herói para sobreviver ao render:
     aplicar 13 de dano redesenha a coluna, e sem isto o campo voltaria
     para 5 justo quando você ia bater no segundo alvo. */
  quantiaPV: {},


  iniciar: function () {
    this.render();
    this.ligarEventos();
  },


  /* Abas e miolo andam juntos: as pílulas das abas contam o que está no
     miolo (heróis em risco, rodada do combate), então redesenhar um sem
     o outro deixaria o contador mentindo. Por isso toda ação que muda o
     Estado chama render(), e não renderConteudo() direto. */
  render: function () {
    this.renderAbas();
    this.renderConteudo();
  },


  /* ---------- Abas ---------- */

  /* As abas FILTRAM esta tela — não navegam para outra. Panorama mostra
     as três colunas; as outras mostram uma só, com a largura toda.

     Antes daqui havia abas chamadas "Fichas dos Jogadores" e "Iniciativa
     em andamento" que só davam um recado de desculpas, e ainda
     concorriam com o códice da esquerda, que leva a telas de verdade.
     Duas navegações dizendo coisas diferentes é pior que uma só: a
     pessoa clica na que está mais perto e nada acontece.

     No celular, onde as três colunas viram uma pilha muito longa, é aqui
     que se escolhe o que olhar. */
  ABAS: [
    { id: 'panorama',    ico: 'painel', texto: 'Panorama' },
    { id: 'grupo',       ico: 'npcs',   texto: 'Grupo' },
    { id: 'cena',        ico: 'mapa',   texto: 'Cena' },
    { id: 'ferramentas', ico: 'dados',  texto: 'Ferramentas' }
  ],


  /* A pílula de cada aba, calculada na hora — nenhuma é texto fixo. Uma
     etiqueta que não mede nada é decoração, e decoração que se parece
     com informação é pior que nada: a aba antiga dizia "Ativo" sem
     existir nenhum interruptor no Estado. Devolver null é não ter
     pílula, e a aba fica só com o nome. */
  pilulaDaAba: function (id) {
    if (id === 'grupo') {
      const contados = Estado.herois.filter(Painel.emRisco).length;
      return contados
        ? { texto: contados + ' em risco', cor: 'perigo' }
        : { texto: String(Estado.herois.length), cor: null };
    }

    if (id === 'cena' && Estado.combate.ativo) {
      return { texto: 'Rodada ' + Estado.combate.rodada, cor: 'azul' };
    }

    return null;
  },


  /* Um herói está em risco quando a barra de vida dele já entrou na
     faixa vermelha. O valor é DERIVADO do PV, e não lido de
     heroi.estadoPerigo: aquele campo é um rótulo escrito à mão no
     dados.js, que continua dizendo "Ferido" mesmo depois de o herói
     curar tudo. Guardar o que dá para calcular é combinar de ter dois
     números que um dia discordam.

     É a mesma fatia de 30% que pinta a barra em montarHeroi, e por isso
     as duas leem daqui. */
  emRisco: function (heroi) {
    return heroi.pv === 0 || heroi.pv / heroi.pvMax <= .3;
  },


  renderAbas: function () {
    const area = document.getElementById('abas');
    const c = Estado.campanha;
    const self = this;
    area.textContent = '';

    this.ABAS.forEach(function (aba) {
      const ativa = self.aba === aba.id;
      const botao = criar('button.aba' + (ativa ? '.ativa' : ''));
      botao.type = 'button';
      botao.dataset.aba = aba.id;
      /* Para quem usa leitor de tela, "ativa" sem isto é apenas uma cor
         de fundo — e ninguém anuncia cor de fundo. */
      botao.setAttribute('aria-pressed', ativa ? 'true' : 'false');
      botao.appendChild(Icone.svg(aba.ico, 15));
      botao.appendChild(criar('span', aba.texto));

      const pilula = self.pilulaDaAba(aba.id);
      if (pilula) {
        botao.appendChild(criar('span.pilula' + (pilula.cor ? '.' + pilula.cor : ''), pilula.texto));
      }
      area.appendChild(botao);
    });

    area.appendChild(criar('div.espaco'));
    area.appendChild(criar('span.pilula', 'Cap. ' + c.capitulo));
    area.appendChild(criar('span.pilula.azul', 'Nível médio ' + c.nivelMedio));
  },


  /* ---------- O miolo: uma coluna ou as três ---------- */

  renderConteudo: function () {
    const area = document.getElementById('conteudo');
    area.textContent = '';

    /* A classe .foco avisa ao CSS que veio uma coluna só, e que ela pode
       se espalhar na largura toda em vez de ficar estreita no meio do
       vazio. As regras estão na seção 16b do style.css. */
    const caixa = criar('div.colunas-mesa' + (this.aba === 'panorama' ? '' : '.foco'));

    if (this.aba === 'panorama') area.appendChild(this.montarSobreCampanha());

    if (this.mostra('grupo'))       caixa.appendChild(this.montarColunaHerois());
    if (this.mostra('cena'))        caixa.appendChild(this.montarColunaCena());
    if (this.mostra('ferramentas')) caixa.appendChild(this.montarColunaFerramentas());

    area.appendChild(caixa);
    if (this.aba === 'grupo') this.equilibrarGrupo(caixa.querySelector('.coluna-herois'));
  },


  /* A aba Grupo põe as fichas em grade. O CSS sozinho enche as fileiras
     da esquerda para a direita, e 5 heróis numa tela larga viravam
     4 + 1: um herói sozinho na fileira de baixo, e um buraco do lado.
     Aqui: quantas cabem por fileira (330px cada, como na seção 16b do
     style.css), quantas fileiras isso dá — e as fichas repartidas por
     igual nelas (5 → 3 + 2). O ResizeObserver refaz a conta quando a
     largura muda, sem esperar outro redesenho. */
  equilibrarGrupo: function (coluna) {
    if (this.observadorGrupo) this.observadorGrupo.disconnect();
    if (!coluna || typeof ResizeObserver === 'undefined') return;
    const fichas = coluna.querySelectorAll(':scope > .heroi').length;
    if (!fichas) return;
    function contar() {
      const largura = coluna.clientWidth;
      const vao = parseFloat(getComputedStyle(coluna).columnGap) || 0;
      const cabem = Math.max(1, Math.floor((largura + vao) / (330 + vao)));
      const fileiras = Math.ceil(fichas / cabem);
      /* Cabem todos numa fileira? Então as colunas de sempre: 1 ou 2
         heróis não se esticam pela tela inteira. */
      const colunas = fileiras === 1 ? cabem : Math.ceil(fichas / fileiras);
      coluna.style.gridTemplateColumns = 'repeat(' + colunas + ', minmax(0, 1fr))';
    }
    this.observadorGrupo = new ResizeObserver(contar);
    this.observadorGrupo.observe(coluna);
    contar();
  },


  /* ----- O que foi respondido ao criar a campanha -----

     <details> e não um cartão sempre aberto: premissa, cenário e
     limites são para CONSULTAR, não para ocupar o topo da tela a
     sessão inteira. O <details> abre e fecha sozinho, sem uma linha
     de JS, e o leitor de tela já sabe anunciar que ele expande.

     Ele nasce aberto só enquanto a campanha não tem nenhum herói —
     é quando o mestre ainda está se situando. Os limites, quando
     existem, ficam na linha do título: é a única coisa daqui que
     precisa estar à vista mesmo com o cartão fechado. */
  montarSobreCampanha: function () {
    const c = Estado.campanha;
    const sobre = criar('details.sobre-campanha');
    sobre.open = Estado.herois.length === 0;

    const resumo = criar('summary', [
      criarComIcone('span.titulo', 'campanha', 'Sobre a campanha', 15),
      criar('span.sub', [c.sistema, c.tom].filter(Boolean).join(' · '))
    ]);
    sobre.appendChild(resumo);

    /* 'limites' é o nome antigo de 'linhas' (campanhas criadas antes
       de existirem linhas e véus). */
    const itens = [
      ['Do que se trata', c.premissa],
      ['Onde se passa', c.cenario],
      ['Linhas — nunca entra', c.linhas || c.limites],
      ['Véus — fora de cena', c.veus],
      ['Mesa', c.jogadores ? c.jogadores + ' jogadores · começam no nível ' + c.nivelInicial : '']
    ].filter(function (par) { return par[1]; });

    if (itens.length) {
      const grade = criar('dl.sobre-grade');
      /* A <div> segura o par junto no grid — ver .sobre-grade no CSS. */
      itens.forEach(function (par) {
        grade.appendChild(criar('div', [criar('dt', par[0]), criar('dd', par[1])]));
      });
      sobre.appendChild(grade);
    } else {
      sobre.appendChild(criar('p.dica', 'Esta campanha ainda não tem premissa nem cenário registrados.'));
    }

    /* Link, e não botão com JS: editar é ir para outra página. A
       página de edição descobre QUAL campanha pela sessão, e não pelo
       endereço — por isso o link não leva id nenhum. */
    const editar = criarComIcone('a.mini-botao', 'editar', 'Editar campanha', 13);
    editar.href = 'criar-campanha.html?editar=1';
    /* Quem tem acesso (liberar jogador, outros computadores, apagar):
       uma página à parte — ver o topo do acessos.html. */
    const acessos = criarComIcone('a.mini-botao', 'secreto', 'Acessos da mesa', 13);
    acessos.href = 'acessos.html';
    sobre.appendChild(criar('div.sobre-acoes', [editar, acessos]));

    return sobre;
  },


  /* Panorama mostra tudo; qualquer outra aba mostra só a sua coluna. */
  mostra: function (coluna) {
    return this.aba === 'panorama' || this.aba === coluna;
  },


  /* ----- Coluna 1: os heróis ----- */

  montarColunaHerois: function () {
    const self = this;
    const coluna = criar('section.coluna-mesa.coluna-herois');

    coluna.appendChild(criar('div.titulo-coluna', [
      criar('div', [
        criarComIcone('h2', 'npcs', 'Grupo de heróis', 17),
        criar('div.sub', Estado.grupo.nome + ' (' + Estado.herois.length + ')')
      ])
    ]));

    Estado.herois.forEach(function (heroi) {
      coluna.appendChild(self.montarHeroi(heroi));
    });

    /* Campanha vazia. Quem cria herói é o jogador, na ficha dele —
       que é o próximo passo do projeto. */
    if (!Estado.herois.length) {
      coluna.appendChild(criar('div.vazio',
        'Nenhum herói ainda. Passe o código de convite (botão ao lado do sino): cada jogador entra com ele e cria a própria ficha.'));
    }

    return coluna;
  },


  montarHeroi: function (heroi) {
    const cartao = criar('article.heroi');
    cartao.dataset.heroi = heroi.id;

    /* A foto que o jogador pôs na ficha dele, ou a inicial. */
    const retrato = criarRetrato('div.retrato-heroi', heroi.ficha && heroi.ficha.foto, heroi.nome);
    retrato.appendChild(criar('span.nivel', 'NV ' + heroi.nivel));

    cartao.appendChild(criar('div.heroi-topo', [
      retrato,
      criar('div.heroi-identidade', [
        criar('div.nome', heroi.nome),
        criar('div.classe', heroi.classe)
      ]),
      /* Personagem criado por jogador ainda não tem estado ("Furtivo",
         "Abençoado"...): sem texto, sem pílula. */
      heroi.estado && criar('span.pilula' + (heroi.estadoPerigo ? '.perigo' : '.azul'), heroi.estado)
    ]));

    cartao.appendChild(criar('div.estatisticas', [
      this.montarEstat('Armadura', heroi.ca + ' CA'),
      this.montarEstat('Percepção', heroi.pp + ' PP'),
      this.montarEstat(heroi.terceira.rotulo, heroi.terceira.valor)
    ]));

    const proporcao = heroi.pv / heroi.pvMax;
    const faixa = proporcao > .6 ? '' : (this.emRisco(heroi) ? '.baixa' : '.media');

    cartao.appendChild(criar('div.linha-vida', [
      criar('span', 'Pontos de vida'),
      criar('span.numeros', heroi.pv + ' / ' + heroi.pvMax + ' PV')
    ]));

    const preenchimento = criar('div.preenchimento' + faixa);
    preenchimento.style.width = Math.max(0, proporcao * 100) + '%';
    cartao.appendChild(criar('div.barra', preenchimento));

    if (heroi.recursos) {
      const pontos = criar('div.pontos-recurso');
      pontos.style.marginTop = '10px';
      const rotulo = criar('span', heroi.recursos.rotulo);
      rotulo.style.cssText = 'font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--texto-3);margin-right:4px';
      pontos.appendChild(rotulo);
      for (let i = 0; i < heroi.recursos.total; i++) {
        pontos.appendChild(criar('span.ponto' + (i < heroi.recursos.usados ? '.gasto' : '')));
      }
      cartao.appendChild(pontos);
    }

    /* Antes eram dois botões de 5 PV fixos. Dano em D&D quase nunca é
       5: um crítico de machado grande faz 19, e clicar quatro vezes
       passa do ponto. O número agora é campo. */
    const quantia = document.createElement('input');
    quantia.type = 'number';
    quantia.min = 1;
    quantia.max = 999;
    quantia.value = this.quantiaPV[heroi.id] || 5;
    quantia.className = 'campo-pv';
    quantia.setAttribute('aria-label', 'Quantidade de PV — ' + heroi.nome);

    const menos = criarBotao('mini-botao.dano', 'dano', 'menos', 'Dano');
    const mais = criarBotao('mini-botao.cura', 'cura', 'mais', 'Cura');

    cartao.appendChild(criar('div.heroi-rodape', [
      criar('div.grupo-mini', [menos, quantia, mais]),
      criar('span.detalhe', heroi.rodape)
    ]));

    return cartao;
  },


  montarEstat: function (rotulo, valor) {
    return criar('div.estat', [
      criar('div.rotulo', rotulo),
      criar('div.valor', valor)
    ]);
  },


  /* ----- Coluna 2: cena + resumo do combate ----- */

  montarColunaCena: function () {
    /* A classe .coluna-cena existe para a aba de foco: o mapa é o único
       cartão da tela que fica PIOR esticado, então o CSS limita ele. */
    const coluna = criar('section.coluna-mesa.coluna-cena');
    coluna.appendChild(this.montarCartaoCena());
    coluna.appendChild(this.montarResumoCombate());
    return coluna;
  },


  /* A cena que está em jogo. Existia um Estado.cena separado, com as
     próprias posições em pixels, só para esta tela — e por isso o mapa
     daqui e o da tela de Mapas mostravam salas diferentes. Agora as
     duas leem a MESMA cena de Estado.cenas. */
  cenaEmJogo: function () {
    return (Estado.cenas || []).find(function (c) {
      return c.id === Estado.cenaAtual;
    });
  },


  /* Quem está no combate mas não tem token na cena. O casamento é pelo
     nome, que é a convenção já combinada no dados.js.

     Isto não é enfeite: enquanto nada ligar combatente e token, os dois
     podem divergir de novo no meio da sessão. Melhor a tela dizer
     "faltam estes" do que fingir que a sala está completa. */
  foraDoMapa: function (cena) {
    if (!cena) return [];
    const nomes = cena.tokens.map(function (t) { return t.nome; });
    return Estado.combate.combatentes.filter(function (c) {
      return nomes.indexOf(c.nome) === -1;
    });
  },


  montarCartaoCena: function () {
    const cena = this.cenaEmJogo();
    const combate = Estado.combate;
    const cartao = criar('div.cartao');

    if (!cena) {
      cartao.appendChild(criar('p.dica', 'Nenhuma cena selecionada em Mapas & Cenas.'));
      return cartao;
    }

    /* A "Rodada 3" saiu daqui: a pílula da aba Cena já mostra o número,
       e ela existe justamente para você ver isso SEM abrir a aba. */
    /* Sem encontro descrito (campanha nova, ou entre combates), o
       título é o nome da sala e a pílula de dificuldade não aparece —
       uma pílula " · ND " vazia seria pior que nenhuma. */
    cartao.appendChild(criar('div.cena-cabecalho', [
      criar('div', [
        combate.dificuldade && criar('div.cena-etiquetas', [
          criar('span.pilula.perigo', combate.dificuldade + (combate.nd ? ' · ND ' + combate.nd : ''))
        ]),
        criar('h2.titulo-cena', combate.encontro || cena.nome)
      ])
    ]));

    const mapa = criar('div.mapa');
    mapa.appendChild(this.desenharMapa(cena));

    /* Contado, não guardado: um número escrito à mão em dados.js seria
       mais um lugar para discordar do mapa. */
    const inimigos = cena.tokens.filter(function (t) { return t.tipo === 'inimigo'; }).length;

    mapa.appendChild(criar('div.mapa-faixa', [
      cena.visibilidade && criar('span.mapa-selo', cena.visibilidade),
      criar('span.mapa-selo.perigo', inimigos + (inimigos === 1 ? ' inimigo visível' : ' inimigos visíveis'))
    ]));

    mapa.appendChild(criar('div.mapa-rodape',
      criarBotao('mini-botao', 'expandir-mapa', 'expandir', 'Expandir mapa')));

    cartao.appendChild(mapa);

    const ausentes = this.foraDoMapa(cena);
    if (ausentes.length) {
      cartao.appendChild(criar('p.aviso-cena', 'No combate, mas fora do mapa: '
        + ausentes.map(function (c) { return c.nome; }).join(', ') + '.'));
    }

    return cartao;
  },


  /* A planta da cena em miniatura. O desenho mora no planta.js, que
     a aba Mesa do painel do jogador também usa — uma planta só para
     as duas telas. Continua sendo só leitura: arrastar token é na
     tela de Mapas. */
  desenharMapa: function (cena) {
    return Planta.desenhar(cena);
  },


  /* Resumo do combate — só leitura. Quem mexe é combate.html. */
  montarResumoCombate: function () {
    const combate = Estado.combate;
    const cartao = criar('div.cartao');

    const vez = combate.combatentes.findIndex(function (c) { return !c.agiu; });
    const faltam = combate.combatentes.filter(function (c) { return !c.agiu; }).length;

    cartao.appendChild(criar('div.titulo-coluna', [
      criarComIcone('h2', 'ampulheta', 'Ordem de iniciativa', 17),
      criar('span.sub', faltam + ' ainda por agir')
    ]));

    const lista = criar('div.iniciativa');

    combate.combatentes.forEach(function (combatente, indice) {
      const classes = '.linha-iniciativa'
        + (combatente.agiu ? '.agiu' : '')
        + (indice === vez ? '.vez-simples' : '')
        + (combatente.tipo === 'inimigo' ? '.inimigo' : '');

      const linha = criar('div' + classes, [
        criar('div.ordem-numero', combatente.iniciativa),
        criar('div.quem', [
          criar('div.nome', combatente.nome),
          criar('div.estado', combatente.pv + '/' + combatente.pvMax + ' PV · ' + combatente.nota)
        ])
      ]);

      if (indice === vez) linha.appendChild(criar('span.pilula.azul', 'Vez'));
      else if (combatente.agiu) {
        const certo = Icone.svg('check', 16);
        certo.style.color = 'var(--texto-3)';
        linha.appendChild(certo);
      }

      lista.appendChild(linha);
    });

    if (!combate.combatentes.length) {
      lista.appendChild(criar('p.dica', 'Ninguém na ordem. Monte o combate pela tela de Combate ou pelo Bestiário.'));
    }

    cartao.appendChild(lista);

    /* O caminho para a tela que realmente opera o combate. */
    const abrir = criar('a.botao.pequeno', 'Abrir combate');
    abrir.href = 'combate.html';
    abrir.style.textDecoration = 'none';

    cartao.appendChild(criar('div.rodape-combate', [abrir]));
    return cartao;
  },


  /* ----- Coluna 3: as ferramentas ----- */

  /* O Rolador e as Rolagens da mesa ficam numa pilha: quando a coluna
     se abre em grade (a aba Ferramentas, ou o Panorama até 1500px), a
     pilha é a coluna da esquerda e termina perto do Compêndio, em vez
     de o Rolador acabar na metade e deixar um buraco embaixo. No
     Panorama largo (três colunas) as rolagens saem pelo CSS: ali esta
     coluna já é a mais comprida. */
  montarColunaFerramentas: function () {
    const coluna = criar('aside.coluna-mesa.coluna-ferramentas');
    coluna.appendChild(criar('div.coluna-mesa.pilha-rolador', [this.montarRolador(), this.montarRolagensMesa()]));
    coluna.appendChild(this.montarCompendio());
    return coluna;
  },


  /* As rolagens dos jogadores, como cada um as vê na aba Mesa
     (jogador-mesa.js, RoladorJogador): o mesmo registro, as mesmas
     palavras. Antes o Mestre não via o que a mesa rolava no painel. */
  montarRolagensMesa: function () {
    const cartao = criar('div.cartao.cartao-rolagens-mesa', [criar('div.titulo-coluna', [criarComIcone('h2', 'dados', 'Rolagens da mesa', 17)])]);
    const registro = criar('div.registro-rolagens');
    const rolagens = Estado.rolagensMesa || [];
    if (!rolagens.length) registro.appendChild(criar('p.dica', 'Ninguém rolou nada ainda.'));
    rolagens.slice(0, 8).forEach(function (r) {
      registro.appendChild(criar('div.rolagem-mesa' + (r.marca ? '.' + r.marca : ''), [
        criar('div', [
          criar('div.quem', (r.personagem || r.autor) + ' — ' + r.texto),
          criar('div.formula', r.formula)
        ]),
        criar('div.total', String(r.total))
      ]));
    });
    cartao.appendChild(registro);
    return cartao;
  },


  montarRolador: function () {
    const self = this;
    const cartao = criar('div.cartao');

    const modos = criar('div.modos-rolagem');
    [['vantagem', '+V'], ['normal', 'N'], ['desvantagem', '−D']].forEach(function (par) {
      const botao = criar('button.modo' + (self.modoRolagem === par[0] ? '.ativo' : ''), par[1]);
      botao.type = 'button';
      botao.dataset.acao = 'modo';
      botao.dataset.modo = par[0];
      botao.title = par[0];
      modos.appendChild(botao);
    });

    cartao.appendChild(criar('div.titulo-coluna', [
      criarComIcone('h2', 'dados', 'Rolador do mestre', 17),
      modos
    ]));

    const grade = criar('div.grade-dados');
    [
      { faces: 4, uso: 'Dardo' }, { faces: 6, uso: 'Fogo' }, { faces: 8, uso: 'Espada' },
      { faces: 10, uso: 'Truque' }, { faces: 20, uso: 'Teste / ataque', principal: true }, { faces: 100, uso: 'Tabela' }
    ].forEach(function (dado) {
      const botao = criar('button.dado' + (dado.principal ? '.principal' : ''));
      botao.type = 'button';
      botao.dataset.acao = 'rolar';
      botao.dataset.faces = dado.faces;
      botao.appendChild(criar('div.face', dado.faces === 100 ? 'd%' : 'd' + dado.faces));
      botao.appendChild(criar('div.uso', dado.uso));
      grade.appendChild(botao);
    });
    cartao.appendChild(grade);

    cartao.appendChild(this.montarResultado());

    const secreta = criarBotao('botao.fantasma.pequeno', 'rolagem-secreta', 'secreto', 'Percepção secreta (só você vê)');
    const animacao = criarBotao('mini-botao' + (Dados3D.ativa() ? '.ligado' : ''), 'alternar-animacao', 'dados',
      Dados3D.ativa() ? 'Animação ligada' : 'Animação desligada');
    animacao.setAttribute('aria-pressed', Dados3D.ativa() ? 'true' : 'false');
    const linha = criar('div.linha-botoes', [secreta, animacao]);
    linha.style.marginTop = '12px';
    cartao.appendChild(linha);

    return cartao;
  },


  montarResultado: function () {
    const ultima = Estado.rolagens[0];
    const caixa = criar('div.resultado');

    caixa.appendChild(criar('div.rotulo', 'Última rolagem'));

    /* Campanha nova: nenhum dado rolado ainda. */
    if (!ultima) {
      caixa.appendChild(criar('p.dica', 'Nada rolado ainda. Escolha um dado acima.'));
      return caixa;
    }

    const total = criar('div.total' + (ultima.marca === 'critico' ? '.critico' : (ultima.marca === 'falha' ? '.falha' : '')), ultima.total);
    const direita = criar('div', [total]);
    if (ultima.marca === 'critico') direita.appendChild(criar('div.selo-critico.critico', 'Acerto crítico'));
    if (ultima.marca === 'falha') direita.appendChild(criar('div.selo-critico.falha', 'Falha crítica'));

    caixa.appendChild(criar('div.topo', [
      criar('div.formula', [
        criar('div', ultima.texto),
        criar('div', ultima.formula + (ultima.nota ? ' · ' + ultima.nota : ''))
      ]),
      direita
    ]));

    if (Estado.rolagens.length > 1) {
      const historico = criar('div.historico');
      Estado.rolagens.slice(1, 4).forEach(function (rolagem) {
        historico.appendChild(criar('div.linha', [
          criar('span', rolagem.texto),
          criar('span.valor', rolagem.formula + ' = ' + rolagem.total)
        ]));
      });
      caixa.appendChild(historico);
    }

    return caixa;
  },


  montarCompendio: function () {
    const self = this;
    const cartao = criar('div.cartao');

    cartao.appendChild(criar('div.titulo-coluna', [
      criarComIcone('h2', 'compendio', 'Compêndio rápido', 17),
      criar('span.sub', 'Consulta relâmpago')
    ]));

    /* NPC */
    const recarregar = criarBotao('mini-botao', 'gerar-npc', 'recarregar', '');
    recarregar.setAttribute('aria-label', 'Gerar outro NPC');

    /* Campanha nova começa sem NPC sorteado (Estado.npc é null). */
    let gerado;
    if (Estado.npc) {
      const segredo = criar('div.segredo');
      segredo.appendChild(criar('strong', 'Segredo: '));
      segredo.appendChild(document.createTextNode(Estado.npc.segredo));

      gerado = criar('div.npc-gerado', [
        criar('div.nome', Estado.npc.nome),
        criar('div.traco', Estado.npc.traco),
        segredo
      ]);
    } else {
      gerado = criar('p.dica', 'Clique em sortear para gerar um NPC de improviso.');
    }

    cartao.appendChild(criar('div.bloco-compendio', [
      criar('div.cabeca', [
        criarComIcone('span.titulo', 'npcNovo', 'Gerador de NPC', 14),
        recarregar
      ]),
      gerado
    ]));

    /* Condições */
    const etiquetas = criar('div.etiquetas-condicao');
    Object.keys(CONDICOES).slice(0, 6).forEach(function (nome) {
      const botao = criar('button.etiqueta-condicao' + (self.condicaoAberta === nome ? '.ativa' : ''), nome);
      botao.type = 'button';
      botao.dataset.acao = 'condicao';
      botao.dataset.condicao = nome;
      etiquetas.appendChild(botao);
    });

    const blocoCondicoes = criar('div.bloco-compendio', [
      criar('div.cabeca', [criarComIcone('span.titulo', 'condicoes', 'Regras de condições', 14)]),
      etiquetas
    ]);

    if (this.condicaoAberta) {
      const texto = criar('div.texto-regra');
      texto.appendChild(criar('strong', this.condicaoAberta + ': '));
      /* O texto das condições é NOSSO (está no dados.js) e algumas
         usam <strong>. Nunca vem de digitação de jogador. */
      const trecho = document.createElement('span');
      trecho.innerHTML = CONDICOES[this.condicaoAberta];
      texto.appendChild(trecho);
      blocoCondicoes.appendChild(texto);
    }
    cartao.appendChild(blocoCondicoes);

    /* Fixadas no compêndio — só aparece se houver alguma.
       É o outro lado do botão "Fixar no painel" do compendio.html. */
    const fixadas = Estado.fixadas || [];
    if (fixadas.length) {
      const lista = criar('div.etiquetas-condicao');

      fixadas.forEach(function (nome) {
        /* Link, não botão: leva ao verbete no compêndio, já aberto.
           Só o nome é guardado, então o tipo é descoberto aqui. */
        const tipo = MAGIAS.some(function (m) { return m.nome === nome; }) ? 'magias'
                   : EQUIPAMENTO.some(function (e) { return e.nome === nome; }) ? 'equipamento'
                   : 'condicoes';
        const atalho = criar('a.etiqueta-condicao', nome);
        atalho.href = 'compendio.html#abrir=' + encodeURIComponent(tipo + ':' + nome);
        atalho.style.textDecoration = 'none';
        lista.appendChild(atalho);
      });

      cartao.appendChild(criar('div.bloco-compendio', [
        criar('div.cabeca', [criarComIcone('span.titulo', 'surto', 'Fixadas nesta campanha', 14)]),
        lista
      ]));
    }

    /* Tesouro */
    cartao.appendChild(criar('div.bloco-compendio', [
      criar('div.cabeca', [
        criarComIcone('span.titulo', 'tesouro', 'Tesouro individual ND 5-10', 14),
        criarBotao('mini-botao', 'rolar-saque', 'dados', 'Rolar')
      ]),
      criar('div.saque', Estado.tesouro)
    ]));

    /* Áudio — quem toca é o audio.js; aqui só estão os controles. */
    const controle = criar('div.controle-audio');
    controle.appendChild(this.montarBotaoSom());

    const faixa = document.createElement('input');
    faixa.type = 'range';
    faixa.min = 0;
    faixa.max = 100;
    faixa.value = Estado.audio.volume;
    faixa.id = 'volumeAudio';
    faixa.setAttribute('aria-label', 'Volume do ambiente');
    controle.appendChild(faixa);

    const mostrador = criar('span.valor-volume', Estado.audio.volume + '%');
    mostrador.style.cssText = 'font-size:11px;color:var(--texto-3);min-width:34px;text-align:right';
    controle.appendChild(mostrador);

    /* Escolher a pista numa lista, e não sortear: o mestre sabe que
       a cena pede chuva, não quer rolar até cair nela. */
    const escolha = document.createElement('select');
    escolha.id = 'pistaAudio';
    escolha.setAttribute('aria-label', 'Pista de ambiente');
    Object.keys(Som.PISTAS).forEach(function (nome) {
      const opcao = document.createElement('option');
      opcao.value = nome;
      opcao.textContent = nome;
      escolha.appendChild(opcao);
    });
    escolha.value = Estado.audio.pista;

    cartao.appendChild(criar('div.bloco-compendio', [
      criar('div.cabeca', [criarComIcone('span.titulo', 'audio', 'Áudio de ambiente', 14)]),
      controle,
      criar('div.linha-pista', [escolha])
    ]));

    return cartao;
  },


  /* Mesmo raciocínio do botão da barra: o ícone mostra o que o
     clique FAZ, a partir do que está soando de verdade. */
  montarBotaoSom: function () {
    const soando = Som.tocando();
    const botao = criarBotao('mini-botao', 'som', soando ? 'pausa' : 'volume', '');
    botao.id = 'botaoSomPainel';
    botao.setAttribute('aria-label', soando ? 'Pausar ambiente' : 'Tocar ambiente');
    botao.title = soando ? 'Pausar ambiente' : 'Tocar ambiente';
    return botao;
  },


  /* Chamado quando o som muda (evento 'plainus:audio').

     Troca só o botão e o valor da lista, em vez de redesenhar o painel
     inteiro. Redesenhar tudo destruiria a lista de pistas no meio do
     clique — se o primeiro clique da página for nela, o navegador
     abriria a lista e ela sumiria na mesma hora. */
  atualizarSom: function () {
    const botao = document.getElementById('botaoSomPainel');
    if (botao) botao.replaceWith(this.montarBotaoSom());

    const escolha = document.getElementById('pistaAudio');
    if (escolha) escolha.value = Estado.audio.pista;
  },


  /* ---------- Eventos ---------- */

  ligarEventos: function () {
    const self = this;

    document.getElementById('abas').addEventListener('click', function (evento) {
      const botao = evento.target.closest('[data-aba]');
      if (!botao) return;
      if (botao.dataset.aba === self.aba) return;   /* clicar na ativa não faz nada */

      self.aba = botao.dataset.aba;
      self.render();

      /* O render destruiu e recriou o botão que acabou de ser clicado.
         Sem devolver o foco, quem navega por teclado seria jogado para o
         começo da página a cada troca de aba. */
      const ativa = document.querySelector('.aba.ativa');
      if (ativa) ativa.focus();
    });

    document.getElementById('conteudo').addEventListener('click', function (evento) {
      const alvo = evento.target.closest('[data-acao]');
      if (!alvo) return;
      self.executar(alvo.dataset.acao, alvo);
    });

    document.getElementById('conteudo').addEventListener('input', function (evento) {
      if (evento.target.id === 'volumeAudio') {
        Acoes.executar('ajustarAudio', { volume: Number(evento.target.value) });
        Som.ajustarVolume();
        const mostrador = document.querySelector('.valor-volume');
        if (mostrador) mostrador.textContent = Estado.audio.volume + '%';
      }
    });

    /* Escolher uma pista é querer ouvi-la: por isso liga o som também. */
    document.getElementById('conteudo').addEventListener('change', function (evento) {
      if (evento.target.id !== 'pistaAudio') return;
      if (Acoes.executar('ajustarAudio', { pista: evento.target.value, tocando: true }).erro) return;
      Som.liberar();
      Som.aplicar();
      Layout.recado('Tocando: ' + Estado.audio.pista + '.');
    });

    document.addEventListener('plainus:audio', function () {
      self.atualizarSom();
    });
  },


  executar: function (acao, alvo) {
    switch (acao) {

      case 'dano':
      case 'cura': {
        const ficha = alvo.closest('[data-heroi]');
        const campo = ficha.querySelector('.campo-pv');
        /* Limpar a entrada aqui, e não confiar no min/max do HTML: o
           atributo orienta o navegador, mas nada impede um valor
           esquisito de chegar. Quem calcula é quem tem de conferir. */
        const quantia = Math.max(1, Math.min(999, parseInt(campo.value, 10) || 5));
        this.quantiaPV[ficha.dataset.heroi] = quantia;
        this.mudarPV(ficha.dataset.heroi, acao === 'dano' ? -quantia : quantia);
        break;
      }

      case 'rolar':
        this.rolarDado(Number(alvo.dataset.faces));
        break;

      case 'modo':
        this.modoRolagem = alvo.dataset.modo;
        this.render();
        break;

      case 'rolagem-secreta': {
        const valor = Layout.dado(20);
        const marca = valor === 20 ? 'critico' : (valor === 1 ? 'falha' : null);
        this.registrarRolagem(
          { texto: 'Percepção secreta (DM)', formula: 'd20 — só você vê', total: valor, marca: marca },
          { modo: 'teste', faces: 20, valores: [valor], escolhido: 0, bonus: 0, total: valor,
            texto: 'Percepção secreta', formula: 'd20 — só você vê', marca: marca }
        );
        break;
      }

      /* Liga ou desliga a animação dos dados (dados3d.js) — escolha de
         quem olha, guardada neste navegador. */
      case 'alternar-animacao':
        Layout.recado(Dados3D.alternar() ? 'Animação dos dados ligada.' : 'Animação dos dados desligada.');
        this.render();
        break;

      case 'gerar-npc':
        Acoes.executar('guardarNpcSorteado', { npc: {
          nome: Layout.sortear(GERADOR.nomes) + ', ' + Layout.sortear(GERADOR.epitetos),
          traco: Layout.sortear(GERADOR.racas) + ' · ' + Layout.sortear(GERADOR.tracos),
          segredo: Layout.sortear(GERADOR.segredos)
        } });
        this.render();
        break;

      case 'condicao':
        this.condicaoAberta = (this.condicaoAberta === alvo.dataset.condicao) ? null : alvo.dataset.condicao;
        this.render();
        break;

      case 'rolar-saque': {
        const ouro = Layout.dado(6) * 10 + Layout.dado(20);
        const prata = Layout.dado(10) * 20;
        const itens = ['poção de cura', 'pergaminho de Identificação', 'adaga bem-feita', 'anel de sinete gasto', 'frasco de óleo alquímico', 'mapa rasgado'];
        Acoes.executar('guardarTesouro', { texto: ouro + ' PO · ' + prata + ' PP · ' + Layout.sortear(itens) });
        this.render();
        Layout.recado('Saque rolado: ' + Estado.tesouro);
        break;
      }

      case 'som':
        Layout.alternarSom();
        break;

      case 'expandir-mapa':
        Layout.recado('O mapa em tela cheia, com tokens que você arrasta, é a tela de Mapas & Cenas.');
        break;
    }
  },


  /* ---------- Ações ---------- */

  rolarDado: function (faces) {
    const rotulo = faces === 100 ? 'd%' : 'd' + faces;
    let total;
    let formula;

    let valores;

    /* Vantagem e desvantagem só fazem sentido no d20. */
    if (faces === 20 && this.modoRolagem !== 'normal') {
      const a = Layout.dado(20);
      const b = Layout.dado(20);
      total = this.modoRolagem === 'vantagem' ? Math.max(a, b) : Math.min(a, b);
      formula = rotulo + ' (' + a + ', ' + b + ') — ' + this.modoRolagem;
      valores = [a, b];
    } else {
      total = Layout.dado(faces);
      formula = rotulo;
      valores = [total];
    }

    const marca = faces === 20 && total === 20 ? 'critico' : (faces === 20 && total === 1 ? 'falha' : null);
    const texto = 'Rolagem livre — ' + rotulo;
    this.registrarRolagem(
      { texto: texto, formula: formula, total: total, marca: marca },
      /* O d20 cai em 3D; os outros, na bandeja rápida (dados3d.js). */
      faces === 20
        ? { modo: 'teste', faces: 20, valores: valores, escolhido: valores.indexOf(total), bonus: 0, total: total, texto: texto, formula: formula, marca: marca }
        : { modo: 'dano', faces: faces, valores: valores, total: total, texto: texto, formula: formula, marca: null }
    );
  },


  /* Grava e mostra: com a animação (dados3d.js) ou, desligada, com o
     recado de sempre. O resultado é gravado ANTES de ser mostrado. */
  registrarRolagem: function (rolagem, cena) {
    Acoes.executar('registrarRolagemMestre', { rolagem: rolagem });
    this.render();
    if (cena && Dados3D.mostrar(cena)) return;

    const extra = rolagem.marca === 'critico' ? ' — crítico!'
                : rolagem.marca === 'falha' ? ' — falha crítica.' : '';
    Layout.recado(rolagem.texto + ': ' + rolagem.total + extra, rolagem.marca === 'falha');
  },


  /* Mexer no PV aqui também mexe no combate, se o herói estiver nele —
     a regra está na ação mudarPVHeroi (acoes.js). */
  mudarPV: function (id, quanto) {
    const r = Acoes.executar('mudarPVHeroi', { id: id, delta: quanto });
    if (r.erro || !r.mudou) return;
    this.render();

    if (r.depois === 0) {
      Layout.recado(r.nome + ' caiu a 0 PV — testes de morte a partir do próximo turno.', true);
    } else {
      Layout.recado(r.nome + ': ' + r.antes + ' → ' + r.depois + ' PV.');
    }
  }
};


/* A moldura decide se esta pessoa pode ver a tela; só então montamos. */
Layout.iniciar(function () {
  Painel.iniciar();

  /* Outra aba mudou a campanha (ver 'plainus:externo' no layout.js). */
  Layout.redesenhar = function () { Painel.render(); };

  /* Pedido da busca ou dos avisos (ver Layout.aoPedir): rola até o
     cartão do herói e o faz brilhar um instante, para o olho achar. */
  Layout.aoPedir(function (tipo, id) {
    if (tipo !== 'heroi') return;

    /* Comparar um por um, e não montar '[data-heroi="' + id + '"]': o
       id veio do endereço, e colar texto de fora dentro de um seletor
       é o mesmo erro de colar texto de fora dentro de HTML. */
    const cartao = Array.prototype.find.call(
      document.querySelectorAll('[data-heroi]'),
      function (el) { return el.dataset.heroi === id; }
    );
    if (!cartao) return;

    cartao.scrollIntoView({ behavior: 'smooth', block: 'center' });
    cartao.classList.remove('destaque');
    void cartao.offsetWidth;          /* reinicia a animação se ela já tinha rodado */
    cartao.classList.add('destaque');
  });
});
