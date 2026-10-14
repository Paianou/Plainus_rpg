/* ===================================================================
   testes/base.mjs — o que todo roteiro do navegador usa

   Não roda sozinho: o testes/rodar.mjs cola esta base na frente de cada
   roteiro (testes/roteiros/*.mjs) e roda o resultado. Por isso os
   roteiros usam js(), ir(), ok(), novaAba()... sem importar nada.

   Como funciona: abre o Edge "headless" (sem janela) e conversa com ele
   pelo Chrome DevTools Protocol (CDP) — o mesmo canal do F12. Por ali
   dá para rodar JavaScript na página, navegar, tirar foto da tela,
   simular mouse e teclado de verdade e abrir uma segunda aba (a do
   jogador, com a própria sessão).

   O SERVIDOR DE CADA ROTEIRO
   Cada roteiro liga o próprio server.js numa porta de teste, com uma
   pasta de campanhas só dele (testes/saida/<roteiro>/dados) — nenhum
   roteiro vê as campanhas do outro, nem as suas de verdade (data/).
   Com PLAINUS_ROTAS_DE_TESTE=1, o servidor ganha as rotas de
   testes/rotas-de-teste.cjs, que a página usa pelo objeto T:
     await T.gravado()      a campanha como o SERVIDOR a tem (depois de
                            as ações a caminho chegarem)
     await T.salvar()       o Mestre: o Estado desta tela vira o oficial
                            (para montar situações sem dezenas de cliques)
     await T.trocar(e, id)  troca a campanha inteira por e

   O executor passa por variáveis de ambiente:
     PLAINUS_RAIZ       a pasta do site (a raiz do repositório)
     PLAINUS_SAIDA      onde vão fotos, downloads e o perfil do navegador
                        (testes/saida, ignorada pelo Git)
     PLAINUS_NAVEGADOR  o executável (Edge ou Chrome), achado sozinho
   =================================================================== */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';

const AQUI = process.env.PLAINUS_SAIDA;
const MESA = process.env.PLAINUS_RAIZ.split(path.sep).join('/').replace(/\/?$/, '/');
const PERFIL = path.join(AQUI, 'perfil');
const DADOS = path.join(AQUI, 'dados');
rmSync(PERFIL, { recursive: true, force: true });
rmSync(DADOS, { recursive: true, force: true });
mkdirSync(path.join(AQUI, 'fotos'), { recursive: true });

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---- o servidor deste roteiro ---- */
const PORTA_TESTE = Number(process.env.PLAINUS_PORTA_TESTE) || 3999;
const SITE = 'http://127.0.0.1:' + PORTA_TESTE + '/';
const url = (f) => SITE + f;
/* O duplo clique (file://), para os roteiros que conferem a página sem servidor. */
const urlArquivo = (f) => 'file:///' + MESA + 'publico/' + f;
/* ligarServidor() de novo depois de servidor.kill(): o roteiro 21 derruba
   e religa o servidor, para ver os painéis reconectarem. */
