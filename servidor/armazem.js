/* ===================================================================
   servidor/armazem.js — onde as campanhas moram no servidor

   Na memória, para responder rápido; no disco, para sobreviver ao
   servidor desligar. Uma campanha = um arquivo:

     data/campanhas/c1a2b3c4d5e6f7a8b.json

   O ARQUIVO É UM BACKUP
   O formato é o mesmo do "Baixar backup" da tela de entrada
   ({ formato: 'plainus-campanha', versao, estado }). Então qualquer
   arquivo desta pasta pode ser copiado para um pendrive e restaurado
   em outro lugar — e um backup antigo pode ser trazido para cá.

   GRAVAÇÃO SEGURA
   Escreve num arquivo temporário e só depois troca pelo definitivo
   (rename). Se a luz cair no meio, sobra o arquivo ANTIGO inteiro,
   nunca um arquivo pela metade.

   GRAVAÇÃO AGRUPADA
   Pintar parede gera várias mudanças por segundo. Cada mudança marca a
   campanha como "a gravar", e ela é gravada um instante depois — uma
   vez só, com tudo junto. Ao desligar o servidor, gravarPendentes()
   grava o que faltar antes de sair.

   O QUE VEM DO DISCO TAMBÉM É CONFERIDO
   Um arquivo editado à mão, ou cortado no meio, passa pelo mesmo
   conferirCampanha() do backup (modelo.js). Arquivo que não se salva é
   avisado e deixado de lado — nunca apagado: pode ser recuperado à mão.

   Este arquivo NÃO sabe nada de rede, de quem é Mestre ou de senha:
   só guarda e devolve. Quem decide quem pode o quê é o server.js.
   =================================================================== */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { conferirCampanha, sortearCodigo, normalizarCodigo } = require('../modelo.js');

const FORMATO = 'plainus-campanha';
const VERSAO = 1;

/* O id que o site gera: 'c' + 16 caracteres de 0-9a-f. É também o nome
   do arquivo — por isso nunca aceitamos outra forma: um id como
   '../../algo' nunca chega a virar caminho no disco. */
const ID_CAMPANHA = /^c[0-9a-f]{16}$/;

const ESPERA_GRAVAR = 800;          /* ms entre a mudança e a gravação */
const LIMITE_CAMPANHAS = 200;


