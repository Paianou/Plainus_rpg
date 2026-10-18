/* A medição em área (a "bola de fogo"): a regra no modelo.js, a ação do
   Mestre (acoes.js) e a do jogador (visao.js), e o que cada um vê. */
const { ACOES } = require('../../publico/acoes.js');
const { visaoDoJogador, aplicarAcaoJogador } = require('../../publico/visao.js');
const { casasDaArea, conferirCampanha, estadoVazio } = require('../../publico/modelo.js');
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

ok(aplicarAcaoJogador('marcarMinhaArea', estado, ana, { x: 5, y: 5, raio: 6 }).erro === 'O Mestre ainda não abriu nenhuma cena.', 'sem cena: recusado');

const c = ACOES.salvarCena(estado, { nome: 'Cripta', colunas: 20, linhas: 16 });
const cena = estado.cenas[0];
ok(Array.isArray(cena.areas) && cena.areas.length === 0, 'cena nova nasce com a lista de áreas vazia');

/* a conta das casas */
ok(casasDaArea({ x: 10, y: 8, raio: 6 }, cena).length === 52, 'Bola de Fogo (6 m) no canto de uma casa: 52 casas — o molde clássico de 20 pés');
ok(casasDaArea({ x: 3.5, y: 3.5, raio: 1.5 }, cena).length === 5, 'raio 1,5 m no meio de uma casa: ela e as 4 vizinhas (a cruz)');
ok(casasDaArea({ x: 0, y: 0, raio: 6 }, cena).every(k => k.col >= 0 && k.lin >= 0) && casasDaArea({ x: 0, y: 0, raio: 6 }, cena).length === 13, 'no canto da cena: só as casas de dentro (13)');

/* o jogador marca */
ok(!aplicarAcaoJogador('marcarMinhaArea', estado, ana, { x: 10, y: 8, raio: 6 }).erro && cena.areas.length === 1, 'a Ana marca uma área de 6 m');
ok(cena.areas[0].nome === 'Lyra' && cena.areas[0].dono === 'j:ana', 'a etiqueta leva o nome do herói; o dono fica guardado no servidor');
aplicarAcaoJogador('marcarMinhaArea', estado, ana, { x: 4.3, y: 4.8, raio: 10 });
ok(cena.areas.length === 1 && cena.areas[0].x === 4.5 && cena.areas[0].y === 5 && cena.areas[0].raio === 10.5, 'marcar de novo muda a dela (não empilha); centro de meia em meia casa, raio de 1,5 em 1,5');
ok(aplicarAcaoJogador('marcarMinhaArea', estado, ana, { x: 4, y: 4, raio: 1 }).erro === 'O raio vai de 1,5 a 36 m.', 'raio de 1 m: recusado');
ok(aplicarAcaoJogador('marcarMinhaArea', estado, ana, { x: 4, y: 4, raio: 99 }).erro, 'raio de 99 m: recusado');
ok(aplicarAcaoJogador('marcarMinhaArea', estado, ana, { x: 'a', y: 4, raio: 6 }).erro, 'centro que não é número: recusado');
aplicarAcaoJogador('marcarMinhaArea', estado, ana, { x: 999, y: -5, raio: 6 });
ok(cena.areas[0].x === 20 && cena.areas[0].y === 0, 'centro fora da cena: encosta na borda');

/* o que cada um vê */
aplicarAcaoJogador('marcarMinhaArea', estado, beto, { x: 2, y: 2, raio: 3 });
ACOES.marcarArea(estado, { cenaId: c.id, x: 15, y: 10, raio: 9 });
const daAna = visaoDoJogador(estado, 'ana').cena.areas;
ok(daAna.length === 3, 'a Ana vê as três áreas: a dela, a do Bram e a do Mestre');
ok(daAna.filter(a => a.minha).length === 1 && daAna.find(a => a.minha).nome === 'Lyra', '…e só a dela é "minha"');
ok(daAna.every(a => a.dono === undefined), 'o dono (id do jogador) não vai para o navegador');

/* apagar */
ok(!aplicarAcaoJogador('tirarMinhaArea', estado, ana, {}).erro && cena.areas.length === 2 && !cena.areas.some(a => a.dono === 'j:ana'), 'a Ana apaga a dela — e só a dela');
ok(aplicarAcaoJogador('tirarMinhaArea', estado, ana, {}).erro === 'Você não tem área no mapa.', 'apagar de novo: avisa');
ok(aplicarAcaoJogador('marcarMinhaArea', estado, { papel: 'mestre' }, { x: 1, y: 1, raio: 3 }).erro, 'o Mestre não usa a ação do jogador');
const doBram = cena.areas.find(a => a.dono === 'j:beto');
ok(!ACOES.tirarArea(estado, { cenaId: c.id, id: doBram.id }).erro && cena.areas.length === 1, 'o Mestre apaga a área do Bram');
ok(ACOES.limparAreas(estado, { cenaId: c.id }).quantas === 1 && cena.areas.length === 0, 'o Mestre limpa todas');
ok(ACOES.limparAreas(estado, { cenaId: c.id }).erro === 'Não há área no mapa.', 'limpar sem nada: avisa');

/* o limite: 20 por cena */
for (let i = 0; i < 20; i++) cena.areas.push({ id: 'x' + i, x: 1, y: 1, raio: 3, dono: 'j:outro' + i, nome: 'X' });
ok(aplicarAcaoJogador('marcarMinhaArea', estado, ana, { x: 2, y: 2, raio: 3 }).erro === 'Áreas demais nesta cena.', 'com 20 áreas na cena: a 21ª é recusada');
cena.areas = [];

/* encolher a cena puxa a área para dentro */
ACOES.marcarArea(estado, { cenaId: c.id, x: 18, y: 14, raio: 6 });
ACOES.salvarCena(estado, { id: c.id, nome: 'Cripta', colunas: 10, linhas: 8 });
ok(cena.areas[0].x === 10 && cena.areas[0].y === 8, 'encolher a cena: a área encosta na borda nova');

/* campanha vinda de fora (um backup) com área estragada */
const backup = Object.assign(estadoVazio(), JSON.parse(JSON.stringify(estado)));
backup.cenas[0].areas = [{ id: 'ok', x: 1, y: 1, raio: 3, dono: 'mestre', nome: 'M' }, { id: 'ruim', x: '1', y: 1, raio: 3, dono: 'mestre' }, 'lixo'];
const limpa = conferirCampanha(backup);
ok(typeof limpa === 'object' && limpa.cenas[0].areas.length === 1 && limpa.cenas[0].areas[0].id === 'ok', 'backup com área estragada: só a válida fica');

console.log(falhas ? falhas + ' FALHAS' : '\nÁrea no mapa certa no Node.');
process.exit(falhas ? 1 : 0);
