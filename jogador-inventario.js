/* ===================================================================
   jogador-inventario.js — a aba Inventário

   Moedas, itens, carga e sintonização. E a ponte com a ficha:
     equipar uma ARMA cria o ataque dela (Ataques, na ficha);
     equipar uma ARMADURA ou ESCUDO muda a CA.

   "EQUIPADO" NÃO É GUARDADO
   O item não tem um campo "equipado". Ele é CALCULADO a partir do que
   a ficha já diz:
     armadura   equipada se é a que a ficha diz que ele veste (f.armadura)
     escudo     equipado se a ficha diz que usa escudo (f.escudo)
     arma       equipada se existe um ataque nascido dela (doItem)
   Guardar "equipado" à parte seria ter dois lugares dizendo a mesma
   coisa — e trocar a armadura pelo "Editar ficha" deixaria o
   inventário mentindo. Assim, as duas telas nunca discordam.

   Toda mudança passa por UsoFicha.usar() → enviarMeuHeroi(): a mesma
   ação de salvar a própria ficha.
   =================================================================== */

const MOEDAS = [
  ['pl', 'Platina', 10],      /* quanto vale em peças de ouro */
  ['po', 'Ouro', 1],
  ['pe', 'Electro', 0.5],
  ['pp', 'Prata', 0.1],
  ['pc', 'Cobre', 0.01]
];

const LIMITE_ITENS = 100;


