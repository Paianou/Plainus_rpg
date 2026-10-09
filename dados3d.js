/* ===================================================================
   dados3d.js — os dados que rolam (no espírito do Baldur's Gate 3)

   DOIS JEITOS DE MOSTRAR UMA ROLAGEM
     teste   o d20 de um teste (perícia, salvaguarda, ataque, iniciativa):
             um d20 em 3D cai no meio da tela, quica, gira e PARA na face
             sorteada; aparece o total com o bônus e, se houver CD,
             SUCESSO ou FALHA. Com vantagem/desvantagem, dois dados.
     dano    os dados de dano (2d6, 1d8...): uma bandeja pequena embaixo
             da tela, rápida — num combate se rolam muitos, e esperar o
             d20 grande a cada um cansaria.

   O RESULTADO VEM ANTES DA ANIMAÇÃO
   Quem chama já sorteou o número (hoje o Layout.dado; amanhã, o
   servidor). Esta peça só ENCENA: calcula a rotação final que deixa
   aquela face virada para a câmera, com o número de pé, e anima a
   queda até ela. Se a física decidisse o número, cada tela veria um
   resultado e o servidor não teria como conferir.

   AS PEÇAS DO 3D (Three.js — vendor/three.min.js)
     renderer   desenha num <canvas> com WebGL (a placa de vídeo)
     scene      o "palco": o dado, as luzes, a sombra
     camera     de onde se olha (de frente, eixo Z)
     mesh       um objeto: geometria (a forma) + material (a pele)
   A geometria do d20 é um icosaedro: 20 triângulos. Cada face ganha um
   número numa plaquinha transparente colada nela, voltada para fora.

   QUANDO NÃO ANIMA
     - a pessoa desligou (o botão no cartão de dados);
     - o sistema pede "reduzir movimento" e ela não ligou de propósito;
     - não há WebGL (computador antigo): aí o d20 também vai para a
       bandeja 2D, que funciona em qualquer lugar.
   Clicar ou apertar qualquer tecla pula a animação.
   =================================================================== */

