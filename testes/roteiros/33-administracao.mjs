/* A Administração: a conta de administrador (só no computador do
   servidor), os convites de Mestre e as contas. */

const pedir = (rota, corpo, cabecalhos) => js(`fetch('/api/${rota}', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, ${JSON.stringify(cabecalhos || {})}), body: JSON.stringify(${JSON.stringify(corpo || {})}) }).then(r => r.json().then(d => Object.assign({ status: r.status }, d)))`);

await ir('admin.html');
ok(await js(`!document.getElementById('blocoCriarAdmin').hidden && document.getElementById('blocoEntrar').hidden && document.activeElement.id==='adminUsuario'`), 'sem administrador, no computador do servidor: a página pede a conta de administrador (foco no usuário)');

/* pelo túnel (o Cloudflare manda o CF-Connecting-IP), criar o administrador é recusado */
const deFora = await pedir('conta/admin', { usuario: 'Intruso', senha: 'senha-do-intruso' }, { 'CF-Connecting-IP': '203.0.113.9' });
ok(deFora.status === 403 && /computador onde o servidor está rodando/.test(deFora.erro), 'pelo link do túnel, criar o administrador: recusado (403)');
ok((await pedir('conta/estado', {}, { 'CF-Connecting-IP': '203.0.113.9' })).local === false, '…e o servidor sabe que o pedido veio de fora');

/* um corpo esquisito (objeto onde se espera texto): erro limpo, sem a pilha do Node */
const esquisito = await js(`fetch('/api/conta/entrar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"usuario":{"toString":1},"senha":"x"}' }).then(r => r.text().then(t => r.status + ' ' + t))`);
ok(/^(400|500) {/.test(esquisito) && !/C:\\|at |node:/.test(esquisito), 'pedido com um objeto no lugar do nome: resposta curta em JSON, sem caminhos deste computador (' + esquisito.slice(0, 60) + ')');

/* senhas diferentes: a página avisa antes de mandar */
await js(`document.getElementById('adminUsuario').value='Thiago'; document.getElementById('adminSenha').value='lua nova sobre Valkoria'; document.getElementById('adminSenha2').value='lua nova'; document.querySelector('#blocoCriarAdmin button[type="submit"]').click()`); await espera(200);
ok(await js(`/não são iguais/.test(document.getElementById('erro').textContent)`), 'as duas senhas diferentes: a página avisa');
await js(`document.getElementById('adminSenha2').value='lua nova sobre Valkoria'; document.querySelector('#blocoCriarAdmin button[type="submit"]').click()`);
ok(await aguardar(`!document.getElementById('blocoPainel').hidden && /Entrou como Thiago/.test(document.getElementById('subtitulo').textContent)`), 'administrador criado: o painel abre, logado como Thiago');
ok(await js(`ContaLocal.ler() && ContaLocal.ler().admin === true`), 'a sessão da conta fica neste navegador');
ok((await pedir('conta/admin', { usuario: 'Outro', senha: 'outra-senha-forte' })).status === 400, 'um segundo administrador, mesmo daqui: recusado');

/* convite de Mestre */
await js(`document.getElementById('btnConvite').click()`);
ok(await aguardar(`!document.getElementById('codigoGerado').hidden && /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(document.getElementById('textoCodigo').textContent)`), 'gerar convite: o código aparece, grande, uma vez');
const codigo = await js(`document.getElementById('textoCodigo').textContent`);
ok(await aguardar(`/aberto, vale até/.test(document.getElementById('listaConvites').textContent) && !document.getElementById('listaConvites').textContent.includes(${JSON.stringify(codigo)})`), 'a lista mostra o convite aberto — sem o código');
await foto('33-admin-convite');

/* alguém usa o convite (o passo 3 fará a tela; aqui, direto na /api) */
const bruna = await pedir('conta/criar', { convite: codigo, usuario: 'Bruna', senha: 'senha-da-bruna' }, { 'CF-Connecting-IP': '198.51.100.7' });
ok(bruna.status === 200 && bruna.usuario === 'Bruna' && bruna.admin === false, 'a Bruna cria a conta com o convite, pelo link');
ok((await pedir('admin/convite', { contaId: bruna.contaId, chave: bruna.chave, tipo: 'mestre' })).status === 403, 'a sessão da Bruna (não administradora) não gera convite: 403');
ok((await pedir('admin/contas', { contaId: bruna.contaId, chave: 'chave-inventada' })).status === 401, 'chave inventada: 401 (a sessão não vale), diferente de 403 (vale, mas não é administrador)');
await js(`PaginaAdmin.carregar()`); await espera(300);
ok(await js(`/virou a conta de Bruna/.test(document.getElementById('listaConvites').textContent) && /Bruna/.test(document.getElementById('listaContas').textContent)`), 'o painel mostra o convite usado pela Bruna, e a conta dela');

/* convite de nova senha e desativar */
await js(`document.querySelector('#listaContas [data-acao="nova-senha"]').click()`);
ok(await aguardar(`/Convite de nova senha para Bruna/.test(document.getElementById('rotuloCodigo').textContent)`), '"Convite de nova senha": o código aparece, dizendo para quem');
await js(`document.querySelector('#listaContas [data-acao="desativar"]').click()`); await espera(100);
ok(await js(`/Confirmar: desativar Bruna/.test(document.querySelector('#listaContas [data-acao="desativar"]').textContent)`), 'desativar pede o segundo clique');
await js(`document.querySelector('#listaContas [data-acao="desativar"]').click()`);
ok(await aguardar(`/desativada/.test(document.getElementById('listaContas').textContent)`), 'desativada: a lista diz "desativada"');
ok((await pedir('conta/eu', { contaId: bruna.contaId, chave: bruna.chave })).status === 401, '…e a sessão da Bruna caiu na hora');

/* revogar */
await js(`document.getElementById('btnConvite').click()`); await espera(400);
await js(`document.querySelector('#listaConvites [data-acao="revogar"]').click()`); await espera(100);
await js(`document.querySelector('#listaConvites [data-acao="revogar"]').click()`);
ok(await aguardar(`/Convite revogado/.test(document.getElementById('aviso').textContent) && document.getElementById('codigoGerado').hidden`), 'revogar (dois cliques): o convite sai, e o código dele some da tela');

/* sair e entrar */
await js(`document.getElementById('btnSair').click()`);
ok(await aguardar(`!document.getElementById('blocoEntrar').hidden && !ContaLocal.ler()`), 'sair: a sessão sai deste navegador e a página pede para entrar');
await js(`document.getElementById('entrarUsuario').value='thiago'; document.getElementById('entrarSenha').value='errada'; document.querySelector('#blocoEntrar button[type="submit"]').click()`);
ok(await aguardar(`/não conferem/.test(document.getElementById('erro').textContent) && document.getElementById('entrarSenha').value==='errada'`), 'senha errada: "não conferem", e a tentativa fica no campo');
await js(`document.getElementById('entrarSenha').value='lua nova sobre Valkoria'; document.querySelector('#blocoEntrar button[type="submit"]').click()`);
ok(await aguardar(`!document.getElementById('blocoPainel').hidden`), 'usuário em minúsculas + senha certa: o painel volta');
await foto('33-admin-painel');

console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill(); process.exit(0);
