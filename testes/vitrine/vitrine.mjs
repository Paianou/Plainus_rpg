/* ===================================================================
   testes/vitrine/vitrine.mjs — a campanha de demonstração e as
   capturas da landing

   COMO RODAR (na pasta minha-mesa):
     node testes/rodar.mjs vitrine

   NÃO É UM TESTE. Usa a mesma base dos roteiros (testes/base.mjs: um
   Edge sem janela, o servidor numa porta de teste, uma pasta de dados
   só dele em testes/saida/vitrine/dados), mas o objetivo é outro:
     1. montar "A Cripta de Valdren", uma campanha bem preenchida;
     2. fotografar a mesa e gravar as capturas em landing/midia/.
   Mora fora de testes/roteiros/ para o npm test de sempre não rodá-la
   (ela escreve arquivos na landing).

   POR QUE UM SCRIPT, E NÃO FOTOS À MÃO
   A mesa vai mudar. Quando mudar, este comando refaz as capturas com
   a mesma campanha, no mesmo enquadramento — a landing nunca fica
   mostrando uma tela velha.

   O MAPA SEM IMAGEM DE FUNDO, de propósito: grade e paredes pintadas
   na própria mesa. Nenhuma arte de terceiros, nenhuma licença a
   conferir. Os monstros são do SRD (Esqueleto, Cultista).

   As suas campanhas de verdade (data/) não são tocadas.
   =================================================================== */

import { readFileSync, readdirSync } from 'node:fs';

const MIDIA = path.join(process.env.PLAINUS_RAIZ, 'landing', 'midia');
mkdirSync(MIDIA, { recursive: true });

/* A captura em WebP (qualidade 82): a mesma nitidez de um PNG com uma
   fração do peso — é o que a landing baixa. */
async function capturar(c, nome) {
  /* Uma segunda tentativa: logo depois de trocar o tamanho da tela, o
     navegador às vezes ainda está redesenhando e a foto não sai. */
  let r = await comLimite(c('Page.captureScreenshot', { format: 'webp', quality: 82 }));
  if (!r) { await espera(1000); r = await comLimite(c('Page.captureScreenshot', { format: 'webp', quality: 82 })); }
  if (r) writeFileSync(path.join(MIDIA, nome + '.webp'), Buffer.from(r.result.data, 'base64'));
  ok(!!r, 'captura: landing/midia/' + nome + '.webp');
}

/* Os avisos flutuantes ("Lyra entrou na mesa") e o tour são da hora,
   não da vitrine: saem antes da foto. */
const LIMPAR = `document.querySelectorAll('.recados, .tour, .tour-fundo').forEach((e) => e.remove())`;

await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
/* Sem a barra de rolagem na foto: ela é do navegador, não da mesa. */
await cmd('Emulation.setScrollbarsHidden', { hidden: true });


/* ---- O Mestre cria a campanha ---- */
await ir('index.html');
/* Uma Mestra de mentira ("Helena"), como os jogadores: a vitrine é
   pública, e não leva o nome de ninguém de verdade. */
await js(`document.getElementById('nome').value='Helena'; document.getElementById('campanha').value='A Cripta de Valdren'`);
await clicarENavegar(`document.getElementById('btnCriar').click()`);
await js(`const b=()=>document.getElementById('btnAvancar').click(); b();
  document.getElementById('premissa').value='Um necromante acordou os mortos sob a abadia de Valdren, e os sinos tocam sozinhos à meia-noite.';
  document.getElementById('cenario').value='Valdren, vila de pedra cinzenta nas montanhas, e as criptas debaixo da abadia.';
  b(); b(); b(); b();`);
await clicarENavegar(`document.getElementById('btnAvancar').click()`);
const codigo = await js(`Estado.campanha.codigo`);
ok(!!codigo, 'campanha criada: ' + codigo);


/* ---- Os quatro jogadores entram e criam os personagens ---- */
/* Os atributos pela compra de pontos (15, 14, 13, 12, 10, 8 = os 27
   pontos), arrumados para cada classe; a arma e a armadura da lista
   da mesa; as magias do SRD. */
