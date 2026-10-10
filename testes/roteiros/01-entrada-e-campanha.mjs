/* 0. edição sem sessão */
await ir('criar-campanha.html?editar=1'); await espera(400);
ok(await js(`location.pathname.endsWith('index.html')`), 'edição sem sessão manda para a entrada');

/* 1. mestre.html sem sessão */
await ir('mestre.html');
ok(await js(`!!document.querySelector('.tela-restrita') && document.getElementById('app').hidden`), 'mestre.html sem sessão mostra Área do Mestre');

/* 2. entrada vazia */
await ir('index.html');
ok(await js(`document.getElementById('campanhasSalvas').hidden`), 'entrada sem campanhas esconde "Suas campanhas"');
await js(`document.getElementById('btnCriar').click()`);
ok(await js(`document.getElementById('erro').textContent`) === 'Diga como a mesa te chama.', 'criar sem nome dá erro');

/* 3. criar -> etapas */
await js(`document.getElementById('nome').value='Thiago'; document.getElementById('campanha').value='Crônicas de Ravendusk'`);
await clicarENavegar(`document.getElementById('btnCriar').click()`);
ok(await js(`location.pathname.endsWith('criar-campanha.html')`), 'foi para criar-campanha.html');
ok(await js(`document.getElementById('nomeCampanha').value==='Crônicas de Ravendusk' && document.getElementById('mestre').value==='Thiago'`), 'rascunho preenche nome e mestre');
await foto('1-etapa1');
await js(`document.getElementById('btnAvancar').click()`);
ok(await js(`!document.querySelector('section[data-passo="2"]').hidden`), 'avançou para etapa 2');
await js(`document.getElementById('btnAvancar').click()`);
ok(await js(`document.getElementById('erro').textContent.startsWith('Conte')`), 'etapa 2 exige premissa');
await js(`document.getElementById('premissa').value='Um rei morto volta.\\nA cidade finge não ver.'; document.getElementById('cenario').value='Ravendusk, cidade de criptas'; document.getElementById('tom').value='Sombrio, investigação'; document.getElementById('linhas').value='Sem tortura detalhada'`);
await foto('2-etapa2');
await js(`document.getElementById('btnAvancar').click()`);
await js(`document.getElementById('nivelInicial').value='0'; document.getElementById('btnAvancar').click()`);
ok(await js(`document.getElementById('erro').textContent.includes('1 a 20')`), 'nível 0 é recusado');
await js(`document.getElementById('nivelInicial').value='3'; document.getElementById('regras').value='Poção como ação bônus'; document.getElementById('grupo').value='Os Sem-Teto'; document.getElementById('btnAvancar').click(); document.getElementById('btnAvancar').click()`);
ok(await js(`!document.querySelector('section[data-passo="5"]').hidden`), 'etapa 4 (sessão 1) aparece ao criar');
await js(`document.getElementById('prazo').value='3 dias'; document.getElementById('btnAvancar').click()`);
ok(await js(`document.getElementById('erro').textContent.startsWith('Diga qual é a ameaça')`), 'prazo sem ameaça é recusado');
await js(`document.getElementById('tituloSessao').value='O enterro'; document.getElementById('dataSessao').value='2026-10-10'; document.getElementById('ameaca').value='O rei acorda na lua nova'; document.getElementById('verdade').value='O rei é o avô do clérigo'; document.getElementById('pista').value='Chuva sobre Valkoria'`);
await foto('2b-etapa-sessao');
await js(`document.getElementById('btnAvancar').click()`);
ok(await js(`document.querySelectorAll('#resumoCampanha dt').length`) === 21, 'resumo lista os 21 campos preenchidos (17 + 4 regras)');
ok(await js(`[...document.querySelectorAll('#resumoCampanha dd')].some(d=>d.textContent==='10/10/2026')`), 'data no formato brasileiro no resumo');
await foto('3-etapa5');
await js(`document.getElementById('btnVoltar').click()`);
ok(await js(`!document.querySelector('section[data-passo="5"]').hidden`), 'voltar funciona');
await js(`document.getElementById('btnAvancar').click()`);
await clicarENavegar(`document.getElementById('btnAvancar').click()`);
ok(await js(`document.querySelector('.titulo-sessao').textContent`) === 'Crônicas de Ravendusk — Sessão 1: O enterro', 'sessão 1 com título na barra');
ok(await js(`Estado.pendencias.length===1 && Estado.pendencias[0].urgente && Estado.segredos.length===1 && Estado.audio.pista==='Chuva sobre Valkoria' && Estado.diario[0].data==='2026-10-10'`), 'pendência urgente, segredo, data e pista gravados');
ok(await js(`document.querySelector('.coluna-herois .sub').textContent.startsWith('Os Sem-Teto')`), 'nome do grupo na Visão Geral');
await js(`document.getElementById('sinoAvisos').click()`); await espera(200);
ok(await js(`document.querySelector('.painel-avisos').textContent.includes('O rei acorda na lua nova')`), 'ameaça aparece no sino de avisos');
await js(`document.getElementById('sinoAvisos').click()`);
/* edição */
await clicarENavegar(`document.querySelector('.sobre-acoes a').click()`);
ok(await js(`document.getElementById('tituloForm').textContent==='Editar campanha' && document.getElementById('premissa').value.startsWith('Um rei morto') && document.getElementById('grupo').value==='Os Sem-Teto'`), 'edição abre preenchida');
ok(await js(`document.querySelectorAll('#passos li:not([hidden])').length`) === 5, 'edição tem 5 etapas');
await js(`document.getElementById('veus').value='Romance fora de cena'; for (let i=0;i<4;i++) document.getElementById('btnAvancar').click()`);
ok(await js(`document.getElementById('btnAvancar').textContent==='Salvar alterações' && document.getElementById('escolhaInicio').hidden`), 'última etapa da edição: salvar, sem escolha vazia/exemplo');
await foto('3b-edicao-salvar');
const codigoAntes = await js(`Campanhas.lerEstado(Sessao.ler().campanhaId).campanha.codigo`);
await clicarENavegar(`document.getElementById('btnAvancar').click()`);
ok(await js(`document.querySelector('.sobre-grade').textContent.includes('Romance fora de cena') && Estado.campanha.codigo===${JSON.stringify(codigoAntes)} && Estado.pendencias.length===1`), 'edição salva véus, mantém código e conteúdo');
await ir('criar-campanha.html?editar=1');
await js(`for (let i=0;i<4;i++) document.getElementById('btnAvancar').click();`);
await ir('mestre.html');
ok(await js(`location.pathname.endsWith('mestre.html') && !document.getElementById('app').hidden`), 'criou vazia e abriu o painel');
ok(await js(`document.querySelector('.sobre-campanha')?.open && document.querySelector('.sobre-grade').textContent.includes('Ravendusk')`), 'cartão Sobre a campanha aberto com o cenário');
ok(await js(`document.querySelector('.regra-ativa p').textContent`) === 'Poção como ação bônus', 'regras da casa no códice');
ok(await js(`document.querySelector('.perfil .nome').textContent`) === 'Thiago', 'nome do mestre na barra');
await foto('4-painel-vazio');

