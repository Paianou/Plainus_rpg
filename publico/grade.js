/* ===================================================================
   grade.js — a calibração da grade sobre a imagem do mapa
   (MESA3D.md, fase 3)

   O PROBLEMA
   Uma imagem de mapa quase sempre já tem a grade desenhada. Esticar a
   imagem sobre as nossas células (como o 2D fazia) só bate quando a
   proporção está perfeita — e mesmo assim a margem da imagem entra na
   conta. A calibração diz onde a grade DO DESENHO está:
     { x0, y0, lado, proporcao }  (frações da imagem — ver modelo.js)

   DUAS FORMAS DE CALIBRAR
     1. Detectar: a imagem é lida e a grade é achada sozinha (abaixo).
     2. Marcar uma célula: dois cliques em dois cantos opostos de UMA
        célula. Dali saem o lado e a origem.
   Nas duas, a grade é desenhada por cima da prévia para a pessoa
   conferir. O que vale é o que ela confirma.

   COMO A DETECÇÃO FUNCIONA (sem IA, em contas simples)
   As linhas da grade são mudanças bruscas de cor em linhas retas, que
   se repetem num passo fixo. Então:
     1. a imagem vai para um <canvas> pequeno, em cinza;
     2. para cada coluna de pixels, soma-se o quanto a cor muda entre
        um pixel e o vizinho da direita (o "perfil" horizontal); onde
        há uma linha vertical da grade, a soma é alta;
     3. a AUTOCORRELAÇÃO do perfil diz em que passo ele "se parece
        consigo mesmo deslocado": o passo que mais parece é o lado da
        célula;
     4. com o passo, a FASE que melhor soma as linhas é a origem (x0);
     5. o mesmo, de cima para baixo, para as linhas horizontais (y0).
   Se o passo vertical e o horizontal discordam muito, a confiança cai:
   a imagem pode nem ter grade, ou ter células não quadradas.
   =================================================================== */

