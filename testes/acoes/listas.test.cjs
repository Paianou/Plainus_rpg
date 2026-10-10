/* O acoes.js rodando no Node — sem navegador, sem Estado global, como o
   futuro server.js vai rodar. */
const { ACOES } = require('../../acoes.js');
let falhas = 0;
const ok = (c, t) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + t); if (!c) falhas++; };

const estado = { npcs: [{ id: 'n1', nome: 'Barnabé' }, { id: 'n2', nome: 'Selis' }, { id: 'n3', nome: 'Kor' }], diario: [{ id: 'd1', titulo: 'O enterro', sessao: 1 }, { id: 'd2', titulo: 'A cripta', sessao: 2 }], segredos: [{ id: 's1', titulo: 'O rei vive' }] };

ok(ACOES.salvarItem(estado, { lista: 'npcs', item: { id: 'n4', nome: 'Vhalor' } }).novo === true && estado.npcs.length === 4, 'salvarItem: NPC novo entra no fim');
ok(ACOES.salvarItem(estado, { lista: 'npcs', item: { id: 'n2', nome: 'Madame Selis' } }).novo === false && estado.npcs[1].nome === 'Madame Selis', 'salvarItem: mesmo id = edição no lugar');
const r = ACOES.apagarItem(estado, { lista: 'npcs', id: 'n2' });
ok(r.posicao === 1 && r.item.nome === 'Madame Selis' && estado.npcs.length === 3, 'apagarItem devolve o item e a posição');
ok(!ACOES.devolverItem(estado, { lista: 'npcs', item: r.item, posicao: r.posicao }).erro && estado.npcs[1].id === 'n2', 'devolverItem põe de volta NA MESMA posição');
ok(ACOES.devolverItem(estado, { lista: 'npcs', item: r.item, posicao: r.posicao }).erro && estado.npcs.length === 4, 'devolver duas vezes não duplica');

/* o que o servidor vai recusar */
ok(ACOES.salvarItem(estado, { lista: 'herois', item: { id: 'h1', nome: 'x' } }).erro, 'lista fora da lista branca (heróis são dos jogadores): recusado');
ok(ACOES.salvarItem(estado, { lista: '__proto__', item: { id: 'x', nome: 'x' } }).erro, 'lista "__proto__" (truque clássico): recusado');
ok(ACOES.salvarItem(estado, { lista: 'npcs', item: { id: 'n9 <script>', nome: 'x' } }).erro, 'id com espaço e HTML: recusado');
ok(ACOES.salvarItem(estado, { lista: 'npcs', item: { id: 'n9', nome: '   ' } }).erro, 'NPC sem nome: recusado');
ok(ACOES.salvarItem(estado, { lista: 'npcs', item: { id: 'n9', nome: 'x', bio: 'a'.repeat(30000) } }).erro, 'NPC de 30 mil caracteres: recusado (limite 20 mil)');
ok(ACOES.salvarItem(estado, { lista: 'npcs', item: ['n9'] }).erro, 'item que é lista, e não objeto: recusado');
ok(ACOES.apagarItem(estado, { lista: 'npcs', id: 'n99' }).erro && estado.npcs.length === 4, 'apagar o que não existe: erro, nada muda');

/* regras que moram nas ações */
const s = ACOES.alternarSegredo(estado, { id: 's1' });
ok(s.revelado && estado.segredos[0].reveladoEm === 2, 'revelar segredo guarda a última sessão do diário (2)');
ACOES.alternarSegredo(estado, { id: 's1' });
ok(!estado.segredos[0].revelado && !('reveladoEm' in estado.segredos[0]), 'esconder de novo apaga o reveladoEm');
ok(ACOES.alternarStatusNpc(estado, { id: 'n1' }).status === 'morto', 'alternarStatusNpc: vivo → morto');

ACOES.registrarRolagensTabela(estado, { rolagens: [{ tabela: 't1', nome: 'Tesouro', face: 3, texto: 'a' }, { tabela: 't1', nome: 'Tesouro', face: 5, texto: 'b' }] });
ok(estado.rolagensTabela.length === 2 && estado.rolagensTabela[0].face === 5, 'rolagens de tabela: a mais nova primeiro');
for (let i = 0; i < 40; i++) ACOES.registrarRolagensTabela(estado, { rolagens: [{ tabela: 't', nome: 'n', face: 1, texto: 'x' }] });
ok(estado.rolagensTabela.length === 30, 'o histórico para em 30');
ok(ACOES.registrarRolagensTabela(estado, { rolagens: new Array(21).fill({}) }).erro, '21 rolagens de uma vez: recusado');

console.log(falhas ? '\n' + falhas + ' FALHAS' : '\nTudo certo no Node.');
process.exit(falhas ? 1 : 0);
