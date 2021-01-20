'use strict';

const { Pool } = require('pg');

const conditionParse = (object, length) =>  {
    let value;
    let condition;
    let i = length ? length : 1;

    if (Object.getOwnPropertyNames(object).length !== 1) {
        throw new Error('Must be only 1 condition!')
    } else {
        const [key, val] = Object.entries(object)[0];
        if (val.startsWith('=')) {
            condition = `${key} = $${i}`;
            value = val.substring(1);
        } else if (val.startsWith('>=')) {
            condition = `${key} >= $${i}`;
            value = val.substring(2);
        } else if (val.startsWith('<=')) {
            condition = `${key} <= $${i}`;
            value = val.substring(2);
        } else if (val.startsWith('<>') || val.startsWith('!=')) {
            condition = `${key} <> $${i}`;
            value = val.substring(2);
        } else if (val.startsWith('>')) {
            condition = `${key} > $${i}`;
            value = val.substring(1);
        } else if (val.startsWith('<')) {
            condition = `${key} < $${i}`;
            value = val.substring(1);
        } else if (val.includes('*') || val.includes('?')) {
            value = val.replace(/\*/g, '%').replace(/\?/g, '_');
            condition = `${key} LIKE $${i}`;
        }
    }

    return { condition, value };
}; //DONE

class Cursor {
    constructor(db) {
        this.database = db;

        this.operation = undefined;
        this.sql = undefined;

        this.table = undefined;
        this.condition = undefined;
        this.rowLimit = undefined;
        this.offset = undefined;
        this.fields = [];
        this.orderBy = [];
        this.args = [];

        this.newTable = undefined;
        this.fieldsOptions = {};
    } //DONE

    select(fields) {
        this.operation = this.selectBuilder;
        if (fields === '*') {
            this.fields.push('*');
        } else {
            for (const field of fields) {
                this.fields.push(field);
            }
        }
        return this;
    } //DONE

    insert(object) {
        this.operation = this.insertBuilder;
        for (const [key, val] of Object.entries(object)) {
            this.fields.push(key);
            this.args.push(val);
        }
        return this;
    } //DONE

    update(object) {
        this.operation = this.updateBuilder;
        for (const [key, val] of Object.entries((object))) {
            this.fields.push(key);
            this.args.push(val);
        }
        return this;
    } //DONE

    delete() {
        this.operation = this.deleteBuilder;
        return this;
    } //DONE

    createTable(name) {
        this.operation = this.createTableBuilder;
        this.newTable = name;
        return this;
    } //DONE

    withField(object) {
        for (const [key, obj] of Object.entries(object)) {
            const options = {
                primaryKey: false,
                type: 'VARCHAR(50)',
                unique: true,
                notNull: true,
            };

            for (const option of Object.keys(options)) {
                if (obj.hasOwnProperty(option)) {
                    options[option] = obj[option];
                }
            }

            this.fieldsOptions[key] = options;
        }
        return this;
    } //DONE

    limit(count, offset) {
        this.rowLimit = count;
        this.offset = offset;
        return this;
    } //DONE

    where(cond) {
        const { condition, value } = conditionParse(cond, this.args.length + 1);
        this.condition = condition;
        this.args.push(value);
        return this;
    } //DONE

    and(cond) {
        const { condition, value } = conditionParse(cond, this.args.length + 1);
        this.condition += ` AND ${condition}`;
        this.args.push(value);
        return this;
    } //DONE

    or(cond) {
        const { condition, value } = conditionParse(cond, this.args.length + 1);
        this.condition += ` OR ${condition}`;
        this.args.push(value);
        return this;
    } //DONE

    inOrder(object) {
        for (const [key, val] of Object.entries(object)) {
            const mode = val ? val : 'ASC';
            this.orderBy.push(`${key} ${mode}`);
        }
        return this;
    } //DONE

    inTable(table) {
        this.table = table;
        return this;
    } //DONE

    selectBuilder() {
        const { table, fields, condition, orderBy, rowLimit, offset } = this;
        const columns = fields.join(', ');
        const ordering = orderBy.join(', ');
        this.sql = `SELECT ${columns} FROM ${table}`;
        this.sql += condition ? ` WHERE ${condition}`: '';
        this.sql += ordering ? ` ORDER BY ${ordering}` : '';
        this.sql += rowLimit ? ` LIMIT ${rowLimit}` : '';
        this.sql += offset ? ` OFFSET ${offset}` : '';
    } //DONE

    insertBuilder() {
        const { table, fields } = this;
        const values = [];
        for (let i = 1; i <= fields.length; i++) {
            values.push(`$${i}`);
        }
        const joinedValues = values.join(', ');
        const joinedFields = fields.join(', ')
        this.sql = `INSERT INTO ${table}(${joinedFields}) VALUES (${joinedValues})`;
    } //DONE

    updateBuilder() {
        const { table, fields, condition } = this;
        const updatedColumns = [];
        for (let i = 0; i < fields.length; i++) {
            updatedColumns.push(`${fields[i]} = $${i + 1}`);
        }
        const updatedColsJoined = updatedColumns.join(',');
        this.sql = `UPDATE ${table} SET ${updatedColsJoined} WHERE ${condition}`;
    } //DONE

    deleteBuilder() {
        const { table, condition } = this;
        this.sql = `DELETE FROM ${table} WHERE ${condition}`;
    } //DONE

    createTableBuilder() {
        const { newTable, fieldsOptions } = this;
        const fields = [];

        for (const key of Object.keys(fieldsOptions)) {
            const options = fieldsOptions[key];
            let field = `${key} ${options.type}`;
            field += options.primaryKey ? ' PRIMARY KEY' : '';
            field += options.unique ? ' UNIQUE' : '';
            field += options.notNull ? ' NOT NULL' : '';
            fields.push(field);
        }

        const strFields = fields.join(',\n ');
        this.sql = `CREATE TABLE IF NOT EXISTS ${newTable}(\n ${strFields} \n);`;
    } //DONE

    async exec(callback) {
        this.operation();
        const { sql, args } = this;
        await this.database.query(sql, args, (err, res) => {
            if (callback) {
                if (res === undefined) {
                    callback(err, undefined);
                    return;
                }
                this.rows = res.rows;
                const { rows, cols } = this;
                callback(err, rows);
            } else {
                throw new Error('Missing callback!');
            }
        });
    } //DONE

}

class Database {
    constructor(config, initSql) {
        this.pool = new Pool(config);
        this.config = config;
        console.log('Created pool.');
        this.ready = true;

        if (initSql) {
            this.pool.query(initSql)
                .catch(err => console.log(`Database initialization failed: ${err}`));
        }
    } //TODO

    query(sql, values, callback) {
            if (typeof (values) === 'function') {
                callback = values;
                values = [];
            }

            this.pool.query(sql, values, (err, res) => {
                console.group('Created sql request to db:');
                console.log(`SQL: \n${sql}`);
                console.groupEnd();

                callback ? callback(err, res) : undefined;
            })
    } //TODO

    sql() {
        return new Cursor(this);
    } //DONE

    close() {
        console.log('Pool was closed!');
        this.pool.end();
    } //DONE
}

module.exports = Database;

