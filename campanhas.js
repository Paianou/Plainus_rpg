/* ===================================================================
   campanhas.js — o que este navegador lembra, e como ele pede ao servidor

   A CAMPANHA MORA NO SERVIDOR
   Desde a parte 2 do servidor, a campanha não fica mais guardada no
   navegador: ela mora no servidor (data/campanhas/), que é a cópia
   única e oficial. O navegador lembra só o necessário para voltar à
   mesa — as CHAVES:

     plainus:acessos     as mesas deste navegador: uma linha por mesa
     (localStorage)        { campanhaId, papel, jogadorId, chave, nome, em }
                           A chave é o que prova ao servidor que você é o
                           Mestre (quem criou) ou aquele jogador (quem
                           entrou com aquele nome). Sem ela, o servidor
                           não abre a mesa.

     plainus:sessao      quem está usando ESTA ABA — a mesma linha, mais
     (sessionStorage)      nada. Por aba: o Mestre numa, a Ana noutra.

     plainus:meu-nome    o último nome digitado na entrada, só para já
                           vir preenchido.

   Guardar a chave no navegador tem um preço honesto: quem tiver acesso
   a este navegador (ou a um script malicioso na página) tem a chave.
   O site nunca põe texto de usuário como HTML (problema 5 do CLAUDE.md),
   que é o que fecha a porta do script malicioso.

   AS PERGUNTAS AO SERVIDOR (Servidor, no fim do arquivo)
   Criar campanha, entrar com o código, os cartões de "Suas mesas" e o
   backup são perguntas HTTP (servidor/api.js). A mesa em jogo é pela
   conexão em tempo real (conexao.js).

   CAMPANHAS DA VERSÃO ANTIGA
   Quem usou o site antes desta mudança tem campanhas guardadas no
   navegador (plainus:campanhas, plainus:campanha:<id>). Elas não são
   apagadas: Antigas.listar() as encontra, e a tela de entrada oferece
   baixar o backup de cada uma — para restaurar no servidor.
   =================================================================== */

const CHAVE_SESSAO = 'plainus:sessao';
const CHAVE_ACESSOS = 'plainus:acessos';
const CHAVE_NOME = 'plainus:meu-nome';

/* As chaves da versão antiga, só para leitura (Antigas). */
const CHAVE_INDICE_ANTIGO = 'plainus:campanhas';
const PREFIXO_CAMPANHA_ANTIGA = 'plainus:campanha:';

const ID_CAMPANHA = /^c[0-9a-f]{16}$/;
const ID_JOGADOR = /^j[0-9a-f]{16}$/;


/* ---------- Ler e gravar sem quebrar ----------
   O localStorage pode falhar: aba anônima com armazenamento bloqueado,
   espaço cheio, ou um valor que alguém editou à mão no DevTools e não
   é mais JSON. Nenhuma dessas situações pode derrubar a página.

   `qual` escolhe o depósito: localStorage (o padrão) ou sessionStorage
   (a sessão, que é por aba). Os dois têm a mesma interface. */
const Armazem = {

  ler: function (chave, qual) {
    try {
      const bruto = (qual || localStorage).getItem(chave);
      return bruto ? JSON.parse(bruto) : null;
    } catch (erro) {
      return null;
    }
  },

  gravar: function (chave, valor, qual) {
    try {
      (qual || localStorage).setItem(chave, JSON.stringify(valor));
      return true;
    } catch (erro) {
      return false;
    }
  },

  apagar: function (chave, qual) {
    try { (qual || localStorage).removeItem(chave); } catch (erro) { /* nada a fazer */ }
  }
};

/* O sessionStorage pode nem existir (bloqueado em alguns navegadores
   em modo restrito): pegar a referência já pode lançar erro. */
function depositoDaSessao() {
  try { return window.sessionStorage; } catch (erro) { return null; }
}

/* Uma linha de acesso, conferida: o que vem do armazenamento é texto que
   qualquer um edita, então é tratado como entrada de usuário. */
function acessoValido(a) {
  if (!a || typeof a !== 'object') return null;
  if (!ID_CAMPANHA.test(String(a.campanhaId)) || typeof a.chave !== 'string' || !a.chave) return null;
  const papel = a.papel === 'mestre' ? 'mestre' : a.papel === 'jogador' ? 'jogador' : null;
  if (!papel) return null;
  if (papel === 'jogador' && !ID_JOGADOR.test(String(a.jogadorId))) return null;
  return {
    campanhaId: a.campanhaId, papel: papel,
    jogadorId: papel === 'jogador' ? a.jogadorId : null,
    chave: a.chave.slice(0, 100),
    nome: String(a.nome || '').slice(0, 30),
    em: Number(a.em) || 0
  };
}


/* ===================================================================
   SESSÃO — quem está usando esta aba
   =================================================================== */

