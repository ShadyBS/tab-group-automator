# 🤖 Prompt para Geração de Arquivos `agents.md`

## 📋 Objetivo

Este prompt orienta a criação de arquivos `agents.md` personalizados para projetos específicos, servindo como guia completo para agentes de IA trabalhando em desenvolvimento de software no VSCode.

---

## 🎯 Instruções para o Agente

Você deve criar um arquivo `agents.md` completo e específico para o projeto fornecido. Use a estrutura e padrões abaixo, adaptando o conteúdo para as características únicas do projeto.

### 📝 Informações Necessárias

Antes de gerar o arquivo, colete as seguintes informações sobre o projeto:

1. **Tipo de Projeto**: Web app, extensão de navegador, API, mobile app, desktop app, biblioteca, etc.
2. **Stack Tecnológico**: Linguagens, frameworks, bibliotecas principais
3. **Arquitetura**: Estrutura de pastas, componentes principais, padrões arquiteturais
4. **Scripts de Build**: Comandos npm/yarn, processos de build e deploy
5. **Ferramentas de Qualidade**: Linters, formatters, testes, validações
6. **Fluxo de Desenvolvimento**: Git workflow, versionamento, releases
7. **Dependências Críticas**: APIs externas, serviços, integrações
8. **Considerações Especiais**: Segurança, performance, compatibilidade

---

## 🏗️ Estrutura Obrigatória do `agents.md`

### 1. Cabeçalho e Identidade

```markdown
# [Nome do Projeto] - Guia para Agentes de IA

## 🎯 IDENTIDADE DO AGENTE

Você é um **especialista em [tecnologia/domínio principal]** com conhecimento profundo em:
- **[Tecnologia 1]** - [Descrição específica]
- **[Tecnologia 2]** - [Descrição específica]
- **[Domínio específico]** - [Conhecimento especializado]
- **[Padrões/Arquiteturas]** - [Práticas específicas]

---

## 📋 PRIORIDADES ABSOLUTAS

1. **SEMPRE leia o arquivo `agents.md` antes de começar e siga TODAS as suas orientações e regras, isso é OBRIGATÓRIO**
2. **[Prioridade específica 1]** - [Descrição detalhada]
3. **[Prioridade específica 2]** - [Descrição detalhada]
4. **[Prioridade específica 3]** - [Descrição detalhada]
5. **[Prioridade específica 4]** - [Descrição detalhada]
```

### 2. Estrutura do Projeto

```markdown
## 📁 Estrutura do Projeto

### Arquitetura Geral
```
[Nome do Projeto]/
├── 📄 [arquivo-config]           # [Descrição]
├── 🔧 [arquivo-principal]        # [Descrição]
├── 📊 [pasta-componentes]/       # [Descrição]
│   ├── [componente1]
│   └── [componente2]
├── 🎨 [pasta-ui]/               # [Descrição]
├── 🔒 [pasta-seguranca]/        # [Descrição]
├── 📚 [pasta-docs]/             # [Descrição]
└── 🧪 [pasta-testes]/           # [Descrição]
```

### Arquivos Críticos - ⚠️ NÃO MODIFICAR SEM CUIDADO

#### [Categoria 1]
- `[arquivo1]` - [Descrição e cuidados]
- `[arquivo2]` - [Descrição e cuidados]

#### [Categoria 2]
- `[arquivo3]` - [Descrição e cuidados]
- `[arquivo4]` - [Descrição e cuidados]

### Padrões e Convenções Existentes

#### Nomenclatura de Arquivos
- **[Padrão 1]**: [Descrição e exemplos]
- **[Padrão 2]**: [Descrição e exemplos]

#### Estrutura de Código
- **[Convenção 1]**: [Descrição e exemplos]
- **[Convenção 2]**: [Descrição e exemplos]
```

### 3. Regras Invioláveis e Fluxo de Trabalho

```markdown
## 🚨 REGRAS INVIOLÁVEIS - NUNCA PULE ESTAS ETAPAS

### ⚠️ FLUXO OBRIGATÓRIO APÓS QUALQUER MODIFICAÇÃO

**ESTAS ETAPAS SÃO OBRIGATÓRIAS E NÃO PODEM SER PULADAS:**

#### 🔄 FLUXO VISUAL OBRIGATÓRIO
```
📝 IMPLEMENTAR MUDANÇA
         ↓
📋 ATUALIZAR CHANGELOG.md
         ↓
✅ EXECUTAR VALIDAÇÕES
    ├── [comando de lint]
    ├── [comando de teste]
    └── [comando de build]
         ↓
🔄 VERIFICAR NOVOS ARQUIVOS
    ├── Incluídos no build?
    ├── Imports corretos?
    └── Configs atualizadas?
         ↓
💾 COMMIT OBRIGATÓRIO
    ├── git add .
    └── git commit -m "tipo: desc"
         ↓
✅ TAREFA COMPLETA
```

#### 1. 📝 CHANGELOG OBRIGATÓRIO
```bash
# SEMPRE atualize CHANGELOG.md na seção [Unreleased]
# Adicione entrada apropriada: Added/Changed/Fixed/Removed/Security
# Exemplo:
# ### Fixed
# - **[Componente]**: Descrição clara da correção implementada
```

#### 2. ✅ VALIDAÇÃO OBRIGATÓRIA
```bash
# SEMPRE execute validações completas
[comando de lint]               # Linting obrigatório
[comando de type-check]         # Type checking obrigatório (se aplicável)
[comando de teste]              # Testes obrigatórios
[comando de build]              # Build obrigatório
```

#### 3. 🔄 ATUALIZAÇÃO DE BUILD (se novos arquivos)
```bash
# SE criou novos arquivos, SEMPRE verifique:
# - Arquivos incluídos no sistema de build
# - Imports/exports corretos e funcionando
# - Configurações de bundling atualizadas
# - Assets/recursos incluídos corretamente
```

#### 4. 💾 COMMIT OBRIGATÓRIO
```bash
# SEMPRE faça commit das mudanças
git add .
git commit -m "tipo(escopo): descrição clara"
# Exemplo: git commit -m "fix(api): corrigir timeout em requisições longas"
```

**❌ NUNCA deixe uma tarefa sem completar TODAS estas etapas!**

#### 5. 🔄 ATUALIZAÇÃO DO AGENTS.MD (se mudanças estruturais)
```bash
# SE fez mudanças estruturais no projeto, SEMPRE verifique:
# - Estrutura de pastas mudou?
# - Novos scripts de build foram adicionados?
# - Arquivos de configuração foram modificados?
# - Fluxo de desenvolvimento mudou?
# - Novas ferramentas foram introduzidas?

