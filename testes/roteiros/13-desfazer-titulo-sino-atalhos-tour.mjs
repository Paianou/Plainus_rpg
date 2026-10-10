const dialogos = [];
ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.method === 'Page.javascriptDialogOpening') dialogos.push(d.params.type); });
const tecla = (key, extra) => `document.dispatchEvent(new KeyboardEvent('keydown',Object.assign({key:${JSON.stringify(key)},bubbles:true,cancelable:true},${JSON.stringify(extra || {})})))`;

/* ---- campanha com exemplo ---- */
await ir('index.html');
await js(`document.querySelector('[data-porta="mestrar"]').click(); document.getElementById('nome').value='Thiago'; document.getElementById('campanha').value='Teste melhorias'`);
await clicarENavegar(`document.getElementById('btnCriar').click()`);
await js(`document.getElementById('btnAvancar').click(); document.getElementById('premissa').value='x'; document.getElementById('cenario').value='y'; const b=()=>document.getElementById('btnAvancar').click(); b(); b(); b(); b(); document.querySelector('input[value="exemplo"]').checked=true`);
await clicarENavegar(`document.getElementById('btnAvancar').click()`);
const codigo = await js(`Estado.campanha.codigo`);

/* ================= 5. DESFAZER ================= */
await ir('npcs.html');
const npc0 = await js(`(()=>{const n=Elenco.npcs()[1]; return {id:n.id, nome:n.nome, total:Elenco.npcs().length};})()`);
await js(`Elenco.selecionado=${JSON.stringify(npc0.id)}; Elenco.render();`);
dialogos.length = 0;
await js(`document.querySelector('[data-acao="apagar"]').click()`); await espera(100);
ok(!dialogos.length, 'apagar um NPC não abre mais o "Tem certeza?"');
ok(await js(`Elenco.npcs().length===${npc0.total - 1} && !Campanhas.lerEstado(Sessao.ler().campanhaId).npcs.some(n=>n.id===${JSON.stringify(npc0.id)})`), 'o NPC sai na hora (e já sai do que está gravado)');
ok(await js(`!!document.querySelector('.recado-flutuante.com-acao .desfazer-recado')`), 'aparece o recado com "Desfazer"');
await foto('m1-desfazer');
await js(`document.querySelector('.desfazer-recado').click()`); await espera(100);
ok(await js(`Elenco.npcs()[1].id===${JSON.stringify(npc0.id)} && Elenco.selecionado===${JSON.stringify(npc0.id)} && Campanhas.lerEstado(Sessao.ler().campanhaId).npcs.length===${npc0.total}`), '"Desfazer" devolve o NPC no MESMO lugar da lista, selecionado e gravado');
await js(`document.querySelector('[data-acao="apagar"]').click()`); await espera(80);
await js(tecla('z', { ctrlKey: true })); await espera(80);
ok(await js(`Elenco.npcs().some(n=>n.id===${JSON.stringify(npc0.id)})`), 'Ctrl+Z também desfaz');
await js(tecla('z', { ctrlKey: true })); await espera(80);
ok(await js(`Elenco.npcs().filter(n=>n.id===${JSON.stringify(npc0.id)}).length===1`), 'um segundo Ctrl+Z não duplica nada');
await js(`Elenco.selecionado=${JSON.stringify(npc0.id)}; Elenco.render(); document.querySelector('[data-acao="apagar"]').click()`);
await espera(8400);
ok(await js(`!document.querySelector('.recado-flutuante.com-acao')`), 'depois de 8 segundos o recado some');
await js(tecla('z', { ctrlKey: true })); await espera(80);
ok(await js(`!Elenco.npcs().some(n=>n.id===${JSON.stringify(npc0.id)})`), '…e aí o apagar é definitivo (Ctrl+Z não traz mais)');

