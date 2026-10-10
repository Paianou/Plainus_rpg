/* uma imagem de teste, gerada na página: um PNG grande (vira JPEG pequeno) */
const gerarFoto = `new Promise(r=>{const c=document.createElement('canvas'); c.width=1200; c.height=1600; const g=c.getContext('2d'); g.fillStyle='#843'; g.fillRect(0,0,1200,1600); g.fillStyle='#fd8'; g.beginPath(); g.arc(600,600,300,0,7); g.fill(); c.toBlob(b=>r(new File([b],'retrato.png',{type:'image/png'})),'image/png');})`;
/* troca o "escolher arquivo" (que abriria a janela do sistema) por um
   arquivo gerado — o resto do caminho (comprimir, salvar) é o de verdade */
const semJanela = `(()=>{ Imagens.escolher = function (perfil, aoEscolher) { ${gerarFoto}.then(a=>Imagens.comprimir(a, perfil)).then(aoEscolher); }; })()`;

/* ---- Mestre: campanha com exemplo ---- */
await ir('index.html');
await js(`document.getElementById('nome').value='Thiago'; document.getElementById('campanha').value='Teste chat'`);
await clicarENavegar(`document.getElementById('btnCriar').click()`);
await js(`const b=()=>document.getElementById('btnAvancar').click(); b(); document.getElementById('premissa').value='p'; document.getElementById('cenario').value='c'; b(); b(); b(); b(); document.querySelector('input[value="exemplo"]').checked=true;`);
await clicarENavegar(`document.getElementById('btnAvancar').click()`);
const codigo = await js(`Estado.campanha.codigo`);

/* ---- Ana e Bruno ---- */
async function jogador(nome, personagem) {
  const aba = await novaAba();
  await aba.ir('index.html');
  await aba.js(`document.getElementById('nome').value='${nome}'; document.getElementById('codigo').value=${JSON.stringify(codigo)};`);
  await aba.navegarPor(`document.getElementById('btnEntrar').click()`);
  await aba.js(digita('#f-nome', personagem) + digita('#f-raca', 'Humano') + digita('#f-classe', 'Guerreiro'));
  await aba.js(`document.querySelector('[data-acao="salvar-ficha"]').click()`); await espera(400);
  return aba;
}
const ana = await jogador('Ana', 'Lyra');
const bruno = await jogador('Bruno', 'Brom');
ok(await ana.js(`!!document.querySelector('.nav-jogador [data-aba="chat"]')`), 'jogador tem a aba Chat');

/* ======== FOTOS ======== */
await ana.js(semJanela);
await ana.js(`document.querySelector('.cabeca-ficha [data-acao="foto-escolher"]').click()`); await espera(1500);
ok(await ana.js(`(()=>{const f=Estado.herois.find(h=>h.nome==='Lyra').ficha.foto; return !!retratoSeguro(f) && f.length < 160000;})()`), 'foto do personagem comprimida (< 160 KB) e salva');
ok(await ana.js(`!!document.querySelector('.cabeca-ficha .retrato-grande img') && !!document.querySelector('.nav-personagem img')`), 'a foto aparece na ficha e na navegação');
await ana.foto('f1-ficha-foto');
await espera(300);
ok(await bruno.js(`(()=>{Memoria.carregar(); Jogador.render(); return [...document.querySelectorAll('.companheiro')].some(c=>c.textContent.includes('Lyra') && c.querySelector('img'));})()`), 'o outro jogador vê a foto da Lyra na party');
await ir('mestre.html');
ok(await js(`[...document.querySelectorAll('article.heroi')].some(a=>a.textContent.includes('Lyra') && a.querySelector('.retrato-heroi img'))`), 'o Mestre vê a foto no cartão do herói');
/* foto inválida é recusada pela ação, mesmo vindo por fora da tela */
ok(await ana.js(`(()=>{const m=Estado.herois.find(h=>h.nome==='Lyra'); const h=JSON.parse(JSON.stringify(m)); h.ficha.foto='data:image/svg+xml;base64,PHN2Zz4='; return enviarMeuHeroi(Sessao.ler(), h)==='Essa foto não é válida. Escolha outra imagem.';})()`), 'foto que não é o JPEG do site é recusada (SVG)');
await ana.js(`document.querySelector('[data-acao="foto-tirar"]').click()`); await espera(300);
ok(await ana.js(`!Estado.herois.find(h=>h.nome==='Lyra').ficha.foto && !document.querySelector('.cabeca-ficha img')`), 'tirar foto volta para a inicial');
await ana.js(`document.querySelector('.cabeca-ficha [data-acao="foto-escolher"]').click()`); await espera(1500);

