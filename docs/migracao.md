# Guia de Migração — transferir o projeto das minhas contas para as do cliente

Ordem recomendada: **Supabase → GitHub → Resend → Vercel**. A Vercel vai por
último porque ela precisa das variáveis de ambiente novas já prontas.

---

## Antes de começar

- [ ] Receber do cliente o checklist completo do `client-account-setup.md`
      (GitHub, Supabase, Vercel e Resend prontos)
- [ ] Tirar **backup completo** do banco Supabase atual:
      - Painel → *Database → Backups* → baixar dump, ou
      - CLI: `supabase db dump -f backup.sql`
- [ ] Baixar também o bucket de **Storage** (produtos têm imagens):
      `supabase storage download` ou pelo painel web
- [ ] Anotar todas as variáveis de ambiente da Vercel atual
      (*Project → Settings → Environment Variables*) — vai precisar recriar
      no projeto novo
- [ ] **Commitar e dar push** da migration pendente
      `supabase/migrations/20260411100000_allow_delete_user_with_orders.sql`
      (hoje está unstaged) antes de transferir o repo
- [ ] Marcar **janela de manutenção** com o cliente (app fica fora ~30–60 min)

---

## 1. Migrar Supabase

1. Pedir ao cliente para te adicionar como **Owner** temporário na org dele
   (*Organization → Team → Invite*)
2. Dentro da org do cliente, criar **novo projeto** na **mesma região**
   do atual (ex: `sa-east-1` São Paulo). Guardar a senha do banco num
   gerenciador.
3. Aplicar as migrations do repositório no projeto novo:
   ```bash
   supabase link --project-ref <novo-ref>
   supabase db push
   ```
   (ou aplicar `supabase/migrations/` manualmente pelo SQL Editor)
4. Restaurar os dados do dump:
   ```bash
   psql "postgresql://postgres:<senha>@db.<ref>.supabase.co:5432/postgres" < backup.sql
   ```
5. Recriar buckets de **Storage** (*Storage → New bucket*) com as **mesmas
   policies** e fazer upload dos arquivos baixados
6. Em *Authentication → Providers*, reconfigurar os providers usados
   (e-mail/senha, Google, etc.)
7. Em *Authentication → URL Configuration*, deixar um placeholder — volta
   nesse passo depois que o domínio estiver apontando para a Vercel
8. Copiar as novas chaves de *Settings → API*:
   - **Project URL**
   - **anon key**
   - **service_role key**
9. Testar localmente com as chaves novas antes de seguir

---

## 2. Migrar GitHub

**Opção A (recomendada) — transferir o repositório:**

1. No repo atual: *Settings → General → Transfer ownership*
2. Digitar o usuário/org do cliente
3. Cliente recebe e-mail e aceita (link expira em 1 dia)
4. Issues, PRs, Actions e histórico vão junto
5. Depois da transferência, pedir pra ele te adicionar como colaborador

**Opção B — clone limpo (se não quiser transferir o histórico):**

1. `git clone --mirror <seu-repo>`
2. Cliente cria repo vazio
3. `git push --mirror <repo-do-cliente>`

⚠️ **Secrets do GitHub Actions** (*Settings → Secrets*) **não** são transferidos
— anotar e recriar no destino se houver CI configurado.

---

## 3. Migrar Resend

1. Cliente te convida como membro (*Settings → Team → Invite*)
2. Confirmar que o domínio dele já está verificado
3. Criar **API Key** nova em *API Keys → Create*:
   - Escopo: *Sending access*
   - Nome: `production-vercel`
4. Copiar a chave — vai na Vercel no próximo passo
5. Ajustar `RESEND_FROM_EMAIL` para o domínio do cliente (se no código/env
   atual está hard-coded no meu domínio)

---

## 4. Migrar Vercel (último passo — entra no ar)

1. Cliente te convida no Team dele
2. *Add New → Project → Import Git Repository* → escolher o repo transferido.
   Se o GitHub do Team não mostrar o repo, autorizar a **Vercel GitHub App**
   na org do cliente.
3. Framework preset: **Next.js** (detecta automático)
4. **Environment Variables** — preencher com as credenciais **novas**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL`
   - + demais variáveis anotadas do projeto antigo
5. **Deploy** e aguardar build passar
6. Testar a URL temporária `*.vercel.app` antes de apontar domínio
7. *Project → Settings → Domains* → adicionar o domínio do cliente. Ele
   atualiza os registros DNS conforme a instrução da Vercel.
8. Voltar ao **Supabase → Authentication → URL Configuration** e colocar a URL
   final (`https://app.empresa.com.br`) em *Site URL* e *Redirect URLs*

---

## 5. Pós-migração

- [ ] Testar fluxos críticos no ambiente novo:
  - login
  - criar pedido
  - upload de imagem de produto
  - envio de e-mail transacional
  - auditoria
- [ ] Validar RLS rodando com usuários de papéis diferentes
      (admin, commissary, etc.)
- [ ] Confirmar com o cliente que está tudo funcionando **antes** de desligar
      as contas antigas
- [ ] Esperar 7–14 dias e então **deletar**:
  - projeto Supabase antigo
  - projeto Vercel antigo
  - API keys antigas do Resend
- [ ] Pedir ao cliente para reduzir meu acesso de Owner para
      Developer/colaborador (se for continuar mantendo o projeto)
- [ ] Guardar as credenciais finais num gerenciador compartilhado

---

## Pontos de atenção específicos deste projeto

- **Supabase Storage:** o app usa bucket de imagens de produto — não esquecer
  de migrar os arquivos
- **RLS policies e funções `SECURITY DEFINER`** existem nas migrations —
  validar que todas foram aplicadas:
  ```sql
  select * from pg_policies;
  select proname, prosecdef from pg_proc where prosecdef = true;
  ```
- **`middleware.ts`** usa cookies do Supabase — funciona igual com qualquer
  projeto, depende só das env vars estarem corretas
- **Migration pendente** `20260411100000_allow_delete_user_with_orders.sql`
  precisa ser commitada **antes** da transferência do GitHub, senão se perde
- **Região do Supabase:** criar o projeto novo na mesma região do atual para
  não mudar a latência percebida pelo usuário final
