const { ACOES } = require('../../acoes.js');
let falhas = 0;
const ok = (c, t) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + t); if (!c) falhas++; };

const estado = { campanha: { sessao: 3 }, herois: [{ id: 'h1', nome: 'Lyra', ca: 15, pv: 20, pvMax: 20, bonusIniciativa: 3, ficha: { nome: 'rascunho da Ana' } }],
  diario: [{ id: 'd1', sessao: 2, titulo: 'A cripta', emAberto: false }, { id: 'd2', sessao: 3, titulo: 'O enterro', emAberto: true }] };

/* PV pela Visão Geral */
ACOES.trazerParty(estado);
const r = ACOES.mudarPVHeroi(estado, { id: 'h1', delta: -8 });
ok(r.depois === 12 && estado.combate.combatentes[0].pv === 12, 'PV pela Visão Geral: ficha e combate em 12');
ok(estado.herois[0].ficha.nome === 'rascunho da Ana', 'o resto do herói (a ficha da Ana) não é tocado');
ok(ACOES.mudarPVHeroi(estado, { id: 'h1', delta: 'abc' }).mudou === false, 'delta que não é número: nada muda');

/* sessões */
ok(ACOES.comecarSessao(estado, { numero: 3, titulo: 'x' }).erro, 'começar sessão com número que já existe: recusado');
ACOES.comecarSessao(estado, { numero: 4, titulo: 'A ponte' });
ok(estado.campanha.sessao === 4 && estado.diario.find(e => e.sessao === 3).emAberto === false && estado.diario.find(e => e.sessao === 4).emAberto === true, 'começar a sessão 4: a 3 fecha, a 4 abre');
ok(/^\d{4}-\d\d-\d\d$/.test(estado.diario.find(e => e.sessao === 4).data), 'a entrada nova leva a data de hoje');
ok(ACOES.salvarSessao(estado, { numero: 2, titulo: 'y' }).erro, 'renomear a sessão para um número que já existe (2): recusado — antes criava duplicata');
ACOES.salvarSessao(estado, { numero: 5, titulo: 'A ponte caída' });
ok(estado.campanha.sessao === 5 && estado.diario.filter(e => e.sessao === 5).length === 1 && estado.diario.find(e => e.sessao === 5).titulo === 'A ponte caída', 'renomear a sessão 4 para 5 com título: a mesma entrada muda');
ok(ACOES.irParaSessao(estado, { numero: 2 }).titulo === 'A cripta' && estado.campanha.sessao === 2, 'voltar para a sessão 2');
ok(ACOES.irParaSessao(estado, { numero: 2 }).mesma === true, 'ir para a mesma: nada muda');
ok(ACOES.comecarSessao(estado, { numero: -1 }).erro, 'sessão -1: recusado');

/* som, avisos, fixadas, rolagens, npc, tesouro */
ACOES.ajustarAudio(estado, { volume: 250 });
ok(estado.audio.volume === 100, 'volume 250 vira 100');
ACOES.ajustarAudio(estado, { pista: 'Taverna', tocando: true });
ok(estado.audio.pista === 'Taverna' && estado.audio.tocando === true && estado.audio.volume === 100, 'trocar pista não mexe no volume');
ACOES.marcarAvisosVistos(estado, { chaves: ['a', 'b'] });
ok(estado.avisosVistos.join() === 'a,b', 'avisos vistos');
ok(ACOES.alternarFixada(estado, { nome: 'Bola de Fogo' }).fixada === true && ACOES.alternarFixada(estado, { nome: 'Bola de Fogo' }).fixada === false, 'fixar e desafixar');
for (let i = 0; i < 12; i++) ACOES.registrarRolagemMestre(estado, { rolagem: { texto: 'd20', formula: 'd20', total: i, marca: i === 11 ? 'critico' : 'hacker' } });
ok(estado.rolagens.length === 8 && estado.rolagens[0].total === 11 && estado.rolagens[0].marca === 'critico' && estado.rolagens[1].marca === null, 'rolagens do Mestre: 8 últimas, marca só crítico/falha');
ok(ACOES.guardarNpcSorteado(estado, { npc: { nome: '' } }).erro, 'NPC sorteado sem nome: recusado');
ACOES.guardarTesouro(estado, { texto: 'x'.repeat(1000) });
ok(estado.tesouro.length === 300, 'tesouro cortado em 300 letras');

console.log(falhas ? '\n' + falhas + ' FALHAS' : '\nVisão Geral, sessões e o resto: certo no Node.');
process.exit(falhas ? 1 : 0);
