/* ===================================================================
   bichos.js — as silhuetas das criaturas.

   POR QUE ISTO EXISTE
   Um token no mapa mostrava a inicial do nome. Só que a inicial é
   gerada por `nome.charAt(0)` (mapas.js), então "Aparição" e "Aranha"
   viravam o mesmo "A" — dois círculos vermelhos idênticos no meio de
   um combate. A silhueta resolve de vez: um lobo não se confunde com
   uma aranha nem de relance.

   POR QUE SILHUETA CHEIA, E NÃO TRAÇO
   O icones.js é tudo em traço que herda a cor do texto, e isso
   continua valendo para a INTERFACE. Aqui é outro problema: no mapa o
   token tem 34 px, e um contorno de 1,6 px de um lobo nesse tamanho
   vira borrão. Forma sólida lê; contorno não. Então estas são formas
   cheias que herdam a cor por `fill: currentColor` — mesmo princípio
   do icones.js, execução diferente porque o tamanho pede.

   O ALVO DE LEITURA
   Cada desenho foi feito para ser reconhecido a 34 px, não para ser
   bonito a 200. O que se lê nesse tamanho é a SILHUETA: quantas
   pernas, se está de pé ou de quatro, se tem asa, se é bloco ou
   massa. Detalhe fino foi deixado de fora de propósito.

   Grade 24 × 24, a mesma do icones.js.

   Uso:
     Bicho.svg('lobo', 20)        -> um <svg> pronto para a interface
     Bicho.noMapa('lobo', 26)     -> um <g> para enfiar dentro do mapa
     Bicho.para('Carniçal de Armadura')  -> 'carnical'
   =================================================================== */

