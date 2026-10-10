/* O site servido pelo server.js (http://), e não pelo duplo clique
   (file://). Este roteiro liga o próprio servidor numa porta de teste. */
const PORTA_TESTE = 3999;
const SITE = 'http://127.0.0.1:' + PORTA_TESTE + '/';
const servidor = spawn(process.execPath, [path.join(MESA, 'server.js')], { env: Object.assign({}, process.env, { PORT: String(PORTA_TESTE) }), stdio: ['ignore', 'pipe', 'pipe'] });
let falaDoServidor = '';
servidor.stdout.on('data', (d) => { falaDoServidor += d; });
servidor.stderr.on('data', (d) => { falaDoServidor += d; });
for (let i = 0; i < 40 && !falaDoServidor.includes('no ar'); i++) await espera(100);
process.on('exit', () => { try { servidor.kill(); } catch (erro) { /* já tinha saído */ } });
ok(falaDoServidor.includes('Plainus no ar em http://localhost:' + PORTA_TESTE), 'npm start: o servidor liga e diz o endereço');

const irHttp = async (caminho) => { const p = new Promise((r) => { carregou = r; }); await cmd('Page.navigate', { url: SITE + caminho }); await p; await espera(300); };
/* Espera até a página mostrar algo — em vez de um tempo fixo, que pode ser pouco. */
const esperarPor = async (expr, limite) => { for (let i = 0; i < (limite || 50); i++) { if (await js(expr)) return true; await espera(100); } return false; };
const status = async (caminho) => (await fetch(SITE + caminho)).status;

/* a lista branca, de novo, de fora */
ok(await status('') === 200 && await status('jogador.html') === 200 && await status('vendor/three.min.js') === 200, 'entrega as páginas, os scripts e o vendor/');
ok(await status('server.js') === 404 && await status('package.json') === 404 && await status('.git/config') === 404 && await status('testes/rodar.mjs') === 404, 'não entrega server.js, package.json, .git nem os testes');

/* o Mestre cria a campanha pelo http:// */
await irHttp('');
ok(await js(`location.protocol`) === 'http:' && await esperarPor(`!!document.querySelector('[data-porta="mestrar"]')`), 'a entrada abre por http://');
await js(`document.querySelector('[data-porta="mestrar"]').click(); document.getElementById('nome').value='Thiago'; document.getElementById('campanha').value='Mesa no servidor'`);
await clicarENavegar(`document.getElementById('btnCriar').click()`);
await js(`document.getElementById('btnAvancar').click(); document.getElementById('premissa').value='x'; document.getElementById('cenario').value='y'; const b=()=>document.getElementById('btnAvancar').click(); b(); b(); b(); b();`);
await clicarENavegar(`document.getElementById('btnAvancar').click()`);
ok(await js(`location.href`) === SITE + 'mestre.html' && await js(`Estado.campanha.nome`) === 'Mesa no servidor', 'criar campanha leva ao painel do Mestre, em http://');
const codigo = await js(`Estado.campanha.codigo`);

/* no ar, o convite é um LINK */
await js(`window._copiado=null; navigator.clipboard.writeText=(t)=>{window._copiado=t; return Promise.resolve();}; Layout.copiarCodigo()`); await espera(100);
ok(await js(`window._copiado`) === SITE + 'index.html#convite=' + codigo, 'o botão de convite copia o LINK: ' + await js(`window._copiado`));

/* a Ana abre o link */
const ana = await novaAba();
await ana.js(`location.href=${JSON.stringify(SITE + 'jogador.html')}`); await espera(500);
await ana.navegarPor(`location.href=${JSON.stringify(SITE + 'index.html#convite=' + codigo)}`);
ok(await ana.js(`!document.getElementById('formPorta').hidden && document.getElementById('codigo').value===${JSON.stringify(codigo)} && document.getElementById('conviteAchado').textContent.includes('Mesa no servidor')`), 'a Ana abre o link: porta do convite aberta, código preenchido, "Mesa no servidor"');
await ana.js(`document.getElementById('nome').value='Ana'`);
await ana.navegarPor(`document.getElementById('btnEntrar').click()`);
ok(await ana.js(`location.href`) === SITE + 'jogador.html' && await ana.js(`!!document.getElementById('formFicha')`), '…e entra como jogadora, no formulário da ficha');
await ana.fechar();

servidor.kill();
console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill();
process.exit(0);
