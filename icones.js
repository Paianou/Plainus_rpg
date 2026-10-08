/* ===================================================================
   icones.js — os ícones do site, desenhados em traço.

   Regra da identidade visual (CLAUDE.md): nada de emoji na interface.
   Emoji traz cor e estilo próprios, muda de desenho em cada sistema
   operacional e quebra o clima. Estes aqui são SVG de traço que
   HERDAM a cor do texto ao redor (stroke: currentColor, no .ico do
   style.css), então um ícone dentro de um texto apagado fica apagado,
   e dentro de um título aceso fica aceso. Um arquivo só, porque as
   próximas telas (ficha, party, mapa) vão pedir os mesmos desenhos.

   Vários vieram de mesa-virtual/public/js/icones.js, para o site novo
   e a referência falarem a mesma língua. Os que faltavam (busca, sino,
   volume, ampulheta, moeda...) foram desenhados na mesma grade 24x24
   e com a mesma espessura de traço.

   Uso:
     Icone.svg('dados', 18)  -> devolve um elemento <svg> pronto
   =================================================================== */

const Icone = {

  traco: {
    /* --- navegação do códice --- */
    painel:     '<path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z"/>',
    combate:    '<path d="M4 4l10 10M20 4L10 14"/><path d="M14 14l3 3-2 3-3-3zM10 14l-3 3 2 3 3-3z"/>',
    compendio:  '<path d="M5 19V5a2 2 0 0 1 2-2h12v16H7a2 2 0 0 0-2 2z"/><path d="M9 7h6M9 11h4"/>',
    bestiario:  '<path d="M12 3a7 7 0 0 0-7 7v4l2 2v3h10v-3l2-2v-4a7 7 0 0 0-7-7z"/><path d="M9.5 11h.01M14.5 11h.01M10 17v2M14 17v2"/>',
    npcs:       '<circle cx="9" cy="8" r="3"/><path d="M3 19a6 6 0 0 1 12 0"/><path d="M16 6a3 3 0 0 1 0 6M17 19a6 6 0 0 0-2-4.5"/>',
    mapa:       '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
    tabelas:    '<path d="M3 5h18v14H3z"/><path d="M3 10h18M3 15h18M9 5v14M15 5v14"/>',
    diario:     '<path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z"/><path d="M18 20a2 2 0 0 0 2-2V6"/><path d="M9 8h6M9 12h4"/>',

    /* --- barra do topo --- */
    marca:      '<path d="M6 21V9c0-4 3-6 6-8 3 2 6 4 6 8v12z"/><path d="M12 8v13M9 12h6"/>',
    busca:      '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
    sino:       '<path d="M6 16V10a6 6 0 0 1 12 0v6l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    expandir:   '<path d="M4 9V4h5M20 15v5h-5M15 4h5v5M9 20H4v-5"/>',
    chevron:    '<path d="M6 9l6 6 6-6"/>',
    volume:     '<path d="M5 9h3l4-3v12l-4-3H5z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
    mudo:       '<path d="M5 9h3l4-3v12l-4-3H5z"/><path d="M16 9l5 6M21 9l-5 6"/>',
    pausa:      '<path d="M9 5v14M15 5v14"/>',
    recarregar: '<path d="M20 12a8 8 0 1 1-2.5-5.8"/><path d="M20 4v5h-5"/>',

    /* --- atributos de ficha --- */
    armadura:   '<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/>',
    olho:       '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/>',
    iniciativa: '<path d="M13 3l-7 10h5l-1 8 7-10h-5z"/>',
    vida:       '<path d="M12 20s-7-4.5-7-9.5A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.5C19 15.5 12 20 12 20z"/>',
    magia:      '<path d="M5 19L16 8"/><path d="M14 4l1.2 2.8L18 8l-2.8 1.2L14 12l-1.2-2.8L10 8l2.8-1.2z"/><path d="M6 5l.7 1.6L8.3 7l-1.6.7L6 9.3l-.7-1.6L3.7 7l1.6-.7z"/>',
    ajustes:    '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',

    /* --- combate --- */
    ampulheta:  '<path d="M7 3h10M7 21h10"/><path d="M7 3v4l5 5 5-5V3M7 21v-4l5-5 5 5v4"/>',
    check:      '<path d="M5 13l4 4L19 7"/>',
    alerta:     '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
    escudo:     '<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/><path d="M12 9v5M9.5 11.5h5"/>',
    surto:      '<path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>',
    passo:      '<path d="M5 12h12"/><path d="M13 7l5 5-5 5"/>',

    /* --- ferramentas do mestre --- */
    dados:      '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 3v18M4 7.5l8 4.5 8-4.5"/>',
    secreto:    '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/><path d="M4 20L20 4"/>',
    npcNovo:    '<circle cx="10" cy="8" r="3.5"/><path d="M3 20a7 7 0 0 1 14 0"/><path d="M18 7v6M15 10h6"/>',
    condicoes:  '<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/><path d="M12 8v4M12 15h.01"/>',
    tesouro:    '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10h3.2a1.8 1.8 0 0 1 0 3.6H9.5"/>',
    audio:      '<path d="M4 14V9M8 18V6M12 15v-7M16 19V5M20 13v-3"/>',
    campanha:   '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
    copiar:     '<path d="M9 9h10v10H9z"/><path d="M5 15V5h10"/>',
    mestre:     '<path d="M4 8l3.5 4L12 5l4.5 7L20 8v10H4z"/><path d="M4 18h16"/>',
    mais:       '<path d="M12 5v14M5 12h14"/>',
    menos:      '<path d="M5 12h14"/>',
    remover:    '<path d="M6 6l12 12M18 6L6 18"/>',
    editar:     '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z"/><path d="M15 6l3 3"/>',
    faccao:     '<path d="M6 21V4"/><path d="M6 5h11l-2.5 3.5L17 12H6"/>',
    regua:      '<path d="M3 15.5L15.5 3l5.5 5.5L8.5 21z"/><path d="M7 11l2 2M10 8l2 2M13 5l2 2"/>',
    sair:       '<path d="M14 4H5v16h9"/><path d="M10 12h10M17 9l3 3-3 3"/>',
    parede:     '<path d="M3 5h18v14H3z"/><path d="M3 12h18M9 5v7M15 12v7"/>',
    chat:       '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
    mochila:    '<path d="M6 8a6 6 0 0 1 12 0v12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2M9 14h6"/>',
    nota:       '<path d="M5 3h10l4 4v14H5z"/><path d="M15 3v4h4M8 12h8M8 16h5"/>',
    imagem:     '<path d="M3 5h18v14H3z"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 15l-5-5-9 9"/>'
  },


  /* Devolve um <svg> pronto para pendurar na tela.
     Repare: nada de string de HTML. Montamos o elemento de verdade,
     então nunca há risco de um texto virar marcação por engano. */
  svg: function (nome, tamanho) {
    const corpo = Icone.traco[nome];
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    svg.setAttribute('class', 'ico');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', tamanho || 16);
    svg.setAttribute('height', tamanho || 16);
    svg.setAttribute('aria-hidden', 'true');

    /* Os desenhos são texto SVG fixo, escrito aqui em cima — nunca
       vêm de fora. Por isso innerHTML é seguro neste ponto: não há
       como um dado de usuário entrar nesta string. */
    if (corpo) svg.innerHTML = corpo;

    return svg;
  },


  /* Preenche todo elemento com data-ico="nome" do documento (ou de um
     pedaço dele). Serve para o HTML ficar limpo: em vez de colar um
     <svg> de 5 linhas no meio da marcação, escreve-se
     <span data-ico="dados"></span> e esta função resolve. */
  aplicar: function (raiz) {
    (raiz || document).querySelectorAll('[data-ico]').forEach(function (alvo) {
      if (alvo.dataset.pronto) return;          /* não repete */
      alvo.appendChild(Icone.svg(alvo.dataset.ico, Number(alvo.dataset.tamanho) || 16));
      alvo.dataset.pronto = '1';
    });
  }
};
