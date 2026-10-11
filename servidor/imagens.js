/* ===================================================================
   servidor/imagens.js — as imagens moram fora da campanha

   O PROBLEMA
   Um mapa é um JPEG de até ~500 KB, guardado como texto (base64) dentro
   da campanha. A cada mudança — um token arrastado, uma rolagem —, a
   campanha inteira viaja para cada pessoa na mesa, com todos os mapas e
   retratos dentro. Na rede de casa, passa; pela internet, trava.

   A SAÍDA
   Cada imagem vira um arquivo em data/imagens/, e a campanha guarda só
   o endereço dela:

     antes:  "imagem": "data:image/jpeg;base64,/9j/4AAQSkZJRg… (500 KB)"
     depois: "imagem": "img/3f9a…c2.jpg"                      (70 letras)

   O navegador baixa cada imagem UMA vez (GET /img/…, que o server.js
   entrega com cache longo) e a guarda; a campanha que viaja fica leve.

   O NOME DO ARQUIVO É O RESUMO DO CONTEÚDO (sha256)
     - a mesma imagem duas vezes vira um arquivo só;
     - um arquivo nunca muda (conteúdo novo = nome novo), por isso o
       navegador pode guardá-lo para sempre sem perguntar de novo;
     - o nome não dá para adivinhar: só chega a ele quem recebeu a
       campanha (ou a visão) que o cita. O mapa de uma cena que os
       jogadores ainda não viram não chega a eles — nem o nome dele.

   QUEM FAZ A TROCA
   O site continua mandando a imagem como texto (data:image/jpeg…), do
   jeito de sempre; o servidor tira as imagens da campanha logo depois
   de cada ação (extrair). Ao baixar um backup, elas voltam para dentro
   (embutir) — o backup continua um arquivo só.

   LIMITES (problema 4 do CLAUDE.md)
     - cada imagem: JPEG de verdade (os primeiros bytes conferidos) e
       até TAMANHO_MAXIMO;
     - cada campanha: até ESPACO_POR_CAMPANHA em imagens.
   Imagem que nenhuma campanha usa mais é apagada (limpar).
   =================================================================== */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TAMANHO_MAXIMO = 600 * 1024;               /* bytes de JPEG, por imagem */
/* bytes, somando as imagens; PLAINUS_ESPACO_IMAGENS só nos testes */
const ESPACO_POR_CAMPANHA = Number(process.env.PLAINUS_ESPACO_IMAGENS) || 40 * 1024 * 1024;

const DADOS_JPEG = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/;
const ENDERECO = /^img\/([0-9a-f]{64})\.jpg$/;
const ARQUIVO = /^[0-9a-f]{64}\.jpg$/;


/* Os lugares da campanha onde mora imagem. `trocar(valor)` devolve o
   valor novo (ou undefined para tirar o campo). Um lugar novo de imagem
   no site entra AQUI — e só aqui. */
function percorrer(estado, trocar) {
  const lista = function (x) { return Array.isArray(x) ? x : []; };
  lista(estado.cenas).forEach(function (cena) {
    if (cena && cena.imagem !== undefined) mudar(cena, 'imagem', trocar);
  });
  lista(estado.herois).forEach(function (h) {
    if (h && h.ficha && h.ficha.foto !== undefined) mudar(h.ficha, 'foto', trocar);
  });
  lista(estado.monstrosMeus).forEach(function (m) {
    if (m && m.foto !== undefined) mudar(m, 'foto', trocar);
  });
  const fotos = estado.fotosMonstros;
  if (fotos && typeof fotos === 'object' && !Array.isArray(fotos)) {
    Object.keys(fotos).forEach(function (nome) { mudar(fotos, nome, trocar); });
  }
}

function mudar(objeto, campo, trocar) {
  const novo = trocar(objeto[campo]);
  if (novo === undefined) delete objeto[campo];
  else objeto[campo] = novo;
}


