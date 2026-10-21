/* A senha do Mestre: criar com senha, entrar como Mestre noutro
   computador, trocar a senha, e a mesa sem senha.

   "Outro computador" é simulado apagando deste navegador as chaves
   (plainus:acessos) e a sessão: é exatamente o que um computador novo
   tem — nada. */
const SENHA = 'lua nova sobre Valkoria';
const outroComputador = () => js(`localStorage.removeItem('plainus:acessos'); Sessao.limpar(); true`);
const preencherEtapas = `const b=()=>document.getElementById('btnAvancar').click(); b(); document.getElementById('premissa').value='p'; document.getElementById('cenario').value='c'; b(); b(); b(); b();`;
const comecarCriacao = async (nome) => {
  await ir('index.html');
  await js(`document.querySelector('[data-porta="mestrar"]').click(); document.getElementById('nome').value='Thiago'; document.getElementById('campanha').value=${JSON.stringify(nome)}`);
  await clicarENavegar(`document.getElementById('btnCriar').click()`);
};

/* ---- criar com senha: as regras do campo ---- */
await comecarCriacao('Mesa trancada');
ok(await js(`!document.getElementById('blocoSenha').hidden && document.getElementById('senhaMestre').type==='password'`), 'a etapa 1 tem a senha do Mestre (campo de senha, opcional)');
await js(digita('#senhaMestre', 'curta') + digita('#senhaMestre2', 'curta') + `document.getElementById('btnAvancar').click()`);
ok(await js(`document.getElementById('erro').textContent.includes('pelo menos 8')`), 'senha curta: recusada');
await js(digita('#senhaMestre', SENHA) + digita('#senhaMestre2', SENHA + 'x') + `document.getElementById('btnAvancar').click()`);
ok(await js(`document.getElementById('erro').textContent==='As duas senhas não são iguais.'`), 'as duas senhas diferentes: recusado');
await js(digita('#senhaMestre2', SENHA) + preencherEtapas);
ok(await js(`!document.getElementById('resumoCampanha').textContent.includes(${JSON.stringify(SENHA)})`), 'a senha não aparece no resumo');
await clicarENavegar(`document.getElementById('btnAvancar').click()`);
ok(await js(`location.pathname.endsWith('mestre.html') && Estado.campanha.nome==='Mesa trancada'`), 'campanha criada com senha');
ok(await js(`!JSON.stringify(Estado).includes(${JSON.stringify(SENHA)}) && !JSON.stringify(sessionStorage).includes(${JSON.stringify(SENHA)}) && !JSON.stringify(localStorage).includes(${JSON.stringify(SENHA)})`), 'a senha não fica na campanha nem guardada no navegador');
const codigo = await js(`Estado.campanha.codigo`);
await ir('index.html');
ok(await js(`!!document.querySelector('.campanha-salva') && !document.querySelector('.campanha-salva').textContent.includes('Sem senha')`), 'o cartão da mesa com senha não mostra "Sem senha"');

/* ---- outro computador: código + senha ---- */
await outroComputador();
await ir('index.html');
ok(await js(`document.getElementById('campanhasSalvas').hidden`), 'computador novo: nenhuma mesa na lista');
await js(`document.querySelector('[data-porta="mestrar"]').click(); document.getElementById('btnVoltaMestre').click()`);
ok(await js(`!document.getElementById('blocoVoltaMestre').hidden && document.getElementById('campoNome').hidden && document.getElementById('tituloPorta').textContent==='Entrar como Mestre' && document.activeElement.id==='codigoMestre'`), '"Já tenho uma mesa" abre código + senha (sem o nome), com o foco no código');
await foto('s1-entrar-como-mestre');
await js(`document.getElementById('codigoMestre').value=${JSON.stringify(codigo)}; document.getElementById('senhaMestre').value='senha errada'; document.getElementById('btnEntrarMestre').click()`);
/* A tentativa errada fica no campo (escondida, e selecionada para
   digitar por cima): apagar fazia o próximo clique trocar o aviso por
   "Digite a senha do Mestre", e parecia que o site nem tinha recebido. */
