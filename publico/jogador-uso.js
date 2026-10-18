/* ===================================================================
   jogador-uso.js — ataques, magias, recursos e descansos

   O que o jogador USA durante a sessão, com um clique na ficha:
     Ataques    "Atacar" rola d20 + bônus; "Dano" rola o dado da arma.
                Se o ataque tirou 20 natural, o dano seguinte daquela
                arma dobra os dados sozinho (regra do crítico).
     Magias     CD e ataque mágico calculados; espaços que se gastam;
                "Conjurar" gasta o menor espaço que serve e, se a
                magia for de concentração, marca "Concentrando" no
                combate — o Mestre e o sino de avisos veem.
     Recursos   usos limitados (Surto de Ação, Fúria...) em bolinhas.
     Descansos  o curto recarrega os recursos "de descanso curto"; o
                longo recarrega tudo e encerra a concentração.

   E as três seções do formulário (Editar ficha) onde se cadastra o
   que se usa aqui.

   SOBRE O PV NO DESCANSO
   No livro, o descanso longo devolve todo o PV. Aqui ele não devolve:
   o PV atual é do Mestre (é ele quem tira e dá no combate), e o
   descanso é uma decisão da mesa, não do jogador sozinho. O recado
   do descanso lembra disso.

   Cada clique que muda a ficha passa por usar() → enviarMeuHeroi()
   (visao.js): a mesma ação de salvar a ficha, que só mexe no próprio
   personagem.
   =================================================================== */

const NIVEIS_MAGIA = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const LIMITE_LINHAS = 10;     /* ataques ou recursos por ficha */

