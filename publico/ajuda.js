/* ===================================================================
   ajuda.js — a página Ajuda do Mestre

   Um cartão por assunto. O que já existia no site é chamado, não
   copiado:
     Atalhos do teclado      Atalhos.montarLista (atalhos.js) — a mesma
                             lista da janela "?"
     O que cada tela faz     Layout.SECOES (layout.js): o nome, o ícone e
                             a linha "descricao" de cada seção
     Jogar pelo link         os passos do túnel (o README conta o mesmo)
     Quando algo dá errado   o caminho para as telas que resolvem
   =================================================================== */

const Ajuda = {

  render: function () {
    const area = document.getElementById('ajuda');
    area.textContent = '';
    area.appendChild(this.cartaoTelas());
    area.appendChild(this.cartaoAtalhos());
    area.appendChild(this.cartaoLink());
    area.appendChild(this.cartaoProblemas());
  },


  /* Cada tela do códice, com a linha que diz para que ela serve. O nome
     é um link: daqui já se vai para lá. */
  cartaoTelas: function () {
    const cartao = criar('div.cartao', [criarComIcone('h2', 'seta', 'O que cada tela faz', 16)]);
    Layout.SECOES.forEach(function (secao) {
      const nome = criarComIcone('a.nome-uso', secao.ico, secao.texto, 15);
      nome.href = secao.arquivo;
      cartao.appendChild(criar('div.linha-uso', [
        criar('div', [nome, criar('div.explica-uso', secao.descricao || '')])
      ]));
    });
    return cartao;
  },


  cartaoAtalhos: function () {
    return criar('div.cartao', [
      criarComIcone('h2', 'ajuda', 'Atalhos do teclado', 16),
      criar('p.explica-uso', 'Funcionam quando você não está digitando num campo. A tecla ? abre esta lista em qualquer tela do painel.'),
      Atalhos.montarLista()
    ]);
  },


  /* Um passo com um comando: o texto, e o comando num <code>. */
  passo: function (texto, comando, depois) {
    return criar('li', [
      document.createTextNode(texto),
      comando ? criar('code', comando) : null,
      depois ? document.createTextNode(depois) : null
    ]);
  },

  cartaoLink: function () {
    const p = this.passo;
    return criar('div.cartao', [
      criarComIcone('h2', 'convite', 'Jogar com os amigos pelo link', 16),
      criar('ol.passos-ajuda', [
        p('No seu computador, num terminal aberto na pasta minha-mesa: ', 'npm start', '.'),
        p('Em outro terminal: ', 'cloudflared tunnel --url http://localhost:3000', '. Ele mostra um link terminado em trycloudflare.com.'),
        p('Mande esse link aos amigos, junto com o código de convite (Configurações → "Copiar convite"). O link muda cada vez que o túnel liga; o código, não.'),
        p('Cada amigo abre o link, escolhe "Tenho um convite", digita o código e o nome, e cria a ficha.')
      ]),
      criar('p.explica-uso', 'Para VOCÊ entrar pelo link (de outro computador), defina a senha do servidor (PLAINUS_SENHA_SERVIDOR) no arquivo .env da pasta minha-mesa. Pelo link, a senha do Mestre da campanha é sempre pedida.'),
      criar('p.explica-uso', 'Sem o código de convite, ninguém vê nada da mesa — o link sozinho não abre a campanha.')
    ]);
  },


  cartaoProblemas: function () {
    /* O link leva o ícone de onde ele vai (como em Configurações) e
       fica embaixo do texto. */
    function item(titulo, texto, rotulo, endereco, icone) {
      const ir = rotulo ? criarComIcone('a.mini-botao', icone, rotulo, 13) : null;
      if (ir) ir.href = endereco;
      return criar('div.linha-uso', [
        criar('div', [
          criar('div.nome-uso', titulo),
          criar('div.explica-uso', texto),
          ir ? criar('div.linha-botoes', [ir]) : null
        ])
      ]);
    }
    return criar('div.cartao', [
      criarComIcone('h2', 'alerta', 'Quando algo dá errado', 16),
      item('Um jogador trocou de computador',
        'Libere o lugar dele. Depois ele entra de novo com o código de convite e o MESMO nome, e volta para o mesmo personagem.',
        'Abrir acessos da mesa', 'acessos.html', 'convite'),
      item('A tela parou de atualizar',
        'O servidor caiu ou o túnel fechou: olhe o terminal do npm start. Quando o servidor volta, as telas se reconectam sozinhas.'),
      item('Medo de perder a campanha',
        'Baixe um backup antes de cada sessão. Com o arquivo, "Restaurar backup" na entrada traz tudo de volta (pelo link do túnel, isso pede a senha do servidor).',
        'Abrir Configurações', 'configuracoes.html', 'engrenagem')
    ]);
  }
};


/* A moldura decide se esta pessoa pode ver a tela; só então montamos. */
Layout.iniciar(function () {
  Ajuda.render();
});
