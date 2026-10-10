/* ===================================================================
   mapas.js — a planta da cena, com tokens arrastáveis

   O QUE É NOVO AQUI EM RELAÇÃO ÀS OUTRAS TELAS

   1. Desenho em SVG a partir da grade. Cada célula tem CELULA
      unidades de lado no SVG; as posições no Estado são em células
      (col, lin), nunca em pixels. O SVG se estica com a tela e as
      posições continuam valendo.

   2. Arrastar. Três eventos: pointerdown (pega), pointermove (move),
      pointerup (solta). Usa Pointer Events, e não mouse+touch
      separados, porque um conjunto só já cobre mouse, dedo e caneta.

   3. Conversão de coordenadas. A posição do ponteiro vem em pixels da
      TELA; o SVG tem o sistema dele, possivelmente escalado. Converter
      não é subtrair a posição da borda: é aplicar a matriz de
      transformação que o próprio navegador calcula. Ver pontoNoMapa().

   4. setPointerCapture. Sem isso, mover o mouse rápido demais faz o
      ponteiro "escapar" do token e o arrasto morre no meio. Com a
      captura, os eventos continuam chegando ao token até soltar.

   SOBRE A DISTÂNCIA
   A régua usa a regra padrão do PHB: cada célula é 1,5 m, e a
   diagonal conta como uma célula (não como 1,41). Por isso a conta é
   o MAIOR entre os deslocamentos, e não a hipotenusa.

   CRIAR CENAS E DESENHAR PAREDES
   "Nova cena" abre uma janela (<dialog> no mapas.html) com nome,
   tamanho e uma imagem de fundo opcional. As paredes se desenham na
   própria planta, com a ferramenta Parede: clicar numa célula vazia
   põe parede, numa ocupada tira — e arrastar continua fazendo o mesmo
   que o primeiro clique fez. Ver "Paredes" mais abaixo para entender
   por que elas viram células enquanto se pinta.

   A IMAGEM DE FUNDO
   Sem servidor, ela vai para o localStorage junto com a campanha. Por
   isso é recomprimida antes (Imagens.comprimir, no imagens.js): reduzida e salva em
   JPEG, fica em algumas centenas de KB em vez de vários MB. Mesmo
   assim o espaço do navegador acaba — e, se acabar, a janela desfaz a
   mudança e avisa, em vez de deixar a campanha pela metade.
   =================================================================== */

/* O limite de tamanho de uma imagem de mapa está no imagens.js
   (Imagens.PERFIS.mapa): a compressão mora lá, junto com a dos retratos. */

/* CELULA e METROS_POR_CELULA vêm do dados.js, que carrega antes desta
   tela. Ficavam declaradas aqui, mas a Visão Geral desenha a mesma
   planta: dois arquivos com o próprio 40 é um convite a divergirem. */


