const { exec } = require('child_process');
const _ = require('lodash')
const {isValidJSON} = require("../helpers/validator");

function getCommand(url, headerName) {
    if (process.env.NODE_ENV === 'development') {
        return `powershell -Command "(Invoke-WebRequest -Uri ${url} -Method Head).Headers | Out-String -Stream | Select-String -Pattern "${headerName}" "`;
    } else {
        return `curl -I ${url} | grep ${headerName}`;
    }
}

function checkHSTS(url) {
    return new Promise((resolve, reject) => {
        const command = getCommand(url, 'Strict-Transport-Security');
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else if (stdout) {
                const includeSubDomains = stdout.includes('includeSubDomains');
                const maxAge = parseInt(stdout.match(/max-age=(\d+)/)[1]);
                resolve({
                    status: includeSubDomains && maxAge >= 31536000 ? 'secure' : 'insecure',
                    header: stdout.trim(),
                });
            } else {
                resolve({ status: 'missing', header: null });
            }
        });
    });
}

function checkXFrameOptions(url) {
    return new Promise((resolve, reject) => {
        const command = getCommand(url, 'X-Frame-Options');
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else if (stdout) {
                resolve({
                    status: stdout.includes('DENY') || stdout.includes('SAMEORIGIN') ? 'secure' : 'insecure',
                    header: stdout.trim(),
                });
            } else {
                resolve({ status: 'missing', header: null });
            }
        });
    });
}

function checkCSP(url) {
    return new Promise((resolve, reject) => {
        const command = getCommand(url, 'Content-Security-Policy');
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else if (stdout) {
                resolve({ status: 'present', header: stdout.trim() });
            } else {
                resolve({ status: 'missing', header: null });
            }
        });
    });
}

function checkReferrerPolicy(url) {
    return new Promise((resolve, reject) => {
        const command = getCommand(url, 'Referrer-Policy');
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else if (stdout) {
                const secureValues = ['no-referrer', 'same-origin', 'strict-origin',
                    'strict-origin-when-cross-origin', 'origin', 'origin-when-cross-origin'];
                resolve({
                    status: secureValues.some(value => stdout.includes(value)) ? 'secure' : 'insecure',
                    header: stdout.trim(),
                });
            } else {
                resolve({ status: 'missing', header: null });
            }
        });
    });
}

function checkXXSSProtection(url) {
    return new Promise((resolve, reject) => {
        const command = getCommand(url, 'X-XSS-Protection');
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else if (stdout) {
                resolve({
                    status: stdout.includes('1; mode=block') ? 'secure' : 'insecure',
                    header: stdout.trim(),
                });
            } else {
                resolve({ status: 'missing', header: null });
            }
        });
    });
}

function checkSecureCookies(url) {
    return new Promise((resolve, reject) => {
        const command = getCommand(url, 'Set-Cookie');
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else if (stdout) {
                const cookies = stdout.trim().split('\n');
                const secureCookies = cookies.filter(cookie => cookie.includes('Secure') && cookie.includes('HttpOnly'));
                resolve({
                    status: secureCookies.length === cookies.length ? 'secure' : 'insecure',
                    cookies: cookies,
                });
            } else {
                resolve({ status: 'no cookies', cookies: [] });
            }
        });
    });
}

function checkXContentTypeOptions(url) {
    return new Promise((resolve, reject) => {
        const command = getCommand(url, 'X-Content-Type-Options');
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else if (stdout) {
                resolve({
                    status: stdout.includes('nosniff') ? 'secure' : 'insecure',
                    header: stdout.trim(),
                });
            } else {
                resolve({ status: 'missing', header: null });
            }
        });
    });
}

function execPromise(command) {
    return new Promise((resolve, reject) => {
        console.log('command:', command);
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {

                console.log('stdout:', stdout);
                resolve({ stdout, stderr });
            }
        });
    });
}

async function getHeaders(url) {
    try {
        if (process.env.NODE_ENV === 'development') {
            const { stdout: headersAsJSON } = await execPromise(`powershell.exe -Command "(Invoke-WebRequest -Uri ${url} -Method Head) | Select-Object -Property * | ConvertTo-Json"`)
            const headerJSON = JSON.parse(isValidJSON(headersAsJSON) ? headersAsJSON : "{}");
            return {
                responseStatusLine: headerJSON.RawContent.split('\n')[0].replace('\r', ''),
                requestHeaders: Object.entries(headerJSON?.Headers || {}).map(item => item.join(": ")),
                responseHeaders: Object.entries(headerJSON.Headers || {}).map(item => item.join(": ")),
            };
        } else {
            const { stdout } = await execPromise(`curl -I ${url}`);

            const headers = stdout.trim().split('\r\n');
            const responseStatusLine = headers.shift();

            const requestHeaders = [];
            const responseHeaders = [];
            let isResponseHeader = false;

            for (const header of headers) {
                if (header === '') {
                    isResponseHeader = true;
                    continue;
                }
                requestHeaders.push(header);
                responseHeaders.push(header);

            }

            return {
                responseStatusLine,
                requestHeaders,
                responseHeaders,
            };
        }
    } catch (error) {
        console.error('Error getting headers:', error);
        return null;
    }
}


async function test() {
    const url = 'https://www.google.com';
    // process.env.NODE_ENV = 'development';
    // console.logs('HSTS:', await checkHSTS(url));
    // console.logs('X-Frame-Options:', await checkXFrameOptions(url));
    // console.logs('CSP:', await checkCSP(url));
    // console.logs('Referrer-Policy:', await checkReferrerPolicy(url));
    // console.logs('X-XSS-Protection:', await checkXXSSProtection(url));
    // console.logs('Secure Cookies:', await checkSecureCookies(url));
    // console.logs('X-Content-Type-Options:', await checkXContentTypeOptions(url));
    const http = require('https'); // Hoặc 'https' cho HTTPS

    const options = {
        hostname: 'nodejs.org',
        // port: 443, // Hoặc 443 cho HTTPS
        path: '/',
        method: 'GET'
    };

    const req = http.request('https://nodejs.org', (res) => {
        // console.logs('Headers:', req.getHeaders());

        res.on('data', (chunk) => {
            // Xử lý data (nếu cần)
        });

        res.on('end', () => {
            // console.logs('Headers:', req.getHeaders());

            console.log('Response kết thúc');
        });
    });

    req.on('error', (error) => {
        console.error('Lỗi:', error);
    });
    req.on('response', (response) => {
        console.log('Headers:', response.headers);

    })
    req.end();
    // console.logs('Headers:', await getHeaders(url));
}
// test();

module.exports = {
    getHeaders,
    checkXContentTypeOptions,
    checkHSTS,
    checkXFrameOptions,
    checkCSP,
    checkReferrerPolicy,
    checkXXSSProtection,
    checkSecureCookies,
};