import {config} from "dotenv";

config()
import knex, {Knex} from "knex";

interface SelectOptions {
    orderBy?: Array<string | { column: string, order: string }>
    limit?: number
    offset?: number
}

class Repository {
    knex: Knex
    schema: string

    constructor(knex: Knex, schema: string) {
        this.knex = knex
        this.schema = schema
    }

    async find(select: Array<string> | string, where: (builder: Knex.QueryBuilder) => Knex.QueryBuilder, options: SelectOptions) {
        const {limit, offset, orderBy} = options
        return this.knex(this.schema).select(select)
            .where(where)
            .limit(limit || 100)
            .offset(offset || 0)
            .orderBy(<any>orderBy)
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

    constructor(knexClientConfig: Knex.Config) {
        this.knex = knex(knexClientConfig)
    }

    async createSchema(name: string, schema: any) {
        if (await this.knex.schema.hasTable(name) && !process.env.DROP_TABLES) {
            throw new Error('Error creating table with name ' + name + ', it probably already exists')
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
