/* ===================================================================
   servidor/copias.js — as cópias de segurança automáticas

   Tudo o que a mesa guarda mora numa pasta só (data/): as campanhas
   (com as fichas dentro), as contas de Mestre e as imagens. Se o disco
   morrer, se alguém apagar a pasta, se um backup restaurado der errado,
   tudo some — e o "Baixar backup" da tela depende de alguém lembrar.

   Por isso o servidor faz, sozinho, UMA CÓPIA POR DIA da pasta inteira:

     copias/plainus-2026-10-24.json.gz

   Um arquivo só, compactado (gzip, que vem com o Node), com cada
   arquivo de data/ dentro — o caminho e o conteúdo. Para voltar, é
   desembrulhar de volta na pasta (o restaurar.js faz isso).

   QUANTAS FICAM
   As 7 mais novas (uma semana de dias), e, das mais velhas, a última de
   cada semana, por 4 semanas. Umas onze no total: o erro de ontem e o
   de três semanas atrás têm volta, e a pasta não cresce para sempre.

   ONDE
   Por padrão, na pasta copias/, ao lado de data/ (e fora do Git, como
   ela: as cópias levam os segredos do Mestre e as senhas, em resumo).
   PLAINUS_PASTA_COPIAS (no .env) troca o lugar — uma pasta do OneDrive
   ou do Google Drive, por exemplo, que leva a cópia para FORA deste
   computador sem ninguém fazer nada. Dentro de data/, não: cada cópia
   levaria as anteriores dentro, e cresceria sem fim.

   QUANDO
   Ao ligar o servidor, se ainda não houver a de hoje; e, com ele
   ligado, uma olhada por hora — virou o dia, faz a de hoje.
   =================================================================== */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const FORMATO = 'plainus-copia';
const VERSAO = 1;
const NOME = /^plainus-(\d{4})-(\d{2})-(\d{2})\.json\.gz$/;
const DIARIAS = 7;
const SEMANAIS = 4;
const UMA_HORA = 60 * 60 * 1000;

/* "2026-10-24", no dia DESTE computador (e não no de Greenwich: perto
   da meia-noite, os dois são dias diferentes). */
function diaDe(data) {
  const dois = function (n) { return String(n).padStart(2, '0'); };
  return data.getFullYear() + '-' + dois(data.getMonth() + 1) + '-' + dois(data.getDate());
}

/* A semana de um dia "AAAA-MM-DD": o número de semanas desde uma
   segunda-feira (5 de janeiro de 1970). Dois dias da mesma semana
   (segunda a domingo) dão o mesmo número. */
function semanaDe(dia) {
  const p = dia.split('-').map(Number);
  const dias = Math.floor(Date.UTC(p[0], p[1] - 1, p[2]) / 86400000);
  return Math.floor((dias - 4) / 7);
}

/* De uma lista de dias (os nomes das cópias), quais apagar: ficam as
   DIARIAS mais novas e, das outras, a mais nova de cada semana, nas
   SEMANAIS semanas mais recentes. */
function quaisApagar(dias) {
  const ordem = dias.slice().sort().reverse();
  const velhas = ordem.slice(DIARIAS);
  const semanasVistas = [];
  return velhas.filter(function (dia) {
    const semana = semanaDe(dia);
    if (semanasVistas.indexOf(semana) !== -1) return true;      /* já tem uma mais nova dessa semana */
    if (semanasVistas.length >= SEMANAIS) return true;          /* semana velha demais */
    semanasVistas.push(semana);
    return false;
  });
}

/* opcoes:
     log     (texto) → onde avisar (o console do servidor)
     antes   ()      → chamado antes de copiar: grava o que estava
                       esperando a gravação agrupada (armazem.js)
     agora   ()      → a data de agora (os testes trocam) */
