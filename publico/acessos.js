/* ===================================================================
   acessos.js — a página "Acessos da mesa" (acessos.html)

   Tudo aqui é pergunta HTTP ao servidor (servidor/api.js), sempre com
   a chave de Mestre desta aba (a sessão, em campanhas.js). O servidor
   confere a chave em cada pedido: esta página só mostra os botões —
   quem decide se pode é ele.

   AS AÇÕES QUE NÃO TÊM VOLTA PEDEM CONFIRMAÇÃO
   Liberar um jogador e desconectar os outros computadores pedem um
   segundo clique ("Confirmar: …") nos 6 segundos seguintes. Apagar
   pede a senha do Mestre (ou, sem senha, o nome da campanha digitado).
   =================================================================== */

const PaginaAcessos = {

  sessao: null,
  dados: null,          /* a última resposta de /api/acessos */
  armado: null,         /* o botão que está esperando o segundo clique */

  iniciar: function () {
    const sessao = Sessao.ler();
    if (!sessao || sessao.papel !== 'mestre') {
      this.semAcesso('Esta página é do Mestre. Entre pela sua mesa em "Suas mesas", na entrada.');
      return;
    }
    this.sessao = sessao;
    this.ligar();
    this.carregar();
  },

  semAcesso: function (texto) {
    document.getElementById('nomeMesa').textContent = '';
    document.getElementById('conteudo').hidden = true;
    const aviso = document.getElementById('semAcesso');
    aviso.textContent = texto;
    aviso.hidden = false;
    const voltar = document.getElementById('linkVoltar');
    voltar.textContent = 'Ir para a entrada';
    voltar.href = 'index.html';
  },

  carregar: function () {
    const self = this;
    return Servidor.pedir('acessos', this.pedido()).then(function (r) {
      if (r.erro) { self.semAcesso(r.erro); return; }
      self.dados = r;
      self.desenhar();
    });
  },

  /* O corpo de todo pedido: qual mesa, e a chave que prova o Mestre. */
  pedido: function (extra) {
    return Object.assign({ campanhaId: this.sessao.campanhaId, chave: this.sessao.chave }, extra || {});
  },


  /* ---------- Desenhar ---------- */

  desenhar: function () {
    const d = this.dados;
    document.getElementById('nomeMesa').textContent = d.nome;
    document.getElementById('conteudo').hidden = false;

    const lista = document.getElementById('listaJogadores');
    lista.textContent = '';
    if (!d.jogadores.length) {
      lista.appendChild(this.el('li', 'vazio-acessos', 'Ninguém entrou com o código ainda.'));
    }
    d.jogadores.forEach(function (j) {
      const item = PaginaAcessos.el('li', 'item-acesso');
      const quem = PaginaAcessos.el('span', 'quem-acesso');
      quem.appendChild(PaginaAcessos.el('strong', '', j.nome));
      quem.appendChild(PaginaAcessos.el('span', 'sub-acesso', j.personagem ? 'joga com ' + j.personagem : 'ainda sem personagem'));
      item.appendChild(quem);
      const botao = PaginaAcessos.el('button', 'mini-botao', 'Liberar');
      botao.type = 'button';
      botao.dataset.jogador = j.jogadorId;
      botao.dataset.nome = j.nome;
      botao.setAttribute('aria-label', 'Liberar o lugar de ' + j.nome);
      item.appendChild(botao);
      lista.appendChild(item);
    });

    const n = d.computadoresDoMestre;
    document.getElementById('textoComputadores').textContent = n <= 1
      ? 'Só este computador abre o painel do Mestre.'
      : n + ' computadores abrem o painel do Mestre (este e mais ' + (n - 1) + '). Perdeu um deles, ou acha que a senha vazou? Desconecte os outros — e troque a senha em "Editar campanha".';
    document.getElementById('btnSairOutros').hidden = n <= 1;

    /* Apagar: a senha confirma; sem senha, o nome da campanha. */
    document.getElementById('campoSenhaApagar').hidden = !d.temSenha;
    document.getElementById('campoNomeApagar').hidden = d.temSenha;
    document.getElementById('rotuloNomeApagar').textContent = 'Para confirmar, digite o nome da campanha: ' + d.nome;
  },

  el: function (tag, classe, texto) {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto !== undefined) e.textContent = texto;
    return e;
  },


  /* ---------- O segundo clique ---------- */

  /* Devolve true se este clique é a CONFIRMAÇÃO; senão arma o botão. */
  confirmado: function (botao, textoConfirmar) {
    if (this.armado === botao) {
      this.desarmar();
      return true;
    }
    this.desarmar();
    this.armado = botao;
    botao.dataset.textoOriginal = botao.textContent;
    botao.textContent = textoConfirmar;
    botao.classList.add('armado');
    this.relogio = setTimeout(function () { PaginaAcessos.desarmar(); }, 6000);
    return false;
  },

  desarmar: function () {
    clearTimeout(this.relogio);
    const b = this.armado;
    if (b && b.dataset.textoOriginal) { b.textContent = b.dataset.textoOriginal; b.classList.remove('armado'); }
    this.armado = null;
  },


  /* ---------- As ações ---------- */

  liberar: function (botao) {
    const self = this;
    if (!this.confirmado(botao, 'Confirmar: liberar ' + botao.dataset.nome)) return;
    this.limparMensagens();
    Servidor.pedir('liberar', this.pedido({ jogadorId: botao.dataset.jogador })).then(function (r) {
      if (r.erro) { self.mostrarErro(r.erro); return; }
      self.mostrarAviso('Lugar de ' + r.nome + ' liberado. Para voltar, ' + r.nome + ' entra pela entrada com o código e o mesmo nome.');
      self.carregar();
    });
  },

  sairDosOutros: function (botao) {
    const self = this;
    if (!this.confirmado(botao, 'Confirmar: só este computador fica')) return;
    this.limparMensagens();
    Servidor.pedir('sair-dos-outros', this.pedido()).then(function (r) {
      if (r.erro) { self.mostrarErro(r.erro); return; }
      self.mostrarAviso(r.sairam === 1 ? '1 computador desconectado.' : r.sairam + ' computadores desconectados.');
      self.carregar();
    });
  },

  baixarBackup: function () {
    const self = this;
    this.limparMensagens();
    Backup.baixar(this.sessao).then(function (r) {
      if (r.erro) self.mostrarErro(r.erro);
      else self.mostrarAviso('Backup baixado. Guarde o arquivo fora deste computador.');
    });
  },

  apagar: function () {
    const self = this;
    this.limparMensagens();
    const comSenha = this.dados.temSenha;
    const campo = document.getElementById(comSenha ? 'senhaApagar' : 'nomeApagar');
    if (!campo.value.trim()) {
      this.mostrarErro(comSenha ? 'Digite a senha do Mestre para apagar.' : 'Digite o nome da campanha para apagar.');
      campo.focus();
      return;
    }
    const botao = document.getElementById('btnApagar');
    botao.disabled = true;
    Servidor.pedir('apagar', this.pedido(comSenha ? { senha: campo.value } : { confirmacao: campo.value })).then(function (r) {
      botao.disabled = false;
      if (r.erro) { if (comSenha) campo.value = ''; self.mostrarErro(r.erro); campo.focus(); return; }
      /* Apagada: a chave desta mesa não serve mais para nada. */
      Acessos.esquecer(self.sessao.campanhaId, 'mestre', null);
      Sessao.limpar();
      self.semAcesso('A campanha "' + self.dados.nome + '" foi apagada. Quem estava na mesa foi avisado.');
    });
  },


  /* ---------- Mensagens ---------- */

  mostrarErro: function (texto) { document.getElementById('erro').textContent = texto; },
  mostrarAviso: function (texto) { document.getElementById('aviso').textContent = texto; },
  limparMensagens: function () { this.mostrarErro(''); this.mostrarAviso(''); },


  /* ---------- Eventos ---------- */

  ligar: function () {
    const self = this;
    /* Um clique só na lista: cada botão diz QUEM pelo data-jogador
       (nunca um onclick com o nome dentro — problema 5 do CLAUDE.md). */
    document.getElementById('listaJogadores').addEventListener('click', function (evento) {
      const botao = evento.target.closest('button[data-jogador]');
      if (botao) self.liberar(botao);
    });
    document.getElementById('btnSairOutros').addEventListener('click', function (evento) { self.sairDosOutros(evento.currentTarget); });
    document.getElementById('btnBackup').addEventListener('click', function () { self.baixarBackup(); });
    document.getElementById('btnApagar').addEventListener('click', function () { self.apagar(); });
    ['senhaApagar', 'nomeApagar'].forEach(function (id) {
      document.getElementById(id).addEventListener('keydown', function (evento) {
        if (evento.key === 'Enter') self.apagar();
      });
    });
  }
};

PaginaAcessos.iniciar();
