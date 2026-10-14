/* Pelo túnel (o navegador manda CF-Connecting-IP, como o Cloudflare):
   a entrada e a criação avisam ANTES; no localhost, tudo normal. */
await cmd('Network.enable');
await cmd('Network.setExtraHTTPHeaders', { headers: { 'CF-Connecting-IP': '203.0.113.7' } });

await ir('index.html');
await js(`document.querySelector('[data-porta="mestrar"]').click()`); await espera(300);
const e = JSON.parse(await js(`JSON.stringify({aviso:!document.getElementById('avisoSoLocal').hidden, criarEscondido:document.getElementById('criarAqui').hidden, foco:document.activeElement.id, voltaMestre:!!document.getElementById('btnVoltaMestre').offsetParent})`));
ok(e.aviso && e.criarEscondido, 'pelo túnel, "Vou mestrar" mostra o aviso no lugar dos campos de criar');
ok(e.voltaMestre && e.foco === 'btnVoltaMestre', '…e "entrar como Mestre" continua à vista, com o foco nele (' + e.foco + ')');
await foto('tunel-mestrar');
await js(`document.getElementById('btnRestaurar').click()`); await espera(200);
ok(/restaurados no computador onde o servidor/.test(await js(`document.getElementById('erro').textContent`)), 'pelo túnel, "Restaurar backup" explica antes de abrir a escolha de arquivo');

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

console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill();
process.exit(0);
