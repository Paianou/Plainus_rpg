/* ===================================================================
   LANDING 3 — landing.js, o que se mexe na landing da Runlise.

   UM MOMENTO SÓ, BEM FEITO
   O movimento da página é o d20 de pedra. Ele chega na abertura
   girando rápido e vai desacelerando até flutuar; depois gira devagar
   e acompanha o mouse de leve. Nada mais "entra" na tela ao rolar:
   seções que surgem uma a uma são o efeito de qualquer modelo pronto,
   e tirariam a atenção do dado.

   UM DADO SÓ, EM DOIS LUGARES
   O d20 da abertura e o de "Role o dado" são o MESMO objeto 3D. Existe
   um <canvas> só, e ele muda de lugar: fica onde a pessoa está olhando
   (a abertura ou o botão do dado). Além de ser a ideia da página ("o
   dado que você viu lá em cima, agora é a sua vez"), economiza: cada
   <canvas> 3D ocupa memória da placa de vídeo.

   QUANDO NÃO HÁ 3D — e a página continua inteira
     - quem pediu "reduzir movimento" no sistema;
     - aparelho sem WebGL (o 3D do navegador);
     - enquanto o Three.js ainda está chegando (650 KB);
     - se o Three.js não carregar.
   Em todos esses casos fica o d20 DESENHADO que já está no HTML, e o
   botão rola do mesmo jeito: só troca o número, sem animação.

   O 3D vem do mesmo Three.js da mesa (vendor/three.min.js, copiado), e
   o d20 é montado como no dados3d.js da mesa: icosaedro de pedra,
   arestas azuis, número em cada face, faces opostas somando 21.
   =================================================================== */

