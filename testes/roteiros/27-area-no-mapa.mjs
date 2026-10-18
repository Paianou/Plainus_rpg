/* A medição em área: o jogador marca uma "bola de fogo" no mapa, o
   Mestre vê (e marca a dele), e todos veem as duas. */

/* ---- Mestre: campanha vazia ---- */
await ir('index.html');
await js(`document.getElementById('nome').value='Thiago'; document.getElementById('campanha').value='Teste área'`);
await clicarENavegar(`document.getElementById('btnCriar').click()`);
await js(`const b=()=>document.getElementById('btnAvancar').click(); b(); document.getElementById('premissa').value='p'; document.getElementById('cenario').value='c'; b(); b(); b(); b();`);
await clicarENavegar(`document.getElementById('btnAvancar').click()`);
const codigo = await js(`Estado.campanha.codigo`);

/* ---- Ana cria a Lyra ---- */
const ana = await novaAba();
await ana.ir('index.html');
await ana.js(`document.getElementById('nome').value='Ana'; document.getElementById('codigo').value=${JSON.stringify(codigo)};`);
await ana.navegarPor(`document.getElementById('btnEntrar').click()`);
await ana.js(digita('#f-nome', 'Lyra') + digita('#f-raca', 'Elfa') + digita('#f-classe', 'Maga'));
await ana.js(`document.querySelector('[data-acao="salvar-ficha"]').click()`); await espera(500);
await ana.js(`(async()=>{for(let i=0;i<20&&!document.querySelector('.tour-pular');i++)await new Promise(r=>setTimeout(r,100));const b=document.querySelector('.tour-pular');if(b)b.click();})()`); await espera(300);

/* ---- Mestre: cena 16 × 12 e o grupo nela ---- */
await cmd('Page.bringToFront');
await ir('mapas.html');
await js(`document.querySelector('[data-acao="nova-cena"]').click()`);
await js(`document.getElementById('cenaNome').value='Salão'; document.getElementById('cenaColunas').value='16'; document.getElementById('cenaLinhas').value='12'; document.getElementById('cenaLinhas').dispatchEvent(new Event('input')); document.getElementById('salvarCena').click()`);
await espera(300);
/* Digitar na janela de cena marcava o formulário de dentro como "sujo",
   e a marca ficava depois de fechar: a tela parava de redesenhar. */
ok(await js(`!Layout.ocupado() && !AvisoSaida.haPendencia()`), 'criar a cena e fechar a janela não deixa a tela "ocupada" (ela segue redesenhando)');
await js(`document.querySelector('[data-acao="trazer-grupo"]').click()`); await espera(300);

/* ---- Ana: marca a bola de fogo arrastando ---- */
await ana.frente();
await ana.js(`document.querySelector('.nav-jogador [data-aba="mesa"]').click()`); await espera(400);
ok(await ana.js(`!!document.querySelector('[data-acao="marcar-area"]') && document.getElementById('raioMinhaArea').value==='6' && !!document.querySelector('[data-acao="area-no-token"]')`), 'embaixo do mapa: o raio (6 m), "Marcar área" e "No meu personagem"');
await ana.js(`document.querySelector('[data-acao="marcar-area"]').click()`); await espera(200);
ok(await ana.js(`document.querySelector('[data-acao="marcar-area"]').getAttribute('aria-pressed')==='true' && document.querySelector('.mapa-jogador').classList.contains('marcando-area') && document.activeElement===document.querySelector('[data-acao="marcar-area"]')`), '"Marcar área" liga o modo (aria-pressed), o mapa vira mira, e o foco fica no botão');