const GRUPO = [
  { jogador: 'Ana', nome: 'Lyra', raca: 'Elfa', classe: 'Maga',
    base: { for: 8, des: 14, con: 13, int: 15, sab: 12, car: 10 }, armadura: '', arma: 'Adaga',
    magia: { atributo: 'int', espacos: 2, magias: ['Mísseis Mágicos', 'Raio de Fogo', 'Escudo Arcano'] } },
  { jogador: 'Bruno', nome: 'Borin', raca: 'Anão', classe: 'Guerreiro',
    base: { for: 15, des: 10, con: 14, int: 8, sab: 12, car: 13 }, armadura: 'Cota de Malha', arma: 'Machado de Batalha' },
  { jogador: 'Caio', nome: 'Pip', raca: 'Halfling', classe: 'Ladino',
    base: { for: 8, des: 15, con: 13, int: 12, sab: 10, car: 14 }, armadura: 'Couro Batido', arma: 'Arco Curto' },
  { jogador: 'Duda', nome: 'Ysolde', raca: 'Humana', classe: 'Clériga',
    base: { for: 13, des: 8, con: 14, int: 10, sab: 15, car: 12 }, armadura: 'Cota de Malha', arma: 'Maça',
    magia: { atributo: 'sab', espacos: 2, magias: ['Curar Ferimentos', 'Bênção', 'Palavra Curativa'] } }
];
/* Muda um <select> e avisa a página (o formulário recalcula ao vivo). */
const escolhe = (sel, valor) => `(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return; e.value=${JSON.stringify(valor)}; e.dispatchEvent(new Event('change',{bubbles:true}));})();`;
const abas = [];
for (const p of GRUPO) {
  const aba = await novaAba();
  await aba.tamanho(1440, 900);
  await aba.cmd('Emulation.setScrollbarsHidden', { hidden: true });
  await aba.ir('index.html');
  await aba.js(`document.getElementById('nome').value=${JSON.stringify(p.jogador)}; document.getElementById('codigo').value=${JSON.stringify(codigo)};`);
  await aba.navegarPor(`document.getElementById('btnEntrar').click()`);
  await aba.js(digita('#f-nome', p.nome) + digita('#f-raca', p.raca) + digita('#f-classe', p.classe));
  await aba.js(Object.keys(p.base).map((k) => digita('[data-base="' + k + '"]', p.base[k])).join(''));
  if (p.armadura) await aba.js(escolhe('#f-armadura', p.armadura));
  await aba.js(`document.querySelector('[data-acao="mais-linha"][data-lista="ataques"]').click()`); await espera(200);
  await aba.js(escolhe('[data-ataque="0"] [data-parte="arma"]', p.arma));
  if (p.magia) {
    await aba.js(escolhe('#f-atributoMagia', p.magia.atributo) + digita('[data-espaco="1"]', p.magia.espacos));
    await aba.js(`${JSON.stringify(p.magia.magias)}.forEach((n)=>{const m=document.querySelector('[data-magia="'+n+'"]'); if(m) m.click();})`);
  }
  await aba.js(`document.querySelector('[data-acao="salvar-ficha"]').click()`); await espera(500);
  ok(await aba.js(`!!(Conexao.visao.meuHeroi && Conexao.visao.meuHeroi.ficha.ataques.length)`), p.nome + ': ficha salva, com ataque');
  await aba.js(`(async()=>{for(let i=0;i<20&&!document.querySelector('.tour-pular');i++)await new Promise(r=>setTimeout(r,100));const b=document.querySelector('.tour-pular');if(b)b.click();})()`); await espera(300);
  abas.push(aba);
}
await cmd('Page.bringToFront');
ok(await aguardar(`Estado.herois.length === 4`), 'os quatro personagens estão na campanha');


