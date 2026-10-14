/* Atrás do Cloudflare Tunnel: os limites por endereço contam cada
   pessoa (CF-Connecting-IP), e não a mesa inteira como uma só.
   Liga o server.js de verdade (com os limites), numa pasta temporária. */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { quemPede } = require('../../servidor/api.js');

let falhas = 0;
const ok = (c, t) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + t); if (!c) falhas++; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---- quemPede, direto ---- */
const pedido = (remoto, cabecalho) => ({ socket: { remoteAddress: remoto }, headers: cabecalho ? { 'cf-connecting-ip': cabecalho } : {} });
ok(quemPede(pedido('127.0.0.1', '203.0.113.7')) === '203.0.113.7', 'pelo túnel (conexão do próprio computador): vale o endereço que o Cloudflare informa');
ok(quemPede(pedido('::ffff:127.0.0.1', '2001:db8::1')) === '2001:db8::1', '…também em IPv6');
ok(quemPede(pedido('192.168.0.20', '203.0.113.7')) === '192.168.0.20', 'conexão direta de outra máquina: o cabeçalho é ignorado (ela poderia inventá-lo)');
ok(quemPede(pedido('127.0.0.1')) === '127.0.0.1', 'sem túnel, no próprio computador: o endereço da conexão');

/* ---- o servidor de verdade ---- */
(async function () {
  const PORTA = 3995;
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'plainus-tunel-'));
  const servidor = spawn(process.execPath, [path.join(__dirname, '..', '..', 'server.js')], {
    env: Object.assign({}, process.env, { PORT: String(PORTA), DATA_DIR: pasta, PLAINUS_ROTAS_DE_TESTE: '' }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let fala = '';
  servidor.stdout.on('data', (d) => { fala += d; });
  process.on('exit', () => { try { servidor.kill(); } catch (e) { /* já saiu */ } });
  for (let i = 0; i < 60 && !fala.includes('no ar'); i++) await espera(100);

  const tentar = (ip) => fetch('http://127.0.0.1:' + PORTA + '/api/mestre', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify({ codigo: 'AAAA-BBBB-CCCC', senha: 'chute' })
  }).then((r) => r.status);

  const ana = [];
  for (let i = 0; i < 6; i++) ana.push(await tentar('203.0.113.7'));
  ok(ana.slice(0, 5).every((s) => s === 403) && ana[5] === 429, 'a 6ª tentativa no minuto, da mesma pessoa: barrada (' + ana.join(', ') + ')');
  ok(await tentar('198.51.100.9') === 403, '…mas outra pessoa, pelo mesmo túnel, continua podendo tentar');

  /* Espera o servidor SAIR antes de apagar a pasta dele: no Windows,
     apagar uma pasta que outro processo ainda está largando dá EBUSY —
     e o teste falhava depois de todas as verificações darem certo. */
  const saiu = new Promise((r) => (servidor.exitCode !== null ? r() : servidor.once('exit', r)));
  servidor.kill();
  await saiu;
  fs.rmSync(pasta, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  console.log(falhas ? falhas + ' FALHAS' : '\nTúnel certo.');
  /* exitCode, e não process.exit(): no Windows, sair à força enquanto as
     conexões do fetch ainda estão fechando derruba o Node com
     "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)" — o teste
     falhava DEPOIS de tudo dar certo. Assim o Node sai sozinho, quando
     elas fecham. */
  process.exitCode = falhas ? 1 : 0;
})();
