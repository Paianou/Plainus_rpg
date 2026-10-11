/* ===================================================================
   criar-campanha.js — o formulário em etapas, para criar ou editar

   DOIS MODOS, UM FORMULÁRIO
     criar   (criar-campanha.html)           etapas 1, 2, 3, 4, 5, 6
     editar  (criar-campanha.html?editar=1)  etapas 1, 2, 3, 4, 6

   `ordem` guarda quais etapas existem no modo atual, e `indice` diz em
   qual delas estamos. Continuar valida SÓ a etapa atual e avança;
   Voltar recua sem validar (ninguém deve ser travado por um campo que
   ainda vai corrigir). Nada é gravado até o último clique.

   A etapa 5 (primeira sessão) só existe ao criar: o que ela gera —
   uma sessão no Diário, uma pendência, um segredo — passa a ter vida
   própria lá, e é lá que se edita depois.


   QUAL CAMPANHA SE EDITA
   Sempre a da SESSÃO, nunca um id vindo do endereço. Se o endereço
   pudesse dizer ?editar=<id>, bastaria um link para alguém abrir o
   formulário de uma campanha que não é a que ele está mestrando.


   A TABELA DE CAMPOS
   Cada campo está descrito UMA vez em CAMPOS: em que etapa fica, se é
   obrigatório, o limite. A validação, o resumo da última etapa e a
   leitura das respostas percorrem essa tabela. Acrescentar um campo é
   acrescentar uma linha aqui (e o elemento no HTML).

   O maxlength do HTML já segura a digitação; a tabela confere de novo
   porque o HTML é só orientação ao navegador (DevTools apaga ele).
   =================================================================== */

const CAMPOS = [
  { id: 'nomeCampanha', rotulo: 'Nome',              passo: 1, obrigatorio: true, max: 60 },
  { id: 'sistema',      rotulo: 'Sistema',           passo: 1, obrigatorio: true, max: 40 },
  { id: 'mestre',       rotulo: 'Mestre',            passo: 1, obrigatorio: true, max: 30 },

  { id: 'premissa',     rotulo: 'Do que se trata',   passo: 2, obrigatorio: true, max: 600 },
  { id: 'cenario',      rotulo: 'Onde se passa',     passo: 2, obrigatorio: true, max: 300 },
  { id: 'tom',          rotulo: 'Tom e temas',       passo: 2, max: 80 },
  { id: 'linhas',       rotulo: 'Linhas',            passo: 2, max: 400 },
  { id: 'veus',         rotulo: 'Véus',              passo: 2, max: 400 },

  { id: 'grupo',        rotulo: 'Nome do grupo',     passo: 3, max: 40 },
  { id: 'nivelInicial', rotulo: 'Nível inicial',     passo: 3, numero: true, min: 1, maxNumero: 20 },
  { id: 'jogadores',    rotulo: 'Jogadores',         passo: 3, numero: true, min: 1, maxNumero: 10 },
  { id: 'regras',       rotulo: 'Regras da casa',    passo: 3, max: 400 },

  /* `opcoes`: um <select> cujas opções vêm do regras.js — o valor
     tem de ser uma das chaves. `marcar`: uma caixa de marcar. */
  { id: 'metodoAtributos', rotulo: 'Atributos',      passo: 4, opcoes: METODOS_ATRIBUTOS },
  { id: 'metodoPv',     rotulo: 'PV por nível',      passo: 4, opcoes: METODOS_PV },
  { id: 'talentos',     rotulo: 'Talentos',          passo: 4, marcar: true },
  { id: 'multiclasse',  rotulo: 'Multiclasse',       passo: 4, marcar: true },

  { id: 'tituloSessao', rotulo: 'Sessão 1',          passo: 5, max: 60 },
  { id: 'dataSessao',   rotulo: 'Data',              passo: 5, data: true },
  { id: 'ameaca',       rotulo: 'Ameaça',            passo: 5, max: 300 },
  { id: 'prazo',        rotulo: 'Prazo',             passo: 5, max: 60 },
  { id: 'verdade',      rotulo: 'A verdade',         passo: 5, max: 600 },
  { id: 'pista',        rotulo: 'Ambiente sonoro',   passo: 5, lista: true }
];

