/* ===================================================================
   conexao.js — a ligação com a mesa (Socket.IO)

   Cada painel (do Mestre ou de um jogador) abre UMA conexão com o
   servidor e a mantém enquanto está aberto. Por ela:

     ENTRAR     com a chave da sessão (campanhas.js). Sem chave que
                abra a mesa, o painel não abre.
     RECEBER    a mesa: o Mestre recebe a campanha inteira (que vira o
                Estado desta página); o jogador recebe só a VISÃO dele
                (Conexao.visao). A cada mudança de qualquer um, chega de
                novo — e a página se redesenha ('plainus:externo').
     MANDAR     as ações: as do Mestre (acoes.js, com a semente) e as do
                jogador (visao.js). O servidor confere, aplica, grava e
                espalha.

   O ECO
   O Mestre aplica a própria ação na tela na hora (para não esperar a
   rede) e o servidor devolve a campanha com ela. Se o que chegou é
   igual ao que a tela já tem, nada é redesenhado.

   TIRADO DA MESA
   O Mestre liberou o seu lugar, desconectou os outros computadores
   dele, ou apagou a campanha: o servidor manda 'fora' com o motivo e
   desconecta. A chave não vale mais — sai deste navegador — e o painel
   dá lugar ao aviso.

   CAIU A CONEXÃO
   O indicador fica vermelho ("Sem conexão") e o Socket.IO reconecta
   sozinho. As ações feitas nesse meio-tempo esperam numa fila e seguem
   quando a mesa reabrir. Uma ação que não for confirmada em 10 s vira
   um aviso — a tela volta a mostrar o que o servidor tem.
   =================================================================== */