ok(await aguardar(`document.getElementById('erro').textContent==='Código ou senha não conferem.' && document.getElementById('senhaMestre').value!=='' && document.activeElement===document.getElementById('senhaMestre') && document.getElementById('senhaMestre').type==='password'`), 'senha errada: recusada; a tentativa fica no campo, escondida e selecionada');
await js(`document.getElementById('codigoMestre').value='ZZZZ-ZZZZ-ZZZZ'; document.getElementById('senhaMestre').value=${JSON.stringify(SENHA)}; document.getElementById('btnEntrarMestre').click()`);
ok(await aguardar(`document.getElementById('erro').textContent==='Código ou senha não conferem.'`), 'código errado: a MESMA mensagem (não conta qual dos dois errou)');
await js(`document.getElementById('codigoMestre').value=${JSON.stringify(codigo.toLowerCase())}; document.getElementById('senhaMestre').value=${JSON.stringify(SENHA)};`);
await clicarENavegar(`document.getElementById('senhaMestre').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);
ok(await js(`location.pathname.endsWith('mestre.html') && Estado.campanha.nome==='Mesa trancada' && Sessao.ler().papel==='mestre'`), 'código + senha certos (Enter): o painel do Mestre abre neste computador');
await ir('index.html');
ok(await js(`document.querySelectorAll('.campanha-salva').length===1`), '…e a mesa passa a aparecer em "Suas mesas" aqui');

/* ---- trocar a senha em "Editar campanha" ---- */
await clicarENavegar(`document.querySelector('.campanha-salva [data-acao="continuar"]').click()`);
await ir('criar-campanha.html?editar=1');
ok(await aguardar(`document.getElementById('ajudaSenha').textContent.startsWith('Esta mesa já tem senha')`) && await js(`document.getElementById('rotuloSenha').textContent==='Nova senha'`), 'a edição diz que a mesa já tem senha, e em branco mantém a atual');
await js(digita('#senhaMestre', 'trovão em Ravendusk') + digita('#senhaMestre2', 'trovão em Ravendusk') + `for (let i=0;i<4;i++) document.getElementById('btnAvancar').click();`);
await clicarENavegar(`document.getElementById('btnAvancar').click()`);
ok(await js(`location.pathname.endsWith('mestre.html')`), 'salvar a edição com a senha nova volta ao painel');
await outroComputador();
await ir('index.html');
await js(`document.querySelector('[data-porta="mestrar"]').click(); document.getElementById('btnVoltaMestre').click(); document.getElementById('codigoMestre').value=${JSON.stringify(codigo)}; document.getElementById('senhaMestre').value=${JSON.stringify(SENHA)}; document.getElementById('btnEntrarMestre').click()`);
ok(await aguardar(`document.getElementById('erro').textContent==='Código ou senha não conferem.'`), 'depois de trocar, a senha antiga não vale mais');
await js(`document.getElementById('senhaMestre').value='trovão em Ravendusk'`);
await clicarENavegar(`document.getElementById('btnEntrarMestre').click()`);
ok(await js(`location.pathname.endsWith('mestre.html')`), '…e a nova vale');

/* ---- um jogador não define a senha ---- */
const jogador = await novaAba();
await jogador.ir('index.html#convite=' + codigo);
await jogador.js(`document.getElementById('nome').value='Ana'`);
await jogador.navegarPor(`document.getElementById('btnEntrar').click()`);
ok(await jogador.js(`Servidor.definirSenha(Sessao.ler(), 'quero ser mestre').then(r=>r.erro)`) === 'Só o Mestre desta campanha define a senha.', 'a chave de um jogador não define a senha do Mestre');
await jogador.fechar();

/* ---- mesa sem senha ---- */
await comecarCriacao('Mesa aberta');
await js(preencherEtapas);
await clicarENavegar(`document.getElementById('btnAvancar').click()`);
ok(await js(`location.pathname.endsWith('mestre.html') && Estado.campanha.nome==='Mesa aberta'`), 'criar sem senha continua valendo');
const codigoAberta = await js(`Estado.campanha.codigo`);
await ir('index.html');
ok(await js(`[...document.querySelectorAll('.campanha-salva')].some(c=>c.textContent.includes('Mesa aberta') && c.textContent.includes('Sem senha'))`), 'o cartão da mesa sem senha mostra "Sem senha"');
await clicarENavegar(`[...document.querySelectorAll('.campanha-salva')].find(c=>c.textContent.includes('Mesa aberta')).querySelector('[data-acao="continuar"]').click()`);
await ir('criar-campanha.html?editar=1');
ok(await aguardar(`document.getElementById('ajudaSenha').textContent.startsWith('Esta mesa ainda não tem senha')`), 'a edição avisa que a mesa ainda não tem senha');
await ir('index.html');
await js(`document.querySelector('[data-porta="mestrar"]').click(); document.getElementById('btnVoltaMestre').click(); document.getElementById('codigoMestre').value=${JSON.stringify(codigoAberta)}; document.getElementById('senhaMestre').value='qualquer coisa'; document.getElementById('btnEntrarMestre').click()`);
ok(await aguardar(`document.getElementById('erro').textContent.includes('ainda não tem senha')`), 'mesa sem senha: entrar como Mestre noutro computador explica o que fazer');

await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await espera(300);
ok(await js(`document.documentElement.scrollWidth <= 390`), 'celular: o formulário do Mestre sem rolagem de lado');
await foto('s2-celular');

console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill();
process.exit(0);
