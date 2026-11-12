/* ===================================================================
   testes/figuras/emagrecer-glb.mjs — prepara um .glb para a mesa

   COMO USAR (na pasta minha-mesa):
     node testes/figuras/emagrecer-glb.mjs <entrada.glb> <saida.glb> [pose] [nó-a-tirar ...]
   ou, por dentro: import { emagrecer } from './emagrecer-glb.mjs'
   (é o que o montar-figuras.mjs faz, com a receita de cada figura).

   POR QUE EXISTE
   Os modelos do KayKit vêm com 75 animações cada (andar, atacar,
   morrer...) e com TODAS as armas e escudos à vista ao mesmo tempo —
   é um "kit", não uma miniatura. Na mesa, por enquanto, a figura fica
   PARADA numa pose, com um equipamento só. As animações são 90% do
   arquivo (3,6 MB → centenas de KB sem elas); quem entra na mesa baixa
   cada figura uma vez, e 4 MB por figura, num celular, é demais. As
   animações voltam numa fase futura, a partir dos originais (que ficam
   fora do repositório).

   O QUE FAZ
     1. CONGELA A POSE: lê o primeiro quadro da animação pedida (a
        "Idle", de pé) e grava a posição/rotação de cada osso nos nós.
        O esqueleto (skin) fica — é ele que dobra a malha para a pose;
        sem ele, a figura apareceria em T, como foi modelada.
     2. TIRA as animações, e os nós pedidos (as armas que sobram).
     3. COMPACTA: reescreve o BIN só com os pedaços que ainda são usados.

   O FORMATO .glb (binário do glTF), em duas partes:
     cabeçalho (12 bytes): "glTF", versão 2, tamanho total
     pedaço JSON: a descrição (nós, malhas, materiais, animações...)
     pedaço BIN:  os bytes (vértices, índices, texturas, curvas)
   O JSON aponta para fatias do BIN (bufferViews). Tirando animações e
   malhas, sobram fatias órfãs: o BIN é reescrito só com as usadas, e
   tudo o que aponta para elas é renumerado.
   =================================================================== */
import { readFileSync, writeFileSync } from 'node:fs';

const TAMANHO_DO_TIPO = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