function criarArmazem(pastaDados, avisar) {
  const log = avisar || function () {};
  const pasta = path.join(pastaDados, 'campanhas');
  fs.mkdirSync(pasta, { recursive: true });

  /* id → { estado, criadaEm, atualizadaEm } */
  const campanhas = new Map();
  /* id → o relógio da gravação agrupada */
  const aGravar = new Map();

  const arquivoDe = function (id) { return path.join(pasta, id + '.json'); };


  /* ---------- Ler o disco, ao ligar ---------- */

  function carregar() {
    fs.readdirSync(pasta).forEach(function (nome) {
      const id = nome.replace(/\.json$/, '');
      if (!nome.endsWith('.json') || !ID_CAMPANHA.test(id)) return;   /* .tmp e o que não for nosso */
      try {
        const envelope = JSON.parse(fs.readFileSync(arquivoDe(id), 'utf8'));
        if (!envelope || envelope.formato !== FORMATO) throw new Error('não é uma campanha do Plainus');
        const estado = conferirCampanha(envelope.estado);
        if (typeof estado === 'string') throw new Error(estado);
        campanhas.set(id, {
          estado: estado,
          criadaEm: Number(envelope.criadaEm) || Date.now(),
          atualizadaEm: Number(envelope.atualizadaEm) || Date.now()
        });
      } catch (erro) {
        log('Deixei de lado ' + nome + ' (' + erro.message + '). O arquivo continua lá.');
      }
    });
    return campanhas.size;
  }


  /* ---------- Gravar ---------- */

  function gravarAgora(id) {
    const relogio = aGravar.get(id);
    if (relogio) { clearTimeout(relogio); aGravar.delete(id); }
    const c = campanhas.get(id);
    if (!c) return;
    const envelope = { formato: FORMATO, versao: VERSAO, criadaEm: c.criadaEm, atualizadaEm: c.atualizadaEm, estado: c.estado };
    const final = arquivoDe(id);
    const temporario = final + '.tmp';
    fs.writeFileSync(temporario, JSON.stringify(envelope));
    fs.renameSync(temporario, final);
  }

  /* "Esta campanha mudou": grava daqui a pouco, junto com o que mais mudar. */
  function mudou(id) {
    const c = campanhas.get(id);
    if (!c) return;
    c.atualizadaEm = Date.now();
    if (aGravar.has(id)) return;
    aGravar.set(id, setTimeout(function () {
      try { gravarAgora(id); } catch (erro) { log('Não consegui gravar ' + id + ': ' + erro.message); }
    }, ESPERA_GRAVAR));
  }

  /* Ao desligar: grava o que ainda estava esperando. */
  function gravarPendentes() {
    Array.from(aGravar.keys()).forEach(function (id) {
      try { gravarAgora(id); } catch (erro) { log('Não consegui gravar ' + id + ': ' + erro.message); }
    });
  }


  /* ---------- Consultar ---------- */

  /* A linha de cada campanha, para listas — tirada do próprio estado,
     nunca guardada à parte (assim o nome na lista nunca discorda do
     nome dentro da campanha). */
  function resumo(id) {
    const c = campanhas.get(id);
    return {
      id: id,
      nome: c.estado.campanha.nome,
      sistema: c.estado.campanha.sistema,
      mestre: c.estado.mestre.nome,
      codigo: c.estado.campanha.codigo,
      sessao: c.estado.campanha.sessao,
      criadaEm: c.criadaEm,
      atualizadaEm: c.atualizadaEm
    };
  }

  function listar() {
    return Array.from(campanhas.keys()).map(resumo)
      .sort(function (a, b) { return b.atualizadaEm - a.atualizadaEm; });
  }

  /* O estado VIVO da campanha (o mesmo objeto que as ações mudam). */
  function ler(id) {
    const c = ID_CAMPANHA.test(String(id)) && campanhas.get(id);
    return c ? c.estado : null;
  }

  function acharPorCodigo(texto) {
    const codigo = normalizarCodigo(texto);
    if (!codigo) return null;
    for (const [id, c] of campanhas) {
      if (c.estado.campanha.codigo === codigo) return id;
    }
    return null;
  }


  /* ---------- Criar e apagar ---------- */

  function novoId() {
    let id;
    do { id = 'c' + crypto.randomBytes(8).toString('hex'); } while (campanhas.has(id));
    return id;
  }

  function codigoLivre() {
    let codigo;
    do { codigo = sortearCodigo(); } while (acharPorCodigo(codigo));
    return codigo;
  }

  /* Cria a partir de um estado que veio de fora (a criação em etapas,
     ou um backup). Devolve { id, codigo } ou { erro }. O código de
     convite é mantido se for válido e estiver livre; senão, sorteia
     outro — dois convites iguais apontariam para duas campanhas. */
  function criar(estadoDeFora) {
    if (campanhas.size >= LIMITE_CAMPANHAS) return { erro: 'Este servidor já tem campanhas demais.' };
    const estado = conferirCampanha(estadoDeFora);
    if (typeof estado === 'string') return { erro: estado };

    const codigo = normalizarCodigo(estado.campanha.codigo);
    estado.campanha.codigo = codigo && !acharPorCodigo(codigo) ? codigo : codigoLivre();

    const id = novoId();
    const agora = Date.now();
    campanhas.set(id, { estado: estado, criadaEm: agora, atualizadaEm: agora });
    try {
      gravarAgora(id);          /* criar é raro e importante: grava na hora */
    } catch (erro) {
      campanhas.delete(id);
      return { erro: 'Não consegui gravar a campanha no disco: ' + erro.message };
    }
    return { id: id, codigo: estado.campanha.codigo };
  }

  function apagar(id) {
    if (!campanhas.has(id)) return false;
    const relogio = aGravar.get(id);
    if (relogio) { clearTimeout(relogio); aGravar.delete(id); }
    campanhas.delete(id);
    try { fs.unlinkSync(arquivoDe(id)); } catch (erro) { /* já não estava lá */ }
    return true;
  }

  return { carregar, listar, ler, resumo, acharPorCodigo, criar, apagar, mudou, gravarPendentes, gravarAgora };
}

module.exports = { criarArmazem, ID_CAMPANHA };