# ENTÃO SEMPRE atualize o agents.md:
# - Atualizar seção "Estrutura do Projeto"
# - Atualizar seção "Scripts e Automação"
# - Atualizar seção "Fluxo de Trabalho"
# - Atualizar exemplos de código se necessário
# - Atualizar comandos e validações
```

### ⚠️ CONSEQUÊNCIAS DE NÃO SEGUIR AS REGRAS

#### 📝 Não Atualizar Changelog
- **Problema**: Mudanças não documentadas
- **Impacto**: Dificuldade em releases, perda de rastreabilidade
- **Resultado**: Bugs não identificados, regressões

#### ✅ Não Validar/Testar
- **Problema**: Código quebrado em produção
- **Impacto**: Usuários afetados, rollbacks emergenciais
- **Resultado**: Perda de confiança, trabalho redobrado

#### 🔄 Não Atualizar Build
- **Problema**: Funcionalidades não funcionam
- **Impacto**: Features "fantasma" que não existem em produção
- **Resultado**: Bugs críticos, funcionalidades quebradas

#### 💾 Não Fazer Commit
- **Problema**: Trabalho perdido
- **Impacto**: Retrabalho, perda de histórico
- **Resultado**: Desperdício de tempo, frustração da equipe

#### 🔄 Não Atualizar Agents.md
- **Problema**: Documentação desatualizada para agentes
- **Impacto**: Agentes seguem instruções obsoletas, criam código inconsistente
- **Resultado**: Bugs, regressões, perda de padrões, trabalho refeito

---

## 🔄 Fluxo de Trabalho Específico

### Passo-a-Passo para Modificações

#### 1. Preparação do Ambiente
```bash
# [Comandos específicos do projeto]
[comando1]
[comando2]
```

#### 2. Análise de Impacto
- **[Consideração 1]**: [Descrição]
- **[Consideração 2]**: [Descrição]

#### 3. Implementação
```[linguagem]
// ✅ [Padrão correto específico do projeto]
[exemplo de código]

// ❌ [Anti-padrão específico]
[exemplo do que não fazer]
```

#### 4. Validação e Build
```bash
# [Scripts específicos]
[comando de build]
[comando de teste]
[comando de validação]
```

#### 5. Documentação
- **[Tipo de doc 1]**: [Onde e como atualizar]
- **[Tipo de doc 2]**: [Onde e como atualizar]

#### 6. Commit Obrigatório (SEMPRE EXECUTAR)
```bash
# ⚠️ FLUXO OBRIGATÓRIO APÓS QUALQUER MODIFICAÇÃO ⚠️
[sequência de comandos obrigatórios]
```
```

### 4. Ferramentas e Scripts

```markdown
## 🔧 Scripts e Automação

### 🤖 Scripts de Automação Obrigatórios

#### Script de Validação Completa
```bash
# Script que SEMPRE deve ser executado antes de commit
[comando-validacao-completa]     # Executa todas as validações obrigatórias
```

#### Script de Commit Seguro
```bash
# Script que força validações antes do commit
[comando-commit-seguro]          # Valida + commit automático com verificações
```

#### Script de Verificação de Arquivos
```bash
# Script que verifica se novos arquivos estão no build
[comando-verificar-build]        # Verifica integridade do build e novos arquivos
```

#### Script de Checklist Automático
```bash
# Script que executa checklist completo de qualidade
[comando-checklist-completo]    # Executa todas as verificações de qualidade
```

### Scripts Disponíveis

#### Desenvolvimento
```bash
[comando1]                    # [Descrição]
[comando2]                    # [Descrição]
```

#### Build e Deploy
```bash
[comando3]                    # [Descrição]
[comando4]                    # [Descrição]
```

#### Validação e Qualidade
```bash
[comando5]                    # [Descrição]
[comando6]                    # [Descrição]
```

### 🔍 Checklist de Verificação Obrigatória

Antes de considerar qualquer tarefa como "completa", execute este checklist:

#### ✅ Documentação
- [ ] **CHANGELOG.md atualizado** na seção [Unreleased]
- [ ] **Tipo de mudança documentado** (Added/Changed/Fixed/etc.)
- [ ] **Descrição clara** da mudança implementada

#### ✅ Validações
- [ ] **`[comando-lint]`** executado e passou
- [ ] **`[comando-type-check]`** executado e passou (se TypeScript)
- [ ] **`[comando-test]`** executado e passou
- [ ] **`[comando-build]`** executado com sucesso

#### ✅ Arquivos e Build
- [ ] **Novos arquivos** incluídos no sistema de build
- [ ] **Imports/exports** verificados e funcionando
- [ ] **Configurações de build** atualizadas se necessário
- [ ] **Assets/recursos** incluídos corretamente

#### ✅ Controle de Versão
- [ ] **Todas as mudanças** adicionadas ao git (`git add .`)
- [ ] **Commit realizado** com mensagem descritiva
- [ ] **Conventional Commits** seguido (tipo(escopo): descrição)

#### ✅ Funcionalidade
- [ ] **Funcionalidade testada** manualmente
- [ ] **Não há regressões** introduzidas
- [ ] **Performance** não foi impactada negativamente

#### ✅ Manutenção do Agents.md
- [ ] **Estrutura do projeto** atualizada se houve mudanças
- [ ] **Scripts e comandos** atualizados se novos foram adicionados
- [ ] **Fluxo de trabalho** atualizado se processo mudou
- [ ] **Exemplos de código** atualizados se padrões mudaram
- [ ] **Validações** atualizadas se novas ferramentas foram introduzidas

### Quando Usar Cada Script

#### Durante Desenvolvimento
1. **`[comando-dev]`** - Para desenvolvimento ativo
2. **`[comando-watch]`** - Para rebuild automático

#### Antes de Commit
1. **`[comando-validacao-completa]`** - Validação obrigatória
2. **`[comando-commit-seguro]`** - Commit com verificações

#### Antes de Release
1. **`[comando-build-prod]`** - Build de produção
2. **`[comando-checklist-completo]`** - Verificação final
```

### 5. Práticas de Código e Organização

