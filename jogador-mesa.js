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

    area.appendChild(this.montarCena(visao.cena, meu));
    area.appendChild(this.montarCombate(combate));
  },


  montarCena: function (cena, meu) {
    const cartao = criar('div.cartao', [criarComIcone('h2', 'mapa', cena ? cena.nome : 'A cena', 16)]);

    if (!cena) {
      cartao.appendChild(criar('p.dica', 'O Mestre ainda não abriu nenhuma cena.'));
      return cartao;
    }

    const mapa = criar('div.mapa.mapa-jogador');
    /* O seu token aparece destacado: "você está aqui". */
    mapa.appendChild(Planta.desenhar(cena, { destacar: meu ? meu.nome : null }));
    if (cena.visibilidade) {
      mapa.appendChild(criar('div.mapa-faixa', [criar('span.mapa-selo', cena.visibilidade)]));
    }
    cartao.appendChild(mapa);
    cartao.appendChild(criar('p.dica.legenda-mapa-jogador', 'Cada quadrado tem 1,5 m. Quem move os tokens é o Mestre.'));
    return cartao;
  },


  montarCombate: function (combate) {
    const cartao = criar('div.cartao', [criarComIcone('h2', 'ampulheta', 'Ordem de iniciativa', 16)]);

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
