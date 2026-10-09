/* ===================================================================
   tabelas.js — rolar nas tabelas

   A tela mais simples do painel, de propósito: escolher, rolar, ler.
   Ela aparece no meio de uma sessão, com a mesa esperando — não é
   hora de navegar por menus.

   Duas coisas valem explicar:

   1. A CONFERÊNCIA AO ABRIR. Uma tabela d12 com 11 itens deixaria o
      resultado 12 sem resposta, e o erro só apareceria quando o dado
      caísse em 12 — na frente de todo mundo. Por isso conferimos ao
      abrir e avisamos ali mesmo (ver montarDetalhe). É mais fácil
      consertar o dado do que descobrir o buraco em jogo.

   2. AS TABELAS PRÓPRIAS. As prontas vêm de TABELAS (regras.js) e não
      se editam. As que você escreve ficam em Estado.tabelasMinhas e
      são salvas. Nas duas listas o id é o mesmo campo, então o resto
      do código não precisa saber de onde a tabela veio — só na hora de
      apagar é que a diferença importa.
   =================================================================== */

const Rolador = {

  selecionada: null,      /* id da tabela aberta */
  modo: 'leitura',        /* 'leitura' | 'edicao' */
  rascunho: null,
  busca: '',


  iniciar: function () {
    if (!Estado.tabelasMinhas) Estado.tabelasMinhas = [];
    if (!Estado.rolagensTabela) Estado.rolagensTabela = [];

    this.render();
    this.ligarEventos();
  },


  /* ---------- Acesso ---------- */

  /* As duas origens, numa lista só. 'minha' diz de onde veio. */
  todas: function () {
    const prontas = TABELAS.map(function (t) {
      return Object.assign({}, t, { minha: false });
    });
    const minhas = (Estado.tabelasMinhas || []).map(function (t) {
      return Object.assign({}, t, { minha: true });
    });
    return prontas.concat(minhas);
  },

  achar: function (id) {
    return this.todas().find(function (t) { return t.id === id; });
  },


  filtrar: function () {
    const busca = semAcento(this.busca.trim());
    if (!busca) return this.todas();

    return this.todas().filter(function (tabela) {
      const alvo = tabela.nome + ' ' + tabela.categoria + ' ' + tabela.itens.join(' ');
      return semAcento(alvo).indexOf(busca) !== -1;
    });
  },


  /* ---------- Desenho ---------- */

  render: function () {
    const tabelas = this.filtrar();

    this.renderLista(tabelas);
    this.renderDetalhe();

    document.getElementById('contagem').textContent =
      tabelas.length + (tabelas.length === 1 ? ' tabela' : ' tabelas');

    const minhas = (Estado.tabelasMinhas || []).length;
    document.getElementById('seloTotal').textContent =
      TABELAS.length + ' prontas' + (minhas ? ' · ' + minhas + ' suas' : '');

    document.getElementById('limparBusca').hidden = this.busca === '';
  },


  /* A lista vem agrupada por categoria — uma lista corrida de vinte
     tabelas obriga a ler tudo para achar a que se quer. */
  renderLista: function (tabelas) {
    const self = this;
    const area = document.getElementById('lista');
    area.textContent = '';

    if (tabelas.length === 0) {
      const vazio = criar('div.vazio');
      vazio.appendChild(Icone.svg('busca', 26));
      vazio.appendChild(criar('div', 'Nada encontrado para "' + this.busca + '".'));
      area.appendChild(vazio);
      return;
    }

    const categorias = [];
    tabelas.forEach(function (t) {
      const nome = t.minha ? 'Minhas tabelas' : t.categoria;
      if (categorias.indexOf(nome) === -1) categorias.push(nome);
    });

    categorias.forEach(function (categoria) {
      const grupo = criar('div.grupo-tabelas', [
        criar('div.titulo-grupo-tabela', categoria)
      ]);

      const lista = criar('div.lista-compendio');

      tabelas.filter(function (t) {
        return (t.minha ? 'Minhas tabelas' : t.categoria) === categoria;
      }).forEach(function (tabela) {
        lista.appendChild(self.montarItem(tabela));
      });

      grupo.appendChild(lista);
      area.appendChild(grupo);
    });
  },


  montarItem: function (tabela) {
    const ativo = this.selecionada === tabela.id;

    const botao = criar('button.item-compendio' + (ativo ? '.ativo' : ''));
    botao.type = 'button';
    botao.dataset.acao = 'abrir';
    botao.dataset.id = tabela.id;

    botao.appendChild(criar('span.selo-dado', 'd' + tabela.dado));

    botao.appendChild(criar('div', [
      criar('div.nome-item', tabela.nome),
      criar('div.linha-meta', tabela.itens.length + ' resultados')
    ]));

    const marcas = criar('div.marcas-item');
    if (tabela.minha) marcas.appendChild(criar('span.pilula.azul', 'Sua'));
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

    if (!this.selecionada) {
      const vazio = criar('div.vazio');
      vazio.style.border = '0';
      vazio.appendChild(Icone.svg('dados', 28));
      vazio.appendChild(criar('div', 'Escolha uma tabela para rolar.'));
      area.appendChild(vazio);
      return;
    }

    this.montarDetalhe(area);
  },


  montarDetalhe: function (area) {
    const tabela = this.achar(this.selecionada);
    if (!tabela) return;

    area.appendChild(criar('h2.titulo-detalhe', tabela.nome));
    area.appendChild(criar('div.subtitulo-detalhe',
      'Rola d' + tabela.dado + ' · ' + tabela.categoria));

    /* A conferência: itens têm que bater com as faces do dado. */
    if (tabela.itens.length !== tabela.dado) {
      const aviso = criar('div.bloco-superior');
      aviso.style.borderLeftColor = 'var(--perigo)';
      aviso.appendChild(criar('strong', 'Atenção: '));
      aviso.appendChild(document.createTextNode(
        'esta tabela rola d' + tabela.dado + ' mas tem ' + tabela.itens.length
        + ' resultados. Os valores sem linha vão sair em branco — ajuste o dado ou a lista.'
      ));
      area.appendChild(aviso);
    }

    /* Botões de rolagem */
    const rolar = criarBotao('botao.pequeno', 'rolar', 'dados', 'Rolar d' + tabela.dado);
    const rolarTres = criarBotao('botao.fantasma.pequeno', 'rolar-tres', null, 'Rolar 3×');

    const acoes = criar('div.linha-botoes', [rolar, rolarTres]);
    acoes.style.marginBottom = '16px';
    area.appendChild(acoes);

    /* Último resultado desta tabela */
    const ultima = (Estado.rolagensTabela || []).find(function (r) {
      return r.tabela === tabela.id;
    });

    if (ultima) {
      area.appendChild(criar('div.resultado-tabela', [
        criar('div.cabeca', [
          criar('div.numero', ultima.face),
          criar('div.rotulo', 'Resultado')
        ]),
        criar('div.texto', ultima.texto)
      ]));
    }

    /* A tabela inteira, com a linha sorteada destacada */
    const linhas = criar('div.linhas-tabela');
    tabela.itens.forEach(function (item, indice) {
      const face = indice + 1;
      const sorteada = ultima && ultima.face === face;

      linhas.appendChild(criar('div.linha-tabela' + (sorteada ? '.sorteada' : ''), [
        criar('span.face', String(face)),
        criar('span', item)
      ]));
    });
    area.appendChild(linhas);

    /* Só as tabelas próprias podem ser mexidas. */
    if (tabela.minha) {
      area.appendChild(criar('div.acoes-detalhe', [
        criarBotao('botao.fantasma.pequeno', 'editar', 'editar', 'Editar'),
        criarBotao('botao.perigo.pequeno', 'apagar', null, 'Apagar')
      ]));
    }

    /* Histórico geral, de todas as tabelas */
    const historico = Estado.rolagensTabela || [];
    if (historico.length > 0) {
      const grupo = criar('div.grupo-acoes', [
        criar('div.titulo-grupo', 'Rolagens recentes')
      ]);

      const lista = criar('div.historico-tabela');
      historico.slice(0, 8).forEach(function (rolagem) {
        lista.appendChild(criar('div.linha-historico', [
          criar('span.de', rolagem.nome + ' ' + rolagem.face + ':'),
          criar('span', rolagem.texto)
        ]));
      });

      grupo.appendChild(lista);
      grupo.appendChild(criar('div.linha-botoes', [
        criarBotao('mini-botao', 'limpar-historico', 'remover', 'Limpar histórico')
      ]));
      area.appendChild(grupo);
    }
  },


  /* ---------- Formulário de tabela própria ---------- */

  montarFormulario: function (area) {
    const tabela = this.rascunho;
    const nova = !(Estado.tabelasMinhas || []).some(function (t) { return t.id === tabela.id; });

    area.appendChild(criar('h2.titulo-detalhe', nova ? 'Nova tabela' : 'Editando'));
    area.appendChild(criar('div.subtitulo-detalhe',
      'Um resultado por linha. O dado é escolhido pelo tanto de linhas.'));

    const form = criar('div.formulario');

    /* nome */
    const entradaNome = document.createElement('input');
    entradaNome.type = 'text';
    entradaNome.value = tabela.nome;
    entradaNome.placeholder = 'Ex.: O que o taverneiro ouviu';
    entradaNome.dataset.campo = 'nome';
    entradaNome.id = 'campo-nome';
    entradaNome.maxLength = 60;

    const rotuloNome = document.createElement('label');
    rotuloNome.textContent = 'Nome da tabela';
    rotuloNome.htmlFor = 'campo-nome';
    form.appendChild(criar('div.campo-form', [rotuloNome, entradaNome]));

    /* categoria */
    const entradaCategoria = document.createElement('input');
    entradaCategoria.type = 'text';
    entradaCategoria.value = tabela.categoria;
    entradaCategoria.placeholder = 'Encontros, Cidade, Narrativa…';
    entradaCategoria.dataset.campo = 'categoria';
    entradaCategoria.id = 'campo-categoria';
    entradaCategoria.maxLength = 30;

    const rotuloCategoria = document.createElement('label');
    rotuloCategoria.textContent = 'Categoria';
    rotuloCategoria.htmlFor = 'campo-categoria';
    form.appendChild(criar('div.campo-form', [rotuloCategoria, entradaCategoria]));

    /* itens */
    const entradaItens = document.createElement('textarea');
    entradaItens.value = tabela.itens.join('\n');
    entradaItens.placeholder = 'Um resultado por linha.';
    entradaItens.dataset.campo = 'itens';
    entradaItens.id = 'campo-itens';
    entradaItens.style.minHeight = '220px';

    const rotuloItens = document.createElement('label');
    rotuloItens.textContent = 'Resultados';
    rotuloItens.htmlFor = 'campo-itens';

    const campoItens = criar('div.campo-form', [rotuloItens, entradaItens]);
    campoItens.appendChild(criar('div.ajuda',
      'O dado sai da quantidade de linhas: 6 linhas viram d6, 9 viram d9. Como quem '
      + 'rola é o computador, o dado não precisa existir de verdade — assim nenhuma '
      + 'linha fica sem chance de sair.'));
    form.appendChild(campoItens);

    area.appendChild(form);

    area.appendChild(criar('div.acoes-detalhe', [
      criarBotao('botao.pequeno', 'salvar', 'check', 'Salvar'),
      criarBotao('botao.fantasma.pequeno', 'cancelar', null, 'Cancelar')
    ]));
  },


  /* O "dado" de uma tabela sua é simplesmente o tamanho da lista: 6
     itens rolam d6, 9 itens rolam d9.

     Um d9 não existe em cima da mesa, mas aqui quem rola é o
     computador. Arredondar para o dado físico mais próximo seria pior
     dos dois jeitos: para cima deixa faces sem resposta, para baixo
     deixa linhas que nunca saem. Assim toda linha tem a mesma chance
     e nenhuma face fica vazia. */
  dadoPara: function (quantidade) {
    return quantidade;
  },


  /* ---------- Ações ---------- */

  rolar: function (vezes) {
    const tabela = this.achar(this.selecionada);
    if (!tabela) return;

    const saidas = [];

    for (let i = 0; i < (vezes || 1); i++) {
      const face = Layout.dado(tabela.dado);
      const texto = tabela.itens[face - 1] || '(esta tabela não tem resultado para ' + face + ')';

      Estado.rolagensTabela.unshift({
        tabela: tabela.id,
        nome: tabela.nome,
        face: face,
        texto: texto
      });

      saidas.push(face + ': ' + texto);
    }

    Estado.rolagensTabela = Estado.rolagensTabela.slice(0, 30);

    Memoria.salvar();
    this.render();

    Layout.recado(saidas.length === 1
      ? tabela.nome + ' — ' + saidas[0]
      : tabela.nome + ' — ' + saidas.length + ' rolagens: ' + saidas.join(' | '));
  },


  nova: function () {
    this.modo = 'edicao';
    this.rascunho = {
      id: 'tm' + Date.now(),
      nome: '',
      categoria: 'Minhas',
      dado: 6,
      itens: []
    };
    this.render();

    const campo = document.getElementById('campo-nome');
    if (campo) campo.focus();
  },


  editar: function () {
    const tabela = this.achar(this.selecionada);
    if (!tabela || !tabela.minha) return;

    /* Cópia, para cancelar poder descartar. */
    this.rascunho = JSON.parse(JSON.stringify(tabela));
    this.modo = 'edicao';
    this.render();
  },


  salvar: function () {
    const self = this;

    document.querySelectorAll('#detalhe [data-campo]').forEach(function (campo) {
      if (campo.dataset.campo === 'itens') {
        /* Linhas vazias não viram resultado em branco na tabela. */
        self.rascunho.itens = campo.value
          .split('\n')
          .map(function (linha) { return linha.trim(); })
          .filter(function (linha) { return linha !== ''; });
      } else {
        self.rascunho[campo.dataset.campo] = campo.value.trim();
      }
    });

    if (!this.rascunho.nome) {
      Layout.recado('Dê um nome à tabela antes de salvar.', true);
      const campo = document.getElementById('campo-nome');
      if (campo) campo.focus();
      return;
    }

    if (this.rascunho.itens.length < 2) {
      Layout.recado('Uma tabela precisa de pelo menos dois resultados.', true);
      const campo = document.getElementById('campo-itens');
      if (campo) campo.focus();
      return;
    }

    if (!this.rascunho.categoria) this.rascunho.categoria = 'Minhas';
    this.rascunho.dado = this.dadoPara(this.rascunho.itens.length);

    const existente = (Estado.tabelasMinhas || []).find(function (t) {
      return t.id === self.rascunho.id;
    });

    if (existente) {
      Object.keys(this.rascunho).forEach(function (chave) {
        existente[chave] = self.rascunho[chave];
      });
      Layout.recado('"' + existente.nome + '" atualizada.');
    } else {
      Estado.tabelasMinhas.push(this.rascunho);
      Layout.recado('"' + this.rascunho.nome + '" criada, rolando d' + this.rascunho.dado + '.');
    }

    this.selecionada = this.rascunho.id;
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


  apagar: function () {
    const tabela = this.achar(this.selecionada);
    if (!tabela || !tabela.minha) return;

    /* Apaga na hora e oferece desfazer (Layout.recadoDesfazer). */
    const self = this;
    const minhas = Estado.tabelasMinhas || [];
    const posicao = minhas.findIndex(function (t) { return t.id === tabela.id; });
    const original = minhas[posicao];
    Estado.tabelasMinhas = minhas.filter(function (t) { return t.id !== tabela.id; });
    this.selecionada = null;

    Memoria.salvar();
    this.render();
    Layout.recadoDesfazer('"' + tabela.nome + '" apagada.', function () {
      if (!Estado.tabelasMinhas) Estado.tabelasMinhas = [];
      if (!Layout.devolver(Estado.tabelasMinhas, original, posicao)) return;
      self.selecionada = original.id;
      Memoria.salvar();
      self.render();
      Layout.recado('"' + original.nome + '" de volta.');
    });
  },


  limparHistorico: function () {
    Estado.rolagensTabela = [];
    Memoria.salvar();
    this.render();
    Layout.recado('Histórico limpo.');
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
        case 'abrir':
          self.selecionada = alvo.dataset.id;
          self.modo = 'leitura';
          self.render();
          break;

        case 'rolar':            self.rolar(1); break;
        case 'rolar-tres':       self.rolar(3); break;
        case 'nova':             self.nova(); break;
        case 'editar':           self.editar(); break;
        case 'salvar':           self.salvar(); break;
        case 'cancelar':         self.cancelar(); break;
        case 'apagar':           self.apagar(); break;
        case 'limpar-historico': self.limparHistorico(); break;
      }
    });
  }
};


/* A moldura decide se esta pessoa pode ver a tela; só então montamos. */
Layout.iniciar(function () {
  Rolador.iniciar();

  /* Outra aba mudou a campanha (ver 'plainus:externo' no layout.js). */
  Layout.redesenhar = function () { if (Rolador.modo === 'leitura') Rolador.render(); };

  /* Pedido da busca (ver Layout.aoPedir). */
  Layout.aoPedir(function (tipo, id) {
    if (tipo !== 'tabela') return;

    Rolador.selecionada = id;
    Rolador.modo = 'leitura';
    Rolador.rascunho = null;
    Rolador.busca = '';
    document.getElementById('busca').value = '';
    Rolador.render();
  });
});
