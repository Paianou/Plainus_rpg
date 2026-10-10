/* As ações de combate rodando no Node, sem navegador. */
const { ACOES } = require('../../acoes.js');
let falhas = 0;
const ok = (c, t) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + t); if (!c) falhas++; };

const estado = { herois: [{ id: 'h1', nome: 'Lyra', ca: 15, pv: 20, pvMax: 20, bonusIniciativa: 3, classe: 'Guerreira' }, { id: 'h2', nome: 'Kor', ca: 12, pv: 9, pvMax: 9, bonusIniciativa: 0, classe: 'Mago' }] };

/* entrar */
const g1 = ACOES.entrarNoCombate(estado, { molde: { nome: 'Esqueleto', ca: 13, pv: 13, bonusIniciativa: 2, nota: 'Morto-vivo' } });
const g2 = ACOES.entrarNoCombate(estado, { molde: { nome: 'Esqueleto', ca: 13, pv: 13, bonusIniciativa: 2 } });
ok(g1.combatente.nome === 'Esqueleto' && g2.combatente.nome === 'Esqueleto 2', 'dois "Esqueleto": o segundo vira "Esqueleto 2"');
ok(g1.combatente.iniciativa >= 3 && g1.combatente.iniciativa <= 22, 'iniciativa sorteada no servidor: d20 + 2 = ' + g1.combatente.iniciativa);
ok(estado.combate.registro[0].texto.startsWith('Esqueleto 2 entra no combate'), 'a entrada vai para o registro');

const p = ACOES.trazerParty(estado);
ok(p.entraram === 2 && estado.combate.combatentes.length === 4, 'trazerParty: os 2 heróis entram');
ok(ACOES.trazerParty(estado).erro === 'A party inteira já está no combate.', 'de novo: "A party inteira já está no combate."');
const lyra = estado.combate.combatentes.find(c => c.heroiId === 'h1');
ok(lyra.pv === 20 && lyra.ca === 15 && lyra.nota === 'Guerreira', 'herói entra com CA e PV da FICHA');
ok(ACOES.entrarNoCombate(estado, { molde: { heroiId: 'h1', pv: 999 } }).erro, 'herói que já está: recusado (e o "pv: 999" mandado junto nem é lido)');
ok(ACOES.entrarNoCombate(estado, { molde: { heroiId: 'h99' } }).erro, 'herói que não existe: recusado');
ok(ACOES.entrarNoCombate(estado, { molde: { nome: '  ' } }).erro, 'monstro sem nome: recusado');
const exagerado = ACOES.entrarNoCombate(estado, { molde: { nome: 'Tarrasque', pv: 1e9, ca: -5, bonusIniciativa: 'muito' } });
const t = estado.combate.combatentes.find(c => c.id === exagerado.combatente.id);
ok(t.pv === 9999 && t.ca === 1 && t.bonusIniciativa === 0, 'números absurdos são presos nos limites (PV 9999, CA 1, bônus 0)');
ACOES.sairDoCombate(estado, { id: t.id });

/* ordem e turnos */
const ordem = estado.combate.combatentes.map(c => c.iniciativa);
ok(ordem.every((v, i) => i === 0 || ordem[i - 1] >= v), 'a ordem fica da maior iniciativa para a menor');
ACOES.iniciarCombate(estado);
const primeiro = estado.combate.combatentes[0].nome;
const r1 = ACOES.proximoTurno(estado);
ok(estado.combate.combatentes[0].agiu && r1.proximo === estado.combate.combatentes[1].nome, 'próximo turno: ' + primeiro + ' agiu, agora é ' + r1.proximo);
ACOES.proximoTurno(estado); ACOES.proximoTurno(estado);
ok(ACOES.proximoTurno(estado).proximo === null, 'o último a agir: fim da rodada');
ok(ACOES.proximoTurno(estado).erro, 'mais um "próximo": erro, todos já agiram');
const ra = ACOES.avancarRodada(estado);
ok(ra.rodada === 2 && estado.combate.combatentes.every(c => !c.agiu), 'avançar rodada: rodada 2, ninguém agiu');

