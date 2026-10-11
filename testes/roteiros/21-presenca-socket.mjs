/* Socket.IO: quem está na mesa — com o servidor que a base liga (e que
   este roteiro derruba e religa no fim).

   Este roteiro não confia no evento "a página carregou" para saber que
   chegou: com várias abas e um servidor de verdade, o evento da página
   ANTERIOR às vezes chega atrasado e libera o passo seguinte cedo
   demais. Em vez disso, cada passo espera a página certa ficar pronta
   (o endereço e o que precisa existir nela) — ver chegar(). */
/* Pergunta de novo até dar certo (ou desistir). Erro no meio — a página
   trocando bem na hora da pergunta — conta como "ainda não". */
const esperarPor = async (quem, expr, limite) => {
  for (let i = 0; i < (limite || 80); i++) {
    try { if (await quem(expr)) return true; } catch (erro) { /* a página está trocando */ }
    await espera(100);
  }
  return false;
};
/* Faz algo que leva a outra página e espera ela ficar pronta. */
const chegar = async (quem, acao, destino, pronto) => {
  try { await quem(acao); } catch (erro) { /* a navegação pode cortar a resposta */ }
  const chegou = await esperarPor(quem, `location.href===${JSON.stringify(destino)} && document.readyState==='complete' && (${pronto || 'true'})`, 100);
  await espera(250);   /* um respiro: os scripts da página terminam de se ligar */
  return chegou;
};

const textoPresenca = `(document.querySelector('.presenca-mesa')||{}).textContent`;
const naMesa = (n) => `(()=>{const p=document.querySelector('.presenca-mesa'); return !!p && !p.hidden && p.textContent==='${n} na mesa';})()`;
const criarCampanha = (nome) => `(()=>{document.getElementById('btnAvancar').click(); document.getElementById('premissa').value='x'; document.getElementById('cenario').value='y'; for (let i=0;i<5;i++) document.getElementById('btnAvancar').click();})()`;

/* ---- sem servidor (duplo clique): o aviso, e nada tenta conectar ---- */
await ir(urlArquivo('index.html'));
ok(await js(`location.protocol==='file:' && !document.getElementById('avisoServidor').hidden`), 'duplo clique (file://): a entrada avisa para rodar npm start');
await ir(urlArquivo('mestre.html'));
ok(await js(`location.protocol==='file:' && !!document.querySelector('.tela-restrita') && typeof io==='undefined'`), '…e o painel não abre nem tenta conectar');

/* ---- só conecta quem vem do próprio site ---- */
/* Um pedido de WebSocket feito à mão, com o Origin que quisermos:
   101 = aceito (a conexão abriria); qualquer outra resposta = recusado. */
