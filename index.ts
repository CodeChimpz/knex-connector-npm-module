import {config} from "dotenv";
import {WinstonLoggerService} from "../logger";

config()
import knex, {Knex} from "knex";
import now from "performance-now";

//QUERY running interfaces
interface SelectOptions {
    limit?: number
    offset?: number
}

interface WhereObjI {
    select?: Array<string> | string,
    where?: (builder: Knex.QueryBuilder) => Knex.QueryBuilder,
    orderBy?: Array<string | { column: string, order: string }>,
    options?: SelectOptions
}

export enum SchemaDataTypes {
    // primary = 'primary',
    integer = 'integer',
    string = 'string',
    datetime = 'datetime'
}


interface SchemaDefinitionT {
    [key: string]: {
        type: SchemaDataTypes
    }
}


//Repo class
export class Repository {
    knex: Knex
    schema: string

    constructor(knex: Knex, schema: string) {
        this.knex = knex
        this.schema = schema
    }

    async find(opts: WhereObjI) {
        const {options, where, orderBy, select} = opts
        return this.knex(this.schema).select(select || '*')
            .where(where || {})
            .orderBy(orderBy || [])
            .limit(options?.limit || 100)
            .offset(options?.offset || 0)
    }

    async create(object: any) {
        const res = await this.knex(this.schema).insert(object).then(obj => {
            return this.knex(this.schema).select().where('_id', obj[0])
        })
        return res[0]

    }

    async edit(data: any, where: (builder: Knex.QueryBuilder) => Knex.QueryBuilder) {
        return this.knex(this.schema).where(where).update(data)
    }

    async delete(where: (builder: Knex.QueryBuilder) => Knex.QueryBuilder) {
        return this.knex(this.schema).where(where).delete()
    }
}

export class DataSource {
    knex: Knex
    queriesRan: Map<string, { start?: number, time?: number, overrun?: boolean }>
    logger: WinstonLoggerService

    constructor(knexClientConfig: Knex.Config, logger: WinstonLoggerService) {
        this.logger = logger
        this.knex = knex(knexClientConfig)
        this.queriesRan = new Map()
        try {
            this.knex.raw('SELECT 1')
            this.logger.http.info('Connected to database')
            this.knex
                .on('query', (query) => {
                    const time = now()
                    const id = <string>query.__knexQueryUid
                    this.queriesRan.set(id, {
                        start: time
                    })
                })
                .on('query-response', (response, query) => {
                    const time = now()
                    const id = <string>query.__knexQueryUid
                    const start = this.queriesRan.get(id)?.start
                    if (!start) {
                        throw 'Escaped query start'
                    }
                    this.queriesRan.set(id, {
                        time: time - start
                    })
                })
                .on('query-error', (error, query) => {
                    const id = <string>query.__knexQueryUid
                    if (error.name === 'KnexTimeoutError') {
                        this.queriesRan.set(id, {
                            time: query.timeout,
                            overrun: true
                        })
                    }
                    this.logger.app.error('Query timeout , id: ' + id, {id, error})
                })
        } catch (e: any) {
            this.logger.app.error(e)
        }

    }

    //Creates a table in db from defined Schema, returns a class to use for initialisation of Models
    async createSchema(name: string, schema: SchemaDefinitionT) {
        const check = await this.knex.schema.hasTable(name)
        if (!check) {
            //run createTable query with all the defined types
            await this.knex.schema.createTable(name, (table: any) => {
                table.increments('_id').primary()
                Object.entries(schema).forEach(property => {
                    const [name, meta] = property
                    table[meta.type](name)
                    // switch (meta.type) {
                    //     case SchemaDataTypes.primary:
                    //         table.increments(name).primary()
                    //         break;
                    //     default:
                    //         table[meta.type](name)
                    //         break;
                    // }
                })
            })
            //
        }
        this.logger.app.info('Created table "' + name + '"')
        return new Repository(this.knex, name)
    }

}
