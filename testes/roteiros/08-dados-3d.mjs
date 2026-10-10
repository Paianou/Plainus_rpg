/* ---- Mestre: campanha vazia ---- */
await ir('index.html');
await js(`document.getElementById('nome').value='Thiago'; document.getElementById('campanha').value='Teste dados'`);
await clicarENavegar(`document.getElementById('btnCriar').click()`);
await js(`const b=()=>document.getElementById('btnAvancar').click(); b(); document.getElementById('premissa').value='p'; document.getElementById('cenario').value='c'; b(); b(); b(); b();`);
await clicarENavegar(`document.getElementById('btnAvancar').click()`);
const codigo = await js(`Estado.campanha.codigo`);

/* ---- Ana ---- */
const ana = await novaAba();
await ana.ir('index.html');
await ana.js(`document.getElementById('nome').value='Ana'; document.getElementById('codigo').value=${JSON.stringify(codigo)};`);
await ana.navegarPor(`document.getElementById('btnEntrar').click()`);
await ana.js(digita('#f-nome', 'Lyra') + digita('#f-raca', 'Elfa') + digita('#f-classe', 'Guerreira') + digita('[data-base="des"]', 15));
await ana.js(`document.querySelector('[data-acao="mais-linha"][data-lista="ataques"]').click()`);
await ana.js(`(()=>{const s=document.querySelector('[data-ataque="0"] [data-parte="arma"]'); s.value='Espada Longa'; s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
await ana.js(`document.querySelector('[data-acao="salvar-ficha"]').click()`); await espera(400);
await ana.js(`localStorage.setItem('plainus:animacao-dados','ligada')`);

ok(await ana.js(`Dados3D.tem3D()`), 'o navegador tem WebGL (o 3D funciona aqui)');

/* Qual face do dado i está virada para a câmera agora? */
const faceDeFrente = (i) => `(()=>{const d=Dados3D.dados[${i}]; const q=d.grupo.quaternion; let melhor=null, z=-2; d.faces.forEach(f=>{const n=f.normal.clone().applyQuaternion(q); if(n.z>z){z=n.z; melhor=f;}}); return {valor:melhor.valor, z:z};})()`;

/* ---- teste simples: Atletismo ---- */
await ana.js(`document.querySelector('button.pericia[data-texto="Atletismo"]').click()`);
await espera(350);
ok(await ana.js(`!!document.querySelector('.palco-dados.d20 canvas') && !document.querySelector('.palco-dados.pousou')`), 'clicar na perícia abre o palco e o d20 está rolando');
await ana.foto('d1-rolando');
await espera(1500);
const r1 = await ana.js(`Campanhas.lerEstado(Sessao.ler().campanhaId).rolagensMesa[0]`);
const f1 = await ana.js(faceDeFrente(0));
const dado1 = Number(/d20 \((\d+)\)/.exec(r1.formula)[1]);
ok(f1.valor === dado1 && f1.z > 0.999, 'o d20 parou com a face sorteada virada para a câmera (' + dado1 + ', z=' + f1.z.toFixed(4) + ')');
ok(await ana.js(`document.querySelector('.palco-dados.pousou .total-rolagem').textContent`) === String(r1.total), 'o total na tela é o total gravado: ' + r1.total);
await ana.foto('d2-pousou');
/* clique fecha */
await ana.js(`document.querySelector('.palco-dados').click()`); await espera(400);
ok(await ana.js(`!document.querySelector('.palco-dados')`), 'clicar com o resultado na tela fecha o palco');

/* ---- d20 de pé: o "alto" do número aponta para cima ---- */
const dePe = await ana.js(`(()=>{const d=Dados3D.dados[0]; const f=d.faces.find(x=>x.normal.clone().applyQuaternion(d.grupo.quaternion).z>0.99); const alto=f.alto.clone().applyQuaternion(d.grupo.quaternion); return alto.y;})()`);
ok(dePe > 0.99, 'o número da face está de pé (alto.y = ' + dePe.toFixed(3) + ')');

/* ---- as faces somam 21 com a oposta ---- */
ok(await ana.js(`Dados3D.dados[0].faces.every(f=>{const o=Dados3D.dados[0].faces.find(g=>g.normal.dot(f.normal)<-0.99); return f.valor+o.valor===21;}) && new Set(Dados3D.dados[0].faces.map(f=>f.valor)).size===20`), 'numeração de d20 de verdade: 1 a 20, faces opostas somam 21');

/* ---- vantagem + CD ---- */
await ana.js(`document.querySelector('[data-acao="modo-rolagem"][data-modo="vantagem"]').click()`);
await ana.js(`(()=>{const c=document.getElementById('cdTeste'); c.value='15'; c.dispatchEvent(new Event('input',{bubbles:true}));})()`);
await ana.js(`document.querySelector('button.pericia[data-texto="Acrobacia"]').click()`); await espera(1900);
const r2 = await ana.js(`Campanhas.lerEstado(Sessao.ler().campanhaId).rolagensMesa[0]`);
const [a2, b2] = /d20 \((\d+), (\d+)\)/.exec(r2.formula).slice(1).map(Number);
const fa = await ana.js(faceDeFrente(0)); const fb = await ana.js(faceDeFrente(1));
ok(fa.valor === a2 && fb.valor === b2, 'vantagem: dois d20, cada um parado no seu valor (' + a2 + ' e ' + b2 + ')');
const opacidades = await ana.js(`Dados3D.dados.map(d=>d.pedra.opacity)`);
ok((a2 >= b2 ? opacidades[1] : opacidades[0]) < 0.5 && (a2 >= b2 ? opacidades[0] : opacidades[1]) === 1, 'o dado descartado se apaga');
const veredito = await ana.js(`document.querySelector('.palco-dados .veredito').textContent`);
ok(veredito === (r2.total >= 15 ? 'Sucesso · CD 15' : 'Falha · CD 15'), 'com CD 15 e total ' + r2.total + ': "' + veredito + '"');
await ana.foto('d3-vantagem-cd');
await ana.js(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`); await espera(350);
ok(await ana.js(`!document.querySelector('.palco-dados')`), 'Esc fecha');

