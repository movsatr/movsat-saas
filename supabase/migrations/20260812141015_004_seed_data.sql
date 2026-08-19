/*
# MovSat OS — Seed Data

## Overview
Populates all business tables with realistic sample data for a vehicle-tracking
company in Vitória da Conquista, BA. Data covers all four cruzamento quadrants.

## Data Inserted
- 15 associados (clients) with varied payment and equipment statuses
- 18 rastreadores (tracking devices) linked to associados
- 5 prestadores (service providers)
- 12 ordens_servico (service orders) in various statuses
- ~20 financeiro records (cobrancas)
- 8 base_tecnica documents
- 10 estoque items
- 10 atividades (activity log entries)
*/

-- === ASSOCIADOS ===
INSERT INTO public.associados (nome, cpf_cnpj, telefone, email, endereco, plano, valor_mensalidade, status_pagamento, status_equipamento, data_cadastro, observacoes) VALUES
('João Mendes Ferreira', '123.456.789-01', '(77) 99988-1001', 'joao.mendes@email.com', 'Rua das Acácias, 120 - Vitória da Conquista', 'Profissional', 89.90, 'em_dia', 'ok', '2024-01-15', 'Cliente desde 2024, sempre em dia'),
('Maria das Dores Santos', '987.654.321-02', '(77) 99988-1002', 'maria.dores@email.com', 'Av. Brasil, 450 - Vitória da Conquista', 'Basico', 49.90, 'em_dia', 'ok', '2024-02-20', NULL),
('Pedro Alves Costa', '456.789.123-03', '(77) 99988-1003', 'pedro.alves@email.com', 'Rua Sete de Setembro, 88 - Vitória da Conquista', 'Premium', 129.90, 'em_dia', 'com_problema', '2024-03-10', 'Equipamento apresentando falha de sinal intermitente'),
('Ana Paula Ribeiro', '321.654.987-04', '(77) 99988-1004', 'ana.ribeiro@email.com', 'Rua Barão do Rio Branco, 230 - Vitória da Conquista', 'Profissional', 89.90, 'atrasado', 'ok', '2024-01-28', 'Pagamento atrasado 15 dias'),
('Carlos Eduardo Lima', '654.321.789-05', '(77) 99988-1005', 'carlos.lima@email.com', 'Av. Maria Quiteria, 67 - Vitória da Conquista', 'Basico', 49.90, 'inadimplente', 'ok', '2023-11-05', 'Inadimplente há 60+ dias, candidato a corte'),
('Fernanda Souza Brito', '789.123.456-06', '(77) 99988-1006', 'fernanda.souza@email.com', 'Rua Caldas Junior, 15 - Vitória da Conquista', 'Premium', 129.90, 'em_dia', 'ok', '2024-04-01', NULL),
('Ricardo Pereira Nunes', '147.258.369-07', '(77) 99988-1007', 'ricardo.nunes@email.com', 'Rua João Moura, 340 - Vitória da Conquista', 'Profissional', 89.90, 'atrasado', 'com_problema', '2024-02-14', 'Atrasado e equipamento com problema - risco duplo'),
('Juliana Maria Silva', '258.369.147-08', '(77) 99988-1008', 'juliana.silva@email.com', 'Av. Floresta, 500 - Vitória da Conquista', 'Basico', 49.90, 'em_dia', 'ok', '2024-05-20', NULL),
('Roberto Carlos Gomes', '369.147.258-09', '(77) 99988-1009', 'roberto.gomes@email.com', 'Rua Candeias, 78 - Vitória da Conquista', 'Profissional', 89.90, 'inadimplente', 'com_problema', '2023-09-12', 'Inadimplente e equipamento com problema'),
('Patricia Almeida Rocha', '741.852.963-10', '(77) 99988-1010', 'patricia.almeida@email.com', 'Rua das Flores, 190 - Vitória da Conquista', 'Premium', 129.90, 'em_dia', 'ok', '2024-06-01', NULL),
('Marcos Vinicius Dias', '852.963.741-11', '(77) 99988-1011', 'marcos.dias@email.com', 'Av. Princesa Isabel, 210 - Vitória da Conquista', 'Basico', 49.90, 'atrasado', 'ok', '2024-03-25', 'Atrasado 10 dias'),
('Sandra Regina Faria', '963.741.852-12', '(77) 99988-1012', 'sandra.faria@email.com', 'Rua Dom Pedro II, 45 - Vitória da Conquista', 'Profissional', 89.90, 'em_dia', 'com_problema', '2024-04-18', 'Equipamento com problema de GPS'),
('Luiz Fernando Carvalho', '159.357.486-13', '(77) 99988-1013', 'luiz.carvalho@email.com', 'Rua Barão de Cotegipe, 300 - Vitória da Conquista', 'Premium', 129.90, 'em_dia', 'ok', '2024-01-08', NULL),
('Camila Rodrigues Aires', '753.951.468-14', '(77) 99988-1014', 'camila.rodrigues@email.com', 'Rua General Osório, 125 - Vitória da Conquista', 'Basico', 49.90, 'inadimplente', 'ok', '2023-08-20', 'Inadimplente há 90 dias'),
('Anderson Souza Prado', '456.789.123-15', '(77) 99988-1015', 'anderson.prado@email.com', 'Rua Coronel Philindo Ribeiro, 90 - Vitória da Conquista', 'Profissional', 89.90, 'em_dia', 'ok', '2024-07-01', 'Cliente novo')
ON CONFLICT DO NOTHING;

