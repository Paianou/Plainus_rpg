/* Visão Geral, menu de sessão, som, sino de avisos e compêndio — clicando. */
const gravado = (expr) => `(async()=>{const e=(await T.gravado()); return ${expr};})()`;

await ir('index.html');
await js(`document.querySelector('[data-porta="mestrar"]').click(); document.getElementById('nome').value='Thiago'; document.getElementById('campanha').value='Teste geral'`);
await clicarENavegar(`document.getElementById('btnCriar').click()`);
await js(`document.getElementById('btnAvancar').click(); document.getElementById('premissa').value='x'; document.getElementById('cenario').value='y'; const b=()=>document.getElementById('btnAvancar').click(); b(); b(); b(); b(); document.querySelector('input[value="exemplo"]').checked=true`);
await clicarENavegar(`document.getElementById('btnAvancar').click()`);
await js(`localStorage.setItem('plainus:animacao-dados','desligada')`);

/* ---- PV de herói pela Visão Geral ---- */
const h = await js(`(()=>{const h=Estado.herois.find(h=>h.pv>6 && h.pv<h.pvMax); return {id:h.id, nome:h.nome, pv:h.pv, max:h.pvMax};})()`);
await js(`(()=>{const f=document.querySelector('[data-heroi="${h.id}"]'); f.querySelector('.campo-pv').value='3'; f.querySelector('[data-acao="dano"]').click();})()`); await espera(80);
ok(await js(gravado(`e.herois.find(x=>x.id==='${h.id}').pv===${h.pv - 3}`)), 'Visão Geral: dano 3 em ' + h.nome + ' (' + h.pv + ' → ' + (h.pv - 3) + ') gravado');
await js(`(()=>{const f=document.querySelector('[data-heroi="${h.id}"]'); f.querySelector('.campo-pv').value='999'; f.querySelector('[data-acao="cura"]').click();})()`); await espera(80);
ok(await js(gravado(`e.herois.find(x=>x.id==='${h.id}').pv===${h.max}`)), 'cura 999 para no máximo (' + h.max + ')');
await js(`location.href='combate.html'`); await espera(900);
await js(`document.querySelector('[data-acao="add-party"]').click()`); await espera(80);
await ir('mestre.html');
await js(`(()=>{const f=document.querySelector('[data-heroi="${h.id}"]'); f.querySelector('.campo-pv').value='2'; f.querySelector('[data-acao="dano"]').click();})()`); await espera(80);
ok(await js(gravado(`e.combate.combatentes.find(c=>c.heroiId==='${h.id}').pv===${h.max - 2}`)), 'com o herói no combate, o dano da Visão Geral aparece no combate também');

/* ---- rolador, NPC, saque ---- */
await js(`document.querySelector('[data-acao="rolar"][data-faces="20"]').click()`); await espera(80);
ok(await js(gravado(`e.rolagens[0].texto==='Rolagem livre — d20' && e.rolagens[0].total>=1 && e.rolagens[0].total<=20`)), 'rolador do Mestre: d20 gravado');
await js(`document.querySelector('[data-acao="gerar-npc"]').click()`); await espera(80);
ok(await js(gravado(`!!(e.npc && e.npc.nome && e.npc.segredo)`)), 'gerar NPC: guardado com nome e segredo');
await js(`document.querySelector('[data-acao="rolar-saque"]').click()`); await espera(80);
ok(await js(gravado(`/ PO · .* PP · /.test(e.tesouro)`)), 'rolar saque: guardado (' + await js(gravado('e.tesouro')) + ')');

