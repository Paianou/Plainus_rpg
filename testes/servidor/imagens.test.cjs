/* As imagens fora da campanha (servidor/imagens.js) e os limites do
   armazem.aplicar(), numa pasta temporária. O espaço por campanha fica
   pequeno (300 KB) para o teste não precisar gravar 40 MB. */
process.env.PLAINUS_ESPACO_IMAGENS = String(300 * 1024);
process.env.PLAINUS_ESPERA_GRAVAR = '0';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { criarArmazem } = require('../../servidor/armazem.js');
const { estadoVazio, imagemDaCena, retratoSeguro } = require('../../publico/modelo.js');

let falhas = 0;
const ok = (c, t) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + t); if (!c) falhas++; };

/* Um "JPEG" de mentira, mas com a assinatura certa (FF D8 FF): o
   servidor confere a assinatura e o tamanho, não desenha a imagem. */
const jpeg = (tamanho, semente) => {
  const b = Buffer.alloc(tamanho, semente);
  b[0] = 0xFF; b[1] = 0xD8; b[2] = 0xFF; b[3] = 0xE0;
  return 'data:image/jpeg;base64,' + b.toString('base64');
};
const ENDERECO = /^img\/[0-9a-f]{64}\.jpg$/;

const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'plainus-imagens-'));
const pastaImagens = path.join(pasta, 'imagens');
const arquivos = () => fs.readdirSync(pastaImagens).filter((n) => n.endsWith('.jpg'));
const a = criarArmazem(pasta);
a.carregar();

/* ---- criar: as imagens saem da campanha ---- */
const mapa = jpeg(50000, 1);
const retrato = jpeg(8000, 2);
const e = estadoVazio();
e.campanha.nome = 'Com mapas';
e.mestre.nome = 'Thiago';
e.cenas.push({ id: 's1', nome: 'Cripta', colunas: 8, linhas: 5, paredes: [], tokens: [], imagem: mapa });
e.cenas.push({ id: 's2', nome: 'Cripta de novo', colunas: 8, linhas: 5, paredes: [], tokens: [], imagem: mapa });
e.herois.push({ id: 'h1', nome: 'Lyra', ficha: { foto: retrato } });
e.monstrosMeus.push({ id: 'm1', nome: 'Lobo', foto: retrato });
e.fotosMonstros = { Goblin: jpeg(6000, 3), Falso: 'data:image/jpeg;base64,' + Buffer.from('<svg>não sou jpeg</svg>').toString('base64') };
const r = a.criar(e);
const est = a.ler(r.id);
ok(ENDERECO.test(est.cenas[0].imagem) && ENDERECO.test(est.herois[0].ficha.foto) && ENDERECO.test(est.monstrosMeus[0].foto) && ENDERECO.test(est.fotosMonstros.Goblin), 'mapa, retrato do herói, foto de monstro e do livro viram endereços img/<resumo>.jpg');
ok(est.cenas[0].imagem === est.cenas[1].imagem && est.herois[0].ficha.foto === est.monstrosMeus[0].foto && arquivos().length === 3, 'a mesma imagem duas vezes é UM arquivo (3 arquivos para 5 usos)');
ok(!('Falso' in est.fotosMonstros), 'um "JPEG" que não começa com FF D8 FF é recusado e sai da campanha');
const noDisco = fs.readFileSync(path.join(pasta, 'campanhas', r.id + '.json'), 'utf8');
ok(!noDisco.includes('base64') && noDisco.length < 5000, 'o arquivo da campanha fica leve: ' + noDisco.length + ' letras, sem imagem dentro');
ok(imagemDaCena(est.cenas[0]) === est.cenas[0].imagem && retratoSeguro(est.herois[0].ficha.foto) === est.herois[0].ficha.foto, 'as conferências do site (modelo.js) aceitam o endereço');
ok(imagemDaCena({ imagem: 'img/../../server.js' }) === null && imagemDaCena({ imagem: 'img/' + 'a'.repeat(64) + '.png' }) === null, '…e só o endereço certinho (nada de ../ nem outra extensão)');
ok(a.arquivoDeImagem(est.cenas[0].imagem.slice(4)) && a.arquivoDeImagem('../campanhas/' + r.id + '.json') === null && a.arquivoDeImagem('x.jpg') === null, 'o arquivo de uma imagem só sai de um nome de imagem nosso');

