/* O armazém do servidor (servidor/armazem.js), numa pasta temporária. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { criarArmazem } = require('../../servidor/armazem.js');
const { estadoVazio, conferirCampanha } = require('../../publico/modelo.js');

let falhas = 0;
const ok = (c, t) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + t); if (!c) falhas++; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

(async function () {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'plainus-armazem-'));
  const avisos = [];
  const a = criarArmazem(pasta, (t) => avisos.push(t));
  ok(a.carregar() === 0, 'pasta nova: nenhuma campanha');

  /* criar */
  const nova = estadoVazio();
  nova.campanha.nome = 'Crônicas de Ravendusk';
  nova.campanha.codigo = 'K7QM-2XRP-9HVD';
  nova.mestre.nome = 'Thiago';
  nova.npcs.push({ id: 'n1', nome: 'Barnabé' });
  const r = a.criar(nova);
  ok(/^c[0-9a-f]{16}$/.test(r.id) && r.codigo === 'K7QM-2XRP-9HVD', 'criar: id novo, e o código de convite mantido');
  const arquivo = path.join(pasta, 'campanhas', r.id + '.json');
  ok(fs.existsSync(arquivo), 'criar grava na hora: ' + path.basename(arquivo));

  /* o arquivo é um backup válido */
  const envelope = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  ok(envelope.formato === 'plainus-campanha' && envelope.versao === 1 && typeof conferirCampanha(envelope.estado) === 'object' && envelope.estado.npcs[0].nome === 'Barnabé', 'o arquivo do disco tem o formato do backup (dá para restaurar em outro lugar)');

  /* código repetido */
  const outra = estadoVazio();
  outra.campanha.nome = 'Outra';
  outra.campanha.codigo = 'k7qm 2xrp 9hvd';
  const r2 = a.criar(outra);
  ok(r2.codigo !== 'K7QM-2XRP-9HVD' && /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(r2.codigo), 'código já usado (mesmo escrito diferente): ganha outro (' + r2.codigo + ')');
  ok(a.acharPorCodigo('k7qm-2xrp-9hvd') === r.id && a.acharPorCodigo('lixo') === null, 'achar pelo código, do jeito que a pessoa digitar');

  /* o que vem de fora é conferido */
  ok(a.criar({ campanha: { nome: '' } }).erro, 'campanha sem nome: recusada');
  const lixo = estadoVazio(); lixo.campanha.nome = 'Com lixo'; lixo.herois = 'não sou lista'; lixo.chaveInventada = 'x';
  const r3 = a.criar(lixo);
  ok(Array.isArray(a.ler(r3.id).herois) && !('chaveInventada' in a.ler(r3.id)), 'parte com tipo errado vira vazia; chave desconhecida some');

  /* ids que não são ids */
  ok(a.ler('../../etc/passwd') === null && a.ler('c' + 'g'.repeat(16)) === null && a.ler(undefined) === null, 'ler com "id" que é caminho ou lixo: nada (nunca vira caminho de arquivo)');

  /* gravação agrupada */
  const estado = a.ler(r.id);
  estado.npcs.push({ id: 'n2', nome: 'Selis' });
  a.mudou(r.id); a.mudou(r.id); a.mudou(r.id);
  ok(JSON.parse(fs.readFileSync(arquivo, 'utf8')).estado.npcs.length === 1, 'mudou(): ainda não gravou (espera agrupar)');
  await espera(1000);
  ok(JSON.parse(fs.readFileSync(arquivo, 'utf8')).estado.npcs.length === 2, '…e um instante depois grava, uma vez só, com tudo');
  estado.npcs.push({ id: 'n3', nome: 'Kor' });
  a.mudou(r.id);
  a.gravarPendentes();
  ok(JSON.parse(fs.readFileSync(arquivo, 'utf8')).estado.npcs.length === 3, 'gravarPendentes() (o Ctrl+C) grava o que estava esperando');
  ok(!fs.readdirSync(path.join(pasta, 'campanhas')).some((n) => n.endsWith('.tmp')), 'nenhum arquivo temporário sobrando');

  /* recarregar: outro armazém, mesma pasta (o servidor reiniciando) */
  fs.writeFileSync(path.join(pasta, 'campanhas', 'c0000000000000000.json'), '{ isto não é json');
  fs.writeFileSync(path.join(pasta, 'campanhas', 'c1111111111111111.json'), JSON.stringify({ formato: 'outra-coisa' }));
  fs.writeFileSync(path.join(pasta, 'campanhas', 'nao-sou-id.json'), '{}');
  fs.writeFileSync(path.join(pasta, 'campanhas', r.id + '.json.tmp'), 'meio arquivo');
  const avisos2 = [];
  const b = criarArmazem(pasta, (t) => avisos2.push(t));
  ok(b.carregar() === 3, 'servidor reiniciado: as 3 campanhas boas voltam');
  ok(b.ler(r.id).npcs.length === 3 && b.ler(r.id).campanha.nome === 'Crônicas de Ravendusk', '…com tudo o que tinham');
  ok(avisos2.length === 2 && fs.existsSync(path.join(pasta, 'campanhas', 'c0000000000000000.json')), 'arquivo corrompido: avisado e deixado de lado — não apagado');
  ok(b.listar()[0].nome && b.listar().every((x) => x.id && x.codigo), 'listar: um resumo por campanha (nome, código, sessão...)');

  /* ---------- as chaves ---------- */
  const c = criarArmazem(pasta);
  c.carregar();
  const base = estadoVazio(); base.campanha.nome = 'Mesa com chave'; base.mestre.nome = 'Thiago';
  /* um personagem que veio de um backup: tem dono, mas ninguém tem a chave dele */
  base.herois.push({ id: 'h1', nome: 'Lyra', jogador: 'Ana', dono: 'jaaaaaaaaaaaaaaaa', pv: 9, pvMax: 9 });
  const mesa = c.criar(base);
  ok(typeof mesa.chave === 'string' && mesa.chave.length >= 30, 'criar devolve a chave do Mestre (uma vez só)');
  const noDisco = fs.readFileSync(path.join(pasta, 'campanhas', mesa.id + '.json'), 'utf8');
  ok(!noDisco.includes(mesa.chave) && /"mestres":\["[0-9a-f]{64}"\]/.test(noDisco), 'o disco guarda só o RESUMO da chave, nunca a chave');
  ok(c.conferirAcesso(mesa.id, 'mestre', null, mesa.chave), 'a chave certa abre como Mestre');
  ok(!c.conferirAcesso(mesa.id, 'mestre', null, mesa.chave + 'x') && !c.conferirAcesso(mesa.id, 'mestre', null, '') && !c.conferirAcesso(mesa.id, 'mestre', null, undefined), 'chave errada, vazia ou ausente: não abre');
  ok(!c.conferirAcesso(mesa.id, 'jogador', null, mesa.chave), 'a chave do Mestre não abre como jogador sem id');

  const bruno = c.entrarComoJogador(mesa.id, 'Bruno');
  ok(/^j[0-9a-f]{16}$/.test(bruno.jogadorId) && bruno.chave && !bruno.reivindicou, 'Bruno entra: jogador novo, chave nova');
  ok(c.conferirAcesso(mesa.id, 'jogador', bruno.jogadorId, bruno.chave) && !c.conferirAcesso(mesa.id, 'mestre', null, bruno.chave), 'a chave do Bruno abre o Bruno — e não o Mestre');
  ok(c.entrarComoJogador(mesa.id, '  bruno ').erro && c.entrarComoJogador(mesa.id, 'BRUNO').erro, '"bruno" e "BRUNO" de novo: recusado (o nome já tem dono)');
  const ana = c.entrarComoJogador(mesa.id, 'Ána');
  ok(ana.reivindicou && ana.jogadorId === 'jaaaaaaaaaaaaaaaa', 'a Ana (escrito "Ána") reivindica a Lyra que veio do backup — mesmo jogadorId do personagem');
  ok(c.entrarComoJogador(mesa.id, 'Ana').erro, '…e depois disso ninguém mais entra como Ana');
  ok(c.nomeDoJogador(mesa.id, bruno.jogadorId) === 'Bruno' && c.nomeDoJogador(mesa.id, 'jinventado000000') === null, 'o nome de cada jogador vem do servidor');
  ok(c.entrarComoJogador(mesa.id, '').erro && c.entrarComoJogador('c' + '0'.repeat(16), 'X').erro, 'nome vazio ou campanha que não existe: recusado');
  const backup = c.envelopeDeBackup(mesa.id);
  ok(backup.formato === 'plainus-campanha' && !('acessos' in backup) && !JSON.stringify(backup).includes('"resumo"'), 'o backup baixado leva a campanha e nenhuma chave (nem resumo)');

  /* reiniciar não perde as chaves */
  const d = criarArmazem(pasta);
  d.carregar();
  ok(d.conferirAcesso(mesa.id, 'mestre', null, mesa.chave) && d.conferirAcesso(mesa.id, 'jogador', bruno.jogadorId, bruno.chave), 'servidor reiniciado: as chaves continuam valendo');

  /* ---- a senha do Mestre ---- */
  const codigoMesa = c.resumo(mesa.id).codigo;
  ok(!c.temSenha(mesa.id) && (await c.entrarComoMestre(codigoMesa, 'qualquercoisa')).erro.includes('ainda não tem senha'), 'sem senha definida: entrar como Mestre noutro computador explica o que fazer');
  ok((await c.definirSenha(mesa.id, 'curta')).erro, 'senha com menos de 8 caracteres: recusada');
  ok(!(await c.definirSenha(mesa.id, 'lua nova sobre Valkoria')).erro && c.temSenha(mesa.id), 'senha definida');
  const comSenha = fs.readFileSync(path.join(pasta, 'campanhas', mesa.id + '.json'), 'utf8');
  ok(!comSenha.includes('lua nova') && /"senha":\{"sal":"[0-9a-f]{32}","resumo":"[0-9a-f]{64}"\}/.test(comSenha), 'o disco guarda o sal e o resumo (scrypt), nunca a senha');
  ok(!JSON.stringify(c.envelopeDeBackup(mesa.id)).includes('"sal"') && !JSON.stringify(c.ler(mesa.id)).includes('"sal"'), 'a senha não entra na campanha nem no backup');
  const errada = await c.entrarComoMestre(codigoMesa, 'lua cheia sobre Valkoria');
  const codigoErrado = await c.entrarComoMestre('ZZZZ-ZZZZ-ZZZZ', 'lua nova sobre Valkoria');
  ok(errada.erro && errada.erro === codigoErrado.erro, 'senha errada e código errado dão a MESMA mensagem: "' + errada.erro + '"');
  const outroPc = await c.entrarComoMestre(codigoMesa.toLowerCase(), 'lua nova sobre Valkoria');
  ok(outroPc.campanhaId === mesa.id && outroPc.chave && outroPc.chave !== mesa.chave && outroPc.nome === base.mestre.nome, 'código + senha certos: uma chave de Mestre NOVA, só deste computador');
  ok(c.conferirAcesso(mesa.id, 'mestre', null, outroPc.chave) && c.conferirAcesso(mesa.id, 'mestre', null, mesa.chave), 'as duas chaves de Mestre valem (a do computador original continua)');
  const reiniciado = criarArmazem(pasta); reiniciado.carregar();
  ok(reiniciado.temSenha(mesa.id) && !(await reiniciado.entrarComoMestre(codigoMesa, 'lua nova sobre Valkoria')).erro, 'servidor reiniciado: a senha continua valendo');

  /* errar demais trava */
  for (let i = 0; i < 10; i++) await c.entrarComoMestre(codigoMesa, 'chute número ' + i);
  const travada = await c.entrarComoMestre(codigoMesa, 'lua nova sobre Valkoria');
  ok(travada.erro && /travada/.test(travada.erro), '10 senhas erradas seguidas: a entrada como Mestre daquela mesa trava (até com a senha certa)');

  /* arquivo do formato antigo (uma chave de Mestre só, "mestre") */
  const antigo = criarArmazem(pasta);
  const molde = JSON.parse(JSON.stringify(base)); molde.campanha.codigo = ''; const velha = antigo.criar(molde);
  const arqVelho = path.join(pasta, 'campanhas', velha.id + '.json');
  const env = JSON.parse(fs.readFileSync(arqVelho, 'utf8'));
  env.acessos = { mestre: env.acessos.mestres[0], jogadores: {} };
  fs.writeFileSync(arqVelho, JSON.stringify(env));
  const lido = criarArmazem(pasta); lido.carregar();
  ok(lido.conferirAcesso(velha.id, 'mestre', null, velha.chave), 'arquivo de antes da senha ("mestre": um resumo só): a chave continua valendo');

  /* apagar */
  ok(b.apagar(r3.id) && !fs.existsSync(path.join(pasta, 'campanhas', r3.id + '.json')) && b.ler(r3.id) === null, 'apagar tira da memória e do disco');

  fs.rmSync(pasta, { recursive: true, force: true });
  console.log(falhas ? falhas + ' FALHAS' : '\nArmazém certo.');
  process.exit(falhas ? 1 : 0);
})();
