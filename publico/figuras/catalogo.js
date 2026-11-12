/* ===================================================================
   figuras/catalogo.js — as miniaturas da mesa (MESA3D.md, fase 4)

   Cada figura é um arquivo .glb em publico/figuras/, pronto para a
   mesa: uma pose parada, um equipamento, sem animação (ver
   testes/figuras/montar-figuras.mjs, que os gera dos pacotes
   originais). Este catálogo é a LISTA que o servidor confere
   (token.modelo só pode ser um id daqui) e que as telas mostram.

   A ESCALA
   Os modelos vêm em "unidades do KayKit" (uns 2,2 de altura para um
   humano). Na mesa, 1 célula = 1 unidade = 1,5 m. Um humano de 1,8 m
   tem então 1,2 unidades: `altura` é a altura que a figura deve ter na
   mesa, e a escala sai de altura ÷ altura-do-arquivo (alturas.json).
   O tamanho do SRD (pequeno, médio, grande...) ajusta por cima.

   AS LIGAÇÕES AUTOMÁTICAS
   `classes` liga a classe da ficha à figura sugerida; `monstros`, o
   nome do monstro do bestiário. Quem não casa com nada ganha a figura
   genérica da categoria (heroi → 'guerreiro'; inimigo → 'esqueleto').

   ORIGEM E LICENÇA de cada uma em figuras/LICENCAS.md.
   =================================================================== */

const CATALOGO_FIGURAS = {

  figuras: [
    { id: 'guerreiro', nome: 'Guerreiro', arquivo: 'figuras/guerreiro.glb', categoria: 'heroi', altura: 1.2,
      classes: ['Guerreiro', 'Guerreira', 'Paladino', 'Paladina', 'Clérigo', 'Clériga'], origem: 'KayKit Adventurers (Knight)', licenca: 'CC0' },
    { id: 'barbaro', nome: 'Bárbaro', arquivo: 'figuras/barbaro.glb', categoria: 'heroi', altura: 1.25,
      classes: ['Bárbaro', 'Bárbara'], origem: 'KayKit Adventurers (Barbarian)', licenca: 'CC0' },
    { id: 'mago', nome: 'Mago', arquivo: 'figuras/mago.glb', categoria: 'heroi', altura: 1.2,
      classes: ['Mago', 'Maga', 'Feiticeiro', 'Feiticeira', 'Bruxo', 'Bruxa', 'Druida'], origem: 'KayKit Adventurers (Mage)', licenca: 'CC0' },
    { id: 'ladino', nome: 'Ladino', arquivo: 'figuras/ladino.glb', categoria: 'heroi', altura: 1.15,
      classes: ['Ladino', 'Ladina', 'Monge', 'Bardo', 'Barda'], origem: 'KayKit Adventurers (Rogue, Hooded)', licenca: 'CC0' },
    { id: 'arqueiro', nome: 'Arqueiro', arquivo: 'figuras/arqueiro.glb', categoria: 'heroi', altura: 1.15,
      classes: ['Patrulheiro', 'Patrulheira', 'Arqueiro', 'Arqueira'], origem: 'KayKit Adventurers (Rogue)', licenca: 'CC0' },
    { id: 'esqueleto', nome: 'Esqueleto', arquivo: 'figuras/esqueleto.glb', categoria: 'inimigo', altura: 1.15,
      monstros: ['Esqueleto', 'Zumbi', 'Morto-vivo'], origem: 'KayKit Skeletons (Minion)', licenca: 'CC0' },
    { id: 'esqueleto-guerreiro', nome: 'Esqueleto guerreiro', arquivo: 'figuras/esqueleto-guerreiro.glb', categoria: 'inimigo', altura: 1.2,
      monstros: ['Armadura Animada', 'Carniçal'], origem: 'KayKit Skeletons (Warrior)', licenca: 'CC0' },
    { id: 'esqueleto-mago', nome: 'Esqueleto mago', arquivo: 'figuras/esqueleto-mago.glb', categoria: 'inimigo', altura: 1.2,
      monstros: ['Cultista', 'Espectro', 'Aparição'], origem: 'KayKit Skeletons (Mage)', licenca: 'CC0' },
    { id: 'esqueleto-ladino', nome: 'Esqueleto ladino', arquivo: 'figuras/esqueleto-ladino.glb', categoria: 'inimigo', altura: 1.15,
      monstros: ['Bandido'], origem: 'KayKit Skeletons (Rogue)', licenca: 'CC0' }
  ],

  /* A altura de cada arquivo nas unidades dele (gerado pelo
     montar-figuras.mjs); a escala na mesa é altura ÷ isto. */
  alturasDoArquivo: {
    guerreiro: 2.31, barbaro: 2.19, mago: 2.20, ladino: 2.25, arqueiro: 2.19,
    esqueleto: 2.17, 'esqueleto-guerreiro': 2.17, 'esqueleto-mago': 2.17, 'esqueleto-ladino': 2.17
  },

  /* Os tamanhos do SRD: quanto a figura cresce, e quantas células ocupa. */
  tamanhos: {
    pequeno: { escala: 0.8, celulas: 1 },
    medio:   { escala: 1.0, celulas: 1 },
    grande:  { escala: 1.6, celulas: 2 },
    enorme:  { escala: 2.3, celulas: 3 }
  },

  porId: function (id) {
    return this.figuras.find(function (f) { return f.id === id; }) || null;
  },

  idValido: function (id) {
    return !!this.porId(id);
  },

  /* A figura sugerida para um token: pela classe da ficha (herói) ou
     pelo nome do monstro (inimigo); senão, a genérica da categoria. */
  sugerir: function (token, heroi) {
    const texto = String((heroi && heroi.classe) || token.nome || '');
    const lista = token.tipo === 'heroi' ? 'classes' : 'monstros';
    const achada = this.figuras.find(function (f) {
      return (f[lista] || []).some(function (nome) { return texto.toLowerCase().indexOf(nome.toLowerCase()) !== -1; });
    });
    return achada ? achada.id : (token.tipo === 'heroi' ? 'guerreiro' : 'esqueleto');
  },

  /* A escala que põe a figura na altura certa, já com o tamanho. */
  escala: function (id, tamanho) {
    const f = this.porId(id);
    const t = this.tamanhos[tamanho] || this.tamanhos.medio;
    if (!f) return t.escala;
    return (f.altura / (this.alturasDoArquivo[id] || 2.2)) * t.escala;
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = { CATALOGO_FIGURAS: CATALOGO_FIGURAS };
