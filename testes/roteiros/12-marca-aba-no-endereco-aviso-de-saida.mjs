/* Registra os diálogos que o navegador abre (o harness já aceita todos). */
const dialogos = [];
ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.method === 'Page.javascriptDialogOpening') dialogos.push(d.params.type); });
/* Digitação de verdade (conta como interação da pessoa com a página). */
const teclar = async (seletor, texto) => { await js(`document.querySelector(${JSON.stringify(seletor)}).focus()`); await cmd('Input.insertText', { text: texto }); await espera(80); };
const pendente = `(()=>{const e=new Event('beforeunload',{cancelable:true}); window.dispatchEvent(e); return e.defaultPrevented;})()`;

/* ---- criar a campanha: o aviso no meio, e nenhum ao terminar ---- */
await ir('index.html');
await js(`document.querySelector('[data-porta="mestrar"]').click(); document.getElementById('nome').value='Thiago'; document.getElementById('campanha').value='Teste saída'`);
await clicarENavegar(`document.getElementById('btnCriar').click()`);
ok(await js(pendente) === false, 'criação recém-aberta (só o rascunho da entrada): sair não pergunta');
await js(`document.getElementById('btnAvancar').click()`);
await teclar('#premissa', 'Um rei morto volta.');
ok(await js(pendente) === true, 'digitou na criação da campanha: sair pergunta');
await js(`document.getElementById('cenario').value='c'; const b=()=>document.getElementById('btnAvancar').click(); b(); b(); b(); b();`);
dialogos.length = 0;
await clicarENavegar(`document.getElementById('btnAvancar').click()`);
ok(await js(`location.pathname.endsWith('mestre.html')`) && !dialogos.includes('beforeunload'), 'terminar a criação vai ao painel SEM perguntar (a saída é o salvamento)');

/* ---- item 2: a marca leva ao início ---- */
ok(await js(`document.querySelector('.barra-topo a.marca-mestre').getAttribute('href')`) === 'index.html', 'Mestre: "Plainus RPG" na barra é um link para o início');
await clicarENavegar(`document.querySelector('.barra-topo a.marca-mestre').click()`);
ok(await js(`location.pathname.endsWith('index.html') && document.querySelectorAll('.campanha-salva').length===1`), 'clicar na marca leva à entrada, com a campanha em "Suas mesas"');
await clicarENavegar(`document.querySelector('.campanha-salva [data-acao="continuar"]').click()`);
const codigo = await js(`Estado.campanha.codigo`);

/* ---- item 4 no Mestre: bestiário ---- */
await ir('bestiario.html');
await js(`document.querySelector('[data-acao="novo"]').click()`); await espera(150);
ok(await js(pendente) === false, 'bestiário: formulário de monstro aberto e intocado não segura a saída');
await teclar('#campo-nome', 'Esqueleto');
ok(await js(pendente) === true, 'bestiário: digitou o nome do monstro — sair pergunta');
dialogos.length = 0;
await clicarENavegar(`location.href='mestre.html'`);
ok(dialogos.includes('beforeunload'), 'o navegador mostrou de fato o "sair do site?" ao trocar de página');
ok(await js(pendente) === false, 'na página nova, nada pendente');

/* ---- Ana ---- */
const ana = await novaAba();
await ana.ir('index.html');
await ana.js(`document.querySelector('[data-porta="convite"]').click(); document.getElementById('nome').value='Ana'; document.getElementById('codigo').value=${JSON.stringify(codigo)};`);
await ana.navegarPor(`document.getElementById('btnEntrar').click()`);
ok(await ana.js(pendente) === false, 'ficha nova em branco: sair não pergunta');
await ana.js(digita('#f-nome', 'Lyra'));
ok(await ana.js(pendente) === true, 'começou a ficha: sair pergunta');
await ana.js(digita('#f-raca', 'Elfa') + digita('#f-classe', 'Guerreira'));
await ana.js(`document.querySelector('[data-acao="salvar-ficha"]').click()`); await espera(300);
ok(await ana.js(pendente) === false, 'ficha salva: sair não pergunta mais');
ok(await ana.js(`document.querySelector('.barra-topo a.marca-mestre').getAttribute('href')`) === 'index.html', 'jogador: a marca também leva ao início');

await ana.js(`document.querySelector('[data-acao="editar"]').click()`); await espera(150);
ok(await ana.js(pendente) === false, '"Editar ficha" aberto sem mexer: sair não pergunta');
await ana.js(digita('#f-nome', 'Lyra Vento'));
ok(await ana.js(pendente) === true, 'mudou o nome na edição: sair pergunta');
await ana.js(`document.querySelector('[data-acao="cancelar"]').click()`); await espera(150);
ok(await ana.js(pendente) === false, 'cancelou a edição: nada pendente');

/* anotação e chat */
await ana.js(`document.querySelector('.nav-jogador [data-aba="notas"]').click()`); await espera(100);
await ana.js(digita('#notaTexto', 'A pista da porta'));
ok(await ana.js(pendente) === true, 'anotação escrita e não guardada: sair pergunta');
await ana.js(`document.querySelector('[data-acao="nota-salvar"]').click()`); await espera(150);
ok(await ana.js(pendente) === false, 'anotação guardada: nada pendente');
await ana.js(`document.querySelector('.nav-jogador [data-aba="chat"]').click()`); await espera(100);
await ana.js(`document.getElementById('chatTexto').value='oi, mestre'`);
ok(await ana.js(pendente) === true, 'mensagem escrita e não enviada no chat: sair pergunta');
await ana.js(`document.getElementById('chatTexto').value=''`);

/* ---- item 3: a aba no endereço ---- */
await ana.js(`document.querySelector('.nav-jogador [data-aba="inventario"]').click()`); await espera(150);
ok(await ana.js(`location.hash`) === '#aba=inventario', 'trocar de aba põe #aba=inventario no endereço');
await ana.navegarPor(`location.reload()`);
ok(await ana.js(`document.querySelector('.nav-jogador .codice-link.ativo').dataset.aba==='inventario' && document.getElementById('cabecaAba').textContent.startsWith('Inventário')`), 'F5 volta para o Inventário, e não para a Ficha');
await ana.js(`document.querySelector('.nav-jogador [data-aba="mesa"]').click()`); await espera(150);
await ana.js(`history.back()`); await espera(300);
ok(await ana.js(`location.hash==='#aba=inventario' && document.querySelector('.nav-jogador .codice-link.ativo').dataset.aba==='inventario'`), '"Voltar" do navegador volta da Mesa para o Inventário');
await ana.js(`history.back()`); await espera(300);
ok(await ana.js(`document.querySelector('.nav-jogador .codice-link.ativo').dataset.aba`) === 'chat', 'e mais um "voltar" vai para o Chat');
await ana.js(`location.hash='aba=invadir'`); await espera(200);
ok(await ana.js(`document.querySelector('.nav-jogador .codice-link.ativo').dataset.aba`) === 'ficha', 'aba inventada no endereço cai na Ficha');
await ana.js(`location.hash='aba=magias'`); await espera(200);
ok(await ana.js(`document.querySelector('.nav-jogador .codice-link.ativo').dataset.aba`) === 'ficha', 'Magias pelo endereço, numa guerreira que não conjura: cai na Ficha');
await ana.foto('s1-jogador');
await ana.fechar();

console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill();
process.exit(0);
