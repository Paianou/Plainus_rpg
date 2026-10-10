/* ---- Mestre (aba 1): campanha com exemplo ---- */
await ir('index.html');
await js(`document.getElementById('nome').value='Thiago'; document.getElementById('campanha').value='Teste de uso'`);
await clicarENavegar(`document.getElementById('btnCriar').click()`);
await js(`const b=()=>document.getElementById('btnAvancar').click(); b(); document.getElementById('premissa').value='p'; document.getElementById('cenario').value='c'; b(); b(); b(); b(); document.querySelector('input[value="exemplo"]').checked=true;`);
await clicarENavegar(`document.getElementById('btnAvancar').click()`);
const codigo = await js(`Estado.campanha.codigo`);

/* ---- Ana (aba 2): cria a Lyra com ataque, magia e recurso ---- */
const ana = await novaAba();
await ana.ir('index.html');
await ana.js(`document.getElementById('nome').value='Ana'; document.getElementById('codigo').value=${JSON.stringify(codigo)};`);
await ana.navegarPor(`document.getElementById('btnEntrar').click()`);
await ana.js(digita('#f-nome', 'Lyra') + digita('#f-raca', 'Elfa') + digita('#f-classe', 'Maga') + digita('[data-base="int"]', 15) + digita('[data-base="des"]', 13));
ok(await ana.js(`!!document.querySelector('[data-acao="mais-linha"][data-lista="ataques"]') && !!document.getElementById('f-atributoMagia')`), 'formulário tem as seções Ataques, Magia e Recursos');

