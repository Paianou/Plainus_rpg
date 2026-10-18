/* ===================================================================
   jogador-mesa.js — a mesa vista pelo jogador: cena, combate, diário
   e o rolador

   Tudo aqui desenha a partir da VISÃO (visao.js), nunca do Estado. É
   por isso que este arquivo pode mostrar a ordem de iniciativa sem
   medo: o PV dos inimigos, a CA deles e as notas do Mestre já não
   vêm na visão — não há o que esconder, porque não chegou.

   O jogador-mesa.js só desenha e rola. Quem decide a aba, escuta os
   cliques e redesenha é o jogador.js (Jogador.ligar).
   =================================================================== */

const MesaJogador = {

  /* Um chip de condição. Se ela é uma condição do livro (CONDICOES),
     o chip é um botão que abre a regra na aba Regras — "Amedrontado"
     no meio do combate e um clique para lembrar o que faz. Efeitos
     anotados pelo Mestre ("Concentrando", "Abençoado") ficam só texto. */
  chip: function (nome) {
    if (!CONDICOES[nome]) return criar('span.chip-condicao', nome);
    const botao = criar('button.chip-condicao.chip-regra', nome);
    botao.type = 'button';
    botao.dataset.acao = 'ver-regra';
    botao.dataset.tipo = 'condicoes';
    botao.dataset.nome = nome;
    botao.title = 'O que ' + nome + ' faz';
    return botao;
  },


  /* ===================================================================
     ABA MESA: a cena em jogo e a ordem de iniciativa
     =================================================================== */

  montarMesa: function (area, visao) {
    const meu = visao.meuHeroi;
    const combate = visao.combate;

    /* O aviso que mais importa na sessão inteira. */
    if (combate && combate.ativo && combate.combatentes.some(function (c) { return c.vez && c.meu; })) {
      area.appendChild(criar('div.sua-vez', [
        Icone.svg('iniciativa', 18),
        criar('span', 'É a sua vez, ' + meu.nome + '.')
      ]));
    }

    area.appendChild(this.montarCena(visao.cena, meu, combate));
    area.appendChild(this.montarCombate(combate));
  },


  /* Arrastando o próprio token agora? Enquanto sim, uma visão nova que
     chegue não redesenha a aba (jogador.js, ocupado) — senão o token
     sumiria da mão no meio do gesto. */
  arrastando: false,

  /* A medição em área (a "bola de fogo"): o botão "Marcar área" liga o
     modo — o próximo clique no mapa põe o centro — e o raio do campo
     fica guardado aqui entre um redesenho e outro. */
  modoArea: false,
  raioArea: 6,

  montarCena: function (cena, meu, combate) {
    const cartao = criar('div.cartao', [criarComIcone('h2', 'mapa', cena ? cena.nome : 'A cena', 16)]);

    if (!cena) {
      cartao.appendChild(criar('p.dica', 'O Mestre ainda não abriu nenhuma cena.'));
      return cartao;
    }

    /* Dá para andar? Precisa ter token na cena — e, no combate, ser a
       sua vez. É a mesma regra que o servidor confere (visao.js,
       moverMeuToken); aqui ela só decide o que a tela oferece. */
    const meuToken = cena.tokens.find(function (t) { return t.meu; });
    const lutando = !!(combate && combate.ativo && combate.combatentes.some(function (c) { return c.meu; }));
    const minhaVez = lutando && combate.combatentes.some(function (c) { return c.meu && c.vez; });
    const andar = !!meuToken && (!lutando || minhaVez);

    const mapa = criar('div.mapa.mapa-jogador');
    /* O seu token aparece destacado: "você está aqui". */
    const planta = Planta.desenhar(cena, { destacar: meu ? meu.nome : null, andar: andar });
    mapa.appendChild(planta);
    if (cena.visibilidade) {
      mapa.appendChild(criar('div.mapa-faixa', [criar('span.mapa-selo', cena.visibilidade)]));
    }
    cartao.appendChild(mapa);

    let legenda = 'Quem move os tokens é o Mestre.';
    if (andar) legenda = 'Arraste o seu token para andar — ou clique nele e use as setas.';
    else if (meuToken) legenda = 'No combate, você anda na sua vez.';
    else if (meu) legenda = 'O Mestre ainda não pôs você no mapa.';
    cartao.appendChild(criar('p.dica.legenda-mapa-jogador', 'Cada quadrado tem 1,5 m. ' + legenda));

    cartao.appendChild(this.montarArea(cena, meuToken));

    if (andar) this.ligarAndar(planta, cena, meuToken);
    if (this.modoArea) this.ligarArea(planta, cena, mapa);
    return cartao;
  },


  /* O raio digitado, conferido: de 1,5 em 1,5 m, dentro dos limites
     (os mesmos do servidor — RAIO_AREA, no modelo.js). */
  lerRaio: function (valor) {
    const n = Number(valor);
    if (!Number.isFinite(n)) return this.raioArea;
    return Math.min(RAIO_AREA[1], Math.max(RAIO_AREA[0], Math.round(n / 1.5) * 1.5));
  },


  /* Embaixo do mapa: o raio, os botões e, em texto, as áreas que estão
     no mapa — o que o desenho mostra, para quem não vê o desenho. */
  montarArea: function (cena, meuToken) {
    const self = this;
    const areas = cena.areas || [];
    const minha = areas.find(function (a) { return a.minha; });

    const campo = criar('div.campo-form.campo-raio');
    const rotulo = criar('label', 'Raio (m)');
    rotulo.htmlFor = 'raioMinhaArea';
    const entrada = document.createElement('input');
    entrada.type = 'number';
    entrada.id = 'raioMinhaArea';
    entrada.min = String(RAIO_AREA[0]);
    entrada.max = String(RAIO_AREA[1]);
    entrada.step = '1.5';
    entrada.value = String(this.raioArea);
    entrada.addEventListener('input', function () { self.raioArea = self.lerRaio(entrada.value); });
    campo.appendChild(rotulo);
    campo.appendChild(entrada);

    const marcar = criarBotao('mini-botao' + (this.modoArea ? '.ligado' : ''), 'marcar-area', 'magia', 'Marcar área');
    marcar.setAttribute('aria-pressed', this.modoArea ? 'true' : 'false');
    const linha = criar('div.linha-area', [campo, marcar]);
    if (meuToken) linha.appendChild(criarBotao('mini-botao', 'area-no-token', 'escudo', 'No meu personagem'));
    if (minha) linha.appendChild(criarBotao('mini-botao', 'apagar-minha-area', 'remover', 'Apagar a minha'));

    const bloco = criar('div.bloco-area', [linha]);
    if (this.modoArea) {
      bloco.appendChild(criar('p.dica', 'Clique no mapa para pôr o centro — ou clique e arraste para escolher o raio. Bola de Fogo: 6 m.'));
    }
    if (areas.length) {
      bloco.appendChild(criar('p.dica', 'No mapa: ' + areas.map(function (a) {
        return a.nome + ' · ' + String(a.raio).replace('.', ',') + ' m (' + casasDaArea(a, cena).length + ' casas)';
      }).join('; ') + '.'));
    }
    return bloco;
  },


  /* Com o modo ligado, o mapa inteiro recebe o clique: apertar põe o
     centro (de meia em meia casa — na linha da grade ou no meio dela),
     arrastar escolhe o raio, soltar manda para o servidor. Durante o
     gesto só a camada das áreas se redesenha (Planta.desenharAreas),
     como o token, que só se move. */
  ligarArea: function (svg, cena, mapa) {
    const self = this;
    let previa = null;
    mapa.classList.add('marcando-area');

    function ponto(evento) {
      const p = svg.createSVGPoint();
      p.x = evento.clientX;
      p.y = evento.clientY;
      const matriz = svg.getScreenCTM();
      return matriz ? p.matrixTransform(matriz.inverse()) : { x: 0, y: 0 };
    }

    function redesenhar() {
      const comPrevia = Object.assign({}, cena, {
        areas: (cena.areas || []).filter(function (a) { return !a.minha; }).concat([previa])
      });
      const velha = svg.querySelector('.areas-planta');
      const nova = Planta.desenharAreas(comPrevia);
      if (velha) velha.replaceWith(nova);
    }

    svg.addEventListener('pointerdown', function (evento) {
      if (evento.button !== 0) return;
      evento.preventDefault();
      const p = ponto(evento);
      previa = { x: Math.round(p.x / CELULA * 2) / 2, y: Math.round(p.y / CELULA * 2) / 2, raio: self.raioArea, nome: (Conexao.visao.meuHeroi || {}).nome || '', minha: true };
      self.arrastando = true;
      try { svg.setPointerCapture(evento.pointerId); } catch (erro) { /* segue sem captura */ }
      redesenhar();
    });

    svg.addEventListener('pointermove', function (evento) {
      if (!previa) return;
      if (evento.buttons === 0) { soltar(); return; }
      const p = ponto(evento);
      const metros = Math.hypot(p.x - previa.x * CELULA, p.y - previa.y * CELULA) / CELULA * METROS_POR_CELULA;
      if (metros < METROS_POR_CELULA) return;
      const raio = self.lerRaio(metros);
      if (raio === previa.raio) return;
      previa.raio = raio;
      self.raioArea = raio;
      redesenhar();
    });

    function soltar() {
      if (!previa) return;
      const fim = previa;
      previa = null;
      self.arrastando = false;
      self.modoArea = false;
      enviarMinhaArea(fim.x, fim.y, fim.raio);
      Jogador.render();
    }
    svg.addEventListener('pointerup', soltar);
    svg.addEventListener('pointercancel', soltar);
    svg.addEventListener('lostpointercapture', soltar);
  },


  /* O próprio token, pela mão ou pelo teclado. Mesma conta do mapas.js
     do Mestre: o ponto da tela vira ponto do SVG (getScreenCTM, porque
     o mapa está escalado) e o ponto vira célula. Durante o arrasto só o
     grupo do token se move; ao soltar, a casa vai para o servidor
     (enviarMeuToken), que confere parede, casa ocupada e a vez. */
  ligarAndar: function (svg, cena, token) {
    const self = this;
    const grupo = svg.querySelector('.token-meu');
    if (!grupo) return;
    let arrasto = null;

    function ponto(evento) {
      const p = svg.createSVGPoint();
      p.x = evento.clientX;
      p.y = evento.clientY;
      const matriz = svg.getScreenCTM();
      return matriz ? p.matrixTransform(matriz.inverse()) : { x: 0, y: 0 };
    }

    function andarPara(col, lin) {
      col = Math.max(0, Math.min(cena.colunas - 1, col));
      lin = Math.max(0, Math.min(cena.linhas - 1, lin));
      if (col === token.col && lin === token.lin) return false;
      enviarMeuToken(col, lin);
      return true;
    }

    grupo.addEventListener('pointerdown', function (evento) {
      /* Marcando área, o clique no token é o centro da área (ligarArea). */
      if (evento.button !== 0 || self.modoArea) return;
      evento.preventDefault();
      grupo.focus();
      arrasto = { inicio: ponto(evento), moveu: false };
      self.arrastando = true;
      grupo.classList.add('pegando');
      /* Sem a captura, um movimento rápido escapa do token (ver mapas.js). */
      try { grupo.setPointerCapture(evento.pointerId); } catch (erro) { /* segue sem captura */ }
    });

    grupo.addEventListener('pointermove', function (evento) {
      if (!arrasto) return;
      /* O botão já foi solto, fora do token (o pointerup não chegou
         aqui): o gesto acabou. Sem isto o token ficaria "na mão" — e a
         aba pararia de receber as novidades (ver arrastando). */
      if (evento.buttons === 0) { soltar(); return; }
      const p = ponto(evento);
      arrasto.dx = p.x - arrasto.inicio.x;
      arrasto.dy = p.y - arrasto.inicio.y;
      arrasto.moveu = true;
      grupo.setAttribute('transform', 'translate(' + arrasto.dx + ',' + arrasto.dy + ')');
    });

    /* Soltou: encaixa na casa onde caiu o CENTRO do token. Redesenha
       sempre — mesmo num clique sem arrastar —, porque o que chegou do
       servidor durante o gesto esperou por ele (como no mapas.js). */
    function soltar() {
      if (!arrasto) return;
      const fim = arrasto;
      arrasto = null;
      self.arrastando = false;
      if (fim.moveu) {
        andarPara(Math.floor((token.col * CELULA + CELULA / 2 + fim.dx) / CELULA),
          Math.floor((token.lin * CELULA + CELULA / 2 + fim.dy) / CELULA));
      }
      Jogador.render();
    }
    grupo.addEventListener('pointerup', soltar);
    grupo.addEventListener('pointercancel', soltar);
    /* O navegador soltou a captura por conta própria (a aba perdeu o
       foco, por exemplo): o gesto acabou também. */
    grupo.addEventListener('lostpointercapture', soltar);

    /* As setas andam uma casa. O foco volta ao token depois do redesenho
       (jogador.js, render) — dá para andar várias casas seguidas. */
    grupo.addEventListener('keydown', function (evento) {
      const passo = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[evento.key];
      if (!passo) return;
      evento.preventDefault();
      if (andarPara(token.col + passo[0], token.lin + passo[1])) Jogador.render();
    });
  },


  montarCombate: function (combate) {
    /* O liga/desliga do aviso da vez mora aqui, junto do combate. */
    const ligado = AvisoVez.ligado();
    const aviso = criarBotao('mini-botao' + (ligado ? '.ligado' : ''), 'alternar-aviso-vez', 'sino',
      ligado ? 'Aviso da vez ligado' : 'Aviso da vez desligado');
    aviso.setAttribute('aria-pressed', ligado ? 'true' : 'false');
    aviso.title = 'Toca um sino (e avisa o sistema, se você permitir) quando chegar a sua vez';
    const cartao = criar('div.cartao', [criar('div.titulo-coluna', [criarComIcone('h2', 'ampulheta', 'Ordem de iniciativa', 16), aviso])]);

    if (!combate) {
      cartao.appendChild(criar('p.dica', 'Nenhum combate agora.'));
      return cartao;
    }

    cartao.appendChild(criar('div.sub.cabeca-combate-jogador',
      (combate.ativo ? 'Rodada ' + combate.rodada : 'Combate encerrado')
      + (combate.encontro ? ' · ' + combate.encontro : '')));

    const lista = criar('div.iniciativa-jogador');

    combate.combatentes.forEach(function (c) {
      const classes = '.linha-jogador'
        + (c.vez ? '.vez' : '') + (c.agiu && !c.vez ? '.agiu' : '')
        + (c.tipo === 'inimigo' ? '.inimigo' : '') + (c.meu ? '.meu' : '')
        + (c.caido ? '.caido' : '');

      /* Aliado: o PV de verdade, com a barra. Inimigo: só a palavra
         ("Sangrando") — é tudo o que a visão manda. */
      let vida;
      if (c.tipo === 'heroi') {
        const proporcao = c.pvMax ? Math.max(0, c.pv / c.pvMax) : 0;
        const faixa = proporcao > .6 ? '' : (proporcao > .3 ? '.media' : '.baixa');
        const preenchimento = criar('div.preenchimento' + faixa);
        preenchimento.style.width = (proporcao * 100) + '%';
        vida = criar('div.vida-jogador', [
          criar('span.numeros', c.pv + ' / ' + c.pvMax + ' PV'),
          criar('div.barra', preenchimento)
        ]);
      } else {
        vida = criar('span.pilula' + (c.caido ? '' : '.perigo'), c.vida);
      }

      const nome = criar('div.nome', c.nome);
      if (c.meu) nome.appendChild(criar('span.pilula.azul', 'Você'));
      if (c.vez) nome.appendChild(criar('span.pilula.azul', 'Vez'));

      const condicoes = c.condicoes.length
        ? criar('div.condicoes-jogador', c.condicoes.map(function (cond) { return MesaJogador.chip(cond); }))
        : null;

      lista.appendChild(criar('div' + classes, [
        criar('div.ordem-numero', String(c.iniciativa)),
        criar('div.quem', [nome, condicoes]),
        vida
      ]));
    });

    cartao.appendChild(lista);
    return cartao;
  },


  /* ===================================================================
     ABA DIÁRIO: o que a party viveu e sabe
     =================================================================== */

  montarDiario: function (area, visao) {
    /* Sessões */
    const sessoes = criar('div.cartao', [criarComIcone('h2', 'diario', 'Sessões', 16)]);
    if (!visao.diario.length) {
      sessoes.appendChild(criar('p.dica', 'Nenhuma sessão registrada ainda.'));
    }
    visao.diario.forEach(function (d) {
      const cabeca = criar('div.cabeca-sessao-jogador', [
        criar('span.numero-sessao', 'Sessão ' + d.sessao),
        criar('span.titulo', d.titulo || 'Sem título')
      ]);
      if (d.emAberto) cabeca.appendChild(criar('span.pilula.azul', 'Em andamento'));
      sessoes.appendChild(criar('div.sessao-jogador', [
        cabeca,
        d.resumo ? criar('p', d.resumo) : criar('p.dica', 'O Mestre ainda não escreveu o resumo.')
      ]));
    });
    area.appendChild(sessoes);

    /* Segredos que já vieram à tona */
    const segredos = criar('div.cartao', [criarComIcone('h2', 'olho', 'O que já se descobriu', 16)]);
    if (!visao.segredos.length) {
      segredos.appendChild(criar('p.dica', 'Nada revelado ainda.'));
    }
    visao.segredos.forEach(function (s) {
      segredos.appendChild(criar('div.sessao-jogador', [
        criar('div.cabeca-sessao-jogador', [
          criar('span.titulo', s.titulo),
          s.reveladoEm ? criar('span.pilula', 'Sessão ' + s.reveladoEm) : null
        ]),
        criar('p', s.texto)
      ]));
    });
    area.appendChild(segredos);

    /* Gente que a party conheceu */
    const pessoas = criar('div.cartao', [criarComIcone('h2', 'npcs', 'Pessoas que vocês conhecem', 16)]);
    if (!visao.conhecidos.length) {
      pessoas.appendChild(criar('p.dica', 'Ninguém ainda.'));
    }
    visao.conhecidos.forEach(function (n) {
      pessoas.appendChild(criar('div.companheiro' + (n.morto ? '.morto' : ''), [
        criar('span.inicial-npc', n.nome.charAt(0)),
        criar('div', [
          criar('div.nome', n.morto ? n.nome + ' (morto)' : n.nome),
          criar('div.sub', [n.papel, n.local].filter(Boolean).join(' · ')),
          n.aparencia ? criar('div.sub', n.aparencia) : null
        ])
      ]));
    });
    area.appendChild(pessoas);
  }
};