-- === RASTREADORES ===
INSERT INTO public.rastreadores (imei, modelo, associado_id, veiculo_placa, veiculo_modelo, veiculo_cor, status, data_instalacao, observacoes)
SELECT r.imei, r.modelo, a.id, r.veiculo_placa, r.veiculo_modelo, r.veiculo_cor, r.status, r.data_instalacao::date, r.observacoes
FROM (VALUES
  ('012345678901234', 'GT06N', 'João Mendes Ferreira', 'ABC1D23', 'Honda CG 160', 'Vermelha', 'ativo', '2024-01-15', NULL),
  ('012345678901235', 'GT06N', 'Maria das Dores Santos', 'DEF2E34', 'Yamaha Factor 150', 'Preta', 'ativo', '2024-02-20', NULL),
  ('012345678901236', 'GT06 PRO', 'Pedro Alves Costa', 'GHI3F45', 'Toyota Corolla', 'Prata', 'com_problema', '2024-03-10', 'Falha intermitente no sinal GPS'),
  ('012345678901237', 'GT06N', 'Ana Paula Ribeiro', 'JKL4G56', 'Honda CG 160', 'Azul', 'ativo', '2024-01-28', NULL),
  ('012345678901238', 'GT06N', 'Carlos Eduardo Lima', 'MNO5H67', 'Yamaha XTZ 150', 'Verde', 'ativo', '2023-11-05', NULL),
  ('012345678901239', 'GT06 PRO', 'Fernanda Souza Brito', 'PQR6I78', 'Jeep Renegade', 'Branca', 'ativo', '2024-04-01', NULL),
  ('012345678901240', 'GT06N', 'Ricardo Pereira Nunes', 'STU7J89', 'Honda Biz 125', 'Preta', 'com_problema', '2024-02-14', 'Antena danificada'),
  ('012345678901241', 'GT06N', 'Juliana Maria Silva', 'VWX8K90', 'Honda CG 150', 'Vermelha', 'ativo', '2024-05-20', NULL),
  ('012345678901242', 'GT06N', 'Roberto Carlos Gomes', 'YZA9L01', 'Yamaha Fazer 250', 'Azul', 'com_problema', '2023-09-12', 'Sem sinal - chip desativado'),
  ('012345678901243', 'GT06 PRO', 'Patricia Almeida Rocha', 'BCD0M12', 'Honda Civic', 'Preta', 'ativo', '2024-06-01', NULL),
  ('012345678901244', 'GT06N', 'Marcos Vinicius Dias', 'EFG1N23', 'Honda CG 160', 'Cinza', 'ativo', '2024-03-25', NULL),
  ('012345678901245', 'GT06N', 'Sandra Regina Faria', 'HIJ2O34', 'Yamaha Factor 150', 'Vermelha', 'com_problema', '2024-04-18', 'GPS com baixa precisão'),
  ('012345678901246', 'GT06 PRO', 'Luiz Fernando Carvalho', 'KLM3P45', 'Toyota Hilux', 'Branca', 'ativo', '2024-01-08', NULL),
  ('012345678901247', 'GT06N', 'Camila Rodrigues Aires', 'NOP4Q56', 'Honda Biz 100', 'Azul', 'ativo', '2023-08-20', NULL),
  ('012345678901248', 'GT06N', 'Anderson Souza Prado', 'QRS5R67', 'Yamaha XTZ 125', 'Preta', 'ativo', '2024-07-01', NULL)
) AS r(imei, modelo, assoc_nome, veiculo_placa, veiculo_modelo, veiculo_cor, status, data_instalacao, observacoes)
JOIN public.associados a ON a.nome = r.assoc_nome
WHERE NOT EXISTS (SELECT 1 FROM public.rastreadores WHERE imei = r.imei);

