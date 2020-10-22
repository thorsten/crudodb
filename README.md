# CrudoDb

Offline-first IndexedDb wrapper written in TypeScript, which is able to sync with backend services by passing optional service implementation.

## Why?

CrudoDb offers some advantages over other solutions as it offers an offline-first and offline-only solution.

An optional API connection and can be synchronized e.g. after an already completed offline implementation.

## crudodb

Store list of `Database<T>` instances and manage them.

`schemaKey` is an identifier to the instance of `Database<T>` you want to access.

For example:

```typescript
const instance = await CrudoDb.setup();

// key will generated by CrudoDb
const key = await wrapper.registerDatabase({
    schema: mySchema
});
const item: T = {key: 'value', id: '1'};

// will call create of the Database<T> instance
wrapper.create(key, item);
```

## Database

* Manages all CRUD operations against store and optional API.
* Store item in indexeddb and on success try to call the api#create.
* if no API is defined, the item only lives in the IndexedDb.
* if an API is defined, the created item will be sent to the API.
* on successful creation, the local item will update without creation flag

### Flags

There are 3 flags to mark an item in indexeddb for processing.

+ C
+ U
+ D


## Recommendations

### Angular

```typescript
@Injectable({providedIn: 'root'})
export class StoreAccessService {

    public instance$ = fromPromise(CrudoDb.setup)
        .pipe(shareReplay(1));

}

@Injectable({providedIn: 'root'})
export class DaoService {

    private key$ = this.storeAccess.instance$.pipe(
        switchMap((instance) => instance.registerSchema({schema})),
        shareReplay(1)
    );

    private handle$ = combineLatest([this.key$, this.storeAccess.instance$]).pipe(shareReplay(1));

    constructor(private storeAccess: StoreAccessService) {}

    public create(item: Dao): Observable<Dao> {
        return this.handle$.pipe(
            switchMap(([key, instance]) => instance.create(key, item))
        );
    }
}

```

### React (Hooks API)

```typescript jsx

// TODO: write hook(context) for it

 
```
