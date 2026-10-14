/* ===================================================================
   busca.js — a busca global (Ctrl+K)

   Uma caixa só que procura em TUDO: magias, monstros, NPCs, facções,
   diário, segredos, pendências, tabelas, cenas e heróis. Escolher um
   resultado leva à tela certa, já com o item aberto.


   COMO ELA "ABRE" UM ITEM EM OUTRA PÁGINA
   Cada tela é um .html próprio, então a busca não consegue chamar
   Compendio.abrir() — o Compendio nem existe na página em que você
   está. O pedido viaja no endereço, depois do #:

     compendio.html#abrir=magias:Bola de Fogo
                          └─tipo─┘ └──valor──┘

   A tela de destino, ao montar, pergunta ao Layout se chegou um
   pedido (Layout.aoPedir, no layout.js) e abre o item. O # e não o ?
   porque o # não recarrega a página quando o destino é a própria tela
   em que você está: só dispara o evento 'hashchange'.

   Segurança: qualquer um pode montar um link com # e mandar para o
   mestre. Por isso o valor do pedido só é usado para PROCURAR um item
   por id ou nome — nunca vira HTML nem código.


   POR QUE O ÍNDICE É REFEITO A CADA ABERTURA
   O Estado muda o tempo todo (NPC novo, sessão nova). Montar a lista
   na hora custa milissegundos e garante que a busca nunca mostre um
   NPC que você apagou. Com as poucas centenas de itens de uma
   campanha, não há o que otimizar.

   <dialog> e showModal() dão de graça o que custaria dezenas de linhas:
   fundo escurecido, Esc fechando, e o foco preso dentro da caixa.
   =================================================================== */