function criarImagens(pastaDados, avisar) {
  const log = avisar || function () {};
  const pasta = path.join(pastaDados, 'imagens');
  fs.mkdirSync(pasta, { recursive: true });

  const caminho = function (resumo) { return path.join(pasta, resumo + '.jpg'); };

  /* resumo → tamanho em bytes (para não perguntar ao disco toda hora) */
  const tamanhos = new Map();
  function tamanhoDe(resumo) {
    if (tamanhos.has(resumo)) return tamanhos.get(resumo);
    let t = 0;
    try { t = fs.statSync(caminho(resumo)).size; } catch (erro) { /* não existe */ }
    tamanhos.set(resumo, t);
    return t;
  }

  /* Guarda uma imagem que veio como texto. Devolve o endereço, ou
     { erro }. JPEG começa sempre com os bytes FF D8 FF: um arquivo que
     só DIZ ser JPEG (o texto pode dizer qualquer coisa) não passa. */
  function guardar(texto) {
    const achado = DADOS_JPEG.exec(texto);
    if (!achado) return { erro: 'Imagem em formato que o site não aceita.' };
    const bytes = Buffer.from(achado[1], 'base64');
    if (bytes.length < 4 || bytes[0] !== 0xFF || bytes[1] !== 0xD8 || bytes[2] !== 0xFF) return { erro: 'Essa imagem não é um JPEG de verdade.' };
    if (bytes.length > TAMANHO_MAXIMO) return { erro: 'Imagem grande demais (até ' + Math.round(TAMANHO_MAXIMO / 1024) + ' KB).' };
    const resumo = crypto.createHash('sha256').update(bytes).digest('hex');
    if (!fs.existsSync(caminho(resumo))) {
      const temporario = caminho(resumo) + '.tmp';
      fs.writeFileSync(temporario, bytes);
      fs.renameSync(temporario, caminho(resumo));
    }
    tamanhos.set(resumo, bytes.length);
    return { endereco: 'img/' + resumo + '.jpg' };
  }

  /* Tira as imagens de dentro da campanha (no próprio objeto). Imagem
     que não passa nas regras sai da campanha. Devolve
     { mudou, recusadas } — recusadas: quantas foram tiradas. */
  function extrair(estado) {
    let mudou = false;
    let recusadas = 0;
    percorrer(estado, function (valor) {
      if (valor === null || valor === undefined) return valor;
      if (typeof valor === 'string' && ENDERECO.test(valor)) return valor;
      mudou = true;
      if (typeof valor !== 'string') { recusadas += 1; return undefined; }
      const r = guardar(valor);
      if (r.erro) { recusadas += 1; return undefined; }
      return r.endereco;
    });
    return { mudou: mudou, recusadas: recusadas };
  }

  /* Os resumos das imagens que a campanha usa. */
  function usadas(estado) {
    const conjunto = new Set();
    percorrer(estado, function (valor) {
      const achado = typeof valor === 'string' && ENDERECO.exec(valor);
      if (achado) conjunto.add(achado[1]);
      return valor;
    });
    return conjunto;
  }

  /* Bytes das imagens da campanha (cada imagem conta uma vez). */
  function espacoDe(estado) {
    let total = 0;
    usadas(estado).forEach(function (r) { total += tamanhoDe(r); });
    return total;
  }

  /* Uma CÓPIA da campanha com as imagens de volta para dentro (o
     backup). Imagem que sumiu do disco sai da cópia. */
  function embutir(estado) {
    const copia = JSON.parse(JSON.stringify(estado));
    percorrer(copia, function (valor) {
      const achado = typeof valor === 'string' && ENDERECO.exec(valor);
      if (!achado) return valor;
      try {
        return 'data:image/jpeg;base64,' + fs.readFileSync(caminho(achado[1])).toString('base64');
      } catch (erro) {
        return undefined;
      }
    });
    return copia;
  }

  /* Apaga as imagens que nenhuma das campanhas usa. */
  function limpar(estados) {
    const vivas = new Set();
    estados.forEach(function (e) { usadas(e).forEach(function (r) { vivas.add(r); }); });
    let apagadas = 0;
    fs.readdirSync(pasta).forEach(function (nome) {
      const resumo = nome.replace(/\.jpg(\.tmp)?$/, '');
      if (nome.endsWith('.tmp') || (ARQUIVO.test(nome) && !vivas.has(resumo))) {
        try { fs.unlinkSync(path.join(pasta, nome)); apagadas += 1; tamanhos.delete(resumo); } catch (erro) { /* tanto faz */ }
      }
    });
    if (apagadas) log(apagadas + (apagadas === 1 ? ' imagem sem uso apagada.' : ' imagens sem uso apagadas.'));
    return apagadas;
  }

  /* O arquivo de um endereço /img/<nome> — ou null, se o nome não for
     de imagem nossa (o server.js nunca monta caminho com texto de fora). */
  function arquivo(nome) {
    return ARQUIVO.test(String(nome)) ? path.join(pasta, nome) : null;
  }

  return { extrair, usadas, espacoDe, embutir, limpar, arquivo, ESPACO_POR_CAMPANHA, TAMANHO_MAXIMO };
}

module.exports = { criarImagens };
