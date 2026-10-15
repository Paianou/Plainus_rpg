# DESIGN.md - Plainus RPG

A fonte da verdade do visual. Quando o CSS e este arquivo discordarem,
este arquivo diz o que é o certo.

Substitui a direção anterior ("pedra fria e luz arcana", outubro de 2026),
que está no histórico do Git. Este arquivo descreve a direção NOVA; as
páginas migram uma por vez (ver "Migração", no fim).


## A tese: a mesa, não o jogo

O Plainus não substitui um videogame: substitui uma MESA, com papel, dado e
lápis. Parecendo videogame (quase-preto, acento brilhante, catedral, brilho
arcano), ele compete com Roll20 e Foundry no terreno deles, com o visual
mais reconhecível de interface gerada por IA. Parecendo a mesa, ele tem um
ponto de vista que nenhum dos dois tem.

O vocabulário visual vem dos materiais do RPG de mesa: papel quadriculado,
grafite, tinta de caneta, a faceta do dado, o formulário impresso da ficha.

- Tipo: aplicativo de sessão (denso, uso longo) + documentos (a ficha).
- Público: o Mestre e um grupo pequeno de amigos, no computador e no celular.
- Adjetivos: tátil, legível, sóbrio, analógico, preciso.
- Essência: papel sobre a mesa.


## As cinco decisões

### 1. Dois mundos, não um

Duas superfícies completas e deliberadas. Nenhuma é "o tema"; cada tela
pertence a uma delas, ou põe uma folha de papel sobre a mesa.

| Mundo | O que é | Onde |
|---|---|---|
| **Mesa** (escura) | o ambiente da sessão: a sala, o tampo, o mapa | Visão Geral, Combate, Mapas, rolador, chat, presença, menus |
| **Papel** (clara) | o documento: leitura longa e preenchimento | ficha do jogador, criação/edição de campanha, a folha da entrada, diário, verbetes do compêndio e bestiário |

Regras:
- O papel é uma FOLHA: tem borda, sombra de papel sobre a mesa e margem.
  Nunca encosta nas bordas da janela no computador. Assim fica claro que
  é um objeto em cima da mesa, e não um tema que falhou ao carregar.
- Cada mundo tem a própria tinta: o acento é o mesmo (tinta azul), em
  dois tons — escuro sobre o papel, claro sobre a mesa.
- Componente nenhum muda de cor "porque está no outro mundo" por acaso:
  ele usa só os nomes de uso (`--cor-texto`, `--cor-acento`...), e quem
  diz o mundo é o contêiner, com a classe `.mundo-mesa` ou `.mundo-papel`
  (ver Tokens). O mesmo botão fica certo nos dois.

### 2. A faceta do d20 é a assinatura

O arco gótico sai. No lugar, a face do icosaedro: um TRIÂNGULO. Não se
desenha dado; usa-se a forma, sempre com a mesma geometria:

- **Ângulo:** 60°, o da aresta da face do d20. Todo corte e todo marcador
  usa esse ângulo — é ele que faz a forma ser reconhecível.
- **Canto de faceta** (`--faceta: 14px`): um canto cortado a 60°, no canto
  superior direito, só em cartões que importam (a folha da entrada, o
  resultado do dado, o cartão do combatente da vez). Nunca em todos.
- **Marcador:** um triângulo cheio de 8px no lugar do pingo de luz antes
  dos títulos de seção, e como marcador do item ativo na navegação.
- **Separador de seção:** linha de 1px com o triângulo de 8px no meio.
- **Moldura de retrato:** o hexágono da silhueta do d20 visto de frente.

### 3. Quadriculado

O papel quadriculado é o fundo dos lugares onde se desenha ou se planeja:
o mapa, a área de anotação, o cabeçalho de uma seção de papel.

- Quadrado de 20px (o "5 mm" do papel de verdade), linha de 1px.
- No papel: tinta azul a 9% (`--quadricula-papel`). Na mesa: giz a 5%
  (`--quadricula-mesa`).
