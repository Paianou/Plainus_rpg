const gravado = (expr) => `(async()=>{const e=(await T.gravado()); return ${expr};})()`;

await ir('index.html');
await js(`document.querySelector('[data-porta="mestrar"]').click(); document.getElementById('nome').value='Thiago'; document.getElementById('campanha').value='Teste bestiário'`);
await clicarENavegar(`document.getElementById('btnCriar').click()`);
await js(`document.getElementById('btnAvancar').click(); document.getElementById('premissa').value='x'; document.getElementById('cenario').value='y'; const b=()=>document.getElementById('btnAvancar').click(); b(); b(); b(); b();`);
await clicarENavegar(`document.getElementById('btnAvancar').click()`);

await ir('bestiario.html');
await js(`document.querySelector('[data-acao="novo"]').click()`); await espera(80);
await js(digita('#campo-nome', 'Lobo Sombrio') + `document.getElementById('campo-ca').value='14'; document.getElementById('campo-pv').value='42'; document.getElementById('campo-nd').value='3';`);
await js(`document.querySelector('[data-acao="salvar"]').click()`); await espera(100);
ok(await js(gravado(`(e.monstrosMeus||[]).some(m=>m.nome==='Lobo Sombrio')`)) && await js(`Bestiario.modo==='leitura' && Bestiario.selecionado==='Lobo Sombrio'`), 'monstro novo: gravado, e a ficha dele aberta');
await js(`document.querySelector('[data-acao="editar"]').click()`); await espera(80);
await js(digita('#campo-nome', 'Lobo das Sombras'));
await js(`document.querySelector('[data-acao="salvar"]').click()`); await espera(100);
ok(await js(gravado(`e.monstrosMeus.length===1 && e.monstrosMeus[0].nome==='Lobo das Sombras'`)), 'editar troca no lugar (um monstro só)');

/* foto */
await js(`(()=>{const c=document.createElement('canvas'); c.width=30; c.height=30; c.getContext('2d').fillRect(0,0,30,30); window._foto=c.toDataURL('image/jpeg',.8);})()`);
await js(`Bestiario.mudarFoto('Lobo das Sombras', window._foto)`); await espera(80);
ok(await js(gravado(`e.monstrosMeus[0].foto===window._foto`)), 'foto do monstro próprio: gravada na ficha dele');
const livro = await js(`todosMonstros().find(m=>!m.meu).nome`);
await js(`Bestiario.mudarFoto(${JSON.stringify(livro)}, window._foto)`); await espera(80);
ok(await js(gravado(`(e.fotosMonstros||{})[${JSON.stringify(livro)}]===window._foto`)), 'foto de monstro do livro (' + livro + '): gravada pelo nome');
await js(`Bestiario.mudarFoto(${JSON.stringify(livro)}, null)`); await espera(80);
ok(await js(gravado(`!((e.fotosMonstros||{})[${JSON.stringify(livro)}])`)), 'tirar a foto');

/* o servidor recusa: a tela volta ao que ele tem. A tela "aplica" a
   foto sozinha e manda ao servidor uma versão que ele não aceita. */
const L = JSON.stringify(livro);
await js(`Estado.fotosMonstros=Object.assign({}, Estado.fotosMonstros, {[${L}]: window._foto}); Conexao.acao('mudarFotoMonstro', {meuId:null, nome:${L}, foto:'data:image/svg+xml;base64,PHN2Zz4='}, novaSemente()); true`);
ok(await aguardar(`!(Estado.fotosMonstros||{})[${L}]`), 'o servidor recusou: a foto NÃO fica na tela (o Estado voltou ao do servidor)');
ok(await aguardar(`[...document.querySelectorAll('.recado-flutuante.erro')].some(r=>r.textContent.startsWith('Essa imagem não é válida'))`), '…e aparece o aviso com o motivo');

/* apagar e desfazer */
await js(`Bestiario.selecionado='Lobo das Sombras'; Bestiario.render(); document.querySelector('[data-acao="apagar"]').click()`); await espera(100);
ok(await js(gravado(`e.monstrosMeus.length===0`)), 'apagar: sai do gravado');
await js(`document.querySelector('.desfazer-recado').click()`); await espera(100);
ok(await js(gravado(`e.monstrosMeus.length===1 && e.monstrosMeus[0].foto===window._foto`)), '"Desfazer": volta, com a foto');
ok(await js(`Bestiario.selecionado==='Lobo das Sombras' && !!document.querySelector('#detalhe') && document.querySelector('#detalhe').textContent.includes('Lobo das Sombras')`), '…e a ficha dele abre (antes o Desfazer selecionava pelo id e não achava)');

console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill();
process.exit(0);
