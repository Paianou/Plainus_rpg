/* ===================================================================
   tour.js — a visita guiada da primeira vez

   Seus amigos vão abrir o painel do jogador sem ninguém do lado para
   explicar. Na primeira vez (por navegador), uns poucos balões apontam
   o essencial: onde ficam as abas, que perícia se clica para rolar, os
   dados, a mesa, o chat e a ajuda. Pular é sempre um clique (ou Esc).

   COMO SE DESENHA
     .tour-fundo   pega os cliques fora do balão (para ninguém mexer na
                   página por trás sem querer)
     .tour-foco    um retângulo em cima do elemento apontado, com uma
                   sombra ENORME em volta: a sombra escurece a página
                   inteira, menos o buraco do retângulo
     .tour-balao   o texto e os botões

   Os passos dizem QUEM apontar com uma função (alvo), e não com o
   elemento: a tela se redesenha (uma rolagem, uma mensagem nova) e o
   elemento de antes deixa de existir. A cada reposição, o alvo é
   procurado de novo. Passo cujo alvo não está na tela é pulado.
   =================================================================== */

const Tour = {

  CHAVE: 'plainus:tour-jogador',
  passos: null,
  indice: 0,

  jaViu: function () {
    try { return localStorage.getItem(this.CHAVE) === 'visto'; } catch (erro) { return true; }
  },

  marcarVisto: function () {
    try { localStorage.setItem(this.CHAVE, 'visto'); } catch (erro) { /* aparece de novo; paciência */ }
  },

  aberto: function () {
    return !!this.passos;
  },

  /* passos: [{ alvo: function () { return elemento }, titulo, texto }] */
  iniciar: function (passos) {
    if (this.passos) return;
    const self = this;
    this.passos = passos;
    this.antes = document.activeElement;

    this.fundo = criar('div.tour-fundo');
    this.foco = criar('div.tour-foco');
    this.balao = criar('div.tour-balao');
    this.balao.setAttribute('role', 'dialog');
    this.balao.setAttribute('aria-labelledby', 'tourTitulo');
    this.balao.setAttribute('aria-describedby', 'tourTexto');
    document.body.appendChild(this.fundo);
    document.body.appendChild(this.foco);
    document.body.appendChild(this.balao);

    this.aoTeclar = function (evento) {
      if (evento.key === 'Escape') { evento.preventDefault(); self.fechar(); }
      else if (evento.key === 'ArrowRight') { evento.preventDefault(); self.ir(1); }
      else if (evento.key === 'ArrowLeft') { evento.preventDefault(); self.ir(-1); }
    };
    this.aoMover = function () { self.posicionar(); };
    document.addEventListener('keydown', this.aoTeclar, true);
    window.addEventListener('resize', this.aoMover);
    window.addEventListener('scroll', this.aoMover, true);

    this.indice = -1;
    this.ir(1);
  },

  /* O passo seguinte (ou anterior) que tem alvo na tela. */
  ir: function (direcao) {
    let i = this.indice + direcao;
    while (i >= 0 && i < this.passos.length && !this.alvoDe(this.passos[i])) i += direcao;
    if (i < 0) return;                                   /* já está no primeiro */
    if (i >= this.passos.length) { this.fechar(); return; }
    this.indice = i;
    this.mostrar();
  },

  alvoDe: function (passo) {
    let el = null;
    try { el = passo.alvo(); } catch (erro) { el = null; }
    return el && el.isConnected && el.getClientRects().length ? el : null;
  },

  /* Quantos passos têm alvo — para o "2 de 5" não contar os pulados. */
  validos: function () {
    const self = this;
    return this.passos.map(function (p, i) { return self.alvoDe(p) ? i : -1; }).filter(function (i) { return i >= 0; });
  },

  mostrar: function () {
    const self = this;
    const passo = this.passos[this.indice];
    const validos = this.validos();
    const posicao = validos.indexOf(this.indice);
    const ultimo = posicao === validos.length - 1;

    const titulo = criar('h3', passo.titulo);
    titulo.id = 'tourTitulo';
    const texto = criar('p', passo.texto);
    texto.id = 'tourTexto';

    const pular = criarBotao('tour-pular', null, null, 'Pular o tour');
    /* O azul (fantasma) marca o caminho para a frente; o Voltar fica em grafite. */
    const voltar = criarBotao('botao.pequeno', null, null, 'Voltar');
    const seguir = criarBotao('botao.fantasma.pequeno', null, null, ultimo ? 'Começar a jogar' : 'Próximo');
    voltar.disabled = posicao <= 0;
    pular.addEventListener('click', function () { self.fechar(); });
    voltar.addEventListener('click', function () { self.ir(-1); });
    seguir.addEventListener('click', function () { self.ir(1); });

    this.balao.textContent = '';
    this.balao.appendChild(criar('div.tour-contador', (posicao + 1) + ' de ' + validos.length));
    this.balao.appendChild(titulo);
    this.balao.appendChild(texto);
    this.balao.appendChild(criar('div.tour-botoes', [pular, criar('span.espaco'), voltar, seguir]));

    /* Traz o alvo para a tela antes de medir. 'auto', e não 'smooth':
       medir no meio de uma rolagem suave daria a posição errada. */
    const alvo = this.alvoDe(passo);
    /* Só rola se precisa: alvo fora da tela, ou pequeno e cortado na
       borda. Um alvo da altura da tela (a coluna do menu, que fica presa
       sob a barra) já está à vista — centralizá-lo rolaria a página à toa. */
    const caixa = alvo.getBoundingClientRect();
    const altura = window.innerHeight;
    const foraDaTela = caixa.bottom < 70 || caixa.top > altura - 40;
    const cortado = caixa.height < altura * 0.6 && (caixa.top < 70 || caixa.bottom > altura - 20);
    if (foraDaTela || cortado) alvo.scrollIntoView({ block: 'center', inline: 'nearest' });
    this.posicionar();

    /* O balão anima ao trocar de passo (CSS), e o foco vai para o botão
       de seguir — Enter avança, Tab chega no Voltar e no Pular. */
    this.balao.classList.remove('trocou'); void this.balao.offsetWidth; this.balao.classList.add('trocou');
    seguir.focus({ preventScroll: true });
  },

  /* Põe o buraco em cima do alvo e o balão onde couber: embaixo, em
     cima, à direita ou à esquerda — nessa ordem de preferência. */
  posicionar: function () {
    if (!this.passos) return;
    const alvo = this.alvoDe(this.passos[this.indice]);
    if (!alvo) { this.ir(1); return; }

    const r = alvo.getBoundingClientRect();
    const folga = 6;
    const largura = window.innerWidth;
    const altura = window.innerHeight;
    const margem = 16;

    /* O buraco não passa da tela: um alvo muito alto (a coluna do menu)
       fica recortado nas bordas, em vez de sumir para fora. */
    const topo = Math.max(r.top - folga, 4);
    const base = Math.min(r.bottom + folga, altura - 4);
    Object.assign(this.foco.style, {
      top: topo + 'px', left: (r.left - folga) + 'px',
      width: (r.width + folga * 2) + 'px', height: Math.max(base - topo, 0) + 'px'
    });

    const b = this.balao;
    const w = b.offsetWidth;
    const h = b.offsetHeight;
    const prender = function (valor, min, max) { return Math.min(Math.max(valor, min), Math.max(min, max)); };
    let x;
    let y;

    if (base + 14 + h <= altura - margem) {                    /* embaixo */
      y = base + 14;
      x = prender(r.left + r.width / 2 - w / 2, margem, largura - w - margem);
    } else if (topo - 14 - h >= margem) {                      /* em cima */
      y = topo - 14 - h;
      x = prender(r.left + r.width / 2 - w / 2, margem, largura - w - margem);
    } else if (r.right + folga + 14 + w <= largura - margem) {  /* à direita */
      x = r.right + folga + 14;
      y = prender(r.top, margem, altura - h - margem);
    } else if (r.left - folga - 14 - w >= margem) {             /* à esquerda */
      x = r.left - folga - 14 - w;
      y = prender(r.top, margem, altura - h - margem);
    } else {                                                    /* não cabe ao lado: embaixo da tela */
      x = prender(largura / 2 - w / 2, margem, largura - w - margem);
      y = altura - h - margem;
    }
    b.style.left = Math.round(x) + 'px';
    b.style.top = Math.round(y) + 'px';
  },

  fechar: function () {
    if (!this.passos) return;
    document.removeEventListener('keydown', this.aoTeclar, true);
    window.removeEventListener('resize', this.aoMover);
    window.removeEventListener('scroll', this.aoMover, true);
    this.fundo.remove();
    this.foco.remove();
    this.balao.remove();
    this.passos = null;
    this.marcarVisto();
    if (this.antes && this.antes.focus && this.antes.isConnected) this.antes.focus({ preventScroll: true });
  }
};
