/* ===================================================================
   chat.js — o chat da mesa, nos dois painéis

   Uma peça só, usada em dois lugares:
     painel do jogador   a aba "Chat" (jogador.js)
     painel do Mestre    um painel que abre pela barra do topo, em
                         qualquer tela (layout.js)

   AS CONVERSAS (canais)
     Mesa      todos: o Mestre e os jogadores
     Equipe    só os jogadores (o Mestre não vê)
     Privado   cada jogador com o Mestre; o Mestre tem uma por jogador

   Quem pode ler e escrever onde NÃO é decidido aqui: está no visao.js
   (mensagensDoJogador, enviarMensagem) — o desenho do servidor. Esta
   tela só desenha o que pode ver e manda pelo que pode mandar.

   SEM SERVIDOR
   As mensagens vão para a campanha no localStorage, e as outras abas
   do MESMO navegador ficam sabendo pelo evento 'storage' (dados.js).
   Dá para conversar entre as abas do Mestre e dos jogadores num
   computador só; entre computadores, só com o servidor (Socket.IO).

   O QUE JÁ FOI LIDO
   Fica no sessionStorage desta aba: até quando cada conversa foi lida.
   É coisa de quem está olhando, não da campanha — por isso não vai
   para o Estado.
   =================================================================== */

const Chat = {

  canal: 'mesa',          /* a conversa aberta agora */
  painel: null,           /* o painel do Mestre, quando aberto */
  aoMudarLidas: null,     /* a tela põe aqui o que fazer quando o "não lidas" muda */


  /* ---------- Quem está olhando ---------- */

  sessao: function () {
    return Sessao.ler();
  },

  ehMestre: function () {
    const s = this.sessao();
    return !!(s && s.papel === 'mestre');
  },


  /* As mensagens que esta pessoa pode ler. Do jogador, só o que a
     visão libera; do Mestre, tudo menos a conversa da equipe. */
  mensagens: function () {
    const s = this.sessao();
    if (!s) return [];
    if (s.papel === 'jogador') return mensagensDoJogador(Estado, s.jogadorId);

    return (Estado.mensagens || [])
      .filter(function (m) { return m.canal !== 'equipe'; })
      .map(function (m) {
        return {
          id: m.id, canal: m.canal, texto: m.texto, quando: m.quando,
          autor: { papel: m.autor.papel, nome: m.autor.nome, personagem: m.autor.personagem || '', eu: m.autor.papel === 'mestre' }
        };
      });
  },


  /* As conversas que esta pessoa tem: [id, rótulo]. */
  canais: function () {
    const s = this.sessao();
    if (!s) return [];
    if (s.papel === 'jogador') {
      return [['mesa', 'Mesa'], ['equipe', 'Equipe'], [canalPrivado(s.jogadorId), 'Mestre (privado)']];
    }
    /* O Mestre: a mesa e uma conversa por jogador que já tem personagem. */
    const privados = (Estado.herois || []).filter(function (h) { return h.dono; }).map(function (h) {
      return [canalPrivado(h.dono), h.nome + (h.jogador ? ' (' + h.jogador + ')' : '')];
    });
    return [['mesa', 'Mesa']].concat(privados);
  },


  /* ---------- Lidas e não lidas ---------- */

  chaveLidas: function () {
    const s = this.sessao();
    return 'plainus:chat-lido:' + (s ? s.campanhaId : '');
  },

  lidas: function () {
    try { return JSON.parse(sessionStorage.getItem(this.chaveLidas())) || {}; } catch (erro) { return {}; }
  },

  marcarLido: function (canal) {
    const lidas = this.lidas();
    const ultima = this.mensagens().filter(function (m) { return m.canal === canal; }).pop();
    lidas[canal] = ultima ? ultima.quando : Date.now();
    try { sessionStorage.setItem(this.chaveLidas(), JSON.stringify(lidas)); } catch (erro) { /* tanto faz */ }
  },

  /* Quantas mensagens dos OUTROS chegaram depois da última leitura —
     de uma conversa, ou de todas (canal omitido). */
  naoLidas: function (canal) {
    const lidas = this.lidas();
    return this.mensagens().filter(function (m) {
      if (canal && m.canal !== canal) return false;
      return !m.autor.eu && m.quando > (lidas[m.canal] || 0);
    }).length;
  },


  /* ===================================================================
     O DESENHO
     =================================================================== */

  /* Monta o chat inteiro dentro de `area`. Só a LISTA se redesenha
     quando chega mensagem; o campo de texto fica — senão quem está
     digitando perderia a frase no meio. */
  montar: function (area) {
    const canais = this.canais();
    if (!canais.some(function (c) { return c[0] === this.canal; }, this)) this.canal = 'mesa';

    const abas = criar('div.chat-canais');
    abas.id = 'chatCanais';

    const lista = criar('div.chat-lista');
    lista.id = 'chatLista';
    lista.setAttribute('role', 'log');            /* o leitor de tela anuncia o que chega */
    lista.setAttribute('aria-live', 'polite');

    const campo = document.createElement('textarea');
    campo.id = 'chatTexto';
    campo.rows = 2;
    campo.maxLength = LIMITE_TEXTO_MENSAGEM;
    campo.placeholder = 'Escreva e aperte Enter (Shift+Enter quebra a linha)';
    campo.setAttribute('aria-label', 'Mensagem');

    const enviar = criarBotao('botao.pequeno', 'chat-enviar', 'passo', 'Enviar');

    area.appendChild(criar('div.chat', [
      abas,
      lista,
      criar('div.chat-escrever', [campo, enviar])
    ]));

    this.desenharCanais();
    this.desenharLista();
  },


  desenharCanais: function () {
    const self = this;
    const area = document.getElementById('chatCanais');
    if (!area) return;
    area.textContent = '';

    this.canais().forEach(function (par) {
      const ativo = par[0] === self.canal;
      const botao = criar('button.filtro' + (ativo ? '.ativo' : ''), par[1]);
      botao.type = 'button';
      botao.dataset.acao = 'chat-canal';
      botao.dataset.canal = par[0];
      if (ativo) botao.setAttribute('aria-current', 'true');

      const novas = ativo ? 0 : self.naoLidas(par[0]);
      if (novas) botao.appendChild(criar('span.pilula.azul', String(novas)));
      area.appendChild(botao);
    });
  },


  desenharLista: function () {
    const lista = document.getElementById('chatLista');
    if (!lista) return;

    const canal = this.canal;
    const mensagens = this.mensagens().filter(function (m) { return m.canal === canal; });

    /* Se a pessoa tinha rolado para cima para reler, não puxamos a
       lista para o fim — só quando ela já estava lá embaixo. */
    const noFim = lista.scrollHeight - lista.scrollTop - lista.clientHeight < 40;

    lista.textContent = '';
    if (!mensagens.length) {
      lista.appendChild(criar('p.dica', this.textoVazio(canal)));
    }

    mensagens.forEach(function (m) {
      const quem = m.autor.papel === 'mestre'
        ? 'Mestre' + (m.autor.nome ? ' · ' + m.autor.nome : '')
        : (m.autor.personagem ? m.autor.personagem + ' (' + m.autor.nome + ')' : m.autor.nome);

      const hora = new Date(m.quando).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      lista.appendChild(criar('div.mensagem' + (m.autor.eu ? '.minha' : '') + (m.autor.papel === 'mestre' ? '.do-mestre' : ''), [
        criar('div.cabeca-mensagem', [criar('span.quem', quem), criar('span.hora', hora)]),
        /* textContent: o que um jogador escreveu nunca vira HTML. */
        criar('div.texto-mensagem', m.texto)
      ]));
    });

    if (noFim || !this.jaDesenhou) lista.scrollTop = lista.scrollHeight;
    this.jaDesenhou = true;

    /* Estando à vista, a conversa aberta conta como lida. */
    if (this.estaVisivel()) {
      this.marcarLido(canal);
      if (typeof this.aoMudarLidas === 'function') this.aoMudarLidas();
    }
  },

  textoVazio: function (canal) {
    if (canal === 'mesa') return 'Ninguém falou na mesa ainda.';
    if (canal === 'equipe') return 'A conversa da equipe é só dos jogadores — o Mestre não a vê.';
    return this.ehMestre()
      ? 'Conversa privada com este jogador. Só vocês dois veem.'
      : 'Conversa privada com o Mestre. Só vocês dois veem.';
  },

  /* O chat está montado e aparecendo? */
  estaVisivel: function () {
    const lista = document.getElementById('chatLista');
    return !!(lista && lista.offsetParent !== null);
  },


  /* ---------- Ações ---------- */

  enviar: function () {
    const campo = document.getElementById('chatTexto');
    if (!campo) return;

    const problema = enviarMensagem(this.sessao(), this.canal, campo.value);
    if (problema) {
      Layout.recado(problema, true);
      return;
    }

    campo.value = '';
    campo.focus();
    this.jaDesenhou = false;          /* a mensagem nova: rola até o fim */
    this.desenharLista();
    this.desenharCanais();
  },

  trocarCanal: function (canal) {
    this.canal = canal;
    this.jaDesenhou = false;
    this.desenharCanais();
    this.desenharLista();
    const campo = document.getElementById('chatTexto');
    if (campo) campo.focus();
  },


  /* ===================================================================
     O PAINEL DO MESTRE
     Mora no <body>, e não na barra do topo, pelo mesmo motivo do painel
     de avisos: a barra é redesenhada inteira quando a sessão ou o som
     mudam, e o painel sumiria no meio da conversa.
     =================================================================== */

  alternarPainel: function () {
    if (this.painel) { this.fecharPainel(); return; }

    this.painel = criar('div.painel-chat');
    this.painel.setAttribute('role', 'dialog');
    this.painel.setAttribute('aria-label', 'Chat da mesa');

    const fechar = criarBotao('icone-botao', 'chat-fechar', 'remover', '');
    fechar.setAttribute('aria-label', 'Fechar o chat');

    this.painel.appendChild(criar('div.cabeca-painel-chat', [criarComIcone('span.titulo', 'chat', 'Chat da mesa', 15), fechar]));
    document.body.appendChild(this.painel);

    this.jaDesenhou = false;
    this.montar(this.painel);
    document.getElementById('chatTexto').focus();
  },

  fecharPainel: function () {
    if (!this.painel) return;
    this.painel.remove();
    this.painel = null;
    if (typeof this.aoMudarLidas === 'function') this.aoMudarLidas();
  },


  /* ===================================================================
     OS EVENTOS — ligados uma vez, no document, para servir aos dois
     painéis (o do Mestre nasce e morre; a aba do jogador é redesenhada)
     =================================================================== */

  ligar: function () {
    const self = this;
    if (this.ligado) return;
    this.ligado = true;

    document.addEventListener('click', function (evento) {
      const alvo = evento.target.closest('[data-acao]');
      if (!alvo) return;
      if (alvo.dataset.acao === 'chat-enviar') self.enviar();
      if (alvo.dataset.acao === 'chat-canal') self.trocarCanal(alvo.dataset.canal);
      if (alvo.dataset.acao === 'chat-fechar') self.fecharPainel();
    });

    /* Enter envia; Shift+Enter quebra a linha. */
    document.addEventListener('keydown', function (evento) {
      if (evento.target.id === 'chatTexto' && evento.key === 'Enter' && !evento.shiftKey) {
        evento.preventDefault();
        self.enviar();
      }
      if (evento.key === 'Escape' && self.painel) self.fecharPainel();
    });

    /* Chegou mensagem de outra aba (o dados.js já recarregou o Estado):
       só a lista e as conversas se redesenham — o campo, nunca. */
    document.addEventListener('plainus:externo', function () {
      self.desenharLista();
      self.desenharCanais();
      if (typeof self.aoMudarLidas === 'function') self.aoMudarLidas();
    });
  }
};