let servidor = null;
let falaDoServidor = '';
async function ligarServidor() {
  falaDoServidor = '';
  servidor = spawn(process.execPath, [path.join(MESA, 'server.js')], {
    env: Object.assign({}, process.env, { PORT: String(PORTA_TESTE), HOST: '127.0.0.1', DATA_DIR: DADOS, PLAINUS_ESPERA_GRAVAR: '0', PLAINUS_ROTAS_DE_TESTE: '1' }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  servidor.stdout.on('data', (d) => { falaDoServidor += d; });
  servidor.stderr.on('data', (d) => { falaDoServidor += d; });
  for (let i = 0; i < 60 && !falaDoServidor.includes('no ar'); i++) await espera(100);
  if (!falaDoServidor.includes('no ar')) {
    console.log('FALHA o servidor de teste não ligou (a porta ' + PORTA_TESTE + ' está ocupada?): ' + falaDoServidor.slice(0, 300));
    process.exit(1);
  }
}
/* Termine como terminar — até quebrando no meio —, o servidor de teste
   é desligado. Sem isto, ele segura a porta e o próximo roteiro
   conversa com um servidor velho. */
process.on('exit', () => { try { servidor && servidor.kill(); } catch (erro) { /* já tinha saído */ } });
await ligarServidor();

/* O objeto T, posto em toda página antes dos scripts dela (ver o topo). */
const AJUDANTE = `window.T = {
  pedir: function (rota, corpo) { return fetch('/teste/' + rota, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }).then(function (r) { return r.json(); }); },
  id: function (id) { return id || Sessao.ler().campanhaId; },
  calma: async function () {
    for (let i = 0; i < 200; i++) {
      if (typeof Conexao === 'undefined' || (!Conexao.fila.length && !Conexao.pendentes)) return true;
      await new Promise(function (r) { setTimeout(r, 50); });
    }
    return false;
  },
  gravado: async function (id) { await T.calma(); return T.pedir('ler', { campanhaId: T.id(id) }); },
  trocar: async function (estado, id) { await T.calma(); return T.pedir('trocar', { campanhaId: T.id(id), estado: estado }); },
  salvar: function () { return T.trocar(JSON.parse(JSON.stringify(Estado))); }
};`;

/* A página está pronta quando a mesa chegou do servidor (sem o "Abrindo
   a mesa…") e a entrada terminou de pedir os cartões. */
const PRONTA = `document.readyState==='complete' && !document.querySelector('.carregando-mesa') && !window.plainusCarregando`;

/* Uma foto de tela que demore mais que isto é pulada: numa aba em
   segundo plano, o navegador às vezes nunca responde, e o roteiro
   travaria inteiro por causa de uma foto. */
const LIMITE_FOTO = 15000;
const comLimite = (promessa) => Promise.race([promessa, new Promise((r) => setTimeout(() => r(null), LIMITE_FOTO))]);

const edge = spawn(process.env.PLAINUS_NAVEGADOR, [
  '--headless=new', '--remote-debugging-port=9333', '--user-data-dir=' + PERFIL,
  '--window-size=1440,1000', '--no-first-run', 'about:blank'
], { stdio: 'ignore' });

let alvo;
for (let i = 0; i < 40 && !alvo; i++) {
  await espera(250);
  try {
    const lista = await (await fetch('http://127.0.0.1:9333/json')).json();
    alvo = lista.find((t) => t.type === 'page');
  } catch (e) { /* ainda subindo */ }
}
const ws = new WebSocket(alvo.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));

let seq = 0;
const pend = new Map();
const erros = [];
let carregou = null;
ws.addEventListener('message', (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') erros.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') erros.push('console: ' + JSON.stringify(d.params.args.map((a) => a.value)));
  if (d.method === 'Page.loadEventFired' && carregou) { carregou(); carregou = null; }
  if (d.method === 'Page.javascriptDialogOpening') cmd('Page.handleJavaScriptDialog', { accept: true });
});
function cmd(method, params = {}) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((r) => pend.set(id, r));
}
/* Uma expressão com await (T.gravado, T.salvar) roda dentro de uma
   função async — uma só expressão devolve o valor; várias (com ;) não. */
