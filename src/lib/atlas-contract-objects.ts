export type AtlasRecord = Record<string, unknown>;
export type AtlasQuery = (params: Record<string, string>) => Promise<unknown>;

export interface ActiveTrackerRecord {
  id: string;
  person: {
    id: string;
    name: string | null;
    cpfCnpj: string | null;
  };
  vehicle: {
    id: string;
    externalId: string | null;
    plate: string | null;
    assembler: string | null;
    model: string | null;
  };
  contract: {
    id: string;
    status: string;
  };
  product: {
    id: string;
    name: string;
    description: string;
    supplierCode: string;
  };
}

export interface LocalVehicleMatch {
  status: 'matched' | 'unassigned' | 'missing_external_id' | 'not_found' | 'ambiguous';
  associateName: string | null;
  trackerStatus: string | null;
  personMatches: boolean | null;
}

interface PageResult {
  rows: AtlasRecord[];
  count: number | null;
  next: boolean | null;
}

function isRecord(value: unknown): value is AtlasRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function records(value: unknown): AtlasRecord[] | null {
  return Array.isArray(value) && value.every(isRecord) ? value : null;
}

function parsePage(payload: unknown): PageResult {
  const root = isRecord(payload) ? payload : null;
  const nested = root && isRecord(root.data) ? root.data : null;
  const rows =
    records(payload) ??
    (root && records(root.results)) ??
    (root && records(root.data)) ??
    (nested && records(nested.results)) ??
    (nested && records(nested.data));

  if (!rows) throw new Error('Resposta paginada da Mutual Tech em formato inválido.');

  const rawCount = root?.count ?? root?.total ?? nested?.count ?? nested?.total;
  const count = rawCount == null ? null : Number(rawCount);
  if (count !== null && (!Number.isSafeInteger(count) || count < 0)) {
    throw new Error('Contagem inválida na resposta paginada da Mutual Tech.');
  }

  const nextValue = root?.next ?? nested?.next;
  const next = nextValue === undefined ? null : nextValue !== false && nextValue !== null && nextValue !== '';
  return { rows, count, next };
}

export async function fetchAllPages(
  query: AtlasQuery,
  params: Record<string, string>,
  pageSize = 100,
  maxPages = 1000,
): Promise<AtlasRecord[]> {
  const allRows: AtlasRecord[] = [];
  let expectedCount: number | null = null;

  for (let page = 1; page <= maxPages; page += 1) {
    const result = parsePage(await query({
      ...params,
      page: String(page),
      page_size: String(pageSize),
    }));

    if (result.count !== null) {
      if (expectedCount !== null && expectedCount !== result.count) {
        throw new Error('A contagem da Mutual Tech mudou durante a consulta.');
      }
      expectedCount = result.count;
    }

    allRows.push(...result.rows);
    if (expectedCount !== null) {
      if (allRows.length > expectedCount) {
        throw new Error('A paginação da Mutual Tech retornou mais registros que a contagem informada.');
      }
      if (allRows.length === expectedCount) return allRows;
      if (result.rows.length === 0) {
        throw new Error('A paginação da Mutual Tech terminou antes da contagem informada.');
      }
      continue;
    }

    if (result.next === false || (result.next === null && result.rows.length < pageSize)) {
      return allRows;
    }
    if (result.rows.length === 0 && result.next === null) return allRows;
  }

  throw new Error('A Mutual Tech excedeu o limite de páginas; a consulta foi considerada incompleta.');
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  let failure: unknown;

  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (failure === undefined) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= values.length) return;
      try {
        results[index] = await mapper(values[index]);
      } catch (error) {
        failure = error;
      }
    }
  });

  await Promise.all(workers);
  if (failure !== undefined) throw failure;
  return results;
}

function valueId(value: unknown): string {
  if (value == null || typeof value === 'object') return '';
  return String(value).trim();
}

function pathValue(row: AtlasRecord, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) =>
    isRecord(value) ? value[key] : undefined, row);
}

function sameIdentity(left: AtlasRecord, right: AtlasRecord, keys: string[]): boolean {
  return keys.every((key) => valueId(pathValue(left, key)) === valueId(pathValue(right, key)));
}

function uniqueById(rows: AtlasRecord[], getId: (row: AtlasRecord) => string, keys: string[]): AtlasRecord[] {
  const unique = new Map<string, AtlasRecord>();
  for (const row of rows) {
    const id = getId(row);
    if (!id) throw new Error('A Mutual Tech retornou um vínculo sem identificador estável.');
    const existing = unique.get(id);
    if (existing && !sameIdentity(existing, row, keys)) {
      throw new Error('A Mutual Tech retornou vínculos duplicados com relacionamentos divergentes.');
    }
    if (!existing) unique.set(id, row);
  }
  return [...unique.values()];
}

