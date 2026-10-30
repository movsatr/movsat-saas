export type Role = 'operador' | 'supervisor' | 'diretoria' | 'administrador';

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: Role;
  created_at: string;
  updated_at: string;
}

export interface Associado {
  id: string;
  nome: string;
  cpf_cnpj: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  plano: string;
  valor_mensalidade: number;
  status_pagamento: 'em_dia' | 'atrasado' | 'inadimplente';
  status_equipamento: 'ok' | 'com_problema' | 'sem_equipamento';
  cidade: string | null;
  estado: string | null;
  data_cadastro: string;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Rastreador {
  id: string;
  imei: string;
  modelo: string;
  associado_id: string;
  veiculo_placa: string | null;
  veiculo_modelo: string | null;
  veiculo_cor: string | null;
  status: 'ativo' | 'inativo' | 'com_problema' | 'manutencao';
  data_instalacao: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export type RastreadorWithVeiculo = Rastreador & {
  veiculo?: { id: string; placa: string; modelo: string; ano: number }[] | null;
};

export type AssociadoWithRelations = Associado & {
  rastreadores: {
    id: string;
    imei: string;
    modelo: string | null;
    status: string;
    data_instalacao: string | null;
    veiculo: { id: string; placa: string; modelo: string; ano: number }[] | null;
  }[];
  veiculos: {
    id: string;
    placa: string;
    modelo: string;
    ano: number;
    rastreador_id: string | null;
    status: string;
  }[];
};

export interface Veiculo {
  id: string;
  placa: string;
  modelo: string;
  ano: number;
  associado_id: string | null;
  rastreador_id: string | null;
  id_externo: string | null;
  status: 'ativo' | 'inativo';
  created_at: string;
}

export interface Prestador {
  id: string;
  nome: string;
  especialidade: 'instalacao' | 'manutencao' | 'remocao' | 'geral';
  telefone: string | null;
  email: string | null;
  area_cobertura: string | null;
  status: 'ativo' | 'inativo';
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EstoqueItem {
  id: string;
  nome: string;
  categoria: 'rastreador' | 'acessorio' | 'simcard' | 'ferramenta';
  quantidade: number;
  quantidade_minima: number;
  preco_unitario: number;
  fornecedor: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrdemServico {
  id: string;
  numero: string;
  associado_id: string;
  rastreador_id: string | null;
  veiculo_id: string | null;
  prestador_id: string | null;
  tipo: 'instalacao' | 'manutencao' | 'remocao' | 'consultoria';
  status: 'aberta' | 'em_andamento' | 'concluida' | 'cancelada';
  prioridade: 'baixa' | 'normal' | 'alta' | 'urgente';
  descricao: string | null;
  solucao: string | null;
  data_abertura: string;
  data_conclusao: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceiroRecord {
  id: string;
  associado_id: string;
  tipo: 'mensalidade' | 'instalacao' | 'manutencao' | 'rastreamento' | 'assistencia' | 'servico' | 'outro';
  descricao: string;
  valor: number;
  status: 'pago' | 'pendente' | 'atrasado' | 'cancelado';
  data_vencimento: string;
  data_pagamento: string | null;
  forma_pagamento: 'pix' | 'boleto' | 'cartao' | 'dinheiro' | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BaseTecnicaDoc {
  id: string;
  titulo: string;
  categoria: 'instalacao' | 'configuracao' | 'troubleshooting' | 'especificacao' | 'manual';
  conteudo: string;
  tags: string | null;
  status: 'ativo' | 'arquivado';
  created_at: string;
  updated_at: string;
}

export interface EventLog {
  id: string;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown>;
  severity: 'info' | 'warning' | 'critical';
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  owner: string;
  priority: 'baixa' | 'normal' | 'alta' | 'urgente';
  status: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';
  deadline: string | null;
  related_customer: string | null;
  related_os: string | null;
  related_tracker: string | null;
  financial_impact: number;
  resolution_notes: string | null;
  source_event: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  trigger: string;
  conditions: Record<string, unknown>;
  actions: Record<string, unknown>[];
  status: 'ativa' | 'pausada' | 'rascunho';
  last_execution: string | null;
  next_execution: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationLog {
  id: string;
  rule_id: string | null;
  trigger_event: string | null;
  status: 'sucesso' | 'falha' | 'skip';
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error_message: string | null;
  duration_ms: number;
  created_at: string;
}

export interface AutomationQueueItem {
  id: string;
  rule_id: string | null;
  event_id: string | null;
  payload: Record<string, unknown>;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'dead';
  attempts: number;
  max_attempts: number;
  locked_by: string | null;
  locked_at: string | null;
  scheduled_for: string;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface ScheduledTask {
  id: string;
  name: string;
  rule_id: string | null;
  cron_expression: string;
  payload: Record<string, unknown>;
  status: 'ativa' | 'pausada';
  last_run: string | null;
  next_run: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string | null;
  target_role: string | null;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'critical';
  related_entity_type: string | null;
  related_entity_id: string | null;
  read: boolean;
  created_at: string;
}
