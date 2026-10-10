/* ---- Mestre: campanha com exemplo ---- */
await ir('index.html');
await js(`document.getElementById('nome').value='Thiago'; document.getElementById('campanha').value='Teste das abas'`);
await clicarENavegar(`document.getElementById('btnCriar').click()`);
await js(`const b=()=>document.getElementById('btnAvancar').click(); b(); document.getElementById('premissa').value='p'; document.getElementById('cenario').value='c'; b(); b(); b(); b(); document.querySelector('input[value="exemplo"]').checked=true;`);
await clicarENavegar(`document.getElementById('btnAvancar').click()`);
const codigo = await js(`Estado.campanha.codigo`);

/* ---- Ana: Lyra, maga que prepara magias ---- */
const ana = await novaAba();
await ana.ir('index.html');
await ana.js(`document.getElementById('nome').value='Ana'; document.getElementById('codigo').value=${JSON.stringify(codigo)};`);
await ana.navegarPor(`document.getElementById('btnEntrar').click()`);
await ana.js(digita('#f-nome', 'Lyra') + digita('#f-raca', 'Elfa') + digita('#f-classe', 'Maga') + digita('[data-base="int"]', 15) + digita('[data-base="for"]', 10));
await ana.js(`(()=>{const s=document.getElementById('f-atributoMagia'); s.value='int'; s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
await ana.js(digita('[data-espaco="1"]', 2));
await ana.js(`['Raio de Fogo','Mísseis Mágicos','Sono','Detectar Magia'].forEach(n=>document.querySelector('[data-magia="'+n+'"]').click()); document.getElementById('f-preparaMagias').click();`);
await ana.js(`document.querySelector('[data-acao="salvar-ficha"]').click()`); await espera(400);

const abas = await ana.js(`[...document.querySelectorAll('.nav-jogador .codice-link')].map(a=>a.dataset.aba).join(',')`);
ok(abas === 'ficha,magias,inventario,mesa,chat,diario,notas,regras', 'oito abas, com Magias porque ela conjura: ' + abas);
ok(await ana.js(`!document.querySelector('[data-acao="conjurar"]') && !!document.querySelector('[data-acao="aba"][data-aba="magias"]')`), 'a ficha mostra só o resumo das magias, com atalho para a aba');

/* ---- aba Magias: preparar ---- */
await ana.js(`document.querySelector('.nav-jogador [data-aba="magias"]').click()`);
ok(await ana.js(`document.querySelector('.contador-preparadas').textContent.startsWith('Preparadas hoje: 0 de 3')`), 'preparadas 0 de 3 (INT +2 + nível 1)');
ok(await ana.js(`document.querySelector('[data-acao="conjurar"][data-nome="Mísseis Mágicos"]').disabled && !document.querySelector('[data-acao="conjurar"][data-nome="Raio de Fogo"]').disabled`), 'magia não preparada não conjura; truque sempre');
await ana.js(`document.querySelector('[data-acao="preparar"][data-nome="Mísseis Mágicos"]').click()`); await espera(300);
ok(await ana.js(`!document.querySelector('[data-acao="conjurar"][data-nome="Mísseis Mágicos"]').disabled && document.querySelector('.contador-preparadas').textContent.startsWith('Preparadas hoje: 1 de 3')`), 'preparar libera o Conjurar e conta 1 de 3');
await ana.js(`document.querySelector('[data-acao="conjurar"][data-nome="Mísseis Mágicos"]').click()`); await espera(300);
ok(await ana.js(`Estado.herois.find(h=>h.nome==='Lyra').ficha.espacosGastos[1]===1`), 'conjurar a preparada gasta o espaço');
await ana.js(`(()=>{const id=Sessao.ler().campanhaId; const e=Campanhas.lerEstado(id); e.herois.find(h=>h.nome==='Lyra').ficha.preparadas=[]; Campanhas.salvarEstado(id,e); Memoria.carregar(); Jogador.render();})(); UsoFicha.conjurar('Mísseis Mágicos');`); await espera(300);
ok(await ana.js(`[...document.querySelectorAll('.recado-flutuante.erro')].some(r=>r.textContent.includes('não está preparada'))`), 'a regra é conferida também fora do botão');
await ana.js(`document.querySelector('[data-acao="filtro-magia"][data-nivel="0"]').click()`);
ok(await ana.js(`[...document.querySelectorAll('.linha-magia .nome-uso')].map(n=>n.textContent).join()==='Raio de Fogo'`), 'filtro "Truques" mostra só o truque');
await ana.foto('a1-magias');

/* ---- aba Inventário ---- */
await ana.js(`document.querySelector('.nav-jogador [data-aba="inventario"]').click()`);
const caAntes = await ana.js(`Estado.herois.find(h=>h.nome==='Lyra').ca`);
await ana.js(`document.getElementById('invLista').value='Couro'; document.querySelector('[data-acao="inv-da-lista"]').click()`); await espera(300);
await ana.js(`document.getElementById('invLista').value='Adaga'; document.querySelector('[data-acao="inv-da-lista"]').click()`); await espera(300);
await ana.js(`document.getElementById('invLista').value='Escudo'; document.querySelector('[data-acao="inv-da-lista"]').click()`); await espera(300);
ok(await ana.js(`document.querySelectorAll('.item-inventario').length===3`), 'três itens da lista no inventário');
await ana.js(`[...document.querySelectorAll('.item-inventario')].find(l=>l.textContent.includes('Couro')).querySelector('[data-acao="inv-equipar"]').click()`); await espera(300);
await ana.js(`[...document.querySelectorAll('.item-inventario')].find(l=>l.textContent.includes('Escudo')).querySelector('[data-acao="inv-equipar"]').click()`); await espera(300);
ok(await ana.js(`Estado.herois.find(h=>h.nome==='Lyra').ca`) === caAntes + 1 + 2, 'vestir couro (+1 sobre 10) e escudo (+2) muda a CA: ' + caAntes + ' → ' + (caAntes + 3));
await ana.js(`[...document.querySelectorAll('.item-inventario')].find(l=>l.textContent.includes('Adaga')).querySelector('[data-acao="inv-equipar"]').click()`); await espera(300);
ok(await ana.js(`Estado.herois.find(h=>h.nome==='Lyra').ficha.ataques.some(a=>a.nome==='Adaga' && a.doItem)`), 'empunhar a adaga cria o ataque dela na ficha');
/* editar a ficha não pode cortar a ligação arma ↔ ataque */
await ana.js(`document.querySelector('.nav-jogador [data-aba="ficha"]').click(); document.querySelector('[data-acao="editar"]').click(); document.querySelector('[data-acao="salvar-ficha"]').click();`); await espera(400);
ok(await ana.js(`!!Estado.herois.find(h=>h.nome==='Lyra').ficha.ataques.find(a=>a.nome==='Adaga').doItem`), 'salvar o "Editar ficha" preserva a ligação com a arma');
await ana.js(`document.querySelector('.nav-jogador [data-aba="inventario"]').click()`);
await ana.js(`[...document.querySelectorAll('.item-inventario')].find(l=>l.textContent.includes('Adaga')).querySelector('[data-acao="inv-equipar"]').click()`); await espera(300);
ok(await ana.js(`!Estado.herois.find(h=>h.nome==='Lyra').ficha.ataques.some(a=>a.nome==='Adaga')`), 'guardar a adaga tira o ataque dela');
/* trocar a armadura pelo formulário: o inventário acompanha (equipado é calculado) */
await ana.js(`document.querySelector('.nav-jogador [data-aba="ficha"]').click(); document.querySelector('[data-acao="editar"]').click(); (()=>{const s=document.getElementById('f-armadura'); s.value=''; s.dispatchEvent(new Event('change',{bubbles:true}));})(); document.querySelector('[data-acao="salvar-ficha"]').click();`); await espera(400);
await ana.js(`document.querySelector('.nav-jogador [data-aba="inventario"]').click()`);
ok(await ana.js(`![...document.querySelectorAll('.item-inventario')].find(l=>l.textContent.includes('Couro')).classList.contains('equipado')`), 'tirar a armadura pelo formulário: o inventário deixa de mostrá-la em uso');
/* itens avulsos, mágicos, sintonia */
for (const n of ['Anel A', 'Anel B', 'Anel C', 'Anel D']) {
  await ana.js(`document.getElementById('invNome').value='${n}'; document.getElementById('invPeso').value='0'; document.getElementById('invMagico').checked=true; document.querySelector('[data-acao="inv-avulso"]').click();`); await espera(250);
}
for (const n of ['Anel A', 'Anel B', 'Anel C', 'Anel D']) {
  await ana.js(`[...document.querySelectorAll('.item-inventario')].find(l=>l.textContent.includes('${n}')).querySelector('[data-acao="inv-sintonia"]').click()`); await espera(250);
}
ok(await ana.js(`Estado.herois.find(h=>h.nome==='Lyra').ficha.itens.filter(i=>i.sintonizado).length===3`) && await ana.js(`[...document.querySelectorAll('.recado-flutuante.erro')].some(r=>r.textContent.includes('3 itens'))`), 'quarta sintonia é recusada (máximo 3)');
await ana.js(`document.getElementById('invNome').value='Tocha'; document.getElementById('invPeso').value='0.5'; document.getElementById('invQtd').value='5'; document.getElementById('invMagico').checked=false; document.querySelector('[data-acao="inv-avulso"]').click();`); await espera(250);
await ana.js(`document.getElementById('invNome').value='Tocha'; document.getElementById('invPeso').value='0.5'; document.getElementById('invQtd').value='3'; document.querySelector('[data-acao="inv-avulso"]').click();`); await espera(250);
ok(await ana.js(`Estado.herois.find(h=>h.nome==='Lyra').ficha.itens.filter(i=>i.nome==='Tocha').length===1 && Estado.herois.find(h=>h.nome==='Lyra').ficha.itens.find(i=>i.nome==='Tocha').quantidade===8`), 'mesmo item avulso soma na quantidade (5 + 3 = 8)');
await ana.js(`(()=>{const e=document.getElementById('moeda-po'); e.value='2000'; e.dispatchEvent(new Event('change',{bubbles:true}));})()`); await espera(300);
ok(await ana.js(`Estado.herois.find(h=>h.nome==='Lyra').ficha.moedas.po===2000`), 'moedas guardadas ao sair do campo');
ok(await ana.js(`(()=>{const f=Estado.herois.find(h=>h.nome==='Lyra').ficha; return Math.abs(Ficha.pesoTotal(f)-(5+0.5+3+4+18))<0.01 && Ficha.cargaMaxima(f)===75;})()`), 'peso: couro 5 + adaga 0,5 + escudo 3 + 8 tochas 4 + 2000 PO 18 = 30,5 kg; carga máx. FOR 10 × 7,5 = 75 kg');
await ana.foto('a2-inventario');

/* ---- aba Anotações ---- */
await ana.js(`document.querySelector('.nav-jogador [data-aba="notas"]').click()`);
await ana.js(`document.getElementById('notaTitulo').value='Selis'; document.getElementById('notaTexto').value='Ela vende informação para todo mundo.'; document.querySelector('[data-acao="nota-salvar"]').click();`); await espera(300);
await ana.js(`document.querySelector('[data-acao="nota-editar"]').click(); document.getElementById('notaTexto').value='Ela vende informação para o Culto também.'; document.querySelector('[data-acao="nota-salvar"]').click();`); await espera(300);
ok(await ana.js(`(()=>{const n=Estado.herois.find(h=>h.nome==='Lyra').ficha.notas; return n.length===1 && n[0].texto.includes('Culto também');})()`), 'anotação criada e editada');
await ana.js(`document.getElementById('notaTexto').value='rascunho pela metade'; document.getElementById('notaTexto').focus();`);
/* o Mestre mexe na outra aba enquanto ela digita */
await js(`document.querySelector('[data-faces="20"]') ? document.querySelector('[data-faces="20"]').click() : (Estado.rolagens.unshift({texto:'x',formula:'d20',total:1}), Memoria.salvar())`); await espera(600);
ok(await ana.js(`document.getElementById('notaTexto')?.value==='rascunho pela metade'`), 'mudança do Mestre não apaga a anotação que está sendo digitada');
await ana.foto('a3-anotacoes');

/* ---- aba Regras e o chip de condição ---- */
await ana.js(`document.querySelector('.nav-jogador [data-aba="regras"]').click()`);
await ana.js(`(()=>{const c=document.getElementById('buscaRegras'); c.focus(); c.value='paralis'; c.dispatchEvent(new Event('input',{bubbles:true}));})()`);
ok(await ana.js(`document.activeElement.id==='buscaRegras' && [...document.querySelectorAll('.item-regra .nome-uso')].map(x=>x.textContent).join()==='Paralisado'`), 'busca "paralis" acha Paralisado, sem perder o foco do campo');
await ana.js(`(()=>{const c=document.getElementById('buscaRegras'); c.value=''; c.dispatchEvent(new Event('input',{bubbles:true}));})(); document.querySelector('[data-acao="regras-tipo"][data-tipo="magias"]').click(); document.querySelector('[data-acao="regras-abrir"][data-nome="Bola de Fogo"]').click();`);
ok(await ana.js(`document.querySelector('.titulo-regra').textContent==='Bola de Fogo'`), 'abre o verbete de uma magia');
ok(await ana.js(`!('BESTIARIO' in window) || ![...document.querySelectorAll('[data-acao="regras-tipo"]')].some(b=>/monstr|besti/i.test(b.textContent))`), 'não há bestiário na aba Regras');
/* chip clicável: Mestre amedronta a Lyra */
await ir('combate.html');
await js(`document.querySelector('[data-acao="add-party"]').click()`);
await js(`(()=>{const c=Estado.combate.combatentes.find(x=>x.nome==='Lyra'); c.condicoes.push('Amedrontado'); Memoria.salvar(); Combate.render();})()`); await espera(500);
await ana.js(`document.querySelector('.nav-jogador [data-aba="mesa"]').click()`);
await ana.js(`document.querySelector('.chip-regra[data-nome="Amedrontado"]').click()`);
ok(await ana.js(`Jogador.aba==='regras' && document.querySelector('.titulo-regra').textContent==='Amedrontado'`), 'clicar no chip "Amedrontado" abre a regra');
await ana.foto('a4-regras');

/* ---- sem magia, sem aba Magias ---- */
await ana.js(`document.querySelector('.nav-jogador [data-aba="ficha"]').click(); document.querySelector('[data-acao="editar"]').click(); (()=>{const s=document.getElementById('f-atributoMagia'); s.value=''; s.dispatchEvent(new Event('change',{bubbles:true}));})(); document.querySelector('[data-acao="salvar-ficha"]').click();`); await espera(400);
ok(await ana.js(`!document.querySelector('.nav-jogador [data-aba="magias"]')`), 'quem não conjura não vê a aba Magias');

/* ---- o layout em três larguras ---- */
await ana.js(`document.querySelector('.nav-jogador [data-aba="ficha"]').click()`);
ok(await ana.js(`(()=>{const n=document.getElementById('navJogador').getBoundingClientRect(); const p=document.getElementById('principal').getBoundingClientRect(); const l=document.getElementById('lateral').getBoundingClientRect(); return n.right <= p.left && p.right <= l.left;})()`), 'tela larga: nav à esquerda, aba no meio, lateral à direita');
await ana.foto('n1-larga');
await ana.tamanho(1100);
ok(await ana.js(`(()=>{const n=document.getElementById('navJogador').getBoundingClientRect(); const p=document.getElementById('principal').getBoundingClientRect(); const l=document.getElementById('lateral').getBoundingClientRect(); return n.bottom <= p.top && l.top >= p.bottom - 1;})()`), 'tela média (como no Mestre): o códice vira faixa no topo e a lateral desce para baixo da aba');
await ana.foto('n2-media');
await ana.tamanho(390, 844);
ok(await ana.js(`(()=>{const n=document.getElementById('navJogador').getBoundingClientRect(); const p=document.getElementById('principal').getBoundingClientRect(); return n.bottom <= p.top + 1 && document.documentElement.scrollWidth <= 390;})()`), 'celular: a nav vira uma fileira no topo, sem rolagem lateral da página');
await ana.foto('n3-celular');
await ana.tamanho(1440);
await ana.js(`document.querySelector('[data-acao="editar"]').click()`);
ok(await ana.js(`document.getElementById('navJogador').hidden && document.querySelector('.colunas-jogador').classList.contains('sem-nav') && document.getElementById('principal').getBoundingClientRect().width > 700`), 'editando a ficha, a nav some e o formulário ocupa o espaço');
await ana.fechar();

console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill();
process.exit(0);
