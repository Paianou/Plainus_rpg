/* ===================================================================
   server.js — o servidor da mesa

   Entrega o site (a lista branca, logo abaixo), guarda as campanhas
   (servidor/armazem.js, na pasta data/), responde às perguntas da
   entrada (servidor/api.js) e mantém a mesa em tempo real
   (servidor/mesa.js).

   COMO RODAR
     npm install     uma vez (baixa o Express e o Socket.IO)
     npm start       liga o servidor
     abra http://localhost:3000

   A campanha mora aqui: o servidor tem a cópia oficial, confere cada
   ação (só o Mestre mexe na campanha; cada jogador, só no que é dele),
   grava no disco e espalha para a mesa — a cada um, só o que ele vê.


   SÓ ENTREGA O QUE É DO SITE (uma lista branca)
   Os arquivos do site moram na raiz do repositório, junto com o que
   NÃO pode sair daqui: este server.js, o package.json, a pasta .git
   (o histórico inteiro), os testes e, mais tarde, a pasta data/ com
   as campanhas. Entregar a pasta inteira seria deixar qualquer um com
   o link baixar tudo isso. Então o servidor entrega só:
     - as páginas .html, os .js e o .css da raiz (menos o server.js)
     - a pasta vendor/ (o Three.js)
   e responde 404 para todo o resto.


   ONDE ELE ESCUTA
   Por padrão, só no próprio computador (127.0.0.1): ninguém da rede
   de casa, nem da internet, alcança — só você e o túnel do Cloudflare,
   que roda nesta mesma máquina. HOST=0.0.0.0 abre para a rede local.
   A porta vem de PORT (as hospedagens costumam definir), ou 3000.
   =================================================================== */

const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const { criarArmazem } = require('./servidor/armazem.js');
const { criarApi } = require('./servidor/api.js');
const { ligarMesa } = require('./servidor/mesa.js');

const RAIZ = __dirname;
const PORTA = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
/* Onde as campanhas ficam no disco. A pasta data/ está no .gitignore:
   campanha de verdade (com os segredos do Mestre) nunca sobe pro Git. */
const PASTA_DADOS = process.env.DATA_DIR || path.join(RAIZ, 'data');

const rotasDeTeste = process.env.PLAINUS_ROTAS_DE_TESTE === '1' && HOST === '127.0.0.1'
  ? require('./testes/rotas-de-teste.cjs') : null;


/* ---------- As campanhas (servidor/armazem.js) ---------- */
const armazem = criarArmazem(PASTA_DADOS, function (texto) { console.log(texto); });
const quantas = armazem.carregar();


/* ---------- A lista branca ---------- */

const NAO_ENTREGAR = new Set(['server.js']);
const EXTENSOES_DO_SITE = /\.(html|js|css)$/;

/* Lida uma vez, ao ligar: arquivo novo no site pede reiniciar o
   servidor (é o que acontece de qualquer jeito ao atualizar). */
const ARQUIVOS_DO_SITE = new Set(
  fs.readdirSync(RAIZ, { withFileTypes: true })
    .filter(function (e) { return e.isFile() && EXTENSOES_DO_SITE.test(e.name) && !NAO_ENTREGAR.has(e.name); })
    .map(function (e) { return e.name; })
);
const PASTAS_DO_SITE = ['vendor'];


const app = express();

/* O Express se anuncia no cabeçalho "X-Powered-By". Não há por que
   contar a quem pergunta qual software está rodando aqui. */
app.disable('x-powered-by');

/* Cabeçalhos de segurança básicos, em toda resposta:
     nosniff          o navegador não "adivinha" que um .txt é script
     DENY             nenhum outro site põe a mesa dentro de um <iframe>
                      (proteção contra clique disfarçado)
     same-origin      o endereço da mesa (com o código de convite no #)
                      não vaza para sites de fora em links */
app.use(function (pedido, resposta, seguir) {
  resposta.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin'
  });
  seguir();
});

/* "/" é a tela de entrada. */
app.get('/', function (pedido, resposta) {
  resposta.sendFile(path.join(RAIZ, 'index.html'));
});

/* Um arquivo da raiz: só se estiver na lista branca. */
app.get('/:arquivo', function (pedido, resposta, seguir) {
  if (!ARQUIVOS_DO_SITE.has(pedido.params.arquivo)) return seguir();
  resposta.sendFile(path.join(RAIZ, pedido.params.arquivo));
});

/* As pastas do site (vendor/). express.static já recusa "../" para
   sair da pasta e, com dotfiles: 'deny', arquivos escondidos. */
PASTAS_DO_SITE.forEach(function (pasta) {
  app.use('/' + pasta, express.static(path.join(RAIZ, pasta), { dotfiles: 'deny', index: false }));
});

/* As perguntas da tela de entrada (criar, entrar, cartões, backup):
   servidor/api.js. */
app.use('/api', criarApi(armazem, { semLimite: !!rotasDeTeste }));

/* Os testes do navegador (testes/rodar.mjs) ligam o servidor com
   PLAINUS_ROTAS_DE_TESTE=1 e ganham duas rotas para ler e trocar uma
   campanha por inteiro. Sem essa variável — o npm start de sempre —
   elas não existem. E nunca fora do 127.0.0.1. */
if (rotasDeTeste) rotasDeTeste.ligar(app, armazem, function () { return mesa; });

/* Todo o resto: não existe. */
app.use(function (pedido, resposta) {
  resposta.status(404).type('text').send('Não encontrado.');
});


/* ===================================================================
   O TEMPO REAL — servidor/mesa.js

   Cada painel aberto mantém uma conexão (Socket.IO, só WebSocket) com
   o servidor. Por ela entra quem tem a chave, e por ela passam as ações
   do Mestre e dos jogadores — conferidas, aplicadas na cópia oficial,
   gravadas, e espalhadas para a mesa (a cada um, só o que ele vê).
   =================================================================== */
const servidor = http.createServer(app);
const mesa = ligarMesa(servidor, armazem, function (texto) { console.log(texto); });


servidor.listen(PORTA, HOST, function () {
  /* 127.0.0.1 e 0.0.0.0 abrem no navegador como "localhost". */
  const nome = HOST === '127.0.0.1' || HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log('Plainus no ar em http://' + nome + ':' + PORTA);
  console.log('Entregando ' + ARQUIVOS_DO_SITE.size + ' arquivos do site.');
  console.log(quantas + (quantas === 1 ? ' campanha guardada' : ' campanhas guardadas') + ' em ' + PASTA_DADOS + '. Ctrl+C para desligar.');
});

/* Desligar com calma: Ctrl+C (SIGINT) ou o sistema pedindo (SIGTERM).
   Antes de sair, grava o que ainda estava esperando a gravação agrupada
   — sem isto, a última mudança antes do Ctrl+C se perderia. */
function desligar() {
  armazem.gravarPendentes();
  console.log('Campanhas gravadas. Até a próxima sessão.');
  process.exit(0);
}
process.on('SIGINT', desligar);
process.on('SIGTERM', desligar);

/* Para os testes (e o que mais precisar do servidor por dentro). */
module.exports = { armazem };
