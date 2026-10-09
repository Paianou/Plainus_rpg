/* ===================================================================
   layout.js — a moldura das telas do mestre

   Monta o que é IGUAL em toda página interna: a barra do topo, o
   códice lateral (marcando sozinho em que página você está), os
   recados flutuantes e a checagem de papel.

   Por que isto existe: agora cada submenu é um .html próprio. Sem
   este arquivo, a barra do topo estaria copiada em oito lugares, e
   trocar um botão dela viraria oito edições — com a garantia de
   esquecer uma. Aqui, muda num lugar e muda em todas.

   COMO UMA TELA USA
     <body data-secao="combate">   <- diz ao códice quem acender
     ...
     <script src="icones.js"></script>
     <script src="campanhas.js"></script> <- antes do dados.js: ele carrega
     <script src="dados.js"></script>        a campanha da sessão
     <script src="regras.js"></script>    <- a busca procura magias e monstros
     <script src="audio.js"></script>     <- antes do layout: a barra usa
     <script src="busca.js"></script>        o Som, a Busca e os Avisos
     <script src="avisos.js"></script>
     <script src="layout.js"></script>
     <script src="combate.js"></script>

   e no JS da tela:

     Layout.iniciar(function () {
       Combate.iniciar();          <- só roda se for mesmo o mestre
     });


   ===================================================================
   A CHECAGEM DE PAPEL É UMA PLACA, NÃO UMA PORTA
   ===================================================================
   Ela roda no navegador do próprio visitante, que pode mudá-la pelo
   DevTools. Serve para o jogador não cair aqui sem querer; não impede
   quem quer entrar. A porta de verdade fica no servidor:

     1. papel de Mestre travado em quem CRIOU a sala (problema nº 1 do
        CLAUDE.md, visível na mesa-virtual em server.js ~linha 796);
     2. dado de mestre não é escondido, é NÃO ENVIADO.
   =================================================================== */


/* ---------- criar() ----------
   Monta um elemento sem escrever HTML em string.

     criar('div.estat', [ criar('span.rotulo', 'Armadura'),
                          criar('span.valor', '19 CA') ])

   O seletor é "tag.classe.classe". O conteúdo pode ser texto, um
   elemento, ou uma lista deles — valores falsos são ignorados, o que
   deixa escrever condicional fácil: `condicao && criar(...)`.

   Texto SEMPRE entra por textContent, nunca por innerHTML. É o que
   impede um nome digitado por um jogador de virar código na tela. */

function criar(seletor, conteudo) {
  const partes = String(seletor).split('.');
  const elemento = document.createElement(partes[0] || 'div');

  if (partes.length > 1) elemento.className = partes.slice(1).join(' ');
  if (conteudo === null || conteudo === undefined) return elemento;

  if (Array.isArray(conteudo)) {
    conteudo.forEach(function (filho) { if (filho) elemento.appendChild(filho); });
  } else if (conteudo instanceof Node) {
    elemento.appendChild(conteudo);
  } else {
    elemento.textContent = conteudo;
  }

  return elemento;
}

/* Atalho: elemento com um ícone antes do texto. */
function criarComIcone(seletor, icone, texto, tamanho) {
  const elemento = criar(seletor);
  elemento.appendChild(Icone.svg(icone, tamanho || 15));
  if (texto) elemento.appendChild(document.createTextNode(' ' + texto));
  return elemento;
}

/* Um retrato: a foto, se houver e for de confiança (retratoSeguro, no
   dados.js); senão, a inicial do nome — como sempre foi. A foto entra
   como <img> com src, nunca colada em HTML. alt vazio porque o nome já
   está escrito ao lado: o leitor de tela não precisa ler duas vezes. */
function criarRetrato(seletor, foto, nome) {
  const caixa = criar(seletor);
  const segura = retratoSeguro(foto);
  if (segura) {
    const imagem = document.createElement('img');
    imagem.src = segura;
    imagem.alt = '';
    caixa.appendChild(imagem);
    caixa.classList.add('com-foto');
  } else {
    caixa.textContent = String(nome || '?').charAt(0).toUpperCase();
  }
  return caixa;
}

/* A marca na barra do topo — e um link para o início (index.html),
   como em quase todo site: quem se perde clica no nome e volta para a
   porta de entrada. A sessão desta aba não acaba; a entrada mostra a
   mesa em "Suas mesas", e um clique traz de volta.

   Um <a> de verdade, e não um div com onclick: o navegador já sabe
   abrir em outra aba com o botão do meio, o leitor de tela anuncia
   "link", e o Tab chega nele sem nada a mais. */
function marcaDoSite(emblema, funcao) {
  const marca = criar('a.marca-mestre', [
    emblema,
    criar('div', [
      criar('div.nome', 'Plainus RPG'),
      criar('div.funcao', funcao)
    ])
  ]);
  marca.href = 'index.html';
  marca.title = 'Ir para o início';
  marca.setAttribute('aria-label', 'Plainus RPG — ir para o início');
  return marca;
}

