import {CrudoDb, StoreSchema} from '../src';
import {BASE_SCHEMA, unload} from "./helper";
import {InternalStoreEntry, SCHEMA} from "../src/store-schema";
import {createDao, Dao, DaoApi} from "./dao";

require('fake-indexeddb/auto');

const debug = true;
const SCHEMA_KEY = 'general';

describe('#crudoDb', () => {
  let instance: CrudoDb;
  let test: string | undefined;

  beforeEach(async () => {
    instance = await CrudoDb.setup(debug);
    test = undefined;
  });

  afterEach(async () => {
    instance.close();
    await unload(SCHEMA.dbName);
    if (test) {
      await unload(test);
    }
  });

  console.debug = jest.fn();
  console.time = jest.fn();
  console.timeEnd = jest.fn();

  describe('#general', () => {

    it('should build instance of crudodb painless', async () => {
      expect(instance).toBeTruthy();
    });

  });

  describe('#setup', () => {

    // should reach each setup case
    it('should setup instance of crudodb with general database', async () => {
      const entries = await instance.getAll(SCHEMA_KEY);
      expect(entries).toHaveLength(0);
    });

  });

  describe('#register new schema', () => {

    it('should register first schema in database painless', async () => {
      test = 'shouldregisterfirstschemaindatabasepainless';
      const schema = createSchema({dbName: test});
      const schemaKey = await instance.registerSchema({
        schema
      });
      expect(schemaKey).toEqual(`custom_schema:${schema.dbName}:${schema.store}`);
      const indexedSchemas = await instance.getAll(SCHEMA_KEY);
      expect(indexedSchemas).not.toBeUndefined();
      expect(indexedSchemas).toHaveLength(1);
    });

    it('should register second schema in database painless', async () => {
      test = 'shouldregistersecondschemaindatabasepainless';
      await instance.registerSchema({ schema: createSchema({ dbName: test, store: 'otherStore' }) });
      const onUpgradeNeeded = jest.fn(() => Promise.resolve(true));
      const schema = createSchema({ dbName: test, onUpgradeNeeded });
      await instance.registerSchema({ schema });

      const indexedSchemas = await instance.getAll(SCHEMA_KEY);

      expect(indexedSchemas).not.toBeUndefined();
      expect(indexedSchemas).toHaveLength(2);
    });

    it('should register multiple schemas in different databases painless', async () => {
      const test = 'shouldregistermultipleschemasindifferentdatabasespainless';
      await instance.registerSchema({ schema: createSchema({ dbName: `${test}-1` }) });
      await instance.registerSchema({ schema: createSchema({ dbName: `${test}-2` }) });

      const indexedSchemas = await instance.getAll(SCHEMA_KEY);

      expect(indexedSchemas).not.toBeUndefined();
      expect(indexedSchemas).toHaveLength(2);

      instance.close();
      await unload(`${test}-1`);
      await unload(`${test}-2`);
    });

  });

  describe('#register existing schema', () => {

    it('should register existing schemas with unchanged version painless', async () => {
      test = 'shouldregisterexistingschemaswithunchangedversionpainless';

      await instance.registerSchema({ schema: createSchema({ dbName: test }) });
      await instance.registerSchema({ schema: createSchema({ dbName: test }) });

      const indexedSchemas = await instance.getAll(SCHEMA_KEY);

      expect(indexedSchemas).not.toBeUndefined();
      expect(indexedSchemas).toHaveLength(1);
    });

    it('should register multiple schemas painless', async() => {
      test = 'shouldregistermultipleschemaspainless';

      const schemaA = createSchema({dbName: `${test}-A`});
      const schemaB = createSchema({dbName: `${test}-B`});
      const schemaC10 = createSchema({dbName: `${test}-C`, dbVersion: 10});
      const schemaB5 = createSchema({dbName: `${test}-B`, dbVersion: 5, onUpgradeNeeded: () => Promise.resolve(true)});
      const schemaD = createSchema({dbName: `${test}-D`});

      const schemaKeyA = await instance.registerSchema({schema: schemaA});
      const schemaKeyB = await instance.registerSchema({schema: schemaB});
      const schemaKeyC = await instance.registerSchema({schema: schemaC10});
      await instance.registerSchema({schema: schemaB5, schemaKey: schemaKeyB});
      const schemaKeyD = await instance.registerSchema({schema: schemaD});

      const indexedSchemas = await instance.getAll<InternalStoreEntry>('general');

      const expectedEntries: (InternalStoreEntry & {flag: string})[] = [
        {
          ...schemaA,
          dbVersion: 1,
          indexedIn: 1,
          id: schemaKeyA!,
          flag: 'C',
          keyPath: undefined
        },
        {
          ...createSchema({dbName: `${test}-B`, dbVersion: 5}),
          indexedIn: 5,
          id: schemaKeyB!,
          flag: 'C',
          keyPath: undefined
        },
        {
          ...schemaC10,
          dbVersion: 10,
          indexedIn: 10,
          id: schemaKeyC!,
          flag: 'C',
          keyPath: undefined
        },
        {
          ...schemaD,
          dbVersion: 1,
          indexedIn: 1,
          id: schemaKeyD!,
          flag: 'C',
          keyPath: undefined
        }
      ];
      expect(indexedSchemas).toEqual(expectedEntries);
    });

  });

  describe('#register existing schema with update', () => {

    it('should register existing schemas with updated version painless', async () => {
      test = 'shouldregisterexistingschemaswithupdatedversionpainless';

      await instance.registerSchema({ schema: createSchema({ dbName: test }) });
      await instance.registerSchema({ schema: createSchema({ dbName: test, dbVersion: 5, onUpgradeNeeded: (db, event) => Promise.resolve(!!(db && event)) }) });

      const indexedSchemas = await instance.getAll<InternalStoreEntry>(SCHEMA_KEY);

      expect(indexedSchemas).not.toBeUndefined();
      expect(indexedSchemas[0].dbVersion).toEqual(5);
      expect(indexedSchemas).toHaveLength(1);
    });

    it('should register multiple schemas in same database', async () => {
      test = 'shouldregistermultipleschemasinsamedatabase';

      await instance.registerSchema({ schema: createSchema({ dbName: test, store: 'A', dbVersion: 1 }) });
      await instance.registerSchema({ schema: createSchema({ dbName: test, store: 'B', dbVersion: 1 }) });
      await instance.registerSchema({ schema: createSchema({ dbName: test, store: 'C', dbVersion: 1 }) });

      const indexedSchemas = await instance.getAll<InternalStoreEntry>(SCHEMA_KEY);

      expect(indexedSchemas).not.toBeUndefined();
      expect(indexedSchemas[0].dbVersion).toEqual(3);
      expect(indexedSchemas).toHaveLength(3);
    });

  });

  describe('#delegate requests to databases', () => {

    it('should handle get request to database', async () => {
      test = 'shouldhandlegetrequesttodatabase';
      const api = new DaoApi();
      const dao = createDao(test);
      await api.create(dao);
      const key = await instance.registerSchema({ schema: createSchema({
          dbName: test}),
        api
      });
      if (!key) {
        fail('exit');
      }
      const entity = await instance.get<Dao>(key, dao.id);
      expect(entity).toEqual(dao);
    });

    it('should fail to handle get request to not existing database', async () => {
      expect.assertions(1);
      test = 'shouldfailtohandlegetrequesttonotexistingdatabase';

      try {
        await instance.get<Dao>('notexists', 'random');
      } catch (e) {
        expect(e).toEqual(new Error('notexists does not exists'));
      }
    });

    it('should handle create request to database', async () => {
      test = 'shouldhandlecreaterequesttodatabase';
      const key = await instance.registerSchema({ schema: createSchema({dbName: test})});
      if (!key) {
        fail('exit');
      }
      const dao = createDao(test);
      const entity = await instance.create<Dao>(key, dao);
      expect(entity).toEqual({
        ...dao,
        flag: 'C'
      });
    });

    it('should fail to handle create request to not existing database', async () => {
      expect.assertions(1);
      test = 'shouldfailtohandlecreaterequesttonotexistingdatabase';

      try {
        await instance.create<Dao>('notexists', createDao(test))
      } catch (e) {
        expect(e).toEqual(new Error('notexists does not exists'));
      }
    });


    it('should handle update request to database', async () => {
      test = 'shouldhandleupdaterequesttodatabase';
      const api = new DaoApi();
      const dao = createDao(test);
      await api.create(dao);
      const key = await instance.registerSchema(
        {
          schema: createSchema({dbName: test}),
          api
        });
      if (!key) {
        fail('exit');
      }
      const entity = await instance.update<Dao>(key, dao);
      expect(entity).toEqual({
        ...dao,
        flag: ''
      });
    });

    it('should fail to handle update request to not existing database', async () => {
      expect.assertions(1);
      test = 'shouldfailtohandleupdaterequesttonotexistingdatabase';

      try {
        await instance.update<Dao>('notexists', createDao(test))
      } catch (e) {
        expect(e).toEqual(new Error('notexists does not exists'));
      }
    });

    it('should handle delete request to database', async () => {
      test = 'shouldhandledeleterequesttodatabase';
      const api = new DaoApi();
      const dao = createDao(test);
      await api.create(dao);
      const key = await instance.registerSchema(
        {
          schema: createSchema({dbName: test}),
          api
        });
      if (!key) {
        fail('exit');
      }
      const result = await instance.delete<Dao>(key, dao);
      expect(result).toEqual(true);
    });

    it('should fail to handle delete request to not existing database', async () => {
      expect.assertions(1);
      test = 'shouldfailtohandledeleterequesttonotexistingdatabase';

      try {
        await instance.delete<Dao>('notexists', createDao(test));
      } catch (e) {
        expect(e).toEqual(new Error('notexists does not exists'));
      }
    });
  });

});

function createSchema(changes: Partial<StoreSchema>): StoreSchema {
  return {
    ...BASE_SCHEMA,
    ...changes
  };
}
