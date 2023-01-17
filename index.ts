import {config} from "dotenv";

config()
import knex from "knex";

const {
    MYSQL_CONNECTION_STRING,
    MYSQL_HOST,
    MYSQL_PORT,
    MYSQL_DBNAME,
    MYSQL_USER,
    MYSQL_PASSWORD
} = process.env

export const knexClient = knex({
        client: "mysql2",
        connection: MYSQL_CONNECTION_STRING || {
            host: MYSQL_HOST,
            port: Number(MYSQL_PORT),
            user: MYSQL_USER,
            password: MYSQL_PASSWORD,
            database: MYSQL_DBNAME
        }
    }
)