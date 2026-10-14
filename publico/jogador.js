/* ===================================================================
   jogador.js — o painel do jogador: a moldura e a ficha

   O que o jogador VÊ e o que ele pode FAZER não mora aqui: está no
   visao.js (visaoDoJogador, enviarMeuHeroi, enviarRolagem), que é o
   desenho do servidor. Esta tela só desenha o que a visão devolve e
   só grava pelas ações de lá — nunca lê nem escreve o Estado direto.

   As abas (ver ABAS):
     Ficha        a ficha (ver / criar / editar) — aqui; ataques e
                  recursos — jogador-uso.js
     Magias       só se o personagem conjura — jogador-uso.js
     Inventário   moedas, itens, carga, sintonia — jogador-inventario.js
     Mesa         a cena e a ordem de iniciativa — jogador-mesa.js
     Diário       resumos, segredos revelados, pessoas — jogador-mesa.js
     Anotações    o caderno do jogador — jogador-consulta.js
     Regras       magias, equipamento, condições — jogador-consulta.js
   E o rolador, na coluna lateral (jogador-mesa.js).


   QUEM É O JOGADOR
   A sessão guarda o jogadorId e a CHAVE que o servidor entregou na
   entrada. Quem o jogador é sai da chave, conferida no servidor — o
   jogadorId sozinho não abre nada (problema 2 do CLAUDE.md, resolvido
   no servidor/armazem.js).
   =================================================================== */

/* Limites de cada campo de texto da ficha. */
const LIMITES_FICHA = {
  nome: 40, raca: 40, classe: 40, classe2: 40, antecedente: 40, alinhamento: 30,
  deslocamento: 20, idiomas: 200, equipamento: 1000, talentos: 600,
  personalidade: 1000, historia: 2000
};

const DADOS_VIDA = [6, 8, 10, 12];


