/* ===================================================================
   imagens.js — receber uma imagem do computador e deixá-la leve

   Três lugares do site recebem imagem: o fundo de uma cena (Mapas),
   o retrato de um personagem (painel do jogador) e o retrato de um
   monstro (Bestiário). Os três fazem a mesma coisa — abrir o arquivo,
   reduzir, regravar em JPEG — e por isso a função mora aqui, uma vez.
   Antes ela estava presa no mapas.js.

   POR QUE REDUZIR
   Sem servidor, a imagem vai para o localStorage junto com a campanha,
   e o navegador inteiro tem uns 5 MB. Uma foto de celular tem 3 a 5 MB
   sozinha. Reduzida e em JPEG, um retrato fica em ~100 KB e um mapa em
   algumas centenas — e, na tela, aparecem do mesmo tamanho.

   Com o servidor, a imagem vira um arquivo enviado (upload) e a
   campanha guarda só o endereço. Quem chama Imagens.comprimir() não
   precisa mudar: muda só o que se faz com o resultado.

   POR QUE REGRAVAR EM JPEG, E NÃO GUARDAR O ARQUIVO COMO VEIO
   Além do tamanho: o que sai do <canvas> é sempre um JPEG que nós
   mesmos geramos. Um "arquivo de imagem" qualquer pode ser um SVG com
   código dentro. imagemSegura() (dados.js) só aceita o JPEG em base64.
   =================================================================== */

const Imagens = {

  /* Os tamanhos de cada uso.
       lado     o maior lado, na primeira tentativa
       minimo   abaixo disso, desiste
       limite   tamanho máximo do texto base64 (≈ bytes × 4/3) */
  PERFIS: {
    mapa:    { lado: 1600, minimo: 600, limite: 700000 },
    retrato: { lado: 512,  minimo: 160, limite: 160000 }
  },


  /* Reduz a imagem e regrava em JPEG, até caber no limite do perfil.

     O <canvas> é uma folha em branco onde se desenha a imagem no
     tamanho que quisermos; toDataURL devolve o desenho como texto
     ("data:image/jpeg;base64,..."). Cada volta do laço tenta menor e
     com menos qualidade. O fundo é pintado antes porque PNG
     transparente vira preto no JPEG — melhor que vire a cor da casa.

     Devolve uma Promise: carregar uma imagem leva um tempo, e quem
     chamou continua no .then() quando ela estiver pronta. */
  comprimir: function (arquivo, nomePerfil) {
    const perfil = this.PERFIS[nomePerfil || 'mapa'];

    return new Promise(function (resolver, recusar) {
      if (!arquivo || !/^image\//.test(arquivo.type)) {
        recusar('Esse arquivo não é uma imagem.');
        return;
      }
      if (arquivo.size > 25 * 1024 * 1024) {
        recusar('Imagem grande demais (mais de 25 MB). Use uma versão menor.');
        return;
      }

      const endereco = URL.createObjectURL(arquivo);
      const foto = new Image();

      foto.onload = function () {
        URL.revokeObjectURL(endereco);

        const canvas = document.createElement('canvas');
        const pincel = canvas.getContext('2d');
        let lado = perfil.lado;
        let qualidade = 0.8;
        let dados = '';
        const passo = Math.max(40, Math.round(perfil.lado / 6));

        do {
          const escala = Math.min(1, lado / Math.max(foto.naturalWidth, foto.naturalHeight));
          canvas.width = Math.max(1, Math.round(foto.naturalWidth * escala));
          canvas.height = Math.max(1, Math.round(foto.naturalHeight * escala));
          pincel.fillStyle = '#0a0c10';
          pincel.fillRect(0, 0, canvas.width, canvas.height);
          pincel.drawImage(foto, 0, 0, canvas.width, canvas.height);
          dados = canvas.toDataURL('image/jpeg', qualidade);

          lado -= passo;
          qualidade = Math.max(0.45, qualidade - 0.08);
        } while (dados.length > perfil.limite && lado >= perfil.minimo);

        if (dados.length > perfil.limite) {
          recusar('Mesmo comprimida, a imagem não coube. Tente uma com menos detalhe.');
          return;
        }
        resolver({ dados: dados, largura: canvas.width, altura: canvas.height });
      };

      foto.onerror = function () {
        URL.revokeObjectURL(endereco);
        recusar('Não consegui abrir essa imagem.');
      };

      foto.src = endereco;
    });
  },


  /* Abre a janela "escolher arquivo" do sistema sem precisar de um
     <input type="file"> visível na tela: um botão bonito chama isto.
     `aoEscolher` recebe o retrato já comprimido; erros viram recado. */
  escolher: function (nomePerfil, aoEscolher) {
    const self = this;
    const entrada = document.createElement('input');
    entrada.type = 'file';
    entrada.accept = 'image/*';

    entrada.addEventListener('change', function () {
      const arquivo = entrada.files[0];
      if (!arquivo) return;
      self.comprimir(arquivo, nomePerfil).then(aoEscolher).catch(function (mensagem) {
        Layout.recado(typeof mensagem === 'string' ? mensagem : 'Não consegui ler essa imagem.', true);
      });
    });

    entrada.click();
  }
};
