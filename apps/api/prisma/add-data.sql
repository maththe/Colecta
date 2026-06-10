-- Adiciona novas lixeiras (com posicoes) e tarefas sem apagar dados existentes.
DO $$
DECLARE
  t uuid := '00000000-0000-0000-0000-000000000001';
  loc_acad uuid := gen_random_uuid();
  loc_estac uuid := gen_random_uuid();
  loc_cancha uuid := gen_random_uuid();
  loc_anfit uuid := gen_random_uuid();
  loc_pet uuid := gen_random_uuid();
  bin_acad uuid := gen_random_uuid();
  bin_estac uuid := gen_random_uuid();
  bin_cancha uuid := gen_random_uuid();
  bin_anfit uuid := gen_random_uuid();
  bin_pet uuid := gen_random_uuid();
BEGIN
  INSERT INTO locations (id, "tenantUuid", name, description, latitude, longitude, "createdAt", "updatedAt") VALUES
    (loc_acad,  t, 'Academia ao ar livre', 'Equipamentos de ginastica',     -23.5885, -46.6601, NOW(), NOW()),
    (loc_estac, t, 'Estacionamento',       'Saida do estacionamento sul',   -23.5860, -46.6610, NOW(), NOW()),
    (loc_cancha,t, 'Cancha de areia',      'Lado da quadra de volei',       -23.5908, -46.6571, NOW(), NOW()),
    (loc_anfit, t, 'Anfiteatro',           'Atras do anfiteatro',           -23.5879, -46.6549, NOW(), NOW()),
    (loc_pet,   t, 'Pet place',            'Area cercada para caes',        -23.5896, -46.6605, NOW(), NOW());

  INSERT INTO trash_bins (id, "tenantUuid", name, code, "locationId", "capacityLiters", status, "fillLevel", "batteryLevel", "lastSeenAt", "createdAt", "updatedAt") VALUES
    (bin_acad,  t, 'Lixeira Academia',     'PRQ-006', loc_acad,  90,  'active'::"TrashBinStatus",      55, 78, NOW(), NOW(), NOW()),
    (bin_estac, t, 'Lixeira Estacionamento','PRQ-007', loc_estac, 240, 'full'::"TrashBinStatus",       92, 64, NOW(), NOW(), NOW()),
    (bin_cancha,t, 'Lixeira Cancha',       'PRQ-008', loc_cancha,100, 'active'::"TrashBinStatus",      30, 81, NOW(), NOW(), NOW()),
    (bin_anfit, t, 'Lixeira Anfiteatro',   'PRQ-009', loc_anfit, 120, 'maintenance'::"TrashBinStatus", 15, 55, NOW() - INTERVAL '3 hours', NOW(), NOW()),
    (bin_pet,   t, 'Lixeira Pet Place',    'PRQ-010', loc_pet,   60,  'active'::"TrashBinStatus",      72, 18, NOW(), NOW(), NOW());

  INSERT INTO tasks (id, "tenantUuid", title, description, status, priority, "trashBinId", "locationId", "assigneeName", "dueDate", "createdAt", "updatedAt") VALUES
    (gen_random_uuid(), t, 'Esvaziar lixeira estacionamento', 'PRQ-007 esta cheia (92%)',           'pending'::"TaskStatus",     'high'::"TaskPriority",    bin_estac,  NULL,     'Equipe Coleta B',  NOW() + INTERVAL '3 hours',  NOW(), NOW()),
    (gen_random_uuid(), t, 'Trocar bateria do sensor pet',     'PRQ-010 bateria baixa (18%)',        'pending'::"TaskStatus",     'medium'::"TaskPriority",  bin_pet,    NULL,     'Tecnico Manutencao', NOW() + INTERVAL '1 day',   NOW(), NOW()),
    (gen_random_uuid(), t, 'Manutencao do anfiteatro',         'PRQ-009 em manutencao programada',   'in_progress'::"TaskStatus", 'medium'::"TaskPriority",  bin_anfit,  NULL,     'Tecnico Manutencao', NOW() + INTERVAL '8 hours', NOW(), NOW()),
    (gen_random_uuid(), t, 'Inspecao da academia',             'Verificar fixacao da lixeira',       'pending'::"TaskStatus",     'low'::"TaskPriority",     bin_acad,   NULL,     'Equipe Coleta A',  NOW() + INTERVAL '2 days',   NOW(), NOW()),
    (gen_random_uuid(), t, 'Avaliar nova posicao na cancha',   'Confirmar se a coordenada e ideal',  'pending'::"TaskStatus",     'low'::"TaskPriority",     NULL,       loc_cancha,'Gestor',            NOW() + INTERVAL '5 days',   NOW(), NOW());

  RAISE NOTICE 'Inseridos: 5 posicoes, 5 lixeiras, 5 tarefas';
END $$;
