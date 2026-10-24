/* Campanhas de antes das contas (sem dono): quem é o Mestre delas neste
   navegador as traz para a própria conta — com a mesma prova de entrar
   como Mestre num computador novo (a senha do Mestre; sem senha, só do
   computador do servidor). Ninguém adota a de outro. */

const api = (rota, corpo) => js(`fetch('/api/${rota}', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(${JSON.stringify(corpo || {})}) }).then(r => r.json().then(d => Object.assign({ status: r.status }, d)))`);
const criarSemConta = async (nome, senha) => {
  await ir('index.html');
  await js(`document.querySelector('[data-porta="mestrar"]').click(); document.getElementById('nome').value='Thiago'; document.getElementById('campanha').value=${JSON.stringify(nome)}`);
  await clicarENavegar(`document.getElementById('btnCriar').click()`);
  if (senha) await js(`document.getElementById('senhaMestre').value=${JSON.stringify(senha)}; document.getElementById('senhaMestre2').value=${JSON.stringify(senha)}`);
  await js(`const b=()=>document.getElementById('btnAvancar').click(); b(); document.getElementById('premissa').value='p'; document.getElementById('cenario').value='c'; b(); b(); b(); b();`);
  await clicarENavegar(`document.getElementById('btnAvancar').click()`);
  return js(`Sessao.ler()`);
};
const SENHA_POCO = 'o poço não tem fundo';

/* ---- duas campanhas do jeito antigo: sem conta, no computador do servidor ---- */
const acesso = await criarSemConta('A Velha Cripta');
ok(acesso && acesso.papel === 'mestre', 'a Velha Cripta foi criada sem conta e sem senha (Mestre só por este navegador)');
const poco = await criarSemConta('O Poço Fundo', SENHA_POCO);
ok(poco && poco.papel === 'mestre' && poco.campanhaId !== acesso.campanhaId, 'o Poço Fundo foi criado sem conta, com senha de Mestre');

/* ---- a conta do Thiago (administrador) ---- */
const adm = await api('conta/admin', { usuario: 'Thiago', senha: 'lua nova sobre Valkoria' });
await js(`ContaLocal.gravar(${JSON.stringify({ contaId: adm.contaId, chave: adm.chave, usuario: 'Thiago', admin: true })})`);
await ir('index.html');
await js(`document.querySelector('[data-porta="mestrar"]').click()`);
ok(await aguardar(`!document.getElementById('blocoSemDono').hidden && /A Velha Cripta/.test(document.getElementById('listaSemDono').textContent) && /O Poço Fundo/.test(document.getElementById('listaSemDono').textContent) && /Nenhuma campanha ainda/.test(document.getElementById('listaMinhas').textContent)`), 'logado: as duas aparecem em "Mesas deste computador sem conta"');
ok(await js(`!!document.querySelector('[data-senha-de="${poco.campanhaId}"]') && !document.querySelector('[data-senha-de="${acesso.campanhaId}"]') && document.querySelector('[data-senha-de="${poco.campanhaId}"]').type==='password'`), 'só a que tem senha de Mestre pede a senha, num campo ao lado do botão');
await js(`document.getElementById('blocoSemDono').scrollIntoView({block:'center'})`);
await foto('35-sem-dono');

/* ---- sem senha de Mestre: só do computador do servidor ---- */
const corpoVelha = { contaId: adm.contaId, chave: adm.chave, campanhaId: acesso.campanhaId, chaveMestre: acesso.chave };
await cmd('Network.enable');
await cmd('Network.setExtraHTTPHeaders', { headers: { 'CF-Connecting-IP': '203.0.113.7' } });
const peloLink = await api('conta/vincular', corpoVelha);
ok(peloLink.status === 400 && /não tem senha de Mestre/.test(peloLink.erro), 'pelo link, a campanha SEM senha não vem para a conta só com a chave (um amigo que já foi Mestre nela teria a dele)');
await cmd('Network.setExtraHTTPHeaders', { headers: {} });
await js(`document.querySelector('[data-vincular="${acesso.campanhaId}"]').click()`);
ok(await aguardar(`/agora é da sua conta/.test(document.getElementById('aviso').textContent) && /A Velha Cripta/.test(document.getElementById('listaMinhas').textContent) && !/A Velha Cripta/.test(document.getElementById('listaSemDono').textContent)`), 'no computador do servidor: "Trazer para a minha conta" a põe em "Minhas campanhas"');

