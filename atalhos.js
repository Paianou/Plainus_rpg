/* ===================================================================
   atalhos.js — atalhos de teclado e o painel "?"

   Vale para os dois painéis (Mestre e jogador), que carregam este
   arquivo depois do layout.js:

     1 a 8      vai para a seção do códice (o menu da esquerda) na
                mesma ordem em que ela aparece — no jogador, as abas;
                no Mestre, as telas
     ?          abre a lista de atalhos (e, no jogador, o "Rever o tour")
     Ctrl + Z   desfaz o último apagar (layout.js, recadoDesfazer)
     Esc        fecha janelas e a rolagem de dados (cada uma cuida do seu)

   QUANDO NÃO DISPARA
   Digitando num campo, o "1" é um 1 e o "?" é um ponto de interrogação.
   Com Ctrl, Alt ou Cmd, a tecla é do navegador ou do sistema. E com
   algo aberto por cima (a rolagem dos dados, a busca, uma janela, o
   tour), a tecla é dele.

   O painel "?" também abre pelo botão de ajuda da barra do topo: um
   atalho que ninguém sabe que existe não ajuda ninguém.
   =================================================================== */

const Atalhos = {

  /* O jogador põe aqui o "Rever o tour" (jogador.js). */
  aoReverTour: null,

  digitando: function (alvo) {
    return !!alvo && (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName));
  },

  algoAberto: function () {
    return !!document.querySelector('.palco-dados, dialog[open], .tour-fundo, .atalhos-fundo');
  },

  /* As seções do códice, só as visíveis, na ordem da tela. */
  secoes: function () {
    return Array.prototype.filter.call(document.querySelectorAll('.codice .codice-link'), function (link) {
      return link.offsetParent !== null;
    });
  },

  ligar: function () {
    const self = this;
    document.addEventListener('keydown', function (evento) {
      if (evento.defaultPrevented || evento.ctrlKey || evento.altKey || evento.metaKey) return;
      if (self.digitando(evento.target) || self.algoAberto()) return;

      if (evento.key === '?') {
        evento.preventDefault();
        self.abrir();
        return;
      }

      if (/^[1-9]$/.test(evento.key)) {
        const secao = self.secoes()[Number(evento.key) - 1];
        if (!secao) return;
        evento.preventDefault();
        secao.click();
      }
    });
  },


  /* ---------- O botão da barra do topo ---------- */

  botao: function () {
    const self = this;
    const botao = criar('button.icone-botao');
    botao.type = 'button';
    botao.id = 'botaoAjuda';
    botao.title = 'Atalhos e ajuda (?)';
    botao.setAttribute('aria-label', 'Atalhos do teclado e ajuda');
    botao.appendChild(Icone.svg('ajuda', 16));
    botao.addEventListener('click', function () { self.abrir(); });
    return botao;
  },


  /* ---------- O painel ---------- */

  linhas: function () {
    const lista = [
      [['1', '–', '8'], 'Ir para as seções do menu da esquerda, na ordem'],
      [['Ctrl', '+', 'Z'], 'Desfazer o último apagar, enquanto o aviso estiver na tela'],
      [['Esc'], 'Fechar janelas, a busca e a rolagem de dados']
    ];
    /* Cada tela tem o que tem: a busca só existe no Mestre. */
    if (typeof Busca !== 'undefined') lista.splice(1, 0, [['Ctrl', '+', 'K'], 'Buscar em tudo da campanha']);
    if (typeof Chat !== 'undefined') lista.push([['Enter'], 'Enviar a mensagem no chat (Shift + Enter pula a linha)']);
    lista.push([['?'], 'Abrir esta lista']);
    return lista;
  },

  abrir: function () {
    if (document.querySelector('.atalhos-fundo')) return;
    const self = this;
    const antes = document.activeElement;

    const lista = criar('dl.lista-atalhos');
    this.linhas().forEach(function (linha) {
      const teclas = criar('dt');
      linha[0].forEach(function (parte) {
        teclas.appendChild(parte === '+' || parte === '–' ? criar('span.entre-teclas', parte) : criar('kbd', parte));
      });
      lista.appendChild(teclas);
      lista.appendChild(criar('dd', linha[1]));
    });

    const fechar = criarBotao('botao.pequeno', null, null, 'Fechar');
    const botoes = [fechar];
    if (typeof this.aoReverTour === 'function') {
      const tour = criarBotao('botao.fantasma.pequeno', null, 'passo', 'Rever o tour');
      tour.addEventListener('click', function () { feche(); self.aoReverTour(); });
      botoes.unshift(tour);
    }

    const titulo = criar('h2', 'Atalhos do teclado');
    titulo.id = 'atalhosTitulo';
    const caixa = criar('div.atalhos-caixa', [
      titulo,
      criar('p.dica', 'Funcionam quando você não está digitando num campo.'),
      lista,
      criar('div.linha-botoes', botoes)
    ]);
    caixa.setAttribute('role', 'dialog');
    caixa.setAttribute('aria-modal', 'true');
    caixa.setAttribute('aria-labelledby', 'atalhosTitulo');

    const fundo = criar('div.atalhos-fundo', caixa);
    document.body.appendChild(fundo);
    fechar.focus();

    function tecla(evento) {
      if (evento.key === 'Escape') { evento.preventDefault(); feche(); }
    }
    /* Fecha e devolve o foco a quem tinha antes — quem navega pelo
       teclado não pode ser jogado de volta ao topo da página. */
    function feche() {
      document.removeEventListener('keydown', tecla, true);
      fundo.remove();
      if (antes && antes.focus && antes.isConnected) antes.focus();
    }
    document.addEventListener('keydown', tecla, true);
    fechar.addEventListener('click', feche);
    fundo.addEventListener('click', function (evento) { if (evento.target === fundo) feche(); });
  }
};

Atalhos.ligar();