/* ---- pular: clicar durante a rolagem vai direto ao resultado ---- */
await ana.js(`document.querySelector('[data-acao="modo-rolagem"][data-modo="normal"]').click()`);
await ana.js(`document.querySelector('button.pericia[data-texto="Furtividade"]').click()`);
await espera(120);
await ana.js(`document.querySelector('.palco-dados').click()`); await espera(150);
ok(await ana.js(`!!document.querySelector('.palco-dados.pousou')`), 'clicar no meio da rolagem pula direto para o resultado');
await ana.js(`document.querySelector('.palco-dados').click()`); await espera(350);

/* ---- 20 natural: o crítico ---- */
await ana.js(`window._d=Layout.dado; Layout.dado=f=>f; document.querySelector('[data-acao="atacar"]').click(); Layout.dado=window._d;`);
await espera(1900);
ok(await ana.js(`document.querySelector('.palco-dados').classList.contains('critico')`) && (await ana.js(faceDeFrente(0))).valor === 20, '20 natural: o dado mostra o 20 e o palco acende o crítico');
ok(await ana.js(`document.querySelector('.palco-dados .veredito').textContent`) === 'Crítico · acerta', 'ataque com 20 natural: "Crítico · acerta", mesmo com CA preenchida');
await ana.foto('d4-critico');
await ana.js(`document.querySelector('.palco-dados').click()`); await espera(350);

