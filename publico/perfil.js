/* ===================================================================
   perfil.js — a página Perfil do Mestre

   Dois cartões:
     Como a mesa te vê   o mesmo selo do topo (Layout.cartaoMestre) e o
                         campo para trocar o nome — ação mudarNomeMestre
                         (acoes.js)
     Seu acesso de Mestre  o que guarda a entrada (este navegador, a
                         senha pelo link) e o caminho para os Acessos e
                         para o "Editar campanha"
   =================================================================== */

const Perfil = {

  render: function () {
    const area = document.getElementById('perfil');
    area.textContent = '';
    area.appendChild(this.cartaoNome());
    area.appendChild(this.cartaoAcesso());
  },


  cartaoNome: function () {
    const campo = criar('div.campo-form');
    const rotulo = criar('label', 'Seu nome como Mestre');
    rotulo.htmlFor = 'nomeMestre';
    const entrada = document.createElement('input');
    entrada.type = 'text';
    entrada.id = 'nomeMestre';
    entrada.maxLength = 30;
    entrada.autocomplete = 'nickname';
    entrada.placeholder = 'Como a mesa te chama';
    entrada.value = Estado.mestre.nome;
    campo.appendChild(rotulo);
    campo.appendChild(entrada);

    /* O form deixa o Enter salvar, como em qualquer campo do site. */
    const form = criar('form.formulario', [
      campo,
      criar('div.linha-botoes', [criarBotao('botao.pequeno', null, 'check', 'Salvar nome')])
    ]);
    form.querySelector('button').type = 'submit';
    form.id = 'formNome';

    return criar('div.cartao', [
      criarComIcone('h2', 'pessoa', 'Como a mesa te vê', 16),
      criar('div.selo-perfil', [Layout.cartaoMestre()]),
      criar('p.explica-uso', 'É o nome do topo do painel, do chat e do "Mestre: …" que os jogadores veem. As mensagens antigas do chat ficam com o nome de quando foram escritas.'),
      form
    ]);
  },


  cartaoAcesso: function () {
    const acessos = criarComIcone('a.mini-botao', 'convite', 'Abrir acessos da mesa', 13);
    acessos.href = 'acessos.html';
    const editar = criarComIcone('a.mini-botao', 'editar', 'Editar campanha', 13);
    editar.href = 'criar-campanha.html?editar=1';

    return criar('div.cartao', [
      criarComIcone('h2', 'mestre', 'Seu acesso de Mestre', 16),
      criar('p.explica-uso', 'Este navegador guarda a sua chave de Mestre: é ela que abre o painel sem pedir nada.'),
      criar('p.explica-uso', 'Pelo link do túnel, a senha do Mestre da campanha é sempre pedida. Ela se define (e se troca) em "Editar campanha".'),
      criar('p.explica-uso', 'Em "Acessos da mesa" você vê quais computadores abrem o seu painel — e desconecta os outros, se perdeu um deles.'),
      criar('div.linha-botoes', [acessos, editar])
    ]);
  },


  salvar: function () {
    const entrada = document.getElementById('nomeMestre');
    const r = Acoes.executar('mudarNomeMestre', { nome: entrada.value });
    if (r.erro) {
      entrada.setAttribute('aria-invalid', 'true');
      entrada.focus();
      Layout.recado(r.erro, true);
      return;
    }
    /* O nome também fica na lista de mesas deste navegador (a entrada
       mostra), e na sessão aberta. */
    const sessao = Sessao.ler();
    if (sessao) {
      Sessao.gravar(Object.assign({}, sessao, { nome: r.nome }));
      Acessos.lembrar(Object.assign({}, sessao, { nome: r.nome }));
    }
    Layout.montarTopo();
    this.render();
    /* O foco vai para o botão, e não de volta ao campo: com o cursor num
       campo, o painel acha que você está digitando e segura as novidades
       da mesa (Layout.ocupado). */
    document.querySelector('#formNome button[type="submit"]').focus();
    Layout.recado('Nome salvo: agora a mesa te chama de ' + r.nome + '.');
  },


  ligarEventos: function () {
    const self = this;
    document.getElementById('perfil').addEventListener('submit', function (evento) {
      evento.preventDefault();
      self.salvar();
    });
  }
};


/* A moldura decide se esta pessoa pode ver a tela; só então montamos. */
Layout.iniciar(function () {
  Perfil.render();
  Perfil.ligarEventos();
  /* Outra aba mudou a campanha: redesenha, menos com o nome sendo
     digitado (o Layout já espera — ver ocupado, no layout.js). */
  Layout.redesenhar = function () { Perfil.render(); };
});
