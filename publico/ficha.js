/* ===================================================================
   ficha.js — as contas da ficha de personagem

   "Ficha que calcula": o jogador escreve o que está no papel (raça,
   classe, nível, atributos, em que perícias é treinado, que armadura
   veste) e TUDO o que é consequência sai daqui — modificadores, bônus
   de proficiência, perícias, salvaguardas, CA, iniciativa, Percepção
   passiva, PV máximo.

   Nada aqui desenha tela. São funções que recebem a ficha e devolvem
   números. Por isso o mesmo arquivo serve ao painel do jogador (que
   mostra a ficha dele) e pode servir ao do Mestre (que mostra a de
   todos) — e as duas telas nunca vão discordar de quanto dá a CA.

   POR QUE NÃO GUARDAR O RESULTADO
   Guardar "Furtividade +5" junto do "Destreza 16" seria guardar a
   mesma informação duas vezes; no dia em que a Destreza subir, a
   Furtividade guardada estaria errada. A única exceção é o RESUMO que
   vai para Estado.herois (ver resumoDoHeroi): as telas do Mestre já
   leem ca, pvMax, pp de lá, e ele é recalculado a cada vez que a
   ficha é salva — nunca digitado.


   A FICHA (heroi.ficha)
     raca, classe, nivel, dadoVida          a classe principal
     classe2, nivel2, dadoVida2             só se a campanha deixar multiclasse
     antecedente, alinhamento
     metodo                                 como os atributos foram gerados
     base:  { for, des, con, int, sab, car }   o valor "comprado" ou rolado
     bonus: { for, des, ... }                  raça, antecedente, talentos
     rolados: [6 números]                   só no método rolagem
     salvaguardas: ['for', 'con']           as treinadas
     pericias: ['Atletismo', ...]           as treinadas
     armadura, escudo, caExtra, deslocamento
     pvRolado                               PV máximo, só no método "rolado"
     idiomas, equipamento, talentos, personalidade, historia

     ataques: [{ nome, atributo, proficiente, dano, tipo, bonus, doItem? }]
     atributoMagia, espacos, espacosGastos, magias, concentrando
     preparaMagias, preparadas             quem prepara magias a cada dia
     recursos: [{ nome, total, gastos, recarga: 'curto' | 'longo' }]
     moedas: { pl, po, pe, pp, pc }   itens: [...]   (ver Inventário)
     notas: [{ id, titulo, texto, quando }]   o caderno do jogador

   Os "gastos" (espaços, recursos) e a concentração mudam DURANTE a
   sessão, com um clique na ficha; o resto muda no "Editar ficha".
   Fichas criadas antes destes campos não os têm — quem lê usa
   `|| []` e `|| {}`.

   Precisa do regras.js carregado antes (PERICIAS, ARMADURAS, etc.).
   =================================================================== */

