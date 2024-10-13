const SqlInjection = require("../src/services/database-injection/sql-injection");
const test = async () => {
    const url = 'https://kenh14.vn/tim-kiem.chn'
    const method = 'GET'
    const params = {
        keyword: 'đất đai',
    }

    const body = {};
    const sql = new SqlInjection('client-id', {url, method, params, body});
    const headers = await sql.preFetchHeaders();
    sql.event.on('sql-injection-error-based', (data) => {
        const {query, response, time} = data;
        const {url, method, params, body, maliciousQuery} = query;
        console.log(`[Request]:\n -time:${time}\n -${url}\n\ -${method}\n\ -${JSON.stringify(params)}\n -${JSON.stringify(body)}\n -${maliciousQuery}`);
        console.log(`[Response]:\n -${response.message}\n -${maliciousQuery} `);
    })
    const response = await sql.scanInjectionWithErrorBased();
}

test()