- No máximo UMA região quadriculada por tela, e nunca atrás de parágrafo
  de leitura. É fundo de seção, não papel de parede.

### 4. O número é o herói

O resultado do d20, o PV, a CA, a iniciativa são o design. Eles usam a
escala de destaque (`--t-numero-*`), em Inter peso 600, numerais tabulares
(`font-variant-numeric: tabular-nums`) e espaçamento apertado (-0,02em). O
rótulo do número é pequeno e quieto; o número é grande. Nada de brilho em
volta: o tamanho já basta.

### 5. Escalas que não existiam

Medição do style.css antigo (2026-10-14): nenhum token de espaçamento nem
de tipo; só 317 de 789 espaçamentos múltiplos de 4 (com 5, 7, 9, 11, 13...
em dezenas de lugares); fontes de 8,5 a 16px em passos de meio pixel, em
px e rem misturados. Os passos abaixo partem do que mais se usava (8, 12,
16) e fecham numa base de 4px.


## Cor

Todas as cores do site vêm destes tokens. Valor escrito à mão fora deles
é erro (o style.css antigo tinha `rgba(77,141,255,...)` 130 vezes).

### Mesa

| Token | Hex | Papel |
|---|---|---|
| `--mesa` | `#1c1b19` | o tampo: fundo das telas de sessão (grafite quente, não preto) |
| `--mesa-2` | `#25231f` | painéis e cartões sobre o tampo |
| `--mesa-3` | `#2f2c27` | elevado: hover, item ativo, menu aberto |
| `--giz` | `#ece7dd` | texto principal sobre a mesa |
| `--giz-2` | `#b3ab9e` | texto de apoio sobre a mesa |
| `--linha-mesa` | `rgba(236,231,221,.12)` | bordas e divisões sobre a mesa |

### Papel

| Token | Hex | Papel |
|---|---|---|
| `--papel` | `#eff0ec` | a folha: branco frio de papel de cópia (NÃO creme — ver nota) |
| `--papel-2` | `#e3e5df` | campo, linha de tabela, seção dentro da folha |
| `--grafite` | `#22231f` | texto principal sobre o papel |
| `--grafite-2` | `#565951` | texto de apoio sobre o papel |
| `--linha-papel` | `rgba(34,35,31,.16)` | bordas e divisões sobre o papel |

**Nota sobre o papel (2026-10-14):** a primeira versão usava `#f3f0e9`,
praticamente o `#F4F1EA` creme que é hoje um dos fundos mais típicos de
interface gerada por IA (creme + serifa + acento terracota). Trocado por
um branco FRIO de papel de cópia: a ficha impressa, não o pergaminho.

### Tinta (o acento — um só, em dois tons)

| Token | Hex | Onde |
|---|---|---|
| `--tinta` | `#2b4b8c` | sobre o papel: link, foco, botão principal, seleção |
| `--tinta-clara` | `#9bb4e6` | sobre a mesa: o mesmo papel |

### Estado (informação, nunca enfeite)

| Token (papel / mesa: `-claro`) | Sobre o papel | Sobre a mesa | Uso |
|---|---|---|---|
| `--estado-perigo` | `#a8352a` | `#e6908a` | erro, dano, inimigo, "abatido" |
| `--estado-sucesso` | `#2e6f49` | `#8cc7a3` | cura, vida cheia, confirmado |
| `--estado-atencao` | `#8a5a12` | `#d9a650` | ferido, aviso de atenção |

(O prefixo `estado-` não é enfeite: `--perigo` já existe no CSS antigo, com
outro valor. Os nomes novos não podem colidir com os antigos enquanto as
duas direções convivem — senão as páginas ainda não migradas mudariam de
cor sozinhas.)

O âmbar é cor de ESTADO. Sem dourado como enfeite (continua valendo).

### Contraste medido (WCAG, texto comum pede 4,5:1)

