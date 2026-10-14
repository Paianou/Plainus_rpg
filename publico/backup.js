/* ===================================================================
   backup.js — baixar a campanha num arquivo e restaurar de volta

   POR QUE ISTO EXISTE
   A campanha mora no servidor (data/campanhas/), num disco só: se ele
   estragar, ou a pasta for apagada, vai tudo — heróis, diário, mapas.
   O backup é um arquivo .json que você guarda onde quiser (pendrive,
   Google Drive, mandar para você mesmo no Discord): a cópia que não
   depende do disco de ninguém. Com as imagens dentro, num arquivo só.


   O FORMATO DO ARQUIVO

     {
       "formato": "plainus-campanha",   ← "isto é um backup nosso"
       "versao": 1,                     ← sobe se o formato mudar
       "exportadoEm": "2026-10-08T21:14:00.000Z",
       "estado": { ...o Estado inteiro da campanha... }
     }

   O "formato" e a "versao" ficam FORA do Estado de propósito: são o
   envelope. Quando o formato mudar (versão 2), quem restaura lê a
   versão e sabe converter — sem isso, um backup antigo seria um
   palpite.


   O ARQUIVO É ENTRADA DE USUÁRIO
   Um backup pode ter sido editado à mão, cortado no meio, ou ser outro
   .json qualquer. Por isso validar() confere tudo antes de gravar:
   o envelope, e cada parte do Estado contra o molde de estadoVazio()
   (modelo.js, conferirCampanha) — o que tiver o tipo errado é descartado e o painel
   recebe o valor vazio no lugar, em vez de quebrar ao abrir.

   E nada do arquivo vira HTML: o resto do site já escreve nomes e
   textos com textContent (problema 5 do CLAUDE.md), então um nome de
   campanha com <script> dentro aparece como texto, não executa.


   CUIDADO: O BACKUP TEM OS SEGREDOS
   O arquivo leva o Estado INTEIRO, inclusive o que só o Mestre vê
   (segredos, ameaça, a verdade da campanha). Não é para mandar para
   os jogadores — a tela de entrada avisa.
   =================================================================== */

