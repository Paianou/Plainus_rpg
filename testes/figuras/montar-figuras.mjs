/* ===================================================================
   testes/figuras/montar-figuras.mjs — monta o catálogo de figuras

   COMO USAR (na pasta minha-mesa):
     node testes/figuras/montar-figuras.mjs <pasta-dos-pacotes>
   A pasta tem os pacotes baixados (fora do repositório — são 270 MB):
     <pasta>/adv/   KayKit Character Pack: Adventurers 1.0 (CC0)
     <pasta>/skel/  KayKit Character Pack: Skeletons 1.0 (CC0)
   Gera publico/figuras/*.glb, cada um com UMA pose e UM equipamento, e
   confere as licenças (publico/figuras/LICENCAS.md diz de onde cada
   figura veio).

   Cada receita: o arquivo de origem, a pose (a animação cujo primeiro
   quadro vira a pose parada) e as armas que SAEM (o KayKit mostra
   todas de uma vez; uma miniatura segura uma só).
   =================================================================== */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { emagrecer } from './emagrecer-glb.mjs';

const pacotes = process.argv[2];
if (!pacotes) { console.log('uso: node testes/figuras/montar-figuras.mjs <pasta-dos-pacotes>'); process.exit(1); }
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SAIDA = path.join(RAIZ, 'publico', 'figuras');
mkdirSync(SAIDA, { recursive: true });

const ADV = path.join(pacotes, 'adv', 'addons', 'kaykit_character_pack_adventures', 'Characters', 'gltf');
const SKEL = path.join(pacotes, 'skel', 'addons', 'kaykit_character_pack_skeletons', 'Characters', 'gltf');

/* A licença de cada pacote tem de dizer CC0 — senão, nada sai daqui. */
for (const p of ['adv', 'skel']) {
  const licenca = readFileSync(path.join(pacotes, p, 'LICENSE.txt'), 'utf8');
  if (!/Creative Commons Zero, CC0/.test(licenca)) throw new Error('a licença de ' + p + ' não é CC0 — não entra');
}

const RECEITAS = [
  { id: 'guerreiro', origem: path.join(ADV, 'Knight.glb'), pose: 'Idle', remover: ['1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Spike_Shield', '2H_Sword'] },
  { id: 'barbaro', origem: path.join(ADV, 'Barbarian.glb'), pose: '2H_Melee_Idle', remover: ['1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', 'Mug'] },
  { id: 'mago', origem: path.join(ADV, 'Mage.glb'), pose: 'Idle', remover: ['Spellbook', 'Spellbook_open', '1H_Wand'] },
  { id: 'ladino', origem: path.join(ADV, 'Rogue_Hooded.glb'), pose: 'Idle', remover: ['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Throwable'] },
  { id: 'arqueiro', origem: path.join(ADV, 'Rogue.glb'), pose: 'Idle', remover: ['Knife_Offhand', '1H_Crossbow', 'Knife', 'Throwable'] },
  { id: 'esqueleto', origem: path.join(SKEL, 'Skeleton_Minion.glb'), pose: 'Idle_Combat', remover: [] },
  { id: 'esqueleto-guerreiro', origem: path.join(SKEL, 'Skeleton_Warrior.glb'), pose: 'Idle_Combat', remover: [] },
  { id: 'esqueleto-mago', origem: path.join(SKEL, 'Skeleton_Mage.glb'), pose: 'Idle', remover: [] },
  { id: 'esqueleto-ladino', origem: path.join(SKEL, 'Skeleton_Rogue.glb'), pose: 'Idle', remover: [] }
];

const alturas = {};
for (const r of RECEITAS) {
  const bruto = readFileSync(r.origem);
  const feito = emagrecer(bruto, { pose: r.pose, remover: r.remover });
  writeFileSync(path.join(SAIDA, r.id + '.glb'), feito.glb);
  alturas[r.id] = feito.altura;
  console.log(r.id.padEnd(22) + Math.round(bruto.length / 1024) + ' KB → ' + Math.round(feito.glb.length / 1024) + ' KB · altura ' + feito.altura.toFixed(2));
}
writeFileSync(path.join(SAIDA, 'alturas.json'), JSON.stringify(alturas, null, 2));
console.log('\nAlturas em publico/figuras/alturas.json (o catalogo.js usa para a escala).');