const Busca = {

  indice: [],
  resultados: [],
  ativo: 0,           /* qual resultado as setas estão marcando */
  caixa: null,


  /* ---------- Abrir e fechar ---------- */

  abrir: function () {
    if (!this.caixa) this.montar();

    this.indice = this.montarIndice();
    const campo = document.getElementById('buscaGlobalCampo');
    campo.value = '';
    this.filtrar('');

    if (!this.caixa.open) this.caixa.showModal();
    campo.focus();
  },

  fechar: function () {
    if (this.caixa && this.caixa.open) this.caixa.close();
  },


  /* A caixa é criada uma vez, na primeira abertura, e reaproveitada. */
  montar: function () {
    const self = this;

    const campo = document.createElement('input');
    campo.type = 'text';
    campo.id = 'buscaGlobalCampo';
    campo.placeholder = 'Buscar magia, monstro, NPC, segredo, cena...';
    campo.autocomplete = 'off';
    campo.spellcheck = false;
    campo.setAttribute('aria-label', 'Buscar na campanha');
    campo.setAttribute('aria-controls', 'buscaGlobalLista');

    const lista = criar('div.busca-lista');
    lista.id = 'buscaGlobalLista';
    lista.setAttribute('role', 'listbox');

    const topo = criar('div.busca-campo', [Icone.svg('busca', 17), campo, criar('kbd', 'Esc')]);

    const rodape = criar('div.busca-rodape', [
      criar('span', [criar('kbd', '↑'), criar('kbd', '↓'), document.createTextNode(' navegar')]),
      criar('span', [criar('kbd', 'Enter'), document.createTextNode(' abrir')]),
      criar('span', [criar('kbd', 'Esc'), document.createTextNode(' fechar')])
    ]);

    this.caixa = criar('dialog.busca-global', [topo, lista, rodape]);
    this.caixa.setAttribute('aria-label', 'Busca na campanha');
    document.body.appendChild(this.caixa);

    campo.addEventListener('input', function () { self.filtrar(campo.value); });

    campo.addEventListener('keydown', function (evento) {
      if (evento.key === 'ArrowDown') { evento.preventDefault(); self.mover(1); }
      else if (evento.key === 'ArrowUp') { evento.preventDefault(); self.mover(-1); }
      else if (evento.key === 'Enter') { evento.preventDefault(); self.ir(self.ativo); }
    });

    lista.addEventListener('click', function (evento) {
      const linha = evento.target.closest('[data-indice]');
      if (linha) self.ir(Number(linha.dataset.indice));
    });

    /* Clique no fundo escurecido fecha. O fundo faz parte do próprio
       <dialog>, então "clicou no dialog, e não num filho" = fundo. */
    this.caixa.addEventListener('click', function (evento) {
      if (evento.target === self.caixa) self.fechar();
    });
  },


  /* ---------- O índice ----------
     Cada item: { grupo, titulo, detalhe, texto, pagina, pedido }
       texto   onde a busca procura (já sem acento e minúsculo)
       pedido  o que vai depois do #abrir= ; vazio = só abrir a tela */

  montarIndice: function () {
    const itens = [];

    function por(grupo, titulo, detalhe, extras, pagina, pedido) {
      itens.push({
        grupo: grupo,
        titulo: titulo,
        detalhe: detalhe || '',
        /* filter(Boolean) tira os campos vazios — sem ele, um NPC sem
           notas teria a palavra "undefined" no texto buscável. */
        texto: semAcento([titulo, detalhe].concat(extras || []).filter(Boolean).join(' ')),
        pagina: pagina,
        pedido: pedido || ''
      });
    }

    /* As telas: Ctrl+K também serve para ir de uma tela a outra. */
    Layout.SECOES.forEach(function (secao) {
      if (secao.pronta) por('Telas', secao.texto, '', [], secao.arquivo, '');
    });

    /* Heróis */
    (Estado.herois || []).forEach(function (h) {
      por('Heróis', h.nome, h.classe + ' · NV ' + h.nivel, [], 'mestre.html', 'heroi:' + h.id);
    });

    /* Conteúdo da campanha. Segredos e notas ENTRAM no texto buscável:
       esta busca é do mestre, e "quem tem a chave?" é pergunta de mestre. */
    (Estado.npcs || []).forEach(function (n) {
      por('NPCs', n.nome, n.papel + (n.local ? ' · ' + n.local : ''),
        [n.raca, n.aparencia, n.objetivo, n.segredo, n.notas], 'npcs.html', 'npc:' + n.id);
    });

    (Estado.faccoes || []).forEach(function (f) {
      por('Facções', f.nome, f.tipo + ' · ' + f.relacao,
        [f.sede, f.objetivo, f.influencia], 'npcs.html', 'faccao:' + f.id);
    });

    (Estado.diario || []).forEach(function (d) {
      por('Diário', 'Sessão ' + d.sessao + (d.titulo ? ' — ' + d.titulo : ''), d.data,
        [d.resumo, d.notas], 'diario.html', 'sessoes:' + d.id);
    });

    (Estado.segredos || []).forEach(function (s) {
      por('Segredos', s.titulo, s.revelado ? 'Revelado' : 'Oculto',
        [s.texto, s.ligadoA], 'diario.html', 'segredos:' + s.id);
    });

    (Estado.pendencias || []).forEach(function (p) {
      por('Pendências', p.texto, p.resolvida ? 'Resolvida' : (p.prazo || 'Em aberto'),
        [], 'diario.html', 'pendencias:' + p.id);
    });

    (Estado.cenas || []).forEach(function (c) {
      por('Cenas', c.nome, c.visibilidade, [], 'mapas.html', 'cena:' + c.id);
    });

    /* O catálogo de regras. Só existe se a página carregou o regras.js;
       o typeof evita quebrar a busca numa tela que não carregou. */
    if (typeof MAGIAS !== 'undefined') {
      MAGIAS.forEach(function (m) {
        por('Magias', m.nome, (m.nivel === 0 ? 'Truque' : m.nivel + 'º círculo') + ' · ' + m.escola,
          [m.classes.join(' ')], 'compendio.html', 'magias:' + m.nome);
      });
    }

    /* todosMonstros() (dados.js): os do livro e os criados por você. */
    todosMonstros().forEach(function (b) {
      por('Monstros', b.nome, [b.tipo, 'ND ' + b.nd].filter(Boolean).join(' · '),
        [b.tamanho], 'bestiario.html', 'monstro:' + b.nome);
    });

    if (typeof EQUIPAMENTO !== 'undefined') {
      EQUIPAMENTO.forEach(function (e) {
        por('Equipamento', e.nome, e.categoria, [e.propriedades], 'compendio.html', 'equipamento:' + e.nome);
      });
    }

    Object.keys(CONDICOES).forEach(function (nome) {
      por('Condições', nome, 'Condição', [], 'compendio.html', 'condicoes:' + nome);
    });

    if (typeof TABELAS !== 'undefined') {
      TABELAS.concat(Estado.tabelasMinhas || []).forEach(function (t) {
        por('Tabelas', t.nome, t.categoria || 'Minha tabela', [], 'tabelas.html', 'tabela:' + t.id);
      });
    }

    return itens;
  },


  /* ---------- Procurar ---------- */

  filtrar: function (texto) {
    const termos = semAcento(texto.trim()).split(/\s+/).filter(Boolean);

    if (!termos.length) {
      /* Caixa vazia: mostra as telas, como um atalho de navegação. */
      this.resultados = this.indice.filter(function (item) { return item.grupo === 'Telas'; });
    } else {
      /* Todos os termos precisam aparecer ("bola fogo" acha "Bola de
         Fogo"). A nota ordena: começar pelo termo vale mais que
         conter, e estar no título vale mais que estar no texto. */
      const primeiro = termos[0];

      this.resultados = this.indice
        .filter(function (item) {
          return termos.every(function (t) { return item.texto.indexOf(t) !== -1; });
        })
        .map(function (item) {
          const titulo = semAcento(item.titulo);
          const nota = titulo.indexOf(primeiro) === 0 ? 3 : (titulo.indexOf(primeiro) !== -1 ? 2 : 1);
          return { item: item, nota: nota };
        })
        .sort(function (a, b) { return b.nota - a.nota; })
        .map(function (par) { return par.item; })
        .slice(0, 40);
    }

    this.ativo = 0;
    this.desenhar(texto.trim());
  },


  desenhar: function (texto) {
    const lista = document.getElementById('buscaGlobalLista');
    lista.textContent = '';

    if (!this.resultados.length) {
      lista.appendChild(criar('div.busca-vazio', 'Nada encontrado para "' + texto + '".'));
      return;
    }

    /* Agrupa na ordem em que os grupos aparecem nos resultados — o
       grupo do melhor resultado vem primeiro. */
    const self = this;
    let grupoAtual = null;

    this.resultados.forEach(function (item, indice) {
      if (item.grupo !== grupoAtual) {
        grupoAtual = item.grupo;
        lista.appendChild(criar('div.busca-grupo', grupoAtual));
      }

      const linha = criar('div.busca-item' + (indice === self.ativo ? '.ativo' : ''), [
        criar('span.busca-titulo', item.titulo),
        item.detalhe ? criar('span.busca-detalhe', item.detalhe) : null
      ]);
      linha.dataset.indice = indice;
      linha.id = 'buscaItem' + indice;
      linha.setAttribute('role', 'option');
      linha.setAttribute('aria-selected', indice === self.ativo ? 'true' : 'false');
      lista.appendChild(linha);
    });

    this.marcarAtivo();
  },


  mover: function (passo) {
    if (!this.resultados.length) return;
    const total = this.resultados.length;
    this.ativo = (this.ativo + passo + total) % total;     /* dá a volta nas pontas */

    const lista = document.getElementById('buscaGlobalLista');
    lista.querySelectorAll('.busca-item').forEach(function (linha) {
      const marcada = Number(linha.dataset.indice) === this.ativo;
      linha.classList.toggle('ativo', marcada);
      linha.setAttribute('aria-selected', marcada ? 'true' : 'false');
    }, this);

    this.marcarAtivo();
  },


  /* Rola a lista até o item marcado e conta ao leitor de tela qual é. */
  marcarAtivo: function () {
    const linha = document.getElementById('buscaItem' + this.ativo);
    if (!linha) return;
    linha.scrollIntoView({ block: 'nearest' });
    document.getElementById('buscaGlobalCampo').setAttribute('aria-activedescendant', linha.id);
  },


  /* ---------- Ir até o item ---------- */

  ir: function (indice) {
    const item = this.resultados[indice];
    if (!item) return;

    this.fechar();

    const destino = item.pagina + (item.pedido ? '#abrir=' + encodeURIComponent(item.pedido) : '');
    const aqui = location.pathname.split('/').pop() || 'index.html';

    if (item.pagina === aqui && !item.pedido) return;     /* já está nesta tela */
    location.href = destino;
  }
};