const Backup = {

  FORMATO: 'plainus-campanha',
  VERSAO: 1,

  /* Bem acima do que uma campanha ocupa (o localStorage inteiro tem
     uns 5 MB), mas segura um arquivo errado de 2 GB antes de o
     navegador tentar ler tudo para a memória. */
  LIMITE_BYTES: 10 * 1024 * 1024,

  /* Quando cada campanha teve backup pela última vez: { id: data }.
     Fica numa chave À PARTE do índice porque o índice é refeito a
     partir do Estado a cada gravação (campanhas.js, resumoDe) e
     perderia o que não vem de lá. */
  CHAVE_DATAS: 'plainus:backups',


  /* ---------- Baixar ---------- */

  /* Uma mesa do servidor: o arquivo vem de lá, e só sai com a chave do
     Mestre (o backup leva os segredos). Devolve uma Promise com
     { ok: true } ou { erro }. */
  baixar: function (acesso) {
    const self = this;
    return Servidor.backup(acesso.campanhaId, acesso.chave).then(function (envelope) {
      if (envelope.erro) return envelope;
      self.entregarArquivo(envelope);
      self.marcarData(acesso.campanhaId);
      return { ok: true };
    });
  },

  /* Uma campanha da versão antiga, ainda guardada neste navegador
     (campanhas.js, Antigas): o arquivo é montado aqui mesmo. */
  baixarAntiga: function (id) {
    const estado = Antigas.ler(id);
    if (!estado) return false;
    this.entregarArquivo({ formato: this.FORMATO, versao: this.VERSAO, exportadoEm: new Date().toISOString(), estado: estado });
    return true;
  },

  /* Blob + link com "download": o jeito de uma página criar um arquivo e
     oferecer para salvar. O texto vai indentado (o 2 do stringify) para
     dar para abrir e ler num editor. */
  entregarArquivo: function (envelope) {
    const estado = envelope.estado || {};
    const arquivo = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
    const endereco = URL.createObjectURL(arquivo);

    const link = document.createElement('a');
    link.href = endereco;
    link.download = this.nomeDoArquivo(estado.campanha && estado.campanha.nome);
    document.body.appendChild(link);
    link.click();
    link.remove();

    /* O endereço do Blob segura o arquivo na memória até ser
       revogado. Um instante depois o download já começou. */
    setTimeout(function () { URL.revokeObjectURL(endereco); }, 1000);
  },

  /* "plainus-cronicas-de-ravendusk-2026-10-08.json": sem acento, sem
     espaço, sem barra — nomes que qualquer sistema aceita — e com a
     data, para dois backups não terem o mesmo nome. */
  nomeDoArquivo: function (nome) {
    const base = String(nome || 'campanha')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')   /* tira os acentos */
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'campanha';
    const hoje = new Date();
    const data = hoje.getFullYear() + '-' + ('0' + (hoje.getMonth() + 1)).slice(-2) + '-' + ('0' + hoje.getDate()).slice(-2);
    return 'plainus-' + base + '-' + data + '.json';
  },


  /* ---------- Quando foi o último ---------- */

  marcarData: function (id, quando) {
    const datas = Armazem.ler(this.CHAVE_DATAS) || {};
    datas[id] = quando || Date.now();
    Armazem.gravar(this.CHAVE_DATAS, datas);
  },

  ultimo: function (id) {
    const datas = Armazem.ler(this.CHAVE_DATAS);
    const quando = datas && datas[id];
    return typeof quando === 'number' ? quando : null;
  },

  /* "hoje", "ontem", "há 5 dias" — para a lista da entrada. */
  quandoFoi: function (id) {
    const quando = this.ultimo(id);
    if (!quando) return null;
    const meiaNoite = new Date(); meiaNoite.setHours(0, 0, 0, 0);
    const dias = Math.ceil((meiaNoite - quando) / 86400000);
    if (dias <= 0) return 'hoje';
    if (dias === 1) return 'ontem';
    return 'há ' + dias + ' dias';
  },

  /* Ao esquecer uma campanha, a data do backup dela vai junto. */
  esquecerData: function (id) {
    const datas = Armazem.ler(this.CHAVE_DATAS);
    if (!datas || !(id in datas)) return;
    delete datas[id];
    Armazem.gravar(this.CHAVE_DATAS, datas);
  },


  /* ---------- Restaurar ---------- */

  /* Lê o arquivo escolhido e, se for um backup válido, manda para o
     servidor como uma campanha NOVA — de que este navegador vira o
     Mestre (guarda a chave). Devolve (numa Promise):
       { ok: true, id, nome, codigo, codigoNovo }
       { ok: false, erro }             o texto para mostrar à pessoa */
  restaurar: function (arquivo) {
    const self = this;

    if (!arquivo) return Promise.resolve({ ok: false, erro: 'Nenhum arquivo escolhido.' });
    if (arquivo.size > this.LIMITE_BYTES) {
      return Promise.resolve({ ok: false, erro: 'Esse arquivo é grande demais para ser um backup de campanha.' });
    }

    return arquivo.text().then(function (texto) {
      let dados;
      try {
        dados = JSON.parse(texto);
      } catch (erro) {
        return { ok: false, erro: 'Esse arquivo não é um backup do Plainus (não deu para ler o conteúdo).' };
      }

      const conferido = self.validar(dados);
      if (typeof conferido === 'string') return { ok: false, erro: conferido };

      return self.gravarRestaurado(conferido).then(function (resultado) {
        /* A campanha veio DE um backup: a data dele é a data do último
           backup dela (o arquivo continua guardado em algum lugar). */
        if (resultado.ok) {
          const feito = Date.parse(dados.exportadoEm);
          self.marcarData(resultado.id, Number.isFinite(feito) && feito <= Date.now() ? feito : Date.now());
        }
        return resultado;
      });
    }, function () {
      return { ok: false, erro: 'O navegador não conseguiu ler esse arquivo.' };
    });
  },

  /* Devolve o Estado limpo, ou um texto dizendo o que está errado. */
  validar: function (dados) {
    if (!dados || typeof dados !== 'object' || dados.formato !== this.FORMATO) {
      return 'Esse arquivo não é um backup de campanha do Plainus.';
    }
    if (typeof dados.versao !== 'number' || dados.versao > this.VERSAO) {
      return 'Esse backup foi feito por uma versão mais nova do site. Atualize os arquivos e tente de novo.';
    }

    /* O que é uma campanha válida mora no modelo.js — a mesma regra
       que o servidor usa para os arquivos dele. */
    return conferirCampanha(dados.estado);
  },


  /* Sempre cria uma campanha NOVA (id novo): restaurar nunca passa por
     cima do que existe. O código de convite do backup é mantido se
     estiver livre neste servidor; se já estiver em uso (a mesma
     campanha, de outro dia, já foi restaurada), o servidor sorteia
     outro — e a pessoa fica sabendo. */
  gravarRestaurado: function (estado) {
    const codigoAntigo = normalizarCodigo(estado.campanha.codigo);
    return Servidor.criarCampanha(estado).then(function (r) {
      if (r.erro) return { ok: false, erro: r.erro };
      Acessos.lembrar({ campanhaId: r.id, papel: 'mestre', chave: r.chave, nome: estado.mestre.nome });
      return { ok: true, id: r.id, nome: estado.campanha.nome, codigo: r.codigo, codigoNovo: !!codigoAntigo && codigoAntigo !== r.codigo };
    });
  }
};
