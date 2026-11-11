/* ===================================================================
   mesa3d.js — a mesa em 3D (fase 2: a mesa, a folha, a grade e as
   paredes; a câmera livre). Ver MESA3D.md.

   A IDEIA
   Uma cena é uma mesa física. O tampo é de ardósia; sobre ele, a folha
   do mapa (a imagem da cena, ou pedra escura quando não há imagem); a
   grade desenhada sobre a folha; as paredes pintadas no 2D erguidas
   como blocos. A câmera é a cabeça de quem olha a mesa: gira, inclina,
   aproxima e desliza, dentro de limites (não passa por baixo do tampo).

   AS UNIDADES
   1 célula = 1 unidade do 3D. A coluna vira X, a linha vira Z (o
   "para baixo" do mapa 2D é o "para a frente" da mesa), e Y é a
   altura. O canto da célula (0, 0) é a origem — exatamente como o SVG
   do 2D, só que deitado. Assim as contas de célula são as mesmas nos
   dois desenhos.

   DESENHA SÓ QUANDO ALGO MUDA
   Um jogo 3D redesenha 60 vezes por segundo. Uma mesa não precisa: ela
   só muda quando a câmera se mexe ou a cena muda. Por isso o desenho é
   "sob demanda": cada mudança pede UM quadro, e enquanto a câmera está
   parada nada é desenhado. Numa sessão de três horas, é a diferença
   entre o celular quente com a bateria no fim e o celular frio.

   ESTE ARQUIVO É UM MÓDULO (<script type="module">): só assim ele
   importa o Three.js e o OrbitControls de vendor/three/. O mapas.js,
   que é script comum, fala com ele por window.Mesa3D.

   O QUE AINDA NÃO ESTÁ AQUI (as próximas fases)
     3  a grade calibrada sobre a imagem (cena.grade) — hoje a imagem é
        esticada sobre a grade, como no 2D
     4–5  as figuras (os modelos .glb), selecionar, arrastar, girar
     6  o jogador em 3D
   =================================================================== */

import * as THREE from './vendor/three/three.module.min.js';
import { OrbitControls } from './vendor/three/OrbitControls.js';

/* As medidas da mesa, em células. */
const MARGEM_TAMPO = 3;          /* quanto o tampo sobra em volta da folha */
const ESPESSURA_TAMPO = 0.35;
const ALTURA_PAREDE = 1.4;       /* ~2,1 m: mais alta que uma figura média */
const INCLINACAO_INICIAL = 52;   /* graus a partir da vertical: "sentado à mesa" */

/* As cores da identidade (DESIGN.md): ardósia e pedra, e o azul arcano. */
const COR_TAMPO = 0x1b1e24;
const COR_FOLHA_SEM_IMAGEM = 0x0e1116;
const COR_PAREDE = 0x23262d;
const COR_AZUL = 0x4d8dff;
const COR_FUNDO = 0x08090b;

const MENOS_MOVIMENTO = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');


