/* ===================================================================
   jogador-consulta.js — as abas Regras e Anotações

   REGRAS
   O livro à mão: magias, equipamento e condições, com busca. É o
   mesmo catálogo do Compêndio do Mestre (regras.js) — que é público:
   está em qualquer Livro do Jogador. O BESTIÁRIO FICA DE FORA: a ficha
   de um monstro é justamente o que o jogador descobre apanhando.

   Clicar numa condição no combate ("Amedrontado") abre aqui o que ela
   faz — ver RegrasJogador.abrir().

   ANOTAÇÕES
   O caderno do jogador: pistas, nomes, teorias. Ficam na ficha dele
   (ficha.notas) e só ele escreve. Sem servidor, o Mestre também
   consegue lê-las (como lê o resto); a tela diz isso, para ninguém
   escrever achando que é um diário trancado.
   =================================================================== */

const RegrasJogador = {

  tipo: 'condicoes',      /* 'condicoes' | 'magias' | 'equipamento' */
  busca: '',
  selecionado: null,      /* nome do verbete aberto */


  /* Leva para a aba Regras já com um verbete aberto. */
  abrir: function (tipo, nome) {
    this.tipo = tipo;
    this.busca = '';
    this.selecionado = nome;
    Jogador.aba = 'regras';
    Jogador.render();
  },


  /* O catálogo do tipo escolhido, já filtrado pela busca, num formato
     só: { nome, meta, alvoBusca }. */
  itens: function () {
    const busca = semAcento(this.busca.trim());
    let lista;

    if (this.tipo === 'magias') {
      lista = MAGIAS.slice().sort(function (a, b) { return a.nivel - b.nivel || a.nome.localeCompare(b.nome); })
        .map(function (m) {
          return {
            nome: m.nome,
            meta: (m.nivel === 0 ? 'Truque' : m.nivel + 'º nível') + ' · ' + m.escola,
            alvo: m.nome + ' ' + m.escola + ' ' + m.texto + ' ' + m.classes.join(' ')
          };
        });
    } else if (this.tipo === 'equipamento') {
      lista = EQUIPAMENTO.map(function (e) {
        return {
          nome: e.nome,
          meta: e.categoria + ' · ' + (e.dano ? e.dano + ' ' + e.tipoDano : 'CA ' + e.ca),
          alvo: e.nome + ' ' + e.categoria + ' ' + (e.propriedades || '')
        };
      });
    } else {
      lista = Object.keys(CONDICOES).map(function (nome) {
        return { nome: nome, meta: 'Condição', alvo: nome + ' ' + CONDICOES[nome] };
      });
    }

    if (!busca) return lista;
    return lista.filter(function (item) { return semAcento(item.alvo).indexOf(busca) !== -1; });
  },


  montar: function (area) {
    const self = this;

    /* A busca fica FORA da parte que se redesenha a cada tecla — senão
       o campo seria recriado e perderia o foco no meio da palavra. */
    const campo = document.createElement('input');
    campo.type = 'text';
    campo.id = 'buscaRegras';
    campo.value = this.busca;
    campo.placeholder = 'Procure pelo nome ou pelo efeito: paralisado, fogo, concentração…';
    campo.autocomplete = 'off';
    campo.setAttribute('aria-label', 'Procurar nas regras');

    const tipos = criar('div.filtros-magia');
    [['condicoes', 'Condições'], ['magias', 'Magias'], ['equipamento', 'Equipamento']].forEach(function (par) {
      const botao = criar('button.filtro' + (self.tipo === par[0] ? '.ativo' : ''), par[1]);
      botao.type = 'button';
      botao.dataset.acao = 'regras-tipo';
      botao.dataset.tipo = par[0];
      tipos.appendChild(botao);
    });

    /* criar() só entende "tag.classe": o id vai à mão. */
    const lista = criar('div.lista-regras');
    lista.id = 'listaRegras';
    const detalhe = criar('div.detalhe-regras');
    detalhe.id = 'detalheRegras';

    const cartao = criar('div.cartao', [
      criarComIcone('h2', 'compendio', 'Regras', 16),
      criar('div.busca-grande.busca-regras', [Icone.svg('busca', 16), campo]),
      tipos,
      criar('div.colunas-regras', [lista, detalhe])
    ]);
    area.appendChild(cartao);

    this.desenharLista();
    this.desenharDetalhe();
  },


  desenharLista: function () {
    const self = this;
    const area = document.getElementById('listaRegras');
    if (!area) return;
    area.textContent = '';

    const itens = this.itens();
    if (!itens.length) {
      area.appendChild(criar('p.dica', 'Nada encontrado para "' + this.busca + '".'));
      return;
    }

    itens.forEach(function (item) {
      const botao = criar('button.item-regra' + (self.selecionado === item.nome ? '.ativo' : ''), [
        criar('span.nome-uso', item.nome),
        criar('span.sub', item.meta)
      ]);
      botao.type = 'button';
      botao.dataset.acao = 'regras-abrir';
      botao.dataset.nome = item.nome;
      area.appendChild(botao);
    });
  },


  desenharDetalhe: function () {
    const area = document.getElementById('detalheRegras');
    if (!area) return;
    area.textContent = '';

    const nome = this.selecionado;
    if (!nome) {
      area.appendChild(criar('p.dica', 'Escolha um verbete na lista.'));
      return;
    }

    if (this.tipo === 'magias') {
      const m = MAGIAS.find(function (x) { return x.nome === nome; });
      if (!m) return;
      area.appendChild(criar('h3.titulo-regra', m.nome));
      area.appendChild(criar('div.sub', (m.nivel === 0 ? 'Truque de ' + m.escola.toLowerCase() : m.nivel + 'º nível · ' + m.escola)
        + (m.ritual ? ' (ritual)' : '')));
      area.appendChild(criar('div.meta-magia', [m.tempo, m.alcance, m.componentes, m.duracao].join(' · ')));
      area.appendChild(criar('p', m.texto));
      if (m.superior) area.appendChild(criar('p.dica', 'Em espaços superiores: ' + m.superior));
      if (m.concentracao) area.appendChild(criar('p.dica', 'Concentração: uma por vez; ao sofrer dano, salvaguarda de CON (CD 10 ou metade do dano).'));
      area.appendChild(criar('div.sub', 'Conjuram: ' + m.classes.join(', ')));
      return;
    }

    if (this.tipo === 'equipamento') {
      const e = EQUIPAMENTO.find(function (x) { return x.nome === nome; });
      if (!e) return;
      area.appendChild(criar('h3.titulo-regra', e.nome));
      area.appendChild(criar('div.sub', e.categoria));
      area.appendChild(criar('dl.lista-sobre', [
        e.dano ? criar('div', [criar('dt', 'Dano'), criar('dd', e.dano + ' ' + e.tipoDano)]) : null,
        e.ca ? criar('div', [criar('dt', 'Classe de armadura'), criar('dd', String(e.ca))]) : null,
        criar('div', [criar('dt', 'Peso'), criar('dd', e.peso + ' kg')]),
        criar('div', [criar('dt', 'Valor'), criar('dd', e.valor)]),
        criar('div', [criar('dt', 'Propriedades'), criar('dd', e.propriedades)])
      ]));
      return;
    }

    if (!CONDICOES[nome]) return;
    area.appendChild(criar('h3.titulo-regra', nome));
    area.appendChild(criar('div.sub', 'Condição'));
    /* O texto das condições é NOSSO (dados.js) e algumas usam <strong>.
       Nunca vem de digitação — por isso innerHTML é seguro aqui. */
    const texto = document.createElement('p');
    texto.innerHTML = CONDICOES[nome];
    area.appendChild(texto);
  },


  /* A cada tecla: só a lista e o detalhe se redesenham. */
  buscar: function (texto) {
    this.busca = texto;
    this.desenharLista();
  },

  trocarTipo: function (tipo) {
    this.tipo = tipo;
    this.selecionado = null;
    Jogador.render();
  },

  escolher: function (nome) {
    this.selecionado = nome;
    this.desenharLista();
    this.desenharDetalhe();
  }
};