/* ================= 6 e 8 no Mestre ================= */
await ir('mestre.html');
ok(await js(`!!document.getElementById('botaoAjuda')`), 'Mestre: botão de ajuda na barra');
await js(tecla('?')); await espera(80);
ok(await js(`!!document.querySelector('.atalhos-fundo [role="dialog"]') && document.querySelector('.lista-atalhos').textContent.includes('Buscar em tudo')`), '"?" abre os atalhos — no Mestre, com o Ctrl+K da busca');
ok(await js(`!document.querySelector('.atalhos-caixa').textContent.includes('Rever o tour')`), 'no Mestre não há "Rever o tour" (o tour é do jogador)');
await foto('m2-atalhos-mestre');
await js(tecla('Escape')); await espera(80);
ok(await js(`!document.querySelector('.atalhos-fundo')`), 'Esc fecha os atalhos');
const segunda = await js(`(()=>{const l=Atalhos.secoes()[1]; return l.getAttribute('href')||l.textContent;})()`);
await clicarENavegar(tecla('2'));
ok(await js(`location.pathname.endsWith(${JSON.stringify(segunda)})`), 'tecla 2 no Mestre vai para a 2ª tela do códice (' + segunda + ')');

/* ================= o jogador ================= */
const ana = await novaAba();
await ana.ir('index.html');
await ana.js(`document.querySelector('[data-porta="convite"]').click(); document.getElementById('nome').value='Zed'; document.getElementById('codigo').value=${JSON.stringify(codigo)};`);
await ana.navegarPor(`document.getElementById('btnEntrar').click()`);
await ana.js(digita('#f-nome', 'Kael') + digita('#f-raca', 'Humano') + digita('#f-classe', 'Guerreiro'));
await ana.js(`document.querySelector('[data-acao="salvar-ficha"]').click()`);
await espera(1100);

/* ================= 9. TOUR ================= */
ok(await ana.js(`!!document.querySelector('.tour-balao') && document.querySelector('.tour-balao h3').textContent==='Suas abas'`), 'primeira vez com a ficha pronta: o tour começa sozinho, nas abas');
ok(await ana.js(`document.activeElement.textContent==='Próximo'`), 'o foco vai para o "Próximo"');
await ana.foto('m3-tour-1');
await ana.js(tecla('?')); await ana.js(tecla('3')); await espera(80);
ok(await ana.js(`!document.querySelector('.atalhos-fundo') && Jogador.aba==='ficha'`), 'com o tour aberto, os atalhos não disparam');
await ana.js(`document.querySelector('.tour-balao .botao.fantasma').click()`); await espera(350);
ok(await ana.js(`document.querySelector('.tour-balao h3').textContent==='Clique para rolar'`), 'Próximo: a perícia');
await ana.foto('m4-tour-2');
await ana.js(tecla('ArrowRight')); await espera(350);
const passos = [await ana.js(`document.querySelector('.tour-balao h3').textContent`)];
for (let i = 0; i < 3; i++) { await ana.js(tecla('ArrowRight')); await espera(300); passos.push(await ana.js(`document.querySelector('.tour-balao h3')?.textContent`)); }
ok(JSON.stringify(passos) === JSON.stringify(['Os dados', 'A mesa', 'O chat', 'Ajuda']), 'seta → percorre: ' + passos.join(' › '));
ok(await ana.js(`document.querySelector('.tour-balao .botao.fantasma').textContent==='Começar a jogar' && document.querySelector('.tour-contador').textContent==='6 de 6'`), 'último passo: "6 de 6" e "Começar a jogar"');
await ana.foto('m5-tour-ajuda');
await ana.js(`document.querySelector('.tour-balao .botao.fantasma').click()`); await espera(100);
ok(await ana.js(`!document.querySelector('.tour-balao, .tour-fundo, .tour-foco') && localStorage.getItem('plainus:tour-jogador')==='visto'`), 'concluir fecha o tour e lembra que já foi visto');
await ana.navegarPor(`location.reload()`); await espera(1100);
ok(await ana.js(`!document.querySelector('.tour-balao')`), 'na volta, o tour não aparece de novo');
await ana.js(tecla('?')); await espera(80);
ok(await ana.js(`[...document.querySelectorAll('.atalhos-caixa button')].some(b=>b.textContent.includes('Rever o tour')) && !document.querySelector('.lista-atalhos').textContent.includes('Buscar em tudo')`), 'jogador: atalhos com "Rever o tour" e sem a busca do Mestre');
await espera(300); await ana.foto('m6-atalhos-jogador');
await ana.js(`[...document.querySelectorAll('.atalhos-caixa button')].find(b=>b.textContent.includes('Rever o tour')).click()`); await espera(200);
ok(await ana.js(`!!document.querySelector('.tour-balao') && !document.querySelector('.atalhos-fundo')`), '"Rever o tour" fecha os atalhos e recomeça o tour');
await ana.js(tecla('Escape')); await espera(80);
ok(await ana.js(`!document.querySelector('.tour-balao')`), 'Esc pula o tour');

