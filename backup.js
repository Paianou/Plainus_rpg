/* ===================================================================
   backup.js — baixar a campanha num arquivo e restaurar de volta

   POR QUE ISTO EXISTE
   Sem servidor, a campanha inteira mora no localStorage DESTE
   navegador. Limpar os dados de navegação, trocar de navegador ou
   formatar o computador apaga tudo — heróis, diário, mapas — sem aviso
   e sem volta. O backup é um arquivo .json que você guarda onde quiser
   (pendrive, Google Drive, mandar para você mesmo no Discord).

   Mesmo com o servidor (passo 8 do CLAUDE.md) ele continua útil: é a
   cópia que não depende de disco de ninguém.


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
   (dados.js) — o que tiver o tipo errado é descartado e o painel
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

  /* Monta o arquivo e entrega ao navegador como download. Devolve
     false se a campanha não existir. */
  baixar: function (id) {
    const estado = Campanhas.lerEstado(id);
    if (!estado) return false;

    const envelope = {
      formato: this.FORMATO,
      versao: this.VERSAO,
      exportadoEm: new Date().toISOString(),
      estado: estado
    };

    /* Blob + link com "download": o jeito de um site criar um arquivo
       e oferecer para salvar, sem servidor. O texto vai indentado
       (o 2 do stringify) para dar para abrir e ler num editor. */
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

    this.marcarData(id);
    return true;
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

  /* Lê o arquivo escolhido e, se for um backup válido, grava como uma
     campanha deste navegador. Devolve (numa Promise, porque ler
     arquivo é assíncrono):
       { ok: true, id, nome, copia }   copia = já existia, virou cópia
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

      const resultado = self.gravarRestaurado(conferido);

      /* A campanha veio DE um backup: a data dele é a data do último
         backup dela (o arquivo continua guardado em algum lugar). */
      if (resultado.ok) {
        const feito = Date.parse(dados.exportadoEm);
        self.marcarData(resultado.id, Number.isFinite(feito) && feito <= Date.now() ? feito : Date.now());
      }
      return resultado;
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

    const salvo = dados.estado;
    if (!salvo || typeof salvo !== 'object' || Array.isArray(salvo)
        || !salvo.campanha || typeof salvo.campanha !== 'object'
        || typeof salvo.campanha.nome !== 'string' || !salvo.campanha.nome.trim()) {
      return 'O backup está incompleto: falta a campanha dentro dele.';
    }

    /* Cada parte do Estado tem de ter o MESMO tipo que tem no molde:
       lista onde é lista, texto onde é texto. O que não bater fica
       com o valor do molde. Chaves que o molde não conhece são
       descartadas — não há por que guardar o que nenhuma tela lê. */
    const molde = estadoVazio();
    const limpo = {};
    Object.keys(molde).forEach(function (chave) {
      const valor = salvo[chave];
      limpo[chave] = Backup.mesmoTipo(valor, molde[chave]) ? valor : molde[chave];
    });

    /* Dentro de "campanha", o mesmo cuidado com os campos principais:
       o índice e a entrada leem estes direto. */
    limpo.campanha.nome = limpo.campanha.nome.trim().slice(0, 60);
    if (typeof limpo.campanha.sistema !== 'string') limpo.campanha.sistema = '';
    if (typeof limpo.campanha.codigo !== 'string') limpo.campanha.codigo = '';
    if (!(limpo.campanha.sessao >= 1)) limpo.campanha.sessao = 1;
    if (typeof limpo.mestre.nome !== 'string') limpo.mestre.nome = '';

    return limpo;
  },

  /* null e undefined contam como "não veio"; lista não passa por
     objeto (typeof [] também é 'object'). */
  mesmoTipo: function (valor, modelo) {
    if (valor === null || valor === undefined) return modelo === null;
    /* No molde, null quer dizer "ainda nada": cenaAtual guarda o id da
       cena (texto), npc guarda um objeto. Lista não serve a nenhum. */
    if (modelo === null) return typeof valor === 'string' || (typeof valor === 'object' && !Array.isArray(valor));
    if (Array.isArray(modelo)) return Array.isArray(valor);
    if (typeof modelo === 'object') return typeof valor === 'object' && !Array.isArray(valor);
    return typeof valor === typeof modelo;
  },

  /* Sempre cria uma campanha NOVA (id novo): restaurar nunca passa por
     cima do que existe. Se já há uma campanha com o mesmo código — é a
     mesma campanha, e o backup é de outro dia —, a restaurada vira
     cópia, com outro código e "(backup de ...)" no nome, e as duas
     ficam na lista para você comparar e esquecer a que não quiser. */
  gravarRestaurado: function (estado) {
    const codigo = Campanhas.normalizarCodigo(estado.campanha.codigo);
    const copia = !!(codigo && Campanhas.acharPorCodigo(codigo));

    if (!codigo || copia) estado.campanha.codigo = Campanhas.gerarCodigo();
    else estado.campanha.codigo = codigo;

    if (copia) {
      const hoje = new Date().toLocaleDateString('pt-BR');
      estado.campanha.nome = (estado.campanha.nome + ' (backup de ' + hoje + ')').slice(0, 80);
    }

    const id = Campanhas.criar(estado);
    if (!id) {
      return { ok: false, erro: 'O navegador não deixou guardar a campanha — provavelmente falta espaço. Esqueça uma campanha antiga e tente de novo.' };
    }
    return { ok: true, id: id, nome: estado.campanha.nome, copia: copia };
  }
};
