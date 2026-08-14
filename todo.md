# CocrIA — Plataforma de Autoria de Cursos com IA

## Funcionalidades Principais

### Módulos de Assistentes
- [ ] Módulo CocrIA Planejamento: fluxo interativo por etapas (tema, problema, objetivos, público-alvo, metodologia, conteúdo programático)
- [ ] Módulo CocrIA Pesquisa de Fontes: pesquisa bibliográfica estruturada por tópico com relatório de referências
- [ ] Módulo CocrIA Produção de Conteúdo: geração de material didático tópico a tópico (bloqueado até validação de fontes)
- [ ] Módulo CocrIA Recursos Adicionais: camada modular para roteiros de vídeo, atividades, podcasts, mapas mentais, infográficos

### Fluxo de Validação
- [ ] Sistema de status de projeto (rascunho, aguardando validação, validado, em produção)
- [ ] Bloqueio de avanço entre módulos até aprovação explícita
- [ ] Interface de validação para responsáveis em cada etapa
- [ ] Histórico de alterações e versões de cada projeto

### Gerenciamento de Insumos
- [ ] Upload de proposta de ação educacional (PDF/Google Docs)
- [ ] Armazenamento de Manual GEPED como referência fixa
- [ ] Suporte a upload de materiais de referência e documentação
- [ ] Integração com Google Drive para compartilhamento de documentos

### Interface de Chat com IA
- [ ] Tela de conversa por módulo com histórico de mensagens
- [ ] Renderização de markdown nas respostas
- [ ] Suporte a respostas em streaming do LLM
- [ ] Persistência de histórico de interações

### Controle de Acesso
- [ ] Perfil Conteudista: acesso aos fluxos de criação
- [ ] Perfil Coordenação: acesso aos fluxos + edição de parâmetros e prompts
- [ ] Perfil Admin GEX-IA: configuração técnica completa
- [ ] Autenticação via Google Workspace institucional

### Painel Administrativo de Prompts
- [ ] Visualização de prompts de sistema de cada assistente
- [ ] Edição autônoma de prompts pela Coordenação
- [ ] Histórico de versões de prompts
- [ ] Validação de prompts antes de aplicação

### Interface Visual
- [ ] Design elegante, refinado e sofisticado
- [ ] Componentes visuais impecáveis em todos os detalhes
- [ ] Transmissão de credibilidade e cuidado
- [ ] Responsividade e acessibilidade

## Arquitetura Técnica

### Banco de Dados
- [ ] Tabela de usuários com perfis (conteudista, coordenação, admin)
- [ ] Tabela de projetos com status e metadados
- [ ] Tabela de etapas de planejamento (plano pedagógico, matriz instrucional)
- [ ] Tabela de pesquisa de fontes com relatórios
- [ ] Tabela de conteúdo produzido por tópico
- [ ] Tabela de recursos adicionais (roteiros, atividades, etc)
- [ ] Tabela de histórico de validações
- [ ] Tabela de prompts de sistema com versionamento
- [ ] Tabela de histórico de chat/interações com IA

### Backend (tRPC + Express)
- [ ] Procedimentos para gerenciamento de projetos
- [ ] Procedimentos para fluxo de planejamento
- [ ] Procedimentos para pesquisa de fontes
- [ ] Procedimentos para produção de conteúdo
- [ ] Procedimentos para recursos adicionais
- [ ] Procedimentos para validação de etapas
- [ ] Procedimentos para gerenciamento de prompts
- [ ] Integração com LLM para assistentes de IA
- [ ] Endpoints para upload de arquivos

### Frontend (React + Tailwind)
- [ ] Layout base com navegação por perfil
- [ ] Dashboard principal com lista de projetos
- [ ] Página de criação de novo projeto
- [ ] Interface de chat para cada módulo
- [ ] Painel de validação para responsáveis
- [ ] Painel administrativo de prompts
- [ ] Página de configurações de usuário

## Requisitos Técnicos

### Restrições de Negócio
- [ ] Produção de Conteúdo bloqueada até validação de Pesquisa de Fontes
- [ ] Recursos Adicionais bloqueados até conclusão de Produção de Conteúdo
- [ ] Nenhum avanço sem aprovação explícita do responsável
- [ ] Respeito rigoroso às regras do Manual GEPED
- [ ] Prompts editáveis pela Coordenação sem intervenção técnica

### Integração com IA
- [ ] Chamadas ao LLM para cada assistente
- [ ] Streaming de respostas
- [ ] Persistência de histórico de chat
- [ ] Suporte a contexto de conversas anteriores

### Armazenamento
- [ ] Upload e armazenamento de PDFs/Docs
- [ ] Integração com Google Drive (opcional)
- [ ] Armazenamento de arquivos gerados (apostilas, roteiros, etc)

## Fases de Desenvolvimento

### Fase 1: Arquitetura e Banco de Dados
- [x] Inicializar projeto web com scaffold
- [ ] Definir schema do banco de dados
- [ ] Criar migrações SQL

### Fase 2: Autenticação e Controle de Acesso
- [ ] Implementar autenticação via Manus OAuth
- [ ] Criar sistema de perfis (conteudista, coordenação, admin)
- [ ] Proteger rotas por perfil

### Fase 3: Layout Base e Navegação
- [ ] Criar layout base com sidebar/navegação
- [ ] Implementar dashboard principal
- [ ] Criar páginas de cada módulo

### Fase 4: Módulo Planejamento
- [ ] Implementar fluxo interativo de perguntas
- [ ] Integrar com LLM
- [ ] Criar interface de chat
- [ ] Implementar validação

### Fase 5: Módulo Pesquisa de Fontes
- [ ] Implementar pesquisa bibliográfica
- [ ] Gerar relatório estruturado
- [ ] Criar interface de validação

### Fase 6: Módulo Produção de Conteúdo
- [ ] Implementar geração de conteúdo por tópico
- [ ] Validar regras do Manual GEPED
- [ ] Criar bloqueio até validação de fontes

### Fase 7: Módulo Recursos Adicionais
- [ ] Implementar geração de roteiros de vídeo
- [ ] Implementar geração de atividades avaliativas
- [ ] Implementar geração de podcasts
- [ ] Implementar geração de mapas mentais
- [ ] Implementar geração de infográficos

### Fase 8: Painel Administrativo de Prompts
- [ ] Criar interface de visualização de prompts
- [ ] Implementar edição de prompts
- [ ] Criar versionamento de prompts
- [ ] Implementar validação de prompts

### Fase 9: Refinamento e Entrega
- [ ] Testes de funcionalidade
- [ ] Refinamento visual
- [ ] Otimizações de performance
- [ ] Documentação
