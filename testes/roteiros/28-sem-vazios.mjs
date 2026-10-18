/* Os vazios das telas: cada um ganhou conteúdo útil, foi reorganizado
   ou virou tela de aplicativo. Campanha de exemplo (5 heróis, combate
   em andamento, diário e NPCs). */

await ir('index.html');
await js(`document.querySelector('[data-porta="mestrar"]').click(); document.getElementById('nome').value='Thiago'; document.getElementById('campanha').value='Sem vazios'`);
await clicarENavegar(`document.getElementById('btnCriar').click()`);
await js(`const b=()=>document.getElementById('btnAvancar').click(); b(); document.getElementById('premissa').value='p'; document.getElementById('cenario').value='c'; b(); b(); b(); b(); document.querySelector('input[value="exemplo"]').checked=true;`);
await clicarENavegar(`document.getElementById('btnAvancar').click()`);
const codigo = await js(`Estado.campanha.codigo`);

/* ---- Ana cria a Lyra, com uma adaga, e rola um teste ---- */
const ana = await novaAba();
await ana.ir('index.html');
await ana.js(`document.querySelector('[data-porta="convite"]').click(); document.getElementById('nome').value='Ana'; document.getElementById('codigo').value=${JSON.stringify(codigo)};`);
await ana.navegarPor(`document.getElementById('btnEntrar').click()`);
await ana.js(digita('#f-nome', 'Lyra') + digita('#f-raca', 'Elfa') + digita('#f-classe', 'Guerreira'));
await ana.js(`document.querySelector('[data-acao="mais-linha"][data-lista="ataques"]').click()`);
await ana.js(`(()=>{const s=document.querySelector('[data-ataque="0"] [data-parte="arma"]'); s.value='Adaga'; s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
await ana.js(`document.querySelector('[data-acao="salvar-ficha"]').click()`); await espera(600);
await ana.js(`(async()=>{for(let i=0;i<20&&!document.querySelector('.tour-pular');i++)await new Promise(r=>setTimeout(r,100));const b=document.querySelector('.tour-pular');if(b)b.click();})()`); await espera(300);
await ana.js(`localStorage.setItem('plainus:animacao-dados','desligada'); document.querySelector('button.pericia[data-texto="Atletismo"]').click()`); await espera(400);

/* ---- Mestre › Ferramentas: as rolagens da mesa embaixo do Rolador ---- */
await cmd('Page.bringToFront');
await cmd('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
await ir('mestre.html');
await js(`document.querySelector('#abas [data-aba="ferramentas"]').click()`); await espera(200);
ok(await aguardar(`/Lyra — Atletismo/.test((document.querySelector('.pilha-rolador .cartao-rolagens-mesa')||{}).textContent||'')`), 'Ferramentas: embaixo do Rolador, as Rolagens da mesa mostram o teste da Lyra');
ok(await js(`(()=>{const p=document.querySelector('.pilha-rolador'); return p.children[0].textContent.includes('Rolador do mestre') && p.children[1].classList.contains('cartao-rolagens-mesa');})()`), '…numa pilha só: Rolador em cima, rolagens embaixo (a coluna da esquerda da grade)');

/* ---- Panorama largo: as rolagens saem (a coluna já é a mais comprida) ---- */
await cmd('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1000, deviceScaleFactor: 1, mobile: false });
await js(`document.querySelector('#abas [data-aba="panorama"]').click()`); await espera(300);
ok(await js(`getComputedStyle(document.querySelector('.cartao-rolagens-mesa')).display === 'none'`), 'Panorama em 1920px (três colunas): as rolagens da mesa ficam de fora');

/* ---- Grupo: 5 heróis em 3 + 2, sem herói sozinho ---- */
await js(`document.querySelector('#abas [data-aba="grupo"]').click()`); await espera(300);
const fileiras = JSON.parse(await js(`JSON.stringify((()=>{const t={}; document.querySelectorAll('.coluna-herois > .heroi').forEach(h=>{const y=Math.round(h.getBoundingClientRect().top); t[y]=(t[y]||0)+1;}); return Object.values(t);})())`));
ok(fileiras.join('+') === '3+2', 'Grupo em 1920px: 5 heróis em 3 + 2 (antes 4 + 1) — ' + fileiras.join('+'));
await cmd('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false }); await espera(300);
const fileiras2 = JSON.parse(await js(`JSON.stringify((()=>{const t={}; document.querySelectorAll('.coluna-herois > .heroi').forEach(h=>{const y=Math.round(h.getBoundingClientRect().top); t[y]=(t[y]||0)+1;}); return Object.values(t);})())`));
ok(fileiras2.every(n => n >= 2) && fileiras2.reduce((a, b) => a + b, 0) === 5, 'mudando a largura da janela, a conta se refaz sozinha (' + fileiras2.join('+') + ')');

/* ---- Listas com ficha: abrem o primeiro, em vez de "Escolha…" ---- */
await ir('diario.html');
ok(await js(`!/Escolha/.test(document.getElementById('detalhe').textContent) && document.querySelector('.entrada-diario.ativa') === document.querySelector('.entrada-diario')`), 'Diário: a sessão mais recente já vem aberta');
await ir('npcs.html');
ok(await js(`!/Escolha/.test(document.getElementById('detalhe').textContent) && !!document.querySelector('#lista .ativo')`), 'NPCs: o primeiro do elenco já vem aberto');
await ir('compendio.html');
ok(await js(`!/Escolha/.test(document.getElementById('detalhe').textContent) && !!document.querySelector('.item-compendio.ativo')`), 'Compêndio: o primeiro da lista já vem aberto');
await js(`(()=>{const c=document.getElementById('busca'); c.value='bola de fogo'; c.dispatchEvent(new Event('input'));})()`); await espera(100);
ok(await js(`/Bola de Fogo/.test(document.querySelector('#detalhe .titulo-detalhe').textContent)`), '…e buscar abre o primeiro resultado, em vez de ficar no que estava aberto');
await ir('bestiario.html');
ok(await js(`!/Escolha/.test(document.getElementById('detalhe').textContent) && !!document.querySelector('.item-compendio.ativo')`), 'Bestiário: a primeira criatura já vem aberta');

/* ---- Combate: a ordem com o "Entrar" embaixo; o Registro da altura da tela ---- */
await ir('combate.html');
ok(await js(`document.querySelector('#listaCombatentes').nextElementSibling.classList.contains('entrar-combate')`), 'Combate: "Entrar no combate" fica embaixo da ordem de iniciativa');
const reg = JSON.parse(await js(`JSON.stringify((()=>{const a=document.querySelector('.coluna-registro'); const r=a.getBoundingClientRect(); return {pos:getComputedStyle(a).position, fundo:r.bottom, janela:innerHeight, cartoes:a.children.length};})())`));
ok(reg.pos === 'sticky' && reg.cartoes === 1 && reg.fundo > reg.janela - 40, 'o Registro sozinho na coluna, preso ao rolar e indo até o fim da janela (' + Math.round(reg.fundo) + ' de ' + reg.janela + ')');
await foto('28-combate');

/* ---- Jogador › Mesa em combate: o cartão "Em combate" na lateral ---- */
await js(`Acoes.executar('trazerParty')`); await espera(400);
await ana.frente();
await ana.js(`document.querySelector('.nav-jogador [data-aba="mesa"]').click()`); await espera(400);
ok(await aguardar(`!!document.querySelector('#lateral > .cartao-em-combate') && document.querySelector('#lateral').firstElementChild.classList.contains('cartao-em-combate')`, ana.js), 'Mesa em combate: o cartão "Em combate" no topo da coluna lateral');
ok(await ana.js(`/Vez de Kaelen/.test(document.querySelector('.cartao-em-combate').textContent) && /Adaga/.test(document.querySelector('.cartao-em-combate').textContent)`), '…com de quem é a vez e os ataques da ficha');
const antes = await ana.js(`Conexao.visao.rolagensMesa.length`);
await ana.js(`document.querySelector('.cartao-em-combate [data-acao="atacar"]').click()`);
ok(await aguardar(`Conexao.visao.rolagensMesa.length > ${antes} && /Adaga/.test(Conexao.visao.rolagensMesa[0].texto)`, ana.js), 'o "Atacar" do cartão rola o ataque, igual ao da ficha');
await ana.foto('28-jogador-mesa');
await ana.js(`document.querySelector('.nav-jogador [data-aba="inventario"]').click()`); await espera(300);
ok(await ana.js(`!document.querySelector('.cartao-em-combate')`), 'fora da aba Mesa, o cartão não aparece');

await ana.fechar();
console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill(); process.exit(0);