| Par | Razão |
|---|---|
| giz / mesa | 13,97 |
| giz-2 / mesa · mesa-2 · mesa-3 | 7,57 · 6,90 · 6,11 |
| tinta-clara / mesa · mesa-3 | 8,25 · 6,66 |
| perigo · sucesso · atenção (claros) / mesa-2 | 6,51 · 8,08 · 7,11 |
| grafite / papel · papel-2 | 13,81 · 12,45 |
| grafite-2 / papel · papel-2 | 6,23 · 5,62 |
| tinta / papel · papel-2 | 7,37 · 6,65 |
| papel / tinta (texto do botão principal) | 7,37 |
| perigo · sucesso · atenção / papel | 5,72 · 5,26 · 5,17 (atenção / papel-2: 4,66) |

Não há terceiro nível de texto: o apoio é `--giz-2` / `--grafite-2`, e
ambos passam com folga. Texto mais apagado que isso não existe.


## Tipografia

- **Inter** — interface, texto e NÚMEROS (tabulares). Pesos 400 e 600.
- **Marcellus** — só o título da tela e o nome da campanha. Mais nada.
- Unidade: `rem` (respeita o tamanho de letra que a pessoa escolheu).
  Base 16px.
- **Sem caixa alta em rótulo.** Hierarquia por peso e cor. (O CSS antigo
  tinha `text-transform: uppercase` em 41 regras.) Exceção nenhuma.

| Token | Tamanho | Linha | Peso | Uso |
|---|---|---|---|---|
| `--t-legenda` | 12px · .75rem | 1.4 | 400 | data, contador, meta |
| `--t-apoio` | 14px · .875rem | 1.45 | 400 | dica, texto de apoio, interface densa da mesa |
| `--t-rotulo` | 14px · .875rem | 1.4 | 600 | rótulo de campo e de número |
| `--t-corpo` | 16px · 1rem | 1.55 | 400 | texto, campos (16px evita o zoom do iPhone) |
| `--t-secao` | 20px · 1.25rem | 1.3 | 600 | título de seção (Inter) |
| `--t-titulo` | 31px · 1.95rem | 1.15 | 400 | título da tela (Marcellus) |
| `--t-numero-p` | 25px · 1.5625rem | 1 | 600 | CA, PV no cartão |
| `--t-numero-m` | 39px · 2.4375rem | 1 | 600 | PV da ficha, iniciativa da vez |
| `--t-numero-g` | 61px · 3.8125rem | 1 | 600 | o resultado do d20 |

Escala de razão 1,25 a partir de 16 (12,8 · 16 · 20 · 25 · 31 · 39 · 49 ·
61), com 12 e 14 como passos de interface. Menor que 12px: não existe.


## Espaçamento

Base de 4px. Nenhum valor fora destes passos.

| Token | px | Uso típico |
|---|---|---|
| `--e-1` | 4 | ícone e texto; dentro de um chip |
| `--e-2` | 8 | entre itens de um grupo |
| `--e-3` | 12 | dentro de um controle compacto |
| `--e-4` | 16 | entre campos; margem do cartão no celular |
| `--e-5` | 24 | margem do cartão; entre grupos |
| `--e-6` | 32 | entre seções |
| `--e-7` | 48 | margem da folha de papel |
| `--e-8` | 64 | respiro de página |

Ritmo: apertado dentro do grupo (`--e-2`), folgado entre grupos (`--e-5`
ou mais). Um valor igual em todo lugar é o "quase certo" que se quer
evitar.


## Forma e profundidade

Raio e sombra carregam HIERARQUIA. Não existe "o raio do card".

| Coisa | Raio | Profundidade |
|---|---|---|
| Campo, botão, chip (no papel e na mesa) | `--r-1: 2px` | nenhuma: borda de 1px |
| Painel/cartão sobre a mesa | `--r-2: 6px` | nenhuma: deitado no tampo, borda `--linha-mesa` |
| Folha de papel sobre a mesa | `--r-1` + canto de faceta | `--sombra-papel` (a folha sobre o tampo) |
| Menu, diálogo (acima de tudo) | `--r-2` | `--sombra-acima` |
| Cartão que importa | `--r-2` + canto de faceta | a do mundo onde está |