```markdown
## 💻 Práticas de Código e Organização

### 🏗️ Arquitetura e Organização da Codebase

#### Estrutura de Diretórios
```
src/
├── components/           # Componentes reutilizáveis
│   ├── common/          # Componentes genéricos
│   ├── ui/              # Componentes de interface
│   └── business/        # Componentes de negócio
├── services/            # Lógica de negócio e APIs
├── utils/               # Utilitários e helpers
├── types/               # Definições de tipos
├── constants/           # Constantes da aplicação
├── hooks/               # Hooks customizados (React)
├── stores/              # Gerenciamento de estado
├── assets/              # Recursos estáticos
└── tests/               # Testes organizados por tipo
    ├── unit/
    ├── integration/
    └── e2e/
```

#### Princípios de Organização
- **Separação de Responsabilidades**: Cada módulo tem uma responsabilidade única
- **Baixo Acoplamento**: Módulos independentes e fracamente acoplados
- **Alta Coesão**: Elementos relacionados agrupados logicamente
- **Reutilização**: Componentes e funções reutilizáveis
- **Escalabilidade**: Estrutura que cresce sem complexidade excessiva

### 📝 Convenções de Nomenclatura

#### Arquivos e Diretórios
```[linguagem]
// ✅ Padrões corretos
components/UserProfile.tsx        // PascalCase para componentes
services/userService.ts          // camelCase para serviços
utils/dateHelpers.ts             // camelCase para utilitários
types/UserTypes.ts               // PascalCase para tipos
constants/API_ENDPOINTS.ts       // UPPER_CASE para constantes

// ❌ Padrões incorretos
components/userprofile.tsx       // Sem convenção clara
services/UserService.ts          // Inconsistente
utils/date-helpers.ts            // Mistura de convenções
```

#### Variáveis e Funções
```[linguagem]
// ✅ Nomenclatura descritiva e consistente
const userAccountBalance = 1000;
const isUserAuthenticated = true;
const getUserProfileData = async (userId: string) => {};
const handleFormSubmission = (formData: FormData) => {};

// ❌ Nomenclatura vaga ou inconsistente
const data = 1000;                // Muito genérico
const flag = true;                // Não descritivo
const get = async (id) => {};     // Muito vago
const submit = (data) => {};      // Contexto insuficiente
```

#### Classes e Interfaces
```[linguagem]
// ✅ Padrões corretos
class UserAccountManager {}       // PascalCase, substantivo
interface UserProfile {}         // PascalCase, sem prefixo
type ApiResponse<T> = {};         // PascalCase, genérico claro
enum UserRole {}                  // PascalCase, singular

// ❌ Padrões incorretos
class userManager {}              // camelCase incorreto
interface IUserProfile {}        // Prefixo desnecessário
type response = {};               // camelCase incorreto
enum UserRoles {}                 // Plural desnecessário
```

### 🎯 Padrões Arquiteturais Específicos

#### 1. Separação de Camadas
```[linguagem]
// ✅ Arquitetura em camadas clara
// Camada de Apresentação
export const UserProfileComponent = () => {
  const { user, loading, error } = useUserProfile();
  return <UserProfileView user={user} loading={loading} error={error} />;
};

// Camada de Lógica de Negócio
export const useUserProfile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    UserService.getCurrentUser()
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);
  
  return { user, loading };
};

// Camada de Dados
export class UserService {
  static async getCurrentUser(): Promise<User> {
    return ApiClient.get('/user/profile');
  }
}
```

#### 2. Injeção de Dependências
```[linguagem]
// ✅ Dependências injetadas, testável
export class UserService {
  constructor(
    private apiClient: ApiClient,
    private logger: Logger,
    private cache: CacheService
  ) {}
  
  async getUser(id: string): Promise<User> {
    const cacheKey = `user:${id}`;
    const cached = await this.cache.get(cacheKey);
    
    if (cached) {
      this.logger.debug('User loaded from cache', { id });
      return cached;
    }
    
    const user = await this.apiClient.get(`/users/${id}`);
    await this.cache.set(cacheKey, user, 300); // 5 min TTL
    
    this.logger.info('User loaded from API', { id });
    return user;
  }
}

// ❌ Dependências hardcoded, difícil de testar
export class UserService {
  async getUser(id: string): Promise<User> {
    // Dependências hardcoded
    const response = await fetch(`/api/users/${id}`);
    console.log('User loaded'); // Log hardcoded
    return response.json();
  }
}
```

#### 3. Error Handling Consistente
```[linguagem]
// ✅ Tratamento de erro estruturado
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const handleApiError = (error: unknown): ApiError => {
  if (error instanceof ApiError) {
    return error;
  }
  
  if (error instanceof Response) {
    return new ApiError(
      'API request failed',
      error.status,
      'API_ERROR',
      { url: error.url }
    );
  }
  
  return new ApiError(
    'Unknown error occurred',
    500,
    'UNKNOWN_ERROR',
    { originalError: error }
  );
};

// Uso consistente
try {
  const user = await UserService.getUser(id);
  return user;
} catch (error) {
  const apiError = handleApiError(error);
  logger.error('Failed to load user', {
    userId: id,
    error: apiError.code,
    details: apiError.details
  });
  throw apiError;
}
```

### 🔧 Bibliotecas e APIs Preferidas

#### [Categoria específica do projeto]
```[linguagem]
// ✅ APIs recomendadas para o projeto
import { [biblioteca-preferida] } from '[pacote-oficial]';

// Uso correto seguindo padrões do projeto
const result = await [biblioteca-preferida].[metodo-recomendado]();

// ❌ APIs desencorajadas
import { [biblioteca-legacy] } from '[pacote-deprecated]';
```

### 📊 Qualidade de Código

#### Métricas de Qualidade
- **Complexidade Ciclomática**: Máximo 10 por função
- **Cobertura de Testes**: Mínimo 80% para código crítico
- **Duplicação de Código**: Máximo 3% do codebase
- **Tamanho de Função**: Máximo 50 linhas por função
- **Tamanho de Arquivo**: Máximo 300 linhas por arquivo

#### Code Review Checklist
- [ ] **Nomenclatura**: Nomes descritivos e consistentes
- [ ] **Responsabilidade Única**: Cada função/classe tem uma responsabilidade
- [ ] **DRY**: Não há duplicação desnecessária de código
- [ ] **SOLID**: Princípios SOLID aplicados quando apropriado
- [ ] **Testabilidade**: Código facilmente testável
- [ ] **Performance**: Sem gargalos óbvios de performance
- [ ] **Segurança**: Sem vulnerabilidades conhecidas
- [ ] **Documentação**: Código autodocumentado ou documentado

### 🧪 Estratégias de Teste

#### Pirâmide de Testes
```[linguagem]
// ✅ Testes unitários (base da pirâmide)
describe('UserService', () => {
  it('should return user data when API call succeeds', async () => {
    const mockApiClient = {
      get: jest.fn().mockResolvedValue({ id: '1', name: 'John' })
    };
    const userService = new UserService(mockApiClient);
    
    const result = await userService.getUser('1');
    
    expect(result).toEqual({ id: '1', name: 'John' });
    expect(mockApiClient.get).toHaveBeenCalledWith('/users/1');
  });
});

