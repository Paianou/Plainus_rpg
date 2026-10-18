/* ===================================================================
   aviso-saida.js — "Sair sem salvar?"

   Você está no meio da ficha de um monstro, ou da criação da campanha,
   e fecha a aba, aperta F5 ou clica num link. Sem isto, o que estava
   digitado some em silêncio. Com isto, o navegador pergunta antes.

   COMO FUNCIONA
   O navegador dispara 'beforeunload' antes de sair da página. Se quem
   ouve chamar preventDefault(), ele mostra a pergunta de "sair do
   site?". O texto da pergunta é do NAVEGADOR — por segurança, nenhum
   site escolhe as palavras (golpes usavam isso para assustar).

   O QUE CONTA COMO "NÃO SALVO"
   1. Digitação dentro de um formulário que ainda não foi salvo:
        .formulario      os do Mestre (bestiário, NPCs, diário, tabelas)
        dialog[open]     a janela de cena dos mapas
        .form-nota       a anotação do jogador
        [data-rascunho]  qualquer outro que se marque assim
      Basta digitar dentro deles: este arquivo marca o formulário com
      data-sujo. Ao salvar ou cancelar, as telas redesenham e o
      formulário sai da página — e um formulário fora da página não
      segura ninguém. Por isso nenhuma tela precisa "desmarcar" nada.
   2. Uma mensagem escrita e não enviada no chat.
   3. O que cada tela registrar com AvisoSaida.registrar(funcao) — a
      ficha do jogador, que é redesenhada a cada tecla (para as contas
      aparecerem na hora) e por isso compara o rascunho com o original.

   Quando a SAÍDA É o salvamento (a criação da campanha termina indo
   para o painel), a tela chama AvisoSaida.liberar() antes de sair.
   =================================================================== */

const AvisoSaida = {

  verificadores: [],
  livre: false,

  /* `funcao` devolve true se há algo que se perderia. */
  registrar: function (funcao) {
    this.verificadores.push(funcao);
  },

  /* A próxima saída é de propósito: não perguntar. */
  liberar: function () {
    this.livre = true;
  },

  haPendencia: function () {
    if (this.livre) return false;

    /* isConnected: só vale formulário que ainda está na página. */
    const sujo = document.querySelector('.formulario[data-sujo], .form-nota[data-sujo], [data-rascunho][data-sujo], dialog[open][data-sujo]');
    if (sujo && sujo.isConnected) return true;

    const chat = document.getElementById('chatTexto');
    if (chat && chat.value.trim()) return true;

    return this.verificadores.some(function (f) {
      try { return f(); } catch (erro) { return false; }
    });
  },

  ligar: function () {
    const self = this;

    /* Digitou dentro de um formulário: ele fica "sujo". Na fase de
       captura (o true no fim), para nenhuma tela engolir o evento antes. */
    document.addEventListener('input', function (evento) {
      const alvo = evento.target;
      if (!alvo || !alvo.closest) return;
      const form = alvo.closest('.formulario, .form-nota, [data-rascunho], dialog');
      if (form) form.dataset.sujo = '1';
    }, true);

    /* A janela de cena (<dialog>) não sai da página ao fechar: ela só
       se esconde. Fechou, limpou — ela E o que está dentro: a marca cai
       no .formulario de dentro da janela (o mais perto de quem digitou),
       e, esquecida ali, a tela de Mapas se achava "ocupada" para sempre
       e parava de redesenhar o que os jogadores faziam. */
    document.addEventListener('close', function (evento) {
      const janela = evento.target;
      if (!janela || !janela.dataset) return;
      delete janela.dataset.sujo;
      janela.querySelectorAll('[data-sujo]').forEach(function (dentro) { delete dentro.dataset.sujo; });
    }, true);

    window.addEventListener('beforeunload', function (evento) {
      if (!self.haPendencia()) return;
      evento.preventDefault();
      /* Navegadores mais antigos só perguntam se returnValue tiver
         algum texto — que eles também não mostram. */
      evento.returnValue = '';
    });
  }
};

AvisoSaida.ligar();