- `--sombra-papel`: `0 1px 0 rgba(0,0,0,.35), 0 18px 32px -18px rgba(0,0,0,.65)`
- `--sombra-acima`: `0 16px 40px -12px rgba(0,0,0,.6)`
- **Sem brilho.** Nenhuma sombra colorida, nenhum glow, nenhum pulsar (o
  CSS antigo tinha 34 sombras azuis). Destaque é cor, peso e tamanho.
- **Sem pílula** (raio 999px). Chip é retângulo de `--r-1`.


## Foco e interação

- Foco: contorno de 2px na tinta do mundo (`--tinta` no papel,
  `--tinta-clara` na mesa), afastado 2px. Sem brilho.
- Item ativo da navegação: o marcador triangular, não um fundo brilhante.
- Hover só onde existe mouse: `@media (hover: hover)`. No toque, o efeito
  não gruda.
- Alvo de toque: 24px no mínimo; 44px em tela de toque
  (`@media (pointer: coarse)`).


## Movimento

- Duração: `--m-rapido: 120ms` (hover, foco), `--m-normal: 200ms` (abrir
  menu, trocar aba). Nada contínuo, nada que pulse.
- Saída suave: `cubic-bezier(.2, .7, .2, 1)`. Anima só transform e opacity.
- `prefers-reduced-motion: reduce` desliga TODA animação e transição — sem
  lista de exceções (no CSS antigo, `pulsar` e `surgir-menu` escapavam).


## Responsivo

Do celular para cima (`min-width`), quatro larguras e só elas:

| Token (nome) | A partir de | O que muda |
|---|---|---|
| celular | 0 | uma coluna; folha de papel ocupa a largura menos `--e-4` |
| `--q-tablet` | 720px | duas colunas onde houver |
| `--q-notebook` | 1024px | a mesa ganha o painel lateral |
| `--q-larga` | 1280px | três colunas da sessão |

Nada de largura fixa em px para coluna: `minmax()`, `clamp()` e `%`. (O
CSS antigo tinha 8 larguras de quebra diferentes, e colunas fixas na mesa.)


## Tokens (a fonte da verdade, em CSS)

```css
:root {
  /* mesa */
  --mesa: #1c1b19; --mesa-2: #25231f; --mesa-3: #2f2c27;
  --giz: #ece7dd; --giz-2: #b3ab9e; --linha-mesa: rgba(236, 231, 221, .12);
  /* papel */
  --papel: #eff0ec; --papel-2: #e3e5df;
  --grafite: #22231f; --grafite-2: #565951; --linha-papel: rgba(34, 35, 31, .16);
  /* tinta e estado (tom escuro = papel; claro = mesa) */
  --tinta: #2b4b8c; --tinta-clara: #9bb4e6;
  --estado-perigo: #a8352a; --estado-perigo-claro: #e6908a;
  --estado-sucesso: #2e6f49; --estado-sucesso-claro: #8cc7a3;
  --estado-atencao: #8a5a12; --estado-atencao-claro: #d9a650;
  /* quadriculado */
  --quadricula-papel: rgba(43, 75, 140, .09);
  --quadricula-mesa: rgba(236, 231, 221, .05);
  --quadrado: 20px;
  /* tipo */
  --fonte: 'Inter', 'Segoe UI', system-ui, sans-serif;
  --fonte-titulo: 'Marcellus', Georgia, serif;
  --t-legenda: .75rem; --t-apoio: .875rem; --t-rotulo: .875rem; --t-corpo: 1rem;
  --t-secao: 1.25rem; --t-titulo: 1.95rem;
  --t-numero-p: 1.5625rem; --t-numero-m: 2.4375rem; --t-numero-g: 3.8125rem;
  /* espaço */
  --e-1: 4px; --e-2: 8px; --e-3: 12px; --e-4: 16px;
  --e-5: 24px; --e-6: 32px; --e-7: 48px; --e-8: 64px;
  /* forma */
  --r-1: 2px; --r-2: 6px; --faceta: 14px;
  --sombra-papel: 0 1px 0 rgba(0, 0, 0, .35), 0 18px 32px -18px rgba(0, 0, 0, .65);
  --sombra-acima: 0 16px 40px -12px rgba(0, 0, 0, .6);
  /* com canto de faceta, o clip-path corta a box-shadow: a sombra vai
     num invólucro, como filtro */
  --sombra-papel-filtro: drop-shadow(0 1px 0 rgba(0, 0, 0, .35)) drop-shadow(0 14px 14px rgba(0, 0, 0, .45));
  /* movimento */
  --m-rapido: 120ms; --m-normal: 200ms; --curva: cubic-bezier(.2, .7, .2, 1);
}
```

