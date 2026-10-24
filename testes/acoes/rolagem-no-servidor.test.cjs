/* A rolagem do jogador: quem rola é o SERVIDOR (visao.js, ação
   'rolagem'). O navegador só pede o quê; um total mandado por ele é
   ignorado, e o dano crítico só vale depois de um 20 natural. */
const { aplicarAcaoJogador, visaoDoJogador, Sorte } = require('../../publico/visao.js');
let falhas = 0;
const ok = (c, t) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + t); if (!c) falhas++; };

const { estadoVazio } = require('../../publico/modelo.js');
const estado = Object.assign(estadoVazio(), { herois: [{ id: 'h1', dono: 'j1', nome: 'Lyra' }], rolagensMesa: [] });
const ana = { papel: 'jogador', jogadorId: 'j1', nome: 'Ana' };
const bia = { papel: 'jogador', jogadorId: 'j2', nome: 'Bia' };
const rolar = (sessao, pedido) => aplicarAcaoJogador('rolagem', estado, sessao, { rolagem: pedido });

/* um total forjado não passa */
const forjada = rolar(ana, { tipo: 'teste', texto: 'Furtividade', bonus: 3, total: 99, marca: 'critico', formula: 'd20 (20) + 3' });
const r = estado.rolagensMesa[0];
ok(!forjada.erro && r.total >= 4 && r.total <= 23 && r.total === forjada.rolagem.natural + 3, 'teste: o total mandado (99) é ignorado — o servidor rola d20 + 3 (' + r.total + ')');
ok(r.formula === 'd20 (' + forjada.rolagem.natural + ') + 3' && r.personagem === 'Lyra' && r.autor === 'Ana', 'a fórmula e o autor são do servidor: ' + r.formula);
ok(r.marca === (forjada.rolagem.natural === 20 ? 'critico' : forjada.rolagem.natural === 1 ? 'falha' : null), 'a marca vem do dado natural, não do pedido');

/* os dados caem de 1 a faces, e todas as faces aparecem */
const vistas = new Set();
for (let i = 0; i < 400; i++) vistas.add(rolar(ana, { tipo: 'dado', faces: 6 }).rolagem.total);
ok(vistas.size === 6 && Math.min(...vistas) === 1 && Math.max(...vistas) === 6, 'd6: 400 rolagens dão de 1 a 6, todas as faces');
ok(rolar(ana, { tipo: 'dado', faces: 7 }).erro, 'd7 não existe: recusado');
ok(rolar(ana, { tipo: 'trapaca' }).erro, 'tipo desconhecido: recusado');

/* vantagem: dois d20, fica o maior */
const v = rolar(ana, { tipo: 'dado', faces: 20, modo: 'vantagem' }).rolagem;
ok(v.valores.length === 2 && v.natural === Math.max(...v.valores) && /vantagem$/.test(v.formula), 'd20 com vantagem: dois dados, fica o maior');

/* bônus absurdo é cortado */
ok(rolar(ana, { tipo: 'teste', bonus: 500 }).rolagem.bonus === 30, 'bônus de 500 vira 30 (e fica escrito na fórmula)');

/* crítico do dano */
ok(rolar(ana, { tipo: 'dano', faces: 8, quantos: 1, bonus: 2, critico: true }).erro, 'dano "crítico" sem ataque crítico antes: recusado');
Sorte.viciado = 'maximo';
const ataque = rolar(ana, { tipo: 'teste', texto: 'Ataque — Adaga', bonus: 5, ataque: true }).rolagem;
Sorte.viciado = null;
ok(ataque.natural === 20 && ataque.marca === 'critico', 'ataque com 20 natural');
ok(rolar(bia, { tipo: 'dano', faces: 4, quantos: 1, critico: true }).erro, 'o crítico da Ana não vale para a Bia');
rolar(ana, { tipo: 'teste', texto: 'Percepção', bonus: 1 });
const dano = rolar(ana, { tipo: 'dano', texto: 'Dano — Adaga', faces: 4, quantos: 1, bonus: 1, critico: true }).rolagem;
ok(dano && dano.valores.length === 2 && / — crítico$/.test(dano.formula) && dano.marca === 'critico', 'depois do 20 (mesmo com uma perícia no meio): o dano crítico rola o dobro de dados');
ok(rolar(ana, { tipo: 'dano', faces: 4, quantos: 1, critico: true }).erro, 'o crítico vale uma vez: o segundo dano crítico é recusado');

/* o Mestre não usa esta ação; e a visão do jogador não leva os campos internos */
ok(aplicarAcaoJogador('rolagem', estado, { papel: 'mestre' }, { rolagem: { tipo: 'dado', faces: 6 } }).erro, 'o Mestre não rola por aqui');
const vista = visaoDoJogador(estado, 'j2').rolagensMesa[0];
ok(vista && vista.dono === undefined && vista.tipo === undefined && vista.ataque === undefined, 'a visão do jogador não leva dono/tipo/ataque');

process.exit(falhas ? 1 : 0);
