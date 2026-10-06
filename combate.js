/* ===================================================================
   combate.js — a tela de Combate & Iniciativa

   O que ela faz de verdade:
     - avança turno e rodada, sabendo de quem é a vez;
     - aplica dano e cura (com o valor que você digitar);
     - aplica e remove condições;
     - traz monstros do catálogo ou gente avulsa para o combate;
     - rola iniciativa de todo mundo e reordena;
     - registra tudo no log, do mais novo para o mais velho.

   Uma regra que vale a pena entender: o PV de um herói mora na FICHA
   (Estado.herois), não no combate. O combatente que é herói guarda um
   heroiId e as duas coisas são atualizadas juntas (ver sincronizar()).
   Sem isso, você curaria alguém no combate e a visão geral continuaria
   mostrando o herói ferido — dois números para a mesma coisa é o tipo
   de bug que só aparece na hora errada.

   O que NÃO está aqui, porque é compartilhado:
     Estado, MONSTROS, CONDICOES, Memoria ... dados.js
     criar(), Layout, a moldura, a guarda .. layout.js
     Icone .................................. icones.js
   =================================================================== */

const Combate = {

  /* Guarda qual combatente está com o menu de condições aberto. */
  condicaoAberta: null,


  iniciar: function () {
    this.preencherCatalogo();
    this.render();
    this.ligarEventos();
  },


  /* ---------- Atalhos de leitura ---------- */

  dados: function () {
    return Estado.combate;
  },

  /* De quem é a vez: o primeiro da ordem que ainda não agiu. */
  indiceDaVez: function () {
    return this.dados().combatentes.findIndex(function (c) {
      return !c.agiu && c.pv > 0;
    });
  },


  /* ---------- Desenho ---------- */

  render: function () {
    this.renderCabecalho();
    this.renderLista();
    this.renderRegistro();
  },


  renderCabecalho: function () {
    const combate = this.dados();
    const vivos = combate.combatentes.filter(function (c) { return c.pv > 0; });
    const inimigos = vivos.filter(function (c) { return c.tipo === 'inimigo'; }).length;
    const faltam = vivos.filter(function (c) { return !c.agiu; }).length;

    /* "Encerrado" só faz sentido se houve combate; numa campanha nova
       a ordem está vazia e nada foi encerrado ainda. */
    const semNinguem = combate.combatentes.length === 0;
    document.getElementById('seloEncontro').textContent = combate.ativo ? 'Combate em andamento'
      : (semNinguem ? 'Sem combate' : 'Combate encerrado');
    document.getElementById('seloRodada').textContent = 'Rodada ' + combate.rodada;
    document.getElementById('tituloEncontro').textContent = combate.encontro || 'Combate';

    document.getElementById('resumoCombate').textContent =
      vivos.length + ' em pé · ' + inimigos + (inimigos === 1 ? ' inimigo' : ' inimigos')
      + ' · ' + faltam + ' ainda por agir nesta rodada';

    document.getElementById('contagemCombate').textContent =
      combate.combatentes.length + ' na ordem';

    /* Os botões de controle mudam conforme o combate está ativo. */
    const area = document.getElementById('controlesCombate');
    area.textContent = '';

    if (combate.ativo) {
      area.appendChild(criarBotao('botao.pequeno', 'proximo-turno', 'passo', 'Próximo turno'));
      area.appendChild(criarBotao('botao.fantasma.pequeno', 'avancar-rodada', 'recarregar', 'Avançar rodada'));
      area.appendChild(criarBotao('botao.fantasma.pequeno', 'rolar-iniciativa', 'dados', 'Rolar iniciativa'));
      area.appendChild(criarBotao('botao.perigo.pequeno', 'encerrar', null, 'Encerrar combate'));
    } else {
      area.appendChild(criarBotao('botao.pequeno', 'iniciar-combate', 'combate', 'Iniciar combate'));
    }
  },


  renderLista: function () {
    const self = this;
    const area = document.getElementById('listaCombatentes');
    const combate = this.dados();
    const vez = this.indiceDaVez();

    area.textContent = '';

    if (combate.combatentes.length === 0) {
      const vazio = criar('div.vazio');
      vazio.appendChild(Icone.svg('combate', 26));
      vazio.appendChild(criar('div', 'Ninguém na ordem ainda. Traga a party e some os monstros ao lado.'));
      area.appendChild(vazio);
      return;
    }

    combate.combatentes.forEach(function (combatente, indice) {
      area.appendChild(self.montarCombatente(combatente, indice === vez && combate.ativo));
    });
  },


  montarCombatente: function (combatente, ehVez) {
    const caido = combatente.pv <= 0;

    const classes = '.combatente'
      + (combatente.agiu && !ehVez ? '.agiu' : '')
      + (ehVez ? '.vez' : '')
      + (combatente.tipo === 'inimigo' ? '.inimigo' : '')
      + (caido ? '.caido' : '');

    const linha = criar('div' + classes);
    linha.dataset.id = combatente.id;

    /* 1. iniciativa */
    linha.appendChild(criar('div.ordem-numero', combatente.iniciativa));

    /* 2. identidade + condições */
    /* O retrato vira uma coluna a mais na grade da linha, e a classe
       avisa o CSS disso. Sem a classe, a linha do inimigo teria cinco
       filhos numa grade de quatro faixas: o nome cairia na coluna do
       PV e os botoes desceriam para uma segunda linha. */
    const desenho = combatente.tipo === 'inimigo' ? Bicho.para(combatente.nome) : null;
    if (desenho) {
      linha.classList.add('com-retrato');
      const marca = criar('div.marca-bicho');
      marca.appendChild(Bicho.svg(desenho, 20));
      linha.appendChild(marca);
    }

    const nome = criar('div.nome-combatente', combatente.nome);

    if (ehVez) nome.appendChild(criar('span.pilula.azul', 'Sua vez'));
    if (caido) nome.appendChild(criar('span.pilula.perigo', combatente.tipo === 'inimigo' ? 'Abatido' : 'Caído'));

    combatente.condicoes.forEach(function (condicao) {
      const chip = criar('span.chip-condicao', condicao);
      const tirar = criar('button', '×');
      tirar.type = 'button';
      tirar.dataset.acao = 'tirar-condicao';
      tirar.dataset.condicao = condicao;
      tirar.setAttribute('aria-label', 'Remover ' + condicao);
      chip.appendChild(tirar);
      nome.appendChild(chip);
    });

    const identidade = criar('div', [nome]);
    if (combatente.nota) identidade.appendChild(criar('div.nota', 'CA ' + combatente.ca + ' · ' + combatente.nota));
    else identidade.appendChild(criar('div.nota', 'CA ' + combatente.ca));

    linha.appendChild(identidade);

    /* 3. vida */
    const proporcao = combatente.pvMax ? combatente.pv / combatente.pvMax : 0;
    const faixa = proporcao > .6 ? '' : (proporcao > .3 ? '.media' : '.baixa');

    const preenchimento = criar('div.preenchimento' + faixa);
    preenchimento.style.width = Math.max(0, proporcao * 100) + '%';

    const numeros = criar('div.numeros', [
      criar('span', 'PV'),
      criar('strong', combatente.pv + ' / ' + combatente.pvMax)
    ]);

    linha.appendChild(criar('div.vida-combatente', [
      numeros,
      criar('div.barra', preenchimento)
    ]));

    /* 4. ações */
    const valor = document.createElement('input');
    valor.type = 'number';
    valor.className = 'campo-numero';
    valor.min = 0;
    valor.max = 999;
    valor.placeholder = '5';
    valor.dataset.campo = 'valor';
    valor.setAttribute('aria-label', 'Quanto de dano ou cura');

    const dano = criarBotao('mini-botao.dano', 'dano', 'menos', '');
    dano.title = 'Aplicar dano';
    const cura = criarBotao('mini-botao.cura', 'cura', 'mais', '');
    cura.title = 'Curar';

    const condicao = criarBotao('mini-botao', 'menu-condicao', 'condicoes', '');
    condicao.title = 'Aplicar condição';

    const remover = criarBotao('mini-botao', 'remover', 'remover', '');
    remover.title = 'Tirar do combate';

    const acoes = criar('div.acoes-combatente', [valor, dano, cura, condicao, remover]);
    linha.appendChild(acoes);

    /* Menu de condições, aberto só para este combatente. */
    if (this.condicaoAberta === combatente.id) {
      const lista = criar('div.etiquetas-condicao');
      lista.style.cssText = 'grid-column:1/-1;margin-top:4px';

      Object.keys(CONDICOES).forEach(function (nomeCondicao) {
        const jaTem = combatente.condicoes.indexOf(nomeCondicao) !== -1;
        const botao = criar('button.etiqueta-condicao' + (jaTem ? '.ativa' : ''), nomeCondicao);
        botao.type = 'button';
        botao.dataset.acao = 'por-condicao';
        botao.dataset.condicao = nomeCondicao;
        lista.appendChild(botao);
      });

      linha.appendChild(lista);
    }

    return linha;
  },


  renderRegistro: function () {
    const area = document.getElementById('registroCombate');
    area.textContent = '';

    const registro = this.dados().registro;

    if (registro.length === 0) {
      area.appendChild(criar('div.vazio', 'Nada aconteceu ainda.'));
      return;
    }

    const icones = { dano: 'menos', cura: 'mais', turno: 'passo', magia: 'magia', entrada: 'mais', saida: 'remover' };

    registro.slice(0, 12).forEach(function (evento) {
      const linha = criar('div.registro-linha.' + (evento.tipo || ''));
      linha.appendChild(Icone.svg(icones[evento.tipo] || 'diario', 14));
      linha.appendChild(criar('span', evento.texto));
      area.appendChild(linha);
    });
  },


  /* O catálogo vem de todosMonstros() (dados.js) — o mesmo que a tela
     de Bestiário mostra, incluindo os monstros que você criou. Antes
     havia uma listinha separada aqui, e duas listas de monstros viram
     duas listas diferentes com o tempo.

     O valor de cada opção é o NOME, e não a posição na lista: com os
     seus monstros entrando e saindo, a posição 17 hoje não é a 17
     amanhã. O nome é único (o Bestiário não deixa repetir). */
  preencherCatalogo: function () {
    const select = document.getElementById('escolhaMonstro');
    todosMonstros().forEach(function (ficha) {
      const opcao = document.createElement('option');
      opcao.value = ficha.nome;
      opcao.textContent = ficha.nome + ' — ND ' + ficha.nd + ' · CA ' + ficha.ca + ' · ' + ficha.pv + ' PV'
        + (ficha.meu ? ' (sua)' : '');
      select.appendChild(opcao);
    });
  },


  /* ---------- Eventos ----------
     Um listener na área de trabalho inteira, lendo data-acao.
     Nunca onclick no HTML (problema nº 5 do CLAUDE.md). */

  ligarEventos: function () {
    const self = this;

    document.querySelector('.area-trabalho').addEventListener('click', function (evento) {
      const alvo = evento.target.closest('[data-acao]');
      if (!alvo) return;

      const linha = alvo.closest('[data-id]');
      self.executar(alvo.dataset.acao, alvo, linha ? linha.dataset.id : null);
    });

    /* Enter no campo de dano aplica o dano, que é o gesto natural. */
    document.getElementById('listaCombatentes').addEventListener('keydown', function (evento) {
      if (evento.key !== 'Enter') return;
      if (!evento.target.matches('[data-campo="valor"]')) return;

      evento.preventDefault();
      const linha = evento.target.closest('[data-id]');
      if (linha) self.aplicarPV(linha.dataset.id, -1);
    });
  },


  executar: function (acao, alvo, id) {
    switch (acao) {

      case 'proximo-turno':    this.proximoTurno(); break;
      case 'avancar-rodada':   this.avancarRodada(); break;
      case 'rolar-iniciativa': this.rolarIniciativa(); break;
      case 'encerrar':         this.encerrar(); break;
      case 'iniciar-combate':  this.iniciarCombate(); break;

      case 'dano': this.aplicarPV(id, -1); break;
      case 'cura': this.aplicarPV(id, +1); break;

      case 'menu-condicao':
        this.condicaoAberta = (this.condicaoAberta === id) ? null : id;
        this.renderLista();
        break;

      case 'por-condicao':   this.porCondicao(id, alvo.dataset.condicao); break;
      case 'tirar-condicao': this.tirarCondicao(id, alvo.dataset.condicao); break;

      case 'remover':     this.remover(id); break;
      case 'add-monstro': this.adicionarMonstro(); break;
      case 'add-avulso':  this.adicionarAvulso(); break;
      case 'add-party':   this.adicionarParty(); break;
    }
  },


  /* ---------- Turnos ---------- */

  proximoTurno: function () {
    const vez = this.indiceDaVez();
    if (vez === -1) {
      Layout.recado('Todos já agiram. Avance a rodada para recomeçar a ordem.');
      return;
    }

    const atual = this.dados().combatentes[vez];
    atual.agiu = true;

    const proxima = this.indiceDaVez();
    this.salvar();

    if (proxima === -1) {
      Layout.recado('Fim da rodada ' + this.dados().rodada + '. Avance para a próxima.');
    } else {
      Layout.recado('Agora é a vez de ' + this.dados().combatentes[proxima].nome + '.');
    }
  },


  avancarRodada: function () {
    const combate = this.dados();
    combate.rodada += 1;
    combate.combatentes.forEach(function (c) { c.agiu = false; });

    this.registrar('Rodada ' + combate.rodada + ' começou.', 'turno');
    this.salvar();

    const primeiro = combate.combatentes[this.indiceDaVez()];
    Layout.recado('Rodada ' + combate.rodada + (primeiro ? '. Começa ' + primeiro.nome + '.' : '.'));
  },


  rolarIniciativa: function () {
    const combate = this.dados();

    combate.combatentes.forEach(function (c) {
      /* O bônus do herói vem da ficha; o do monstro ficou salvo nele. */
      let bonus = c.bonusIniciativa || 0;
      if (c.heroiId) {
        const heroi = Estado.herois.find(function (h) { return h.id === c.heroiId; });
        if (heroi) bonus = heroi.bonusIniciativa || 0;
      }
      c.iniciativa = Layout.dado(20) + bonus;
      c.agiu = false;
    });

    Mesa.ordenarIniciativa();
    combate.rodada = 1;

    this.registrar('Iniciativa rolada de novo. A ordem mudou.', 'turno');
    this.salvar();
    Layout.recado('Iniciativa rolada. A rodada voltou para 1.');
  },


  encerrar: function () {
    const combate = this.dados();
    combate.ativo = false;
    this.registrar('Combate encerrado.', 'turno');
    this.salvar();
    Layout.recado('Combate encerrado. A ordem fica salva caso você queira retomar.');
  },


  iniciarCombate: function () {
    const combate = this.dados();
    combate.ativo = true;
    combate.rodada = 1;
    combate.combatentes.forEach(function (c) { c.agiu = false; });
    this.registrar('Combate iniciado.', 'turno');
    this.salvar();
    Layout.recado('Combate iniciado. Role a iniciativa se quiser uma ordem nova.');
  },


  /* ---------- Vida ---------- */

  /* sinal: -1 para dano, +1 para cura. O valor vem do campo da linha
     (ou 5, se estiver vazio). */
  aplicarPV: function (id, sinal) {
    const combatente = this.achar(id);
    if (!combatente) return;

    const campo = document.querySelector('[data-id="' + id + '"] [data-campo="valor"]');
    const digitado = campo ? parseInt(campo.value, 10) : NaN;
    const quanto = (isNaN(digitado) || digitado < 0) ? 5 : digitado;

    const antes = combatente.pv;
    combatente.pv = Math.max(0, Math.min(combatente.pvMax, combatente.pv + sinal * quanto));

    if (combatente.pv === antes) return;

    this.sincronizar(combatente);
    if (campo) campo.value = '';

    const verbo = sinal < 0 ? 'sofre' : 'recupera';
    this.registrar(combatente.nome + ' ' + verbo + ' ' + Math.abs(combatente.pv - antes) + ' PV.', sinal < 0 ? 'dano' : 'cura');

    if (combatente.pv === 0) {
      const aviso = combatente.tipo === 'inimigo'
        ? combatente.nome + ' foi abatido.'
        : combatente.nome + ' caiu a 0 PV — testes de morte a partir do próximo turno.';
      this.registrar(aviso, 'dano');
      Layout.recado(aviso, true);
    } else {
      Layout.recado(combatente.nome + ': ' + antes + ' → ' + combatente.pv + ' PV.');
    }

    this.salvar();
  },


  /* O PV de herói mora na ficha. Aqui as duas cópias andam juntas. */
  sincronizar: function (combatente) {
    if (!combatente.heroiId) return;
    const heroi = Estado.herois.find(function (h) { return h.id === combatente.heroiId; });
    if (heroi) heroi.pv = combatente.pv;
  },


  /* ---------- Condições ---------- */

  porCondicao: function (id, condicao) {
    const combatente = this.achar(id);
    if (!combatente) return;

    const posicao = combatente.condicoes.indexOf(condicao);
    if (posicao === -1) {
      combatente.condicoes.push(condicao);
      this.registrar(combatente.nome + ' está ' + condicao.toLowerCase() + '.', 'magia');
    } else {
      combatente.condicoes.splice(posicao, 1);
    }

    this.salvar();
  },


  tirarCondicao: function (id, condicao) {
    const combatente = this.achar(id);
    if (!combatente) return;

    const posicao = combatente.condicoes.indexOf(condicao);
    if (posicao === -1) return;

    combatente.condicoes.splice(posicao, 1);
    this.registrar(combatente.nome + ' não está mais ' + condicao.toLowerCase() + '.', 'cura');
    this.salvar();
  },


  /* ---------- Entrar e sair ---------- */

  adicionarMonstro: function () {
    const select = document.getElementById('escolhaMonstro');
    const ficha = acharMonstro(select.value);
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
    Layout.recado(combatente.nome + ' entrou com iniciativa ' + combatente.iniciativa + '.');
  },


  adicionarAvulso: function () {
    const campoNome = document.getElementById('nomeAvulso');
    const campoPV = document.getElementById('pvAvulso');
    const campoCA = document.getElementById('caAvulso');

    const nome = campoNome.value.trim();
    if (!nome) {
      Layout.recado('Dê um nome a quem está entrando no combate.', true);
      campoNome.focus();
      return;
    }

    const pv = Math.max(1, parseInt(campoPV.value, 10) || 10);
    const ca = Math.max(1, parseInt(campoCA.value, 10) || 12);

    const combatente = Mesa.somarAoCombate({
      nome: Mesa.nomeLivre(nome), tipo: 'inimigo',
      ca: ca, pv: pv, bonusIniciativa: 0, nota: 'Avulso'
    });

    campoNome.value = '';
    campoPV.value = '';
    campoCA.value = '';
    campoNome.focus();

    this.render();
    Layout.recado(combatente.nome + ' entrou com iniciativa ' + combatente.iniciativa + '.');
  },


  /* Traz para o combate os heróis que ainda não estão nele. */
  adicionarParty: function () {
    const combate = this.dados();
    let entraram = 0;

    Estado.herois.forEach(function (heroi) {
      const jaEsta = combate.combatentes.some(function (c) { return c.heroiId === heroi.id; });
      if (jaEsta) return;

      Mesa.somarAoCombate({
        heroiId: heroi.id,
        nome: heroi.nome,
        tipo: 'heroi',
        ca: heroi.ca,
        pv: heroi.pv,
        pvMax: heroi.pvMax,
        bonusIniciativa: heroi.bonusIniciativa || 0,
        nota: heroi.classe
      });

      entraram += 1;
    });

    if (entraram === 0) {
      Layout.recado('A party inteira já está no combate.');
      return;
    }

    this.salvar();
    Layout.recado(entraram + (entraram === 1 ? ' herói entrou' : ' heróis entraram') + ' na ordem.');
  },


  remover: function (id) {
    const combate = this.dados();
    const posicao = combate.combatentes.findIndex(function (c) { return c.id === id; });
    if (posicao === -1) return;

    const saiu = combate.combatentes[posicao];
    combate.combatentes.splice(posicao, 1);

    this.registrar(saiu.nome + ' saiu do combate.', 'saida');
    this.salvar();
    Layout.recado(saiu.nome + ' saiu da ordem.');
  },


  /* ---------- Ajudantes ---------- */

  achar: function (id) {
    return this.dados().combatentes.find(function (c) { return c.id === id; });
  },


  registrar: function (texto, tipo) {
    Mesa.registrar(texto, tipo);
  },


  /* Guarda e redesenha. Toda ação termina aqui — assim não existe
     caminho que muda o Estado e esquece de mostrar. */
  salvar: function () {
    Memoria.salvar();
    this.render();
  }
};


/* A moldura decide se esta pessoa pode ver a tela; só então montamos. */
Layout.iniciar(function () {
  Combate.iniciar();
});
