/* As três telas do Mestre que passaram para o acoes.js, de ponta a ponta. */
const gravado = (expr) => `(()=>{const e=Campanhas.lerEstado(Sessao.ler().campanhaId); return ${expr};})()`;
const clicar = (acao, extra) => `document.querySelector('[data-acao="${acao}"]${extra || ''}').click()`;

await ir('index.html');
await js(`document.querySelector('[data-porta="mestrar"]').click(); document.getElementById('nome').value='Thiago'; document.getElementById('campanha').value='Teste ações'`);
await clicarENavegar(`document.getElementById('btnCriar').click()`);
await js(`document.getElementById('btnAvancar').click(); document.getElementById('premissa').value='x'; document.getElementById('cenario').value='y'; const b=()=>document.getElementById('btnAvancar').click(); b(); b(); b(); b(); document.querySelector('input[value="exemplo"]').checked=true`);
await clicarENavegar(`document.getElementById('btnAvancar').click()`);

/* ================= NPCs ================= */
await ir('npcs.html');
const nNpcs = await js(gravado('e.npcs.length'));
await js(clicar('novo')); await espera(80);
await js(digita('#campo-nome', 'Mirela da Ponte') + digita('#campo-papel', 'Barqueira'));
await js(clicar('salvar')); await espera(100);
ok(await js(gravado(`e.npcs.length===${nNpcs + 1} && e.npcs[e.npcs.length-1].nome==='Mirela da Ponte' && e.npcs[e.npcs.length-1].papel==='Barqueira'`)), 'NPC novo: entra no fim e fica gravado');
ok(await js(`Elenco.modo==='leitura' && Elenco.acharNpc(Elenco.selecionado).nome==='Mirela da Ponte'`), 'e a tela mostra a ficha dele');
await js(clicar('editar')); await espera(80);
await js(digita('#campo-nome', 'Mirela, a Barqueira'));
await js(clicar('salvar')); await espera(100);
ok(await js(gravado(`e.npcs.length===${nNpcs + 1} && e.npcs.some(n=>n.nome==='Mirela, a Barqueira') && !e.npcs.some(n=>n.nome==='Mirela da Ponte')`)), 'editar troca o NPC no lugar (não duplica)');
await js(clicar('editar')); await espera(80);
await js(digita('#campo-nome', '   '));
await js(clicar('salvar')); await espera(100);
ok(await js(`Elenco.modo==='edicao'`) && await js(gravado(`e.npcs.some(n=>n.nome==='Mirela, a Barqueira')`)), 'nome em branco: não salva, continua editando');
await js(clicar('cancelar')); await espera(80);
await js(clicar('alternar-status')); await espera(80);
ok(await js(gravado(`e.npcs.find(n=>n.nome==='Mirela, a Barqueira').status==='morto'`)), 'marcar como morto fica gravado');
await js(clicar('alternar-status')); await espera(80);
ok(await js(gravado(`e.npcs.find(n=>n.nome==='Mirela, a Barqueira').status==='vivo'`)), 'e voltar a vivo também');

/* ================= Diário ================= */
await ir('diario.html');
const nSessoes = await js(gravado('e.diario.length'));
await js(clicar('nova-sessao')); await espera(80);
await js(digita('#campo-titulo', 'A ponte caída'));
await js(clicar('salvar')); await espera(100);
ok(await js(gravado(`e.diario.length===${nSessoes + 1} && e.diario.some(d=>d.titulo==='A ponte caída')`)), 'diário: sessão nova gravada');
const sessao = await js(gravado(`e.diario.find(d=>d.titulo==='A ponte caída').sessao`));
ok(typeof sessao === 'number' && sessao > 0, 'o número da sessão é número (' + sessao + '), não texto');
await js(clicar('editar')); await espera(80);
await js(digita('#campo-titulo', 'A ponte caída (revisado)'));
await js(clicar('salvar')); await espera(100);
ok(await js(gravado(`e.diario.length===${nSessoes + 1} && e.diario.some(d=>d.titulo==='A ponte caída (revisado)')`)), 'editar a sessão troca no lugar');
await js(clicar('apagar')); await espera(100);
ok(await js(gravado(`e.diario.length===${nSessoes}`)), 'apagar a sessão: sai do gravado');
await js(`document.querySelector('.desfazer-recado').click()`); await espera(100);
ok(await js(gravado(`e.diario.length===${nSessoes + 1} && e.diario.some(d=>d.titulo==='A ponte caída (revisado)')`)) && await js(`Diario.selecionado===Diario.selecionado && !!document.querySelector('#detalhe')`), '"Desfazer" traz a sessão de volta');

