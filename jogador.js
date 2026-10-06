/* ===================================================================
   jogador.js — o painel do jogador

   Três peças, nesta ordem de leitura:

   1. visaoDoJogador()  O QUE o jogador pode ver. A tela só desenha o
                        que sai dela — nunca lê o Estado direto.
   2. enviarMeuHeroi()  O QUE o jogador pode mudar: a própria ficha, e
                        nada mais. É uma AÇÃO ("salve este personagem"),
                        não "salve a campanha inteira".
   3. Jogador           a tela: moldura, ficha (ver / criar / editar).


   ===================================================================
   POR QUE AS PEÇAS 1 E 2 EXISTEM, SE TUDO RODA NO MESMO NAVEGADOR
   ===================================================================
   Hoje elas são uma placa: um jogador esperto abre o DevTools e lê o
   Estado inteiro, segredos incluídos. Mas elas já têm o FORMATO certo.
   Quando o servidor existir:

     visaoDoJogador()  passa a rodar NO SERVIDOR, antes de mandar os
                       dados. O que ela tira não chega ao navegador do
                       jogador — aí, sim, é porta.
     enviarMeuHeroi()  vira uma mensagem ao servidor, que confere se o
                       personagem é mesmo de quem mandou.

   E esta tela não precisa mudar nada: ela já só conhece o que essas
   duas funções deixam. (Problema 5 da lista de segurança, "dado de
   mestre não é escondido, é não enviado", começa a ser resolvido aqui.)


   QUEM É O JOGADOR
   A sessão guarda um jogadorId, criado na entrada. Sem servidor ele é
   autodeclarado — é o problema 2 do CLAUDE.md, e só um token assinado
   pelo servidor resolve de vez.
   =================================================================== */


/* ===================================================================
   1. O QUE O JOGADOR VÊ

   Lista BRANCA: copia campo por campo o que é público. Uma lista negra
   ("tudo menos os segredos") vazaria o primeiro campo secreto que
   alguém criasse e esquecesse de acrescentar nela.
   =================================================================== */

function visaoDoJogador(estado, jogadorId) {
  const c = estado.campanha;
  const herois = estado.herois || [];
  const meu = herois.find(function (h) { return h.dono === jogadorId; });

  return {
    campanha: {
      nome: c.nome, sistema: c.sistema, sessao: c.sessao,
      premissa: c.premissa, cenario: c.cenario, tom: c.tom,
      /* Linhas e véus são justamente para os jogadores verem. */
      linhas: c.linhas || c.limites, veus: c.veus,
      nivelInicial: c.nivelInicial, regra: c.regra
    },
    mestre: estado.mestre.nome,
    grupo: estado.grupo ? estado.grupo.nome : '',
    regras: regrasPersonagem(estado),

    /* A própria ficha vem inteira — é dele. Cópia, para a tela não
       mexer no Estado por engano. */
    meuHeroi: meu ? JSON.parse(JSON.stringify(meu)) : null,

    /* Dos companheiros, só o que se vê de fora. */
    party: herois.filter(function (h) { return h !== meu; }).map(function (h) {
      return { nome: h.nome, classe: h.classe, nivel: h.nivel, jogador: h.jogador || '' };
    })
  };
}


/* ===================================================================
   2. A ÚNICA COISA QUE O JOGADOR GRAVA: O PRÓPRIO PERSONAGEM

   Lê a campanha FRESCA do armazenamento (não a da memória, que pode
   estar velha), troca só este personagem e grava. Se o Mestre mudou
   outra coisa nesse meio-tempo, a mudança dele sobrevive.

   O PV ATUAL não vem da ficha: quem tira e dá PV na mesa é o Mestre,
   no combate. A ficha só muda o máximo — e o atual é preso a ele.
   =================================================================== */

function enviarMeuHeroi(sessao, heroi) {
  const estado = Campanhas.lerEstado(sessao.campanhaId);
  if (!estado) return 'Esta campanha não está mais guardada neste navegador.';

  estado.herois = estado.herois || [];
  const posicao = estado.herois.findIndex(function (h) { return h.id === heroi.id; });

  if (posicao === -1) {
    heroi.pv = heroi.pvMax;
    estado.herois.push(heroi);
  } else {
    const antigo = estado.herois[posicao];
    if (antigo.dono !== sessao.jogadorId) return 'Esse personagem não é seu.';

    /* Estava com a vida cheia? Continua cheio com o máximo novo (subir
       de nível não deixa ninguém ferido). Estava ferido? O atual fica
       como estava — curar é com o Mestre. */
    heroi.pv = antigo.pv >= antigo.pvMax ? heroi.pvMax : Math.min(antigo.pv, heroi.pvMax);
    estado.herois[posicao] = Object.assign({}, antigo, heroi);

    /* Se ele estiver no combate, a CA e o PV máximo de lá acompanham. */
    (estado.combate.combatentes || []).forEach(function (c) {
      if (c.heroiId !== heroi.id) return;
      c.nome = heroi.nome;
      c.ca = heroi.ca;
      c.pvMax = heroi.pvMax;
      c.pv = Math.min(c.pv, heroi.pvMax);
    });
  }

  if (!Campanhas.salvarEstado(sessao.campanhaId, estado)) {
    return 'O navegador não deixou guardar a ficha.';
  }

  Memoria.carregar();         /* a memória desta aba passa a ser a gravada */
  return null;
}


