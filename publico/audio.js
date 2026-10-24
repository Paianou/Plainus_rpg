/* ===================================================================
   audio.js — o som ambiente, gerado na hora

   Não existe nenhum arquivo de música no projeto. Cada pista é MONTADA
   pelo navegador com a Web Audio API, a partir de três ingredientes:

     oscilador   uma onda pura (o zumbido da cripta, o corpo do tambor)
     ruído       chiado aleatório; filtrado vira vento, chuva, fogo
     filtro      deixa passar só uma faixa de frequências — é o que
                 transforma o mesmo chiado em vento (médios) ou em
                 trovão (só graves)

   Pense no AudioContext como uma mesa de som: você cria aparelhos
   (nós), liga um no outro com connect(), e o último vai para a caixa
   de som. O caminho de toda pista é:

     fontes → filtros → saida da pista → mestre (volume) → caixa de som

   Cada pista tem a SUA saída. É o que permite trocar de pista com
   fade: a antiga desce, a nova sobe, sem corte seco.


   A REGRA DO NAVEGADOR
   Nenhuma página pode tocar som sozinha: o navegador exige um gesto de
   quem está nela (um clique, uma tecla). Por isso, ao trocar de tela, o
   som para e volta no primeiro clique. É também por isso que o
   AudioContext só nasce em liberar(), chamado por um clique.


   COMO AS TELAS USAM
   Ninguém manda "toque isto". A tela muda Estado.audio (pela ação
   ajustarAudio, no acoes.js) e chama Som.aplicar(), que faz o som bater
   com o Estado. É o mesmo padrão do resto do projeto: o Estado manda,
   a saída obedece.

     Acoes.executar('ajustarAudio', { tocando: false });
     Som.aplicar();

   Depois de aplicar(), dispara o evento 'plainus:audio' no document,
   para quem desenha algo de áudio (a barra, o painel) se redesenhar.

   NO PAINEL DO JOGADOR não existe Estado (ele recebe só a visão). Lá,
   Som.origem aponta para uma função que diz o que tocar — a pista que
   o Mestre escolheu, vinda do servidor (visao.js), e o "silenciar" do
   próprio jogador. Sem origem, vale o Estado do Mestre.
   =================================================================== */

