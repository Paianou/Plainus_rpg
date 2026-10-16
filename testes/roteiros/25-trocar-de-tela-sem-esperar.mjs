/* Trocar de tela no painel do Mestre sem o "Abrindo a mesa…".

   Cada tela do Mestre é uma página. Antes, toda troca mostrava o
   "Abrindo a mesa…" enquanto a página nova reconectava e esperava a
   campanha. Agora a aba guarda a última campanha (conexao.js) e a tela
   seguinte se desenha na hora com ela (layout.js) — e se atualiza com
   a oficial quando ela chega.

   Um vigia, posto em cada página ANTES dos scripts dela, anota se o
   "Abrindo" apareceu nem que seja por um instante. */
const VIGIA = `window.__viuAbrindo = false;
new MutationObserver(function () { if (document.querySelector('.carregando-mesa')) window.__viuAbrindo = true; })
  .observe(document, { childList: true, subtree: true });`;   /* document: o <html> ainda não existe a esta altura */
await cmd('Page.addScriptToEvaluateOnNewDocument', { source: VIGIA });

/* ---- primeira abertura nesta aba: o "Abrindo" aparece ---- */
await ir('index.html');
await js(`document.querySelector('[data-porta="mestrar"]').click(); document.getElementById('nome').value='Thiago'; document.getElementById('campanha').value='Troca rápida'`);
await clicarENavegar(`document.getElementById('btnCriar').click()`);
await js(`const b=()=>document.getElementById('btnAvancar').click(); b(); document.getElementById('premissa').value='p'; document.getElementById('cenario').value='c'; b(); b(); b(); b();`);
await clicarENavegar(`document.getElementById('btnAvancar').click()`);
ok(await js(`location.pathname.endsWith('mestre.html') && Estado.campanha.nome==='Troca rápida'`), 'campanha criada: o painel do Mestre abre');
ok(await js(`window.__viuAbrindo === true`), 'primeira abertura nesta aba: o "Abrindo a mesa…" aparece (ainda não há campanha guardada)');
ok(await js(`(()=>{const g=JSON.parse(sessionStorage.getItem('plainus:ultima-campanha')); return !!g && g.campanhaId===Sessao.ler().campanhaId && JSON.parse(g.texto).campanha.nome==='Troca rápida';})()`), 'a aba guarda a última campanha que chegou');

/* ---- trocar de tela pelo menu: sem "Abrindo" ---- */
await clicarENavegar(`document.querySelector('#codice a[href="combate.html"]').click()`);
ok(await js(`location.pathname.endsWith('combate.html')`), 'o menu leva ao Combate');
ok(await js(`window.__viuAbrindo === false`), 'trocando de tela: o "Abrindo a mesa…" NÃO aparece');
ok(await aguardar(`Conexao.entrou === true && Estado.campanha.nome === 'Troca rápida'`), '…e a tela se conecta com a campanha certa');

/* ---- a campanha guardada pode estar velha: a oficial vence ----
   Muda o nome guardado na aba e troca de tela: a página se desenha com
   o nome velho e, quando a oficial chega, volta ao certo. */
await js(`(()=>{const g=JSON.parse(sessionStorage.getItem('plainus:ultima-campanha')); const e=JSON.parse(g.texto); e.campanha.nome='Nome velho'; g.texto=JSON.stringify(e); sessionStorage.setItem('plainus:ultima-campanha', JSON.stringify(g)); return true;})()`);
await clicarENavegar(`document.querySelector('#codice a[href="npcs.html"]').click()`);
ok(await js(`window.__viuAbrindo === false`), 'de novo sem "Abrindo"');
ok(await aguardar(`Conexao.entrou === true && Estado.campanha.nome === 'Troca rápida' && !document.body.textContent.includes('Nome velho')`), 'a campanha guardada estava velha: a oficial chega e a tela se redesenha com ela');

/* ---- a chave não vale mais: a campanha guardada some, e fica o motivo ---- */
await js(`(()=>{const s=Sessao.ler(); s.chave='chave-que-nao-abre-nada-0000000000'; sessionStorage.setItem('plainus:sessao', JSON.stringify(s)); return true;})()`);
await clicarENavegar(`document.querySelector('#codice a[href="mapas.html"]').click()`);
ok(await aguardar(`!!document.querySelector('.tela-restrita') && document.getElementById('app').hidden`), 'chave que não abre: a tela desenhada some e aparece o motivo');
ok(await js(`sessionStorage.getItem('plainus:ultima-campanha') === null`), '…e a campanha guardada é esquecida');

console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill();
process.exit(0);
