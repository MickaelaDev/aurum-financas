# Aurum

Dashboard financeiro pessoal, **local-first** e **100% estático**. Roda direto no navegador — inclusive no **GitHub Pages** — sem servidor, sem banco remoto e sem conta em nuvem. Os dados ficam em um cofre SQLite cifrado no `IndexedDB` do navegador e só saem de lá por backup manual.

## Recursos

- **Painel** mensal com saldo, entradas, saídas, economia, gráficos semanal/mensal/anual e próximos vencimentos.
- **Transações** com filtros por mês, tipo, conta, categoria e busca.
- **Contas** e carteiras com saldo consolidado.
- **Orçamentos** por categoria, com acompanhamento do consumo no mês.
- **Metas** de economia com aportes e progresso.
- **Recorrentes** (contas e assinaturas) com registro de pagamento no mês.
- **Salário** totalmente manual: valor bruto, cada desconto (INSS, crediário etc.) e líquido resultante.
- **Cofre cifrado** com PIN, aberto offline e sem nenhuma chamada de rede.
- **Backup e restauração** em JSON pela tela de Configurações.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Interface | React 19, TypeScript, Vite 8, Recharts, lucide-react |
| Estilo | CSS próprio, Cormorant Garamond + Inter (`@fontsource`) |
| Banco local | SQLite no navegador com `sql.js`, persistido cifrado em `IndexedDB` |
| Criptografia | AES-256-GCM; chave derivada do PIN via PBKDF2-SHA-256 (210.000 iterações) |
| Roteamento | React Router com `HashRouter` (funciona em subpastas do Pages) |
| Deploy | Site estático no GitHub Pages via GitHub Actions |

## Requisitos

- Node.js **22.12+** (Vite 8). Recomendado: **Node 24 LTS**.
- npm 11+.

## Rodar localmente

```bash
npm install
npm run dev
```

Interface em <http://localhost:5173>. Crie um cofre na primeira tela — o nome e o PIN são a única credencial.

> Abra sempre por `http://localhost` (ou HTTPS). O app usa módulos ES, WebAssembly e `IndexedDB`; abrir `dist/index.html` com `file://` não funciona.

## Build

```bash
npm run build -w client
npm run preview -w client
```

A saída fica em `client/dist` e usa caminhos relativos (`./assets/...`), então funciona em qualquer subpasta.

## Como os dados funcionam

1. Ao criar o cofre, o cliente gera um **salt aleatório** e deriva uma chave AES-256 do PIN com PBKDF2.
2. Um verificador cifrado é gravado junto da conta local, para validar o PIN sem nunca armazená-lo.
3. O banco SQLite (`sql.js`) é cifrado com AES-256-GCM e salvo no **IndexedDB** do navegador.
4. Cada alteração é salva no mesmo lugar, de forma cifrada e automática.
5. **Nada trafega pela rede.** Não existe servidor, sessão, cookie ou sincronização automática.

## Backup, importação e troca de aparelho

- **Exportar**: Configurações → *Baixar backup* gera um JSON legível com contas, categorias, transações, orçamentos, metas, recorrentes, salário e descontos.
- **Importar**: Configurações → *Importar backup* mescla um JSON exportado no cofre aberto (os registros são combinados por `id`).
- **Trocar de aparelho**: exporte em um navegador e importe no outro depois de criar o cofre local.
- **Limpar os dados do site** apaga a cópia local. Sem backup exportado, não há como recuperar.
- O arquivo JSON é legível e contém valores financeiros — guarde-o em local seguro.

## Segurança e limitações

- **O PIN não pode ser recuperado.** Ele nunca é armazenado; só a chave derivada dele abre o cofre.
- Sem HTTPS, alguém com acesso à máquina pode ler o `IndexedDB`. O GitHub Pages já serve por HTTPS.
- Um PIN de 4 a 6 dígitos tem espaço de busca pequeno: prefira **6 dígitos**.
- Não há sincronização entre dispositivos — use o backup JSON.
- Não há cálculo automático de INSS/IRRF. O salário é registrado exatamente como informado.

## Estrutura do projeto

```
Dashboard Financeiro/
├── client/                 # React + Vite (o app publicado)
│   └── src/
│       ├── components/     # layout, modais, primitivas, gráficos
│       ├── lib/            # SQLite, cripto, IndexedDB, contas locais, repositórios
│       ├── pages/          # painel, transações, contas, orçamentos, metas...
│       ├── state/          # AppContext (cofre, sessão local, salvamento)
│       └── styles.css      # design system preto e dourado
├── server/                 # Servidor opcional (legado, fora do fluxo do app)
├── .github/workflows/      # deploy automático no GitHub Pages
└── package.json            # workspaces e scripts
```

## Scripts

| Comando | Ação |
| --- | --- |
| `npm run dev` | Sobe só o cliente (Vite) em `localhost:5173`. |
| `npm run dev:client` | O mesmo, explícito. |
| `npm run dev:all` | Cliente + servidor legado em paralelo. |
| `npm run dev:server` | Apenas o servidor legado (`tsx watch`). |
| `npm run build` | Build do cliente e do servidor. |
| `npm run build -w client` | Apenas o build publicado no Pages. |
| `npm run typecheck` | Checagem de tipos dos dois workspaces. |

## Publicar no GitHub Pages

O workflow `.github/workflows/deploy.yml` já faz tudo: instala dependências, roda o typecheck/build do cliente e publica `client/dist`.

1. Suba o repositório no GitHub (branch `main`).
2. Em **Settings → Pages**, defina **Source: GitHub Actions**.
3. Rode o workflow (push na `main` ou *Actions → Deploy no GitHub Pages → Run workflow*).
4. O site fica em `https://<usuario>.github.io/<repositorio>/`.

Observações:

- Em contas gratuitas, o Pages só publica repositórios **públicos**. Repositórios privados exigem plano pago.
- Como o app usa `HashRouter` + caminhos relativos, funciona em qualquer nome de repositório e não precisa de `404.html`.
- Depois de um deploy, use `Ctrl+F5` se o navegador insistir em carregar o bundle antigo.

## Servidor opcional (legado)

O projeto nasceu com sincronização entre dispositivos: API Fastify + `node:sqlite` + registros cifrados (`server/`, e no cliente `lib/api.ts` e `lib/sync.ts`). Esse caminho **não é usado pela interface atual** — ele fica no repositório apenas como referência e pode ser reativado se você quiser voltar a ter múltiplos dispositivos com sincronização.

```bash
npm run dev:all        # cliente + API
npm run build          # inclui o servidor
npm start              # serve client/dist + /api em http://localhost:8787
```

Variáveis do servidor: `PORT` (8787), `HOST` (0.0.0.0), `DATA_DIR` (`./data`), `COOKIE_SECURE`, `TRUST_PROXY`, `LOG_LEVEL`.