/* ===================================================================
   3. A TELA
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
    if (typeof sessao.jogadorId !== 'string' || !Campanhas.achar(sessao.campanhaId)) {
      this.mostrarRestrito('Esta campanha não está guardada neste navegador. Entre de novo com o código.');
      return;
    }

    this.sessao = sessao;
    document.getElementById('app').hidden = false;
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
    this.visao = visaoDoJogador(Estado, this.sessao.jogadorId);

    this.renderBarra();
    this.renderLateral();

    const area = document.getElementById('principal');
    area.textContent = '';

    if (!this.visao.meuHeroi) {
      /* Sem personagem: a tela inteira é criar um. */
      if (!this.rascunho) this.rascunho = this.rascunhoNovo();
      this.montarFormulario(area, true);
    } else if (this.modo === 'editar') {
      this.montarFormulario(area, false);
    } else {
      this.montarFicha(area, this.visao.meuHeroi);
    }
  },


  renderBarra: function () {
    const barra = document.getElementById('barraJogador');
    barra.textContent = '';

    const emblema = criar('span.emblema');
    emblema.appendChild(Icone.svg('escudo', 19));

    barra.appendChild(criar('div.marca-mestre', [
      emblema,
      criar('div', [
        criar('div.nome', 'Plainus RPG'),
        criar('div.funcao', 'Painel do jogador')
      ])
    ]));

    barra.appendChild(criar('div.campanha-jogador', [
      criar('span.titulo-sessao', this.visao.campanha.nome),
      criar('span.sub', 'Sessão ' + this.visao.campanha.sessao + ' · Mestre: ' + this.visao.mestre)
    ]));

    barra.appendChild(criar('div.espaco'));

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

    const party = criar('div.cartao', [criarComIcone('h2', 'npcs', v.grupo || 'A party', 16)]);
    if (!v.party.length) {
      party.appendChild(criar('p.dica', 'Ninguém mais criou personagem ainda.'));
    } else {
      v.party.forEach(function (h) {
        party.appendChild(criar('div.companheiro', [
          criar('span.inicial-npc', h.nome.charAt(0)),
          criar('div', [
            criar('div.nome', h.nome),
            criar('div.sub', [h.classe, 'Nível ' + h.nivel, h.jogador].filter(Boolean).join(' · '))
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
      criar('div.retrato-heroi', heroi.nome.charAt(0)),
      criar('div', [
        criar('h1.nome-ficha', heroi.nome),
        criar('div.sub', subtitulo)
      ]),
      criarBotao('botao.fantasma.pequeno', 'editar', 'editar', 'Editar ficha')
    ]));

    /* A faixa de números que se consulta a sessão inteira. */
    area.appendChild(criar('div.faixa-ficha', [
      this.numero('CA', Ficha.ca(f)),
      this.numero('PV', heroi.pv + ' / ' + heroi.pvMax),
      this.numero('Iniciativa', comSinal(Ficha.iniciativa(f))),
      this.numero('Deslocamento', f.deslocamento || '9 m'),
      this.numero('Proficiência', comSinal(Ficha.proficiencia(f))),
      this.numero('Percepção passiva', Ficha.percepcaoPassiva(f))
    ]));

    /* Atributos, com a salvaguarda embaixo de cada um. */
    const atributos = criar('div.atributos-ficha');
    ATRIBUTOS_FICHA.forEach(function (par) {
      const treinada = (f.salvaguardas || []).indexOf(par[0]) !== -1;
      atributos.appendChild(criar('div.atributo-ficha', [
        criar('div.sigla', par[1]),
        criar('div.valor', String(Ficha.valor(f, par[0]))),
        criar('div.mod', comSinal(Ficha.mod(f, par[0]))),
        criar('div.salva' + (treinada ? '.treinada' : ''), 'Salv. ' + comSinal(Ficha.salvaguarda(f, par[0])))
      ]));
    });
    area.appendChild(atributos);

    /* Perícias: a bolinha cheia é "treinado". */
    const pericias = criar('div.pericias-ficha');
    PERICIAS.forEach(function (par) {
      const treinada = (f.pericias || []).indexOf(par[0]) !== -1;
      pericias.appendChild(criar('div.pericia' + (treinada ? '.treinada' : ''), [
        criar('span.marca'),
        criar('span.nome', par[0]),
        criar('span.atrib', par[1].toUpperCase()),
        criar('span.bonus', comSinal(Ficha.pericia(f, par[0])))
      ]));
    });
    area.appendChild(criar('div.cartao', [criarComIcone('h2', 'ajustes', 'Perícias', 16), pericias]));

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
        idiomas: 'Comum', equipamento: '', talentos: '', personalidade: '', historia: ''
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

    const ficha = Object.assign({}, f, {
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

    const problema = enviarMeuHeroi(this.sessao, heroi);
    if (problema) {
      Layout.recado(problema, true);
      return;
    }

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
    this.rascunho = { id: meu.id, nome: meu.nome, ficha: JSON.parse(JSON.stringify(meu.ficha)) };
    this.dadoTocado = { dadoVida: true, dadoVida2: true };   /* já foi escolhido antes */
    this.modo = 'editar';
    this.render();
  },


  /* ---------- Eventos ---------- */

  ligar: function () {
    const self = this;

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
      if (!self.rascunho) return;
      const id = evento.target.id;
      if (id === 'f-dadoVida' || id === 'f-dadoVida2') self.dadoTocado[id.slice(2)] = true;
      self.lerFormulario();
      self.atualizarCalculos();
    });

    /* Enter num campo de texto não deve "enviar" a página. */
    document.getElementById('principal').addEventListener('submit', function (evento) {
      evento.preventDefault();
    });

    /* O Mestre mexeu na campanha em outra aba (dados.js já recarregou
       o Estado). Só redesenha se não houver formulário aberto — senão
       apagaria o que está sendo digitado. */
    document.addEventListener('plainus:externo', function () {
      if (self.rascunho) return;
      self.render();
    });
  }
};


Jogador.iniciar();
