# Plainus RPG

Uma mesa virtual para jogar D&D 5e com os amigos: o Mestre controla o
mundo, cada jogador o próprio personagem, tudo em tempo real.

## Como rodar

```
npm install     uma vez (baixa o Express e o Socket.IO)
npm start       liga o servidor
```

Depois, abra `http://localhost:3000`.

## Onde fica cada coisa

```
publico/      o que o navegador baixa: as páginas (.html), os scripts
              (.js), o estilo (style.css) e vendor/ (o Three.js)
servidor/     o servidor por dentro: campanhas, API, mesa em tempo real
testes/       os testes (npm test)
server.js     liga tudo: entrega publico/, a API e a mesa
DESIGN.md     a identidade visual, como regra
data/         as campanhas gravadas (não vai para o Git)
```

Três arquivos de `publico/` rodam também no servidor, porque os dois
lados precisam das mesmas regras: `modelo.js` (o formato da campanha),
`acoes.js` (o que o Mestre muda) e `visao.js` (o que o jogador vê e
faz).

## Testes

```
npm run test:node   só os testes no Node (segundos)
npm test            tudo, incluindo os roteiros num Edge sem janela
```