const Bicho = {

  /* ---------- Os desenhos ----------
     Alguns usam fill-rule="evenodd": os buracos (órbitas do crânio, os
     olhos do fantasma) são subcaminhos que PERFURAM a forma. Sem isso
     eles teriam de ser pintados da cor do fundo — e o fundo muda
     conforme o token seja azul, vermelho ou cinza. */
  formas: {

    /* Quadrúpede miúdo, focinho pontudo, rabo comprido. */
    rato:
      '<ellipse cx="10.4" cy="14" rx="6" ry="3.6"/>' +
      '<ellipse cx="16.8" cy="12.6" rx="3.4" ry="2.8"/>' +
      '<circle cx="16.2" cy="9.6" r="1.8"/>' +
      '<path d="M19.8 12.1 L23 13.4 L19.8 14.6 Z"/>' +
      '<rect x="7" y="16.8" width="1.7" height="3.6" rx=".85"/>' +
      '<rect x="12" y="16.8" width="1.7" height="3.6" rx=".85"/>' +
      '<path d="M4.6 14.8 C1.9 15.8 1.6 18.6 3.4 20.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',

    /* Quadrúpede maior, orelha em pé, rabo erguido. */
    lobo:
      '<ellipse cx="10.6" cy="12.2" rx="5.8" ry="3.2"/>' +
      '<path d="M14.8 10.4 L17.8 8.4 L22.6 9.4 L22.6 11.6 L18.6 12.4 L16.4 13.8 Z"/>' +
      '<path d="M17.2 8.6 L16.8 4.8 L19.8 7.4 Z"/>' +
      '<rect x="6.4" y="14.8" width="1.7" height="5.8" rx=".85"/>' +
      '<rect x="9.4" y="14.8" width="1.7" height="5.8" rx=".85"/>' +
      '<rect x="13.2" y="14.8" width="1.7" height="5.8" rx=".85"/>' +
      '<path d="M5.2 11.4 L1.4 8.4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',

    /* Corpo em dois bulbos e oito pernas em leque. */
    aranha:
      '<ellipse cx="12" cy="14.2" rx="4.3" ry="3.6"/>' +
      '<circle cx="12" cy="9.4" r="2.5"/>' +
      '<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M8.6 10.8 L4.6 7 M8 13 L2.6 12.2 M8.4 15.6 L3.6 17.8 M9.8 17.2 L7.4 21.4"/>' +
      '<path d="M15.4 10.8 L19.4 7 M16 13 L21.4 12.2 M15.6 15.6 L20.4 17.8 M14.2 17.2 L16.6 21.4"/>' +
      '</g>',

    /* Gente de pé. Serve para bandido, cultista e qualquer humanoide
       sem marca própria. */
    humanoide:
      '<circle cx="12" cy="5.2" r="2.9"/>' +
      '<path d="M12 9 C8.6 9 7 11.3 6.6 14.6 L8.8 15.2 L9.2 21.5 L14.8 21.5 L15.2 15.2 L17.4 14.6 C17 11.3 15.4 9 12 9 Z"/>',

    /* Mais largo que o humanoide, e com as presas para baixo. */
    orc:
      '<path d="M10.6 2.4 C8 2.4 6.7 4.3 6.7 6.3 C6.7 8.3 8.2 9.8 10.6 9.8 C13 9.8 14.5 8.3 14.5 6.3 C14.5 4.3 13.2 2.4 10.6 2.4 Z"/>' +
      '<path d="M10.6 10.6 C6.2 10.6 4.2 13 3.8 16.4 L6.6 17 L7 21.6 L14.2 21.6 L14.6 17 L17.4 16.4 C17 13 15 10.6 10.6 10.6 Z"/>' +
      '<path d="M19.4 4.4 L19.4 21.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
      '<path d="M19.4 5 C22.4 5.6 23.6 8.2 22.8 11 L19.4 9.8 Z"/>',

    /* Crânio com órbitas vazadas, coluna e costelas. */
    esqueleto:
      '<path fill-rule="evenodd" d="M7.3 6.6 a4.7 4.7 0 1 0 9.4 0 a4.7 4.7 0 1 0 -9.4 0 Z' +
      'M8.85 6 a1.35 1.35 0 1 0 2.7 0 a1.35 1.35 0 1 0 -2.7 0 Z' +
      'M12.45 6 a1.35 1.35 0 1 0 2.7 0 a1.35 1.35 0 1 0 -2.7 0 Z"/>' +
      '<rect x="10.2" y="10.6" width="3.6" height="2" rx=".6"/>' +
      '<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">' +
      '<path d="M12 13 L12 20.8"/>' +
      '<path d="M8.6 14.4 H15.4 M8.2 17 H15.8 M8.8 19.6 H15.2"/>' +
      '</g>',

    /* Cabeça tombada e os dois braços esticados para a frente. */
    zumbi:
      '<circle cx="13.4" cy="5" r="2.8"/>' +
      '<path d="M13.4 8.6 C10.6 8.6 9.2 10.8 9 14 L10.2 14.4 L10.4 21.5 L15.8 21.5 L16.2 14.4 L17.6 14 C17.4 10.8 16.2 8.6 13.4 8.6 Z"/>' +
      '<g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">' +
      '<path d="M9.6 11.6 L3 12.6 M9.8 13.8 L3.6 15.2"/>' +
      '</g>',

    /* Encurvado, magro, com as garras à frente. */
    carnical:
      '<circle cx="16.4" cy="8.6" r="2.6"/>' +
      '<path d="M15.6 11 C12 10.4 9 12.6 8.6 16.4 L10.4 16.8 L9.6 21.6 L15 21.6 L15.8 16.6 ' +
      'C17.6 15.6 18.4 13.6 17.8 11.8 Z"/>' +
      '<g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">' +
      '<path d="M8.8 14.6 L4 15.8 M8.4 16.6 L3.6 17.8 M9 18.4 L4.4 19.8"/>' +
      '</g>',

    /* Vulto sem pernas, barra de baixo ondulada, olhos vazados. */
    fantasma:
      '<path fill-rule="evenodd" d="M12 2.2 C8.1 2.2 5.8 5.2 5.8 9 L5.8 19.8 C5.8 20.9 7 21.3 7.7 20.4 ' +
      'L9.1 18.7 L10.6 20.4 C11.3 21.2 12.7 21.2 13.4 20.4 L14.9 18.7 L16.3 20.4 C17 21.3 18.2 20.9 18.2 19.8 ' +
      'L18.2 9 C18.2 5.2 15.9 2.2 12 2.2 Z' +
      'M8.7 8.6 a1.4 1.4 0 1 0 2.8 0 a1.4 1.4 0 1 0 -2.8 0 Z' +
      'M12.5 8.6 a1.4 1.4 0 1 0 2.8 0 a1.4 1.4 0 1 0 -2.8 0 Z"/>',

    /* Elmo com a fresta vazia e o peitoral — ninguém dentro. */
    armadura:
      '<path fill-rule="evenodd" d="M12 2.2 C9.1 2.2 7.2 4.3 7.2 7.3 L7.2 10.6 L16.8 10.6 L16.8 7.3 ' +
      'C16.8 4.3 14.9 2.2 12 2.2 Z' +
      'M9.1 6.2 L14.9 6.2 L14.9 8.3 L9.1 8.3 Z"/>' +
      '<path d="M6.8 11.8 L17.2 11.8 L16.1 17.6 L12 21.6 L7.9 17.6 Z"/>',

    /* Blocos empilhados: cabeça, tronco, dois braços, duas pernas. */
    golem:
      '<rect x="8.6" y="2.6" width="6.8" height="5.4" rx="1"/>' +
      '<rect x="6.6" y="9" width="10.8" height="7.4" rx="1.4"/>' +
      '<rect x="3.4" y="9.6" width="2.6" height="6.2" rx="1.1"/>' +
      '<rect x="18" y="9.6" width="2.6" height="6.2" rx="1.1"/>' +
      '<rect x="7.8" y="17.4" width="3.2" height="4.2" rx=".9"/>' +
      '<rect x="13" y="17.4" width="3.2" height="4.2" rx=".9"/>',

    /* Massa irregular: sem cabeça nem membros, só rocha. */
    elemental:
      '<path d="M12 2.4 L16.6 5.2 L18.8 4.4 L18 8.8 L21.4 12.2 L17.8 14.4 L18.2 19.4 ' +
      'L13.6 18.2 L11 21.6 L8.4 18 L4.4 19.2 L5.2 14.2 L2.4 11.4 L6 8.6 L5.4 4.2 L9.2 5.6 Z"/>',

    /* Corpo largo, cabeça pequena, clava no ombro. */
    ogro:
      '<circle cx="11.6" cy="4.6" r="2.6"/>' +
      '<path d="M11.6 7.6 C6.8 7.6 4.3 10.6 4.1 15.2 L6.5 15.8 L6.9 21.6 L16.3 21.6 L16.7 15.8 L19.1 15.2 ' +
      'C18.9 10.6 16.4 7.6 11.6 7.6 Z"/>' +
      '<path d="M17.4 8.4 L21.4 3.6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',

    /* Magro e curvado, com os braços chegando ao chão. */
    troll:
      '<circle cx="13.2" cy="4.4" r="2.5"/>' +
      '<path d="M13.2 7.4 C10.5 7.4 9 9.6 8.8 13.4 L10 14 L9.6 21.6 L15.2 21.6 L15.6 14 L17.2 13.4 ' +
      'C17 9.6 15.9 7.4 13.2 7.4 Z"/>' +
      '<g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">' +
      '<path d="M9.4 10.6 C5.4 12.2 4.2 16.2 5 20.6"/>' +
      '<path d="M16.8 10.6 C20 12.6 20.8 16.8 19.8 20.6"/>' +
      '</g>',

    /* Asa erguida acima do dorso, pescoço em S, cauda arrastando. */
    dragao:
      '<path d="M5 15.6 C5 12.6 8.4 11.2 11.6 11.4 C13 11.4 14.2 11.6 15.2 12.1 L17.6 8.8 ' +
      'C18 8.2 17.6 7.3 16.8 7.3 L18.6 5.4 L21.2 6.6 L22.2 9.2 L19.8 10.6 ' +
      'C19.6 13.2 18 15.8 15.4 17 C12 18.6 7.6 18.1 5 15.6 Z"/>' +
      '<path d="M11.2 11.6 L7.4 3 L16.8 7.6 Z"/>' +
      '<path d="M5.4 15.9 C3.4 17.3 2.5 19.1 2.3 21.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>'
  },


  /* ---------- De nome de criatura para desenho ----------
     A tabela é explícita de propósito. Dava para adivinhar tudo por
     palavra-chave, mas aí "Armadura Animada" e "Carniçal de Armadura"
     — que são bichos diferentes — cairiam no mesmo desenho. */
  porNome: {
    'Rato Gigante': 'rato',
    'Bandido': 'humanoide',
    'Cultista': 'humanoide',
    'Esqueleto': 'esqueleto',
    'Zumbi': 'zumbi',
    'Lobo': 'lobo',
    'Orc': 'orc',
    'Carniçal': 'carnical',
    'Aranha Gigante': 'aranha',
    'Armadura Animada': 'armadura',
    'Espectro': 'fantasma',
    'Ogro': 'ogro',
    'Aparição': 'fantasma',
    'Troll': 'troll',
    'Elemental da Terra': 'elemental',
    'Dragão Branco Jovem': 'dragao',
    'Golem de Pedra': 'golem'
  },


  /* Último recurso, quando o nome não está na tabela: o TIPO da ficha
     ainda diz alguma coisa. Um morto-vivo desconhecido como esqueleto
     é melhor que uma letra. */
  porTipo: {
    'Morto-vivo': 'esqueleto',
    'Fera': 'lobo',
    'Humanoide': 'humanoide',
    'Constructo': 'golem',
    'Gigante': 'ogro',
    'Elemental': 'elemental',
    'Dragão': 'dragao'
  },


  /* Resolve o desenho de uma criatura.

     `nome` pode vir temperado — no combate, um monstro do bestiário
     vira "Aparição Sombria Alpha". Por isso, depois da tabela exata,
     procuramos o nome de bestiário mais LONGO que seja começo deste.
     O mais longo, e não o primeiro, para "Rato Gigante" não perder
     para um eventual "Rato". */
  para: function (nome, tipo) {
    if (!nome) return null;
    if (this.porNome[nome]) return this.porNome[nome];

    let melhor = null;
    Object.keys(this.porNome).forEach(function (chave) {
      if (nome.indexOf(chave) === 0 && (!melhor || chave.length > melhor.length)) {
        melhor = chave;
      }
    });
    if (melhor) return this.porNome[melhor];

    return (tipo && this.porTipo[tipo]) || null;
  },


  /* Um <svg> solto, para usar na interface como se fosse um ícone. */
  svg: function (chave, tamanho) {
    const forma = this.formas[chave];
    if (!forma) return null;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'silhueta');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', tamanho || 18);
    svg.setAttribute('height', tamanho || 18);
    svg.setAttribute('aria-hidden', 'true');

    /* Desenho fixo, escrito neste arquivo — nunca vem de fora. Mesma
       justificativa do icones.js para o innerHTML. */
    svg.innerHTML = forma;
    return svg;
  },


  /* A caixa que cada desenho ocupa de verdade, medida uma vez.

     Nenhum desenho preenche a grade 24 x 24 inteira, e quase nenhum
     está centrado nela: o carniçal tem a massa à direita, o orc
     carrega um machado na borda. Centrar pelo MEIO DA GRADE deixa a
     silhueta encostada num lado do token. Centrar pela caixa real
     resolve para todos — inclusive para desenhos que eu acrescentar
     depois, sem ter de acertar a mão. */
  caixas: {},

  caixaDe: function (chave) {
    if (this.caixas[chave]) return this.caixas[chave];

    const NS = 'http://www.w3.org/2000/svg';
    const regua = document.createElementNS(NS, 'svg');
    regua.setAttribute('viewBox', '0 0 24 24');
    regua.setAttribute('width', 24);
    regua.setAttribute('height', 24);
    /* Fora da vista, mas dentro do documento: getBBox() precisa que o
       elemento esteja renderizado para responder. */
    regua.setAttribute('style', 'position:absolute;left:-9999px;top:0');
    regua.innerHTML = this.formas[chave];
    document.body.appendChild(regua);

    let caixa;
    try {
      const b = regua.getBBox();
      caixa = { x: b.x, y: b.y, largura: b.width, altura: b.height };
    } catch (erro) {
      caixa = { x: 0, y: 0, largura: 24, altura: 24 };   /* nunca some por causa disto */
    }
    regua.remove();

    this.caixas[chave] = caixa;
    return caixa;
  },


  /* Um <g> para enfiar DENTRO do SVG do mapa, centrado em (0,0) e
     escalado para caber num quadrado de `lado` unidades.

     Não dá para reaproveitar o svg() aqui: um <svg> aninhado tem
     sistema de coordenadas próprio e ignoraria o translate do token.
     O <g> obedece. */
  noMapa: function (chave, lado) {
    const forma = this.formas[chave];
    if (!forma) return null;

    const NS = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(NS, 'g');
    const caixa = this.caixaDe(chave);

    /* A escala sai do lado MAIOR, para o desenho caber inteiro. */
    const escala = lado / Math.max(caixa.largura, caixa.altura);
    const meioX = caixa.x + caixa.largura / 2;
    const meioY = caixa.y + caixa.altura / 2;

    g.setAttribute('transform',
      'scale(' + escala + ') translate(' + (-meioX) + ',' + (-meioY) + ')');
    g.innerHTML = forma;
    return g;
  }
};
