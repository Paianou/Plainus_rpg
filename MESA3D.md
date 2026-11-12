# MESA3D.md — a mesa em 3D (plano e decisões)

O foco da Runlise desde 2026-11-10 (ver `CLAUDE.md`): o mapa em 3D
totalmente móvel, com zoom, e o catálogo de miniaturas. **Não há mais
ícone de personagem: há figuras em 3D**, como numa mesa de RPG de
verdade. Este arquivo guarda o plano, as decisões e o que já foi feito,
para uma sessão nova continuar de onde parou.


## A ideia, em uma frase

Uma cena é uma mesa física: a imagem do mapa é uma folha deitada sobre
um tampo de ardósia; a grade está **alinhada à imagem** (calibrada), não
esticada sobre ela; as paredes pintadas se erguem como blocos; as
figuras ficam em pé sobre bases, com sombra; a câmera é a cabeça de quem
olha a mesa (gira, inclina, aproxima, desliza). Tudo o que muda no jogo
chega a todos pelo mesmo tempo real de hoje.


## Decisões (2026-11-10, com o Thiago)

1. **A planta 2D de hoje vira só o plano B** (sem WebGL, celular fraco).
   Não é removida: é o que garante que ninguém fica sem jogar.
2. **Figuras de graça, que funcionem:** pacotes CC0 (KayKit, Quaternius —
   estilizados, "low poly" de qualidade). Modelos realistas esculpidos
   não existem de graça; o realismo da mesa vem da luz, das sombras, dos
   materiais e da escala. Um pacote pago pode entrar depois no mesmo
   catálogo. Download dos pacotes autorizado; só entra o que a licença
   dentro do download confirmar como CC0.
3. **Processamento da imagem de mapa:** calibração da grade por uma
   célula (dois cliques) + detecção automática do passo da grade +
   textura a 2048px. Detectar paredes a partir do desenho fica para
   depois.
4. **Visão e névoa** (o jogador só vê o que o personagem vê) são
   calculadas **no servidor** (`visao.js`): esconder só no 3D deixaria o
   monstro visível pelo F12.


## Arquitetura

### Dados (o que o servidor guarda — `modelo.js`, `acoes.js`, `visao.js`)

| Campo | Estado | O que é |
|---|---|---|
| `cena.grade` | novo | `{ x0, y0, celulaPx }`: onde a grade começa na imagem e quantos pixels tem uma célula. `colunas × linhas` passam a ser calculadas a partir disto quando há imagem |
| `cena.paredes` | existe | `[col, lin, largura, altura]` em células; erguidas em 3D com altura padrão (altura por parede: depois) |
| `token.modelo` | novo | id da figura no catálogo (`publico/figuras/catalogo.js`); o servidor só aceita ids da lista |
| `token.direcao` | novo | para onde a figura olha, 0–7 (passos de 45°); ação nova `virarFigura` |
| `token.tamanho` | novo | `pequeno` / `medio` / `grande` / `enorme` (SRD): base e escala |

O nome `tokens` fica **por dentro** (backups e campanhas atuais continuam
valendo); por fora, na interface, chama-se **figura**.

### Imagem de mapa (`servidor/imagens.js`, `publico/imagens.js`, `mapas.js`)

1. O Mestre envia a imagem; o servidor recomprime (JPEG, até 2048px no
   lado maior para o 3D — hoje 1600).
2. **Calibração:** o Mestre marca uma célula sobre a imagem (dois cantos)
   → `x0, y0, celulaPx`. Margens fora da grade continuam visíveis na
   folha; a grade cobre só a parte jogável.
3. **Detecção automática:** antes de pedir a calibração, o navegador
   tenta achar o passo da grade (autocorrelação das linhas escuras); se
   achar, propõe, e o Mestre confirma ou ajusta.
4. A cena guarda só a calibração; a imagem continua um arquivo
   `img/<resumo>.jpg`, baixado uma vez e guardado pelo navegador.

### Desenho (`publico/mesa3d.js`, Three.js r180 em módulos)

- **Three.js em módulos** (`publico/vendor/three/`): `three.module.min.js`
  + `three.core.min.js`, e os extras `GLTFLoader`, `OrbitControls`,
  `BufferGeometryUtils` com o `from 'three'` reescrito para o caminho
  local (a CSP não deixa import map inline). `global.js` pendura `THREE`
  no ar para o `dados3d.js`, que é script comum.
