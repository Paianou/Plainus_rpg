const dialogos = [];
ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.method === 'Page.javascriptDialogOpening') dialogos.push(d.params.type); });
const tecla = (key, extra) => `document.dispatchEvent(new KeyboardEvent('keydown',Object.assign({key:${JSON.stringify(key)},bubbles:true,cancelable:true},${JSON.stringify(extra || {})})))`;

/* ---- campanha com exemplo ---- */
await ir('index.html');
await js(`document.querySelector('[data-porta="mestrar"]').click(); document.getElementById('nome').value='Thiago'; document.getElementById('campanha').value='Teste melhorias'`);
await clicarENavegar(`document.getElementById('btnCriar').click()`);
await js(`document.getElementById('btnAvancar').click(); document.getElementById('premissa').value='x'; document.getElementById('cenario').value='y'; const b=()=>document.getElementById('btnAvancar').click(); b(); b(); b(); b(); document.querySelector('input[value="exemplo"]').checked=true`);
await clicarENavegar(`document.getElementById('btnAvancar').click()`);
const codigo = await js(`Estado.campanha.codigo`);

const ana = await novaAba();
await ana.tamanho(390, 844);
await ana.ir('index.html');
await ana.js(`document.querySelector('[data-porta="convite"]').click(); document.getElementById('nome').value='Zed'; document.getElementById('codigo').value=${JSON.stringify(codigo)};`);
await ana.navegarPor(`document.getElementById('btnEntrar').click()`);
await ana.js(digita('#f-nome', 'Kael') + digita('#f-raca', 'Humano') + digita('#f-classe', 'Guerreiro'));
await ana.js(`document.querySelector('[data-acao="salvar-ficha"]').click()`);
await espera(1200);
const dentro = `(()=>{const r=document.querySelector('.tour-balao').getBoundingClientRect(); return r.left>=0 && r.right<=innerWidth && r.top>=0 && r.bottom<=innerHeight;})()`;
const fotos = [];
for (let i = 0; i < 6; i++) {
  const t = await ana.js(`document.querySelector('.tour-balao h3')?.textContent`);
  if (!t) break;
  ok(await ana.js(dentro), 'celular, passo "' + t + '": o balão cabe inteiro na tela');
  await ana.foto('c' + (i + 1) + '-tour-celular');
  await ana.js(`document.querySelector('.tour-balao .botao.fantasma').click()`); await espera(400);
}
ok(await ana.js(`document.documentElement.scrollWidth <= 390`), 'celular: sem rolagem de lado');
console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill(); process.exit(0);
