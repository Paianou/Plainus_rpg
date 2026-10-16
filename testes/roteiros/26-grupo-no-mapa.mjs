/* O Mestre põe o grupo no mapa fora do combate, e cada jogador anda
   com o próprio token — arrastando ou pelas setas. No combate, só na
   vez dele. */

/* ---- Mestre: campanha vazia ---- */
await ir('index.html');
await js(`document.getElementById('nome').value='Thiago'; document.getElementById('campanha').value='Teste grupo'`);
await clicarENavegar(`document.getElementById('btnCriar').click()`);
await js(`const b=()=>document.getElementById('btnAvancar').click(); b(); document.getElementById('premissa').value='p'; document.getElementById('cenario').value='c'; b(); b(); b(); b();`);
await clicarENavegar(`document.getElementById('btnAvancar').click()`);
const codigo = await js(`Estado.campanha.codigo`);

/* ---- Ana cria a Lyra ---- */
const ana = await novaAba();
await ana.ir('index.html');
await ana.js(`document.getElementById('nome').value='Ana'; document.getElementById('codigo').value=${JSON.stringify(codigo)};`);
await ana.navegarPor(`document.getElementById('btnEntrar').click()`);
await ana.js(digita('#f-nome', 'Lyra') + digita('#f-raca', 'Elfa') + digita('#f-classe', 'Guerreira'));
await ana.js(`document.querySelector('[data-acao="salvar-ficha"]').click()`); await espera(500);
await ana.js(`(async()=>{for(let i=0;i<20&&!document.querySelector('.tour-pular');i++)await new Promise(r=>setTimeout(r,100));const b=document.querySelector('.tour-pular');if(b)b.click();})()`); await espera(300);
await ana.js(`document.querySelector('.nav-jogador [data-aba="mesa"]').click()`); await espera(300);
ok(await ana.js(`/O Mestre ainda não abriu nenhuma cena/.test(document.getElementById('principal').textContent)`), 'sem cena: a Mesa avisa');

/* ---- Mestre: uma cena 10 × 8 com contorno, e o grupo nela ---- */
await cmd('Page.bringToFront');
await ir('mapas.html');
await js(`document.querySelector('[data-acao="nova-cena"]').click()`);
await js(`document.getElementById('cenaNome').value='Torre'; document.getElementById('cenaColunas').value='10'; document.getElementById('cenaLinhas').value='8'; document.getElementById('cenaLinhas').dispatchEvent(new Event('input')); document.getElementById('salvarCena').click()`);
await espera(300);
ok(await js(`!!document.querySelector('[data-acao="trazer-grupo"]') && !!document.querySelector('[data-acao="trazer"]')`), 'Mapas: "Trazer o grupo" ao lado de "Trazer combatentes"');
await js(`document.querySelector('[data-acao="trazer-grupo"]').click()`); await espera(300);
ok(await js(`Estado.cenas[0].tokens.length===1 && Estado.cenas[0].tokens[0].nome==='Lyra' && Estado.cenas[0].tokens[0].heroiId===Estado.herois[0].id`), 'a Lyra entra no mapa, ligada ao herói (heroiId), sem combate nenhum');
ok(await js(`/1 herói entrou no mapa/.test(document.body.textContent)`), 'o recado diz quantos entraram');

/* ---- Ana: o próprio token ---- */
await ana.frente();
ok(await aguardar(`!!document.querySelector('#principal .token-meu')`, ana.js), 'a Ana vê o próprio token, pronto para pegar');
ok(await ana.js(`document.querySelector('.mapa-jogador > svg').getAttribute('role')==='group' && document.querySelector('.token-meu').getAttribute('role')==='button' && document.querySelector('.token-meu').tabIndex===0`), 'o mapa é um grupo e o token é um botão no Tab (o leitor de tela o encontra)');
ok(await ana.js(`/Arraste o seu token para andar/.test(document.querySelector('.legenda-mapa-jogador').textContent)`), 'a legenda diz como andar');
await ana.foto('26-ana-mapa');