const Som = {

  /* Nome da pista (como aparece na tela e fica salvo no Estado)
     → método que a monta, mais abaixo. */
  PISTAS: {
    'Cripta dos Ancestrais (loop)': 'cripta',
    'Taverna Sombria (ambiente)':   'taverna',
    'Vento nas Ruínas':             'vento',
    'Tambores de Guerra':           'tambores',
    'Chuva sobre Valkoria':         'chuva'
  },

  origem: null,       /* no jogador: function → { pista, tocando, volume } */
  ctx: null,          /* o AudioContext — a mesa de som */
  mestre: null,       /* o volume geral, último aparelho antes da caixa */
  ruido: null,        /* 4 s de chiado, reaproveitado por todas as pistas */
  atual: null,        /* a pista tocando agora, ou null */
  liberado: false,


  /* ---------- O que as telas chamam ---------- */

  disponivel: function () {
    return !!(window.AudioContext || window.webkitAudioContext);
  },

  /* O que o mestre OUVE agora — não o que o Estado pede. Antes do
     primeiro clique, o Estado pode dizer "tocando" e nada soar. */
  tocando: function () {
    return this.atual !== null;
  },

  /* Chamado num clique. Pode ser chamado mil vezes: só age na primeira. */
  liberar: function () {
    if (this.liberado || !this.disponivel()) return;

    const Contexto = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Contexto();

    this.mestre = this.ctx.createGain();
    this.mestre.gain.value = 0;
    this.mestre.connect(this.ctx.destination);

    /* Ruído branco: cada amostra é um número aleatório entre -1 e 1.
       Um buffer só, tocado em loop e de pontos de partida diferentes,
       basta para todos os chiados. */
    const tamanho = this.ctx.sampleRate * 4;
    this.ruido = this.ctx.createBuffer(1, tamanho, this.ctx.sampleRate);
    const amostras = this.ruido.getChannelData(0);
    for (let i = 0; i < tamanho; i++) amostras[i] = Math.random() * 2 - 1;

    this.liberado = true;
    this.aplicar();
  },

  /* O que tocar: o Estado do Mestre, ou a origem do jogador. */
  pedido: function () {
    return this.origem ? this.origem() : Estado.audio;
  },

  /* Faz o som bater com o pedido (Estado.audio, no Mestre). */
  aplicar: function () {
    if (this.liberado) {
      const audio = this.pedido();
      this.ajustarVolume();

      if (!audio.tocando) {
        this.pararAtual();
      } else if (!this.atual || this.atual.pista !== audio.pista) {
        this.pararAtual();
        this.atual = this.comecar(audio.pista);
      }
    }

    document.dispatchEvent(new CustomEvent('plainus:audio'));
  },

  /* Separado de aplicar() porque a barra de volume chama isto a cada
     milímetro arrastado — e ninguém precisa se redesenhar por isso. */
  ajustarVolume: function () {
    if (!this.liberado) return;
    /* O ouvido não é linear: 50% na barra com ganho 0,5 soa quase tão
       alto quanto 100%. Elevar ao quadrado deixa a barra "justa". */
    const alvo = Math.pow(this.pedido().volume / 100, 2);
    /* setTargetAtTime desliza até o valor em vez de pular — pular
       o volume de uma vez faz um estalo. */
    this.mestre.gain.setTargetAtTime(alvo, this.ctx.currentTime, 0.08);
  },


  /* ---------- Ligar e desligar pistas ---------- */

  comecar: function (pista) {
    const metodo = this.PISTAS[pista] || 'cripta';

    const faixa = {
      pista: pista,
      saida: this.ctx.createGain(),
      fontes: [],       /* o que precisa de stop() no fim */
      relogios: []      /* os setInterval dos eventos (gotas, batidas) */
    };

    faixa.saida.gain.value = 0;
    faixa.saida.connect(this.mestre);
    faixa.saida.gain.setTargetAtTime(1, this.ctx.currentTime, 0.8);   /* entra devagar */

    this[metodo](faixa);
    return faixa;
  },

  pararAtual: function () {
    const faixa = this.atual;
    if (!faixa) return;
    this.atual = null;

    faixa.relogios.forEach(clearInterval);
    faixa.saida.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);   /* sai devagar */

    /* Só desliga de vez depois do fade. Esquecer isto deixaria os
       osciladores rodando mudos para sempre, comendo processador. */
    setTimeout(function () {
      faixa.fontes.forEach(function (fonte) {
        try { fonte.stop(); } catch (erro) { /* já parado */ }
      });
      faixa.saida.disconnect();
    }, 2500);
  },


  /* ---------- Peças de montar ---------- */

  ganho: function (valor) {
    const g = this.ctx.createGain();
    g.gain.value = valor;
    return g;
  },

  filtro: function (tipo, frequencia, q) {
    const f = this.ctx.createBiquadFilter();
    f.type = tipo;
    f.frequency.value = frequencia;
    if (q) f.Q.value = q;
    return f;
  },

  /* Fonte contínua: toca até a pista parar. */
  oscilador: function (faixa, tipo, frequencia) {
    const osc = this.ctx.createOscillator();
    osc.type = tipo;
    osc.frequency.value = frequencia;
    osc.start();
    faixa.fontes.push(osc);
    return osc;
  },

  chiado: function (faixa) {
    const fonte = this.ctx.createBufferSource();
    fonte.buffer = this.ruido;
    fonte.loop = true;
    fonte.start(0, Math.random() * 4);
    faixa.fontes.push(fonte);
    return fonte;
  },

  /* LFO: um oscilador lento demais para ouvir, usado para MEXER num
     botão de outro aparelho — abrir e fechar um filtro, por exemplo.
     É o que tira o som do "parado": o vento sobe e desce sozinho. */
  lfo: function (faixa, frequencia, profundidade, parametro) {
    const g = this.ganho(profundidade);
    this.oscilador(faixa, 'sine', frequencia).connect(g);
    g.connect(parametro);
  },

  /* Eco de caverna: o som volta atrasado e mais fraco, e volta de
     novo, cada vez mais abafado. Devolve a ENTRADA do eco. */
  eco: function (faixa, tempo, retorno) {
    const entrada = this.ganho(1);
    const atraso = this.ctx.createDelay(2);
    atraso.delayTime.value = tempo;
    const abafa = this.filtro('lowpass', 1800);
    const volta = this.ganho(retorno);

    entrada.connect(atraso);
    atraso.connect(abafa);
    abafa.connect(volta);
    volta.connect(atraso);          /* o laço que faz o eco repetir */
    abafa.connect(faixa.saida);
    return entrada;
  },

  /* Som curto de chiado filtrado: estalo de lenha, pingo, pele do
     tambor, trovão. Nasce, toca e some sozinho. */
  pulsoRuido: function (destino, t, o) {
    const fonte = this.ctx.createBufferSource();
    fonte.buffer = this.ruido;

    const filtro = this.filtro(o.filtro, o.freq, o.q);
    const envelope = this.ctx.createGain();
    const ataque = o.ataque || 0.003;

    envelope.gain.setValueAtTime(0, t);
    envelope.gain.linearRampToValueAtTime(o.volume, t + ataque);
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + ataque + o.duracao);

    fonte.connect(filtro);
    filtro.connect(envelope);
    envelope.connect(destino);
    fonte.start(t, Math.random() * 3);
    fonte.stop(t + ataque + o.duracao + 0.05);
  },

  /* Som curto de oscilador com o tom escorregando de 'de' para 'ate':
     subindo vira gota d'água; descendo vira tambor. */
  nota: function (destino, t, o) {
    const osc = this.ctx.createOscillator();
    osc.type = o.tipo || 'sine';
    osc.frequency.setValueAtTime(o.de, t);
    osc.frequency.exponentialRampToValueAtTime(o.ate, t + o.curva);

    const envelope = this.ctx.createGain();
    envelope.gain.setValueAtTime(0, t);
    envelope.gain.linearRampToValueAtTime(o.volume, t + 0.004);
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + o.duracao);

    osc.connect(envelope);
    envelope.connect(destino);
    osc.start(t);
    osc.stop(t + o.duracao + 0.05);
  },

  /* Repete um evento para sempre (até a pista parar).

     Por que não um setTimeout simples para cada batida? Porque o
     setTimeout atrasa alguns milissegundos quando o navegador está
     ocupado, e num tambor o ouvido percebe. Aqui o relógio de JS só
     ACORDA a cada 200 ms e agenda, no relógio do áudio (que é exato),
     tudo o que cai no próximo 1,5 s. O atraso do JS deixa de importar.

     intervalo(): quanto esperar até o próximo evento (pode sortear)
     tocar(t):    agenda o evento para o instante t */
  repetir: function (faixa, intervalo, tocar, espera) {
    const ctx = this.ctx;
    let proximo = ctx.currentTime + (espera || 0.1);

    const relogio = setInterval(function () {
      /* Aba ficou muito tempo em segundo plano: não despeja tudo o que
         "perdeu" de uma vez, só retoma daqui. */
      if (proximo < ctx.currentTime) proximo = ctx.currentTime + 0.05;

      while (proximo < ctx.currentTime + 1.5) {
        tocar(proximo);
        proximo += intervalo();
      }
    }, 200);

    faixa.relogios.push(relogio);
  },

  entre: function (min, max) {
    return min + Math.random() * (max - min);
  },


  /* ===================================================================
     AS PISTAS
     Cada uma recebe a faixa e liga seus aparelhos em faixa.saida.
     Os números de volume são a olho (a ouvido): o total de cada pista
     fica perto de 0,5, para nenhuma estourar quando o volume está no máximo.
     =================================================================== */

  /* Zumbido grave que respira, ar parado e gotas com eco. */
  cripta: function (faixa) {
    const self = this;

    /* Duas ondas QUASE iguais (55 e 55,4 Hz) se somam e se anulam
       em ciclo: o som "pulsa" sozinho, devagar. */
    const abafa = this.filtro('lowpass', 180, 1);
    const grave = this.ganho(0.16);
    grave.connect(abafa);
    abafa.connect(faixa.saida);
    this.oscilador(faixa, 'sawtooth', 55).connect(grave);
    this.oscilador(faixa, 'sawtooth', 55.4).connect(grave);
    this.oscilador(faixa, 'sine', 82.5).connect(grave);
    this.lfo(faixa, 0.05, 60, abafa.frequency);      /* abre e fecha a cada 20 s */

    const ar = this.ganho(0.05);
    const arFiltro = this.filtro('lowpass', 320);
    this.chiado(faixa).connect(arFiltro);
    arFiltro.connect(ar);
    ar.connect(faixa.saida);

    const eco = this.eco(faixa, 0.33, 0.4);
    this.repetir(faixa, function () { return self.entre(1.5, 5); }, function (t) {
      const altura = self.entre(900, 1700);
      const opcoes = { de: altura, ate: altura * 1.8, curva: 0.06, duracao: 0.22, volume: 0.1 };
      self.nota(faixa.saida, t, opcoes);
      self.nota(eco, t, opcoes);
    });
  },

  /* Fogo de lareira, murmúrio de gente e, às vezes, canecas. */
  taverna: function (faixa) {
    const self = this;

    const fogo = this.filtro('lowpass', 160);
    const fogoVolume = this.ganho(0.3);
    this.chiado(faixa).connect(fogo);
    fogo.connect(fogoVolume);
    fogoVolume.connect(faixa.saida);

    const murmurio = this.filtro('bandpass', 450, 0.8);
    const murmurioVolume = this.ganho(0.06);
    this.chiado(faixa).connect(murmurio);
    murmurio.connect(murmurioVolume);
    murmurioVolume.connect(faixa.saida);
    this.lfo(faixa, 0.3, 0.03, murmurioVolume.gain);

    /* Estalos de lenha: rajadas curtíssimas, agudas e irregulares. */
    this.repetir(faixa, function () { return self.entre(0.04, 0.45); }, function (t) {
      self.pulsoRuido(faixa.saida, t, {
        filtro: 'highpass', freq: self.entre(1500, 4000),
        volume: self.entre(0.03, 0.2), duracao: self.entre(0.005, 0.03)
      });
    });

    /* Caneca batendo: duas notas agudas que não formam acorde — é
       essa "desafinação" que soa como metal, e não como sino. */
    this.repetir(faixa, function () { return self.entre(6, 14); }, function (t) {
      self.nota(faixa.saida, t, { de: 2400, ate: 2380, curva: 0.3, duracao: 0.35, volume: 0.03 });
      self.nota(faixa.saida, t, { de: 3150, ate: 3120, curva: 0.3, duracao: 0.25, volume: 0.02 });
    }, 3);
  },

  /* Chiado que passa por um filtro que se move: é isso o vento. */
  vento: function (faixa) {
    const self = this;

    const banda = this.filtro('bandpass', 500, 1.2);
    const rajada = this.ganho(0.12);
    this.chiado(faixa).connect(banda);
    banda.connect(rajada);
    rajada.connect(faixa.saida);
    this.lfo(faixa, 0.08, 300, banda.frequency);

    /* Assobio: filtro estreitíssimo (Q alto) deixa passar quase um tom só. */
    const assobio = this.filtro('bandpass', 1200, 18);
    const assobioVolume = this.ganho(0.12);
    this.chiado(faixa).connect(assobio);
    assobio.connect(assobioVolume);
    assobioVolume.connect(faixa.saida);
    this.lfo(faixa, 0.05, 250, assobio.frequency);

    /* Rajadas: o volume sobe e desce em momentos sorteados. */
    this.repetir(faixa, function () { return self.entre(4, 9); }, function (t) {
      rajada.gain.setTargetAtTime(self.entre(0.3, 0.5), t, 0.8);
      rajada.gain.setTargetAtTime(0.1, t + self.entre(1.2, 2.2), 1.2);
    });
  },

  /* Tambores em marcha sobre um grave contínuo. */
  tambores: function (faixa) {
    const self = this;

    const fundo = this.ganho(0.08);
    fundo.connect(faixa.saida);
    this.oscilador(faixa, 'sine', 41).connect(fundo);
    this.oscilador(faixa, 'sine', 61.5).connect(fundo);

    /* 16 passos; o número é a força da batida (0 = silêncio). */
    const ritmo = [1, 0, 0, .6, .8, 0, 0, 0, 1, 0, .5, 0, .8, 0, .4, .4];
    const passo = 60 / 84 / 2;         /* 84 batidas por minuto, em colcheias */
    let i = 0;

    this.repetir(faixa, function () { return passo; }, function (t) {
      const forca = ritmo[i % ritmo.length];
      const acento = i % 16 === 0;
      i++;
      if (!forca) return;

      /* O corpo: tom que cai rápido — é a pele vibrando e afrouxando. */
      self.nota(faixa.saida, t, {
        de: acento ? 120 : 150, ate: 45, curva: 0.25, duracao: 0.6, volume: forca * 0.55
      });
      /* O ataque: um tapa curto de chiado, a baqueta batendo. */
      self.pulsoRuido(faixa.saida, t, {
        filtro: 'lowpass', freq: 900, volume: forca * 0.18, duracao: 0.08
      });
    });
  },

  /* Chiado largo (a chuva), pingos soltos e trovão ao longe. */
  chuva: function (faixa) {
    const self = this;

    const agudo = this.filtro('highpass', 900);
    const teto = this.filtro('lowpass', 7000);
    const chuvaVolume = this.ganho(0.18);
    this.chiado(faixa).connect(agudo);
    agudo.connect(teto);
    teto.connect(chuvaVolume);
    chuvaVolume.connect(faixa.saida);

    const corpo = this.filtro('lowpass', 400);
    const corpoVolume = this.ganho(0.1);
    this.chiado(faixa).connect(corpo);
    corpo.connect(corpoVolume);
    corpoVolume.connect(faixa.saida);

    this.repetir(faixa, function () { return self.entre(0.02, 0.12); }, function (t) {
      self.pulsoRuido(faixa.saida, t, {
        filtro: 'bandpass', freq: self.entre(3000, 6000), q: 2,
        volume: self.entre(0.02, 0.06), duracao: 0.012
      });
    });

    /* Trovão: só os graves do chiado, subindo devagar e sumindo
       mais devagar ainda. A espera inicial evita trovejar no play. */
    this.repetir(faixa, function () { return self.entre(14, 30); }, function (t) {
      self.pulsoRuido(faixa.saida, t, {
        filtro: 'lowpass', freq: 110, volume: self.entre(0.5, 0.9),
        ataque: 0.4, duracao: self.entre(3, 5)
      });
    }, 6);
  }
};