(function () {
  'use strict';

  const MENOS_MOVIMENTO = window.matchMedia('(prefers-reduced-motion: reduce)');

  const lugarAbertura = document.querySelector('.abertura-d20');
  const botaoD20 = document.getElementById('botaoD20');
  const numeroD20 = document.getElementById('numeroD20');
  const resultadoD20 = document.getElementById('resultadoD20');


  /* ===================================================================
     ROLAR — funciona com e sem 3D
     =================================================================== */

  /* Um número de 1 a 20, sem vício.
     crypto.getRandomValues, e não Math.random: é o sorteio "de verdade"
     do navegador. E o "do ... while" descarta os números do fim da
     faixa: 2^32 não é múltiplo de 20, então sem isso os primeiros
     números sairiam um tiquinho mais que os outros. */
  function sortearD20() {
    const n = new Uint32Array(1);
    const limite = Math.floor(0x100000000 / 20) * 20;
    do { crypto.getRandomValues(n); } while (n[0] >= limite);
    return (n[0] % 20) + 1;
  }

  function frase(valor) {
    if (valor === 20) return '20 natural! Acerto crítico.';
    if (valor === 1) return '1 natural. Falha crítica.';
    return 'Você tirou ' + valor + '.';
  }

  /* O resultado aparece no número desenhado (plano B) e no parágrafo
     com aria-live — que o leitor de tela lê em voz alta. */
  function mostrar(valor) {
    numeroD20.textContent = valor;
    resultadoD20.textContent = frase(valor);
  }

  let rolando = false;
  botaoD20.addEventListener('click', function () {
    if (rolando) return;              /* um clique por rolagem */
    const valor = sortearD20();
    if (Palco.ligado && Palco.lugar === botaoD20) {
      rolando = true;
      resultadoD20.textContent = '';
      Palco.rolar(valor, function () {
        rolando = false;
        mostrar(valor);
      });
    } else {
      mostrar(valor);
    }
  });


  /* ===================================================================
     O PALCO 3D
     =================================================================== */

  const Palco = {
    ligado: false,
    renderer: null,
    cena: null,
    camera: null,
    dado: null,           /* { grupo, faces } */
    lugar: null,          /* onde o <canvas> está agora */
    visivel: false,
    quadro: null,         /* o requestAnimationFrame em curso */

    inicio: 0,            /* quando o dado chegou (a entrada) */
    rolagem: null,        /* a rolagem em curso, se houver */
    pousado: null,        /* a rotação parada no último resultado */
    mouse: { x: 0, y: 0, alvoX: 0, alvoY: 0 },


    montar: function () {
      const THREE = window.THREE;

      this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      /* No máximo 2x: em tela 3x, o custo triplica e ninguém vê diferença. */
      this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.domElement.className = 'd20-3d';
      this.renderer.domElement.setAttribute('aria-hidden', 'true');

      this.cena = new THREE.Scene();
      /* Câmera de frente; a 6.5 de distância, o dado ocupa uns 2/3 do
         quadro. */
      this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
      this.camera.position.set(0, 0, 6.5);

      /* As luzes da mesa: uma geral fraca, uma de cima (a "janela") e
         uma azul de lado — a luz arcana. */
      this.cena.add(new THREE.AmbientLight(0x8090b0, 0.55));
      const cima = new THREE.DirectionalLight(0xffffff, 1.6);
      cima.position.set(-2, 5, 6);
      this.cena.add(cima);
      const arcana = new THREE.PointLight(0x4d8dff, 22, 20);
      arcana.position.set(3.5, -1, 4);
      this.cena.add(arcana);

      this.dado = this.criarD20();
      this.cena.add(this.dado.grupo);
      this.pousado = this.rotacaoFinal(20);
    },


    /* O d20, como no dados3d.js da mesa: o icosaedro de pedra, as
       arestas acesas e uma plaquinha com o número em cada face. */
    criarD20: function () {
      const THREE = window.THREE;
      const RAIO = 1.25;
      const geometria = new THREE.IcosahedronGeometry(RAIO, 0);
      const pos = geometria.attributes.position;

      /* flatShading: cada face lisa, com a própria luz — parece lapidado. */
      const corpo = new THREE.Mesh(geometria, new THREE.MeshStandardMaterial({
        color: 0x1b2030, roughness: 0.42, metalness: 0.35, flatShading: true
      }));
      const arestas = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometria),
        new THREE.LineBasicMaterial({ color: 0x4d8dff, transparent: true, opacity: 0.55 })
      );
      const grupo = new THREE.Group();
      grupo.add(corpo);
      grupo.add(arestas);

      /* Cada face: o centro, para onde aponta (normal) e um vértice
         (para onde o "alto" do número aponta). */
      const faces = [];
      for (let i = 0; i < pos.count; i += 3) {
        const a = new THREE.Vector3().fromBufferAttribute(pos, i);
        const b = new THREE.Vector3().fromBufferAttribute(pos, i + 1);
        const c = new THREE.Vector3().fromBufferAttribute(pos, i + 2);
        const centro = a.clone().add(b).add(c).divideScalar(3);
        faces.push({ centro: centro, normal: centro.clone().normalize(), vertice: a, valor: 0 });
      }

      /* Como num d20 de verdade: faces OPOSTAS somam 21. */
      let proximo = 1;
      faces.forEach(function (f) {
        if (f.valor) return;
        const oposta = faces.find(function (g) { return !g.valor && g !== f && g.normal.dot(f.normal) < -0.99; });
        f.valor = proximo;
        if (oposta) oposta.valor = 21 - proximo;
        proximo += 1;
      });

      const lado = RAIO * 0.52;
      faces.forEach(function (f) {
        const plaquinha = new THREE.Mesh(
          new THREE.PlaneGeometry(lado, lado),
          new THREE.MeshBasicMaterial({ map: Palco.texturaNumero(f.valor), transparent: true, depthWrite: false })
        );
        /* Vira a plaquinha para fora da face e gira até o "alto" do
           número apontar para um vértice. */
        const virar = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), f.normal);
        const altoAtual = new THREE.Vector3(0, 1, 0).applyQuaternion(virar);
        const altoQuerido = f.vertice.clone().sub(f.centro).projectOnPlane(f.normal).normalize();
        const angulo = Math.atan2(altoAtual.clone().cross(altoQuerido).dot(f.normal), altoAtual.dot(altoQuerido));
        const girar = new THREE.Quaternion().setFromAxisAngle(f.normal, angulo);
        plaquinha.quaternion.copy(girar.multiply(virar));
        plaquinha.position.copy(f.centro).addScaledVector(f.normal, 0.01);
        f.alto = altoQuerido;
        grupo.add(plaquinha);
      });

      return { grupo: grupo, faces: faces };
    },


    /* O número desenhado num <canvas> que vira textura. Inter, e não
       Marcellus: na Marcellus o 1 parece I. O 6 e o 9 ganham um
       tracinho — num dado que gira, é o que separa os dois. */
    texturaNumero: function (valor) {
      const THREE = window.THREE;
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
      return textura;
    },


    /* A rotação que deixa a face `valor` de frente, com o número de pé. */
    rotacaoFinal: function (valor) {
      const THREE = window.THREE;
      const face = this.dado.faces.find(function (f) { return f.valor === valor; }) || this.dado.faces[0];
      const frente = new THREE.Quaternion().setFromUnitVectors(face.normal, new THREE.Vector3(0, 0, 1));
      const alto = face.alto.clone().applyQuaternion(frente);
      const dePe = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.atan2(alto.x, alto.y));
      return dePe.multiply(frente);
    },


    /* Põe o <canvas> dentro de um lugar e acerta o tamanho. A classe
       .com-3d no lugar esconde o desenho (CSS) e mostra o 3D. */
    colocarEm: function (lugar) {
      if (this.lugar === lugar) return;
      if (this.lugar) this.lugar.classList.remove('com-3d');
      this.lugar = lugar;
      lugar.appendChild(this.renderer.domElement);
      this.ajustar();
      lugar.classList.add('com-3d');
      /* No botão, o dado chega parado no último número que saiu. */
      if (lugar === botaoD20) {
        this.dado.grupo.quaternion.copy(this.pousado);
        this.dado.grupo.scale.setScalar(1);
      }
    },

    ajustar: function () {
      if (!this.lugar) return;
      const caixa = this.lugar.getBoundingClientRect();
      const lado = Math.max(1, Math.round(Math.min(caixa.width, caixa.height)));
      /* false: o tamanho NA TELA vem do CSS (100%); aqui só a resolução. */
      this.renderer.setSize(lado, lado, false);
      this.camera.aspect = 1;
      this.camera.updateProjectionMatrix();
    },


    /* Liga e desliga o laço de desenho: só gira quando há alguém vendo.
       Fora da tela, 60 quadros por segundo gastariam bateria à toa. */
    animar: function () {
      const self = this;
      if (this.quadro || !this.visivel) return;
      function quadro(agora) {
        if (!self.visivel) { self.quadro = null; return; }
        self.desenhar(agora);
        self.quadro = requestAnimationFrame(quadro);
      }
      this.quadro = requestAnimationFrame(quadro);
    },


    desenhar: function (agora) {
      const THREE = window.THREE;
      const grupo = this.dado.grupo;
      const t = agora / 1000;

      if (this.rolagem) {
        this.passoDaRolagem(agora);
      } else if (this.lugar === lugarAbertura) {
        /* A ENTRADA: nos primeiros 1,6 s o dado chega girando rápido,
           crescendo, e desacelera (easeOutCubic) até o giro calmo. */
        if (!this.inicio) this.inicio = agora;
        const e = Math.min(1, (agora - this.inicio) / 1600);
        const suave = 1 - Math.pow(1 - e, 3);
        grupo.scale.setScalar(0.7 + 0.3 * suave);
        const extra = (1 - suave) * Math.PI * 3;

        /* O mouse puxa o dado um pouco (suavizado: anda 6% por quadro
           na direção do alvo, para não tremer). */
        const m = this.mouse;
        m.x += (m.alvoX - m.x) * 0.06;
        m.y += (m.alvoY - m.y) * 0.06;

        grupo.rotation.set(t * 0.11 + m.y * 0.5, t * 0.23 + extra + m.x * 0.6, 0);
        grupo.position.y = Math.sin(t * 0.9) * 0.06;      /* flutua */
      } else {
        /* No botão, parado no resultado, só balançando de leve. */
        grupo.quaternion.copy(this.pousado);
        grupo.rotateY(Math.sin(t * 0.8) * 0.06);
        grupo.position.y = 0;
      }

      this.renderer.render(this.cena, this.camera);
    },


    /* A rolagem: gira solto em volta de um eixo sorteado, cada vez
       mais devagar, e no fim desliza até a face sorteada — a mesma
       ideia do dados3d.js da mesa. O resultado já foi sorteado: a
       animação só ENCENA. */
    rolar: function (valor, terminou) {
      const THREE = window.THREE;
      this.rolagem = {
        comeco: null,
        duracao: 1300,
        inicio: this.dado.grupo.quaternion.clone(),
        fim: this.rotacaoFinal(valor),
        eixo: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
        voltas: (2.5 + Math.random()) * Math.PI * 2,
        terminou: terminou
      };
      this.pousado = this.rolagem.fim;
    },

    passoDaRolagem: function (agora) {
      const THREE = window.THREE;
      const r = this.rolagem;
      const grupo = this.dado.grupo;
      if (r.comeco === null) r.comeco = agora;
      const e = Math.min(1, (agora - r.comeco) / r.duracao);
      const suave = 1 - Math.pow(1 - e, 3);

      const solto = new THREE.Quaternion().setFromAxisAngle(r.eixo, r.voltas * suave).multiply(r.inicio);
      const chegada = Math.max(0, Math.min(1, (e - 0.5) / 0.45));
      const mistura = chegada * chegada * (3 - 2 * chegada);      /* smoothstep */
      grupo.quaternion.copy(solto).slerp(r.fim, mistura);
      grupo.position.y = Math.sin(Math.PI * e) * 0.35 * (1 - e);   /* um pulinho */

      if (e >= 1) {
        grupo.position.y = 0;
        this.rolagem = null;
        r.terminou();
      }
    },


    /* O dado saiu da tela (ou a aba foi para trás) no meio de uma
       rolagem: termina na hora, no resultado. Sem isto, o laço parado
       deixaria a rolagem "pendurada" — sem número e sem o aviso do
       leitor de tela — até o dado voltar a aparecer. */
    concluirRolagem: function () {
      if (!this.rolagem) return;
      const r = this.rolagem;
      this.rolagem = null;
      this.dado.grupo.quaternion.copy(r.fim);
      this.dado.grupo.position.y = 0;
      r.terminou();
    },


    /* Volta tudo para o desenho (quem passou a pedir menos movimento
       com a página aberta, ou o 3D quebrou). */
    desligar: function () {
      this.ligado = false;
      this.visivel = false;
      if (this.lugar) this.lugar.classList.remove('com-3d');
      if (this.renderer) this.renderer.domElement.remove();
      this.lugar = null;
      this.concluirRolagem();
    }
  };


  /* ===================================================================
     LIGAR O 3D — só quando faz sentido
     =================================================================== */

  function temWebGL() {
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch (erro) {
      return false;
    }
  }

  /* O Three.js tem 650 KB. Ele só começa a chegar DEPOIS que a página
     carregou (o evento 'load'), e ainda espera o navegador ficar
     ocioso: quem tem internet lenta lê o texto enquanto o dado vem. */
  function carregarThree(pronto) {
    const script = document.createElement('script');
    script.src = 'vendor/three.min.js';
    script.onload = pronto;
    document.head.appendChild(script);
  }

  function ligar3D() {
    if (MENOS_MOVIMENTO.matches || !temWebGL() || !lugarAbertura) return;
    carregarThree(function () {
      /* document.fonts.ready: espera a Inter chegar, senão os números
         das faces seriam desenhados na fonte reserva. */
      document.fonts.ready.then(function () {
        if (MENOS_MOVIMENTO.matches) return;
        try {
          Palco.montar();
        } catch (erro) {
          return;     /* algo no 3D falhou: fica o desenho */
        }
        Palco.ligado = true;
        /* O navegador pode DERRUBAR o 3D (pouca memória de vídeo, placa
           reiniciada). Aí o <canvas> ficaria em branco: volta o desenho. */
        Palco.renderer.domElement.addEventListener('webglcontextlost', function () { Palco.desligar(); });
        observarLugares();
      });
    });
  }

  /* O <canvas> vai para o lugar que está na tela. IntersectionObserver
     avisa quando um elemento entra ou sai da área visível — sem ficar
     medindo a cada rolagem da página. */
  function observarLugares() {
    const vendo = new Map();
    const observador = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) { vendo.set(e.target, e.isIntersecting); });
      if (!Palco.ligado) return;
      const alvo = vendo.get(botaoD20) ? botaoD20 : (vendo.get(lugarAbertura) ? lugarAbertura : null);
      Palco.visivel = !!alvo && !document.hidden;
      if (!Palco.visivel) Palco.concluirRolagem();
      if (alvo && !Palco.rolagem) Palco.colocarEm(alvo);
      Palco.animar();
    });
    observador.observe(lugarAbertura);
    observador.observe(botaoD20);

    /* Aba em segundo plano: para. Voltou: continua. */
    document.addEventListener('visibilitychange', function () {
      Palco.visivel = !document.hidden && !!Palco.lugar;
      if (!Palco.visivel) Palco.concluirRolagem();
      Palco.animar();
    });

    /* Mudou o tamanho da janela: refaz a resolução do <canvas>. */
    window.addEventListener('resize', function () { Palco.ajustar(); });
  }

  /* O mouse, de -0.5 a 0.5 em cada eixo (o centro da tela é 0). */
  window.addEventListener('pointermove', function (e) {
    Palco.mouse.alvoX = e.clientX / window.innerWidth - 0.5;
    Palco.mouse.alvoY = e.clientY / window.innerHeight - 0.5;
  });

  /* Quem liga "reduzir movimento" com a página aberta: o 3D sai. */
  MENOS_MOVIMENTO.addEventListener('change', function () {
    if (MENOS_MOVIMENTO.matches) Palco.desligar();
  });

  function quandoOcioso(fazer) {
    if ('requestIdleCallback' in window) window.requestIdleCallback(fazer, { timeout: 2000 });
    else setTimeout(fazer, 300);
  }
  if (document.readyState === 'complete') quandoOcioso(ligar3D);
  else window.addEventListener('load', function () { quandoOcioso(ligar3D); });


  /* ===================================================================
     O VÍDEO DA MESA
     Toca sozinho só para quem não pediu menos movimento, e só enquanto
     está na tela. O botão pausa e continua; quem pediu menos movimento
     vê a foto (o poster) e um botão "Assistir".
     =================================================================== */
  const video = document.querySelector('.demonstracao video');
  const botaoVideo = document.getElementById('botaoVideo');
  if (video && botaoVideo) {
    /* No celular, a versão com as duas telas uma em cima da outra.
       Trocada ANTES de qualquer download (preload="none"): o navegador
       só baixa uma das duas. */
    if (window.matchMedia('(max-width: 720px)').matches) {
      video.poster = 'midia/lado-a-lado-celular.webp';
      video.width = 800; video.height = 1008;
      video.querySelectorAll('source').forEach(function (s) { s.src = s.getAttribute('src').replace('mesa.', 'mesa-celular.'); });
      video.load();
    }
    /* O botão da página assume: os controles do navegador saem. */
    video.controls = false;
    /* Quem pausou com o botão continua pausado: o vídeo não volta a
       tocar sozinho só porque a pessoa rolou a página. */
    let pausadoPelaPessoa = MENOS_MOVIMENTO.matches;
    let naTela = false;

    function atualizarBotao() {
      botaoVideo.textContent = video.paused ? (video.currentTime > 0 ? 'Continuar' : 'Assistir') : 'Pausar';
    }
    function tocarSePuder() {
      if (naTela && !pausadoPelaPessoa) video.play().catch(function () {});
      else video.pause();
    }

    botaoVideo.hidden = false;
    botaoVideo.addEventListener('click', function () {
      pausadoPelaPessoa = !video.paused;
      if (video.paused) video.play().catch(function () {});
      else video.pause();
    });
    video.addEventListener('play', atualizarBotao);
    video.addEventListener('pause', atualizarBotao);
    atualizarBotao();

    new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) { naTela = e.isIntersecting; });
      tocarSePuder();
    }).observe(video);

    /* Ligou "reduzir movimento" com a página aberta: o vídeo para,
       como o dado. */
    MENOS_MOVIMENTO.addEventListener('change', function () {
      if (MENOS_MOVIMENTO.matches) { pausadoPelaPessoa = true; video.pause(); }
    });
  }
})();
