/* ===================================================================
   configuracoes.js — a página Configurações do Mestre

   Um cartão por seção. Cada um chama o que já existia no site — nada
   de regra nova aqui:
     Preferências          Dados3D (dados3d.js): ligar e desligar a
                           animação, guardada NESTE navegador
     Campanha              o resumo, e o "Editar campanha" de sempre
                           (criar-campanha.html?editar=1)
     Jogadores e acessos   o convite (Layout.copiarCodigo, o mesmo do
                           botão da barra) e o caminho para acessos.html
     Backup                Backup.baixar (backup.js), o mesmo da entrada
     Zona de perigo        apagar a campanha mora em acessos.html, com a
                           confirmação pelo nome; aqui só o caminho
   =================================================================== */

const Configuracoes = {

  render: function () {
    const area = document.getElementById('configuracoes');
    area.textContent = '';
    area.appendChild(this.cartaoPreferencias());
    area.appendChild(this.cartaoCampanha());
    area.appendChild(this.cartaoJogadores());
    area.appendChild(this.cartaoBackup());
    area.appendChild(this.cartaoPerigo());
  },


  /* Uma linha de opção: o nome e o que ela faz, à esquerda; o botão, à
     direita. É a .linha-uso da ficha (seção 31 do style.css). */
  linha: function (nome, explica, controle) {
    return criar('div.linha-uso', [
      criar('div', [criar('div.nome-uso', nome), criar('div.explica-uso', explica)]),
      criar('div.botoes-uso', [controle])
    ]);
  },


  cartaoPreferencias: function () {
    const ligada = Dados3D.ativa();
    const animacao = criarBotao('mini-botao' + (ligada ? '.ligado' : ''), 'alternar-animacao', 'dados',
      ligada ? 'Animação ligada' : 'Animação desligada');
    animacao.setAttribute('aria-pressed', ligada ? 'true' : 'false');

    return criar('div.cartao', [
      criarComIcone('h2', 'engrenagem', 'Preferências deste navegador', 16),
      this.linha('Animação dos dados',
        'Os dados rolando na tela quando você rola. Desligada, o resultado aparece direto.', animacao)
    ]);
  },


  cartaoCampanha: function () {
    const c = Estado.campanha;
    const editar = criarComIcone('a.mini-botao', 'editar', 'Editar campanha', 13);
    editar.href = 'criar-campanha.html?editar=1';

    return criar('div.cartao', [
      criarComIcone('h2', 'campanha', 'Campanha', 16),
      criar('dl.lista-sobre', [
        criar('div', [criar('dt', 'Nome'), criar('dd', c.nome)]),
        criar('div', [criar('dt', 'Sistema'), criar('dd', c.sistema || '—')]),
        criar('div', [criar('dt', 'Sessão atual'), criar('dd', String(c.sessao))]),
        criar('div', [criar('dt', 'Mestre'), criar('dd', Estado.mestre.nome || '—')])
      ]),
      criar('p.explica-uso', 'Premissa, tom, linhas e véus, regras de criação, regras da casa e a senha do Mestre ficam em "Editar campanha".'),
      criar('div.linha-botoes', [editar])
    ]);
  },


  cartaoJogadores: function () {
    const copiar = criarBotao('mini-botao', 'copiar-convite', 'copiar', 'Copiar convite');
    const acessos = criarComIcone('a.mini-botao', 'convite', 'Abrir acessos da mesa', 13);
    acessos.href = 'acessos.html';

    const cartao = criar('div.cartao', [
      criarComIcone('h2', 'npcs', 'Jogadores e acessos', 16),
      criar('dl.lista-sobre', [
        criar('div', [criar('dt', 'Código de convite'), criar('dd.codigo-convite', Estado.campanha.codigo || '—')])
      ])
    ]);

    /* Quem já entrou: o jogador e o personagem dele. */
    const comDono = Estado.herois.filter(function (h) { return h.jogador; });
    if (comDono.length) {
      cartao.appendChild(criar('dl.lista-sobre.lista-jogadores', comDono.map(function (h) {
        return criar('div', [criar('dt', h.jogador), criar('dd', 'joga com ' + h.nome)]);
      })));
    } else {
      cartao.appendChild(criar('p.explica-uso', 'Ninguém entrou ainda. Mande o convite: cada jogador entra com ele e cria a própria ficha.'));
    }

    cartao.appendChild(criar('p.explica-uso', 'Em "Acessos da mesa": liberar um jogador que trocou de computador, e ver quais computadores abrem o seu painel.'));
    cartao.appendChild(criar('div.linha-botoes', [copiar, acessos]));
    return cartao;
  },


  cartaoBackup: function () {
    const sessao = Sessao.ler();
    const quando = sessao && Backup.quandoFoi(sessao.campanhaId);
    return criar('div.cartao', [
      criarComIcone('h2', 'diario', 'Backup', 16),
      criar('p.explica-uso', quando
        ? 'Último backup desta campanha neste computador: ' + quando + '.'
        : 'Nenhum backup desta campanha foi baixado neste computador ainda.'),
      criar('p.explica-uso', 'O arquivo leva a campanha inteira, com os segredos. Para trazer uma campanha de volta, use "Restaurar backup" na entrada.'),
      criar('div.linha-botoes', [criarBotao('mini-botao', 'baixar-backup', 'diario', 'Baixar backup')])
    ]);
  },


  cartaoPerigo: function () {
    const ir = criarComIcone('a.mini-botao', 'alerta', 'Ir para "Apagar a campanha"', 13);
    ir.href = 'acessos.html';
    return criar('div.cartao.cartao-perigo', [
      criarComIcone('h2', 'alerta', 'Zona de perigo', 16),
      criar('p.explica-uso', 'Apagar a campanha tira ela do servidor, para todo mundo, e não tem volta. A confirmação (digitar o nome da campanha) fica em "Acessos da mesa".'),
      criar('div.linha-botoes', [ir])
    ]);
  },


  baixarBackup: function () {
    const sessao = Sessao.ler();
    if (!sessao) return;
    Backup.baixar(sessao).then(function (r) {
      if (r.erro) { Layout.recado(r.erro, true); return; }
      Layout.recado('Backup baixado.');
      Configuracoes.render();
    });
  },


  ligarEventos: function () {
    const self = this;
    document.getElementById('configuracoes').addEventListener('click', function (evento) {
      const alvo = evento.target.closest('[data-acao]');
      if (!alvo) return;
      switch (alvo.dataset.acao) {
        case 'alternar-animacao':
          Layout.recado(Dados3D.alternar() ? 'Animação dos dados ligada.' : 'Animação dos dados desligada.');
          self.render();
          document.querySelector('#configuracoes [data-acao="alternar-animacao"]').focus();
          break;
        case 'copiar-convite': Layout.copiarCodigo(); break;
        case 'baixar-backup':  self.baixarBackup(); break;
      }
    });
  }
};


/* A moldura decide se esta pessoa pode ver a tela; só então montamos. */
Layout.iniciar(function () {
  Configuracoes.render();
  Configuracoes.ligarEventos();
  /* Outra aba mudou a campanha (um jogador entrou, o nome mudou). */
  Layout.redesenhar = function () { Configuracoes.render(); };
});