/* monstros */
await ir('bestiario.html');
await js(semJanela);
await js(`Bestiario.abrir('Esqueleto'); document.querySelector('[data-acao="foto"]').click()`); await espera(1500);
ok(await js(`!!Estado.fotosMonstros['Esqueleto'] && !!document.querySelector('.retrato-bicho img') && [...document.querySelectorAll('.item-compendio')].some(i=>i.textContent.includes('Esqueleto') && i.querySelector('.marca-bicho img'))`), 'foto num monstro do livro: guardada à parte e mostrada na lista e na ficha');
await js(`document.querySelector('[data-acao="duplicar"]').click(); document.getElementById('campo-nome').value='Esqueleto Arqueiro'; document.querySelector('[data-acao="salvar"]').click();`); await espera(300);
ok(await js(`!!acharMonstro('Esqueleto Arqueiro').foto`), 'duplicar leva a foto junto');
await js(`document.querySelector('[data-acao="editar"]').click(); document.getElementById('campo-pv').value='20'; document.querySelector('[data-acao="salvar"]').click();`); await espera(300);
ok(await js(`acharMonstro('Esqueleto Arqueiro').pv===20 && !!acharMonstro('Esqueleto Arqueiro').foto`), 'editar o monstro não apaga a foto');
await js(`Bestiario.abrir('Esqueleto'); document.querySelector('[data-acao="tirar-foto"]').click()`); await espera(300);
ok(await js(`!Estado.fotosMonstros['Esqueleto'] && !!acharMonstro('Esqueleto Arqueiro').foto`), 'tirar a foto do livro não mexe na do seu');
await foto('f2-bestiario-foto');

/* ======== CHAT ======== */
await ir('mestre.html');
ok(await js(`!!document.getElementById('botaoChat')`), 'a barra do Mestre tem o botão de chat');
await js(`document.getElementById('botaoChat').click()`);
const canaisMestre = await js(`[...document.querySelectorAll('#chatCanais .filtro')].map(b=>b.textContent).join('|')`);
ok(canaisMestre === 'Mesa|Lyra (Ana)|Brom (Bruno)', 'o Mestre tem a Mesa e uma conversa por jogador, sem a da equipe: ' + canaisMestre);
await js(`document.getElementById('chatTexto').value='Bem-vindos à cripta.'; document.querySelector('[data-acao="chat-enviar"]').click();`); await espera(500);

