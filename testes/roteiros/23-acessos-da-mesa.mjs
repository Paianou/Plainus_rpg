/* Acessos da mesa (acessos.html): liberar um jogador, desconectar os
   outros computadores do Mestre, apagar a campanha — e quem está com a
   mesa aberta sendo avisado na hora.

   As abas dividem o mesmo navegador (o mesmo localStorage). Por isso o
   "outro computador do Mestre" guarda a chave só na sessão da aba dele,
   e a aba do Mestre põe a própria chave de volta na lista quando a
   desconexão do outro a leva junto — em computadores de verdade, cada
   um tem a sua lista. */
const SENHA = 'lua nova sobre Valkoria';

/* ---- Mestre cria a mesa, com senha ---- */
await ir('index.html');
await js(`document.querySelector('[data-porta="mestrar"]').click(); document.getElementById('nome').value='Thiago'; document.getElementById('campanha').value='Mesa vigiada'`);
await clicarENavegar(`document.getElementById('btnCriar').click()`);
await js(digita('#senhaMestre', SENHA) + digita('#senhaMestre2', SENHA) + `const b=()=>document.getElementById('btnAvancar').click(); b(); document.getElementById('premissa').value='p'; document.getElementById('cenario').value='c'; b(); b(); b(); b();`);
await clicarENavegar(`document.getElementById('btnAvancar').click()`);
const codigo = await js(`Estado.campanha.codigo`);

/* ---- Ana (com a Lyra) e Bruno entram ---- */
const entrar = async (nome) => {
  const aba = await novaAba();
  await aba.ir('index.html#convite=' + codigo);
  await aba.js(`document.getElementById('nome').value=${JSON.stringify(nome)}`);
  await aba.navegarPor(`document.getElementById('btnEntrar').click()`);
  return aba;
};
const ana = await entrar('Ana');
await ana.js(digita('#f-nome', 'Lyra') + digita('#f-raca', 'Elfa') + digita('#f-classe', 'Maga') + `document.querySelector('[data-acao="salvar-ficha"]').click()`);
await aguardar(`document.querySelector('.nome-ficha')?.textContent==='Lyra'`, ana.js);
const bruno = await entrar('Bruno');

/* ---- a página de acessos ---- */
await clicarENavegar(`document.querySelector('.sobre-acoes a[href="acessos.html"]').click()`);
ok(await aguardar(`document.querySelectorAll('#listaJogadores .item-acesso').length===2`), 'o link "Acessos da mesa" do painel abre a página com os 2 jogadores');
ok(await js(`(()=>{const t=document.getElementById('listaJogadores').textContent; return t.includes('Ana') && t.includes('joga com Lyra') && t.includes('Bruno') && t.includes('ainda sem personagem');})()`), 'cada jogador com o personagem dele');
ok(await js(`document.getElementById('nomeMesa').textContent==='Mesa vigiada' && document.getElementById('btnSairOutros').hidden && !document.getElementById('campoSenhaApagar').hidden && document.getElementById('campoNomeApagar').hidden`), 'um computador só (sem o botão de desconectar); apagar pede a senha');
await foto('a1-acessos');

/* ---- liberar a Ana ---- */
await js(`[...document.querySelectorAll('#listaJogadores button')].find(b=>b.dataset.nome==='Ana').click()`);
ok(await js(`document.querySelector('#listaJogadores button.armado')?.textContent==='Confirmar: liberar Ana'`), 'o primeiro clique só arma: "Confirmar: liberar Ana"');
await espera(300);
ok(await ana.js(`!document.querySelector('.tela-restrita')`), '…e nada acontece ainda');
await js(`document.querySelector('#listaJogadores button.armado').click()`);
ok(await aguardar(`/liberado/.test(document.getElementById('aviso').textContent) && document.querySelectorAll('#listaJogadores .item-acesso').length===1`), 'o segundo clique libera: a Ana sai da lista');
ok(await aguardar(`!!document.querySelector('.tela-restrita') && document.querySelector('.tela-restrita').textContent.includes('liberou o seu lugar') && document.getElementById('app').hidden`, ana.js), 'a aba da Ana, aberta, é avisada na hora e o painel fecha');
ok(await ana.js(`!Acessos.listar().some(a=>a.papel==='jogador' && a.nome==='Ana') && !Sessao.ler()`), 'a chave antiga da Ana sai do navegador dela');
ok(await bruno.js(`!document.querySelector('.tela-restrita') && !document.getElementById('app').hidden`), 'o Bruno continua na mesa');