/* ===================================================================
   O ROLADOR DO JOGADOR

   Dois jeitos de rolar:
     - clicar num dado do cartão (d4 a d100);
     - clicar na ficha: uma perícia, um atributo, uma salvaguarda ou a
       iniciativa rola d20 + o bônus que a ficha calculou.

   Vantagem e desvantagem valem para o d20: rola dois e fica com o
   maior (ou o menor). O 20 e o 1 NATURAIS — o número no dado, não o
   total — ganham destaque.

   Toda rolagem vai para o registro da mesa por enviarRolagem()
   (visao.js), e todos os jogadores a veem.
   =================================================================== */

const RoladorJogador = {

  modo: 'normal',       /* 'vantagem' | 'normal' | 'desvantagem' */
  cd: null,             /* a CD (ou CA do alvo) digitada no cartão — estado de vista */


  montar: function (area, visao) {
    const self = this;
    const cartao = criar('div.cartao.rolador-jogador');

    const modos = criar('div.modos-rolagem');
    [['vantagem', '+V', 'Vantagem'], ['normal', 'N', 'Normal'], ['desvantagem', '−D', 'Desvantagem']].forEach(function (trio) {
      const botao = criar('button.modo' + (self.modo === trio[0] ? '.ativo' : ''), trio[1]);
      botao.type = 'button';
      botao.dataset.acao = 'modo-rolagem';
      botao.dataset.modo = trio[0];
      botao.title = trio[2] + ' (vale para o d20)';
      botao.setAttribute('aria-pressed', self.modo === trio[0] ? 'true' : 'false');
      modos.appendChild(botao);
    });

    cartao.appendChild(criar('div.titulo-coluna', [criarComIcone('h2', 'dados', 'Dados', 16), modos]));

    const grade = criar('div.grade-dados-jogador');
    [4, 6, 8, 10, 12, 20, 100].forEach(function (faces) {
      const botao = criar('button.dado' + (faces === 20 ? '.principal' : ''), faces === 100 ? 'd%' : 'd' + faces);
      botao.type = 'button';
      botao.dataset.acao = 'rolar-dado';
      botao.dataset.faces = faces;
      grade.appendChild(botao);
    });
    cartao.appendChild(grade);

    /* A CD do teste (ou a CA do alvo, num ataque), quando o Mestre diz
       em voz alta: com ela, a animação mostra SUCESSO ou FALHA. Vale
       para as próximas rolagens até ser apagada. */
    const cd = document.createElement('input');
    cd.type = 'number';
    cd.id = 'cdTeste';
    cd.min = 1;
    cd.max = 40;
    cd.placeholder = '—';
    if (this.cd) cd.value = this.cd;
    cd.setAttribute('aria-label', 'CD do teste ou CA do alvo');

    const animacao = criarBotao('mini-botao' + (Dados3D.ativa() ? '.ligado' : ''), 'alternar-animacao', 'dados',
      Dados3D.ativa() ? 'Animação ligada' : 'Animação desligada');
    animacao.setAttribute('aria-pressed', Dados3D.ativa() ? 'true' : 'false');

    cartao.appendChild(criar('div.opcoes-rolagem', [
      criar('label.campo-cd', [criar('span', 'CD / CA'), cd]),
      animacao
    ]));
    cartao.appendChild(criar('p.dica', 'Na ficha, clique numa perícia, atributo ou salvaguarda para rolar o teste.'));

    /* O registro da mesa: as rolagens de todos. */
    const registro = criar('div.registro-rolagens');
    if (!visao.rolagensMesa.length) registro.appendChild(criar('p.dica', 'Ninguém rolou nada ainda.'));
    visao.rolagensMesa.slice(0, 8).forEach(function (r) {
      registro.appendChild(criar('div.rolagem-mesa' + (r.marca ? '.' + r.marca : ''), [
        criar('div', [
          criar('div.quem', (r.personagem || r.autor) + ' — ' + r.texto),
          criar('div.formula', r.formula)
        ]),
        criar('div.total', String(r.total))
      ]));
    });
    cartao.appendChild(criar('div.titulo-grupo', 'Rolagens da mesa'));
    cartao.appendChild(registro);

    area.appendChild(cartao);
  },


  /* Um d20, levando em conta o modo. Devolve o dado que valeu e a
     fórmula para mostrar: "d20 (17, 4) vantagem". */
  /* valores e escolhido vão para a animação: com vantagem, os DOIS
     dados aparecem, e o que não valeu se apaga. */
  d20: function () {
    if (this.modo === 'normal') {
      const d = Layout.dado(20);
      return { dado: d, valores: [d], escolhido: 0, formula: 'd20 (' + d + ')' };
    }
    const a = Layout.dado(20);
    const b = Layout.dado(20);
    const dado = this.modo === 'vantagem' ? Math.max(a, b) : Math.min(a, b);
    return { dado: dado, valores: [a, b], escolhido: dado === a ? 0 : 1, formula: 'd20 (' + a + ', ' + b + ') ' + this.modo };
  },

  /* A cena da animação de um teste de d20 (dados3d.js). */
  cenaTeste: function (texto, rolagem, bonus, formula, marca) {
    return {
      modo: 'teste', faces: 20, texto: texto,
      valores: rolagem.valores, escolhido: rolagem.escolhido,
      bonus: bonus, total: rolagem.dado + bonus, cd: this.cd,
      formula: formula, marca: marca
    };
  },


  rolarTeste: function (texto, bonus) {
    const rolagem = this.d20();
    const formula = rolagem.formula + ' ' + (bonus < 0 ? '− ' + Math.abs(bonus) : '+ ' + bonus);
    const marca = rolagem.dado === 20 ? 'critico' : (rolagem.dado === 1 ? 'falha' : null);
    this.registrar(
      { texto: texto, formula: formula, total: rolagem.dado + bonus, marca: marca },
      this.cenaTeste(texto, rolagem, bonus, formula, marca)
    );
  },


  rolarDado: function (faces) {
    if (faces === 20) {
      const rolagem = this.d20();
      const marca = rolagem.dado === 20 ? 'critico' : (rolagem.dado === 1 ? 'falha' : null);
      this.registrar(
        { texto: 'd20', formula: rolagem.formula, total: rolagem.dado, marca: marca },
        this.cenaTeste('d20', rolagem, 0, rolagem.formula, marca)
      );
      return;
    }
    const valor = Layout.dado(faces);
    const rotulo = faces === 100 ? 'd%' : 'd' + faces;
    this.registrar(
      { texto: rotulo, formula: rotulo, total: valor, marca: null },
      { modo: 'dano', faces: faces, valores: [valor], texto: rotulo, total: valor, formula: rotulo, marca: null }
    );
  },


  /* Manda para o registro da mesa e mostra o resultado: com a
     animação (dados3d.js), ou com o recado, se ela estiver desligada.
     A ordem importa: o resultado é GRAVADO antes de ser mostrado — a
     animação só encena o que já está decidido. */
  registrar: function (rolagem, cena) {
    const problema = enviarRolagem(Jogador.sessao, rolagem);
    if (problema) {
      Layout.recado(problema, true);
      return;
    }

    Jogador.render();
    if (cena && Dados3D.mostrar(cena)) return;

    const destaque = rolagem.marca === 'critico' ? ' — 20 natural!' : (rolagem.marca === 'falha' ? ' — 1 natural.' : '');
    Layout.recado(rolagem.texto + ': ' + rolagem.total + '  (' + rolagem.formula + ')' + destaque, rolagem.marca === 'falha');
  }
};