const Mapa = {

  svg: null,
  ferramenta: 'mover',      /* 'mover' | 'medir' | 'marcar' | 'parede' */
  selecionado: null,        /* id do token selecionado */
  mostrarGrade: true,

  /* Estado do arrasto em andamento. */
  arrasto: null,

  /* Pintura de paredes em andamento: { celulas, valor, ultima }. */
  pintura: null,

  /* A janela de cena: 'nova' ou 'editar', e a imagem escolhida nela
     (undefined = não mexeu; null = tirou; texto = imagem nova). */
  janela: null,
  imagemEscolhida: undefined,

  /* Estado da régua: {de:{col,lin}, para:{col,lin}} */
  regua: null,


  iniciar: function () {
    this.render();
  },


  /* ---------- Acesso aos dados ---------- */

  cena: function () {
    const self = this;
    return Estado.cenas.find(function (c) { return c.id === Estado.cenaAtual; })
      || Estado.cenas[0];
  },

  token: function (id) {
    return this.cena().tokens.find(function (t) { return t.id === id; });
  },


  /* ---------- Desenho ---------- */

  render: function () {
    /* Campanha nova não tem cena nenhuma, e todo o resto deste arquivo
       parte do princípio de que cena() devolve uma. Melhor parar aqui
       com um aviso do que deixar cada função quebrar do seu jeito. */
    const semCena = !this.cena();

    /* Sem cena, o quadro do mapa, as ferramentas, o painel do token e
       os marcadores não têm o que mostrar — some tudo, em vez de
       sobrar caixa vazia. Fica só a lista de cenas, com o aviso. */
    ['quadro', 'ferramentas', 'blocoToken', 'seloVisibilidade'].forEach(function (id) {
      document.getElementById(id).hidden = semCena;
    });
    document.getElementById('listaMarcadores').closest('.bloco-lateral').hidden = semCena;

    if (semCena) {
      this.renderSemCena();
      return;
    }

    this.renderCabecalho();
    this.renderFerramentas();
    this.renderMapa();
    this.renderCenas();
    this.renderToken();
    this.renderMarcadores();
  },


  /* Não há o que mover, medir ou marcar (render() já escondeu essas
     partes). Sobra a lista de cenas — vazia, com o botão de criar. */
  renderSemCena: function () {
    document.getElementById('nomeCena').textContent = 'Nenhuma cena';
    document.getElementById('resumoCena').textContent = 'Esta campanha ainda não tem mapas. Crie a primeira em "Nova cena".';
    this.renderCenas();
  },


  renderCabecalho: function () {
    const cena = this.cena();

    document.getElementById('nomeCena').textContent = cena.nome;

    /* Visibilidade é opcional na janela de cena: sem ela, o selo some
       em vez de virar uma pílula vazia. */
    const selo = document.getElementById('seloVisibilidade');
    selo.textContent = cena.visibilidade || '';
    selo.hidden = !cena.visibilidade;

    const herois = cena.tokens.filter(function (t) { return t.tipo === 'heroi'; }).length;
    const inimigos = cena.tokens.filter(function (t) { return t.tipo === 'inimigo'; }).length;

    document.getElementById('resumoCena').textContent =
      cena.colunas + ' × ' + cena.linhas + ' células · '
      + Math.round(cena.colunas * METROS_POR_CELULA) + ' × ' + Math.round(cena.linhas * METROS_POR_CELULA) + ' m · '
      + herois + ' heróis · ' + inimigos + ' inimigos';
  },


  renderFerramentas: function () {
    const self = this;
    const area = document.getElementById('ferramentas');
    area.textContent = '';

    [
      { id: 'mover',  ico: 'passo',  texto: 'Mover' },
      { id: 'medir',  ico: 'regua',  texto: 'Medir' },
      { id: 'marcar', ico: 'alerta', texto: 'Marcar' },
      { id: 'parede', ico: 'parede', texto: 'Parede' }
    ].forEach(function (ferramenta) {
      const botao = criar('button.filtro' + (self.ferramenta === ferramenta.id ? '.ativo' : ''));
      botao.type = 'button';
      botao.dataset.acao = 'ferramenta';
      botao.dataset.valor = ferramenta.id;
      botao.style.cssText = 'display:inline-flex;align-items:center;gap:7px;padding:8px 13px';
      botao.appendChild(Icone.svg(ferramenta.ico, 14));
      botao.appendChild(criar('span', ferramenta.texto));
      area.appendChild(botao);
    });

    area.appendChild(criar('div.separador-vertical'));

    area.appendChild(criarBotao('mini-botao', 'trazer', 'npcs', 'Trazer combatentes'));
    area.appendChild(criarBotao('mini-botao', 'grade', 'tabelas', this.mostrarGrade ? 'Ocultar grade' : 'Mostrar grade'));

    if (this.regua) {
      area.appendChild(criarBotao('mini-botao', 'limpar-regua', 'remover', 'Limpar medição'));
    }
  },


  renderMapa: function () {
    const cena = this.cena();
    const quadro = document.getElementById('quadro');

    /* Tira o SVG antigo, mas preserva a legenda (que é HTML). */
    const antigo = quadro.querySelector('svg');
    if (antigo) antigo.remove();

    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    const largura = cena.colunas * CELULA;
    const altura = cena.linhas * CELULA;

    svg.setAttribute('viewBox', '0 0 ' + largura + ' ' + altura);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Planta da cena: ' + cena.nome);

    function no(tag, atributos) {
      const elemento = document.createElementNS(NS, tag);
      Object.keys(atributos).forEach(function (chave) {
        elemento.setAttribute(chave, atributos[chave]);
      });
      return elemento;
    }
    this.no = no;

    /* chão */
    svg.appendChild(no('rect', { x: 0, y: 0, width: largura, height: altura, fill: '#0a0c10' }));

    /* imagem de fundo, esticada para cobrir a grade inteira. Por isso
       a janela de cena ajusta as linhas à proporção da imagem: com a
       proporção certa, esticar não deforma nada. */
    const imagem = imagemDaCena(cena);
    if (imagem) {
      svg.appendChild(no('image', {
        href: imagem, x: 0, y: 0, width: largura, height: altura, preserveAspectRatio: 'none'
      }));
    }

    /* grade — mais visível sobre imagem, onde a de .05 sumiria */
    if (this.mostrarGrade) {
      const grade = no('g', {});
      const traco = imagem ? 'rgba(0,0,0,.35)' : 'rgba(255,255,255,.05)';
      for (let c = 1; c < cena.colunas; c++) {
        grade.appendChild(no('line', {
          x1: c * CELULA, y1: 0, x2: c * CELULA, y2: altura,
          stroke: traco, 'stroke-width': 1
        }));
      }
      for (let l = 1; l < cena.linhas; l++) {
        grade.appendChild(no('line', {
          x1: 0, y1: l * CELULA, x2: largura, y2: l * CELULA,
          stroke: traco, 'stroke-width': 1
        }));
      }
      svg.appendChild(grade);
    }

    /* paredes */
    cena.paredes.forEach(function (p) {
      svg.appendChild(no('rect', {
        x: p[0] * CELULA, y: p[1] * CELULA,
        width: p[2] * CELULA, height: p[3] * CELULA,
        fill: '#1b1f27', stroke: 'rgba(255,255,255,.09)', 'stroke-width': 1, rx: 3
      }));
    });

    /* marcadores */
    cena.marcadores.forEach(function (marcador) {
      const x = marcador.col * CELULA + CELULA / 2;
      const y = marcador.lin * CELULA + CELULA / 2;
      const perigo = marcador.tipo === 'perigo';

      const grupo = no('g', {});
      grupo.appendChild(no('path', {
        d: 'M' + x + ' ' + (y - 13) + 'L' + (x + 13) + ' ' + y + 'L' + x + ' ' + (y + 13) + 'L' + (x - 13) + ' ' + y + 'Z',
        fill: perigo ? 'rgba(194,65,63,.25)' : 'rgba(77,141,255,.18)',
        stroke: perigo ? '#c2413f' : '#4d8dff',
        'stroke-width': 1.5
      }));

      const letra = no('text', {
        x: x, y: y + 4, 'text-anchor': 'middle',
        fill: perigo ? '#e0827d' : '#a9c4ff',
        'font-size': 13, 'font-family': 'Inter, sans-serif', 'font-weight': 'bold'
      });
      letra.textContent = perigo ? '!' : 'i';
      grupo.appendChild(letra);

      svg.appendChild(grupo);
    });

    /* tokens */
    const self = this;
    cena.tokens.forEach(function (token) {
      svg.appendChild(self.desenharToken(token));
    });

    /* régua */
    if (this.regua) svg.appendChild(this.desenharRegua());

    quadro.appendChild(svg);
    this.svg = svg;

    quadro.classList.toggle('medindo', this.ferramenta === 'medir');
    quadro.classList.toggle('marcando', this.ferramenta === 'marcar');
    quadro.classList.toggle('pintando', this.ferramenta === 'parede');

    this.ligarMapa();
    this.renderLegenda();
  },


  desenharToken: function (token) {
    const no = this.no;
    const x = token.col * CELULA + CELULA / 2;
    const y = token.lin * CELULA + CELULA / 2;

    const cores = {
      heroi:   { fundo: 'rgba(77,141,255,.9)',  aro: '#a9c4ff' },
      inimigo: { fundo: 'rgba(194,65,63,.9)',   aro: '#e0827d' },
      npc:     { fundo: 'rgba(120,128,148,.9)', aro: '#c7cddb' }
    };
    const cor = cores[token.tipo] || cores.npc;

    const grupo = no('g', {
      class: 'token-mapa' + (this.selecionado === token.id ? ' selecionado' : ''),
      transform: 'translate(' + x + ',' + y + ')'
    });
    grupo.dataset.token = token.id;

    grupo.appendChild(no('circle', {
      class: 'aro', cx: 0, cy: 0, r: CELULA / 2 - 4,
      fill: cor.fundo, stroke: cor.aro, 'stroke-width': 1.8
    }));

    /* A silhueta entra no lugar da inicial quando a criatura tem uma.

       Só inimigo: herói e NPC são pessoas com nome, e um bonequinho
       genérico diria menos que o "K" de Kaelen. Monstro é o contrário
       — o nome muda ("Aparição Sombria Alpha"), a espécie não. */
    const desenho = token.tipo === 'inimigo' ? Bicho.para(token.nome) : null;
    const silhueta = desenho ? Bicho.noMapa(desenho, CELULA * 0.62) : null;

    if (silhueta) {
      silhueta.setAttribute('fill', '#0a0c10');
      grupo.appendChild(silhueta);
    } else {
      const letra = no('text', {
        x: 0, y: 5, 'text-anchor': 'middle',
        fill: '#0a0c10', 'font-size': 15,
        'font-family': 'Marcellus, serif', 'font-weight': 'bold'
      });
      letra.textContent = token.inicial;
      grupo.appendChild(letra);
    }

    const nome = no('text', {
      x: 0, y: CELULA / 2 + 10, 'text-anchor': 'middle',
      fill: 'rgba(230,232,240,.8)', 'font-size': 9, 'font-family': 'Inter, sans-serif'
    });
    /* Só o primeiro nome, senão os rótulos se atropelam. */
    nome.textContent = token.nome.split(' ')[0];
    grupo.appendChild(nome);

    return grupo;
  },


  desenharRegua: function () {
    const no = this.no;
    const r = this.regua;

    const x1 = r.de.col * CELULA + CELULA / 2;
    const y1 = r.de.lin * CELULA + CELULA / 2;
    const x2 = r.para.col * CELULA + CELULA / 2;
    const y2 = r.para.lin * CELULA + CELULA / 2;

    const grupo = no('g', { 'pointer-events': 'none' });

    grupo.appendChild(no('line', {
      x1: x1, y1: y1, x2: x2, y2: y2,
      stroke: '#4d8dff', 'stroke-width': 2.5, 'stroke-dasharray': '7 5'
    }));
    grupo.appendChild(no('circle', { cx: x1, cy: y1, r: 5, fill: '#4d8dff' }));
    grupo.appendChild(no('circle', { cx: x2, cy: y2, r: 5, fill: '#4d8dff' }));

    /* A etiqueta com a distância, no meio da linha. */
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const texto = this.distancia() + ' m';

    grupo.appendChild(no('rect', {
      x: mx - 26, y: my - 13, width: 52, height: 24, rx: 12,
      fill: 'rgba(8,9,11,.9)', stroke: 'rgba(77,141,255,.5)', 'stroke-width': 1
    }));

    const etiqueta = no('text', {
      x: mx, y: my + 4, 'text-anchor': 'middle',
      fill: '#a9c4ff', 'font-size': 12, 'font-family': 'Marcellus, serif'
    });
    etiqueta.textContent = texto;
    grupo.appendChild(etiqueta);

    return grupo;
  },


  /* Regra do PHB: a diagonal custa uma célula, igual à reta. Por isso
     a distância é o MAIOR dos dois deslocamentos, não a hipotenusa. */
  distancia: function () {
    if (!this.regua) return 0;

    const dx = Math.abs(this.regua.para.col - this.regua.de.col);
    const dy = Math.abs(this.regua.para.lin - this.regua.de.lin);

    return (Math.max(dx, dy) * METROS_POR_CELULA).toFixed(1).replace('.', ',');
  },


  renderLegenda: function () {
    const cena = this.cena();
    const legenda = document.getElementById('legenda');
    legenda.textContent = '';

    if (cena.visibilidade) legenda.appendChild(criar('span.mapa-selo', cena.visibilidade));

    const inimigos = cena.tokens.filter(function (t) { return t.tipo === 'inimigo'; }).length;
    if (inimigos > 0) {
      legenda.appendChild(criar('span.mapa-selo.perigo',
        inimigos + (inimigos === 1 ? ' inimigo em campo' : ' inimigos em campo')));
    }
  },


  renderCenas: function () {
    const area = document.getElementById('listaCenas');
    const aberta = this.cena();
    area.textContent = '';

    if (!Estado.cenas.length) {
      const vazio = criar('div.vazio', 'Nenhuma cena ainda.');
      vazio.style.padding = '14px';
      area.appendChild(vazio);
    }

    Estado.cenas.forEach(function (cena) {
      const botao = criar('button.item-cena' + (aberta && cena.id === aberta.id ? '.ativa' : ''));
      botao.type = 'button';
      botao.dataset.acao = 'cena';
      botao.dataset.id = cena.id;

      botao.appendChild(Icone.svg(imagemDaCena(cena) ? 'imagem' : 'mapa', 15));
      botao.appendChild(criar('span', cena.nome));
      botao.appendChild(criar('span.contagem', cena.tokens.length + ' tokens'));

      area.appendChild(botao);
    });

    /* Criar vale sempre; editar e apagar valem para a cena aberta. */
    const botoes = [criarBotao('mini-botao', 'nova-cena', 'mais', 'Nova cena')];
    if (aberta) {
      botoes.push(criarBotao('mini-botao', 'editar-cena', 'editar', 'Editar'));
      botoes.push(criarBotao('mini-botao.perigo-leve', 'apagar-cena', 'remover', 'Apagar'));
    }
    area.appendChild(criar('div.linha-botoes.botoes-cena', botoes));
  },


  renderToken: function () {
    const bloco = document.getElementById('blocoToken');
    bloco.textContent = '';

    const token = this.selecionado ? this.token(this.selecionado) : null;

    if (!token) {
      bloco.appendChild(criarComIcone('h2', 'npcs', 'Token', 16));
      const vazio = criar('div.vazio', 'Clique num token para ver e mover.');
      vazio.style.border = '0';
      vazio.style.padding = '10px 0 0';
      bloco.appendChild(vazio);
      return;
    }

    bloco.appendChild(criarComIcone('h2', 'npcs', 'Token', 16));

    const ficha = criar('div.ficha-token', [
      criar('div.nome', token.nome),
      criar('div.posicao', 'Coluna ' + (token.col + 1) + ', linha ' + (token.lin + 1))
    ]);

    /* Se este token é alguém do combate, mostra a vida — o dado mora
       lá, e aqui a gente só reflete. */
    const combatente = Estado.combate.combatentes.find(function (c) {
      return c.nome === token.nome;
    });

    if (combatente) {
      const proporcao = combatente.pv / combatente.pvMax;
      const faixa = proporcao > .6 ? '' : (proporcao > .3 ? '.media' : '.baixa');

      ficha.appendChild(criar('div.linha-vida', [
        criar('span', 'Pontos de vida'),
        criar('span.numeros', combatente.pv + ' / ' + combatente.pvMax)
      ]));

      const preenchimento = criar('div.preenchimento' + faixa);
      preenchimento.style.width = Math.max(0, proporcao * 100) + '%';
      ficha.appendChild(criar('div.barra', preenchimento));
    }

    bloco.appendChild(ficha);

    bloco.appendChild(criar('div.linha-botoes', [
      criarBotao('mini-botao', 'centro', 'mapa', 'Ao centro'),
      criarBotao('mini-botao', 'tirar-token', 'remover', 'Tirar do mapa')
    ]));
  },


  renderMarcadores: function () {
    const cena = this.cena();
    const area = document.getElementById('listaMarcadores');
    area.textContent = '';

    if (cena.marcadores.length === 0) {
      const vazio = criar('div.vazio', 'Nenhum marcador. Use a ferramenta Marcar e clique no mapa.');
      vazio.style.border = '0';
      vazio.style.padding = '0';
      area.appendChild(vazio);
      return;
    }

    cena.marcadores.forEach(function (marcador) {
      const item = criar('div.item-marcador' + (marcador.tipo === 'perigo' ? '.perigo' : ''));
      item.appendChild(Icone.svg(marcador.tipo === 'perigo' ? 'alerta' : 'diario', 14));

      /* O texto é editável no lugar — sem abrir formulário para uma
         linha só. O 'change' salva quando o campo perde o foco. */
      const entrada = document.createElement('input');
      entrada.type = 'text';
      entrada.className = 'texto';
      entrada.value = marcador.texto;
      entrada.dataset.marcador = marcador.id;
      entrada.style.cssText = 'background:transparent;border:0;color:inherit;font:inherit;width:100%;padding:0';
      item.appendChild(entrada);

      const tirar = criar('button.tirar', '×');
      tirar.type = 'button';
      tirar.dataset.acao = 'tirar-marcador';
      tirar.dataset.id = marcador.id;
      tirar.setAttribute('aria-label', 'Remover marcador');
      item.appendChild(tirar);

      area.appendChild(item);
    });
  },


  /* ---------- Coordenadas ----------
     Converte a posição do ponteiro (pixels da tela) para o sistema de
     coordenadas de dentro do SVG.

     Não dá para simplesmente subtrair a posição da borda: o SVG pode
     estar escalado (ele é responsivo). getScreenCTM() devolve a matriz
     que o navegador usou para desenhar; invertê-la desfaz a conta. */

  pontoNoMapa: function (evento) {
    const ponto = this.svg.createSVGPoint();
    ponto.x = evento.clientX;
    ponto.y = evento.clientY;

    const matriz = this.svg.getScreenCTM();
    if (!matriz) return { x: 0, y: 0 };

    return ponto.matrixTransform(matriz.inverse());
  },


  /* Do ponto no SVG para a célula da grade, já presa às bordas. */
  celulaDoPonto: function (ponto) {
    const cena = this.cena();
    return {
      col: Math.max(0, Math.min(cena.colunas - 1, Math.floor(ponto.x / CELULA))),
      lin: Math.max(0, Math.min(cena.linhas - 1, Math.floor(ponto.y / CELULA)))
    };
  },


  /* ---------- Eventos do mapa ---------- */

  ligarMapa: function () {
    const self = this;
    const svg = this.svg;

    svg.addEventListener('pointerdown', function (evento) {
      const grupo = evento.target.closest('.token-mapa');

      /* Ferramenta medir: o clique começa uma medição. */
      if (self.ferramenta === 'medir') {
        const celula = self.celulaDoPonto(self.pontoNoMapa(evento));
        self.regua = { de: celula, para: celula };
        self.medindo = true;
        try { svg.setPointerCapture(evento.pointerId); } catch (erro) { /* segue sem captura */ }
        self.renderMapa();
        self.atualizarLeituraRegua();
        return;
      }

      /* Ferramenta marcar: o clique cria um marcador. */
      if (self.ferramenta === 'marcar') {
        const celula = self.celulaDoPonto(self.pontoNoMapa(evento));
        self.criarMarcador(celula);
        return;
      }

      /* Ferramenta parede: o PRIMEIRO clique decide se este gesto põe
         ou tira — célula vazia, põe; com parede, tira. O arrasto
         continua fazendo a mesma coisa, para não virar um pisca-pisca
         de parede-sim, parede-não ao passar por cima do que já existe. */
      if (self.ferramenta === 'parede') {
        evento.preventDefault();
        const celula = self.celulaDoPonto(self.pontoNoMapa(evento));
        const chave = celula.col + ',' + celula.lin;
        const celulas = self.celulasDeParede(self.cena());

        self.pintura = { celulas: celulas, valor: !celulas.has(chave), ultima: null };
        try { svg.setPointerCapture(evento.pointerId); } catch (erro) { /* segue sem captura */ }
        self.pintar(celula);
        return;
      }

      /* Ferramenta mover: só faz algo se pegou um token. */
      if (!grupo) {
        if (self.selecionado) { self.selecionado = null; self.render(); }
        return;
      }

      evento.preventDefault();

      const token = self.token(grupo.dataset.token);
      self.selecionado = token.id;

      /* Guarda a diferença entre o centro do token e onde o ponteiro
         pegou, para o token não "pular" para debaixo do cursor. */
      const ponto = self.pontoNoMapa(evento);
      self.arrasto = {
        id: token.id,
        grupo: grupo,
        dx: ponto.x - (token.col * CELULA + CELULA / 2),
        dy: ponto.y - (token.lin * CELULA + CELULA / 2),
        moveu: false
      };

      /* Sem a captura, um movimento rápido faz o ponteiro escapar do
         token e o arrasto morre no meio. O try/catch existe porque
         alguns navegadores recusam a captura de um ponteiro que já
         não está ativo — e nesse caso o arrasto ainda funciona, só
         fica mais sensível a movimentos bruscos. */
      try { grupo.setPointerCapture(evento.pointerId); } catch (erro) { /* segue sem captura */ }
      self.renderToken();
    });

    svg.addEventListener('pointermove', function (evento) {
      /* Medindo: atualiza a ponta da régua. */
      if (self.medindo) {
        const celula = self.celulaDoPonto(self.pontoNoMapa(evento));
        if (celula.col === self.regua.para.col && celula.lin === self.regua.para.lin) return;

        self.regua.para = celula;
        self.renderMapa();
        self.atualizarLeituraRegua();
        return;
      }

      /* Pintando parede: cada célula nova sob o ponteiro. Se nenhum
         botão está apertado, o mouse foi solto FORA do mapa (e o
         pointerup não chegou aqui): a pincelada acabou. Sem isto,
         passar o mouse por cima depois continuaria pintando sozinho. */
      if (self.pintura) {
        if (evento.buttons === 0) { soltar(evento); return; }
        self.pintar(self.celulaDoPonto(self.pontoNoMapa(evento)));
        return;
      }

      if (!self.arrasto) return;

      /* Durante o arrasto NÃO redesenhamos o mapa inteiro: só movemos
         o grupo do token. Redesenhar a cada pixel deixaria pesado. */
      const ponto = self.pontoNoMapa(evento);
      self.arrasto.moveu = true;
      self.arrasto.grupo.setAttribute('transform',
        'translate(' + (ponto.x - self.arrasto.dx) + ',' + (ponto.y - self.arrasto.dy) + ')');
    });

    function soltar(evento) {
      if (self.medindo) {
        self.medindo = false;
        return;
      }

      /* Grava só ao soltar: a pincelada inteira vira UMA ação
         (definirParedes). Durante a pincelada, as paredes mudam só na
         memória desta tela, para o desenho acompanhar o mouse — com
         servidor, os outros veem a pincelada pronta, e não dezenas de
         pedidos por segundo. Se a ação recusar, volta ao gravado. */
      if (self.pintura) {
        self.pintura = null;
        const cena = self.cena();
        if (Acoes.executar('definirParedes', { cenaId: cena.id, paredes: cena.paredes }).erro) Memoria.carregar();
        self.render();
        return;
      }

      if (!self.arrasto) return;

      const arrasto = self.arrasto;
      self.arrasto = null;

      if (!arrasto.moveu) {
        /* Foi um clique, não um arrasto: só selecionar. */
        self.render();
        return;
      }

      /* Solta: encaixa na célula mais próxima do centro do token. */
      const ponto = self.pontoNoMapa(evento);
      const token = self.token(arrasto.id);
      const celula = self.celulaDoPonto({
        x: ponto.x - arrasto.dx,
        y: ponto.y - arrasto.dy
      });

      Acoes.executar('moverToken', { cenaId: self.cena().id, id: token.id, col: celula.col, lin: celula.lin });
      self.render();
    }

    svg.addEventListener('pointerup', soltar);
    svg.addEventListener('pointercancel', soltar);
  },


  atualizarLeituraRegua: function () {
    /* A leitura fica no painel do token, quando há medição em curso. */
    const bloco = document.getElementById('blocoToken');
    bloco.textContent = '';
    bloco.appendChild(criarComIcone('h2', 'regua', 'Medição', 16));

    bloco.appendChild(criar('div.leitura-regua', [
      criar('div.distancia', this.distancia() + ' m'),
      criar('div.detalhe', 'Diagonal conta como uma célula (regra do PHB)')
    ]));
  },


  /* ---------- Ações ---------- */

  criarMarcador: function (celula) {
    const r = Acoes.executar('criarMarcador', { cenaId: this.cena().id, col: celula.col, lin: celula.lin });
    if (r.erro) { Layout.recado(r.erro, true); return; }
    this.render();
    Layout.recado('Marcador criado. Escreva o que ele é na lista ao lado.');
  },


  /* Traz para o mapa quem está no combate e ainda não tem token —
     onde cada um cai é regra da ação (celulaLivre, no acoes.js). */
  trazerCombatentes: function () {
    const r = Acoes.executar('trazerCombatentesAoMapa', { cenaId: this.cena().id });
    if (r.erro) { Layout.recado(r.erro); return; }
    this.render();
    Layout.recado(r.entraram + (r.entraram === 1 ? ' token entrou' : ' tokens entraram') + ' no mapa.');
  },


  trocarCena: function (id) {
    const r = Acoes.executar('escolherCena', { id: id });
    if (r.erro) return;
    this.selecionado = null;
    this.regua = null;
    this.render();
    Layout.recado('Cena: ' + r.nome + '.');
  },


  tirarToken: function () {
    const token = this.token(this.selecionado);
    if (!token) return;
    const r = Acoes.executar('tirarToken', { cenaId: this.cena().id, id: token.id });
    if (r.erro) return;
    this.selecionado = null;
    this.render();
    Layout.recado(r.nome + ' saiu do mapa.');
  },


  aoCentro: function () {
    const cena = this.cena();
    const token = this.token(this.selecionado);
    if (!token) return;
    Acoes.executar('moverToken', { cenaId: cena.id, id: token.id, col: Math.floor(cena.colunas / 2), lin: Math.floor(cena.linhas / 2) });
    this.render();
  },


  tirarMarcador: function (id) {
    Acoes.executar('tirarMarcador', { cenaId: this.cena().id, id: id });
    this.render();
  },


  /* ===================================================================
     PAREDES

     No Estado, uma parede é um retângulo [coluna, linha, largura,
     altura]: uma muralha de 24 células é UM item, não 24. Ótimo para
     guardar e para desenhar — péssimo para tirar uma célula do meio.

     Por isso, enquanto se pinta, as paredes viram um CONJUNTO de
     células ("3,5", "4,5"...), onde pôr e tirar é uma linha. A cada
     célula pintada, o conjunto volta a ser retângulos: células
     vizinhas na mesma linha se juntam numa faixa só. O resto do código
     (o desenho, celulaLivre) continua vendo retângulos e nem sabe que
     a pintura existe.
     =================================================================== */

  celulasDeParede: function (cena) {
    const celulas = new Set();
    cena.paredes.forEach(function (p) {
      for (let c = p[0]; c < p[0] + p[2]; c++) {
        for (let l = p[1]; l < p[1] + p[3]; l++) {
          if (c >= 0 && l >= 0 && c < cena.colunas && l < cena.linhas) celulas.add(c + ',' + l);
        }
      }
    });
    return celulas;
  },

  /* Varre linha por linha juntando as células seguidas em faixas. O
     laço vai até `colunas` (uma casa além da última) para a faixa que
     encosta na borda direita também ser fechada. */
  paredesDeCelulas: function (celulas, cena) {
    const paredes = [];
    for (let l = 0; l < cena.linhas; l++) {
      let inicio = -1;
      for (let c = 0; c <= cena.colunas; c++) {
        const tem = c < cena.colunas && celulas.has(c + ',' + l);
        if (tem && inicio === -1) inicio = c;
        if (!tem && inicio !== -1) {
          paredes.push([inicio, l, c - inicio, 1]);
          inicio = -1;
        }
      }
    }
    return paredes;
  },

  /* Uma célula da pincelada. `ultima` evita refazer o desenho enquanto
     o ponteiro se mexe dentro da mesma célula. */
  pintar: function (celula) {
    const p = this.pintura;
    const chave = celula.col + ',' + celula.lin;
    if (chave === p.ultima) return;
    p.ultima = chave;

    if (p.valor) p.celulas.add(chave);
    else p.celulas.delete(chave);

    const cena = this.cena();
    cena.paredes = this.paredesDeCelulas(p.celulas, cena);
    this.renderMapa();
  },

  /* ===================================================================
     A JANELA DE CENA (criar e editar)
     =================================================================== */

  abrirJanela: function (modo) {
    const cena = modo === 'editar' ? this.cena() : null;
    if (modo === 'editar' && !cena) return;

    this.janela = modo;
    this.imagemEscolhida = undefined;

    document.getElementById('tituloDialogoCena').textContent = cena ? 'Editar cena' : 'Nova cena';
    document.getElementById('salvarCena').textContent = cena ? 'Salvar' : 'Criar cena';
    document.getElementById('linhaContorno').hidden = !!cena;

    document.getElementById('cenaNome').value = cena ? cena.nome : '';
    document.getElementById('cenaVisibilidade').value = cena ? (cena.visibilidade || '') : '';
    document.getElementById('cenaColunas').value = cena ? cena.colunas : 20;
    document.getElementById('cenaLinhas').value = cena ? cena.linhas : 12;
    document.getElementById('cenaContorno').checked = true;
    document.getElementById('cenaImagem').value = '';
    document.getElementById('erroCena').textContent = '';

    this.mostrarPrevia(cena ? imagemDaCena(cena) : null, 'Imagem atual desta cena');
    this.atualizarMedida();

    document.getElementById('dialogoCena').showModal();
    document.getElementById('cenaNome').focus();
  },

  fecharJanela: function () {
    const dialogo = document.getElementById('dialogoCena');
    if (dialogo.open) dialogo.close();
    this.janela = null;
    this.imagemEscolhida = undefined;
  },

  /* "20 × 12 células = 30 × 18 m" — enquanto você digita o tamanho. */
  atualizarMedida: function () {
    const colunas = Number(document.getElementById('cenaColunas').value);
    const linhas = Number(document.getElementById('cenaLinhas').value);
    const metros = function (n) { return String(n * METROS_POR_CELULA).replace('.', ','); };

    document.getElementById('cenaMedida').textContent = colunas > 0 && linhas > 0
      ? colunas + ' × ' + linhas + ' células = ' + metros(colunas) + ' × ' + metros(linhas) + ' m (cada célula tem 1,5 m).'
      : 'Cada célula tem 1,5 m.';
  },

  mostrarPrevia: function (imagem, info) {
    const previa = document.getElementById('previaImagem');
    previa.hidden = !imagem;
    if (!imagem) return;
    document.getElementById('previaImagemFoto').src = imagem;
    document.getElementById('previaImagemInfo').textContent = info || '';
  },


  /* Escolheu um arquivo: comprime, mostra a prévia e acerta as linhas
     para a grade ter a mesma proporção da imagem. Nada é gravado aqui
     — só no Salvar. */
  escolherImagem: function (arquivo) {
    const self = this;
    const erro = document.getElementById('erroCena');
    erro.textContent = '';
    if (!arquivo) return;

    this.comprimirImagem(arquivo).then(function (r) {
      self.imagemEscolhida = r.dados;

      /* base64 gasta 4 caracteres para cada 3 bytes. */
      const kb = Math.round(r.dados.length * 3 / 4 / 1024);
      self.mostrarPrevia(r.dados, r.largura + ' × ' + r.altura + ' px · ' + kb + ' KB depois de comprimida');

      const campoColunas = document.getElementById('cenaColunas');
      const colunas = Math.max(5, Math.min(60, Number(campoColunas.value) || 20));
      document.getElementById('cenaLinhas').value =
        Math.max(5, Math.min(40, Math.round(colunas * r.altura / r.largura)));
      self.atualizarMedida();
    }).catch(function (mensagem) {
      document.getElementById('cenaImagem').value = '';
      erro.textContent = typeof mensagem === 'string' ? mensagem : 'Não consegui ler essa imagem.';
    });
  },

  tirarImagem: function () {
    this.imagemEscolhida = null;
    document.getElementById('cenaImagem').value = '';
    this.mostrarPrevia(null);
  },


  /* A compressão mora no imagens.js, que os retratos também usam. */
  comprimirImagem: function (arquivo) {
    return Imagens.comprimir(arquivo, 'mapa');
  },


  /* Salvar da janela. A tela confere os campos para mostrar o erro no
     lugar certo; a ação confere de novo (no servidor, é a que vale). */
  salvarJanela: function () {
    const erro = document.getElementById('erroCena');
    const nome = document.getElementById('cenaNome').value.trim();
    const visibilidade = document.getElementById('cenaVisibilidade').value.trim();
    const colunas = Number(document.getElementById('cenaColunas').value);
    const linhas = Number(document.getElementById('cenaLinhas').value);

    function falha(texto, id) {
      erro.textContent = texto;
      if (id) document.getElementById(id).focus();
    }

    if (!nome) return falha('Dê um nome à cena.', 'cenaNome');
    if (nome.length > 60) return falha('O nome pode ter até 60 letras.', 'cenaNome');
    if (visibilidade.length > 60) return falha('A visibilidade pode ter até 60 letras.', 'cenaVisibilidade');
    if (!Number.isInteger(colunas) || colunas < 5 || colunas > 60) return falha('Colunas: um número inteiro de 5 a 60.', 'cenaColunas');
    if (!Number.isInteger(linhas) || linhas < 5 || linhas > 40) return falha('Linhas: um número inteiro de 5 a 40.', 'cenaLinhas');

    /* A mudança em si é a ação salvarCena (acoes.js): nova ou editada,
       com o redimensionamento. Se o navegador recusar a gravação (espaço
       cheio, quase sempre por causa de imagem), o Acoes.executar desfaz
       e devolve o erro. */
    const nova = this.janela === 'nova';
    const r = Acoes.executar('salvarCena', {
      id: nova ? null : this.cena().id,
      nome: nome, visibilidade: visibilidade, colunas: colunas, linhas: linhas,
      contorno: nova && document.getElementById('cenaContorno').checked,
      imagem: this.imagemEscolhida
    });
    if (r.erro) return falha(r.erro);

    this.selecionado = null;
    this.regua = null;
    this.fecharJanela();
    this.render();
    Layout.recado(nova ? 'Cena "' + nome + '" criada. Use a ferramenta Parede para desenhar.' : 'Cena "' + nome + '" atualizada.');
  },


  /* (O redimensionar de uma cena com coisas dentro mora na ação
     salvarCena, no acoes.js.) */


  apagarCena: function () {
    const cena = this.cena();
    if (!cena) return;

    /* Apaga na hora e oferece desfazer (Layout.recadoDesfazer). A cena
       volta com paredes, tokens e marcadores — e volta a ser a atual. */
    const self = this;
    const r = Acoes.executar('apagarCena', { id: cena.id });
    if (r.erro) return;
    this.selecionado = null;
    this.regua = null;
    this.render();

    Layout.recadoDesfazer('Cena "' + cena.nome + '" apagada.', function () {
      if (Acoes.executar('devolverCena', { item: r.item, posicao: r.posicao }).erro) return;
      self.render();
      Layout.recado('Cena "' + cena.nome + '" de volta.');
    });
  }
};


