/* ===================================================================
   app.js — o comportamento da tela de entrada (index.html)

   Três caminhos saem daqui:

     Suas campanhas     as campanhas já criadas NESTE navegador. Só
                        aparece se houver alguma. "Continuar" entra
                        direto no painel do Mestre.
     Criar campanha     confere seu nome e o da campanha e leva para a
                        criação em etapas (criar-campanha.html), onde
                        o resto é preenchido.
     Entrar com código  procura a campanha pelo código. Mestre vai
                        para o painel dele (mestre.html); jogador, para
                        o dele (jogador.html), onde cria ou abre a ficha.

   Guardar campanhas e sessão é trabalho do campanhas.js — este
   arquivo só decide para onde a pessoa vai.


   ===================================================================
   O QUE ISTO PROTEGE, E O QUE NÃO PROTEGE
   ===================================================================
   É a mesma "placa, não porta" do topo do layout.js. Sem servidor,
   tudo roda no navegador de quem está usando — qualquer um pode abrir
   o DevTools e escrever papel: 'mestre' na sessão (sessionStorage). Isto aqui
   impede o jogador de cair no painel sem querer; não impede quem quer
   entrar.

   Quando o servidor existir, o papel deixa de ser declarado aqui:
     - Mestre é quem CRIOU a sala, e o servidor lembra disso;
     - quem entrar marcando "Mestre" precisa da senha da campanha;
     - o servidor devolve um token assinado, e é o token — não o que
       está escrito no navegador — que prova quem você é.
   (Problemas 1 e 2 da lista de segurança do CLAUDE.md.)
   =================================================================== */

const LIMITE_NOME = 30;
const LIMITE_CAMPANHA = 60;

/* O que a entrada passa para a criação de campanha. sessionStorage
   porque é rascunho de passagem: só precisa durar até a próxima tela. */
const CHAVE_RASCUNHO = 'plainus:rascunho-campanha';


/* Monta um elemento com texto. É a versão mínima do criar() do
   layout.js, que esta tela não carrega. O texto entra SEMPRE por
   textContent: o nome da campanha foi digitado por alguém. */
function el(tag, classe, texto) {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}