/* ================= 8. ATALHOS no jogador ================= */
const numero = async (aba) => String(await ana.js(`Atalhos.secoes().findIndex(l=>l.dataset.aba==='${aba}')+1`));
const nInv = await numero('inventario');
ok(await numero('mesa') === '3', 'sem Magias (guerreiro), a Mesa é a 3ª aba: os números seguem as abas VISÍVEIS');
await ana.js(tecla(nInv)); await espera(100);
ok(await ana.js(`Jogador.aba`) === 'inventario', 'tecla ' + nInv + ': Inventário');
await ana.js(`document.getElementById('invNome').focus()`);
await ana.js(`document.getElementById('invNome').dispatchEvent(new KeyboardEvent('keydown',{key:'1',bubbles:true,cancelable:true}))`); await espera(80);
ok(await ana.js(`Jogador.aba`) === 'inventario', 'digitando num campo, o "1" não troca de aba');
await ana.js(`document.getElementById('invNome').blur()`);

/* ================= 5. DESFAZER no jogador ================= */
await ana.js(`(()=>{const s=document.getElementById('invLista'); s.value=s.options[1].value; document.querySelector('[data-acao="inv-da-lista"]').click();})()`); await espera(150);
const item = await ana.js(`(()=>{const i=Jogador.visao.meuHeroi.ficha.itens[0]; return {id:i.id, nome:i.nome, n:Jogador.visao.meuHeroi.ficha.itens.length};})()`);
dialogos.length = 0;
await ana.js(`document.querySelector('[data-acao="inv-remover"][data-id="${item.id}"]').click()`); await espera(150);
ok(await ana.js(`!Jogador.visao.meuHeroi.ficha.itens.some(i=>i.id===${JSON.stringify(item.id)}) && !!document.querySelector('.desfazer-recado')`), 'jogador: tirar "' + item.nome + '" do inventário é na hora, com "Desfazer"');
await ana.js(`document.querySelector('.desfazer-recado').click()`); await espera(150);
ok(await ana.js(`Jogador.visao.meuHeroi.ficha.itens.some(i=>i.id===${JSON.stringify(item.id)})`), '"Desfazer" devolve o item à mochila');
await ana.js(tecla(await numero('notas'))); await espera(100);
ok(await ana.js(`Jogador.aba`) === 'notas', 'tecla ' + (await numero('notas')) + ': Anotações');
await ana.js(digita('#notaTexto', 'Pista importante') + `document.querySelector('[data-acao="nota-salvar"]').click()`); await espera(150);
await ana.js(`document.querySelector('[data-acao="nota-apagar"]').click()`); await espera(150);
ok(await ana.js(`Jogador.visao.meuHeroi.ficha.notas.length===0 && !!document.querySelector('.desfazer-recado')`), 'apagar anotação: some na hora, com "Desfazer"');
await ana.js(`document.querySelector('.desfazer-recado').click()`); await espera(150);
ok(await ana.js(`Jogador.visao.meuHeroi.ficha.notas.length===1 && Jogador.visao.meuHeroi.ficha.notas[0].texto==='Pista importante'`), '"Desfazer" devolve a anotação');

