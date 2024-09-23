const { exec } = require('child_process');

const headerChecks = {
    checkHSTS: async (url) => {
        const command = process.env.NODE_ENV === 'development'
            ? `powershell -Command "(Invoke-WebRequest -Uri ${url} -UseBasicParsing).Headers['Strict-Transport-Security']"`
            : `curl -I ${url} | grep Strict-Transport-Security`;

        const { stdout } = await execPromise(command);
        if (stdout) {
            const includeSubDomains = stdout.includes('includeSubDomains');
            const maxAge = parseInt(stdout.match(/max-age=(\d+)/)?.[1] || "0");
            return includeSubDomains && maxAge >= 31536000
                ? "HSTS is configured securely with includeSubDomains and max-age of at least 1 year."
                : "HSTS is configured insecurely, missing includeSubDomains or max-age is too short.";
        } else {
            return "HSTS header not found. Website is vulnerable to Man-in-the-Middle attacks.";
        }
    },

    checkXFrameOptions: async (url) => {
        const command = process.env.NODE_ENV === 'development'
            ? `powershell -Command "(Invoke-WebRequest -Uri ${url} -UseBasicParsing).Headers['X-Frame-Options']"`
            : `curl -I ${url} | grep X-Frame-Options`;

        const { stdout } = await execPromise(command);
        if (stdout) {
            return stdout.includes('DENY') || stdout.includes('SAMEORIGIN')
                ? "X-Frame-Options is configured securely, preventing clickjacking."
                : "X-Frame-Options is configured insecurely, allowing framing from certain sources.";
        } else {
            return "X-Frame-Options header not found. Website is vulnerable to clickjacking attacks.";
        }
    },

    checkXContentTypeOptions: async (url) => {
        const command = process.env.NODE_ENV === 'development'
            ? `powershell -Command "(Invoke-WebRequest -Uri ${url} -UseBasicParsing).Headers['X-Content-Type-Options']"`
            : `curl -I ${url} | grep X-Content-Type-Options`;

        const { stdout } = await execPromise(command);
        if (stdout) {
            return stdout.includes('nosniff')
                ? "X-Content-Type-Options is configured securely, preventing MIME sniffing."
                : "X-Content-Type-Options is configured insecurely.";
        } else {
            return "X-Content-Type-Options header not found. Website is vulnerable to MIME sniffing attacks.";
        }
    },

    checkCSP: async (url) => {
        const command = process.env.NODE_ENV === 'development'
            ? `powershell -Command "(Invoke-WebRequest -Uri ${url} -UseBasicParsing).Headers['Content-Security-Policy']"`
            : `curl -I ${url} | grep Content-Security-Policy`;

        const { stdout } = await execPromise(command);
        return stdout
            ? "CSP header is configured. Detailed policy inspection is needed to assess security level."
            : "CSP header not found. Website is vulnerable to XSS and other injection attacks.";
    },

    checkReferrerPolicy: async (url) => {
        const command = process.env.NODE_ENV === 'development'
            ? `powershell -Command "(Invoke-WebRequest -Uri ${url} -UseBasicParsing).Headers['Referrer-Policy']"`
            : `curl -I ${url} | grep Referrer-Policy`;

        const { stdout } = await execPromise(command);
        if (stdout) {
            const secureValues = ['no-referrer', 'same-origin', 'strict-origin',
                'strict-origin-when-cross-origin', 'origin', 'origin-when-cross-origin'];
            return secureValues.some(value => stdout.includes(value))
                ? "Referrer-Policy is configured securely, protecting referrer information."
                : "Referrer-Policy is configured insecurely, potentially disclosing referrer information.";
        } else {
            return "Referrer-Policy header not found. Website may leak unnecessary referrer information.";
        }
    },

    checkXXSSProtection: async (url) => {
        const command = process.env.NODE_ENV === 'development'
            ? `powershell -Command "(Invoke-WebRequest -Uri ${url} -UseBasicParsing).Headers['X-XSS-Protection']"`
            : `curl -I ${url} | grep X-XSS-Protection`;

        const { stdout } = await execPromise(command);
        if (stdout) {
            return stdout.includes('1; mode=block')
                ? "X-XSS-Protection is configured securely, enabling browser's XSS filter and blocking suspicious responses."
                : "X-XSS-Protection is configured insecurely, disabling browser's XSS filter.";
        } else {
            return "X-XSS-Protection header not found. Website is vulnerable to XSS attacks.";
        }
    },

    checkSecureCookies: async (url) => {
        const command = process.env.NODE_ENV === 'development'
            ? `powershell -Command "(Invoke-WebRequest -Uri ${url} -UseBasicParsing).Headers['Set-Cookie']"`
            : `curl -I ${url} | grep Set-Cookie`;

        const { stdout } = await execPromise(command);
        if (stdout) {
            const cookies = stdout.trim().split('\n');
            const secureCookies = cookies.filter(cookie => cookie.includes('Secure') && cookie.includes('HttpOnly'));
            return secureCookies.length === cookies.length
                ? "All cookies are configured securely with Secure and HttpOnly flags."
                : "Some cookies are not configured with Secure and HttpOnly flags. Cookie data is vulnerable to theft.";
        } else {
            return "No cookies found.";
        }
    }
};

function execPromise(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(null);
            } else {
                resolve({ stdout, stderr });
            }
        });
    });
}

module.exports = headerChecks;