# Softruck API v5 (somente leitura)

A Edge Function `softruck-v5-api` atua como proxy autenticado para consultas GET à API oficial da Softruck.

## Recursos liberados

- `resource=vehicles`: frota, placas e atributos dos veículos (inclui relações de dispositivos e usuários quando retornadas pela API).
- `resource=devices`: dispositivos/rastreadores e identificadores retornados pela API.
- `resource=users`: usuários/titulares retornados pela API.
- `resource=vehicle_devices&id=<vehicle_id>`: dispositivos vinculados a um veículo.
- `resource=vehicle_users&id=<vehicle_id>`: usuários vinculados a um veículo.
- `resource=tracking`: dados de monitoramento disponibilizados pela API.
- `resource=trajectories&from=YYYY-MM-DD&to=YYYY-MM-DD`: trajetórias, com intervalo máximo de 32 dias.

Todas as rotas são chamadas com GET. Nenhuma operação de criação, edição, associação, comando ou exclusão é exposta por este proxy.

## Secret necessário

Cadastre `SOFTRUCK_V5_API_TOKEN` nos secrets das Edge Functions do projeto Supabase. Gere o token na plataforma Softruck em **Empresas → empresa da Mov Sat → API → criar token**. Não coloque o token no frontend, no GitHub ou nesta documentação.

## Chamada

`GET /functions/v1/softruck-v5-api?resource=vehicles&page=1&limit=100`

Enviar o access token da sessão Supabase no header `Authorization: Bearer <supabase_access_token>`.

- Requer sessão Supabase válida e perfil `administrador` ou `diretoria`.
- A consulta é somente leitura e mantém o token Softruck no servidor.
- A API usa o parâmetro `q` com os filtros/paginação codificados em Base64.
- O formato exato dos campos retornados depende dos dados disponíveis na conta Softruck; a tela deve tratar campos ausentes como não informados, nunca como vínculo inexistente.
