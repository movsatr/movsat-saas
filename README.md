# movsat-saas

Sistema operacional para gestão da operação de rastreamento veicular.

## Stack

- **Frontend:** Vite + React 18 + TypeScript + Tailwind CSS
- **Backend:** Supabase (Postgres, Auth, RLS, Edge Functions)
- **Ícones:** lucide-react

## Módulos

Dashboard, Associados, Rastreadores, Veículos, Ordens de Serviço, Prestadores, Estoque, Financeiro, Base Técnica, Inteligência, Automação, Tarefas e Administração.

## Perfis

Operador, Supervisor, Diretoria e Administrador — com matriz de permissões aplicada no frontend e via RLS no banco.

## Integração Mutual Tech / Softruck

A tela **Associados** está sendo preparada para consultar, em modo somente leitura, a rota `/softruck/contract_objects/` da API Atlas v2. Essa rota não exige `supplier_id` no proxy atual e usa o secret `ATLAS_API_TOKEN` da Edge Function `atlas-api`.

O token permanece exclusivamente no backend. Não configurar o token em variáveis `VITE_*`, commits ou logs. O proxy exige uma sessão Supabase válida e perfil `administrador` ou `diretoria`.

A primeira execução percorre todas as páginas e registra apenas a quantidade de objetos e os nomes dos campos retornados, sem exibir dados pessoais nem classificar os objetos como rastreadores ativos. A regra de elegibilidade só será implementada depois de validar a resposta autenticada real e confirmar quais campos indicam vínculo e ativação. Nenhum dado local é criado, atualizado ou excluído nesta etapa.

A rota geral `/integrations/contract_objects/` continua separada: ela exige `supplier_id` e não deve ser usada enquanto a MovSat não tiver esse identificador confirmado pela Mutual Tech. Integração financeira e operações de escrita permanecem fora do escopo.