const tela = async (x, y) => ana.js(`(()=>{const s=document.querySelector('.mapa-jogador > svg'); const p=s.createSVGPoint(); p.x=${x}*CELULA; p.y=${y}*CELULA; const t=p.matrixTransform(s.getScreenCTM()); return {x:t.x,y:t.y};})()`);
const mouse = (type, p, buttons) => ana.cmd('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', buttons, clickCount: 1 });
await ana.js(`document.querySelector('.mapa-jogador').scrollIntoView({block:'center'})`); await espera(100);
/* centro na linha da grade (4, 4); arrasta 2 e depois 4 casas para a direita: raio 6 m */
const c0 = await tela(4.05, 3.95), c1 = await tela(6, 4), c2 = await tela(8, 4);
await mouse('mousePressed', c0, 1); await mouse('mouseMoved', c1, 1);
ok(await ana.js(`/Lyra · 3 m/.test(document.querySelector('.areas-planta').textContent)`), 'arrastando: a prévia acompanha o ponteiro (3 m, duas casas)');
await mouse('mouseMoved', c2, 1); await mouse('mouseReleased', c2, 0);
ok(await aguardar(`T.gravado().then(e=>{const a=(e.cenas[0].areas||[])[0]; return !!a && a.x===4 && a.y===4 && a.raio===6 && a.nome==='Lyra';})`, ana.js), 'soltar: o servidor grava a área da Lyra — centro (4, 4), 6 m');
ok(await ana.js(`document.querySelector('[data-acao="marcar-area"]').getAttribute('aria-pressed')==='false' && !MesaJogador.arrastando`), 'depois de marcar, o modo desliga sozinho');
ok(await aguardar(`/No mapa: Lyra · 6 m \\(\\d+ casas\\)/.test(document.querySelector('.bloco-area').textContent)`, ana.js), 'o texto embaixo do mapa diz a área e quantas casas ela pega');
await ana.foto('27-ana-area');

/* ---- o Mestre vê, e marca a dele ---- */
await cmd('Page.bringToFront');
ok(await aguardar(`(Estado.cenas[0].areas||[]).length===1 && document.querySelectorAll('#quadro .areas-planta circle').length===2`), 'o Mestre vê a área da Lyra no mapa dele, sem recarregar');
await js(`document.querySelector('[data-valor="area"]').click()`); await espera(200);
ok(await js(`!!document.getElementById('raioArea') && /Lyra · 6 m · \\d+ casas/.test(document.getElementById('blocoToken').textContent)`), 'ferramenta Área: o painel mostra o raio e a área da Lyra');
await js(`document.getElementById('raioArea').value='9'; document.getElementById('raioArea').dispatchEvent(new Event('input',{bubbles:true}))`);
const ponto = async (x, y) => js(`(()=>{const s=document.querySelector('#quadro svg'); const p=s.createSVGPoint(); p.x=${x}*CELULA; p.y=${y}*CELULA; const t=p.matrixTransform(s.getScreenCTM()); return {x:t.x,y:t.y};})()`);
const m0 = await ponto(11.5, 6.5);
await cmd('Input.dispatchMouseEvent', { type: 'mousePressed', x: m0.x, y: m0.y, button: 'left', buttons: 1, clickCount: 1 });
await cmd('Input.dispatchMouseEvent', { type: 'mouseReleased', x: m0.x, y: m0.y, button: 'left', buttons: 0, clickCount: 1 });
ok(await aguardar(`T.gravado().then(e=>e.cenas[0].areas.some(a=>a.dono==='mestre' && a.raio===9 && a.x===11.5 && a.y===6.5))`), 'um clique, sem arrastar: a área do Mestre com o raio do campo (9 m), no meio da casa');
await foto('27-mestre-area');

/* ---- Ana vê as duas, e usa os botões ---- */
await ana.frente();
ok(await aguardar(`Conexao.visao.cena.areas.length===2 && Conexao.visao.cena.areas.filter(a=>a.minha).length===1`, ana.js), 'a Ana vê as duas áreas, e só a dela é "minha"');
await ana.js(`document.querySelector('[data-acao="area-no-token"]').click()`);
ok(await aguardar(`T.gravado().then(e=>{const t=e.cenas[0].tokens[0]; const a=e.cenas[0].areas.find(a=>a.dono!=='mestre'); return a.x===t.col+0.5 && a.y===t.lin+0.5;})`, ana.js), '"No meu personagem": a área dela vai para o meio do token (sem mouse)');
await ana.js(`document.querySelector('[data-acao="apagar-minha-area"]').click()`);
ok(await aguardar(`T.gravado().then(e=>e.cenas[0].areas.length===1 && e.cenas[0].areas[0].dono==='mestre')`, ana.js), '"Apagar a minha": some só a dela');

/* ---- o Mestre apaga a dele ---- */
await cmd('Page.bringToFront');
await aguardar(`(Estado.cenas[0].areas||[]).length===1`);
await js(`document.querySelector('[data-acao="tirar-area"]').click()`);
ok(await aguardar(`T.gravado().then(e=>e.cenas[0].areas.length===0)`), 'o × na lista do Mestre apaga a área');

await ana.fechar();
console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill(); process.exit(0);
