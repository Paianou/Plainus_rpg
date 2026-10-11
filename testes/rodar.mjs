/* ===================================================================
   testes/rodar.mjs — roda os testes do site e mostra o resumo

   COMO USAR (na pasta minha-mesa):
     node testes/rodar.mjs              tudo: os testes no Node + o navegador
     node testes/rodar.mjs node         só os testes no Node (segundos)
     node testes/rodar.mjs 08 15        só os roteiros que começam com 08 e 15
     node testes/rodar.mjs dados        só os roteiros com "dados" no nome

   AS FAMÍLIAS DE TESTE
     testes/acoes/*.test.cjs     o acoes.js direto no Node, sem navegador —
                                 do mesmo jeito que o servidor o usa.
     testes/servidor/*.test.cjs  as peças do servidor (servidor/*.js).
     testes/roteiros/*.mjs       o site de verdade num Edge sem janela,
                                 clicando como as pessoas clicam (base.mjs).
                                 Cada roteiro liga o próprio servidor, na
                                 porta 3999, com as campanhas numa pasta só
                                 dele (testes/saida/<roteiro>/dados) — a
                                 data/ de verdade nunca é tocada.

   Cada roteiro imprime uma linha por verificação ("OK" ou "FALHA") e,
   no fim, "ERROS DE JS: nenhum" — erro de JavaScript na página conta
   como falha, mesmo que todas as verificações tenham passado.

   O que é gerado (fotos de tela, downloads, perfil do navegador) vai
   para testes/saida/, que o Git ignora. As fotos ajudam a ver o que o
   teste viu: testes/saida/<roteiro>/fotos/.
   =================================================================== */
import { spawn, spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TESTES = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.dirname(TESTES);
const SAIDA = path.join(TESTES, 'saida');
const LIMITE_ROTEIRO = 10 * 60 * 1000;   /* o mais longo (o do chat) leva uns 3 minutos */

const filtros = process.argv.slice(2);
/* 'acoes' era o nome antigo deste atalho; continua valendo. */
const soNode = filtros.length === 1 && (filtros[0] === 'node' || filtros[0] === 'acoes');
const quer = (nome) => !filtros.length || filtros.some((f) => nome.startsWith(f) || nome.includes(f));


/* ---------- O navegador ---------- */

function acharNavegador() {
  if (process.env.PLAINUS_NAVEGADOR) return process.env.PLAINUS_NAVEGADOR;
  const candidatos = [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/microsoft-edge', '/usr/bin/google-chrome', '/usr/bin/chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ];
  return candidatos.find((c) => existsSync(c)) || null;
}

/* Um roteiro que trava deixa o navegador aberto — e ele segura a porta
   9333, derrubando o roteiro seguinte. Fecha quem estiver usando o
   perfil de testes. */
function fecharNavegadorDosTestes() {
  /* Só processos do NAVEGADOR: sem esse filtro, o próprio PowerShell
     que faz a busca tem o padrão na linha de comando e se encerra no
     meio do caminho. */
  if (process.platform === 'win32') {
    spawnSync('powershell', ['-NoProfile', '-Command',
      "Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'msedge.exe' -or $_.Name -eq 'chrome.exe') -and $_.CommandLine -like '*testes*saida*perfil*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"],
      { stdio: 'ignore' });
  } else {
    spawnSync('pkill', ['-f', '(msedge|chrome|chromium).*testes/saida/.*/perfil'], { stdio: 'ignore' });
  }
}


/* ---------- Rodar um arquivo e contar ---------- */

function rodar(arquivo, ambiente) {
  return new Promise((resolve) => {
    const filho = spawn(process.execPath, [arquivo], { env: Object.assign({}, process.env, ambiente) });
    let saida = '';
    filho.stdout.on('data', (d) => { saida += d; });
    filho.stderr.on('data', (d) => { saida += d; });
    const relogio = setTimeout(() => { saida += '\n[parado: passou de ' + LIMITE_ROTEIRO / 60000 + ' minutos]'; filho.kill(); }, LIMITE_ROTEIRO);
    filho.on('close', (codigo) => { clearTimeout(relogio); resolve({ codigo, saida }); });
  });
}

function resumo(saida) {
  const linhas = saida.split('\n');
  return {
    ok: linhas.filter((l) => l.startsWith('OK')).length,
    falhas: linhas.filter((l) => l.startsWith('FALHA')),
    semErroDeJs: /ERROS DE JS: nenhum/.test(saida)
  };
}

const resultados = [];
const mostrar = (nome, r, extra) => {
  const certo = !r.falhas.length && r.codigo === 0 && (extra === undefined || extra);
  console.log((certo ? '  ✔ ' : '  ✘ ') + nome.padEnd(46) + String(r.ok).padStart(3) + ' ok' + (r.falhas.length ? '  ' + r.falhas.length + ' falha(s)' : ''));
  resultados.push(certo);
  return certo;
};


/* ---------- 1. Os testes no Node (sem navegador) ---------- */

if (soNode || !filtros.length) {
  for (const [pasta, titulo] of [['acoes', 'acoes.js no Node'], ['servidor', 'O servidor por dentro']]) {
    const dir = path.join(TESTES, pasta);
    if (!existsSync(dir)) continue;
    console.log('\n' + titulo);
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.test.cjs')).sort()) {
      const r = await rodar(path.join(dir, f), {});
      const conta = resumo(r.saida);
      if (!mostrar(f.replace('.test.cjs', ''), Object.assign({ codigo: r.codigo }, conta))) {
        console.log(r.saida.split('\n').filter((l) => !l.startsWith('OK')).map((l) => '      ' + l).join('\n'));
      }
    }
  }
}


