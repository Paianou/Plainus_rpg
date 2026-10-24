/* A busca do jogador (Ctrl+K): a caixa do Mestre, com o índice do
   jogador — as abas, as regras públicas e o inventário dele. Nada da
   campanha do Mestre (segredos, NPCs, monstros) entra. */

await ir('index.html');
await js(`document.querySelector('[data-porta="mestrar"]').click(); document.getElementById('nome').value='Thiago'; document.getElementById('campanha').value='Busca na mesa'`);
await clicarENavegar(`document.getElementById('btnCriar').click()`);
await js(`const b=()=>document.getElementById('btnAvancar').click(); b(); document.getElementById('premissa').value='p'; document.getElementById('cenario').value='c'; b(); b(); b(); b(); document.querySelector('input[value="exemplo"]').checked=true;`);
await clicarENavegar(`document.getElementById('btnAvancar').click()`);
const codigo = await js(`Estado.campanha.codigo`);
const ctrlK = `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))`;

const ana = await novaAba();
await ana.ir('index.html');
await ana.js(`document.querySelector('[data-porta="convite"]').click(); document.getElementById('nome').value='Ana'; document.getElementById('codigo').value=${JSON.stringify(codigo)};`);
await ana.navegarPor(`document.getElementById('btnEntrar').click()`);

/* ---- criando a ficha: ainda não há para onde ir ---- */
ok(await ana.js(`!document.getElementById('botaoBusca')`), 'criando a ficha: a barra ainda não tem a busca');
await ana.js(ctrlK);
ok(await ana.js(`!(Busca.caixa && Busca.caixa.open) && [...document.querySelectorAll('.recado-flutuante')].some(r=>r.textContent.includes('quando a ficha estiver pronta'))`), '…e o Ctrl+K não abre a caixa: avisa que a busca vem com a ficha pronta');

await ana.js(digita('#f-nome', 'Lyra') + digita('#f-raca', 'Elfa') + digita('#f-classe', 'Guerreira'));
await ana.js(`document.querySelector('[data-acao="mais-linha"][data-lista="ataques"]').click()`);
await ana.js(`(()=>{const s=document.querySelector('[data-ataque="0"] [data-parte="arma"]'); s.value='Adaga'; s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
await ana.js(`document.querySelector('[data-acao="salvar-ficha"]').click()`); await espera(600);
await ana.js(`(async()=>{for(let i=0;i<20&&!document.querySelector('.tour-pular');i++)await new Promise(r=>setTimeout(r,100));const b=document.querySelector('.tour-pular');if(b)b.click();})()`); await espera(300);

/* uma adaga na mochila (aba Inventário) */
await ana.js(`document.querySelector('[data-acao="aba"][data-aba="inventario"]').click()`); await espera(200);
await ana.js(`document.getElementById('invLista').value='Adaga'; document.querySelector('[data-acao="inv-da-lista"]').click()`); await espera(400);
await ana.js(`document.querySelector('[data-acao="aba"][data-aba="ficha"]').click()`); await espera(200);

/* ---- a barra e a caixa ---- */
ok(await ana.js(`(()=>{const b=document.getElementById('botaoBusca'); return !!b && b.classList.contains('largo') && b.getAttribute('aria-label')==='Buscar' && b.textContent.includes('Ctrl+K') && b.compareDocumentPosition(document.getElementById('botaoChat')) & Node.DOCUMENT_POSITION_FOLLOWING;})()`), 'com a ficha pronta: a busca aparece na barra, antes do chat (como no Mestre)');
await ana.js(`document.getElementById('botaoBusca').click()`); await espera(200);
ok(await ana.js(`Busca.caixa.open && document.activeElement.id==='buscaGlobalCampo' && /condição/.test(document.getElementById('buscaGlobalCampo').placeholder) && document.getElementById('buscaGlobalCampo').getAttribute('aria-label')==='Buscar no painel' && Busca.caixa.getAttribute('aria-label')==='Busca no painel'`), 'o botão abre a caixa, com o foco no campo e as palavras do jogador');
ok(await ana.js(`[...document.querySelectorAll('.busca-grupo')].map(g=>g.textContent).join()==='Abas' && [...document.querySelectorAll('.busca-item .busca-titulo')].some(t=>t.textContent==='Inventário')`), 'caixa vazia: as abas do painel, para ir de uma a outra');
const grupos = await ana.js(`[...new Set(Busca.indice.map(i=>i.grupo))].join('|')`);
ok(grupos === 'Abas|Seu inventário|Magias|Equipamento|Condições', 'o índice do jogador só tem abas, inventário e regras — nada de NPCs, segredos ou monstros (' + grupos + ')');
await ana.foto('37-busca-aberta');

/* ---- uma condição: abre a aba Regras com o verbete ---- */
await ana.js(`(()=>{const c=document.getElementById('buscaGlobalCampo'); c.value='paralis'; c.dispatchEvent(new Event('input',{bubbles:true}));})()`);
ok(await ana.js(`document.querySelector('.busca-item.ativo .busca-titulo').textContent==='Paralisado'`), '"paralis": o primeiro resultado é Paralisado');
await ana.js(`document.getElementById('buscaGlobalCampo').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`); await espera(300);
ok(await ana.js(`!Busca.caixa.open && location.hash==='#aba=regras' && RegrasJogador.selecionado==='Paralisado' && RegrasJogador.tipo==='condicoes' && document.activeElement.matches('.nav-jogador .codice-link.ativo')`), 'Enter: a caixa fecha, a aba Regras abre em Paralisado, e o foco fica na aba (não se perde)');

/* ---- um item do inventário, pelo Ctrl+K ---- */
await ana.js(ctrlK); await espera(200);
await ana.js(`(()=>{const c=document.getElementById('buscaGlobalCampo'); c.value='adaga'; c.dispatchEvent(new Event('input',{bubbles:true}));})()`);
ok(await ana.js(`[...document.querySelectorAll('.busca-grupo')].map(g=>g.textContent).includes('Seu inventário')`), 'Ctrl+K e "adaga": a adaga da mochila aparece em "Seu inventário"');
await ana.js(`(()=>{const i=Busca.resultados.findIndex(r=>r.grupo==='Seu inventário'); Busca.ir(i);})()`); await espera(300);
ok(await ana.js(`location.hash==='#aba=inventario' && Jogador.aba==='inventario'`), 'escolher o item leva à aba Inventário');

/* ---- a lista de atalhos fala da busca do jogador ---- */
ok(await ana.js(`/Buscar abas, regras e o seu inventário/.test(Atalhos.montarLista().textContent)`), 'a lista de atalhos ("?") mostra o Ctrl+K do jogador');

/* ---- e a do Mestre continua a mesma ---- */
ok(await js(`(()=>{ Busca.abrir(); const r = Busca.caixa.getAttribute('aria-label')==='Busca na campanha' && document.getElementById('buscaGlobalCampo').getAttribute('aria-label')==='Buscar na campanha' && Busca.indice.some(i=>i.grupo==='NPCs') && [...document.querySelectorAll('.busca-grupo')].map(g=>g.textContent).join()==='Telas'; Busca.fechar(); return r; })()`), 'no Mestre, a busca segue igual: as palavras dele, os NPCs no índice e as telas na caixa vazia');

await ana.fechar();
console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill(); process.exit(0);