const Grade = {

  LARGURA_ANALISE: 900,     /* a imagem é reduzida a isto para a conta */
  PASSO_MINIMO: 8,          /* em pixels da análise: menos que isso é textura, não grade */

  /* Detecta a grade numa imagem já carregada (<img> ou <canvas>).
     Devolve { x0, y0, lado, proporcao, confianca } — ou null se não
     achou nada que pareça uma grade. */
  detectar: function (imagem) {
    const larguraNatural = imagem.naturalWidth || imagem.width;
    const alturaNatural = imagem.naturalHeight || imagem.height;
    if (!larguraNatural || !alturaNatural) return null;

    const escala = Math.min(1, this.LARGURA_ANALISE / larguraNatural);
    const W = Math.max(2, Math.round(larguraNatural * escala));
    const H = Math.max(2, Math.round(alturaNatural * escala));
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const g = canvas.getContext('2d', { willReadFrequently: true });
    g.drawImage(imagem, 0, 0, W, H);
    const dados = g.getImageData(0, 0, W, H).data;

    /* Cinza: 0,299 R + 0,587 G + 0,114 B (o peso que o olho dá a cada cor). */
    const cinza = new Float32Array(W * H);
    for (let i = 0, p = 0; i < cinza.length; i++, p += 4) {
      cinza[i] = 0.299 * dados[p] + 0.587 * dados[p + 1] + 0.114 * dados[p + 2];
    }

    /* Os perfis: quanto a cor muda ao lado (por coluna) e abaixo (por linha). */
    const perfilX = new Float32Array(W);
    const perfilY = new Float32Array(H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W - 1; x++) {
        const d = Math.abs(cinza[y * W + x + 1] - cinza[y * W + x]);
        perfilX[x] += d;
      }
    }
    for (let y = 0; y < H - 1; y++) {
      let soma = 0;
      for (let x = 0; x < W; x++) soma += Math.abs(cinza[(y + 1) * W + x] - cinza[y * W + x]);
      perfilY[y] = soma;
    }

    const h = this.passoEFase(perfilX);
    const v = this.passoEFase(perfilY);
    if (!h && !v) return null;

    /* Quando só um eixo respondeu, o outro copia o passo (célula
       quadrada) e procura só a fase. */
    const passo = h && v ? (h.passo + v.passo) / 2 : (h ? h.passo : v.passo);
    const faseX = h ? h.fase : this.melhorFase(perfilX, passo);
    const faseY = v ? v.fase : this.melhorFase(perfilY, passo);
    let confianca = Math.max(h ? h.forca : 0, v ? v.forca : 0);
    if (h && v && Math.abs(h.passo - v.passo) / passo > 0.08) confianca *= 0.4;   /* não é quadrada */

    return {
      x0: faseX / W,
      y0: faseY / H,
      lado: passo / W,
      proporcao: alturaNatural / larguraNatural,
      confianca: Math.max(0, Math.min(1, confianca))
    };
  },


  /* O passo (período) de um perfil, pela autocorrelação, e a fase. */
  passoEFase: function (perfil) {
    const n = perfil.length;
    let media = 0;
    for (let i = 0; i < n; i++) media += perfil[i];
    media /= n;
    const p = new Float32Array(n);
    let energia = 0;
    for (let i = 0; i < n; i++) { p[i] = perfil[i] - media; energia += p[i] * p[i]; }
    if (energia === 0) return null;

    const maximo = Math.floor(n / 4);
    /* A autocorrelação de cada lag (de -1 a 1). */
    const correlacao = new Float32Array(maximo + 1);
    let maior = 0;
    for (let lag = this.PASSO_MINIMO; lag <= maximo; lag++) {
      let soma = 0;
      for (let i = 0; i + lag < n; i++) soma += p[i] * p[i + lag];
      correlacao[lag] = soma / energia;
      if (correlacao[lag] > maior) maior = correlacao[lag];
    }
    if (maior < 0.12) return null;

    /* Uma grade correlaciona em TODOS os múltiplos do passo (a cada 2
       células também bate), e o múltiplo às vezes ganha por um fio. O
       passo de verdade é o MENOR pico que chega perto do maior. */
    let passo = 0;
    for (let lag = this.PASSO_MINIMO + 1; lag < maximo; lag++) {
      const ehPico = correlacao[lag] >= correlacao[lag - 1] && correlacao[lag] >= correlacao[lag + 1];
      if (ehPico && correlacao[lag] >= maior * 0.55) { passo = lag; break; }
    }
    if (!passo) return null;
    const melhor = { valor: correlacao[passo] };

    /* Refina o passo com casas decimais: a média das distâncias entre
       picos consecutivos (os picos são as linhas) é mais exata que o
       lag inteiro. */
    const picos = [];
    const janela = Math.max(2, Math.round(passo * 0.35));
    for (let i = janela; i < n - janela; i++) {
      let ehPico = p[i] > 0;
      for (let k = -janela; k <= janela && ehPico; k++) if (p[i + k] > p[i]) ehPico = false;
      if (ehPico) picos.push(i);
    }
    if (picos.length >= 3) {
      const distancias = [];
      for (let i = 1; i < picos.length; i++) {
        const d = picos[i] - picos[i - 1];
        if (Math.abs(d - passo) / passo < 0.25) distancias.push(d);
      }
      if (distancias.length >= 2) passo = distancias.reduce(function (a, b) { return a + b; }, 0) / distancias.length;
    }

    return { passo: passo, fase: this.melhorFase(perfil, passo), forca: melhor.valor };
  },


  /* A fase: o deslocamento (0 a passo) em que as linhas somam mais. */
  melhorFase: function (perfil, passo) {
    const n = perfil.length;
    let melhor = 0, melhorSoma = -Infinity;
    const passos = Math.max(1, Math.round(passo * 4));          /* um quarto de pixel */
    for (let k = 0; k < passos; k++) {
      const fase = k / 4;
      let soma = 0, quantos = 0;
      for (let x = fase; x < n; x += passo) {
        const i = Math.round(x);
        if (i < n) { soma += perfil[i]; quantos++; }
      }
      if (quantos && soma / quantos > melhorSoma) { melhorSoma = soma / quantos; melhor = fase; }
    }
    return melhor;
  },


  /* ===================================================================
     O CALIBRADOR — a prévia com a grade por cima, e os dois cliques

     Calibrador.ligar(canvas, imagem, grade, aoMudar)
       canvas   o <canvas> da janela de cena
       imagem   o <img> carregado (a prévia)
       grade    a calibração atual, ou null
       aoMudar  chamado com a grade nova (ou null) a cada mudança
     =================================================================== */
  Calibrador: {
    canvas: null,
    imagem: null,
    grade: null,
    aoMudar: null,
    primeiroClique: null,

    ligar: function (canvas, imagem, grade, aoMudar) {
      const self = this;
      this.canvas = canvas;
      this.imagem = imagem;
      this.grade = grade || null;
      this.aoMudar = aoMudar;
      this.primeiroClique = null;
      if (!canvas.dataset.ligado) {
        canvas.addEventListener('click', function (evento) { self.clique(evento); });
        canvas.dataset.ligado = '1';
      }
      this.desenhar();
    },

    definir: function (grade) {
      this.grade = grade || null;
      this.primeiroClique = null;
      this.desenhar();
      if (this.aoMudar) this.aoMudar(this.grade);
    },

    /* Onde foi o clique, em fração da imagem. */
    posicao: function (evento) {
      const caixa = this.canvas.getBoundingClientRect();
      return { x: (evento.clientX - caixa.left) / caixa.width, y: (evento.clientY - caixa.top) / caixa.height };
    },

    /* Dois cantos opostos de uma célula: o lado é a distância em X (e
       em Y, que deve ser parecida — é a mesma célula); a origem é o
       canto de cima/esquerda dessa célula, trazido de volta até a
       borda da imagem de célula em célula. */
    clique: function (evento) {
      if (!this.imagem) return;
      const p = this.posicao(evento);
      if (!this.primeiroClique) {
        this.primeiroClique = p;
        this.desenhar();
        return;
      }
      const a = this.primeiroClique;
      this.primeiroClique = null;
      const proporcao = this.imagem.naturalHeight / this.imagem.naturalWidth;
      const ladoX = Math.abs(p.x - a.x);
      const ladoY = Math.abs(p.y - a.y) * proporcao;     /* em fração da LARGURA, como ladoX */
      if (ladoX < 0.004 || ladoY < 0.004) { this.desenhar(); return; }
      const lado = (ladoX + ladoY) / 2;
      const cantoX = Math.min(a.x, p.x);
      const cantoY = Math.min(a.y, p.y);
      const ladoEmY = lado / proporcao;
      this.definir({
        x0: cantoX - Math.floor(cantoX / lado + 1e-9) * lado,
        y0: cantoY - Math.floor(cantoY / ladoEmY + 1e-9) * ladoEmY,
        lado: lado,
        proporcao: proporcao
      });
    },

    desenhar: function () {
      const canvas = this.canvas, imagem = this.imagem;
      if (!canvas || !imagem || !imagem.naturalWidth) return;
      const largura = 640;
      const altura = Math.round(largura * imagem.naturalHeight / imagem.naturalWidth);
      canvas.width = largura; canvas.height = altura;
      const g = canvas.getContext('2d');
      g.drawImage(imagem, 0, 0, largura, altura);

      const grade = this.grade;
      if (grade) {
        const passoX = grade.lado * largura;
        const passoY = grade.lado / grade.proporcao * altura;
        g.strokeStyle = 'rgba(77, 141, 255, .85)';
        g.lineWidth = 1;
        g.beginPath();
        for (let x = grade.x0 * largura; x <= largura + 0.5; x += passoX) { g.moveTo(Math.round(x) + 0.5, 0); g.lineTo(Math.round(x) + 0.5, altura); }
        for (let y = grade.y0 * altura; y <= altura + 0.5; y += passoY) { g.moveTo(0, Math.round(y) + 0.5); g.lineTo(largura, Math.round(y) + 0.5); }
        g.stroke();
        /* A área fora da grade (a margem) fica mais escura. */
        const colunas = Math.floor((1 - grade.x0) / grade.lado + 1e-6);
        const linhas = Math.floor((1 - grade.y0) * grade.proporcao / grade.lado + 1e-6);
        g.fillStyle = 'rgba(8, 9, 11, .55)';
        const x1 = grade.x0 * largura + colunas * passoX, y1 = grade.y0 * altura + linhas * passoY;
        g.fillRect(0, 0, largura, grade.y0 * altura);
        g.fillRect(0, y1, largura, altura - y1);
        g.fillRect(0, 0, grade.x0 * largura, altura);
        g.fillRect(x1, 0, largura - x1, altura);
      }
      if (this.primeiroClique) {
        g.fillStyle = '#4d8dff';
        g.beginPath();
        g.arc(this.primeiroClique.x * largura, this.primeiroClique.y * altura, 5, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = { Grade: Grade };
