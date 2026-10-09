/* ===================================================================
   bestiario.js — busca, filtros, ficha de monstro e monstros próprios

   Mesmo desenho do compendio.js:

       catálogo + (busca, filtros)  ->  lista  ->  ficha

   O catálogo é todosMonstros() (dados.js): os do livro (BESTIARIO,
   regras.js, não se editam) mais os que o mestre criou
   (Estado.monstrosMeus, salvos com a campanha).

   Como na tela de NPCs, o painel da direita tem dois modos:
     leitura  a ficha do monstro
     edicao   o formulário (criar, editar ou duplicar)
   O formulário trabalha numa CÓPIA (rascunho): cancelar descarta, e
   nada vira verdade antes do Salvar.

   Duas pontes com o resto da mesa:
     - "Somar ao combate" põe a criatura em Estado.combate, que a tela
       de Combate lê — o monstro já está lá quando você troca de página;
     - um monstro criado aqui aparece no Combate e na busca (Ctrl+K)
       sozinho, porque todos perguntam a todosMonstros().

   Ordenar por ND exige um cuidado: o nd vem como '1/8', '1/4' ou como
   número. Texto ordena '1/8' depois de '10', o que é errado — por
   isso ndNumero() converte antes de comparar.
   =================================================================== */

/* Os campos de texto simples da ficha: [chave, rótulo, limite, dica].
   O formulário, a validação e a leitura percorrem esta lista — a mesma
   ideia da tabela CAMPOS da criação de campanha. */
const CAMPOS_TEXTO = [
  ['deslocamento',       'Deslocamento',          60,  '9 m, voo 18 m'],
  ['salvaguardas',       'Salvaguardas',          120, 'Des +5, Sab +3'],
  ['pericias',           'Perícias',              120, 'Furtividade +6, Percepção +4'],
  ['vulnerabilidades',   'Vulnerabilidades',      120, 'Radiante'],
  ['resistencias',       'Resistências',          160, 'Frio; concussão de ataques não mágicos'],
  ['imunidades',         'Imunidades a dano',     160, 'Veneno, necrótico'],
  ['imunidadesCondicao', 'Imunidades a condição', 160, 'Envenenado, exaustão'],
  ['sentidos',           'Sentidos',              120, 'Visão no escuro 18 m, Percepção passiva 12'],
  ['idiomas',            'Idiomas',               120, 'Comum, Abissal']
];

const ATRIBUTOS = [['for', 'FOR'], ['des', 'DES'], ['con', 'CON'], ['int', 'INT'], ['sab', 'SAB'], ['car', 'CAR']];

const LIMITE_BLOCOS = 12;      /* traços ou ações por ficha */