/* Botão com ícone + texto, já com type="button" e data-acao. */
function criarBotao(classe, acao, icone, texto) {
  const botao = criar('button.' + classe);
  botao.type = 'button';
  if (acao) botao.dataset.acao = acao;
  if (icone) botao.appendChild(Icone.svg(icone, 13));
  if (texto) botao.appendChild(document.createTextNode((icone ? ' ' : '') + texto));
  return botao;
}


const Layout = {

  /* O códice. 'pronta' diz se o .html já existe — as que ainda não
     existem viram botão que avisa, em vez de link que dá 404. */
  SECOES: [
    { id: 'painel',    arquivo: 'mestre.html',   ico: 'painel',     texto: 'Visão Geral / Painel', pronta: true },
    { id: 'combate',   arquivo: 'combate.html',  ico: 'combate',    texto: 'Combate & Iniciativa', pronta: true },
    { id: 'compendio', arquivo: 'compendio.html', ico: 'compendio', texto: 'Compêndio & Magias',   pronta: true },
    { id: 'bestiario', arquivo: 'bestiario.html', ico: 'bestiario', texto: 'Bestiário & Ameaças',  pronta: true },
    { id: 'npcs',      arquivo: 'npcs.html',     ico: 'npcs',       texto: 'NPCs & Facções',       pronta: true },
    { id: 'mapas',     arquivo: 'mapas.html',    ico: 'mapa',       texto: 'Mapas & Cenas',        pronta: true },
    { id: 'tabelas',   arquivo: 'tabelas.html',  ico: 'tabelas',    texto: 'Tabelas & Geradores',  pronta: true },
    { id: 'diario',    arquivo: 'diario.html',   ico: 'diario',     texto: 'Diário & Segredos',    pronta: true }
  ],

  /* ---------- Partida ---------- */

  /* Só monta a tela para quem entrou pelo index.html marcando Mestre
     (ou criando uma campanha). Antes, abrir mestre.html sem sessão
     caía num "modo demonstração" que mostrava tudo — ou seja, qualquer
     um chegava ao painel só digitando o endereço. Agora não há mais
     exceção: sem sessão de mestre, a tela não monta. */
  iniciar: function (aoPronto) {
    const sessao = Sessao.ler();

    if (!sessao || sessao.papel !== 'mestre') {
      this.mostrarRestrito(sessao ? sessao.papel : null);
      return;                                   /* a tela não monta */
    }

    /* Mestre, mas de uma campanha que não existe mais (foi esquecida
       na tela de entrada, ou o armazenamento foi limpo). Sem isto, o
       painel abriria com o exemplo de Valkoria fingindo ser a sua. */
    if (!Campanhas.achar(sessao.campanhaId)) {
      this.mostrarRestrito(null, 'Esta campanha não está mais guardada neste navegador. Volte à entrada e escolha outra, ou crie uma nova.');
      return;
    }

    /* Nome, campanha e código não são mais copiados da sessão: eles
       moram no Estado da campanha, que o dados.js já carregou. */

    document.getElementById('app').hidden = false;

    this.montarFaixa();
    this.montarTopo();
    this.montarCodice();
    Icone.aplicar();

    this.ligarSom();

    /* Toda mudança no Estado passa por Memoria.salvar(), que avisa
       'plainus:mudou'. O sino escuta para acender o ponto na hora. */
    document.addEventListener('plainus:mudou', function () {
      Avisos.atualizar();
    });

    /* Outra aba mudou a campanha (um jogador criou o personagem, por
       exemplo) e o dados.js já recarregou o Estado. A barra se refaz
       aqui; o miolo, cada tela sabe redesenhar o seu — ela põe essa
       função em Layout.redesenhar. Tela sem redesenhar fica como está
       até a próxima navegação, mas já com o Estado certo na memória. */
    const self = this;
    document.addEventListener('plainus:externo', function () {
      self.montarTopo();
      Icone.aplicar();
      if (typeof self.redesenhar === 'function') self.redesenhar();
      self.recado('A campanha foi atualizada em outra aba.');
    });

    /* O chat (chat.js): os eventos dele, e o contador do botão. */
    Chat.ligar();
    Chat.aoMudarLidas = function () { self.atualizarChat(); };

    if (typeof aoPronto === 'function') aoPronto();
  },


  /* Só o contador do botão de chat — sem redesenhar a barra. */
  atualizarChat: function () {
    const botao = document.getElementById('botaoChat');
    if (!botao) return;
    const velho = botao.querySelector('.contador-chat');
    if (velho) velho.remove();
    const novas = Chat.painel ? 0 : Chat.naoLidas();
    if (novas) botao.appendChild(criar('span.contador-chat', novas > 9 ? '9+' : String(novas)));
    botao.setAttribute('aria-label', novas ? 'Chat da mesa (' + novas + ' novas)' : 'Chat da mesa');
    this.marcarTitulo(novas);
  },

  /* Preenchida por cada tela (ver 'plainus:externo' acima). */
  redesenhar: null,


  /* O navegador só deixa tocar som depois de um gesto. O primeiro
     clique ou tecla em QUALQUER lugar da página libera o áudio — e,
     se o Estado diz que a música estava tocando, ela volta sozinha.

     'click' no document, e não 'pointerdown', de propósito: o clique
     sobe do botão até o document, então o botão de pausar já fez o
     trabalho dele quando este ouvinte roda. Com pointerdown, a
     música começaria e pararia no mesmo clique. */
  ligarSom: function () {
    const self = this;

    function liberar() {
      Som.liberar();
      document.removeEventListener('click', liberar);
      document.removeEventListener('keydown', liberar);
    }
    document.addEventListener('click', liberar);
    document.addEventListener('keydown', liberar);

    /* Sempre que o som muda, a barra se redesenha — seja quem for
       que mudou (o botão daqui, o painel, a liberação acima). */
    document.addEventListener('plainus:audio', function () {
      self.montarTopo();
    });
  },


  /* A tela de acesso restrito é montada aqui, e não escrita em cada
     .html, pelo mesmo motivo da barra do topo: uma cópia só.

     papel === null quer dizer "ainda não entrou na mesa". O papel vem
     da sessão (sessionStorage), que qualquer um edita — por isso entra por
     criar() (textContent), nunca colado em HTML. */
  mostrarRestrito: function (papel, motivo) {
    const olho = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    olho.setAttribute('class', 'ico-grande');
    olho.setAttribute('viewBox', '0 0 24 24');
    olho.setAttribute('aria-hidden', 'true');
    olho.innerHTML = Icone.traco.secreto;

    const texto = criar('p');
    if (motivo) {
      texto.textContent = motivo;
    } else if (papel) {
      texto.appendChild(document.createTextNode('Esta página é o painel de quem está mestrando a campanha. Sua entrada na mesa foi como '));
      texto.appendChild(criar('strong', String(papel)));
      texto.appendChild(document.createTextNode('.'));
    } else {
      texto.textContent = 'Você ainda não entrou na mesa. Crie uma campanha, ou entre com o código marcando "Mestre", para abrir este painel.';
    }

    /* Jogador que caiu numa tela do Mestre: o caminho certo é o painel
       dele, não a entrada. */
    const ehJogador = papel === 'jogador' && !motivo;
    const voltar = criar('a.botao.fantasma', ehJogador ? 'Ir para o seu painel' : (papel ? 'Voltar para a entrada' : 'Ir para a entrada'));
    voltar.href = ehJogador ? 'jogador.html' : 'index.html';
    voltar.style.cssText = 'display:block;text-decoration:none;text-align:center';

    const tela = criar('div.tela-restrita',
      criar('div.cartao', [
        olho,
        criar('h1', 'Área do Mestre'),
        texto,
        voltar
      ])
    );

    document.body.appendChild(tela);
  },


  /* ---------- A moldura ---------- */

  /* Aparece sempre: a campanha é salva, mas só no localStorage deste
     navegador — os jogadores, em outros computadores, não a veem. A
     faixa sai quando o servidor entrar. */
  montarFaixa: function () {
    const faixa = document.getElementById('faixaDemo');
    if (!faixa) return;
    faixa.className = 'faixa-aviso';
    faixa.textContent = 'Sem servidor ainda — esta campanha fica salva só neste navegador e não chega aos jogadores.';
  },


  montarTopo: function () {
    const barra = document.getElementById('barraTopo');
    if (!barra) return;

    barra.className = 'barra-topo';
    barra.textContent = '';

    /* marca */
    const emblema = criar('span.emblema');
    emblema.appendChild(Icone.svg('mestre', 19));

    barra.appendChild(marcaDoSite(emblema, 'Painel de Campanha'));

    /* Seletor de sessão + o botão de nova sessão, na mesma caixa.
       A caixa é 'position: relative' porque o menu se pendura nela. */
    const seletor = criar('button.seletor-sessao');
    seletor.type = 'button';
    seletor.dataset.acao = 'sessao';
    seletor.appendChild(Icone.svg('compendio', 15));
    seletor.appendChild(criar('span.titulo-sessao', this.tituloDaBarra()));
    seletor.appendChild(Icone.svg('chevron', 14));

    const maisSessao = criar('button.icone-botao.botao-nova-sessao');
    maisSessao.type = 'button';
    maisSessao.dataset.acao = 'nova-sessao-topo';
    maisSessao.title = 'Começar a próxima sessão';
    maisSessao.setAttribute('aria-label', 'Começar a próxima sessão');
    maisSessao.appendChild(Icone.svg('mais', 16));

    const caixa = criar('div.caixa-sessao', [seletor, maisSessao]);
    caixa.appendChild(this.montarMenuSessao());
    barra.appendChild(caixa);

    barra.appendChild(criar('div.espaco'));

    /* áudio — o ícone mostra o que o botão FAZ: pausa quando está
       soando, play (volume) quando está em silêncio. */
    const soando = Som.tocando();
    const pausar = criarBotao('mini-botao', 'audio-pausar', soando ? 'pausa' : 'volume', '');
    pausar.setAttribute('aria-label', soando ? 'Pausar ambiente' : 'Tocar ambiente');
    pausar.title = soando ? 'Pausar ambiente' : 'Tocar ambiente';

    barra.appendChild(criar('div.faixa-audio', [
      Icone.svg('volume', 15),
      criar('span.pista', Estado.audio.pista),
      pausar
    ]));

    /* busca */
    const busca = criar('button.icone-botao.largo');
    busca.type = 'button';
    busca.dataset.acao = 'busca';
    busca.setAttribute('aria-label', 'Buscar');
    busca.appendChild(Icone.svg('busca', 15));
    busca.appendChild(criar('span.atalho', 'Ctrl+K'));
    barra.appendChild(busca);

    /* avisos — o ponto só aparece se houver aviso que o mestre ainda
       não viu; quem decide é o avisos.js. */
    const sino = criar('button.icone-botao');
    sino.type = 'button';
    sino.id = 'sinoAvisos';
    sino.dataset.acao = 'avisos';
    sino.setAttribute('aria-haspopup', 'dialog');
    sino.setAttribute('aria-expanded', Avisos.painel ? 'true' : 'false');
    sino.appendChild(Icone.svg('sino', 16));
    barra.appendChild(sino);

    /* chat — o número é o de mensagens que chegaram desde a última vez
       que o Mestre olhou (chat.js). */
    const chat = criar('button.icone-botao.botao-chat');
    chat.type = 'button';
    chat.id = 'botaoChat';
    chat.dataset.acao = 'chat';
    chat.title = 'Chat da mesa';
    chat.setAttribute('aria-label', 'Chat da mesa');
    chat.appendChild(Icone.svg('chat', 16));
    barra.appendChild(chat);
    this.atualizarChat();

    /* convite */
    const convite = criar('button.icone-botao');
    convite.type = 'button';
    convite.dataset.acao = 'convite';
    convite.title = 'Copiar código de convite';
    convite.setAttribute('aria-label', 'Copiar código de convite');
    convite.appendChild(Icone.svg('copiar', 16));
    barra.appendChild(convite);

    /* ajuda — a lista de atalhos (atalhos.js) */
    if (typeof Atalhos !== 'undefined') barra.appendChild(Atalhos.botao());

    /* sair — volta para a entrada, onde estão as outras campanhas e o
       "Criar campanha". A campanha continua salva; só a sessão acaba. */
    const sair = criar('button.icone-botao');
    sair.type = 'button';
    sair.dataset.acao = 'sair';
    sair.title = 'Sair da mesa';
    sair.setAttribute('aria-label', 'Sair da mesa');
    sair.appendChild(Icone.svg('sair', 16));
    barra.appendChild(sair);

    /* perfil */
    const inicial = Estado.mestre.nome.replace(/^Mestre\s+/i, '').charAt(0).toUpperCase();
    barra.appendChild(criar('div.perfil', [
      criar('div.quem', [
        criar('div.nome', Estado.mestre.nome),
        criar('div.cargo', 'Mestre da mesa')
      ]),
      criar('div.retrato', inicial)
    ]));

    Avisos.atualizarPonto();      /* o sino acabou de nascer: acende o ponto se for o caso */
    this.ligarTopo(barra);
  },



  /* ===================================================================
     O MENU DE SESSÃO

     O seletor do topo era decorativo — clicava e dava um recado. Agora
     ele abre um menu onde se faz duas coisas:

       1. dar nome à sessão corrente (ou corrigir o que já tem);
       2. começar a próxima, já com nome.

     DE ONDE VEM O NOME DA SESSÃO
     Do Diário, não de um campo novo. `Estado.diario` já guarda uma
     entrada por sessão, com título, resumo e notas. Se a barra tivesse
     a própria lista de nomes, teríamos dois lugares dizendo como a
     sessão 12 se chama — e um dia eles discordariam. Aqui a barra só
     lê e escreve na mesma lista que a tela de Diário usa.

     `Estado.campanha.sessao` continua sendo só o NÚMERO da sessão
     corrente: é o ponteiro que diz qual das entradas está em jogo.
     =================================================================== */

  /* O texto que aparece na barra. Mostra o nome da sessão quando ela
     tem um; senão, só o número. */
  tituloDaBarra: function () {
    const entrada = this.sessaoCorrente();
    const base = Estado.campanha.nome + ' — Sessão ' + Estado.campanha.sessao;
    return entrada && entrada.titulo ? base + ': ' + entrada.titulo : base;
  },


  sessaoCorrente: function () {
    return (Estado.diario || []).find(function (e) {
      return e.sessao === Estado.campanha.sessao;
    });
  },


  /* As sessões já registradas, da mais nova para a mais velha. */
  sessoesRegistradas: function () {
    return (Estado.diario || []).slice().sort(function (a, b) {
      return b.sessao - a.sessao;
    });
  },


  montarMenuSessao: function () {
    const self = this;
    const corrente = this.sessaoCorrente();
    const proxima = this.proximoNumero();

    const menu = criar('div.menu-sessao');
    menu.id = 'menuSessao';
    menu.hidden = true;

    /* ----- 1. a sessão corrente ----- */
    const numeroAtual = document.createElement('input');
    numeroAtual.type = 'number';
    numeroAtual.min = 1;
    numeroAtual.value = Estado.campanha.sessao;
    numeroAtual.id = 'sessaoNumero';
    numeroAtual.setAttribute('aria-label', 'Número da sessão corrente');

    const tituloAtual = document.createElement('input');
    tituloAtual.type = 'text';
    tituloAtual.value = corrente ? (corrente.titulo || '') : '';
    tituloAtual.placeholder = 'Dê um nome a esta sessão';
    tituloAtual.maxLength = 60;
    tituloAtual.id = 'sessaoTitulo';
    tituloAtual.setAttribute('aria-label', 'Nome da sessão corrente');

    menu.appendChild(criar('div.secao-menu', [
      criar('div.rotulo-menu', 'Sessão corrente'),
      criar('div.linha-campos-sessao', [numeroAtual, tituloAtual]),
      criar('div.linha-botoes', [
        criarBotao('botao.pequeno', 'salvar-sessao', 'check', 'Salvar')
      ])
    ]));

    /* ----- 2. começar a próxima ----- */
    const numeroNovo = document.createElement('input');
    numeroNovo.type = 'number';
    numeroNovo.min = 1;
    numeroNovo.value = proxima;
    numeroNovo.id = 'novaSessaoNumero';
    numeroNovo.setAttribute('aria-label', 'Número da nova sessão');

    const tituloNovo = document.createElement('input');
    tituloNovo.type = 'text';
    tituloNovo.placeholder = 'Nome da sessão ' + proxima;
    tituloNovo.maxLength = 60;
    tituloNovo.id = 'novaSessaoTitulo';
    tituloNovo.setAttribute('aria-label', 'Nome da nova sessão');

    const bloco = criar('div.secao-menu', [
      criar('div.rotulo-menu', 'Começar a próxima'),
      criar('div.linha-campos-sessao', [numeroNovo, tituloNovo]),
      criar('div.linha-botoes', [
        criarBotao('botao.fantasma.pequeno', 'comecar-sessao', 'mais', 'Começar sessão')
      ])
    ]);
    bloco.appendChild(criar('div.aviso-menu',
      'A sessão de agora é fechada e a nova entra no Diário, pronta para receber o resumo.'));
    menu.appendChild(bloco);

    /* ----- 3. as anteriores ----- */
    const registradas = this.sessoesRegistradas();
    if (registradas.length) {
      const lista = criar('div.lista-sessoes-menu');

      registradas.forEach(function (entrada) {
        const linha = criar('button.linha-sessao-menu'
          + (entrada.sessao === Estado.campanha.sessao ? '.corrente' : ''));
        linha.type = 'button';
        linha.dataset.acao = 'ir-sessao';
        linha.dataset.numero = entrada.sessao;
        linha.appendChild(criar('span.num', String(entrada.sessao)));
        linha.appendChild(criar('span.tit', entrada.titulo || 'Sem nome'));
        if (entrada.emAberto) linha.appendChild(criar('span.pilula.azul', 'Aberta'));
        lista.appendChild(linha);
      });

      menu.appendChild(criar('div.secao-menu', [
        criar('div.rotulo-menu', 'Sessões registradas'),
        lista
      ]));
    }

    return menu;
  },


  /* O número seguinte ao maior já registrado — e nunca menor que o
     da sessão corrente, para o caso de o diário estar vazio. */
  proximoNumero: function () {
    const maior = (Estado.diario || []).reduce(function (maximo, e) {
      return Math.max(maximo, e.sessao);
    }, Estado.campanha.sessao);

    return maior + 1;
  },


  alternarMenuSessao: function (focar) {
    const menu = document.getElementById('menuSessao');
    if (!menu) return;

    const vaiAbrir = menu.hidden;
    menu.hidden = !vaiAbrir;
    if (!vaiAbrir) return;

    const campo = document.getElementById(
      focar === 'nova' ? 'novaSessaoTitulo' : 'sessaoTitulo');
    if (campo) { campo.focus(); campo.select(); }
  },


  fecharMenuSessao: function () {
    const menu = document.getElementById('menuSessao');
    if (menu) menu.hidden = true;
  },


  /* ---------- As duas ações ---------- */

  salvarSessao: function () {
    const numero = parseInt(document.getElementById('sessaoNumero').value, 10);
    const titulo = document.getElementById('sessaoTitulo').value.trim();

    if (!numero || numero < 1) {
      this.recado('O número da sessão precisa ser 1 ou mais.', true);
      return;
    }

    const anterior = Estado.campanha.sessao;
    Estado.campanha.sessao = numero;

    /* Se já havia entrada para esta sessão, atualiza; senão, cria uma
       nova — assim nomear pela barra também registra no Diário. */
    let entrada = (Estado.diario || []).find(function (e) { return e.sessao === anterior; });

    if (entrada) {
      entrada.sessao = numero;
      entrada.titulo = titulo;
    } else {
      if (!Estado.diario) Estado.diario = [];
      entrada = {
        id: 'd' + Date.now(),
        sessao: numero,
        data: this.hojeISO(),
        titulo: titulo,
        resumo: '',
        notas: '',
        emAberto: true
      };
      Estado.diario.push(entrada);
    }

    this.depoisDeMudarSessao(titulo
      ? 'Sessão ' + numero + ' agora se chama "' + titulo + '".'
      : 'Sessão ' + numero + ' salva.');
  },


  comecarSessao: function () {
    const numero = parseInt(document.getElementById('novaSessaoNumero').value, 10);
    const titulo = document.getElementById('novaSessaoTitulo').value.trim();

    if (!numero || numero < 1) {
      this.recado('O número da sessão precisa ser 1 ou mais.', true);
      return;
    }

    const jaExiste = (Estado.diario || []).some(function (e) { return e.sessao === numero; });
    if (jaExiste) {
      this.recado('Já existe uma sessão ' + numero + '. Escolha outro número.', true);
      return;
    }

    /* A sessão que estava em jogo deixa de estar aberta. */
    const corrente = this.sessaoCorrente();
    if (corrente) corrente.emAberto = false;

    if (!Estado.diario) Estado.diario = [];
    Estado.diario.push({
      id: 'd' + Date.now(),
      sessao: numero,
      data: this.hojeISO(),
      titulo: titulo,
      resumo: '',
      notas: '',
      emAberto: true
    });

    Estado.campanha.sessao = numero;

    this.depoisDeMudarSessao('Sessão ' + numero
      + (titulo ? ' — "' + titulo + '"' : '') + ' começou.');
  },


  /* Voltar para uma sessão já registrada, caso tenha se enganado. */
  irParaSessao: function (numero) {
    const alvo = parseInt(numero, 10);
    if (!alvo || alvo === Estado.campanha.sessao) {
      this.fecharMenuSessao();
      return;
    }

    Estado.campanha.sessao = alvo;
    const entrada = this.sessaoCorrente();

    this.depoisDeMudarSessao('Agora em jogo: sessão ' + alvo
      + (entrada && entrada.titulo ? ' — "' + entrada.titulo + '"' : '') + '.');
  },


  /* Salva, redesenha a barra e avisa a tela.

     O aviso é um evento no document, e não uma chamada direta, porque
     o layout.js não sabe em qual tela está rodando. Quem se importa
     escuta 'plainus:sessao' e se redesenha — hoje o Diário,
     amanhã quem mais precisar. */
  depoisDeMudarSessao: function (mensagem) {
    Memoria.salvar();
    this.fecharMenuSessao();

    this.montarTopo();
    Icone.aplicar();

    document.dispatchEvent(new CustomEvent('plainus:sessao'));
    this.recado(mensagem);
  },


  hojeISO: function () {
    const hoje = new Date();
    return hoje.getFullYear() + '-'
      + String(hoje.getMonth() + 1).padStart(2, '0') + '-'
      + String(hoje.getDate()).padStart(2, '0');
  },


  montarCodice: function () {
    const codice = document.getElementById('codice');
    if (!codice) return;

    const atual = document.body.dataset.secao;
    const self = this;

    codice.className = 'codice';
    codice.textContent = '';
    codice.appendChild(criar('div.codice-titulo', 'Códice de campanha'));

    this.SECOES.forEach(function (secao) {
      /* Página pronta vira link de verdade; as outras viram botão que
         avisa. Assim ninguém cai num 404. */
      const item = secao.pronta
        ? criar('a.codice-link')
        : criar('button.codice-link');

      if (secao.pronta) {
        item.href = secao.arquivo;
      } else {
        item.type = 'button';
        item.dataset.acao = 'secao-futura';
        item.dataset.nome = secao.texto;
        item.style.opacity = '.55';
      }

      if (secao.id === atual) item.classList.add('ativo');

      item.appendChild(Icone.svg(secao.ico, 17));
      item.appendChild(criar('span', secao.texto));
      codice.appendChild(item);
    });

    /* regra ativa */
    codice.appendChild(criar('div.regra-ativa', [
      criar('div.cabeca', [
        criar('span.rotulo', 'Regra ativa'),
        criar('span.sistema', Estado.campanha.sistema)
      ]),
      criar('p', Estado.campanha.regra || 'Nenhuma regra da casa registrada.')
    ]));

    codice.addEventListener('click', function (evento) {
      const alvo = evento.target.closest('[data-acao="secao-futura"]');
      if (!alvo) return;
      self.recado('"' + alvo.dataset.nome + '" ainda não foi construída — vamos uma tela por vez.');
    });
  },


  ligarTopo: function (barra) {
    const self = this;

    /* Uma vez só. montarTopo() roda de novo sempre que a sessão ou a
       pista mudam, mas #barraTopo é SEMPRE o mesmo elemento — só os
       filhos são refeitos. Sem esta trava, cada redesenho penduraria
       mais um listener no mesmo lugar, e um clique acabaria disparando
       a ação três, quatro vezes. */
    if (this.topoLigado) return;
    this.topoLigado = true;

    /* Fecha o menu ao clicar fora dele. O clique DENTRO da caixa não
       conta, senão o menu se fecharia ao tocar nos próprios campos. */
    document.addEventListener('click', function (evento) {
      if (evento.target.closest('.caixa-sessao')) return;
      self.fecharMenuSessao();
    });

    document.addEventListener('keydown', function (evento) {
      if (evento.key === 'Escape') self.fecharMenuSessao();
    });

    /* Enter nos campos do menu confirma — digitar o nome e apertar
       Enter é o gesto natural, e obrigar a mirar no botão é atrito. */
    barra.addEventListener('keydown', function (evento) {
      if (evento.key !== 'Enter') return;
      const id = evento.target.id;

      if (id === 'sessaoTitulo' || id === 'sessaoNumero') {
        evento.preventDefault();
        self.salvarSessao();
      } else if (id === 'novaSessaoTitulo' || id === 'novaSessaoNumero') {
        evento.preventDefault();
        self.comecarSessao();
      }
    });

    barra.addEventListener('click', function (evento) {
      const alvo = evento.target.closest('[data-acao]');
      if (!alvo) return;

      switch (alvo.dataset.acao) {
        case 'convite':
          self.copiarCodigo();
          break;
        case 'busca':
          self.buscar();
          break;
        case 'avisos':
          Avisos.alternar(alvo);
          break;
        case 'chat':
          Chat.alternarPainel();
          break;
        case 'sessao':
          self.alternarMenuSessao('corrente');
          break;
        case 'nova-sessao-topo':
          self.alternarMenuSessao('nova');
          break;
        case 'salvar-sessao':
          self.salvarSessao();
          break;
        case 'comecar-sessao':
          self.comecarSessao();
          break;
        case 'ir-sessao':
          self.irParaSessao(alvo.dataset.numero);
          break;
        case 'audio-pausar':
          self.alternarSom();
          break;
        case 'sair':
          Sessao.limpar();
          location.href = 'index.html';
          break;
      }
    });

    document.addEventListener('keydown', function (evento) {
      if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'k') {
        evento.preventDefault();
        self.buscar();
      }
    });
  },


  /* ---------- Ações da moldura ---------- */

  /* Decide pelo que o mestre OUVE, não pelo que o Estado diz. Ao abrir
     uma tela, o Estado pode dizer "tocando" e nada soar ainda (o
     navegador espera um clique). Nesse caso, o botão mostra play, e
     apertar play tem que TOCAR — não inverter um "tocando" que já era
     verdadeiro e silenciar de vez. */
  alternarSom: function () {
    if (!Som.disponivel()) {
      this.recado('Este navegador não consegue gerar o som ambiente.', true);
      return;
    }

    Estado.audio.tocando = !Som.tocando();
    Memoria.salvar();
    Som.liberar();            /* este clique já é o gesto que o navegador exige */
    Som.aplicar();            /* aplicar() avisa 'plainus:audio', e a barra se redesenha */

    this.recado(Estado.audio.tocando
      ? 'Tocando: ' + Estado.audio.pista + '.'
      : 'Ambiente pausado.');
  },

  copiarCodigo: function () {
    const codigo = Estado.campanha.codigo;
    const self = this;

    /* No ar (http/https), copia o LINK de convite: o jogador clica e
       cai na entrada com o código já preenchido (app.js, lerConvite).
       Aberto por duplo clique (file://), o link seria um caminho do
       SEU disco — inútil para quem está em outro computador —, então
       copia só o código. */
    const noAr = location.protocol === 'http:' || location.protocol === 'https:';
    const texto = noAr ? new URL('index.html#convite=' + codigo, location.href).href : codigo;
    const oQue = noAr ? 'Link de convite' : 'Código ' + codigo;

    /* A API moderna só funciona em contexto seguro (https, localhost).
       Abrindo por duplo clique (file://) ela pode falhar — por isso o
       catch mostra o código em vez de ficar em silêncio. */
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(function () {
        self.recado(oQue + ' copiado.');
      }).catch(function () {
        self.recado('Não consegui copiar daqui. O código é ' + codigo + '.', true);
      });
    } else {
      this.recado('Este navegador não deixa copiar por aqui. O código é ' + codigo + '.', true);
    }
  },


  buscar: function () {
    Busca.abrir();
  },


  /* ---------- Pedidos de abertura ----------
     A busca e os avisos levam a outra tela com um pedido no endereço:

       npcs.html#abrir=npc:n4        →  tratar('npc', 'n4')

     Cada tela diz como atender, no próprio JS:

       Layout.aoPedir(function (tipo, valor) { ... abre o item ... });

     O pedido é lido ao montar a tela E a cada 'hashchange', porque se
     o destino for a tela em que você já está, o navegador não recarrega
     a página — só troca o #.

     Depois de lido, o # é apagado do endereço. Senão, recarregar a
     página (F5) abriria o mesmo item de novo, e pedir o mesmo item uma
     segunda vez não mudaria o # — e não dispararia nada. */
  aoPedir: function (tratar) {
    function ler() {
      const achado = location.hash.match(/^#abrir=(.+)$/);
      if (!achado) return;

      try {
        history.replaceState(null, '', location.pathname + location.search);
      } catch (erro) {
        location.hash = '';       /* file:// em alguns navegadores não deixa o replaceState */
      }

      let pedido;
      try {
        pedido = decodeURIComponent(achado[1]);
      } catch (erro) {
        return;                   /* endereço malformado: ignora */
      }

      const doisPontos = pedido.indexOf(':');
      if (doisPontos === -1) return;
      tratar(pedido.slice(0, doisPontos), pedido.slice(doisPontos + 1));
    }

    ler();
    window.addEventListener('hashchange', ler);
  },


  /* ---------- Recados flutuantes ---------- */

  recado: function (texto, ehErro) {
    const area = document.getElementById('recados');
    if (!area) return;

    const caixa = criar('div.recado-flutuante' + (ehErro ? '.erro' : ''), texto);
    area.appendChild(caixa);

    setTimeout(function () { caixa.remove(); }, 4200);
    while (area.children.length > 3) area.removeChild(area.firstChild);
  },


  /* O título da aba do navegador como aviso: "(2) Visão Geral — ..."
     com mensagens novas, "Sua vez! · Painel do jogador — ..." no turno.
     Numa sessão a pessoa vive alternando com o Discord: o título é a
     única parte da página que ela vê da outra aba. O título original é
     guardado na primeira chamada, para os avisos não se acumularem. */
  marcarTitulo: function (naoLidas, alerta) {
    if (this.tituloBase === undefined) this.tituloBase = document.title;
    let titulo = this.tituloBase;
    if (naoLidas) titulo = '(' + (naoLidas > 9 ? '9+' : naoLidas) + ') ' + titulo;
    if (alerta) titulo = alerta + ' · ' + titulo;
    if (document.title !== titulo) document.title = titulo;
  },


  /* "Goblin apagado · Desfazer" — no lugar do "Tem certeza?".

     A janela de confirmação pergunta ANTES, toda vez, e quase sempre a
     resposta é "sim": a pessoa aprende a clicar OK sem ler, e no dia em
     que clicou errado, clicou OK do mesmo jeito. Apagar na hora e
     oferecer a volta por uns segundos protege melhor e não interrompe
     ninguém (é o que o Gmail e o Trello fazem).

     'desfazer' é quem sabe pôr de volta — cada tela guarda o que tirou.
     Ctrl+Z também desfaz, enquanto o recado estiver na tela. */
  DURACAO_DESFAZER: 8000,

  recadoDesfazer: function (texto, desfazer) {
    const area = document.getElementById('recados');
    if (!area) return;
    const self = this;

    const botao = criar('button.desfazer-recado', 'Desfazer');
    botao.type = 'button';
    const caixa = criar('div.recado-flutuante.com-acao', [criar('span', texto), botao]);

    /* Uma vez só: dois cliques rápidos não podem pôr o item de volta duas vezes. */
    let usado = false;
    const executar = function () {
      if (usado) return;
      usado = true;
      caixa.remove();
      if (self.desfazerPendente === executar) self.desfazerPendente = null;
      desfazer();
    };
    botao.addEventListener('click', executar);

    area.appendChild(caixa);
    while (area.children.length > 3) area.removeChild(area.firstChild);

    this.desfazerPendente = executar;
    setTimeout(function () {
      caixa.remove();
      if (self.desfazerPendente === executar) self.desfazerPendente = null;
    }, this.DURACAO_DESFAZER);

    /* O Ctrl+Z é ligado uma vez por página, na primeira vez que precisa.
       Dentro de um campo de texto, o Ctrl+Z é do campo (desfazer a
       digitação), não daqui. */
    if (!this.ctrlZLigado) {
      this.ctrlZLigado = true;
      document.addEventListener('keydown', function (evento) {
        if (!(evento.ctrlKey || evento.metaKey) || evento.shiftKey || evento.key.toLowerCase() !== 'z') return;
        const foco = document.activeElement;
        if (foco && /^(INPUT|TEXTAREA|SELECT)$/.test(foco.tagName)) return;
        if (!self.desfazerPendente) return;
        evento.preventDefault();
        self.desfazerPendente();
      });
    }
  },

  /* Põe de volta um item tirado de uma lista do Estado, na posição em
     que estava — se ele já não tiver voltado por outro caminho. */
  devolver: function (lista, item, posicao) {
    if (!item || lista.some(function (x) { return x.id === item.id; })) return false;
    lista.splice(Math.min(Math.max(posicao, 0), lista.length), 0, item);
    return true;
  },


  /* ---------- Utilidades de jogo ---------- */

  dado: function (faces) {
    return Math.floor(Math.random() * faces) + 1;
  },

  sortear: function (lista) {
    return lista[Math.floor(Math.random() * lista.length)];
  }
};
