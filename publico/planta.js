/* ===================================================================
   planta.js — a planta da cena, só para olhar

   Desenha uma cena (paredes, imagem de fundo, marcadores, tokens) em
   SVG, a partir da MESMA grade que a tela de Mapas usa. Duas telas
   usam este arquivo:

     Visão Geral do Mestre   a miniatura no cartão da cena
     painel do jogador       a aba "Mesa"

   Antes, o desenho morava dentro do mestre.js. Quando o jogador
   precisou da mesma planta, havia duas saídas: copiar a função (e ter
   duas plantas que um dia desenham diferente) ou mover para cá. Mesma
   decisão do ficha.js: uma conta, um lugar.

   ESTE ARQUIVO NÃO ESCONDE NADA
   Ele desenha o que recebe. Se a cena vier sem marcadores — como vem
   na visão do jogador (visao.js) —, não há marcador para desenhar.
   Decidir o que cada um vê é trabalho da visão, nunca do desenho:
   esconder na hora de desenhar é esconder com CSS, e o dado já teria
   chegado ao navegador.

   A interação do Mestre (arrastar, medir, pintar parede) continua no
   mapas.js, que tem o próprio desenho com os eventos ligados. Aqui há
   só o ponto de apoio para o jogador andar: cada token num <g> com
   data-token, e o token "meu" (visao.js marca) pronto para ser pego —
   os eventos ficam no jogador-mesa.js.

   Uso:
     Planta.desenhar(cena)                          -> <svg>
     Planta.desenhar(cena, { destacar: 'Lyra' })    -> com um token aceso
     Planta.desenhar(cena, { andar: true })         -> o token meu pode ser pego
     Planta.desenharAreas(cena, ehMinha)            -> <g> com as áreas marcadas

   AS ÁREAS
   A "bola de fogo" (modelo.js, marcarAreaNaCena) se desenha aqui, e o
   mapas.js do Mestre chama a mesma função: o círculo que o Mestre vê é
   o mesmo que o jogador vê, casa por casa.
   =================================================================== */