function isTrackerProduct(product: AtlasRecord): boolean {
  const labels = [
    product.product_name,
    product.subproduct_description,
    product.subproduct_supplier_code,
  ].filter((value): value is string => typeof value === 'string');
  return labels.some((label) => /rastre|track/i.test(label));
}

function mergeActiveTrackerRecords(
  objects: AtlasRecord[],
  productRows: AtlasRecord[],
  vehicleRows: AtlasRecord[],
): ActiveTrackerRecord[] {
  const uniqueObjects = uniqueById(objects, (row) => valueId(row.id), ['contract_data.id', 'person_data.id']);
  const uniqueProducts = uniqueById(productRows, (row) => valueId(row.id), [
    'contract_id', 'contract_object_id', 'product_id', 'activated', 'deleted',
  ]);
  const uniqueVehicles = uniqueById(vehicleRows, (row) => valueId(row.id), [
    'contract_id', 'vehicle_id', 'person_id', 'vehicle_external_id', 'status', 'contract_status',
  ]);

  const productsByObject = new Map<string, AtlasRecord[]>();
  for (const product of uniqueProducts) {
    const objectId = valueId(product.contract_object_id);
    if (!objectId) throw new Error('A Mutual Tech retornou um produto sem ID de objeto de contrato.');
    const products = productsByObject.get(objectId) ?? [];
    products.push(product);
    productsByObject.set(objectId, products);
  }

  const vehiclesByObject = new Map<string, AtlasRecord>();
  for (const vehicle of uniqueVehicles) vehiclesByObject.set(valueId(vehicle.id), vehicle);

  const activeTrackers: ActiveTrackerRecord[] = [];
  for (const object of uniqueObjects) {
    const objectId = valueId(object.id);
    const contractData = isRecord(object.contract_data) ? object.contract_data : null;
    const personData = isRecord(object.person_data) ? object.person_data : null;
    const vehicleData = isRecord(object.vehicle_data) ? object.vehicle_data : null;
    const contractId = valueId(contractData?.id);

    if (!vehicleData || !contractId) continue;

    const catalogProducts = Array.isArray(object.products_data)
      ? object.products_data.filter(isRecord)
      : [];
    const activeTrackerLinks = (productsByObject.get(objectId) ?? []).filter((link) =>
      link.activated === true && link.deleted !== true &&
      valueId(link.contract_id) === contractId &&
      catalogProducts.some((product) =>
        valueId(product.product_id) === valueId(link.product_id) && isTrackerProduct(product)
      )
    );

    for (const productLink of activeTrackerLinks) {
      const vehicle = vehiclesByObject.get(objectId);
      if (!vehicle) throw new Error('Não foi possível confirmar o veículo de um produto rastreador ativo.');

      const vehicleId = valueId(vehicle.vehicle_id);
      const personId = valueId(personData?.id);
      const productId = valueId(productLink.product_id);
      const contractStatusFromVehicle = valueId(vehicle.contract_status);
      const contractStatusFromIntegration = valueId(contractData?.status);
      if (
        contractStatusFromVehicle &&
        contractStatusFromIntegration &&
        contractStatusFromVehicle.toUpperCase() !== contractStatusFromIntegration.toUpperCase()
      ) {
        throw new Error('O status do contrato diverge entre os endpoints da Mutual Tech.');
      }
      const contractStatus = contractStatusFromVehicle || contractStatusFromIntegration;
      const objectStatus = valueId(vehicle.status);
      if (!vehicleId || !personId || !productId || !contractStatus || !objectStatus) {
        throw new Error('A Mutual Tech não retornou todos os IDs e status necessários para confirmar o vínculo ativo.');
      }
      if (valueId(vehicle.contract_id) !== contractId || valueId(vehicle.person_id) !== personId) {
        throw new Error('Os IDs de contrato ou titular divergem entre os endpoints da Mutual Tech.');
      }
      if (objectStatus.toUpperCase() !== 'ATIVO' || contractStatus.toUpperCase() !== 'ATIVO') continue;

      const catalogProduct = catalogProducts.find((product) =>
        valueId(product.product_id) === productId && isTrackerProduct(product)
      );
      if (!catalogProduct) continue;

      activeTrackers.push({
        id: objectId,
        person: {
          id: personId,
          name: typeof personData?.name === 'string' ? personData.name : null,
          cpfCnpj: typeof personData?.cpf_cnpj === 'string' ? personData.cpf_cnpj : null,
        },
        vehicle: {
          id: vehicleId,
          externalId: typeof vehicle.vehicle_external_id === 'string' ? vehicle.vehicle_external_id : null,
          plate: typeof vehicle.vehicle_plate === 'string' ? vehicle.vehicle_plate : (typeof vehicleData.plate === 'string' ? vehicleData.plate : null),
          assembler: typeof vehicle.vehicle_assembler === 'string' ? vehicle.vehicle_assembler : (typeof vehicleData.assembler === 'string' ? vehicleData.assembler : null),
          model: typeof vehicle.vehicle_model === 'string' ? vehicle.vehicle_model : (typeof vehicleData.model === 'string' ? vehicleData.model : null),
        },
        contract: { id: contractId, status: contractStatus },
        product: {
          id: productId,
          name: String(catalogProduct.product_name),
          description: String(catalogProduct.subproduct_description),
          supplierCode: String(catalogProduct.subproduct_supplier_code),
        },
      });
    }
  }

  const uniqueTrackers = new Map<string, ActiveTrackerRecord>();
  for (const tracker of activeTrackers) {
    const existing = uniqueTrackers.get(tracker.id);
    if (existing && (
      existing.contract.id !== tracker.contract.id ||
      existing.person.id !== tracker.person.id ||
      existing.vehicle.id !== tracker.vehicle.id ||
      existing.product.id !== tracker.product.id
    )) {
      throw new Error('A Mutual Tech retornou um mesmo objeto com vínculos divergentes.');
    }
    if (!existing) uniqueTrackers.set(tracker.id, tracker);
  }
  return [...uniqueTrackers.values()];
}

