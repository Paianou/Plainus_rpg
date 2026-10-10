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

   O executor passa por variáveis de ambiente:
     PLAINUS_RAIZ       a pasta do site (a raiz do repositório)
     PLAINUS_SAIDA      onde vão fotos, downloads e o perfil do navegador
                        (testes/saida, ignorada pelo Git)
     PLAINUS_NAVEGADOR  o executável (Edge ou Chrome), achado sozinho
   =================================================================== */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const AQUI = process.env.PLAINUS_SAIDA;
const MESA = process.env.PLAINUS_RAIZ.split(path.sep).join('/').replace(/\/?$/, '/');
const url = (f) => 'file:///' + MESA + f;
const PERFIL = path.join(AQUI, 'perfil');
rmSync(PERFIL, { recursive: true, force: true });
mkdirSync(path.join(AQUI, 'fotos'), { recursive: true });

/* Uma foto de tela que demore mais que isto é pulada: numa aba em
   segundo plano, o navegador às vezes nunca responde, e o roteiro
   travaria inteiro por causa de uma foto. */
const LIMITE_FOTO = 15000;
const comLimite = (promessa) => Promise.race([promessa, new Promise((r) => setTimeout(() => r(null), LIMITE_FOTO))]);

const edge = spawn(process.env.PLAINUS_NAVEGADOR, [
  '--headless=new', '--remote-debugging-port=9333', '--user-data-dir=' + PERFIL,
  '--window-size=1440,1000', '--no-first-run', 'about:blank'
], { stdio: 'ignore' });

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
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
async function js(expr) {
  const r = await cmd('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (!r.result) throw new Error(expr + ' => o navegador respondeu com erro: ' + JSON.stringify(r.error));
  if (r.result.exceptionDetails) throw new Error(expr + ' => ' + r.result.exceptionDetails.exception?.description);
  return r.result.result.value;
}
async function ir(f) {
  const p = new Promise((r) => { carregou = r; });
  await cmd('Page.navigate', { url: url(f) });
  await p; await espera(300);
}
async function clicarENavegar(expr) {
  const p = new Promise((r) => { carregou = r; });
  await js(expr);
  await p; await espera(300);
}
async function foto(nome) {
  const r = await comLimite(cmd('Page.captureScreenshot', { format: 'png' }));
  if (r) writeFileSync(path.join(AQUI, 'fotos', nome + '.png'), Buffer.from(r.result.data, 'base64'));
}
const ok = (cond, txt) => console.log((cond ? 'OK   ' : 'FALHA') + ' ' + txt);

await cmd('Page.enable'); await cmd('Runtime.enable');

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
  const aba = {
    js: async (e) => { const r = await c('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (!r.result) throw new Error(e + ' => o navegador respondeu com erro: ' + JSON.stringify(r.error)); if (r.result.exceptionDetails) throw new Error(e + ' => ' + r.result.exceptionDetails.exception?.description); return r.result.result.value; },
    ir: async (f) => { const w = new Promise((r) => { pronto = r; }); await c('Page.navigate', { url: url(f) }); await w; await espera(300); },
    navegarPor: async (e) => { const w = new Promise((r) => { pronto = r; }); await aba.js(e); await w; await espera(300); },
    foto: async (nome) => { const r = await comLimite(c('Page.captureScreenshot', { format: 'png' })); if (r) writeFileSync(path.join(AQUI, 'fotos', nome + '.png'), Buffer.from(r.result.data, 'base64')); },
    tamanho: async (w, alt) => { await c('Emulation.setDeviceMetricsOverride', { width: w, height: alt || 900, deviceScaleFactor: 1, mobile: w < 600 }); await espera(300); },
    frente: async () => { await c('Page.bringToFront'); },
    emular: async (f) => { await c('Emulation.setEmulatedMedia', { features: f }); },
    fechar: async () => { s.close(); await fetch('http://127.0.0.1:9333/json/close/' + alvo.id).catch(() => {}); }
  };
  return aba;
}
const digita = (sel, valor) => `(()=>{const e=document.querySelector(${JSON.stringify(sel)}); e.value=${JSON.stringify(String(valor))}; e.dispatchEvent(new Event('input',{bubbles:true})); })();`;
