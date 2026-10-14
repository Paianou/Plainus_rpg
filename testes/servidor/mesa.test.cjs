/* O servidor inteiro, de fora: as rotas da entrada (servidor/api.js) e
   a mesa em tempo real (servidor/mesa.js), como os navegadores usam.
   Liga o server.js de verdade, numa pasta de dados temporária. */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { io } = require('socket.io-client');
const { aplicarAcao, novaSemente } = require('../../publico/acoes.js');
const { estadoVazio } = require('../../publico/modelo.js');

let falhas = 0;
const ok = (c, t) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + t); if (!c) falhas++; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const PORTA = 3990;
const SITE = 'http://127.0.0.1:' + PORTA;
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'plainus-mesa-'));
const servidor = spawn(process.execPath, [path.join(__dirname, '..', '..', 'server.js')], {
  env: Object.assign({}, process.env, { PORT: String(PORTA), DATA_DIR: pasta, PLAINUS_ESPERA_GRAVAR: '0' }), stdio: ['ignore', 'pipe', 'pipe']
});
let fala = '';
servidor.stdout.on('data', (d) => { fala += d; });
servidor.stderr.on('data', (d) => { fala += d; });
process.on('exit', () => { try { servidor.kill(); } catch (e) { /* já saiu */ } fs.rmSync(pasta, { recursive: true, force: true }); });

