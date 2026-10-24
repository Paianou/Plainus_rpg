/* A conta de Mestre na entrada, PELO LINK (o navegador manda o
   CF-Connecting-IP, como o Cloudflare): criar a conta com o convite,
   criar campanha sem a senha do servidor, e voltar a ela de outro
   computador por "Minhas campanhas". */

const api = (rota, corpo, cab) => js(`fetch('/api/${rota}', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, ${JSON.stringify(cab || {})}), body: JSON.stringify(${JSON.stringify(corpo || {})}) }).then(r => r.json().then(d => Object.assign({ status: r.status }, d)))`);

/* ---- o administrador, no computador do servidor ---- */
await ir('index.html');
const adm = await api('conta/admin', { usuario: 'Thiago', senha: 'lua nova sobre Valkoria' });
ok(adm.admin === true, 'o administrador é criado no computador do servidor');
const convite = await api('admin/convite', { contaId: adm.contaId, chave: adm.chave, tipo: 'mestre' });
ok(/^[A-Z0-9-]{14}$/.test(convite.codigo), 'ele gera um convite de Mestre');

/* ---- daqui para baixo, pelo link do túnel ---- */
await cmd('Network.enable');
await cmd('Network.setExtraHTTPHeaders', { headers: { 'CF-Connecting-IP': '198.51.100.7' } });
await ir('index.html');
await js(`localStorage.clear(); sessionStorage.clear(); true`);
await ir('index.html');
await js(`document.querySelector('[data-porta="mestrar"]').click()`); await espera(500);
ok(await js(`!document.getElementById('blocoContaEntrar').hidden && document.getElementById('blocoMinhaConta').hidden && !document.getElementById('avisoSoLocal').hidden && document.activeElement.id==='contaUsuario'`), 'pelo link, sem conta: "Vou mestrar" pede a conta de Mestre (foco no usuário), e o aviso explica');
ok(await js(`/conta de Mestre/.test(document.getElementById('avisoSoLocal').textContent) && document.getElementById('campoNome').hidden`), '…o aviso fala da conta, e "Seu nome" (que não serve sem conta) não aparece');
await foto('34-sem-conta');

/* criar a conta com o convite */
await js(`document.querySelector('[data-conta-modo="criar"]').click()`); await espera(100);
ok(await js(`!document.getElementById('blocoContaCriar').hidden && document.activeElement.id==='conviteMestre'`), '"Tenho um convite de Mestre" abre o formulário de criar conta');
await js(`document.getElementById('conviteMestre').value=${JSON.stringify(convite.codigo.toLowerCase())}; document.getElementById('novoUsuario').value='Bruna'; document.getElementById('novaSenhaConta').value='senha-da-bruna'; document.getElementById('novaSenhaConta2').value='senha-da-bruna'; document.getElementById('btnCriarConta').click()`);
ok(await aguardar(`!document.getElementById('blocoMinhaConta').hidden && document.getElementById('usuarioLogado').textContent==='Bruna'`), 'conta criada: "Mestre: Bruna"');
ok(await aguardar(`/Nenhuma campanha ainda/.test(document.getElementById('listaMinhas').textContent) && !document.getElementById('criarAqui').hidden && document.getElementById('avisoSoLocal').hidden && document.getElementById('linkAdmin').hidden`), '"Minhas campanhas" vazia, e os campos de criar aparecem; Bruna não é administradora, então o link da Administração não aparece');
ok(await js(`!document.getElementById('campoNome').hidden && document.getElementById('nome').value===''`), '"Seu nome" aparece vazio: o nome NA MESA é escolhido, e não é o usuário da conta (que é metade do login)');
await foto('34-logada');

/* criar a campanha pelo link, com a conta */
await js(`document.getElementById('nome').value='Mestra Bru'; document.getElementById('campanha').value='A Torre de Bruna'`);
await clicarENavegar(`document.getElementById('btnCriar').click()`);
await aguardar(`window.plainusCarregando === false`);
ok(await js(`!/obrigatória/.test(document.getElementById('tituloSenha').textContent) && document.getElementById('avisoSoLocal').hidden`), 'na criação, com conta: as etapas abrem, e a senha do Mestre NÃO é obrigatória');
await js(`const b=()=>document.getElementById('btnAvancar').click(); b(); document.getElementById('premissa').value='p'; document.getElementById('cenario').value='c'; b(); b(); b(); b();`);
await clicarENavegar(`document.getElementById('btnAvancar').click()`);
ok(await js(`location.pathname.endsWith('mestre.html') && Estado.campanha.nome==='A Torre de Bruna' && Estado.mestre.nome==='Mestra Bru'`), 'a campanha é criada pelo link, com o nome escolhido para a mesa (não o usuário)');
const minhas = await js(`Servidor.conta('campanhas', { contaId: ContaLocal.ler().contaId, chave: ContaLocal.ler().chave })`);
ok(minhas.campanhas && minhas.campanhas.length === 1 && minhas.campanhas[0].nome === 'A Torre de Bruna', 'a campanha nasceu da conta da Bruna (o servidor a lista como dela)');