/* ---------- Eventos de fora do mapa ---------- */

function ligarPainel() {
  document.querySelector('.area-trabalho').addEventListener('click', function (evento) {
    const alvo = evento.target.closest('[data-acao]');
    if (!alvo) return;

    switch (alvo.dataset.acao) {
      case 'ferramenta':
        Mapa.ferramenta = alvo.dataset.valor;
        if (Mapa.ferramenta !== 'medir') Mapa.regua = null;
        Mapa.render();
        break;

      case 'cena':           Mapa.trocarCena(alvo.dataset.id); break;
      case 'nova-cena':      Mapa.abrirJanela('nova'); break;
      case 'editar-cena':    Mapa.abrirJanela('editar'); break;
      case 'apagar-cena':    Mapa.apagarCena(); break;
      case 'trazer':         Mapa.trazerCombatentes(); break;
      case 'tirar-token':    Mapa.tirarToken(); break;
      case 'centro':         Mapa.aoCentro(); break;
      case 'tirar-marcador': Mapa.tirarMarcador(alvo.dataset.id); break;

      case 'grade':
        Mapa.mostrarGrade = !Mapa.mostrarGrade;
        Mapa.render();
        break;

      case 'limpar-regua':
        Mapa.regua = null;
        Mapa.render();
        break;
    }
  });

  /* Texto do marcador: salva quando o campo perde o foco. */
  document.getElementById('listaMarcadores').addEventListener('change', function (evento) {
    const campo = evento.target.closest('[data-marcador]');
    if (!campo) return;

    /* (Um marcador que fala de armadilha vira vermelho sozinho — regra
       da ação editarMarcador.) */
    Acoes.executar('editarMarcador', { cenaId: Mapa.cena().id, id: campo.dataset.marcador, texto: campo.value });
    Mapa.render();
  });


  /* ----- A janela de cena ----- */
  const dialogo = document.getElementById('dialogoCena');

  /* Enter num campo envia o form; o preventDefault impede o envio de
     verdade (que recarregaria a página) e deixa o mapas.js decidir. */
  document.getElementById('formCena').addEventListener('submit', function (evento) {
    evento.preventDefault();
    Mapa.salvarJanela();
  });

  document.getElementById('cancelarCena').addEventListener('click', function () {
    Mapa.fecharJanela();
  });

  /* Esc fecha o <dialog> sozinho; aqui só esquecemos a imagem que
     estava escolhida, para ela não reaparecer na próxima abertura. */
  dialogo.addEventListener('close', function () {
    Mapa.janela = null;
    Mapa.imagemEscolhida = undefined;
  });

  document.getElementById('cenaImagem').addEventListener('change', function (evento) {
    Mapa.escolherImagem(evento.target.files[0]);
  });

  document.getElementById('tirarImagem').addEventListener('click', function () {
    Mapa.tirarImagem();
  });

  ['cenaColunas', 'cenaLinhas'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', function () { Mapa.atualizarMedida(); });
  });
}


/* A moldura decide se esta pessoa pode ver a tela; só então montamos. */
Layout.iniciar(function () {
  Mapa.iniciar();

  /* Outra aba mudou a campanha (ver 'plainus:externo' no layout.js). */
  Layout.redesenhar = function () { if (!Mapa.arrasto && !Mapa.pintura && !Mapa.janela) Mapa.render(); };
  ligarPainel();

  /* Pedido da busca (ver Layout.aoPedir). O some() confere se a cena
     existe: o id veio do endereço, e qualquer um pode escrever um. */
  Layout.aoPedir(function (tipo, id) {
    if (tipo !== 'cena') return;
    if (!Estado.cenas.some(function (c) { return c.id === id; })) return;
    Mapa.trocarCena(id);
  });
});