function comAwait(expr) {
  if (!/\bawait\b/.test(expr) || /^\s*\(async/.test(expr)) return expr;
  const limpa = expr.trim().replace(/;$/, '');
  return limpa.includes(';') ? '(async()=>{' + limpa + '})()' : '(async()=>(' + limpa + '))()';
}
async function js(expr) {
  const r = await cmd('Runtime.evaluate', { expression: comAwait(expr), returnByValue: true, awaitPromise: true });
  if (!r.result) throw new Error(expr + ' => o navegador respondeu com erro: ' + JSON.stringify(r.error));
  if (r.result.exceptionDetails) throw new Error(expr + ' => ' + r.result.exceptionDetails.exception?.description);
  return r.result.result.value;
}
/* Uma navegação que não acontece (o botão não levou a lugar nenhum)
   vira uma FALHA com o endereço, em vez de travar o roteiro inteiro. */
const LIMITE_NAVEGAR = 15000;
const comPrazo = (promessa, onde) => {
  let relogio;
  const prazo = new Promise((r) => { relogio = setTimeout(() => { console.log('FALHA a página não trocou em ' + LIMITE_NAVEGAR / 1000 + 's: ' + onde); r(); }, LIMITE_NAVEGAR); });
  return Promise.race([promessa, prazo]).finally(() => clearTimeout(relogio));
};
async function esperarPronta(rodar) {
  for (let i = 0; i < 100; i++) {
    try { if (await rodar(PRONTA)) return; } catch (erro) { /* página trocando */ }
    await espera(100);
  }
}
async function ir(f) {
  const p = new Promise((r) => { carregou = r; });
  await cmd('Page.navigate', { url: /^(file|http)/.test(f) ? f : url(f) });
  await p; await esperarPronta(js); await espera(300);
}
async function clicarENavegar(expr) {
  const p = new Promise((r) => { carregou = r; });
  await js(expr);
  await comPrazo(p, expr.slice(0, 120)); await esperarPronta(js); await espera(300);
}
async function foto(nome) {
  const r = await comLimite(cmd('Page.captureScreenshot', { format: 'png' }));
  if (r) writeFileSync(path.join(AQUI, 'fotos', nome + '.png'), Buffer.from(r.result.data, 'base64'));
}
/* Espera até a expressão dar verdadeiro na página (de `quem`: js, ou aba.js) — em vez de um tempo fixo, que pode ser pouco. */
const aguardar = async (expr, quem, limite) => { for (let i = 0; i < (limite || 80); i++) { try { if (await (quem || js)(expr)) return true; } catch (erro) { /* página trocando */ } await espera(100); } return false; };
const ok = (cond, txt) => console.log((cond ? 'OK   ' : 'FALHA') + ' ' + txt);

await cmd('Page.enable'); await cmd('Runtime.enable');
await cmd('Page.addScriptToEvaluateOnNewDocument', { source: AJUDANTE });

/* ---- uma segunda aba de verdade, com a própria sessão ---- */
async function novaAba() {
  const alvo = await (await fetch('http://127.0.0.1:9333/json/new?about:blank', { method: 'PUT' })).json();
  const s = new WebSocket(alvo.webSocketDebuggerUrl);
  await new Promise((r) => s.addEventListener('open', r));
  let n = 5000; const p = new Map(); let pronto = null;
  s.addEventListener('message', (m) => {
    const d = JSON.parse(m.data);
    if (d.id && p.has(d.id)) { p.get(d.id)(d); p.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') erros.push('aba 2: ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
    if (d.method === 'Page.loadEventFired' && pronto) { pronto(); pronto = null; }
  });
  const c = (method, params = {}) => { const id = ++n; s.send(JSON.stringify({ id, method, params })); return new Promise((r) => p.set(id, r)); };
  await c('Page.enable'); await c('Runtime.enable');
  await c('Page.addScriptToEvaluateOnNewDocument', { source: AJUDANTE });
  const aba = {
    js: async (e) => { const r = await c('Runtime.evaluate', { expression: comAwait(e), returnByValue: true, awaitPromise: true }); if (!r.result) throw new Error(e + ' => o navegador respondeu com erro: ' + JSON.stringify(r.error)); if (r.result.exceptionDetails) throw new Error(e + ' => ' + r.result.exceptionDetails.exception?.description); return r.result.result.value; },
    ir: async (f) => { const w = new Promise((r) => { pronto = r; }); await c('Page.navigate', { url: /^(file|http)/.test(f) ? f : url(f) }); await w; await esperarPronta(aba.js); await espera(300); },
    navegarPor: async (e) => { const w = new Promise((r) => { pronto = r; }); await aba.js(e); await comPrazo(w, e.slice(0, 120)); await esperarPronta(aba.js); await espera(300); },
    foto: async (nome) => { const r = await comLimite(c('Page.captureScreenshot', { format: 'png' })); if (r) writeFileSync(path.join(AQUI, 'fotos', nome + '.png'), Buffer.from(r.result.data, 'base64')); },
    tamanho: async (w, alt) => { await c('Emulation.setDeviceMetricsOverride', { width: w, height: alt || 900, deviceScaleFactor: 1, mobile: w < 600 }); await espera(300); },
    frente: async () => { await c('Page.bringToFront'); },
    emular: async (f) => { await c('Emulation.setEmulatedMedia', { features: f }); },
    fechar: async () => { s.close(); await fetch('http://127.0.0.1:9333/json/close/' + alvo.id).catch(() => {}); }
  };
  return aba;
}
const digita = (sel, valor) => `(()=>{const e=document.querySelector(${JSON.stringify(sel)}); e.value=${JSON.stringify(String(valor))}; e.dispatchEvent(new Event('input',{bubbles:true})); })();`;
