/* ---- campanha vazia, com as regras de personagem ---- */
await ir('index.html');
await js(`document.getElementById('nome').value='Thiago'; document.getElementById('campanha').value='Mesa dos jogadores'`);
await clicarENavegar(`document.getElementById('btnCriar').click()`);
await js(`const b=()=>document.getElementById('btnAvancar').click(); b(); document.getElementById('premissa').value='p'; document.getElementById('cenario').value='c'; b(); b();`);
ok(await js(`!document.querySelector('section[data-passo="4"]').hidden && document.getElementById('metodoAtributos').options.length===4`), 'etapa Personagens aparece com os 4 métodos');
await js(`document.getElementById('metodoAtributos').value='compra'; document.getElementById('metodoPv').value='media'; document.getElementById('multiclasse').checked=true; document.getElementById('btnAvancar').click(); document.getElementById('btnAvancar').click();`);
ok(await js(`[...document.querySelectorAll('#resumoCampanha dd')].some(d=>d.textContent==='Compra de pontos (27)') && [...document.querySelectorAll('#resumoCampanha dd')].some(d=>d.textContent==='Permitido')`), 'resumo mostra as regras com texto legível');
await clicarENavegar(`document.getElementById('btnAvancar').click()`);
ok(await js(`JSON.stringify(Estado.campanha.regrasPersonagem)`) === '{"atributos":"compra","pv":"media","talentos":true,"multiclasse":true}', 'regras gravadas na campanha');
const codigo = await js(`Estado.campanha.codigo`);

/* ---- jogadora Ana entra e cria a ficha ---- */
await clicarENavegar(`document.querySelector('[data-acao="sair"]').click()`);
await js(`document.getElementById('nome').value='Ana'; document.getElementById('codigo').value=${JSON.stringify(codigo)};`);
await clicarENavegar(`document.getElementById('btnEntrar').click()`);
ok(await js(`location.pathname.endsWith('jogador.html') && !document.getElementById('app').hidden && !!document.getElementById('formFicha')`), 'jogador cai no painel, no formulário de criar');
ok(await js(`!!document.getElementById('f-classe2')`), 'segunda classe aparece (campanha permite multiclasse)');
ok(await js(`document.querySelector('.contador-pontos strong').textContent==='0 de 27'`), 'compra de pontos começa em 0 de 27 (tudo 8)');

await js(digita('#f-nome', 'Lyra') + digita('#f-raca', 'Elfa') + digita('#f-classe', 'Maga'));
ok(await js(`document.getElementById('f-dadoVida').value`) === '6', 'escrever "Maga" sugere d6');
const bases = { for: 8, des: 14, con: 13, int: 15, sab: 12, car: 10 };
for (const k in bases) await js(digita('[data-base="' + k + '"]', bases[k]));
await js(digita('[data-bonus="des"]', 2) + digita('[data-bonus="int"]', 1));
await js(`document.querySelector('[data-pericia="Arcanismo"]').click(); document.querySelector('[data-salva="int"]').click();`);
ok(await js(`document.querySelector('.contador-pontos strong').textContent==='27 de 27'`), 'contador marca 27 de 27');
ok(await js(`document.querySelector('[data-calc="ca"]').textContent==='13' && document.querySelector('[data-calc="pv"]').textContent==='7' && document.querySelector('[data-calc="pericia-Arcanismo"]').textContent==='+5'`), 'resumo ao vivo: CA 13, PV 7, Arcanismo +5');
await foto('j1-formulario');
await js(digita('[data-base="for"]', 9));
await js(`document.querySelector('[data-acao="salvar-ficha"]').click()`);
ok(await js(`[...document.querySelectorAll('.recado-flutuante.erro')].some(r=>r.textContent.includes('28 pontos'))`), 'passar de 27 pontos é recusado');
await js(digita('[data-base="for"]', 8));
await js(`document.querySelector('[data-acao="salvar-ficha"]').click()`);
await espera(200);
ok(await js(`!document.getElementById('formFicha') && document.querySelector('.nome-ficha').textContent==='Lyra'`), 'ficha criada e mostrada em leitura');
ok(await js(`(()=>{const h=Campanhas.lerEstado(Sessao.ler().campanhaId).herois[0]; return h.nome==='Lyra' && h.jogador==='Ana' && h.dono===Sessao.ler().jogadorId && h.pv===7 && h.pvMax===7 && h.ca===13 && h.pp===11;})()`), 'herói gravado com dono, jogador e resumo (PV 7, CA 13, PP 11)');
await foto('j2-ficha');