const Mesa3D = {

  /* --- o que fica montado entre um desenho e outro --- */
  renderer: null,
  cena3d: null,
  camera: null,
  controles: null,
  canvas: null,
  caixa: null,             /* o elemento onde o <canvas> mora (o quadro do mapa) */
  observador: null,        /* ResizeObserver: a caixa mudou de tamanho */
  botoes: null,            /* "De cima" e "Enquadrar" */

  /* --- as peças da cena --- */
  tampo: null,
  folha: null,
  grade: null,
  paredes: null,           /* InstancedMesh */
  luzes: null,
  texturas: new Map(),     /* url → THREE.Texture, para não baixar duas vezes */

  /* --- o que está desenhado --- */
  cenaId: null,
  colunas: 0,
  linhas: 0,
  imagemAtual: null,
  quadroPedido: false,
  rodando: false,
  perdeu: null,            /* o que fazer se o navegador derrubar o 3D */


  /* ===================================================================
     TEM 3D? — a mesma pergunta do dados3d.js
     =================================================================== */
  disponivel: function () {
    if (this._disponivel !== undefined) return this._disponivel;
    let ok = false;
    try {
      const teste = document.createElement('canvas');
      ok = !!(teste.getContext('webgl2') || teste.getContext('webgl'));
    } catch (erro) { ok = false; }
    this._disponivel = ok;
    return ok;
  },


  /* ===================================================================
     MOSTRAR — monta na primeira vez, atualiza nas seguintes

     mostrar(caixa, cena, { grade: true/false, aoPerder: fn })
     A caixa é o quadro do mapa (mapas.js põe o <canvas> ao lado do SVG,
     que fica escondido enquanto o 3D está ligado).
     =================================================================== */
  mostrar: function (caixa, cena, opcoes) {
    if (!this.disponivel()) return false;
    opcoes = opcoes || {};
    this.perdeu = opcoes.aoPerder || null;

    if (!this.renderer) this.montar(caixa);
    if (this.caixa !== caixa) {
      this.caixa = caixa;
      caixa.appendChild(this.canvas);
      caixa.appendChild(this.botoes);
      this.observarTamanho();
    }
    this.canvas.hidden = false;
    this.botoes.hidden = false;

    const trocouDeCena = cena.id !== this.cenaId;
    this.atualizar(cena, opcoes);
    this.ajustarTamanho();
    /* Cena nova na mesa: a câmera enquadra. Na mesma cena, quem olha
       continua olhando de onde estava — redesenhar não "puxa" a câmera. */
    if (trocouDeCena) this.enquadrar();
    this.pedirQuadro();
    return true;
  },


  esconder: function () {
    if (!this.renderer) return;
    this.canvas.hidden = true;
    this.botoes.hidden = true;
  },


  /* ===================================================================
     MONTAR — uma vez só. Criar um contexto WebGL a cada redesenho
     vazaria memória da placa de vídeo (o dados3d.js tem o mesmo cuidado).
     =================================================================== */
  montar: function (caixa) {
    const self = this;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    /* No máximo 2x: em tela 3x o custo triplica e ninguém vê diferença. */
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setClearColor(COR_FUNDO, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    /* ACES: o mesmo "filme" dos jogos — as luzes fortes não estouram em
       branco, escurecem com graça. É o que dá o ar de mesa real. */
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.canvas = this.renderer.domElement;
    this.canvas.className = 'mesa-3d';
    this.canvas.setAttribute('role', 'img');
    /* O navegador pode derrubar o 3D (pouca memória de vídeo): avisa
       quem chamou, que volta para o 2D. */
    this.canvas.addEventListener('webglcontextlost', function (evento) {
      evento.preventDefault();
      if (self.perdeu) self.perdeu();
    });

    this.cena3d = new THREE.Scene();
    this.cena3d.background = new THREE.Color(COR_FUNDO);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);

    /* A câmera: OrbitControls — gira em volta de um ponto (o alvo), com
       o botão esquerdo; aproxima com a roda (ou pinça); desliza com o
       botão direito (ou dois dedos). zoomToCursor: a roda aproxima o
       ponto sob o mouse, não o centro — é como se inclinar sobre a mesa. */
    this.controles = new OrbitControls(this.camera, this.canvas);
    this.controles.enableDamping = !(MENOS_MOVIMENTO && MENOS_MOVIMENTO.matches);
    this.controles.dampingFactor = 0.08;
    this.controles.screenSpacePanning = false;   /* deslizar segue o tampo, não a tela */
    this.controles.zoomToCursor = true;
    this.controles.minPolarAngle = 0;
    this.controles.maxPolarAngle = THREE.MathUtils.degToRad(85);   /* nunca por baixo do tampo */
    this.controles.addEventListener('start', function () { self.animar(); });
    this.controles.addEventListener('change', function () { self.pedirQuadro(); });

    this.montarLuzes();
    this.botoes = this.montarBotoes();

    caixa.appendChild(this.canvas);
    caixa.appendChild(this.botoes);
    this.caixa = caixa;
    this.observarTamanho();
  },


  /* As luzes: uma do céu (fria, azulada, com o chão escuro), uma
     "janela" de cima com sombra, e a luz arcana azul de um canto — a
     mesma receita do d20 (dados3d.js), em escala de mesa. */
  montarLuzes: function () {
    const ceu = new THREE.HemisphereLight(0x9fb4ff, 0x0a0c10, 0.55);

    const janela = new THREE.DirectionalLight(0xffffff, 2.4);
    janela.castShadow = true;
    janela.shadow.mapSize.set(2048, 2048);
    janela.shadow.bias = -0.0005;
    janela.shadow.normalBias = 0.02;

    const arcana = new THREE.PointLight(COR_AZUL, 40, 0, 2);

    this.luzes = { ceu: ceu, janela: janela, arcana: arcana };
    this.cena3d.add(ceu, janela, janela.target, arcana);
  },


  /* Os botões sobre o quadro. Botões comuns, com os ícones da mesa. */
  montarBotoes: function () {
    const self = this;
    const barra = document.createElement('div');
    barra.className = 'controles-3d';
    [
      ['deCima', 'mapa', 'De cima'],
      ['enquadrar', 'expandir', 'Enquadrar']
    ].forEach(function (b) {
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'mini-botao';
      if (typeof Icone !== 'undefined') botao.appendChild(Icone.svg(b[1], 14));
      botao.appendChild(document.createTextNode(b[2]));
      botao.addEventListener('click', function () { self[b[0]](); });
      barra.appendChild(botao);
    });
    return barra;
  },


  /* ===================================================================
     ATUALIZAR — a cena mudou (ou é outra): refaz só o que mudou
     =================================================================== */
  atualizar: function (cena, opcoes) {
    opcoes = opcoes || {};
    const colunas = Math.max(1, cena.colunas | 0);
    const linhas = Math.max(1, cena.linhas | 0);
    const mudouTamanho = colunas !== this.colunas || linhas !== this.linhas;
    this.colunas = colunas;
    this.linhas = linhas;
    this.cenaId = cena.id;

    if (mudouTamanho) {
      this.montarTampo();
      this.montarFolha();
      this.montarGrade();
      this.posicionarLuzes();
      this.limitarCamera();
    }

    /* imagemDaCena e Icone são "const" de scripts comuns: moram no escopo
       global, mas NÃO em window — por isso typeof, e não window.x. */
    const imagem = (typeof imagemDaCena === 'function' ? imagemDaCena(cena) : null) || null;
    if (imagem !== this.imagemAtual || mudouTamanho) this.vestirFolha(imagem);

    if (this.grade) this.grade.visible = opcoes.grade !== false;
    this.montarParedes(cena.paredes || []);
    this.canvas.setAttribute('aria-label', 'Mesa em 3D da cena ' + cena.nome + '. Arraste para girar, use a roda para aproximar, o botão direito para deslizar.');
    this.pedirQuadro();
  },


  /* O tampo de ardósia: um bloco maior que a folha, com a face de cima
     logo abaixo de y = 0 (onde a folha deita). */
  montarTampo: function () {
    if (this.tampo) { this.cena3d.remove(this.tampo); this.tampo.geometry.dispose(); }
    const largura = this.colunas + MARGEM_TAMPO * 2;
    const fundo = this.linhas + MARGEM_TAMPO * 2;
    const geometria = new THREE.BoxGeometry(largura, ESPESSURA_TAMPO, fundo);
    if (!this.materialTampo) {
      this.materialTampo = new THREE.MeshStandardMaterial({ color: COR_TAMPO, roughness: 0.92, metalness: 0.05 });
    }
    this.tampo = new THREE.Mesh(geometria, this.materialTampo);
    this.tampo.position.set(this.colunas / 2, -ESPESSURA_TAMPO / 2 - 0.01, this.linhas / 2);
    this.tampo.receiveShadow = true;
    this.cena3d.add(this.tampo);
  },


  /* A folha do mapa: um plano do tamanho exato da grade, deitado. */
  montarFolha: function () {
    if (this.folha) { this.cena3d.remove(this.folha); this.folha.geometry.dispose(); }
    const geometria = new THREE.PlaneGeometry(this.colunas, this.linhas);
    if (!this.materialFolha) {
      this.materialFolha = new THREE.MeshStandardMaterial({ color: COR_FOLHA_SEM_IMAGEM, roughness: 0.95, metalness: 0 });
    }
    this.folha = new THREE.Mesh(geometria, this.materialFolha);
    this.folha.rotation.x = -Math.PI / 2;            /* deita o plano */
    this.folha.position.set(this.colunas / 2, 0, this.linhas / 2);
    this.folha.receiveShadow = true;
    this.cena3d.add(this.folha);
  },


  /* A imagem da cena vira a textura da folha. Sem imagem, pedra escura.
     Fase 3: a calibração (cena.grade) vai mapear só a parte jogável da
     imagem sobre a grade; hoje ela é esticada inteira, como no 2D. */
  vestirFolha: function (imagem) {
    const self = this;
    this.imagemAtual = imagem;
    const material = this.materialFolha;
    if (!imagem) {
      material.map = null;
      material.color.setHex(COR_FOLHA_SEM_IMAGEM);
      material.needsUpdate = true;
      this.pintarGrade(false);
      return;
    }
    material.color.setHex(0xffffff);
    this.pintarGrade(true);

    const pronta = function (textura) {
      if (self.imagemAtual !== imagem) return;     /* a cena já trocou */
      material.map = textura;
      material.needsUpdate = true;
      self.pedirQuadro();
    };
    if (this.texturas.has(imagem)) { pronta(this.texturas.get(imagem)); return; }
    new THREE.TextureLoader().load(imagem, function (textura) {
      textura.colorSpace = THREE.SRGBColorSpace;
      /* Anisotropia: a textura continua nítida vista de raspão — é o
         ângulo normal de quem olha uma mesa. */
      textura.anisotropy = self.renderer.capabilities.getMaxAnisotropy();
      self.texturas.set(imagem, textura);
      pronta(textura);
    });
  },


  /* A grade: linhas de verdade (LineSegments), um fio acima da folha.
     Uma linha WebGL tem sempre 1 pixel, em qualquer zoom — é a
     "espessura constante" que uma grade pintada na textura não teria. */
  montarGrade: function () {
    if (this.grade) { this.cena3d.remove(this.grade); this.grade.geometry.dispose(); }
    const pontos = [];
    const y = 0.004;
    for (let c = 0; c <= this.colunas; c++) pontos.push(c, y, 0, c, y, this.linhas);
    for (let l = 0; l <= this.linhas; l++) pontos.push(0, y, l, this.colunas, y, l);
    const geometria = new THREE.BufferGeometry();
    geometria.setAttribute('position', new THREE.Float32BufferAttribute(pontos, 3));
    if (!this.materialGrade) {
      this.materialGrade = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.07, depthWrite: false });
    }
    this.grade = new THREE.LineSegments(geometria, this.materialGrade);
    this.cena3d.add(this.grade);
  },

  /* Sobre imagem a grade é escura (a de .07 branca sumiria); sem
     imagem, clara e discreta — os mesmos tons do 2D. */
  pintarGrade: function (sobreImagem) {
    if (!this.materialGrade) return;
    this.materialGrade.color.setHex(sobreImagem ? 0x000000 : 0xffffff);
    this.materialGrade.opacity = sobreImagem ? 0.35 : 0.07;
  },


  /* As paredes: UM objeto para todas (InstancedMesh). Cada parede do 2D
     é [coluna, linha, largura, altura] em células; aqui vira um bloco
     esticado — mil paredes custam o mesmo que uma. Quando a quantidade
     muda, o objeto é refeito (a quantidade de instâncias é fixa). */
  montarParedes: function (paredes) {
    const quantas = paredes.length;
    if (!this.paredes || this.paredes.count !== quantas) {
      if (this.paredes) { this.cena3d.remove(this.paredes); this.paredes.dispose(); }
      if (!quantas) { this.paredes = null; return; }
      if (!this.geometriaParede) this.geometriaParede = new THREE.BoxGeometry(1, ALTURA_PAREDE, 1);
      if (!this.materialParede) this.materialParede = new THREE.MeshStandardMaterial({ color: COR_PAREDE, roughness: 0.85, metalness: 0.08 });
      this.paredes = new THREE.InstancedMesh(this.geometriaParede, this.materialParede, quantas);
      this.paredes.castShadow = true;
      this.paredes.receiveShadow = true;
      this.cena3d.add(this.paredes);
    }
    const matriz = new THREE.Matrix4();
    const posicao = new THREE.Vector3();
    const escala = new THREE.Vector3();
    const giro = new THREE.Quaternion();
    paredes.forEach(function (p, i) {
      const largura = Math.max(0.001, p[2]), fundo = Math.max(0.001, p[3]);
      posicao.set(p[0] + largura / 2, ALTURA_PAREDE / 2, p[1] + fundo / 2);
      escala.set(largura, 1, fundo);
      matriz.compose(posicao, giro, escala);
      this.paredes.setMatrixAt(i, matriz);
    }, this);
    this.paredes.instanceMatrix.needsUpdate = true;
  },


  /* As luzes acompanham o tamanho da mesa: a "janela" vem de cima e de
     um lado, e a sombra dela cobre o tampo inteiro (câmera ortográfica
     da sombra = a área que recebe sombra; fora dela, nada sombreia). */
  posicionarLuzes: function () {
    const maior = Math.max(this.colunas, this.linhas);
    const cx = this.colunas / 2, cz = this.linhas / 2;
    const janela = this.luzes.janela;
    janela.position.set(cx - maior * 0.45, maior * 1.3, cz + maior * 0.55);
    janela.target.position.set(cx, 0, cz);
    const alcance = maior * 0.75 + MARGEM_TAMPO;
    janela.shadow.camera.left = -alcance;
    janela.shadow.camera.right = alcance;
    janela.shadow.camera.top = alcance;
    janela.shadow.camera.bottom = -alcance;
    janela.shadow.camera.near = 0.5;
    janela.shadow.camera.far = maior * 4;
    janela.shadow.camera.updateProjectionMatrix();
    /* A luz arcana: perto do canto de cima à direita, baixa, para lamber
       a folha de lado. Intensidade cresce com a mesa (decai com a
       distância ao quadrado). */
    this.luzes.arcana.position.set(this.colunas + 2, 2.5, -1.5);
    this.luzes.arcana.intensity = 6 * maior;
  },


  /* ===================================================================
     A CÂMERA
     =================================================================== */

  /* A distância de "enquadrar": a que faz a folha caber na tela, no
     eixo mais apertado (vertical ou horizontal, conforme a proporção
     do quadro). R é o raio da esfera que envolve a folha. */
  distanciaParaCaber: function () {
    const R = Math.sqrt(this.colunas * this.colunas + this.linhas * this.linhas) / 2;
    const fovV = THREE.MathUtils.degToRad(this.camera.fov);
    const fovH = 2 * Math.atan(Math.tan(fovV / 2) * this.camera.aspect);
    /* A esfera sobra em volta de um retângulo deitado (os cantos de
       cima dela estão vazios): 0.82 aproxima sem cortar a folha. */
    return R / Math.sin(Math.min(fovV, fovH) / 2) * 0.82;
  },

  limitarCamera: function () {
    const maior = Math.max(this.colunas, this.linhas);
    this.controles.minDistance = 1.2;
    this.controles.maxDistance = Math.max(12, maior * 4);
  },

  /* Sentado à mesa: inclinada, olhando a folha inteira. */
  enquadrar: function () {
    const alvo = new THREE.Vector3(this.colunas / 2, 0, this.linhas / 2);
    const d = this.distanciaParaCaber();
    const inclinacao = THREE.MathUtils.degToRad(INCLINACAO_INICIAL);
    this.controles.target.copy(alvo);
    this.camera.position.set(alvo.x, Math.cos(inclinacao) * d, alvo.z + Math.sin(inclinacao) * d);
    this.camera.lookAt(alvo);
    this.controles.update();
    this.pedirQuadro();
  },

  /* De cima, como o 2D — para quem quer medir e planejar. */
  deCima: function () {
    const alvo = new THREE.Vector3(this.colunas / 2, 0, this.linhas / 2);
    const d = this.distanciaParaCaber();
    this.controles.target.copy(alvo);
    /* Um fio fora da vertical: exatamente em cima, "para onde é o
       norte" fica indefinido e a câmera pode virar de repente. */
    this.camera.position.set(alvo.x, d, alvo.z + 0.001 * d);
    this.camera.lookAt(alvo);
    this.controles.update();
    this.pedirQuadro();
  },

  /* O alvo (o ponto em volta do qual a câmera gira) não sai do tampo:
     deslizar para longe deixaria a mesa fora da tela sem volta. */
  prenderAlvo: function () {
    const t = this.controles.target;
    const folga = MARGEM_TAMPO;
    t.x = THREE.MathUtils.clamp(t.x, -folga, this.colunas + folga);
    t.z = THREE.MathUtils.clamp(t.z, -folga, this.linhas + folga);
    t.y = 0;
  },


  /* ===================================================================
     TAMANHO — o <canvas> ocupa a largura do quadro, com a proporção de
     uma mesa vista de frente (16:10), entre um mínimo e um máximo.
     =================================================================== */
  observarTamanho: function () {
    const self = this;
    if (this.observador) this.observador.disconnect();
    if (!('ResizeObserver' in window)) return;
    this.observador = new ResizeObserver(function () { self.ajustarTamanho(); });
    this.observador.observe(this.caixa);
  },

  ajustarTamanho: function () {
    if (!this.caixa || this.canvas.hidden) return;
    const largura = Math.max(1, Math.round(this.caixa.clientWidth));
    const altura = Math.round(THREE.MathUtils.clamp(largura * 0.625, 320, 760));
    /* false: o tamanho NA TELA é do CSS (width 100%); aqui, a resolução. */
    this.renderer.setSize(largura, altura, false);
    this.canvas.style.height = altura + 'px';
    this.camera.aspect = largura / altura;
    this.camera.updateProjectionMatrix();
    this.pedirQuadro();
  },


  /* ===================================================================
     DESENHAR — sob demanda
     =================================================================== */
  pedirQuadro: function () {
    if (this.quadroPedido || !this.renderer) return;
    this.quadroPedido = true;
    const self = this;
    requestAnimationFrame(function () {
      self.quadroPedido = false;
      self.desenhar();
    });
  },

  desenhar: function () {
    if (!this.renderer || this.canvas.hidden) return;
    this.prenderAlvo();
    this.renderer.render(this.cena3d, this.camera);
  },

  /* Enquanto a câmera "desliza" (o amortecimento do OrbitControls), ela
     continua se mexendo depois que o mouse parou: um laço desenha até
     update() dizer que nada mudou. Fora disso, nenhum laço roda. */
  animar: function () {
    if (this.rodando) return;
    this.rodando = true;
    const self = this;
    function laco() {
      const mudou = self.controles.update();
      if (mudou) { self.desenhar(); requestAnimationFrame(laco); }
      else self.rodando = false;
    }
    requestAnimationFrame(laco);
  }
};

window.Mesa3D = Mesa3D;
/* Quem estava esperando (o mapas.js desenha o botão "Ver em 3D"). */
document.dispatchEvent(new CustomEvent('runlise:mesa3d'));