// ✅ Testes de integração (meio da pirâmide)
describe('User API Integration', () => {
  it('should create and retrieve user', async () => {
    const userData = { name: 'John Doe', email: 'john@example.com' };
    
    const createdUser = await request(app)
      .post('/api/users')
      .send(userData)
      .expect(201);
    
    const retrievedUser = await request(app)
      .get(`/api/users/${createdUser.body.id}`)
      .expect(200);
    
    expect(retrievedUser.body.name).toBe(userData.name);
  });
});

// ✅ Testes E2E (topo da pirâmide - poucos mas críticos)
describe('User Registration Flow', () => {
  it('should allow user to register and login', async () => {
    await page.goto('/register');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="submit"]');
    
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="welcome"]')).toBeVisible();
  });
});
```

### 📈 Performance e Otimização

#### Práticas de Performance
```[linguagem]
// ✅ Lazy loading e code splitting
const UserDashboard = lazy(() => import('./UserDashboard'));
const AdminPanel = lazy(() => import('./AdminPanel'));

// ✅ Memoização adequada
const ExpensiveComponent = memo(({ data, onUpdate }) => {
  const processedData = useMemo(() => {
    return data.map(item => expensiveTransformation(item));
  }, [data]);
  
  const handleUpdate = useCallback((id, changes) => {
    onUpdate(id, changes);
  }, [onUpdate]);
  
  return <DataTable data={processedData} onUpdate={handleUpdate} />;
});

// ✅ Debouncing para inputs
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  
  return debouncedValue;
};
```

### 🔒 Segurança

#### Práticas de Segurança
```[linguagem]
// ✅ Sanitização de entrada
import DOMPurify from 'dompurify';

const sanitizeUserInput = (input: string): string => {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong'],
    ALLOWED_ATTR: []
  });
};

// ✅ Validação de entrada
import { z } from 'zod';

const UserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  age: z.number().min(18, 'Must be at least 18 years old')
});

const validateUserInput = (input: unknown) => {
  try {
    return UserSchema.parse(input);
  } catch (error) {
    throw new ValidationError('Invalid user data', error.errors);
  }
};

// ✅ Escape de SQL (se aplicável)
const getUserById = async (id: string) => {
  // Usando prepared statements
  const query = 'SELECT * FROM users WHERE id = ?';
  return database.query(query, [id]);
};
```

### 📋 Exemplos de Código

#### ✅ Código Exemplar
```[linguagem]
/**
 * Serviço responsável por gerenciar operações de usuário
 * Implementa cache, logging e tratamento de erros
 */
export class UserService {
  private readonly cache = new Map<string, { data: User; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutos
  
  constructor(
    private readonly apiClient: ApiClient,
    private readonly logger: Logger
  ) {}
  
  /**
   * Busca usuário por ID com cache automático
   * @param id - ID único do usuário
   * @returns Promise com dados do usuário
   * @throws {UserNotFoundError} Quando usuário não existe
   * @throws {ApiError} Quando API falha
   */
  async getUserById(id: string): Promise<User> {
    this.validateUserId(id);
    
    const cached = this.getCachedUser(id);
    if (cached) {
      this.logger.debug('User loaded from cache', { userId: id });
      return cached;
    }
    
    try {
      const user = await this.apiClient.get<User>(`/users/${id}`);
      this.setCachedUser(id, user);
      
      this.logger.info('User loaded successfully', { 
        userId: id, 
        source: 'api' 
      });
      
      return user;
    } catch (error) {
      this.logger.error('Failed to load user', { 
        userId: id, 
        error: error.message 
      });
      
      if (error.status === 404) {
        throw new UserNotFoundError(`User with ID ${id} not found`);
      }
      
      throw new ApiError('Failed to fetch user data', error);
    }
  }
  
  private validateUserId(id: string): void {
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      throw new ValidationError('User ID must be a non-empty string');
    }
  }
  
  private getCachedUser(id: string): User | null {
    const cached = this.cache.get(id);
    if (!cached) return null;
    
    const isExpired = Date.now() - cached.timestamp > this.CACHE_TTL;
    if (isExpired) {
      this.cache.delete(id);
      return null;
    }
    
    return cached.data;
  }
  
  private setCachedUser(id: string, user: User): void {
    this.cache.set(id, {
      data: user,
      timestamp: Date.now()
    });
  }
}
```

#### ❌ Código Problemático
```[linguagem]
// ❌ Múltiplos problemas: sem tipos, sem tratamento de erro,
// sem validação, responsabilidades misturadas, sem logging
export class UserService {
  async getUser(id) {  // Sem tipos
    // Sem validação de entrada
    const response = await fetch(`/api/users/${id}`);  // Hardcoded URL
    const user = await response.json();  // Sem tratamento de erro
    
    // Lógica de apresentação misturada com lógica de dados
    if (user.name) {
      user.displayName = user.name.toUpperCase();
    }
    
    // Sem logging
    return user;  // Pode retornar undefined
  }
  
  // Função muito longa e com múltiplas responsabilidades
  async updateUserAndSendEmail(id, data, emailTemplate) {
    const user = await this.getUser(id);
    user.name = data.name;
    user.email = data.email;
    user.updatedAt = new Date();
    
    const updateResponse = await fetch(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(user)
    });
    
    const emailData = {
      to: user.email,
      subject: 'Profile Updated',
      template: emailTemplate,
      data: user
    };
    
    const emailResponse = await fetch('/api/send-email', {
      method: 'POST',
      body: JSON.stringify(emailData)
    });
    
    return { user: updateResponse.json(), email: emailResponse.json() };
  }
}
```
```

### 6. Debugging e Troubleshooting

