const { ACOES } = require('../../acoes.js');
let falhas = 0;
const ok = (c, t) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + t); if (!c) falhas++; };
const estado = { cenas: [], combate: { ativo: true, rodada: 1, combatentes: [{ nome: 'Lyra', tipo: 'heroi', pv: 10 }, { nome: 'Goblin', tipo: 'inimigo', pv: 0 }, { nome: 'Orc', tipo: 'inimigo', pv: 15 }], registro: [] } };

/* criar e editar */
ok(ACOES.salvarCena(estado, { nome: 'Cripta', colunas: 4, linhas: 10 }).erro, 'colunas 4: recusado (mínimo 5)');
ok(ACOES.salvarCena(estado, { nome: '', colunas: 10, linhas: 10 }).erro, 'sem nome: recusado');
ok(ACOES.salvarCena(estado, { nome: 'x', colunas: 10, linhas: 10, imagem: 'data:image/svg+xml;base64,AAA' }).erro, 'imagem SVG: recusada');
const c = ACOES.salvarCena(estado, { nome: 'Cripta', visibilidade: 'Penumbra', colunas: 10, linhas: 8, contorno: true });
const cena = estado.cenas[0];
ok(c.nova && estado.cenaAtual === c.id && cena.paredes.length === 4, 'cena nova com contorno: 4 paredes, e vira a atual');

/* paredes */
ok(!ACOES.definirParedes(estado, { cenaId: c.id, paredes: [[2, 2, 3, 1], [8, 7, 5, 5], [50, 50, 1, 1], [1, 1, 99, 1]] }).erro, 'definir paredes');
ok(JSON.stringify(cena.paredes) === JSON.stringify([[2, 2, 3, 1], [8, 7, 2, 1]]), 'parede que passa da borda é cortada; fora da cena ou com largura impossível (99) sai');
ok(ACOES.definirParedes(estado, { cenaId: c.id, paredes: 'tudo' }).erro && cena.paredes.length === 2, 'paredes que não são lista: recusado, nada muda');
ok(ACOES.definirParedes(estado, { cenaId: c.id, paredes: new Array(3000).fill([1, 1, 1, 1]) }).erro, '3000 paredes: recusado');

/* tokens */
const t = ACOES.trazerCombatentesAoMapa(estado, { cenaId: c.id });
ok(t.entraram === 2 && cena.tokens.map(x => x.nome).join() === 'Lyra,Orc', 'trazer o combate: Lyra e Orc entram; o Goblin (0 PV) não');
ok(cena.tokens.every(x => !cena.paredes.some(p => x.col >= p[0] && x.col < p[0] + p[2] && x.lin >= p[1] && x.lin < p[1] + p[3])), 'nenhum token caiu em cima de parede');
ok(ACOES.trazerCombatentesAoMapa(estado, { cenaId: c.id }).erro === 'Todo mundo do combate já está no mapa.', 'de novo: "Todo mundo do combate já está no mapa."');
const tk = cena.tokens[0];
ACOES.moverToken(estado, { cenaId: c.id, id: tk.id, col: 999, lin: -5 });
ok(tk.col === 9 && tk.lin === 0, 'mover token para fora da cena: encosta na borda (9, 0)');
ok(ACOES.tirarToken(estado, { cenaId: c.id, id: tk.id }).nome === 'Lyra' && cena.tokens.length === 1, 'tirar token');

/* marcadores */
const m = ACOES.criarMarcador(estado, { cenaId: c.id, col: 3, lin: 3 });
ACOES.editarMarcador(estado, { cenaId: c.id, id: m.id, texto: 'Glifo de fogo na porta' });
ok(cena.marcadores[0].tipo === 'perigo', 'marcador que fala de glifo vira perigo');
ACOES.editarMarcador(estado, { cenaId: c.id, id: m.id, texto: '   ' });
ok(cena.marcadores[0].texto === 'Marcador' && cena.marcadores[0].tipo === 'nota', 'texto vazio vira "Marcador"');
ok(!ACOES.tirarMarcador(estado, { cenaId: c.id, id: m.id }).erro && cena.marcadores.length === 0, 'tirar marcador');

/* encolher */
ACOES.criarMarcador(estado, { cenaId: c.id, col: 9, lin: 7 });
ACOES.salvarCena(estado, { id: c.id, nome: 'Cripta menor', colunas: 6, linhas: 5 });
ok(cena.colunas === 6 && cena.marcadores[0].col === 5 && cena.marcadores[0].lin === 4 && cena.paredes.every(p => p[0] + p[2] <= 6 && p[1] + p[3] <= 5), 'encolher a cena: marcador puxado para dentro, paredes cortadas');

/* apagar e desfazer */
const segunda = ACOES.salvarCena(estado, { nome: 'Taverna', colunas: 10, linhas: 10 });
ACOES.escolherCena(estado, { id: c.id });
const a = ACOES.apagarCena(estado, { id: c.id });
ok(estado.cenas.length === 1 && estado.cenaAtual === segunda.id, 'apagar a cena atual: a outra vira a atual');
ok(!ACOES.devolverCena(estado, { item: a.item, posicao: a.posicao }).erro && estado.cenas[0].id === c.id && estado.cenaAtual === c.id && estado.cenas[0].tokens.length === 1, 'desfazer: a cena volta no lugar, com o token, e vira a atual');
ok(ACOES.devolverCena(estado, { item: { id: 'cenaX', nome: 'Falsa', colunas: 999, linhas: 10 }, posicao: 0 }).erro, 'devolver uma cena inventada com 999 colunas: recusado');
const truque = ACOES.devolverCena(estado, { item: { id: 'cenaY', nome: 'Truque', colunas: 10, linhas: 10, tokens: [{ id: 't1', nome: '<img src=x onerror=1>', tipo: 'admin', col: 50, lin: 2 }] }, posicao: 0 });
const tt = estado.cenas.find(x => x.id === 'cenaY').tokens[0];
ok(!truque.erro && tt.tipo === 'inimigo' && tt.col === 9 && tt.inicial === '<', 'cena "devolvida" de fora é limpa: tipo estranho vira inimigo, posição presa na cena');

console.log(falhas ? falhas + ' FALHAS' : '\nMapas certo no Node.');
process.exit(falhas ? 1 : 0);
