/* ---- primeira visita ---- */
await ir('index.html');
ok(await js(`document.getElementById('campanhasSalvas').hidden && !document.getElementById('portas').hidden && document.getElementById('formPorta').hidden`), 'primeira visita: sem "Suas mesas", só as duas portas');
ok(await js(`!document.querySelector('input[name="papel"]')`), 'não existe mais "entrar como Mestre" pelo código');
ok(await js(`document.querySelectorAll('.porta .ico').length===2 && !!document.querySelector('#btnVoltarPorta .ico')`), 'as portas e o Voltar têm ícones em traço');
await foto('e1-primeira');

/* ---- Vou mestrar ---- */
await js(`document.querySelector('[data-porta="mestrar"]').click()`); await espera(100);
ok(await js(`!document.getElementById('formPorta').hidden && document.getElementById('portas').hidden && !document.getElementById('blocoMestrar').hidden && document.getElementById('blocoConvite').hidden && document.getElementById('tituloPorta').textContent==='Vou mestrar' && document.activeElement.id==='nome'`), '"Vou mestrar" abre só o formulário de criar, com o foco no nome');
await foto('e2-mestrar');
await js(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})); document.getElementById('nome').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`); await espera(80);
ok(await js(`document.getElementById('formPorta').hidden && !document.getElementById('portas').hidden`), 'Esc volta às portas');
await js(`document.querySelector('[data-porta="mestrar"]').click(); document.getElementById('nome').value='Thiago'; document.getElementById('campanha').value='Teste dados'`);
await clicarENavegar(`document.getElementById('campanha').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);
ok(await js(`location.pathname.endsWith('criar-campanha.html')`), 'Enter no nome da campanha leva para a criação');
await js(`const b=()=>document.getElementById('btnAvancar').click(); b(); document.getElementById('premissa').value='p'; document.getElementById('cenario').value='c'; b(); b(); b(); b();`);
await clicarENavegar(`document.getElementById('btnAvancar').click()`);
const codigo = await js(`Estado.campanha.codigo`);

/* um mapa na cena, para o fundo do cartão */
await js(`(async()=>{const c=document.createElement('canvas'); c.width=64; c.height=40; const x=c.getContext('2d'); x.fillStyle='#3a5a8a'; x.fillRect(0,0,64,40); x.fillStyle='#ddd'; x.fillRect(10,10,20,20); Estado.cenas=[{id:'s1', nome:'Cripta', colunas:8, linhas:5, paredes:[], tokens:[], imagem:c.toDataURL('image/jpeg',.8)}]; Estado.cenaAtual='s1'; await T.salvar();})()`);