/* Mensagens do "está vazio" — escritas por campo porque "Preencha o
   campo Sistema" ensina menos que dizer o que se espera nele. */
const PEDIDOS = {
  nomeCampanha: 'Dê um nome à campanha.',
  sistema: 'Diga qual sistema a mesa vai jogar.',
  mestre: 'Diga como a mesa te chama.',
  premissa: 'Conte em poucas linhas do que a campanha trata.',
  cenario: 'Diga onde a história se passa.'
};

/* A mesma chave que o app.js usa para mandar o que já foi digitado. */
const CHAVE_RASCUNHO = 'plainus:rascunho-campanha';

const PISTA_PADRAO = 'Cripta dos Ancestrais (loop)';


const Criacao = {

  modo: 'criar',              /* 'criar' | 'editar' */
  ordem: [1, 2, 3, 4, 5, 6],  /* as etapas que existem neste modo */
  indice: 0,                  /* posição em `ordem` */
  idEditando: null,


  iniciar: function () {
    this.preencherPistas();
    this.preencherOpcoes();

    const self = this;
    const editar = new URLSearchParams(location.search).get('editar') === '1';
    if (editar) {
      /* A campanha a editar vem do servidor: a página espera ela chegar. */
      this.prepararEdicao().then(function (pronta) {
        if (!pronta) return;
        self.ligar();
        self.mostrar(0);
      });
      return;
    }
    this.preencherRascunho();
    this.ligar();
    this.mostrar(0);
  },

  passoAtual: function () {
    return this.ordem[this.indice];
  },


  /* ---------- Preparar a tela ---------- */

  /* A lista de pistas é a do audio.js — a mesma do painel. Uma lista
     copiada aqui à mão sairia do ar com a primeira pista nova. */
  preencherPistas: function () {
    const escolha = document.getElementById('pista');
    Object.keys(Som.PISTAS).forEach(function (nome) {
      const opcao = document.createElement('option');
      opcao.value = nome;
      opcao.textContent = nome;
      escolha.appendChild(opcao);
    });
    escolha.value = PISTA_PADRAO;
  },

  /* Os <select> com `opcoes` na tabela CAMPOS (regras de personagem):
     chave → valor guardado, texto → o que aparece na lista. A primeira
     opção de cada objeto é o padrão. */
  preencherOpcoes: function () {
    CAMPOS.forEach(function (campo) {
      if (!campo.opcoes) return;
      const escolha = document.getElementById(campo.id);
      Object.keys(campo.opcoes).forEach(function (chave) {
        const opcao = document.createElement('option');
        opcao.value = chave;
        opcao.textContent = campo.opcoes[chave];
        escolha.appendChild(opcao);
      });
    });
  },

  /* O nome da campanha e o do mestre já foram digitados na entrada:
     pedir de novo seria atrito. */
  preencherRascunho: function () {
    let rascunho = null;
    try {
      rascunho = JSON.parse(sessionStorage.getItem(CHAVE_RASCUNHO));
    } catch (erro) { /* sem rascunho: campos em branco */ }

    if (!rascunho || typeof rascunho !== 'object') return;
    if (typeof rascunho.nome === 'string') document.getElementById('nomeCampanha').value = rascunho.nome.slice(0, 60);
    if (typeof rascunho.mestre === 'string') document.getElementById('mestre').value = rascunho.mestre.slice(0, 30);
  },

  /* Abre a mesa pela conexão (só com a chave do Mestre), troca os
     textos, esconde o que só existe ao criar e preenche os campos com a
     campanha. Devolve uma Promise: false (e sai da página, ou mostra o
     motivo) se não der para editar. */
  prepararEdicao: function () {
    const self = this;
    const sessao = Sessao.ler();
    if (!sessao || sessao.papel !== 'mestre') {
      location.replace('index.html');
      return Promise.resolve(false);
    }
    return Conexao.abrir(sessao).then(function () {
      return self.preencherEdicao(sessao, Estado);
    }, function (motivo) {
      self.mostrarErro(motivo);
      return false;
    });
  },

  preencherEdicao: function (sessao, estado) {

    this.modo = 'editar';
    this.ordem = [1, 2, 3, 4, 6];
    this.idEditando = sessao.campanhaId;

    document.title = 'Editar campanha — Plainus RPG';
    document.getElementById('tituloForm').textContent = 'Editar campanha';
    document.getElementById('subtituloForm').textContent = estado.campanha.nome;
    document.querySelector('#passos li[data-passo="5"]').hidden = true;
    document.getElementById('rotuloUltimo').textContent = 'Salvar';
    document.getElementById('escolhaInicio').hidden = true;

    const cancelar = document.getElementById('linkCancelar');
    cancelar.textContent = 'Cancelar e voltar ao painel';
    cancelar.href = 'mestre.html';

    /* Campanhas criadas antes de existir "linhas" guardaram tudo em
       'limites' — aparece aqui como linhas, e ao salvar migra. */
    const c = estado.campanha;
    const valores = {
      nomeCampanha: c.nome, sistema: c.sistema, mestre: estado.mestre.nome,
      premissa: c.premissa, cenario: c.cenario, tom: c.tom,
      linhas: c.linhas || c.limites, veus: c.veus,
      grupo: estado.grupo && estado.grupo.nome,
      nivelInicial: c.nivelInicial, jogadores: c.jogadores, regras: c.regra
    };

    /* O que não existe na campanha (a de exemplo não tem premissa,
       por exemplo) fica com o valor padrão do HTML. */
    Object.keys(valores).forEach(function (id) {
      if (valores[id] !== undefined && valores[id] !== null) {
        document.getElementById(id).value = valores[id];
      }
    });

    /* As regras de personagem: regrasPersonagem() (dados.js) completa
       o que uma campanha antiga não tiver. */
    const regras = regrasPersonagem(estado);
    document.getElementById('metodoAtributos').value = regras.atributos;
    document.getElementById('metodoPv').value = regras.pv;
    document.getElementById('talentos').checked = !!regras.talentos;
    document.getElementById('multiclasse').checked = !!regras.multiclasse;

    return true;
  },


  /* ---------- Trocar de etapa ---------- */

  mostrar: function (indice) {
    const self = this;
    this.indice = indice;
    const passo = this.passoAtual();
    const ultimo = indice === this.ordem.length - 1;

    this.limparErro();

    document.querySelectorAll('section.passo').forEach(function (secao) {
      secao.hidden = Number(secao.dataset.passo) !== passo;
    });

    document.querySelectorAll('#passos li').forEach(function (item) {
      const posicao = self.ordem.indexOf(Number(item.dataset.passo));
      item.classList.toggle('feito', posicao !== -1 && posicao < indice);
      if (posicao === indice) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });

    document.getElementById('btnVoltar').hidden = indice === 0;
    document.getElementById('btnAvancar').textContent = !ultimo ? 'Continuar'
      : (this.modo === 'editar' ? 'Salvar alterações' : 'Criar campanha');

    if (ultimo) this.montarResumo();

    /* Leva o foco para o primeiro campo da etapa nova. Sem isto, quem
       usa teclado ficaria com o foco no botão, que mudou de lugar. */
    const primeiro = document.querySelector(
      'section.passo:not([hidden]) input:not([type="radio"]), section.passo:not([hidden]) textarea');
    if (primeiro) primeiro.focus();
  },

  avancar: function () {
    if (!this.validar(this.passoAtual())) return;

    if (this.indice < this.ordem.length - 1) this.mostrar(this.indice + 1);
    else if (this.modo === 'editar') this.salvarEdicao();
    else this.criar();
  },

  voltar: function () {
    if (this.indice > 0) this.mostrar(this.indice - 1);
  },

  /* "Pular" é "não quero isso agora": limpa o que foi digitado na
     etapa, para não criar uma sessão ou um segredo pela metade. */
  pular: function () {
    const passo = this.passoAtual();
    CAMPOS.forEach(function (campo) {
      if (campo.passo !== passo) return;
      document.getElementById(campo.id).value = campo.id === 'pista' ? PISTA_PADRAO : '';
    });
    this.mostrar(this.indice + 1);
  },


  /* ---------- Ler e conferir ---------- */

  respostas: function () {
    const r = {};
    CAMPOS.forEach(function (campo) {
      const elemento = document.getElementById(campo.id);
      if (campo.marcar) { r[campo.id] = elemento.checked; return; }
      const valor = elemento.value.trim();
      r[campo.id] = campo.numero ? parseInt(valor, 10) : valor;
    });
    return r;
  },

  /* Confere só os campos da etapa pedida. Para no primeiro erro: uma
     mensagem de cada vez, com o foco já no campo certo. */
  validar: function (passo) {
    this.limparErro();

    for (let i = 0; i < CAMPOS.length; i++) {
      const campo = CAMPOS[i];
      if (campo.passo !== passo) continue;

      const elemento = document.getElementById(campo.id);
      const valor = elemento.value.trim();

      /* Caixa de marcar: ou está marcada, ou não — nada a conferir. */
      if (campo.marcar) continue;

      /* Lista do regras.js: o valor tem de ser uma das chaves. */
      if (campo.opcoes) {
        if (!Object.prototype.hasOwnProperty.call(campo.opcoes, valor)) {
          this.mostrarErro(campo.rotulo + ': escolha uma opção da lista.', elemento);
          return false;
        }
        continue;
      }

      if (campo.numero) {
        const n = Number(valor);
        if (!Number.isInteger(n) || n < campo.min || n > campo.maxNumero) {
          this.mostrarErro(campo.rotulo + ': um número inteiro de ' + campo.min + ' a ' + campo.maxNumero + '.', elemento);
          return false;
        }
        continue;
      }

      /* O <input type="date"> já só entrega AAAA-MM-DD ou vazio, mas
         o valor pode ter sido mexido — e ele vai para o Diário. */
      if (campo.data) {
        if (valor && !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
          this.mostrarErro('Data: use o calendário do campo.', elemento);
          return false;
        }
        continue;
      }

      /* Um <select> também é editável pelo DevTools: só vale o que
         está na lista de pistas de verdade. */
      if (campo.lista) {
        if (!Object.prototype.hasOwnProperty.call(Som.PISTAS, valor)) {
          this.mostrarErro('Escolha uma pista da lista.', elemento);
          return false;
        }
        continue;
      }

      if (campo.obrigatorio && !valor) {
        this.mostrarErro(PEDIDOS[campo.id], elemento);
        return false;
      }
      if (valor.length > campo.max) {
        this.mostrarErro(campo.rotulo + ': até ' + campo.max + ' caracteres.', elemento);
        return false;
      }
    }

    /* Um prazo sozinho não diz nada: prazo DE QUÊ? */
    if (passo === 5) {
      const ameaca = document.getElementById('ameaca');
      if (document.getElementById('prazo').value.trim() && !ameaca.value.trim()) {
        this.mostrarErro('Diga qual é a ameaça que tem esse prazo.', ameaca);
        return false;
      }
    }

    return true;
  },


  /* ---------- Mensagens ---------- */

  mostrarErro: function (texto, campo) {
    document.getElementById('erro').textContent = texto;
    if (campo) {
      campo.setAttribute('aria-invalid', 'true');
      campo.focus();
    }
  },

  limparErro: function () {
    document.getElementById('erro').textContent = '';
    document.querySelectorAll('[aria-invalid]').forEach(function (campo) {
      campo.removeAttribute('aria-invalid');
    });
  },


  /* ---------- A última etapa: o resumo ----------
     Um <dl> (lista de definições): par "rótulo → valor", que é
     exatamente o que um resumo é. Campo opcional em branco não
     aparece, e campos de etapas que não existem neste modo também
     não. Todo texto entra por textContent: foi digitado por alguém. */

  montarResumo: function () {
    const self = this;
    const lista = document.getElementById('resumoCampanha');
    const r = this.respostas();
    lista.textContent = '';

    CAMPOS.forEach(function (campo) {
      if (self.ordem.indexOf(campo.passo) === -1) return;

      let valor = r[campo.id];
      if (valor === '' || valor === null || Number.isNaN(valor)) return;
      if (campo.data) valor = valor.split('-').reverse().join('/');   /* 2026-10-10 → 10/10/2026 */
      if (campo.marcar) valor = valor ? 'Permitido' : 'Não permitido';
      if (campo.opcoes) valor = campo.opcoes[valor];                  /* a chave vira o texto */

      const termo = document.createElement('dt');
      termo.textContent = campo.rotulo;
      const definicao = document.createElement('dd');
      definicao.textContent = String(valor);

      lista.appendChild(termo);
      lista.appendChild(definicao);
    });
  },


  /* ---------- Gravar ---------- */

  /* O que vale igual para criar e editar: a identidade, o mundo e a
     mesa. Grupo em branco mantém o nome que já havia (o do exemplo,
     ou "A party" do molde vazio). */
  aplicarCampanha: function (estado, r) {
    Object.assign(estado.campanha, {
      nome: r.nomeCampanha,
      sistema: r.sistema,
      premissa: r.premissa,
      cenario: r.cenario,
      tom: r.tom,
      linhas: r.linhas,
      veus: r.veus,
      nivelInicial: r.nivelInicial,
      jogadores: r.jogadores,
      /* Lidas pela ficha do jogador (jogador.js). */
      regrasPersonagem: {
        atributos: r.metodoAtributos,
        pv: r.metodoPv,
        talentos: r.talentos,
        multiclasse: r.multiclasse
      }
    });
    delete estado.campanha.limites;          /* migrado para 'linhas' */

    estado.mestre = Object.assign({}, estado.mestre, { nome: r.mestre });
    estado.grupo = Object.assign({ nome: 'A party' }, estado.grupo);
    if (r.grupo) estado.grupo.nome = r.grupo;
  },


  /* A etapa 5. Cada resposta vira algo que já tem tela — por isso as
     estruturas aqui são as mesmas que o Diário e o avisos.js leem. */
  prepararPrimeiraSessao: function (estado, r) {
    const agora = Date.now();
    const c = estado.campanha;

    if (r.tituloSessao || r.dataSessao) {
      /* Na campanha com exemplo, a sessão corrente já existe no Diário
         (é a 12 de Valkoria). A sua entra depois dela, e a do exemplo
         deixa de estar aberta — é o que o "Começar sessão" da barra
         do topo também faz. */
      if (estado.diario.some(function (e) { return e.sessao === c.sessao; })) {
        estado.diario.forEach(function (e) { e.emAberto = false; });
        c.sessao = estado.diario.reduce(function (maior, e) { return Math.max(maior, e.sessao); }, c.sessao) + 1;
      }

      estado.diario.push({
        id: 'd' + agora, sessao: c.sessao, data: r.dataSessao,
        titulo: r.tituloSessao, resumo: '', notas: '', emAberto: true
      });
    }

    /* Mesma regra do Diário: ter prazo é o que torna urgente — e
       pendência urgente é o que acende o sino (avisos.js). */
    if (r.ameaca) {
      estado.pendencias.unshift({
        id: 'p' + agora, texto: r.ameaca, prazo: r.prazo,
        resolvida: false, urgente: r.prazo !== ''
      });
    }

    if (r.verdade) {
      estado.segredos.unshift({
        id: 's' + agora, titulo: 'A verdade por trás de tudo',
        texto: r.verdade, revelado: false, ligadoA: ''
      });
    }

    estado.audio.pista = r.pista;
  },


  criar: function () {
    const r = this.respostas();
    const marcado = document.querySelector('input[name="inicio"]:checked');
    const comExemplo = marcado && marcado.value === 'exemplo';

    /* Os moldes vêm do dados.js. Com exemplo, as respostas daqui
       substituem o nome, o sistema e o resto da campanha de Valkoria,
       mas heróis, NPCs, mapas e diário continuam os do exemplo. */
    const estado = comExemplo ? estadoDeExemplo() : estadoVazio();

    this.aplicarCampanha(estado, r);
    /* O código de convite é sorteado pelo servidor (que sabe quais já
       existem — dois convites iguais apontariam para duas mesas). */
    estado.campanha.codigo = '';

    /* Regras da casa em branco no exemplo: fica a regra que ele já
       tinha. Na vazia, o branco é branco mesmo. */
    if (r.regras || !comExemplo) estado.campanha.regra = r.regras;
    if (!comExemplo) estado.campanha.nivelMedio = r.nivelInicial;

    this.prepararPrimeiraSessao(estado, r);

    /* O exemplo nasce com a música "tocando". Numa campanha recém-
       criada, quem decide quando soa é o mestre. */
    estado.audio.tocando = false;

    this.gravar(estado, null);
  },


  /* A edição é uma ação (editarCampanha, no acoes.js): só os campos
     daqui mudam, e o resto da campanha — o que o Mestre ou os jogadores
     mexeram enquanto ele editava — não é atropelado. Espera o servidor
     confirmar antes de sair da página. */
  salvarEdicao: function () {
    const self = this;
    const r = this.respostas();
    const botao = document.getElementById('btnAvancar');
    botao.disabled = true;

    const feita = Acoes.executar('editarCampanha', {
      campanha: {
        nome: r.nomeCampanha, sistema: r.sistema, premissa: r.premissa, cenario: r.cenario, tom: r.tom,
        linhas: r.linhas, veus: r.veus, nivelInicial: r.nivelInicial, jogadores: r.jogadores, regra: r.regras,
        regrasPersonagem: { atributos: r.metodoAtributos, pv: r.metodoPv, talentos: r.talentos, multiclasse: r.multiclasse }
      },
      mestre: r.mestre,
      grupo: r.grupo
    });
    if (feita.erro) { botao.disabled = false; this.mostrarErro(feita.erro); return; }

    Acoes.confirmar().then(function (resposta) {
      if (resposta.erro) { botao.disabled = false; self.mostrarErro(resposta.erro); return; }
      self.sair();
    });
  },


  /* Campanha nova: o servidor guarda e devolve a chave do Mestre, que
     este navegador lembra (Suas mesas) e que abre o painel. Trava o
     botão enquanto grava: um segundo clique criaria duas campanhas. */
  gravar: function (estado) {
    const self = this;
    const botao = document.getElementById('btnAvancar');
    botao.disabled = true;

    Servidor.criarCampanha(estado).then(function (r) {
      if (r.erro) {
        botao.disabled = false;
        self.mostrarErro(r.erro);
        return;
      }
      const acesso = { campanhaId: r.id, papel: 'mestre', chave: r.chave, nome: estado.mestre.nome };
      Acessos.lembrar(acesso);
      if (!Sessao.gravar(acesso)) {
        botao.disabled = false;
        self.mostrarErro('O navegador não deixou guardar sua entrada. Se estiver numa aba anônima, tente numa aba normal.');
        return;
      }
      self.sair();
    });
  },

  sair: function () {
    try { sessionStorage.removeItem(CHAVE_RASCUNHO); } catch (erro) { /* tanto faz */ }
    /* Esta saída É o salvamento: sem perguntar "sair sem salvar?". */
    AvisoSaida.liberar();
    location.href = 'mestre.html';
  },


  /* ---------- Eventos ---------- */

  ligar: function () {
    const self = this;
    const form = document.getElementById('formCampanha');

    /* preventDefault: sem ele, o submit recarregaria a página (é o
       comportamento padrão de um form) e tudo o que foi digitado
       sumiria. */
    form.addEventListener('submit', function (evento) {
      evento.preventDefault();
      self.avancar();
    });

    document.getElementById('btnVoltar').addEventListener('click', function () {
      self.voltar();
    });

    document.getElementById('btnPular').addEventListener('click', function () {
      self.pular();
    });

    form.addEventListener('input', function () {
      self.limparErro();
    });
  }
};


Criacao.iniciar();
