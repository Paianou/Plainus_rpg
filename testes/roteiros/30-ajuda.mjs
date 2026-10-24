/* A Ajuda: a página do Mestre e a aba do jogador. E os atalhos 1–8,
   que não podem cair no grupo do site. */

await ir('index.html');
await js(`document.querySelector('[data-porta="mestrar"]').click(); document.getElementById('nome').value='Thiago'; document.getElementById('campanha').value='Ajuda'`);
await clicarENavegar(`document.getElementById('btnCriar').click()`);
await js(`const b=()=>document.getElementById('btnAvancar').click(); b(); document.getElementById('premissa').value='p'; document.getElementById('cenario').value='c'; b(); b(); b(); b();`);
await clicarENavegar(`document.getElementById('btnAvancar').click()`);
const codigo = await js(`Estado.campanha.codigo`);

/* ---- Mestre ---- */
await cmd('Emulation.setDeviceMetricsOverride', { width: 1366, height: 820, deviceScaleFactor: 1, mobile: false });
await ir('mestre.html');
await clicarENavegar(`document.querySelector('#codice .codice-site a[href="ajuda.html"]').click()`);
ok(await js(`location.pathname.endsWith('ajuda.html') && document.querySelector('#codice a[href="ajuda.html"]').classList.contains('ativo')`), 'Ajuda abre pelo pé do códice e acende ali');
ok(await js(`[...document.querySelectorAll('#ajuda > .cartao > h2')].map(h=>h.textContent.trim()).join('|')`) === 'O que cada tela faz|Atalhos do teclado|Jogar com os amigos pelo link|Quando algo dá errado', 'os quatro assuntos, na ordem');
ok(await js(`(()=>{const links=[...document.querySelectorAll('#ajuda a.nome-uso')]; return links.length===8 && links.every((a,i)=>a.getAttribute('href')===Layout.SECOES[i].arquivo) && [...document.querySelectorAll('#ajuda .cartao:first-child .explica-uso')].every(d=>d.textContent.length>20);})()`), '"O que cada tela faz": as oito telas, cada uma com o link e a sua linha de descrição');
ok(await js(`document.querySelector('#ajuda .lista-atalhos').textContent === Atalhos.montarLista().textContent && /Ctrl\\+K/.test(document.querySelector('#ajuda .lista-atalhos').textContent.replace(/\\s/g,''))`), 'os atalhos são a mesma lista da janela "?" (com o Ctrl+K da busca: no Mestre, em tudo da campanha)');
ok(await js(`/cloudflared tunnel --url http:\\/\\/localhost:3000/.test(document.querySelector('#ajuda .passos-ajuda').textContent) && /conta de Mestre/.test(document.getElementById('ajuda').textContent) && /admin\\.html/.test(document.getElementById('ajuda').textContent) && !/PLAINUS_SENHA_SERVIDOR/.test(document.getElementById('ajuda').textContent)`), 'como jogar pelo link: o comando do túnel e a conta de Mestre (sem a antiga senha do servidor)');
await foto('30-ajuda-mestre');

/* 1–8 é das telas do jogo: com o foco fora de campos, o 8 vai para o Diário */
await js(`document.activeElement && document.activeElement.blur()`);
await cmd('Input.dispatchKeyEvent', { type: 'keyDown', key: '8', code: 'Digit8', text: '8', windowsVirtualKeyCode: 56 });
await cmd('Input.dispatchKeyEvent', { type: 'keyUp', key: '8', code: 'Digit8', windowsVirtualKeyCode: 56 });
await espera(800);
ok(await js(`location.pathname.endsWith('diario.html')`), 'a tecla 8 vai para "Diário & Segredos" — o grupo do site não entra na conta');

/* ---- jogador (Guerreira: sete abas, sem Magias) ---- */
const ana = await novaAba();
await ana.ir('index.html');
await ana.js(`document.querySelector('[data-porta="convite"]').click(); document.getElementById('nome').value='Ana'; document.getElementById('codigo').value=${JSON.stringify(codigo)};`);
await ana.navegarPor(`document.getElementById('btnEntrar').click()`);
await ana.js(digita('#f-nome', 'Lyra') + digita('#f-raca', 'Elfa') + digita('#f-classe', 'Guerreira'));
await ana.js(`document.querySelector('[data-acao="salvar-ficha"]').click()`); await espera(600);
await ana.js(`(async()=>{for(let i=0;i<20&&!document.querySelector('.tour-pular');i++)await new Promise(r=>setTimeout(r,100));const b=document.querySelector('.tour-pular');if(b)b.click();})()`); await espera(300);
await ana.js(`document.querySelector('.nav-jogador .codice-site [data-aba="ajuda"]').click()`); await espera(400);
ok(await ana.js(`location.hash==='#aba=ajuda' && document.querySelector('#cabecaAba h1').textContent==='Ajuda'`), 'jogador: Ajuda abre como aba e vai para o endereço');
ok(await ana.js(`[...document.querySelectorAll('#principal .link-aba')].map(b=>b.dataset.aba).join(',')`) === 'ficha,inventario,mesa,chat,diario,notas,regras', '"O que cada aba faz": as abas DELA (sem Magias, que ela não conjura)');
await ana.js(`document.querySelector('#principal .link-aba[data-aba="regras"]').click()`); await espera(300);
ok(await ana.js(`location.hash==='#aba=regras'`), 'clicar no nome da aba leva até ela');
await ana.js(`document.querySelector('.nav-jogador .codice-site [data-aba="ajuda"]').click()`); await espera(300);
await ana.js(`document.querySelector('#principal [data-acao="rever-tour"]').click()`); await espera(500);
ok(await ana.js(`!!document.querySelector('.tour-fundo') && location.hash==='#aba=ficha'`), '"Rever o tour" volta para a Ficha e abre o tour');
await ana.js(`document.querySelector('.tour-pular') && document.querySelector('.tour-pular').click()`); await espera(200);
await ana.js(`document.activeElement && document.activeElement.blur()`);
await ana.cmd('Input.dispatchKeyEvent', { type: 'keyDown', key: '8', code: 'Digit8', text: '8', windowsVirtualKeyCode: 56 });
await ana.cmd('Input.dispatchKeyEvent', { type: 'keyUp', key: '8', code: 'Digit8', windowsVirtualKeyCode: 56 });
await espera(300);
ok(await ana.js(`location.hash==='#aba=ficha'`), 'com sete abas, o 8 não faz nada (antes caía no Perfil)');
await ana.js(`document.querySelector('.nav-jogador .codice-site [data-aba="ajuda"]').click()`); await espera(400);
await ana.foto('30-ajuda-jogador');

await ana.fechar();
console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill(); process.exit(0);