const Ficha = {

  /* ---------- Nível e proficiência ---------- */

  /* Com multiclasse, o nível do PERSONAGEM é a soma das duas classes —
     é ele que decide a proficiência. */
  nivelTotal: function (f) {
    return (Number(f.nivel) || 1) + (f.classe2 ? Number(f.nivel2) || 0 : 0);
  },

  /* +2 nos níveis 1–4, +3 no 5–8, ... +6 no 17–20. */
  proficiencia: function (f) {
    return 2 + Math.floor((Math.max(1, this.nivelTotal(f)) - 1) / 4);
  },


  /* ---------- Atributos ---------- */

  valor: function (f, chave) {
    return (Number(f.base[chave]) || 0) + (Number(f.bonus[chave]) || 0);
  },

  mod: function (f, chave) {
    return modificador(this.valor(f, chave));
  },

  salvaguarda: function (f, chave) {
    const treinada = (f.salvaguardas || []).indexOf(chave) !== -1;
    return this.mod(f, chave) + (treinada ? this.proficiencia(f) : 0);
  },

  /* `nome` é o da lista PERICIAS (regras.js), que diz o atributo. */
  pericia: function (f, nome) {
    const par = PERICIAS.find(function (p) { return p[0] === nome; });
    if (!par) return 0;
    const treinada = (f.pericias || []).indexOf(nome) !== -1;
    return this.mod(f, par[1]) + (treinada ? this.proficiencia(f) : 0);
  },

  percepcaoPassiva: function (f) {
    return 10 + this.pericia(f, 'Percepção');
  },

  iniciativa: function (f) {
    return this.mod(f, 'des');
  },


  /* ---------- Classe de armadura ----------
     Lê a armadura da lista ARMADURAS (regras.js), cuja CA vem escrita
     como no livro: "11 + Des", "13 + Des (máx 2)", "16". A conta:

       sem armadura    10 + Des
       leve            valor + Des
       média           valor + Des, até o máximo
       pesada          valor (a Destreza não conta)

     Escudo soma 2. "Outros" cobre o que a lista não sabe: Defesa sem
     Armadura do bárbaro e do monge, anel de proteção, magia. */
  ca: function (f) {
    const des = this.mod(f, 'des');
    let total = 10 + des;

    const armadura = ARMADURAS.find(function (a) {
      return a.nome === f.armadura && a.categoria === 'Armadura';
    });

    if (armadura) {
      const partes = /^(\d+)(\s*\+\s*Des)?(?:\s*\(máx\s*(\d+)\))?/.exec(armadura.ca);
      if (partes) {
        total = Number(partes[1]);
        if (partes[2]) total += partes[3] ? Math.min(des, Number(partes[3])) : des;
      }
    }

    if (f.escudo) total += 2;
    return total + (Number(f.caExtra) || 0);
  },


  /* ---------- Pontos de vida ----------
     Regra do livro: no 1º nível, o dado de vida inteiro + Constituição.
     Em cada nível seguinte, a média do dado (metade + 1) + Constituição.
     Nunca menos de 1 por nível, mesmo com Constituição negativa.

     No método "rolado", o PV é o que o jogador rolou (pvRolado); a
     média vira só a sugestão. */
  pvMedio: function (f) {
    const con = this.mod(f, 'con');
    const dado1 = Number(f.dadoVida) || 8;
    const dado2 = Number(f.dadoVida2) || 8;
    const niveis1 = Math.max(1, Number(f.nivel) || 1);
    const niveis2 = f.classe2 ? Math.max(0, Number(f.nivel2) || 0) : 0;

    let total = Math.max(1, dado1 + con);
    total += (niveis1 - 1) * Math.max(1, dado1 / 2 + 1 + con);
    total += niveis2 * Math.max(1, dado2 / 2 + 1 + con);
    return total;
  },

  pvMaximo: function (f, regras) {
    if (regras && regras.pv === 'rolado' && Number(f.pvRolado) > 0) return Number(f.pvRolado);
    return this.pvMedio(f);
  },

  /* Rola o PV dos níveis depois do 1º (que é sempre o dado inteiro). */
  rolarPv: function (f) {
    const con = this.mod(f, 'con');
    const dado1 = Number(f.dadoVida) || 8;
    const dado2 = Number(f.dadoVida2) || 8;
    const niveis1 = Math.max(1, Number(f.nivel) || 1);
    const niveis2 = f.classe2 ? Math.max(0, Number(f.nivel2) || 0) : 0;

    let total = Math.max(1, dado1 + con);
    for (let i = 1; i < niveis1; i++) total += Math.max(1, Layout.dado(dado1) + con);
    for (let i = 0; i < niveis2; i++) total += Math.max(1, Layout.dado(dado2) + con);
    return total;
  },


  /* ---------- Gerar atributos ---------- */

  pontosGastos: function (base) {
    return ATRIBUTOS_FICHA.reduce(function (soma, par) {
      const custo = CUSTO_COMPRA[Number(base[par[0]])];
      return soma + (custo === undefined ? 0 : custo);
    }, 0);
  },

  /* 4d6, descarta o menor — seis vezes. Devolve os seis totais. */
  rolarAtributos: function () {
    const totais = [];
    for (let i = 0; i < 6; i++) {
      const dados = [Layout.dado(6), Layout.dado(6), Layout.dado(6), Layout.dado(6)]
        .sort(function (a, b) { return a - b; });
      totais.push(dados[1] + dados[2] + dados[3]);
    }
    return totais;
  },

  /* Confere a ficha contra o método da campanha. Devolve o texto do
     problema, ou null se está tudo certo. Só vale na CRIAÇÃO: depois,
     subir de nível muda atributos (aumento de valor, talento) e a
     compra de pontos original deixa de ser conferível. */
  conferirMetodo: function (f, metodo) {
    const valores = ATRIBUTOS_FICHA.map(function (par) { return Number(f.base[par[0]]); });
    const ordenados = function (lista) { return lista.slice().sort(function (a, b) { return a - b; }).join(','); };

    if (metodo === 'compra') {
      if (valores.some(function (v) { return !(v >= 8 && v <= 15); })) {
        return 'Na compra de pontos, cada atributo base vai de 8 a 15.';
      }
      const gastos = this.pontosGastos(f.base);
      if (gastos > PONTOS_COMPRA) return 'Você gastou ' + gastos + ' pontos; o limite é ' + PONTOS_COMPRA + '.';
      return null;
    }

    if (metodo === 'padrao') {
      return ordenados(valores) === ordenados(CONJUNTO_PADRAO)
        ? null
        : 'No conjunto padrão, os seis valores base são 15, 14, 13, 12, 10 e 8 — cada um usado uma vez.';
    }

    if (metodo === 'rolagem') {
      if (!Array.isArray(f.rolados) || f.rolados.length !== 6) return 'Role os atributos antes de distribuir.';
      return ordenados(valores) === ordenados(f.rolados)
        ? null
        : 'Os valores base têm de ser os seis que você rolou (' + f.rolados.join(', ') + '), em qualquer ordem.';
    }

    return null;     /* livre: o Mestre confere */
  },


  /* ---------- O dado sugerido pela classe ---------- */

  /* "guerreiro", "Guerreira Campeã", "GUERREIRO" → 10. Compara só a
     primeira palavra, sem acento, sem caixa e sem o -o/-a do final —
     assim "maga" acha Mago e "clériga" acha Clérigo. */
  dadoSugerido: function (classe) {
    function raiz(texto) {
      return semAcento(String(texto || '').trim()).split(/\s+/)[0].replace(/[ao]$/, '');
    }
    const alvo = raiz(classe);
    if (!alvo) return null;
    const achada = Object.keys(DADO_POR_CLASSE).find(function (nome) { return raiz(nome) === alvo; });
    return achada ? DADO_POR_CLASSE[achada] : null;
  },


  /* ---------- Ataques ----------
     Um ataque na ficha: { nome, atributo, proficiente, dano, tipo, bonus }
       atributo     'for' ou 'des' (ou o de conjuração, num ataque mágico)
       dano         o dado, como no livro: '1d8', '2d6'
       bonus        arma mágica +1, +2... soma no acerto E no dano */

  bonusAtaque: function (f, ataque) {
    return this.mod(f, ataque.atributo) + (ataque.proficiente ? this.proficiencia(f) : 0) + (Number(ataque.bonus) || 0);
  },

  /* O que se soma aos dados de dano: o atributo e o bônus mágico. */
  bonusDano: function (f, ataque) {
    return this.mod(f, ataque.atributo) + (Number(ataque.bonus) || 0);
  },

  /* "1d8 + 3 cortante", para mostrar na ficha. */
  textoDano: function (f, ataque) {
    const extra = this.bonusDano(f, ataque);
    return ataque.dano + (extra ? (extra > 0 ? ' + ' : ' − ') + Math.abs(extra) : '') + (ataque.tipo ? ' ' + ataque.tipo : '');
  },

  /* Que atributo uma arma da lista ARMAS usa. Acuidade deixa escolher
     o melhor entre Força e Destreza; arma de munição (arco, besta) é
     sempre Destreza; o resto, Força. */
  atributoDaArma: function (f, arma) {
    const propriedades = semAcento(arma.propriedades || '');
    if (propriedades.indexOf('municao') !== -1) return 'des';
    if (propriedades.indexOf('acuidade') !== -1) return this.mod(f, 'des') > this.mod(f, 'for') ? 'des' : 'for';
    return 'for';
  },

  /* O pedido de dano de um ataque: '2d6' vira { quantos: 2, faces: 6 },
     mais o bônus fixo da ficha. Quem rola é o servidor (visao.js); no
     crítico, ele dobra a QUANTIDADE de dados (a regra do livro), e o
     bônus fixo entra uma vez só. null se o texto não for de dados. */
  expressaoDano: function (f, ataque) {
    const partes = /^(\d{1,2})d(\d{1,3})$/.exec(String(ataque.dano).replace(/\s+/g, ''));
    if (!partes) return null;
    return { quantos: Number(partes[1]), faces: Number(partes[2]), extra: this.bonusDano(f, ataque) };
  },


  /* ---------- Magia ----------
     ficha.atributoMagia     'int' | 'sab' | 'car' | '' (não conjura)
     ficha.espacos           { 1: 4, 2: 3, ... } quantos espaços por nível
     ficha.espacosGastos     { 1: 2, ... } quantos já foram usados
     ficha.magias            nomes da lista MAGIAS (regras.js)
     ficha.concentrando      o nome da magia mantida, ou '' */

  cdMagia: function (f) {
    return 8 + this.proficiencia(f) + this.mod(f, f.atributoMagia);
  },

  ataqueMagia: function (f) {
    return this.proficiencia(f) + this.mod(f, f.atributoMagia);
  },

  /* Quantos espaços sobram num nível. */
  espacosLivres: function (f, nivel) {
    const total = Number((f.espacos || {})[nivel]) || 0;
    const gastos = Number((f.espacosGastos || {})[nivel]) || 0;
    return Math.max(0, total - gastos);
  },

  /* Para conjurar uma magia de nível N, serve o menor espaço livre de
     nível N ou mais (usar um espaço maior é permitido, só desperdiça).
     Devolve o nível do espaço, ou null se não houver nenhum. */
  espacoParaConjurar: function (f, nivelMagia) {
    for (let nivel = Math.max(1, nivelMagia); nivel <= 9; nivel++) {
      if (this.espacosLivres(f, nivel) > 0) return nivel;
    }
    return null;
  },


  /* ---------- Inventário ----------
     ficha.moedas  { pl, po, pe, pp, pc } — platina, ouro, electro, prata, cobre
     ficha.itens   [{ id, nome, quantidade, peso, tipo, equipado, magico, sintonizado }]
       tipo        'arma' | 'armadura' | 'escudo' | 'outro'
       peso        de UMA unidade, em kg */

  /* Livro do Jogador: carrega até Força × 15 libras ≈ Força × 7,5 kg. */
  cargaMaxima: function (f) {
    return this.valor(f, 'for') * 7.5;
  },

  /* 50 moedas pesam 1 libra (≈ 0,45 kg) — de qualquer metal. Parece
     detalhe, mas 2.000 PO de um tesouro pesam 18 kg. */
  pesoMoedas: function (f) {
    const m = f.moedas || {};
    const total = ['pl', 'po', 'pe', 'pp', 'pc'].reduce(function (soma, k) { return soma + (Number(m[k]) || 0); }, 0);
    return total / 50 * 0.45;
  },

  pesoTotal: function (f) {
    const itens = (f.itens || []).reduce(function (soma, item) {
      return soma + (Number(item.quantidade) || 0) * (Number(item.peso) || 0);
    }, 0);
    return itens + this.pesoMoedas(f);
  },

  sintonizados: function (f) {
    return (f.itens || []).filter(function (i) { return i.sintonizado; }).length;
  },

  LIMITE_SINTONIA: 3,


  /* ---------- Magias preparadas ----------
     Clérigo, druida e mago (e o paladino, pela metade do nível)
     preparam a cada dia uma parte das magias que conhecem: atributo
     de conjuração + nível, no mínimo 1. A ficha mostra o limite; o
     jogador decide quais. */
  limitePreparadas: function (f) {
    return Math.max(1, this.mod(f, f.atributoMagia) + this.nivelTotal(f));
  },


  /* ---------- O resumo que as telas do Mestre leem ----------
     A Visão Geral, o Combate e os avisos leem estes campos direto de
     Estado.herois (eram os únicos que existiam antes da ficha). Eles
     são DERIVADOS e reescritos a cada salvamento — ver o topo. */
  resumoDoHeroi: function (f, regras, jogador) {
    const classe = f.classe2
      ? f.classe + ' ' + f.nivel + ' / ' + f.classe2 + ' ' + f.nivel2
      : f.classe;
    const iniciativa = this.iniciativa(f);

    return {
      classe: classe + ' (' + f.raca + ')',
      nivel: this.nivelTotal(f),
      ca: this.ca(f),
      pp: this.percepcaoPassiva(f),
      bonusIniciativa: iniciativa,
      pvMax: this.pvMaximo(f, regras),
      terceira: { rotulo: 'Iniciativa', valor: comSinal(iniciativa) },
      rodape: 'Jogador: ' + jogador,
      estado: ''
    };
  }
};
