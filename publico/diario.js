/* ===================================================================
   diario.js — a memória da campanha

   Três listas na mesma tela, escolhidas por aba: sessões, segredos e
   pendências. A aba ativa decide o que a lista mostra, o que o filtro
   de estado oferece e o que o painel da direita desenha — por isso
   quase toda função começa perguntando `this.aba`.

   Poderiam ser três telas. Ficaram numa só porque as três respondem à
   mesma pergunta antes de começar a sessão: "onde a gente parou, o
   que eles ainda não sabem, e o que eu não posso esquecer?". Separar
   obrigaria a abrir três páginas para montar uma resposta.

   As pendências vêm ordenadas por urgência, não por criação: o que
   tem prazo aparece primeiro, e o que está resolvido vai para o fim.
   Uma lista de afazeres que não se ordena sozinha vira uma lista que
   ninguém lê.
   =================================================================== */

const Diario = {

  aba: 'sessoes',         /* 'sessoes' | 'segredos' | 'pendencias' */
  estado: 'todos',        /* filtro secundário, muda conforme a aba */
  selecionado: null,
  modo: 'leitura',        /* 'leitura' | 'edicao' */
  rascunho: null,
  busca: '',


  iniciar: function () {
    if (!Estado.diario) Estado.diario = [];
    if (!Estado.segredos) Estado.segredos = [];
    if (!Estado.pendencias) Estado.pendencias = [];

    this.montarFiltros();
    this.render();
    this.ligarEventos();
  },


  /* ---------- Filtros ---------- */

  montarFiltros: function () {
    const self = this;

    const areaAba = document.getElementById('filtroAba');
    areaAba.textContent = '';
    areaAba.appendChild(criar('span.rotulo-filtro', 'Mostrar'));

    [
      ['sessoes', 'Sessões'],
      ['segredos', 'Segredos'],
      ['pendencias', 'Pendências']
    ].forEach(function (par) {
      const botao = criar('button.filtro' + (self.aba === par[0] ? '.ativo' : ''), par[1]);
      botao.type = 'button';
      botao.dataset.acao = 'aba';
      botao.dataset.valor = par[0];
      areaAba.appendChild(botao);
    });

    /* O filtro de estado só faz sentido em segredos e pendências. */
    const areaEstado = document.getElementById('filtroEstado');
    areaEstado.textContent = '';

    if (this.aba === 'sessoes') return;

    const opcoes = this.aba === 'segredos'
      ? [['todos', 'Todos'], ['oculto', 'Ocultos'], ['revelado', 'Revelados']]
      : [['todos', 'Todas'], ['aberta', 'Em aberto'], ['resolvida', 'Resolvidas']];

    areaEstado.appendChild(criar('span.rotulo-filtro', 'Estado'));
    opcoes.forEach(function (par) {
      const botao = criar('button.filtro' + (self.estado === par[0] ? '.ativo' : ''), par[1]);
      botao.type = 'button';
      botao.dataset.acao = 'estado';
      botao.dataset.valor = par[0];
      areaEstado.appendChild(botao);
    });
  },


  filtrar: function () {
    const self = this;
    const busca = semAcentoDiario(this.busca.trim());

    if (this.aba === 'sessoes') {
      return Estado.diario.filter(function (entrada) {
        if (!busca) return true;
        const alvo = entrada.titulo + ' ' + entrada.resumo + ' ' + (entrada.notas || '')
          + ' sessao ' + entrada.sessao;
        return semAcentoDiario(alvo).indexOf(busca) !== -1;
      }).sort(function (a, b) { return b.sessao - a.sessao; });
    }

    if (this.aba === 'segredos') {
      return Estado.segredos.filter(function (segredo) {
        if (self.estado === 'oculto' && segredo.revelado) return false;
        if (self.estado === 'revelado' && !segredo.revelado) return false;
        if (!busca) return true;
        const alvo = segredo.titulo + ' ' + segredo.texto + ' ' + (segredo.ligadoA || '');
        return semAcentoDiario(alvo).indexOf(busca) !== -1;
      });
    }

    /* Pendências: urgentes primeiro, resolvidas por último. */
    return Estado.pendencias.filter(function (pendencia) {
      if (self.estado === 'aberta' && pendencia.resolvida) return false;
      if (self.estado === 'resolvida' && !pendencia.resolvida) return false;
      if (!busca) return true;
      return semAcentoDiario(pendencia.texto + ' ' + (pendencia.prazo || '')).indexOf(busca) !== -1;
    }).sort(function (a, b) {
      if (a.resolvida !== b.resolvida) return a.resolvida ? 1 : -1;
      if (a.urgente !== b.urgente) return a.urgente ? -1 : 1;
      return 0;
    });
  },


  /* ---------- Desenho ---------- */

  render: function () {
    const itens = this.filtrar();

    this.renderLista(itens);
    this.renderDetalhe();
    this.renderCabecalho(itens.length);

    document.getElementById('limparBusca').hidden = this.busca === '';
  },


  renderCabecalho: function (quantos) {
    const ocultos = Estado.segredos.filter(function (s) { return !s.revelado; }).length;
    const abertas = Estado.pendencias.filter(function (p) { return !p.resolvida; }).length;
    const ultima = Estado.diario.slice().sort(function (a, b) { return b.sessao - a.sessao; })[0];

    document.getElementById('seloTotal').textContent =
      Estado.diario.length + (Estado.diario.length === 1 ? ' sessão' : ' sessões');
    document.getElementById('seloSegredos').textContent =
      ocultos + (ocultos === 1 ? ' segredo guardado' : ' segredos guardados');

    document.getElementById('resumoDiario').textContent =
      (ultima ? 'Última: sessão ' + ultima.sessao + ' — ' + ultima.titulo + '. ' : '')
      + abertas + (abertas === 1 ? ' pendência em aberto.' : ' pendências em aberto.');

    const titulos = { sessoes: 'Sessões', segredos: 'Segredos', pendencias: 'Pendências' };
    document.getElementById('tituloLista').textContent = titulos[this.aba];

    const nomes = {
      sessoes: quantos === 1 ? ' sessão' : ' sessões',
      segredos: quantos === 1 ? ' segredo' : ' segredos',
      pendencias: quantos === 1 ? ' pendência' : ' pendências'
    };
    document.getElementById('contagem').textContent = quantos + nomes[this.aba];
  },


  renderLista: function (itens) {
    const self = this;
    const area = document.getElementById('lista');
    area.textContent = '';

    if (itens.length === 0) {
      const vazio = criar('div.vazio');
      vazio.appendChild(Icone.svg(this.busca ? 'busca' : 'diario', 26));
      vazio.appendChild(criar('div', this.busca
        ? 'Nada encontrado para "' + this.busca + '".'
        : 'Nada aqui ainda.'));
      area.appendChild(vazio);
      return;
    }

    if (this.aba === 'sessoes') {
      const tempo = criar('div.linha-tempo');
      itens.forEach(function (entrada) { tempo.appendChild(self.montarEntrada(entrada)); });
      area.appendChild(tempo);
      return;
    }

    if (this.aba === 'segredos') {
      itens.forEach(function (segredo) { area.appendChild(self.montarSegredo(segredo)); });
      return;
    }

    itens.forEach(function (pendencia) { area.appendChild(self.montarPendencia(pendencia)); });
  },


  montarEntrada: function (entrada) {
    const botao = criar('button.entrada-diario' + (this.selecionado === entrada.id ? '.ativa' : ''));
    botao.type = 'button';
    botao.dataset.acao = 'abrir';
    botao.dataset.id = entrada.id;

    const cabeca = criar('div.cabeca', [
      criar('span.numero-sessao', 'Sessão ' + entrada.sessao),
      criar('span.titulo-sessao', entrada.titulo)
    ]);
    if (entrada.emAberto) cabeca.appendChild(criar('span.pilula.azul', 'Em aberto'));

    botao.appendChild(cabeca);
    botao.appendChild(criar('div.previa', entrada.resumo));

    return botao;
  },


  montarSegredo: function (segredo) {
    const botao = criar('button.item-segredo'
      + (segredo.revelado ? '.revelado' : '')
      + (this.selecionado === segredo.id ? '.ativa' : ''));
    botao.type = 'button';
    botao.dataset.acao = 'abrir';
    botao.dataset.id = segredo.id;

    botao.appendChild(Icone.svg(segredo.revelado ? 'olho' : 'secreto', 15));

    const corpo = criar('div.corpo', [
      criar('div.titulo-segredo', segredo.titulo)
    ]);
    if (segredo.ligadoA) corpo.appendChild(criar('div.ligado', segredo.ligadoA));
    botao.appendChild(corpo);

    if (segredo.revelado) {
      botao.appendChild(criar('span.pilula',
        segredo.reveladoEm ? 'Sessão ' + segredo.reveladoEm : 'Revelado'));
    }

    return botao;
  },


  montarPendencia: function (pendencia) {
    const item = criar('div.item-pendencia'
      + (pendencia.urgente && !pendencia.resolvida ? '.urgente' : '')
      + (pendencia.resolvida ? '.resolvida' : ''));

    const marcar = criar('button.marcador-feito');
    marcar.type = 'button';
    marcar.dataset.acao = 'alternar-pendencia';
    marcar.dataset.id = pendencia.id;
    marcar.setAttribute('aria-label', pendencia.resolvida ? 'Reabrir' : 'Marcar como resolvida');
    if (pendencia.resolvida) marcar.appendChild(Icone.svg('check', 13));
    item.appendChild(marcar);

    const corpo = criar('div.corpo', [criar('div.texto-pendencia', pendencia.texto)]);
    if (pendencia.prazo) corpo.appendChild(criar('div.prazo', pendencia.prazo));
    item.appendChild(corpo);

    const tirar = criar('button.tirar', '×');
    tirar.type = 'button';
    tirar.dataset.acao = 'tirar-pendencia';
    tirar.dataset.id = pendencia.id;
    tirar.setAttribute('aria-label', 'Apagar pendência');
    item.appendChild(tirar);

    return item;
  },


  renderDetalhe: function () {
    const area = document.getElementById('detalhe');
    area.textContent = '';

    if (this.modo === 'edicao') {
      this.montarFormulario(area);
      return;
    }

    /* A aba de pendências trabalha direto na lista — não há ficha. */
    if (this.aba === 'pendencias') {
      this.montarPainelPendencias(area);
      return;
    }

    if (!this.selecionado) {
      const vazio = criar('div.vazio');
      vazio.style.border = '0';
      vazio.appendChild(Icone.svg('diario', 28));
      vazio.appendChild(criar('div', this.aba === 'sessoes'
        ? 'Escolha uma sessão para ler.'
        : 'Escolha um segredo.'));
      area.appendChild(vazio);
      return;
    }

    if (this.aba === 'sessoes') this.montarFichaSessao(area);
    else this.montarFichaSegredo(area);
  },


  montarFichaSessao: function (area) {
    const entrada = Estado.diario.find(function (e) { return e.id === this.selecionado; }.bind(this));
    if (!entrada) return;

    area.appendChild(criar('h2.titulo-detalhe', entrada.titulo));
    area.appendChild(criar('div.subtitulo-detalhe',
      'Sessão ' + entrada.sessao + (entrada.data ? ' · ' + this.dataPorExtenso(entrada.data) : '')));

    if (entrada.emAberto) {
      const etiquetas = criar('div.cena-etiquetas', [criar('span.pilula.azul', 'Em aberto')]);
      etiquetas.style.marginBottom = '14px';
      area.appendChild(etiquetas);
    }

    area.appendChild(criar('div.bloco-npc', [
      criar('div.rotulo', 'O que aconteceu'),
      criar('div.texto', entrada.resumo)
    ]));

    if (entrada.notas) {
      const bloco = criar('div.bloco-notas');
      const cabeca = criar('div.cabeca');
      cabeca.appendChild(Icone.svg('secreto', 13));
      cabeca.appendChild(criar('span', 'Só você vê'));
      bloco.appendChild(cabeca);
      bloco.appendChild(criar('div.texto', entrada.notas));
      area.appendChild(bloco);
    }

    area.appendChild(criar('div.acoes-detalhe', [
      criarBotao('botao.pequeno', 'editar', 'editar', 'Editar'),
      criarBotao('botao.perigo.pequeno', 'apagar', null, 'Apagar')
    ]));
  },


  montarFichaSegredo: function (area) {
    const self = this;
    const segredo = Estado.segredos.find(function (s) { return s.id === self.selecionado; });
    if (!segredo) return;

    area.appendChild(criar('h2.titulo-detalhe', segredo.titulo));
    area.appendChild(criar('div.subtitulo-detalhe',
      segredo.revelado
        ? 'Revelado' + (segredo.reveladoEm ? ' na sessão ' + segredo.reveladoEm : '')
        : 'Ainda guardado'));

    if (segredo.ligadoA) {
      area.appendChild(criar('div.linhas-monstro', [
        criar('div.linha-monstro', [
          criar('span.chave', 'Ligado a:'),
          criar('span', segredo.ligadoA)
        ])
      ]));
    }

    /* Enquanto oculto, o texto vem no bloco vermelho. Revelado, ele é
       só história — e o vermelho perde o sentido. */
    if (segredo.revelado) {
      area.appendChild(criar('div.bloco-npc', [
        criar('div.rotulo', 'O que era'),
        criar('div.texto', segredo.texto)
      ]));
    } else {
      const bloco = criar('div.bloco-segredo');
      const cabeca = criar('div.cabeca');
      cabeca.appendChild(Icone.svg('secreto', 13));
      cabeca.appendChild(criar('span', 'Só você vê'));
      bloco.appendChild(cabeca);
      bloco.appendChild(criar('div.texto', segredo.texto));
      area.appendChild(bloco);
    }

    area.appendChild(criar('div.acoes-detalhe', [
      criarBotao('botao.pequeno', 'alternar-segredo', segredo.revelado ? 'secreto' : 'olho',
        segredo.revelado ? 'Voltar a guardar' : 'Marcar como revelado')
    ]));
  },


  /* O painel das pendências é um formulário curto: a lista já mostra
     tudo, aqui só se acrescenta. */
  montarPainelPendencias: function (area) {
    area.appendChild(criar('h2.titulo-detalhe', 'Nova pendência'));
    area.appendChild(criar('div.subtitulo-detalhe',
      'O que não pode escapar até a próxima sessão.'));

    const entrada = document.createElement('textarea');
    entrada.placeholder = 'Ex.: cobrar do Aldric a resposta sobre a cripta.';
    entrada.id = 'campo-pendencia';
    entrada.style.minHeight = '80px';

    const rotulo = document.createElement('label');
    rotulo.textContent = 'O que ficou em aberto';
    rotulo.htmlFor = 'campo-pendencia';

    const prazo = document.createElement('input');
    prazo.type = 'text';
    prazo.placeholder = 'Ex.: faltam 3 dias de jogo';
    prazo.id = 'campo-prazo';
    prazo.maxLength = 60;

    const rotuloPrazo = document.createElement('label');
    rotuloPrazo.textContent = 'Prazo (opcional)';
    rotuloPrazo.htmlFor = 'campo-prazo';

    const campoPrazo = criar('div.campo-form', [rotuloPrazo, prazo]);
    campoPrazo.appendChild(criar('div.ajuda',
      'Pendência com prazo sobe para o topo da lista e fica marcada em vermelho.'));

    area.appendChild(criar('div.formulario', [
      criar('div.campo-form', [rotulo, entrada]),
      campoPrazo
    ]));

    area.appendChild(criar('div.acoes-detalhe', [
      criarBotao('botao.pequeno', 'add-pendencia', 'mais', 'Acrescentar')
    ]));
  },


  montarFormulario: function (area) {
    const entrada = this.rascunho;
    const nova = !Estado.diario.some(function (e) { return e.id === entrada.id; });

    area.appendChild(criar('h2.titulo-detalhe', nova ? 'Nova sessão' : 'Editando'));
    area.appendChild(criar('div.subtitulo-detalhe',
      nova ? 'O número já vem preenchido com o seguinte.' : entrada.titulo));

    const form = criar('div.formulario');

    /* número e data lado a lado */
    const campoNumero = document.createElement('input');
    campoNumero.type = 'number';
    campoNumero.min = 1;
    campoNumero.value = entrada.sessao;
    campoNumero.dataset.campo = 'sessao';
    campoNumero.id = 'campo-sessao';

    const rotuloNumero = document.createElement('label');
    rotuloNumero.textContent = 'Sessão';
    rotuloNumero.htmlFor = 'campo-sessao';

    const campoData = document.createElement('input');
    campoData.type = 'date';
    campoData.value = entrada.data || '';
    campoData.dataset.campo = 'data';
    campoData.id = 'campo-data';

    const rotuloData = document.createElement('label');
    rotuloData.textContent = 'Data';
    rotuloData.htmlFor = 'campo-data';

    form.appendChild(criar('div.dupla-form', [
      criar('div.campo-form', [rotuloNumero, campoNumero]),
      criar('div.campo-form', [rotuloData, campoData])
    ]));

    form.appendChild(this.campoTexto('titulo', 'Título', entrada.titulo, 'Ex.: A noite do desaparecimento'));
    form.appendChild(this.campoArea('resumo', 'O que aconteceu', entrada.resumo,
      'O que a party pode reler sem estragar surpresa.'));

    const notas = this.campoArea('notas', 'Notas do mestre', entrada.notas,
      'O que você pensou, o que escondeu, o que preparou.');
    notas.classList.add('segredo');
    notas.appendChild(criar('div.ajuda',
      'Como o campo de segredo dos NPCs: quando houver servidor, isto não sai do seu lado.'));
    form.appendChild(notas);

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
    entrada.id = 'campo-' + campo;
    entrada.maxLength = 80;

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
    entrada.style.minHeight = '110px';

    const etiqueta = document.createElement('label');
    etiqueta.textContent = rotulo;
    etiqueta.htmlFor = entrada.id;

    return criar('div.campo-form', [etiqueta, entrada]);
  },


  /* "26 de setembro de 2026" — mais legível que 2026-09-26 numa
     ficha que se lê rápido antes da sessão começar. */
  dataPorExtenso: function (iso) {
    const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
                   'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const partes = String(iso).split('-');
    if (partes.length !== 3) return iso;

    const mes = meses[Number(partes[1]) - 1];
    if (!mes) return iso;

    return Number(partes[2]) + ' de ' + mes + ' de ' + partes[0];
  },


  /* ---------- Ações ---------- */

  novaSessao: function () {
    const maior = Estado.diario.reduce(function (maximo, e) {
      return Math.max(maximo, e.sessao);
    }, 0);

    const hoje = new Date();
    const iso = hoje.getFullYear() + '-'
      + String(hoje.getMonth() + 1).padStart(2, '0') + '-'
      + String(hoje.getDate()).padStart(2, '0');

    this.aba = 'sessoes';
    this.modo = 'edicao';
    this.rascunho = {
      id: 'd' + Date.now(),
      sessao: maior + 1,
      data: iso,
      titulo: '',
      resumo: '',
      notas: '',
      emAberto: true
    };

    this.montarFiltros();
    this.render();

    const campo = document.getElementById('campo-titulo');
    if (campo) campo.focus();
  },


  editar: function () {
    const self = this;
    const entrada = Estado.diario.find(function (e) { return e.id === self.selecionado; });
    if (!entrada) return;

    this.rascunho = JSON.parse(JSON.stringify(entrada));
    this.modo = 'edicao';
    this.render();
  },


  salvar: function () {
    const self = this;

    document.querySelectorAll('#detalhe [data-campo]').forEach(function (campo) {
      const valor = campo.value.trim();
      self.rascunho[campo.dataset.campo] =
        campo.dataset.campo === 'sessao' ? (parseInt(valor, 10) || 1) : valor;
    });

    if (!this.rascunho.titulo) {
      Layout.recado('Dê um título à sessão antes de salvar.', true);
      const campo = document.getElementById('campo-titulo');
      if (campo) campo.focus();
      return;
    }

    /* A mudança em si é uma ação com nome (acoes.js). */
    const r = Acoes.executar('salvarItem', { lista: 'diario', item: this.rascunho });
    if (r.erro) { Layout.recado(r.erro, true); return; }
    Layout.recado('Sessão ' + this.rascunho.sessao + (r.novo ? ' registrada.' : ' atualizada.'));

    this.selecionado = this.rascunho.id;
    this.modo = 'leitura';
    this.rascunho = null;
    this.render();
  },


  cancelar: function () {
    this.modo = 'leitura';
    this.rascunho = null;
    this.render();
  },


  apagar: function () {
    const self = this;
    const entrada = Estado.diario.find(function (e) { return e.id === self.selecionado; });
    if (!entrada) return;

    /* Apaga na hora e oferece desfazer (Layout.recadoDesfazer). */
    const r = Acoes.executar('apagarItem', { lista: 'diario', id: entrada.id });
    if (r.erro) { Layout.recado(r.erro, true); return; }
    this.selecionado = null;
    this.render();

    Layout.recadoDesfazer('Sessão ' + entrada.sessao + ' apagada.', function () {
      if (Acoes.executar('devolverItem', { lista: 'diario', item: r.item, posicao: r.posicao }).erro) return;
      self.selecionado = entrada.id;
      self.render();
      Layout.recado('Sessão ' + entrada.sessao + ' de volta.');
    });
  },


  /* A regra (guardar EM QUAL sessão foi revelado) mora na ação
     alternarSegredo, no acoes.js. */
  alternarSegredo: function () {
    const r = Acoes.executar('alternarSegredo', { id: this.selecionado });
    if (r.erro) return;
    Layout.recado(r.revelado
      ? '"' + r.titulo + '" agora é história conhecida.'
      : '"' + r.titulo + '" voltou a ser segredo.');
    this.render();
  },


  acrescentarPendencia: function () {
    const campo = document.getElementById('campo-pendencia');
    const prazo = document.getElementById('campo-prazo');
    const texto = campo.value.trim();

    if (!texto) {
      Layout.recado('Escreva o que ficou em aberto.', true);
      campo.focus();
      return;
    }

    const textoPrazo = prazo.value.trim();

    const r = Acoes.executar('salvarItem', { lista: 'pendencias', item: {
      id: 'p' + Date.now(),
      texto: texto,
      prazo: textoPrazo,
      resolvida: false,
      /* Ter prazo é o que torna uma pendência urgente. */
      urgente: textoPrazo !== ''
    } });
    if (r.erro) { Layout.recado(r.erro, true); return; }

    this.render();
    Layout.recado('Pendência anotada.');
  },


  alternarPendencia: function (id) {
    if (Acoes.executar('alternarPendencia', { id: id }).erro) return;
    this.render();
  },


  tirarPendencia: function (id) {
    if (Acoes.executar('apagarItem', { lista: 'pendencias', id: id }).erro) return;
    this.render();
  },


  /* ---------- Eventos ---------- */

  ligarEventos: function () {
    const self = this;
    const campo = document.getElementById('busca');

    campo.addEventListener('input', function () {
      self.busca = campo.value;
      self.render();
    });

    campo.addEventListener('keydown', function (evento) {
      if (evento.key === 'Escape' && campo.value) {
        evento.preventDefault();
        campo.value = '';
        self.busca = '';
        self.render();
      }
    });

    document.getElementById('limparBusca').addEventListener('click', function () {
      campo.value = '';
      self.busca = '';
      self.render();
      campo.focus();
    });

    document.querySelector('.area-trabalho').addEventListener('click', function (evento) {
      const alvo = evento.target.closest('[data-acao]');
      if (!alvo) return;

      switch (alvo.dataset.acao) {
        case 'aba':
          self.aba = alvo.dataset.valor;
          self.estado = 'todos';
          self.selecionado = null;
          self.modo = 'leitura';
          self.montarFiltros();
          self.render();
          break;

        case 'estado':
          self.estado = alvo.dataset.valor;
          self.montarFiltros();
          self.render();
          break;

        case 'abrir':
          self.selecionado = alvo.dataset.id;
          self.modo = 'leitura';
          self.render();
          break;

        case 'nova-sessao':        self.novaSessao(); break;
        case 'editar':             self.editar(); break;
        case 'salvar':             self.salvar(); break;
        case 'cancelar':           self.cancelar(); break;
        case 'apagar':             self.apagar(); break;
        case 'alternar-segredo':   self.alternarSegredo(); break;
        case 'add-pendencia':      self.acrescentarPendencia(); break;
        case 'alternar-pendencia': self.alternarPendencia(alvo.dataset.id); break;
        case 'tirar-pendencia':    self.tirarPendencia(alvo.dataset.id); break;
      }
    });
  }
};


