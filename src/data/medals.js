// Catálogo das medalhas (as regras estão em supabase/schema-social.sql).
// tier: bronze | prata | ouro | platina
export const MEDALS = [
  { key: 'bem-vindo', name: 'Bem-vindo', description: 'Criaste a tua conta.', tier: 'bronze', icon: 'star' },
  { key: 'primeira-vitoria', name: 'Primeira vitória', description: 'Ganha a tua primeira partida.', tier: 'bronze', icon: 'trophy' },
  { key: 'primeiro-amigo', name: 'Bom companheiro', description: 'Faz o teu primeiro amigo.', tier: 'bronze', icon: 'people' },
  { key: 'anfitriao', name: 'Anfitrião', description: 'Convida um amigo para uma sala.', tier: 'bronze', icon: 'door' },
  { key: 'explorador', name: 'Explorador', description: 'Joga os 6 jogos.', tier: 'prata', icon: 'compass' },
  { key: 'imparavel', name: 'Imparável', description: 'Ganha 5 partidas seguidas no mesmo jogo.', tier: 'prata', icon: 'flame' },
  { key: 'veterano', name: 'Veterano', description: 'Joga 50 partidas.', tier: 'prata', icon: 'shield' },
  { key: 'palavras-10', name: 'Dicionário vivo', description: 'Ganha 10 vezes no Palavras.', tier: 'prata', icon: 'letters' },
  { key: 'fiada-5', name: 'Trevo da sorte', description: 'Ganha 5 vezes na Fiada.', tier: 'prata', icon: 'clover' },
  { key: 'galo-10', name: 'Galo de combate', description: 'Ganha 10 vezes no Jogo do Galo.', tier: 'prata', icon: 'grid' },
  { key: 'quatro-10', name: 'Quatro em linha', description: 'Ganha 10 vezes no 4 em Linha.', tier: 'prata', icon: 'discs' },
  { key: 'xadrez-5', name: 'Estratega', description: 'Ganha 5 partidas de xadrez.', tier: 'prata', icon: 'knight' },
  { key: 'memes-3', name: 'Rei dos memes', description: 'Ganha 3 jogos dos Memes.', tier: 'ouro', icon: 'laugh' },
  { key: 'xadrez-mestre', name: 'Grande mestre', description: 'Vence o bot de xadrez no nível difícil.', tier: 'ouro', icon: 'crown' },
  { key: 'popular', name: 'Popular', description: 'Tem 10 amigos.', tier: 'ouro', icon: 'people' },
  { key: 'conversador', name: 'Conversador', description: 'Envia 100 mensagens.', tier: 'ouro', icon: 'chat' },
  { key: 'lenda', name: 'Lenda', description: 'Ganha 100 partidas.', tier: 'platina', icon: 'crown' },
]

export const medalByKey = Object.fromEntries(MEDALS.map((m) => [m.key, m]))
