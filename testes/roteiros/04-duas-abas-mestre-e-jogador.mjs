/* ---- ABA 1 = Mestre: campanha com o exemplo de Valkoria ---- */
await ir('index.html');
await js(`document.getElementById('nome').value='Thiago'; document.getElementById('campanha').value='Valkoria de teste'`);
await clicarENavegar(`document.getElementById('btnCriar').click()`);
await js(`const b=()=>document.getElementById('btnAvancar').click(); b(); document.getElementById('premissa').value='Um rei morto volta.'; document.getElementById('cenario').value='Valkoria'; b(); b(); b(); b(); document.querySelector('input[value="exemplo"]').checked=true;`);
await clicarENavegar(`document.getElementById('btnAvancar').click()`);
ok(await js(`location.pathname.endsWith('mestre.html') && document.querySelectorAll('article.heroi').length===4`), 'Mestre na aba 1, campanha com exemplo');
const codigo = await js(`Estado.campanha.codigo`);

/* ---- ABA 2 = Ana, jogadora ---- */
const ana = await novaAba();
await ana.ir('index.html');
await ana.js(`document.getElementById('nome').value='Ana'; document.getElementById('codigo').value=${JSON.stringify(codigo)};`);
await ana.navegarPor(`document.getElementById('btnEntrar').click()`);
ok(await ana.js(`location.pathname.endsWith('jogador.html') && !!document.getElementById('formFicha')`), 'Ana entra na aba 2');
ok(await js(`Sessao.ler().papel`) === 'mestre', 'a aba do Mestre continua Mestre depois que a Ana entrou (sessão por aba)');

await ana.js(digita('#f-nome', 'Lyra') + digita('#f-raca', 'Elfa') + digita('#f-classe', 'Maga') + digita('[data-base="int"]', 15));
await ana.js(`document.querySelector('[data-pericia="Arcanismo"]').click(); document.querySelector('[data-acao="salvar-ficha"]').click();`);
await espera(600);
ok(await ana.js(`document.querySelector('.nome-ficha')?.textContent==='Lyra'`), 'Lyra criada');
ok(await js(`Estado.herois.length===5 && document.querySelectorAll('article.heroi').length===5`), 'aba do Mestre ganhou a Lyra sozinha');

/* ---- Mestre: Lyra no combate, e é a vez dela ---- */
await ir('combate.html');
await js(`document.querySelector('[data-acao="add-party"]').click()`);
const lyraId = await js(`Estado.herois.find(h=>h.nome==='Lyra').id`);
await js(`Estado.combate.combatentes.forEach(c=>{ c.agiu = c.heroiId !== ${JSON.stringify(lyraId)}; }); Memoria.salvar(); Combate.render();`);
ok(await js(`Campanhas.lerEstado(Sessao.ler().campanhaId).combate.combatentes.some(c=>c.heroiId===${JSON.stringify(lyraId)})`), 'Mestre gravou o combate (a sessão dele não foi trocada)');
await espera(600);

/* ---- Ana vê a mesa ---- */
ok(await ana.js(`[...document.querySelectorAll('.nav-jogador .codice-link')].some(a=>a.textContent.includes('Sua vez'))`), 'aba Mesa da Ana acende "Sua vez" sem recarregar');
await ana.js(`document.querySelector('[data-aba="mesa"]').click()`);
ok(await ana.js(`!!document.querySelector('.sua-vez') && !!document.querySelector('.mapa-jogador svg')`), 'aba Mesa: aviso de vez e a planta');
const texto = await ana.js(`document.getElementById('principal').textContent`);
ok(!texto.includes('Drenar Vida') && !texto.includes('Garras paralisantes'), 'notas do Mestre nos combatentes não aparecem');
ok(!texto.includes('38 / 60') && !texto.includes('22 / 22'), 'PV exato de inimigo não aparece');
ok(texto.includes('Ferido') && texto.includes('Ileso'), 'inimigos aparecem como "Ferido" e "Ileso"');
ok(!(await ana.js(`document.querySelector('.mapa-jogador svg').textContent`)).includes('Glifo'), 'marcador de armadilha não aparece na planta');
ok(await ana.js(`JSON.stringify(Object.keys(visaoDoJogador(Estado, Sessao.ler().jogadorId).combate.combatentes.find(c=>c.tipo==='inimigo')).sort())`) === JSON.stringify(['agiu', 'caido', 'condicoes', 'id', 'iniciativa', 'meu', 'nome', 'tipo', 'vez', 'vida']), 'a visão de um inimigo só tem os campos públicos (sem pv, ca, nota)');
await ana.foto('k1-mesa');