/* ---------- 2. O site no navegador ---------- */

if (!soNode) {
  const navegador = acharNavegador();
  const base = readFileSync(path.join(TESTES, 'base.mjs'), 'utf8');
  const roteiros = readdirSync(path.join(TESTES, 'roteiros')).filter((f) => f.endsWith('.mjs')).sort()
    .filter((f) => quer(f.replace('.mjs', '')));

  if (!navegador) {
    console.log('\nNão achei o Edge nem o Chrome. Diga onde está: PLAINUS_NAVEGADOR=caminho/do/navegador');
    resultados.push(false);
  } else if (roteiros.length) {
    console.log('\nO site no navegador (' + path.basename(navegador) + ')');
    for (const f of roteiros) {
      const nome = f.replace('.mjs', '');
      const pasta = path.join(SAIDA, nome);
      mkdirSync(pasta, { recursive: true });
      /* A base vai colada na frente do roteiro, num arquivo só. */
      const montado = path.join(pasta, 'rodando.mjs');
      writeFileSync(montado, base + '\n\n' + readFileSync(path.join(TESTES, 'roteiros', f), 'utf8'));

      fecharNavegadorDosTestes();
      const inicio = Date.now();
      const r = await rodar(montado, { PLAINUS_RAIZ: RAIZ, PLAINUS_SAIDA: pasta, PLAINUS_NAVEGADOR: navegador });
      fecharNavegadorDosTestes();

      const conta = resumo(r.saida);
      const certo = mostrar(nome + ' (' + Math.round((Date.now() - inicio) / 1000) + 's)', Object.assign({ codigo: r.codigo }, conta), conta.semErroDeJs);
      if (!certo) {
        conta.falhas.forEach((l) => console.log('      ' + l));
        if (!conta.semErroDeJs) {
          const fim = r.saida.trim().split('\n').slice(-8).map((l) => '      | ' + l).join('\n');
          console.log('      não terminou ou teve erro de JavaScript. Últimas linhas:\n' + fim);
        }
      }
    }
  }
}

const falharam = resultados.filter((x) => !x).length;
console.log('\n' + (falharam ? falharam + ' de ' + resultados.length + ' com problema.' : 'Tudo certo: ' + resultados.length + ' de ' + resultados.length + '.'));
process.exit(falharam ? 1 : 0);