```markdown
## 🐛 Debugging e Troubleshooting

### Ferramentas Específicas do Stack

#### [Ferramenta 1]
```bash
# [Como usar]
[comandos]
```

#### [Ferramenta 2]
```bash
# [Como usar]
[comandos]
```

### Problemas Comuns e Soluções

#### 1. [Problema comum 1]
```bash
# Problema: [Descrição]
# Solução:
[comandos de solução]
```

#### 2. [Problema comum 2]
```bash
# Problema: [Descrição]
# Solução:
[comandos de solução]
```

### Logs e Monitoramento

#### [Sistema de logging]
```[linguagem]
// ✅ [Como fazer logging correto]
[exemplo]
```
```

### 7. Versionamento, Commits e Changelog

```markdown
## 📝 Versionamento, Commits e Changelog

### 🔄 Padrão de Commits (Conventional Commits)

#### Formato Obrigatório
```
<tipo>(<escopo>): <descrição>

[corpo opcional]

[rodapé opcional]
```

#### Tipos Principais
- **feat**: Nova funcionalidade para o usuário
- **fix**: Correção de bug
- **docs**: Mudanças na documentação
- **style**: Formatação, espaços em branco, etc.
- **refactor**: Refatoração de código sem mudança de funcionalidade
- **test**: Adição ou correção de testes
- **chore**: Tarefas de manutenção, build, etc.
- **perf**: Melhorias de performance
- **ci**: Mudanças em CI/CD
- **build**: Mudanças no sistema de build

#### Escopos Comuns do Projeto
- **[escopo1]**: [Descrição do escopo]
- **[escopo2]**: [Descrição do escopo]
- **[escopo3]**: [Descrição do escopo]

#### Exemplos de Commits
```bash
# Nova funcionalidade
git commit -m "feat(auth): adicionar autenticação via OAuth2"

# Correção de bug
git commit -m "fix(api): corrigir timeout em requisições longas"

# Documentação
git commit -m "docs(readme): atualizar instruções de instalação"

# Refatoração
git commit -m "refactor(utils): extrair função de validação para módulo separado"

# Breaking change
git commit -m "feat(api): alterar formato de resposta da API

BREAKING CHANGE: O campo 'data' agora retorna array em vez de objeto"
```

### 📋 Organização do CHANGELOG.md

#### Estrutura Padrão
```markdown
# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Added
- Nova funcionalidade X
- Suporte para Y

### Changed
- Melhoria na funcionalidade Z
- Atualização da dependência A para versão 2.0

### Fixed
- Correção do bug #123
- Correção de memory leak em componente Y

### Deprecated
- Funcionalidade X será removida na v2.0

### Removed
- Remoção da funcionalidade Y (deprecated desde v1.5)

### Security
- Correção de vulnerabilidade XSS em formulários

## [1.2.0] - 2024-01-15

### Added
- Sistema de notificações em tempo real
- API de webhooks para integrações

### Changed
- Interface do dashboard redesenhada
- Performance melhorada em 40%

### Fixed
- Correção de bug na paginação
- Correção de problema de encoding UTF-8

## [1.1.0] - 2024-01-01

...
```

#### Categorias Obrigatórias
- **Added**: Novas funcionalidades
- **Changed**: Mudanças em funcionalidades existentes
- **Deprecated**: Funcionalidades que serão removidas
- **Removed**: Funcionalidades removidas
- **Fixed**: Correções de bugs
- **Security**: Correções de segurança

#### Regras de Organização
1. **Sempre manter seção [Unreleased]** no topo
2. **Versões em ordem cronológica reversa** (mais recente primeiro)
3. **Datas no formato ISO** (YYYY-MM-DD)
4. **Links para comparação** entre versões
5. **Descrições claras e concisas**
6. **Referências a issues/PRs** quando relevante

#### Automação do Changelog
```bash
# Gerar changelog automaticamente
npm run changelog:generate

# Atualizar changelog para nova versão
npm run changelog:release

# Validar formato do changelog
npm run changelog:validate
```

### 🏷️ Estratégia de Versionamento (Semantic Versioning)

#### Formato: MAJOR.MINOR.PATCH
```
1.2.3
│ │ │
│ │ └─ PATCH: Correções de bugs compatíveis
│ └─── MINOR: Novas funcionalidades compatíveis
└───── MAJOR: Mudanças incompatíveis
```

#### Quando Incrementar Cada Nível

##### PATCH (1.2.3 → 1.2.4)
- Correções de bugs
- Melhorias de performance
- Correções de segurança
- Atualizações de documentação
- Refatorações internas

##### MINOR (1.2.3 → 1.3.0)
- Novas funcionalidades
- Novas APIs (compatíveis)
- Deprecação de funcionalidades
- Melhorias significativas

##### MAJOR (1.2.3 → 2.0.0)
- Breaking changes
- Remoção de APIs deprecated
- Mudanças incompatíveis
- Reestruturação arquitetural

#### Versionamento Pré-Release
```bash
# Alpha (desenvolvimento inicial)
1.0.0-alpha.1
1.0.0-alpha.2

# Beta (feature complete, em teste)
1.0.0-beta.1
1.0.0-beta.2

# Release Candidate (pronto para produção)
1.0.0-rc.1
1.0.0-rc.2
```

### 🚀 Processo de Release

#### Release Automatizado
```bash
# Release patch (correções)
npm run release:patch

# Release minor (novas funcionalidades)
npm run release:minor

# Release major (breaking changes)
npm run release:major

# Release com versão específica
npm run release -- --release-as 2.1.0

# Dry run (simular release)
npm run release -- --dry-run
```

#### Fluxo de Release Manual
```bash
# 1. Verificar estado do repositório
git status
git pull origin main

# 2. Executar testes e validações
npm run test
npm run lint
npm run build

# 3. Atualizar versão
npm version patch  # ou minor/major

# 4. Atualizar CHANGELOG.md
# Mover itens de [Unreleased] para nova versão

# 5. Commit da release
git add CHANGELOG.md
git commit -m "chore(release): v1.2.3"

# 6. Criar tag
git tag v1.2.3

# 7. Push com tags
git push origin main --tags

# 8. Criar release no GitHub
gh release create v1.2.3 --generate-notes

# 9. Deploy (se aplicável)
npm run deploy:production
```

#### Checklist de Release
- [ ] **Testes passando**: Todos os testes unitários e integração
- [ ] **Build funcionando**: Build de produção sem erros
- [ ] **Documentação atualizada**: README, CHANGELOG, docs
- [ ] **Breaking changes documentados**: Se aplicável
- [ ] **Dependências atualizadas**: Verificar vulnerabilidades
- [ ] **Performance testada**: Sem regressões de performance
- [ ] **Compatibilidade verificada**: Browsers/Node.js suportados
- [ ] **Rollback plan**: Plano de rollback definido

### 🔄 Git Workflow

#### Branching Strategy
```bash
# Branches principais
main                    # Produção estável
develop                 # Desenvolvimento ativo

