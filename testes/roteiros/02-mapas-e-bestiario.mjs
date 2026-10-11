/* ---- preparar: campanha vazia ---- */
await ir('index.html');
await js(`document.getElementById('nome').value='Thiago'; document.getElementById('campanha').value='Teste mapas'`);
await clicarENavegar(`document.getElementById('btnCriar').click()`);
await js(`document.getElementById('btnAvancar').click(); document.getElementById('premissa').value='p'; document.getElementById('cenario').value='c'; document.getElementById('btnAvancar').click(); document.getElementById('btnAvancar').click(); document.getElementById('btnAvancar').click(); document.getElementById('btnAvancar').click();`);
await clicarENavegar(`document.getElementById('btnAvancar').click()`);
ok(await js(`location.pathname.endsWith('mestre.html')`), 'campanha vazia criada');

/* ================= MAPAS ================= */
await ir('mapas.html');
ok(await js(`!!document.querySelector('[data-acao="nova-cena"]') && document.getElementById('quadro').hidden`), 'sem cena: botão Nova cena e quadro escondido');
await js(`document.querySelector('[data-acao="nova-cena"]').click()`);
ok(await js(`document.getElementById('dialogoCena').open`), 'janela de cena abre');
await js(`document.getElementById('salvarCena').click()`);
ok(await js(`document.getElementById('erroCena').textContent==='Dê um nome à cena.'`), 'cena sem nome recusada');
await js(`document.getElementById('cenaNome').value='Torre'; document.getElementById('cenaColunas').value='10'; document.getElementById('cenaLinhas').value='8'; document.getElementById('cenaLinhas').dispatchEvent(new Event('input')); document.getElementById('salvarCena').click()`);
ok(await js(`!document.getElementById('dialogoCena').open && Estado.cenas.length===1 && Estado.cenaAtual===Estado.cenas[0].id && Estado.cenas[0].paredes.length===4`), 'cena criada, aberta, com contorno');
ok(await js(`T.gravado().then(e=>e.cenas.length===1)`), 'cena gravada no servidor');

/* pintar com o mouse de verdade */
await js(`document.querySelector('[data-valor="parede"]').click()`);
const centro = async (c, l) => js(`(()=>{const s=document.querySelector('#quadro svg'); const p=s.createSVGPoint(); p.x=${c}*CELULA+20; p.y=${l}*CELULA+20; const t=p.matrixTransform(s.getScreenCTM()); return {x:t.x,y:t.y};})()`);
const mouse = (type, p, buttons) => cmd('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', buttons, clickCount: 1 });
const a = await centro(3, 3), b = await centro(4, 3), c = await centro(5, 3);
await mouse('mousePressed', a, 1); await mouse('mouseMoved', b, 1); await mouse('mouseMoved', c, 1); await mouse('mouseReleased', c, 0);
await espera(200);
const linha3 = await js(`JSON.stringify(Estado.cenas[0].paredes.filter(p=>p[1]===3))`);
ok(linha3 === '[[0,3,1,1],[3,3,3,1],[9,3,1,1]]', 'arrastar pinta 3 células de parede numa faixa só ' + linha3);
const d = await centro(4, 3);
await mouse('mousePressed', d, 1); await mouse('mouseReleased', d, 0); await espera(200);
const linha3b = await js(`JSON.stringify(Estado.cenas[0].paredes.filter(p=>p[1]===3))`);
ok(linha3b === '[[0,3,1,1],[3,3,1,1],[5,3,1,1],[9,3,1,1]]', 'clicar numa parede tira só aquela célula ' + linha3b);
ok(await js(`T.gravado().then(e=>JSON.stringify(e.cenas[0].paredes)===JSON.stringify(Estado.cenas[0].paredes))`), 'paredes salvas no servidor ao soltar');
await foto('m1-paredes');

/* redimensionar */
await js(`document.querySelector('[data-acao="editar-cena"]').click(); document.getElementById('cenaColunas').value='5'; document.getElementById('salvarCena').click()`);
ok(await js(`Estado.cenas[0].colunas===5 && Estado.cenas[0].paredes.every(p=>p[0]+p[2]<=5)`), 'encolher corta as paredes na borda nova');