export function emagrecer(bruto, opcoes) {
  opcoes = opcoes || {};
  if (bruto.readUInt32LE(0) !== 0x46546C67) throw new Error('não é um .glb');
  const tamanhoJson = bruto.readUInt32LE(12);
  const json = JSON.parse(bruto.subarray(20, 20 + tamanhoJson).toString('utf8'));
  const inicioBin = 20 + tamanhoJson + 8;
  const tamanhoBin = bruto.readUInt32LE(20 + tamanhoJson);
  const bin = bruto.subarray(inicioBin, inicioBin + tamanhoBin);

  /* Lê os floats de um accessor (só o que a pose precisa: float32). */
  function floatsDoAccessor(indice) {
    const a = json.accessors[indice];
    const v = json.bufferViews[a.bufferView];
    const largura = TAMANHO_DO_TIPO[a.type];
    const passo = v.byteStride || largura * 4;
    const inicio = (v.byteOffset || 0) + (a.byteOffset || 0);
    const saida = [];
    for (let i = 0; i < a.count; i++) {
      const linha = [];
      for (let k = 0; k < largura; k++) linha.push(bin.readFloatLE(inicio + i * passo + k * 4));
      saida.push(linha);
    }
    return saida;
  }

  /* 1. A pose: o primeiro quadro da animação pedida vira a posição
     fixa dos nós. */
  const animacao = opcoes.pose && (json.animations || []).find(function (a) { return a.name === opcoes.pose; });
  if (opcoes.pose && !animacao) throw new Error('animação não encontrada: ' + opcoes.pose + ' (tem: ' + (json.animations || []).map(function (a) { return a.name; }).join(', ') + ')');
  if (animacao) {
    animacao.channels.forEach(function (canal) {
      const sampler = animacao.samplers[canal.sampler];
      const valores = floatsDoAccessor(sampler.output);
      /* CUBICSPLINE guarda [tangente, valor, tangente] por quadro. */
      const primeiro = sampler.interpolation === 'CUBICSPLINE' ? valores[1] : valores[0];
      const no = json.nodes[canal.target.node];
      if (canal.target.path === 'weights') return;
      no[canal.target.path] = primeiro;
    });
  }
  delete json.animations;

  /* 2. Os nós a tirar (as armas que sobram): sem malha, o nó fica
     vazio — e a malha, órfã, sai na compactação. */
  const tirar = new Set(opcoes.remover || []);
  (json.nodes || []).forEach(function (no) { if (tirar.has(no.name)) delete no.mesh; });

  /* 3. Compactar: quais malhas, accessors e bufferViews ainda são usados. */
  const malhasUsadas = new Set();
  (json.nodes || []).forEach(function (no) { if (no.mesh !== undefined) malhasUsadas.add(no.mesh); });
  const mapaMalha = new Map();
  const malhasNovas = [];
  (json.meshes || []).forEach(function (m, i) { if (malhasUsadas.has(i)) { mapaMalha.set(i, malhasNovas.length); malhasNovas.push(m); } });
  json.meshes = malhasNovas;
  (json.nodes || []).forEach(function (no) { if (no.mesh !== undefined) no.mesh = mapaMalha.get(no.mesh); });

  const accessorsUsados = new Set();
  json.meshes.forEach(function (malha) {
    (malha.primitives || []).forEach(function (p) {
      Object.values(p.attributes || {}).forEach(function (a) { accessorsUsados.add(a); });
      if (p.indices !== undefined) accessorsUsados.add(p.indices);
      (p.targets || []).forEach(function (t) { Object.values(t).forEach(function (a) { accessorsUsados.add(a); }); });
    });
  });
  (json.skins || []).forEach(function (s) { if (s.inverseBindMatrices !== undefined) accessorsUsados.add(s.inverseBindMatrices); });

  const mapaAccessor = new Map();
  const accessorsNovos = [];
  (json.accessors || []).forEach(function (a, i) { if (accessorsUsados.has(i)) { mapaAccessor.set(i, accessorsNovos.length); accessorsNovos.push(a); } });
  json.accessors = accessorsNovos;
  json.meshes.forEach(function (malha) {
    (malha.primitives || []).forEach(function (p) {
      Object.keys(p.attributes || {}).forEach(function (k) { p.attributes[k] = mapaAccessor.get(p.attributes[k]); });
      if (p.indices !== undefined) p.indices = mapaAccessor.get(p.indices);
      (p.targets || []).forEach(function (t) { Object.keys(t).forEach(function (k) { t[k] = mapaAccessor.get(t[k]); }); });
    });
  });
  (json.skins || []).forEach(function (s) { if (s.inverseBindMatrices !== undefined) s.inverseBindMatrices = mapaAccessor.get(s.inverseBindMatrices); });

  const viewsUsadas = new Set();
  json.accessors.forEach(function (a) {
    if (a.bufferView !== undefined) viewsUsadas.add(a.bufferView);
    if (a.sparse) { viewsUsadas.add(a.sparse.indices.bufferView); viewsUsadas.add(a.sparse.values.bufferView); }
  });
  (json.images || []).forEach(function (img) { if (img.bufferView !== undefined) viewsUsadas.add(img.bufferView); });

  const partes = [];
  const mapaView = new Map();
  const viewsNovas = [];
  let deslocamento = 0;
  (json.bufferViews || []).forEach(function (v, i) {
    if (!viewsUsadas.has(i)) return;
    const fatia = bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
    mapaView.set(i, viewsNovas.length);
    viewsNovas.push(Object.assign({}, v, { byteOffset: deslocamento, buffer: 0 }));
    partes.push(fatia);
    deslocamento += fatia.length;
    const sobra = (4 - (deslocamento % 4)) % 4;
    if (sobra) { partes.push(Buffer.alloc(sobra)); deslocamento += sobra; }
  });
  json.bufferViews = viewsNovas;
  json.accessors.forEach(function (a) {
    if (a.bufferView !== undefined) a.bufferView = mapaView.get(a.bufferView);
    if (a.sparse) { a.sparse.indices.bufferView = mapaView.get(a.sparse.indices.bufferView); a.sparse.values.bufferView = mapaView.get(a.sparse.values.bufferView); }
  });
  (json.images || []).forEach(function (img) { if (img.bufferView !== undefined) img.bufferView = mapaView.get(img.bufferView); });
  const binNovo = Buffer.concat(partes);
  json.buffers = [{ byteLength: binNovo.length }];

  /* O .glb de volta: JSON alinhado com espaços, BIN alinhado com zeros. */
  let textoJson = Buffer.from(JSON.stringify(json), 'utf8');
  if (textoJson.length % 4) textoJson = Buffer.concat([textoJson, Buffer.alloc(4 - (textoJson.length % 4), 0x20)]);
  const cabecalho = Buffer.alloc(12);
  cabecalho.writeUInt32LE(0x46546C67, 0); cabecalho.writeUInt32LE(2, 4);
  const cabJson = Buffer.alloc(8); cabJson.writeUInt32LE(textoJson.length, 0); cabJson.writeUInt32LE(0x4E4F534A, 4);
  const cabBin = Buffer.alloc(8); cabBin.writeUInt32LE(binNovo.length, 0); cabBin.writeUInt32LE(0x004E4942, 4);
  const total = 12 + 8 + textoJson.length + 8 + binNovo.length;
  cabecalho.writeUInt32LE(total, 8);

  /* A altura da figura (o maior Y de qualquer malha), para a escala. */
  let alturaMax = 0;
  json.accessors.forEach(function (a) { if (a.type === 'VEC3' && a.max && a.max[1] > alturaMax && Math.abs(a.max[1]) < 100) alturaMax = a.max[1]; });

  return { glb: Buffer.concat([cabecalho, cabJson, textoJson, cabBin, binNovo]), altura: alturaMax };
}

/* Linha de comando. */
if (process.argv[1] && /emagrecer-glb\.mjs$/.test(process.argv[1])) {
  const [entrada, saida, pose, ...remover] = process.argv.slice(2);
  if (!entrada || !saida) { console.log('uso: node emagrecer-glb.mjs <entrada.glb> <saida.glb> [pose] [nó-a-tirar ...]'); process.exit(1); }
  const bruto = readFileSync(entrada);
  const r = emagrecer(bruto, { pose: pose, remover: remover });
  writeFileSync(saida, r.glb);
  console.log(entrada.split(/[\\/]/).pop() + ': ' + Math.round(bruto.length / 1024) + ' KB → ' + Math.round(r.glb.length / 1024) + ' KB · altura ' + r.altura.toFixed(2));
}