const Dados3D = {

  CHAVE: 'plainus:animacao-dados',
  DURACAO: 1400,          /* a queda do d20, em ms */
  ESPERA: 1500,           /* quanto o resultado fica na tela depois */

  /* --- o que fica montado entre uma rolagem e outra --- */
  palco: null,
  renderer: null,
  cena: null,
  camera: null,
  dados: [],              /* os dois d20 (o segundo só na vantagem) */
  sombras: [],
  quadro: null,           /* o requestAnimationFrame em curso */
  fechar: null,           /* a função que encerra a rolagem em curso */
  audio: null,


  /* ===================================================================
     LIGADA OU DESLIGADA — preferência de quem olha, não da campanha
     =================================================================== */

  preferencia: function () {
    try { return localStorage.getItem(this.CHAVE); } catch (erro) { return null; }
  },

  /* Sem escolha feita, segue o sistema: quem pediu "reduzir movimento"
     começa sem animação. */
  ativa: function () {
    const escolha = this.preferencia();
    if (escolha) return escolha === 'ligada';
    return !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  },

  alternar: function () {
    try { localStorage.setItem(this.CHAVE, this.ativa() ? 'desligada' : 'ligada'); } catch (erro) { /* fica como está */ }
    return this.ativa();
  },

  tem3D: function () {
    if (this._tem3D !== undefined) return this._tem3D;
    let ok = false;
    try {
      const teste = document.createElement('canvas');
      ok = typeof THREE !== 'undefined' && !!(teste.getContext('webgl2') || teste.getContext('webgl'));
    } catch (erro) { ok = false; }
    this._tem3D = ok;
    return ok;
  },


  /* ===================================================================
     A PORTA DE ENTRADA

     Dados3D.mostrar({
       modo: 'teste' | 'dano',
       texto: 'Arcanismo',
       faces: 20,              (no dano: 4, 6, 8...)
       valores: [17, 4],       os dados que saíram
       escolhido: 0,           na vantagem/desvantagem, qual valeu
       bonus: 5, total: 22, cd: 15, marca: 'critico' | 'falha' | null,
       formula: 'd20 (17, 4) vantagem + 5'
     })

     Devolve true se vai animar. Se devolver false (desligada), quem
     chamou mostra o resultado do jeito de antes (o recado).
     =================================================================== */

  mostrar: function (rolagem) {
    if (!this.ativa()) return false;

    /* Uma rolagem nova encerra a anterior na hora. */
    if (this.fechar) this.fechar(true);

    if (rolagem.modo === 'teste' && rolagem.faces === 20 && this.tem3D()) {
      this.rolarD20(rolagem);
    } else {
      this.rolarBandeja(rolagem);
    }
    return true;
  },


  /* ===================================================================
     O d20 EM 3D
     =================================================================== */

  /* Monta o palco uma vez só e reaproveita: criar um contexto WebGL a
     cada rolagem vazaria memória da placa de vídeo. */
  montarPalco: function () {
    if (this.renderer) return;

    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.cena = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    this.camera.position.set(0, 0, 11);

    /* A luz: uma geral fraca, uma de cima (a "janela") e uma azul de
       lado — a luz arcana da identidade visual. */
    this.cena.add(new THREE.AmbientLight(0x8090b0, 0.55));
    const cima = new THREE.DirectionalLight(0xffffff, 1.6);
    cima.position.set(-2, 5, 6);
    this.cena.add(cima);
    const arcana = new THREE.PointLight(0x4d8dff, 22, 20);
    arcana.position.set(3.5, -1, 4);
    this.cena.add(arcana);

    this.dados = [this.criarD20(), this.criarD20()];
    this.sombras = [this.criarSombra(), this.criarSombra()];
    this.dados.forEach(function (d) { this.cena.add(d.grupo); }, this);
    this.sombras.forEach(function (s) { this.cena.add(s); }, this);
  },


  /* Um d20: o icosaedro, as arestas acesas e as 20 plaquinhas. */
  criarD20: function () {
    const RAIO = 1.25;
    const geometria = new THREE.IcosahedronGeometry(RAIO, 0);
    const pos = geometria.attributes.position;

    /* Pedra escura e um pouco metálica; flatShading deixa cada face
       lisa e com a própria luz — é o que faz parecer lapidado. */
    const pedra = new THREE.MeshStandardMaterial({
      color: 0x1b2030, roughness: 0.42, metalness: 0.35, flatShading: true,
      transparent: true, opacity: 1
    });
    const corpo = new THREE.Mesh(geometria, pedra);

    const arestas = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometria),
      new THREE.LineBasicMaterial({ color: 0x4d8dff, transparent: true, opacity: 0.55 })
    );

    const grupo = new THREE.Group();
    grupo.add(corpo);
    grupo.add(arestas);

    /* As faces: centro, normal (para onde ela aponta) e um vértice (para
       onde o "alto" do número aponta, como num dado de verdade). */
    const faces = [];
    for (let i = 0; i < pos.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(pos, i);
      const b = new THREE.Vector3().fromBufferAttribute(pos, i + 1);
      const c = new THREE.Vector3().fromBufferAttribute(pos, i + 2);
      const centro = a.clone().add(b).add(c).divideScalar(3);
      faces.push({ centro: centro, normal: centro.clone().normalize(), vertice: a, valor: 0 });
    }

    /* Numeração como num d20 de verdade: faces OPOSTAS somam 21. */
    let proximo = 1;
    faces.forEach(function (f) {
      if (f.valor) return;
      const oposta = faces.find(function (g) { return !g.valor && g !== f && g.normal.dot(f.normal) < -0.99; });
      f.valor = proximo;
      if (oposta) oposta.valor = 21 - proximo;
      proximo += 1;
    });

    /* As plaquinhas dos números. */
    const lado = RAIO * 0.52;
    faces.forEach(function (f) {
      const plaquinha = new THREE.Mesh(
        new THREE.PlaneGeometry(lado, lado),
        new THREE.MeshBasicMaterial({ map: Dados3D.texturaNumero(f.valor), transparent: true, depthWrite: false })
      );

      /* Vira a plaquinha para fora da face... */
      const virar = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), f.normal);
      /* ...e gira em torno da normal até o "alto" do número apontar
         para um vértice. */
      const altoAtual = new THREE.Vector3(0, 1, 0).applyQuaternion(virar);
      const altoQuerido = f.vertice.clone().sub(f.centro).projectOnPlane(f.normal).normalize();
      const angulo = Math.atan2(altoAtual.clone().cross(altoQuerido).dot(f.normal), altoAtual.dot(altoQuerido));
      const girar = new THREE.Quaternion().setFromAxisAngle(f.normal, angulo);

      plaquinha.quaternion.copy(girar.multiply(virar));
      plaquinha.position.copy(f.centro).addScaledVector(f.normal, 0.01);
      f.alto = altoQuerido;
      grupo.add(plaquinha);
    });

    return { grupo: grupo, faces: faces, pedra: pedra, arestas: arestas };
  },


  /* O número, desenhado num <canvas> que vira textura. Inter e não
     Marcellus: na Marcellus o 1 parece I e o 0 parece O. O 6 e o 9
     ganham um tracinho embaixo — num dado que gira, é o que separa os
     dois. */
  texturaNumero: function (valor) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const g = canvas.getContext('2d');
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '700 62px Inter, "Segoe UI", system-ui, sans-serif';
    g.shadowColor = '#4d8dff';
    g.shadowBlur = 16;
    g.fillStyle = valor === 20 ? '#ffffff' : '#cfe0ff';
    g.fillText(String(valor), 64, 66);
    if (valor === 6 || valor === 9) g.fillRect(48, 96, 32, 5);

    const textura = new THREE.CanvasTexture(canvas);
    textura.colorSpace = THREE.SRGBColorSpace;
    textura.anisotropy = 4;
    return textura;
  },


  /* Uma sombra macia embaixo do dado: um círculo borrado que encolhe
     quando o dado sobe. É o que dá a sensação de chão. */
  criarSombra: function () {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const g = canvas.getContext('2d');
    const gradiente = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gradiente.addColorStop(0, 'rgba(0,0,0,0.65)');
    gradiente.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gradiente;
    g.fillRect(0, 0, 64, 64);
    const sombra = new THREE.Mesh(
      new THREE.PlaneGeometry(2.8, 1.1),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false })
    );
    sombra.position.y = -1.55;
    return sombra;
  },


  /* A rotação que deixa a face `valor` virada para a câmera (+Z) com o
     número de pé. Duas rotações: primeiro a face para a frente, depois
     um giro em torno do eixo da câmera até o "alto" apontar para cima. */
  rotacaoFinal: function (dado, valor) {
    const face = dado.faces.find(function (f) { return f.valor === valor; }) || dado.faces[0];
    const frente = new THREE.Quaternion().setFromUnitVectors(face.normal, new THREE.Vector3(0, 0, 1));
    const alto = face.alto.clone().applyQuaternion(frente);
    const dePe = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.atan2(alto.x, alto.y));
    return dePe.multiply(frente);
  },


  rolarD20: function (rolagem) {
    const self = this;
    this.montarPalco();

    const valores = rolagem.valores.slice(0, 2);
    const dois = valores.length === 2;
    const palco = this.abrirPalco('d20', rolagem);

    const largura = Math.min(window.innerWidth, 900);
    const altura = Math.min(window.innerHeight * 0.62, 520);
    this.renderer.setSize(largura, altura);
    this.camera.aspect = largura / altura;
    this.camera.updateProjectionMatrix();
    palco.querySelector('.palco-3d').appendChild(this.renderer.domElement);

    /* Cada dado: de onde vem, para onde vai, como gira. */
    const planos = valores.map(function (valor, i) {
      const dado = self.dados[i];
      const xFinal = dois ? (i === 0 ? -1.55 : 1.55) : 0;
      const eixo = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      const inicio = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3));

      dado.grupo.visible = true;
      dado.pedra.opacity = 1;
      dado.arestas.material.opacity = 0.55;
      self.sombras[i].visible = true;

      return {
        dado: dado, sombra: self.sombras[i],
        x0: xFinal + (i === 0 ? -4.2 : 4.2), xFinal: xFinal, y0: 3.6,
        eixo: eixo, voltas: (3.2 + Math.random() * 1.5) * Math.PI * 2,
        inicio: inicio, fim: self.rotacaoFinal(dado, valor),
        atraso: i * 110, quicou: 0
      };
    });
    for (let i = valores.length; i < 2; i++) {
      this.dados[i].grupo.visible = false;
      this.sombras[i].visible = false;
    }

    let comeco = null;
    let terminou = false;
    const QUIQUES = [0.36, 0.73, 0.91];       /* onde o easeOutBounce toca o chão */

    function quadro(agora) {
      if (comeco === null) comeco = agora;
      let todosParados = true;

      planos.forEach(function (p) {
        const t = Math.max(0, Math.min(1, (agora - comeco - p.atraso) / self.DURACAO));
        if (t < 1) todosParados = false;
        self.posicionar(p, t);

        /* Um "toc" a cada quique, mais fraco a cada vez. */
        const tq = Math.min(1, t * 1.15);
        while (p.quicou < QUIQUES.length && tq >= QUIQUES[p.quicou]) {
          self.som(1 - p.quicou * 0.3);
          p.quicou += 1;
        }
      });

      self.renderer.render(self.cena, self.camera);

      if (todosParados && !terminou) {
        terminou = true;
        self.pousar(palco, rolagem, planos);
      }
      self.quadro = requestAnimationFrame(quadro);
    }
    this.quadro = requestAnimationFrame(quadro);

    /* Pular: leva tudo para o fim na hora. */
    this.pular = function () {
      comeco = -1e9;
    };
  },


  /* Onde o dado está no instante t (0 a 1). */
  posicionar: function (p, t) {
    const suave = 1 - Math.pow(1 - t, 3);                 /* easeOutCubic */
    const quique = Dados3D.easeOutBounce(Math.min(1, t * 1.15));

    const x = p.x0 + (p.xFinal - p.x0) * suave;
    const y = p.y0 * (1 - quique);
    p.dado.grupo.position.set(x, y, 0);

    /* Gira solto em volta de um eixo sorteado, cada vez mais devagar;
       no último terço, desliza até a rotação que mostra o resultado. */
    const solto = new THREE.Quaternion().setFromAxisAngle(p.eixo, p.voltas * suave).multiply(p.inicio);
    const chegada = Math.max(0, Math.min(1, (t - 0.55) / 0.37));
    const mistura = chegada * chegada * (3 - 2 * chegada);    /* smoothstep */
    p.dado.grupo.quaternion.copy(solto).slerp(p.fim, mistura);

    /* A sombra fica no chão, embaixo; encolhe quando o dado sobe. */
    const alturaRel = Math.min(1, y / p.y0);
    p.sombra.position.x = x;
    p.sombra.scale.setScalar(1 - alturaRel * 0.55);
    p.sombra.material.opacity = 1 - alturaRel * 0.7;
  },

  easeOutBounce: function (x) {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (x < 1 / d1) return n1 * x * x;
    if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
    if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
    return n1 * (x -= 2.625 / d1) * x + 0.984375;
  },


  /* O dado parou: o descartado se apaga, o crítico acende, e o
     resultado aparece. */
  pousar: function (palco, rolagem, planos) {
    if (planos.length === 2) {
      const descartado = planos[rolagem.escolhido === 0 ? 1 : 0];
      descartado.dado.pedra.opacity = 0.28;
      descartado.dado.arestas.material.opacity = 0.15;
    }
    if (rolagem.marca === 'critico') planos[rolagem.escolhido || 0].dado.arestas.material.opacity = 1;

    this.mostrarResultado(palco, rolagem);
  },


  /* ===================================================================
     A BANDEJA (dano, e o d20 quando não há 3D)
     Plaquinhas com o formato de cada dado, que embaralham números
     por meio segundo e param no sorteado.
     =================================================================== */

  rolarBandeja: function (rolagem) {
    const self = this;
    const palco = this.abrirPalco('bandeja', rolagem);
    const fileira = criar('div.fileira-dados');

    const plaquinhas = rolagem.valores.map(function (valor, i) {
      const plaquinha = criar('span.dado-2d.d' + rolagem.faces + (rolagem.escolhido !== undefined && rolagem.valores.length > 1 && i !== rolagem.escolhido ? '.descartado' : ''), '?');
      fileira.appendChild(plaquinha);
      return { el: plaquinha, valor: valor };
    });
    palco.querySelector('.palco-bandeja').appendChild(fileira);

    let voltas = 0;
    this.som(0.6);
    const relogio = setInterval(function () {
      voltas += 1;
      plaquinhas.forEach(function (p) { p.el.textContent = String(1 + Math.floor(Math.random() * rolagem.faces)); });
      if (voltas >= 8) {
        clearInterval(relogio);
        plaquinhas.forEach(function (p) {
          p.el.textContent = String(p.valor);
          p.el.classList.add('parou');
        });
        self.som(0.9);
        self.mostrarResultado(palco, rolagem);
      }
    }, 60);

    this.pular = function () {
      clearInterval(relogio);
      plaquinhas.forEach(function (p) { p.el.textContent = String(p.valor); p.el.classList.add('parou'); });
      self.mostrarResultado(palco, rolagem);
    };
  },


  /* ===================================================================
     O PALCO (o HTML por cima da página) E O RESULTADO
     =================================================================== */

  abrirPalco: function (tipo, rolagem) {
    const self = this;
    const palco = criar('div.palco-dados.' + tipo);
    palco.setAttribute('role', 'dialog');
    palco.setAttribute('aria-label', 'Rolagem: ' + rolagem.texto);

    palco.appendChild(criar('div.' + (tipo === 'd20' ? 'palco-3d' : 'palco-bandeja')));
    palco.appendChild(criar('div.resultado-dados'));
    /* Para o leitor de tela: o resultado em texto, anunciado. */
    const anuncio = criar('div.so-leitor');
    anuncio.setAttribute('aria-live', 'assertive');
    palco.appendChild(anuncio);

    document.body.appendChild(palco);
    this.palco = palco;
    this.mostrouResultado = false;

    /* Clicar ou apertar qualquer tecla: no meio da rolagem, pula para
       o fim; com o resultado na tela, fecha. */
    function aoInteragir(evento) {
      if (evento.type === 'keydown' && evento.key === 'Tab') return;
      if (!self.mostrouResultado) {
        if (self.pular) self.pular();
      } else {
        encerrar(false);
      }
    }
    let temporizador = null;

    function encerrar(imediato) {
      document.removeEventListener('keydown', aoInteragir, true);
      palco.removeEventListener('click', aoInteragir);
      clearTimeout(temporizador);
      if (self.quadro) cancelAnimationFrame(self.quadro);
      self.quadro = null;
      self.pular = null;
      self.fechar = null;
      self.agendarFim = null;
      if (imediato) { palco.remove(); return; }
      palco.classList.add('saindo');
      setTimeout(function () { palco.remove(); }, 220);
    }

    palco.addEventListener('click', aoInteragir);
    document.addEventListener('keydown', aoInteragir, true);
    this.fechar = encerrar;
    this.agendarFim = function (ms) { temporizador = setTimeout(function () { encerrar(false); }, ms); };
    return palco;
  },


  mostrarResultado: function (palco, rolagem) {
    if (this.mostrouResultado) return;
    this.mostrouResultado = true;

    const caixa = palco.querySelector('.resultado-dados');
    const linhas = [criar('div.texto-rolagem', rolagem.texto)];

    linhas.push(criar('div.total-rolagem' + (rolagem.marca ? '.' + rolagem.marca : ''), String(rolagem.total)));
    linhas.push(criar('div.formula-rolagem', rolagem.formula));

    let veredito = '';
    if (rolagem.marca === 'critico' && rolagem.faces === 20) veredito = '20 natural';
    if (rolagem.marca === 'falha' && rolagem.faces === 20) veredito = '1 natural';
    if (rolagem.modo === 'dano' && rolagem.marca === 'critico') veredito = 'Dano crítico';

    /* Com CD: o veredito. No ATAQUE a regra é dura: 20 natural sempre
       acerta (e é crítico), 1 natural sempre erra, seja qual for a CA.
       No teste comum, não: vale o total contra a CD. */
    if (rolagem.ataque && rolagem.marca === 'critico') {
      linhas.push(criar('div.veredito.sucesso', 'Crítico · acerta'));
    } else if (rolagem.ataque && rolagem.marca === 'falha') {
      linhas.push(criar('div.veredito.fracasso', '1 natural · erra'));
    } else if (rolagem.cd) {
      const passou = rolagem.total >= rolagem.cd;
      const contra = rolagem.ataque ? ' · CA ' : ' · CD ';
      const palavra = rolagem.ataque ? (passou ? 'Acerta' : 'Erra') : (passou ? 'Sucesso' : 'Falha');
      linhas.push(criar('div.veredito.' + (passou ? 'sucesso' : 'fracasso'), palavra + contra + rolagem.cd));
    } else if (veredito) {
      linhas.push(criar('div.veredito.' + (rolagem.marca === 'falha' ? 'fracasso' : 'sucesso'), veredito));
    }

    caixa.textContent = '';
    linhas.forEach(function (l) { caixa.appendChild(l); });
    palco.classList.add('pousou');
    if (rolagem.marca) palco.classList.add(rolagem.marca);

    palco.querySelector('.so-leitor').textContent = rolagem.texto + ': ' + rolagem.total
      + (rolagem.cd ? (rolagem.total >= rolagem.cd ? ', sucesso' : ', falha') : '');

    if (this.agendarFim) this.agendarFim(this.ESPERA + (rolagem.modo === 'teste' ? 300 : 0));
  },


  /* ===================================================================
     O SOM — gerado na hora, como os ambientes do audio.js: um estalo
     de ruído filtrado (o dado batendo) e um baque grave (a mesa).
     O AudioContext nasce aqui, num clique, que é quando o navegador
     deixa tocar som.
     =================================================================== */

  som: function (forca) {
    try {
      const Contexto = window.AudioContext || window.webkitAudioContext;
      if (!Contexto) return;
      if (!this.audio) this.audio = new Contexto();
      const ctx = this.audio;
      const agora = ctx.currentTime;
      const volume = 0.18 * Math.max(0.15, forca);

      const tamanho = Math.floor(ctx.sampleRate * 0.05);
      const buffer = ctx.createBuffer(1, tamanho, ctx.sampleRate);
      const amostras = buffer.getChannelData(0);
      for (let i = 0; i < tamanho; i++) amostras[i] = (Math.random() * 2 - 1) * (1 - i / tamanho);

      const estalo = ctx.createBufferSource();
      estalo.buffer = buffer;
      const filtro = ctx.createBiquadFilter();
      filtro.type = 'bandpass';
      filtro.frequency.value = 2400 + Math.random() * 1600;
      filtro.Q.value = 1.4;
      const ganho = ctx.createGain();
      ganho.gain.setValueAtTime(volume, agora);
      ganho.gain.exponentialRampToValueAtTime(0.0001, agora + 0.06);
      estalo.connect(filtro);
      filtro.connect(ganho);
      ganho.connect(ctx.destination);
      estalo.start(agora);

      const baque = ctx.createOscillator();
      baque.type = 'sine';
      baque.frequency.setValueAtTime(140, agora);
      baque.frequency.exponentialRampToValueAtTime(55, agora + 0.09);
      const ganhoBaque = ctx.createGain();
      ganhoBaque.gain.setValueAtTime(volume * 0.9, agora);
      ganhoBaque.gain.exponentialRampToValueAtTime(0.0001, agora + 0.12);
      baque.connect(ganhoBaque);
      ganhoBaque.connect(ctx.destination);
      baque.start(agora);
      baque.stop(agora + 0.13);
    } catch (erro) { /* sem som, a rolagem segue */ }
  }
};
