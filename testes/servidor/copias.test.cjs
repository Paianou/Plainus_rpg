/* As cópias de segurança (servidor/copias.js): uma por dia, com a pasta
   de dados inteira; as velhas são podadas; a cópia abre de volta igual. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { criarCopias, lerCopia, quaisApagar } = require('../../servidor/copias.js');
let falhas = 0;
const ok = (c, t) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + t); if (!c) falhas++; };

const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'plainus-copias-'));
const dados = path.join(raiz, 'data');
const destino = path.join(raiz, 'copias');
fs.mkdirSync(path.join(dados, 'campanhas'), { recursive: true });
fs.mkdirSync(path.join(dados, 'imagens'), { recursive: true });
fs.writeFileSync(path.join(dados, 'campanhas', 'a1.json'), '{"nome":"A Velha Cripta"}');
fs.writeFileSync(path.join(dados, 'campanhas', 'a1.json.tmp'), 'pela metade');
fs.writeFileSync(path.join(dados, 'contas.json'), '{"contas":[]}');
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x10, 0x80, 0xff, 0xd9]);
fs.writeFileSync(path.join(dados, 'imagens', 'abc.jpg'), jpeg);

let dia = new Date(2026, 9, 24, 21, 30);          /* 24/10/2026, 21h30, no relógio deste PC */
let antes = 0;
const avisos = [];
const copias = criarCopias(dados, destino, { log: (t) => avisos.push(t), antes: () => { antes++; }, agora: () => dia });

/* ---- a de hoje ---- */
const r = copias.fazerSeFaltar();
ok(r && !r.erro && fs.existsSync(path.join(destino, 'plainus-2026-10-24.json.gz')), 'sem cópia de hoje: faz plainus-2026-10-24.json.gz');
ok(antes === 1, 'antes de copiar, grava o que estava pendente (antes() chamado)');
ok(/Cópia de segurança: .*3 arquivos/.test(avisos[0] || ''), 'o console diz onde ficou e quantos arquivos: ' + avisos[0]);
ok(copias.fazerSeFaltar() === null && antes === 1, 'já tem a de hoje: não faz outra');

const aberta = lerCopia(path.join(destino, 'plainus-2026-10-24.json.gz'));
ok(Object.keys(aberta.arquivos).sort().join() === 'campanhas/a1.json,contas.json,imagens/abc.jpg', 'a cópia leva campanhas, contas e imagens — e não o .tmp');
ok(aberta.arquivos['campanhas/a1.json'].toString() === '{"nome":"A Velha Cripta"}' && aberta.arquivos['imagens/abc.jpg'].equals(jpeg), 'abre de volta igual, inclusive a imagem (bytes)');
ok(!fs.readdirSync(destino).some((n) => n.endsWith('.tmp')), 'não sobra .tmp na pasta das cópias');

/* ---- virou o dia ---- */
dia = new Date(2026, 9, 25, 0, 5);
ok(copias.fazerSeFaltar() && fs.existsSync(path.join(destino, 'plainus-2026-10-25.json.gz')), 'virou o dia (00h05): faz a do dia 25');

/* ---- quantas ficam ---- */
const trinta = [];
for (let i = 0; i < 30; i++) { const d = new Date(2026, 8, 25 + i); trinta.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')); }
const sai = quaisApagar(trinta);
const ficam = trinta.filter((d) => sai.indexOf(d) === -1).sort();
ok(ficam.length === 11, '30 dias de cópias: ficam 11 (' + ficam.join(', ') + ')');
ok(ficam.slice(-7).join() === trinta.slice(-7).join(), '…as 7 mais novas, todas');
const semana = (d) => Math.floor((Date.parse(d + 'T00:00:00Z') / 86400000 - 4) / 7);
ok(new Set(ficam.slice(0, 4).map(semana)).size === 4 && ficam.slice(0, 4).join() === '2026-09-27,2026-10-04,2026-10-11,2026-10-17', '…e 4 semanais: a mais nova de cada uma das 4 semanas anteriores (a do 17/10, porque o domingo 18 já é das diárias)');

trinta.forEach((d) => fs.writeFileSync(path.join(destino, 'plainus-' + d + '.json.gz'), 'x'));
copias.podar();
ok(copias.existentes().length === 11, 'podar() apaga do disco as que passaram da conta');

/* ---- arquivos que não são cópia ---- */
fs.writeFileSync(path.join(raiz, 'estragado.json.gz'), 'isto não é gzip');
let erro = '';
try { lerCopia(path.join(raiz, 'estragado.json.gz')); } catch (e) { erro = e.message; }
ok(/não é uma cópia/.test(erro), 'arquivo estragado: "não é uma cópia do Plainus"');

/* ---- a pasta das cópias dentro da de dados: recusado ---- */
const avisos2 = [];
const dentro = criarCopias(dados, path.join(dados, 'copias'), { log: (t) => avisos2.push(t) });
dentro.ligar();
ok(/DESLIGADAS/.test(avisos2[0] || '') && !fs.existsSync(path.join(dados, 'copias')), 'pasta das cópias dentro de data/: desligadas, com aviso (cada cópia levaria as outras)');

/* ---- pasta sem permissão / caminho impossível: aviso, sem derrubar ---- */
fs.writeFileSync(path.join(raiz, 'arquivo-no-caminho'), 'x');
const avisos3 = [];
const ruim = criarCopias(dados, path.join(raiz, 'arquivo-no-caminho', 'copias'), { log: (t) => avisos3.push(t) });
const r3 = ruim.fazerSeFaltar();
ok(r3 && r3.erro && /NÃO foi feita/.test(avisos3[0] || ''), 'não deu para gravar: vira aviso no console, e o servidor segue');

fs.rmSync(raiz, { recursive: true, force: true });
process.exit(falhas ? 1 : 0);