const InventarioJogador = {

  /* ---------- O que está equipado (calculado) ---------- */

  equipado: function (f, item) {
    if (item.tipo === 'armadura') return !!f.armadura && f.armadura === item.ref;
    if (item.tipo === 'escudo') {
      /* Com dois escudos no inventário, só o primeiro conta como em uso. */
      const primeiro = f.itens.find(function (i) { return i.tipo === 'escudo'; });
      return !!f.escudo && primeiro === item;
    }
    if (item.tipo === 'arma') return f.ataques.some(function (a) { return a.doItem === item.id; });
    return false;
  },


  /* ===================================================================
     A ABA
     =================================================================== */

  montar: function (area, heroi) {
    const f = UsoFicha.completar(JSON.parse(JSON.stringify(heroi.ficha)));
    area.appendChild(this.cartaoMoedas(f));
    area.appendChild(this.cartaoCarga(f));
    area.appendChild(this.cartaoItens(f));
  },


  cartaoMoedas: function (f) {
    const linha = criar('div.moedas');
    let valor = 0;

    MOEDAS.forEach(function (m) {
      const quantia = Number(f.moedas[m[0]]) || 0;
      valor += quantia * m[2];

      const entrada = document.createElement('input');
      entrada.type = 'number';
      entrada.min = 0;
      entrada.value = quantia;
      entrada.dataset.moeda = m[0];
      entrada.id = 'moeda-' + m[0];

      const rotulo = document.createElement('label');
      rotulo.htmlFor = entrada.id;
      rotulo.textContent = m[1];
      linha.appendChild(criar('div.moeda', [rotulo, entrada]));
    });

    return criar('div.cartao', [
      criar('div.titulo-coluna', [
        criarComIcone('h2', 'tesouro', 'Moedas', 16),
        criar('span.sub', 'Vale ' + valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' PO')
      ]),
      linha,
      criar('p.dica', 'Digite o novo valor e saia do campo para guardar.')
    ]);
  },


  cartaoCarga: function (f) {
    const peso = Ficha.pesoTotal(f);
    const maximo = Ficha.cargaMaxima(f);
    const proporcao = maximo ? Math.min(1, peso / maximo) : 0;
    const passou = peso > maximo;

    const preenchimento = criar('div.preenchimento' + (passou ? '.baixa' : (proporcao > .75 ? '.media' : '')));
    preenchimento.style.width = (proporcao * 100) + '%';

    const kg = function (n) { return n.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' kg'; };

    return criar('div.cartao', [
      criarComIcone('h2', 'armadura', 'Carga', 16),
      criar('div.linha-vida', [
        criar('span', 'Carregando'),
        criar('span.numeros', kg(peso) + ' de ' + kg(maximo))
      ]),
      criar('div.barra', preenchimento),
      passou
        ? criar('p.aviso-carga', 'Acima da capacidade (Força × 7,5 kg). O Mestre pode aplicar a regra de sobrecarga.')
        : null,
      criar('p.dica.sintonia', 'Sintonizados: ' + Ficha.sintonizados(f) + ' de ' + Ficha.LIMITE_SINTONIA + ' itens mágicos.')
    ]);
  },


  cartaoItens: function (f) {
    const self = this;
    const cartao = criar('div.cartao', [criarComIcone('h2', 'mochila', 'Itens', 16)]);

    /* Adicionar: da lista de armas e armaduras, ou um item qualquer. */
    const lista = document.createElement('select');
    lista.id = 'invLista';
    lista.setAttribute('aria-label', 'Arma ou armadura da lista');
    [['', 'Arma ou armadura da lista…']].concat(EQUIPAMENTO.map(function (e) {
      return [e.nome, e.nome + ' — ' + (e.dano ? e.dano + ' ' + e.tipoDano : 'CA ' + e.ca) + ' · ' + e.peso + ' kg'];
    })).forEach(function (par) {
      const opcao = document.createElement('option');
      opcao.value = par[0];
      opcao.textContent = par[1];
      lista.appendChild(opcao);
    });

    const nome = this.entrada('text', 'invNome', 'Ou escreva um item: corda, poção, tocha…', 60);
    const qtd = this.entrada('number', 'invQtd', 'Qtd.', null);
    qtd.value = 1;
    qtd.min = 1;
    const peso = this.entrada('number', 'invPeso', 'kg cada', null);
    peso.step = '0.1';
    peso.min = 0;
    const magico = document.createElement('input');
    magico.type = 'checkbox';
    magico.id = 'invMagico';

    cartao.appendChild(criar('div.adicionar-item', [
      criar('div.linha-adicionar', [lista, criarBotao('mini-botao', 'inv-da-lista', 'mais', 'Adicionar')]),
      criar('div.linha-adicionar', [
        nome, qtd, peso,
        criar('label.marcar-opcao', [magico, document.createTextNode('Mágico')]),
        criarBotao('mini-botao', 'inv-avulso', 'mais', 'Adicionar')
      ])
    ]));

    if (!f.itens.length) {
      cartao.appendChild(criar('p.dica', 'Mochila vazia.'));
      return cartao;
    }

    f.itens.forEach(function (item) {
      const equipado = self.equipado(f, item);
      const pilulas = [
        equipado ? criar('span.pilula.azul', item.tipo === 'arma' ? 'Empunhada' : 'Em uso') : null,
        item.magico ? criar('span.pilula', 'Mágico') : null,
        item.sintonizado ? criar('span.pilula.azul', 'Sintonizado') : null
      ];

      const menos = criarBotao('mini-botao.passo-qtd', 'inv-qtd', null, '−');
      menos.dataset.id = item.id;
      menos.dataset.delta = -1;
      menos.setAttribute('aria-label', 'Um a menos');
      const mais = criarBotao('mini-botao.passo-qtd', 'inv-qtd', null, '+');
      mais.dataset.id = item.id;
      mais.dataset.delta = 1;
      mais.setAttribute('aria-label', 'Um a mais');

      const botoes = [];
      if (item.tipo !== 'outro') {
        const equipar = criarBotao('mini-botao', 'inv-equipar', item.tipo === 'arma' ? 'combate' : 'armadura',
          equipado ? 'Guardar' : (item.tipo === 'arma' ? 'Empunhar' : 'Vestir'));
        equipar.dataset.id = item.id;
        botoes.push(equipar);
      }
      if (item.magico) {
        const sintonia = criarBotao('mini-botao', 'inv-sintonia', 'magia', item.sintonizado ? 'Desfazer sintonia' : 'Sintonizar');
        sintonia.dataset.id = item.id;
        botoes.push(sintonia);
      }
      const tirar = criar('button.tirar', '×');
      tirar.type = 'button';
      tirar.dataset.acao = 'inv-remover';
      tirar.dataset.id = item.id;
      tirar.setAttribute('aria-label', 'Tirar ' + item.nome + ' do inventário');
      botoes.push(tirar);

      const pesoTotal = (Number(item.quantidade) || 0) * (Number(item.peso) || 0);
      cartao.appendChild(criar('div.item-inventario' + (equipado ? '.equipado' : ''), [
        criar('div.item-nome', [criar('span.nome-uso', item.nome)].concat(pilulas)),
        criar('div.item-qtd', [menos, criar('span', String(item.quantidade)), mais]),
        criar('span.item-peso', pesoTotal.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' kg'),
        criar('div.botoes-uso', botoes)
      ]));
    });

    return cartao;
  },


  entrada: function (tipo, id, dica, limite) {
    const entrada = document.createElement('input');
    entrada.type = tipo;
    entrada.id = id;
    entrada.placeholder = dica;
    entrada.setAttribute('aria-label', dica);
    if (limite) entrada.maxLength = limite;
    return entrada;
  },


  /* ===================================================================
     AS AÇÕES
     =================================================================== */

  /* Uma arma ou armadura da lista EQUIPAMENTO (regras.js). Guarda o
     nome de referência (ref) — é ele que liga o item à regra: a CA da
     armadura, o dano da arma. */
  adicionarDaLista: function () {
    const ref = document.getElementById('invLista').value;
    const base = EQUIPAMENTO.find(function (e) { return e.nome === ref; });
    if (!base) {
      Layout.recado('Escolha uma arma ou armadura na lista.', true);
      return;
    }
    const tipo = base.categoria === 'Arma' ? 'arma' : (base.categoria === 'Escudo' ? 'escudo' : 'armadura');

    UsoFicha.usar(function (f) {
      if (f.itens.length >= LIMITE_ITENS) return false;
      f.itens.push({
        id: 'i' + Date.now() + Math.floor(Math.random() * 1000),
        nome: base.nome, ref: base.nome, tipo: tipo,
        quantidade: 1, peso: base.peso, magico: false, sintonizado: false
      });
    }, base.nome + ' entrou no inventário.');
  },


  /* Um item qualquer. Mesmo nome de um que já existe (e não é arma nem
     armadura): soma na quantidade, em vez de duplicar a linha. */
  adicionarAvulso: function () {
    const nome = document.getElementById('invNome').value.trim();
    const qtd = Number(document.getElementById('invQtd').value || 1);
    const peso = Number(document.getElementById('invPeso').value || 0);
    const magico = document.getElementById('invMagico').checked;

    if (!nome || nome.length > 60) { Layout.recado('Dê um nome ao item (até 60 letras).', true); return; }
    if (!Number.isInteger(qtd) || qtd < 1 || qtd > 999) { Layout.recado('Quantidade: de 1 a 999.', true); return; }
    if (!(peso >= 0 && peso <= 500)) { Layout.recado('Peso: de 0 a 500 kg por unidade.', true); return; }

    UsoFicha.usar(function (f) {
      const igual = f.itens.find(function (i) { return i.tipo === 'outro' && i.nome === nome && !!i.magico === magico; });
      if (igual) {
        igual.quantidade = Math.min(999, igual.quantidade + qtd);
        return;
      }
      if (f.itens.length >= LIMITE_ITENS) return false;
      f.itens.push({
        id: 'i' + Date.now() + Math.floor(Math.random() * 1000),
        nome: nome, ref: '', tipo: 'outro',
        quantidade: qtd, peso: Math.round(peso * 100) / 100, magico: magico, sintonizado: false
      });
    }, nome + ' entrou no inventário.');
  },


  quantidade: function (id, delta) {
    UsoFicha.usar(function (f) {
      const item = f.itens.find(function (i) { return i.id === id; });
      if (!item) return false;
      const nova = Math.max(1, Math.min(999, item.quantidade + delta));
      if (nova === item.quantidade) return false;
      item.quantidade = nova;
    });
  },


  /* Empunhar / vestir / guardar. Mexe na ficha, que é a fonte do que
     está equipado — ver o topo. */
  equipar: function (id) {
    const self = this;
    let recado = '';

    UsoFicha.usar(function (f) {
      const item = f.itens.find(function (i) { return i.id === id; });
      if (!item) return false;
      const estava = self.equipado(f, item);

      if (item.tipo === 'arma') {
        if (estava) {
          f.ataques = f.ataques.filter(function (a) { return a.doItem !== item.id; });
          recado = item.nome + ' guardada. O ataque dela saiu da ficha.';
        } else {
          const arma = ARMAS.find(function (a) { return a.nome === item.ref; });
          if (!arma) return false;
          f.ataques.push({
            nome: item.nome, atributo: Ficha.atributoDaArma(f, arma), proficiente: true,
            dano: arma.dano, tipo: arma.tipoDano, bonus: 0, doItem: item.id
          });
          recado = item.nome + ' empunhada. O ataque dela entrou na ficha.';
        }
      } else if (item.tipo === 'armadura') {
        f.armadura = estava ? '' : item.ref;
        recado = estava ? item.nome + ' tirada.' : item.nome + ' vestida.';
      } else if (item.tipo === 'escudo') {
        f.escudo = !estava;
        recado = estava ? 'Escudo guardado.' : 'Escudo em uso: +2 na CA.';
      }
    });

    if (recado) Layout.recado(recado + ' CA agora: ' + Ficha.ca(UsoFicha.fichaAtual()) + '.');
  },


  /* No máximo 3 itens sintonizados ao mesmo tempo (Livro do Mestre). */
  sintonizar: function (id) {
    let recado = '';
    let erro = false;

    UsoFicha.usar(function (f) {
      const item = f.itens.find(function (i) { return i.id === id; });
      if (!item || !item.magico) return false;
      if (!item.sintonizado && Ficha.sintonizados(f) >= Ficha.LIMITE_SINTONIA) {
        recado = 'Você já está sintonizado com ' + Ficha.LIMITE_SINTONIA + ' itens. Desfaça uma sintonia antes.';
        erro = true;
        return false;
      }
      item.sintonizado = !item.sintonizado;
      recado = item.sintonizado ? 'Sintonizado com ' + item.nome + '.' : 'Sintonia com ' + item.nome + ' desfeita.';
    });

    if (recado) Layout.recado(recado, erro);
  },


  /* Tirar do inventário desequipa antes: uma armadura apagada não pode
     continuar dando CA, nem uma arma apagada deixar o ataque órfão. */
  remover: function (id) {
    const self = this;
    const item = (Jogador.visao.meuHeroi.ficha.itens || []).find(function (i) { return i.id === id; });
    if (!item) return;
    /* Tira na hora e oferece desfazer (Layout.recadoDesfazer). Como tirar
       um item equipado também mexe em ataques, armadura e escudo, a
       volta restaura os quatro como estavam. */
    let antes = null;
    const ok = UsoFicha.usar(function (f) {
      antes = JSON.parse(JSON.stringify({ itens: f.itens, ataques: f.ataques, armadura: f.armadura, escudo: f.escudo }));
      const alvo = f.itens.find(function (i) { return i.id === id; });
      if (!alvo) return false;
      if (self.equipado(f, alvo)) {
        if (alvo.tipo === 'arma') f.ataques = f.ataques.filter(function (a) { return a.doItem !== alvo.id; });
        if (alvo.tipo === 'armadura') f.armadura = '';
        if (alvo.tipo === 'escudo') f.escudo = false;
      }
      f.itens = f.itens.filter(function (i) { return i.id !== id; });
    });
    if (!ok) return;
    Layout.recadoDesfazer(item.nome + ' saiu do inventário.', function () {
      UsoFicha.usar(function (f) {
        if (f.itens.some(function (i) { return i.id === id; })) return false;
        Object.assign(f, antes);
      }, item.nome + ' voltou para a mochila.');
    });
  },


  mudarMoeda: function (chave, texto) {
    const valor = Number(texto);
    if (!Number.isInteger(valor) || valor < 0 || valor > 9999999) {
      Layout.recado('Moedas: um número inteiro, de 0 para cima.', true);
      Jogador.render();
      return;
    }
    UsoFicha.usar(function (f) {
      if ((Number(f.moedas[chave]) || 0) === valor) return false;
      f.moedas[chave] = valor;
    });
  }
};