-- Unlinked rastreadores (in stock / maintenance)
INSERT INTO public.rastreadores (imei, modelo, associado_id, veiculo_placa, veiculo_modelo, veiculo_cor, status, data_instalacao, observacoes)
SELECT r.imei, r.modelo, NULL::uuid, r.veiculo_placa, r.veiculo_modelo, r.veiculo_cor, r.status, NULL::date, r.observacoes
FROM (VALUES
  ('012345678901249', 'GT06N', 'TUV6S78', 'Reserva Estoque', 'N/A', 'inativo', 'Dispositivo em estoque aguardando instalação'),
  ('012345678901250', 'GT06 PRO', 'WXY7T89', 'Reserva Estoque', 'N/A', 'inativo', 'Dispositivo em estoque aguardando instalação'),
  ('012345678901251', 'GT06N', 'ZAB8U90', 'Reserva Estoque', 'N/A', 'manutencao', 'Em manutenção - bateria com defeito')
) AS r(imei, modelo, veiculo_placa, veiculo_modelo, veiculo_cor, status, observacoes)
WHERE NOT EXISTS (SELECT 1 FROM public.rastreadores WHERE imei = r.imei);

-- === PRESTADORES ===
INSERT INTO public.prestadores (nome, especialidade, telefone, email, area_cobertura, status, observacoes) VALUES
('José Martins', 'instalacao', '(77) 98800-1001', 'jose.martins@movsat.com', 'Vitória da Conquista e região', 'ativo', 'Especialista em instalação automotiva'),
('Paulo Henrique', 'manutencao', '(77) 98800-1002', 'paulo.henrique@movsat.com', 'Vitória da Conquista', 'ativo', 'Técnico em eletrônica veicular'),
('Roberto Silva', 'geral', '(77) 98800-1003', 'roberto.silva@movsat.com', 'Vitória da Conquista, Anagé, Belo Campo', 'ativo', NULL),
('Marcos Paulo', 'remocao', '(77) 98800-1004', 'marcos.paulo@movsat.com', 'Vitória da Conquista', 'ativo', 'Especialista em remoção e reinstalação'),
('Felipe Anderson', 'manutencao', '(77) 98800-1005', 'felipe.anderson@movsat.com', 'Vitória da Conquista, Itambé', 'inativo', 'Temporariamente indisponível')
ON CONFLICT DO NOTHING;