/* ---- dano: a bandeja, crítico dobrando os dados ---- */
await ana.js(`document.querySelector('[data-acao="dano"]').click()`); await espera(250);
ok(await ana.js(`!!document.querySelector('.palco-dados.bandeja') && !document.querySelector('.palco-dados.bandeja .parou')`), 'dano abre a bandeja, com os dados embaralhando');
await espera(900);
const r3 = await ana.js(`Campanhas.lerEstado(Sessao.ler().campanhaId).rolagensMesa[0]`);
const mostrados = await ana.js(`[...document.querySelectorAll('.dado-2d.parou')].map(e=>Number(e.textContent))`);
const gravados = /\(([\d, ]+)\)/.exec(r3.formula)[1].split(',').map(Number);
ok(mostrados.length === 2 && JSON.stringify(mostrados) === JSON.stringify(gravados), 'a bandeja mostra os 2d8 do crítico com os valores gravados: ' + mostrados.join(', '));
ok(await ana.js(`document.querySelectorAll('.dado-2d.d8').length===2`), 'cada dado da bandeja tem o formato do d8');
await ana.foto('d5-bandeja-dano');
await espera(2000);
ok(await ana.js(`!document.querySelector('.palco-dados')`), 'a bandeja some sozinha depois de um tempo');

/* ---- desligada: recado, sem palco ---- */
await ana.js(`document.querySelector('[data-acao="alternar-animacao"]').click()`);
await ana.js(`document.querySelector('button.pericia[data-texto="Percepção"]').click()`); await espera(300);
ok(await ana.js(`!document.querySelector('.palco-dados') && [...document.querySelectorAll('.recado-flutuante')].some(r=>r.textContent.startsWith('Percepção:'))`), 'desligada: sem animação, o resultado vem no recado como antes');
await ana.js(`document.querySelector('[data-acao="alternar-animacao"]').click()`);

/* ---- "reduzir movimento" sem escolha feita: começa desligada ---- */
await ana.js(`localStorage.removeItem('plainus:animacao-dados')`);
await ana.emular([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
ok(await ana.js(`Dados3D.ativa()===false`), 'com "reduzir movimento" no sistema e sem escolha feita, começa desligada');
await ana.emular([]);
await ana.js(`localStorage.setItem('plainus:animacao-dados','ligada')`);

/* ---- o Mestre ---- */
await js(`localStorage.setItem('plainus:animacao-dados','ligada')`);
await cmd('Page.bringToFront');
await ir('mestre.html');
await js(`document.querySelector('[data-acao="modo"][data-modo="desvantagem"]').click(); document.querySelector('[data-faces="20"]').click()`);
await espera(1900);
const rm = await js(`Estado.rolagens[0]`);
const [am, bm] = /\((\d+), (\d+)\)/.exec(rm.formula).slice(1).map(Number);
ok((await js(faceDeFrente(0))).valor === am && (await js(faceDeFrente(1))).valor === bm, 'Mestre: desvantagem com dois d20 parados nos valores (' + am + ', ' + bm + ')');
await foto('d6-mestre');
await js(`document.querySelector('.palco-dados').click()`); await espera(350);
await js(`document.querySelector('[data-faces="6"]').click()`); await espera(900);
ok(await js(`!!document.querySelector('.palco-dados.bandeja .dado-2d.d6.parou')`), 'Mestre: d6 vai para a bandeja');
ok(await js(`[...document.querySelectorAll('.dado .face')].map(f=>getComputedStyle(f).fontFamily).every(x=>/Inter/.test(x))`), 'botões de dado em Inter (fim do "dIO")');

await ana.frente();
await ana.tamanho(390, 844);
await ana.js(`document.querySelector('.nav-jogador [data-aba="ficha"]').click(); document.querySelector('button.pericia[data-texto="Atletismo"]').click()`); await espera(1900);
ok(await ana.js(`document.documentElement.scrollWidth <= 390 && !!document.querySelector('.palco-dados.pousou')`), 'no celular, o palco cabe na tela');
await ana.foto('d7-celular');
await ana.fechar();

console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill();
process.exit(0);
