const signature = require('./signature/sql');
const axios = require('axios');
const CreateBrowser = require('browserless');
const fs = require("node:fs");
const path = require("node:path");
const EventEmitter = require('events').EventEmitter;
const { performance } = require('perf_hooks');
const timeout = require("../../helpers/delay");

class SqlInjection {
    clientId = null;
    options = {
        url: null, // request url: https://example.com/api/v1/users
        method: null, // GET, POST, PUT, DELETE
        params: null, // query params: ?q=1&page=2
        body: null, // request body: {username: 'admin', list: [1, 2, 3]}
    };
    headers = {};
    cookies = [];
    USER_AGENT = 'Googlebot/2.1 (+http://www.googlebot.com/bot.html)'
    event;
    dictionaryPath = {
        ERROR_BASED: path.posix.join(process.cwd(), "src/services/database-injection/signature/sql/Generic_ErrorBased.txt"),
        UNION_BASED: './dictionary/sql-injection/union-based.txt',
        BLIND_BASED: './dictionary/sql-injection/blind-based.txt',
        TIME_BASED: './dictionary/sql-injection/time-based.txt',
        BOOLEAN_BASED: './dictionary/sql-injection/boolean-based.txt',
    }

    vulnerabilities = {
        ERROR_BASED: []
    }
    logPath = path.posix.join(process.cwd(), 'storages/logs/sql_injection.log');
    logStream = fs.createWriteStream(this.logPath, { flags: 'a' })
    constructor(clientId, options) {
        this.clientId = clientId;
        this.options = options;
        this.event = new EventEmitter();
        // clear log file
        fs.writeFileSync(this.logPath, '');
        process.on('exit', () => {
            this.logStream.end();
        });
    }

    async preFetchHeaders() {
        const browser = CreateBrowser({
            timeout: 25000,
            lossyDeviceName: true,
            ignoreHTTPSErrors: true,
            args: [
                '--disable-web-security',
                '--fast-start',
                '--disable-extensions',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--no-gpu',
                '--disable-background-timer-throttling',
                '--disable-renderer-backgrounding',
                '--override-plugin-power-saver-for-testing=never',
                '--disable-extensions-http-throttling',
                '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
            ],
        });
        const context = await browser.createContext({ retry: 2 });
        const page = await context.page();
        page.on('request', (request) => {
            if (request.url().includes(this.options.url)) {
                this.headers = {
                    ...request.headers(),
                    'user-agent': this.USER_AGENT,
                };
                console.log(request.headers());
            }
        });
        await page.goto(this.options.url, {
            headers: {
                "user-agent": this.USER_AGENT,
            }
        });
        const devtoolProtocol = await page.target().createCDPSession();
        const cookies = (await devtoolProtocol.send('Network.getAllCookies')).cookies;
        this.cookies = cookies;
        console.log('Cookies:', this.cookies);
        console.log('Headers:', this.headers);
        await browser.close();
        return this.headers;
    }

    async handleRequest(url, method, params, body) {
        try {
            // console.log('Request:', { url, method, params, body });
            const response = await axios({
                url,
                method,
                params,
                data: body,
                headers: this.headers,
            });
            return {
                data: response.data,
                message: response.statusText,
            };
        } catch (error) {
            return {
                data: null,
                message: error.message,
            };
        }
    }

    async scanInjectionWithErrorBased() {
        const dictionary = await fs.promises.readFile(this.dictionaryPath.ERROR_BASED, 'utf-8');
        const payloads = dictionary.split('\n');
        const queries = payloads.map(payload => {
            const params = this.options.params;
            const body = this.options.body;
            return {
                maliciousQuery: payload,
                url: this.options.url,
                method: this.options.method,
                params: {
                    ...Object.keys(params).reduce((acc, key) => {
                        acc[key] = params[key] + payload;
                        return acc;
                    }, {}),
                },
                body: {
                    ...Object.keys(body).reduce((acc, key) => {
                        acc[key] = body[key] + payload;
                        return acc;
                    }, {}),
                },
            }
        });
        for (const query of queries) {
            const startTime = performance.now();
            const response = await this.handleRequest(query.url, query.method, query.params, query.body);
            const endTime = performance.now();

            this.event.emit('sql-injection-error-based', {
                time: endTime - startTime,
                maliciousQuery: query.maliciousQuery,
                query,
                response,
            });
            this.logStream.write(`[Request]: time:${endTime - startTime} - ${query.url} - ${query.method} - ${JSON.stringify(query.params)} - ${JSON.stringify(query.body)} - ${query.maliciousQuery}\n`);
            this.logStream.write(`[Response]: ${response.message} - ${query.maliciousQuery}\n`);
            if (response.data) {
                this.vulnerabilities.ERROR_BASED.push({
                    query,
                    response,
                });
            }
            await timeout(500);
        }

    }
    async scanWithDictionary(dictionaryPath) {
        const dictionary = await fs.promises.readFile(dictionaryPath, 'utf-8');
        const payloads = dictionary.split('\n');
        const queries = payloads.map(payload => {
            const params = this.options.params;
            const body = this.options.body;
            return {
                maliciousQuery: payload,
                url: this.options.url,
                method: this.options.method,
                params: {
                    ...Object.keys(params).reduce((acc, key) => {
                        acc[key] = params[key] + payload;
                        return acc;
                    }, {}),
                },
                body: {
                    ...Object.keys(body).reduce((acc, key) => {
                        acc[key] = body[key] + payload;
                        return acc;
                    }, {}),
                },
            }
        });
        for (const query of queries) {
            const startTime = performance.now();
            const response = await this.handleRequest(query.url, query.method, query.params, query.body);
            const endTime = performance.now();

            this.event.emit('sql-injection-error-based', {
                time: endTime - startTime,
                maliciousQuery: query.maliciousQuery,
                query,
                response,
            });
            this.logStream.write(`[Request]: time:${endTime - startTime} - ${query.url} - ${query.method} - ${JSON.stringify(query.params)} - ${JSON.stringify(query.body)} - ${query.maliciousQuery}\n`);
            this.logStream.write(`[Response]: ${response.message} - ${query.maliciousQuery}\n`);
            if (response.data) {
                this.vulnerabilities.ERROR_BASED.push({
                    query,
                    response,
                });
            }
            await timeout(500);
        }

    }
}

module.exports = SqlInjection;