/* ===================================================================
   AvisoVez — o sino quando chega a SUA vez no combate

   O Mestre passa o turno; o jogador está no Discord, ou lendo a aba
   de Regras. Um sino curto (feito na hora com WebAudio, sem arquivo de
   som) e, se a aba estiver escondida e a pessoa tiver permitido, uma
   notificação do sistema. Quem decide QUANDO é o jogador.js
   (vigiarMesa), que percebe a passagem de "não é minha vez" para "é".

   Vem ligado: é o aviso que mais importa numa sessão. Desliga no botão
   do cartão "Ordem de iniciativa", e a escolha fica neste navegador.

   A notificação do sistema pode não existir aqui: aberto por duplo
   clique (file://), o navegador costuma recusar a permissão. Aí sobra
   o sino e o título da aba — e tudo bem.
   =================================================================== */

const AvisoVez = {

  CHAVE: 'plainus:aviso-vez',

  ligado: function () {
    try { return localStorage.getItem(this.CHAVE) !== 'desligado'; } catch (erro) { return true; }
  },

  alternar: function () {
    const novo = !this.ligado();
    try { localStorage.setItem(this.CHAVE, novo ? 'ligado' : 'desligado'); } catch (erro) { /* fica só nesta visita */ }
    if (novo) this.pedirPermissao();
    return novo;
  },

  /* Só pergunta quando a pessoa LIGA o aviso — nunca ao abrir a página,
     que é o jeito certo de ter a permissão negada para sempre. */
  pedirPermissao: function () {
    try {
      if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    } catch (erro) { /* sem notificação; o sino basta */ }
  },

  tocar: function (nome) {
    if (!this.ligado()) return;
    this.sino();
    try {
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        /* tag: um aviso novo SUBSTITUI o anterior, em vez de empilhar. */
        new Notification('Sua vez!', { body: 'É a vez de ' + nome + ' no combate.', tag: 'plainus-vez' });
      }
    } catch (erro) { /* idem */ }
  },

  /* Duas notas de sino, uma quinta acima da outra: chama a atenção sem
     soar como alarme. Cada nota é uma senoide com um harmônico, que
     começa forte e se apaga devagar. */
  sino: function () {
    try {
      const Contexto = window.AudioContext || window.webkitAudioContext;
      if (!Contexto) return;
      if (!this.audio) this.audio = new Contexto();
      const ctx = this.audio;
      if (ctx.state === 'suspended') ctx.resume();
      const agora = ctx.currentTime;

      [[659.25, 0], [987.77, 0.16]].forEach(function (par) {
        [1, 2.01].forEach(function (multiplo, i) {
          const osc = ctx.createOscillator();
          const ganho = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = par[0] * multiplo;
          const inicio = agora + par[1];
          const pico = i === 0 ? 0.12 : 0.03;
          ganho.gain.setValueAtTime(0.0001, inicio);
          ganho.gain.exponentialRampToValueAtTime(pico, inicio + 0.012);
          ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + 1.3);
          osc.connect(ganho);
          ganho.connect(ctx.destination);
          osc.start(inicio);
          osc.stop(inicio + 1.35);
        });
      });
    } catch (erro) { /* sem som; o título da aba ainda avisa */ }
  }
};
