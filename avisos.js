/* ===================================================================
   avisos.js — o sino da barra do topo

   Os avisos NÃO são guardados: são CALCULADOS a partir do Estado toda
   vez que alguém pergunta. "Kaelen caiu" não é uma mensagem que alguém
   escreveu; é o que se conclui olhando para heroi.pv === 0.

   Por que calcular em vez de guardar uma lista de mensagens:
     - o aviso some sozinho quando deixa de ser verdade (curou o
       Kaelen, o aviso vai embora — ninguém precisa apagá-lo);
     - não existe aviso desatualizado, porque não existe cópia.

   O QUE É "NOVO"
   Cada aviso tem uma chave estável ('caido:kaelen'). Ao abrir o sino,
   as chaves de agora vão para Estado.avisosVistos. O ponto azul
   acende quando aparece alguma chave que não está lá.

   A lista de vistas é SUBSTITUÍDA a cada abertura, não somada. Assim,
   se o Kaelen cair, for curado e cair de novo, 'caido:kaelen' sumiu
   da lista no meio do caminho e o segundo tombo acende o ponto de novo.

   Quando o servidor existir, entram aqui os avisos que só ele sabe:
   quem entrou na sala, quem caiu da conexão.
   =================================================================== */

const Avisos = {

  painel: null,


  /* ---------- O que merece aviso ----------
     nivel: 'perigo' | 'atencao' | 'info' — decide a cor e a ordem. */

  calcular: function () {
    const avisos = [];
    const combate = Estado.combate || { combatentes: [] };

    (Estado.herois || []).forEach(function (h) {
      if (h.pv <= 0) {
        avisos.push({
          chave: 'caido:' + h.id, nivel: 'perigo',
          titulo: h.nome + ' está a 0 PV',
          detalhe: 'Testes de morte no início de cada turno dele.',
          pagina: 'mestre.html', pedido: 'heroi:' + h.id
        });
      } else if (h.pv / h.pvMax <= 0.3) {
        avisos.push({
          chave: 'ferido:' + h.id, nivel: 'atencao',
          titulo: h.nome + ' está em perigo',
          detalhe: h.pv + ' de ' + h.pvMax + ' PV.',
          pagina: 'mestre.html', pedido: 'heroi:' + h.id
        });
      }
    });

    if (combate.ativo) {
      combate.combatentes.forEach(function (c) {
        if ((c.condicoes || []).indexOf('Concentrando') === -1) return;
        avisos.push({
          chave: 'concentracao:' + c.id, nivel: 'info',
          titulo: c.nome + ' está concentrando',
          detalhe: 'Ao sofrer dano: salvaguarda de CON, CD 10 ou metade do dano.',
          pagina: 'combate.html', pedido: ''
        });
      });
    }

    (Estado.pendencias || []).forEach(function (p) {
      if (p.resolvida || !p.urgente) return;
      avisos.push({
        chave: 'pendencia:' + p.id, nivel: 'atencao',
        titulo: p.texto,
        detalhe: p.prazo || 'Pendência urgente.',
        pagina: 'diario.html', pedido: 'pendencias:' + p.id
      });
    });

    /* Sessão que já passou e ficou sem resumo: o resumo é o que a
       party lê para lembrar da história, e depois de uma semana
       ninguém lembra mais o que escrever. A sessão corrente não conta:
       é normal ela estar sem resumo enquanto se joga. */
    (Estado.diario || []).forEach(function (d) {
      if (d.sessao === Estado.campanha.sessao || (d.resumo || '').trim()) return;
      avisos.push({
        chave: 'resumo:' + d.id, nivel: 'info',
        titulo: 'Sessão ' + d.sessao + ' ficou sem resumo',
        detalhe: 'Escreva enquanto ainda lembra o que aconteceu.',
        pagina: 'diario.html', pedido: 'sessoes:' + d.id
      });
    });

    const ordem = { perigo: 0, atencao: 1, info: 2 };
    return avisos.sort(function (a, b) { return ordem[a.nivel] - ordem[b.nivel]; });
  },


  novos: function () {
    const vistos = Estado.avisosVistos || [];
    return this.calcular().filter(function (a) { return vistos.indexOf(a.chave) === -1; });
  },


  /* Só salva se a lista mudou. Não é economia: Memoria.salvar()
     dispara 'plainus:mudou', que chama atualizar(), que chama esta
     função de novo. Sem a comparação, seria um laço infinito; com
     ela, a segunda volta encontra tudo igual e para. */
  marcarVistos: function () {
    const agora = this.calcular().map(function (a) { return a.chave; });
    const antes = Estado.avisosVistos || [];
    if (agora.join('|') === antes.join('|')) return;

    Estado.avisosVistos = agora;
    Memoria.salvar();
  },


  /* ---------- O ponto do sino ----------
     Mexe só no ponto e no rótulo, sem redesenhar a barra: isto roda
     depois de CADA mudança no Estado, inclusive enquanto alguém
     digita num campo da barra. */

  atualizarPonto: function () {
    const sino = document.getElementById('sinoAvisos');
    if (!sino) return;

    const quantos = this.novos().length;
    const ponto = sino.querySelector('.aviso-ponto');

    if (quantos && !ponto) sino.appendChild(criar('span.aviso-ponto'));
    if (!quantos && ponto) ponto.remove();

    sino.setAttribute('aria-label', quantos ? 'Avisos (' + quantos + ' novos)' : 'Avisos');
  },


  /* ---------- O painel ---------- */

  alternar: function (botao) {
    if (this.painel) { this.fechar(); return; }
    this.abrir(botao);
  },

  abrir: function (botao) {
    const self = this;

    /* O painel mora no <body>, e não dentro da barra, porque a barra
       é redesenhada inteira quando o som ou a sessão mudam — e o
       painel sumiria no meio da leitura. */
    this.painel = criar('div.painel-avisos');
    this.painel.setAttribute('role', 'dialog');
    this.painel.setAttribute('aria-label', 'Avisos da mesa');
    document.body.appendChild(this.painel);

    /* Pendura o painel logo abaixo do sino, alinhado pela direita. */
    const caixa = botao.getBoundingClientRect();
    this.painel.style.top = (caixa.bottom + 8) + 'px';
    this.painel.style.right = Math.max(16, window.innerWidth - caixa.right) + 'px';

    this.desenhar();
    botao.setAttribute('aria-expanded', 'true');

    this.marcarVistos();
    this.atualizarPonto();

    /* Fechar ao clicar fora. O setTimeout deixa o clique que ABRIU o
       painel terminar de subir antes de começar a escutar — senão
       esse mesmo clique chegaria aqui e fecharia o painel na hora. */
    setTimeout(function () {
      document.addEventListener('click', self.aoClicarFora);
    }, 0);
    document.addEventListener('keydown', this.aoTeclar);
  },

  fechar: function () {
    if (!this.painel) return;
    this.painel.remove();
    this.painel = null;

    document.removeEventListener('click', this.aoClicarFora);
    document.removeEventListener('keydown', this.aoTeclar);

    const sino = document.getElementById('sinoAvisos');
    if (sino) sino.setAttribute('aria-expanded', 'false');
  },

  /* Escritas como propriedades (e não funções anônimas) para o
     removeEventListener conseguir achar a MESMA função e desligá-la. */
  aoClicarFora: function (evento) {
    if (Avisos.painel && !Avisos.painel.contains(evento.target)
        && !evento.target.closest('#sinoAvisos')) {
      Avisos.fechar();
    }
  },

  aoTeclar: function (evento) {
    if (evento.key === 'Escape') Avisos.fechar();
  },


  desenhar: function () {
    if (!this.painel) return;
    const painel = this.painel;
    painel.textContent = '';

    const avisos = this.calcular();

    painel.appendChild(criar('div.avisos-cabeca', [
      criarComIcone('span.titulo', 'sino', 'Avisos da mesa', 14),
      criar('span.pilula', String(avisos.length))
    ]));

    if (!avisos.length) {
      painel.appendChild(criar('div.avisos-vazio', 'Nada pedindo sua atenção agora.'));
    } else {
      const lista = criar('div.avisos-lista');
      avisos.forEach(function (aviso) {
        /* Link de verdade: dá para abrir em outra aba com o botão do meio. */
        const link = criar('a.aviso-item.' + aviso.nivel, [
          criar('span.aviso-marca'),
          criar('span.aviso-textos', [
            criar('span.aviso-titulo', aviso.titulo),
            criar('span.aviso-detalhe', aviso.detalhe)
          ])
        ]);
        link.href = aviso.pagina + (aviso.pedido ? '#abrir=' + encodeURIComponent(aviso.pedido) : '');
        lista.appendChild(link);
      });
      painel.appendChild(lista);
    }

    /* O que aconteceu por último no combate — o registro já existe
       (registrarNoCombate, no acoes.js); aqui só mostramos a ponta. */
    const registro = ((Estado.combate && Estado.combate.registro) || []).slice(0, 4);
    if (registro.length) {
      const recentes = criar('div.avisos-recentes', [criar('div.rotulo-menu', 'Últimos no combate')]);
      registro.forEach(function (linha) {
        recentes.appendChild(criar('div.aviso-registro', linha.texto));
      });
      painel.appendChild(recentes);
    }
  },


  /* Chamado quando o Estado muda (evento 'plainus:mudou'). */
  atualizar: function () {
    if (this.painel) {
      this.desenhar();
      this.marcarVistos();      /* com o painel aberto, o que aparece já foi visto */
    }
    this.atualizarPonto();
  }
};