/* imagem */
await js(`document.querySelector('[data-acao="editar-cena"]').click(); document.getElementById('cenaColunas').value='20'`);
await js(`new Promise(r=>{const cv=document.createElement('canvas'); cv.width=3000; cv.height=1500; const g=cv.getContext('2d'); for(let i=0;i<3000;i+=50){g.fillStyle='hsl('+(i%360)+',60%,40%)'; g.fillRect(i,0,50,1500);} cv.toBlob(bl=>{Mapa.escolherImagem(new File([bl],'mapa.png',{type:'image/png'})); r();},'image/png');})`);
await espera(1500);
ok(await js(`typeof Mapa.imagemEscolhida==='string' && Mapa.imagemEscolhida.length < 700000 && !document.getElementById('previaImagem').hidden`), 'imagem comprimida e prévia mostrada');
ok(await js(`document.getElementById('cenaLinhas').value`) === '10', 'linhas ajustadas à proporção (2:1 em 20 colunas = 10)');
await foto('m2-janela-imagem');
await js(`document.getElementById('salvarCena').click()`);
ok(await js(`!!imagemDaCena(Estado.cenas[0]) && !!document.querySelector('#quadro svg image')`), 'imagem salva e desenhada no mapa');
await foto('m3-mapa-imagem');
await ir('mestre.html');
ok(await js(`!!document.querySelector('.mapa svg image')`), 'Visão Geral mostra a imagem na miniatura');
await ir('mapas.html');

/* a imagem foi para o servidor, e a página recarregada a recebe de lá */
ok(await js(`T.gravado().then(e=>!!imagemDaCena(e.cenas[0]))`), 'a imagem da cena está no servidor');

/* imagem inválida no estado é ignorada */
ok(await js(`imagemDaCena({imagem:'javascript:alert(1)'})===null && imagemDaCena({imagem:'data:image/svg+xml;base64,AAAA'})===null`), 'imagem que não é JPEG em base64 é ignorada');

/* apagar */
await js(`document.querySelector('[data-acao="apagar-cena"]').click()`); await espera(300);
ok(await js(`Estado.cenas.length===0 && Estado.cenaAtual===null && document.getElementById('quadro').hidden`), 'apagar cena volta ao estado vazio');

