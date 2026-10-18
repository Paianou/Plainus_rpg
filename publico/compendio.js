/* ===================================================================
   compendio.js — busca, filtros e detalhe

   A tela toda é uma função só, conceitualmente:

       catálogo + (busca, filtros)  ->  lista  ->  detalhe

   Toda mudança (digitar, clicar num filtro, escolher um item) mexe no
   objeto `filtro` e chama render(). Nenhuma função mexe na tela por
   conta própria — é o mesmo princípio das outras telas: muda o estado,
   redesenha.

   Uma escolha que vale explicar: a busca olha também o TEXTO da
   magia, não só o nome. Procurar "paralisado" acha Imobilizar Pessoa;
   procurar "concentração" acha todas que exigem. No meio de um turno,
   é assim que a gente lembra das coisas — pelo efeito, não pelo nome.
   =================================================================== */

const Compendio = {

  /* O que está filtrado agora. */
  filtro: {
    busca: '',
    tipo: 'magias',        /* 'magias' | 'equipamento' | 'condicoes' */
    nivel: 'todos',        /* 'todos' | 0..5 */
    classe: 'todas'
  },

  selecionado: null,       /* o item aberto no detalhe */


  iniciar: function () {
    this.montarFiltros();
    this.render();
    this.ligarEventos();
  },


  /* ---------- Os filtros ---------- */

  montarFiltros: function () {
    const self = this;

    /* Tipo */
    const tipos = [
      { id: 'magias',      texto: 'Magias' },
      { id: 'equipamento', texto: 'Equipamento' },
      { id: 'condicoes',   texto: 'Condições' }
    ];
    const areaTipo = document.getElementById('filtroTipo');
    areaTipo.textContent = '';
    areaTipo.appendChild(criar('span.rotulo-filtro', 'Mostrar'));
    tipos.forEach(function (tipo) {
      const botao = criar('button.filtro' + (self.filtro.tipo === tipo.id ? '.ativo' : ''), tipo.texto);
      botao.type = 'button';
      botao.dataset.acao = 'tipo';
      botao.dataset.valor = tipo.id;
      areaTipo.appendChild(botao);
    });

    /* Nível e classe só fazem sentido para magias. */
    const areaNivel = document.getElementById('filtroNivel');
    const areaClasse = document.getElementById('filtroClasse');
    areaNivel.textContent = '';
    areaClasse.textContent = '';

    if (this.filtro.tipo !== 'magias') return;

    areaNivel.appendChild(criar('span.rotulo-filtro', 'Nível'));
    ['todos', 0, 1, 2, 3, 4, 5].forEach(function (nivel) {
      const rotulo = nivel === 'todos' ? 'Todos' : (nivel === 0 ? 'Truque' : nivel + 'º');
      const botao = criar('button.filtro' + (String(self.filtro.nivel) === String(nivel) ? '.ativo' : ''), rotulo);
      botao.type = 'button';
      botao.dataset.acao = 'nivel';
      botao.dataset.valor = nivel;
      areaNivel.appendChild(botao);
    });

    /* Só as classes que realmente aparecem no catálogo. */
    const classes = [];
    MAGIAS.forEach(function (magia) {
      magia.classes.forEach(function (classe) {
        if (classes.indexOf(classe) === -1) classes.push(classe);
      });
    });
    classes.sort();

    areaClasse.appendChild(criar('span.rotulo-filtro', 'Classe'));
    ['todas'].concat(classes).forEach(function (classe) {
      const botao = criar('button.filtro' + (self.filtro.classe === classe ? '.ativo' : ''),
        classe === 'todas' ? 'Todas' : classe);
      botao.type = 'button';
      botao.dataset.acao = 'classe';
      botao.dataset.valor = classe;
      areaClasse.appendChild(botao);
    });
  },


  /* ---------- A filtragem ----------
     Devolve a lista já normalizada: todo item vira um objeto com os
     mesmos campos básicos (nome, linha de meta, e o original), para a
     lista não precisar saber se está olhando magia ou armadura. */

  filtrar: function () {
    const f = this.filtro;
    const busca = semAcento(f.busca.trim());

    if (f.tipo === 'magias') {
      return MAGIAS.filter(function (magia) {
        if (f.nivel !== 'todos' && magia.nivel !== Number(f.nivel)) return false;
        if (f.classe !== 'todas' && magia.classes.indexOf(f.classe) === -1) return false;
        if (!busca) return true;

        /* Procura no nome, na escola e no texto — ver o comentário do
           topo do arquivo sobre por que o texto entra. */
        const alvo = semAcento(
          magia.nome + ' ' + magia.escola + ' ' + magia.texto + ' ' +
          magia.classes.join(' ') + ' ' + (magia.duracao || '')
        );
        return alvo.indexOf(busca) !== -1;
      });
    }

    if (f.tipo === 'equipamento') {
      return EQUIPAMENTO.filter(function (item) {
        if (!busca) return true;
        const alvo = semAcento(item.nome + ' ' + item.categoria + ' ' + (item.propriedades || ''));
        return alvo.indexOf(busca) !== -1;
      });
    }

    /* Condições: o objeto CONDICOES vira lista. */
    return Object.keys(CONDICOES).filter(function (nome) {
      if (!busca) return true;
      return semAcento(nome + ' ' + CONDICOES[nome]).indexOf(busca) !== -1;
    }).map(function (nome) {
      return { nome: nome, texto: CONDICOES[nome] };
    });
  },


  /* ---------- Desenho ---------- */

  render: function () {
    const itens = this.filtrar();
    /* Nada aberto? Abre o primeiro da lista (já com a busca e os
       filtros): o painel do lado mostra uma ficha em vez de um
       "Escolha…" sozinho no meio do vazio. Os quatro painéis de lista
       e ficha (compêndio, bestiário, diário, NPCs) fazem igual. */
    if (!this.selecionado && itens.length) this.selecionado = itens[0];

    this.renderLista(itens);
    this.renderDetalhe();

    document.getElementById('contagem').textContent =
      itens.length + (itens.length === 1 ? ' resultado' : ' resultados');

    document.getElementById('seloTotal').textContent =
      MAGIAS.length + ' magias · ' + EQUIPAMENTO.length + ' itens · ' + Object.keys(CONDICOES).length + ' condições';

    const limpar = document.getElementById('limparBusca');
    limpar.hidden = this.filtro.busca === '';
  },


  renderLista: function (itens) {
    const self = this;
    const area = document.getElementById('lista');
    area.textContent = '';

    if (itens.length === 0) {
      const vazio = criar('div.vazio');
      vazio.appendChild(Icone.svg('busca', 26));
      vazio.appendChild(criar('div', 'Nada encontrado para "' + this.filtro.busca + '".'));
      vazio.appendChild(criar('div', 'Tente outra palavra, ou afrouxe os filtros de nível e classe.'));
      area.appendChild(vazio);
      return;
    }

    itens.forEach(function (item) {
      area.appendChild(self.montarItem(item));
    });
  },


  montarItem: function (item) {
    const tipo = this.filtro.tipo;
    const ativo = this.selecionado && this.selecionado.nome === item.nome;

    const botao = criar('button.item-compendio' + (ativo ? '.ativo' : ''));
    botao.type = 'button';
    botao.dataset.acao = 'abrir';
    botao.dataset.nome = item.nome;

    /* 1. o selo da esquerda */
    let selo;
    if (tipo === 'magias') {
      /* "1º" e não "1": em Marcellus o algarismo 1 é quase idêntico a
         um I maiúsculo, e um selo de um caractere só fica ambíguo. */
      selo = criar('span.selo-nivel', item.nivel === 0 ? 'T' : item.nivel + 'º');
    } else if (tipo === 'equipamento') {
      selo = criar('span.selo-nivel');
      selo.appendChild(Icone.svg(item.categoria === 'Arma' ? 'combate' : 'armadura', 15));
    } else {
      selo = criar('span.selo-nivel');
      selo.appendChild(Icone.svg('condicoes', 15));
    }
    botao.appendChild(selo);

    /* 2. nome + linha de meta */
    let meta;
    if (tipo === 'magias') {
      meta = item.escola + ' · ' + item.classes.slice(0, 3).join(', ')
           + (item.classes.length > 3 ? '…' : '');
    } else if (tipo === 'equipamento') {
      meta = item.categoria + ' · ' + (item.dano ? item.dano + ' ' + item.tipoDano : 'CA ' + item.ca)
           + ' · ' + item.valor;
    } else {
      meta = 'Condição';
    }

    botao.appendChild(criar('div', [
      criar('div.nome-item', item.nome),
      criar('div.linha-meta', meta)
    ]));

    /* 3. marcas da direita */
    const marcas = criar('div.marcas-item');
    if (tipo === 'magias') {
      if (item.concentracao) marcas.appendChild(criar('span.pilula', 'Conc.'));
      if (item.ritual) marcas.appendChild(criar('span.pilula.azul', 'Ritual'));
    }
    if (this.estaFixada(item.nome)) {
      const alfinete = Icone.svg('surto', 14);
      alfinete.style.color = 'var(--azul)';
      marcas.appendChild(alfinete);
    }
    botao.appendChild(marcas);

    return botao;
  },


  renderDetalhe: function () {
    const area = document.getElementById('detalhe');
    area.textContent = '';

    if (!this.selecionado) {
      const vazio = criar('div.vazio');
      vazio.style.border = '0';
      vazio.appendChild(Icone.svg('compendio', 28));
      vazio.appendChild(criar('div', 'Nada nesta lista para ler aqui.'));
      area.appendChild(vazio);
      return;
    }

    const item = this.selecionado;

    if (this.filtro.tipo === 'magias') this.detalheMagia(area, item);
    else if (this.filtro.tipo === 'equipamento') this.detalheEquipamento(area, item);
    else this.detalheCondicao(area, item);
  },


  detalheMagia: function (area, magia) {
    area.appendChild(criar('h2.titulo-detalhe', magia.nome));

    const subtitulo = magia.nivel === 0
      ? 'Truque de ' + magia.escola.toLowerCase()
      : magia.nivel + 'º nível · ' + magia.escola
        + (magia.ritual ? ' (ritual)' : '');
    area.appendChild(criar('div.subtitulo-detalhe', subtitulo));

    area.appendChild(criar('div.meta-grade', [
      this.metaCampo('Tempo de conjuração', magia.tempo),
      this.metaCampo('Alcance', magia.alcance),
      this.metaCampo('Componentes', magia.componentes),
      this.metaCampo('Duração', magia.duracao)
    ]));

    area.appendChild(criar('div.corpo-detalhe', criar('p', magia.texto)));

    if (magia.superior) {
      const bloco = criar('div.bloco-superior');
      bloco.appendChild(criar('strong', 'Em espaços superiores: '));
      bloco.appendChild(document.createTextNode(magia.superior));
      area.appendChild(bloco);
    }

    /* Aviso que vale ouro na mesa: concentração é uma por vez. */
    if (magia.concentracao) {
      const aviso = criar('div.bloco-superior');
      aviso.style.borderLeftColor = 'var(--perigo)';
      aviso.appendChild(criar('strong', 'Concentração: '));
      aviso.appendChild(document.createTextNode(
        'só uma magia de concentração por vez. Ao sofrer dano, é preciso passar numa salvaguarda de Constituição com CD 10 ou metade do dano, o que for maior.'
      ));
      area.appendChild(aviso);
    }

    area.appendChild(criar('div.classes-magia', criar('div.linha-meta', 'Conjuram: ' + magia.classes.join(', '))));

    this.acoesDetalhe(area, magia.nome);
  },


  detalheEquipamento: function (area, item) {
    area.appendChild(criar('h2.titulo-detalhe', item.nome));
    area.appendChild(criar('div.subtitulo-detalhe', item.categoria));

    const linhas = criar('div.tabela-propriedades');

    if (item.dano) linhas.appendChild(this.linhaTabela('Dano', item.dano + ' ' + item.tipoDano));
    if (item.ca) linhas.appendChild(this.linhaTabela('Classe de armadura', item.ca));
    linhas.appendChild(this.linhaTabela('Peso', item.peso + ' kg'));
    linhas.appendChild(this.linhaTabela('Valor', item.valor));
    linhas.appendChild(this.linhaTabela('Propriedades', item.propriedades));

    area.appendChild(linhas);
    this.acoesDetalhe(area, item.nome);
  },


  detalheCondicao: function (area, condicao) {
    area.appendChild(criar('h2.titulo-detalhe', condicao.nome));
    area.appendChild(criar('div.subtitulo-detalhe', 'Condição'));

    /* O texto das condições é NOSSO (está no dados.js) e algumas usam
       <strong>. Nunca vem de digitação de jogador. */
    const corpo = criar('div.corpo-detalhe');
    const paragrafo = document.createElement('p');
    paragrafo.innerHTML = condicao.texto;
    corpo.appendChild(paragrafo);
    area.appendChild(corpo);

    this.acoesDetalhe(area, condicao.nome);
  },


  metaCampo: function (rotulo, valor) {
    return criar('div', [
      criar('div.rotulo', rotulo),
      criar('div.valor', valor)
    ]);
  },


  linhaTabela: function (chave, valor) {
    return criar('div.linha', [
      criar('span.chave', chave),
      criar('span.valor', valor)
    ]);
  },


  acoesDetalhe: function (area, nome) {
    const fixada = this.estaFixada(nome);

    const fixar = criarBotao('botao.fantasma.pequeno', 'fixar', 'surto',
      fixada ? 'Desafixar' : 'Fixar no painel');
    fixar.dataset.nome = nome;

    area.appendChild(criar('div.acoes-detalhe', [fixar]));
  },


  /* ---------- Fixar ----------
     O que o mestre fixa aqui é coisa da MESA dele, não do livro —
     por isso vive no Estado (dados.js) e é salvo, enquanto o catálogo
     (regras.js) fica intocado. */

  estaFixada: function (nome) {
    return (Estado.fixadas || []).indexOf(nome) !== -1;
  },


  alternarFixada: function (nome) {
    const r = Acoes.executar('alternarFixada', { nome: nome });
    if (r.erro) { Layout.recado(r.erro, true); return; }
    Layout.recado(r.fixada
      ? '"' + nome + '" fixada. Ela vai aparecer no acesso rápido do painel.'
      : '"' + nome + '" desafixada.');
    this.render();
  },


  /* ---------- Eventos ---------- */

  ligarEventos: function () {
    const self = this;
    const campo = document.getElementById('busca');

    /* 'input' e não 'keyup': pega também colar com o mouse. */
    campo.addEventListener('input', function () {
      self.filtro.busca = campo.value;
      /* Buscar é procurar outra coisa: o painel abre o primeiro
         resultado, em vez de ficar no que estava aberto. */
      self.selecionado = null;
      self.render();
    });

    /* Esc limpa a busca — é o reflexo de quem usa busca o dia todo. */
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

      const valor = alvo.dataset.valor;

      if (alvo.dataset.acao === 'tipo') {
        self.filtro.tipo = valor;
        self.selecionado = null;      /* o detalhe antigo não vale mais */
        self.montarFiltros();
      } else if (alvo.dataset.acao === 'nivel') {
        self.filtro.nivel = valor;
        self.montarFiltros();
      } else if (alvo.dataset.acao === 'classe') {
        self.filtro.classe = valor;
        self.montarFiltros();
      }

      self.render();
    });

    document.getElementById('lista').addEventListener('click', function (evento) {
      const alvo = evento.target.closest('[data-acao="abrir"]');
      if (!alvo) return;
      self.abrir(alvo.dataset.nome);
    });

    document.getElementById('detalhe').addEventListener('click', function (evento) {
      const alvo = evento.target.closest('[data-acao="fixar"]');
      if (!alvo) return;
      self.alternarFixada(alvo.dataset.nome);
    });
  },


  limpar: function () {
    const campo = document.getElementById('busca');
    campo.value = '';
    this.filtro.busca = '';
    this.render();
    campo.focus();
  },


  abrir: function (nome) {
    const achado = this.filtrar().find(function (item) { return item.nome === nome; });
    if (!achado) return;

    this.selecionado = achado;
    this.render();
  }
};


/* A moldura decide se esta pessoa pode ver a tela; só então montamos. */
Layout.iniciar(function () {
  Compendio.iniciar();

  /* Outra aba mudou a campanha (ver 'plainus:externo' no layout.js). */
  Layout.redesenhar = function () { Compendio.render(); };

  /* Pedido da busca (ver Layout.aoPedir): mostra o tipo certo, sem
     filtro nenhum — abrir() procura dentro do que está filtrado, então
     um filtro de nível esconderia a magia pedida. */
  Layout.aoPedir(function (tipo, nome) {
    if (['magias', 'equipamento', 'condicoes'].indexOf(tipo) === -1) return;

    Compendio.filtro = { busca: '', tipo: tipo, nivel: 'todos', classe: 'todas' };
    document.getElementById('busca').value = '';
    Compendio.montarFiltros();
    Compendio.render();
    Compendio.abrir(nome);
  });
});