Em cada mundo, os nomes de USO apontam para a superfície certa, para o
componente ser escrito uma vez só:

```css
.mundo-mesa {
  --cor-fundo: var(--mesa);   --cor-fundo-2: var(--mesa-2);   --cor-fundo-3: var(--mesa-3);
  --cor-texto: var(--giz);    --cor-apoio: var(--giz-2);      --cor-linha: var(--linha-mesa);
  --cor-acento: var(--tinta-clara);
  --cor-perigo: var(--estado-perigo-claro);  --cor-sucesso: var(--estado-sucesso-claro);
  --cor-atencao: var(--estado-atencao-claro); --cor-quadricula: var(--quadricula-mesa);
}
.mundo-papel {
  --cor-fundo: var(--papel);  --cor-fundo-2: var(--papel-2);  --cor-fundo-3: var(--papel-2);
  --cor-texto: var(--grafite); --cor-apoio: var(--grafite-2); --cor-linha: var(--linha-papel);
  --cor-acento: var(--tinta);
  --cor-perigo: var(--estado-perigo);  --cor-sucesso: var(--estado-sucesso);
  --cor-atencao: var(--estado-atencao); --cor-quadricula: var(--quadricula-papel);
}
```

Um componente escreve `var(--cor-texto)`, `var(--cor-acento)`... e fica
certo nos dois mundos sem saber em qual está. (Prefixo `cor-`: `--texto`
já existe no CSS antigo.)

(As media queries não aceitam variável: as quatro larguras são escritas
como números, e só esses quatro.)


## O que não se faz

- Caixa alta em rótulo. Brilho, glow, pulsar. Pílula. Raio e sombra iguais
  em todos os cartões. Cor fora dos tokens. Fonte menor que 12px. Valor de
  espaço fora da escala. Mais de uma região quadriculada por tela.
- Dourado como enfeite. Emoji na interface (ícones continuam SVG em traço
  que herdam a cor do texto).
- Desenhar dados como decoração: a faceta é uma FORMA, não uma ilustração.


## Preservado da versão anterior

- As "portas" da entrada (tenho um convite / vou mestrar), com o
  formulário revelado depois da escolha.
- `role="alert"` (erro) e `role="status"` (aviso) nas mensagens.
- Um `<h1>` por tela; campo com rótulo visível ou `aria-label`; foco
  sempre visível; alvos de toque de pelo menos 24px; todo o comportamento.


## Migração

| Passo | Estado |
|---|---|
| 1. Este DESIGN.md | feito (2026-10-14) |
| 2. Tokens no `:root` do style.css (definidos; as regras antigas intactas) | feito (2026-10-14): 6 páginas com estilo final idêntico antes e depois |
| 3. Protótipo: só a tela de entrada, na branch `redesenho-mesa` | feito (2026-10-14): seção 39 do style.css, sob `.entrada-nova` |
| 4. Comparação antes/depois, e aprovação | a fazer |
| 5. As outras 10 telas, uma por vez | depois da aprovação |


## Changelog

- 2026-10-14: direção nova, "a mesa, não o jogo". Substitui "pedra fria e
  luz arcana" (2026-10-12/13), que fica no histórico do Git.