/* ---- A cena: o Salão dos Ossos, e o grupo nela ---- */
await ir('mapas.html');
await js(`document.querySelector('[data-acao="nova-cena"]').click()`);
await js(`document.getElementById('cenaNome').value='Salão dos Ossos'; document.getElementById('cenaColunas').value='20'; document.getElementById('cenaLinhas').value='12'; document.getElementById('cenaLinhas').dispatchEvent(new Event('input')); document.getElementById('salvarCena').click()`);
await espera(300);
await js(`document.querySelector('[data-acao="trazer-grupo"]').click()`); await espera(500);


/* ---- O resto da campanha, de uma vez (T.trocar: a rota de teste que
   troca a campanha inteira). Paredes, posições, monstros, combate e
   diário — o que levaria dezenas de cliques. ---- */
await js(`(async () => {
  const e = await T.gravado();
  const cena = e.cenas[0];

  /* Paredes: [coluna, linha, largura, altura]. O contorno, uma parede
     no meio com uma passagem, e duas colunas no salão da esquerda. */
  cena.paredes = [
    [0, 0, 20, 1], [0, 11, 20, 1], [0, 0, 1, 12], [19, 0, 1, 12],
    [9, 1, 1, 4], [9, 7, 1, 4],
    [4, 3, 1, 1], [4, 8, 1, 1],
    [14, 1, 1, 2], [14, 9, 1, 2]
  ];

  /* O grupo à esquerda, em volta da passagem. */
  const lugares = [[6, 5], [6, 6], [7, 4], [7, 7]];
  e.herois.forEach((h, i) => {
    const t = cena.tokens.find((x) => x.heroiId === h.id);
    if (t) { t.col = lugares[i][0]; t.lin = lugares[i][1]; }
  });

  /* Os mortos, do outro lado. */
  const monstros = [
    ['Esqueleto', 11, 5], ['Esqueleto', 12, 7], ['Esqueleto', 15, 4], ['Cultista', 17, 6]
  ];
  monstros.forEach((m, i) => cena.tokens.push({ id: 'tv' + i, nome: m[0], inicial: m[0].charAt(0), tipo: 'inimigo', col: m[1], lin: m[2] }));

  /* O combate em andamento, na segunda rodada. */
  const pv = (h) => (typeof h.pvMax === 'number' && h.pvMax > 0 ? h.pvMax : 10);
  e.combate = {
    ativo: true, rodada: 2, encontro: 'Salão dos Ossos', dificuldade: 'Média', nd: '',
    registro: [],
    combatentes: [
      { id: 'c1', heroiId: e.herois[1].id, nome: e.herois[1].nome, tipo: 'heroi', pv: pv(e.herois[1]), pvMax: pv(e.herois[1]), ca: 16, iniciativa: 17, agiu: true, condicoes: [] },
      { id: 'c2', heroiId: null, nome: 'Esqueleto', tipo: 'inimigo', pv: 6, pvMax: 13, ca: 13, iniciativa: 15, agiu: true, condicoes: [] },
      { id: 'c3', heroiId: e.herois[0].id, nome: e.herois[0].nome, tipo: 'heroi', pv: pv(e.herois[0]), pvMax: pv(e.herois[0]), ca: 12, iniciativa: 14, agiu: false, condicoes: [] },
      { id: 'c4', heroiId: null, nome: 'Cultista', tipo: 'inimigo', pv: 9, pvMax: 9, ca: 12, iniciativa: 12, agiu: false, condicoes: [] },
      { id: 'c5', heroiId: e.herois[2].id, nome: e.herois[2].nome, tipo: 'heroi', pv: pv(e.herois[2]), pvMax: pv(e.herois[2]), ca: 14, iniciativa: 11, agiu: false, condicoes: [] },
      { id: 'c6', heroiId: e.herois[3].id, nome: e.herois[3].nome, tipo: 'heroi', pv: pv(e.herois[3]), pvMax: pv(e.herois[3]), ca: 18, iniciativa: 6, agiu: false, condicoes: [] }
    ]
  };

  /* O sistema, sem o nome da marca de terceiros: a landing diz
     "5ª edição" e as fotos dizem o mesmo. */
  e.campanha.sistema = '5ª edição (SRD 5.1)';

  /* O diário das sessões anteriores. */
  e.campanha.sessao = 4;
  e.diario = [
    { id: 'dv1', sessao: 1, data: '2026-09-12', titulo: 'Os sinos de Valdren', resumo: 'O grupo chega à vila e ouve os sinos da abadia tocarem sozinhos à meia-noite.', notas: '', emAberto: false },
    { id: 'dv2', sessao: 2, data: '2026-09-19', titulo: 'O padre que não dormia', resumo: 'O padre Aldric esconde uma chave de ferro e mente sobre a cripta.', notas: '', emAberto: false },
    { id: 'dv3', sessao: 3, data: '2026-09-26', titulo: 'Debaixo da abadia', resumo: 'A escada atrás do altar desce para as criptas. Algo respira lá embaixo.', notas: '', emAberto: false }
  ];

  await T.trocar(e);
})()`);
await espera(800);
ok(await aguardar(`Estado.cenas[0].paredes.length === 10 && Estado.combate.ativo`), 'cena, monstros e combate no lugar');


