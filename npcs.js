/* ===================================================================
   npcs.js — o elenco da campanha

   Mesma armação das telas de consulta (lista + detalhe), com uma
   diferença grande: aqui se escreve. Por isso o painel da direita tem
   dois modos —

     leitura  mostra a ficha do NPC
     edicao   mostra o formulário (criar ou alterar)

   A variável `modo` guarda em qual deles estamos. Salvar volta para
   leitura; cancelar também. Não existe "salvar automático" enquanto se
   digita: um campo de segredo meio escrito não deve virar verdade.

   Sobre apagar: exige confirmar, porque não há desfazer. É a única
   ação da tela que destrói alguma coisa.
   =================================================================== */

const Elenco = {

  lista: 'npcs',          /* 'npcs' | 'faccoes' */
  modo: 'leitura',        /* 'leitura' | 'edicao' */
  selecionado: null,      /* id do NPC ou da facção aberta */
  rascunho: null,         /* o NPC sendo editado (cópia, não o original) */

  filtro: { busca: '', atitude: 'todos', faccao: 'todas' },


  iniciar: function () {
    this.montarFiltros();
    this.render();
    this.ligarEventos();
  },


  /* ---------- Acesso aos dados ---------- */

  npcs: function () { return Estado.npcs || []; },
  faccoes: function () { return Estado.faccoes || []; },

  acharNpc: function (id) {
    return this.npcs().find(function (n) { return n.id === id; });
  },

  acharFaccao: function (id) {
    return this.faccoes().find(function (f) { return f.id === id; });
  },

  nomeFaccao: function (id) {
    const faccao = this.acharFaccao(id);
    return faccao ? faccao.nome : 'Sem facção';
  },


  /* ---------- Filtros ---------- */

  montarFiltros: function () {
    const self = this;

    /* Qual lista estamos vendo */
    const areaLista = document.getElementById('filtroLista');
    areaLista.textContent = '';
    areaLista.appendChild(criar('span.rotulo-filtro', 'Mostrar'));

    [['npcs', 'Personagens'], ['faccoes', 'Facções']].forEach(function (par) {
      const botao = criar('button.filtro' + (self.lista === par[0] ? '.ativo' : ''), par[1]);
      botao.type = 'button';
      botao.dataset.acao = 'lista';
      botao.dataset.valor = par[0];
      areaLista.appendChild(botao);
    });

    const areaAtitude = document.getElementById('filtroAtitude');
    const areaFaccao = document.getElementById('filtroFaccao');
    areaAtitude.textContent = '';
    areaFaccao.textContent = '';

    /* Atitude e facção só filtram personagens. */
    if (this.lista !== 'npcs') return;

    areaAtitude.appendChild(criar('span.rotulo-filtro', 'Atitude'));
    [['todos', 'Todas'], ['aliado', 'Aliados'], ['neutro', 'Neutros'], ['hostil', 'Hostis'], ['morto', 'Mortos']]
      .forEach(function (par) {
        const botao = criar('button.filtro' + (self.filtro.atitude === par[0] ? '.ativo' : ''), par[1]);
        botao.type = 'button';
        botao.dataset.acao = 'atitude';
        botao.dataset.valor = par[0];
        areaAtitude.appendChild(botao);
      });

    areaFaccao.appendChild(criar('span.rotulo-filtro', 'Facção'));
    const opcoes = [{ id: 'todas', nome: 'Todas' }].concat(this.faccoes());
    opcoes.forEach(function (faccao) {
      const botao = criar('button.filtro' + (self.filtro.faccao === faccao.id ? '.ativo' : ''), faccao.nome);
      botao.type = 'button';
      botao.dataset.acao = 'faccao';
      botao.dataset.valor = faccao.id;
      areaFaccao.appendChild(botao);
    });
  },


  filtrar: function () {
    const f = this.filtro;
    const busca = semAcentoSimples(f.busca.trim());

    if (this.lista === 'faccoes') {
      return this.faccoes().filter(function (faccao) {
        if (!busca) return true;
        const alvo = faccao.nome + ' ' + faccao.tipo + ' ' + faccao.objetivo + ' ' + faccao.sede;
        return semAcentoSimples(alvo).indexOf(busca) !== -1;
      });
    }

    return this.npcs().filter(function (npc) {
      if (f.atitude === 'morto') {
        if (npc.status !== 'morto') return false;
      } else if (f.atitude !== 'todos') {
        if (npc.atitude !== f.atitude || npc.status === 'morto') return false;
      }

      if (f.faccao !== 'todas' && npc.faccao !== f.faccao) return false;
      if (!busca) return true;

      const alvo = npc.nome + ' ' + npc.papel + ' ' + npc.raca + ' ' + npc.local + ' '
        + (npc.objetivo || '') + ' ' + (npc.aparencia || '') + ' ' + (npc.notas || '');
      return semAcentoSimples(alvo).indexOf(busca) !== -1;
    });
  },


  /* ---------- Desenho ---------- */

  render: function () {
    const itens = this.filtrar();

    this.renderLista(itens);
    this.renderDetalhe();

    document.getElementById('tituloLista').textContent =
      this.lista === 'npcs' ? 'Elenco' : 'Facções';

    document.getElementById('contagem').textContent =
      itens.length + (this.lista === 'npcs'
        ? (itens.length === 1 ? ' personagem' : ' personagens')
        : (itens.length === 1 ? ' facção' : ' facções'));

    const vivos = this.npcs().filter(function (n) { return n.status !== 'morto'; }).length;
    document.getElementById('seloTotal').textContent =
      vivos + ' em cena · ' + this.faccoes().length + ' facções';

    document.getElementById('limparBusca').hidden = this.filtro.busca === '';
  },


  renderLista: function (itens) {
    const self = this;
    const area = document.getElementById('lista');
    area.textContent = '';

    if (itens.length === 0) {
      const vazio = criar('div.vazio');
      vazio.appendChild(Icone.svg('npcs', 26));
      vazio.appendChild(criar('div', this.filtro.busca
        ? 'Ninguém encontrado para "' + this.filtro.busca + '".'
        : 'Nada aqui ainda.'));
      area.appendChild(vazio);
      return;
    }

    itens.forEach(function (item) {
      area.appendChild(self.lista === 'npcs' ? self.montarItemNpc(item) : self.montarItemFaccao(item));
    });
  },


  montarItemNpc: function (npc) {
    const morto = npc.status === 'morto';
    const ativo = this.selecionado === npc.id;

    const botao = criar('button.item-compendio' + (ativo ? '.ativo' : '') + (morto ? '.inativo' : ''));
    botao.type = 'button';
    botao.dataset.acao = 'abrir';
    botao.dataset.id = npc.id;

    botao.appendChild(criar('span.inicial-npc', npc.nome.charAt(0)));

    botao.appendChild(criar('div', [
      criar('div.nome-item', npc.nome),
      criar('div.linha-meta', npc.papel + ' · ' + this.nomeFaccao(npc.faccao))
    ]));

    const marcas = criar('div.marcas-item');
    if (morto) {
      marcas.appendChild(criar('span.pilula.morto', 'Morto'));
    } else {
      const rotulos = { aliado: 'Aliado', neutro: 'Neutro', hostil: 'Hostil' };
      marcas.appendChild(criar('span.pilula.' + npc.atitude, rotulos[npc.atitude] || npc.atitude));
    }
    if (!npc.conhecido) marcas.appendChild(criar('span.pilula', 'Oculto'));
    botao.appendChild(marcas);

    return botao;
  },


  montarItemFaccao: function (faccao) {
    const ativo = this.selecionado === faccao.id;
    const membros = this.npcs().filter(function (n) { return n.faccao === faccao.id; }).length;

    const botao = criar('button.item-compendio' + (ativo ? '.ativo' : ''));
    botao.type = 'button';
    botao.dataset.acao = 'abrir';
    botao.dataset.id = faccao.id;

    const selo = criar('span.selo-nivel');
    selo.appendChild(Icone.svg('faccao', 15));
    botao.appendChild(selo);

    botao.appendChild(criar('div', [
      criar('div.nome-item', faccao.nome),
      criar('div.linha-meta', faccao.tipo + ' · ' + membros + (membros === 1 ? ' membro' : ' membros'))
    ]));

    const cores = { aliada: 'aliado', inimiga: 'hostil', neutra: '' };
    const marcas = criar('div.marcas-item', [
      criar('span.pilula' + (cores[faccao.relacao] ? '.' + cores[faccao.relacao] : ''), faccao.relacao)
    ]);
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

    if (!this.selecionado) {
      const vazio = criar('div.vazio');
      vazio.style.border = '0';
      vazio.appendChild(Icone.svg('npcs', 28));
      vazio.appendChild(criar('div', this.lista === 'npcs'
        ? 'Escolha alguém para ver a ficha.'
        : 'Escolha uma facção.'));
      area.appendChild(vazio);
      return;
    }

    if (this.lista === 'faccoes') this.montarFichaFaccao(area);
    else this.montarFichaNpc(area);
  },


  montarFichaNpc: function (area) {
    const npc = this.acharNpc(this.selecionado);
    if (!npc) return;

    const morto = npc.status === 'morto';

    area.appendChild(criar('h2.titulo-detalhe', npc.nome));
    area.appendChild(criar('div.subtitulo-detalhe',
      npc.papel + ' · ' + npc.raca));

    /* Etiquetas de estado */
    const etiquetas = criar('div.cena-etiquetas');
    etiquetas.style.marginBottom = '16px';

    if (morto) {
      etiquetas.appendChild(criar('span.pilula.morto', 'Morto'));
    } else {
      const rotulos = { aliado: 'Aliado', neutro: 'Neutro', hostil: 'Hostil' };
      etiquetas.appendChild(criar('span.pilula.' + npc.atitude, rotulos[npc.atitude]));
    }
    etiquetas.appendChild(criar('span.pilula', this.nomeFaccao(npc.faccao)));
    if (!npc.conhecido) etiquetas.appendChild(criar('span.pilula', 'A party ainda não conhece'));
    area.appendChild(etiquetas);

    /* Onde encontrar */
    area.appendChild(criar('div.linhas-monstro', [
      criar('div.linha-monstro', [
        criar('span.chave', 'Onde:'),
        criar('span', npc.local || '—')
      ])
    ]));

    if (npc.aparencia) area.appendChild(this.blocoTexto('Aparência e jeito', npc.aparencia));
    if (npc.objetivo) area.appendChild(this.blocoTexto('O que quer', npc.objetivo));

    /* O segredo */
    if (npc.segredo) {
      const bloco = criar('div.bloco-segredo');
      const cabeca = criar('div.cabeca');
      cabeca.appendChild(Icone.svg('secreto', 13));
      cabeca.appendChild(criar('span', 'Só você vê'));
      bloco.appendChild(cabeca);
      bloco.appendChild(criar('div.texto', npc.segredo));
      area.appendChild(bloco);
    }

    if (npc.notas) area.appendChild(this.blocoTexto('Anotações', npc.notas));

    /* Ações */
    const editar = criarBotao('botao.pequeno', 'editar', 'editar', 'Editar');
    const matar = criarBotao('botao.fantasma.pequeno', 'alternar-status', null,
      morto ? 'Marcar como vivo' : 'Marcar como morto');
    const apagar = criarBotao('botao.perigo.pequeno', 'apagar', null, 'Apagar');

    area.appendChild(criar('div.acoes-detalhe', [editar, matar, apagar]));
  },


  montarFichaFaccao: function (area) {
    const self = this;
    const faccao = this.acharFaccao(this.selecionado);
    if (!faccao) return;

    area.appendChild(criar('h2.titulo-detalhe', faccao.nome));
    area.appendChild(criar('div.subtitulo-detalhe', faccao.tipo + ' · ' + faccao.sede));

    const cores = { aliada: 'aliado', inimiga: 'hostil', neutra: '' };
    const etiquetas = criar('div.cena-etiquetas', [
      criar('span.pilula' + (cores[faccao.relacao] ? '.' + cores[faccao.relacao] : ''), faccao.relacao)
    ]);
    etiquetas.style.marginBottom = '16px';
    area.appendChild(etiquetas);

    area.appendChild(this.blocoTexto('Objetivo', faccao.objetivo));
    area.appendChild(this.blocoTexto('Influência', faccao.influencia));

    /* Membros conhecidos — clicáveis, levam à ficha. */
    const membros = this.npcs().filter(function (n) { return n.faccao === faccao.id; });

    const grupo = criar('div.grupo-acoes', [criar('div.titulo-grupo', 'Membros')]);

    if (membros.length === 0) {
      grupo.appendChild(criar('div.bloco-acao', 'Ninguém do elenco está ligado a esta facção.'));
    } else {
      const lista = criar('div.membros-faccao');
      membros.forEach(function (npc) {
        const item = criar('button.membro');
        item.type = 'button';
        item.dataset.acao = 'ir-npc';
        item.dataset.id = npc.id;
        item.appendChild(criar('span.inicial-npc', npc.nome.charAt(0)));
        item.appendChild(criar('span', npc.nome));
        item.appendChild(criar('span.papel', npc.status === 'morto' ? 'morto' : npc.papel));
        lista.appendChild(item);
      });
      grupo.appendChild(lista);
    }

    area.appendChild(grupo);
  },


  blocoTexto: function (rotulo, texto) {
    return criar('div.bloco-npc', [
      criar('div.rotulo', rotulo),
      criar('div.texto', texto)
    ]);
  },


  /* ---------- O formulário ---------- */

  montarFormulario: function (area) {
    const self = this;
    const npc = this.rascunho;
    const novo = !this.acharNpc(npc.id);

    area.appendChild(criar('h2.titulo-detalhe', novo ? 'Novo personagem' : 'Editando'));
    area.appendChild(criar('div.subtitulo-detalhe',
      novo ? 'Só o nome é obrigatório — o resto pode vir depois.' : npc.nome));

    const form = criar('div.formulario');

    form.appendChild(this.campoTexto('nome', 'Nome', npc.nome, 'Como a mesa vai chamá-lo'));
    form.appendChild(criar('div.dupla-form', [
      this.campoTexto('papel', 'Papel', npc.papel, 'Ferreiro, capitã, taverneiro…'),
      this.campoTexto('raca', 'Povo', npc.raca, 'Anão, humano, meio-elfo…')
    ]));
    form.appendChild(this.campoTexto('local', 'Onde encontrar', npc.local, 'Taverna, quartel, cripta…'));

    form.appendChild(criar('div.dupla-form', [
      this.campoSelecao('atitude', 'Atitude', npc.atitude, [
        ['aliado', 'Aliado'], ['neutro', 'Neutro'], ['hostil', 'Hostil']
      ]),
      this.campoSelecao('status', 'Estado', npc.status, [
        ['vivo', 'Vivo'], ['morto', 'Morto'], ['sumido', 'Desaparecido']
      ])
    ]));

    const opcoesFaccao = [['', 'Sem facção']].concat(this.faccoes().map(function (f) {
      return [f.id, f.nome];
    }));
    form.appendChild(this.campoSelecao('faccao', 'Facção', npc.faccao || '', opcoesFaccao));

    form.appendChild(this.campoArea('aparencia', 'Aparência e jeito', npc.aparencia,
      'Uma imagem e um trejeito bastam.'));
    form.appendChild(this.campoArea('objetivo', 'O que quer', npc.objetivo,
      'O que ele persegue, mesmo que a party nunca descubra.'));

    /* O segredo, com a borda vermelha e o aviso. */
    const segredo = this.campoArea('segredo', 'Segredo', npc.segredo,
      'O que ninguém na mesa pode saber ainda.');
    segredo.classList.add('segredo');
    segredo.appendChild(criar('div.ajuda',
      'Hoje isto fica só no seu navegador. Quando houver servidor, este campo não será enviado para os jogadores — é a regra que impede vazamento.'));
    form.appendChild(segredo);

    form.appendChild(this.campoArea('notas', 'Anotações', npc.notas,
      'Ganchos, dívidas, o que ele faria se pressionado.'));

    area.appendChild(form);

    area.appendChild(criar('div.acoes-detalhe', [
      criarBotao('botao.pequeno', 'salvar', 'check', 'Salvar'),
      criarBotao('botao.fantasma.pequeno', 'cancelar', null, 'Cancelar')
    ]));
  },


  campoTexto: function (campo, rotulo, valor, dica) {
    const entrada = document.createElement('input');
    entrada.type = 'text';
    entrada.value = valor || '';
    entrada.placeholder = dica || '';
    entrada.dataset.campo = campo;
    entrada.maxLength = 80;
    entrada.id = 'campo-' + campo;

    const etiqueta = document.createElement('label');
    etiqueta.textContent = rotulo;
    etiqueta.htmlFor = entrada.id;

    return criar('div.campo-form', [etiqueta, entrada]);
  },


  campoArea: function (campo, rotulo, valor, dica) {
    const entrada = document.createElement('textarea');
    entrada.value = valor || '';
    entrada.placeholder = dica || '';
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

    opcoes.forEach(function (par) {
      const opcao = document.createElement('option');
      opcao.value = par[0];
      opcao.textContent = par[1];
      if (String(par[0]) === String(valor)) opcao.selected = true;
      entrada.appendChild(opcao);
    });

    const etiqueta = document.createElement('label');
    etiqueta.textContent = rotulo;
    etiqueta.htmlFor = entrada.id;

    return criar('div.campo-form', [etiqueta, entrada]);
  },


  /* ---------- Ações ---------- */

  novo: function () {
    this.lista = 'npcs';
    this.modo = 'edicao';
    this.rascunho = {
      id: 'n' + Date.now(),
      nome: '', papel: '', raca: '', local: '',
      faccao: '', atitude: 'neutro', status: 'vivo', conhecido: true,
      aparencia: '', objetivo: '', segredo: '', notas: ''
    };
    this.montarFiltros();
    this.render();
    const campo = document.getElementById('campo-nome');
    if (campo) campo.focus();
  },


  editar: function () {
    const npc = this.acharNpc(this.selecionado);
    if (!npc) return;

    /* Cópia, não o original: cancelar precisa poder descartar. */
    this.rascunho = JSON.parse(JSON.stringify(npc));
    this.modo = 'edicao';
    this.render();
  },


  salvar: function () {
    const self = this;

    /* Lê o formulário de uma vez. */
    document.querySelectorAll('#detalhe [data-campo]').forEach(function (campo) {
      self.rascunho[campo.dataset.campo] = campo.value.trim();
    });

    if (!this.rascunho.nome) {
      Layout.recado('Dê um nome ao personagem antes de salvar.', true);
      const campo = document.getElementById('campo-nome');
      if (campo) campo.focus();
      return;
    }

    const existente = this.acharNpc(this.rascunho.id);
    if (existente) {
      Object.keys(this.rascunho).forEach(function (chave) {
        existente[chave] = self.rascunho[chave];
      });
      Layout.recado('"' + existente.nome + '" atualizado.');
    } else {
      Estado.npcs.push(this.rascunho);
      Layout.recado('"' + this.rascunho.nome + '" entrou no elenco.');
    }

    this.selecionado = this.rascunho.id;
    this.modo = 'leitura';
    this.rascunho = null;

    Memoria.salvar();
    this.render();
  },


  cancelar: function () {
    this.modo = 'leitura';
    this.rascunho = null;
    this.render();
  },


  alternarStatus: function () {
    const npc = this.acharNpc(this.selecionado);
    if (!npc) return;

    npc.status = npc.status === 'morto' ? 'vivo' : 'morto';
    Memoria.salvar();
    this.render();

    Layout.recado(npc.status === 'morto'
      ? npc.nome + ' foi marcado como morto.'
      : npc.nome + ' voltou para o elenco dos vivos.');
  },


  /* Apaga na hora e oferece desfazer (Layout.recadoDesfazer). */
  apagar: function () {
    const self = this;
    const npc = this.acharNpc(this.selecionado);
    if (!npc) return;

    const posicao = this.npcs().indexOf(npc);
    Estado.npcs = this.npcs().filter(function (n) { return n.id !== npc.id; });
    this.selecionado = null;

    Memoria.salvar();
    this.render();
    Layout.recadoDesfazer('"' + npc.nome + '" foi apagado.', function () {
      if (!Layout.devolver(Estado.npcs, npc, posicao)) return;
      self.selecionado = npc.id;
      Memoria.salvar();
      self.render();
      Layout.recado('"' + npc.nome + '" está de volta.');
    });
  },


  /* Usa o mesmo gerador da visão geral e já abre para edição — o
     sorteio dá o ponto de partida, você ajusta e salva. */
  sortear: function () {
    this.lista = 'npcs';
    this.modo = 'edicao';
    this.rascunho = {
      id: 'n' + Date.now(),
      nome: Layout.sortear(GERADOR.nomes) + ', ' + Layout.sortear(GERADOR.epitetos),
      papel: '', raca: Layout.sortear(GERADOR.racas), local: '',
      faccao: '', atitude: 'neutro', status: 'vivo', conhecido: true,
      aparencia: Layout.sortear(GERADOR.tracos),
      objetivo: '',
      segredo: Layout.sortear(GERADOR.segredos),
      notas: ''
    };

    this.montarFiltros();
    this.render();
    Layout.recado('Sorteado. Ajuste o que quiser e salve.');
  },


  abrir: function (id) {
    this.selecionado = id;
    this.modo = 'leitura';
    this.rascunho = null;
    this.render();
  },


  /* Vai de uma facção para a ficha de um membro. */
  irParaNpc: function (id) {
    this.lista = 'npcs';
    this.montarFiltros();
    this.abrir(id);
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
        campo.value = '';
        self.filtro.busca = '';
        self.render();
      }
    });

    document.getElementById('limparBusca').addEventListener('click', function () {
      campo.value = '';
      self.filtro.busca = '';
      self.render();
      campo.focus();
    });

    /* Um listener para a área inteira: cabeçalho, filtros, lista e
       detalhe. Todos usam data-acao. */
    document.querySelector('.area-trabalho').addEventListener('click', function (evento) {
      const alvo = evento.target.closest('[data-acao]');
      if (!alvo) return;

      switch (alvo.dataset.acao) {
        case 'lista':
          self.lista = alvo.dataset.valor;
          self.selecionado = null;
          self.modo = 'leitura';
          self.montarFiltros();
          self.render();
          break;

        case 'atitude':
          self.filtro.atitude = alvo.dataset.valor;
          self.montarFiltros();
          self.render();
          break;

        case 'faccao':
          self.filtro.faccao = alvo.dataset.valor;
          self.montarFiltros();
          self.render();
          break;

        case 'abrir':           self.abrir(alvo.dataset.id); break;
        case 'ir-npc':          self.irParaNpc(alvo.dataset.id); break;
        case 'novo':            self.novo(); break;
        case 'sortear':         self.sortear(); break;
        case 'editar':          self.editar(); break;
        case 'salvar':          self.salvar(); break;
        case 'cancelar':        self.cancelar(); break;
        case 'alternar-status': self.alternarStatus(); break;
        case 'apagar':          self.apagar(); break;
      }
    });
  }
};


/* A busca ignora acento e caixa. O compêndio tem a sua em regras.js;
   esta tela não carrega aquele arquivo, então traz a própria. */
function semAcentoSimples(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}


/* A moldura decide se esta pessoa pode ver a tela; só então montamos. */
Layout.iniciar(function () {
  Elenco.iniciar();

  /* Outra aba mudou a campanha (ver 'plainus:externo' no layout.js). */
  Layout.redesenhar = function () { if (Elenco.modo === 'leitura') { Elenco.montarFiltros(); Elenco.render(); } };

  /* Pedido da busca ou dos avisos (ver Layout.aoPedir). Os filtros são
     zerados porque um filtro ativo poderia esconder justamente o item
     pedido — e o mestre veria a ficha sem vê-la na lista. */
  Layout.aoPedir(function (tipo, id) {
    if (tipo !== 'npc' && tipo !== 'faccao') return;

    Elenco.lista = tipo === 'npc' ? 'npcs' : 'faccoes';
    Elenco.filtro = { busca: '', atitude: 'todos', faccao: 'todas' };
    document.getElementById('busca').value = '';
    Elenco.montarFiltros();
    Elenco.abrir(id);
  });
});