const Entrada = {

  /* ---------- Mensagens ---------- */

  mostrarErro: function (texto, campo) {
    document.getElementById('erro').textContent = texto;

    /* aria-invalid avisa o leitor de tela QUAL campo está errado; o
       texto do #erro (role="alert") diz o porquê. */
    if (campo) {
      campo.setAttribute('aria-invalid', 'true');
      campo.focus();
    }
  },

  limparErro: function () {
    document.getElementById('erro').textContent = '';
    document.getElementById('aviso').textContent = '';
    document.querySelectorAll('[aria-invalid]').forEach(function (campo) {
      campo.removeAttribute('aria-invalid');
    });
  },


  /* ---------- Suas campanhas ---------- */

  desenharCampanhas: function () {
    const area = document.getElementById('campanhasSalvas');
    const lista = document.getElementById('listaCampanhas');
    const campanhas = Campanhas.listar();

    lista.textContent = '';
    area.hidden = campanhas.length === 0;

    campanhas.forEach(function (c) {
      const meta = [c.sistema, 'Sessão ' + c.sessao, c.mestre ? 'Mestre: ' + c.mestre : '']
        .filter(Boolean).join(' · ');

      /* Quando foi o último backup — ou o lembrete de que nunca houve. */
      const quando = Backup.quandoFoi(c.id);
      const estadoBackup = el('span', 'campanha-backup' + (quando ? '' : ' nunca'),
        quando ? 'Backup ' + quando : 'Sem backup');

      const linhaMeta = el('div', 'campanha-meta', meta + ' · ');
      linhaMeta.appendChild(estadoBackup);

      const info = el('div', 'campanha-info');
      info.appendChild(el('div', 'campanha-nome', c.nome));
      info.appendChild(linhaMeta);

      /* data-id, e não onclick com o id dentro: ver problema 5 do
         CLAUDE.md. Um único listener lá embaixo lê o data-id. */
      const continuar = el('button', 'botao-compacto', 'Continuar');
      continuar.type = 'button';
      continuar.dataset.acao = 'continuar';
      continuar.dataset.id = c.id;

      const backup = el('button', 'botao-compacto neutro', 'Backup');
      backup.type = 'button';
      backup.dataset.acao = 'backup';
      backup.dataset.id = c.id;
      backup.title = 'Baixar um arquivo com a campanha inteira';
      backup.setAttribute('aria-label', 'Baixar backup da campanha ' + c.nome);

      const esquecer = el('button', 'botao-compacto discreto', 'Esquecer');
      esquecer.type = 'button';
      esquecer.dataset.acao = 'esquecer';
      esquecer.dataset.id = c.id;
      esquecer.setAttribute('aria-label', 'Esquecer a campanha ' + c.nome);

      const linha = el('div', 'campanha-salva');
      linha.appendChild(info);
      linha.appendChild(continuar);
      linha.appendChild(backup);
      linha.appendChild(esquecer);
      lista.appendChild(linha);
    });
  },

  continuar: function (id) {
    if (!Campanhas.achar(id)) return;
    if (!Sessao.gravar({ papel: 'mestre', campanhaId: id })) {
      this.mostrarErroArmazenamento();
      return;
    }
    location.href = 'mestre.html';
  },

  /* Apagar não tem desfazer — e aqui apaga a campanha INTEIRA. */
  esquecer: function (id) {
    const campanha = Campanhas.achar(id);
    if (!campanha) return;

    const certeza = window.confirm('Esquecer a campanha "' + campanha.nome
      + '"? Heróis, NPCs, diário e mapas dela serão apagados deste navegador. Isso não tem desfazer.');
    if (!certeza) return;

    Campanhas.apagar(id);
    Backup.esquecerData(id);

    const sessao = Sessao.ler();
    if (sessao && sessao.campanhaId === id) Sessao.limpar();

    this.desenharCampanhas();
  },


  /* ---------- Backup (backup.js) ---------- */

  baixarBackup: function (id) {
    this.limparErro();
    if (!Backup.baixar(id)) {
      this.mostrarErro('Não deu para ler essa campanha para o backup.');
      return;
    }
    this.mostrarAviso('Backup baixado. Guarde o arquivo num lugar fora deste navegador — pendrive, nuvem, e-mail para você mesmo.');
    this.desenharCampanhas();
  },

  restaurarBackup: function (arquivo) {
    const self = this;
    this.limparErro();
    Backup.restaurar(arquivo).then(function (resultado) {
      if (!resultado.ok) {
        self.mostrarErro(resultado.erro);
        return;
      }
      self.desenharCampanhas();
      self.mostrarAviso(resultado.copia
        ? 'Essa campanha já estava aqui, então o backup entrou como cópia: "' + resultado.nome + '". As duas estão na lista — esqueça a que não quiser.'
        : 'Campanha "' + resultado.nome + '" restaurada. Ela está na lista acima.');
    });
  },

  mostrarAviso: function (texto) {
    document.getElementById('aviso').textContent = texto;
  },


  /* ---------- Campos ---------- */

  /* O nome é pedido pelos dois caminhos, então a checagem é uma só. */
  lerNome: function () {
    const campo = document.getElementById('nome');
    const nome = campo.value.trim();

    if (!nome) {
      this.mostrarErro('Diga como a mesa te chama.', campo);
      return null;
    }
    /* O maxlength do HTML já segura a digitação, mas ele é só uma
       orientação ao navegador. Quem grava o dado confere de novo. */
    if (nome.length > LIMITE_NOME) {
      this.mostrarErro('O nome pode ter até ' + LIMITE_NOME + ' letras.', campo);
      return null;
    }
    return nome;
  },

  mostrarErroArmazenamento: function () {
    this.mostrarErro('O navegador não deixou guardar sua entrada. Se estiver numa aba anônima, tente numa aba normal.');
  },


  /* ---------- Criar e entrar ---------- */

  /* Não cria nada ainda: só leva o que já foi digitado para a tela
     de criação, que pede o resto. */
  criar: function () {
    this.limparErro();

    const nome = this.lerNome();
    if (!nome) return;

    const campo = document.getElementById('campanha');
    const campanha = campo.value.trim();

    if (!campanha) {
      this.mostrarErro('Dê um nome à campanha.', campo);
      return;
    }
    if (campanha.length > LIMITE_CAMPANHA) {
      this.mostrarErro('O nome da campanha pode ter até ' + LIMITE_CAMPANHA + ' letras.', campo);
      return;
    }

    try {
      sessionStorage.setItem(CHAVE_RASCUNHO, JSON.stringify({ mestre: nome, nome: campanha }));
    } catch (erro) {
      /* Sem o rascunho, a criação só começa com os campos em branco. */
    }

    location.href = 'criar-campanha.html';
  },


  entrar: function () {
    this.limparErro();

    const nome = this.lerNome();
    if (!nome) return;

    const campo = document.getElementById('codigo');
    if (!campo.value.trim()) {
      this.mostrarErro('Digite o código que o Mestre te passou.', campo);
      return;
    }

    const codigo = Campanhas.normalizarCodigo(campo.value);
    if (!codigo) {
      this.mostrarErro('Esse código não existe. São 12 letras e números, no formato XXXX-XXXX-XXXX.', campo);
      return;
    }
    campo.value = codigo;            /* mostra como ficou, já arrumado */

    /* Formato certo não quer dizer que a campanha existe. Sem servidor,
       só existem as campanhas criadas neste navegador. */
    const campanha = Campanhas.acharPorCodigo(codigo);
    if (!campanha) {
      this.mostrarErro('Nenhuma campanha com esse código neste navegador. Enquanto não houver servidor, o código só funciona no computador onde a campanha foi criada.', campo);
      return;
    }

    /* Só 'mestre' abre o painel. Qualquer outro valor — inclusive um
       que alguém tenha mexido no HTML — conta como jogador. */
    const marcado = document.querySelector('input[name="papel"]:checked');
    const papel = marcado && marcado.value === 'mestre' ? 'mestre' : 'jogador';

    const sessao = papel === 'mestre'
      ? { papel: 'mestre', campanhaId: campanha.id }
      : { papel: 'jogador', campanhaId: campanha.id, nome: nome, jogadorId: this.jogadorIdPara(campanha.id, nome) };

    if (!Sessao.gravar(sessao)) {
      this.mostrarErroArmazenamento();
      return;
    }

    location.href = papel === 'mestre' ? 'mestre.html' : 'jogador.html';
  },


  /* Quem é este jogador nesta campanha?

     Se já existe um personagem cujo jogador tem este nome, é ele
     voltando: recebe o mesmo id e cai na ficha que já tinha. Senão,
     ganha um id novo e vai criar a ficha.

     Reconhecer pelo NOME é uma placa, não uma porta: quem digitar o
     nome de outro jogador entra no lugar dele (problema 2 do
     CLAUDE.md). Sem servidor não há como provar quem é quem; com ele,
     o reconhecimento passa a ser por um token assinado. */
  jogadorIdPara: function (campanhaId, nome) {
    const estado = Campanhas.lerEstado(campanhaId);
    const alvo = nome.toLowerCase();
    const meu = ((estado && estado.herois) || []).find(function (h) {
      return h.dono && (h.jogador || '').toLowerCase() === alvo;
    });
    return meu ? meu.dono : Campanhas.novoId().replace(/^c/, 'j');
  },


  /* ---------- Eventos ---------- */

  ligar: function () {
    const self = this;

    document.getElementById('btnCriar').addEventListener('click', function () { self.criar(); });
    document.getElementById('btnEntrar').addEventListener('click', function () { self.entrar(); });

    /* Enter confirma o bloco em que você está digitando. Sem <form>,
       o navegador não faz isso sozinho. */
    document.getElementById('campanha').addEventListener('keydown', function (evento) {
      if (evento.key === 'Enter') self.criar();
    });
    document.getElementById('codigo').addEventListener('keydown', function (evento) {
      if (evento.key === 'Enter') self.entrar();
    });

    document.getElementById('listaCampanhas').addEventListener('click', function (evento) {
      const alvo = evento.target.closest('[data-acao]');
      if (!alvo) return;
      if (alvo.dataset.acao === 'continuar') self.continuar(alvo.dataset.id);
      if (alvo.dataset.acao === 'esquecer') self.esquecer(alvo.dataset.id);
      if (alvo.dataset.acao === 'backup') self.baixarBackup(alvo.dataset.id);
    });

    /* O botão abre a janela de escolher arquivo; o change traz o
       arquivo escolhido. O value é zerado depois para que escolher o
       MESMO arquivo de novo também dispare o change. */
    const arquivo = document.getElementById('arquivoBackup');
    document.getElementById('btnRestaurar').addEventListener('click', function () { arquivo.click(); });
    arquivo.addEventListener('change', function () {
      if (arquivo.files[0]) self.restaurarBackup(arquivo.files[0]);
      arquivo.value = '';
    });

    /* O erro some assim que a pessoa começa a corrigir. */
    document.querySelector('.entrada-caixa').addEventListener('input', function () {
      self.limparErro();
    });
  }
};


Entrada.desenharCampanhas();
Entrada.ligar();