/* ---- As capturas ---- */

/* 1. O Mestre, na tela de Mapas. */
await ir('mapas.html'); await espera(800);
await js(LIMPAR);
await capturar(cmd, 'mestre');

/* 2. A Lyra (Ana), na ficha. */
const ana = abas[0];
await ana.frente();
await ana.ir('jogador.html'); await espera(800);
await ana.js(`(document.querySelector('.nav-jogador [data-aba="ficha"]') || {}).click?.()`); await espera(500);
await ana.js(LIMPAR);
await capturar(ana.cmd, 'ficha');

/* 3. A Lyra na Mesa (o mapa como o jogador vê). */
await ana.js(`document.querySelector('.nav-jogador [data-aba="mesa"]').click()`); await espera(800);
await ana.js(LIMPAR);
await capturar(ana.cmd, 'jogador-mesa');

/* 4. Mestre e jogador lado a lado: uma página só com as duas fotos,
   fotografada de novo. É o "mesmo momento, nas duas telas". Sem
   legenda desenhada: a legenda é texto da landing (<figcaption>).
   Duas versões: lado a lado (computador) e uma em cima da outra
   (celular — lado a lado, numa tela de 390px, as letras sumiriam). */
const arquivo = (n) => 'file:///' + path.join(MIDIA, n + '.webp').split(path.sep).join('/');
async function montarPar(nome, colunas, largura, altura) {
  const pagina = path.join(AQUI, nome + '.html');
  writeFileSync(pagina, `<!DOCTYPE html><meta charset="utf-8"><style>
    html,body{margin:0;background:#08090b}
    .par{display:grid;grid-template-columns:${colunas};gap:16px;padding:16px}
    img{width:100%;display:block;border:1px solid rgba(255,255,255,.07);border-radius:12px}
  </style><div class="par"><img src="${arquivo('mestre')}"><img src="${arquivo('jogador-mesa')}"></div>`);
  await cmd('Emulation.setDeviceMetricsOverride', { width: largura, height: altura, deviceScaleFactor: 1, mobile: false });
  await ir('file:///' + pagina.split(path.sep).join('/')); await espera(1000);
  await capturar(cmd, nome);
}
/* 1600 de largura: (1600 - 3×16) / 2 = 776 por foto, 16:10 → 485 de
   altura, + 32 de margem. Empilhada: 800 de largura → 768 por foto. */
await montarPar('lado-a-lado', '1fr 1fr', 1600, 517);
await montarPar('lado-a-lado-celular', '1fr', 800, 1008);

/* ---- O backup, para gravar o vídeo no seu navegador ----
   Restaurado na tela de entrada, ele faz de você o Mestre; e quem entra
   com o código e o nome de um jogador ("Ana") recupera o personagem.
   Fica em testes/saida/ (fora do Git). Sem o bloco de acessos: backup
   não leva chave de ninguém. */
