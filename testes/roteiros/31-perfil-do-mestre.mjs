/* O Perfil do Mestre: trocar o nome sem passar pelo "Editar campanha",
   e o nome novo chega ao topo, ao servidor e aos jogadores. */

await ir('index.html');
await js(`document.querySelector('[data-porta="mestrar"]').click(); document.getElementById('nome').value='Thiago'; document.getElementById('campanha').value='Perfil'`);
await clicarENavegar(`document.getElementById('btnCriar').click()`);
await js(`const b=()=>document.getElementById('btnAvancar').click(); b(); document.getElementById('premissa').value='p'; document.getElementById('cenario').value='c'; b(); b(); b(); b();`);
await clicarENavegar(`document.getElementById('btnAvancar').click()`);
const codigo = await js(`Estado.campanha.codigo`);

/* uma jogadora, para ver o nome chegar do outro lado */
const ana = await novaAba();
await ana.ir('index.html');
await ana.js(`document.querySelector('[data-porta="convite"]').click(); document.getElementById('nome').value='Ana'; document.getElementById('codigo').value=${JSON.stringify(codigo)};`);
await ana.navegarPor(`document.getElementById('btnEntrar').click()`);
await ana.js(digita('#f-nome', 'Lyra') + digita('#f-raca', 'Elfa') + digita('#f-classe', 'Guerreira'));
await ana.js(`document.querySelector('[data-acao="salvar-ficha"]').click()`); await espera(600);
await ana.js(`(async()=>{for(let i=0;i<20&&!document.querySelector('.tour-pular');i++)await new Promise(r=>setTimeout(r,100));const b=document.querySelector('.tour-pular');if(b)b.click();})()`); await espera(300);
ok(await ana.js(`/Mestre: Thiago/.test(document.body.textContent)`), 'a jogadora vê "Mestre: Thiago"');

await cmd('Page.bringToFront');
await cmd('Emulation.setDeviceMetricsOverride', { width: 1366, height: 820, deviceScaleFactor: 1, mobile: false });
await ir('mestre.html');
await clicarENavegar(`document.querySelector('#codice .codice-site a[href="perfil.html"]').click()`);
ok(await js(`location.pathname.endsWith('perfil.html') && document.querySelector('#codice a[href="perfil.html"]').classList.contains('ativo')`), 'Perfil abre pelo pé do códice e acende ali');
ok(await js(`document.getElementById('nomeMestre').value === 'Thiago' && document.querySelector('label[for="nomeMestre"]').textContent === 'Seu nome como Mestre' && document.querySelector('.selo-perfil .perfil .nome').textContent === 'Thiago'`), 'o campo vem com o nome de agora, com rótulo, e o selo do topo aparece no cartão');

/* vazio: recusado, e o campo marcado */
await js(`document.getElementById('nomeMestre').value='   '; document.getElementById('nomeMestre').dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('#formNome button[type="submit"]').click()`); await espera(200);
ok(await js(`document.getElementById('nomeMestre').getAttribute('aria-invalid')==='true' && /Diga como a mesa te chama/.test(document.getElementById('recados').textContent) && Estado.mestre.nome==='Thiago'`), 'nome vazio: recusado, com o aviso de sempre, e nada muda');

/* o nome novo, com Enter */
await js(`document.getElementById('nomeMestre').value='Mestre Thiago Corvo'; document.getElementById('nomeMestre').dispatchEvent(new Event('input',{bubbles:true}));`);
await js(`document.getElementById('nomeMestre').focus()`);
await cmd('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
await cmd('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
await espera(300);
ok(await js(`Estado.mestre.nome === 'Mestre Thiago Corvo' && document.querySelector('#barraTopo .perfil .nome').textContent === 'Mestre Thiago Corvo' && document.querySelector('#barraTopo .perfil .retrato').textContent === 'T'`), 'Enter salva: o topo já mostra o nome novo (e a inicial ignora o "Mestre")');
ok(await js(`document.activeElement === document.querySelector('#formNome button[type="submit"]')`), '…e o foco vai para o botão (com o cursor no campo, a tela seguraria as novidades)');
ok(await aguardar(`T.gravado().then(e=>e.mestre.nome==='Mestre Thiago Corvo')`), 'o servidor gravou');
ok(await js(`Acessos.listar().some(a=>a.papel==='mestre' && a.nome==='Mestre Thiago Corvo') && Sessao.ler().nome==='Mestre Thiago Corvo'`), 'a lista de mesas deste navegador e a sessão também ficam com o nome novo');
ok(await js(`!AvisoSaida.haPendencia()`), 'depois de salvar, sair da página não pergunta nada');
await foto('31-perfil-mestre');

ok(await js(`document.getElementById('nomeMestre').maxLength === 30`), 'o campo aceita até 30 letras (o mesmo limite da criação)');

await ana.frente();
ok(await aguardar(`/Mestre: Mestre Thiago Corvo/.test(document.body.textContent)`, ana.js), 'a jogadora vê o nome novo, sem recarregar');
ok(await aguardar(`Conexao.presentes && Conexao.presentes.some(p=>p.papel==='mestre' && p.nome==='Mestre Thiago Corvo')`, ana.js), '…e a lista de quem está na mesa também (sem o Mestre reconectar)');

await ana.fechar();
console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill(); process.exit(0);
