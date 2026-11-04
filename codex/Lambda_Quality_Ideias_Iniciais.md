# Lambda Quality --- Ideias Iniciais

> Documento vivo de concepção do produto.\
> **Status:** Ideação / planejamento

> Direção técnica revisada em 30/09/2026: TypeScript com Node.js 24 e
> MySQL 8 (baseline 8.4 LTS). Este documento contém ideias futuras;
> escopo e contratos executáveis seguem os demais documentos de `codex/`.

## 1. Visão

O **Lambda Quality** será uma plataforma de **Quality Management + Test
Management**, inicialmente para uso interno, mas concebida desde o
início como **multi-tenant**, permitindo futura oferta como SaaS.

A intenção não é criar apenas um clone do Qase, mas aproveitar conceitos
eficientes de ferramentas de Test Management e combiná-los com
**governança, maturidade, rastreabilidade e integração com automação**.

## 2. Princípios

-   Multi-tenant desde a primeira versão.
-   Workspace como fronteira do tenant.
-   Projetos isolados dentro do Workspace.
-   RBAC por Workspace e Projeto.
-   Evidências e histórico auditáveis.
-   Integração, em vez de substituição, com Azure DevOps, Jenkins,
    Playwright, Supertest, JMeter e Allure.
-   Mecanismo de governança genérico, capaz de representar TMMi, ISO e
    frameworks internos.

``` text
Lambda Quality
├── Workspace: Lambda Team
│   ├── Users / Groups / Roles
│   └── Projects
├── Workspace: Cliente A
└── Workspace: Cliente B
```

## 3. Workspace

``` text
WORKSPACE
├── Dashboard
├── Projects
├── Users
├── Invitations
├── Groups
├── Roles
├── Attachments
├── Governance
└── Settings
```

Recursos iniciais: usuários, convites, grupos, roles/permissões, anexos,
configurações e auditoria. Futuramente: licenciamento, planos e limites
de uso.

## 4. Projetos

Visão resumida:

  Projeto            Casos   Suítes   Runs ativos   Defeitos   Membros
  ---------------- ------- -------- ------------- ---------- ---------
  Portal Cliente       367       92             4          3         5
  Admin                524      118             2          0         4
  LambdaHub             184       34             1          2         3

``` text
PROJECT
├── Tests
│   ├── Repository
│   └── Traceability
├── Execution
│   ├── Test Plans
│   ├── Test Runs
│   └── Configurations
├── Issues
│   ├── Defects
│   └── Requirements
└── Management
    ├── Milestones
    ├── Members
    └── Settings
```

## 5. Repository

Suítes deverão ser hierárquicas e recursivas.

``` text
Portal Cliente
├── Cadastro
│   └── Dados pessoais
│       ├── LQ-141 — Validar CPF inválido
│       ├── LQ-142 — Validar nome inválido
│       └── LQ-143 — Validar data de nascimento
├── Login
│   ├── Autenticação
│   └── Recuperação de senha
└── Área do Cliente
    ├── Home
    └── Perfil
```

Modelo conceitual:

``` text
TestSuite
- id
- workspace_id
- project_id
- parent_suite_id
- name
- description
- position
```

## 6. Casos de Teste

Cada caso poderá possuir:

-   título, descrição, pré e pós-condições;
-   Suite, Severity, Priority, Status, Behavior, Type e Layer;
-   Tags;
-   Automation Status;
-   Milestone;
-   anexos;
-   comentários;
-   histórico;
-   vínculo com Runs e Defects.

``` text
LQ-141 — Validar tentativa de cadastro com CPF inválido

General | Properties | Runs | History | Defects | Comments
```

Steps:

  \#   Ação               Dados   Resultado esperado
  ---- ------------------ ------- ------------------------
  1    Acessar cadastro   ---     Tela apresentada
  2    Informar CPF       `123`   Campo preenchido
  3    Cadastrar          ---     CPF inválido informado

## 7. Automação

``` text
Automation Status
○ Manual
○ To be automated
○ In progress
○ Automated
○ Not applicable
```

Isso permitirá medir cobertura geral, por projeto, suíte, criticidade e
camada.

``` text
Portal Cliente    ███████████████░░░░░ 78%
Admin             ██████████░░░░░░░░░░ 51%
LambdaHub          ██████░░░░░░░░░░░░░░ 31%
```

## 8. Test Plans e Test Runs

O **Test Plan** representa o que se pretende testar; o **Test Run**, uma
execução concreta.