const Bestiario = {

  filtro: {
    busca: '',
    tipo: 'todos',
    desafio: 'todos'      /* 'todos' | 'baixo' | 'medio' | 'alto' */
  },

  /* O NOME do monstro aberto, e não o objeto: depois de editar, o
     objeto antigo seria uma foto velha. Pelo nome, a ficha é sempre
     buscada de novo. */
  selecionado: null,
  modo: 'leitura',        /* 'leitura' | 'edicao' */
  rascunho: null,


  iniciar: function () {
    if (!Estado.monstrosMeus) Estado.monstrosMeus = [];
    this.montarFiltros();
    this.render();
    this.ligarEventos();
  },


  /* '1/8' -> 0.125, '5' -> 5. Serve para ordenar e para faixas. */
  ndNumero: function (nd) {
    const texto = String(nd);
    if (texto.indexOf('/') === -1) return Number(texto);

    const partes = texto.split('/');
    return Number(partes[0]) / Number(partes[1]);
  },


  /* ---------- Filtros ---------- */

  montarFiltros: function () {
    const self = this;

    /* Tipos que existem de fato no catálogo — inclusive os que só os
       monstros criados por você têm. */
    const tipos = [];
    todosMonstros().forEach(function (ficha) {
      if (ficha.tipo && tipos.indexOf(ficha.tipo) === -1) tipos.push(ficha.tipo);
    });
    tipos.sort();

    const areaTipo = document.getElementById('filtroTipo');
    areaTipo.textContent = '';
    areaTipo.appendChild(criar('span.rotulo-filtro', 'Tipo'));

    ['todos'].concat(tipos).forEach(function (tipo) {
      const botao = criar('button.filtro' + (self.filtro.tipo === tipo ? '.ativo' : ''),
        tipo === 'todos' ? 'Todos' : tipo);
      botao.type = 'button';
      botao.dataset.acao = 'tipo';
      botao.dataset.valor = tipo;
      areaTipo.appendChild(botao);
    });

    /* Faixas de desafio, pensadas pelo uso: o que serve de capanga,
       o que serve de luta séria, o que serve de chefe. */
    const faixas = [
      { id: 'todos', texto: 'Todos' },
      { id: 'baixo', texto: 'ND até 1' },
      { id: 'medio', texto: 'ND 2 a 5' },
      { id: 'alto',  texto: 'ND 6+' }
    ];

    const areaDesafio = document.getElementById('filtroDesafio');
    areaDesafio.textContent = '';
    areaDesafio.appendChild(criar('span.rotulo-filtro', 'Desafio'));

    faixas.forEach(function (faixa) {
      const botao = criar('button.filtro' + (self.filtro.desafio === faixa.id ? '.ativo' : ''), faixa.texto);
      botao.type = 'button';
      botao.dataset.acao = 'desafio';
      botao.dataset.valor = faixa.id;
      areaDesafio.appendChild(botao);
    });
  },


  filtrar: function () {
    const self = this;
    const f = this.filtro;
    const busca = semAcento(f.busca.trim());

    return todosMonstros().filter(function (ficha) {
      if (f.tipo !== 'todos' && ficha.tipo !== f.tipo) return false;

      if (f.desafio !== 'todos') {
        const nd = self.ndNumero(ficha.nd);
        if (f.desafio === 'baixo' && nd > 1) return false;
        if (f.desafio === 'medio' && (nd < 2 || nd > 5)) return false;
        if (f.desafio === 'alto' && nd < 6) return false;
      }

      if (!busca) return true;

      /* Procura também nos traços e nas ações: assim "paralisar" acha
         o Carniçal, e "regeneração" acha o Troll. */
      let alvo = ficha.nome + ' ' + ficha.tipo + ' ' + ficha.tamanho + ' '
        + (ficha.resistencias || '') + ' ' + (ficha.imunidades || '') + ' '
        + (ficha.deslocamento || '');

      (ficha.tracos || []).forEach(function (t) { alvo += ' ' + t.nome + ' ' + t.texto; });
      (ficha.acoes || []).forEach(function (a) { alvo += ' ' + a.nome + ' ' + a.texto; });

      return semAcento(alvo).indexOf(busca) !== -1;
    }).sort(function (a, b) {
      return self.ndNumero(a.nd) - self.ndNumero(b.nd);
    });
  },


  /* ---------- Desenho ---------- */

  render: function () {
    const fichas = this.filtrar();

    this.renderLista(fichas);
    this.renderDetalhe();

    document.getElementById('contagem').textContent =
      fichas.length + (fichas.length === 1 ? ' criatura' : ' criaturas');

    const meus = Estado.monstrosMeus.length;
    document.getElementById('seloTotal').textContent = BESTIARIO.length + ' fichas no bestiário'
      + (meus ? ' · ' + meus + (meus === 1 ? ' sua' : ' suas') : '');
    document.getElementById('limparBusca').hidden = this.filtro.busca === '';
  },


  renderLista: function (fichas) {
    const self = this;
    const area = document.getElementById('lista');
    area.textContent = '';

    if (fichas.length === 0) {
      const vazio = criar('div.vazio');
      vazio.appendChild(Icone.svg('busca', 26));
      vazio.appendChild(criar('div', 'Nada encontrado para "' + this.filtro.busca + '".'));
      vazio.appendChild(criar('div', 'Tente outra palavra, ou afrouxe os filtros de tipo e desafio.'));
      area.appendChild(vazio);
      return;
    }

    fichas.forEach(function (ficha) {
      area.appendChild(self.montarItem(ficha));
    });
  },


  montarItem: function (ficha) {
    const ativo = this.selecionado === ficha.nome;

    const botao = criar('button.item-compendio' + (ativo ? '.ativo' : ''));
    botao.type = 'button';
    botao.dataset.acao = 'abrir';
    botao.dataset.nome = ficha.nome;

    /* O retrato antes do selo: quem procura "aquele bicho de oito
       pernas" acha pela forma antes de ler o nome. Monstro criado por
       você ganha a silhueta do tipo dele, se o tipo tiver uma. */
    /* A foto que o Mestre pôs vence a silhueta. */
    const desenho = Bicho.para(ficha.nome, ficha.tipo);
    if (retratoSeguro(ficha.foto)) {
      botao.classList.add('com-retrato');
      botao.appendChild(criarRetrato('span.marca-bicho', ficha.foto, ficha.nome));
    } else if (desenho) {
      /* A classe avisa ao CSS que esta linha tem uma coluna a mais.
         O .item-compendio e uma grade de tres faixas, compartilhada
         com a lista de magias - que nao tem retrato. Sem a marca, o
         retrato empurraria tudo uma casa para o lado. */
      botao.classList.add('com-retrato');
      const marca = criar('span.marca-bicho');
      marca.appendChild(Bicho.svg(desenho, 22));
      botao.appendChild(marca);
    }

    botao.appendChild(criar('span.selo-nd', 'ND ' + ficha.nd));

    botao.appendChild(criar('div', [
      criar('div.nome-item', ficha.nome),
      criar('div.linha-meta', [ficha.tamanho, ficha.tipo, 'CA ' + ficha.ca, ficha.pv + ' PV']
        .filter(Boolean).join(' · '))
    ]));

    /* Marca quantos desse tipo já estão no combate agora. */
    const noCombate = Estado.combate.combatentes.filter(function (c) {
      return c.nome === ficha.nome || c.nome.indexOf(ficha.nome + ' ') === 0;
    }).length;

    const marcas = criar('div.marcas-item');
    if (ficha.meu) marcas.appendChild(criar('span.pilula.azul', 'Sua'));
    if (noCombate > 0) marcas.appendChild(criar('span.pilula.azul', noCombate + ' em campo'));
    botao.appendChild(marcas);

    return botao;
  },


  renderDetalhe: function () {
    const area = document.getElementById('detalhe');
    area.textContent = '';

    if (this.modo === 'edicao') {
      this.montarFormulario(area);
      return;
    }

    const ficha = this.selecionado ? acharMonstro(this.selecionado) : null;

    if (!ficha) {
      const vazio = criar('div.vazio');
      vazio.style.border = '0';
      vazio.appendChild(Icone.svg('bestiario', 28));
      vazio.appendChild(criar('div', 'Escolha uma criatura para ver a ficha, ou crie uma nova.'));
      area.appendChild(vazio);
      return;
    }

    this.montarFicha(area, ficha);
  },


  montarFicha: function (area, ficha) {
    /* Cabeça */
    const desenhoFicha = Bicho.para(ficha.nome, ficha.tipo);
    const cabeca = criar('div.cabeca-monstro', [
      criar('div', [
        criar('h2.titulo-detalhe', ficha.nome),
        criar('div.subtitulo-detalhe',
          [ficha.tamanho, (ficha.tipo || '').toLowerCase(), ficha.alinhamento].filter(Boolean).join(' · '))
      ])
    ]);

    if (retratoSeguro(ficha.foto)) {
      cabeca.insertBefore(criarRetrato('div.retrato-bicho', ficha.foto, ficha.nome), cabeca.firstChild);
    } else if (desenhoFicha) {
      const retrato = criar('div.retrato-bicho');
      retrato.appendChild(Bicho.svg(desenhoFicha, 40));
      cabeca.insertBefore(retrato, cabeca.firstChild);
    }

    area.appendChild(cabeca);

    /* Defesas */
    area.appendChild(criar('div.defesas-monstro', [
      criar('div.defesa', [
        criar('div.rotulo', 'Classe de armadura'),
        criar('div.valor', String(ficha.ca)),
        ficha.fonteCa ? criar('div.detalhe', ficha.fonteCa) : null
      ]),
      criar('div.defesa', [
        criar('div.rotulo', 'Pontos de vida'),
        criar('div.valor', String(ficha.pv)),
        ficha.dadosVida ? criar('div.detalhe', ficha.dadosVida) : null
      ]),
      criar('div.defesa', [
        criar('div.rotulo', 'Desafio'),
        criar('div.valor', String(ficha.nd)),
        criar('div.detalhe', (ficha.xp || 0).toLocaleString('pt-BR') + ' XP')
      ])
    ]));

    /* Atributos */
    const atributos = criar('div.atributos-monstro');
    ATRIBUTOS.forEach(function (par) {
      const valor = ficha.atributos[par[0]];
      atributos.appendChild(criar('div.atributo', [
        criar('div.sigla', par[1]),
        criar('div.valor', String(valor)),
        criar('div.mod', comSinal(modificador(valor)))
      ]));
    });
    area.appendChild(atributos);

    /* Linhas de detalhe — só as que a ficha tem. */
    const linhas = criar('div.linhas-monstro');
    CAMPOS_TEXTO.forEach(function (campo) {
      if (!ficha[campo[0]]) return;
      linhas.appendChild(criar('div.linha-monstro', [
        criar('span.chave', campo[1] + ':'),
        criar('span', ficha[campo[0]])
      ]));
    });
    area.appendChild(linhas);

    /* Traços e ações */
    if (ficha.tracos && ficha.tracos.length) {
      area.appendChild(this.grupoBlocos('Traços', ficha.tracos));
    }
    if (ficha.acoes && ficha.acoes.length) {
      area.appendChild(this.grupoBlocos('Ações', ficha.acoes));
    }

    /* A ponte com o combate. */
    const somar = criarBotao('botao.pequeno', 'somar', 'combate', 'Somar ao combate');
    somar.dataset.nome = ficha.nome;

    const irCombate = criar('a.botao.fantasma.pequeno', 'Abrir combate');
    irCombate.href = 'combate.html';
    irCombate.style.textDecoration = 'none';

    /* Duplicar serve para qualquer ficha: o jeito mais rápido de fazer
       um "Esqueleto Guerreiro" é partir do Esqueleto. Editar e Apagar
       só existem para os seus — os do livro não mudam. */
    const acoes = [somar, irCombate, criarBotao('botao.fantasma.pequeno', 'duplicar', 'copiar', 'Duplicar')];

    /* Foto: em qualquer monstro, do livro ou seu. */
    acoes.push(criarBotao('botao.fantasma.pequeno', 'foto', 'imagem', ficha.foto ? 'Trocar foto' : 'Pôr foto'));
    if (ficha.foto) acoes.push(criarBotao('botao.fantasma.pequeno', 'tirar-foto', 'remover', 'Tirar foto'));
    if (ficha.meu) {
      acoes.push(criarBotao('botao.fantasma.pequeno', 'editar', 'editar', 'Editar'));
      acoes.push(criarBotao('botao.perigo.pequeno', 'apagar', null, 'Apagar'));
    }

    area.appendChild(criar('div.acoes-detalhe', acoes));
  },


  grupoBlocos: function (titulo, blocos) {
    const grupo = criar('div.grupo-acoes', [criar('div.titulo-grupo', titulo)]);

    blocos.forEach(function (bloco) {
      const paragrafo = criar('div.bloco-acao');
      paragrafo.appendChild(criar('span.nome-acao', bloco.nome + '. '));
      paragrafo.appendChild(document.createTextNode(bloco.texto));
      grupo.appendChild(paragrafo);
    });

    return grupo;
  },


  /* ===================================================================
     O FORMULÁRIO
     =================================================================== */

  /* Um monstro em branco, com os valores mais comuns já postos: é
     mais rápido corrigir um 10 do que digitar seis atributos do zero. */
  moldeVazio: function () {
    return {
      id: 'mm' + Date.now(),
      nome: '', tamanho: 'Médio', tipo: '', alinhamento: '',
      ca: 12, fonteCa: '', pv: 10, dadosVida: '', nd: '1',
      atributos: { for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 },
      deslocamento: '9 m', salvaguardas: '', pericias: '', vulnerabilidades: '',
      resistencias: '', imunidades: '', imunidadesCondicao: '', sentidos: '', idiomas: '',
      tracos: [],
      acoes: [{ nome: '', texto: '' }]
    };
  },


  montarFormulario: function (area) {
    const self = this;
    const r = this.rascunho;
    const novo = !Estado.monstrosMeus.some(function (m) { return m.id === r.id; });

    area.appendChild(criar('h2.titulo-detalhe', novo ? 'Novo monstro' : 'Editando'));
    area.appendChild(criar('div.subtitulo-detalhe',
      novo ? 'Obrigatórios: nome, CA, PV e ND. O resto aparece na ficha se for preenchido.' : r.nome));

    const form = criar('div.formulario');

    /* Identidade */
    form.appendChild(this.campoTexto('nome', 'Nome', r.nome, 60, 'Esqueleto Guerreiro'));
    form.appendChild(criar('div.dupla-form', [
      this.campoSelecao('tamanho', 'Tamanho', r.tamanho, TAMANHOS),
      this.campoTexto('tipo', 'Tipo', r.tipo, 30, 'Morto-vivo', 'tiposMonstro')
    ]));
    form.appendChild(this.campoTexto('alinhamento', 'Alinhamento', r.alinhamento, 40, 'Caótico e mau'));

    /* Os tipos já usados viram sugestão: "Morto-vivo" escrito igual em
       todo lugar é o que faz o filtro de tipo funcionar. */
    const sugestoes = document.createElement('datalist');
    sugestoes.id = 'tiposMonstro';
    todosMonstros().map(function (m) { return m.tipo; })
      .filter(function (t, i, lista) { return t && lista.indexOf(t) === i; })
      .forEach(function (tipo) {
        const opcao = document.createElement('option');
        opcao.value = tipo;
        sugestoes.appendChild(opcao);
      });
    form.appendChild(sugestoes);

    /* Defesas e desafio */
    form.appendChild(criar('div.dupla-form', [
      this.campoNumero('ca', 'Classe de armadura', r.ca, 1, 30),
      this.campoTexto('fonteCa', 'De onde vem a CA', r.fonteCa, 60, 'armadura natural')
    ]));
    form.appendChild(criar('div.dupla-form', [
      this.campoNumero('pv', 'Pontos de vida', r.pv, 1, 999),
      this.campoTexto('dadosVida', 'Dados de vida', r.dadosVida, 20, '6d8+12')
    ]));
    const nd = this.campoSelecao('nd', 'Nível de desafio', String(r.nd), NDS);
    nd.appendChild(criar('div.ajuda', 'O XP sai do ND, pela tabela do Livro dos Monstros.'));
    form.appendChild(nd);

    /* Atributos: seis caixinhas lado a lado, como na ficha impressa. */
    const atributos = criar('div.atributos-form');
    ATRIBUTOS.forEach(function (par) {
      const entrada = document.createElement('input');
      entrada.type = 'number';
      entrada.min = 1;
      entrada.max = 30;
      entrada.value = r.atributos[par[0]];
      entrada.dataset.atributo = par[0];
      entrada.id = 'atrib-' + par[0];
      entrada.setAttribute('aria-label', par[1]);

      const rotulo = document.createElement('label');
      rotulo.textContent = par[1];
      rotulo.htmlFor = entrada.id;
      atributos.appendChild(criar('div.campo-form', [rotulo, entrada]));
    });
    form.appendChild(criar('div', [criar('div.titulo-grupo', 'Atributos'), atributos]));

    /* O resto do bloco de estatísticas */
    CAMPOS_TEXTO.forEach(function (campo) {
      form.appendChild(self.campoTexto(campo[0], campo[1], r[campo[0]], campo[2], campo[3]));
    });

    /* Traços e ações: listas que crescem */
    form.appendChild(this.listaBlocos('tracos', 'Traços', r.tracos, 'Faro Apurado', 'Vantagem em testes de Percepção que dependam de olfato.'));
    form.appendChild(this.listaBlocos('acoes', 'Ações', r.acoes, 'Mordida', '+4 para acertar, alcance 1,5 m. Dano: 1d6+2 perfurante.'));

    area.appendChild(form);

    area.appendChild(criar('div.acoes-detalhe', [
      criarBotao('botao.pequeno', 'salvar', 'check', 'Salvar'),
      criarBotao('botao.fantasma.pequeno', 'cancelar', null, 'Cancelar')
    ]));
  },


  /* Uma lista de traços (ou de ações). Cada linha guarda de que lista
     e em que posição está, para o "×" saber qual tirar. */
  listaBlocos: function (lista, titulo, blocos, dicaNome, dicaTexto) {
    const grupo = criar('div.lista-blocos-form', [criar('div.titulo-grupo', titulo)]);

    blocos.forEach(function (bloco, indice) {
      const nome = document.createElement('input');
      nome.type = 'text';
      nome.maxLength = 60;
      nome.value = bloco.nome;
      nome.placeholder = dicaNome;
      nome.dataset.lista = lista;
      nome.dataset.parte = 'nome';
      nome.setAttribute('aria-label', 'Nome — ' + titulo + ' ' + (indice + 1));

      const texto = document.createElement('textarea');
      texto.maxLength = 600;
      texto.value = bloco.texto;
      texto.placeholder = dicaTexto;
      texto.dataset.lista = lista;
      texto.dataset.parte = 'texto';
      texto.setAttribute('aria-label', 'Descrição — ' + titulo + ' ' + (indice + 1));

      const tirar = criar('button.tirar', '×');
      tirar.type = 'button';
      tirar.dataset.acao = 'tirar-bloco';
      tirar.dataset.lista = lista;
      tirar.dataset.indice = indice;
      tirar.setAttribute('aria-label', 'Remover ' + (bloco.nome || 'linha ' + (indice + 1)));

      grupo.appendChild(criar('div.bloco-form', [criar('div.bloco-form-campos', [nome, texto]), tirar]));
    });

    if (blocos.length < LIMITE_BLOCOS) {
      const mais = criarBotao('mini-botao', 'mais-bloco', 'mais', titulo === 'Traços' ? 'Adicionar traço' : 'Adicionar ação');
      mais.dataset.lista = lista;
      grupo.appendChild(mais);
    }

    return grupo;
  },


  campoTexto: function (campo, rotulo, valor, limite, dica, lista) {
    const entrada = document.createElement('input');
    entrada.type = 'text';
    entrada.value = valor || '';
    entrada.placeholder = dica || '';
    entrada.maxLength = limite;
    entrada.dataset.campo = campo;
    entrada.id = 'campo-' + campo;
    if (lista) entrada.setAttribute('list', lista);

    const etiqueta = document.createElement('label');
    etiqueta.textContent = rotulo;
    etiqueta.htmlFor = entrada.id;

    return criar('div.campo-form', [etiqueta, entrada]);
  },

  campoNumero: function (campo, rotulo, valor, min, max) {
    const entrada = document.createElement('input');
    entrada.type = 'number';
    entrada.min = min;
    entrada.max = max;
    entrada.value = valor;
    entrada.dataset.campo = campo;
    entrada.id = 'campo-' + campo;

    const etiqueta = document.createElement('label');
    etiqueta.textContent = rotulo;
    etiqueta.htmlFor = entrada.id;

    return criar('div.campo-form', [etiqueta, entrada]);
  },

  campoSelecao: function (campo, rotulo, valor, opcoes) {
    const entrada = document.createElement('select');
    entrada.dataset.campo = campo;
    entrada.id = 'campo-' + campo;

    opcoes.forEach(function (texto) {
      const opcao = document.createElement('option');
      opcao.value = texto;
      opcao.textContent = texto;
      entrada.appendChild(opcao);
    });
    entrada.value = valor;

    const etiqueta = document.createElement('label');
    etiqueta.textContent = rotulo;
    etiqueta.htmlFor = entrada.id;

    return criar('div.campo-form', [etiqueta, entrada]);
  },


  /* Copia o que está na tela para o rascunho. Chamado antes de
     acrescentar ou tirar uma linha de traço/ação — senão o redesenho
     apagaria o que já tinha sido digitado — e antes de salvar. */
  lerFormulario: function () {
    const r = this.rascunho;

    document.querySelectorAll('#detalhe [data-campo]').forEach(function (campo) {
      r[campo.dataset.campo] = campo.value.trim();
    });

    document.querySelectorAll('#detalhe [data-atributo]').forEach(function (campo) {
      r.atributos[campo.dataset.atributo] = campo.value.trim();
    });

    ['tracos', 'acoes'].forEach(function (lista) {
      const nomes = document.querySelectorAll('#detalhe [data-lista="' + lista + '"][data-parte="nome"]');
      const textos = document.querySelectorAll('#detalhe [data-lista="' + lista + '"][data-parte="texto"]');
      r[lista] = Array.prototype.map.call(nomes, function (nome, i) {
        return { nome: nome.value.trim(), texto: textos[i].value.trim() };
      });
    });
  },


  /* Confere e converte. Devolve a ficha pronta para gravar, ou null
     (já com o recado na tela e o foco no campo errado). */
  validar: function () {
    const r = this.rascunho;

    function falha(texto, seletor) {
      Layout.recado(texto, true);
      const campo = seletor && document.querySelector(seletor);
      if (campo) campo.focus();
      return null;
    }

    if (!r.nome) return falha('Dê um nome ao monstro.', '#campo-nome');

    /* O nome é a chave do bestiário: dois "Esqueleto" deixariam o
       combate e a busca sem saber qual ficha abrir. */
    const repetido = todosMonstros().some(function (m) { return m.nome === r.nome && m.id !== r.id; });
    if (repetido) return falha('Já existe um monstro chamado "' + r.nome + '". Escolha outro nome.', '#campo-nome');

    if (TAMANHOS.indexOf(r.tamanho) === -1) return falha('Escolha um tamanho da lista.', '#campo-tamanho');
    if (NDS.indexOf(String(r.nd)) === -1) return falha('Escolha um ND da lista.', '#campo-nd');

    const ca = Number(r.ca);
    if (!Number.isInteger(ca) || ca < 1 || ca > 30) return falha('CA: um número inteiro de 1 a 30.', '#campo-ca');
    const pv = Number(r.pv);
    if (!Number.isInteger(pv) || pv < 1 || pv > 999) return falha('PV: um número inteiro de 1 a 999.', '#campo-pv');

    const atributos = {};
    for (let i = 0; i < ATRIBUTOS.length; i++) {
      const chave = ATRIBUTOS[i][0];
      const valor = Number(r.atributos[chave]);
      if (!Number.isInteger(valor) || valor < 1 || valor > 30) {
        return falha(ATRIBUTOS[i][1] + ': um número inteiro de 1 a 30.', '#atrib-' + chave);
      }
      atributos[chave] = valor;
    }

    /* Linha toda em branco é linha que sobrou: some. Texto sem nome
       não: na ficha ele apareceria como ". Faz tal coisa". */
    const blocos = {};
    for (const lista of ['tracos', 'acoes']) {
      blocos[lista] = r[lista].filter(function (b) { return b.nome || b.texto; });
      const semNome = blocos[lista].findIndex(function (b) { return !b.nome; });
      if (semNome !== -1) {
        return falha((lista === 'tracos' ? 'Traço' : 'Ação') + ' sem nome. Dê um nome ou apague a linha.',
          '#detalhe [data-lista="' + lista + '"][data-parte="nome"]');
      }
    }

    const ficha = {
      id: r.id, nome: r.nome, tamanho: r.tamanho, tipo: r.tipo, alinhamento: r.alinhamento,
      ca: ca, fonteCa: r.fonteCa, pv: pv, dadosVida: r.dadosVida,
      nd: String(r.nd), xp: XP_POR_ND[String(r.nd)],
      atributos: atributos,
      tracos: blocos.tracos, acoes: blocos.acoes
    };
    /* A foto não está no formulário: vem da ficha que está sendo
       editada (ou duplicada) e é preservada. */
    if (retratoSeguro(r.foto)) ficha.foto = r.foto;
    CAMPOS_TEXTO.forEach(function (campo) { ficha[campo[0]] = r[campo[0]] || ''; });

    return ficha;
  },


  /* ---------- Ações ---------- */

  novo: function () {
    this.rascunho = this.moldeVazio();
    this.abrirFormulario();
  },

  /* Copia a ficha inteira — de um monstro do livro ou de um seu — com
     id novo e "(cópia)" no nome, que não pode ficar repetido. */
  duplicar: function () {
    const ficha = acharMonstro(this.selecionado);
    if (!ficha) return;

    const copia = JSON.parse(JSON.stringify(ficha));
    delete copia.meu;
    copia.id = 'mm' + Date.now();
    copia.nome = ficha.nome + ' (cópia)';
    copia.tracos = copia.tracos || [];
    copia.acoes = copia.acoes || [];

    this.rascunho = Object.assign(this.moldeVazio(), copia);
    this.abrirFormulario();
    Layout.recado('Cópia de "' + ficha.nome + '". Mude o nome e o que quiser, e salve.');
  },

  editar: function () {
    const ficha = acharMonstro(this.selecionado);
    if (!ficha || !ficha.meu) return;

    this.rascunho = JSON.parse(JSON.stringify(ficha));
    delete this.rascunho.meu;
    this.abrirFormulario();
  },

  abrirFormulario: function () {
    this.modo = 'edicao';
    this.render();
    const campo = document.getElementById('campo-nome');
    if (campo) { campo.focus(); campo.select(); }
  },

  salvar: function () {
    this.lerFormulario();
    const ficha = this.validar();
    if (!ficha) return;

    const posicao = Estado.monstrosMeus.findIndex(function (m) { return m.id === ficha.id; });
    if (posicao === -1) {
      Estado.monstrosMeus.push(ficha);
      Layout.recado('"' + ficha.nome + '" entrou no bestiário.');
    } else {
      Estado.monstrosMeus[posicao] = ficha;
      Layout.recado('"' + ficha.nome + '" atualizado.');
    }

    this.selecionado = ficha.nome;
    this.modo = 'leitura';
    this.rascunho = null;

    Memoria.salvar();
    this.montarFiltros();       /* um tipo novo vira filtro novo */
    this.render();
  },

  cancelar: function () {
    this.modo = 'leitura';
    this.rascunho = null;
    this.render();
  },

  /* Apaga na hora e oferece desfazer (Layout.recadoDesfazer). Quem já
     estava no combate continua lá: o combatente guarda a própria CA e
     PV, não depende da ficha. */
  apagar: function () {
    const self = this;
    const ficha = acharMonstro(this.selecionado);
    if (!ficha || !ficha.meu) return;

    const posicao = Estado.monstrosMeus.findIndex(function (m) { return m.id === ficha.id; });
    const original = Estado.monstrosMeus[posicao];
    Estado.monstrosMeus = Estado.monstrosMeus.filter(function (m) { return m.id !== ficha.id; });
    this.selecionado = null;

    Memoria.salvar();
    this.montarFiltros();
    this.render();
    Layout.recadoDesfazer('"' + ficha.nome + '" foi apagado.', function () {
      if (!Layout.devolver(Estado.monstrosMeus, original, posicao)) return;
      self.selecionado = original.id;
      Memoria.salvar();
      self.montarFiltros();
      self.render();
      Layout.recado('"' + original.nome + '" está de volta.');
    });
  },

  maisBloco: function (lista) {
    this.lerFormulario();
    if (this.rascunho[lista].length >= LIMITE_BLOCOS) return;
    this.rascunho[lista].push({ nome: '', texto: '' });
    this.render();

    const nomes = document.querySelectorAll('#detalhe [data-lista="' + lista + '"][data-parte="nome"]');
    if (nomes.length) nomes[nomes.length - 1].focus();
  },

  tirarBloco: function (lista, indice) {
    this.lerFormulario();
    this.rascunho[lista].splice(Number(indice), 1);
    this.render();
  },


  /* A foto de um monstro. Do seu: vai na ficha dele. Do livro: vai
     para Estado.fotosMonstros, porque o livro (regras.js) não muda. Se
     o navegador recusar por falta de espaço, desfaz e avisa. */
  mudarFoto: function (nome, dados) {
    const ficha = acharMonstro(nome);
    if (!ficha) return;

    const antes = JSON.stringify({ meus: Estado.monstrosMeus, fotos: Estado.fotosMonstros || {} });

    if (ficha.meu) {
      const meu = Estado.monstrosMeus.find(function (m) { return m.id === ficha.id; });
      if (dados) meu.foto = dados; else delete meu.foto;
    } else {
      Estado.fotosMonstros = Estado.fotosMonstros || {};
      if (dados) Estado.fotosMonstros[nome] = dados; else delete Estado.fotosMonstros[nome];
    }

    if (!Memoria.salvar({ silencioso: true })) {
      const volta = JSON.parse(antes);
      Estado.monstrosMeus = volta.meus;
      Estado.fotosMonstros = volta.fotos;
      Layout.recado('Não coube no armazenamento do navegador. Tente uma imagem menor.', true);
      return;
    }
    this.render();
    Layout.recado(dados ? 'Foto de ' + nome + ' atualizada.' : 'Foto de ' + nome + ' removida.');
  },


  somarAoCombate: function (nome) {
    const ficha = acharMonstro(nome);
    if (!ficha) return;

    const combatente = Mesa.somarAoCombate({
      nome: Mesa.nomeLivre(ficha.nome),
      tipo: 'inimigo',
      ca: ficha.ca,
      pv: ficha.pv,
      /* A iniciativa de um monstro é o modificador de Destreza dele. */
      bonusIniciativa: modificador(ficha.atributos.des),
      nota: [ficha.tipo, 'ND ' + ficha.nd].filter(Boolean).join(' · ')
    });

    this.render();
    Layout.recado(combatente.nome + ' entrou na iniciativa com ' + combatente.iniciativa + '. Abra o combate para ver.');
  },


  /* ---------- Eventos ---------- */

  ligarEventos: function () {
    const self = this;
    const campo = document.getElementById('busca');

    campo.addEventListener('input', function () {
      self.filtro.busca = campo.value;
      self.render();
    });

    campo.addEventListener('keydown', function (evento) {
      if (evento.key === 'Escape' && campo.value) {
        evento.preventDefault();
        self.limpar();
      }
    });

    document.getElementById('limparBusca').addEventListener('click', function () {
      self.limpar();
    });

    document.querySelector('.filtros-compendio').addEventListener('click', function (evento) {
      const alvo = evento.target.closest('[data-acao]');
      if (!alvo) return;

      if (alvo.dataset.acao === 'tipo') self.filtro.tipo = alvo.dataset.valor;
      if (alvo.dataset.acao === 'desafio') self.filtro.desafio = alvo.dataset.valor;

      self.montarFiltros();
      self.render();
    });

    document.getElementById('lista').addEventListener('click', function (evento) {
      const alvo = evento.target.closest('[data-acao="abrir"]');
      if (!alvo) return;
      self.abrir(alvo.dataset.nome);
    });

    /* O botão "Novo monstro" do cabeçalho. */
    document.querySelector('.cabecalho-combate').addEventListener('click', function (evento) {
      if (evento.target.closest('[data-acao="novo"]')) self.novo();
    });

    document.getElementById('detalhe').addEventListener('click', function (evento) {
      const alvo = evento.target.closest('[data-acao]');
      if (!alvo) return;

      switch (alvo.dataset.acao) {
        case 'somar':       self.somarAoCombate(alvo.dataset.nome); break;
        case 'foto':
          Imagens.escolher('retrato', function (resultado) { self.mudarFoto(self.selecionado, resultado.dados); });
          break;
        case 'tirar-foto':  self.mudarFoto(self.selecionado, null); break;
        case 'duplicar':    self.duplicar(); break;
        case 'editar':      self.editar(); break;
        case 'apagar':      self.apagar(); break;
        case 'salvar':      self.salvar(); break;
        case 'cancelar':    self.cancelar(); break;
        case 'mais-bloco':  self.maisBloco(alvo.dataset.lista); break;
        case 'tirar-bloco': self.tirarBloco(alvo.dataset.lista, alvo.dataset.indice); break;
      }
    });
  },


  limpar: function () {
    const campo = document.getElementById('busca');
    campo.value = '';
    this.filtro.busca = '';
    this.render();
    campo.focus();
  },


  /* Abrir outra ficha descarta um formulário pela metade — o mesmo
     comportamento da tela de NPCs. */
  abrir: function (nome) {
    if (!acharMonstro(nome)) return;

    this.selecionado = nome;
    this.modo = 'leitura';
    this.rascunho = null;
    this.render();
  }
};


/* A moldura decide se esta pessoa pode ver a tela; só então montamos. */
Layout.iniciar(function () {
  Bestiario.iniciar();

  /* Outra aba mudou a campanha (ver 'plainus:externo' no layout.js). */
  Layout.redesenhar = function () { if (Bestiario.modo === 'leitura') { Bestiario.montarFiltros(); Bestiario.render(); } };

  /* Pedido da busca (ver Layout.aoPedir). Zera os filtros para o
     monstro aberto também aparecer na lista ao lado. */
  Layout.aoPedir(function (tipo, nome) {
    if (tipo !== 'monstro') return;

    Bestiario.filtro = { busca: '', tipo: 'todos', desafio: 'todos' };
    document.getElementById('busca').value = '';
    Bestiario.montarFiltros();
    Bestiario.abrir(nome);
  });
});