const Planta = {

  desenhar: function (cena, opcoes) {
    const destacar = opcoes && opcoes.destacar;
    const andar = !!(opcoes && opcoes.andar);
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    const largura = cena.colunas * CELULA;
    const altura = cena.linhas * CELULA;

    svg.setAttribute('viewBox', '0 0 ' + largura + ' ' + altura);
    /* Com um token para pegar, o mapa é um grupo (um "img" esconde do
       leitor de tela tudo o que tem dentro, inclusive o botão). */
    svg.setAttribute('role', andar ? 'group' : 'img');
    svg.setAttribute('aria-label', 'Planta da cena: ' + cena.nome);

    function no(tag, atributos) {
      const elemento = document.createElementNS(NS, tag);
      Object.keys(atributos).forEach(function (chave) {
        elemento.setAttribute(chave, atributos[chave]);
      });
      return elemento;
    }

    /* Centro de uma célula. Os tokens ficam no meio da casa, não no
       canto dela — é o mesmo cálculo do mapas.js. */
    function centro(col, lin) {
      return { x: col * CELULA + CELULA / 2, y: lin * CELULA + CELULA / 2 };
    }

    svg.appendChild(no('rect', { x: 0, y: 0, width: largura, height: altura, fill: '#0a0c10' }));

    /* A imagem de fundo, se houver — a mesma checagem e o mesmo
       esticar da tela de Mapas. */
    const imagem = imagemDaCena(cena);
    if (imagem) {
      svg.appendChild(no('image', {
        href: imagem, x: 0, y: 0, width: largura, height: altura, preserveAspectRatio: 'none'
      }));
    }

    const grade = no('g', {});
    const traco = imagem ? 'rgba(0,0,0,.3)' : 'rgba(255,255,255,.04)';
    for (let c = 1; c < cena.colunas; c++) {
      grade.appendChild(no('line', {
        x1: c * CELULA, y1: 0, x2: c * CELULA, y2: altura, stroke: traco, 'stroke-width': 1
      }));
    }
    for (let l = 1; l < cena.linhas; l++) {
      grade.appendChild(no('line', {
        x1: 0, y1: l * CELULA, x2: largura, y2: l * CELULA, stroke: traco, 'stroke-width': 1
      }));
    }
    svg.appendChild(grade);

    /* A luz das tochas. É atmosfera, não dado — mas fica centrada no
       grupo, então ao menos aponta para onde a party está. */
    const herois = cena.tokens.filter(function (t) { return t.tipo === 'heroi'; });
    if (herois.length && !imagem) {
      const defs = document.createElementNS(NS, 'defs');
      const brilho = no('radialGradient', { id: 'luzTocha' });
      brilho.appendChild(no('stop', { offset: '0%', 'stop-color': 'rgba(77,141,255,.20)' }));
      brilho.appendChild(no('stop', { offset: '100%', 'stop-color': 'rgba(77,141,255,0)' }));
      defs.appendChild(brilho);
      svg.appendChild(defs);

      const meio = herois.reduce(function (soma, t) {
        const p = centro(t.col, t.lin);
        return { x: soma.x + p.x / herois.length, y: soma.y + p.y / herois.length };
      }, { x: 0, y: 0 });

      svg.appendChild(no('circle', { cx: meio.x, cy: meio.y, r: CELULA * 5, fill: 'url(#luzTocha)' }));
    }

    cena.paredes.forEach(function (p) {
      svg.appendChild(no('rect', {
        x: p[0] * CELULA, y: p[1] * CELULA,
        width: p[2] * CELULA, height: p[3] * CELULA,
        fill: '#1b1f27', stroke: 'rgba(255,255,255,.09)', 'stroke-width': 1, rx: 3
      }));
    });

    (cena.marcadores || []).forEach(function (marcador) {
      const p = centro(marcador.col, marcador.lin);
      const perigo = marcador.tipo === 'perigo';

      svg.appendChild(no('path', {
        d: 'M' + p.x + ' ' + (p.y - 15) + 'L' + (p.x + 15) + ' ' + p.y
         + 'L' + p.x + ' ' + (p.y + 15) + 'L' + (p.x - 15) + ' ' + p.y + 'Z',
        fill: perigo ? 'rgba(194,65,63,.25)' : 'rgba(77,141,255,.18)',
        stroke: perigo ? '#c2413f' : '#4d8dff', 'stroke-width': 1.5
      }));

      /* Só o marcador de perigo se explica na planta. O de nota é um
         lembrete do mestre — abrir em Mapas & Cenas. */
      if (perigo) {
        const texto = no('text', {
          x: p.x, y: p.y + 32, 'text-anchor': 'middle',
          fill: '#e0827d', 'font-size': 15, 'font-family': 'Inter, sans-serif'
        });
        texto.textContent = marcador.texto;
        svg.appendChild(texto);
      }
    });

    /* As áreas ficam por baixo dos tokens: quem está dentro continua à
       vista. */
    svg.appendChild(Planta.desenharAreas(cena));

    cena.tokens.forEach(function (token) {
      const p = centro(token.col, token.lin);
      const cores = {
        heroi:   { fundo: 'rgba(77,141,255,.9)',  aro: '#a9c4ff' },
        inimigo: { fundo: 'rgba(194,65,63,.9)',   aro: '#e0827d' },
        npc:     { fundo: 'rgba(120,128,148,.9)', aro: '#c7cddb' }
      };
      const cor = cores[token.tipo] || cores.npc;

      /* Cada token num grupo: arrastar é mover o grupo inteiro (círculo,
         letra e nome juntos). O meu, quando dá para andar, entra na
         ordem do Tab e diz o que faz — as setas também andam. */
      const grupo = no('g', { class: 'token-planta' });
      grupo.dataset.token = token.id;
      if (andar && token.meu) {
        grupo.setAttribute('class', 'token-planta token-meu');
        grupo.setAttribute('tabindex', '0');
        grupo.setAttribute('role', 'button');
        grupo.setAttribute('aria-label', token.nome + ': arraste, ou use as setas, para andar');
      }
      svg.appendChild(grupo);

      /* O token destacado (o personagem de quem está olhando) ganha um
         anel a mais — é o "você está aqui" do mapa. */
      if (token.meu || (destacar && token.nome === destacar)) {
        grupo.appendChild(no('circle', {
          class: 'anel-meu', cx: p.x, cy: p.y, r: CELULA / 2 + 3,
          fill: 'none', stroke: '#e6e8f0', 'stroke-width': 2, 'stroke-dasharray': '4 3'
        }));
      }

      grupo.appendChild(no('circle', {
        cx: p.x, cy: p.y, r: CELULA / 2 - 3,
        fill: cor.fundo, stroke: cor.aro, 'stroke-width': 2
      }));

      /* Mesma regra da tela de Mapas: inimigo ganha silhueta, herói
         e NPC ficam com a inicial. As telas leem o mesmo bichos.js,
         então não há como divergirem. */
      const desenho = token.tipo === 'inimigo' ? Bicho.para(token.nome) : null;
      const silhueta = desenho ? Bicho.noMapa(desenho, CELULA * 0.62) : null;

      if (silhueta) {
        silhueta.setAttribute('transform',
          'translate(' + p.x + ',' + p.y + ') ' + silhueta.getAttribute('transform'));
        silhueta.setAttribute('fill', '#0a0c10');
        grupo.appendChild(silhueta);
      } else {
        const letra = no('text', {
          x: p.x, y: p.y + 7, 'text-anchor': 'middle',
          fill: '#0a0c10', 'font-size': 20,
          'font-family': 'Marcellus, serif', 'font-weight': 'bold'
        });
        letra.textContent = token.inicial;
        grupo.appendChild(letra);
      }

      /* Só o primeiro nome: numa planta pequena os rótulos inteiros se
         atropelariam. */
      const nome = no('text', {
        x: p.x, y: p.y + CELULA / 2 + 16, 'text-anchor': 'middle',
        fill: 'rgba(230,232,240,.78)', 'font-size': 15, 'font-family': 'Inter, sans-serif'
      });
      nome.textContent = token.nome.split(' ')[0];
      grupo.appendChild(nome);
    });

    return svg;
  },


  /* As áreas da cena. As casas que cada uma pega (casasDaArea, no
     modelo.js — a mesma conta para todos) se acendem; o círculo vai por
     cima, com a etiqueta de quem marcou e o raio. A minha (a do
     jogador olhando, ou a do Mestre na tela dele) tem traço cheio e
     casas mais acesas; as dos outros, pontilhado. Nada aqui recebe
     clique: o mapa embaixo continua respondendo. */
  desenharAreas: function (cena, ehMinha) {
    const NS = 'http://www.w3.org/2000/svg';
    function no(tag, atributos) {
      const elemento = document.createElementNS(NS, tag);
      Object.keys(atributos).forEach(function (chave) { elemento.setAttribute(chave, atributos[chave]); });
      return elemento;
    }
    const camada = no('g', { class: 'areas-planta', 'pointer-events': 'none' });

    (cena.areas || []).forEach(function (area) {
      const minha = ehMinha ? ehMinha(area) : !!area.minha;
      const grupo = no('g', {});

      casasDaArea(area, cena).forEach(function (casa) {
        grupo.appendChild(no('rect', {
          x: casa.col * CELULA + 1, y: casa.lin * CELULA + 1, width: CELULA - 2, height: CELULA - 2, rx: 3,
          fill: minha ? 'rgba(77,141,255,.22)' : 'rgba(77,141,255,.12)'
        }));
      });

      const cx = area.x * CELULA;
      const cy = area.y * CELULA;
      const r = area.raio / METROS_POR_CELULA * CELULA;
      grupo.appendChild(no('circle', {
        cx: cx, cy: cy, r: r, fill: 'rgba(77,141,255,.05)',
        stroke: '#4d8dff', 'stroke-width': 2, 'stroke-dasharray': minha ? 'none' : '7 5'
      }));
      grupo.appendChild(no('circle', { cx: cx, cy: cy, r: 4, fill: '#4d8dff' }));

      /* A etiqueta, na pílula da régua do Mestre: em cima do círculo;
         sem lugar em cima, embaixo; sem lugar nos dois (uma área maior
         que o mapa), logo acima do centro — sempre dentro da planta. */
      const texto = String(area.nome || '').split(' ')[0] + ' · ' + String(area.raio).replace('.', ',') + ' m';
      const largura = texto.length * 7 + 22;
      const altura = cena.linhas * CELULA;
      let y = cy - r - 16;
      if (y < 14) y = cy + r + 18 <= altura - 14 ? cy + r + 18 : Math.max(14, cy - 24);
      /* …e na largura: perto da borda esquerda ou direita, a pílula
         encosta na borda em vez de sair pela metade. */
      const x = Math.min(Math.max(cx, largura / 2 + 2), cena.colunas * CELULA - largura / 2 - 2);
      grupo.appendChild(no('rect', {
        x: x - largura / 2, y: y - 13, width: largura, height: 24, rx: 12,
        fill: 'rgba(8,9,11,.9)', stroke: 'rgba(77,141,255,.5)', 'stroke-width': 1
      }));
      const etiqueta = no('text', {
        x: x, y: y + 4, 'text-anchor': 'middle',
        fill: '#a9c4ff', 'font-size': 12, 'font-family': 'Marcellus, serif'
      });
      etiqueta.textContent = texto;
      grupo.appendChild(etiqueta);

      camada.appendChild(grupo);
    });
    return camada;
  }
};
