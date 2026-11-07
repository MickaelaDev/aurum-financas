# Aurum

Dashboard financeiro pessoal, **local-first**, com visual preto e dourado, tipografia editorial e interface em português (pt-BR). Os dados ficam em um cofre SQLite dentro do navegador e são sincronizados entre dispositivos apenas como payloads cifrados.

## Recursos

- **Painel** mensal com saldo, entradas, saídas, economia, gráficos semanal/mensal/anual e próximos vencimentos.
- **Transações** com filtros por mês, tipo, conta, categoria e busca.
- **Contas** e carteiras com saldo consolidado.
- **Orçamentos** por categoria, com acompanhamento do consumo no mês.
- **Metas** de economia com aportes e progresso.
- **Recorrentes** (contas e assinaturas) com registro de pagamento no mês.
- **Salário** totalmente manual: valor bruto, cada desconto (INSS, crediário etc.) e líquido resultante.
- **Sincronização cifrada** entre navegadores/dispositivos.
- **Acesso offline** ao cofre já baixado, usando o PIN.
- **Backup** em JSON pela tela de Configurações.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Interface | React 19, TypeScript, Vite 8, Recharts, lucide-react |
| Estilo | CSS próprio, Cormorant Garamond + Inter (`@fontsource`) |
| Banco local | SQLite no navegador com `sql.js`, persistido cifrado em IndexedDB |
| Criptografia | AES-256-GCM; chave derivada do PIN via PBKDF2-SHA-256 (210.000 iterações) |
| Servidor | Fastify 5, `node:sqlite`, sessão em cookie `HttpOnly` |
| Autenticação | Nome do cofre + PIN; hash do PIN com `scrypt` no servidor |

## Requisitos

- Node.js **24 LTS** (recomendado) — o servidor usa `node:sqlite`.
- npm 11+.

## Rodar localmente

```bash
npm install
npm run dev
```

- Interface: <http://localhost:5173>
- API: <http://localhost:8787> (o Vite faz proxy de `/api` para essa porta)

Crie um cofre na primeira tela. O nome e o PIN são a única credencial; não há recuperação de PIN.

### Produção

```bash
npm run build
npm start
```

O servidor serve a build do cliente em `client/dist` e a API na mesma porta (`8787` por padrão). Acesse <http://localhost:8787>.

## Variáveis de ambiente

Definidas no processo do **servidor**:

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `PORT` | `8787` | Porta HTTP. |
| `HOST` | `0.0.0.0` | Interface de rede. |
| `DATA_DIR` | `./data` | Pasta do SQLite do servidor. Use um volume persistente em produção. |
| `COOKIE_SECURE` | `false` | Defina `true` atrás de HTTPS. O cookie também vira `Secure` automaticamente quando a requisição chega por HTTPS. |
| `TRUST_PROXY` | `false` | Defina `true` atrás de um proxy reverso confiável (para IP real e protocolo). |
| `LOG_LEVEL` | `info` | Nível de log do Fastify. |

Exemplo:

```bash
# Linux/macOS
DATA_DIR=/var/lib/aurum PORT=8787 COOKIE_SECURE=true TRUST_PROXY=true npm start
```

```powershell
# PowerShell
$env:DATA_DIR="D:\aurum-data"; $env:PORT=8787; $env:COOKIE_SECURE="true"; $env:TRUST_PROXY="true"; npm start
```

## Como os dados funcionam

1. Ao criar o cofre, o cliente gera um `vaultSalt` e deriva uma chave AES-256 do PIN com PBKDF2.
2. O banco SQLite (`sql.js`) é cifrado com AES-256-GCM e salvo no **IndexedDB** do navegador.
3. A cada alteração, as linhas modificadas são cifradas individualmente e enviadas para `POST /api/sync/push`.
4. Outros navegadores baixam os registros por `GET /api/sync/pull` usando um cursor por usuário.
5. Conflitos são resolvidos por **last-write-wins** com base em `updated_at` (milissegundos). O servidor rejeita versões mais antigas; o cliente ignora registros remotos que não sejam mais novos que os locais.
6. O servidor vê apenas entidade, ID do registro, timestamp e payload cifrado. Nomes, valores e categorias não trafegam em texto puro.