/* vida */
const r2 = ACOES.mudarPVCombatente(estado, { id: lyra.id, delta: -7 });
ok(r2.antes === 20 && r2.depois === 13 && estado.herois[0].pv === 13, 'dano na Lyra: 20 → 13, e a FICHA dela também foi para 13');
ACOES.mudarPVCombatente(estado, { id: lyra.id, delta: 50 });
ok(lyra.pv === 20 && estado.herois[0].pv === 20, 'cura não passa do máximo (20), na ficha também');
ok(ACOES.mudarPVCombatente(estado, { id: lyra.id, delta: 5 }).mudou === false, 'curar quem está cheio: nada muda');
const r3 = ACOES.mudarPVCombatente(estado, { id: g1.combatente.id, delta: -100 });
ok(r3.depois === 0 && r3.aviso === 'Esqueleto foi abatido.', 'monstro a 0: "Esqueleto foi abatido."');
const kor = estado.combate.combatentes.find(c => c.heroiId === 'h2');
ok(/caiu a 0 PV/.test(ACOES.mudarPVCombatente(estado, { id: kor.id, delta: -9 }).aviso), 'herói a 0: aviso dos testes de morte');

/* condições */
ok(ACOES.alternarCondicao(estado, { id: lyra.id, condicao: 'Envenenado' }).posta === true && lyra.condicoes[0] === 'Envenenado', 'pôr condição');
ok(ACOES.alternarCondicao(estado, { id: lyra.id, condicao: 'Envenenado' }).posta === false && lyra.condicoes.length === 0, 'alternar de novo tira');
ACOES.alternarCondicao(estado, { id: lyra.id, condicao: 'Caído' });
ok(!ACOES.tirarCondicao(estado, { id: lyra.id, condicao: 'Caído' }).erro && estado.combate.registro[0].texto === 'Lyra não está mais caído.', 'tirar condição vai para o registro');
ok(ACOES.alternarCondicao(estado, { id: lyra.id, condicao: 'x'.repeat(200) }).posta === true && lyra.condicoes[0].length === 30, 'condição com 200 letras é cortada em 30');

/* rolar de novo */
ACOES.rolarIniciativa(estado);
ok(estado.combate.rodada === 1 && estado.combate.combatentes.every(c => !c.agiu), 'rolar iniciativa: rodada 1 e todo mundo de novo');
const lyra2 = estado.combate.combatentes.find(c => c.heroiId === 'h1');
ok(lyra2.iniciativa >= 4 && lyra2.iniciativa <= 23, 'a Lyra rola com o bônus da ficha (+3): ' + lyra2.iniciativa);
for (let i = 0; i < 50; i++) ACOES.avancarRodada(estado);
ok(estado.combate.registro.length === 40, 'o registro do combate para em 40');
ACOES.encerrarCombate(estado);
ok(estado.combate.ativo === false, 'encerrar');

/* o sorteio é justo? 20.000 d20 */
const cont = new Array(21).fill(0);
for (let i = 0; i < 20000; i++) cont[ACOES.entrarNoCombate.length && (function () { const e = {}; return ACOES.entrarNoCombate(e, { molde: { nome: 'x', bonusIniciativa: 0 } }).combatente.iniciativa; })()]++;
const faces = cont.slice(1);
ok(faces.every(n => n > 800 && n < 1200), 'd20 do servidor equilibrado: cada face saiu entre 800 e 1200 vezes em 20 mil (min ' + Math.min(...faces) + ', máx ' + Math.max(...faces) + ')');

console.log(falhas ? '\n' + falhas + ' FALHAS' : '\nCombate certo no Node.');
process.exit(falhas ? 1 : 0);