/* ================= 6 e 7. TÍTULO E SINO ================= */
await ana.js(`window._sinos=0; const s=AvisoVez.sino.bind(AvisoVez); AvisoVez.sino=function(){window._sinos++; s();};`);
const base = await ana.js(`document.title`);
/* uma mensagem do Mestre e um combate em que é a vez do Kael, vindos da aba do Mestre */
await ir('combate.html');
await js(`(()=>{const k=Estado.herois.find(h=>h.nome==='Kael'); Estado.mensagens.push({id:'m'+Date.now(), canal:'mesa', autor:{papel:'mestre', nome:'Thiago'}, texto:'Rolem iniciativa.', quando:Date.now()}); Estado.combate={ativo:true, rodada:1, encontro:'', dificuldade:'', nd:'', registro:[], combatentes:[{id:'c1', nome:'Goblin', tipo:'monstro', iniciativa:15, ca:13, pv:7, pvMax:7, agiu:false}, {id:'c2', nome:'Kael', tipo:'heroi', heroiId:k.id, iniciativa:12, ca:16, pv:12, pvMax:12, agiu:false}]}; Memoria.salvar();})()`);
await espera(400);
const t1 = await ana.js(`document.title`);
ok(/^\(1\) /.test(t1) && !/Sua vez/.test(t1), 'mensagem nova: título "(1) ' + base + '"');
ok(await ana.js(`window._sinos`) === 0, 'combate começou, mas a vez é do Goblin: sem sino');
await js(`(()=>{Estado.combate.combatentes[0].agiu=true; Memoria.salvar();})()`);
await espera(400);
const t2 = await ana.js(`document.title`);
ok(/^Sua vez! · \(1\) /.test(t2), 'a vez passou para o Kael: "' + t2 + '"');
ok(await ana.js(`window._sinos`) === 1, 'e o sino tocou uma vez');
await js(`(()=>{Estado.combate.registro.push({texto:'x'}); Memoria.salvar();})()`);
await espera(300);
ok(await ana.js(`window._sinos`) === 1, 'outra mudança no meio do turno não toca de novo');
await ana.js(tecla(await numero('chat'))); await espera(150);
ok(!/^\(1\)/.test((await ana.js(`document.title`)).replace('Sua vez! · ', '')), 'abrindo o chat, o "(1)" some do título');
await ana.js(tecla(await numero('mesa'))); await espera(150);
ok(await ana.js(`!!document.querySelector('[data-acao="alternar-aviso-vez"].ligado')`), 'na Mesa, o botão do aviso da vez (ligado por padrão)');
await ana.foto('m7-mesa-aviso');
await ana.js(`document.querySelector('[data-acao="alternar-aviso-vez"]').click()`); await espera(100);
await js(`(()=>{Estado.combate.rodada=2; Estado.combate.combatentes.forEach(c=>c.agiu=false); Memoria.salvar();})()`); await espera(300);
await js(`(()=>{Estado.combate.combatentes[0].agiu=true; Memoria.salvar();})()`); await espera(300);
ok(await ana.js(`window._sinos`) === 1 && /^Sua vez!/.test(await ana.js(`document.title`)), 'aviso desligado: sem sino — mas o título ainda avisa');
await js(`(()=>{Estado.combate.ativo=false; Memoria.salvar();})()`); await espera(300);
ok(await ana.js(`document.title`) === base, 'fim do combate: o título volta ao normal');

/* ================= 5. DESFAZER na entrada ================= */
await ana.fechar();
await ir('index.html');
const antes = await js(`Campanhas.listar().length`);
await js(`document.querySelector('.campanha-salva .botao-opcoes').click()`);
dialogos.length = 0;
await js(`document.querySelector('.campanha-salva [data-acao="esquecer"]').click()`); await espera(100);
ok(!dialogos.length && await js(`Campanhas.listar().length`) === antes - 1 && await js(`Mesas.listar().length`) === 0, 'esquecer campanha: na hora, sem "Tem certeza?", levando o cartão de jogador junto');
await foto('m8-esquecida');
await js(`document.querySelector('.desfazer-recado').click()`); await espera(100);
ok(await js(`Campanhas.listar().length===${antes} && Mesas.listar().length===1 && document.querySelectorAll('.campanha-salva').length===1 && document.querySelectorAll('.mesa-jogador').length===1`), '"Desfazer" traz a campanha e o cartão do jogador de volta');
ok(await js(`Campanhas.lerEstado(Campanhas.listar()[0].id).herois.some(h=>h.nome==='Kael')`), '…com tudo dentro (o Kael está lá)');

console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill();
process.exit(0);