/* ===================================================================
   ANOTAÇÕES
   =================================================================== */

const LIMITE_NOTAS = 100;

const AnotacoesJogador = {

  editando: null,       /* id da nota aberta no formulário, ou null */


  montar: function (area, heroi) {
    const self = this;
    const notas = (heroi.ficha.notas || []).slice().sort(function (a, b) { return b.quando - a.quando; });
    const atual = this.editando ? notas.find(function (n) { return n.id === self.editando; }) : null;

    /* O formulário: nova nota, ou a que está sendo editada. */
    const titulo = document.createElement('input');
    titulo.type = 'text';
    titulo.id = 'notaTitulo';
    titulo.maxLength = 60;
    titulo.placeholder = 'Título (opcional)';
    titulo.value = atual ? atual.titulo : '';
    titulo.setAttribute('aria-label', 'Título da anotação');

    const texto = document.createElement('textarea');
    texto.id = 'notaTexto';
    texto.maxLength = 2000;
    texto.placeholder = 'O que o NPC disse, a pista da porta, a teoria sobre o Encapuzado…';
    texto.value = atual ? atual.texto : '';
    texto.setAttribute('aria-label', 'Texto da anotação');

    const botoes = [criarBotao('botao.pequeno', 'nota-salvar', 'check', atual ? 'Salvar alterações' : 'Guardar anotação')];
    if (atual) botoes.push(criarBotao('botao.fantasma.pequeno', 'nota-cancelar', null, 'Cancelar'));

    area.appendChild(criar('div.cartao', [
      criarComIcone('h2', 'nota', atual ? 'Editando anotação' : 'Nova anotação', 16),
      criar('div.form-nota', [titulo, texto]),
      criar('div.acoes-detalhe', botoes),
      criar('p.dica', 'As anotações ficam na sua ficha. Sem servidor, o Mestre também consegue lê-las.')
    ]));

    const lista = criar('div.cartao', [criarComIcone('h2', 'diario', 'Suas anotações (' + notas.length + ')', 16)]);
    if (!notas.length) lista.appendChild(criar('p.dica', 'Nenhuma anotação ainda.'));

    notas.forEach(function (n) {
      const editar = criarBotao('mini-botao', 'nota-editar', 'editar', 'Editar');
      editar.dataset.id = n.id;
      const apagar = criarBotao('mini-botao.perigo-leve', 'nota-apagar', 'remover', 'Apagar');
      apagar.dataset.id = n.id;

      lista.appendChild(criar('div.sessao-jogador.nota-jogador', [
        criar('div.cabeca-sessao-jogador', [
          criar('span.titulo', n.titulo || 'Sem título'),
          criar('span.numero-sessao', new Date(n.quando).toLocaleDateString('pt-BR'))
        ]),
        criar('p', n.texto),
        criar('div.botoes-uso', [editar, apagar])
      ]));
    });
    area.appendChild(lista);
  },


  salvar: function () {
    const self = this;
    const titulo = document.getElementById('notaTitulo').value.trim();
    const texto = document.getElementById('notaTexto').value.trim();

    if (!texto) { Layout.recado('Escreva alguma coisa na anotação.', true); return; }
    if (titulo.length > 60 || texto.length > 2000) { Layout.recado('Anotação longa demais.', true); return; }

    const editando = this.editando;
    const ok = UsoFicha.usar(function (f) {
      if (editando) {
        const nota = f.notas.find(function (n) { return n.id === editando; });
        if (!nota) return false;
        nota.titulo = titulo;
        nota.texto = texto;
        return;
      }
      if (f.notas.length >= LIMITE_NOTAS) return false;
      f.notas.push({ id: 'n' + Date.now(), titulo: titulo, texto: texto, quando: Date.now() });
    }, editando ? 'Anotação atualizada.' : 'Anotação guardada.');

    if (ok) {
      self.editando = null;
      Jogador.render();
    }
  },


  editar: function (id) {
    this.editando = id;
    Jogador.render();
    const campo = document.getElementById('notaTexto');
    if (campo) campo.focus();
  },

  cancelar: function () {
    this.editando = null;
    Jogador.render();
  },

  /* Apaga na hora e oferece desfazer (Layout.recadoDesfazer). */
  apagar: function (id) {
    const self = this;
    let nota = null;
    let posicao = 0;
    const ok = UsoFicha.usar(function (f) {
      posicao = f.notas.findIndex(function (n) { return n.id === id; });
      if (posicao === -1) return false;
      nota = f.notas[posicao];
      f.notas.splice(posicao, 1);
      if (self.editando === id) self.editando = null;
    });
    if (!ok) return;
    Layout.recadoDesfazer('Anotação apagada.', function () {
      UsoFicha.usar(function (f) {
        return Layout.devolver(f.notas, nota, posicao);
      }, 'Anotação de volta.');
    });
  }
};
