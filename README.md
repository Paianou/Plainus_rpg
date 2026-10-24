# Plainus RPG

Uma mesa virtual para jogar D&D 5e com os amigos: o Mestre controla o
mundo, cada jogador o próprio personagem, tudo em tempo real.

## Como rodar

```
npm install     uma vez (baixa o Express e o Socket.IO)
npm start       liga o servidor
```

Depois, abra `http://localhost:3000`.

## Jogar com os amigos (pelo link do Cloudflare)

Dois terminais, os dois abertos durante a sessão:

```
npm start
cloudflared tunnel --url http://localhost:3000
```

O segundo mostra o link `https://...trycloudflare.com` (muda a cada vez).
Os jogadores entram por ele, em "Tenho um convite", com o código da mesa.

**O Mestre também mestra pelo link**, com uma **conta de Mestre**:

1. Uma vez só, no computador do servidor, abra
   `http://localhost:3000/admin.html` e crie a conta de administrador
   (a sua). Ela também é uma conta de Mestre.
2. Para outro Mestre, gere um convite de Mestre na mesma página e mande
   o código a ele: com o código, ele cria a própria conta na entrada.
3. Pelo link, em "Vou mestrar", entre com usuário e senha: dá para criar
   campanha, restaurar backup e abrir as suas campanhas em "Minhas
   campanhas" — o link muda a cada vez, a conta não.

Campanhas criadas antes das contas aparecem em "Mesas deste computador
sem conta", no navegador em que você é o Mestre delas: "Trazer para a
minha conta" pede a senha do Mestre da campanha (ou, se ela não tiver
senha, que você esteja no computador do servidor).

Sem conta, criar campanha só funciona em `http://localhost:3000`. A
antiga `PLAINUS_SENHA_SERVIDOR` do `.env` não é mais usada.

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