-- === ORDENS_SERVICO ===
INSERT INTO public.ordens_servico (numero, associado_id, rastreador_id, prestador_id, tipo, status, prioridade, descricao, solucao, data_abertura, data_conclusao, observacoes)
SELECT os.numero, a.id, r.id, p.id, os.tipo, os.status, os.prioridade, os.descricao, os.solucao, os.data_abertura::date, os.data_conclusao::date, os.observacoes
FROM (VALUES
  ('OS-2025-0001', 'Pedro Alves Costa', '012345678901236', 'Paulo Henrique', 'manutencao', 'em_andamento', 'alta', 'Falha intermitente no sinal GPS do rastreador', NULL, '2025-01-10', NULL, 'Cliente pagante com equipamento com problema - prioridade'),
  ('OS-2025-0002', 'Ricardo Pereira Nunes', '012345678901240', 'Paulo Henrique', 'manutencao', 'aberta', 'urgente', 'Antena danificada, sem sinal', NULL, '2025-01-12', NULL, 'Atrasado e com problema - risco duplo'),
  ('OS-2025-0003', 'Roberto Carlos Gomes', '012345678901242', 'Felipe Anderson', 'manutencao', 'aberta', 'baixa', 'Sem sinal - chip possivelmente desativado', NULL, '2025-01-08', NULL, 'Inadimplente - baixa prioridade comercial'),
  ('OS-2025-0004', 'Sandra Regina Faria', '012345678901245', 'Paulo Henrique', 'manutencao', 'em_andamento', 'normal', 'GPS com baixa precisão', NULL, '2025-01-11', NULL, NULL),
  ('OS-2025-0005', 'Anderson Souza Prado', '012345678901248', 'José Martins', 'instalacao', 'concluida', 'normal', 'Instalação de rastreador em nova moto', 'Instalação concluída com sucesso', '2025-01-05', '2025-01-06', NULL),
  ('OS-2025-0006', 'João Mendes Ferreira', '012345678901234', 'José Martins', 'instalacao', 'concluida', 'normal', 'Instalação inicial', 'Instalação concluída', '2024-01-15', '2024-01-15', NULL),
  ('OS-2025-0007', 'Fernanda Souza Brito', '012345678901239', 'José Martins', 'instalacao', 'concluida', 'normal', 'Instalação em veículo novo', 'Instalação concluída', '2024-04-01', '2024-04-01', NULL),
  ('OS-2025-0008', 'Patricia Almeida Rocha', '012345678901243', 'José Martins', 'instalacao', 'concluida', 'normal', 'Instalação Premium', 'Instalação concluída com adicional de bloqueador', '2024-06-01', '2024-06-01', NULL),
  ('OS-2025-0009', 'Luiz Fernando Carvalho', '012345678901246', 'Marcos Paulo', 'remocao', 'concluida', 'normal', 'Remoção e reinstalação em novo veículo', 'Remoção e reinstalação concluídas', '2024-12-15', '2024-12-16', NULL),
  ('OS-2025-0010', 'Marcos Vinicius Dias', '012345678901244', 'Roberto Silva', 'manutencao', 'concluida', 'normal', 'Revisão preventiva', 'Revisão concluída, tudo OK', '2024-12-20', '2024-12-20', NULL),
  ('OS-2025-0011', 'Camila Rodrigues Aires', '012345678901247', 'Marcos Paulo', 'remocao', 'aberta', 'baixa', 'Solicitação de remoção - cliente inadimplente', NULL, '2025-01-14', NULL, 'Inadimplente - possível corte'),
  ('OS-2025-0012', 'Carlos Eduardo Lima', '012345678901238', 'Marcos Paulo', 'remocao', 'aberta', 'baixa', 'Remoção por inadimplência prolongada', NULL, '2025-01-15', NULL, 'Candidato a corte')
) AS os(numero, assoc_nome, rast_imei, prest_nome, tipo, status, prioridade, descricao, solucao, data_abertura, data_conclusao, observacoes)
JOIN public.associados a ON a.nome = os.assoc_nome
JOIN public.rastreadores r ON r.imei = os.rast_imei
JOIN public.prestadores p ON p.nome = os.prest_nome
WHERE NOT EXISTS (SELECT 1 FROM public.ordens_servico WHERE numero = os.numero);

-- === FINANCEIRO ===
INSERT INTO public.financeiro (associado_id, tipo, descricao, valor, status, data_vencimento, data_pagamento, forma_pagamento, observacoes)
SELECT a.id, 'mensalidade', 'Mensalidade Janeiro 2025', a.valor_mensalidade,
  CASE
    WHEN a.status_pagamento = 'em_dia' THEN 'pago'
    WHEN a.status_pagamento = 'atrasado' THEN 'pendente'
    WHEN a.status_pagamento = 'inadimplente' THEN 'atrasado'
  END,
  '2025-01-10'::date,
  CASE WHEN a.status_pagamento = 'em_dia' THEN '2025-01-08'::date ELSE NULL END,
  CASE WHEN a.status_pagamento = 'em_dia' THEN 'pix' ELSE NULL END,
  NULL
FROM public.associados a
WHERE NOT EXISTS (
  SELECT 1 FROM public.financeiro fin WHERE fin.associado_id = a.id AND fin.descricao = 'Mensalidade Janeiro 2025'
);

INSERT INTO public.financeiro (associado_id, tipo, descricao, valor, status, data_vencimento, data_pagamento, forma_pagamento)
SELECT a.id, 'mensalidade', 'Mensalidade Dezembro 2024', a.valor_mensalidade, 'pago', '2024-12-10'::date, '2024-12-08'::date, 'pix'
FROM public.associados a
WHERE a.status_pagamento = 'em_dia'
AND NOT EXISTS (
  SELECT 1 FROM public.financeiro fin WHERE fin.associado_id = a.id AND fin.descricao = 'Mensalidade Dezembro 2024'
);

