# DESIGN.md - Plainus (minha-mesa)

A identidade visual da mesa, escrita como regra. Descreve o que o site
JÁ é (o `style.css` e o `CLAUDE.md`), não um visual novo. Quando o código
e este arquivo discordarem, este arquivo diz o que é o certo; a seção
"Divergências medidas" lista onde o código ainda não chegou lá.

Qualquer ferramenta de design (inclusive as skills de "deslop") lê este
arquivo primeiro e o respeita. Escolhas daqui que contrariam regras
genéricas dessas ferramentas são DECISÕES, não descuido (ver "Decisões
que não se discutem").


## Contexto

- Tipo: aplicativo de mesa virtual (VTT) para D&D 5e. Painel denso de
  ferramenta (Mestre) + painel de jogador, também no celular.
- Posicionamento: utilitário, com clima. Não é SaaS, não vende nada.
- Público: o Mestre (Thiago) e um grupo pequeno de amigos.
- Ação principal: jogar a sessão. O Mestre controla o mundo; cada
  jogador, o próprio personagem.
- Adjetivos: frio, arcano, contido, preciso, noturno.
- Tradução visual:
  - frio: superfícies grafite com um fio de azul, nunca marrom ou creme
  - arcano: um único acento de luz azul, e nenhum outro
  - contido: um ornamento gótico, não vários; nada de dourado
  - preciso: hairlines de 1px, números tabulares, alinhamento rigoroso
  - noturno: fundo quase preto, texto quase branco, grão de filme
- Essência (3 palavras): pedra fria, luz arcana.
- Modo: só escuro. Densidade: densa no Mestre, equilibrada no jogador.
- Restrições: HTML/CSS/JS puro, sem framework; CSP sem estilo inline em
  atributo (ver server.js); sem emoji na interface.


## Estética

- Direção: pedra fria e luz arcana (sob medida).
- Traço que organiza tudo: superfícies em camadas de grafite separadas
  por luz (hairline + brilho no topo), não por bordas grossas.
- Assinatura: o arco gótico (`.arco-gotico`) no cabeçalho, o ÚNICO
  ornamento literal, junto com o grão de filme sobre a página toda e a
  névoa que respira devagar na entrada.

### Referências de RPG (2026-10-15)

Detalhes do mundo da mesa de RPG, POR CIMA da direção acima — sem mudar
cor nem acabamento. Por enquanto, só na tela de entrada.

- **Papel quadriculado** atrás do título (`.entrada-marca.com-quadriculado`):
  quadrados de 20px, linhas na cor `--hairline`, sumindo para baixo. É o
  papel de mapa da mesa. Uma região quadriculada por tela, no máximo.
- **Retratos em hexágono** (`.retrato-mini`): a silhueta do d20 visto de
  frente. A moldura é feita em duas camadas (o `clip-path` do hexágono
  cortaria uma borda comum); a do seu personagem ("meu") é azul.

Tentativa recusada (2026-10-14, branch `redesenho-mesa`): a direção "a
mesa, não o jogo", com a folha de papel clara, tinta azul-escura e sem
brilho. Vista na tela, não agradou: o escuro com o azul elétrico é a cara
da mesa. Não voltar a ela sem pedido.


## Decisões que não se discutem

Vêm do `CLAUDE.md` e já valem no código. Ferramentas genéricas podem
apontar algumas como "padrão de IA"; aqui elas ficam.

- **Inter na interface.** Escolhida pela legibilidade em tamanho pequeno
  e pelos números tabulares, num painel denso. A personalidade vem do
  Marcellus nos títulos, não da fonte do corpo.
- **Azul elétrico é o único acento** (foco, seleção, botão secundário,
  hover, luzes de fundo). **Sem violeta**, em lugar nenhum: decidido em
  2026-10-12 (achado desnecessário); o token `--violeta` saiu do CSS em
  2026-10-13.
- **Sem dourado.** O âmbar `--vida-media` existe só como cor de ESTADO
  "atenção" (vida pela metade, aviso de nível atenção no sino), nunca
  em borda, título ou fundo decorativo.
- **Sem emoji.** Ícones são SVG em traço que herdam a cor do texto.
- **Gótico com parcimônia:** um ornamento marcante, não enfeite espalhado.


## Tipografia

- Títulos e números de destaque: **Marcellus** (Google Fonts, OFL), peso 400,
  `letter-spacing: .02em`. Usado em `h1`, `h2`, `.marca`.
- Interface: **Inter** (Google Fonts, OFL), pesos 400/500/600/700.
  Alternativas: 'Segoe UI', system-ui.
- Base: 15px, `line-height: 1.5`.
- Números: `font-feature-settings: 'tnum' 1` na página toda (os valores
  não dançam quando mudam).
- Escala alvo (para novas telas): 11 / 12 / 13 / 15 / 18 / 24 / 32 px.
  Mínimo para texto legível: 11px; 9-10px só em rótulo de uma palavra
  em caixa alta, nunca em frase.


## Cor

Paleta (token -> OKLCH | hex). Tudo no código usa `var(--token)`.

Superfícies (do mais fundo ao mais alto):
- `--breu`: oklch(13.9% 0.005 263) | #08090b (fundo da página)
- `--cripta`: oklch(16.3% 0.009 264) | #0c0e12
- `--pedra`: oklch(20.5% 0.010 268) | #15171c (cartão)
- `--pedra-2`: oklch(23.5% 0.012 264) | #1b1e24
- `--pedra-3`: oklch(26.9% 0.014 267) | #23262d (elevado, hover)

Linhas e relevo:
- `--hairline`: rgba(255,255,255,.07) (separadores)
- `--hairline-forte`: rgba(255,255,255,.13) (bordas de controle)
- `--relevo`: rgba(255,255,255,.055) (brilho no topo, `inset 0 1px 0`)

Texto:
- `--texto`: oklch(93.2% 0.011 275) | #e6e8f0 (principal)
- `--texto-2`: oklch(69.1% 0.032 271) | #949bb0 (secundário)
- `--texto-3`: oklch(62.4% 0.031 270) | #80879b (dica, detalhe, rótulo, placeholder).
  Era #5d6478 (contraste 3:1). É o tom mais apagado que ainda passa 4,5:1
  no fundo comum. **Sobre fundo realçado** (linha da vez, item ativo,
  pílula, cartão em degradê), o texto apagado usa `--texto-2`, porque
  ali o `--texto-3` não tem contraste.

Acento (luz arcana):
- `--azul`: oklch(65.8% 0.182 261) | #4d8dff
- `--azul-fundo`: rgba(77,141,255,.12)
- `--gelo`: oklch(82.1% 0.089 265) | #a9c4ff (texto sobre fundo azul)
- ~~`--violeta`~~ #8b6cff: fora da paleta e do CSS desde 2026-10-13.
  As luzes de fundo da entrada são `--gelo` e `--azul`.

Estado (informação, não decoração):
- `--perigo`: oklch(55.8% 0.165 25) | #c2413f (borda/fundo de erro, botão perigoso)
- texto de erro: oklch(83.4% 0.068 23) | #f2b8b4 (ainda sem token; ver Divergências)
- texto de sucesso: oklch(80.4% 0.082 161) | #8fd0ae (ainda sem token)
- `--vida` / `--vida-media` / `--vida-baixa`: #3f9e6c / #b8873c / #b5413f
  (barra de vida: bem / ferido / quase caindo). O âmbar também marca o
  aviso de nível "atenção" no sino (perigo = vermelho, info = azul).
  Fora disso, nunca.

Distribuição: ~70 grafite / ~25 texto / ~5 azul. O azul aparece pouco
para continuar chamando atenção.


## Espaço, cantos, sombra

- Cantos: `--r-p` 8px (controles pequenos, pílulas de canto), `--r-m`
  12px (botões, campos, cartões), `--r-g` 18px (o cartão principal).
  Círculo: `50%` (retratos, pontos). Pílula: `999px`.
- Sombra: elevação suave, em três degraus (`--sombra-baixa`, `--sombra`,
  `--sombra-alta`), sempre junto do brilho de topo
  `inset 0 1px 0 var(--relevo)`. A borda é hairline (1px, translúcida),
  nunca grossa.
- Espaçamento: múltiplos de 4px; apertado dentro de um grupo, folgado
  entre grupos.


## Layout

- Mestre: barra do topo + códice (navegação lateral) + três colunas.
- Jogador: barra própria, abas, lateral que desce no meio da tela.
- Quebra principal: **720px** (celular). Telas médias: 1100px.
- Celular: nenhuma rolagem de lado (os testes conferem em 390px).


## Componentes e estados

- Botão principal (`.botao`): cheio, degradê grafite, hairline forte,
  brilho de topo. Hover: sobe 1px e ganha borda e sombra azuladas.
- Botão secundário (`.botao.fantasma`): contorno azul, texto `--gelo`,
  fundo azul a 8%.
- Botão perigoso (`.botao.perigo`): fundo vermelho translúcido.
- Pequeno (`.botao.pequeno`). Desabilitado: sem hover.
- Hierarquia por importância, não por cor: um botão cheio por área.
- Campo (`.campo`): label sempre visível acima (placeholder não é label).
  Campo compacto sem label à vista (linhas de formulário, texto editável
  no lugar) leva `aria-label`, como os de PV e CA do Combate.
- Foco de campo: borda `rgba(77,141,255,.55)` + anel de 3px. Campo sem
  borda própria (a busca Ctrl+K) mostra o foco na faixa que o contém
  (`:focus-within`).
- Erro (`.erro-entrada`): faixa com borda esquerda `--perigo`, some
  sozinha quando vazia (`:empty`), `role="alert"`.
- Recado (`.recados`): aviso flutuante que some sozinho.
- Foco: `:focus-visible { outline: 2px solid var(--azul); outline-offset: 3px }`
  na página toda. Nunca remover sem pôr outro no lugar.
- Vazio: frase que diz o que fazer ("Passe o código de convite...").


## Movimento

- Padrão: `--transicao` = 180ms `cubic-bezier(.22,.61,.36,1)` (sai rápido,
  pousa suave).
- Anima transform e opacity; hover sobe 1px, nunca pula.
- Névoa e luzes de fundo: lentas, para respirar, não para chamar atenção.
- `prefers-reduced-motion: reduce` é respeitado (6 regras no CSS).


## Ícones

- SVG em traço desenhado à mão (`icones.js`), grade 24x24, traço 1.6,
  pontas e junções arredondadas, `stroke: currentColor` (herda a cor).
- Tamanho padrão 16px; 14-22px conforme o lugar.
- Criaturas (`bichos.js`): silhuetas CHEIAS, porque contorno em token de
  34px vira borrão.


## Imagens

- Mapas e retratos vêm dos usuários, recomprimidos em JPEG (imagens.js).
- Fundo de cartão de mesa: o mapa da cena, bem apagado
  (`.fundo-mesa`: `grayscale(.6) brightness(.55)`, opacidade .35).
- Texto sobre imagem: a imagem é que escurece e some, nunca o texto;
  o contraste do texto continua o da superfície.


## Acessibilidade

Contraste medido (WCAG):
- `--texto` sobre `--pedra`: 14.7 (AA)
- `--texto-2` sobre `--pedra`: 6.5 (AA)
- `--azul` sobre `--pedra`: 5.6 (AA)
- `--texto-3` sobre `--pedra`: 5.0 (AA). Sobre fundo realçado, usar
  `--texto-2` (ver Cor).
- Medição na página desenhada (2026-10-13): 1.994 textos em 22 telas,
  **0 abaixo de AA** (eram 661, todos de `--texto-3`).
- Erro (#f2b8b4) sobre `--pedra`: ~9 (AA).
- Títulos: **um `<h1>` por tela**, o nome da tela (no jogador, o da aba).
  Seções abaixo dele são `<h2>`. Tela sem título visível no desenho
  (Visão Geral) leva o `<h1 class="so-leitor">`: lido, mas fora da vista.
- Alvo de toque: 24px no mínimo, 44px no celular. Ícone pequeno (o "×"
  de 15px, a bolinha de 16px) mantém o desenho e ganha área invisível
  com `::after { position: absolute; inset: -Npx }` — só em botão sem
  padding; com borda, o inset conta de dentro dela. Alvos vizinhos com
  área invisível precisam de folga entre si (senão um clique pega o
  errado). Caixa de marcar: o `<label>` que a envolve é o alvo, com
  `min-height: 24px`. Controle deslizante: 24px de altura, a barra
  desenhada na trilha.
- Medição na página desenhada (2026-10-13): 0 alvos abaixo de 24px nas
  22 telas (eram 8 tipos; o teste clica a 12px do centro, nos 4 lados).
- Cor nunca é o único sinal (a barra de vida também tem texto).


## Divergências medidas (outubro de 2026)

Onde o `style.css` ainda não segue as regras acima. Item corrigido fica
riscado, com a data.

1. **Cores sem token:** texto de erro escrito na mão (#f2b8b4 x17,
   #f0a6a2 x14, #e0827d x6), texto de sucesso (#8fd0ae x7), e cerca de
   290 `rgba(...)` soltos (variações de azul, hairline e perigo).
2. **Canto fora da escala:** `6px` aparece 34 vezes (mais que `--r-g`);
   ou vira token, ou vira `--r-p`.
3. **Tamanhos de fonte:** cerca de 17 tamanhos diferentes, de 8.5px a
   16px, incluindo 8.5px, 9px e 9.5px em vários lugares.
4. ~~**Contraste:** `--texto-3` (3.0) é usado 148 vezes, muitas em texto
   pequeno (dicas de 11-12px).~~ Corrigido em 2026-10-13.
5. **Durações:** 160, 180, 200, 220, 260, 280, 300 e 700ms convivem;
   falta uma escala (rápido / normal / lento).
6. **Quebras de tela:** além de 720px e 1100px, existem 760, 900, 980,
   1180 e 1500px, uma vez cada.
7. ~~**Violeta ainda no CSS**~~ Corrigido em 2026-10-13, nos quatro
   lugares: luz de fundo da entrada (-> `--gelo`), marca de "atenção" no
   sino (-> âmbar), aviso "aberta sem servidor" e ponto de "Abrindo a
   mesa" (-> azul).
8. **Texto miúdo que é frase** (auditoria de 2026-10-13, ainda aberto):
   rótulos de 8,5-9px que não são uma palavra em caixa alta —
   `.campo-form label`, `.passos li`, `.titulo-grupo-tabela`,
   `.titulo-coluna .sub`, `.busca-grupo`, `.dado .uso`.


## Changelog

- 2026-10-12: primeira versão, escrita a partir do style.css e do
  CLAUDE.md, com as divergências medidas.
- 2026-10-12: violeta sai da identidade; azul elétrico é o único acento.
- 2026-10-13: `--texto-3` de #5d6478 para #80879b; texto apagado sobre
  fundo realçado passa a `--texto-2` (7 regras). Contraste: 661 -> 0.
- 2026-10-13: um `<h1>` por tela: Visão Geral ganhou o seu (só leitor de
  tela); o nome do personagem na Ficha virou `<h2>` (visual igual).
- 2026-10-13: rótulo no "Nome avulso" (Combate) e no texto dos
  marcadores (Mapas); a busca Ctrl+K mostra o foco.
- 2026-10-13: alvos de toque com 24px: "×" das condições e dos
  marcadores, texto do marcador (e o estilo dele saiu do JS para o CSS),
  bolinhas de magia (gap 6 -> 9px), volume, rótulos de caixa de marcar.
- 2026-10-13: violeta fora do CSS (4 lugares; o token também saiu);
  âmbar passa a marcar o aviso de "atenção".
- 2026-10-15: referências de RPG na entrada: papel quadriculado atrás do
  título e retratos em hexágono. Cores e acabamento sem mudança.