# Branches de feature
feature/user-auth       # Nova funcionalidade
feature/payment-system  # Nova funcionalidade

# Branches de release
release/v1.2.0         # Preparação de release

# Branches de hotfix
hotfix/critical-bug    # Correção urgente em produção
```

#### Fluxo de Desenvolvimento
```bash
# 1. Criar branch de feature
git checkout -b feature/nova-funcionalidade

# 2. Desenvolver e commitar
git add .
git commit -m "feat(auth): implementar login via Google"

# 3. Push da branch
git push origin feature/nova-funcionalidade

# 4. Criar Pull Request
gh pr create --title "feat: implementar login via Google"

# 5. Code review e merge
# (via interface do GitHub/GitLab)

# 6. Limpar branch local
git checkout main
git pull origin main
git branch -d feature/nova-funcionalidade
```
```

### 8. Validações, Build e CI/CD

```markdown
## 🔧 Validações, Build e CI/CD

### 🔍 Sistema de Validações

#### Validações de Código
```bash
# Linting (ESLint/TSLint/Pylint)
npm run lint                    # Verificar problemas de código
npm run lint:fix               # Corrigir problemas automaticamente

# Formatação (Prettier/Black/gofmt)
npm run format                 # Formatar código
npm run format:check           # Verificar formatação

# Type checking (TypeScript/mypy)
npm run type-check             # Verificar tipos

# Security scanning
npm audit                      # Verificar vulnerabilidades
npm run security:scan          # Scan de segurança avançado
```

#### Validações de Qualidade
```bash
# Complexidade de código
npm run complexity             # Verificar complexidade ciclomática

# Duplicação de código
npm run duplication            # Detectar código duplicado

# Cobertura de testes
npm run test:coverage          # Gerar relatório de cobertura

# Performance
npm run perf:audit             # Auditoria de performance
```

#### Validações Específicas do Projeto
```bash
# [Validações específicas baseadas no tipo de projeto]
npm run validate:api           # Validar contratos de API
npm run validate:schemas       # Validar schemas de dados
npm run validate:config        # Validar arquivos de configuração
npm run validate:dependencies  # Verificar dependências
```

### 🏗️ Sistema de Build

#### Build de Desenvolvimento
```bash
# Build rápido para desenvolvimento
npm run build:dev              # Build não otimizado
npm run build:watch            # Build com watch mode
npm run serve:dev               # Servidor de desenvolvimento
```

#### Build de Produção
```bash
# Build otimizado para produção
npm run build:prod             # Build completo otimizado
npm run build:analyze          # Análise do bundle
npm run build:clean            # Limpar builds anteriores
```

#### Build Multi-Target
```bash
# Builds para diferentes ambientes/plataformas
npm run build:staging          # Build para staging
npm run build:production       # Build para produção
npm run build:docker           # Build para container
npm run build:mobile           # Build para mobile (se aplicável)
```

#### Otimizações de Build
```javascript
// ✅ Configuração de build otimizada
const buildConfig = {
  // Tree shaking para remover código não usado
  optimization: {
    usedExports: true,
    sideEffects: false
  },
  
  // Code splitting para carregamento eficiente
  splitChunks: {
    chunks: 'all',
    cacheGroups: {
      vendor: {
        test: /[\\/]node_modules[\\/]/,
        name: 'vendors',
        chunks: 'all'
      }
    }
  },
  
  // Minificação e compressão
  minimize: true,
  minimizer: [
    new TerserPlugin({
      terserOptions: {
        compress: {
          drop_console: true // Remove console.log em produção
        }
      }
    })
  ]
};
```

### 🚀 CI/CD Pipeline

#### GitHub Actions Workflow
```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [16.x, 18.x, 20.x]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linting
      run: npm run lint
    
    - name: Run type checking
      run: npm run type-check
    
    - name: Run tests
      run: npm run test:coverage
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3

  build:
    needs: test
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18.x'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build application
      run: npm run build:prod
    
    - name: Upload build artifacts
      uses: actions/upload-artifact@v3
      with:
        name: build-files
        path: dist/

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - name: Deploy to production
      run: |
        # Scripts de deploy específicos do projeto
        echo "Deploying to production..."
```

#### Pipeline Stages
1. **Validation Stage**
   - Linting e formatação
   - Type checking
   - Security scanning
   - Dependency audit

2. **Test Stage**
   - Testes unitários
   - Testes de integração
   - Testes E2E
   - Coverage report

3. **Build Stage**
   - Build para diferentes ambientes
   - Otimização de assets
   - Bundle analysis
   - Artifact generation

4. **Deploy Stage**
   - Deploy para staging
   - Smoke tests
   - Deploy para produção
   - Health checks

### 📊 Monitoramento e Métricas

#### Métricas de Build
```bash
# Tempo de build
npm run build:time             # Medir tempo de build

# Tamanho do bundle
npm run bundle:size            # Verificar tamanho dos bundles

# Análise de dependências
npm run deps:analyze           # Analisar dependências
```

#### Métricas de Qualidade
```bash
# Code quality score
npm run quality:score          # Score geral de qualidade

# Technical debt
npm run debt:analyze           # Análise de débito técnico

# Maintainability index
npm run maintainability        # Índice de manutenibilidade
```

### 🔒 Validações de Segurança

#### Security Scanning
```bash
# Vulnerability scanning
npm audit                      # Audit básico do npm
npm run security:audit         # Audit avançado

# SAST (Static Application Security Testing)
npm run security:sast          # Análise estática de segurança

# Dependency scanning
npm run security:deps          # Verificar dependências vulneráveis

# License compliance
npm run license:check          # Verificar licenças das dependências
```

#### Security Policies
```javascript
// ✅ Configuração de segurança
const securityConfig = {
  // Content Security Policy
  csp: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  },
  
  // HTTPS enforcement
  httpsOnly: true,
  
  // Security headers
  headers: {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  }
};
```

### 🧪 Estratégias de Teste Avançadas

#### Test Automation
```bash
# Testes paralelos
npm run test:parallel          # Executar testes em paralelo

