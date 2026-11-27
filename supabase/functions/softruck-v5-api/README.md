# Softruck API v2 (somente leitura)

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

Cadastre `SOFTRUCK_API_TOKEN` nos secrets das Edge Functions do projeto Supabase. O código mantém compatibilidade com o nome antigo `SOFTRUCK_V5_API_TOKEN`. Gere o token na plataforma Softruck em **Empresas → empresa da Mov Sat → API → criar token**. Configure opcionalmente `SOFTRUCK_API_BASE_URL`; a documentação fornecida da API v2 confirma `https://api.softruck.com/v2` como Base URL. Se não for configurada, o proxy usa essa URL. A API v2 também documenta o header `public-key`; se a conta exigir esse header, configure `SOFTRUCK_API_PUBLIC_KEY` no Supabase. Não coloque o token ou a chave no frontend, no GitHub ou nesta documentação. Não coloque o token no frontend, no GitHub ou nesta documentação.

## Chamada

`GET /functions/v1/softruck-v5-api?resource=vehicles&page=1&limit=100`

Enviar o access token da sessão Supabase no header `Authorization: Bearer <supabase_access_token>`.

- Requer sessão Supabase válida e perfil `administrador` ou `diretoria`.
- A consulta é somente leitura e mantém o token Softruck no servidor.
- A API v2 usa os parâmetros de consulta documentados (`attributes`, `includes`, `filters`, `limit`, `page` etc.). A base da API é configurável por `SOFTRUCK_API_BASE_URL`, com fallback para a URL de produção documentada.
- O formato exato dos campos retornados depende dos dados disponíveis na conta Softruck; a tela deve tratar campos ausentes como não informados, nunca como vínculo inexistente.