/* outro computador: só usuário e senha */
await ir('index.html');
await js(`localStorage.clear(); sessionStorage.clear(); true`);
await ir('index.html');
await js(`document.querySelector('[data-porta="mestrar"]').click()`); await espera(500);
await js(`document.getElementById('contaUsuario').value='bruna'; document.getElementById('contaSenha').value='errada'; document.getElementById('btnEntrarConta').click()`);
ok(await aguardar(`/não conferem/.test(document.getElementById('erro').textContent) && document.getElementById('contaSenha').value==='errada'`), 'senha errada: "não conferem", e a tentativa fica no campo');
await js(`document.getElementById('contaSenha').value='senha-da-bruna'`);
await js(`document.getElementById('contaSenha').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);
ok(await aguardar(`/A Torre de Bruna/.test(document.getElementById('listaMinhas').textContent)`), 'noutro computador, usuário + senha (Enter): "Minhas campanhas" mostra a Torre');
await clicarENavegar(`document.querySelector('#listaMinhas [data-campanha]').click()`);
ok(await js(`location.pathname.endsWith('mestre.html') && Estado.campanha.nome==='A Torre de Bruna' && Sessao.ler().papel==='mestre'`), '"Abrir": o painel do Mestre abre neste computador, sem senha da campanha');

/* a conta de outra pessoa não abre a Torre */
const outra = await api('admin/convite', { contaId: adm.contaId, chave: adm.chave, tipo: 'mestre' }, {});
const carla = await api('conta/criar', { convite: outra.codigo, usuario: 'Carla', senha: 'senha-da-carla' });
const roubo = await api('conta/abrir', { contaId: carla.contaId, chave: carla.chave, campanhaId: minhas.campanhas[0].id });
ok(roubo.status === 400 && /não é da sua conta/.test(roubo.erro), 'a conta da Carla não abre a campanha da Bruna');

/* esqueceu a senha: convite de nova senha */
const contasLista = await api('admin/contas', { contaId: adm.contaId, chave: adm.chave });
const idBruna = contasLista.contas.find((c) => c.usuario === 'Bruna').id;
const deSenha = await api('admin/convite', { contaId: adm.contaId, chave: adm.chave, tipo: 'senha', paraConta: idBruna });
await ir('index.html');
await js(`localStorage.clear(); sessionStorage.clear(); true`);
await ir('index.html');
await js(`document.querySelector('[data-porta="mestrar"]').click()`); await espera(500);
await js(`document.querySelector('[data-conta-modo="senha"]').click()`); await espera(100);
await js(`document.getElementById('conviteSenha').value=${JSON.stringify(deSenha.codigo)}; document.getElementById('trocaSenha').value='senha nova da bruna'; document.getElementById('trocaSenha2').value='senha nova da bruna'; document.getElementById('btnTrocarSenha').click()`);
ok(await aguardar(`!document.getElementById('blocoMinhaConta').hidden && /A Torre de Bruna/.test(document.getElementById('listaMinhas').textContent)`), 'com o convite de nova senha: troca a senha, entra, e a Torre continua dela');

/* desativar a conta tira o Mestre dela nas próprias mesas */
const sessaoB = await js(`ContaLocal.ler()`);
const abriu = await api('conta/abrir', { contaId: sessaoB.contaId, chave: sessaoB.chave, campanhaId: minhas.campanhas[0].id });
ok(!!abriu.chave && (await api('acessos', { campanhaId: abriu.campanhaId, chave: abriu.chave })).status === 200, 'antes: a chave de Mestre que "Abrir" deu vale');
ok(!(await api('admin/desativar', { contaId: adm.contaId, chave: adm.chave, paraConta: idBruna })).erro, 'o administrador desativa a conta da Bruna');
ok((await api('acessos', { campanhaId: abriu.campanhaId, chave: abriu.chave })).status === 403, '…e a chave de Mestre dela na Torre deixa de valer na hora');
await ir('index.html');
await js(`document.querySelector('[data-porta="mestrar"]').click()`); await espera(600);
ok(await aguardar(`/não vale mais/.test(document.getElementById('erro').textContent) && !document.getElementById('blocoContaEntrar').hidden && !ContaLocal.ler()`), 'com a página aberta de novo: "sua sessão não vale mais", e volta a pedir a conta');

/* sair da conta (com outra conta, a da Carla) */
await js(`ContaLocal.gravar(${JSON.stringify({ contaId: carla.contaId, chave: carla.chave, usuario: 'Carla', admin: false })})`);
await ir('index.html');
await js(`document.querySelector('[data-porta="mestrar"]').click()`); await espera(600);
/* sair da conta */
await js(`document.getElementById('btnSairConta').click()`);
ok(await aguardar(`!document.getElementById('blocoContaEntrar').hidden && !ContaLocal.ler() && !document.getElementById('avisoSoLocal').hidden`), 'sair da conta: volta a pedir a conta, e (pelo link) o aviso volta');

await cmd('Network.setExtraHTTPHeaders', { headers: {} });
console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill(); process.exit(0);