-- === BASE_TECNICA ===
INSERT INTO public.base_tecnica (titulo, categoria, conteudo, tags, status) VALUES
('Guia de Instalação GT06N', 'instalacao', 'Passo a passo para instalação do rastreador GT06N em motocicletas:

1. Desconectar a bateria da moto
2. Conectar o fio vermelho ao positivo da bateria (+12V)
3. Conectar o fio preto ao negativo da bateria (GND)
4. Conectar o fio laranja ao relay de corte (opcional)
5. Conectar o fio azul ao botão de SOS (opcional)
6. Posicionar a antena GPS com visada para o céu
7. Conectar o chip SIM no slot indicado
8. Reativar a bateria da moto
9. Verificar LED de status: verde pisca = GPS conectado
10. Testar sinal via plataforma

Importante: Sempre use fita 3M para fixar o rastreador. Evite áreas próximas ao escapamento.', 'gt06n, instalação, moto, passo-a-passo', 'ativo'),
('Configuração de APN para Operadoras', 'configuracao', 'Configurações de APN para diferentes operadoras:

Vivo: APN zap.vivo.com.br (usuario: vivo, senha: vivo)
Claro: APN claro.com.br (usuario: claro, senha: claro)
Tim: APN tim.br (usuario: tim, senha: tim)
Oi: APN gprs.oi.com.br (usuario: oi, senha: oi)

Apos configurar o APN, reinicie o rastreador e aguarde 2-3 minutos para conexao.', 'apn, operadoras, configuração, vivo, claro, tim, oi', 'ativo'),
('Troubleshooting: Rastreador Sem Sinal', 'troubleshooting', 'Quando o rastreador nao envia sinal, siga esta ordem:

1. Verificar alimentacao eletrica (LED aceso? bateria 12V?)
2. Verificar chip SIM (ativado? com credito? APN correta?)
3. Verificar antena GPS (conectada? visada para o céu?)
4. Verificar cobertura (sinal de celular na area?)
5. Reiniciar dispositivo (desconectar e reconectar)
6. Se persistir, abrir OS para manutencao presencial', 'sem sinal, troubleshooting, gps, gprs, diagnóstico', 'ativo'),
('Especificações Técnicas GT06 PRO', 'especificacao', 'Rastreador GT06 PRO:
- Tensao: 9-100V DC
- Bateria interna: 150mAh (backup 4-5h)
- Precisao GPS: 5-10m
- Tempo de fix GPS: 35s (frio), 1s (quente)
- Comunicacao: GPRS/GSM
- Bandas: 850/900/1800/1900 MHz
- Temperatura: -20C a +70C
- Dimensoes: 83 x 54 x 24 mm
- Peso: 90g
- Saida relay: 12V/200mA (corte de ignicao)
- Protocolo: GT06
- Certificacao: ANATEL', 'gt06 pro, especificações, técnico, anatel', 'ativo'),
('Guia de Instalação em Veículos Automóveis', 'instalacao', 'Instalacao de rastreadores em carros:

1. Localizar a bateria do veiculo
2. Desconectar o negativo da bateria
3. Conectar o rastreador diretamente a bateria
4. Passar a antena GPS para o painel ou teto
5. Conectar o relay de corte na bomba de combustivel ou ignicao
6. Esconder todos os fios dentro do painel
7. Fixar o rastreador em local nao visivel
8. Reativar a bateria
9. Testar corte de ignicao via plataforma
10. Verificar precisao do GPS

Atencao: Em veiculos com sistema Start-Stop, use o fio ACC para detectar ignicao.', 'instalação, carro, automóvel, relay, corte', 'ativo'),
('Procedimento de Remoção de Rastreador', 'instalacao', 'Procedimento para remocao de rastreador:

1. Solicitar autorizacao da diretoria (para inadimplentes)
2. Comparecer ao local do veiculo
3. Desconectar a bateria do veiculo
4. Remover todos os fios do rastreador
5. Remover o rastreador e antena
6. Restaurar a fiacao original do veiculo
7. Remover o chip SIM (desativar linha se necessario)
8. Atualizar status do rastreador para inativo no sistema
9. Registrar OS de remocao com fotos
10. Levar o equipamento para o estoque', 'remoção, procedimento, inadimplente', 'ativo'),
('Manual de Configuração da Plataforma', 'manual', 'Configuracao inicial do rastreador na plataforma:

1. Acessar a plataforma de monitoramento
2. Adicionar novo dispositivo usando o IMEI
3. Configurar nome do dispositivo (placa do veiculo)
4. Associar ao cliente no sistema
5. Configurar alertas (movimento, velocidade, bateria, corte, SOS)
6. Configurar cercas eletronicas se plano Premium
7. Testar todos os alertas
8. Treinar o cliente no uso da plataforma

O cliente deve baixar o app e fazer login com as credenciais fornecidas.', 'manual, plataforma, configuração, alertas, geofencing', 'ativo'),
('Checklist de Manutenção Preventiva', 'troubleshooting', 'Checklist para manutencao preventiva trimestral:

[ ] Verificar fixacao do rastreador
[ ] Verificar estado da fiacao
[ ] Testar sinal GPS (precisao e tempo de fix)
[ ] Testar sinal GPRS (conectividade)
[ ] Verificar bateria interna
[ ] Testar relay de corte de ignicao
[ ] Verificar antena GPS (sem danos)
[ ] Verificar chip SIM (ativo, com credito)
[ ] Testar botao de SOS/Panico
[ ] Atualizar firmware se disponivel
[ ] Limpar contatos eletricos
[ ] Verificar infiltracao de agua
[ ] Confirmar alertas na plataforma
[ ] Registrar visita no sistema

Frequencia: a cada 3 meses para frotas ativas.', 'manutenção, preventiva, checklist, trimestral', 'ativo')
ON CONFLICT DO NOTHING;

-- === ESTOQUE ===
INSERT INTO public.estoque (nome, categoria, quantidade, quantidade_minima, preco_unitario, fornecedor, observacoes) VALUES
('Rastreador GT06N', 'rastreador', 8, 5, 120.00, 'Shenzhen Concox', NULL),
('Rastreador GT06 PRO', 'rastreador', 3, 5, 180.00, 'Shenzhen Concox', 'Estoque baixo - abaixo do mínimo'),
('Chip SIM Vivo (M2M)', 'simcard', 15, 10, 15.00, 'Vivo', NULL),
('Chip SIM Claro (M2M)', 'simcard', 12, 10, 15.00, 'Claro', NULL),
('Antena GPS Externa', 'acessorio', 2, 5, 25.00, 'Generico', 'Estoque baixo - abaixo do mínimo'),
('Relay 12V (Corte de Ignição)', 'acessorio', 20, 10, 8.00, 'Generico', NULL),
('Fita 3M Dupla Face', 'acessorio', 5, 3, 12.00, '3M', NULL),
('Fio Preto 16AWG (metro)', 'acessorio', 50, 20, 2.50, 'Generico', NULL),
('Fusível 5A', 'acessorio', 30, 15, 1.50, 'Generico', NULL),
('Multímetro Digital', 'ferramenta', 2, 1, 45.00, 'Hikari', NULL)
ON CONFLICT DO NOTHING;

-- === ATIVIDADES ===
INSERT INTO public.atividades (tipo, descricao, modulo, usuario_name)
VALUES
('os_criada', 'OS-2025-0012 aberta para Carlos Eduardo Lima - Remoção por inadimplência', 'Ordens de Serviço', 'Carlos Santos'),
('os_criada', 'OS-2025-0011 aberta para Camila Rodrigues Aires - Solicitação de remoção', 'Ordens de Serviço', 'Carlos Santos'),
('os_status', 'OS-2025-0004 movida para Em Andamento - Sandra Regina Faria', 'Ordens de Serviço', 'Ana Silva'),
('os_status', 'OS-2025-0001 movida para Em Andamento - Pedro Alves Costa', 'Ordens de Serviço', 'Carlos Santos'),
('os_concluida', 'OS-2025-0005 concluída - Anderson Souza Prado (Instalação)', 'Ordens de Serviço', 'José Martins'),
('associado_criado', 'Novo associado: Anderson Souza Prado (Plano Profissional)', 'Associados', 'Carlos Santos'),
('pagamento', 'Pagamento recebido de João Mendes Ferreira - R$ 89,90 (PIX)', 'Financeiro', 'Dirce Oliveira'),
('pagamento', 'Pagamento recebido de Fernanda Souza Brito - R$ 129,90 (PIX)', 'Financeiro', 'Dirce Oliveira'),
('estoque_baixa', 'Saída de estoque: 1x Rastreador GT06N para OS-2025-0005', 'Estoque', 'Carlos Santos'),
('alerta_estoque', 'Alerta: Antena GPS Externa abaixo do estoque mínimo (2/5)', 'Estoque', 'Sistema')
ON CONFLICT DO NOTHING;
