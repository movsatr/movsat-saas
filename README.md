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

## Consulta de rastreadores Mutual Tech

A tela **Associados** oferece uma consulta somente leitura para `administrador` e `diretoria`. O token Atlas e o `supplier_id` usado pelo endpoint de integração geral devem ser configurados como secrets da Edge Function `atlas-api`:

Configure `ATLAS_API_TOKEN` e `ATLAS_INTEGRATION_SUPPLIER_ID` em **Supabase Dashboard → Edge Functions → Secrets**. Alternativamente, use o CLI autenticado com valores mantidos localmente; nunca coloque os valores reais neste arquivo.

Não configure esses valores como variáveis `VITE_*`, não os inclua em commits ou chamados de suporte e não use payloads reais em logs.

A consulta percorre todas as páginas de `/integrations/contract_objects/` e, para cada contrato retornado, percorre `/contract/contract_object_product/` e `/contract/contract_object_vehicle/`. O vínculo é feito por IDs de objeto, contrato, produto, veículo e pessoa; a placa não é usada como chave. Um resultado só é mostrado quando o vínculo de produto retorna `activated: true`, o objeto e o contrato retornam status `ATIVO`, e o catálogo apresenta `rastreador`, `rastreamento`, `tracker` ou `tracking` no nome/descrição/código do subproduto. Falhas de página, contagem incompleta ou divergência nos IDs invalidam a consulta inteira.

O endpoint `/softruck/contract_objects/` é documentado como exclusivo para a Softruck e não declara campos de ativação de produto; por isso não é usado para afirmar que um rastreador está ativo. A documentação OpenAPI pública confirma os campos consultados, mas não confirma os valores de catálogo, o `supplier_id` ou a regra comercial da conta MovSat. Antes de usar o resultado operacionalmente, a Mutual Tech ainda deve validar esses dados com uma resposta autenticada sanitizada. Os IDs 283 e 0013 não são fixados.

A comparação com cadastros locais é apenas informativa: usa igualdade exata entre `vehicle_external_id` e `veiculos.id_externo`, sinaliza ausências/duplicidades e mostra o rastreador local associado. Não cria, atualiza nem exclui registros. Associados sem correspondência de veículo por ID externo ficam sem vínculo local. Não há integração financeira nesta etapa.