await ana.js(`document.querySelector('[data-acao="mais-linha"][data-lista="ataques"]').click()`);
ok(await ana.js(`document.getElementById('f-nome').value==='Lyra' && document.querySelector('[data-base="int"]').value==='15'`), 'adicionar ataque não apaga o que já foi digitado');
await ana.js(`(()=>{const s=document.querySelector('[data-ataque="0"] [data-parte="arma"]'); s.value='Adaga'; s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
ok(await ana.js(`(()=>{const l=document.querySelector('[data-ataque="0"]'); return l.querySelector('[data-parte="nome"]').value==='Adaga' && l.querySelector('[data-parte="dano"]').value==='1d4' && l.querySelector('[data-parte="atributo"]').value==='des';})()`), 'escolher "Adaga" preenche nome, 1d4 e DES (acuidade, DES 13 > FOR 8)');
ok(await ana.js(`document.querySelector('[data-calc="ataque-0"]').textContent`) === 'Acerto +3', 'acerto calculado ao vivo: DES +1 + prof 2 = +3');

await ana.js(`(()=>{const s=document.getElementById('f-atributoMagia'); s.value='int'; s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
await ana.js(digita('[data-espaco="1"]', 2));
ok(await ana.js(`document.querySelector('[data-calc="magia"]').textContent.startsWith('CD de magia 12')`), 'CD de magia ao vivo: 8 + 2 + INT 2 = 12');
ok(await ana.js(`document.querySelector('.magias-form .da-classe [data-magia]') !== null && [...document.querySelectorAll('.magias-form label')].findIndex(l=>!l.classList.contains('da-classe')) > 0`), 'magias de Mago aparecem primeiro');
await ana.js(`['Raio de Fogo','Detectar Magia'].forEach(n=>document.querySelector('[data-magia="'+n+'"]').click())`);
await ana.js(`document.querySelector('[data-acao="mais-linha"][data-lista="recursos"]').click()`);
await ana.js(`(()=>{const l=document.querySelector('[data-recurso="0"]'); l.querySelector('[data-parte="nome"]').value='Recuperação Arcana'; l.querySelector('[data-parte="total"]').value='1'; l.querySelector('[data-parte="recarga"]').value='longo'; l.dispatchEvent(new Event('input',{bubbles:true}));})()`);
/* dano inválido é recusado */
await ana.js(`(()=>{const e=document.querySelector('[data-ataque="0"] [data-parte="dano"]'); e.value='muito'; e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
await ana.js(`document.querySelector('[data-acao="salvar-ficha"]').click()`);
ok(await ana.js(`[...document.querySelectorAll('.recado-flutuante.erro')].some(r=>r.textContent.includes('1d8 ou 2d6'))`), 'dano fora do formato de dados é recusado');
await ana.js(`(()=>{const e=document.querySelector('[data-ataque="0"] [data-parte="dano"]'); e.value='1d4'; e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
await ana.foto('u1-formulario');
await ana.js(`document.querySelector('[data-acao="salvar-ficha"]').click()`); await espera(300);
ok(await ana.js(`(()=>{const f=Estado.herois.find(h=>h.nome==='Lyra').ficha; return f.ataques.length===1 && f.ataques[0].dano==='1d4' && f.atributoMagia==='int' && f.espacos[1]===2 && f.magias.length===2 && f.recursos[0].total===1;})()`), 'ficha salva com ataque, magia e recurso');
ok(await ana.js(`!!document.querySelector('[data-acao="atacar"]') && document.querySelectorAll('.bolinha').length===1 && [...document.querySelectorAll('.cartao .sub')].some(x=>x.textContent.includes('CD 12'))`), 'ficha mostra Atacar, o resumo com CD 12 e 1 recurso em bolinha');
await ana.js(`document.querySelector('.nav-jogador [data-aba="magias"]').click()`);
ok(await ana.js(`document.querySelectorAll('.bolinha[data-tipo="espaco"]').length===2`), 'aba Magias mostra os 2 espaços de 1º nível');
await ana.js(`document.querySelector('.nav-jogador [data-aba="ficha"]').click()`);


/* ---- Mestre põe a party no combate ---- */
await ir('combate.html');
await js(`document.querySelector('[data-acao="add-party"]').click()`);
await espera(500);

/* ---- atacar, e o crítico ---- */
await ana.js(`document.querySelector('[data-acao="atacar"]').click()`); await espera(200);
ok(await ana.js(`Campanhas.lerEstado(Sessao.ler().campanhaId).rolagensMesa[0].texto==='Ataque — Adaga'`), 'Atacar rola e registra "Ataque — Adaga"');
await ana.js(`window._d=Layout.dado; Layout.dado=f=>f; document.querySelector('[data-acao="atacar"]').click();`); await espera(200);
ok(await ana.js(`document.querySelector('[data-acao="dano"]').classList.contains('critico-pendente')`), '20 natural deixa o botão de dano marcado como crítico');
await ana.js(`document.querySelector('[data-acao="dano"]').click(); Layout.dado=window._d;`); await espera(200);
ok(await ana.js(`(()=>{const r=Campanhas.lerEstado(Sessao.ler().campanhaId).rolagensMesa[0]; return r.formula.startsWith('2d4 (4, 4) + 1') && r.total===9 && r.marca==='critico';})()`), 'dano crítico: 2d4 (4, 4) + 1 = 9');
await ana.js(`document.querySelector('[data-acao="dano"]').click()`); await espera(200);
ok(await ana.js(`Campanhas.lerEstado(Sessao.ler().campanhaId).rolagensMesa[0].formula.startsWith('1d4 (')`), 'o dano seguinte volta ao normal');

/* ---- conjurar e concentração ---- */
await ana.js(`document.querySelector('.nav-jogador [data-aba="magias"]').click()`);
await ana.js(`document.querySelector('[data-acao="conjurar"][data-nome="Detectar Magia"]').click()`); await espera(400);
ok(await ana.js(`(()=>{const f=Estado.herois.find(h=>h.nome==='Lyra').ficha; return f.espacosGastos[1]===1 && f.concentrando==='Detectar Magia';})()`), 'conjurar gasta um espaço de 1º e começa a concentração');
ok(await ana.js(`!!document.querySelector('.concentrando')`), 'a ficha mostra "Concentrando em Detectar Magia"');
await espera(400);
ok(await js(`Estado.combate.combatentes.find(c=>c.nome==='Lyra').condicoes.includes('Concentrando')`), 'a aba do Mestre vê "Concentrando" na Lyra, no combate');
await ana.js(`document.querySelector('[data-acao="conjurar"][data-nome="Detectar Magia"]').click()`); await espera(300);
await ana.js(`document.querySelector('[data-acao="conjurar"][data-nome="Detectar Magia"]').click()`); await espera(300);
ok(await ana.js(`[...document.querySelectorAll('.recado-flutuante.erro')].some(r=>r.textContent.startsWith('Sem espaço livre'))`), 'sem espaço livre, conjurar é recusado');
await ana.js(`document.querySelector('[data-acao="conjurar"][data-nome="Raio de Fogo"]').click()`); await espera(300);
ok(await ana.js(`Estado.herois.find(h=>h.nome==='Lyra').ficha.espacosGastos[1]===2`), 'truque não gasta espaço');
await ana.js(`document.querySelector('.bolinha.gasta[data-tipo="espaco"]').click()`); await espera(300);
ok(await ana.js(`Estado.herois.find(h=>h.nome==='Lyra').ficha.espacosGastos[1]===1`), 'clicar numa bolinha apagada devolve o espaço');
await ana.foto('u2-ficha-uso');
await ana.js(`document.querySelector('[data-acao="encerrar-concentracao"]').click()`); await espera(500);
ok(await js(`!Estado.combate.combatentes.find(c=>c.nome==='Lyra').condicoes.includes('Concentrando')`), 'encerrar a concentração tira a condição no combate do Mestre');

/* ---- recursos e descansos ---- */
await ana.js(`document.querySelector('.nav-jogador [data-aba="ficha"]').click()`);
await ana.js(`document.querySelector('.bolinha[data-tipo="recurso"]').click()`); await espera(300);
await ana.js(`document.querySelector('[data-acao="descanso-curto"]').click()`); await espera(300);
ok(await ana.js(`Estado.herois.find(h=>h.nome==='Lyra').ficha.recursos[0].gastos===1`), 'descanso curto não recarrega recurso de descanso longo');
await ana.js(`document.querySelector('[data-acao="descanso-longo"]').click()`); await espera(300);
ok(await ana.js(`(()=>{const f=Estado.herois.find(h=>h.nome==='Lyra').ficha; return f.recursos[0].gastos===0 && !f.espacosGastos[1];})()`), 'descanso longo recarrega recurso e espaços');

/* ---- largar a magia na edição encerra a concentração ---- */
await ana.js(`document.querySelector('.nav-jogador [data-aba="magias"]').click()`);
await ana.js(`document.querySelector('[data-acao="conjurar"][data-nome="Detectar Magia"]').click()`); await espera(500);
await ana.js(`document.querySelector('.nav-jogador [data-aba="ficha"]').click()`);
await ana.js(`document.querySelector('[data-acao="editar"]').click()`);
await ana.js(`document.querySelector('[data-magia="Detectar Magia"]').click(); document.querySelector('[data-acao="salvar-ficha"]').click();`); await espera(600);
ok(await ana.js(`Estado.herois.find(h=>h.nome==='Lyra').ficha.concentrando===''`) && await js(`!Estado.combate.combatentes.find(c=>c.nome==='Lyra').condicoes.includes('Concentrando')`), 'tirar a magia da ficha encerra a concentração e a condição');

/* ---- ficha antiga, sem os campos novos ---- */
await ana.js(`(()=>{const id=Sessao.ler().campanhaId; const e=Campanhas.lerEstado(id); const h=e.herois.find(x=>x.nome==='Lyra'); ['ataques','atributoMagia','espacos','espacosGastos','magias','concentrando','recursos'].forEach(k=>delete h.ficha[k]); Campanhas.salvarEstado(id,e);})()`);
await ana.ir('jogador.html');
ok(await ana.js(`document.querySelector('.nome-ficha')?.textContent==='Lyra' && document.querySelectorAll('.cartao').length>3`), 'ficha antiga (sem os campos novos) abre sem quebrar');
await ana.js(`document.querySelector('[data-acao="editar"]').click()`);
ok(await ana.js(`!!document.querySelector('[data-acao="mais-linha"][data-lista="ataques"]')`), 'e o formulário dela também abre');

await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await ana.fechar();
const ana2 = await novaAba();
await ana2.ir('index.html');
await ana2.js(`document.getElementById('nome').value='Ana'; document.getElementById('codigo').value=${JSON.stringify(codigo)};`);
await ana2.navegarPor(`document.getElementById('btnEntrar').click()`);
await ana2.fechar();

console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill();
process.exit(0);