const { request } = await import('node:http');
const aperto = (origem) => new Promise((resolve) => {
  const cab = { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==' };
  if (origem) cab.Origin = origem;
  const pedido = request({ host: '127.0.0.1', port: PORTA_TESTE, path: '/socket.io/?EIO=4&transport=websocket', headers: cab });
  pedido.on('upgrade', (resposta, soquete) => { soquete.destroy(); resolve(101); });
  pedido.on('response', (resposta) => { resposta.resume(); resolve(resposta.statusCode); });
  pedido.on('error', () => resolve('erro'));
  pedido.end();
});
ok(await aperto('http://127.0.0.1:' + PORTA_TESTE) === 101, 'WebSocket vindo do próprio site: aceito');
const deFora = await aperto('http://site-malicioso.com');
ok(deFora !== 101, 'WebSocket vindo de OUTRO site: recusado (' + deFora + ')');
const polling = await fetch(SITE + 'socket.io/?EIO=4&transport=polling').then((r) => r.status);
ok(polling !== 200, 'long-polling desligado: só WebSocket (' + polling + ')');

/* ---- o Mestre, pelo servidor ---- */
await chegar(js, `location.href=${JSON.stringify(SITE)}`, SITE, `!!document.querySelector('[data-porta="mestrar"]') && typeof Entrada!=='undefined'`);
await js(`document.querySelector('[data-porta="mestrar"]').click(); document.getElementById('nome').value='Thiago'; document.getElementById('campanha').value='Mesa ao vivo'`);
await chegar(js, `document.getElementById('btnCriar').click()`, SITE + 'criar-campanha.html', `!!document.getElementById('btnAvancar')`);
ok(await chegar(js, criarCampanha(), SITE + 'mestre.html', `typeof Estado!=='undefined' && Estado.campanha.nome==='Mesa ao vivo'`), 'criar a campanha pelo servidor leva ao painel do Mestre');
const codigo = await js(`Estado.campanha.codigo`);
ok(await esperarPor(js, naMesa(1)), 'Mestre sozinho: "1 na mesa" (' + await js(textoPresenca) + ')');

/* ---- dois jogadores entram pelo link ---- */
const entrar = async (nome) => {
  const aba = await novaAba();
  await chegar(aba.js, `location.href=${JSON.stringify(SITE + 'index.html#convite=' + codigo)}`, SITE + 'index.html#convite=' + codigo, `!!document.getElementById('btnEntrar') && !document.getElementById('formPorta').hidden`);
  await aba.js(`document.getElementById('nome').value=${JSON.stringify(nome)}`);
  await chegar(aba.js, `document.getElementById('btnEntrar').click()`, SITE + 'jogador.html', `typeof Conexao!=='undefined'`);
  return aba;
};
const ana = await entrar('Ana');
ok(await esperarPor(js, naMesa(2)), 'a Ana entra: o Mestre vê "2 na mesa" sem recarregar nada');
const bruno = await entrar('Bruno');
ok(await esperarPor(js, naMesa(3)) && await esperarPor(ana.js, naMesa(3)), 'o Bruno entra: Mestre e Ana veem "3 na mesa"');
const nomes = 'Na mesa agora: Thiago (Mestre), Ana, Bruno';
ok(await esperarPor(js, `document.querySelector('.presenca-mesa').title===${JSON.stringify(nomes)}`), 'os nomes, com o Mestre primeiro: "' + await js(`document.querySelector('.presenca-mesa').title`) + '"');
await foto('p1-mestre-3-na-mesa');

/* ---- o que chega pela conexão é conferido: só a chave abre ---- */
const tentar = (dados) => ana.js(`new Promise(r=>Conexao.socket.emit('entrar', ${dados}, r))`);
const s1 = await tentar(`{campanhaId: Sessao.ler().campanhaId, papel:'jogador', jogadorId: Sessao.ler().jogadorId, chave:'chave-inventada'}`);
ok(/não abre/.test(s1.erro), 'chave inventada: recusada');
const s2 = await tentar(`{campanhaId: Sessao.ler().campanhaId, papel:'mestre', chave: Sessao.ler().chave}`);
ok(/não abre/.test(s2.erro), 'a chave da Ana não abre a mesa como Mestre (problema 1 do CLAUDE.md)');
const s3 = await tentar(`{campanhaId: '../../etc', papel:'jogador'}`);
const s4 = await tentar(`'lixo'`);
ok(/não abre/.test(s3.erro) && /não abre/.test(s4.erro), 'campanha inválida ou pedido fora de formato: recusados');
const s5 = await bruno.js(`new Promise(r=>Conexao.socket.emit('entrar', {campanhaId: Sessao.ler().campanhaId, papel:'jogador', jogadorId: ${JSON.stringify(await ana.js('Sessao.ler().jogadorId'))}, chave: Sessao.ler().chave}, r))`);
ok(/não abre/.test(s5.erro), 'o Bruno não se passa pela Ana com a chave dele (problema 2 do CLAUDE.md)');
await espera(300);
ok(await js(`document.querySelector('.presenca-mesa').title`) === nomes, '…e a lista da mesa não mudou');

/* ---- alguém sai ---- */
await bruno.fechar();
ok(await esperarPor(js, naMesa(2)), 'o Bruno fecha a aba: o Mestre vê "2 na mesa"');

/* ---- o servidor cai e volta ---- */
servidor.kill();
ok(await esperarPor(js, `document.querySelector('.presenca-mesa').classList.contains('caiu') && document.querySelector('.presenca-mesa').textContent==='Sem conexão'`), 'servidor desligado: o indicador fica vermelho, "Sem conexão"');
await foto('p2-sem-conexao');
await ligarServidor();
ok(await esperarPor(js, naMesa(2), 200), 'servidor de volta: os painéis reconectam sozinhos e a lista volta ("2 na mesa")');

await ana.fechar();
console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill();
process.exit(0);