const UsoFicha = {

  /* O ataque cujo próximo dano é crítico (índice), ou null. */
  criticoDe: null,


  /* O filtro de nível da aba Magias — estado de vista, não é salvo. */
  filtroNivel: 'todas',


  /* Ficha antiga, sem os campos novos: completa com o vazio. */
  completar: function (f) {
    f.ataques = f.ataques || [];
    f.atributoMagia = f.atributoMagia || '';
    f.espacos = f.espacos || {};
    f.espacosGastos = f.espacosGastos || {};
    f.magias = f.magias || [];
    f.concentrando = f.concentrando || '';
    f.preparaMagias = !!f.preparaMagias;
    f.preparadas = f.preparadas || [];
    f.recursos = f.recursos || [];
    f.moedas = f.moedas || { pl: 0, po: 0, pe: 0, pp: 0, pc: 0 };
    f.itens = f.itens || [];
    f.notas = f.notas || [];
    return f;
  },


  /* ===================================================================
     NA FICHA EM LEITURA
     =================================================================== */

  montar: function (area, heroi) {
    const f = this.completar(JSON.parse(JSON.stringify(heroi.ficha)));
    area.appendChild(this.cartaoAtaques(f));
    if (f.atributoMagia) area.appendChild(this.resumoMagias(f));
    area.appendChild(this.cartaoRecursos(f));
  },


  /* Na ficha, as magias viram um resumo com atalho: a lista inteira
     mora na aba Magias. A concentração fica à vista nos dois lugares —
     é o que o jogador não pode esquecer no meio do combate. */
  resumoMagias: function (f) {
    const ir = criarBotao('mini-botao', 'aba', 'magia', 'Abrir a aba Magias');
    ir.dataset.aba = 'magias';
    const ataque = criarBotao('mini-botao.botao-uso', 'ataque-magico', 'magia', 'Ataque mágico ' + comSinal(Ficha.ataqueMagia(f)));

    const cartao = criar('div.cartao', [
      criar('div.titulo-coluna', [
        criarComIcone('h2', 'magia', 'Magias', 16),
        criar('span.sub', 'CD ' + Ficha.cdMagia(f) + ' · ' + f.magias.length + ' conhecidas')
      ])
    ]);
    if (f.concentrando) cartao.appendChild(this.avisoConcentracao(f));
    cartao.appendChild(criar('div.linha-botoes', [ataque, ir]));
    return cartao;
  },

  avisoConcentracao: function (f) {
    return criar('div.concentrando', [
      Icone.svg('alerta', 14),
      criar('span', 'Concentrando em ' + f.concentrando + '. Ao sofrer dano: salvaguarda de CON, CD 10 ou metade do dano.'),
      criarBotao('mini-botao', 'encerrar-concentracao', 'remover', 'Encerrar')
    ]);
  },


  /* A aba Magias inteira: o cartão de magias, com filtro de nível. */
  montarAbaMagias: function (area, heroi) {
    const f = this.completar(JSON.parse(JSON.stringify(heroi.ficha)));
    if (!f.atributoMagia) {
      area.appendChild(criar('div.cartao', [
        criarComIcone('h2', 'magia', 'Magias', 16),
        criar('p.dica', 'Este personagem não conjura magias. Em "Editar ficha", escolha o atributo de conjuração.')
      ]));
      return;
    }
    area.appendChild(this.cartaoMagias(f));
  },


  cartaoAtaques: function (f) {
    const cartao = criar('div.cartao', [criarComIcone('h2', 'combate', 'Ataques', 16)]);

    if (!f.ataques.length) {
      cartao.appendChild(criar('p.dica', 'Nenhum ataque cadastrado. Em "Editar ficha", escolha as armas da lista ou escreva os seus.'));
      return cartao;
    }
    this.linhasAtaques(f).forEach(function (linha) { cartao.appendChild(linha); });
    return cartao;
  },

  /* Uma linha por ataque, com os botões de atacar e de dano. A ficha e
     o cartão "Em combate" (abaixo) usam as mesmas: um clique faz o
     mesmo nos dois lugares. */
  linhasAtaques: function (f) {
    const self = this;
    return f.ataques.map(function (ataque, i) {
      const atacar = criarBotao('mini-botao.botao-uso', 'atacar', 'combate', 'Atacar ' + comSinal(Ficha.bonusAtaque(f, ataque)));
      atacar.dataset.indice = i;
      const dano = criarBotao('mini-botao.botao-uso', 'dano', 'dados', 'Dano ' + Ficha.textoDano(f, ataque));
      dano.dataset.indice = i;
      if (self.criticoDe === i) dano.classList.add('critico-pendente');

      return criar('div.linha-uso', [
        criar('div.nome-uso', ataque.nome),
        criar('div.botoes-uso', [atacar, dano])
      ]);
    });
  },


  /* NA ABA MESA, DURANTE O COMBATE: o que se usa no turno, sem trocar
     de aba — vida e CA, a concentração, os ataques e as magias prontas.
     Vai no topo da coluna lateral (jogador.js, renderLateral), que é
     onde sobrava espaço ao lado da ordem de iniciativa. Só aparece com
     o combate ativo e o personagem dentro dele. */
  cartaoEmCombate: function (visao) {
    const combate = visao.combate;
    const meu = combate && combate.ativo && combate.combatentes.find(function (c) { return c.meu; });
    if (!meu || !visao.meuHeroi) return null;
    const vez = combate.combatentes.find(function (c) { return c.vez; });
    const f = this.completar(JSON.parse(JSON.stringify(visao.meuHeroi.ficha)));

    const cartao = criar('div.cartao.cartao-em-combate', [
      criar('div.titulo-coluna', [
        criarComIcone('h2', 'combate', 'Em combate', 16),
        criar('span.sub' + (meu.vez ? '.minha-vez' : ''), meu.vez ? 'Sua vez' : (vez ? 'Vez de ' + vez.nome.split(' ')[0] : 'Rodada ' + combate.rodada))
      ]),
      criar('dl.lista-sobre.lista-combate', [
        criar('div', [criar('dt', 'Pontos de vida'), criar('dd', meu.pv + ' / ' + meu.pvMax)]),
        criar('div', [criar('dt', 'Armadura'), criar('dd', 'CA ' + visao.meuHeroi.ca)])
      ])
    ]);
    if (f.concentrando) cartao.appendChild(this.avisoConcentracao(f));

    cartao.appendChild(criar('div.titulo-grupo', 'Ataques'));
    if (!f.ataques.length) cartao.appendChild(criar('p.dica', 'Nenhum ataque cadastrado. Em "Editar ficha", escolha as armas da lista ou escreva os seus.'));
    this.linhasAtaques(f).forEach(function (linha) { cartao.appendChild(linha); });

    /* As magias que dá para conjurar agora: truques, e as preparadas
       (ou todas, para quem não prepara) — a mesma regra da aba Magias. */
    if (f.atributoMagia) {
      const prontas = f.magias
        .map(function (nome) { return MAGIAS.find(function (m) { return m.nome === nome; }); })
        .filter(function (m) { return m && (m.nivel === 0 || !f.preparaMagias || f.preparadas.indexOf(m.nome) !== -1); })
        .sort(function (a, b) { return a.nivel - b.nivel || a.nome.localeCompare(b.nome); });
      cartao.appendChild(criar('div.titulo-grupo', 'Magias prontas · CD ' + Ficha.cdMagia(f)));
      cartao.appendChild(criar('div.linha-botoes', [
        criarBotao('mini-botao.botao-uso', 'ataque-magico', 'magia', 'Ataque mágico ' + comSinal(Ficha.ataqueMagia(f)))
      ]));
      prontas.forEach(function (magia) {
        const conjurar = criarBotao('mini-botao.botao-uso', 'conjurar', 'magia', 'Conjurar');
        conjurar.dataset.nome = magia.nome;
        /* O nível antes do nome, como na aba Magias (span.nivel-magia). */
        cartao.appendChild(criar('div.linha-uso', [
          criar('div', [
            criar('span.nivel-magia', magia.nivel === 0 ? 'T' : magia.nivel + 'º'),
            criar('span.nome-uso', magia.nome)
          ]),
          criar('div.botoes-uso', [conjurar])
        ]));
      });
    }
    return cartao;
  },


  cartaoMagias: function (f) {
    const self = this;
    const nomeAtributo = (ATRIBUTOS_FICHA.find(function (p) { return p[0] === f.atributoMagia; }) || [])[1];

    const ataque = criarBotao('mini-botao.botao-uso', 'ataque-magico', 'magia', 'Ataque mágico ' + comSinal(Ficha.ataqueMagia(f)));
    const cartao = criar('div.cartao', [
      criar('div.titulo-coluna', [
        criarComIcone('h2', 'magia', 'Magias', 16),
        criar('span.sub', 'CD ' + Ficha.cdMagia(f) + ' · ' + nomeAtributo)
      ])
    ]);

    /* A concentração em curso, com o botão de largar. */
    if (f.concentrando) cartao.appendChild(this.avisoConcentracao(f));

    cartao.appendChild(criar('div.linha-botoes', [ataque]));

    /* Quem prepara magias vê quantas preparou e o limite do dia. */
    const preparadas = f.preparadas.filter(function (n) {
      const m = MAGIAS.find(function (x) { return x.nome === n; });
      return m && m.nivel > 0;
    }).length;
    if (f.preparaMagias) {
      const limite = Ficha.limitePreparadas(f);
      cartao.appendChild(criar('p.contador-preparadas' + (preparadas > limite ? '.estourou' : ''),
        'Preparadas hoje: ' + preparadas + ' de ' + limite + ' (atributo + nível). Truques não contam e estão sempre prontos.'));
    }

    /* Espaços: uma fileira de bolinhas por nível que tenha espaço. */
    const niveis = NIVEIS_MAGIA.filter(function (n) { return (Number(f.espacos[n]) || 0) > 0; });
    if (niveis.length) {
      const espacos = criar('div.espacos-uso');
      niveis.forEach(function (n) {
        espacos.appendChild(criar('div.linha-bolinhas', [
          criar('span.rotulo-bolinhas', n + 'º'),
          self.bolinhas('espaco', n, Number(f.espacos[n]), Number(f.espacosGastos[n]) || 0, 'espaço de ' + n + 'º nível'),
          criar('span.sobra', Ficha.espacosLivres(f, n) + ' livres')
        ]));
      });
      cartao.appendChild(espacos);
    }

    /* As magias que ele conhece, da mais baixa para a mais alta. Cada
       uma abre os detalhes (o mesmo texto do Compêndio). */
    const todas = f.magias
      .map(function (nome) { return MAGIAS.find(function (m) { return m.nome === nome; }); })
      .filter(Boolean)
      .sort(function (a, b) { return a.nivel - b.nivel || a.nome.localeCompare(b.nome); });

    /* O filtro por nível: só os níveis que ele conhece de fato. */
    const niveisConhecidos = todas.map(function (m) { return m.nivel; })
      .filter(function (n, i, lista) { return lista.indexOf(n) === i; });
    if (niveisConhecidos.length > 1) {
      const filtros = criar('div.filtros-magia');
      ['todas'].concat(niveisConhecidos).forEach(function (n) {
        const botao = criar('button.filtro' + (String(self.filtroNivel) === String(n) ? '.ativo' : ''),
          n === 'todas' ? 'Todas' : (n === 0 ? 'Truques' : n + 'º'));
        botao.type = 'button';
        botao.dataset.acao = 'filtro-magia';
        botao.dataset.nivel = n;
        filtros.appendChild(botao);
      });
      cartao.appendChild(filtros);
    }

    const conhecidas = todas.filter(function (m) {
      return self.filtroNivel === 'todas' || String(m.nivel) === String(self.filtroNivel);
    });

    if (!todas.length) {
      cartao.appendChild(criar('p.dica', 'Nenhuma magia escolhida. Em "Editar ficha", marque as que o personagem conhece.'));
    }

    conhecidas.forEach(function (magia) {
      const preparada = magia.nivel === 0 || !f.preparaMagias || f.preparadas.indexOf(magia.nome) !== -1;

      const conjurar = criarBotao('mini-botao.botao-uso', 'conjurar', 'magia', 'Conjurar');
      conjurar.dataset.nome = magia.nome;
      /* Quem prepara só conjura o que preparou hoje. */
      if (!preparada) {
        conjurar.disabled = true;
        conjurar.title = 'Prepare esta magia para poder conjurá-la hoje.';
      }

      let preparar = null;
      if (f.preparaMagias && magia.nivel > 0) {
        preparar = criarBotao('mini-botao' + (preparada ? '.preparada' : ''), 'preparar', preparada ? 'check' : null,
          preparada ? 'Preparada' : 'Preparar');
        preparar.dataset.nome = magia.nome;
        preparar.setAttribute('aria-pressed', preparada ? 'true' : 'false');
      }

      const resumo = criar('summary', [
        criar('span.nivel-magia', magia.nivel === 0 ? 'T' : magia.nivel + 'º'),
        criar('span.nome-uso', magia.nome),
        magia.concentracao ? criar('span.pilula', 'Conc.') : null,
        magia.ritual ? criar('span.pilula.azul', 'Ritual') : null
      ]);

      const detalhe = criar('details.magia-uso', [
        resumo,
        criar('div.meta-magia', [magia.tempo, magia.alcance, magia.componentes, magia.duracao].join(' · ')),
        criar('p', magia.texto),
        magia.superior ? criar('p.dica', 'Em espaços superiores: ' + magia.superior) : null
      ]);

      cartao.appendChild(criar('div.linha-magia' + (preparada ? '' : '.nao-preparada'), [
        detalhe, criar('div.botoes-uso', [preparar, conjurar])
      ]));
    });

    return cartao;
  },


  cartaoRecursos: function (f) {
    const self = this;
    const cartao = criar('div.cartao', [criarComIcone('h2', 'surto', 'Recursos e descanso', 16)]);

    if (!f.recursos.length) {
      cartao.appendChild(criar('p.dica', 'Usos limitados da classe — Surto de Ação, Fúria, Inspiração Bárdica — entram em "Editar ficha".'));
    }

    f.recursos.forEach(function (recurso, i) {
      cartao.appendChild(criar('div.linha-bolinhas', [
        criar('span.nome-uso', recurso.nome),
        self.bolinhas('recurso', i, recurso.total, recurso.gastos || 0, recurso.nome),
        criar('span.sobra', recurso.recarga === 'curto' ? 'descanso curto' : 'descanso longo')
      ]));
    });

    cartao.appendChild(criar('div.linha-botoes.botoes-descanso', [
      criarBotao('botao.fantasma.pequeno', 'descanso-curto', 'ampulheta', 'Descanso curto'),
      criarBotao('botao.fantasma.pequeno', 'descanso-longo', 'recarregar', 'Descanso longo')
    ]));
    return cartao;
  },


  /* Uma fileira de bolinhas. As primeiras `gastos` estão apagadas.
     Clicar numa acesa gasta uma; clicar numa apagada devolve uma. */
  bolinhas: function (tipo, chave, total, gastos, rotulo) {
    const fileira = criar('span.bolinhas');
    for (let i = 0; i < total; i++) {
      const gasta = i < gastos;
      const bolinha = criar('button.bolinha' + (gasta ? '.gasta' : ''));
      bolinha.type = 'button';
      bolinha.dataset.acao = 'bolinha';
      bolinha.dataset.tipo = tipo;
      bolinha.dataset.chave = chave;
      bolinha.dataset.gasta = gasta ? '1' : '0';
      bolinha.setAttribute('aria-label', (gasta ? 'Recuperar ' : 'Gastar ') + rotulo);
      fileira.appendChild(bolinha);
    }
    return fileira;
  },


  /* ===================================================================
     AS AÇÕES DE USO
     =================================================================== */

  /* Muda a ficha e envia. `mudar` recebe uma CÓPIA da ficha atual;
     devolver false cancela (nada a gravar). */
  usar: function (mudar, recado, ehErro) {
    const meu = Jogador.visao.meuHeroi;
    if (!meu) return false;

    const f = this.completar(JSON.parse(JSON.stringify(meu.ficha)));
    if (mudar(f) === false) return false;

    const heroi = Object.assign(
      { id: meu.id, dono: meu.dono, jogador: meu.jogador, nome: meu.nome, ficha: f },
      Ficha.resumoDoHeroi(f, Jogador.visao.regras, Jogador.sessao.nome)
    );
    const problema = enviarMeuHeroi(Jogador.sessao, heroi);
    if (problema) {
      Layout.recado(problema, true);
      return false;
    }

    Jogador.render();
    if (recado) Layout.recado(recado, ehErro);
    return true;
  },

  fichaAtual: function () {
    return this.completar(JSON.parse(JSON.stringify(Jogador.visao.meuHeroi.ficha)));
  },


  atacar: function (indice) {
    const f = this.fichaAtual();
    const ataque = f.ataques[indice];
    if (!ataque) return;

    const rolagem = RoladorJogador.d20();
    const bonus = Ficha.bonusAtaque(f, ataque);
    /* Guardado ANTES de registrar: registrar() redesenha a ficha, e o
       botão de dano já nasce marcado como crítico. */
    this.criticoDe = rolagem.dado === 20 ? indice : null;

    const texto = 'Ataque — ' + ataque.nome;
    const formula = rolagem.formula + ' ' + (bonus < 0 ? '− ' + Math.abs(bonus) : '+ ' + bonus);
    const marca = rolagem.dado === 20 ? 'critico' : (rolagem.dado === 1 ? 'falha' : null);
    RoladorJogador.registrar(
      { texto: texto, formula: formula, total: rolagem.dado + bonus, marca: marca },
      Object.assign(RoladorJogador.cenaTeste(texto, rolagem, bonus, formula, marca), { ataque: true })
    );
    /* Com a animação ligada, o "20 natural" já aparece nela. */
    if (rolagem.dado === 20 && !Dados3D.ativa()) Layout.recado('Crítico! O próximo dano de ' + ataque.nome + ' rola os dados em dobro.');
  },


  dano: function (indice) {
    const f = this.fichaAtual();
    const ataque = f.ataques[indice];
    if (!ataque) return;

    const critico = this.criticoDe === indice;
    this.criticoDe = null;

    const resultado = Ficha.rolarDano(f, ataque, critico);
    if (!resultado) {
      Layout.recado('O dano de ' + ataque.nome + ' não está no formato de dados (ex.: 1d8). Ajuste em "Editar ficha".', true);
      return;
    }

    const texto = 'Dano — ' + ataque.nome + (ataque.tipo ? ' (' + ataque.tipo + ')' : '');
    RoladorJogador.registrar(
      { texto: texto, formula: resultado.formula, total: resultado.total, marca: critico ? 'critico' : null },
      { modo: 'dano', faces: resultado.faces, valores: resultado.dados, texto: texto,
        total: resultado.total, formula: resultado.formula, marca: critico ? 'critico' : null }
    );
  },


  ataqueMagico: function () {
    const f = this.fichaAtual();
    RoladorJogador.rolarTeste('Ataque mágico', Ficha.ataqueMagia(f));
  },


  /* Conjurar gasta o menor espaço que serve. Truque não gasta nada.
     Magia de concentração substitui a anterior — no D&D, começar a
     manter uma encerra a outra. */
  conjurar: function (nome) {
    const magia = MAGIAS.find(function (m) { return m.nome === nome; });
    if (!magia) return;

    let usado = null;
    let anterior = '';
    let recado = '';

    const ok = this.usar(function (f) {
      /* O botão já vem desligado, mas a regra é conferida aqui também:
         o botão é a tela; esta função é a regra. */
      if (magia.nivel > 0 && f.preparaMagias && f.preparadas.indexOf(magia.nome) === -1) {
        recado = magia.nome + ' não está preparada hoje.';
        return false;
      }
      if (magia.nivel > 0) {
        usado = Ficha.espacoParaConjurar(f, magia.nivel);
        if (usado === null) {
          recado = 'Sem espaço livre de ' + magia.nivel + 'º nível ou maior para ' + magia.nome + '.';
          return false;
        }
        f.espacosGastos[usado] = (Number(f.espacosGastos[usado]) || 0) + 1;
      }
      if (magia.concentracao) {
        anterior = f.concentrando && f.concentrando !== magia.nome ? f.concentrando : '';
        f.concentrando = magia.nome;
      }
      recado = magia.nome + (usado ? ' conjurada com um espaço de ' + usado + 'º nível.' : ' conjurada.')
        + (anterior ? ' Você parou de manter ' + anterior + '.' : '')
        + (magia.concentracao ? ' Concentração ativa.' : '');
    }, null);

    if (!ok) {
      if (recado) Layout.recado(recado, true);
      return;
    }

    /* A condição no combate é outra ação: a ficha é do jogador, o
       combatente vive no combate. */
    if (magia.concentracao) enviarConcentracao(Jogador.sessao, true);
    Jogador.render();
    Layout.recado(recado);
  },


  /* Preparar e despreparar. Passar do limite é permitido, mas o
     contador fica vermelho: há talentos e itens que mudam o limite, e
     quem confere é o Mestre. */
  preparar: function (nome) {
    let preparou = false;
    const ok = this.usar(function (f) {
      if (f.magias.indexOf(nome) === -1) return false;
      const posicao = f.preparadas.indexOf(nome);
      if (posicao === -1) { f.preparadas.push(nome); preparou = true; }
      else f.preparadas.splice(posicao, 1);
    });
    if (ok) Layout.recado(nome + (preparou ? ' preparada para hoje.' : ' deixou de estar preparada.'));
  },


  encerrarConcentracao: function () {
    const ok = this.usar(function (f) {
      if (!f.concentrando) return false;
      f.concentrando = '';
    }, 'Concentração encerrada.');
    if (ok) {
      enviarConcentracao(Jogador.sessao, false);
      Jogador.render();
    }
  },


  bolinha: function (tipo, chave, gasta) {
    this.usar(function (f) {
      if (tipo === 'espaco') {
        const total = Number(f.espacos[chave]) || 0;
        const atual = Number(f.espacosGastos[chave]) || 0;
        f.espacosGastos[chave] = Math.max(0, Math.min(total, atual + (gasta ? -1 : 1)));
      } else {
        const recurso = f.recursos[Number(chave)];
        if (!recurso) return false;
        recurso.gastos = Math.max(0, Math.min(recurso.total, (recurso.gastos || 0) + (gasta ? -1 : 1)));
      }
    });
  },


  descanso: function (tipo) {
    const longo = tipo === 'longo';
    let largouConcentracao = false;

    const ok = this.usar(function (f) {
      f.recursos.forEach(function (r) {
        if (longo || r.recarga === 'curto') r.gastos = 0;
      });
      if (longo) {
        f.espacosGastos = {};
        largouConcentracao = !!f.concentrando;
        f.concentrando = '';
      }
    }, longo
      ? 'Descanso longo: espaços de magia e recursos recarregados. O PV volta pelo Mestre.'
      : 'Descanso curto: recursos de descanso curto recarregados.');

    if (ok && largouConcentracao) {
      enviarConcentracao(Jogador.sessao, false);
      Jogador.render();
    }
  },


  /* ===================================================================
     NO FORMULÁRIO (Editar ficha / Criar personagem)
     =================================================================== */

  montarForm: function (form, f) {
    this.completar(f);
    form.appendChild(this.secaoAtaques(f));
    form.appendChild(this.secaoMagia(f));
    form.appendChild(this.secaoRecursos(f));
  },


  secaoAtaques: function (f) {
    const secao = criar('fieldset.secao-ficha', [criar('legend', 'Ataques')]);
    secao.appendChild(criar('p.ajuda-campo',
      'Escolha uma arma da lista para preencher sozinho, ou escreva o seu (garras, ataque desarmado, arma mágica). O bônus de acerto é calculado.'));

    const opcoes = [['', 'Escolher da lista de armas…']].concat(ARMAS.map(function (a) {
      return [a.nome, a.nome + ' (' + a.dano + ' ' + a.tipoDano + ')'];
    }));

    f.ataques.forEach(function (ataque, i) {
      const linha = criar('div.linha-form-uso');
      linha.dataset.ataque = i;

      linha.appendChild(UsoFicha.entrada('text', 'nome', ataque.nome, 'Nome do ataque', 40, 'Espada longa'));
      linha.appendChild(UsoFicha.selecao('arma', '', opcoes, 'Preencher com uma arma da lista'));
      linha.appendChild(UsoFicha.selecao('atributo', ataque.atributo,
        ATRIBUTOS_FICHA.map(function (p) { return [p[0], p[0].toUpperCase()]; }), 'Atributo do ataque'));
      linha.appendChild(UsoFicha.entrada('text', 'dano', ataque.dano, 'Dado de dano', 8, '1d8'));
      linha.appendChild(UsoFicha.entrada('text', 'tipo', ataque.tipo, 'Tipo de dano', 20, 'cortante'));
      linha.appendChild(UsoFicha.entrada('number', 'bonus', ataque.bonus || 0, 'Bônus mágico', null, '0'));

      const prof = document.createElement('input');
      prof.type = 'checkbox';
      prof.dataset.parte = 'proficiente';
      prof.checked = ataque.proficiente !== false;
      linha.appendChild(criar('label.marcar-opcao.prof-uso', [prof, document.createTextNode('Proficiente')]));

      const calc = criar('span.calc.calc-ataque');
      calc.dataset.calc = 'ataque-' + i;
      linha.appendChild(calc);

      const tirar = criar('button.tirar', '×');
      tirar.type = 'button';
      tirar.dataset.acao = 'tirar-linha';
      tirar.dataset.lista = 'ataques';
      tirar.dataset.indice = i;
      tirar.setAttribute('aria-label', 'Remover ' + (ataque.nome || 'ataque'));
      linha.appendChild(tirar);

      secao.appendChild(linha);
    });

    if (f.ataques.length < LIMITE_LINHAS) {
      const mais = criarBotao('mini-botao', 'mais-linha', 'mais', 'Adicionar ataque');
      mais.dataset.lista = 'ataques';
      secao.appendChild(mais);
    }
    return secao;
  },


  secaoMagia: function (f) {
    const secao = criar('fieldset.secao-ficha', [criar('legend', 'Magia')]);

    const atributo = UsoFicha.selecao('atributoMagia', f.atributoMagia, [
      ['', 'Não conjura magias'], ['int', 'Inteligência (mago, artífice)'],
      ['sab', 'Sabedoria (clérigo, druida, patrulheiro)'], ['car', 'Carisma (bardo, bruxo, feiticeiro, paladino)']
    ], 'Atributo de conjuração');
    atributo.id = 'f-atributoMagia';
    const etiqueta = document.createElement('label');
    etiqueta.textContent = 'Atributo de conjuração';
    etiqueta.htmlFor = 'f-atributoMagia';
    secao.appendChild(criar('div.campo-form', [etiqueta, atributo]));

    const calc = criar('p.ajuda-campo');
    calc.dataset.calc = 'magia';
    secao.appendChild(calc);

    /* Clérigo, druida, mago e paladino escolhem a cada dia quais das
       magias conhecidas estão prontas. Sugerido pela classe escrita,
       mas é o jogador que marca. */
    const prepara = document.createElement('input');
    prepara.type = 'checkbox';
    prepara.id = 'f-preparaMagias';
    prepara.checked = f.preparaMagias;
    secao.appendChild(criar('label.marcar-opcao', [prepara,
      document.createTextNode('Prepara magias a cada dia (clérigo, druida, mago, paladino)')]));

    /* Os espaços vêm da tabela da classe no Livro do Jogador — não
       estão no regras.js, então o jogador copia do livro. */
    const espacos = criar('div.espacos-form');
    NIVEIS_MAGIA.forEach(function (n) {
      const entrada = document.createElement('input');
      entrada.type = 'number';
      entrada.min = 0;
      entrada.max = 9;
      entrada.value = Number(f.espacos[n]) || 0;
      entrada.dataset.espaco = n;
      entrada.setAttribute('aria-label', 'Espaços de ' + n + 'º nível');
      espacos.appendChild(criar('label.espaco-form', [criar('span', n + 'º'), entrada]));
    });
    secao.appendChild(criar('div', [criar('div.titulo-grupo', 'Espaços de magia por nível (veja a tabela da sua classe)'), espacos]));

    /* As magias: as do Compêndio, marcáveis. As da classe escrita na
       ficha vêm primeiro — o resto continua disponível (há classes e
       subclasses que pegam magias de outras listas). */
    const classe = semAcento(f.classe || '').split(/\s+/)[0].replace(/[ao]$/, '');
    const daClasse = function (m) {
      return m.classes.some(function (c) { return semAcento(c).replace(/[ao]$/, '') === classe; });
    };
    const ordenadas = MAGIAS.slice().sort(function (a, b) {
      return (daClasse(b) - daClasse(a)) || (a.nivel - b.nivel) || a.nome.localeCompare(b.nome);
    });

    const lista = criar('div.magias-form');
    ordenadas.forEach(function (m) {
      const marca = document.createElement('input');
      marca.type = 'checkbox';
      marca.dataset.magia = m.nome;
      marca.checked = f.magias.indexOf(m.nome) !== -1;
      lista.appendChild(criar('label.pericia-form' + (daClasse(m) ? '.da-classe' : ''), [
        marca,
        criar('span.nome', m.nome),
        criar('span.atrib', m.nivel === 0 ? 'Truque' : m.nivel + 'º')
      ]));
    });
    secao.appendChild(criar('div', [criar('div.titulo-grupo', 'Magias que o personagem conhece'), lista]));
    return secao;
  },


  secaoRecursos: function (f) {
    const secao = criar('fieldset.secao-ficha', [criar('legend', 'Recursos')]);
    secao.appendChild(criar('p.ajuda-campo', 'Usos limitados: Surto de Ação 1 (curto), Fúria 3 (longo), Inspiração Bárdica 3 (longo)…'));

    f.recursos.forEach(function (recurso, i) {
      const linha = criar('div.linha-form-uso.recurso');
      linha.dataset.recurso = i;
      linha.appendChild(UsoFicha.entrada('text', 'nome', recurso.nome, 'Nome do recurso', 40, 'Surto de Ação'));
      linha.appendChild(UsoFicha.entrada('number', 'total', recurso.total, 'Quantos usos', null, '1'));
      linha.appendChild(UsoFicha.selecao('recarga', recurso.recarga || 'longo',
        [['curto', 'Volta no descanso curto'], ['longo', 'Volta no descanso longo']], 'Quando recarrega'));

      const tirar = criar('button.tirar', '×');
      tirar.type = 'button';
      tirar.dataset.acao = 'tirar-linha';
      tirar.dataset.lista = 'recursos';
      tirar.dataset.indice = i;
      tirar.setAttribute('aria-label', 'Remover ' + (recurso.nome || 'recurso'));
      linha.appendChild(tirar);
      secao.appendChild(linha);
    });

    if (f.recursos.length < LIMITE_LINHAS) {
      const mais = criarBotao('mini-botao', 'mais-linha', 'mais', 'Adicionar recurso');
      mais.dataset.lista = 'recursos';
      secao.appendChild(mais);
    }
    return secao;
  },


  entrada: function (tipo, parte, valor, rotulo, limite, dica) {
    const entrada = document.createElement('input');
    entrada.type = tipo;
    entrada.value = valor === undefined || valor === null ? '' : valor;
    entrada.dataset.parte = parte;
    entrada.placeholder = dica || '';
    entrada.setAttribute('aria-label', rotulo);
    if (limite) entrada.maxLength = limite;
    return entrada;
  },

  selecao: function (parte, valor, opcoes, rotulo) {
    const entrada = document.createElement('select');
    entrada.dataset.parte = parte;
    entrada.setAttribute('aria-label', rotulo);
    opcoes.forEach(function (par) {
      const opcao = document.createElement('option');
      opcao.value = par[0];
      opcao.textContent = par[1];
      entrada.appendChild(opcao);
    });
    entrada.value = valor || '';
    return entrada;
  },


  /* Copia as três seções do formulário para o rascunho. Os "gastos"
     não estão no formulário: vêm da ficha e são preservados. */
  lerForm: function (form, f) {
    this.completar(f);

    /* As linhas estão na mesma ordem de f.ataques: é pela posição que
       a ligação com o item do inventário (doItem) sobrevive à edição. */
    const ataquesAntigos = f.ataques;
    f.ataques = Array.prototype.map.call(form.querySelectorAll('[data-ataque]'), function (linha, i) {
      const valor = function (parte) { const e = linha.querySelector('[data-parte="' + parte + '"]'); return e ? e.value.trim() : ''; };
      return {
        nome: valor('nome'), atributo: valor('atributo') || 'for',
        dano: valor('dano'), tipo: valor('tipo'), bonus: valor('bonus'),
        proficiente: linha.querySelector('[data-parte="proficiente"]').checked,
        doItem: ataquesAntigos[i] ? ataquesAntigos[i].doItem : undefined
      };
    });

    const atributo = form.querySelector('#f-atributoMagia');
    if (atributo) f.atributoMagia = atributo.value;
    const prepara = form.querySelector('#f-preparaMagias');
    if (prepara) f.preparaMagias = prepara.checked;

    form.querySelectorAll('[data-espaco]').forEach(function (e) { f.espacos[e.dataset.espaco] = e.value; });

    f.magias = Array.prototype.filter.call(form.querySelectorAll('[data-magia]'), function (c) { return c.checked; })
      .map(function (c) { return c.dataset.magia; });

    const antigos = f.recursos;
    f.recursos = Array.prototype.map.call(form.querySelectorAll('[data-recurso]'), function (linha, i) {
      const valor = function (parte) { return linha.querySelector('[data-parte="' + parte + '"]').value.trim(); };
      return {
        nome: valor('nome'), total: valor('total'), recarga: valor('recarga'),
        gastos: antigos[i] ? antigos[i].gastos || 0 : 0
      };
    });
  },


  /* Os números que mudam enquanto se digita: o acerto de cada ataque
     e a CD de magia. */
  atualizar: function (f) {
    this.completar(f);
    f.ataques.forEach(function (ataque, i) {
      const alvo = document.querySelector('[data-calc="ataque-' + i + '"]');
      if (!alvo) return;
      const valido = ATRIBUTOS_FICHA.some(function (p) { return p[0] === ataque.atributo; });
      alvo.textContent = valido ? 'Acerto ' + comSinal(Ficha.bonusAtaque(f, ataque)) : '';
    });

    const magia = document.querySelector('[data-calc="magia"]');
    if (magia) {
      magia.textContent = f.atributoMagia
        ? 'CD de magia ' + Ficha.cdMagia(f) + ' · ataque mágico ' + comSinal(Ficha.ataqueMagia(f))
        : 'Sem atributo de conjuração, a ficha não mostra o cartão de magias.';
    }
  },


  /* Preenche uma linha de ataque com uma arma da lista. */
  aplicarArma: function (f, indice, nomeArma) {
    const arma = ARMAS.find(function (a) { return a.nome === nomeArma; });
    const ataque = f.ataques[indice];
    if (!arma || !ataque) return;
    ataque.nome = arma.nome;
    ataque.dano = arma.dano;
    ataque.tipo = arma.tipoDano;
    ataque.atributo = Ficha.atributoDaArma(f, arma);
    ataque.proficiente = true;
  },


  /* Confere e converte. Devolve { erro, campo } ou { limpo }: os campos
     prontos para entrar na ficha. Linhas totalmente em branco somem. */
  validar: function (f) {
    this.completar(f);
    function inteiro(valor, min, max) {
      const n = Number(valor);
      return Number.isInteger(n) && n >= min && n <= max ? n : null;
    }

    const ataques = [];
    for (const a of f.ataques) {
      if (!a.nome && !a.dano && !a.tipo) continue;
      if (!a.nome) return { erro: 'Um ataque está sem nome.' };
      if (a.nome.length > 40 || (a.tipo || '').length > 20) return { erro: 'Texto longo demais no ataque "' + a.nome + '".' };
      if (!/^\d{1,2}d(4|6|8|10|12|20)$/.test(a.dano.replace(/\s+/g, ''))) {
        return { erro: 'Dano de "' + a.nome + '": escreva como no livro, ex.: 1d8 ou 2d6.' };
      }
      if (!ATRIBUTOS_FICHA.some(function (p) { return p[0] === a.atributo; })) return { erro: 'Atributo inválido em "' + a.nome + '".' };
      const bonus = inteiro(a.bonus === '' ? 0 : a.bonus, -5, 10);
      if (bonus === null) return { erro: 'Bônus mágico de "' + a.nome + '": de −5 a +10.' };
      const limpo = { nome: a.nome, atributo: a.atributo, proficiente: !!a.proficiente, dano: a.dano.replace(/\s+/g, ''), tipo: a.tipo, bonus: bonus };
      /* A ligação com a arma do inventário, se a linha nasceu de uma. */
      if (a.doItem && (f.itens || []).some(function (i) { return i.id === a.doItem; })) limpo.doItem = a.doItem;
      ataques.push(limpo);
    }

    if (['', 'int', 'sab', 'car'].indexOf(f.atributoMagia) === -1) return { erro: 'Escolha o atributo de conjuração da lista.' };

    const espacos = {};
    const espacosGastos = {};
    for (const n of NIVEIS_MAGIA) {
      const total = inteiro(f.espacos[n] === '' ? 0 : f.espacos[n], 0, 9);
      if (total === null) return { erro: 'Espaços de ' + n + 'º nível: de 0 a 9.' };
      if (total) {
        espacos[n] = total;
        const gastos = Math.min(total, Number(f.espacosGastos[n]) || 0);
        if (gastos) espacosGastos[n] = gastos;
      }
    }

    const magias = f.magias.filter(function (nome, i, lista) {
      return lista.indexOf(nome) === i && MAGIAS.some(function (m) { return m.nome === nome; });
    });

    const recursos = [];
    for (const r of f.recursos) {
      if (!r.nome && !r.total) continue;
      if (!r.nome || r.nome.length > 40) return { erro: 'Cada recurso precisa de um nome (até 40 letras).' };
      const total = inteiro(r.total, 1, 20);
      if (total === null) return { erro: 'Usos de "' + r.nome + '": de 1 a 20.' };
      if (r.recarga !== 'curto' && r.recarga !== 'longo') return { erro: 'Recarga inválida em "' + r.nome + '".' };
      recursos.push({ nome: r.nome, total: total, recarga: r.recarga, gastos: Math.min(total, Number(r.gastos) || 0) });
    }

    return {
      limpo: {
        ataques: ataques, atributoMagia: f.atributoMagia, espacos: espacos, espacosGastos: espacosGastos,
        magias: magias, recursos: recursos,
        preparaMagias: !!f.preparaMagias,
        /* Só pode estar preparada uma magia que ele ainda conhece. */
        preparadas: f.preparadas.filter(function (n) { return magias.indexOf(n) !== -1; }),
        /* Largou a magia que mantinha? A concentração some junto. */
        concentrando: magias.indexOf(f.concentrando) !== -1 ? f.concentrando : ''
      }
    };
  }
};