/* A busca ignora acento e caixa. Esta tela não carrega regras.js,
   então traz a própria cópia — como a de NPCs. */
function semAcentoDiario(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}


/* A moldura decide se esta pessoa pode ver a tela; só então montamos. */
Layout.iniciar(function () {
  Diario.iniciar();

  /* Outra aba mudou a campanha (ver 'plainus:externo' no layout.js). */
  Layout.redesenhar = function () { if (Diario.modo === 'leitura') Diario.render(); };

  /* O menu de sessão da barra do topo escreve na mesma lista que esta
     tela mostra. Quando ele mexe, avisa por este evento e a tela se
     redesenha — sem isso, você criaria a sessão 13 pela barra e a
     lista aqui continuaria mostrando até a 12. */
  document.addEventListener('plainus:sessao', function () {
    Diario.render();
  });

  /* Pedido da busca ou dos avisos (ver Layout.aoPedir). O tipo já é o
     nome da aba: 'sessoes', 'segredos' ou 'pendencias'. Pendência não
     tem detalhe para abrir, então ali basta mostrar a aba. */
  Layout.aoPedir(function (aba, id) {
    if (['sessoes', 'segredos', 'pendencias'].indexOf(aba) === -1) return;

    Diario.aba = aba;
    Diario.estado = 'todos';
    Diario.busca = '';
    Diario.selecionado = aba === 'pendencias' ? null : id;
    Diario.modo = 'leitura';
    Diario.rascunho = null;
    document.getElementById('busca').value = '';
    Diario.montarFiltros();
    Diario.render();
  });
});