/* Ana: aba chat */
await ana.js(`document.querySelector('.nav-jogador [data-aba="chat"]').click()`);
ok(await ana.js(`[...document.querySelectorAll('#chatCanais .filtro')].map(b=>b.textContent.replace(/\\d+$/,'')).join('|')`) === 'Mesa|Equipe|Mestre (privado)', 'a jogadora tem Mesa, Equipe e Mestre (privado)');
ok(await ana.js(`[...document.querySelectorAll('.mensagem .texto-mensagem')].some(m=>m.textContent==='Bem-vindos à cripta.')`), 'a mensagem do Mestre na mesa chega à jogadora');
/* Enter envia */
await ana.js(`(()=>{const c=document.getElementById('chatTexto'); c.value='Oi, mesa!'; c.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));})()`); await espera(500);
ok(await js(`[...document.querySelectorAll('.painel-chat .mensagem')].some(m=>m.textContent.includes('Lyra (Ana)') && m.textContent.includes('Oi, mesa!'))`), 'Enter envia, e o painel aberto do Mestre recebe sem recarregar');
/* equipe: Bruno vê, Mestre não */
await ana.js(`document.querySelector('[data-acao="chat-canal"][data-canal="equipe"]').click(); document.getElementById('chatTexto').value='Plano: ninguém conta ao Mestre.'; document.querySelector('[data-acao="chat-enviar"]').click();`); await espera(500);
ok(await bruno.js(`mensagensDoJogador(Estado, Sessao.ler().jogadorId).some(m=>m.canal==='equipe' && m.texto.startsWith('Plano'))`), 'o outro jogador recebe a conversa da equipe');
ok(await js(`!Chat.mensagens().some(m=>m.canal==='equipe') && !document.querySelector('.painel-chat').textContent.includes('Plano')`), 'o Mestre não vê a conversa da equipe');
ok(await js(`enviarMensagem(Sessao.ler(), 'equipe', 'infiltrado')`) === 'A conversa da equipe é só dos jogadores.', 'o Mestre não consegue escrever na equipe nem por fora da tela');
/* privado: Ana ↔ Mestre; Bruno não vê */
const canalAna = await ana.js(`canalPrivado(Sessao.ler().jogadorId)`);
await ana.js(`document.querySelector('[data-acao="chat-canal"][data-canal="${canalAna}"]').click(); document.getElementById('chatTexto').value='Quero roubar a chave sem ninguém ver.'; document.querySelector('[data-acao="chat-enviar"]').click();`); await espera(500);
ok(await js(`[...document.querySelectorAll('#chatCanais .filtro')].find(b=>b.textContent.startsWith('Lyra'))?.querySelector('.pilula')?.textContent==='1'`), 'a conversa privada da Lyra acende "1" no painel do Mestre');
await js(`document.querySelector('[data-acao="chat-canal"][data-canal="${canalAna}"]').click(); document.getElementById('chatTexto').value='Role Prestidigitação.'; document.querySelector('[data-acao="chat-enviar"]').click();`); await espera(500);
ok(await ana.js(`[...document.querySelectorAll('.mensagem')].some(m=>m.textContent.includes('Role Prestidigitação.'))`), 'a resposta privada do Mestre chega à Ana');
ok(await bruno.js(`!mensagensDoJogador(Estado, Sessao.ler().jogadorId).some(m=>m.texto.includes('roubar a chave') || m.texto.includes('Prestidigitação'))`), 'o outro jogador NÃO recebe a conversa privada');
ok(await bruno.js(`enviarMensagem(Sessao.ler(), ${JSON.stringify(canalAna)}, 'xereta')`) === 'Você não participa dessa conversa.', 'jogador não escreve na conversa privada de outro');
ok(await ana.js(`mensagensDoJogador(Estado, Sessao.ler().jogadorId).every(m=>!('jogadorId' in m.autor))`), 'a visão do chat não expõe o jogadorId de ninguém');
/* contador e "não apaga o que se digita" */
await bruno.js(`document.querySelector('.nav-jogador [data-aba="ficha"]').click()`);
await js(`document.querySelector('[data-acao="chat-canal"][data-canal="mesa"]').click(); document.getElementById('chatTexto').value='Rodada nova.'; document.querySelector('[data-acao="chat-enviar"]').click();`); await espera(500);
ok(Number(await bruno.js(`document.querySelector('.nav-jogador [data-aba="chat"] .pilula')?.textContent || '0'`)) === 4, 'contador da aba Chat do Bruno: 4 não lidas (3 da mesa + 1 da equipe)');
await ana.js(`document.querySelector('[data-acao="chat-canal"][data-canal="mesa"]').click(); (()=>{const c=document.getElementById('chatTexto'); c.value='digitando pela met'; c.focus();})()`);
await js(`document.getElementById('chatTexto').value='Outra mensagem.'; document.querySelector('[data-acao="chat-enviar"]').click();`); await espera(500);
ok(await ana.js(`document.getElementById('chatTexto').value==='digitando pela met' && [...document.querySelectorAll('.mensagem')].some(m=>m.textContent.includes('Outra mensagem.'))`), 'mensagem chegando não apaga o que a jogadora está digitando');
ok(await ana.js(`enviarMensagem(Sessao.ler(), 'mesa', 'x'.repeat(501))`) === 'A mensagem pode ter até 500 caracteres.', 'limite de 500 caracteres');
/* XSS: texto com HTML aparece como texto */
await ana.js(`document.getElementById('chatTexto').value='<img src=x onerror=alert(1)>'; document.querySelector('[data-acao="chat-enviar"]').click();`); await espera(400);
ok(await js(`!document.querySelector('.painel-chat .texto-mensagem img') && [...document.querySelectorAll('.painel-chat .texto-mensagem')].some(t=>t.textContent==='<img src=x onerror=alert(1)>')`), 'HTML no chat aparece como texto, nunca vira elemento');
await ana.foto('c1-chat-jogador');
await foto('c2-chat-mestre');

await ana.tamanho(390, 844);
await ana.foto('c3-chat-celular');
ok(await ana.js(`document.documentElement.scrollWidth <= 390`), 'chat no celular sem rolagem lateral');
await ana.fechar(); await bruno.fechar();

console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill();
process.exit(0);
