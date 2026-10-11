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
   QUEM É QUEM: AS CHAVES
   ===================================================================
   A campanha mora no servidor, e quem entra nela prova quem é com uma
   CHAVE que o servidor deu (campanhas.js guarda; servidor/armazem.js
   confere):
     - criar uma campanha dá a chave do MESTRE a este navegador;
     - entrar com o código dá a chave daquele JOGADOR — e um nome que
       já tem dono naquela mesa é recusado;
     - o código de convite só faz jogador. Mestre é quem criou.
   (Problemas 1 e 2 da lista de segurança do CLAUDE.md.)

   O que ainda falta: o Mestre entrar de OUTRO computador (a senha da
   campanha) — e, enquanto ela não existe, a chave do Mestre mora só no
   navegador onde a campanha foi criada.
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

     Um cartão por mesa que este navegador conhece (as chaves, em
     campanhas.js). O que vai em cada cartão vem do servidor (/api/
     cartoes), e só das mesas cuja chave abre: nome, sessão, a party em
     miniatura e o mapa da cena atual. */

  desenharMesas: function () {
    const self = this;
    const area = document.getElementById('campanhasSalvas');
    const lista = document.getElementById('listaCampanhas');
    const acessos = Acessos.listar();

    document.getElementById('subtitulo').textContent = acessos.length
      ? 'Que bom te ver de volta. Escolha a mesa — ou abra uma nova porta.'
      : 'Crie uma campanha ou entre na de um amigo.';

    if (!acessos.length || !Servidor.temServidor()) {
      lista.textContent = '';
      area.hidden = true;
      return Promise.resolve();
    }

    window.plainusCarregando = true;
    return Servidor.cartoes(acessos).then(function (resposta) {
      window.plainusCarregando = false;
      lista.textContent = '';
      area.hidden = false;
      if (resposta.erro) {
        lista.appendChild(el('p', 'dica-backup', resposta.erro));
        return;
      }
      /* Da mais recente para a mais antiga, misturando os papéis: quem
         abre a entrada quase sempre quer a mesa da última sessão. */
      (resposta.cartoes || []).slice().sort(function (a, b) { return (b.atualizadaEm || 0) - (a.atualizadaEm || 0); })
        .forEach(function (c) {
          const acesso = acessos.find(function (a) { return a.campanhaId === c.campanhaId && a.papel === c.papel && (a.jogadorId || null) === (c.jogadorId || null); });
          if (!acesso) return;
          lista.appendChild(c.semAcesso ? self.cartaoSemAcesso(acesso) : c.papel === 'mestre' ? self.cartaoMestre(c) : self.cartaoJogador(c));
        });
    });
  },

  /* Os dados que identificam a linha de acesso de um cartão — vão nos
     botões, e o clique acha a linha de novo (nunca a chave no HTML). */
  marcar: function (botao, c) {
    botao.type = 'button';
    botao.dataset.id = c.campanhaId;
    botao.dataset.papel = c.papel;
    if (c.jogadorId) botao.dataset.jogador = c.jogadorId;
    return botao;
  },

  /* As partes que os cartões dividem: o fundo (o mapa da cena atual, bem
     apagado), o selo do papel, o nome e o menu "⋯". */
  cartaoBase: function (classe, c, selo, itensMenu) {
    const cartao = el('article', 'cartao-mesa ' + classe);

    /* O mapa da cena atual como fundo. imagemSegura (modelo.js) só
       aceita um JPEG em base64 — e só por isso ele pode entrar num url()
       de CSS sem abrir porta para injeção. */
    const fundo = imagemSegura(c.fundo);
    if (fundo) {
      const camada = el('div', 'fundo-mesa');
      camada.style.backgroundImage = 'url("' + fundo + '")';
      cartao.appendChild(camada);
    }

    const topo = el('div', 'topo-mesa');
    topo.appendChild(el('span', 'selo-mesa ' + selo[0], selo[1]));
    topo.appendChild(this.menuMesa(c.nome || 'mesa', itensMenu));
    cartao.appendChild(topo);

    cartao.appendChild(el('h3', 'campanha-nome', c.nome || 'Mesa'));
    return cartao;
  },

  cartaoMestre: function (c) {
    const backup = this.marcar(el('button', '', 'Baixar backup'), c);
    backup.dataset.acao = 'backup';
    const esquecer = this.marcar(el('button', 'perigo', 'Tirar da lista'), c);
    esquecer.dataset.acao = 'esquecer';

    /* .campanha-salva: o nome que a lista sempre teve (e que os testes
       procuram) — continua marcando os cartões de MESTRE. */
    const cartao = this.cartaoBase('campanha-salva', c, ['mestre', 'Mestre'], [backup, esquecer]);
    cartao.appendChild(this.retratos(c.party));

    /* Quando foi o último backup — ou o lembrete de que nunca houve. */
    const quando = Backup.quandoFoi(c.campanhaId);
    const meta = el('div', 'campanha-meta', ['Sessão ' + c.sessao, this.haQuanto(c.atualizadaEm)].filter(Boolean).join(' · ') + ' · ');
    meta.appendChild(el('span', 'campanha-backup' + (quando ? '' : ' nunca'), quando ? 'Backup ' + quando : 'Sem backup'));
    /* Sem senha, a mesa só abre neste navegador: o lembrete fica no
       cartão até o Mestre definir uma (em "Editar campanha"). */
    if (c.temSenha === false) {
      meta.appendChild(document.createTextNode(' · '));
      const aviso = el('span', 'campanha-backup nunca', 'Sem senha');
      aviso.title = 'Sem senha, esta mesa só abre neste navegador. Defina uma em "Editar campanha".';
      meta.appendChild(aviso);
    }
    cartao.appendChild(meta);

    const continuar = this.marcar(el('button', 'botao-mesa', 'Continuar'), c);
    continuar.dataset.acao = 'continuar';
    continuar.setAttribute('aria-label', 'Continuar a campanha ' + c.nome + ' como Mestre');
    cartao.appendChild(continuar);
    return cartao;
  },

  cartaoJogador: function (c) {
    const meu = (c.party || []).find(function (h) { return h.dono; });
    const sair = this.marcar(el('button', '', 'Tirar da lista'), c);
    sair.dataset.acao = 'tirar-mesa';

    const cartao = this.cartaoBase('mesa-jogador', c, ['jogador', meu ? 'Jogando com ' + meu.nome : 'Jogador'], [sair]);
    cartao.appendChild(this.retratos(c.party));

    /* O personagem já está no selo; aqui vai QUEM joga — no mesmo
       computador, a Ana e o Bruno podem ter cada um o seu cartão. */
    const quem = meu ? c.meuNome : c.meuNome + ' · ainda sem personagem';
    cartao.appendChild(el('div', 'campanha-meta',
      [quem, 'Sessão ' + c.sessao, c.mestre ? 'Mestre: ' + c.mestre : '', this.haQuanto(c.atualizadaEm)].filter(Boolean).join(' · ')));

    const voltar = this.marcar(el('button', 'botao-mesa', meu ? 'Voltar para a mesa' : 'Criar meu personagem'), c);
    voltar.dataset.acao = 'voltar-mesa';
    voltar.setAttribute('aria-label', 'Voltar para a mesa ' + c.nome + ' como ' + c.meuNome);
    cartao.appendChild(voltar);
    return cartao;
  },

  /* Uma mesa cuja chave não abre mais (a campanha saiu do servidor, ou
     o servidor é outro): fica o aviso e o jeito de tirar da lista. */
  cartaoSemAcesso: function (acesso) {
    const c = { campanhaId: acesso.campanhaId, papel: acesso.papel, jogadorId: acesso.jogadorId, nome: 'Mesa indisponível' };
    const tirar = this.marcar(el('button', '', 'Tirar da lista'), c);
    tirar.dataset.acao = acesso.papel === 'mestre' ? 'esquecer' : 'tirar-mesa';
    const cartao = this.cartaoBase('mesa-sem-acesso', c, [acesso.papel, acesso.papel === 'mestre' ? 'Mestre' : 'Jogador'], [tirar]);
    cartao.appendChild(el('div', 'campanha-meta', 'Este servidor não abre mais esta mesa' + (acesso.nome ? ' (' + acesso.nome + ')' : '') + '. Ela pode ter sido de outro servidor.'));
    return cartao;
  },

  /* A party em miniatura: foto quando houver, inicial quando não. No
     cartão do jogador, o personagem dele vem primeiro e aceso. */
  retratos: function (party) {
    const fila = el('div', 'retratos-mesa');
    const herois = (Array.isArray(party) ? party : []).slice().sort(function (a, b) { return (b.dono === true) - (a.dono === true); });
    if (!herois.length) {
      fila.appendChild(el('span', 'sem-party', 'Ninguém criou personagem ainda'));
      return fila;
    }
    herois.slice(0, RETRATOS_NO_CARTAO).forEach(function (h) {
      const bola = el('span', 'retrato-mini' + (h.dono ? ' meu' : ''));
      const foto = retratoSeguro(h.foto);
      if (foto) {
        const img = document.createElement('img');
        img.src = foto;
        img.alt = '';
        bola.appendChild(img);
      } else {
        bola.textContent = String(h.nome || '?').charAt(0).toUpperCase();
      }
      bola.title = String(h.nome || '');
      fila.appendChild(bola);
    });
    if (herois.length > RETRATOS_NO_CARTAO) fila.appendChild(el('span', 'retrato-mini mais', '+' + (herois.length - RETRATOS_NO_CARTAO)));
    return fila;
  },

  /* O menu "⋯" do cartão: as ações raras (backup, tirar da lista) saem
     da frente e não disputam espaço com o Continuar. <details> já abre e
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


  /* ---------- As campanhas da versão antiga ----------
     Guardadas no navegador antes da mudança para o servidor. Só uma
     coisa a fazer com elas: baixar o backup, para restaurar no servidor. */

  desenharAntigas: function () {
    const antigas = Antigas.listar();
    const area = document.getElementById('campanhasAntigas');
    const lista = document.getElementById('listaAntigas');
    lista.textContent = '';
    area.hidden = !antigas.length;
    antigas.forEach(function (c) {
      const baixar = el('button', 'botao-compacto neutro', 'Baixar backup');
      baixar.type = 'button';
      baixar.dataset.acao = 'backup-antiga';
      baixar.dataset.id = c.id;
      const linha = el('div', 'linha-antiga');
      linha.appendChild(el('span', 'campanha-nome', c.nome));
      linha.appendChild(baixar);
      lista.appendChild(linha);
    });
  },


  /* ---------- Entrar por um cartão ----------
     O botão traz o id, o papel e o jogador; a CHAVE vem da lista deste
     navegador (Acessos) — ela nunca é escrita no HTML. */

  acessoDo: function (botao) {
    return Acessos.achar(botao.dataset.id, botao.dataset.papel, botao.dataset.jogador || null);
  },

  continuar: function (acesso) {
    if (!acesso || !Sessao.gravar(acesso)) { this.mostrarErroArmazenamento(); return; }
    location.href = 'mestre.html';
  },

  voltarMesa: function (acesso) {
    if (!acesso || !Sessao.gravar(acesso)) { this.mostrarErroArmazenamento(); return; }
    Acessos.lembrar(acesso);
    location.href = 'jogador.html';
  },

  /* Tira a mesa do Mestre da lista — com "Desfazer". A campanha continua
     no servidor, mas este navegador perde a chave de Mestre dela: sem
     o desfazer (e enquanto não existe a senha da campanha), não haveria
     volta. Por isso o recado diz isso com todas as letras. */
  esquecer: function (acesso) {
    const self = this;
    if (!acesso) return;
    Acessos.esquecer(acesso.campanhaId, acesso.papel, acesso.jogadorId);
    const sessao = Sessao.ler();
    const eraDestaAba = !!(sessao && sessao.campanhaId === acesso.campanhaId && sessao.papel === acesso.papel);
    if (eraDestaAba) Sessao.limpar();
    this.desenharMesas();

    this.recadoDesfazer('Mesa tirada da lista — e, com ela, a sua chave de Mestre desta mesa.', function () {
      Acessos.lembrar(acesso);
      if (eraDestaAba) Sessao.gravar(sessao);
      self.desenharMesas();
      self.mostrarAviso('A mesa está de volta à lista.');
    });
  },

  /* O recado com "Desfazer" — a mesma ideia do layout.js, que esta tela
     não carrega. Mais tempo na tela que nos painéis (12s). */
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

  /* Só tira o cartão do jogador: o personagem continua na campanha. A
     chave dele sai deste navegador — para voltar, só pelo cartão
     desfeito ou num navegador que ainda a tenha. */
  tirarMesa: function (acesso) {
    const self = this;
    if (!acesso) return;
    Acessos.esquecer(acesso.campanhaId, acesso.papel, acesso.jogadorId);
    this.desenharMesas();
    this.recadoDesfazer('Mesa tirada da lista.', function () {
      Acessos.lembrar(acesso);
      self.desenharMesas();
    });
  },


  /* ---------- Backup (backup.js) ---------- */

  baixarBackup: function (acesso) {
    const self = this;
    this.limparErro();
    if (!acesso) return;
    Backup.baixar(acesso).then(function (r) {
      if (r.erro) { self.mostrarErro(r.erro); return; }
      self.mostrarAviso('Backup baixado. Guarde o arquivo num lugar fora deste computador — pendrive, nuvem, e-mail para você mesmo.');
      self.desenharMesas();
    });
  },

  baixarAntiga: function (id) {
    this.limparErro();
    if (!Backup.baixarAntiga(id)) { this.mostrarErro('Não deu para ler essa campanha.'); return; }
    this.mostrarAviso('Backup baixado. Agora, com o servidor ligado, use "Restaurar backup" para trazer a campanha.');
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
      self.mostrarAviso('Campanha "' + resultado.nome + '" restaurada no servidor — ela está em "Suas mesas", e você é o Mestre.'
        + (resultado.codigoNovo ? ' O código de convite antigo já estava em uso aqui, então ela ganhou um novo: ' + resultado.codigo + '.' : ''));
    });
  },


  /* ---------- As duas portas ---------- */

  /* Três formulários numa porta só: convite, mestrar (criar) e
     volta-mestre (o Mestre noutro computador, que se chega pelo link
     dentro de "Vou mestrar"). */
  abrirPorta: function (qual) {
    this.porta = qual === 'mestrar' || qual === 'volta-mestre' ? qual : 'convite';
    this.limparErro();

    document.getElementById('portas').hidden = true;
    const form = document.getElementById('formPorta');
    form.hidden = false;
    /* Tira e põe a classe para a animação de entrada rodar de novo. */
    form.classList.remove('abrindo'); void form.offsetWidth; form.classList.add('abrindo');

    const convite = this.porta === 'convite';
    const volta = this.porta === 'volta-mestre';
    document.getElementById('tituloPorta').textContent = convite ? 'Tenho um convite' : volta ? 'Entrar como Mestre' : 'Vou mestrar';
    document.getElementById('blocoConvite').hidden = !convite;
    document.getElementById('blocoMestrar').hidden = this.porta !== 'mestrar';
    document.getElementById('blocoVoltaMestre').hidden = !volta;
    document.getElementById('campoNome').hidden = volta;
    if (!convite) document.getElementById('conviteAchado').hidden = true;
    if (volta) { document.getElementById('codigoMestre').focus(); return; }

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
     com o código preenchido, e pergunta ao servidor de que mesa é —
     para mostrar para ONDE a pessoa está entrando.

     O código vai depois do #, e não num ?codigo=: a parte do # nunca
     é enviada ao servidor, então não fica nos registros dele quando o
     site estiver no ar. */
  lerConvite: function () {
    const achado = /^#convite=(.+)$/.exec(location.hash);
    if (!achado) return;

    let texto;
    try { texto = decodeURIComponent(achado[1]); } catch (erro) { return; }
    const codigo = normalizarCodigo(texto);
    if (!codigo) return;

    document.getElementById('codigo').value = codigo;
    this.abrirPorta('convite');

    const aviso = document.getElementById('conviteAchado');
    window.plainusCarregando = true;
    Servidor.convite(codigo).then(function (campanha) {
      window.plainusCarregando = false;
      if (campanha.erro) return;
      aviso.textContent = '';
      aviso.appendChild(document.createTextNode('Você foi convidado para '));
      aviso.appendChild(el('strong', '', String(campanha.nome || '')));
      aviso.appendChild(document.createTextNode(campanha.mestre ? ' · Mestre: ' + campanha.mestre : ''));
      aviso.hidden = false;
    });
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
    Acessos.guardarNome(nome);
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

  /* O código só leva ao painel do JOGADOR (ver o topo do arquivo). O
     servidor confere o código e o nome, e devolve a chave deste jogador
     — que este navegador guarda (Suas mesas) e que abre o painel. */
  entrar: function () {
    const self = this;
    this.limparErro();

    const nome = this.lerNome();
    if (!nome) return;

    const campo = document.getElementById('codigo');
    if (!campo.value.trim()) {
      this.mostrarErro('Digite o código que o Mestre te passou.', campo);
      return;
    }

    const codigo = normalizarCodigo(campo.value);
    if (!codigo) {
      this.mostrarErro('Esse código não existe. São 12 letras e números, no formato XXXX-XXXX-XXXX.', campo);
      return;
    }
    campo.value = codigo;            /* mostra como ficou, já arrumado */

    const botao = document.getElementById('btnEntrar');
    botao.disabled = true;
    Servidor.entrar(codigo, nome).then(function (r) {
      botao.disabled = false;
      if (r.erro) { self.mostrarErro(r.erro, campo); return; }
      const acesso = { campanhaId: r.campanhaId, papel: 'jogador', jogadorId: r.jogadorId, chave: r.chave, nome: r.nome };
      /* Da próxima vez, um cartão em "Suas mesas" — sem código. */
      Acessos.lembrar(acesso);
      if (!Sessao.gravar(acesso)) { self.mostrarErroArmazenamento(); return; }
      location.href = 'jogador.html';
    });
  },


  /* O Mestre noutro computador: código + senha. O servidor devolve uma
     chave de Mestre nova, só deste navegador — e a mesa passa a
     aparecer em "Suas mesas" aqui também. */
  entrarComoMestre: function () {
    const self = this;
    this.limparErro();
    const campoCodigo = document.getElementById('codigoMestre');
    const campoSenha = document.getElementById('senhaMestre');
    const codigo = normalizarCodigo(campoCodigo.value);
    if (!codigo) { this.mostrarErro('Digite o código da mesa (XXXX-XXXX-XXXX).', campoCodigo); return; }
    campoCodigo.value = codigo;
    if (!campoSenha.value) { this.mostrarErro('Digite a senha do Mestre.', campoSenha); return; }

    const botao = document.getElementById('btnEntrarMestre');
    botao.disabled = true;
    Servidor.entrarComoMestre(codigo, campoSenha.value).then(function (r) {
      botao.disabled = false;
      if (r.erro) { campoSenha.value = ''; self.mostrarErro(r.erro, campoSenha); return; }
      const acesso = { campanhaId: r.campanhaId, papel: 'mestre', chave: r.chave, nome: r.nome };
      Acessos.lembrar(acesso);
      if (!Sessao.gravar(acesso)) { self.mostrarErroArmazenamento(); return; }
      location.href = 'mestre.html';
    });
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
    document.getElementById('btnVoltaMestre').addEventListener('click', function () { self.abrirPorta('volta-mestre'); });
    document.getElementById('btnEntrarMestre').addEventListener('click', function () { self.entrarComoMestre(); });

    /* Enter confirma o formulário aberto. Sem <form>, o navegador não
       faz isso sozinho. Esc volta às portas. */
    document.getElementById('formPorta').addEventListener('keydown', function (evento) {
      if (evento.key === 'Escape') { self.fecharPorta(); return; }
      if (evento.key !== 'Enter' || evento.target.tagName !== 'INPUT') return;
      if (self.porta === 'mestrar') self.criar();
      else if (self.porta === 'volta-mestre') self.entrarComoMestre();
      else self.entrar();
    });

    document.getElementById('listaCampanhas').addEventListener('click', function (evento) {
      const alvo = evento.target.closest('[data-acao]');
      if (!alvo) return;
      const menu = alvo.closest('details');
      if (menu) menu.open = false;
      const acesso = self.acessoDo(alvo);
      if (alvo.dataset.acao === 'continuar') self.continuar(acesso);
      if (alvo.dataset.acao === 'voltar-mesa') self.voltarMesa(acesso);
      if (alvo.dataset.acao === 'esquecer') self.esquecer(acesso);
      if (alvo.dataset.acao === 'tirar-mesa') self.tirarMesa(acesso);
      if (alvo.dataset.acao === 'backup') self.baixarBackup(acesso);
    });

    document.getElementById('listaAntigas').addEventListener('click', function (evento) {
      const alvo = evento.target.closest('[data-acao="backup-antiga"]');
      if (alvo) self.baixarAntiga(alvo.dataset.id);
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


/* Aberta sem servidor (duplo clique): o aviso do que fazer. As
   campanhas da versão antiga aparecem nos dois casos — é justamente
   pelo duplo clique que elas estão guardadas. */
document.getElementById('avisoServidor').hidden = Servidor.temServidor();
document.getElementById('nome').value = Acessos.ultimoNome();
Entrada.desenharMesas();
Entrada.desenharAntigas();
Entrada.ligar();
Entrada.lerConvite();