/* ---- Ana: convite ---- */
const ana = await novaAba();
await ana.ir('index.html');
ok(await ana.js(`document.getElementById('nome').value`) === 'Thiago', 'o último nome digitado já vem preenchido');
await ana.js(`document.querySelector('[data-porta="convite"]').click()`);
ok(await ana.js(`document.activeElement.id==='codigo'`), 'com o nome lembrado, o foco cai direto no código');
await ana.js(`document.getElementById('nome').value='Ana'; document.getElementById('codigo').value=${JSON.stringify(codigo.toLowerCase().replace(/-/g, ' '))};`);
await ana.navegarPor(`document.getElementById('codigo').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);
ok(await ana.js(`location.pathname.endsWith('jogador.html') && Sessao.ler().papel==='jogador'`), 'Enter no código (colado minúsculo e com espaços) entra como jogador');
await ana.js(digita('#f-nome', 'Lyra') + digita('#f-raca', 'Elfa') + digita('#f-classe', 'Guerreira'));
await ana.js(`(()=>{const c=document.createElement('canvas'); c.width=40; c.height=40; const x=c.getContext('2d'); x.fillStyle='#a33'; x.fillRect(0,0,40,40); window._foto=c.toDataURL('image/jpeg',.8);})()`);
await ana.js(`document.querySelector('[data-acao="salvar-ficha"]').click()`); await espera(400);
await ana.js(`(async()=>{const e=await T.gravado(); e.herois[0].ficha.foto=window._foto; await T.trocar(e);})()`);

/* ---- Ana volta à entrada ---- */
await ana.ir('index.html');
const cart = await ana.js(`JSON.stringify({mestre:document.querySelectorAll('.campanha-salva').length, jog:document.querySelectorAll('.mesa-jogador').length, selo:document.querySelector('.mesa-jogador .selo-mesa')?.textContent, meu:!!document.querySelector('.mesa-jogador .retrato-mini.meu img'), fundo:document.querySelectorAll('.fundo-mesa').length, sub:document.getElementById('subtitulo').textContent, botao:document.querySelector('.mesa-jogador .botao-mesa')?.textContent})`);
const c1 = JSON.parse(cart);
ok(c1.mestre === 1 && c1.jog === 1, 'Suas mesas: um cartão de Mestre e um de jogador');
ok(c1.selo === 'Jogando com Lyra' && c1.meu && c1.botao === 'Voltar para a mesa', 'cartão do jogador: "Jogando com Lyra", retrato dela aceso, "Voltar para a mesa"');
ok(c1.fundo === 2, 'os dois cartões têm o mapa da cena ao fundo');
ok(/Que bom te ver de volta/.test(c1.sub), 'subtítulo muda para quem volta');
await ana.foto('e3-mesas');

/* menu */
await ana.js(`document.querySelector('.mesa-jogador .botao-opcoes').click()`); await espera(80);
ok(await ana.js(`document.querySelector('.mesa-jogador .menu-mesa').open`), 'o "⋯" abre o menu');
await ana.foto('e4-menu');
await ana.js(`document.querySelector('.entrada-marca').click()`); await espera(50);
ok(await ana.js(`!document.querySelector('.menu-mesa[open]')`), 'clicar fora fecha o menu');

/* voltar para a mesa com um clique */
await ana.navegarPor(`document.querySelector('.mesa-jogador [data-acao="voltar-mesa"]').click()`);
ok(await ana.js(`location.pathname.endsWith('jogador.html') && !!document.querySelector('[data-acao="editar"]') && Sessao.ler().nome==='Ana'`), 'um clique e a Ana está na ficha da Lyra, sem digitar nada');

/* tirar da lista, e o "Desfazer" traz de volta o mesmo jogador */
await ana.ir('index.html');
const idAna = await ana.js(`Acessos.listar().find(a=>a.papel==='jogador').jogadorId`);
const idCamp = await ana.js(`Acessos.listar().find(a=>a.papel==='mestre').campanhaId`);
await ana.js(`document.querySelector('.mesa-jogador [data-acao="tirar-mesa"]').click()`);
await aguardar(`document.querySelectorAll('.mesa-jogador').length===0`, ana.js);
ok(await ana.js(`T.gravado(${JSON.stringify(idCamp)}).then(e=>document.querySelectorAll('.mesa-jogador').length===0 && e.herois.length===1)`), '"Tirar da lista" some com o cartão, mas a Lyra continua na campanha');
await ana.js(`document.querySelector('.desfazer-recado').click()`);
await aguardar(`document.querySelectorAll('.mesa-jogador').length===1`, ana.js);
ok(await ana.js(`Acessos.listar().filter(a=>a.papel==='jogador').length===1 && Acessos.listar().find(a=>a.papel==='jogador').jogadorId===${JSON.stringify(idAna)}`), '"Desfazer" traz o cartão de volta, com a mesma chave (o mesmo jogador)');

/* ---- link de convite ---- */
await ana.ir('jogador.html'); await ana.ir('index.html#convite=' + codigo);
const conv = JSON.parse(await ana.js(`JSON.stringify({aberto:!document.getElementById('formPorta').hidden, convite:!document.getElementById('blocoConvite').hidden, cod:document.getElementById('codigo').value, achado:document.getElementById('conviteAchado').textContent})`));
ok(conv.aberto && conv.convite && conv.cod === codigo && /Você foi convidado para Teste dados · Mestre: Thiago/.test(conv.achado), 'link #convite= abre o convite com o código e mostra para onde está entrando');
await ana.foto('e5-convite-link');
await ana.ir('jogador.html'); await ana.ir('index.html#convite=lixo%3Cscript%3E');
ok(await ana.js(`document.getElementById('formPorta').hidden && document.getElementById('codigo').value===''`), 'link com código inválido é ignorado');

/* ---- o Mestre volta e esquece ---- */
await ana.ir('index.html');
await ana.navegarPor(`document.querySelector('.campanha-salva [data-acao="continuar"]').click()`);
ok(await ana.js(`location.pathname.endsWith('mestre.html')`), 'Continuar no cartão de Mestre abre o painel do Mestre');
await ana.ir('index.html');
await ana.js(`document.querySelector('.campanha-salva .botao-opcoes').click()`);
await ana.js(`document.querySelector('.campanha-salva [data-acao="esquecer"]').click()`);
await aguardar(`document.querySelectorAll('.campanha-salva').length===0`, ana.js);
ok(await ana.js(`!Acessos.listar().some(a=>a.papel==='mestre') && document.querySelectorAll('.mesa-jogador').length===1 && /chave de Mestre/.test(document.getElementById('recados').textContent)`), 'tirar a mesa de Mestre: a chave de Mestre sai (o recado avisa), o cartão de jogador fica');

/* ---- celular ---- */
await ana.ir('index.html');
await ana.tamanho(390, 844); await espera(200);
ok(await ana.js(`document.documentElement.scrollWidth <= 390`), 'celular: sem rolagem de lado (primeira visita)');
await ana.foto('e6-celular');
await ana.fechar();

console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill();
process.exit(0);
