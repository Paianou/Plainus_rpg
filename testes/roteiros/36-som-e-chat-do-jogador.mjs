/* A barra do jogador: o som ambiente que o Mestre escolhe (o jogador
   ouve, e pode silenciar só para ele) e o botão do chat, com as
   mensagens novas. */

await ir('index.html');
await js(`document.querySelector('[data-porta="mestrar"]').click(); document.getElementById('nome').value='Thiago'; document.getElementById('campanha').value='Som na mesa'`);
await clicarENavegar(`document.getElementById('btnCriar').click()`);
await js(`const b=()=>document.getElementById('btnAvancar').click(); b(); document.getElementById('premissa').value='p'; document.getElementById('cenario').value='c'; b(); b(); b(); b();`);
await clicarENavegar(`document.getElementById('btnAvancar').click()`);
const codigo = await js(`Estado.campanha.codigo`);

const ana = await novaAba();
await ana.ir('index.html');
await ana.js(`document.querySelector('[data-porta="convite"]').click(); document.getElementById('nome').value='Ana'; document.getElementById('codigo').value=${JSON.stringify(codigo)};`);
await ana.navegarPor(`document.getElementById('btnEntrar').click()`);
await ana.js(digita('#f-nome', 'Lyra') + digita('#f-raca', 'Elfa') + digita('#f-classe', 'Guerreira'));
await ana.js(`document.querySelector('[data-acao="salvar-ficha"]').click()`); await espera(600);
await ana.js(`(async()=>{for(let i=0;i<20&&!document.querySelector('.tour-pular');i++)await new Promise(r=>setTimeout(r,100));const b=document.querySelector('.tour-pular');if(b)b.click();})()`); await espera(300);

/* ---- o chat na barra ---- */
ok(await ana.js(`(()=>{const b=document.getElementById('botaoChat'); return !!b && b.classList.contains('botao-chat') && b.getAttribute('aria-label')==='Chat da mesa' && !b.querySelector('.contador-chat');})()`), 'a barra do jogador tem o botão do chat, ainda sem mensagens novas');
ok(await ana.js(`!document.querySelector('#barraJogador .faixa-audio')`), 'com o Mestre em silêncio, a faixa do som não aparece');
await js(`Conexao.acaoJogador('mensagem', { canal: 'mesa', texto: 'Bem-vindos à cripta.' })`);
ok(await aguardar(`(document.querySelector('#botaoChat .contador-chat')||{}).textContent==='1' && /1 novas/.test(document.getElementById('botaoChat').getAttribute('aria-label'))`, ana.js), 'chegou mensagem do Mestre: o botão do chat mostra 1');
await ana.js(`document.getElementById('botaoChat').click()`); await espera(300);
ok(await ana.js(`location.hash==='#aba=chat' && !document.querySelector('#botaoChat .contador-chat') && document.activeElement.id==='botaoChat'`), 'clicar no chat da barra abre a aba Chat; o número some e o foco fica no botão');

/* ---- o Mestre põe o som ---- */
await js(`document.querySelector('[data-acao="audio-pausar"]').click()`);
ok(await aguardar(`(document.querySelector('#barraJogador .faixa-audio .pista')||{}).textContent==='Cripta dos Ancestrais (loop)'`, ana.js), 'o Mestre tocou a Cripta: a faixa aparece na barra do jogador, com o nome da pista');
await ana.js(`document.querySelector('[data-acao="aba"][data-aba="ficha"]').click()`); await espera(300);
ok(await aguardar(`Som.tocando() && Som.atual.pista==='Cripta dos Ancestrais (loop)' && document.getElementById('botaoSom').getAttribute('aria-label')==='Silenciar o ambiente (só para você)'`, ana.js), 'no primeiro clique do jogador, o som começa (o navegador exige um gesto) e o botão vira "Silenciar"');
await ana.foto('36-barra-com-som');

await ana.js(`document.getElementById('botaoSom').focus(); document.getElementById('botaoSom').click()`); await espera(200);
ok(await ana.js(`!Som.tocando() && localStorage.getItem('plainus:som-mudo')==='sim' && document.getElementById('botaoSom').getAttribute('aria-label')==='Ouvir o ambiente' && document.activeElement.id==='botaoSom'`), '"Silenciar": o som para só aqui (fica guardado), e o foco continua no botão ');
ok((await js(`(await T.gravado()).audio.tocando`)) === true && await js(`Som.tocando()`), '…e o Mestre continua tocando');
await ana.js(`document.getElementById('botaoSom').focus(); document.getElementById('botaoSom').click()`); await espera(200);
ok(await ana.js(`Som.tocando() && localStorage.getItem('plainus:som-mudo')==='nao'`), '"Ouvir o ambiente": volta a tocar');

/* ---- o Mestre troca a pista, e depois pausa ---- */
await js(`Acoes.executar('ajustarAudio', { pista: 'Chuva sobre Valkoria' }); Som.aplicar();`);
ok(await aguardar(`Som.atual && Som.atual.pista==='Chuva sobre Valkoria' && document.querySelector('#barraJogador .faixa-audio .pista').textContent==='Chuva sobre Valkoria'`, ana.js), 'o Mestre trocou para a Chuva: o jogador passa a ouvir a Chuva');
await js(`document.querySelector('[data-acao="audio-pausar"]').click()`);
ok(await aguardar(`!Som.tocando() && !document.querySelector('#barraJogador .faixa-audio')`, ana.js), 'o Mestre pausou: o som para no jogador, e a faixa some');

await ana.fechar();
console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill(); process.exit(0);