/* subir de nível com a vida cheia: continua cheio */
await js(`document.querySelector('[data-acao="editar"]').click()`);
await js(digita('#f-nivel', 3));
await js(`document.querySelector('[data-acao="salvar-ficha"]').click()`); await espera(200);
ok(await js(`(()=>{const h=Estado.herois[0]; return h.nivel===3 && h.pvMax===17 && h.pv===17;})()`), 'nível 3: PV 7 + 2×(4+1) = 17, e continua cheio');

/* ---- o Mestre vê, e o jogador não entra no painel do Mestre ---- */
await ir('mestre.html');
ok(await js(`document.querySelector('.tela-restrita a')?.getAttribute('href')==='jogador.html'`), 'jogador no painel do Mestre: barrado, com link para o painel dele');

/* duas abas: mestre aberto enquanto o jogador muda a ficha */
await ir('index.html');
const tabMestre = await (await fetch('http://127.0.0.1:9333/json/new?about:blank', { method: 'PUT' })).json();
const ws2 = new WebSocket(tabMestre.webSocketDebuggerUrl);
await new Promise((r) => ws2.addEventListener('open', r));
let seq2 = 1000; const pend2 = new Map();
ws2.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && pend2.has(d.id)) { pend2.get(d.id)(d); pend2.delete(d.id); } if (d.method === 'Runtime.exceptionThrown') erros.push('aba mestre: ' + d.params.exceptionDetails.exception?.description); });
const cmd2 = (method, params = {}) => { const id = ++seq2; ws2.send(JSON.stringify({ id, method, params })); return new Promise((r) => pend2.set(id, r)); };
const js2 = async (e) => (await cmd2('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.result.value;
await cmd2('Runtime.enable');
/* a aba 1 vira Mestre de novo, a aba 2 abre o painel */
const idCamp = await js(`Sessao.ler().campanhaId`);
await js(`Sessao.gravar({papel:'mestre', campanhaId:${JSON.stringify(idCamp)}})`);
await cmd2('Page.enable'); await cmd2('Page.navigate', { url: url('index.html') }); await espera(800);
await js2(`Sessao.gravar({papel:'mestre', campanhaId:${JSON.stringify(idCamp)}})`);
await cmd2('Page.navigate', { url: url('mestre.html') }); await espera(1200);
ok(await js2(`document.querySelectorAll('article.heroi').length`) === 1 && await js2(`!document.querySelector('.heroi-topo .pilula')`), 'Mestre vê Lyra, sem pílula de estado vazia');
/* aba 1 vira jogador e muda o nome do personagem */
const idAna = await js(`Campanhas.lerEstado(${JSON.stringify(idCamp)}).herois[0].dono`);
await js(`Sessao.gravar({papel:'jogador', campanhaId:${JSON.stringify(idCamp)}, nome:'Ana', jogadorId:${JSON.stringify(idAna)}})`);
await ir('jogador.html');
await js(`document.querySelector('[data-acao="editar"]').click()`);
await js(digita('#f-nome', 'Lyra Lunar'));
await js(`document.querySelector('[data-acao="salvar-ficha"]').click()`); await espera(800);
ok(await js2(`document.querySelector('article.heroi .nome').textContent`) === 'Lyra Lunar', 'aba do Mestre se atualiza sozinha quando o jogador salva');
/* e o mestre, agindo depois, não apaga a mudança do jogador */
await js2(`document.querySelector('[data-faces="20"]').click()`); await espera(300);
ok(await js(`Campanhas.lerEstado(${JSON.stringify(idCamp)}).herois[0].nome==='Lyra Lunar'`), 'ação do Mestre depois não apaga a ficha do jogador');
await cmd2('Page.close').catch(() => {}); ws2.close();
await fetch('http://127.0.0.1:9333/json/close/' + tabMestre.id).catch(() => {});

/* ---- Ana volta com o nome em minúsculas: mesma ficha ---- */
await js(`Sessao.limpar()`);
await ir('index.html');
await js(`document.getElementById('nome').value='ana'; document.getElementById('codigo').value=${JSON.stringify(codigo)};`);
await clicarENavegar(`document.getElementById('btnEntrar').click()`);
ok(await js(`document.querySelector('.nome-ficha')?.textContent==='Lyra Lunar'`), 'Ana volta (nome em minúsculas) e cai na própria ficha');

/* ---- Bruno: outro jogador, vê Lyra na party ---- */
await clicarENavegar(`document.querySelector('[data-acao="sair"]').click()`);
await js(`document.getElementById('nome').value='Bruno'; document.getElementById('codigo').value=${JSON.stringify(codigo)};`);
await clicarENavegar(`document.getElementById('btnEntrar').click()`);
ok(await js(`!!document.getElementById('formFicha') && [...document.querySelectorAll('.companheiro .nome')].some(n=>n.textContent==='Lyra Lunar')`), 'novo jogador cria ficha e já vê Lyra na party');
ok(await js(`(()=>{const v=visaoDoJogador(Estado, Sessao.ler().jogadorId); return v.segredos.every(x=>!('ligadoA' in x)) && !('npcs' in v) && !('pendencias' in v);})()`), 'visão do jogador: só segredos revelados, sem lista de NPCs nem pendências');

/* ---- método rolagem + PV rolado ---- */
await js(`(()=>{const id=Sessao.ler().campanhaId; const e=Campanhas.lerEstado(id); e.campanha.regrasPersonagem={atributos:'rolagem',pv:'rolado',talentos:false,multiclasse:false}; Campanhas.salvarEstado(id,e);})()`);
await ir('jogador.html');
ok(await js(`!document.getElementById('f-classe2') && !document.getElementById('f-talentos') && !!document.querySelector('[data-acao="rolar-atributos"]')`), 'regras novas: sem multiclasse, sem talentos, com botão de rolar');
await js(`document.querySelector('[data-acao="rolar-atributos"]').click()`);
const rolados = await js(`JSON.stringify(Jogador.rascunho.ficha.rolados)`);
ok(await js(`Jogador.rascunho.ficha.rolados.length===6 && document.querySelector('[data-acao="rolar-atributos"]').disabled`), 'rolou 6 valores, botão travado ' + rolados);
await js(digita('#f-nome', 'Brom') + digita('#f-raca', 'Anão') + digita('#f-classe', 'Guerreiro'));
await js(`document.querySelector('[data-acao="rolar-pv"]').click()`);
ok(await js(`Number(document.getElementById('f-pvRolado').value) > 0`), 'rolar PV preenche o campo');
await js(digita('[data-base="for"]', 20));
await js(`document.querySelector('[data-acao="salvar-ficha"]').click()`);
ok(await js(`[...document.querySelectorAll('.recado-flutuante.erro')].some(r=>r.textContent.includes('que você rolou'))`), 'valor fora do que foi rolado é recusado');
await js(digita('[data-base="for"]', `Jogador.rascunho.ficha.rolados[0]`).replace(`"Jogador.rascunho.ficha.rolados[0]"`, `Jogador.rascunho.ficha.rolados[0]`));
await js(`document.querySelector('[data-acao="salvar-ficha"]').click()`); await espera(200);
ok(await js(`document.querySelector('.nome-ficha')?.textContent==='Brom' && Estado.herois.length===2`), 'Brom criado com atributos rolados');

/* ---- o Mestre no painel do jogador ---- */
await js(`Sessao.gravar({papel:'mestre', campanhaId:Sessao.ler().campanhaId})`);
await ir('jogador.html');
ok(await js(`document.querySelector('.tela-restrita a')?.getAttribute('href')==='mestre.html'`), 'Mestre no painel do jogador: barrado, com link para o painel dele');
await ir('combate.html');
await js(`document.querySelector('[data-acao="add-party"]').click()`);
ok(await js(`Estado.combate.combatentes.filter(c=>c.heroiId).length===2`), 'Trazer a party leva os dois personagens para o combate');

await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await js(`Sessao.gravar({papel:'jogador', campanhaId:Sessao.ler().campanhaId, nome:'Ana', jogadorId:${JSON.stringify(idAna)}})`);
await ir('jogador.html');
ok(await js(`document.documentElement.scrollWidth <= 390`), 'ficha sem rolagem lateral no celular');
await foto('j3-celular-ficha');
await js(`document.querySelector('[data-acao="editar"]').click()`);
ok(await js(`document.documentElement.scrollWidth <= 390`), 'formulário sem rolagem lateral no celular');
await foto('j4-celular-form');

console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill();
process.exit(0);