/* 4. todas as telas com campanha vazia */
for (const t of ['combate', 'compendio', 'bestiario', 'npcs', 'mapas', 'tabelas', 'diario', 'mestre']) {
  const antes = erros.length;
  await ir(t + '.html');
  ok(erros.length === antes && !(await js(`document.getElementById('app').hidden`)), t + '.html abre sem erro na campanha vazia');
}
await ir('mapas.html'); await foto('5-mapas-vazio'); await ir('index.html'); await foto('0-entrada');

/* 5. mudança salva e sobrevive */
await ir('mestre.html');
await js(`document.querySelector('[data-faces="20"]').click()`);
await ir('mestre.html');
ok(await js(`!!document.querySelector('.resultado .total')`), 'rolagem salva sobrevive a recarregar');

/* 6. sair -> lista -> criar com exemplo */
await clicarENavegar(`document.querySelector('[data-acao="sair"]').click()`);
ok(await js(`!document.getElementById('campanhasSalvas').hidden && document.querySelectorAll('.campanha-salva').length===1`), 'sair volta à entrada com 1 campanha listada');
await foto('6-entrada-lista');
await js(`document.getElementById('nome').value='Thiago'; document.getElementById('campanha').value='Teste exemplo'`);
await clicarENavegar(`document.getElementById('btnCriar').click()`);
await js(`document.getElementById('btnAvancar').click(); document.getElementById('premissa').value='x'; document.getElementById('cenario').value='y'; document.getElementById('btnAvancar').click(); document.getElementById('btnAvancar').click(); document.getElementById('btnAvancar').click(); document.getElementById('btnAvancar').click(); document.querySelector('input[value="exemplo"]').checked=true`);
await clicarENavegar(`document.getElementById('btnAvancar').click()`);
ok(await js(`document.querySelectorAll('article.heroi').length`) === 4, 'campanha com exemplo traz os 4 heróis');
ok(await js(`document.querySelector('.titulo-sessao').textContent.startsWith('Teste exemplo')`), 'nome novo na barra, dados do exemplo');
const codigo = await js(`Estado.campanha.codigo`);