/* a Ana volta com o mesmo nome e reencontra a Lyra */
await ana.ir('index.html#convite=' + codigo);
await ana.js(`document.getElementById('nome').value='Ana'`);
await ana.navegarPor(`document.getElementById('btnEntrar').click()`);
ok(await ana.js(`document.querySelector('.nome-ficha')?.textContent==='Lyra'`), 'a Ana entra de novo com o mesmo nome e volta para a Lyra');

/* ---- outro computador do Mestre ---- */
const outroPc = await novaAba();
await outroPc.ir('index.html');
await outroPc.js(`Servidor.entrarComoMestre(${JSON.stringify(codigo)}, ${JSON.stringify(SENHA)}).then(r=>Sessao.gravar({campanhaId:r.campanhaId, papel:'mestre', chave:r.chave, nome:r.nome}))`);
await outroPc.ir('mestre.html');
ok(await outroPc.js(`!document.getElementById('app').hidden && Estado.campanha.nome==='Mesa vigiada'`), 'o Mestre abre o painel noutro computador (código + senha)');
await ir('acessos.html');
ok(await aguardar(`!document.getElementById('btnSairOutros').hidden && document.getElementById('textoComputadores').textContent.startsWith('2 computadores')`), 'a página mostra 2 computadores do Mestre');
await js(`document.getElementById('btnSairOutros').click(); document.getElementById('btnSairOutros').click()`);
ok(await aguardar(`/1 computador desconectado/.test(document.getElementById('aviso').textContent)`), 'desconectar os outros: confirmado, 1 computador saiu');
ok(await aguardar(`!!document.querySelector('.tela-restrita') && document.querySelector('.tela-restrita').textContent.includes('desconectado do painel do Mestre')`, outroPc.js), 'o painel do outro computador fecha, com o motivo');
await js(`Acessos.lembrar(Sessao.ler()); true`);
await ir('mestre.html');
ok(await js(`!document.getElementById('app').hidden`), 'este computador continua abrindo o painel');

/* ---- apagar: mesa SEM senha pede o nome ---- */
const outra = await js(`(async()=>{const e=JSON.parse(JSON.stringify(Estado)); e.campanha.nome='Mesa descartável'; e.campanha.codigo=''; const r=await Servidor.criarCampanha(e); return r;})()`);
const pedirApagar = (extra) => js(`Servidor.pedir('apagar', Object.assign({campanhaId:${JSON.stringify(outra.id)}, chave:${JSON.stringify(outra.chave)}}, ${JSON.stringify(extra)})).then(r=>r.erro||'ok')`);
ok((await pedirApagar({ confirmacao: 'mesa descartavel' })).startsWith('Digite o nome'), 'mesa sem senha: nome digitado diferente não apaga');
ok(await pedirApagar({ confirmacao: 'Mesa descartável' }) === 'ok', '…o nome exato apaga');

/* ---- apagar a mesa de verdade, com a senha ---- */
await ir('acessos.html');
await aguardar(`!document.getElementById('conteudo').hidden`);
await js(`document.getElementById('senhaApagar').value='senha errada'; document.getElementById('btnApagar').click()`);
ok(await aguardar(`document.getElementById('erro').textContent==='Senha errada.' && document.getElementById('senhaApagar').value===''`), 'senha errada: nada é apagado');
ok(await bruno.js(`!document.querySelector('.tela-restrita')`), '…e a mesa segue aberta para o Bruno');
await js(`document.getElementById('senhaApagar').value=${JSON.stringify(SENHA)}; document.getElementById('btnApagar').click()`);
ok(await aguardar(`!document.getElementById('semAcesso').hidden && document.getElementById('semAcesso').textContent.includes('foi apagada') && !Sessao.ler() && !Acessos.listar().some(a=>a.papel==='mestre')`), 'senha certa: apagada, e a chave sai deste navegador');
ok(await aguardar(`!!document.querySelector('.tela-restrita') && document.querySelector('.tela-restrita').textContent.includes('apagou esta campanha')`, bruno.js), 'o Bruno, com a mesa aberta, é avisado: "O Mestre apagou esta campanha."');
ok(await aguardar(`!!document.querySelector('.tela-restrita')`, ana.js), 'a Ana também');
ok((await fetch(SITE + 'api/convite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo }) })).status === 404, 'o código de convite não leva a mais nada');
await foto('a2-apagada');

/* ---- sem sessão de Mestre ---- */
await bruno.ir('acessos.html');
ok(await bruno.js(`!document.getElementById('semAcesso').hidden && document.getElementById('conteudo').hidden`), 'acessos.html sem ser o Mestre: só o aviso');

await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await espera(300);
ok(await js(`document.documentElement.scrollWidth <= 390`), 'celular: sem rolagem de lado');
await ana.fechar(); await bruno.fechar(); await outroPc.fechar();

console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill();
process.exit(0);