const Conexao = {

  socket: null,
  estado: 'desligado',      /* 'desligado' | 'ligando' | 'ligado' | 'caiu' */
  presentes: [],            /* [{ nome, papel }] — o Mestre primeiro */
  sessao: null,
  entrou: false,            /* a chave já abriu a mesa nesta conexão */
  visao: null,              /* jogador: o que ele vê */
  textoDoServidor: null,    /* Mestre: a última campanha que veio do servidor, em texto */
  fila: [],                 /* ações esperando a mesa abrir */
  pendentes: 0,             /* ações mandadas e ainda sem confirmação */
  atrasada: false,          /* Mestre: chegou campanha com ação ainda a caminho (receber) */
  primeira: null,           /* { resolver, recusar } da abertura */

  ESPERA_NOVA_TENTATIVA: 4000,
  LIMITE_CONFIRMACAO: 10000,

  temServidor: function () {
    return location.protocol === 'http:' || location.protocol === 'https:';
  },


  /* ---------- Abrir a mesa ----------
     Devolve uma Promise que se cumpre quando a mesa chega pela primeira
     vez (o Estado ou a visão já prontos), ou é recusada com o texto do
     problema (chave que não abre, servidor fora do ar). */
  abrir: function (sessao) {
    const self = this;
    return new Promise(function (resolver, recusar) {
      if (!self.temServidor()) {
        recusar('Esta mesa agora roda pelo servidor. Na pasta minha-mesa, rode npm start e abra http://localhost:3000.');
        return;
      }
      self.sessao = sessao;
      self.primeira = { resolver: resolver, recusar: recusar };
      self.carregarBiblioteca();
    });
  },

  /* A biblioteca do navegador é entregue pelo próprio servidor. Se não
     carregar (o servidor reiniciando bem na hora), tenta de novo. */
  carregarBiblioteca: function () {
    const self = this;
    if (this.estado !== 'caiu') this.mudarEstado('ligando');
    if (typeof io === 'function') { this.criarSocket(); return; }

    const script = document.createElement('script');
    script.src = '/socket.io/socket.io.js';
    script.onload = function () { self.criarSocket(); };
    script.onerror = function () {
      script.remove();
      self.mudarEstado('caiu');
      setTimeout(function () { self.carregarBiblioteca(); }, self.ESPERA_NOVA_TENTATIVA);
    };
    document.head.appendChild(script);
  },

  criarSocket: function () {
    const self = this;
    if (this.socket) return;
    /* Só WebSocket — o porquê está no servidor/mesa.js. */
    this.socket = io({ transports: ['websocket'] });

    /* A cada (re)conexão, a chave de novo: depois de uma queda, o
       servidor não lembra mais desta aba. */
    this.socket.on('connect', function () {
      const s = self.sessao;
      self.socket.emit('entrar', { campanhaId: s.campanhaId, papel: s.papel, jogadorId: s.jogadorId, chave: s.chave }, function (resposta) {
        if (!resposta || resposta.erro) {
          /* Chave que não abre: não adianta tentar de novo — e a
             campanha guardada nesta aba não vale mais. */
          self.esquecerCampanha();
          self.socket.io.reconnection(false);
          self.socket.disconnect();
          self.mudarEstado('caiu');
          const texto = (resposta && resposta.erro) || 'O servidor não abriu a mesa.';
          if (self.primeira) { self.primeira.recusar(texto); self.primeira = null; }
          else self.avisar(texto);
          return;
        }
        self.entrou = true;
        self.mudarEstado('ligado');
        const esperando = self.fila;
        self.fila = [];
        esperando.forEach(function (f) { self.mandar(f); });
      });
    });

    this.socket.on('disconnect', function () {
      self.entrou = false;
      self.presentes = [];
      self.mudarEstado('caiu');
    });
    this.socket.on('connect_error', function () { self.mudarEstado('caiu'); });

    this.socket.on('mesa', function (pacote) { self.receber(pacote); });
    this.socket.on('fora', function (pacote) { self.foraDaMesa(pacote && pacote.motivo); });

    this.socket.on('presenca', function (lista) {
      /* O que vem do servidor também é conferido antes de ir para a tela. */
      self.presentes = (Array.isArray(lista) ? lista : []).slice(0, 20).map(function (p) {
        return { nome: String(p && p.nome || '?').slice(0, 30), papel: p && p.papel === 'mestre' ? 'mestre' : 'jogador' };
      });
      self.atualizarIndicadores();
    });
  },


  /* ---------- Receber a mesa ---------- */

  receber: function (pacote) {
    if (!pacote || typeof pacote !== 'object') return;
    let mudou = true;

    if (pacote.papel === 'mestre' && pacote.estado && typeof pacote.estado === 'object') {
      const texto = JSON.stringify(pacote.estado);
      this.textoDoServidor = texto;
      this.guardarCampanha(texto);
      /* Ainda há ação do Mestre a caminho: a tela já mostra ela, e a
         campanha que chegou agora ainda NÃO (o servidor a aplica depois).
         Trocar a tela agora faria a mudança sumir por um instante e
         voltar — o "pisca" de quem pinta parede. Fica guardada; quando
         a última confirmação chegar (enviar, abaixo), a tela passa a
         ser a do servidor. A primeira chegada não espera. */
      if (this.pendentes > 0 && !this.primeira) { this.atrasada = true; return; }
      this.atrasada = false;
      /* O eco da própria ação: igual ao que a tela já tem, nada a fazer. */
      if (texto === JSON.stringify(Estado)) mudou = false;
      else Memoria.substituir(pacote.estado);
    } else if (pacote.papel === 'jogador' && pacote.visao && typeof pacote.visao === 'object') {
      this.visao = pacote.visao;
    } else {
      return;
    }

    if (this.primeira) {
      /* A primeira chegada abre a página; as próximas a redesenham. */
      this.primeira.resolver(pacote.papel);
      this.primeira = null;
      return;
    }
    if (mudou) {
      document.dispatchEvent(new CustomEvent('plainus:externo'));
      document.dispatchEvent(new CustomEvent('plainus:mudou'));
    }
  },

  /* ---------- A última campanha, guardada NESTA aba ----------
     Cada tela do Mestre é uma página: trocar de tela é abrir outra
     página, reconectar e esperar a campanha chegar ("Abrindo a mesa…").
     Guardando a última campanha que chegou, a tela seguinte já se
     desenha com ela, na hora, e se atualiza quando a oficial chega
     (layout.js, iniciar) — milissegundos depois.
     Só no painel do Mestre (o jogador nunca recebe a campanha inteira).
     sessionStorage: é desta aba só, e some quando ela fecha. Cheio ou
     bloqueado, tudo segue como antes (com o "Abrindo"). */
  CHAVE_CAMPANHA: 'plainus:ultima-campanha',

  guardarCampanha: function (texto) {
    const s = this.sessao;
    if (!s || s.papel !== 'mestre') return;
    try { sessionStorage.setItem(this.CHAVE_CAMPANHA, JSON.stringify({ campanhaId: s.campanhaId, texto: texto })); } catch (erro) { /* sem espaço: fica sem atalho */ }
  },

  /* A campanha guardada, se for desta sessão (desta campanha, como Mestre). */
  campanhaGuardada: function (sessao) {
    if (!sessao || sessao.papel !== 'mestre') return null;
    try {
      const guardada = JSON.parse(sessionStorage.getItem(this.CHAVE_CAMPANHA));
      if (!guardada || guardada.campanhaId !== sessao.campanhaId || typeof guardada.texto !== 'string') return null;
      const estado = JSON.parse(guardada.texto);
      return estado && typeof estado === 'object' ? estado : null;
    } catch (erro) {
      return null;
    }
  },

  esquecerCampanha: function () {
    try { sessionStorage.removeItem(this.CHAVE_CAMPANHA); } catch (erro) { /* nada a fazer */ }
  },

  foraDaMesa: function (motivo) {
    const texto = String(motivo || 'O seu acesso a esta mesa não vale mais.').slice(0, 300);
    this.esquecerCampanha();
    if (this.socket) this.socket.io.reconnection(false);
    const s = this.sessao;
    if (s) Acessos.esquecer(s.campanhaId, s.papel, s.jogadorId);
    Sessao.limpar();
    this.fila = [];
    this.pendentes = 0;
    if (this.primeira) { this.primeira.recusar(texto); this.primeira = null; return; }
    /* O que estiver pela metade não tem mais para onde ir: sair sem perguntar. */
    if (typeof AvisoSaida !== 'undefined') AvisoSaida.liberar();
    const app = document.getElementById('app');
    if (app) app.hidden = true;
    if (document.querySelector('.tela-restrita')) return;
    if (typeof Jogador !== 'undefined' && Jogador.mostrarRestrito) Jogador.mostrarRestrito(texto);
    else if (typeof Layout !== 'undefined' && Layout.mostrarRestrito) Layout.mostrarRestrito(null, texto);
  },

  /* A campanha oficial (a última que veio do servidor), de volta para a
     tela — quando uma mudança local não vingou. */
  voltarAoServidor: function () {
    if (!this.textoDoServidor) return;
    Memoria.substituir(JSON.parse(this.textoDoServidor));
    document.dispatchEvent(new CustomEvent('plainus:externo'));
    document.dispatchEvent(new CustomEvent('plainus:mudou'));
  },


  /* ---------- Mandar ações ---------- */

  /* Uma ação do Mestre (acoes.js), já aplicada na tela com esta semente. */
  acao: function (nome, dados, semente) {
    return this.enviar({ evento: 'acao', pedido: { nome: nome, dados: dados, semente: semente } });
  },

  /* Uma ação do jogador (visao.js) — ou a mensagem do Mestre no chat. */
  acaoJogador: function (nome, dados) {
    return this.enviar({ evento: 'acaoJogador', pedido: { nome: nome, dados: dados } });
  },

  /* O jogador troca o próprio nome (Perfil, jogador.js). Não é uma ação
     da campanha: o nome mora também nos acessos do servidor. */
  mudarMeuNome: function (nome) {
    return this.enviar({ evento: 'mudarMeuNome', pedido: { nome: nome } });
  },

  /* Devolve uma Promise com a resposta do servidor ({ resultado } ou
     { erro }). Erros já viram aviso na tela; quem chamou só precisa
     olhar a resposta se quiser fazer algo a mais. */
  enviar: function (envio) {
    const self = this;
    this.pendentes += 1;
    return new Promise(function (resolver) {
      envio.resolver = function (resposta) {
        self.pendentes -= 1;
        /* A última a caminho foi confirmada (ou recusada): a campanha do
           servidor que ficou esperando entra na tela agora. */
        if (!self.pendentes && self.atrasada) {
          self.atrasada = false;
          self.receber({ papel: 'mestre', estado: JSON.parse(self.textoDoServidor) });
        }
        if (resposta && resposta.erro) self.avisar(resposta.erro);
        resolver(resposta || { erro: 'Sem resposta do servidor.' });
      };
      if (self.entrou && self.socket && self.socket.connected) self.mandar(envio);
      else self.fila.push(envio);
    });
  },

  mandar: function (envio) {
    const self = this;
    this.socket.timeout(this.LIMITE_CONFIRMACAO).emit(envio.evento, envio.pedido, function (erroDeTempo, resposta) {
      if (erroDeTempo) {
        envio.resolver({ erro: 'O servidor não confirmou uma mudança. A tela volta a mostrar o que ele tem.' });
        self.voltarAoServidor();
        return;
      }
      envio.resolver(resposta);
    });
  },

  avisar: function (texto) {
    if (typeof Layout !== 'undefined' && Layout.recado) Layout.recado(texto, true);
  },


  /* ---------- O indicador da barra do topo ----------
     A barra é redesenhada várias vezes; cada desenho pede um indicador
     novo, e todos os que estiverem na página se atualizam juntos. */

  mudarEstado: function (estado) {
    this.estado = estado;
    this.atualizarIndicadores();
  },

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
    caixa.hidden = !this.temServidor() || this.estado === 'desligado';
    caixa.classList.toggle('caiu', this.estado === 'caiu');
    caixa.textContent = '';

    const ponto = document.createElement('span');
    ponto.className = 'ponto-presenca';
    const texto = document.createElement('span');

    if (this.estado === 'ligado') {
      const n = this.presentes.length;
      const resumo = this.presentes.map(function (p) { return p.nome + (p.papel === 'mestre' ? ' (Mestre)' : ''); }).join(', ');
      texto.textContent = n + ' na mesa';
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

/* Fechar a aba com uma mudança ainda a caminho do servidor (na fila, ou
   mandada e sem confirmação) a perderia: o navegador pergunta antes. */
if (typeof AvisoSaida !== 'undefined') {
  AvisoSaida.registrar(function () { return Conexao.fila.length > 0 || Conexao.pendentes > 0; });
}