O primeiro acesso em um navegador novo baixa o cofre do servidor. Depois disso, o navegador consegue abrir offline com o PIN. Se o cofre local e o servidor estiverem vazios, são criadas categorias padrão e uma conta principal.

### Sincronização e sessão

- A sincronização roda ao abrir o app, após alterações e a cada 2 minutos com a aba visível.
- A sessão do servidor dura **30 dias**.
- Tentativas de login/registro são limitadas a **12 falhas por 15 minutos** por IP + nome.
- **Configurações → Sincronizar agora** força uma rodada; **Reenviar cofre inteiro** marca todos os registros locais como alterados.

## Backup e restauração

- **Backup dos dados**: Configurações → exportar JSON. O arquivo é legível e contém contas, categorias, transações, orçamentos, metas, recorrentes, salário e descontos.
- **Backup do servidor**: copie a pasta definida em `DATA_DIR` (idealmente com o processo parado, ou usando backup consistente do SQLite).
- **Cofre local**: fica no IndexedDB do navegador, cifrado. Limpar os dados do site apaga essa cópia; o servidor mantém a versão sincronizada.

> Não há restauração automática de um JSON exportado pela interface. Guarde-o como registro/portabilidade; para migrar de navegador, use a sincronização cifrada entrando com o mesmo nome e PIN.

## Segurança e limitações

- **O PIN não pode ser recuperado.** Sem o PIN correto, nem o servidor consegue decifrar o cofre. Perder o PIN significa perder o acesso aos dados sincronizados.
- Use HTTPS em produção. Sem TLS, o PIN e o cookie de sessão podem ser interceptados na rede.
- O PIN é enviado ao servidor para autenticação (hash com `scrypt`), mas a chave do cofre é derivada apenas no cliente e nunca é enviada.
- O servidor conhece metadados de sincronização (entidade, ID, horário) e o nome do cofre; os valores financeiros são cifrados no cliente.
- Um PIN de 4 a 6 dígitos tem espaço de busca pequeno. Para dados sensíveis, prefira 6 dígitos e mantenha o servidor privado/atrás de HTTPS.
- O app não implementa multiusuário compartilhando o mesmo cofre: cada usuário tem seu próprio cofre e suas próprias sessões.
- Não há cálculo automático de INSS/IRRF. O salário é registrado exatamente como informado.

## Estrutura do projeto

```
Dashboard Financeiro/
├── client/                 # React + Vite
│   └── src/
│       ├── components/     # layout, modais, primitivas, gráficos
│       ├── lib/            # SQLite, cripto, IndexedDB, API, sync, repositórios
│       ├── pages/          # painel, transações, contas, orçamentos, metas...
│       ├── state/          # AppContext (cofre, sessão, sincronização)
│       └── styles.css      # design system preto e dourado
├── server/                 # Fastify + node:sqlite
│   └── src/
│       ├── index.ts        # rotas, autenticação, estáticos
│       └── db.ts           # usuários, sessões, sync_records
└── package.json            # workspaces e scripts
```

## Scripts

| Comando | Ação |
| --- | --- |
| `npm run dev` | Sobe API e Vite em paralelo. |
| `npm run dev:server` | Apenas a API com `tsx watch`. |
| `npm run dev:client` | Apenas o Vite. |
| `npm run build` | Typecheck + build do cliente e do servidor. |
| `npm start` | Inicia o servidor de produção (serve `client/dist`). |
| `npm run typecheck` | Checagem de tipos dos dois workspaces. |

## Deploy

1. `npm ci && npm run build` no servidor.
2. Aponte `DATA_DIR` para um volume persistente.
3. Rode `npm start` atrás de um proxy com TLS (Nginx, Caddy, etc.).
4. Use `COOKIE_SECURE=true` e `TRUST_PROXY=true`.
5. Faça backup periódico de `DATA_DIR`.

Como não há dependência de banco externo, um único processo Node com um volume é suficiente para uso pessoal.