/* ---- o backup leva as imagens de volta para dentro ---- */
const backup = a.envelopeDeBackup(r.id);
ok(backup.estado.cenas[0].imagem === mapa && backup.estado.herois[0].ficha.foto === retrato && ENDERECO.test(a.ler(r.id).cenas[0].imagem), 'o backup embute as imagens (um arquivo só), sem mexer na campanha');
const restaurada = a.criar(JSON.parse(JSON.stringify(backup.estado)));
ok(ENDERECO.test(a.ler(restaurada.id).cenas[0].imagem) && arquivos().length === 3, 'restaurar o backup tira as imagens de novo — e reaproveita os mesmos arquivos');

/* ---- aplicar: a ação manda texto, a campanha guarda o endereço ---- */
const nova = jpeg(20000, 4);
const r1 = a.aplicar(r.id, (estado) => { estado.cenas[0].imagem = nova; return {}; });
ok(!r1.erro && ENDERECO.test(a.ler(r.id).cenas[0].imagem) && arquivos().length === 4, 'uma ação que troca o mapa: a imagem nova sai da campanha também');

/* ---- limites ---- */
const grande = jpeg(700 * 1024, 5);
const antesGrande = a.ler(r.id).cenas[1].imagem;
const rGrande = a.aplicar(r.id, (estado) => { estado.cenas[1].imagem = grande; return {}; });
ok(/não foi aceita/.test(rGrande.erro || '') && a.ler(r.id).cenas[1].imagem === antesGrande, 'imagem acima de 600 KB numa ação: a ação é recusada, com o motivo, e o mapa de antes fica');
const antes = JSON.stringify(a.ler(r.id));
const cheia = a.aplicar(r.id, (estado) => {
  for (let i = 0; i < 8; i++) estado.cenas.push({ id: 'x' + i, nome: 'Extra ' + i, colunas: 8, linhas: 5, paredes: [], tokens: [], imagem: jpeg(50000, 10 + i) });
  return {};
});
ok(/passariam de/.test(cheia.erro || '') && JSON.stringify(a.ler(r.id)) === antes, 'imagens além do espaço da campanha: a ação inteira é desfeita, com o motivo');
const gorda = a.aplicar(r.id, (estado) => { estado.diario.push({ id: 'd1', titulo: 'x', resumo: 'a'.repeat(3.5 * 1024 * 1024) }); return {}; });
ok(/grande demais/.test(gorda.erro || '') && JSON.stringify(a.ler(r.id)) === antes, 'campanha grande demais (sem contar imagens): desfeita');
const recusada = a.aplicar(r.id, (estado) => { estado.campanha.nome = 'mudei'; return { erro: 'não pode' }; });
ok(recusada.erro === 'não pode' && a.ler(r.id).campanha.nome === 'Com mapas', 'ação que recusa no meio do caminho: nada fica mudado');

/* ---- imagens sem uso são apagadas ---- */
a.apagar(restaurada.id);
a.aplicar(r.id, (estado) => { estado.cenas[1].imagem = nova; return {}; });
const apagadas = a.limparImagens();
ok(arquivos().length === 3 && apagadas >= 0, 'o mapa antigo, que ninguém usa mais, é apagado (sobram 3: mapa novo, retrato, goblin)');

/* ---- arquivo de antes: as imagens dentro, saem ao ligar ---- */
const velho = estadoVazio();
velho.campanha.nome = 'Antiga'; velho.mestre.nome = 'Thiago';
velho.cenas.push({ id: 's1', nome: 'Velha', colunas: 8, linhas: 5, paredes: [], tokens: [], imagem: jpeg(9000, 30) });
const idVelho = 'c' + 'a'.repeat(16);
fs.writeFileSync(path.join(pasta, 'campanhas', idVelho + '.json'), JSON.stringify({ formato: 'plainus-campanha', versao: 1, acessos: { mestre: 'b'.repeat(64), jogadores: {} }, estado: velho }));
const b = criarArmazem(pasta);
b.carregar();
const relido = fs.readFileSync(path.join(pasta, 'campanhas', idVelho + '.json'), 'utf8');
ok(ENDERECO.test(b.ler(idVelho).cenas[0].imagem) && !relido.includes('base64'), 'campanha de antes (imagem dentro): ao ligar, a imagem sai e o arquivo é regravado leve');

fs.rmSync(pasta, { recursive: true, force: true });
console.log(falhas ? falhas + ' FALHAS' : '\nImagens certas.');
process.exit(falhas ? 1 : 0);
