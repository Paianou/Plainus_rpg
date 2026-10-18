/* O grupo do site no pé do códice (Perfil, Configurações, Ajuda, Sair),
   a página Configurações do Mestre e a aba Configurações do jogador. */

await ir('index.html');
await js(`document.querySelector('[data-porta="mestrar"]').click(); document.getElementById('nome').value='Thiago'; document.getElementById('campanha').value='Site'`);
await clicarENavegar(`document.getElementById('btnCriar').click()`);
await js(`const b=()=>document.getElementById('btnAvancar').click(); b(); document.getElementById('premissa').value='p'; document.getElementById('cenario').value='c'; b(); b(); b(); b(); document.querySelector('input[value="exemplo"]').checked=true;`);
await clicarENavegar(`document.getElementById('btnAvancar').click()`);
const codigo = await js(`Estado.campanha.codigo`);

/* ---- o grupo do site no códice do Mestre ---- */
await cmd('Emulation.setDeviceMetricsOverride', { width: 1366, height: 820, deviceScaleFactor: 1, mobile: false });
await ir('mestre.html');
ok(await js(`[...document.querySelectorAll('#codice .codice-site .codice-link')].map(a=>a.textContent).join(',')`) === 'Perfil,Configurações,Ajuda,Sair', 'Mestre: no pé do códice, Perfil, Configurações, Ajuda e Sair');
ok(await js(`(()=>{const g=document.querySelector('#codice .codice-site'); const r=document.querySelector('#codice .regra-ativa'); const ult=[...document.querySelectorAll('#codice > .codice-link')].pop(); return g.nextElementSibling===r && g.getBoundingClientRect().top - ult.getBoundingClientRect().bottom > 40;})()`), '…logo acima da Regra ativa, e longe de "Diário & Segredos"');
ok(await js(`document.querySelector('#codice .codice-site').getAttribute('role')==='group' && document.querySelector('#codice .codice-site').getAttribute('aria-label')==='Site'`), 'o grupo se anuncia ao leitor de tela como "Site"');
await js(`scrollTo(0, 1200)`); await espera(200);
ok(await js(`(()=>{const r=document.querySelector('#codice .codice-site').getBoundingClientRect(); return r.top > 0 && r.bottom <= innerHeight;})()`), 'rolando o Panorama, o códice fica preso e o grupo do site continua à vista');
const preso = JSON.parse(await js(`JSON.stringify({codice: document.getElementById('codice').getBoundingClientRect().top, barra: document.getElementById('barraTopo').getBoundingClientRect().bottom})`));
ok(Math.abs(preso.codice - preso.barra) < 1, '…preso logo abaixo da barra, sem entrar por baixo dela (códice em ' + Math.round(preso.codice) + ', barra até ' + Math.round(preso.barra) + ')');
await js(`scrollTo(0, 0); document.querySelector('#codice [data-acao="secao-futura"][data-nome="Perfil"]').click()`); await espera(200);
ok(await js(`/"Perfil" ainda não foi construída/.test(document.getElementById('recados').textContent)`), 'Perfil (ainda não feito) avisa, em vez de levar a uma página vazia');

