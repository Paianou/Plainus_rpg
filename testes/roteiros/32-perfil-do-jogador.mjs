/* O Perfil do jogador: trocar o próprio nome. O nome é a chave de volta
   à mesa, então o servidor confere e muda os dois lugares onde ele mora
   (acessos e herói). */

await ir('index.html');
await js(`document.querySelector('[data-porta="mestrar"]').click(); document.getElementById('nome').value='Thiago'; document.getElementById('campanha').value='Perfil jogador'`);
await clicarENavegar(`document.getElementById('btnCriar').click()`);
await js(`const b=()=>document.getElementById('btnAvancar').click(); b(); document.getElementById('premissa').value='p'; document.getElementById('cenario').value='c'; b(); b(); b(); b();`);
await clicarENavegar(`document.getElementById('btnAvancar').click()`);
const codigo = await js(`Estado.campanha.codigo`);

async function entrar(nome, heroi) {
  const aba = await novaAba();
  await aba.ir('index.html');
  await aba.js(`document.querySelector('[data-porta="convite"]').click(); document.getElementById('nome').value=${JSON.stringify(nome)}; document.getElementById('codigo').value=${JSON.stringify(codigo)};`);
  await aba.navegarPor(`document.getElementById('btnEntrar').click()`);
  await aba.js(digita('#f-nome', heroi) + digita('#f-raca', 'Elfa') + digita('#f-classe', 'Guerreira'));
  await aba.js(`document.querySelector('[data-acao="salvar-ficha"]').click()`); await espera(600);
  await aba.js(`(async()=>{for(let i=0;i<20&&!document.querySelector('.tour-pular');i++)await new Promise(r=>setTimeout(r,100));const b=document.querySelector('.tour-pular');if(b)b.click();})()`); await espera(300);
  return aba;
}
const bruno = await entrar('Bruno', 'Bram');
const ana = await entrar('Ana', 'Lyra');

await ana.js(`document.querySelector('.nav-jogador .codice-site [data-aba="perfil"]').click()`); await espera(400);
ok(await ana.js(`location.hash==='#aba=perfil' && document.querySelector('#cabecaAba h1').textContent==='Perfil' && document.querySelector('.nav-jogador .codice-site .ativo').dataset.aba==='perfil'`), 'Perfil abre como aba e acende no pé do códice');
ok(await ana.js(`document.getElementById('meuNome').value==='Ana' && document.querySelector('label[for="meuNome"]').textContent==='Seu nome na mesa' && /Lyra/.test(document.querySelector('.selo-personagem').textContent)`), 'o campo vem com o nome dela, com rótulo, e o personagem aparece no outro cartão');

/* o nome do Bruno: o servidor recusa */
await ana.js(`document.getElementById('meuNome').value='bruno'; document.querySelector('#formMeuNome button[type="submit"]').click()`);
ok(await aguardar(`document.getElementById('meuNome') && document.getElementById('meuNome').getAttribute('aria-invalid')==='true' && /Já tem alguém com esse nome/.test(document.getElementById('recados').textContent)`, ana.js), '"bruno": recusado pelo servidor — é o nome de outra pessoa da mesa');
ok(await ana.js(`T.gravado().then(e=>e.herois.find(h=>h.nome==='Lyra').jogador==='Ana')`), '…e nada mudou no servidor');

/* o nome novo */
await ana.js(`document.getElementById('meuNome').value='Aninha'; document.querySelector('#formMeuNome button[type="submit"]').click()`);
ok(await aguardar(`document.querySelector('#barraJogador .perfil .nome') && document.querySelector('#barraJogador .perfil .nome').textContent==='Aninha'`, ana.js), 'salvo: a barra do topo já mostra "Aninha"');
ok(await ana.js(`Sessao.ler().nome==='Aninha' && Acessos.listar().some(a=>a.papel==='jogador' && a.nome==='Aninha') && document.activeElement===document.querySelector('#formMeuNome button[type="submit"]')`), '…a sessão e "Suas mesas" deste navegador também; o foco fica no botão');
ok(await ana.js(`T.gravado().then(e=>e.herois.find(h=>h.nome==='Lyra').jogador==='Aninha')`), 'no servidor, a Lyra agora é "jogador: Aninha" (o nome que recupera o personagem)');

/* trocar de novo logo em seguida: o servidor pede para esperar */
ok(await ana.js(`Conexao.mudarMeuNome('Ana Clara').then(r=>!!r.erro && /Espere uns segundos/.test(r.erro))`), 'trocar de novo logo depois: "Espere uns segundos" (uma troca a cada 10 s)');

/* os outros veem */
await bruno.frente();
ok(await aguardar(`Conexao.presentes.some(p=>p.nome==='Aninha') && !Conexao.presentes.some(p=>p.nome==='Ana')`, bruno.js), 'o Bruno vê "Aninha" na lista de quem está na mesa, sem ninguém reconectar');
await cmd('Page.bringToFront');
await ir('configuracoes.html');
ok(await aguardar(`/ANINHA\\s*joga com Lyra/i.test(document.getElementById('configuracoes').textContent)`), 'o Mestre vê "Aninha joga com Lyra" nas Configurações');

/* no chat, a mensagem nova sai com o nome novo */
await ana.frente();
await ana.js(`document.querySelector('.nav-jogador [data-aba="chat"]').click()`); await espera(300);
await ana.js(`Conexao.acaoJogador('mensagem', { canal: 'mesa', texto: 'oi, mudei de nome' })`); await espera(400);
ok(await ana.js(`T.gravado().then(e=>e.mensagens.some(m=>m.texto==='oi, mudei de nome' && m.autor.nome==='Aninha'))`), 'a mensagem nova do chat sai como "Aninha"');

await ana.js(`document.querySelector('.nav-jogador .codice-site [data-aba="perfil"]').click()`); await espera(400);
await ana.foto('32-perfil-jogador');
await bruno.fechar();
await ana.fechar();
console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill(); process.exit(0);