/* 7. entrar com código */
await clicarENavegar(`document.querySelector('[data-acao="sair"]').click()`);
ok(await js(`document.querySelectorAll('.campanha-salva').length`) === 2, '2 campanhas na lista');
await js(`document.getElementById('nome').value='Ana'; document.getElementById('codigo').value='AAAA-BBBB-CCCC'; document.getElementById('btnEntrar').click()`);
ok(await js(`document.getElementById('erro').textContent.startsWith('Nenhuma campanha')`), 'código inexistente recusado');
await clicarENavegar(`document.getElementById('codigo').value=${JSON.stringify(codigo.toLowerCase().replace(/-/g, ' '))}; document.getElementById('btnEntrar').click()`);
ok(await js(`location.pathname.endsWith('jogador.html') && !!document.getElementById('formFicha')`), 'jogador com código certo vai para o painel dele (código em minúsculas e com espaços)');
await ir('mestre.html');
ok(await js(`document.querySelector('.tela-restrita strong')?.textContent`) === 'jogador', 'jogador barrado no painel do mestre');
await ir('index.html');
ok(await js(`!document.querySelector('input[name="papel"]')`), 'não há mais como marcar "Mestre" ao entrar com código');
await js(`document.getElementById('nome').value='Thiago'; document.getElementById('codigo').value=${JSON.stringify(codigo)}`);
await clicarENavegar(`document.getElementById('btnEntrar').click()`);
ok(await js(`location.pathname.endsWith('jogador.html') && Sessao.ler().papel==='jogador'`), 'o código só faz JOGADOR, mesmo com o nome do Mestre (problema 1 do CLAUDE.md)');
await ir('index.html');
await clicarENavegar(`[...document.querySelectorAll('.campanha-salva')].find(l=>l.textContent.includes('Teste exemplo')).querySelector('[data-acao="continuar"]').click()`);
ok(await js(`location.pathname.endsWith('mestre.html') && document.querySelectorAll('article.heroi').length===4`), 'o Mestre volta pelo cartão da campanha e entra na campanha certa');

/* 8. continuar e esquecer */
await ir('index.html');
await clicarENavegar(`[...document.querySelectorAll('.campanha-salva')].find(l=>l.textContent.includes('Ravendusk')).querySelector('[data-acao="continuar"]').click()`);
ok(await js(`document.querySelector('.titulo-sessao').textContent.startsWith('Crônicas de Ravendusk')`), 'continuar abre a campanha escolhida');
await ir('index.html');
await js(`[...document.querySelectorAll('.campanha-salva')].find(l=>l.textContent.includes('Ravendusk')).querySelector('[data-acao="esquecer"]').click()`);
await espera(300);
ok(await js(`document.querySelectorAll('.campanha-salva').length`) === 1, 'esquecer apaga a campanha');
await ir('mestre.html');
ok(await js(`!!document.querySelector('.tela-restrita')`), 'campanha esquecida: painel barrado');

/* celular */
await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await ir('index.html'); await foto('7-celular-entrada');
await js(`document.getElementById('nome').value='Thiago'; document.getElementById('campanha').value='Mobile'`);
await clicarENavegar(`document.getElementById('btnCriar').click()`);
ok(await js(`document.documentElement.scrollWidth <= 390`), 'criação sem rolagem horizontal no celular');
await foto('8-celular-criar');

console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill();
process.exit(0);
