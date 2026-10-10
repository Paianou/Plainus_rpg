/* ===================================================================
   conexao.js — a ligação com o servidor (Socket.IO)

   O QUE FAZ POR ENQUANTO
   Mostra QUEM ESTÁ NA MESA agora: ao abrir um painel, o navegador diz
   ao servidor "estou na campanha X, sou fulano"; o servidor junta todo
   mundo da mesma campanha e devolve a lista, e cada painel mostra
   "3 na mesa" na barra do topo. Quem fecha a aba sai da lista sozinho.

   A campanha ainda mora no navegador — trazê-la para o servidor é o
   próximo passo, e é por esta mesma ligação que ela vai passar.

   SÓ COM SERVIDOR
   Aberto por duplo clique (file://) não há servidor para ligar: este
   arquivo não faz nada, o indicador nem aparece, e o site funciona como
   sempre funcionou. Aberto pelo npm start (http://), liga.

   A biblioteca do Socket.IO para o navegador é entregue pelo próprio
   servidor em /socket.io/socket.io.js — por isso ela é carregada daqui,
   só quando há servidor, e não por uma tag <script> fixa no HTML (que
   daria erro no duplo clique).
   =================================================================== */

const Conexao = {

  socket: null,
  estado: 'desligado',     /* 'desligado' | 'ligando' | 'ligado' | 'caiu' */
  presentes: [],           /* [{ nome, papel }] — o Mestre primeiro */

  temServidor: function () {
    return location.protocol === 'http:' || location.protocol === 'https:';
  },

  ESPERA_NOVA_TENTATIVA: 4000,

  /* quem: { campanhaId, nome, papel } */
  ligar: function (quem) {
    if (!this.temServidor() || this.socket || this.carregando || !quem || !quem.campanhaId) return;
    const self = this;
    this.quem = quem;
    this.carregando = true;
    if (this.estado !== 'caiu') this.mudarEstado('ligando');

    /* Se a biblioteca não carregar (o servidor reiniciando bem na hora
       em que a página abriu), tenta de novo daqui a pouco — sem isso,
       a página ficaria "Sem conexão" para sempre, até alguém apertar F5.
       Depois que o socket existe, quem cuida das quedas é o Socket.IO,
       que reconecta sozinho. */
    const tentarDeNovo = function () {
      self.carregando = false;
      self.mudarEstado('caiu');
      setTimeout(function () { self.ligar(self.quem); }, self.ESPERA_NOVA_TENTATIVA);
    };

    const script = document.createElement('script');
    script.src = '/socket.io/socket.io.js';
    script.onload = function () {
      self.carregando = false;
      if (typeof io !== 'function') { tentarDeNovo(); return; }
      /* Só WebSocket — o porquê está no server.js. */
      self.socket = io({ transports: ['websocket'] });

      /* A cada (re)conexão, diz de novo quem é: depois de uma queda, o
         servidor não lembra mais desta aba. */
      self.socket.on('connect', function () {
        self.mudarEstado('ligado');
        self.socket.emit('entrar', { campanhaId: quem.campanhaId, nome: quem.nome, papel: quem.papel });
      });
      self.socket.on('disconnect', function () {
        self.presentes = [];
        self.mudarEstado('caiu');
      });
      self.socket.on('connect_error', function () { self.mudarEstado('caiu'); });

      self.socket.on('presenca', function (lista) {
        /* O que vem do servidor também é conferido antes de ir para a tela. */
        self.presentes = (Array.isArray(lista) ? lista : []).slice(0, 20).map(function (p) {
          return { nome: String(p && p.nome || '?').slice(0, 30), papel: p && p.papel === 'mestre' ? 'mestre' : 'jogador' };
        });
        self.atualizarIndicadores();
      });
    };
    script.onerror = function () { script.remove(); tentarDeNovo(); };
    document.head.appendChild(script);
  },

  mudarEstado: function (estado) {
    this.estado = estado;
    this.atualizarIndicadores();
  },


  /* ---------- O indicador da barra do topo ----------
     A barra é redesenhada várias vezes; cada desenho pede um indicador
     novo, e todos os que estiverem na página se atualizam juntos. */

  indicador: function () {
    const caixa = document.createElement('span');
    caixa.className = 'presenca-mesa';
    caixa.setAttribute('role', 'status');
    this.preencher(caixa);
    return caixa;
  },

  atualizarIndicadores: function () {
    const self = this;
    document.querySelectorAll('.presenca-mesa').forEach(function (caixa) { self.preencher(caixa); });
  },

  preencher: function (caixa) {
    /* Sem servidor (duplo clique): o indicador não tem o que mostrar. */
    caixa.hidden = !this.temServidor() || this.estado === 'desligado';
    caixa.classList.toggle('caiu', this.estado === 'caiu');
    caixa.textContent = '';

    const ponto = document.createElement('span');
    ponto.className = 'ponto-presenca';
    const texto = document.createElement('span');

    let resumo;
    if (this.estado === 'ligado') {
      const n = this.presentes.length;
      texto.textContent = n + ' na mesa';
      resumo = this.presentes.map(function (p) { return p.nome + (p.papel === 'mestre' ? ' (Mestre)' : ''); }).join(', ');
      caixa.title = 'Na mesa agora: ' + (resumo || 'só você');
      caixa.setAttribute('aria-label', n + ' na mesa: ' + (resumo || 'só você'));
    } else {
      texto.textContent = this.estado === 'ligando' ? 'Conectando…' : 'Sem conexão';
      caixa.title = this.estado === 'ligando' ? 'Conectando ao servidor da mesa' : 'Sem conexão com o servidor — tentando de novo';
      caixa.setAttribute('aria-label', caixa.title);
    }
    caixa.appendChild(ponto);
    caixa.appendChild(texto);
  }
};
