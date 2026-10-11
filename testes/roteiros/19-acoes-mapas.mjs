/* Mapas & Cenas: tokens, marcadores, trazer o combate, trocar e apagar cena — com o mouse de verdade. */
const gravado = (expr) => `(async()=>{const e=(await T.gravado()); return ${expr};})()`;
const centro = async (c, l) => js(`(()=>{const s=document.querySelector('#quadro svg'); const p=s.createSVGPoint(); p.x=${c}*CELULA+CELULA/2; p.y=${l}*CELULA+CELULA/2; const t=p.matrixTransform(s.getScreenCTM()); return {x:t.x,y:t.y};})()`);
const mouse = (type, p, buttons) => cmd('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', buttons, clickCount: 1 });

await ir('index.html');
await js(`document.querySelector('[data-porta="mestrar"]').click(); document.getElementById('nome').value='Thiago'; document.getElementById('campanha').value='Teste mapas'`);
await clicarENavegar(`document.getElementById('btnCriar').click()`);
await js(`document.getElementById('btnAvancar').click(); document.getElementById('premissa').value='x'; document.getElementById('cenario').value='y'; const b=()=>document.getElementById('btnAvancar').click(); b(); b(); b(); b(); document.querySelector('input[value="exemplo"]').checked=true`);
await clicarENavegar(`document.getElementById('btnAvancar').click()`);
await ir('combate.html');
await js(`Estado.combate={ativo:true, rodada:1, encontro:'', dificuldade:'', nd:'', combatentes:[], registro:[]}; await T.salvar(); document.querySelector('[data-acao="add-party"]').click()`); await espera(80);
await js(`document.getElementById('nomeAvulso').value='Ogro'; document.getElementById('pvAvulso').value='59'; document.querySelector('[data-acao="add-avulso"]').click()`); await espera(80);
const noCombate = await js(`Estado.combate.combatentes.length`);

await ir('mapas.html');
await js(`document.querySelector('[data-acao="nova-cena"]').click(); document.getElementById('cenaNome').value='Arena'; document.getElementById('cenaColunas').value='14'; document.getElementById('cenaLinhas').value='10'; document.getElementById('salvarCena').click()`); await espera(150);
const arena = await js(`Estado.cenaAtual`);
ok(await js(gravado(`e.cenas.some(c=>c.id==='${arena}' && c.nome==='Arena' && c.colunas===14 && c.paredes.length===4) && e.cenaAtual==='${arena}'`)), 'cena nova pela janela: gravada, com contorno, e atual');

/* trazer o combate */
await js(`document.querySelector('[data-acao="trazer"]').click()`); await espera(100);
ok(await js(gravado(`e.cenas.find(c=>c.id==='${arena}').tokens.length===${noCombate}`)), 'trazer o combate: ' + noCombate + ' tokens no mapa');
ok(await js(`document.querySelectorAll('#quadro [data-token]').length===${noCombate}`), 'e desenhados');

/* arrastar o Ogro com o mouse */
await js(`document.querySelector('[data-valor="mover"]').click()`); await espera(60);
const ogro = await js(`(()=>{const t=Mapa.cena().tokens.find(t=>t.nome==='Ogro'); return {id:t.id, col:t.col, lin:t.lin};})()`);
const de = await centro(ogro.col, ogro.lin);
const para = await centro(2, 2);
await mouse('mousePressed', de, 1);
await mouse('mouseMoved', { x: (de.x + para.x) / 2, y: (de.y + para.y) / 2 }, 1);
await mouse('mouseMoved', para, 1);
await mouse('mouseReleased', para, 0); await espera(150);
ok(await js(gravado(`(()=>{const t=e.cenas.find(c=>c.id==='${arena}').tokens.find(t=>t.id==='${ogro.id}'); return t.col===2 && t.lin===2;})()`)), 'arrastar o Ogro até (2, 2): gravado ao soltar');
ok(await js(`Mapa.selecionado==='${ogro.id}'`), 'e ele fica selecionado');

/* ao centro e tirar */
await js(`document.querySelector('[data-acao="centro"]').click()`); await espera(80);
ok(await js(gravado(`(()=>{const t=e.cenas.find(c=>c.id==='${arena}').tokens.find(t=>t.id==='${ogro.id}'); return t.col===7 && t.lin===5;})()`)), '"ao centro": (7, 5) numa cena 14 × 10');
await js(`document.querySelector('[data-acao="tirar-token"]').click()`); await espera(80);
ok(await js(gravado(`!e.cenas.find(c=>c.id==='${arena}').tokens.some(t=>t.id==='${ogro.id}')`)), 'tirar o token do mapa');

/* marcador */
await js(`document.querySelector('[data-valor="marcar"]').click()`); await espera(60);
const m = await centro(4, 6);
await mouse('mousePressed', m, 1); await mouse('mouseReleased', m, 0); await espera(150);
ok(await js(gravado(`e.cenas.find(c=>c.id==='${arena}').marcadores.some(x=>x.col===4 && x.lin===6 && x.texto==='Novo marcador')`)), 'ferramenta Marcar: clique cria marcador em (4, 6)');
await js(`(()=>{const c=document.querySelector('[data-marcador]'); c.value='Armadilha de lâminas'; c.dispatchEvent(new Event('change',{bubbles:true}));})()`); await espera(80);
ok(await js(gravado(`e.cenas.find(c=>c.id==='${arena}').marcadores[0].tipo==='perigo' && e.cenas.find(c=>c.id==='${arena}').marcadores[0].texto==='Armadilha de lâminas'`)), 'escrever "Armadilha..." no marcador: vira perigo');
await js(`document.querySelector('[data-acao="tirar-marcador"]').click()`); await espera(80);
ok(await js(gravado(`e.cenas.find(c=>c.id==='${arena}').marcadores.length===0`)), 'tirar o marcador');

/* trocar de cena */
const outra = await js(`Estado.cenas.find(c=>c.id!=='${arena}').id`);
await js(`document.querySelector('[data-acao="cena"][data-id="${outra}"]').click()`); await espera(80);
ok(await js(gravado(`e.cenaAtual==='${outra}'`)), 'trocar de cena: gravado');
await js(`document.querySelector('[data-acao="cena"][data-id="${arena}"]').click()`); await espera(80);

/* apagar e desfazer */
const nCenas = await js(`Estado.cenas.length`);
await js(`document.querySelector('[data-acao="apagar-cena"]').click()`); await espera(100);
ok(await js(gravado(`e.cenas.length===${nCenas - 1} && e.cenaAtual!=='${arena}'`)), 'apagar a Arena: some, e outra cena vira a atual');
await js(`document.querySelector('.desfazer-recado').click()`); await espera(100);
ok(await js(gravado(`e.cenas.length===${nCenas} && e.cenaAtual==='${arena}' && e.cenas.find(c=>c.id==='${arena}').tokens.length===${noCombate - 1}`)), '"Desfazer": a Arena volta, atual, com os tokens');
await foto('h1-mapas');

console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill();
process.exit(0);