- **Câmera:** `OrbitControls` com limites (não passa por baixo da mesa;
  distância mínima e máxima; inclinação até 85°). Girar: botão esquerdo;
  deslizar: botão direito ou dois dedos; zoom: roda ou pinça. Botões "De
  cima" e "Enquadrar".
- **Mesa, folha e grade:** tampo de ardósia em volta; folha com a textura
  do mapa; grade por shader sobre a folha, alinhada pela calibração, com
  espessura constante em qualquer zoom.
- **Paredes:** um único `InstancedMesh` para todas as células de parede.
- **Luz:** hemisférica fria + direcional com sombras suaves (PCF) + a luz
  arcana azul; tone mapping ACES; cores sRGB. Materiais
  `MeshStandardMaterial`/`MeshPhysicalMaterial`.
- **Figuras:** cada `.glb` carregado uma vez e clonado. Base com anel azul
  (grupo) ou vermelho (inimigo) — as cores dos tokens de hoje. Nome
  flutuante que encara a câmera.
- **Interação:** raycast para selecionar; arrastar com encaixe na célula;
  ao soltar, a **mesma ação `moverToken`** de hoje, conferida pelo
  servidor. Girar com Q/E ou pelo anel de direção da figura selecionada.
- **Desempenho:** desenha **só quando algo muda** (câmera, estado,
  animação); `pixelRatio` no máximo 2; texturas até 2048.
- **Plano B:** sem WebGL, a planta 2D de hoje.

### Catálogo (`publico/figuras/catalogo.js` + `publico/figuras/*.glb`)

`{ id, nome, arquivo, categoria, tamanho, origem, licenca }`. Ligações
automáticas: classe da ficha → figura sugerida; nome do monstro do
bestiário → figura. Depois, a Oficina de Miniaturas (escolher, ajustar
cor e base, e um dia imagem → figura).


## As fases (um arquivo por vez)

| # | Arquivo | Entrega | Estado |
|---|---|---|---|
| 1 | `vendor/three/` + `dados3d.js` | Three.js em módulos; o d20 continua igual | **feito** (2026-11-10) |
| 2 | `mesa3d.js` (1ª versão) + "Ver em 3D" em Mapas | Mesa, folha, grade e paredes em 3D; câmera livre | **feito** (2026-11-11) |
| 3 | Calibração da grade (`grade.js`, `mapas.js`, `modelo.js`, `acoes.js`) | A grade bate com a imagem; detecção automática | **feito** (2026-11-11) |
| 4 | `figuras/` + `catalogo.js` | Os modelos, com a licença conferida | **feito** (2026-11-12): 9 figuras KayKit CC0, 230–370 KB cada |
| 5 | Figuras no `mesa3d.js` + `direcao`/`modelo`/`tamanho` nas ações | Figuras em pé, arrastar, girar, em tempo real | |
| 6 | Jogador em 3D (`jogador-mesa.js`) | A própria figura, na vez dele | |
| 7 | Escolha da figura (ficha, bestiário) | O jogador escolhe a sua; o Mestre, as dos monstros | |
| 8 | Luz, sombras, celular, "reduzir movimento" | Acabamento e testes em roteiro | |

Depois: visão e névoa no servidor; portas e objetos; a Oficina com
imagem → figura (recorte 3D; IA depois); altura por parede; importar a
foto de qualquer arquivo para a Oficina.


## Pendências fora do 3D

- Landing: deploy na Vercel (precisa do link do Google Forms e do
  domínio `runlise.com`), prévia do link (Open Graph), privacidade,
  contato, 404, ícones do celular, cabeçalhos de segurança, perguntas
  frequentes. Tudo listado na conversa de 2026-11-04.

## Notas da fase 4 (figuras)

- Os pacotes originais (KayKit Adventurers e Skeletons, 270 MB) ficam
  FORA do repositório; `testes/figuras/montar-figuras.mjs <pasta>` gera
  os `.glb` de `publico/figuras/` (pose congelada, um equipamento, sem
  animação) com o `emagrecer-glb.mjs` (Node puro, sem dependências).
- A frente dos modelos KayKit é +Z. Na mesa (coluna = X, linha = Z), uma
  figura sem giro olha "para baixo" no mapa 2D.
- A CSP ganhou `connect-src blob:`: o GLTFLoader lê a textura de dentro
  do .glb por um blob: da própria página.
- Faltam monstros que não sejam humanoides (lobo, orc, aranha, ogro…):
  o Quaternius "Ultimate Monsters" (CC0) está num Google Drive, sem link
  direto; fica para quando houver download. Até lá, esses tokens usam a
  figura genérica da categoria.
