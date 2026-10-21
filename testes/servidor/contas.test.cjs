/* As contas de Mestre e os convites (servidor/contas.js), numa pasta
   temporária. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { criarContas } = require('../../servidor/contas.js');

let falhas = 0;
const ok = (c, t) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + t); if (!c) falhas++; };

(async function () {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'plainus-contas-'));
  const arquivo = path.join(pasta, 'contas.json');
  const c = criarContas(pasta);
  ok(c.carregar() === 0 && !c.temAdmin(), 'pasta nova: nenhuma conta, nenhum administrador');

  /* ---- a primeira conta: o administrador ---- */
  ok((await c.criarAdmin('Th', 'senha-forte-1')).erro, 'usuário com menos de 3 letras: recusado');
  ok((await c.criarAdmin('Thiago', 'curta')).erro, 'senha com menos de 8: recusada');
  const adm = await c.criarAdmin('  Thiago ', 'lua nova sobre Valkoria');
  ok(!adm.erro && adm.conta.admin && adm.conta.usuario === 'Thiago' && typeof adm.chave === 'string', 'a primeira conta é a do administrador (o espaço em volta sai)');
  ok((await c.criarAdmin('Outro', 'senha-forte-1')).erro && c.listarContas().length === 1, 'um segundo administrador por esse caminho: recusado');

  /* ---- convites ---- */
  const conv = c.criarConvite(adm.conta.id, 'mestre');
  ok(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(conv.codigo) && conv.expiraEm > Date.now(), 'o administrador gera um convite (código de 12 letras, vence em 7 dias)');
  ok(c.listarConvites().length === 1 && c.listarConvites()[0].situacao === 'aberto' && !JSON.stringify(c.listarConvites()).includes(conv.codigo), 'a lista mostra o convite como aberto — sem o código');

  /* ---- criar conta com o convite ---- */
  ok((await c.criarConta('ZZZZ-ZZZZ-ZZZZ', 'Bruna', 'senha-da-bruna')).erro, 'convite inventado: recusado');
  ok((await c.criarConta(conv.codigo, 'THIAGO', 'senha-da-bruna')).erro, '"THIAGO" já existe (maiúsculas não contam): recusado');
  const bruna = await c.criarConta(conv.codigo.toLowerCase().replace(/-/g, ''), 'Bruna', 'senha-da-bruna');
  ok(!bruna.erro && !bruna.conta.admin && bruna.chave, 'a Bruna cria a conta com o convite (digitado em minúsculas, sem hífen)');
  ok((await c.criarConta(conv.codigo, 'Carla', 'senha-da-carla')).erro, 'o mesmo convite de novo: recusado (uso único)');
  ok(c.listarConvites()[0].situacao === 'usado' && c.listarConvites()[0].usadoPor === 'Bruna', 'a lista diz que o convite foi usado, e por quem');
  ok(c.criarConvite(bruna.conta.id, 'mestre').erro, 'quem não é administrador não gera convite');

  /* ---- o disco não guarda segredo nenhum ---- */
  const disco = fs.readFileSync(arquivo, 'utf8');
  ok(!disco.includes('lua nova') && !disco.includes('senha-da-bruna') && !disco.includes(adm.chave) && !disco.includes(bruna.chave) && !disco.includes(conv.codigo), 'o contas.json não tem senha, chave nem código de convite — só resumos');

  /* ---- entrar ---- */
  const certo = await c.entrar('bruna', 'senha-da-bruna', '1.1.1.1');
  ok(!certo.erro && certo.conta.usuario === 'Bruna' && certo.chave !== bruna.chave, 'a Bruna entra noutro computador: uma chave nova');
  const errada = await c.entrar('Bruna', 'senha errada', '1.1.1.1');
  const naoExiste = await c.entrar('Ninguem', 'senha-da-bruna', '1.1.1.1');
  ok(errada.erro && errada.erro === naoExiste.erro, 'senha errada e usuário que não existe dão a MESMA mensagem: "' + errada.erro + '"');
  ok(c.conferirSessao(bruna.conta.id, bruna.chave) && c.conferirSessao(bruna.conta.id, certo.chave), 'as duas chaves da Bruna abrem a conta dela');
  ok(!c.conferirSessao(bruna.conta.id, adm.chave) && !c.conferirSessao(bruna.conta.id, '') && !c.conferirSessao('uinventado0000000', bruna.chave), 'a chave de outra conta, vazia, ou conta inventada: não abre');
  c.sair(bruna.conta.id, certo.chave);
  ok(!c.conferirSessao(bruna.conta.id, certo.chave) && c.conferirSessao(bruna.conta.id, bruna.chave), 'sair num computador: só aquela chave deixa de valer');

  /* ---- a trava ---- */
  for (let i = 0; i < 10; i++) await c.entrar('Bruna', 'chute ' + i, '2.2.2.2');
  ok((await c.entrar('Bruna', 'senha-da-bruna', '2.2.2.2')).erro.includes('Espere'), 'dez erros da mesma pessoa: travada, até com a senha certa');
  ok(!(await c.entrar('Bruna', 'senha-da-bruna', '3.3.3.3')).erro, '…mas outra pessoa (outro endereço) ainda entra');
  for (let i = 0; i < 5; i++) await c.entrar('Brúna', 'chute a' + i, '6.6.6.6');
  for (let i = 0; i < 5; i++) await c.entrar('BRUNA', 'chute b' + i, '6.6.6.6');
  ok((await c.entrar('B\u0301runa', 'chute c', '6.6.6.6')).erro.includes('Espere'), 'trocar "Bruna" por "Brúna", "BRUNA" ou um acento solto não zera a trava: é a mesma conta, a mesma contagem');

  /* ---- esqueceu a senha: convite de senha ---- */
  ok(c.criarConvite(adm.conta.id, 'senha', 'uinventado0000000').erro, 'convite de senha para conta que não existe: recusado');
  const deSenha = c.criarConvite(adm.conta.id, 'senha', bruna.conta.id);
  ok((await c.criarConta(deSenha.codigo, 'Carla', 'senha-da-carla')).erro, 'um convite de SENHA não cria conta');
  const nova = await c.trocarSenhaComConvite(deSenha.codigo, 'outra senha da bruna');
  ok(!nova.erro && nova.conta.usuario === 'Bruna', 'com o convite de senha, a Bruna troca a senha (e já entra)');
  ok(!c.conferirSessao(bruna.conta.id, bruna.chave) && c.conferirSessao(bruna.conta.id, nova.chave), '…e os computadores antigos dela deixam de valer');
  ok((await c.entrar('Bruna', 'senha-da-bruna', '4.4.4.4')).erro && !(await c.entrar('Bruna', 'outra senha da bruna', '4.4.4.4')).erro, 'a senha velha não entra mais; a nova, sim');
  ok((await c.trocarSenhaComConvite(deSenha.codigo, 'mais uma senha')).erro, 'o convite de senha também é de uso único');

  /* ---- revogar e vencer ---- */
  const solto = c.criarConvite(adm.conta.id, 'mestre');
  ok(!c.revogarConvite(adm.conta.id, solto.id).erro && (await c.criarConta(solto.codigo, 'Carla', 'senha-da-carla')).erro, 'convite revogado não cria conta');
  const vence = c.criarConvite(adm.conta.id, 'mestre');
  const lido = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  lido.convites.find((v) => v.id === vence.id).expiraEm = Date.now() - 1000;
  fs.writeFileSync(arquivo, JSON.stringify(lido));
  const c2 = criarContas(pasta); c2.carregar();
  ok((await c2.criarConta(vence.codigo, 'Carla', 'senha-da-carla')).erro && c2.listarConvites().find((v) => v.id === vence.id).situacao === 'vencido', 'convite vencido (mais de 7 dias): não cria conta, e a lista diz "vencido"');

  /* ---- desativar ---- */
  ok(c2.desativarConta(adm.conta.id, adm.conta.id).erro, 'o administrador não desativa a si mesmo');
  ok(c2.desativarConta(bruna.conta.id, adm.conta.id).erro, 'quem não é administrador não desativa ninguém');
  const resgate = c2.criarConvite(adm.conta.id, 'senha', bruna.conta.id);
  ok(!c2.desativarConta(adm.conta.id, bruna.conta.id).erro && !c2.conferirSessao(bruna.conta.id, nova.chave) && (await c2.entrar('Bruna', 'outra senha da bruna', '5.5.5.5')).erro, 'conta desativada: as sessões caem e ela não entra mais');
  ok((await c2.trocarSenhaComConvite(resgate.codigo, 'senha de volta')).erro && !c2.listarConvites().some((v) => v.id === resgate.id), '…e um convite de senha aberto antes não a reativa (ele cai junto)');
  const outroResgate = c2.criarConvite(adm.conta.id, 'senha', bruna.conta.id);
  ok((await c2.trocarSenhaComConvite(outroResgate.codigo, 'senha de volta')).erro, 'convite de senha para conta desativada: não reativa');

  /* ---- reiniciar não perde nada ---- */
  const c3 = criarContas(pasta);
  ok(c3.carregar() === 2 && c3.temAdmin() && c3.conferirSessao(adm.conta.id, adm.chave), 'servidor reiniciado: as contas e a sessão do administrador continuam');
  fs.writeFileSync(arquivo, '{ isto não é json');
  const c4 = criarContas(pasta);
  ok(c4.carregar() === 0 && fs.readdirSync(pasta).some((n) => n.startsWith('contas.json.ilegivel-')), 'contas.json estragado: o servidor sobe sem contas e guarda o arquivo ruim à parte (não apaga)');
  fs.writeFileSync(arquivo, JSON.stringify({ formato: 'outra-coisa', contas: [] }));
  const c5 = criarContas(pasta);
  ok(c5.carregar() === 0 && fs.readdirSync(pasta).filter((n) => n.startsWith('contas.json.ilegivel-')).length === 2, 'JSON de outro formato também fica de lado, em vez de ser sobrescrito');
  fs.rmSync(arquivo, { force: true });
  fs.mkdirSync(arquivo);   /* um "arquivo" que não dá para ler */
  let parou = false;
  try { criarContas(pasta).carregar(); } catch (erro) { parou = /não sobe sem as contas/.test(erro.message); }
  ok(parou, 'erro de leitura que não é "não existe": o servidor PARA, em vez de começar vazio e apagar as contas na próxima gravação');

  fs.rmSync(pasta, { recursive: true, force: true });
  console.log(falhas ? falhas + ' FALHAS' : '\nContas certas.');
  process.exit(falhas ? 1 : 0);
})();