# Testes por categoria
npm run test:unit              # Apenas testes unitários
npm run test:integration       # Apenas testes de integração
npm run test:e2e               # Apenas testes E2E

# Testes de performance
npm run test:performance       # Testes de carga e performance

# Testes de acessibilidade
npm run test:a11y              # Testes de acessibilidade
```

#### Test Coverage
```javascript
// ✅ Configuração de cobertura
const coverageConfig = {
  // Thresholds mínimos
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Thresholds específicos para arquivos críticos
    './src/core/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  
  // Arquivos a ignorar
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/build/',
    '/dist/'
  ]
};
```

### 📈 Performance Monitoring

#### Performance Budgets
```javascript
// ✅ Orçamentos de performance
const performanceBudgets = {
  // Tamanho máximo de bundles
  bundleSize: {
    main: '250kb',
    vendor: '500kb',
    total: '1mb'
  },
  
  // Métricas de carregamento
  loadTime: {
    firstContentfulPaint: '1.5s',
    largestContentfulPaint: '2.5s',
    timeToInteractive: '3.5s'
  },
  
  // Métricas de runtime
  runtime: {
    memoryUsage: '50mb',
    cpuUsage: '30%'
  }
};
```

#### Performance Testing
```bash
# Lighthouse audit
npm run perf:lighthouse        # Audit completo do Lighthouse

# Bundle analyzer
npm run perf:bundle            # Análise detalhada do bundle

# Memory profiling
npm run perf:memory            # Profiling de memória

# CPU profiling
npm run perf:cpu               # Profiling de CPU
```
```

### 9. Checklist de Qualidade Avançado

```markdown
## ✅ Checklist de Qualidade Avançado

### 🔍 Checklist Pré-Commit

#### Código e Estrutura
- [ ] **Linting**: `npm run lint` passa sem erros
- [ ] **Formatação**: Código formatado consistentemente
- [ ] **Type Safety**: Type checking passa (TypeScript/Flow)
- [ ] **Nomenclatura**: Nomes descritivos e consistentes
- [ ] **Responsabilidade Única**: Funções/classes com responsabilidade única
- [ ] **DRY**: Sem duplicação desnecessária de código
- [ ] **Complexidade**: Complexidade ciclomática < 10 por função

#### Testes e Qualidade
- [ ] **Testes Unitários**: Cobertura > 80% para código crítico
- [ ] **Testes de Integração**: Fluxos principais testados
- [ ] **Testes E2E**: Cenários críticos cobertos
- [ ] **Performance**: Sem regressões de performance
- [ ] **Memory Leaks**: Sem vazamentos de memória
- [ ] **Error Handling**: Tratamento adequado de erros

#### Segurança
- [ ] **Input Validation**: Validação de todas as entradas
- [ ] **Output Sanitization**: Sanitização de saídas
- [ ] **Authentication**: Autenticação implementada corretamente
- [ ] **Authorization**: Autorização verificada
- [ ] **HTTPS**: Comunicação segura
- [ ] **Dependencies**: Dependências sem vulnerabilidades conhecidas

#### Documentação
- [ ] **README**: Atualizado com mudanças
- [ ] **CHANGELOG**: Entrada adicionada em [Unreleased]
- [ ] **API Docs**: Documentação de API atualizada
- [ ] **Code Comments**: Código complexo comentado
- [ ] **JSDoc**: Funções públicas documentadas

### 🎯 Critérios de Aceitação

#### Performance
- ✅ **Bundle Size**: < 1MB total, < 250KB por chunk
- ✅ **Load Time**: First Contentful Paint < 1.5s
- ✅ **Runtime**: Memory usage < 50MB
- ✅ **Lighthouse Score**: > 90 em todas as métricas

#### Acessibilidade
- ✅ **WCAG 2.1**: Conformidade nível AA
- ✅ **Keyboard Navigation**: Totalmente navegável por teclado
- ✅ **Screen Readers**: Compatível com leitores de tela
- ✅ **Color Contrast**: Contraste adequado (4.5:1)

#### Compatibilidade
- ✅ **Browsers**: Suporte aos browsers definidos
- ✅ **Mobile**: Responsivo em dispositivos móveis
- ✅ **Offline**: Funcionalidade offline quando aplicável
- ✅ **Progressive Enhancement**: Degradação graciosa

#### Manutenibilidade
- ✅ **Code Complexity**: Baixa complexidade ciclomática
- ✅ **Technical Debt**: Débito técnico controlado
- ✅ **Dependencies**: Dependências atualizadas
- ✅ **Architecture**: Arquitetura escalável

### 🚨 Validações Obrigatórias

#### Antes de Cada Commit
```bash
# 1. Validações de código
npm run lint                   # Linting
npm run type-check            # Type checking
npm run format:check          # Formatação

# 2. Testes
npm run test                  # Testes unitários
npm run test:integration      # Testes de integração

# 3. Build
npm run build                 # Build de produção

# 4. Segurança
npm audit                     # Audit de dependências
npm run security:scan         # Security scanning

# 5. Performance
npm run perf:audit            # Performance audit
```

#### Antes de Release
```bash
# 1. Validações completas
npm run validate:all          # Todas as validações

# 2. Testes completos
npm run test:all              # Todos os tipos de teste
npm run test:e2e              # Testes end-to-end

# 3. Build e deploy
npm run build:prod            # Build de produção
npm run deploy:staging        # Deploy para staging

# 4. Smoke tests
npm run test:smoke            # Testes de fumaça

# 5. Performance
npm run perf:full             # Auditoria completa de performance
```

### 📊 Métricas de Qualidade

#### Code Quality Metrics
- **Maintainability Index**: > 70
- **Cyclomatic Complexity**: < 10 por função
- **Code Duplication**: < 3% do codebase
- **Test Coverage**: > 80% para código crítico
- **Technical Debt Ratio**: < 5%

#### Performance Metrics
- **Bundle Size**: < 1MB total
- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Time to Interactive**: < 3.5s
- **Cumulative Layout Shift**: < 0.1

#### Security Metrics
- **Vulnerability Count**: 0 high/critical
- **Dependency Freshness**: < 6 meses
- **Security Score**: > 90
- **OWASP Compliance**: 100%

### 🔄 Processo de Review

#### Code Review Checklist
- [ ] **Funcionalidade**: Código faz o que deveria fazer
- [ ] **Performance**: Sem impacto negativo na performance
- [ ] **Segurança**: Sem vulnerabilidades introduzidas
- [ ] **Testabilidade**: Código facilmente testável
- [ ] **Manutenibilidade**: Código fácil de manter
- [ ] **Documentação**: Adequadamente documentado
- [ ] **Padrões**: Segue padrões do projeto

#### Automated Checks
- [ ] **CI Pipeline**: Todos os checks passando
- [ ] **Linting**: Sem violações de linting
- [ ] **Tests**: Todos os testes passando
- [ ] **Coverage**: Cobertura mantida ou melhorada
- [ ] **Security**: Sem vulnerabilidades detectadas
- [ ] **Performance**: Sem regressões de performance
```