const post = (rota, corpo) => fetch(SITE + '/api/' + rota, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
  .then(async (r) => ({ status: r.status, corpo: await r.json().catch(() => null) }));

/* Uma conexão de navegador, com o que ela recebe guardado. */
function conectar(extra) {
  const s = io(SITE, Object.assign({ transports: ['websocket'], forceNew: true, reconnection: false }, extra || {}));
  s.recebidos = [];
  s.presenca = null;
  s.on('mesa', (p) => s.recebidos.push(p));
  s.on('presenca', (p) => { s.presenca = p; });
  return s;
}
const pedir = (s, evento, dados) => new Promise((r) => s.emit(evento, dados, r));
const conectou = (s) => new Promise((r) => { s.on('connect', () => r(true)); s.on('connect_error', () => r(false)); });
const ultima = (s) => s.recebidos[s.recebidos.length - 1];

(async function () {
  for (let i = 0; i < 50 && !fala.includes('no ar'); i++) await espera(100);
  ok(fala.includes('no ar'), 'o servidor liga');

  /* ================= as rotas da entrada ================= */
  const base = estadoVazio();
  base.campanha.nome = 'Mesa de teste'; base.mestre.nome = 'Thiago';
  base.npcs.push({ id: 'n1', nome: 'O Encapuzado', segredo: 'É o rei', conhecido: false });
  const criada = await post('campanhas', { estado: base });
  ok(criada.status === 200 && /^c[0-9a-f]{16}$/.test(criada.corpo.id) && criada.corpo.chave, 'criar campanha: id, código e a chave do Mestre');
  const { id, codigo, chave: chaveMestre } = criada.corpo;
  ok((await post('campanhas', { estado: { campanha: { nome: '' } } })).status === 400, 'criar campanha sem nome: 400');
  ok((await post('campanhas', { estado: 'x'.repeat(9 * 1024 * 1024) })).status === 413, 'pedido de 9 MB: recusado antes de ser lido (413)');

  ok((await post('entrar', { codigo: 'AAAA-BBBB-CCCC', nome: 'Ana' })).status === 404, 'entrar com código que não existe: 404');
  const ana = (await post('entrar', { codigo: codigo.toLowerCase().replace(/-/g, ' '), nome: 'Ana' })).corpo;
  ok(ana.campanhaId === id && /^j[0-9a-f]{16}$/.test(ana.jogadorId) && ana.chave, 'a Ana entra com o código (escrito do jeito dela): jogadorId e chave');
  const outraAna = await post('entrar', { codigo: codigo, nome: 'ana' });
  ok(outraAna.status === 409 && /Já tem alguém com esse nome/.test(outraAna.corpo.erro), 'alguém tentando entrar como "ana" de novo: recusado (409)');
  const bruno = (await post('entrar', { codigo: codigo, nome: 'Bruno' })).corpo;

  const cartoes = (await post('cartoes', { mesas: [
    { campanhaId: id, papel: 'mestre', chave: chaveMestre },
    { campanhaId: id, papel: 'jogador', jogadorId: ana.jogadorId, chave: ana.chave },
    { campanhaId: id, papel: 'mestre', chave: ana.chave }
  ] })).corpo.cartoes;
  ok(cartoes[0].nome === 'Mesa de teste' && cartoes[0].codigo === codigo && cartoes[0].papel === 'mestre', 'cartão do Mestre: nome e código de convite');
  ok(cartoes[1].papel === 'jogador' && cartoes[1].codigo === null && cartoes[1].meuNome === 'Ana', 'cartão da Ana: sem o código (quem convida é o Mestre), com o nome dela');
  ok(cartoes[2].semAcesso === true && !cartoes[2].nome, 'a chave da Ana pedindo o cartão como Mestre: sem acesso, sem dados');
  ok(!JSON.stringify(cartoes).includes('É o rei'), 'nenhum cartão leva segredo do Mestre');

  const backup = await post('backup', { campanhaId: id, chave: chaveMestre });
  ok(backup.status === 200 && backup.corpo.formato === 'plainus-campanha' && backup.corpo.estado.npcs[0].segredo === 'É o rei' && !('acessos' in backup.corpo), 'backup com a chave do Mestre: a campanha inteira, sem chaves');
  ok((await post('backup', { campanhaId: id, chave: ana.chave })).status === 403, 'backup com a chave da Ana: 403 (o backup tem os segredos)');

  /* ================= a mesa em tempo real ================= */
  const deFora = conectar({ extraHeaders: { origin: 'http://site-malicioso.com' } });
  ok(!(await conectou(deFora)), 'conexão vinda de outro site: recusada');

  const mestre = conectar();
  await conectou(mestre);
  ok((await pedir(mestre, 'entrar', { campanhaId: id, papel: 'mestre', chave: 'chave-errada' })).erro, 'entrar como Mestre com chave errada: recusado');
  ok((await pedir(mestre, 'entrar', { campanhaId: id, papel: 'mestre', chave: ana.chave })).erro, 'entrar como Mestre com a chave da Ana: recusado');
  const m = await pedir(mestre, 'entrar', { campanhaId: id, papel: 'mestre', chave: chaveMestre });
  await espera(100);
  ok(m.ok && m.nome === 'Thiago' && ultima(mestre).papel === 'mestre' && ultima(mestre).estado.npcs[0].segredo === 'É o rei', 'o Mestre entra e recebe a campanha inteira');

  const jogA = conectar();
  await conectou(jogA);
  ok((await pedir(jogA, 'entrar', { campanhaId: id, papel: 'jogador', jogadorId: bruno.jogadorId, chave: ana.chave })).erro, 'a chave da Ana com o id do Bruno: recusado');
  await pedir(jogA, 'entrar', { campanhaId: id, papel: 'jogador', jogadorId: ana.jogadorId, chave: ana.chave, nome: 'Mestre Supremo' });
  await espera(100);
  const visao = ultima(jogA);
  ok(visao.papel === 'jogador' && visao.visao.campanha.nome === 'Mesa de teste' && !('estado' in visao), 'a Ana recebe só a VISÃO dela');
  ok(!JSON.stringify(visao).includes('É o rei') && !JSON.stringify(visao).includes('Encapuzado'), '…sem o NPC desconhecido e sem o segredo');
  ok(mestre.presenca && mestre.presenca.map((p) => p.nome).join() === 'Thiago,Ana', 'presença com os nomes do SERVIDOR (a Ana tentou se chamar "Mestre Supremo")');

  /* ação do Mestre: mesma semente, mesmo resultado */
  const semente = novaSemente();
  const local = JSON.parse(JSON.stringify(ultima(mestre).estado));
  const rLocal = aplicarAcao('entrarNoCombate', local, { molde: { nome: 'Goblin', pv: 7, bonusIniciativa: 2 } }, semente);
  const recebidosAna = jogA.recebidos.length;
  const rServ = await pedir(mestre, 'acao', { nome: 'entrarNoCombate', dados: { molde: { nome: 'Goblin', pv: 7, bonusIniciativa: 2 } }, semente: semente });
  await espera(150);
  ok(rServ.resultado && rServ.resultado.combatente.iniciativa === rLocal.combatente.iniciativa && rServ.resultado.combatente.id === rLocal.combatente.id, 'ação do Mestre: o servidor chega ao MESMO resultado da tela (iniciativa ' + rLocal.combatente.iniciativa + ', mesmo id)');
  ok(JSON.stringify(ultima(mestre).estado.combate) === JSON.stringify(local.combate), 'a campanha que volta para o Mestre é igual à que a tela dele calculou');
  ok(jogA.recebidos.length === recebidosAna + 1 && ultima(jogA).visao.combate.combatentes[0].vida === 'Ileso' && !('pv' in ultima(jogA).visao.combate.combatentes[0]), 'a Ana vê o Goblin entrar — "Ileso", sem o PV');

  const antesNpc = jogA.recebidos.length;
  await pedir(mestre, 'acao', { nome: 'salvarItem', dados: { lista: 'npcs', item: { id: 'n2', nome: 'Espião', conhecido: false } }, semente: novaSemente() });
  await espera(150);
  ok(jogA.recebidos.length === antesNpc, 'o Mestre cria um NPC secreto: nada é enviado à Ana (a visão dela não mudou)');
  await pedir(mestre, 'acao', { nome: 'salvarItem', dados: { lista: 'npcs', item: { id: 'n3', nome: 'Barnabé', conhecido: true } }, semente: novaSemente() });
  await espera(150);
  ok(jogA.recebidos.length === antesNpc + 1 && ultima(jogA).visao.conhecidos.some((n) => n.nome === 'Barnabé'), 'um NPC conhecido: a Ana recebe, na hora');

  ok((await pedir(mestre, 'acao', { nome: 'salvarItem', dados: { lista: 'npcs', item: { id: 'n4', nome: 'x' } } })).erro, 'ação sem semente: recusada');
  ok((await pedir(jogA, 'acao', { nome: 'apagarItem', dados: { lista: 'npcs', id: 'n3' }, semente: novaSemente() })).erro === 'Só o Mestre faz isso.', 'a Ana tentando uma ação de Mestre: "Só o Mestre faz isso."');

  /* ação de jogador */
  const fh = await pedir(jogA, 'acaoJogador', { nome: 'salvarHeroi', dados: { heroi: { id: 'h1', nome: 'Lyra', dono: bruno.jogadorId, pvMax: 12, ca: 15, nivel: 1 } } });
  await espera(150);
  const lyra = ultima(mestre).estado.herois.find((h) => h.id === 'h1');
  ok(fh.resultado && lyra && lyra.dono === ana.jogadorId && lyra.jogador === 'Ana', 'a Ana cria a Lyra: o dono é ela (o "dono: Bruno" que ela mandou foi ignorado)');
  ok(ultima(jogA).visao.meuHeroi && ultima(jogA).visao.meuHeroi.nome === 'Lyra', '…e a visão dela já traz a Lyra como "meu herói"');
  ok((await pedir(jogA, 'acaoJogador', { nome: 'mensagem', dados: { canal: 'privado:' + bruno.jogadorId, texto: 'psiu' } })).erro, 'a Ana escrevendo na conversa privada do Bruno: recusado');
  ok((await pedir(mestre, 'acaoJogador', { nome: 'mensagem', dados: { canal: 'privado:' + ana.jogadorId, texto: 'Rola Percepção.' } })).resultado, 'o Mestre manda mensagem privada à Ana');
  await espera(150);
  ok(ultima(jogA).visao.mensagens.some((x) => x.texto === 'Rola Percepção.' && x.autor.papel === 'mestre'), '…e ela recebe');

  /* o disco */
  await espera(200);
  const arquivo = JSON.parse(fs.readFileSync(path.join(pasta, 'campanhas', id + '.json'), 'utf8'));
  ok(arquivo.estado.herois.some((h) => h.nome === 'Lyra') && arquivo.estado.npcs.some((n) => n.nome === 'Barnabé'), 'tudo isso já está gravado em data/campanhas/');

  /* saiu da mesa */
  jogA.disconnect();
  await espera(200);
  ok(mestre.presenca.map((p) => p.nome).join() === 'Thiago', 'a Ana fecha a aba: some da presença');

  mestre.disconnect();
  console.log(falhas ? '\n' + falhas + ' FALHAS' : '\nO servidor por fora: certo.');
  process.exit(falhas ? 1 : 0);
})();