/* ---- Diário ---- */
await ana.js(`document.querySelector('[data-aba="diario"]').click()`);
const diario = await ana.js(`document.getElementById('principal').textContent`);
ok(diario.includes('Emboscada na cripta') && diario.includes('A party desceu pela entrada dos fundos'), 'resumos das sessões aparecem');
ok(!diario.includes('Deixei o Carniçal entrar tarde'), 'notas do Mestre no diário não aparecem');
ok(diario.includes('Torvin vendia armas ao Culto') && !diario.includes('Boran tem a chave'), 'só o segredo revelado aparece');
ok(diario.includes('Boran, o Ferreiro Caolho') && !diario.includes('O Encapuzado') && !diario.includes('Esconde a chave'), 'NPCs conhecidos sem segredo; desconhecido não aparece');
ok(!diario.includes('ritual do Culto acontece'), 'pendências do Mestre não aparecem');
await ana.foto('k2-diario');

/* ---- Rolar pela ficha ---- */
await ana.js(`document.querySelector('[data-aba="ficha"]').click()`);
await ana.js(`document.querySelector('button.pericia[data-texto="Arcanismo"]').click()`);
await espera(300);
ok(await ana.js(`(()=>{const r=Campanhas.lerEstado(Sessao.ler().campanhaId).rolagensMesa[0]; return r.personagem==='Lyra' && r.autor==='Ana' && r.texto==='Arcanismo' && /\\+ 4$/.test(r.formula);})()`), 'clicar em Arcanismo rola d20 + 4 e vai para o registro da mesa');
await ana.js(`document.querySelector('[data-acao="modo-rolagem"][data-modo="vantagem"]').click(); document.querySelector('[data-acao="rolar-dado"][data-faces="20"]').click();`);
await espera(300);
ok(await ana.js(`/vantagem$/.test(Campanhas.lerEstado(Sessao.ler().campanhaId).rolagensMesa[0].formula)`), 'd20 com vantagem rola dois');
await ana.js(`document.querySelector('[data-acao="rolar-dado"][data-faces="8"]').click()`);
await espera(300);
ok(await ana.js(`(()=>{const r=Campanhas.lerEstado(Sessao.ler().campanhaId).rolagensMesa[0]; return r.texto==='d8' && r.total>=1 && r.total<=8;})()`), 'd8 rola de 1 a 8');
ok(await ana.js(`document.querySelectorAll('.rolagem-mesa').length`) === 3, 'as 3 rolagens aparecem no cartão');
await ana.foto('k3-ficha-rolador');

/* ---- o Mestre age depois e não apaga as rolagens ---- */
await espera(400);
ok(await js(`(Estado.rolagensMesa||[]).length===3`), 'a memória do Mestre recebeu as rolagens');
await ir('mestre.html');
await js(`document.querySelector('[data-faces="20"]').click()`);
await espera(200);
ok(await js(`(()=>{const e=Campanhas.lerEstado(Sessao.ler().campanhaId); return e.rolagensMesa.length===3 && e.rolagens[0].texto.startsWith('Rolagem livre');})()`), 'ação do Mestre grava e preserva as rolagens dos jogadores');

/* ---- celular ---- */
await ana.js(`document.querySelector('[data-aba="mesa"]').click()`);
await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await ana.fechar();
const ana2 = await novaAba();
await ana2.ir('index.html');
await ana2.js(`document.getElementById('nome').value='Ana'; document.getElementById('codigo').value=${JSON.stringify(codigo)};`);
await ana2.navegarPor(`document.getElementById('btnEntrar').click()`);
ok(await ana2.js(`document.querySelector('.nome-ficha')?.textContent==='Lyra'`), 'Ana numa aba nova volta para a mesma ficha');
await ana2.fechar();

console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill();
process.exit(0);
