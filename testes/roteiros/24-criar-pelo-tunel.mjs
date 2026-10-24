/* Pelo túnel (o navegador manda CF-Connecting-IP, como o Cloudflare):
   a entrada e a criação avisam ANTES; no localhost, tudo normal. */
await cmd('Network.enable');
await cmd('Network.setExtraHTTPHeaders', { headers: { 'CF-Connecting-IP': '203.0.113.7' } });

await ir('index.html');
await js(`document.querySelector('[data-porta="mestrar"]').click()`); await espera(300);
const e = JSON.parse(await js(`JSON.stringify({aviso:!document.getElementById('avisoSoLocal').hidden, criarEscondido:document.getElementById('criarAqui').hidden, foco:document.activeElement.id, voltaMestre:!!document.getElementById('btnVoltaMestre').offsetParent})`));
ok(e.aviso && e.criarEscondido, 'pelo túnel, "Vou mestrar" mostra o aviso no lugar dos campos de criar');
ok(e.voltaMestre && e.foco === 'contaUsuario', '…o foco vai para entrar com a conta de Mestre, e "entrar como Mestre" (código + senha) continua à vista (' + e.foco + ')');
await foto('tunel-mestrar');
await js(`document.getElementById('btnRestaurar').click()`); await espera(200);
ok(/restaurar um backup pede a sua conta de Mestre/.test(await js(`document.getElementById('erro').textContent`)), 'pelo túnel, sem conta, "Restaurar backup" explica (a conta de Mestre) antes de abrir a escolha de arquivo');

await ir('criar-campanha.html');
const c = JSON.parse(await js(`JSON.stringify({aviso:!document.getElementById('avisoSoLocal').hidden, passos:document.getElementById('passos').hidden, nav:document.querySelector('.passos-nav').hidden, visiveis:[...document.querySelectorAll('.passo')].filter(p=>!p.hidden).length, link:document.getElementById('linkCancelar').textContent})`));
ok(c.aviso && c.passos && c.nav && c.visiveis === 0, 'pelo túnel, criar-campanha.html mostra só o aviso (etapas visíveis: ' + c.visiveis + ')');
ok(c.link === 'Voltar à entrada', 'e o link vira "Voltar à entrada"');
await foto('tunel-criar');

/* Sem o cabeçalho: o computador do servidor, tudo como antes. */
await cmd('Network.setExtraHTTPHeaders', { headers: {} });
await ir('index.html');
await js(`document.querySelector('[data-porta="mestrar"]').click()`); await espera(300);
ok(await js(`document.getElementById('avisoSoLocal').hidden && !document.getElementById('criarAqui').hidden`), 'no localhost, "Vou mestrar" mostra os campos de criar, sem aviso');
await js(`document.getElementById('nome').value='Thiago'; document.getElementById('campanha').value='Pelo localhost'`);
await clicarENavegar(`document.getElementById('btnCriar').click()`);
ok(await js(`document.getElementById('avisoSoLocal').hidden && !document.getElementById('passos').hidden && !document.querySelector('.passos-nav').hidden`), 'no localhost, a criação abre com as etapas');
await js(`const b=()=>document.getElementById('btnAvancar').click(); b(); document.getElementById('premissa').value='p'; document.getElementById('cenario').value='c'; b(); b(); b(); b();`);
await clicarENavegar(`document.getElementById('btnAvancar').click()`);
ok(await js(`location.pathname.endsWith('mestre.html') && Estado.campanha.nome==='Pelo localhost'`), 'e a campanha é criada');

/* ---- A antiga senha do servidor (PLAINUS_SENHA_SERVIDOR) não abre mais nada ----
   Pelo link, quem cria é a conta de Mestre (roteiro 34). */
process.env.PLAINUS_SENHA_SERVIDOR = 'senha-do-servidor-de-teste';
servidor.kill(); await espera(800); await ligarServidor();
await cmd('Network.setExtraHTTPHeaders', { headers: { 'CF-Connecting-IP': '203.0.113.7' } });
await ir('index.html');
await js(`localStorage.removeItem('plainus:acessos'); sessionStorage.clear(); true`);
await ir('index.html');
await js(`document.querySelector('[data-porta="mestrar"]').click()`); await espera(300);
ok(await js(`!document.getElementById('senhaServidor') && !document.getElementById('avisoSoLocal').hidden && document.getElementById('criarAqui').hidden`), 'com PLAINUS_SENHA_SERVIDOR no .env: a entrada não pede mais a senha do servidor — pelo link, sem conta, só o aviso da conta de Mestre');
const comSenhaAntiga = await js(`fetch('/api/campanhas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: {}, senhaServidor: 'senha-do-servidor-de-teste' }) }).then(r => r.json().then(d => ({ status: r.status, erro: d.erro })))`);
ok(comSenhaAntiga.status === 403 && /conta de Mestre/.test(comSenhaAntiga.erro), 'e o servidor recusa criar pelo link mesmo com a senha antiga certa no pedido');
process.env.PLAINUS_SENHA_SERVIDOR = '';

console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill();
process.exit(0);
