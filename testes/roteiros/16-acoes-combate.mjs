/* A tela de Combate inteira, clicando como o Mestre clica. */
const gravado = (expr) => `(async()=>{const e=(await T.gravado()); return ${expr};})()`;
const naLinha = (nome, acao) => `[...document.querySelectorAll('#listaCombatentes [data-id]')].find(l=>l.querySelector('.nome-combatente').firstChild.textContent===${JSON.stringify(nome)}).querySelector('[data-acao="${acao}"]')`;
const idDe = (nome) => `Estado.combate.combatentes.find(c=>c.nome===${JSON.stringify(nome)}).id`;

await ir('index.html');
await js(`document.querySelector('[data-porta="mestrar"]').click(); document.getElementById('nome').value='Thiago'; document.getElementById('campanha').value='Teste combate'`);
await clicarENavegar(`document.getElementById('btnCriar').click()`);
await js(`document.getElementById('btnAvancar').click(); document.getElementById('premissa').value='x'; document.getElementById('cenario').value='y'; const b=()=>document.getElementById('btnAvancar').click(); b(); b(); b(); b(); document.querySelector('input[value="exemplo"]').checked=true`);
await clicarENavegar(`document.getElementById('btnAvancar').click()`);

/* começar limpo: sem combatentes */
await js(`Estado.combate={ativo:false, rodada:1, encontro:'', dificuldade:'', nd:'', combatentes:[], registro:[]}; await T.salvar();`);

/* ---- bestiário: somar ao combate ---- */
await ir('bestiario.html');
const monstro = await js(`todosMonstros()[0].nome`);
await js(`document.querySelector('[data-acao="abrir"][data-nome="${monstro}"]') ? document.querySelector('[data-acao="abrir"][data-nome="${monstro}"]').click() : Bestiario.abrir && Bestiario.abrir(${JSON.stringify(monstro)})`);
await js(`(()=>{Bestiario.selecionado=${JSON.stringify(monstro)}; Bestiario.render();})()`); await espera(80);
await js(`document.querySelector('[data-acao="somar"]').click()`); await espera(80);
await js(`document.querySelector('[data-acao="somar"]').click()`); await espera(80);
const nomes = await js(gravado(`e.combate.combatentes.map(c=>c.nome)`));
ok(nomes.length === 2 && nomes.includes(monstro) && nomes.includes(monstro + ' 2'), 'bestiário: "Somar ao combate" duas vezes → ' + nomes.join(' e '));

/* ---- a tela de combate ---- */
await ir('combate.html');
await js(`document.querySelector('[data-acao="add-party"]').click()`); await espera(80);
const herois = await js(gravado(`e.herois.length`));
ok(await js(gravado(`e.combate.combatentes.filter(c=>c.heroiId).length===${herois}`)), 'trazer a party: os ' + herois + ' heróis entram');
await js(`document.querySelector('[data-acao="add-party"]').click()`); await espera(80);
ok(await js(`[...document.querySelectorAll('.recado-flutuante')].some(r=>r.textContent.includes('A party inteira já está no combate.'))`), 'de novo: "A party inteira já está no combate."');

await js(`document.getElementById('nomeAvulso').value='Bandido'; document.getElementById('pvAvulso').value='11'; document.getElementById('caAvulso').value='12'; document.querySelector('[data-acao="add-avulso"]').click()`); await espera(80);
ok(await js(gravado(`e.combate.combatentes.some(c=>c.nome==='Bandido' && c.pv===11 && c.ca===12 && c.nota==='Avulso')`)) && await js(`document.getElementById('nomeAvulso').value===''`), 'avulso: entra com PV 11 e CA 12, e o campo limpa');
await js(`document.getElementById('nomeAvulso').value='  '; document.querySelector('[data-acao="add-avulso"]').click()`); await espera(80);
ok(await js(gravado(`!e.combate.combatentes.some(c=>c.nome.trim()==='')`)), 'avulso sem nome: não entra');

/* iniciar e turnos */
await js(`document.querySelector('[data-acao="iniciar-combate"]').click()`); await espera(80);
ok(await js(gravado(`e.combate.ativo===true && e.combate.rodada===1 && e.combate.registro[0].texto==='Combate iniciado.'`)), 'iniciar combate: ativo, rodada 1, no registro');
const n = await js(`Estado.combate.combatentes.length`);
const primeiro = await js(`Estado.combate.combatentes[0].nome`);
await js(`document.querySelector('[data-acao="proximo-turno"]').click()`); await espera(80);
ok(await js(gravado(`e.combate.combatentes[0].agiu===true && e.combate.combatentes[1].agiu===false`)) && await js(`document.querySelector('.combatente.vez .nome-combatente').firstChild.textContent`) === await js(`Estado.combate.combatentes[1].nome`), 'próximo turno: ' + primeiro + ' agiu e a vez (destacada) passa para o seguinte');
for (let i = 1; i < n; i++) { await js(`document.querySelector('[data-acao="proximo-turno"]').click()`); await espera(40); }
ok(await js(`[...document.querySelectorAll('.recado-flutuante')].some(r=>r.textContent.startsWith('Fim da rodada 1'))`), 'depois do último: "Fim da rodada 1"');
await js(`document.querySelector('[data-acao="avancar-rodada"]').click()`); await espera(80);
ok(await js(gravado(`e.combate.rodada===2 && e.combate.combatentes.every(c=>!c.agiu)`)), 'avançar rodada: rodada 2, todos de novo');