/* arrastar, com o mouse de verdade: duas casas para a direita */
const inicio = JSON.parse(await ana.js(`JSON.stringify(Conexao.visao.cena.tokens.find(t=>t.meu))`));
const tela = async (c, l) => ana.js(`(()=>{const s=document.querySelector('.mapa-jogador > svg'); const p=s.createSVGPoint(); p.x=${c}*CELULA+CELULA/2; p.y=${l}*CELULA+CELULA/2; const t=p.matrixTransform(s.getScreenCTM()); return {x:t.x,y:t.y};})()`);
const mouse = (type, p, buttons) => ana.cmd('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', buttons, clickCount: 1 });
await ana.js(`document.querySelector('.token-meu').scrollIntoView({block:'center'})`); await espera(100);
const de = await tela(inicio.col, inicio.lin), meio = await tela(inicio.col + 1, inicio.lin), ate = await tela(inicio.col + 2, inicio.lin);
await mouse('mousePressed', de, 1); await mouse('mouseMoved', meio, 1); await mouse('mouseMoved', ate, 1); await mouse('mouseReleased', ate, 0);
ok(await aguardar(`T.gravado().then(e=>{const t=e.cenas[0].tokens[0]; return t.col===${inicio.col + 2} && t.lin===${inicio.lin};})`, ana.js), 'arrastar duas casas: o servidor grava a Lyra na casa nova');

ok(await ana.js(`!MesaJogador.arrastando && !document.querySelector('.pegando')`), 'soltou: o token não fica "na mão" (a aba volta a receber as novidades)');

/* as setas: uma casa para baixo, e o foco continua no token */
await ana.js(`document.querySelector('.token-meu').focus()`);
await ana.cmd('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
await ana.cmd('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
ok(await aguardar(`T.gravado().then(e=>e.cenas[0].tokens[0].lin===${inicio.lin + 1})`, ana.js), 'seta para baixo: uma casa');
await espera(300);
ok(await ana.js(`document.activeElement===document.querySelector('.token-meu')`), '…e o foco segue no token (dá para andar de novo)');

/* o Mestre vê */
await cmd('Page.bringToFront');
ok(await aguardar(`Estado.cenas[0].tokens[0].col===${inicio.col + 2} && Estado.cenas[0].tokens[0].lin===${inicio.lin + 1}`), 'o Mestre vê a Lyra na casa nova, sem recarregar');

/* parede: o servidor recusa, e o token volta */
await ana.frente();
await ana.js(`enviarMeuToken(0, 0); Jogador.render()`);
ok(await aguardar(`(()=>{const t=Conexao.visao.cena.tokens.find(t=>t.meu); return t.col===${inicio.col + 2} && t.lin===${inicio.lin + 1};})()`, ana.js), 'andar para dentro da parede: recusado, o token volta para onde estava');

/* combate: fora da vez, não anda */
await ana.js(`(async()=>{const e=await T.gravado(); e.combate={ativo:true,rodada:1,encontro:'',registro:[],combatentes:[{id:'c1',nome:'Goblin',tipo:'inimigo',pv:7,pvMax:7,ca:13,iniciativa:18,agiu:false,condicoes:[]},{id:'c2',heroiId:e.herois[0].id,nome:'Lyra',tipo:'heroi',pv:10,pvMax:10,ca:12,iniciativa:9,agiu:false,condicoes:[]}]}; await T.trocar(e);})()`);
ok(await aguardar(`!document.querySelector('#principal .token-meu') && /No combate, você anda na sua vez/.test(document.querySelector('.legenda-mapa-jogador').textContent)`, ana.js), 'no combate, na vez do Goblin: o token não se pega, e a legenda explica');
await ana.js(`(async()=>{const e=await T.gravado(); e.combate.combatentes[0].agiu=true; await T.trocar(e);})()`);
ok(await aguardar(`!!document.querySelector('#principal .token-meu')`, ana.js), 'o Goblin agiu: é a vez da Lyra, e o token volta a se pegar');

await ana.fechar();
console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill(); process.exit(0);