export async function fetchActiveTrackerRecords(query: AtlasQuery): Promise<ActiveTrackerRecord[]> {
  const objects = await fetchAllPages(query, { resource: 'softruck_contract_objects' });
  const contractIds = [...new Set(objects.map((row) => {
    const contractData = isRecord(row.contract_data) ? row.contract_data : null;
    const vehicleData = isRecord(row.vehicle_data) ? row.vehicle_data : null;
    const catalogProducts = Array.isArray(row.products_data) ? row.products_data.filter(isRecord) : [];
    const hasTrackerProduct = catalogProducts.some(isTrackerProduct);
    const contractId = valueId(contractData?.id);
    if (vehicleData && hasTrackerProduct && !contractId) {
      throw new Error('A Mutual Tech retornou um objeto com produto rastreador sem ID de contrato; consulta interrompida.');
    }
    return contractId;
  }).filter(Boolean))];

  const contractData = await mapWithConcurrency(contractIds, 4, async (contractId) => {
    const [products, vehicles] = await Promise.all([
      fetchAllPages(query, { resource: 'contract_object_product', contract_id: contractId }),
      fetchAllPages(query, { resource: 'contract_object_vehicle', contract_id: contractId }),
    ]);
    return { products, vehicles };
  });

  return mergeActiveTrackerRecords(
    objects,
    contractData.flatMap((item) => item.products),
    contractData.flatMap((item) => item.vehicles),
  );
}

export function compareWithLocal(
  record: ActiveTrackerRecord,
  associates: Array<{
    id: string;
    nome: string;
    cpf_cnpj: string | null;
    veiculos: Array<{
      id_externo?: string | null;
      associado_id?: string | null;
      rastreador_id?: string | null;
      rastreador?: { id: string; imei: string; status: string } | { id: string; imei: string; status: string }[] | null;
    }>;
  }>,
  unassignedVehicles: Array<{
    id_externo?: string | null;
    rastreador?: { id: string; imei: string; status: string } | null;
  }> = [],
): LocalVehicleMatch {
  const externalId = record.vehicle.externalId?.trim();
  if (!externalId) {
    return { status: 'missing_external_id', associateName: null, trackerStatus: null, personMatches: null };
  }

  const matches = [
    ...associates.flatMap((associate) =>
      associate.veiculos
        .filter((vehicle) => vehicle.id_externo?.trim() === externalId)
        .map((vehicle) => ({ associate, vehicle }))
    ),
    ...unassignedVehicles
      .filter((vehicle) => vehicle.id_externo?.trim() === externalId)
      .map((vehicle) => ({ associate: null, vehicle })),
  ];
  if (matches.length === 0) {
    return { status: 'not_found', associateName: null, trackerStatus: null, personMatches: null };
  }
  if (matches.length > 1) {
    return { status: 'ambiguous', associateName: null, trackerStatus: null, personMatches: null };
  }

  const { associate, vehicle } = matches[0];
  if (!associate) {
    const tracker = Array.isArray(vehicle.rastreador) ? vehicle.rastreador[0] ?? null : vehicle.rastreador;
    return { status: 'unassigned', associateName: null, trackerStatus: tracker?.status ?? null, personMatches: null };
  }
  const tracker = Array.isArray(vehicle.rastreador) ? vehicle.rastreador[0] ?? null : vehicle.rastreador;
  const normalizeDocument = (value: string | null) => value?.replace(/\D/g, '') ?? '';
  const remoteDocument = normalizeDocument(record.person.cpfCnpj);
  const localDocument = normalizeDocument(associate.cpf_cnpj);

  return {
    status: 'matched',
    associateName: associate.nome,
    trackerStatus: tracker?.status ?? null,
    personMatches: remoteDocument && localDocument ? remoteDocument === localDocument : null,
  };
}