/* ---- a página Configurações ---- */
await clicarENavegar(`document.querySelector('#codice a[href="configuracoes.html"]').click()`);
ok(await js(`document.querySelector('#codice a[href="configuracoes.html"]').classList.contains('ativo') && document.querySelector('#codice a[href="configuracoes.html"]').getAttribute('aria-current')==='page'`), 'Configurações abre e acende no códice');
ok(await js(`[...document.querySelectorAll('#configuracoes > .cartao > h2')].map(h=>h.textContent.trim()).join('|')`) === 'Preferências deste navegador|Campanha|Jogadores e acessos|Backup|Zona de perigo', 'as cinco seções, na ordem');
ok(await js(`document.querySelector('#configuracoes .codigo-convite').textContent === Estado.campanha.codigo && document.querySelector('#configuracoes a[href="criar-campanha.html?editar=1"]') && document.querySelector('#configuracoes a[href="acessos.html"]')`), 'o código de convite, o "Editar campanha" e o caminho para os Acessos');
const antes = await js(`Dados3D.ativa()`);
await js(`document.querySelector('#configuracoes [data-acao="alternar-animacao"]').focus(); document.querySelector('#configuracoes [data-acao="alternar-animacao"]').click()`); await espera(100);
ok(await js(`Dados3D.ativa()`) === !antes && await js(`document.querySelector('#configuracoes [data-acao="alternar-animacao"]').getAttribute('aria-pressed')`) === String(!antes), 'Preferências: a animação dos dados liga e desliga (a mesma de antes, Dados3D)');
ok(await js(`document.activeElement === document.querySelector('#configuracoes [data-acao="alternar-animacao"]')`), '…e o foco fica no botão');
await js(`document.querySelector('#configuracoes [data-acao="baixar-backup"]').click()`);
ok(await aguardar(`/Último backup desta campanha neste computador: hoje/.test(document.getElementById('configuracoes').textContent)`), 'Baixar backup: baixa e a seção diz "hoje"');
ok(await js(`getComputedStyle(document.querySelector('#configuracoes a.mini-botao')).textDecorationLine === 'none'`), 'os links com cara de botão não ficam sublinhados');

/* ---- o jogador ---- */
const ana = await novaAba();
await ana.ir('index.html');
await ana.js(`document.querySelector('[data-porta="convite"]').click(); document.getElementById('nome').value='Ana'; document.getElementById('codigo').value=${JSON.stringify(codigo)};`);
await ana.navegarPor(`document.getElementById('btnEntrar').click()`);
await ana.js(digita('#f-nome', 'Lyra') + digita('#f-raca', 'Elfa') + digita('#f-classe', 'Guerreira'));
await ana.js(`document.querySelector('[data-acao="salvar-ficha"]').click()`); await espera(600);
await ana.js(`(async()=>{for(let i=0;i<20&&!document.querySelector('.tour-pular');i++)await new Promise(r=>setTimeout(r,100));const b=document.querySelector('.tour-pular');if(b)b.click();})()`); await espera(300);
await ana.js(`document.querySelector('.nav-jogador .codice-site [data-aba="configuracoes"]').click()`); await espera(400);
ok(await ana.js(`location.hash === '#aba=configuracoes' && document.querySelector('.nav-jogador .codice-site .ativo').dataset.aba === 'configuracoes' && document.querySelector('#cabecaAba h1').textContent === 'Configurações'`), 'jogador: Configurações abre como aba, acende no pé do códice e vai para o endereço');
ok(await ana.js(`!document.querySelector('#abasJogador [data-aba="configuracoes"]')`), '…e não entra na fileira de abas do jogo, lá em cima');
ok(await ana.js(`/Seu nome na mesa\\s*Ana/.test(document.getElementById('principal').textContent) && /MESMO nome — "Ana"/.test(document.getElementById('principal').textContent)`), '"Sua entrada na mesa": o nome dela, e como voltar de outro computador');
const avisoAntes = await ana.js(`AvisoVez.ligado()`);
await ana.js(`document.querySelector('#principal [data-acao="alternar-aviso-vez"]').click()`); await espera(100);
ok(await ana.js(`AvisoVez.ligado()`) === !avisoAntes, 'Preferências do jogador: o aviso da vez liga e desliga');
await ana.js(`location.reload()`); await espera(1200);
ok(await ana.js(`document.querySelector('#cabecaAba h1').textContent === 'Configurações'`), 'F5 volta para as Configurações');
await ana.foto('29-jogador-configuracoes');

await ana.fechar();
console.log('\nERROS DE JS:', erros.length ? erros : 'nenhum');
ws.close(); edge.kill(); process.exit(0);