/* ================= MONSTROS ================= */
await ir('bestiario.html');
await js(`document.querySelector('[data-acao="novo"]').click()`);
ok(await js(`!!document.getElementById('campo-nome') && document.querySelectorAll('.atributos-form input').length===6`), 'formulário de monstro abre');
await js(`document.querySelector('[data-acao="salvar"]').click()`);
ok(await js(`[...document.querySelectorAll('.recado-flutuante.erro')].some(r=>r.textContent==='Dê um nome ao monstro.')`), 'monstro sem nome recusado');
await js(`document.getElementById('campo-nome').value='Lobo Sombrio'; document.getElementById('campo-tipo').value='Fera'; document.getElementById('campo-ca').value='14'; document.getElementById('campo-pv').value='30'; document.getElementById('campo-nd').value='2'; document.getElementById('atrib-des').value='16'; document.querySelector('[data-lista="acoes"][data-parte="nome"]').value='Mordida'; document.querySelector('[data-lista="acoes"][data-parte="texto"]').value='+5 para acertar.'; document.querySelector('[data-acao="mais-bloco"][data-lista="tracos"]').click()`);
ok(await js(`document.getElementById('campo-nome').value==='Lobo Sombrio' && document.querySelectorAll('[data-lista="tracos"][data-parte="nome"]').length===1`), 'adicionar traço não apaga o que foi digitado');
await js(`document.querySelector('[data-lista="tracos"][data-parte="texto"]').value='Some nas sombras.'; document.querySelector('[data-acao="salvar"]').click()`);
ok(await js(`[...document.querySelectorAll('.recado-flutuante.erro')].some(r=>r.textContent.startsWith('Traço sem nome'))`), 'traço sem nome recusado');
await js(`document.querySelector('[data-lista="tracos"][data-parte="nome"]').value='Sombra'`);
await foto('b1-formulario');
await js(`document.querySelector('[data-acao="salvar"]').click()`);
ok(await js(`Estado.monstrosMeus.length===1 && Estado.monstrosMeus[0].xp===450 && Estado.monstrosMeus[0].atributos.des===16`), 'monstro salvo com XP pelo ND');
ok(await js(`document.querySelector('.titulo-detalhe').textContent==='Lobo Sombrio' && [...document.querySelectorAll('.item-compendio')].some(i=>i.textContent.includes('Lobo Sombrio') && i.textContent.includes('Sua'))`), 'ficha aberta e marcada "Sua" na lista');
await foto('b2-ficha');
/* duplicar */
await js(`Bestiario.abrir('Esqueleto'); document.querySelector('[data-acao="duplicar"]').click()`);
ok(await js(`document.getElementById('campo-nome').value==='Esqueleto (cópia)' && document.getElementById('atrib-con').value==='15'`), 'duplicar copia a ficha do livro');
await js(`document.getElementById('campo-nome').value='Esqueleto'; document.querySelector('[data-acao="salvar"]').click()`);
ok(await js(`Estado.monstrosMeus.length===1`), 'nome repetido recusado');
await js(`document.getElementById('campo-nome').value='Esqueleto Guerreiro'; document.querySelector('[data-acao="salvar"]').click()`);
ok(await js(`Estado.monstrosMeus.length===2 && acharMonstro('Esqueleto Guerreiro').meu===true`), 'cópia salva como monstro seu');
ok(await js(`!!document.querySelector('[data-acao="editar"]')`), 'monstro seu tem Editar');
await js(`Bestiario.abrir('Esqueleto')`);
ok(await js(`!document.querySelector('[data-acao="editar"]') && !document.querySelector('[data-acao="apagar"]')`), 'monstro do livro não tem Editar nem Apagar');
/* editar */
await js(`Bestiario.abrir('Lobo Sombrio'); document.querySelector('[data-acao="editar"]').click(); document.getElementById('campo-pv').value='42'; document.querySelector('[data-acao="salvar"]').click()`);
ok(await js(`acharMonstro('Lobo Sombrio').pv===42 && Estado.monstrosMeus.length===2`), 'editar atualiza sem duplicar');
/* combate e busca */
await ir('combate.html');
ok(await js(`[...document.getElementById('escolhaMonstro').options].some(o=>o.value==='Lobo Sombrio')`), 'monstro novo aparece no Combate');
await js(`document.getElementById('escolhaMonstro').value='Lobo Sombrio'; document.querySelector('[data-acao="add-monstro"]').click()`);
ok(await js(`Estado.combate.combatentes.some(c=>c.nome==='Lobo Sombrio' && c.pv===42 && c.ca===14)`), 'entra no combate com CA e PV dele');
ok(await js(`Busca.montarIndice().some(i=>i.grupo==='Monstros' && i.titulo==='Lobo Sombrio')`), 'monstro novo aparece na busca Ctrl+K');
/* apagar */
await ir('bestiario.html#abrir=' + encodeURIComponent('monstro:Lobo Sombrio'));
await js(`document.querySelector('[data-acao="apagar"]').click()`); await espera(300);
ok(await js(`!acharMonstro('Lobo Sombrio') && Estado.monstrosMeus.length===1`), 'apagar monstro');

await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await ir('bestiario.html'); await js(`document.querySelector('[data-acao="novo"]').click()`);
ok(await js(`document.documentElement.scrollWidth <= 390`), 'formulário de monstro sem rolagem lateral no celular');
await ir('mapas.html'); await js(`document.querySelector('[data-acao="nova-cena"]').click()`);
ok(await js(`document.documentElement.scrollWidth <= 390`), 'janela de cena cabe no celular');
await foto('m4-celular-janela');

console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill();
process.exit(0);