``` text
Regression — Release 2026.10
Environment: HML
Milestone: Release 2026.10

☑ Login
☑ Cadastro
☑ Clientes
☑ Servidores
Total: 187 casos
```

``` text
RUN #LQ-RUN-000124
Progress: 127 / 187

Passed       103
Failed        14
Blocked        4
Skipped        6
Not tested    60
```

Resultados devem ser versionados por execução:

``` text
TestCase
   └── TestRun
       └── TestRunCase
           └── TestRunStep
```

## 9. Integração com pipelines

``` text
Azure DevOps / Jenkins
          │
          ├── Playwright
          ├── Supertest
          └── JMeter
                │
                ▼
         Lambda Quality API
                │
                ▼
             Test Run
```

Uma execução automatizada poderá armazenar resultado, duração,
screenshots, vídeos, logs, stack trace, Allure, pipeline, branch, commit
e ambiente.

## 10. Defects e rastreabilidade

Inicialmente, o Lambda Quality pode manter o vínculo com Azure
DevOps/Jira sem tentar substituí-los.

``` text
Test Case
   ↓
Test Run
   ↓
Failure
   ↓
Defect
   ↓
Azure DevOps Work Item
```

Requirements também poderão ser vinculados:

``` text
Requirement
    ↓
Test Cases
    ↓
Test Runs
    ↓
Defects
```

Uma **Traceability Matrix** poderá apresentar requisito, quantidade de
testes, executados, aprovados, falhos e cobertura.

# 11. Governança de Qualidade

Este módulo poderá ser um dos principais diferenciais do Lambda Quality.

``` text
Governance
├── Governance Goals
├── Frameworks
├── Assessments
├── Evidence
├── Action Plans
└── Reports
```

O mecanismo deverá ser genérico para permitir TMMi, ISO/IEC 29119,
políticas internas e outros modelos.

``` text
GovernanceFramework
└── Sections
    └── Controls
        ├── Checklist
        ├── Evidence
        └── Assessment
```

## 12. Exemplo de acompanhamento TMMi

``` text
TMMi — Nível 2
████████████████░░░░ 81%

Test Policy and Strategy       92%
Test Planning                  85%
Test Monitoring and Control    74%
Test Design and Execution      81%
Test Environment               68%
```

Ao entrar em uma área:

``` text
TMMi > Level 2 > Test Planning

☑ Processo de planejamento definido
☑ Critérios de entrada definidos
☑ Critérios de saída definidos
☑ Riscos identificados
☑ Estratégia documentada
☐ Revisão formal pendente
☐ Evidência de aprovação pendente
```

Os itens acima são exemplos de interface; os controles reais deverão
refletir a documentação oficial aplicável.

## 13. Controles e evidências

Cada controle poderá conter:

``` text
Controle: TP-2.4
Status: Atendido
Responsável: Quality Engineering
Aplicabilidade: Organizacional

Evidências
📎 Politica_Testes_v2.pdf
🔗 Wiki — Estratégia de Testes
🔗 Portal Cliente / Test Plan #283

Última avaliação: 22/09/2026
Próxima revisão: 22/12/2026
```

Status:

  Status          Significado
  --------------- ----------------------------
  Não avaliado    Ainda não analisado
  Não atendido    Processo inexistente
  Parcial         Implementação parcial
  Atendido        Implementado e evidenciado
  Não aplicável   N/A justificado

## 14. Índice interno de atendimento

Exemplo de cálculo configurável:

``` text
Não atendido = 0
Parcial      = 0,5
Atendido     = 1
N/A          = excluído

Aplicáveis: 52
Atendidos: 38
Parciais: 8
Não atendidos: 6

Índice = (38 + 8 × 0,5) / 52 = 80,77%
```

Esse número deve ser tratado como **indicador interno**, não
automaticamente como percentual oficial de conformidade ou certificação.

## 15. Metas de Governança

``` text
META: TMMi Level 2
Responsável: Quality Engineering

Atual  ████████████████░░░░ 81%
Meta   ████████████████████ 100%

Prazo: 31/12/2026
Status: Em andamento
```

Também poderão existir metas calculadas automaticamente:

-   cobertura de automação \>= 80%;
-   testes Critical automatizados \>= 95%;
-   requisitos com testes \>= 90%;
-   regressão executada = 100%;
-   defeitos críticos abertos = 0;
-   testes sem revisão há mais de 180 dias \< 5%;
-   flaky tests \< 2%.

## 16. Dashboard de Governança

