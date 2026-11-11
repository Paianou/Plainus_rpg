/* ===================================================================
   vendor/three/global.js — o Three.js para quem ainda não é módulo

   O Three.js (r180) só existe em MÓDULOS de JavaScript: arquivos que
   se importam uns aos outros com `import`. Os extras que a mesa em 3D
   precisa — GLTFLoader (as figuras) e OrbitControls (a câmera) — só
   vêm assim. Por isso o three.min.js "global" de antes (r158) saiu.

   O dados3d.js (o d20 que rola) é um script comum, de antes dos
   módulos: ele espera encontrar `THREE` no ar. Este arquivo faz a
   ponte: importa o Three.js e o pendura em window.THREE.

   TEMPO: um <script type="module"> roda DEPOIS que a página inteira
   foi lida (é como se tivesse `defer`). Então, nos primeiros
   instantes, `THREE` ainda não existe — e é por isso que o
   Dados3D.tem3D() não guarda a resposta enquanto ele não chegou.

   OS EXTRAS importam `from 'three'` (um nome, que só um "import map"
   resolve — e import map é inline, e a CSP do server.js não deixa
   script inline). Ao copiar os extras para cá, esse import virou
   './three.module.min.js', o caminho de verdade. É a única mudança
   neles.
   =================================================================== */
import * as THREE from './three.module.min.js';

window.THREE = THREE;
/* Quem estava esperando pelo Three.js (o dados3d.js, a mesa em 3D)
   fica sabendo que ele chegou. */
document.dispatchEvent(new CustomEvent('runlise:three'));
