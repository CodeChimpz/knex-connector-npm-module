import {config} from "dotenv";
import {WinstonLoggerService} from "../logger";

config()
import knex, {Knex} from "knex";
import now from "performance-now";

interface SelectOptions {
    limit?: number
    offset?: number
}

export class Repository {
    knex: Knex
    schema: string

    constructor(knex: Knex, schema: string) {
        this.knex = knex
        this.schema = schema

    }

    async find(select: Array<string> | string,
               where: (builder: Knex.QueryBuilder) => Knex.QueryBuilder,
               orderBy: Array<string | { column: string, order: string }>,
               options: SelectOptions) {
        const {limit, offset} = options
        return this.knex(this.schema).select(select)
            .where(where)
            .orderBy(orderBy)
            .limit(limit || 100)
            .offset(offset || 0)
    }

    async create(object: any) {
        return this.knex(this.schema).insert(object)
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
    }

    async createSchema(name: string, schema: any) {
        if (await this.knex.schema.hasTable(name)) {
            return
        }
        await this.knex.schema.createTable(name, (table: any) => {
            Object.getOwnPropertyNames(schema).forEach(property => {
                table[schema[property].type](property)
            })
        })

    }

    async getRepo(name: string) {
        return new Repository(this.knex, name)
    }
}
