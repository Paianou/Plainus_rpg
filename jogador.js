/* ===================================================================
   jogador.js — o painel do jogador: a moldura e a ficha

   O que o jogador VÊ e o que ele pode FAZER não mora aqui: está no
   visao.js (visaoDoJogador, enviarMeuHeroi, enviarRolagem), que é o
   desenho do servidor. Esta tela só desenha o que a visão devolve e
   só grava pelas ações de lá — nunca lê nem escreve o Estado direto.

   Três abas:
     Ficha    a ficha do personagem (ver / criar / editar) — aqui
     Mesa     a cena e a ordem de iniciativa — jogador-mesa.js
     Diário   resumos, segredos revelados, pessoas — jogador-mesa.js
   E o rolador, na coluna lateral (jogador-mesa.js).


   QUEM É O JOGADOR
   A sessão guarda um jogadorId, criado na entrada. Sem servidor ele é
   autodeclarado — é o problema 2 do CLAUDE.md, e só um token assinado
   pelo servidor resolve de vez.
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
  aba: 'ficha',           /* 'ficha' | 'mesa' | 'diario' — estado de VISTA, não vai para o Estado */
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

    /* Criando ou editando a ficha, o formulário ocupa a tela inteira e
       as abas somem: sair dele no meio perderia o que foi digitado. */
    if (!this.visao.meuHeroi) {
      if (!this.rascunho) this.rascunho = this.rascunhoNovo();
      this.montarFormulario(area, true);
      return;
    }
    if (this.modo === 'editar') {
      this.montarFormulario(area, false);
      return;
    }

    area.appendChild(this.montarAbas());
    if (this.aba === 'mesa') MesaJogador.montarMesa(area, this.visao);
    else if (this.aba === 'diario') MesaJogador.montarDiario(area, this.visao);
    else this.montarFicha(area, this.visao.meuHeroi);
  },


  /* As abas do jogador. A da Mesa avisa, de fora, que há combate — e
     acende quando é a vez dele, para ele não precisar ficar olhando. */
  montarAbas: function () {
    const self = this;
    const combate = this.visao.combate;
    const minhaVez = !!(combate && combate.ativo && combate.combatentes.some(function (c) { return c.vez && c.meu; }));

    const abas = criar('div.abas-mesa.abas-jogador');
    [['ficha', 'escudo', 'Ficha'], ['mesa', 'mapa', 'Mesa'], ['diario', 'diario', 'Diário']].forEach(function (trio) {
      const ativa = self.aba === trio[0];
      const botao = criar('button.aba' + (ativa ? '.ativa' : ''));
      botao.type = 'button';
      botao.dataset.acao = 'aba';
      botao.dataset.aba = trio[0];
      botao.setAttribute('aria-pressed', ativa ? 'true' : 'false');
      botao.appendChild(Icone.svg(trio[1], 15));
      botao.appendChild(criar('span', trio[2]));

      if (trio[0] === 'mesa' && minhaVez) botao.appendChild(criar('span.pilula.azul', 'Sua vez'));
      else if (trio[0] === 'mesa' && combate && combate.ativo) botao.appendChild(criar('span.pilula.perigo', 'Combate'));

      abas.appendChild(botao);
    });
    return abas;
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
          criar('span.inicial-npc', h.nome.charAt(0)),
          criar('div.companheiro-corpo', [
            criar('div.nome', h.nome),
            criar('div.sub', [h.classe, 'Nível ' + h.nivel, h.jogador].filter(Boolean).join(' · ')),
            criar('div.vida-jogador', [
              criar('span.numeros', h.pv <= 0 ? 'Caído — 0 PV' : h.pv + ' / ' + h.pvMax + ' PV'),
              criar('div.barra', preenchimento)
            ]),
            h.condicoes.length
              ? criar('div.condicoes-jogador', h.condicoes.map(function (c) { return criar('span.chip-condicao', c); }))
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
      criar('div.retrato-heroi', heroi.nome.charAt(0)),
      criar('div', [
        criar('h1.nome-ficha', heroi.nome),
        criar('div.sub', subtitulo)
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
    this.rascunho = { id: meu.id, nome: meu.nome, ficha: UsoFicha.completar(JSON.parse(JSON.stringify(meu.ficha))) };
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

        /* A aba é estado de vista: troca e redesenha, sem gravar nada.
           O foco volta para a aba, como na Visão Geral do Mestre. */
        case 'aba': {
          self.aba = alvo.dataset.aba;
          self.render();
          const ativa = document.querySelector('.abas-jogador .aba.ativa');
          if (ativa) ativa.focus();
          break;
        }

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
