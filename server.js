/* ===================================================================
   server.js — o servidor da mesa

   Passo 1: entregar o site (a lista branca, logo abaixo).
   Passo 2: o tempo real com Socket.IO — por enquanto, quem está na mesa.

   COMO RODAR
     npm install     uma vez (baixa o Express e o Socket.IO)
     npm start       liga o servidor
     abra http://localhost:3000

   O QUE ELE FAZ POR ENQUANTO
   Entrega os arquivos do site — o mesmo que o duplo clique fazia, mas
   por http:// — e mantém uma ligação em tempo real com cada painel
   aberto, para mostrar quem está na mesa. Ainda não guarda campanha
   nenhuma: cada navegador continua com a sua cópia no localStorage.
   O próximo passo traz a campanha para cá.

   Por que já vale a pena: com http://, o navegador trata o site como
   um site de verdade — o "Copiar convite" passa a copiar um LINK, a
   área de transferência funciona, e o Cloudflare Tunnel tem para onde
   apontar.


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
const { Server } = require('socket.io');
const { criarArmazem, ID_CAMPANHA } = require('./servidor/armazem.js');

const RAIZ = __dirname;
const PORTA = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
/* Onde as campanhas ficam no disco. A pasta data/ está no .gitignore:
   campanha de verdade (com os segredos do Mestre) nunca sobe pro Git. */
const PASTA_DADOS = process.env.DATA_DIR || path.join(RAIZ, 'data');


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

/* Todo o resto: não existe. */
app.use(function (pedido, resposta) {
  resposta.status(404).type('text').send('Não encontrado.');
});


/* ===================================================================
   O TEMPO REAL (Socket.IO) — passo 2: quem está na mesa

   Uma conexão aberta entre cada navegador e o servidor, que fica ligada
   enquanto a página está aberta. Por ela o servidor AVISA os navegadores
   na hora — sem eles ficarem perguntando "mudou algo?".

   Por enquanto ela carrega uma coisa só: a PRESENÇA. Cada navegador diz
   em que campanha está e quem é; o servidor junta todo mundo da mesma
   campanha numa "sala" e manda para a sala a lista de quem está lá.
   A campanha em si continua no navegador — trazê-la para cá é o
   próximo passo.

   O QUE AINDA É CONFIANÇA (e deixa de ser no passo da segurança)
   O nome e o papel vêm do navegador, como hoje vêm do sessionStorage:
   quem quiser mentir, mente. Para a PRESENÇA isso é inofensivo (no
   máximo aparece um nome errado na lista); para mexer na campanha,
   não será — lá entra o token assinado pelo servidor.
   =================================================================== */

const servidor = http.createServer(app);

/* Uma página de OUTRO site, aberta no seu navegador, poderia abrir uma
   conexão com a sua mesa (o navegador deixa — é o "Cross-Site WebSocket
   Hijacking"). O navegador sempre manda o cabeçalho Origin dizendo de
   que site a página veio: só aceitamos quando é este mesmo endereço.
   Sem Origin (um programa, não um navegador), não há vítima a proteger. */
function origemConfere(pedido) {
  const origem = pedido.headers.origin;
  if (!origem) return true;
  try {
    return new URL(origem).host === pedido.headers.host;
  } catch (erro) {
    return false;
  }
}

const io = new Server(servidor, {
  /* Só WebSocket. O Socket.IO também sabe conversar por "long-polling"
     (uma requisição HTTP que fica aberta esperando novidade), mas o
     navegador só abre 6 conexões por endereço — com algumas abas da
     mesa abertas, essas requisições presas enchiam a fila e as páginas
     novas esperavam segundos para carregar um script. WebSocket é uma
     conexão à parte, todo navegador atual tem, e o Cloudflare Tunnel
     também. De quebra, uma porta de entrada a menos no servidor. */
  transports: ['websocket'],
  /* Nenhuma mensagem nossa passa de alguns KB; 100 KB é folga e corta
     de cara quem tentar mandar megabytes para encher a memória. */
  maxHttpBufferSize: 100 * 1024,
  allowRequest: function (pedido, responder) {
    responder(null, origemConfere(pedido));
  }
});

/* Quem está em cada conexão: socket.id → { sala, nome, papel }. */
const presenca = new Map();
const LIMITE_POR_SALA = 20;
const LIMITE_ENTRADAS_POR_MINUTO = 10;

function quemEstaNaSala(sala) {
  const lista = [];
  presenca.forEach(function (p) { if (p.sala === sala) lista.push({ nome: p.nome, papel: p.papel }); });
  /* O Mestre primeiro; os jogadores em ordem alfabética. */
  return lista.sort(function (a, b) {
    if (a.papel !== b.papel) return a.papel === 'mestre' ? -1 : 1;
    return a.nome.localeCompare(b.nome);
  });
}

function avisarSala(sala) {
  io.to(sala).emit('presenca', quemEstaNaSala(sala));
}

io.on('connection', function (socket) {
  let entradas = 0;
  const contagem = setInterval(function () { entradas = 0; }, 60 * 1000);

  /* "Estou na campanha X, sou fulano." Tudo é conferido: o que chega
     pela conexão é entrada de usuário, como um formulário. */
  socket.on('entrar', function (dados) {
    entradas += 1;
    if (entradas > LIMITE_ENTRADAS_POR_MINUTO) return;
    if (!dados || typeof dados !== 'object') return;

    const campanhaId = dados.campanhaId;
    const nome = typeof dados.nome === 'string' ? dados.nome.trim().slice(0, 30) : '';
    const papel = dados.papel === 'mestre' ? 'mestre' : 'jogador';
    if (typeof campanhaId !== 'string' || !ID_CAMPANHA.test(campanhaId) || !nome) return;

    const sala = 'campanha:' + campanhaId;
    if (quemEstaNaSala(sala).length >= LIMITE_POR_SALA) return;

    /* Trocou de campanha na mesma conexão: sai da sala antiga. */
    const antes = presenca.get(socket.id);
    if (antes && antes.sala !== sala) {
      socket.leave(antes.sala);
      presenca.delete(socket.id);
      avisarSala(antes.sala);
    }

    presenca.set(socket.id, { sala: sala, nome: nome, papel: papel });
    socket.join(sala);
    avisarSala(sala);
  });

  /* Fechou a aba, caiu a internet: sai da lista, e a sala fica sabendo. */
  socket.on('disconnect', function () {
    clearInterval(contagem);
    const quem = presenca.get(socket.id);
    presenca.delete(socket.id);
    if (quem) avisarSala(quem.sala);
  });
});


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