const pastaCampanhas = path.join(DADOS, 'campanhas');
const guardada = JSON.parse(readFileSync(path.join(pastaCampanhas, readdirSync(pastaCampanhas)[0]), 'utf8'));
const backup = JSON.stringify({ formato: guardada.formato, versao: guardada.versao, exportadoEm: new Date().toISOString(), estado: guardada.estado });
const arquivoBackup = path.join(AQUI, 'a-cripta-de-valdren.json');
writeFileSync(arquivoBackup, backup);

/* ---- O vídeo: a mesa em uso, nas duas telas ao mesmo tempo ----
   Sem programa de vídeo instalado: quem grava é o próprio navegador.
     1. As duas telas (Mestre e Ana) são fotografadas juntas, várias
        vezes por segundo, enquanto o script joga: o Mestre move um
        esqueleto, a Lyra anda duas casas e ataca (o d20 cai na tela).
     2. Uma página monta as fotos lado a lado num <canvas> e o
        MediaRecorder grava o <canvas> em vídeo WebM, no ritmo em que
        as fotos foram tiradas.
   O resultado: landing/midia/mesa.webm (e .mp4, se o navegador souber
   gravar MP4 — o Safari do iPhone não toca WebM antigo). */
/* (a Ana é a mesma aba das capturas: abas[0]) */
await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await ir('mapas.html'); await espera(600); await js(LIMPAR);
await ana.ir('jogador.html'); await espera(600);
await ana.js(`document.querySelector('.nav-jogador [data-aba="mesa"]').click()`); await espera(800); await ana.js(LIMPAR);
/* As duas abas "na frente" ao mesmo tempo: sem isto, a de trás fica
   escondida (document.hidden) e o navegador para as animações dela. */
await cmd('Emulation.setFocusEmulationEnabled', { enabled: true });
await ana.cmd('Emulation.setFocusEmulationEnabled', { enabled: true });

const quadros = [];
let gravando = true;
const ESCALA = 0.54;   /* 1440 × 900 → 778 × 486, metade da largura do vídeo */
const tirar = (c) => c('Page.captureScreenshot', { format: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: 1440, height: 900, scale: ESCALA } });
const fotografando = (async () => {
  while (gravando) {
    const t = Date.now();
    const [a, b] = await Promise.all([tirar(cmd), tirar(ana.cmd)]);
    if (a && a.result && b && b.result) quadros.push({ t: t, a: a.result.data, b: b.result.data });
  }
})();

/* O roteiro, com o tempo de cada passo. */
const cenaId = await js(`Estado.cenas[0].id`);
await espera(900);
await js(`Acoes.executar('moverToken', { cenaId: ${JSON.stringify(cenaId)}, id: 'tv0', col: 10, lin: 5 })`);
await espera(1300);
await ana.js(`enviarMeuToken(7, 5); Jogador.render()`);
await espera(700);
await ana.js(`enviarMeuToken(8, 5); Jogador.render()`);
await espera(1100);
await ana.js(`document.querySelector('[data-acao="atacar"]').click()`);
await espera(4200);
gravando = false;
await fotografando;
const duracao = (quadros[quadros.length - 1].t - quadros[0].t) / 1000;
ok(quadros.length > 20, 'vídeo: ' + quadros.length + ' quadros em ' + duracao.toFixed(1) + ' s');

/* A montagem e a gravação, numa página em branco. */
await ir('about:blank');
/* Duas montagens: lado a lado (1600 × 517) e empilhada (800 × 1008,
   para o celular — lado a lado, numa tela de 390px, nada se lê). */