function criarCopias(pastaDados, pastaCopias, opcoes) {
  opcoes = opcoes || {};
  const log = opcoes.log || function () {};
  const agora = opcoes.agora || function () { return new Date(); };
  let relogio = null;

  const dados = path.resolve(pastaDados);
  const destino = path.resolve(pastaCopias);
  const dentroDosDados = destino === dados || destino.startsWith(dados + path.sep);

  /* Cada arquivo de data/, com o caminho a partir dela ("campanhas/
     ab12.json", sempre com "/"). Os .tmp são gravações pela metade. */
  function arquivosDe(pasta, prefixo, saida) {
    fs.readdirSync(pasta, { withFileTypes: true }).forEach(function (item) {
      if (item.name.endsWith('.tmp')) return;
      const caminho = path.join(pasta, item.name);
      const relativo = prefixo ? prefixo + '/' + item.name : item.name;
      if (item.isDirectory()) arquivosDe(caminho, relativo, saida);
      else if (item.isFile()) saida[relativo] = fs.readFileSync(caminho).toString('base64');
    });
    return saida;
  }

  function existentes() {
    let nomes;
    try { nomes = fs.readdirSync(destino); } catch (erro) { return []; }
    return nomes.filter(function (n) { return NOME.test(n); }).sort().reverse();
  }

  /* Faz a cópia de hoje (substitui uma de hoje que já exista). */
  function fazer() {
    if (dentroDosDados) throw new Error('a pasta das cópias não pode ficar dentro da pasta de dados');
    if (opcoes.antes) opcoes.antes();
    const arquivos = fs.existsSync(dados) ? arquivosDe(dados, '', {}) : {};
    const quando = agora();
    const pacote = zlib.gzipSync(JSON.stringify({
      formato: FORMATO, versao: VERSAO, feitaEm: quando.toISOString(), arquivos: arquivos
    }));
    fs.mkdirSync(destino, { recursive: true });
    const final = path.join(destino, 'plainus-' + diaDe(quando) + '.json.gz');
    const temporario = final + '.tmp';
    fs.writeFileSync(temporario, pacote);
    fs.renameSync(temporario, final);
    return { arquivo: final, arquivos: Object.keys(arquivos).length, bytes: pacote.length };
  }

  /* Apaga as que passaram da conta (veja QUANTAS FICAM). */
  function podar() {
    const apagar = quaisApagar(existentes().map(function (n) { return NOME.exec(n).slice(1, 4).join('-'); }));
    apagar.forEach(function (dia) {
      try { fs.unlinkSync(path.join(destino, 'plainus-' + dia + '.json.gz')); } catch (erro) { /* já não estava lá */ }
    });
    return apagar;
  }

  /* Ainda não há a de hoje? Faz, e poda. Um erro (disco cheio, pasta
     sem permissão) vira aviso no console — e não derruba a mesa. */
  function fazerSeFaltar() {
    const hoje = 'plainus-' + diaDe(agora()) + '.json.gz';
    if (existentes().indexOf(hoje) !== -1) return null;
    try {
      const r = fazer();
      podar();
      log('Cópia de segurança: ' + r.arquivo + ' (' + r.arquivos + ' arquivos, ' + Math.max(1, Math.round(r.bytes / 1024)) + ' KB).');
      return r;
    } catch (erro) {
      log('Cópia de segurança NÃO foi feita: ' + erro.message + '. Confira a pasta ' + destino + '.');
      return { erro: erro.message };
    }
  }

  function ligar() {
    if (dentroDosDados) {
      log('Cópias de segurança DESLIGADAS: a pasta ' + destino + ' fica dentro da pasta de dados. Escolha outra em PLAINUS_PASTA_COPIAS.');
      return;
    }
    fazerSeFaltar();
    relogio = setInterval(fazerSeFaltar, UMA_HORA);
    relogio.unref();      /* o relógio sozinho não segura o servidor ligado */
  }

  function desligar() {
    if (relogio) clearInterval(relogio);
    relogio = null;
  }

  return { fazer, fazerSeFaltar, podar, existentes, ligar, desligar, pasta: destino };
}

/* Abre uma cópia: devolve { feitaEm, arquivos: { caminho: Buffer } }, ou
   lança um erro que diz o que há de errado com o arquivo. */
function lerCopia(arquivo) {
  let pacote;
  try {
    pacote = JSON.parse(zlib.gunzipSync(fs.readFileSync(arquivo)).toString('utf8'));
  } catch (erro) {
    throw new Error('não é uma cópia da Runlise (ou o arquivo está estragado)');
  }
  if (!pacote || pacote.formato !== FORMATO || typeof pacote.arquivos !== 'object' || !pacote.arquivos) {
    throw new Error('não é uma cópia da Runlise');
  }
  if (pacote.versao > VERSAO) throw new Error('a cópia é de uma versão mais nova da Runlise');
  const arquivos = {};
  Object.keys(pacote.arquivos).forEach(function (caminho) {
    arquivos[caminho] = Buffer.from(String(pacote.arquivos[caminho]), 'base64');
  });
  return { feitaEm: pacote.feitaEm, arquivos: arquivos };
}

module.exports = { criarCopias, lerCopia, quaisApagar, diaDe };
