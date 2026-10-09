/* ===================================================================
   app.js — o comportamento da tela de entrada (index.html)

   A tela responde a uma pergunta: "o que você veio fazer?"

     Suas mesas         quem VOLTA. Um cartão por mesa deste navegador:
                        as campanhas que você mestra ("Continuar", vai
                        para o painel do Mestre) e as mesas em que você
                        joga ("Voltar para a mesa", vai para a sua ficha).
     Tenho um convite   quem chega com o código (ou com o link) do
                        Mestre. Vai para o painel do jogador.
     Vou mestrar        quem vai criar uma campanha. Vai para a
                        criação em etapas (criar-campanha.html).

   As duas últimas são "portas": a pessoa escolhe uma e só então vê o
   formulário dela. Guardar campanhas, mesas e sessão é trabalho do
   campanhas.js — este arquivo só decide para onde a pessoa vai.


   ===================================================================
   O QUE ISTO PROTEGE, E O QUE NÃO PROTEGE
   ===================================================================
   É a mesma "placa, não porta" do topo do layout.js. Sem servidor,
   tudo roda no navegador de quem está usando — qualquer um pode abrir
   o DevTools e escrever papel: 'mestre' na sessão (sessionStorage).
   Isto aqui impede o jogador de cair no painel sem querer; não impede
   quem quer entrar.

   Uma porta, porém, foi FECHADA de verdade nesta tela: o código de
   convite não leva mais ao painel do Mestre. Antes, quem soubesse o
   código marcava "Mestre" e entrava como Mestre (problema 1 do
   CLAUDE.md). Agora o código só faz jogador; o Mestre volta pelo
   cartão da campanha dele.

   Quando o servidor existir, o papel deixa de ser declarado aqui:
     - Mestre é quem CRIOU a sala, e o servidor lembra disso;
     - o Mestre em outro computador entra com a senha da campanha;
     - o servidor devolve um token assinado, e é o token — não o que
       está escrito no navegador — que prova quem você é.
   (Problemas 1 e 2 da lista de segurança do CLAUDE.md.)
   =================================================================== */

const LIMITE_NOME = 30;
const LIMITE_CAMPANHA = 60;

/* O que a entrada passa para a criação de campanha. sessionStorage
   porque é rascunho de passagem: só precisa durar até a próxima tela. */
const CHAVE_RASCUNHO = 'plainus:rascunho-campanha';

