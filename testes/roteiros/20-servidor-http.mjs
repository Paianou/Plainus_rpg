/* O site servido pelo server.js (http://) — o servidor que a base liga
   para cada roteiro. */
ok(falaDoServidor.includes('Plainus no ar em http://localhost:' + PORTA_TESTE), 'npm start: o servidor liga e diz o endereço');

const irHttp = (caminho) => ir(caminho);
const esperarPor = (expr, limite) => aguardar(expr, js, limite);
const status = async (caminho) => (await fetch(SITE + caminho)).status;

/* a lista branca, de novo, de fora */
ok(await status('') === 200 && await status('jogador.html') === 200 && await status('vendor/three.min.js') === 200, 'entrega as páginas, os scripts e o vendor/');
ok(await status('server.js') === 404 && await status('package.json') === 404 && await status('.git/config') === 404 && await status('testes/rodar.mjs') === 404, 'não entrega server.js, package.json, .git nem os testes');
ok(await status('servidor/armazem.js') === 404 && await status('data/campanhas/c0000000000000000.json') === 404 && await status('modelo.js') === 200, 'não entrega o código do servidor (servidor/) nem as campanhas (data/); entrega o modelo.js, que o site usa');

/* o Mestre cria a campanha pelo http:// */
await irHttp('');
ok(await js(`location.protocol`) === 'http:' && await esperarPor(`!!document.querySelector('[data-porta="mestrar"]')`), 'a entrada abre por http://');
await js(`document.querySelector('[data-porta="mestrar"]').click(); document.getElementById('nome').value='Thiago'; document.getElementById('campanha').value='Mesa no servidor'`);
await clicarENavegar(`document.getElementById('btnCriar').click()`);
await js(`document.getElementById('btnAvancar').click(); document.getElementById('premissa').value='x'; document.getElementById('cenario').value='y'; const b=()=>document.getElementById('btnAvancar').click(); b(); b(); b(); b();`);
await clicarENavegar(`document.getElementById('btnAvancar').click()`);
ok(await js(`location.href`) === SITE + 'mestre.html' && await js(`Estado.campanha.nome`) === 'Mesa no servidor', 'criar campanha leva ao painel do Mestre, em http://');
const codigo = await js(`Estado.campanha.codigo`);

/* Aberta por localhost/127.0.0.1, o convite é o CÓDIGO: um link
   "http://127.0.0.1/…" não abre nada no computador do amigo. */
await js(`window._copiado=null; navigator.clipboard.writeText=(t)=>{window._copiado=t; return Promise.resolve();}; Layout.copiarCodigo()`); await espera(100);
ok(await js(`window._copiado`) === codigo, 'por localhost, o botão de convite copia o CÓDIGO: ' + await js(`window._copiado`));

/* O link inteiro colado no campo do código também entra (antes, o
   campo cortava o link em 20 letras e o código era recusado). */
const bia = await novaAba();
await bia.js(`location.href=${JSON.stringify(SITE + 'jogador.html')}`); await espera(500);
await bia.navegarPor(`location.href=${JSON.stringify(SITE)}`);
await bia.js(`document.querySelector('[data-porta="convite"]').click(); document.getElementById('nome').value='Bia'; const c=document.getElementById('codigo'); c.value=${JSON.stringify(SITE + 'index.html#convite=' + codigo)};`);
/* (value por JavaScript ignora o maxlength; quem cola com o teclado, não.) */
ok(await bia.js(`document.getElementById('codigo').maxLength`) >= 100 && await bia.js(`document.getElementById('codigoMestre').maxLength`) >= 100, 'os campos de código cabem um link colado inteiro');
await bia.navegarPor(`document.getElementById('btnEntrar').click()`);
ok(await bia.js(`location.href`) === SITE + 'jogador.html', 'link colado no campo do código: a Bia entra na mesa');
await bia.fechar();

/* a Ana abre o link */
const ana = await novaAba();
await ana.js(`location.href=${JSON.stringify(SITE + 'jogador.html')}`); await espera(500);
await ana.navegarPor(`location.href=${JSON.stringify(SITE + 'index.html#convite=' + codigo)}`);
ok(await ana.js(`!document.getElementById('formPorta').hidden && document.getElementById('codigo').value===${JSON.stringify(codigo)} && document.getElementById('conviteAchado').textContent.includes('Mesa no servidor')`), 'a Ana abre o link: porta do convite aberta, código preenchido, "Mesa no servidor"');
await ana.js(`document.getElementById('nome').value='Ana'`);
await ana.navegarPor(`document.getElementById('btnEntrar').click()`);
ok(await ana.js(`location.href`) === SITE + 'jogador.html' && await ana.js(`!!document.getElementById('formFicha')`), '…e entra como jogadora, no formulário da ficha');
await ana.fechar();

/* As rotas de teste só existem com PLAINUS_ROTAS_DE_TESTE=1: um servidor
   ligado do jeito normal (npm start) não as tem. */
const { mkdtempSync } = await import('node:fs');
const { tmpdir } = await import('node:os');
const PORTA_NORMAL = PORTA_TESTE - 2;
const normal = spawn(process.execPath, [path.join(MESA, 'server.js')], { env: Object.assign({}, process.env, { PORT: String(PORTA_NORMAL), DATA_DIR: mkdtempSync(path.join(tmpdir(), 'plainus-')), PLAINUS_ROTAS_DE_TESTE: '' }), stdio: ['ignore', 'pipe', 'pipe'] });
let falaNormal = '';
normal.stdout.on('data', (d) => { falaNormal += d; });
for (let i = 0; i < 60 && !falaNormal.includes('no ar'); i++) await espera(100);
const rotaTeste = await fetch('http://127.0.0.1:' + PORTA_NORMAL + '/teste/ler', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then((r) => r.status, () => 'erro');
ok(falaNormal.includes('no ar') && rotaTeste === 404, 'no npm start de sempre, as rotas de teste não existem (' + rotaTeste + ')');
normal.kill();
console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill();
process.exit(0);