### 9. Avisos Críticos

```markdown
## 🚨 Avisos Críticos e Práticas Proibidas

### ⚠️ NUNCA FAÇA

#### [Categoria de risco 1]
- ❌ **NUNCA** [ação proibida 1]
- ❌ **NUNCA** [ação proibida 2]

#### [Categoria de risco 2]
- ❌ **NUNCA** [ação proibida 3]
- �� **NUNCA** [ação proibida 4]

### 🔒 Práticas de Segurança Obrigatórias

#### [Aspecto de segurança 1]
```[linguagem]
// ✅ [Prática segura]
[exemplo]
```

### 🎯 Boas Práticas Obrigatórias

#### [Prática 1]
```[linguagem]
// ✅ [Implementação correta]
[exemplo]
```
```

### 10. Resumo Executivo

```markdown
## 📋 Resumo Executivo

### Para Cada Tarefa de IA

#### 1. Preparação (OBRIGATÓRIO)
- ✅ **[Ação 1]**: [Descrição]
- ✅ **[Ação 2]**: [Descrição]

#### 2. Análise (OBRIGATÓRIO)
- ✅ **[Ação 3]**: [Descrição]
- ✅ **[Ação 4]**: [Descrição]

### Comandos Essenciais

#### [Situação 1]
```bash
# [Descrição]
[comandos]
```

### Arquivos Críticos para Monitorar

#### [Categoria 1]
- `[arquivo1]` ↔ `[arquivo2]` - [Relação]

#### [Categoria 2]
- `[arquivo3]` - [Cuidados]

### Checklist Rápido

#### ✅ [Fase 1]
- [ ] [Item 1]
- [ ] [Item 2]

#### ✅ [Fase 2]
- [ ] [Item 3]
- [ ] [Item 4]
```

---

## 🎯 Diretrizes de Personalização

### 1. Adaptação por Tipo de Projeto

#### Extensões de Navegador
- Enfatizar Manifest V3, compatibilidade cross-browser
- Incluir seções sobre permissions, content scripts, background scripts
- Destacar validações de segurança e CSP

#### Aplicações Web
- Focar em frameworks (React, Vue, Angular)
- Incluir build tools, bundlers, deployment
- Destacar performance, SEO, acessibilidade

#### APIs/Backend
- Enfatizar arquitetura de APIs, middlewares
- Incluir database migrations, testing
- Destacar segurança, rate limiting, monitoring

#### Bibliotecas/Packages
- Focar em versionamento semântico, breaking changes
- Incluir documentation, examples, testing
- Destacar backward compatibility, API design

### 2. Elementos Obrigatórios

Independente do tipo de projeto, sempre inclua:

- **Identidade clara** do agente e expertise
- **Prioridades absolutas** específicas do projeto
- **Estrutura detalhada** com descrições
- **Fluxo passo-a-passo** para modificações
- **Scripts e comandos** específicos
- **Padrões de código** com exemplos
- **Checklist de qualidade** completo
- **Avisos críticos** e práticas proibidas
- **Resumo executivo** para referência rápida

### 3. Personalização de Linguagem

- Use **terminologia específica** do domínio
- Inclua **jargões técnicos** relevantes
- Adapte **exemplos de código** para a stack
- Personalize **comandos e scripts** para o projeto
- Ajuste **métricas de qualidade** para o contexto

### 4. Nível de Detalhe

- **Projetos complexos**: Mais seções, sub-categorias detalhadas
- **Projetos simples**: Estrutura enxuta, foco no essencial
- **Projetos críticos**: Mais validações, checklists extensos
- **Projetos experimentais**: Mais flexibilidade, menos restrições

---

## 📝 Template de Prompt para Uso

```markdown
Crie um arquivo `agents.md` completo para o seguinte projeto:

**Informações do Projeto:**
- **Nome**: [Nome do projeto]
- **Tipo**: [Tipo de projeto]
- **Stack Principal**: [Tecnologias principais]
- **Linguagem**: [Linguagem principal]
- **Framework**: [Framework principal, se aplicável]
- **Arquitetura**: [Padrão arquitetural]
- **Build System**: [Sistema de build]
- **Deployment**: [Como é feito deploy]
- **Testes**: [Framework de testes]
- **Linting**: [Ferramentas de qualidade]
- **Versionamento**: [Estratégia de versão]
- **Considerações Especiais**: [Segurança, performance, etc.]

**Estrutura de Pastas:**
```
[Fornecer estrutura atual do projeto]
```

**Scripts NPM/Yarn Existentes:**
```json
{
  "scripts": {
    [Listar scripts existentes]
  }
}
```

**Dependências Críticas:**
- [Listar dependências importantes]

**Fluxo de Desenvolvimento Atual:**
- [Descrever como o time trabalha atualmente]

**Problemas Conhecidos:**
- [Listar problemas comuns ou pontos de atenção]

Use a estrutura fornecida no prompt e adapte completamente para este projeto específico. O arquivo deve ser prático, detalhado e servir como guia definitivo para agentes de IA trabalhando neste projeto.
```

---

## 🎯 Resultado Esperado

O arquivo `agents.md` gerado deve ser:

- **Específico** para o projeto e stack tecnológico
- **Completo** com todas as seções necessárias
- **Prático** com exemplos reais de código e comandos
- **Atualizado** com as práticas atuais do projeto
- **Claro** para agentes de IA seguirem sem ambiguidade
- **Mantível** para evolução junto com o projeto

O agente que usar este arquivo deve conseguir:
- Entender rapidamente a arquitetura e padrões
- Implementar mudanças seguindo as convenções
- Validar e testar modificações adequadamente
- Documentar e versionar corretamente
- Evitar problemas comuns e anti-padrões

---

**Este prompt deve ser usado sempre que um novo projeto precisar de orientação para agentes de IA, garantindo consistência e qualidade no desenvolvimento.**