/* ---- com senha de Mestre: ela é a prova ---- */
await js(`document.querySelector('[data-vincular="${poco.campanhaId}"]').click()`);
ok(await aguardar(`document.getElementById('erro').textContent==='Digite a senha do Mestre desta campanha.' && document.activeElement===document.querySelector('[data-senha-de="${poco.campanhaId}"]')`), 'sem digitar a senha: pede a senha, com o foco no campo');
await js(`document.querySelector('[data-senha-de="${poco.campanhaId}"]').value='senha errada'; document.querySelector('[data-vincular="${poco.campanhaId}"]').click()`);
ok(await aguardar(`/não confere/.test(document.getElementById('erro').textContent) && /O Poço Fundo/.test(document.getElementById('listaSemDono').textContent)`), 'senha errada: recusada, e ela continua sem conta');
await js(`const c=document.querySelector('[data-senha-de="${poco.campanhaId}"]'); c.value=${JSON.stringify(SENHA_POCO)}; c.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);
ok(await aguardar(`/agora é da sua conta/.test(document.getElementById('aviso').textContent) && /O Poço Fundo/.test(document.getElementById('listaMinhas').textContent) && document.getElementById('blocoSemDono').hidden`), 'senha certa (Enter no campo): ela vem para a conta, e a seção some');

/* ---- Acessos da mesa diz de que conta ela é ---- */
await js(`Sessao.gravar(${JSON.stringify(acesso)})`);
await ir('acessos.html');
ok(await aguardar(`/conta de Mestre "Thiago"/.test(document.getElementById('textoDona').textContent)`), 'em Acessos da mesa: "Esta campanha é da conta de Mestre Thiago"');

/* ---- ninguém adota a mesa de outro ---- */
const conv = await api('admin/convite', { contaId: adm.contaId, chave: adm.chave, tipo: 'mestre' });
const bruna = await api('conta/criar', { convite: conv.codigo, usuario: 'Bruna', senha: 'senha-da-bruna' });
const inventada = await api('conta/vincular', { contaId: bruna.contaId, chave: bruna.chave, campanhaId: acesso.campanhaId, chaveMestre: 'chave-inventada' });
ok(inventada.status === 400 && /Só o Mestre/.test(inventada.erro), 'com uma chave de Mestre inventada: recusado');
const comAChave = await api('conta/vincular', { contaId: bruna.contaId, chave: bruna.chave, campanhaId: acesso.campanhaId, chaveMestre: acesso.chave });
ok(comAChave.status === 400 && /já é de outra conta/.test(comAChave.erro), 'mesmo com a chave de Mestre de verdade: a campanha que já tem dono não muda de dono');
const lista = await api('conta/sem-dono', { contaId: bruna.contaId, chave: bruna.chave, mesas: JSON.stringify([{ campanhaId: acesso.campanhaId, chave: acesso.chave }, { campanhaId: acesso.campanhaId, chave: 'x' }]) });
ok(Array.isArray(lista.campanhas) && lista.campanhas.length === 0, '"sem dono" só lista mesas sem dono que a chave abre — a Velha Cripta (já com dono) não aparece');
ok((await api('conta/vincular', { contaId: bruna.contaId, chave: 'sessao-inventada', campanhaId: acesso.campanhaId, chaveMestre: acesso.chave })).status === 401, 'sem sessão de conta válida: 401');

/* ---- e ela abre pela conta, noutro computador ---- */
await js(`localStorage.clear(); sessionStorage.clear(); ContaLocal.gravar(${JSON.stringify({ contaId: adm.contaId, chave: adm.chave, usuario: 'Thiago', admin: true })})`);
await ir('index.html');
await js(`document.querySelector('[data-porta="mestrar"]').click()`);
await aguardar(`/A Velha Cripta/.test(document.getElementById('listaMinhas').textContent)`);
await clicarENavegar(`document.querySelector('#listaMinhas [data-campanha="${acesso.campanhaId}"]').click()`);
ok(await js(`location.pathname.endsWith('mestre.html') && Estado.campanha.nome==='A Velha Cripta'`), 'sem a chave antiga no navegador, a Velha Cripta abre pela conta');

console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill(); process.exit(0);
