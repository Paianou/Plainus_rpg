/* O grupo no mapa fora do combate (acoes.js, trazerGrupoAoMapa) e o
   jogador andando com o próprio token (visao.js, moverMeuToken). */
const { ACOES } = require('../../publico/acoes.js');
const { visaoDoJogador, aplicarAcaoJogador } = require('../../publico/visao.js');
let falhas = 0;
const ok = (c, t) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + t); if (!c) falhas++; };

const estado = {
  campanha: { nome: 'Teste', sessao: 1 }, mestre: { nome: 'Thiago' },
  herois: [
    { id: 'h1', dono: 'ana', nome: 'Lyra', pv: 10, pvMax: 10, ficha: {} },
    { id: 'h2', dono: 'beto', nome: 'Bram', pv: 12, pvMax: 12, ficha: {} }
  ],
  cenas: [], combate: { ativo: false, rodada: 1, combatentes: [], registro: [] }
};
const ana = { papel: 'jogador', jogadorId: 'ana', nome: 'Ana' };
const beto = { papel: 'jogador', jogadorId: 'beto', nome: 'Beto' };

ok(aplicarAcaoJogador('moverMeuToken', estado, ana, { col: 1, lin: 1 }).erro, 'sem cena nenhuma: recusado');

const c = ACOES.salvarCena(estado, { nome: 'Cripta', colunas: 10, linhas: 8, contorno: true });
const cena = estado.cenas[0];
/* Um token antigo, de antes do heroiId, com o nome da Lyra. */
cena.tokens.push({ id: 'tVelho', nome: 'Lyra', inicial: 'L', tipo: 'heroi', col: 2, lin: 2 });

/* trazer o grupo */
const r = ACOES.trazerGrupoAoMapa(estado, { cenaId: c.id });
ok(r.entraram === 1 && cena.tokens.length === 2, 'trazer o grupo: só o Bram entra (a Lyra já tinha token)');
ok(cena.tokens[0].heroiId === 'h1' && cena.tokens[1].heroiId === 'h2', 'cada token sabe de qual herói é (o antigo, pelo nome, foi adotado)');
ok(ACOES.trazerGrupoAoMapa(estado, { cenaId: c.id }).erro === 'O grupo inteiro já está no mapa.', 'de novo: "O grupo inteiro já está no mapa."');
ok(ACOES.trazerGrupoAoMapa({ herois: [], cenas: [cena] }, { cenaId: c.id }).erro === 'Ninguém criou personagem ainda.', 'sem personagens: avisa');

/* a visão de cada um */
const daAna = visaoDoJogador(estado, 'ana').cena.tokens;
ok(daAna.find(t => t.meu).nome === 'Lyra' && daAna.filter(t => t.meu).length === 1, 'na visão da Ana, só o token da Lyra é "meu"');
ok(daAna.every(t => t.heroiId === undefined), 'o heroiId não vai para o navegador (só o "meu")');

/* andar */
const lyra = cena.tokens[0];
ok(!aplicarAcaoJogador('moverMeuToken', estado, ana, { col: 4, lin: 3 }).erro && lyra.col === 4 && lyra.lin === 3, 'a Ana anda com a Lyra para (4, 3)');
ok(aplicarAcaoJogador('moverMeuToken', estado, ana, { col: 0, lin: 0 }).erro === 'Ali tem parede.' && lyra.col === 4, 'para dentro da parede: recusado, não sai do lugar');
const bram = cena.tokens[1];
ok(aplicarAcaoJogador('moverMeuToken', estado, ana, { col: bram.col, lin: bram.lin }).erro === 'Essa casa já está ocupada.', 'para cima do Bram: recusado');
ok(aplicarAcaoJogador('moverMeuToken', estado, ana, { col: 'x', lin: 3 }).erro && lyra.col === 4, 'casa que não é número: recusado');
ok(aplicarAcaoJogador('moverMeuToken', estado, { papel: 'mestre' }, { col: 5, lin: 5 }).erro, 'o Mestre não usa esta ação (ele tem o moverToken)');
ok(aplicarAcaoJogador('moverMeuToken', estado, { papel: 'jogador', jogadorId: 'zé' }, { col: 5, lin: 5 }).erro, 'quem não tem personagem: recusado');

/* combate: só na sua vez */
estado.combate = { ativo: true, rodada: 1, registro: [], combatentes: [
  { id: 'c1', heroiId: 'h2', nome: 'Bram', tipo: 'heroi', pv: 12, agiu: false },
  { id: 'c2', heroiId: 'h1', nome: 'Lyra', tipo: 'heroi', pv: 10, agiu: false }
] };
ok(aplicarAcaoJogador('moverMeuToken', estado, ana, { col: 5, lin: 3 }).erro === 'No combate, você anda na sua vez.' && lyra.col === 4, 'no combate, fora da vez: recusado');
ok(!aplicarAcaoJogador('moverMeuToken', estado, beto, { col: 6, lin: 6 }).erro && bram.col === 6, 'o Bram, na vez dele, anda');
estado.combate.combatentes[0].agiu = true;
ok(!aplicarAcaoJogador('moverMeuToken', estado, ana, { col: 5, lin: 3 }).erro && lyra.col === 5, 'o Bram agiu: agora é a vez da Lyra, e ela anda');

/* trocar o nome na ficha: o token acompanha */
aplicarAcaoJogador('salvarHeroi', estado, ana, { heroi: { id: 'h1', nome: 'Lyra Vento', nivel: 1, ca: 12, pvMax: 10 } });
ok(lyra.nome === 'Lyra Vento' && lyra.inicial === 'L', 'renomear o herói na ficha: o token muda junto');

/* o token sobrevive ao Desfazer de apagar cena (cenaValida) */
ACOES.salvarCena(estado, { nome: 'Outra', colunas: 10, linhas: 10 });
const apagada = ACOES.apagarCena(estado, { id: c.id });
ACOES.devolverCena(estado, { item: apagada.item, posicao: apagada.posicao });
ok(estado.cenas.find(x => x.id === c.id).tokens[0].heroiId === 'h1', 'apagar e desfazer a cena: o token continua sendo da Lyra');

console.log(falhas ? falhas + ' FALHAS' : '\nGrupo no mapa certo no Node.');
process.exit(falhas ? 1 : 0);
