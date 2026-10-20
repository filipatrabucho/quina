// Textos de cada jogo: o que é, como se joga, dicas e perguntas frequentes.
// Aparecem por baixo do jogo e nas páginas estáticas para o Google.
export const GUIDES = {
  palavras: {
    intro:
      'O Palavras é o jogo diário de adivinhar uma palavra portuguesa de cinco letras em seis tentativas. Todos os dias à meia-noite há uma palavra nova, igual para toda a gente, por isso podes comparar o resultado com os amigos.',
    rules: [
      'Escreve uma palavra válida de cinco letras e carrega em Enter.',
      'Verde: a letra está na palavra e no lugar certo.',
      'Amarelo: a letra existe na palavra, mas noutra posição.',
      'Cinzento: a letra não aparece na palavra.',
      'Podes escrever em qualquer casa: clica numa casa vazia para pôr lá a letra.',
      'No Dueto e no Quarteto adivinhas duas ou quatro palavras ao mesmo tempo, e no 1vs1 jogas contra um amigo.',
    ],
    tips: [
      'Começa com uma palavra com várias vogais diferentes e consoantes comuns (R, S, T, L) para eliminar letras depressa.',
      'Usa o teclado do ecrã: as cores mostram as letras que já usaste.',
      'Lembra-te que a mesma letra pode aparecer duas vezes.',
    ],
    faq: [
      ['A palavra muda todos os dias?', 'Sim. Há uma palavra nova à meia-noite (hora de Portugal) e é igual para todos os jogadores.'],
      ['Os acentos contam?', 'Não: o teclado não tem acentos nem cedilha e o jogo aceita a palavra escrita sem eles.'],
    ],
  },
  fiada: {
    intro:
      'A Fiada é um jogo de números em que tens de encher um tabuleiro 4×4 com trevos numerados, sempre por ordem crescente em cada linha e em cada coluna. Ganha quem completar o tabuleiro primeiro.',
    rules: [
      'Na tua vez vira uma carta do baralho, ou escolhe uma carta que esteja na mesa.',
      'Coloca-a numa casa vazia ou troca-a por uma carta que já tenhas no tabuleiro.',
      'Em cada linha e em cada coluna os números têm de subir da esquerda para a direita e de cima para baixo.',
      'Se a carta não te servir, passa-a para a mesa e os outros podem apanhá-la.',
      'Ganha o primeiro a preencher as 16 casas.',
    ],
    tips: [
      'Deixa espaço entre os números: um 5 no canto de cima à esquerda bloqueia menos do que um 12.',
      'Fica atento à mesa: às vezes a carta perfeita foi descartada por outro jogador.',
    ],
    faq: [['Quantos jogadores podem jogar?', 'Podes jogar sozinho o desafio do dia ou de 2 a 5 jogadores online.']],
  },
  quatro: {
    intro:
      'O 4 em Linha é o clássico jogo de tabuleiro vertical: deixa cair as tuas peças nas colunas e tenta juntar quatro seguidas antes do adversário. Joga contra o computador, com três níveis, ou contra um amigo online.',
    rules: [
      'O tabuleiro tem 7 colunas e 6 linhas. Na tua vez escolhe uma coluna e a peça cai até ao fundo.',
      'Ganha quem juntar quatro peças seguidas na horizontal, na vertical ou na diagonal.',
      'Se o tabuleiro encher sem ninguém fazer quatro, é empate.',
    ],
    tips: [
      'Joga pelo centro: a coluna do meio entra em mais linhas possíveis do que as das pontas.',
      'Antes de jogares, vê sempre se o adversário pode fazer quatro na jogada seguinte.',
      'Tenta criar duas ameaças ao mesmo tempo: o adversário só consegue tapar uma.',
    ],
    faq: [['O bot difícil é imbatível?', 'Não, mas pensa várias jogadas à frente. Para o venceres tens de preparar ameaças duplas.']],
  },
  galo: {
    intro:
      'O Jogo do Galo, também conhecido como três em linha, é o jogo mais simples para passar o tempo: X contra O num tabuleiro de 3×3. Joga contra o bot (o nível difícil nunca perde) ou contra um amigo online.',
    rules: [
      'Os jogadores alternam e marcam uma casa vazia com X ou com O.',
      'Ganha quem fizer três seguidos na horizontal, na vertical ou na diagonal.',
      'Se as nove casas ficarem cheias sem três seguidos, é empate.',
    ],
    tips: [
      'Quem começa deve jogar num canto: dá mais hipóteses de criar duas ameaças.',
      'Se o adversário começar num canto, responde no centro.',
      'Contra o bot difícil o melhor resultado possível é o empate.',
    ],
    faq: [['Quem começa?', 'O X começa sempre. Contra o bot, em cada partida nova trocas de símbolo, por isso começas uma vez sim, outra não.']],
  },
  xadrez: {
    intro:
      'Joga xadrez online grátis contra o computador, com três níveis de dificuldade, ou contra um amigo numa sala privada. Todas as regras oficiais estão incluídas: roque, en passant, promoção, xeque-mate e empates.',
    rules: [
      'As brancas começam. Clica numa peça para veres as jogadas possíveis e depois clica no destino.',
      'O objetivo é dar xeque-mate: atacar o rei adversário sem que ele possa escapar.',
      'Há empate por afogamento, repetição de posição, regra dos 50 lances ou material insuficiente.',
      'Quando um peão chega à última linha escolhes a peça em que se promove.',
    ],
    tips: [
      'Na abertura, controla o centro, desenvolve cavalos e bispos e faz o roque cedo.',
      'Antes de cada jogada pergunta: que peças minhas ficam desprotegidas?',
      'Contra o bot, usa o botão Anular para experimentar e aprender.',
    ],
    faq: [['Posso jogar com as pretas?', 'Sim, no modo contra o bot escolhes jogar com as brancas ou com as pretas.']],
  },
  memes: {
    intro:
      'O Jogo dos Memes é um jogo de festa para 2 a 8 jogadores: cada um recebe uma imagem e escreve as legendas mais engraçadas que conseguir. Depois toda a gente vota no melhor meme. Perfeito para jogar em chamada com amigos.',
    rules: [
      'Cria uma sala e envia o link aos amigos.',
      'Em cada ronda tens um tempo limite para escrever as legendas. Podes arrastá-las para onde quiseres na imagem.',
      'Podes trocar de imagem uma vez por ronda.',
      'Na votação escolhes o melhor meme; não podes votar no teu.',
      'Cada voto vale 100 pontos e o meme mais votado da ronda ganha mais 50.',
    ],
    tips: ['Piadas internas do grupo costumam ganhar mais votos do que piadas genéricas.', 'Textos curtos leem-se melhor.'],
    faq: [['Preciso de conta para jogar?', 'Sim, uma conta grátis (email, Google ou Discord). Assim ficas com estatísticas, medalhas e lugar no top.']],
  },
  naval: {
    intro:
      'A Batalha Naval é o clássico jogo de estratégia em que escondes a tua frota e tentas afundar os navios do adversário. Joga contra o computador ou contra um amigo online, num tabuleiro de 10×10.',
    rules: [
      'Coloca os 5 navios: porta-aviões (5 casas), couraçado (4), cruzador (3), submarino (3) e contratorpedeiro (2).',
      'Os navios não se podem tocar, nem na diagonal.',
      'No PC roda o navio com a roda do rato, o botão direito ou a tecla R. No telemóvel usa o botão Rodar navio.',
      'À vez, disparem numa casa do mar inimigo: água ou acerto.',
      'Ganha quem afundar primeiro todos os navios do outro.',
    ],
    tips: [
      'Quando acertares, dispara nas casas à volta para descobrir a direção do navio.',
      'No início dispara em xadrez (uma casa sim, outra não): encontras os navios com menos tiros.',
      'Como os navios não se tocam, à volta de um navio afundado só há água.',
    ],
    faq: [['Posso escolher onde ficam os navios?', 'Sim, colocas cada navio à mão ou usas o botão Aleatório.']],
  },
  stop: {
    intro:
      'O Stop é o jogo de palavras de toda a vida, agora online: sai uma letra e todos têm de encontrar um nome, um país ou cidade, um animal, um objeto, uma comida e uma profissão começados por essa letra. Quem acabar primeiro carrega em STOP!',
    rules: [
      'O anfitrião escolhe o número de rondas e o tempo de cada uma.',
      'Em cada ronda sai uma letra diferente para todos.',
      'Preenche as seis categorias com palavras começadas por essa letra.',
      'Quando alguém completa tudo e carrega em STOP, a ronda acaba para todos.',
      'Na revisão podem contestar respostas que não valham; com votos suficientes a resposta é anulada.',
      'Pontos: 20 se fores o único a responder na categoria, 10 se a tua resposta for diferente e 5 se for repetida.',
    ],
    tips: ['Respostas menos óbvias valem mais pontos.', 'Preenche primeiro as categorias mais fáceis e volta às difíceis.'],
    faq: [['Quantos jogadores?', 'De 2 a 10 jogadores na mesma sala.']],
  },
  cartas: {
    intro:
      'As Cartas Coloridas são um jogo de cartas rápido para 2 a 8 jogadores, ou contra bots: combina cores e números, usa as cartas especiais e sê o primeiro a ficar sem cartas.',
    rules: [
      'Cada jogador começa com 7 cartas.',
      'Joga uma carta da mesma cor ou com o mesmo número ou símbolo da carta da mesa.',
      'Se não tiveres nenhuma, compra uma do baralho; se servir, podes jogá-la logo.',
      'Saltar: o próximo perde a vez. Inverter: muda o sentido do jogo. Mais dois: o próximo compra 2 cartas.',
      'Muda a cor e Mais quatro servem em qualquer altura e escolhes a cor seguinte.',
      'Ganha quem ficar sem cartas primeiro.',
    ],
    tips: ['Guarda os coringas para o fim.', 'Fica atento a quem tem só uma carta e usa as cartas especiais nesse jogador.'],
    faq: [['Posso jogar sozinho?', 'Sim, contra 1 a 3 bots.']],
  },
  poker: {
    intro:
      "O Poker Texas Hold'em é a variante de poker mais jogada no mundo. Aqui jogas em formato torneio: todos começam com as mesmas fichas (a fingir), as blinds vão subindo e ganha quem ficar com todas as fichas. Joga contra bots ou monta uma mesa com até 6 amigos.",
    rules: [
      'Cada jogador recebe 2 cartas fechadas. Na mesa aparecem 5 cartas comunitárias: 3 no flop, 1 no turn e 1 no river.',
      'Há uma ronda de apostas antes do flop e depois de cada fase. Podes desistir, passar (sem aposta), pagar ou aumentar.',
      'Os dois jogadores à esquerda do dealer põem as blinds (apostas obrigatórias). Sobem de 6 em 6 mãos.',
      'No fim, ganha a melhor mão de 5 cartas entre as tuas 2 e as 5 da mesa. Se todos os outros desistirem, ganhas sem mostrar.',
      'Quem faz all-in só pode ganhar o que conseguiu cobrir; o resto vai para potes laterais.',
    ],
    tips: ['Joga poucas mãos antes do flop, mas joga-as com força.', 'A posição conta: agir depois dos outros dá-te mais informação.', 'Quando as blinds sobem, as fichas valem menos: não esperes demasiado.'],
    faq: [
      ['Qual é a ordem das mãos?', 'Da mais forte para a mais fraca: sequência de cor, póquer, full house, cor, sequência, trio, dois pares, par e carta alta.'],
      ['É a dinheiro?', 'Não, as fichas são a fingir.'],
    ],
  },
  blackjack: {
    intro:
      'O Blackjack (ou 21) é o jogo de cartas de casino mais conhecido: tenta fazer uma mão mais perto de 21 do que a banca, sem passar. Joga sozinho contra a banca ou senta-te numa mesa com até 5 amigos. As fichas são a fingir, não há dinheiro envolvido.',
    rules: [
      'As cartas de 2 a 10 valem o número, as figuras valem 10 e o Ás vale 11 ou 1 (o que der mais jeito).',
      'Aposta antes de cada mão. Recebes 2 cartas e a banca mostra só uma das dela.',
      'Pedir dá-te mais uma carta; Ficar passa a vez. Se passares de 21, rebentas e perdes a aposta.',
      'Dobrar duplica a aposta e recebes só mais uma carta. Com duas cartas iguais podes Dividir em duas mãos.',
      'A banca pede cartas até ter 17 ou mais. Ganhar paga 1 para 1 e o Blackjack (Ás + carta de 10) paga 3 para 2.',
    ],
    tips: ['Com 17 ou mais costuma ser melhor ficar.', 'Se a banca mostra 2 a 6, ela rebenta mais vezes: fica com mãos mais baixas.', 'Divide sempre ases e oitos; nunca dividas dez.'],
    faq: [
      ['É a dinheiro?', 'Não. As fichas são a fingir e, se ficares sem nenhuma, recomeças com 1000.'],
      ['Quantos podem jogar na mesa?', 'Até 5 pessoas, cada uma contra a banca.'],
    ],
  },
  bombas: {
    intro:
      'O Bombas & Companhia é um jogo de arena para até 4 jogadores: anda pelo labirinto, põe bombas para rebentar as caixas de madeira, apanha os prémios escondidos e elimina os adversários antes que te apanhem a ti. Joga contra bots ou cria uma sala e convida os teus amigos.',
    rules: [
      'Anda com as setas ou WASD e põe uma bomba com Espaço. No telemóvel usa o comando e o botão 💣 no ecrã.',
      'Cada bomba explode passado pouco mais de 2 segundos, em cruz. A explosão para nas paredes de pedra e parte a primeira caixa que encontrar.',
      'Quem for apanhado pela explosão (incluindo quem pôs a bomba) sai da ronda. Uma explosão faz rebentar as bombas que apanhar.',
      'Algumas caixas escondem prémios: 💣 mais uma bomba de cada vez, 🔥 explosões mais compridas e 👟 mais velocidade.',
      'Ganha a ronda o último que ficar na arena. Na morte súbita (ao fim de 1 minuto contra bots e de 2 minutos online) caem blocos de pedra em espiral e a arena vai fechando.',
    ],
    tips: [
      'Antes de pores uma bomba, vê para onde vais fugir: os corredores sem saída são armadilhas.',
      'Junta prémios de alcance com cuidado: as explosões compridas também te apanham a ti.',
      'Usa as bombas para fechar o caminho aos adversários.',
    ],
    faq: [
      ['Posso jogar sozinho?', 'Sim, no modo vs Bots jogas contra 1 a 3 bots. Numa sala online o anfitrião também pode juntar bots.'],
      ['Quantos jogadores dá?', 'Até 4 na mesma arena, entre pessoas e bots.'],
    ],
  },
  snake: {
    intro:
      'O Snake é o clássico jogo da cobra dos telemóveis antigos: guia a cobra até à comida, cresce e tenta não bater em ti própria. Joga diretamente no browser, no PC ou no telemóvel, e bate o teu recorde.',
    rules: [
      'Usa as setas ou WASD no PC. No telemóvel desliza o dedo no tabuleiro ou usa os botões.',
      'Cada peça de comida dá 1 ponto e faz a cobra crescer.',
      'A cobra fica mais rápida à medida que come.',
      'Com paredes: perdes se bateres na borda. Sem paredes: sais de um lado e entras pelo outro.',
      'Perdes se bateres no teu próprio corpo. Carrega em Espaço para pausa.',
    ],
    tips: ['Anda junto às paredes para deixar o meio livre.', 'Planeia o caminho para não ficares fechado dentro do teu próprio corpo.'],
    faq: [['O recorde fica guardado?', 'Sim, no teu browser, separado para cada modo.']],
  },
  memoria: {
    intro:
      'O jogo da Memória é o clássico de virar cartas e encontrar os pares. Treina a memória sozinho contra o relógio, em quatro tamanhos, ou joga à vez com até 6 amigos online.',
    rules: [
      'Vira duas cartas de cada vez.',
      'Se forem iguais ficam viradas; se não, voltam a esconder-se.',
      'No modo solo tenta acabar com o menor número de jogadas e no menor tempo.',
      'No multiplayer jogam à vez: quem acerta num par joga outra vez e ganha quem tiver mais pares.',
    ],
    tips: ['Vira primeiro as cartas que ainda não viste.', 'Divide o tabuleiro em zonas para te lembrares melhor de onde está cada carta.'],
    faq: [['Que tamanhos há?', 'Fácil (6 pares), Normal (8), Difícil (12) e Enorme (18).']],
  },
  noventa: {
    intro:
      'O 99 é um jogo de cartas de nervos: cada carta jogada soma ao total da mesa e ninguém pode passar dos 99. Quem não conseguir jogar perde uma vida. Joga contra até 5 bots ou com até 8 amigos online.',
    rules: [
      'Cada jogador tem 3 cartas e 3 vidas. Depois de jogares, compras outra carta.',
      'As cartas de 2 a 8 somam o seu valor; o J e a Q somam 10.',
      'O Ás vale 1 ou 11, o 10 tira ou soma 10, o 9 vale 0 e o 4 vale 0 e inverte o sentido.',
      'O K põe o total logo em 99.',
      'Se na tua vez nenhuma carta der para jogar sem passar dos 99, perdes uma vida e começa uma mão nova.',
      'Ganha o último jogador com vidas.',
    ],
    tips: [
      'Guarda o K, o 9, o 4 e o 10 para quando o total estiver perto de 99.',
      'Com o total baixo, joga as cartas altas para pôr pressão nos outros.',
    ],
    faq: [['É o mesmo 99 do Board Game Arena?', 'É inspirado no 99 clássico de somar cartas, com as cartas especiais mais conhecidas.']],
  },
  verdades: {
    intro:
      'Duas Verdades e Uma Mentira é o jogo perfeito para conhecer melhor os amigos: cada um escreve três frases sobre si, duas verdadeiras e uma falsa, e os outros tentam descobrir a mentira.',
    rules: [
      'Todos escrevem três frases sobre si e marcam qual é a mentira.',
      'Depois, à vez, as frases de cada jogador aparecem baralhadas e os outros votam na mentira.',
      'Acertar na mentira dá 100 pontos.',
      'O autor ganha 50 pontos por cada pessoa que enganar.',
      'Ganha quem tiver mais pontos no fim.',
    ],
    tips: ['As melhores mentiras são detalhes pequenos e credíveis.', 'Usa verdades surpreendentes: parecem mentira.'],
    faq: [['Quantos jogadores?', 'De 2 a 10, mas fica mais divertido a partir de 4.']],
  },
  frase: {
    intro:
      'O Continua a Frase é um jogo de festa: aparece o início de uma frase e todos têm o mesmo tempo para escrever a continuação mais engraçada. Depois votam na melhor.',
    rules: [
      'O anfitrião escolhe o número de rondas e o tempo para escrever, de 30 a 90 segundos.',
      'Em cada ronda aparece o início de uma frase. Escreve o final e carrega em Pronto.',
      'Na votação as frases aparecem sem nome e escolhes a melhor; não podes votar na tua.',
      'Cada voto vale 100 pontos e a frase mais votada da ronda ganha mais 50.',
    ],
    tips: ['Respostas inesperadas ganham mais do que as óbvias.', 'Termina sempre antes do tempo: a frase que não for enviada não entra na votação.'],
    faq: [['Preciso de conta?', 'Sim, uma conta grátis. Depois é só entrar na sala com o código ou o link.']],
  },
  emojis: {
    intro:
      'No Emoji Battle tens de descobrir o filme, a série, o jogo ou a personagem escondidos numa sequência de emojis. Há mais de 140 enigmas e podes responder em português ou em inglês. Joga sozinho ou contra amigos.',
    rules: [
      'Em cada enigma aparecem os emojis e a categoria (filme, série, jogo ou personagem).',
      'Escreve o nome em português de Portugal ou em inglês. Pequenas gralhas contam.',
      'A meio do tempo aparece uma pista com a primeira letra de cada palavra.',
      'Quanto mais depressa acertares, mais pontos ganhas (até 150), e o primeiro a acertar leva mais 25.',
      'No modo solo são 10 enigmas de 30 segundos.',
    ],
    tips: ['Pensa nos títulos portugueses e nos originais: os dois são aceites.', 'Se disser "Quase!", estás a uma ou duas letras.'],
    faq: [['Posso escolher o tema?', 'Sim: filmes, séries, jogos, personagens ou tudo misturado.']],
  },
  colonos: {
    intro:
      'Colonos é um jogo de estratégia e negociação: coloniza uma ilha, junta recursos, constrói estradas, aldeias e cidades e troca com os outros jogadores até chegares aos 10 pontos.',
    rules: [
      'No início cada jogador coloca 2 aldeias e 2 estradas; a segunda aldeia dá logo recursos.',
      'Na tua vez lança os dados: cada terreno com esse número dá recursos às aldeias (1) e cidades (2) à volta.',
      'Com 7 o ladrão move-se: quem tem mais de 7 cartas descarta metade e tu roubas uma carta a alguém.',
      'Estrada: madeira e tijolo. Aldeia: madeira, tijolo, lã e trigo. Cidade: 2 trigo e 3 minério. Carta de desenvolvimento: lã, trigo e minério.',
      'Troca 4 cartas iguais por 1 com o banco, ou melhor ainda com os portos (3:1 e 2:1), ou negoceia com os outros jogadores.',
      'Aldeia vale 1 ponto, cidade 2, estrada mais longa (5+) 2 e maior exército (3+ cavaleiros) 2. Ganha quem chegar aos 10.',
    ],
    tips: ['Escolhe cruzamentos com números variados e recursos diferentes.', 'Os números 6 e 8 saem mais vezes.'],
    faq: [['Quantos jogadores?', 'De 2 a 4 online, ou sozinho contra 1 a 3 bots.']],
  },
}
