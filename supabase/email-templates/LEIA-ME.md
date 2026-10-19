# Emails da conta (Supabase → Authentication → Emails → Templates)

Copia o conteúdo de cada ficheiro para o modelo certo e usa estes assuntos:

| Modelo no Supabase | Ficheiro | Assunto |
| --- | --- | --- |
| Confirm signup | `confirmar-conta.html` | Confirma a tua conta Tuga Games |
| Reset password | `nova-password.html` | Define uma password nova · Tuga Games |
| Change email address | `mudar-email.html` | Confirma o teu email novo · Tuga Games |
| Magic link | `link-de-entrada.html` | O teu link para entrar no Tuga Games |

Os links dos emails voltam para `https://tugagames.pt/conta?...`, por isso em
Authentication → URL Configuration → Redirect URLs tem de estar `https://tugagames.pt/**`.
