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

/* ---- Com a senha do servidor ligada: o Mestre cria PELO LINK ---- */
process.env.PLAINUS_SENHA_SERVIDOR = 'senha-do-servidor-de-teste';
servidor.kill(); await espera(800); await ligarServidor();
await cmd('Network.setExtraHTTPHeaders', { headers: { 'CF-Connecting-IP': '203.0.113.7' } });
await ir('index.html');
await js(`localStorage.removeItem('plainus:acessos'); sessionStorage.clear(); true`);
await ir('index.html');
await js(`document.querySelector('[data-porta="mestrar"]').click()`); await espera(300);
const s = JSON.parse(await js(`JSON.stringify({campo:!document.getElementById('campoSenhaServidor').hidden, aviso:!document.getElementById('avisoSoLocal').hidden, criar:!document.getElementById('criarAqui').hidden, foco:document.activeElement.id})`));
ok(s.campo && s.criar && !s.aviso && s.foco === 'senhaServidor', 'senha ligada: pelo link, "Vou mestrar" pede a senha do servidor (com o foco nela), sem o aviso');
await foto('tunel-senha');
await js(`document.getElementById('nome').value='Thiago'; document.getElementById('campanha').value='Pelo link'; document.getElementById('senhaServidor').value='errada-errada-errada'; document.getElementById('btnCriar').click()`);
ok(await aguardar(`/não confere/.test(document.getElementById('erro').textContent) && !location.pathname.endsWith('criar-campanha.html')`), 'senha do servidor errada: recusada ali mesmo, antes das etapas');
ok(await js(`document.getElementById('senhaServidor').value==='errada-errada-errada' && document.activeElement===document.getElementById('senhaServidor')`), '…e a senha errada FICA no campo (selecionada), em vez de sumir — o próximo clique não troca o aviso por "Digite a senha"');
await js(`document.querySelector('[data-mostra="senhaServidor"]').click()`);
ok(await js(`document.getElementById('senhaServidor').type==='text'`), '"Mostrar a senha": dá para ver o que foi digitado');
/* Copiar-e-colar do .env costuma trazer um espaço: não conta. */
await js(`document.getElementById('senhaServidor').value='  senha-do-servidor-de-teste '`);
await clicarENavegar(`document.getElementById('btnCriar').click()`);
ok(await js(`location.pathname.endsWith('criar-campanha.html') && !document.getElementById('passos').hidden && /obrigatória/.test(document.getElementById('tituloSenha').textContent)`), 'senha certa: a criação abre, e a senha do Mestre vira obrigatória');
await js(`document.getElementById('btnAvancar').click()`);
ok(await js(`/senha do Mestre é obrigatória/.test(document.getElementById('erro').textContent)`), 'sem a senha do Mestre, a etapa 1 não passa');
await js(digita('#senhaMestre', 'senha do mestre 123') + digita('#senhaMestre2', 'senha do mestre 123') + `const b=()=>document.getElementById('btnAvancar').click(); b(); document.getElementById('premissa').value='p'; document.getElementById('cenario').value='c'; b(); b(); b(); b();`);
await clicarENavegar(`document.getElementById('btnAvancar').click()`);
ok(await js(`location.pathname.endsWith('mestre.html') && Estado.campanha.nome==='Pelo link'`), 'a campanha é criada PELO LINK');
const codigoLink = await js(`Estado.campanha.codigo`);

/* Outro dia, outro link: o navegador não tem a mesa. Volta-se com o
   código e a senha do Mestre. */
await js(`localStorage.removeItem('plainus:acessos'); Sessao.limpar(); true`);
await ir('index.html');
await js(`document.querySelector('[data-porta="mestrar"]').click(); document.getElementById('btnVoltaMestre').click(); document.getElementById('codigoMestre').value=${JSON.stringify(codigoLink)}; document.getElementById('senhaMestre').value='senha do mestre 123';`);
await clicarENavegar(`document.getElementById('btnEntrarMestre').click()`);
ok(await js(`location.pathname.endsWith('mestre.html') && Estado.campanha.nome==='Pelo link'`), 'num link novo, o Mestre volta à mesa com o código e a senha');

console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill();
process.exit(0);