const Jogador = {

  sessao: null,
  visao: null,
  modo: 'ver',            /* 'ver' | 'editar' — sem personagem, é sempre 'criar' */
  aba: 'ficha',           /* ver ABAS abaixo — estado de VISTA, não vai para o Estado */
  /* Pede a animação de entrada no próximo render. Só a TROCA de aba
     (e a chegada à página) anima: o render também roda a cada rolagem,
     a cada mudança vinda de outra aba do navegador — se animasse
     sempre, a tela piscaria a cada dado. */
  entrando: true,
  rascunho: null,         /* { nome, ficha } enquanto o formulário está aberto */
  dadoTocado: {},         /* o jogador escolheu o dado à mão? então não sugerimos mais */


  iniciar: function () {
    const sessao = Sessao.ler();

    if (!sessao) {
      this.mostrarRestrito('Você ainda não entrou na mesa. Use o código que o Mestre te passou.');
      return;
    }
    if (sessao.papel === 'mestre') {
      this.mostrarRestrito('Você entrou nesta campanha como Mestre. O seu painel é o outro.', 'mestre.html', 'Ir para o painel do Mestre');
      return;
    }

    /* A chave da sessão tem de abrir a mesa no servidor (conexao.js).
       Enquanto a visão não chega, "Abrindo a mesa…"; se não abrir, o
       motivo — e o caminho de volta. */
    const self = this;
    this.sessao = sessao;
    Layout.mostrarCarregando();
    Conexao.abrir(sessao).then(function () {
      Layout.tirarCarregando();
      self.montarPainel();
    }, function (motivo) {
      Layout.tirarCarregando();
      self.mostrarRestrito(motivo);
    });
  },


  montarPainel: function () {
    const sessao = this.sessao;
    document.getElementById('app').hidden = false;

    /* Abriu com #aba=inventario no endereço (F5, link, voltar do
       navegador): começa nessa aba, e não na Ficha. */
    this.aba = this.abaDoEndereco() || 'ficha';

    /* O chat (chat.js) se liga antes: quando chega mensagem, ele
       atualiza a lista; a navegação só precisa refazer o contador. */
    Chat.ligar();
    const self = this;
    Chat.aoMudarLidas = function () {
      if (self.visao && self.visao.meuHeroi && self.modo !== 'editar') self.montarNav(self.abasVisiveis());
      if (self.visao) self.vigiarMesa(self.visao);
    };

    AvisoSaida.registrar(function () { return self.rascunhoMudou(); });

    Atalhos.aoReverTour = function () {
      if (!self.visao || !self.visao.meuHeroi || self.modo === 'editar') return;
      if (self.aba !== 'ficha') {
        self.aba = 'ficha';
        location.hash = 'aba=ficha';
        self.render();
      }
      self.iniciarTour();
    };

    this.render();
    this.ligar();
  },


  mostrarRestrito: function (texto, destino, rotulo) {
    const voltar = criar('a.botao.fantasma', rotulo || 'Ir para a entrada');
    voltar.href = destino || 'index.html';
    voltar.style.cssText = 'display:block;text-decoration:none;text-align:center';

    document.body.appendChild(criar('div.tela-restrita', criar('div.cartao', [
      criar('h1', 'Painel do jogador'),
      criar('p', texto),
      voltar
    ])));
  },


  /* ---------- Desenho ---------- */

  render: function () {
    /* A visão vem PRONTA do servidor (visao.js roda lá): o que ela não
       traz — PV dos monstros, segredos, notas — nem chegou a este navegador. */
    this.visao = Conexao.visao;
    this.vigiarMesa(this.visao);

    this.renderBarra();
    this.renderLateral();

    const area = document.getElementById('principal');
    area.textContent = '';

    const entrando = this.entrando;
    this.entrando = false;

    /* Criando ou editando a ficha, o formulário ocupa o espaço e a
       navegação some: sair dele no meio perderia o que foi digitado.
       O cabeçalho some junto — o formulário tem o título dele. */
    const formulario = !this.visao.meuHeroi || this.modo === 'editar';
    this.mostrarNav(!formulario);
    document.getElementById('cabecaAba').hidden = formulario;

    if (!this.visao.meuHeroi) {
      if (!this.rascunho) this.guardarRascunho(this.rascunhoNovo());
      this.montarFormulario(area, true);
      this.copiarRascunhoInicial();
      return;
    }
    if (this.modo === 'editar') {
      this.montarFormulario(area, false);
      this.copiarRascunhoInicial();
      return;
    }

    /* A aba de Magias some se o personagem não conjura; se ela estava
       aberta, volta para a Ficha. */
    const abas = this.abasVisiveis();
    if (!abas.some(function (a) { return a[0] === this.aba; }, this)) this.aba = 'ficha';

    this.montarNav(abas);
    this.montarCabeca(abas);
    const heroi = this.visao.meuHeroi;
    switch (this.aba) {
      case 'magias':     UsoFicha.montarAbaMagias(area, heroi); break;
      case 'inventario': InventarioJogador.montar(area, heroi); break;
      case 'mesa':       MesaJogador.montarMesa(area, this.visao); break;
      case 'chat':       Chat.montar(area); break;
      case 'diario':     MesaJogador.montarDiario(area, this.visao); break;
      case 'notas':      AnotacoesJogador.montar(area, heroi); break;
      case 'regras':     RegrasJogador.montar(area); break;
      default:           this.montarFicha(area, heroi);
    }

    if (this.aba === 'ficha') this.agendarTour();

    if (entrando) this.animarEntrada();
  },


  /* A entrada da aba: o cabeçalho e os cartões sobem 8px e acendem, em
     cascata (o CSS dá o atraso de cada um). A classe sai no fim, e não
     fica para sempre: transform num ancestral quebra o position:sticky
     dos filhos (o resumo da ficha) enquanto estiver aplicado.
     Quem pediu "reduzir movimento" no sistema não vê nada disso (CSS). */
  animarEntrada: function () {
    ['principal', 'cabecaAba', 'navJogador'].forEach(function (id) {
      const el = document.getElementById(id);
      el.classList.remove('entrando');
      void el.offsetWidth;   /* força o navegador a "esquecer" a animação anterior */
      el.classList.add('entrando');
    });
    clearTimeout(this.fimEntrada);
    this.fimEntrada = setTimeout(function () {
      ['principal', 'cabecaAba', 'navJogador'].forEach(function (id) {
        document.getElementById(id).classList.remove('entrando');
      });
    }, 700);
  },


  /* A visita guiada (tour.js), uma vez por navegador. Espera a animação
     de entrada da aba terminar, e confere de novo antes de começar:
     nesse meio-tempo a pessoa pode ter trocado de aba ou aberto a edição. */
  agendarTour: function () {
    const self = this;
    if (this.tourAgendado || Tour.aberto() || Tour.jaViu()) return;
    this.tourAgendado = true;
    setTimeout(function () {
      self.tourAgendado = false;
      if (self.aba === 'ficha' && self.modo !== 'editar' && self.visao.meuHeroi && !Tour.aberto() && !Tour.jaViu()) self.iniciarTour();
    }, 700);
  },

  /* Os passos: o essencial para quem nunca viu o painel. */
  iniciarTour: function () {
    const cartaoDe = function (seletor) {
      const el = document.querySelector(seletor);
      return el && el.closest('.cartao');
    };
    Tour.iniciar([
      { alvo: function () { return document.getElementById('navJogador'); },
        titulo: 'Suas abas',
        texto: 'Ficha, Inventário, Mesa, Chat… tudo do seu personagem mora aqui. Dica: as teclas 1 a 8 pulam entre elas.' },
      { alvo: function () { return cartaoDe('#principal button.pericia'); },
        titulo: 'Clique para rolar',
        texto: 'Perícias, atributos e salvaguardas são botões: um clique rola o d20 com o bônus já somado.' },
      { alvo: function () { return cartaoDe('#lateral .grade-dados-jogador'); },
        titulo: 'Os dados',
        texto: 'Dados livres, vantagem e desvantagem, e a CD do teste para saber na hora se passou. A animação pode ser desligada aqui.' },
      { alvo: function () { return document.querySelector('.nav-jogador [data-aba="mesa"]'); },
        titulo: 'A mesa',
        texto: 'A cena que o Mestre mostra e a ordem do combate. Quando chegar a sua vez, um sino toca e o título da aba avisa.' },
      { alvo: function () { return document.querySelector('.nav-jogador [data-aba="chat"]'); },
        titulo: 'O chat',
        texto: 'Converse com a equipe toda ou só com o Mestre.' },
      { alvo: function () { return document.getElementById('botaoAjuda'); },
        titulo: 'Ajuda',
        texto: 'Os atalhos do teclado ficam aqui — e este tour, se quiser rever.' }
    ]);
  },


  /* O que acontece na mesa e merece aviso, mesmo de longe: mensagens
     novas e a vez no combate vão para o título da aba (Layout.marcarTitulo),
     e a PASSAGEM para "é a minha vez" toca o sino (AvisoVez). Na primeira
     olhada (eraMinhaVez ainda indefinido) não toca: abrir a página no
     meio do próprio turno não é novidade. */
  vigiarMesa: function (visao) {
    const combate = visao.combate;
    const minha = !!(combate && combate.ativo && combate.combatentes.some(function (c) { return c.vez && c.meu; }));
    if (minha && this.eraMinhaVez === false) AvisoVez.tocar(visao.meuHeroi ? visao.meuHeroi.nome : '');
    this.eraMinhaVez = minha;

    const novas = this.aba === 'chat' ? 0 : Chat.naoLidas();
    Layout.marcarTitulo(novas, minha ? 'Sua vez!' : '');
  },


  /* As abas do jogador. A da Mesa avisa, de fora, que há combate — e
     acende quando é a vez dele, para ele não precisar ficar olhando. */
  /* [id, ícone, texto]. A ordem é a do uso numa sessão: o que é do
     personagem primeiro, depois a mesa, depois a consulta. */
  /* O quarto item é a linha do cabeçalho: para que serve a aba. */
  ABAS: [
    ['ficha', 'escudo', 'Ficha', 'Atributos, perícias e ataques. Clique num valor para rolar.'],
    ['magias', 'magia', 'Magias', 'Espaços, magias preparadas e concentração.'],
    ['inventario', 'mochila', 'Inventário', 'Moedas, carga e o que vai na mochila.'],
    ['mesa', 'mapa', 'Mesa', 'A cena que o Mestre mostra e a ordem do combate.'],
    ['chat', 'chat', 'Chat', 'Conversa com a equipe e com o Mestre.'],
    ['diario', 'diario', 'Diário', 'O que já aconteceu na campanha.'],
    ['notas', 'nota', 'Anotações', 'O que você quer lembrar da campanha.'],
    ['regras', 'compendio', 'Regras', 'Consulta rápida das regras do jogo.']
  ],

  /* "#aba=inventario" → 'inventario'. Só vale um id que existe em ABAS:
     o endereço é texto que qualquer um edita. (Magias num personagem
     que não conjura: o render() já devolve para a Ficha.) O "aba="
     na frente evita que o navegador role a página até um elemento
     que tenha o mesmo id. */
  abaDoEndereco: function () {
    const achado = /^#aba=([a-z]+)$/.exec(location.hash);
    if (!achado) return null;
    const id = achado[1];
    return this.ABAS.some(function (a) { return a[0] === id; }) ? id : null;
  },

  abasVisiveis: function () {
    const conjura = !!(this.visao.meuHeroi && this.visao.meuHeroi.ficha.atributoMagia);
    return this.ABAS.filter(function (a) { return a[0] !== 'magias' || conjura; });
  },

  /* A navegação da lateral esquerda — o mesmo desenho do códice do
     painel do Mestre (.codice-link), para os dois painéis falarem a
     mesma língua. A classe .sem-nav tira a coluna do grid quando o
     formulário está aberto: só esconder a <nav> deixaria a ficha
     espremida na coluna estreita que era dela. */
  mostrarNav: function (mostrar) {
    document.getElementById('navJogador').hidden = !mostrar;
    document.getElementById('corpoJogador').classList.toggle('sem-nav', !mostrar);
    document.querySelector('.colunas-jogador').classList.toggle('sem-nav', !mostrar);
  },

  /* O cabeçalho da área: o nome da aba aberta, para que ela serve e,
     à direita, as pílulas — o mesmo lugar e o mesmo desenho da fileira
     de abas do painel do Mestre, para os dois se alinharem. */
  montarCabeca: function (lista) {
    const self = this;
    const cabeca = document.getElementById('cabecaAba');
    const aba = lista.find(function (a) { return a[0] === self.aba; }) || lista[0];
    const meu = this.visao.meuHeroi;
    const combate = this.visao.combate;

    cabeca.textContent = '';
    cabeca.appendChild(criar('div.cabeca-aba-icone', Icone.svg(aba[1], 18)));
    cabeca.appendChild(criar('div.cabeca-aba-texto', [
      criar('h1', aba[2]),
      criar('p', aba[3])
    ]));

    const pilulas = criar('div.cabeca-aba-pilulas');
    if (combate && combate.ativo) pilulas.appendChild(criar('span.pilula.perigo', 'Em combate'));
    pilulas.appendChild(criar('span.pilula', 'Sessão ' + this.visao.campanha.sessao));
    pilulas.appendChild(criar('span.pilula.azul', 'Nível ' + (meu.nivel || 1)));
    cabeca.appendChild(pilulas);
  },

  montarNav: function (lista) {
    const self = this;
    const nav = document.getElementById('navJogador');
    const meu = this.visao.meuHeroi;
    const combate = this.visao.combate;
    const minhaVez = !!(combate && combate.ativo && combate.combatentes.some(function (c) { return c.vez && c.meu; }));

    nav.textContent = '';

    /* Quem é: o personagem no topo da navegação, sempre à vista. */
    nav.appendChild(criar('div.nav-personagem', [
      criarRetrato('div.retrato-heroi', meu.ficha.foto, meu.nome),
      criar('div', [
        criar('div.nome', meu.nome),
        criar('div.sub', meu.pv + ' / ' + meu.pvMax + ' PV · CA ' + meu.ca)
      ])
    ]));
    nav.appendChild(criar('div.codice-titulo', 'Seu painel'));

    lista.forEach(function (trio) {
      const ativa = self.aba === trio[0];
      const botao = criar('button.codice-link' + (ativa ? '.ativo' : ''));
      botao.type = 'button';
      botao.dataset.acao = 'aba';
      botao.dataset.aba = trio[0];
      /* aria-current diz ao leitor de tela "é aqui que você está". */
      if (ativa) botao.setAttribute('aria-current', 'page');
      botao.appendChild(Icone.svg(trio[1], 17));
      botao.appendChild(criar('span', trio[2]));

      /* Mensagens novas no chat, enquanto ele não está aberto. */
      if (trio[0] === 'chat' && !ativa) {
        const novas = Chat.naoLidas();
        if (novas) botao.appendChild(criar('span.pilula.azul', String(novas)));
      }

      if (trio[0] === 'mesa' && minhaVez) botao.appendChild(criar('span.pilula.azul', 'Sua vez'));
      else if (trio[0] === 'mesa' && combate && combate.ativo) botao.appendChild(criar('span.pilula.perigo', 'Combate'));

      nav.appendChild(botao);
    });
  },


  renderBarra: function () {
    const barra = document.getElementById('barraJogador');
    barra.textContent = '';

    const emblema = criar('span.emblema');
    emblema.appendChild(Icone.svg('escudo', 19));

    barra.appendChild(marcaDoSite(emblema, 'Painel do jogador'));

    barra.appendChild(criar('div.campanha-jogador', [
      criar('span.titulo-sessao', this.visao.campanha.nome),
      criar('span.sub', 'Sessão ' + this.visao.campanha.sessao + ' · Mestre: ' + this.visao.mestre)
    ]));

    barra.appendChild(criar('div.espaco'));

    /* Atalhos e ajuda (atalhos.js) — e, de lá, o "Rever o tour". */
    barra.appendChild(Conexao.indicador());
    barra.appendChild(Atalhos.botao());

    const sair = criar('button.icone-botao');
    sair.type = 'button';
    sair.dataset.acao = 'sair';
    sair.title = 'Sair da mesa';
    sair.setAttribute('aria-label', 'Sair da mesa');
    sair.appendChild(Icone.svg('sair', 16));
    barra.appendChild(sair);

    barra.appendChild(criar('div.perfil', [
      criar('div.quem', [
        criar('div.nome', this.sessao.nome || 'Jogador'),
        criar('div.cargo', 'Jogador')
      ]),
      criar('div.retrato', (this.sessao.nome || 'J').charAt(0).toUpperCase())
    ]));
  },


  /* A coluna da direita: o que a campanha É (público) e quem mais
     está na mesa. Enquanto o jogador cria a ficha, as regras de
     criação também ficam à vista. */
  renderLateral: function () {
    const v = this.visao;
    const area = document.getElementById('lateral');
    area.textContent = '';

    const itens = [
      ['Do que se trata', v.campanha.premissa],
      ['Onde se passa', v.campanha.cenario],
      ['Tom', v.campanha.tom],
      ['Linhas — nunca entra', v.campanha.linhas],
      ['Véus — fora de cena', v.campanha.veus],
      ['Regras da casa', v.campanha.regra]
    ].filter(function (par) { return par[1]; });

    const sobre = criar('div.cartao', [criarComIcone('h2', 'campanha', 'A campanha', 16)]);
    const grade = criar('dl.lista-sobre');
    itens.forEach(function (par) {
      grade.appendChild(criar('div', [criar('dt', par[0]), criar('dd', par[1])]));
    });
    sobre.appendChild(itens.length ? grade : criar('p.dica', 'O Mestre ainda não descreveu a campanha.'));
    area.appendChild(sobre);

    if (!v.meuHeroi || this.modo === 'editar') {
      const regras = criar('div.cartao', [criarComIcone('h2', 'compendio', 'Regras de criação', 16)]);
      regras.appendChild(criar('dl.lista-sobre', [
        criar('div', [criar('dt', 'Atributos'), criar('dd', METODOS_ATRIBUTOS[v.regras.atributos])]),
        criar('div', [criar('dt', 'Pontos de vida'), criar('dd', METODOS_PV[v.regras.pv])]),
        criar('div', [criar('dt', 'Talentos'), criar('dd', v.regras.talentos ? 'Permitidos' : 'Não permitidos')]),
        criar('div', [criar('dt', 'Multiclasse'), criar('dd', v.regras.multiclasse ? 'Permitida' : 'Não permitida')]),
        criar('div', [criar('dt', 'Nível inicial'), criar('dd', String(v.campanha.nivelInicial || 1))])
      ]));
      area.appendChild(regras);
    }

    /* O rolador vem antes da party: na sessão, é o que mais se usa. */
    if (v.meuHeroi && this.modo !== 'editar') RoladorJogador.montar(area, v);

    const party = criar('div.cartao', [criarComIcone('h2', 'npcs', v.grupo || 'A party', 16)]);
    if (!v.party.length) {
      party.appendChild(criar('p.dica', 'Ninguém mais criou personagem ainda.'));
    } else {
      v.party.forEach(function (h) {
        /* A vida dos aliados é pública na mesa: é o que decide quem
           precisa de cura. A barra usa as mesmas faixas do Mestre. */
        const proporcao = h.pvMax ? Math.max(0, h.pv / h.pvMax) : 0;
        const faixa = proporcao > .6 ? '' : (proporcao > .3 ? '.media' : '.baixa');
        const preenchimento = criar('div.preenchimento' + faixa);
        preenchimento.style.width = (proporcao * 100) + '%';

        party.appendChild(criar('div.companheiro' + (h.pv <= 0 ? '.caido' : ''), [
          criarRetrato('span.inicial-npc', h.foto, h.nome),
          criar('div.companheiro-corpo', [
            criar('div.nome', h.nome),
            criar('div.sub', [h.classe, 'Nível ' + h.nivel, h.jogador].filter(Boolean).join(' · ')),
            criar('div.vida-jogador', [
              criar('span.numeros', h.pv <= 0 ? 'Caído — 0 PV' : h.pv + ' / ' + h.pvMax + ' PV'),
              criar('div.barra', preenchimento)
            ]),
            h.condicoes.length
              ? criar('div.condicoes-jogador', h.condicoes.map(function (c) { return MesaJogador.chip(c); }))
              : null
          ])
        ]));
      });
    }
    area.appendChild(party);
  },


  /* ===================================================================
     A FICHA, EM LEITURA
     =================================================================== */

  montarFicha: function (area, heroi) {
    const f = heroi.ficha;
    const regras = this.visao.regras;

    const subtitulo = [f.raca, heroi.classe.replace(/\s*\(.*\)$/, '') + ' — nível ' + heroi.nivel, f.antecedente, f.alinhamento]
      .filter(Boolean).join(' · ');

    area.appendChild(criar('div.cabeca-ficha', [
      /* O retrato é um botão: clicar nele troca a foto. */
      (function () {
        const botao = criarRetrato('button.retrato-heroi.retrato-grande', f.foto, heroi.nome);
        botao.type = 'button';
        botao.dataset.acao = 'foto-escolher';
        botao.title = f.foto ? 'Trocar a foto' : 'Pôr uma foto';
        botao.setAttribute('aria-label', f.foto ? 'Trocar a foto do personagem' : 'Pôr uma foto do personagem');
        return botao;
      })(),
      criar('div', [
        /* h2: o título da página é o da aba ("Ficha", no cabeçalho); o
           nome do personagem é o título da SEÇÃO. Dois h1 numa tela
           confundem quem navega por títulos (leitor de tela). */
        criar('h2.nome-ficha', heroi.nome),
        criar('div.sub', subtitulo),
        criar('div.botoes-foto', [
          criarBotao('mini-botao', 'foto-escolher', 'imagem', f.foto ? 'Trocar foto' : 'Pôr foto'),
          f.foto ? criarBotao('mini-botao.perigo-leve', 'foto-tirar', 'remover', 'Tirar foto') : null
        ])
      ]),
      criarBotao('botao.fantasma.pequeno', 'editar', 'editar', 'Editar ficha')
    ]));

    /* A faixa de números que se consulta a sessão inteira. A
       iniciativa é um botão: clicar rola d20 + o bônus. */
    const iniciativa = this.botaoTeste('button.numero-ficha', 'Iniciativa', Ficha.iniciativa(f), [
      criar('div.rotulo', 'Iniciativa'),
      criar('div.valor', comSinal(Ficha.iniciativa(f)))
    ]);
    area.appendChild(criar('div.faixa-ficha', [
      this.numero('CA', Ficha.ca(f)),
      this.numero('PV', heroi.pv + ' / ' + heroi.pvMax),
      iniciativa,
      this.numero('Deslocamento', f.deslocamento || '9 m'),
      this.numero('Proficiência', comSinal(Ficha.proficiencia(f))),
      this.numero('Percepção passiva', Ficha.percepcaoPassiva(f))
    ]));

    /* Atributos. Cada caixa tem DOIS botões: o de cima rola o teste do
       atributo, o de baixo a salvaguarda. Botão dentro de botão não
       existe em HTML — por isso a caixa é uma <div> com dois botões
       irmãos, e não um botão grande. */
    const self = this;
    const atributos = criar('div.atributos-ficha');
    ATRIBUTOS_FICHA.forEach(function (par) {
      const treinada = (f.salvaguardas || []).indexOf(par[0]) !== -1;
      atributos.appendChild(criar('div.atributo-ficha', [
        self.botaoTeste('button.teste-atributo', 'Teste de ' + par[1], Ficha.mod(f, par[0]), [
          criar('div.sigla', par[1]),
          criar('div.valor', String(Ficha.valor(f, par[0]))),
          criar('div.mod', comSinal(Ficha.mod(f, par[0])))
        ]),
        self.botaoTeste('button.salva' + (treinada ? '.treinada' : ''), 'Salvaguarda de ' + par[1],
          Ficha.salvaguarda(f, par[0]), 'Salv. ' + comSinal(Ficha.salvaguarda(f, par[0])))
      ]));
    });
    area.appendChild(atributos);

    /* Ataques, magias, recursos e descansos (jogador-uso.js). */
    UsoFicha.montar(area, heroi);

    /* Perícias: a bolinha cheia é "treinado". Cada linha rola. */
    const pericias = criar('div.pericias-ficha');
    PERICIAS.forEach(function (par) {
      const treinada = (f.pericias || []).indexOf(par[0]) !== -1;
      pericias.appendChild(self.botaoTeste('button.pericia' + (treinada ? '.treinada' : ''), par[0], Ficha.pericia(f, par[0]), [
        criar('span.marca'),
        criar('span.nome', par[0]),
        criar('span.atrib', par[1].toUpperCase()),
        criar('span.bonus', comSinal(Ficha.pericia(f, par[0])))
      ]));
    });
    area.appendChild(criar('div.cartao', [
      criarComIcone('h2', 'ajustes', 'Perícias', 16),
      criar('p.dica', 'Clique para rolar o teste. Vantagem e desvantagem: no cartão Dados, ao lado.'),
      pericias
    ]));

    /* Defesa e o resto, só o que foi preenchido. */
    const defesa = [f.armadura || 'Sem armadura', f.escudo ? 'escudo' : '', Number(f.caExtra) ? 'outros ' + comSinal(Number(f.caExtra)) : '']
      .filter(Boolean).join(' + ');
    const textos = [
      ['Defesa', defesa],
      ['Dado de vida', 'd' + f.dadoVida + (f.classe2 ? ' / d' + f.dadoVida2 : '') + ' · ' + METODOS_PV[regras.pv]],
      ['Idiomas', f.idiomas],
      ['Equipamento', f.equipamento],
      ['Talentos', f.talentos],
      ['Personalidade', f.personalidade],
      ['História e aparência', f.historia]
    ].filter(function (par) { return par[1]; });

    const resto = criar('dl.lista-sobre');
    textos.forEach(function (par) {
      resto.appendChild(criar('div', [criar('dt', par[0]), criar('dd', par[1])]));
    });
    area.appendChild(criar('div.cartao', [criarComIcone('h2', 'diario', 'Mais da ficha', 16), resto]));
  },

  numero: function (rotulo, valor) {
    return criar('div.numero-ficha', [criar('div.rotulo', rotulo), criar('div.valor', String(valor))]);
  },

  /* Um pedaço da ficha que rola ao ser clicado. O bônus vai no
     data-bonus, calculado agora pelo ficha.js — e a ficha é redesenhada
     a cada mudança, então o número nunca fica velho. */
  botaoTeste: function (seletor, texto, bonus, conteudo) {
    const botao = criar(seletor, conteudo);
    botao.type = 'button';
    botao.dataset.acao = 'rolar-teste';
    botao.dataset.texto = texto;
    botao.dataset.bonus = bonus;
    botao.title = 'Rolar ' + texto + ' (d20 ' + comSinal(bonus) + ')';
    return botao;
  },


  /* ===================================================================
     O FORMULÁRIO (criar ou editar)

     Ao contrário das outras telas, o formulário NÃO se redesenha a
     cada tecla: isso tiraria o foco do campo em que se digita. Cada
     mudança só relê os campos (lerFormulario) e atualiza os números
     calculados no lugar (atualizarCalculos) — os spans com data-calc.
     =================================================================== */

  rascunhoNovo: function () {
    const base = {};
    const bonus = {};
    const metodo = this.visao.regras.atributos;
    ATRIBUTOS_FICHA.forEach(function (par) {
      base[par[0]] = metodo === 'compra' ? 8 : 10;
      bonus[par[0]] = 0;
    });

    return {
      id: 'h' + Date.now(),
      nome: '',
      ficha: {
        raca: '', classe: '', nivel: this.visao.campanha.nivelInicial || 1, dadoVida: 8,
        classe2: '', nivel2: 1, dadoVida2: 8,
        antecedente: '', alinhamento: '',
        metodo: metodo, base: base, bonus: bonus, rolados: null,
        salvaguardas: [], pericias: [],
        armadura: '', escudo: false, caExtra: 0, deslocamento: '9 m',
        pvRolado: null,
        idiomas: 'Comum', equipamento: '', talentos: '', personalidade: '', historia: '',
        /* ataques, magia e recursos (jogador-uso.js) */
        ataques: [], atributoMagia: '', espacos: {}, espacosGastos: {}, magias: [], concentrando: '', recursos: []
      }
    };
  },


  montarFormulario: function (area, criando) {
    const self = this;
    const r = this.rascunho;
    const f = r.ficha;
    const regras = this.visao.regras;

    area.appendChild(criar('div.cabeca-ficha', [
      criar('div', [
        criar('h1.nome-ficha', criando ? 'Criar personagem' : 'Editar ficha'),
        criar('div.sub', criando
          ? 'Escreva o que estaria na ficha de papel. As contas ficam com o site — o resumo ao lado se atualiza enquanto você digita.'
          : 'Subiu de nível, trocou de armadura, aprendeu uma perícia? Ajuste aqui.')
      ])
    ]));

    const form = criar('form.formulario.form-ficha');
    form.id = 'formFicha';
    form.noValidate = true;

    /* --- Quem é --- */
    const quem = criar('fieldset.secao-ficha', [criar('legend', 'Quem é')]);
    quem.appendChild(this.campo('nome', 'Nome do personagem', r.nome, 'Kaelen Valerius'));
    quem.appendChild(criar('div.dupla-form', [
      this.campo('raca', 'Raça', f.raca, 'Humano, elfa, anão…'),
      this.campo('classe', 'Classe', f.classe, 'Guerreiro, maga, clériga…')
    ]));
    quem.appendChild(criar('div.dupla-form', [
      this.campoNumero('nivel', 'Nível', f.nivel, 1, 20),
      this.campoDado('dadoVida', 'Dado de vida', f.dadoVida)
    ]));

    /* A segunda classe só aparece se a campanha deixa — ou se a ficha
       já tinha uma (o Mestre mudou a regra depois). */
    if (regras.multiclasse || f.classe2) {
      quem.appendChild(criar('div.trio-form', [
        this.campo('classe2', 'Segunda classe (opcional)', f.classe2, 'Ladino'),
        this.campoNumero('nivel2', 'Nível', f.nivel2, 1, 19),
        this.campoDado('dadoVida2', 'Dado', f.dadoVida2)
      ]));
    }

    quem.appendChild(criar('div.dupla-form', [
      this.campo('antecedente', 'Antecedente', f.antecedente, 'Soldado, sábio, criminoso…'),
      this.campo('alinhamento', 'Alinhamento', f.alinhamento, 'Neutro e bom')
    ]));
    form.appendChild(quem);

    /* --- Atributos --- */
    const atrib = criar('fieldset.secao-ficha', [criar('legend', 'Atributos')]);
    const metodo = criando ? regras.atributos : 'livre';

    atrib.appendChild(criar('p.ajuda-campo', criando
      ? METODOS_ATRIBUTOS[metodo] + '. "Base" é o valor do método; "bônus" é o que a raça e o antecedente somam.'
      : 'Na edição os valores são livres: aumentos de atributo e talentos mudam o que foi comprado na criação.'));

    if (metodo === 'compra') {
      atrib.appendChild(criar('div.contador-pontos', [criar('span', 'Pontos gastos: '), criar('strong', '')]));
    }
    if (metodo === 'rolagem') {
      const rolar = criarBotao('mini-botao', 'rolar-atributos', 'dados', f.rolados ? 'Já rolado' : 'Rolar 4d6 seis vezes');
      rolar.disabled = !!f.rolados;
      atrib.appendChild(criar('div.linha-botoes', [rolar, criar('span.rolados', f.rolados ? 'Rolou: ' + f.rolados.join(', ') : '')]));
    }

    const tabela = criar('div.tabela-atributos', [
      criar('span.cabeca', ''), criar('span.cabeca', 'Base'), criar('span.cabeca', 'Bônus'),
      criar('span.cabeca', 'Total'), criar('span.cabeca', 'Mod.'), criar('span.cabeca', 'Salv.')
    ]);
    ATRIBUTOS_FICHA.forEach(function (par) {
      const chave = par[0];
      const salva = document.createElement('input');
      salva.type = 'checkbox';
      salva.dataset.salva = chave;
      salva.checked = f.salvaguardas.indexOf(chave) !== -1;
      salva.setAttribute('aria-label', 'Salvaguarda de ' + par[1] + ' treinada');

      tabela.appendChild(criar('span.nome-atrib', par[1]));
      tabela.appendChild(self.entradaNumero('base', chave, f.base[chave], 1, 20, 'Base de ' + par[1]));
      tabela.appendChild(self.entradaNumero('bonus', chave, f.bonus[chave], -5, 5, 'Bônus de ' + par[1]));
      tabela.appendChild(self.calc('total-' + chave));
      tabela.appendChild(self.calc('mod-' + chave));
      tabela.appendChild(criar('label.salva-form', [salva, self.calc('salva-' + chave)]));
    });
    atrib.appendChild(tabela);
    form.appendChild(atrib);

    /* --- Perícias --- */
    const per = criar('fieldset.secao-ficha', [criar('legend', 'Perícias treinadas')]);
    const lista = criar('div.pericias-form');
    PERICIAS.forEach(function (par) {
      const marca = document.createElement('input');
      marca.type = 'checkbox';
      marca.dataset.pericia = par[0];
      marca.checked = f.pericias.indexOf(par[0]) !== -1;
      lista.appendChild(criar('label.pericia-form', [
        marca,
        criar('span.nome', par[0]),
        criar('span.atrib', par[1].toUpperCase()),
        self.calc('pericia-' + par[0])
      ]));
    });
    per.appendChild(lista);
    form.appendChild(per);

    /* --- Defesa e vida --- */
    const def = criar('fieldset.secao-ficha', [criar('legend', 'Defesa e vida')]);
    const opcoesArmadura = [['', 'Sem armadura']].concat(ARMADURAS
      .filter(function (a) { return a.categoria === 'Armadura'; })
      .map(function (a) { return [a.nome, a.nome + ' (CA ' + a.ca + ')']; }));
    def.appendChild(criar('div.dupla-form', [
      this.campoSelecao('armadura', 'Armadura', f.armadura, opcoesArmadura),
      this.campoNumero('caExtra', 'Outros bônus de CA', f.caExtra, -5, 10)
    ]));

    const escudo = document.createElement('input');
    escudo.type = 'checkbox';
    escudo.dataset.f = 'escudo';
    escudo.checked = !!f.escudo;
    def.appendChild(criar('label.marcar-opcao', [escudo, document.createTextNode('Usa escudo (+2 na CA)')]));

    def.appendChild(this.campo('deslocamento', 'Deslocamento', f.deslocamento, '9 m'));

    if (regras.pv === 'rolado') {
      const pv = this.campoNumero('pvRolado', 'PV máximo (rolado)', f.pvRolado || '', 1, 999);
      pv.appendChild(criar('div.linha-botoes', [
        criarBotao('mini-botao', 'rolar-pv', 'dados', 'Rolar os níveis'),
        /* criar() só aceita ELEMENTOS numa lista de filhos — texto
           solto tem de virar um nó de texto. */
        criar('span.ajuda', [document.createTextNode('Pela média seria '), self.calc('pv-medio')])
      ]));
      def.appendChild(pv);
    }
    form.appendChild(def);

    /* --- Ataques, magia e recursos (jogador-uso.js) --- */
    UsoFicha.montarForm(form, f);

    /* --- O resto --- */
    const mais = criar('fieldset.secao-ficha', [criar('legend', 'O resto da ficha')]);
    mais.appendChild(this.campo('idiomas', 'Idiomas', f.idiomas, 'Comum, Élfico'));
    mais.appendChild(this.campoArea('equipamento', 'Equipamento', f.equipamento, 'Espada longa, escudo, mochila de aventureiro, 10 PO…'));
    if (regras.talentos || f.talentos) {
      mais.appendChild(this.campoArea('talentos', 'Talentos', f.talentos, 'Sentinela: ...'));
    }
    mais.appendChild(this.campoArea('personalidade', 'Personalidade, ideais, vínculos, defeitos', f.personalidade, ''));
    mais.appendChild(this.campoArea('historia', 'História e aparência', f.historia, ''));
    form.appendChild(mais);

    /* --- Botões --- */
    const botoes = [criarBotao('botao.pequeno', 'salvar-ficha', 'check', criando ? 'Criar personagem' : 'Salvar ficha')];
    if (!criando) botoes.push(criarBotao('botao.fantasma.pequeno', 'cancelar', null, 'Cancelar'));
    form.appendChild(criar('div.acoes-detalhe', botoes));

    /* O resumo calculado, que acompanha a digitação. */
    const resumo = criar('div.resumo-ficha', [
      criar('div.titulo-grupo', 'Como está ficando'),
      criar('div.faixa-ficha.compacta', [
        criar('div.numero-ficha', [criar('div.rotulo', 'CA'), this.calc('ca', 'div.valor')]),
        criar('div.numero-ficha', [criar('div.rotulo', 'PV máx.'), this.calc('pv', 'div.valor')]),
        criar('div.numero-ficha', [criar('div.rotulo', 'Iniciativa'), this.calc('iniciativa', 'div.valor')]),
        criar('div.numero-ficha', [criar('div.rotulo', 'Proficiência'), this.calc('prof', 'div.valor')]),
        criar('div.numero-ficha', [criar('div.rotulo', 'Perc. passiva'), this.calc('pp', 'div.valor')])
      ])
    ]);

    area.appendChild(resumo);
    area.appendChild(form);
    this.atualizarCalculos();
  },


  /* ---------- Peças do formulário ---------- */

  calc: function (nome, seletor) {
    const elemento = criar(seletor || 'span.calc');
    elemento.dataset.calc = nome;
    return elemento;
  },

  campo: function (chave, rotulo, valor, dica) {
    const entrada = document.createElement('input');
    entrada.type = 'text';
    entrada.value = valor || '';
    entrada.placeholder = dica || '';
    entrada.maxLength = LIMITES_FICHA[chave] || 60;
    entrada.dataset.f = chave;
    entrada.id = 'f-' + chave;
    return this.rotular(entrada, rotulo);
  },

  campoArea: function (chave, rotulo, valor, dica) {
    const entrada = document.createElement('textarea');
    entrada.value = valor || '';
    entrada.placeholder = dica || '';
    entrada.maxLength = LIMITES_FICHA[chave];
    entrada.dataset.f = chave;
    entrada.id = 'f-' + chave;
    return this.rotular(entrada, rotulo);
  },

  campoNumero: function (chave, rotulo, valor, min, max) {
    const entrada = document.createElement('input');
    entrada.type = 'number';
    entrada.min = min;
    entrada.max = max;
    entrada.value = valor;
    entrada.dataset.f = chave;
    entrada.id = 'f-' + chave;
    return this.rotular(entrada, rotulo);
  },

  campoDado: function (chave, rotulo, valor) {
    return this.campoSelecao(chave, rotulo, String(valor), DADOS_VIDA.map(function (d) { return [String(d), 'd' + d]; }));
  },

  campoSelecao: function (chave, rotulo, valor, opcoes) {
    const entrada = document.createElement('select');
    entrada.dataset.f = chave;
    entrada.id = 'f-' + chave;
    opcoes.forEach(function (par) {
      const opcao = document.createElement('option');
      opcao.value = par[0];
      opcao.textContent = par[1];
      entrada.appendChild(opcao);
    });
    entrada.value = valor || '';
    return this.rotular(entrada, rotulo);
  },

  rotular: function (entrada, rotulo) {
    const etiqueta = document.createElement('label');
    etiqueta.textContent = rotulo;
    etiqueta.htmlFor = entrada.id;
    return criar('div.campo-form', [etiqueta, entrada]);
  },

  entradaNumero: function (tipo, chave, valor, min, max, rotulo) {
    const entrada = document.createElement('input');
    entrada.type = 'number';
    entrada.min = min;
    entrada.max = max;
    entrada.value = valor;
    entrada.dataset[tipo] = chave;
    entrada.setAttribute('aria-label', rotulo);
    return entrada;
  },


  /* ---------- Ler e calcular ---------- */

  /* Copia os campos para o rascunho. Números ficam como vieram (texto
     do campo, convertido) — quem confere é validar(). */
  lerFormulario: function () {
    const r = this.rascunho;
    const f = r.ficha;
    const form = document.getElementById('formFicha');
    if (!form) return;

    form.querySelectorAll('[data-f]').forEach(function (campo) {
      const chave = campo.dataset.f;
      const valor = campo.type === 'checkbox' ? campo.checked : campo.value.trim();
      if (chave === 'nome') r.nome = valor;
      else f[chave] = valor;
    });
    form.querySelectorAll('[data-base]').forEach(function (campo) { f.base[campo.dataset.base] = campo.value; });
    form.querySelectorAll('[data-bonus]').forEach(function (campo) { f.bonus[campo.dataset.bonus] = campo.value; });

    f.salvaguardas = Array.prototype.filter.call(form.querySelectorAll('[data-salva]'), function (c) { return c.checked; })
      .map(function (c) { return c.dataset.salva; });
    f.pericias = Array.prototype.filter.call(form.querySelectorAll('[data-pericia]'), function (c) { return c.checked; })
      .map(function (c) { return c.dataset.pericia; });

    UsoFicha.lerForm(form, f);
  },

  /* Reescreve todos os números com data-calc a partir do rascunho. */
  atualizarCalculos: function () {
    const f = this.rascunho.ficha;
    const regras = this.visao.regras;

    function poe(nome, texto) {
      const alvo = document.querySelector('[data-calc="' + nome + '"]');
      if (alvo) alvo.textContent = texto;
    }

    ATRIBUTOS_FICHA.forEach(function (par) {
      poe('total-' + par[0], String(Ficha.valor(f, par[0])));
      poe('mod-' + par[0], comSinal(Ficha.mod(f, par[0])));
      poe('salva-' + par[0], comSinal(Ficha.salvaguarda(f, par[0])));
    });
    PERICIAS.forEach(function (par) { poe('pericia-' + par[0], comSinal(Ficha.pericia(f, par[0]))); });

    poe('ca', String(Ficha.ca(f)));
    poe('pv', String(Ficha.pvMaximo(f, regras)));
    poe('pv-medio', String(Ficha.pvMedio(f)));
    poe('iniciativa', comSinal(Ficha.iniciativa(f)));
    poe('prof', comSinal(Ficha.proficiencia(f)));
    poe('pp', String(Ficha.percepcaoPassiva(f)));
    UsoFicha.atualizar(f);

    /* O contador da compra de pontos fica vermelho ao passar de 27. */
    const contador = document.querySelector('.contador-pontos strong');
    if (contador) {
      const gastos = Ficha.pontosGastos(f.base);
      contador.textContent = gastos + ' de ' + PONTOS_COMPRA;
      contador.parentNode.classList.toggle('estourou', gastos > PONTOS_COMPRA);
    }
  },

  /* Escreveu a classe e ainda não escolheu o dado à mão: sugere. */
  sugerirDado: function (campoClasse) {
    const qual = campoClasse === 'classe' ? 'dadoVida' : 'dadoVida2';
    if (this.dadoTocado[qual]) return;

    const dado = Ficha.dadoSugerido(document.getElementById('f-' + campoClasse).value);
    const escolha = document.getElementById('f-' + qual);
    if (dado && escolha) escolha.value = String(dado);
  },


  /* ---------- Conferir e salvar ---------- */

  /* Devolve o personagem pronto para enviar, ou null (com o recado
     dado e o foco no campo). Converte os números de texto para número
     só aqui, depois de conferir. */
  validar: function (criando) {
    const r = this.rascunho;
    const f = r.ficha;
    const regras = this.visao.regras;

    function falha(texto, id) {
      Layout.recado(texto, true);
      const campo = id && document.getElementById(id);
      if (campo) campo.focus();
      return null;
    }
    function inteiro(valor, min, max) {
      const n = Number(valor);
      return Number.isInteger(n) && n >= min && n <= max ? n : null;
    }

    if (!r.nome) return falha('Dê um nome ao personagem.', 'f-nome');
    if (!f.raca) return falha('Diga a raça do personagem.', 'f-raca');
    if (!f.classe) return falha('Diga a classe do personagem.', 'f-classe');

    for (const chave in LIMITES_FICHA) {
      const valor = chave === 'nome' ? r.nome : f[chave];
      if (typeof valor === 'string' && valor.length > LIMITES_FICHA[chave]) {
        return falha('Texto longo demais em "' + chave + '" (até ' + LIMITES_FICHA[chave] + ').', 'f-' + chave);
      }
    }

    const nivel = inteiro(f.nivel, 1, 20);
    if (nivel === null) return falha('Nível: um número inteiro de 1 a 20.', 'f-nivel');
    const dado = inteiro(f.dadoVida, 6, 12);
    if (DADOS_VIDA.indexOf(dado) === -1) return falha('Escolha um dado de vida da lista.', 'f-dadoVida');

    let nivel2 = 0;
    let dado2 = 8;
    if (f.classe2) {
      if (!regras.multiclasse && criando) return falha('Esta campanha não permite multiclasse.', 'f-classe2');
      nivel2 = inteiro(f.nivel2, 1, 19);
      if (nivel2 === null) return falha('Nível da segunda classe: de 1 a 19.', 'f-nivel2');
      if (nivel + nivel2 > 20) return falha('Somando as duas classes, o nível passa de 20.', 'f-nivel2');
      dado2 = inteiro(f.dadoVida2, 6, 12);
      if (DADOS_VIDA.indexOf(dado2) === -1) return falha('Escolha o dado de vida da segunda classe.', 'f-dadoVida2');
    }

    const base = {};
    const bonus = {};
    for (const par of ATRIBUTOS_FICHA) {
      base[par[0]] = inteiro(f.base[par[0]], 1, 20);
      bonus[par[0]] = inteiro(f.bonus[par[0]], -5, 5);
      if (base[par[0]] === null) return falha(par[1] + ': a base vai de 1 a 20.');
      if (bonus[par[0]] === null) return falha(par[1] + ': o bônus vai de −5 a +5.');
      const total = base[par[0]] + bonus[par[0]];
      if (total < 1 || total > (criando ? 20 : 30)) {
        return falha(par[1] + ': o total fica em ' + total + '. ' + (criando ? 'Na criação, o máximo é 20.' : 'O máximo é 30.'));
      }
    }

    const caExtra = inteiro(f.caExtra === '' ? 0 : f.caExtra, -5, 10);
    if (caExtra === null) return falha('Outros bônus de CA: de −5 a +10.', 'f-caExtra');
    if (f.armadura && !ARMADURAS.some(function (a) { return a.nome === f.armadura; })) {
      return falha('Escolha uma armadura da lista.', 'f-armadura');
    }

    let pvRolado = null;
    if (regras.pv === 'rolado') {
      pvRolado = inteiro(f.pvRolado, 1, 999);
      if (pvRolado === null) return falha('Role ou escreva o PV máximo.', 'f-pvRolado');
    }

    /* Ataques, magia e recursos: conferidos e convertidos lá. */
    const uso = UsoFicha.validar(f);
    if (uso.erro) return falha(uso.erro);

    const ficha = Object.assign({}, f, uso.limpo, {
      nivel: nivel, dadoVida: dado,
      classe2: f.classe2 || '', nivel2: f.classe2 ? nivel2 : 0, dadoVida2: f.classe2 ? dado2 : 8,
      base: base, bonus: bonus,
      caExtra: caExtra, escudo: !!f.escudo, pvRolado: pvRolado,
      talentos: regras.talentos || f.talentos ? f.talentos : ''
    });

    /* O método só é conferido na criação — ver Ficha.conferirMetodo. */
    if (criando) {
      const problema = Ficha.conferirMetodo(ficha, regras.atributos);
      if (problema) return falha(problema);
    }

    return Object.assign(
      { id: r.id, dono: this.sessao.jogadorId, jogador: this.sessao.nome, nome: r.nome, ficha: ficha },
      Ficha.resumoDoHeroi(ficha, regras, this.sessao.nome)
    );
  },


  salvar: function () {
    const criando = !this.visao.meuHeroi;
    this.lerFormulario();
    const heroi = this.validar(criando);
    if (!heroi) return;

    const mantinha = !criando && this.visao.meuHeroi.ficha.concentrando;

    const problema = enviarMeuHeroi(this.sessao, heroi);
    if (problema) {
      Layout.recado(problema, true);
      return;
    }

    /* Tirou da ficha a magia que mantinha: a concentração acaba, e a
       condição no combate sai junto. */
    if (mantinha && !heroi.ficha.concentrando) enviarConcentracao(this.sessao, false);

    this.modo = 'ver';
    this.rascunho = null;
    this.dadoTocado = {};
    this.render();
    window.scrollTo(0, 0);
    Layout.recado(criando ? heroi.nome + ' entrou na mesa. O Mestre já vê o seu personagem.' : 'Ficha salva.');
  },


  editar: function () {
    const meu = this.visao.meuHeroi;
    if (!meu) return;
    this.guardarRascunho({ id: meu.id, nome: meu.nome, ficha: UsoFicha.completar(JSON.parse(JSON.stringify(meu.ficha))) });
    this.dadoTocado = { dadoVida: true, dadoVida2: true };   /* já foi escolhido antes */
    this.modo = 'editar';
    this.render();
  },


  /* ---------- Eventos ---------- */

  ligar: function () {
    const self = this;

    /* O "voltar" e o "avançar" do navegador trocam o #aba= do endereço:
       a tela acompanha. */
    window.addEventListener('hashchange', function () {
      const aba = self.abaDoEndereco() || 'ficha';
      if (aba === self.aba) return;
      self.entrando = true;
      self.aba = aba;
      self.render();
    });

    document.getElementById('app').addEventListener('click', function (evento) {
      const alvo = evento.target.closest('[data-acao]');
      if (!alvo) return;

      switch (alvo.dataset.acao) {
        case 'sair':
          Sessao.limpar();
          location.href = 'index.html';
          break;

        case 'editar':
          self.editar();
          break;

        /* A foto do personagem: comprimida no imagens.js e salva pela
           mesma ação da ficha (enviarMeuHeroi confere de novo). */
        case 'foto-escolher':
          Imagens.escolher('retrato', function (resultado) {
            UsoFicha.usar(function (f) { f.foto = resultado.dados; }, 'Foto do personagem atualizada.');
          });
          break;

        case 'foto-tirar':
          UsoFicha.usar(function (f) {
            if (!f.foto) return false;
            delete f.foto;
          }, 'Foto removida.');
          break;

        /* A aba é estado de vista: troca e redesenha, sem gravar nada.
           O foco volta para a aba, como na Visão Geral do Mestre. */
        case 'aba': {
          if (self.aba !== alvo.dataset.aba) {
            self.entrando = true;
            self.aba = alvo.dataset.aba;
            /* A aba vai para o endereço: o F5 volta a ela, e o "voltar"
               do navegador volta à aba anterior (o hashchange, lá em
               baixo, cuida disso). O redesenho é feito AQUI, na hora,
               e não esperando o hashchange — que chega um instante
               depois e, achando a aba já trocada, não faz nada. */
            location.hash = 'aba=' + self.aba;
          }
          self.render();
          const ativa = document.querySelector('.nav-jogador .codice-link.ativo');
          if (ativa) ativa.focus();
          break;
        }

        case 'alternar-aviso-vez':
          Layout.recado(AvisoVez.alternar()
            ? 'Aviso da vez ligado: um sino quando chegar a sua vez.'
            : 'Aviso da vez desligado.');
          self.render();
          break;

        /* Rolagens (jogador-mesa.js). O bônus foi calculado pela ficha
           na hora de desenhar; aqui só é lido de volta e conferido. */
        case 'rolar-teste': {
          const bonus = parseInt(alvo.dataset.bonus, 10);
          RoladorJogador.rolarTeste(alvo.dataset.texto, Number.isFinite(bonus) ? bonus : 0);
          break;
        }

        case 'rolar-dado':
          RoladorJogador.rolarDado(Number(alvo.dataset.faces));
          break;

        case 'modo-rolagem':
          RoladorJogador.modo = alvo.dataset.modo;
          self.render();
          break;

        /* Liga ou desliga a animação dos dados (dados3d.js). É escolha
           de quem olha, guardada neste navegador — não da campanha. */
        case 'alternar-animacao':
          Layout.recado(Dados3D.alternar() ? 'Animação dos dados ligada.' : 'Animação dos dados desligada.');
          self.render();
          break;

        /* Ataques, magias, recursos, descansos (jogador-uso.js). */
        case 'atacar':                UsoFicha.atacar(Number(alvo.dataset.indice)); break;
        case 'dano':                  UsoFicha.dano(Number(alvo.dataset.indice)); break;
        case 'ataque-magico':         UsoFicha.ataqueMagico(); break;
        case 'conjurar':              UsoFicha.conjurar(alvo.dataset.nome); break;
        case 'encerrar-concentracao': UsoFicha.encerrarConcentracao(); break;
        case 'bolinha':               UsoFicha.bolinha(alvo.dataset.tipo, alvo.dataset.chave, alvo.dataset.gasta === '1'); break;
        case 'descanso-curto':        UsoFicha.descanso('curto'); break;
        case 'descanso-longo':        UsoFicha.descanso('longo'); break;

        /* Linhas de ataque e de recurso no formulário: relê o que foi
           digitado ANTES de redesenhar, senão o redesenho apagaria. */
        case 'mais-linha': {
          self.lerFormulario();
          const lista = self.rascunho.ficha[alvo.dataset.lista];
          lista.push(alvo.dataset.lista === 'ataques'
            ? { nome: '', atributo: 'for', proficiente: true, dano: '', tipo: '', bonus: 0 }
            : { nome: '', total: 1, recarga: 'longo', gastos: 0 });
          self.render();
          break;
        }

        case 'tirar-linha':
          self.lerFormulario();
          self.rascunho.ficha[alvo.dataset.lista].splice(Number(alvo.dataset.indice), 1);
          self.render();
          break;

        /* Aba Magias */
        case 'preparar':       UsoFicha.preparar(alvo.dataset.nome); break;
        case 'filtro-magia':
          UsoFicha.filtroNivel = alvo.dataset.nivel === 'todas' ? 'todas' : Number(alvo.dataset.nivel);
          self.render();
          break;

        /* Aba Inventário (jogador-inventario.js) */
        case 'inv-da-lista':   InventarioJogador.adicionarDaLista(); break;
        case 'inv-avulso':     InventarioJogador.adicionarAvulso(); break;
        case 'inv-qtd':        InventarioJogador.quantidade(alvo.dataset.id, Number(alvo.dataset.delta)); break;
        case 'inv-equipar':    InventarioJogador.equipar(alvo.dataset.id); break;
        case 'inv-sintonia':   InventarioJogador.sintonizar(alvo.dataset.id); break;
        case 'inv-remover':    InventarioJogador.remover(alvo.dataset.id); break;

        /* Abas Regras e Anotações (jogador-consulta.js) */
        case 'regras-tipo':    RegrasJogador.trocarTipo(alvo.dataset.tipo); break;
        case 'regras-abrir':   RegrasJogador.escolher(alvo.dataset.nome); break;
        case 'ver-regra':      RegrasJogador.abrir(alvo.dataset.tipo, alvo.dataset.nome); break;
        case 'nota-salvar':    AnotacoesJogador.salvar(); break;
        case 'nota-editar':    AnotacoesJogador.editar(alvo.dataset.id); break;
        case 'nota-cancelar':  AnotacoesJogador.cancelar(); break;
        case 'nota-apagar':    AnotacoesJogador.apagar(alvo.dataset.id); break;

        case 'cancelar':
          self.modo = 'ver';
          self.rascunho = null;
          self.render();
          break;

        case 'salvar-ficha':
          self.salvar();
          break;

        /* Uma vez só: rolar de novo até sair bom seria trapaça. O
           Mestre vê os valores rolados guardados na ficha. */
        case 'rolar-atributos': {
          const f = self.rascunho.ficha;
          if (f.rolados) return;
          f.rolados = Ficha.rolarAtributos();
          ATRIBUTOS_FICHA.forEach(function (par, i) {
            const campo = document.querySelector('[data-base="' + par[0] + '"]');
            campo.value = f.rolados[i];
          });
          alvo.disabled = true;
          alvo.lastChild.textContent = ' Já rolado';
          document.querySelector('.rolados').textContent = 'Rolou: ' + f.rolados.join(', ') + ' — troque de lugar à vontade.';
          self.lerFormulario();
          self.atualizarCalculos();
          break;
        }

        case 'rolar-pv':
          self.lerFormulario();
          document.getElementById('f-pvRolado').value = Ficha.rolarPv(self.rascunho.ficha);
          self.lerFormulario();
          self.atualizarCalculos();
          break;
      }
    });

    /* Qualquer tecla no formulário: relê e recalcula, sem redesenhar. */
    document.getElementById('principal').addEventListener('input', function (evento) {
      /* A busca da aba Regras redesenha só a lista, nunca o campo. */
      if (evento.target.id === 'buscaRegras') {
        RegrasJogador.buscar(evento.target.value);
        return;
      }
      if (!self.rascunho) return;
      const id = evento.target.id;
      if (id === 'f-dadoVida' || id === 'f-dadoVida2') self.dadoTocado[id.slice(2)] = true;
      if (id === 'f-classe') self.sugerirDado('classe');
      if (id === 'f-classe2') self.sugerirDado('classe2');
      self.lerFormulario();
      self.atualizarCalculos();
    });
    /* <select> e caixas de marcar avisam por 'change'. */
    document.getElementById('principal').addEventListener('change', function (evento) {
      /* Moedas: guarda quando o campo perde o foco (o 'change'). */
      if (evento.target.dataset.moeda) {
        InventarioJogador.mudarMoeda(evento.target.dataset.moeda, evento.target.value);
        return;
      }
      if (!self.rascunho) return;

      /* "Escolher da lista de armas": preenche a linha e redesenha. */
      if (evento.target.dataset.parte === 'arma' && evento.target.value) {
        const linha = evento.target.closest('[data-ataque]');
        self.lerFormulario();
        UsoFicha.aplicarArma(self.rascunho.ficha, Number(linha.dataset.ataque), evento.target.value);
        self.render();
        return;
      }

      const id = evento.target.id;
      if (id === 'f-dadoVida' || id === 'f-dadoVida2') self.dadoTocado[id.slice(2)] = true;
      self.lerFormulario();
      self.atualizarCalculos();
    });

    /* A CD do cartão de dados mora na coluna lateral, fora do
       #principal: tem o próprio ouvinte. */
    document.getElementById('lateral').addEventListener('input', function (evento) {
      if (evento.target.id !== 'cdTeste') return;
      const valor = parseInt(evento.target.value, 10);
      RoladorJogador.cd = valor >= 1 && valor <= 40 ? valor : null;
    });

    /* Enter num campo de texto não deve "enviar" a página. */
    document.getElementById('principal').addEventListener('submit', function (evento) {
      evento.preventDefault();
    });

    /* Chegou uma visão nova do servidor (o Mestre mexeu na mesa, alguém
       rolou um dado). Só redesenha se não houver formulário aberto —
       senão apagaria o que está sendo digitado. */
    document.addEventListener('plainus:externo', function () {
      /* A vez e o título são conferidos SEMPRE — mesmo com a pessoa
         digitando, quando o redesenho espera (ver ocupado). Senão o
         sino só tocaria depois que ela parasse de digitar. */
      self.vigiarMesa(Conexao.visao);
      if (self.ocupado()) return;
      self.render();
    });
  },


  /* O rascunho da ficha e uma cópia de como ele COMEÇOU: o aviso de
     saída (aviso-saida.js) só pergunta se os dois forem diferentes —
     abrir "Editar ficha" e sair sem mexer em nada não é perder nada. */
  guardarRascunho: function (rascunho) {
    this.rascunho = rascunho;
    /* A cópia é tirada depois do PRIMEIRO desenho do formulário (ver
       render), e não aqui: ao se desenhar, o formulário completa o
       rascunho com os valores padrão — e uma ficha em branco já
       pareceria "mexida". */
    this.rascunhoInicial = null;
  },

  rascunhoMudou: function () {
    return !!this.rascunho && this.rascunhoInicial !== null && JSON.stringify(this.rascunho) !== this.rascunhoInicial;
  },

  /* Depois de desenhar o formulário: se a cópia ainda não existe, é
     agora — com o rascunho já completado pelo desenho. */
  copiarRascunhoInicial: function () {
    if (this.rascunho && this.rascunhoInicial === null) this.rascunhoInicial = JSON.stringify(this.rascunho);
  },

  /* Há algo sendo digitado? Então um redesenho vindo de outra aba
     apagaria o texto (a ficha em edição, uma anotação pela metade, a
     busca das regras). Espera: o Estado já está atualizado na memória,
     e o próximo clique redesenha com ele. */
  ocupado: function () {
    if (this.rascunho) return true;
    const foco = document.activeElement;
    return !!(foco && foco.closest && foco.closest('#principal') && /^(INPUT|TEXTAREA|SELECT)$/.test(foco.tagName));
  }
};


Jogador.iniciar();
