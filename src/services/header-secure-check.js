const { exec } = require('child_process');

function checkHSTS(url) {
    return new Promise((resolve, reject) => {
        exec(`curl -I ${url} | grep Strict-Transport-Security`, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else if (stdout) {
                // Header an toàn nếu includeSubDomains và max-age >= 1 năm
                const includeSubDomains = stdout.includes('includeSubDomains');
                const maxAge = parseInt(stdout.match(/max-age=(\d+)/)[1]);
                resolve({
                    status: includeSubDomains && maxAge >= 31536000 ? 'secure' : 'insecure',
                    header: stdout.trim()
                });
            } else {
                resolve({ status: 'missing', header: null });
            }
        });
    });
}

function checkXFrameOptions(url) {
    return new Promise((resolve, reject) => {
        exec(`curl -I ${url} | grep X-Frame-Options`, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else if (stdout) {
                // Header an toàn nếu là DENY hoặc SAMEORIGIN
                resolve({
                    status: stdout.includes('DENY') || stdout.includes('SAMEORIGIN') ? 'secure' : 'insecure',
                    header: stdout.trim()
                });
            } else {
                resolve({ status: 'missing', header: null });
            }
        });
    });
}

function checkCSP(url) {
    return new Promise((resolve, reject) => {
        exec(`curl -I ${url} | grep Content-Security-Policy`, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else if (stdout) {
                // Kiểm tra CSP phức tạp hơn, cần phân tích chi tiết
                // Ở đây chỉ kiểm tra sự tồn tại của header
                resolve({ status: 'present', header: stdout.trim() });
            } else {
                resolve({ status: 'missing', header: null });
            }
        });
    });
}

function checkReferrerPolicy(url) {
    return new Promise((resolve, reject) => {
        exec(`curl -I ${url} | grep Referrer-Policy`, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else if (stdout) {
                // Header an toàn nếu là no-referrer, same-origin, strict-origin,
                // strict-origin-when-cross-origin, origin, origin-when-cross-origin
                const secureValues = ['no-referrer', 'same-origin', 'strict-origin',
                    'strict-origin-when-cross-origin', 'origin', 'origin-when-cross-origin'];
                resolve({
                    status: secureValues.some(value => stdout.includes(value)) ? 'secure' : 'insecure',
                    header: stdout.trim()
                });
            } else {
                resolve({ status: 'missing', header: null });
            }
        });
    });
}

function checkXXSSProtection(url) {
    return new Promise((resolve, reject) => {
        exec(`curl -I ${url} | grep X-XSS-Protection`, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else if (stdout) {
                // Header an toàn nếu là 1; mode=block
                resolve({
                    status: stdout.includes('1; mode=block') ? 'secure' : 'insecure',
                    header: stdout.trim()
                });
            } else {
                resolve({ status: 'missing', header: null });
            }
        });
    });
}

function checkSecureCookies(url) {
    return new Promise((resolve, reject) => {
        exec(`curl -I ${url} | grep Set-Cookie`, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else if (stdout) {
                // Kiểm tra từng cookie xem có Secure và HttpOnly hay không
                const cookies = stdout.trim().split('\n');
                const secureCookies = cookies.filter(cookie => cookie.includes('Secure') && cookie.includes('HttpOnly'));
                resolve({
                    status: secureCookies.length === cookies.length ? 'secure' : 'insecure',
                    cookies: cookies
                });
            } else {
                resolve({ status: 'no cookies', cookies: [] });
            }
        });
    });
}

function checkXContentTypeOptions(url) {
    return new Promise((resolve, reject) => {
        exec(`curl -I ${url} | grep X-Content-Type-Options`, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else if (stdout) {
                // Header an toàn nếu là nosniff
                resolve({
                    status: stdout.includes('nosniff') ? 'secure' : 'insecure',
                    header: stdout.trim()
                });
            } else {
                resolve({ status: 'missing', header: null });
            }
        });
    });
}

function execPromise(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                resolve({ stdout, stderr });
            }
        });
    });
}

async function getHeaders(url) {
    try {
        const { stdout } = await execPromise(`curl -I ${url}`);

        const headers = stdout.trim().split('\r\n');
        const responseStatusLine = headers.shift(); // Lấy dòng trạng thái phản hồi

        const requestHeaders = [];
        const responseHeaders = [];
        let isResponseHeader = false;

        for (const header of headers) {
            if (header === '') { // Dòng trống phân cách header request và response
                isResponseHeader = true;
                continue;
            }

            if (isResponseHeader) {
                responseHeaders.push(header);
            } else {
                requestHeaders.push(header);
            }
        }

        return {
            responseStatusLine,
            requestHeaders,
            responseHeaders,
        };
    } catch (error) {
        console.error('Error getting headers:', error);
        return null;
    }
}

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