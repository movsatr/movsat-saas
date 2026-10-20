# Softruck API v5 (somente leitura)

A Edge Function `softruck-v5-api` consulta a rota de trajetórias observada no histórico da plataforma:

`GET https://api.app.softruck.com/api/v5/trajectories?q=...`

## Secret necessário

Cadastre `SOFTRUCK_V5_API_TOKEN` nos secrets das Edge Functions do projeto Supabase. Gere o token na plataforma Softruck em **Empresas → empresa da Mov Sat → API → criar token**. Não coloque o token no frontend, no GitHub ou nesta documentação.

## Chamada

`GET /functions/v1/softruck-v5-api?from=2026-10-01&to=2026-10-31&page=1&limit=20`

Enviar o access token da sessão Supabase no header `Authorization: Bearer <supabase_access_token>`.

- Somente GET; não envia comandos nem altera dados na Softruck.
- Requer sessão Supabase válida e perfil `administrador` ou `diretoria`.
- O filtro de período reproduz o formato capturado no DevTools: `filters[acc][btw]`.
- Retorna o JSON original da API para validar os campos de distância antes de automatizar a quilometragem.
- A rota ainda precisa ser testada no ambiente Supabase com um token de API válido; o código no GitHub não configura secrets nem faz deploy por si só.
