/* ---- Mestre: campanha vazia ---- */
await ir('index.html');
await js(`document.getElementById('nome').value='Thiago'; document.getElementById('campanha').value='Teste dados'`);
await clicarENavegar(`document.getElementById('btnCriar').click()`);
await js(`const b=()=>document.getElementById('btnAvancar').click(); b(); document.getElementById('premissa').value='p'; document.getElementById('cenario').value='c'; b(); b(); b(); b();`);
await clicarENavegar(`document.getElementById('btnAvancar').click()`);
const codigo = await js(`Estado.campanha.codigo`);

/* ---- Ana ---- */
const ana = await novaAba();
await ana.ir('index.html');
await ana.js(`document.getElementById('nome').value='Ana'; document.getElementById('codigo').value=${JSON.stringify(codigo)};`);
await ana.navegarPor(`document.getElementById('btnEntrar').click()`);
await ana.js(digita('#f-nome', 'Lyra') + digita('#f-raca', 'Elfa') + digita('#f-classe', 'Guerreira') + digita('[data-base="des"]', 15));
await ana.js(`document.querySelector('[data-acao="mais-linha"][data-lista="ataques"]').click()`);
await ana.js(`(()=>{const s=document.querySelector('[data-ataque="0"] [data-parte="arma"]'); s.value='Espada Longa'; s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
await ana.js(`document.querySelector('[data-acao="salvar-ficha"]').click()`); await espera(400);
await ana.fechar();
const { readdirSync, readFileSync } = await import('node:fs');
const PASTA = path.join(AQUI, 'baixados');
rmSync(PASTA, { recursive: true, force: true }); mkdirSync(PASTA, { recursive: true });
await cmd('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: PASTA });

/* escolhe um arquivo no <input type=file> como se a pessoa tivesse escolhido */
async function escolher(arquivo) {
  const doc = await cmd('DOM.getDocument');
  const no = await cmd('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: '#arquivoBackup' });
  await cmd('DOM.setFileInputFiles', { nodeId: no.result.nodeId, files: [arquivo] });
  await espera(500);
}
const gravarTeste = (nome, conteudo) => { const p = path.join(AQUI, nome); writeFileSync(p, conteudo); return p; };

await ir('index.html');
ok(await js(`document.querySelector('.campanha-backup.nunca')?.textContent`) === 'Sem backup', 'campanha sem backup mostra "Sem backup"');
await foto('b1-lista');
await js(`document.querySelector('[data-acao="backup"]').click()`); await espera(1200);
const baixados = readdirSync(PASTA);
ok(baixados.length === 1 && /^plainus-teste-dados-\d{4}-\d\d-\d\d\.json$/.test(baixados[0]), 'baixou o arquivo: ' + baixados.join(', '));
const env = JSON.parse(readFileSync(path.join(PASTA, baixados[0]), 'utf8'));
const codigoOriginal = env.estado.campanha.codigo;
ok(env.formato === 'plainus-campanha' && env.versao === 1 && env.estado.herois.length === 1 && env.estado.herois[0].nome === 'Lyra', 'o arquivo tem o envelope e a campanha inteira (com a Lyra)');
ok(await js(`document.querySelector('.campanha-backup').textContent`) === 'Backup hoje' && /Backup baixado/.test(await js(`document.getElementById('aviso').textContent`)), 'depois de baixar: "Backup hoje" e o aviso azul');
await foto('b2-baixado');

/* As mesas de Mestre deste navegador, com o que o servidor tem de cada uma. */
const mesasDoMestre = () => js(`(async()=>{const r=[]; for (const a of Acessos.listar().filter(a=>a.papel==='mestre')) { const e=await T.gravado(a.campanhaId); r.push({id:a.campanhaId, nome:e.campanha.nome, codigo:e.campanha.codigo, herois:e.herois, diario:e.diario, inventada:'chaveInventada' in e}); } return r;})()`);

/* restaurar o mesmo arquivo com a campanha ainda no servidor: outra campanha, outro código */
const arq = path.join(PASTA, baixados[0]);
await escolher(arq);
await aguardar(`/restaurada/.test(document.getElementById('aviso').textContent)`);
const lista1 = await mesasDoMestre();
ok(lista1.length === 2 && lista1.every(c => c.nome === 'Teste dados') && lista1.some(c => c.codigo === codigoOriginal) && lista1.some(c => c.codigo !== codigoOriginal), 'restaurar com a original no servidor cria OUTRA campanha, com outro código — nada é sobrescrito');
ok(/já estava em uso aqui/.test(await js(`document.getElementById('aviso').textContent`)), 'o aviso explica que o código de convite mudou');
await foto('b3-copia');

/* tirar tudo da lista: um cartão de cada vez (a lista se redesenha pelo servidor) */
for (let i = 0; i < 6 && await js(`!!document.querySelector('[data-acao="esquecer"], [data-acao="tirar-mesa"]')`); i++) {
  const antes = await js(`document.querySelectorAll('.cartao-mesa').length`);
  await js(`document.querySelector('[data-acao="esquecer"], [data-acao="tirar-mesa"]').click()`);
  await aguardar(`document.querySelectorAll('.cartao-mesa').length < ${antes} || document.getElementById('campanhasSalvas').hidden`);
}
ok(await js(`Acessos.listar().length===0 && document.getElementById('campanhasSalvas').hidden && !!document.getElementById('btnRestaurar').offsetParent`), 'sem mesas na lista: ela some, mas o "Restaurar backup" continua à vista');
await escolher(arq);
await aguardar(`!document.getElementById('campanhasSalvas').hidden`);
const lista2 = await mesasDoMestre();
ok(lista2.length === 1 && lista2[0].nome === 'Teste dados' && lista2[0].herois.length === 1, 'restaurou a campanha (com a Lyra), e este navegador é o Mestre dela');
ok(await js(`document.querySelector('.campanha-backup').textContent`) === 'Backup hoje', 'a campanha restaurada já conta como tendo backup');
await js(`document.getElementById('btnRestaurar').scrollIntoView()`);
await foto('b4-restaurada');
await clicarENavegar(`document.querySelector('[data-acao="continuar"]').click()`);
ok(await js(`location.pathname.endsWith('mestre.html') && Estado.herois.length===1 && Estado.herois[0].nome==='Lyra'`), 'Continuar abre o painel do Mestre com a Lyra lá');
await ir('index.html');

/* arquivos ruins */
const ruins = [
  ['nao-json.json', 'isto não é json {', /não é um backup do Plainus/],
  ['outro.json', JSON.stringify({ nome: 'x' }), /não é um backup de campanha/],
  ['futuro.json', JSON.stringify({ formato: 'plainus-campanha', versao: 99, estado: env.estado }), /versão mais nova/],
  ['oco.json', JSON.stringify({ formato: 'plainus-campanha', versao: 1, estado: { herois: [] } }), /incompleto/]
];
for (const [nome, conteudo, esperado] of ruins) {
  await escolher(gravarTeste(nome, conteudo));
  await aguardar(`!!document.getElementById('erro').textContent`);
  const msg = await js(`document.getElementById('erro').textContent`);
  ok(esperado.test(msg) && (await js(`Acessos.listar().length`)) === 1, nome + ': recusado — "' + msg.slice(0, 60) + '…"');
}

/* tipos errados e nome com HTML: entra, mas limpo */
const malvado = JSON.parse(JSON.stringify(env.estado));
malvado.campanha.nome = '<img src=x onerror="window.pegou=1">';
malvado.campanha.codigo = 'nada';
malvado.herois = 'não sou lista';
malvado.diario = { a: 1 };
malvado.chaveInventada = 'lixo';
await escolher(gravarTeste('malvado.json', JSON.stringify({ formato: 'plainus-campanha', versao: 1, estado: malvado })));
await aguardar(`/restaurada/.test(document.getElementById('aviso').textContent) && document.querySelectorAll('.campanha-salva').length===2`);
const nova = (await mesasDoMestre()).find((c) => c.nome.startsWith('<img'));
nova.valido = await js(`!!normalizarCodigo(${JSON.stringify(nova.codigo)})`);
ok(Array.isArray(nova.herois) && nova.herois.length === 0 && Array.isArray(nova.diario) && !nova.inventada, 'partes com tipo errado viram o valor vazio; chave desconhecida é descartada');
ok(nova.valido && nova.codigo !== 'nada', 'código inválido no arquivo: ganha um código novo (' + nova.codigo + ')');
ok(await js(`!document.querySelector('.lista-campanhas img') && !window.pegou && [...document.querySelectorAll('.campanha-nome')].some(e=>e.textContent.startsWith('<img'))`), 'nome com HTML aparece como texto e não executa nada');
await foto('b5-final');
await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await espera(300);
ok(await js(`document.documentElement.scrollWidth <= 390`), 'celular: sem rolagem de lado');
await foto('b6-celular');

console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill(); process.exit(0);
