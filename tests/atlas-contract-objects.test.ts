import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compareWithLocal,
  fetchActiveTrackerRecords,
  fetchAllPages,
  type ActiveTrackerRecord,
} from '../src/lib/atlas-contract-objects.ts';

test('fetchAllPages reads and verifies every counted page', async () => {
  const requestedPages: string[] = [];
  const rows = await fetchAllPages(async ({ page }) => {
    requestedPages.push(page);
    return page === '1'
      ? { count: 3, results: [{ id: 1 }, { id: 2 }] }
      : { count: 3, results: [{ id: 3 }] };
  }, { resource: 'test' }, 2);

  assert.deepEqual(requestedPages, ['1', '2']);
  assert.deepEqual(rows.map((row) => row.id), [1, 2, 3]);
});

test('fetchAllPages rejects failed or incomplete pagination', async () => {
  await assert.rejects(
    fetchAllPages(async ({ page }) => {
      if (page === '2') throw new Error('upstream unavailable');
      return { count: 3, results: [{ id: 1 }, { id: 2 }] };
    }, { resource: 'test' }, 2),
    /upstream unavailable/,
  );

  await assert.rejects(
    fetchAllPages(async () => ({ count: 3, results: [{ id: 1 }] }), { resource: 'test' }, 2, 1),
    /limite de páginas/,
  );
});

test('fetchActiveTrackerRecords joins active products, objects, vehicles and people by IDs', async () => {
  const responses: Record<string, Record<string, unknown>> = {
    integrations_contract_objects: {
      id: 41,
      person_data: { id: 7, name: 'Pessoa', cpf_cnpj: '123.456.789-00' },
      vehicle_data: { plate: 'ABC1234', model: 'Modelo' },
      contract_data: { id: 9, status: 'ATIVO' },
      products_data: [{
        product_id: 18,
        product_name: 'Rastreador veicular',
        subproduct_description: 'Monitoramento ativo',
        subproduct_supplier_code: 'TRACK-01',
      }],
    },
    contract_object_product: {
      id: 51,
      contract_id: 9,
      contract_object_id: 41,
      product_id: 18,
      activated: true,
      deleted: false,
    },
    contract_object_vehicle: {
      id: 41,
      contract_id: 9,
      vehicle_id: 12,
      vehicle_external_id: 'movsat-vehicle-12',
      vehicle_plate: 'ABC1234',
      person_id: 7,
      status: 'ATIVO',
      contract_status: 'ATIVO',
    },
  };

  const records = await fetchActiveTrackerRecords(async ({ resource }) => ({
    count: 1,
    results: [responses[resource]],
  }));
  const duplicated = await fetchActiveTrackerRecords(async ({ resource }) => ({
    count: 2,
    results: [responses[resource], responses[resource]],
  }));

  assert.equal(records.length, 1);
  assert.equal(records[0].vehicle.id, '12');
  assert.equal(records[0].person.id, '7');
  assert.equal(records[0].contract.id, '9');
  assert.equal(duplicated.length, 1);
});

test('inactive contracts or unactivated and non-tracker products are not eligible', async () => {
  const fixture = (overrides: {
    activated?: boolean;
    productName?: string;
    contractStatus?: string;
    objectStatus?: string;
  }) => ({
    integrations_contract_objects: {
      id: 41,
      person_data: { id: 7 },
      vehicle_data: { plate: 'ABC1234' },
      contract_data: { id: 9, status: overrides.contractStatus ?? 'ATIVO' },
      products_data: [{
        product_id: 18,
        product_name: overrides.productName ?? 'Rastreador veicular',
        subproduct_description: 'Monitoramento',
        subproduct_supplier_code: overrides.productName === 'Proteção veicular' ? 'PROD-01' : 'TRACK-01',
      }],
    },
    contract_object_product: {
      id: 51,
      contract_id: 9,
      contract_object_id: 41,
      product_id: 18,
      activated: overrides.activated ?? true,
      deleted: false,
    },
    contract_object_vehicle: {
      id: 41,
      contract_id: 9,
      vehicle_id: 12,
      person_id: 7,
      status: overrides.objectStatus ?? 'ATIVO',
      contract_status: overrides.contractStatus ?? 'ATIVO',
    },
  });

  for (const changes of [
    { activated: false },
    { productName: 'Proteção veicular' },
    { contractStatus: 'INATIVO' },
    { objectStatus: 'INATIVO' },
  ]) {
    const responses = fixture(changes);
    const rows = await fetchActiveTrackerRecords(async ({ resource }) => ({
      count: 1,
      results: [responses[resource as keyof typeof responses]],
    }));
    assert.equal(rows.length, 0);
  }
});