/* segredos */
await js(clicar('aba', '[data-valor="segredos"]')); await espera(80);
const sid = await js(`Estado.segredos.find(s=>!s.revelado).id`);
await js(`document.querySelector('[data-acao="abrir"][data-id="${sid}"]').click()`); await espera(80);
await js(clicar('alternar-segredo')); await espera(80);
const ultimaSessao = await js(`Math.max(...Estado.diario.map(d=>d.sessao))`);
ok(await js(gravado(`(()=>{const s=e.segredos.find(s=>s.id==='${sid}'); return s.revelado===true && s.reveladoEm===${ultimaSessao};})()`)), 'revelar segredo: gravado, com a última sessão (' + ultimaSessao + ')');
await js(clicar('alternar-segredo')); await espera(80);
ok(await js(gravado(`(()=>{const s=e.segredos.find(s=>s.id==='${sid}'); return !s.revelado && !('reveladoEm' in s);})()`)), 'voltar a segredo apaga o reveladoEm');

/* pendências */
await js(clicar('aba', '[data-valor="pendencias"]')); await espera(80);
const nPend = await js(gravado('e.pendencias.length'));
await js(digita('#campo-pendencia', 'Pagar o barqueiro') + digita('#campo-prazo', 'Sessão 14'));
await js(clicar('add-pendencia')); await espera(100);
const pendencia1 = await js(gravado(`e.pendencias.find(p=>p.texto==='Pagar o barqueiro')`));
ok(pendencia1 && pendencia1.urgente === true && pendencia1.resolvida === false && pendencia1.prazo === 'Sessão 14', 'pendência nova gravada (com prazo = urgente)');
await js(`document.querySelector('[data-acao="alternar-pendencia"][data-id="${pendencia1.id}"]').click()`); await espera(80);
ok(await js(gravado(`e.pendencias.find(p=>p.id==='${pendencia1.id}').resolvida===true`)), 'marcar como resolvida fica gravado');
await js(`document.querySelector('[data-acao="tirar-pendencia"][data-id="${pendencia1.id}"]').click()`); await espera(80);
ok(await js(gravado(`e.pendencias.length===${nPend}`)), 'tirar a pendência: sai do gravado');
await js(clicar('add-pendencia')); await espera(80);
ok(await js(gravado(`e.pendencias.length===${nPend}`)), 'pendência em branco: nada gravado');

/* ================= Tabelas ================= */
await ir('tabelas.html');
await js(clicar('nova')); await espera(80);
await js(digita('#campo-nome', 'Clima na ponte') + `(()=>{const c=document.getElementById('campo-itens'); c.value='Neblina\\nChuva fina\\nVento forte\\nSol'; c.dispatchEvent(new Event('input',{bubbles:true}));})()`);
await js(clicar('salvar')); await espera(100);
const tab = await js(gravado(`e.tabelasMinhas.find(t=>t.nome==='Clima na ponte')`));
ok(tab && tab.itens.length === 4 && tab.dado === 4, 'tabela nova gravada, rolando d4');
await js(clicar('rolar')); await espera(100);
const rol1 = await js(gravado(`e.rolagensTabela`));
ok(rol1.length === 1 && rol1[0].tabela === tab.id && tab.itens[rol1[0].face - 1] === rol1[0].texto, 'rolar: o resultado gravado bate com a tabela (' + rol1[0].face + ': ' + rol1[0].texto + ')');
await js(clicar('rolar-tres')); await espera(100);
ok(await js(gravado(`e.rolagensTabela.length===4`)), 'rolar três: mais três no histórico');
await js(clicar('limpar-historico')); await espera(80);
ok(await js(gravado(`e.rolagensTabela.length===0`)), 'limpar histórico fica gravado');
await js(clicar('editar')); await espera(80);
await js(digita('#campo-nome', 'Clima na ponte velha'));
await js(clicar('salvar')); await espera(100);
ok(await js(gravado(`e.tabelasMinhas.filter(t=>t.id==='${tab.id}').length===1 && e.tabelasMinhas.find(t=>t.id==='${tab.id}').nome==='Clima na ponte velha'`)), 'editar a tabela troca no lugar');
await js(clicar('apagar')); await espera(100);
ok(await js(gravado(`!e.tabelasMinhas.some(t=>t.id==='${tab.id}')`)), 'apagar a tabela: sai do gravado');
await js(`document.querySelector('.desfazer-recado').click()`); await espera(100);
ok(await js(gravado(`e.tabelasMinhas.some(t=>t.id==='${tab.id}')`)) && await js(`Rolador.selecionada==='${tab.id}'`), '"Desfazer" traz a tabela de volta, selecionada');
await foto('f1-tabelas');

console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill();
process.exit(0);