/* dano e cura num herói: a ficha acompanha */
const heroi = await js(`(()=>{const c=Estado.combate.combatentes.find(c=>c.heroiId); return {nome:c.nome, id:c.heroiId, pv:c.pv, max:c.pvMax};})()`);
await js(`(()=>{const b=${naLinha(heroi.nome, 'dano')}; b.closest('[data-id]').querySelector('[data-campo="valor"]').value='4'; b.click();})()`); await espera(80);
ok(await js(gravado(`e.herois.find(h=>h.id===${JSON.stringify(heroi.id)}).pv===${heroi.pv - 4} && e.combate.combatentes.find(c=>c.heroiId===${JSON.stringify(heroi.id)}).pv===${heroi.pv - 4}`)), 'dano 4 em ' + heroi.nome + ': combate e FICHA em ' + (heroi.pv - 4));
await js(`(()=>{const b=${naLinha(heroi.nome, 'cura')}; b.closest('[data-id]').querySelector('[data-campo="valor"]').value='999'; b.click();})()`); await espera(80);
ok(await js(gravado(`e.herois.find(h=>h.id===${JSON.stringify(heroi.id)}).pv===${heroi.max}`)), 'cura 999: para no máximo (' + heroi.max + '), na ficha também');
/* Enter no campo aplica dano; vazio vale 5 */
await js(`(()=>{const c=${naLinha('Bandido', 'dano')}.closest('[data-id]').querySelector('[data-campo="valor"]'); c.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));})()`); await espera(80);
ok(await js(gravado(`e.combate.combatentes.find(c=>c.nome==='Bandido').pv===6`)), 'Enter com o campo vazio: dano padrão de 5 (11 → 6)');
await js(`(()=>{const b=${naLinha('Bandido', 'dano')}; b.closest('[data-id]').querySelector('[data-campo="valor"]').value='50'; b.click();})()`); await espera(80);
ok(await js(gravado(`e.combate.combatentes.find(c=>c.nome==='Bandido').pv===0 && e.combate.registro[0].texto==='Bandido foi abatido.'`)) && await js(`!!document.querySelector('.combatente.caido')`), 'Bandido a 0: "foi abatido", e a linha aparece caída');

/* condições */
await js(`${naLinha(heroi.nome, 'menu-condicao')}.click()`); await espera(60);
await js(`document.querySelector('[data-acao="por-condicao"][data-condicao="Envenenado"]').click()`); await espera(80);
ok(await js(gravado(`e.combate.combatentes.find(c=>c.heroiId===${JSON.stringify(heroi.id)}).condicoes.includes('Envenenado')`)) && await js(`[...document.querySelectorAll('.chip-condicao')].some(c=>c.textContent.startsWith('Envenenado'))`), 'pôr "Envenenado": gravado, com a etiqueta na linha');
await js(`document.querySelector('[data-acao="tirar-condicao"][data-condicao="Envenenado"]').click()`); await espera(80);
ok(await js(gravado(`e.combate.combatentes.find(c=>c.heroiId===${JSON.stringify(heroi.id)}).condicoes.length===0 && e.combate.registro[0].texto.endsWith('não está mais envenenado.')`)), 'o "×" da etiqueta tira, e o registro conta');

/* rolar iniciativa, remover, encerrar */
await js(`document.querySelector('[data-acao="rolar-iniciativa"]').click()`); await espera(80);
const ordem = await js(gravado(`e.combate.combatentes.map(c=>c.iniciativa)`));
ok(ordem.every((v, i) => i === 0 || ordem[i - 1] >= v) && await js(gravado(`e.combate.rodada===1`)), 'rolar iniciativa: ordem nova, da maior para a menor, rodada 1');
await js(`${naLinha('Bandido', 'remover')}.click()`); await espera(80);
ok(await js(gravado(`!e.combate.combatentes.some(c=>c.nome==='Bandido') && e.combate.registro[0].texto==='Bandido saiu do combate.'`)), 'remover: Bandido sai, e o registro conta');
await js(`document.querySelector('[data-acao="encerrar"]').click()`); await espera(80);
ok(await js(gravado(`e.combate.ativo===false && e.combate.combatentes.length===${n - 1}`)), 'encerrar: combate parado, mas a ordem fica salva');
await foto('g1-combate');

console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill();
process.exit(0);
