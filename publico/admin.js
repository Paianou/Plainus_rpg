/* ===================================================================
   admin.js — a página Administração (admin.html)

   Tudo aqui é pergunta HTTP ao servidor (servidor/api.js): /api/conta
   para criar o administrador, entrar e sair; /api/admin para convites e
   contas, sempre com a sessão da conta deste navegador (ContaLocal, em
   campanhas.js). O servidor confere a sessão — e se ela é de
   administrador — em cada pedido.

   O CÓDIGO DE UM CONVITE APARECE UMA VEZ
   O servidor guarda só o resumo do código: depois de gerado, ele não tem
   como mostrar de novo. Por isso a página o mostra grande, com "Copiar",
   e a lista mostra só a situação de cada convite.

   O QUE NÃO TEM VOLTA PEDE O SEGUNDO CLIQUE
   Revogar um convite e desativar uma conta: "Confirmar: …" nos 6
   segundos seguintes — o mesmo jeito da página de Acessos.
   =================================================================== */

const PaginaAdmin = {

  armado: null,

  iniciar: function () {
    this.ligar();
    this.decidir();
  },

  /* Qual dos três estados: criar o administrador, entrar, ou o painel. */
  decidir: function () {
    const self = this;
    const conta = ContaLocal.ler();
    if (conta) {
      Servidor.conta('eu', { contaId: conta.contaId, chave: conta.chave }).then(function (r) {
        /* Só "esta sessão não vale mais" (401) desloga. Sem conexão, ou
           servidor ocupado, a sessão continua: é só tentar de novo. */
        if (r.status === 401) { ContaLocal.limpar(); self.decidir(); return; }
        if (r.erro || !r.conta) { self.mostrar(null); self.subtitulo(''); self.mostrarErro(r.erro || 'O servidor não respondeu.'); return; }
        if (!r.conta.admin) { self.mostrar(null); self.subtitulo('Esta página é do administrador do site. Você entrou como ' + r.conta.usuario + '.'); return; }
        self.mostrar('blocoPainel');
        self.subtitulo('Entrou como ' + r.conta.usuario + '.');
        document.getElementById('textoSessao').textContent = 'Este computador está conectado como ' + r.conta.usuario + ' (administrador).';
        self.carregar();
      });
      return;
    }
    Servidor.conta('estado').then(function (r) {
      if (r.erro) { self.mostrar(null); self.mostrarErro(r.erro); self.subtitulo(''); return; }
      if (r.temAdmin) {
        self.mostrar('blocoEntrar');
        self.subtitulo('Entre com a conta de administrador.');
        document.getElementById('entrarUsuario').focus();
      } else if (r.local) {
        self.mostrar('blocoCriarAdmin');
        self.subtitulo('O site ainda não tem administrador.');
        document.getElementById('adminUsuario').focus();
      } else {
        self.mostrar(null);
        self.subtitulo('O site ainda não tem administrador.');
        self.mostrarAviso('A conta de administrador se cria no computador onde o servidor está rodando: lá, abra http://localhost:3000/admin.html.');
      }
    });
  },

  mostrar: function (qual) {
    ['blocoCriarAdmin', 'blocoEntrar', 'blocoPainel'].forEach(function (id) {
      document.getElementById(id).hidden = id !== qual;
    });
  },

  subtitulo: function (texto) { document.getElementById('subtitulo').textContent = texto; },


  /* ---------- Criar o administrador / entrar / sair ---------- */

  /* Depois de criar a conta ou entrar: a sessão fica neste navegador. */
  guardarSessao: function (r) {
    ContaLocal.gravar({ contaId: r.contaId, chave: r.chave, usuario: r.usuario, admin: r.admin });
  },

  criarAdmin: function () {
    const self = this;
    this.limparMensagens();
    const usuario = document.getElementById('adminUsuario');
    const senha = document.getElementById('adminSenha');
    const senha2 = document.getElementById('adminSenha2');
    if (!usuario.value.trim()) { this.mostrarErro('Escolha um usuário.'); usuario.focus(); return; }
    if (senha.value !== senha2.value) { this.mostrarErro('As duas senhas não são iguais.'); senha2.select(); return; }
    const botao = document.querySelector('#blocoCriarAdmin button[type="submit"]');
    botao.disabled = true;
    Servidor.conta('admin', { usuario: usuario.value, senha: senha.value }).then(function (r) {
      botao.disabled = false;
      if (r.erro) { self.mostrarErro(r.erro); return; }
      self.guardarSessao(r);
      self.mostrarAviso('Conta de administrador criada. Agora você gera os convites dos outros Mestres aqui.');
      self.decidir();
    });
  },

  entrar: function () {
    const self = this;
    this.limparMensagens();
    const usuario = document.getElementById('entrarUsuario');
    const senha = document.getElementById('entrarSenha');
    if (!usuario.value.trim() || !senha.value) { this.mostrarErro('Digite o usuário e a senha.'); (usuario.value.trim() ? senha : usuario).focus(); return; }
    const botao = document.querySelector('#blocoEntrar button[type="submit"]');
    botao.disabled = true;
    Servidor.conta('entrar', { usuario: usuario.value, senha: senha.value }).then(function (r) {
      botao.disabled = false;
      /* A senha errada fica no campo, selecionada (como na entrada). */
      if (r.erro) { self.mostrarErro(r.erro); senha.select(); return; }
      self.guardarSessao(r);
      self.decidir();
    });
  },

  sair: function () {
    const self = this;
    const conta = ContaLocal.ler();
    Servidor.conta('sair', conta ? { contaId: conta.contaId, chave: conta.chave } : {}).then(function () {
      ContaLocal.limpar();
      self.limparMensagens();
      self.mostrarAviso('Você saiu deste computador.');
      self.decidir();
    });
  },


  /* ---------- O painel ---------- */

  carregar: function () {
    const self = this;
    return Promise.all([Servidor.admin('convites'), Servidor.admin('contas')]).then(function (rs) {
      const erro = rs[0].erro || rs[1].erro;
      if (rs[0].status === 401 || rs[1].status === 401) { ContaLocal.limpar(); self.decidir(); return; }
      if (erro) { self.mostrarErro(erro); return; }
      self.desenharConvites(rs[0].convites);
      self.desenharContas(rs[1].contas);
    });
  },

  dataCurta: function (quando) {
    return new Date(quando).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  },

  desenharConvites: function (convites) {
    const self = this;
    const lista = document.getElementById('listaConvites');
    lista.textContent = '';
    if (!convites.length) lista.appendChild(this.el('li', 'vazio-acessos', 'Nenhum convite gerado ainda.'));
    /* Os mais novos primeiro. */
    convites.slice().sort(function (a, b) { return b.criadoEm - a.criadoEm; }).forEach(function (v) {
      const item = self.el('li', 'item-acesso');
      const quem = self.el('span', 'quem-acesso');
      quem.appendChild(self.el('strong', '', v.tipo === 'senha' ? 'Nova senha para ' + v.para : 'Convite de Mestre'));
      /* A situação, em palavras: usado (e por quem), vencido, ou aberto. */
      let sub;
      if (v.situacao === 'usado') sub = v.tipo === 'senha' ? 'usado: a senha foi trocada' : 'virou a conta de ' + v.usadoPor;
      else if (v.situacao === 'vencido') sub = 'venceu em ' + self.dataCurta(v.expiraEm);
      else sub = 'aberto, vale até ' + self.dataCurta(v.expiraEm);
      quem.appendChild(self.el('span', 'sub-acesso', sub));
      item.appendChild(quem);
      if (v.situacao === 'aberto') {
        const botao = self.el('button', 'mini-botao', 'Revogar');
        botao.type = 'button';
        botao.dataset.acao = 'revogar';
        botao.dataset.id = v.id;
        botao.setAttribute('aria-label', 'Revogar o convite gerado em ' + self.dataCurta(v.criadoEm));
        item.appendChild(botao);
      }
      lista.appendChild(item);
    });
  },

  desenharContas: function (contas) {
    const self = this;
    const lista = document.getElementById('listaContas');
    lista.textContent = '';
    contas.forEach(function (c) {
      const item = self.el('li', 'item-acesso');
      const quem = self.el('span', 'quem-acesso');
      quem.appendChild(self.el('strong', '', c.usuario));
      const partes = [c.admin ? 'administrador' : 'Mestre', c.ativa ? (c.computadores === 1 ? '1 computador conectado' : c.computadores + ' computadores conectados') : 'desativada'];
      quem.appendChild(self.el('span', 'sub-acesso', partes.join(' · ')));
      item.appendChild(quem);
      if (!c.admin && c.ativa) {
        const botoes = self.el('span', 'botoes-acesso');
        const senha = self.el('button', 'mini-botao', 'Convite de nova senha');
        senha.type = 'button';
        senha.dataset.acao = 'nova-senha';
        senha.dataset.id = c.id;
        senha.dataset.nome = c.usuario;
        const desativar = self.el('button', 'mini-botao', 'Desativar');
        desativar.type = 'button';
        desativar.dataset.acao = 'desativar';
        desativar.dataset.id = c.id;
        desativar.dataset.nome = c.usuario;
        desativar.setAttribute('aria-label', 'Desativar a conta de ' + c.usuario);
        botoes.appendChild(senha);
        botoes.appendChild(desativar);
        item.appendChild(botoes);
      }
      lista.appendChild(item);
    });
  },

  /* O código, grande, com "Copiar". Some ao gerar outro ou recarregar. */
  mostrarCodigo: function (r, rotulo) {
    document.getElementById('codigoGerado').hidden = false;
    document.getElementById('rotuloCodigo').textContent = rotulo;
    document.getElementById('textoCodigo').textContent = r.codigo;
    document.getElementById('validadeCodigo').textContent = 'Vale uma vez, até ' + this.dataCurta(r.expiraEm) + '. Copie agora: depois de sair desta página, ele não aparece de novo.';
    document.getElementById('btnCopiarCodigo').focus();
  },

  gerarConvite: function () {
    const self = this;
    this.limparMensagens();
    Servidor.admin('convite', { tipo: 'mestre' }).then(function (r) {
      if (r.erro) { self.mostrarErro(r.erro); return; }
      self.mostrarCodigo(r, 'Convite de Mestre');
      self.carregar();
    });
  },

  conviteDeSenha: function (botao) {
    const self = this;
    this.limparMensagens();
    Servidor.admin('convite', { tipo: 'senha', paraConta: botao.dataset.id }).then(function (r) {
      if (r.erro) { self.mostrarErro(r.erro); return; }
      self.mostrarCodigo(r, 'Convite de nova senha para ' + botao.dataset.nome);
      self.carregar();
    });
  },

  revogar: function (botao) {
    const self = this;
    if (!this.confirmado(botao, 'Confirmar: revogar')) return;
    this.limparMensagens();
    Servidor.admin('revogar', { conviteId: botao.dataset.id }).then(function (r) {
      if (r.erro) { self.mostrarErro(r.erro); return; }
      /* O código à mostra pode ser justamente o revogado: sai da tela. */
      document.getElementById('codigoGerado').hidden = true;
      self.mostrarAviso('Convite revogado: o código não cria mais conta.');
      self.carregar();
    });
  },

  desativar: function (botao) {
    const self = this;
    if (!this.confirmado(botao, 'Confirmar: desativar ' + botao.dataset.nome)) return;
    this.limparMensagens();
    Servidor.admin('desativar', { paraConta: botao.dataset.id }).then(function (r) {
      if (r.erro) { self.mostrarErro(r.erro); return; }
      /* Um convite de senha para ela, à mostra, não vale mais. */
      document.getElementById('codigoGerado').hidden = true;
      self.mostrarAviso('A conta de ' + botao.dataset.nome + ' foi desativada.');
      self.carregar();
    });
  },

  copiarCodigo: function () {
    const self = this;
    const codigo = document.getElementById('textoCodigo').textContent;
    const feito = function () { self.mostrarAviso('Código copiado.'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(codigo).then(feito, function () { self.mostrarAviso('Não deu para copiar: selecione o código e copie à mão.'); });
    } else {
      self.mostrarAviso('Não deu para copiar: selecione o código e copie à mão.');
    }
  },


  /* ---------- O segundo clique (o mesmo da página de Acessos) ---------- */

  confirmado: function (botao, textoConfirmar) {
    if (this.armado === botao) { this.desarmar(); return true; }
    this.desarmar();
    this.armado = botao;
    botao.dataset.textoOriginal = botao.textContent;
    botao.textContent = textoConfirmar;
    botao.classList.add('armado');
    this.relogio = setTimeout(function () { PaginaAdmin.desarmar(); }, 6000);
    return false;
  },

  desarmar: function () {
    clearTimeout(this.relogio);
    const b = this.armado;
    if (b && b.dataset.textoOriginal) { b.textContent = b.dataset.textoOriginal; b.classList.remove('armado'); }
    this.armado = null;
  },


  /* ---------- Pequenas peças ---------- */

  el: function (tag, classe, texto) {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto !== undefined) e.textContent = texto;
    return e;
  },

  mostrarErro: function (texto) { document.getElementById('erro').textContent = texto; },
  mostrarAviso: function (texto) { document.getElementById('aviso').textContent = texto; },
  limparMensagens: function () { this.mostrarErro(''); this.mostrarAviso(''); },


  ligar: function () {
    const self = this;
    document.getElementById('blocoCriarAdmin').addEventListener('submit', function (evento) { evento.preventDefault(); self.criarAdmin(); });
    document.getElementById('blocoEntrar').addEventListener('submit', function (evento) { evento.preventDefault(); self.entrar(); });
    document.getElementById('btnConvite').addEventListener('click', function () { self.gerarConvite(); });
    document.getElementById('btnCopiarCodigo').addEventListener('click', function () { self.copiarCodigo(); });
    document.getElementById('btnSair').addEventListener('click', function () { self.sair(); });
    /* Um clique só por lista: cada botão diz o que é pelo data-acao e
       QUEM pelo data-id (nunca um onclick com o nome dentro). */
    ['listaConvites', 'listaContas'].forEach(function (id) {
      document.getElementById(id).addEventListener('click', function (evento) {
        const botao = evento.target.closest('button[data-acao]');
        if (!botao) return;
        if (botao.dataset.acao === 'revogar') self.revogar(botao);
        if (botao.dataset.acao === 'nova-senha') self.conviteDeSenha(botao);
        if (botao.dataset.acao === 'desativar') self.desativar(botao);
      });
    });
    /* "Mostrar a senha" (a mesma caixinha da entrada). */
    document.addEventListener('change', function (evento) {
      const caixa = evento.target.closest && evento.target.closest('[data-mostra]');
      if (!caixa) return;
      const campo = document.getElementById(caixa.dataset.mostra);
      if (campo) campo.type = caixa.checked ? 'text' : 'password';
    });
  }
};

PaginaAdmin.iniciar();
