'use strict';

const conditionParse = object =>  {
    let clause = '';
    const args = [];
    let i = 1;
    for (const [key, val] of Object.entries(object)) {
        let value;
        let condition;

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

        i++;
        args.push(value);
        clause = clause ? `${clause} AND ${condition}` : condition;
    }
    return { clause, args };
}; //TODO

class Cursor {
    constructor(db) {
        this.database = db;
        this.operation = undefined;
        this.table = undefined;
        this.sql = undefined;
        this.condition = undefined;
        this.orderBy = [];
        this.fields = [];
        this.args = [];
        this.options = {};
    } //TODO

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

    where(cond) {
        this.condition = conditionParse(cond);
        return this;
    } //TODO

    and(cond) {} //TODO

    or(cond) {} //TODO

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
        const { table, fields, condition, orderBy } = this;
        const columns = fields.join(', ');
        const ordering = orderBy.join(', ');
        this.sql = `SELECT ${columns} FROM ${table}`;
        if (condition) this.sql += ` WHERE ${condition}`;
        if (orderBy) this.sql += ` ORDER BY ${ordering}`;
    } //TODO

    insertBuilder() {
        const { table, fields } = this;
        const values = [];
        for (let i = 1; i <= fields.length; i++) {
            values.push(`$${i}`);
        }
        const joinedValues = values.join(', ');
        const joinedFields = fields.join(', ')
        this.sql = `INSERT INTO ${table}(${joinedFields}) VALUES (${joinedValues})`;
    } //TODO

    updateBuilder() {
        const { table, fields, condition } = this;
        const updatedColumns = [];
        for (let i = 0; i < fields.length; i++) {
            updatedColumns.push(`${fields[i]} = $${i + 1}`);
        }
        const updatedColsJoined = updatedColumns.join(',');
        this.sql = `UPDATE ${table} SET ${updatedColsJoined} WHERE ${condition}`;
    } //TODO

    deleteBuilder() {
        const { table, condition } = this;
        this.sql = `DELETE FROM ${table} WHERE ${condition}`;
    } //DONE

    exec() {
        this.operation()
        console.log(this.sql);
    } //TODO

}

class Database {
    constructor(config, initSql) {
        this.pool = new Pool(config);
        this.config = config;
        console.log('Created pool.');

        if (initSql) {
            this.pool.query(initSql)
                .then(() => console.log('Database initialization was successful!'))
                .then(() => console.log('Database ready to work.'))
                .catch(err => console.log(`Database initialization failed: ${err}`));
        }
    } //TODO

    query(sql, values, callback) {
        if (typeof(values) === 'function') {
            callback = values;
            values = [];
        }

        this.pool.query(sql, values, (err, res) => {
            console.group('Created sql request to db:');
            console.log(`SQL: ${sql}`);
            console.groupEnd();

            callback ? callback(err, res) : undefined;
        })
    } //TODO

    sql() {
        return new Cursor(this);
    } //DONE

    close() {
        this.pool.end();
    } //DONE
}

module.exports = Database;