/* Quantos retratos da party cabem no cartão antes do "+2". */
const RETRATOS_NO_CARTAO = 5;


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

  porta: null,          /* 'convite' | 'mestrar' | null (as duas portas à vista) */


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

  mostrarAviso: function (texto) {
    document.getElementById('aviso').textContent = texto;
  },


  /* ---------- Suas mesas ----------

     Um cartão por mesa. Para montar os retratos e o mapa de fundo é
     preciso abrir o Estado de cada campanha — coisa que o índice do
     campanhas.js existe para evitar. Aqui vale a pena: são poucas
     campanhas, e é a tela onde ver o mundo de vocês faz diferença. */

  desenharMesas: function () {
    const self = this;
    const area = document.getElementById('campanhasSalvas');
    const lista = document.getElementById('listaCampanhas');

    const cartoes = [];
    Campanhas.listar().forEach(function (c) {
      cartoes.push({ quando: c.atualizadaEm || 0, montar: function () { return self.cartaoMestre(c); } });
    });
    Mesas.listar().forEach(function (m) {
      const c = Campanhas.achar(m.campanhaId);
      cartoes.push({ quando: Math.max(c.atualizadaEm || 0, m.em || 0), montar: function () { return self.cartaoJogador(c, m); } });
    });

    /* Da mais recente para a mais antiga, misturando os papéis: quem
       abre a entrada quase sempre quer a mesa da última sessão. */
    cartoes.sort(function (a, b) { return b.quando - a.quando; });

    lista.textContent = '';
    cartoes.forEach(function (c) { lista.appendChild(c.montar()); });
    area.hidden = cartoes.length === 0;

    document.getElementById('subtitulo').textContent = cartoes.length
      ? 'Que bom te ver de volta. Escolha a mesa — ou abra uma nova porta.'
      : 'Crie uma campanha ou entre na de um amigo.';
  },

  /* As partes que os dois cartões dividem: o fundo (o mapa da cena
     atual, bem apagado), o selo do papel, o nome e o menu "⋯". */
  cartaoBase: function (classe, campanha, estado, selo, itensMenu) {
    const cartao = el('article', 'cartao-mesa ' + classe);

    /* O mapa da cena atual como fundo. imagemDaCena (dados.js) só
       devolve um JPEG em base64 conferido — e só por isso ele pode
       entrar num url() de CSS sem abrir porta para injeção. */
    const cena = estado && (estado.cenas || []).find(function (x) { return x.id === estado.cenaAtual; });
    const fundo = imagemDaCena(cena || (estado && (estado.cenas || [])[0]));
    if (fundo) {
      const camada = el('div', 'fundo-mesa');
      camada.style.backgroundImage = 'url("' + fundo + '")';
      cartao.appendChild(camada);
    }

    const topo = el('div', 'topo-mesa');
    topo.appendChild(el('span', 'selo-mesa ' + selo[0], selo[1]));
    topo.appendChild(this.menuMesa(campanha.nome, itensMenu));
    cartao.appendChild(topo);

    cartao.appendChild(el('h3', 'campanha-nome', campanha.nome));
    return cartao;
  },

  cartaoMestre: function (c) {
    const estado = Campanhas.lerEstado(c.id);

    const backup = el('button', '', 'Baixar backup');
    backup.type = 'button';
    backup.dataset.acao = 'backup';
    backup.dataset.id = c.id;

    const esquecer = el('button', 'perigo', 'Esquecer campanha');
    esquecer.type = 'button';
    esquecer.dataset.acao = 'esquecer';
    esquecer.dataset.id = c.id;

    /* .campanha-salva: o nome que a lista sempre teve (e que os testes
       procuram) — continua marcando os cartões de MESTRE. */
    const cartao = this.cartaoBase('campanha-salva', c, estado, ['mestre', 'Mestre'], [backup, esquecer]);

    cartao.appendChild(this.retratos(estado, null));

    /* Quando foi o último backup — ou o lembrete de que nunca houve. */
    const quando = Backup.quandoFoi(c.id);
    const meta = el('div', 'campanha-meta', ['Sessão ' + c.sessao, this.haQuanto(c.atualizadaEm)].filter(Boolean).join(' · ') + ' · ');
    meta.appendChild(el('span', 'campanha-backup' + (quando ? '' : ' nunca'), quando ? 'Backup ' + quando : 'Sem backup'));
    cartao.appendChild(meta);

    const continuar = el('button', 'botao-mesa', 'Continuar');
    continuar.type = 'button';
    continuar.dataset.acao = 'continuar';
    continuar.dataset.id = c.id;
    continuar.setAttribute('aria-label', 'Continuar a campanha ' + c.nome + ' como Mestre');
    cartao.appendChild(continuar);
    return cartao;
  },

  cartaoJogador: function (c, mesa) {
    const estado = Campanhas.lerEstado(c.id);
    const heroi = ((estado && estado.herois) || []).find(function (h) { return h.dono === mesa.jogadorId; });

    const sair = el('button', '', 'Tirar da lista');
    sair.type = 'button';
    sair.dataset.acao = 'tirar-mesa';
    sair.dataset.id = c.id;
    sair.dataset.jogador = mesa.jogadorId;

    const cartao = this.cartaoBase('mesa-jogador', c, estado, ['jogador', heroi ? 'Jogando com ' + heroi.nome : 'Jogador'], [sair]);

    cartao.appendChild(this.retratos(estado, mesa.jogadorId));

    /* O personagem já está no selo; aqui vai QUEM joga — no mesmo
       computador, a Ana e o Bruno podem ter cada um o seu cartão. */
    const quem = heroi ? mesa.nome : mesa.nome + ' · ainda sem personagem';
    cartao.appendChild(el('div', 'campanha-meta',
      [quem, 'Sessão ' + c.sessao, c.mestre ? 'Mestre: ' + c.mestre : '', this.haQuanto(c.atualizadaEm)].filter(Boolean).join(' · ')));

    const voltar = el('button', 'botao-mesa', heroi ? 'Voltar para a mesa' : 'Criar meu personagem');
    voltar.type = 'button';
    voltar.dataset.acao = 'voltar-mesa';
    voltar.dataset.id = c.id;
    voltar.dataset.jogador = mesa.jogadorId;
    voltar.setAttribute('aria-label', 'Voltar para a mesa ' + c.nome + ' como ' + mesa.nome);
    cartao.appendChild(voltar);
    return cartao;
  },

  /* A party em miniatura: foto quando houver, inicial quando não. No
     cartão do jogador, o personagem dele vem primeiro e aceso. */
  retratos: function (estado, meuId) {
    const fila = el('div', 'retratos-mesa');
    const herois = ((estado && estado.herois) || []).slice().sort(function (a, b) {
      return (b.dono === meuId) - (a.dono === meuId);
    });
    if (!herois.length) {
      fila.appendChild(el('span', 'sem-party', 'Ninguém criou personagem ainda'));
      return fila;
    }
    herois.slice(0, RETRATOS_NO_CARTAO).forEach(function (h) {
      const bola = el('span', 'retrato-mini' + (meuId && h.dono === meuId ? ' meu' : ''));
      const foto = retratoSeguro(h.ficha && h.ficha.foto);
      if (foto) {
        const img = document.createElement('img');
        img.src = foto;
        img.alt = '';
        bola.appendChild(img);
      } else {
        bola.textContent = String(h.nome || '?').charAt(0).toUpperCase();
      }
      bola.title = h.nome || '';
      fila.appendChild(bola);
    });
    if (herois.length > RETRATOS_NO_CARTAO) fila.appendChild(el('span', 'retrato-mini mais', '+' + (herois.length - RETRATOS_NO_CARTAO)));
    return fila;
  },

  /* O menu "⋯" do cartão: as ações raras (backup, esquecer) saem da
     frente e não disputam espaço com o Continuar. <details> já abre e
     fecha sozinho, com teclado e leitor de tela, sem JS. */
  menuMesa: function (nome, itens) {
    const menu = el('details', 'menu-mesa');
    const botao = el('summary', 'botao-opcoes');
    botao.setAttribute('aria-label', 'Mais opções de ' + nome);
    botao.appendChild(Icone.svg('opcoes', 18));
    menu.appendChild(botao);
    const caixa = el('div', 'itens-menu-mesa');
    itens.forEach(function (i) { caixa.appendChild(i); });
    menu.appendChild(caixa);
    return menu;
  },

  /* "hoje", "ontem", "há 5 dias", "há 2 meses". */
  haQuanto: function (quando) {
    if (!quando) return '';
    const meiaNoite = new Date(); meiaNoite.setHours(0, 0, 0, 0);
    const dias = Math.ceil((meiaNoite - quando) / 86400000);
    if (dias <= 0) return 'hoje';
    if (dias === 1) return 'ontem';
    if (dias < 45) return 'há ' + dias + ' dias';
    return 'há ' + Math.round(dias / 30) + ' meses';
  },


  /* ---------- Entrar por um cartão ---------- */

  continuar: function (id) {
    if (!Campanhas.achar(id)) return;
    if (!Sessao.gravar({ papel: 'mestre', campanhaId: id })) {
      this.mostrarErroArmazenamento();
      return;
    }
    location.href = 'mestre.html';
  },

  /* O cartão do jogador leva pelo MESMO caminho de quem digita o
     código: grava a sessão de jogador e abre o painel dele. */
  voltarMesa: function (id, jogadorId) {
    const mesa = Mesas.listar().find(function (m) { return m.campanhaId === id && m.jogadorId === jogadorId; });
    if (!mesa) return;
    if (!Sessao.gravar({ papel: 'jogador', campanhaId: id, nome: mesa.nome, jogadorId: jogadorId })) {
      this.mostrarErroArmazenamento();
      return;
    }
    Mesas.lembrar(id, mesa.nome, jogadorId);
    location.href = 'jogador.html';
  },

  /* Esquece na hora e oferece desfazer — sem o "Tem certeza?" (ver
     Layout.recadoDesfazer, no layout.js, para o porquê). Aqui apaga a
     campanha INTEIRA, então a volta guarda tudo o que sai junto: o
     Estado, os cartões de jogador, a data do backup e a sessão da aba.
     Se a pessoa fechar a página antes de desfazer, aí sim é para sempre. */
  esquecer: function (id) {
    const self = this;
    const campanha = Campanhas.achar(id);
    if (!campanha) return;

    const estado = Campanhas.lerEstado(id);
    const mesas = Mesas.listar().filter(function (m) { return m.campanhaId === id; });
    const dataBackup = Backup.ultimo(id);
    const sessao = Sessao.ler();
    const eraDestaAba = !!(sessao && sessao.campanhaId === id);

    Campanhas.apagar(id);
    Backup.esquecerData(id);
    Mesas.esquecer(id);
    if (eraDestaAba) Sessao.limpar();

    this.desenharMesas();

    this.recadoDesfazer('"' + campanha.nome + '" foi esquecida.', function () {
      if (!estado || !Campanhas.salvarEstado(id, estado)) {
        self.mostrarErro('Não deu para trazer a campanha de volta — o navegador recusou a gravação.');
        return;
      }
      mesas.forEach(function (m) { Mesas.lembrar(m.campanhaId, m.nome, m.jogadorId); });
      if (dataBackup) Backup.marcarData(id, dataBackup);
      if (eraDestaAba) Sessao.gravar(sessao);
      self.desenharMesas();
      self.mostrarAviso('"' + campanha.nome + '" está de volta.');
    });
  },

  /* O recado com "Desfazer" — a mesma ideia do layout.js, que esta tela
     não carrega. Mais tempo na tela que nos painéis (12s): aqui o que
     sai é uma campanha inteira. */
  recadoDesfazer: function (texto, desfazer) {
    const area = document.getElementById('recados');
    const botao = el('button', 'desfazer-recado', 'Desfazer');
    botao.type = 'button';
    const caixa = el('div', 'recado-flutuante com-acao');
    caixa.appendChild(el('span', '', texto));
    caixa.appendChild(botao);

    let usado = false;
    botao.addEventListener('click', function () {
      if (usado) return;
      usado = true;
      caixa.remove();
      desfazer();
    });

    area.appendChild(caixa);
    while (area.children.length > 3) area.removeChild(area.firstChild);
    setTimeout(function () { caixa.remove(); }, 12000);
  },

  /* Só tira o cartão: o personagem continua na campanha, e o código
     traz a pessoa de volta quando quiser. Por isso não pergunta. */
  tirarMesa: function (id, jogadorId) {
    Mesas.esquecer(id, jogadorId);
    this.desenharMesas();
  },


  /* ---------- Backup (backup.js) ---------- */

  baixarBackup: function (id) {
    this.limparErro();
    if (!Backup.baixar(id)) {
      this.mostrarErro('Não deu para ler essa campanha para o backup.');
      return;
    }
    this.mostrarAviso('Backup baixado. Guarde o arquivo num lugar fora deste navegador — pendrive, nuvem, e-mail para você mesmo.');
    this.desenharMesas();
  },

  restaurarBackup: function (arquivo) {
    const self = this;
    this.limparErro();
    Backup.restaurar(arquivo).then(function (resultado) {
      if (!resultado.ok) {
        self.mostrarErro(resultado.erro);
        return;
      }
      self.desenharMesas();
      self.mostrarAviso(resultado.copia
        ? 'Essa campanha já estava aqui, então o backup entrou como cópia: "' + resultado.nome + '". As duas estão na lista — esqueça a que não quiser.'
        : 'Campanha "' + resultado.nome + '" restaurada. Ela está em "Suas mesas", acima.');
    });
  },


  /* ---------- As duas portas ---------- */

  abrirPorta: function (qual) {
    this.porta = qual === 'mestrar' ? 'mestrar' : 'convite';
    this.limparErro();

    document.getElementById('portas').hidden = true;
    const form = document.getElementById('formPorta');
    form.hidden = false;
    /* Tira e põe a classe para a animação de entrada rodar de novo. */
    form.classList.remove('abrindo'); void form.offsetWidth; form.classList.add('abrindo');

    const convite = this.porta === 'convite';
    document.getElementById('tituloPorta').textContent = convite ? 'Tenho um convite' : 'Vou mestrar';
    document.getElementById('blocoConvite').hidden = !convite;
    document.getElementById('blocoMestrar').hidden = convite;
    if (!convite) document.getElementById('conviteAchado').hidden = true;

    /* O foco vai para o primeiro campo vazio: com o nome lembrado, a
       pessoa cai direto no código (ou no nome da campanha). */
    const nome = document.getElementById('nome');
    const seguinte = document.getElementById(convite ? 'codigo' : 'campanha');
    (nome.value.trim() && !seguinte.value ? seguinte : nome).focus();
  },

  fecharPorta: function () {
    this.porta = null;
    this.limparErro();
    document.getElementById('formPorta').hidden = true;
    document.getElementById('portas').hidden = false;
    const primeira = document.querySelector('.porta');
    if (primeira) primeira.focus();
  },


  /* ---------- O link de convite ----------

     index.html#convite=K7QM-2XRP-9HVD abre direto a porta do convite,
     com o código preenchido. Se a campanha existe neste navegador,
     mostra para ONDE a pessoa está entrando.

     O código vai depois do #, e não num ?codigo=: a parte do # nunca
     é enviada ao servidor, então não fica nos registros dele quando o
     site estiver no ar. */
  lerConvite: function () {
    const achado = /^#convite=(.+)$/.exec(location.hash);
    if (!achado) return;

    let texto;
    try { texto = decodeURIComponent(achado[1]); } catch (erro) { return; }
    const codigo = Campanhas.normalizarCodigo(texto);
    if (!codigo) return;

    document.getElementById('codigo').value = codigo;
    this.abrirPorta('convite');

    const campanha = Campanhas.acharPorCodigo(codigo);
    const aviso = document.getElementById('conviteAchado');
    if (campanha) {
      aviso.textContent = '';
      aviso.appendChild(document.createTextNode('Você foi convidado para '));
      aviso.appendChild(el('strong', '', campanha.nome));
      aviso.appendChild(document.createTextNode(campanha.mestre ? ' · Mestre: ' + campanha.mestre : ''));
      aviso.hidden = false;
    }
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
    Mesas.guardarNome(nome);
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

  /* O código só leva ao painel do JOGADOR (ver o topo do arquivo). */
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

    const jogadorId = this.jogadorIdPara(campanha.id, nome);
    if (!Sessao.gravar({ papel: 'jogador', campanhaId: campanha.id, nome: nome, jogadorId: jogadorId })) {
      this.mostrarErroArmazenamento();
      return;
    }

    /* Da próxima vez, um cartão em "Suas mesas" — sem código. */
    Mesas.lembrar(campanha.id, nome, jogadorId);
    location.href = 'jogador.html';
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
    if (meu) return meu.dono;

    /* Ainda sem personagem, mas já entrou antes com este nome: o mesmo
       id, para não virar um segundo cartão em "Suas mesas". */
    const mesa = Mesas.listar().find(function (m) {
      return m.campanhaId === campanhaId && m.nome.toLowerCase() === alvo;
    });
    return mesa ? mesa.jogadorId : Campanhas.novoId().replace(/^c/, 'j');
  },


  /* ---------- Eventos ---------- */

  ligar: function () {
    const self = this;

    /* Os ícones das portas e do Voltar vêm do icones.js — o mesmo
       traço do resto do site, em vez de SVG copiado no HTML. */
    document.querySelectorAll('[data-icone]').forEach(function (lugar) {
      lugar.insertBefore(Icone.svg(lugar.dataset.icone, lugar.classList.contains('porta-icone') ? 22 : 16), lugar.firstChild);
    });

    document.getElementById('portas').addEventListener('click', function (evento) {
      const porta = evento.target.closest('[data-porta]');
      if (porta) self.abrirPorta(porta.dataset.porta);
    });
    document.getElementById('btnVoltarPorta').addEventListener('click', function () { self.fecharPorta(); });

    document.getElementById('btnCriar').addEventListener('click', function () { self.criar(); });
    document.getElementById('btnEntrar').addEventListener('click', function () { self.entrar(); });

    /* Enter confirma o formulário aberto. Sem <form>, o navegador não
       faz isso sozinho. Esc volta às portas. */
    document.getElementById('formPorta').addEventListener('keydown', function (evento) {
      if (evento.key === 'Escape') { self.fecharPorta(); return; }
      if (evento.key !== 'Enter' || evento.target.tagName !== 'INPUT') return;
      if (self.porta === 'mestrar') self.criar(); else self.entrar();
    });

    document.getElementById('listaCampanhas').addEventListener('click', function (evento) {
      const alvo = evento.target.closest('[data-acao]');
      if (!alvo) return;
      const menu = alvo.closest('details');
      if (menu) menu.open = false;
      if (alvo.dataset.acao === 'continuar') self.continuar(alvo.dataset.id);
      if (alvo.dataset.acao === 'voltar-mesa') self.voltarMesa(alvo.dataset.id, alvo.dataset.jogador);
      if (alvo.dataset.acao === 'esquecer') self.esquecer(alvo.dataset.id);
      if (alvo.dataset.acao === 'tirar-mesa') self.tirarMesa(alvo.dataset.id, alvo.dataset.jogador);
      if (alvo.dataset.acao === 'backup') self.baixarBackup(alvo.dataset.id);
    });

    /* Um menu "⋯" aberto fecha ao clicar fora dele, ou ao abrir outro. */
    document.addEventListener('click', function (evento) {
      document.querySelectorAll('.menu-mesa[open]').forEach(function (menu) {
        if (!menu.contains(evento.target)) menu.open = false;
      });
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
    document.getElementById('formPorta').addEventListener('input', function () {
      self.limparErro();
    });

    /* Um link de convite colado com a página já aberta. */
    window.addEventListener('hashchange', function () { self.lerConvite(); });
  }
};


document.getElementById('nome').value = Mesas.ultimoNome();
Entrada.desenharMesas();
Entrada.ligar();
Entrada.lerConvite();