/* ---- som ---- */
await js(`document.querySelector('[data-aba="ferramentas"]') && document.querySelector('[data-aba="ferramentas"]').click()`); await espera(80);
const temSom = await js(`!!document.getElementById('volumeAudio')`);
if (temSom) {
  await js(`(()=>{const v=document.getElementById('volumeAudio'); v.value='17'; v.dispatchEvent(new Event('input',{bubbles:true}));})()`); await espera(60);
  ok(await js(gravado(`e.audio.volume===17`)), 'volume do som ambiente gravado (17)');
  await js(`(()=>{const p=document.getElementById('pistaAudio'); p.value=p.options[p.options.length-1].value; p.dispatchEvent(new Event('change',{bubbles:true}));})()`); await espera(60);
  ok(await js(gravado(`e.audio.tocando===true && e.audio.pista===document.getElementById('pistaAudio').value`)), 'trocar a pista: gravada, e passa a tocar');
}
await js(`document.querySelector('[data-acao="audio-pausar"]').click()`); await espera(60);
ok(await js(gravado(`e.audio.tocando===false`)), 'pausar o som pela barra: gravado');

/* ---- menu de sessão ---- */
const s0 = await js(`Estado.campanha.sessao`);
await js(`document.querySelector('[data-acao="nova-sessao-topo"]').click()`); await espera(60);
await js(`document.getElementById('novaSessaoNumero').value='${s0}'; document.getElementById('novaSessaoTitulo').value='Repetida'; document.querySelector('[data-acao="comecar-sessao"]').click()`); await espera(60);
ok(await js(gravado(`e.campanha.sessao===${s0}`)) && await js(`[...document.querySelectorAll('.recado-flutuante.erro')].some(r=>r.textContent.includes('Já existe uma sessão ${s0}'))`), 'começar sessão com número que já existe: recusado, com aviso');
await js(`document.getElementById('novaSessaoNumero').value='${s0 + 1}'; document.getElementById('novaSessaoTitulo').value='A ponte'; document.querySelector('[data-acao="comecar-sessao"]').click()`); await espera(80);
ok(await js(gravado(`e.campanha.sessao===${s0 + 1} && e.diario.some(d=>d.sessao===${s0 + 1} && d.titulo==='A ponte' && d.emAberto) && !e.diario.find(d=>d.sessao===${s0}).emAberto`)), 'começar a sessão ' + (s0 + 1) + ': gravada, aberta, e a ' + s0 + ' fechada');
ok(await js(`document.querySelector('.titulo-sessao').textContent.includes('A ponte')`), 'a barra do topo mostra a sessão nova');
await js(`document.querySelector('[data-acao="sessao"]').click()`); await espera(60);
await js(`document.getElementById('sessaoTitulo').value='A ponte caída'; document.querySelector('[data-acao="salvar-sessao"]').click()`); await espera(80);
ok(await js(gravado(`e.diario.filter(d=>d.sessao===${s0 + 1}).length===1 && e.diario.find(d=>d.sessao===${s0 + 1}).titulo==='A ponte caída'`)), 'renomear pela barra: a mesma entrada muda');
await js(`document.querySelector('[data-acao="sessao"]').click()`); await espera(60);
await js(`document.querySelector('[data-acao="ir-sessao"][data-numero="${s0}"]').click()`); await espera(80);
ok(await js(gravado(`e.campanha.sessao===${s0}`)), 'voltar para a sessão ' + s0 + ' pelo menu');

/* ---- sino ---- */
await js(`document.querySelector('[data-acao="avisos"]').click()`); await espera(100);
ok(await js(gravado(`Array.isArray(e.avisosVistos) && e.avisosVistos.length===Avisos.calcular().length`)) && await js(`Avisos.novos().length===0`), 'abrir o sino marca os avisos como vistos (gravado)');

/* ---- compêndio ---- */
await ir('compendio.html');
const magia = await js(`document.querySelector('[data-acao="abrir"]') ? (document.querySelector('[data-acao="abrir"]').click(), document.querySelector('[data-acao="fixar"]').dataset.nome) : null`);
await espera(60);
await js(`document.querySelector('[data-acao="fixar"]').click()`); await espera(80);
ok(await js(gravado(`(e.fixadas||[]).includes(${JSON.stringify(magia)})`)), 'compêndio: "' + magia + '" fixada');
await js(`document.querySelector('[data-acao="fixar"]').click()`); await espera(80);
ok(await js(gravado(`!(e.fixadas||[]).includes(${JSON.stringify(magia)})`)), 'e desafixada');

console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill();
process.exit(0);