const Sessao = {

  ler: function () {
    const deposito = depositoDaSessao();
    return deposito ? acessoValido(Armazem.ler(CHAVE_SESSAO, deposito)) : null;
  },

  gravar: function (sessao) {
    const deposito = depositoDaSessao();
    const limpa = acessoValido(sessao);
    return deposito && limpa ? Armazem.gravar(CHAVE_SESSAO, limpa, deposito) : false;
  },

  limpar: function () {
    const deposito = depositoDaSessao();
    if (deposito) Armazem.apagar(CHAVE_SESSAO, deposito);
  }
};


/* ===================================================================
   ACESSOS — as mesas deste navegador ("Suas mesas")
   =================================================================== */

const Acessos = {

  listar: function () {
    const lista = Armazem.ler(CHAVE_ACESSOS);
    return (Array.isArray(lista) ? lista : []).map(acessoValido).filter(Boolean);
  },

  /* A mesma mesa, no mesmo papel, com a mesma pessoa: uma linha só. */
  mesma: function (a, b) {
    return a.campanhaId === b.campanhaId && a.papel === b.papel && (a.jogadorId || null) === (b.jogadorId || null);
  },

  achar: function (campanhaId, papel, jogadorId) {
    const alvo = { campanhaId: campanhaId, papel: papel, jogadorId: jogadorId || null };
    return this.listar().find(function (a) { return Acessos.mesma(a, alvo); }) || null;
  },

  lembrar: function (acesso) {
    const novo = acessoValido(Object.assign({}, acesso, { em: Date.now() }));
    if (!novo) return false;
    const lista = this.listar().filter(function (a) { return !Acessos.mesma(a, novo); });
    lista.push(novo);
    return Armazem.gravar(CHAVE_ACESSOS, lista);
  },

  /* Tira a linha da lista. Não apaga nada no servidor: a campanha e o
     personagem continuam lá. */
  esquecer: function (campanhaId, papel, jogadorId) {
    const alvo = { campanhaId: campanhaId, papel: papel, jogadorId: jogadorId || null };
    Armazem.gravar(CHAVE_ACESSOS, this.listar().filter(function (a) { return !Acessos.mesma(a, alvo); }));
  },

  ultimoNome: function () {
    const nome = Armazem.ler(CHAVE_NOME);
    return typeof nome === 'string' ? nome.slice(0, 30) : '';
  },

  guardarNome: function (nome) {
    Armazem.gravar(CHAVE_NOME, nome);
  }
};


/* ===================================================================
   SERVIDOR — as perguntas de "uma pergunta, uma resposta" (HTTP)
   Cada uma devolve uma Promise com o corpo da resposta, ou { erro }.
   =================================================================== */

const Servidor = {

  temServidor: function () {
    return location.protocol === 'http:' || location.protocol === 'https:';
  },

  pedir: function (rota, corpo) {
    if (!this.temServidor()) return Promise.resolve({ erro: 'Abra a mesa pelo servidor (npm start e http://localhost:3000).' });
    return fetch('/api/' + rota, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo)
    }).then(function (resposta) {
      return resposta.json().catch(function () { return {}; }).then(function (dados) {
        if (resposta.ok) return dados;
        return { erro: (dados && dados.erro) || 'O servidor recusou o pedido (' + resposta.status + ').' };
      });
    }, function () {
      return { erro: 'Sem conexão com o servidor da mesa. Ele está ligado?' };
    });
  },

  criarCampanha: function (estado) { return this.pedir('campanhas', { estado: estado }); },
  convite: function (codigo) { return this.pedir('convite', { codigo: codigo }); },
  entrar: function (codigo, nome) { return this.pedir('entrar', { codigo: codigo, nome: nome }); },
  cartoes: function (acessos) { return this.pedir('cartoes', { mesas: acessos }); },
  backup: function (campanhaId, chave) { return this.pedir('backup', { campanhaId: campanhaId, chave: chave }); }
};


/* ===================================================================
   ANTIGAS — as campanhas que a versão antiga guardou no navegador
   Só leitura: a tela de entrada mostra a lista e baixa o backup de cada
   uma, para o Mestre restaurar no servidor. Nada aqui grava.
   =================================================================== */

const Antigas = {

  listar: function () {
    const indice = Armazem.ler(CHAVE_INDICE_ANTIGO);
    return (Array.isArray(indice) ? indice : []).filter(function (c) {
      return c && typeof c.id === 'string' && Antigas.ler(c.id);
    }).map(function (c) {
      return { id: c.id, nome: String(c.nome || 'Sem nome').slice(0, 60), sessao: c.sessao, atualizadaEm: Number(c.atualizadaEm) || 0 };
    });
  },

  ler: function (id) {
    const estado = Armazem.ler(PREFIXO_CAMPANHA_ANTIGA + id);
    return estado && typeof estado === 'object' ? estado : null;
  }
};
