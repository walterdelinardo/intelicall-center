

## Plano: Logo upload, tela de transição e correção do flash de onboarding

### Problema 1: Flash da tela de onboarding
O `PrivateRoute` redireciona para `/onboarding` quando `profile?.clinic_id` é falso. Durante o carregamento do perfil (após auth state mudar mas antes do fetchProfile completar), `profile` é `null`, causando o flash. A solução é tratar `profile === null` (quando `user` existe mas perfil ainda não carregou) como estado de loading, não como "sem clínica".

### Problema 2: Sem tela de boas-vindas pós-login
Criar um estado `showWelcome` no `PrivateRoute` (ou no `AuthContext`) que exibe uma tela animada de boas-vindas por ~2 segundos após o login, mostrando o logo da clínica e o nome do usuário.

### Problema 3: Upload de logo e uso no sistema
Criar um bucket de storage `clinic-logos`, adicionar upload na aba Dados Gerais, e usar o `logo_url` da clínica no Login, no Header e como favicon dinâmico.

---

### Alterações

#### 1. Migração SQL: Criar bucket `clinic-logos`
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('clinic-logos', 'clinic-logos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: qualquer autenticado pode fazer upload/ler
CREATE POLICY "Anyone can read clinic logos" ON storage.objects
  FOR SELECT USING (bucket_id = 'clinic-logos');

CREATE POLICY "Authenticated users can upload clinic logos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'clinic-logos');

CREATE POLICY "Authenticated users can update clinic logos" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'clinic-logos');

CREATE POLICY "Authenticated users can delete clinic logos" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'clinic-logos');
```

#### 2. `src/components/modules/ConfiguracoesModule.tsx`
- Adicionar seção de upload de logo no início do formulário "Dados Gerais"
- Componente: preview do logo atual + botão de upload (input file hidden)
- Ao selecionar arquivo: upload para `clinic-logos/{clinic_id}/logo.{ext}`, obter URL pública, salvar em `clinics.logo_url`
- Mostrar preview circular/quadrada com fallback para ícone Building2

#### 3. `src/pages/Login.tsx`
- Buscar logo da clínica: como o login é público e não sabemos qual clínica, duas opções:
  - **Opção escolhida**: Buscar a primeira clínica ativa (o sistema é single-tenant por implantação, então só existe uma clínica normalmente). Query: `supabase.from("clinics").select("logo_url, name").limit(1).single()`
  - Nota: RLS exige autenticação para SELECT em clinics. Vou usar uma query anon-safe ou criar uma edge function simples. **Alternativa mais simples**: armazenar o logo_url no localStorage ao fazer login, e no Login lê-lo de lá. Ou criar uma RLS policy para leitura pública limitada.
  - **Decisão final**: Criar uma RLS policy `anon can select logo from clinics` ou usar a abordagem de localStorage. Vou usar localStorage pois é mais simples e não requer mudanças RLS.
- Se `logo_url` existir no localStorage, mostrar `<img>` ao invés do ícone Footprints

#### 4. `src/App.tsx` — Corrigir flash de onboarding
- No `PrivateRoute`: quando `user` existe mas `profile` é `null`, tratar como loading (não redirecionar para onboarding)
- Alterar condição: `if (!user) return <Navigate to="/" />` e `if (profile === null) return <Loading />` e `if (!profile.clinic_id) return <Navigate to="/onboarding" />`

#### 5. `src/App.tsx` — Tela de boas-vindas
- Criar componente `WelcomeScreen` inline ou separado
- No `PrivateRoute`: quando tudo carregou com sucesso, mostrar `WelcomeScreen` por ~2.5s antes de renderizar children
- O WelcomeScreen mostra: logo da clínica (de `clinic` ou fallback), nome do usuário (do profile), animação fade-in/scale suave
- Usar `useState(true)` + `useEffect(() => setTimeout(() => setShowWelcome(false), 2500), [])` para controlar a exibição
- A tela só aparece uma vez por sessão (usar `sessionStorage` para evitar mostrar em cada navegação)

#### 6. Favicon dinâmico
- No `DashboardHeader` (ou no `App.tsx`/`PrivateRoute`): quando `clinic.logo_url` estiver disponível, atualizar o favicon dinamicamente via `document.querySelector('link[rel="icon"]').href = clinic.logo_url` ou criar o elemento se não existir
- Adicionar `useEffect` que observa `clinic?.logo_url` e atualiza o favicon

#### 7. `src/components/dashboard/DashboardHeader.tsx`
- Já usa `clinic?.logo_url` — sem alteração necessária, já funciona

#### 8. `src/pages/Login.tsx` — Salvar logo no localStorage
- Ao carregar o login, ler `localStorage.getItem("clinic_logo_url")` e `localStorage.getItem("clinic_name")`
- No `AuthContext` ou no `DashboardHeader`: ao carregar clinic, salvar `localStorage.setItem("clinic_logo_url", clinic.logo_url)`

### Arquivos modificados:
1. **Migração SQL** — bucket `clinic-logos`
2. `src/components/modules/ConfiguracoesModule.tsx` — upload de logo
3. `src/pages/Login.tsx` — exibir logo da clínica
4. `src/App.tsx` — corrigir flash de onboarding + tela de boas-vindas
5. `src/components/dashboard/DashboardHeader.tsx` — favicon dinâmico + salvar logo no localStorage