``` text
┌──────────────────────────────────────────┐
│          GOVERNANCE DASHBOARD            │
├──────────────────────────────────────────┤
│ Overall Governance Score        82%      │
│             ████████████████░░░          │
├──────────────────────────────────────────┤
│ FRAMEWORKS                               │
│ TMMi Level 2                    81%       │
│ ISO/IEC 29119                   74%       │
│ QA Internal Policy              92%       │
├──────────────────────────────────────────┤
│ GOALS                                    │
│ Automation Critical          87% / 90%   │
│ Requirements Coverage       91% / 90% ✓  │
│ Regression Coverage         96% / 100%   │
├──────────────────────────────────────────┤
│ ATTENTION                                │
│ 6 controles não atendidos                │
│ 8 controles parcialmente atendidos       │
│ 3 evidências próximas da revisão         │
│ 2 metas próximas do prazo                │
└──────────────────────────────────────────┘
```

## 17. Framework interno

Poderá existir, por exemplo, um **Lambda Team Quality Standard**:

``` text
☑ Estratégia de testes definida
☑ Responsável por QA definido
☑ PR exige aprovação
☑ develop possui branch protection
☑ master possui branch protection
☑ Pipeline executa testes
☑ Automação publica resultados
☑ Evidências são armazenadas
☑ Bugs críticos impedem release
☑ Testes críticos possuem automação
☐ Performance antes da release
☐ SAST integrado à pipeline
```

Isso permitirá comparar projetos pelo índice interno de atendimento.

# 18. Arquitetura funcional consolidada

``` text
                         LAMBDA QUALITY
                               │
             ┌─────────────────┴─────────────────┐
             │                                   │
         WORKSPACE                           GOVERNANCE
             │                                   │
     ┌───────┼────────┐                ┌─────────┼─────────┐
   Users   Groups    Roles          Frameworks  Goals   Evidence
             │                                   │
          Projects                            Assessments
             │
     ┌───────┼────────────┐
 Repository  Execution  Requirements
     │          │             │
 Test Cases  Test Plans       │
     │          │             │
     └────── Test Runs ───────┘
                │
             Defects
                │
        Azure DevOps / Jira
```

# 19. Roadmap revisado — 02/10/2026

Bootstrap e identidade já foram entregues. A sequência solicitada pelo
usuário substitui o roadmap inicial e segue o
[plano técnico de implementação](CODEX_IMPLEMENTATION_PLAN.md):

1. **Workspaces:** membros, convites, roles, permissions, grupos, campos
   personalizados, tags e anexos em uma fase única.
2. **Projetos:** projetos, membros do projeto, milestones e environments.
3. **Casos de Teste:** suites, cases, passos próprios, campos, tags e anexos.
4. **Planos e Execuções:** planos, runs, resultados e snapshots históricos.
5. **Defeitos:** gestão de defeitos, vínculos com falhas e anexos.
6. **Governança:** frameworks, controles, avaliações, evidências, metas e ações.

Shared parameters e Shared steps foram excluídos do escopo. Os passos
próprios de cada caso de teste continuam previstos.

Requisitos/rastreabilidade, API de automação, Azure DevOps/Jenkins, formatos
de resultado, dashboards/relatórios e evoluções SaaS permanecem como ideias
de backlog, sem fase definida nesta sequência. Não implementar essas ideias
automaticamente dentro das seis fases. A auditoria acompanha cada módulo.

# 20. Direção técnica inicial

Uma abordagem possível:

``` text
Angular
   │
   ▼
TypeScript / Node.js 24 / NestJS
Monólito Modular
   │
   ├── Identity / Tenant
   ├── Projects
   ├── Test Management
   ├── Execution
   ├── Traceability
   ├── Governance
   ├── Integrations
   └── Audit
   │
   ▼
MySQL 8.4 LTS
```

Começar como **monólito modular** reduz complexidade operacional e ainda
permite separar domínios de forma clara. Se algum módulo exigir escala
ou isolamento independente futuramente, poderá ser extraído
posteriormente.

------------------------------------------------------------------------

## 21. Ideia central

O Lambda Quality poderá evoluir de um simples gerenciador de casos de
teste para uma plataforma que responda simultaneamente:

> **O que precisamos testar?**

> **O que foi testado?**

> **Qual foi o resultado?**

> **Quais requisitos estão cobertos?**

> **Quais problemas foram encontrados?**

> **Quanto da nossa estratégia está automatizada?**

> **Qual é a maturidade do nosso processo de qualidade?**

> **Quais metas de governança ainda não atingimos?**

Essa combinação de **Test Management + Quality Engineering + Quality
Governance** deverá orientar a evolução do produto.