test('vehicle/person ID mismatch fails rather than creating an unreliable link', async () => {
  const responses = {
    integrations_contract_objects: {
      id: 41,
      person_data: { id: 7 },
      vehicle_data: {},
      contract_data: { id: 9, status: 'ATIVO' },
      products_data: [{
        product_id: 18,
        product_name: 'Rastreador veicular',
        subproduct_description: 'Monitoramento',
        subproduct_supplier_code: 'TRACK-01',
      }],
    },
    contract_object_product: {
      id: 51,
      contract_id: 9,
      contract_object_id: 41,
      product_id: 18,
      activated: true,
      deleted: false,
    },
    contract_object_vehicle: {
      id: 41,
      contract_id: 9,
      vehicle_id: 12,
      person_id: 8,
      status: 'ATIVO',
      contract_status: 'ATIVO',
    },
  };

  await assert.rejects(
    fetchActiveTrackerRecords(async ({ resource }) => ({
      count: 1,
      results: [responses[resource as keyof typeof responses]],
    })),
    /IDs de contrato ou titular divergem/,
  );
});


test('tracker objects missing a contract ID fail the whole refresh', async () => {
  await assert.rejects(
    fetchActiveTrackerRecords(async () => ({
      count: 1,
      results: [{
        id: 99,
        person_data: { id: 7 },
        vehicle_data: { plate: 'ABC1234' },
        contract_data: null,
        products_data: [{ product_id: 18, product_name: 'Rastreador veicular' }],
      }],
    })),
    /sem ID de contrato/,
  );
});

test('duplicate vehicle rows with conflicting external IDs fail closed', async () => {
  const responses: Record<string, Record<string, unknown>> = {
    integrations_contract_objects: {
      id: 41, person_data: { id: 7 }, vehicle_data: { plate: 'ABC1234' },
      contract_data: { id: 9, status: 'ATIVO' },
      products_data: [{ product_id: 18, product_name: 'Rastreador veicular' }],
    },
    contract_object_product: {
      id: 51, contract_id: 9, contract_object_id: 41, product_id: 18, activated: true, deleted: false,
    },
    contract_object_vehicle: {
      id: 41, contract_id: 9, vehicle_id: 12, vehicle_external_id: 'external-A',
      person_id: 7, status: 'ATIVO', contract_status: 'ATIVO',
    },
  };
  await assert.rejects(
    fetchActiveTrackerRecords(async ({ resource }) => ({
      count: resource === 'integrations_contract_objects' ? 1 : 2,
      results: resource === 'contract_object_vehicle'
        ? [responses[resource], { ...responses[resource], vehicle_external_id: 'external-B' }]
        : [responses[resource]],
    })),
    /relacionamentos divergentes/,
  );
});

test('local reconciliation uses the external vehicle ID and reports ambiguity', () => {
  const record: ActiveTrackerRecord = {
    id: '41',
    person: { id: '7', name: 'Pessoa', cpfCnpj: '12345678900' },
    vehicle: { id: '12', externalId: 'mutual-12', plate: 'ABC1234', assembler: null, model: 'Modelo' },
    contract: { id: '9', status: 'ATIVO' },
    product: { id: '18', name: 'Rastreador', description: 'Ativo', supplierCode: '18' },
  };
  const local = [{
    id: 'associate-1',
    nome: 'Associado local',
    cpf_cnpj: '123.456.789-00',
    veiculos: [{
      id_externo: 'mutual-12',
      associado_id: 'associate-1',
      rastreador_id: 'tracker-1',
      rastreador: { id: 'tracker-1', imei: 'ignored', status: 'ativo' },
    }],
  }];

  assert.deepEqual(compareWithLocal(record, local), {
    status: 'matched',
    associateName: 'Associado local',
    trackerStatus: 'ativo',
    personMatches: true,
  });
  assert.equal(compareWithLocal(record, [{
    ...local[0],
    veiculos: [{ ...local[0].veiculos[0], id_externo: 'different-id' }],
  }]).status, 'not_found');
  assert.equal(compareWithLocal(record, [local[0], { ...local[0], id: 'associate-2' }]).status, 'ambiguous');
  assert.equal(compareWithLocal(record, [], [{ id_externo: 'mutual-12', rastreador: { id: 'tracker-unassigned', imei: 'ignored', status: 'ativo' } }]).status, 'unassigned');
});