const MONTAR = `(async (quadros, tipo, empilhado) => {
  const W = empilhado ? 800 : 1600, H = empilhado ? 1008 : 517;
  const L = empilhado ? 768 : 776, A = empilhado ? 480 : 485;
  const xb = empilhado ? 16 : 808, yb = empilhado ? 512 : 16;
  const c = document.createElement('canvas'); c.width = W; c.height = H; document.body.append(c);
  const g = c.getContext('2d');
  const carregar = (b64) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/jpeg;base64,' + b64; });
  const imgs = [];
  for (const q of quadros) imgs.push({ t: q.t, a: await carregar(q.a), b: await carregar(q.b) });
  const desenhar = (q) => {
    g.fillStyle = '#08090b'; g.fillRect(0, 0, W, H);
    g.drawImage(q.a, 16, 16, L, A); g.drawImage(q.b, xb, yb, L, A);
    g.strokeStyle = 'rgba(255,255,255,.07)'; g.strokeRect(16.5, 16.5, L - 1, A - 1); g.strokeRect(xb + 0.5, yb + 0.5, L - 1, A - 1);
  };
  if (!MediaRecorder.isTypeSupported(tipo)) return null;
  const rec = new MediaRecorder(c.captureStream(30), { mimeType: tipo, videoBitsPerSecond: 8000000 });
  const partes = []; rec.ondataavailable = (e) => { if (e.data.size) partes.push(e.data); };
  const fim = new Promise((r) => { rec.onstop = r; });
  desenhar(imgs[0]); rec.start();
  const t0 = performance.now();
  for (const q of imgs) {
    while (performance.now() - t0 < q.t - imgs[0].t) await new Promise((r) => requestAnimationFrame(r));
    desenhar(q);
  }
  await new Promise((r) => setTimeout(r, 400));
  rec.stop(); await fim;
  const blob = new Blob(partes, { type: tipo.split(';')[0] });
  return await new Promise((r) => { const f = new FileReader(); f.onload = () => r(String(f.result).split(',')[1]); f.readAsDataURL(blob); });
})`;
const VERSOES = [
  ['video/webm;codecs=vp9', 'mesa.webm', false], ['video/mp4;codecs=avc1.42E01E', 'mesa.mp4', false],
  ['video/webm;codecs=vp9', 'mesa-celular.webm', true], ['video/mp4;codecs=avc1.42E01E', 'mesa-celular.mp4', true]
];
for (const [tipo, nome, empilhado] of VERSOES) {
  const r = await cmd('Runtime.evaluate', { expression: MONTAR + '(' + JSON.stringify(quadros) + ',' + JSON.stringify(tipo) + ',' + empilhado + ')', awaitPromise: true, returnByValue: true });
  const dados = r.result && r.result.result && r.result.result.value;
  if (dados) {
    writeFileSync(path.join(MIDIA, nome), Buffer.from(dados, 'base64'));
    ok(true, 'vídeo: landing/midia/' + nome + ' (' + Math.round(Buffer.from(dados, 'base64').length / 1024) + ' KB)');
  } else {
    console.log('(este navegador não grava ' + tipo + ' — ' + nome + ' fica de fora)');
  }
}


/* Confere o caminho inteiro, como o vídeo vai usar: restaurar e entrar. */
await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await ir('index.html');
const restaurado = await js(`Backup.restaurar(new File([${JSON.stringify(backup)}], 'a-cripta-de-valdren.json')).then((r) => ({ ok: r.ok, codigo: r.codigo, erro: r.erro }))`);
ok(restaurado.ok, 'o backup restaura' + (restaurado.erro ? ': ' + restaurado.erro : ''));
const nova = await novaAba();
await nova.ir('index.html');
await nova.js(`document.getElementById('nome').value='Ana'; document.getElementById('codigo').value=${JSON.stringify(restaurado.codigo)};`);
await nova.navegarPor(`document.getElementById('btnEntrar').click()`);
ok(await aguardar(`!!(Conexao.visao && Conexao.visao.meuHeroi && Conexao.visao.meuHeroi.nome === 'Lyra')`, nova.js), 'quem entra como Ana recupera a Lyra');
await nova.fechar();
console.log('Backup para o vídeo: ' + arquivoBackup);

for (const aba of abas) await aba.fechar();
console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill(); process.exit(0);
