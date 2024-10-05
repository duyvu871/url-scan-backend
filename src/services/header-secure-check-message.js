const { exec } = require('child_process');
const _ = require('lodash');

function getCommand(url, headerName) {
    if (process.env.NODE_ENV === 'development') {
        return `powershell -Command "(Invoke-WebRequest -Uri ${url} -UseBasicParsing).Headers['${headerName}']"`;
    } else {
        return `curl -I ${url} | grep '${headerName.toLowerCase()}'`;
    }
}

function execPromise(command) {
    return new Promise((resolve, reject) => {
        try {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.log(`Lỗi khi thực thi lệnh: ${command}`, error);
                    reject(null);
                } else {
                    resolve({ stdout, stderr });
                }
            });
        } catch (e) {
            console.error(`Lỗi khi thực thi lệnh: ${command}`, e);
            reject(null);
        }
    });
}

const headerChecks = {
    checkHSTS: async (url) => {
        const command = getCommand(url, 'Strict-Transport-Security');
        try {
            const { stdout } = await execPromise(command);
            if (stdout) {
                const includeSubDomains = stdout.includes('includeSubDomains');
                const maxAge = parseInt(stdout.match(/max-age=(\d+)/)?.[1] || "0");
                const status = includeSubDomains && maxAge >= 31536000 ? 'secure' : 'insecure';
                const message = includeSubDomains && maxAge >= 31536000
                    ? "HSTS được cấu hình an toàn với includeSubDomains và max-age ít nhất 1 năm."
                    : "HSTS được cấu hình không an toàn, thiếu includeSubDomains hoặc max-age quá ngắn.";
                return { status, header: stdout.trim(), message };
            } else {
                return { status: 'missing', header: null, message: "Không tìm thấy header HSTS. Website dễ bị tấn công Man-in-the-Middle." };
            }
        } catch (e) {
            return { status: 'error', header: null, message: e.message };
        }
    },

    checkXFrameOptions: async (url) => {
        const command = getCommand(url, 'X-Frame-Options');
        try {
            const { stdout } = await execPromise(command);
            if (stdout) {
                const status = stdout.includes('DENY') || stdout.includes('SAMEORIGIN') ? 'secure' : 'insecure';
                const message = status === 'secure'
                    ? "X-Frame-Options được cấu hình an toàn, ngăn chặn clickjacking."
                    : "X-Frame-Options được cấu hình không an toàn, cho phép framing từ một số nguồn.";
                return { status, header: stdout.trim(), message };
            } else {
                return { status: 'missing', header: null, message: "Không tìm thấy header X-Frame-Options. Website dễ bị tấn công clickjacking." };
            }
        } catch (e) {
            return { status: 'error', header: null, message: e.message };
        }
    },

    checkXContentTypeOptions: async (url) => {
        const command = getCommand(url, 'X-Content-Type-Options');
        try {
            const { stdout } = await execPromise(command);
            if (stdout) {
                const status = stdout.includes('nosniff') ? 'secure' : 'insecure';
                const message = status === 'secure'
                    ? "X-Content-Type-Options được cấu hình an toàn, ngăn chặn MIME sniffing."
                    : "X-Content-Type-Options được cấu hình không an toàn.";
                return { status, header: stdout.trim(), message };
            } else {
                return { status: 'missing', header: null, message: "Không tìm thấy header X-Content-Type-Options. Website dễ bị tấn công MIME sniffing." };
            }
        } catch (e) {
            return { status: 'error', header: null, message: e.message };
        }
    },

    checkCSP: async (url) => {
        const command = getCommand(url, 'Content-Security-Policy');
        try {
            const { stdout } = await execPromise(command);
            if (stdout) {
                return { status: 'present', header: stdout.trim(), message: "Header CSP được cấu hình. Cần kiểm tra chi tiết chính sách để đánh giá mức độ an toàn." };
            } else {
                return { status: 'missing', header: null, message: "Không tìm thấy header CSP. Website dễ bị tấn công XSS và các loại tấn công injection khác." };
            }
        } catch (e) {
            return { status: 'error', header: null, message: e.message };
        }
    },

    checkReferrerPolicy: async (url) => {
        const command = getCommand(url, 'Referrer-Policy');
        try {
            const { stdout } = await execPromise(command);
            if (stdout) {
                const secureValues = ['no-referrer', 'same-origin', 'strict-origin',
                    'strict-origin-when-cross-origin', 'origin', 'origin-when-cross-origin'];
                const status = secureValues.some(value => stdout.includes(value)) ? 'secure' : 'insecure';
                const message = status === 'secure'
                    ? "Referrer-Policy được cấu hình an toàn, bảo vệ thông tin referrer."
                    : "Referrer-Policy được cấu hình không an toàn, có thể tiết lộ thông tin referrer.";
                return { status, header: stdout.trim(), message };
            } else {
                return { status: 'missing', header: null, message: "Không tìm thấy header Referrer-Policy. Website có thể tiết lộ thông tin referrer không cần thiết." };
            }
        } catch (e) {
            return { status: 'error', header: null, message: e.message };
        }
    },

    checkXXSSProtection: async (url) => {
        const command = getCommand(url, 'X-XSS-Protection');
        try {
            const { stdout } = await execPromise(command);
            if (stdout) {
                const status = stdout.includes('1; mode=block') ? 'secure' : 'insecure';
                const message = status === 'secure'
                    ? "X-XSS-Protection được cấu hình an toàn, kích hoạt bộ lọc XSS của trình duyệt và chặn các phản hồi bị nghi ngờ."
                    : "X-XSS-Protection được cấu hình không an toàn, vô hiệu hóa bộ lọc XSS của trình duyệt.";
                return { status, header: stdout.trim(), message };
            } else {
                return { status: 'missing', header: null, message: "Không tìm thấy header X-XSS-Protection. Website dễ bị tấn công XSS." };
            }
        } catch (e) {
            return { status: 'error', header: null, message: e.message };
        }
    },

    checkSecureCookies: async (url) => {
        const command = getCommand(url, 'Set-Cookie');
        try {
            const { stdout } = await execPromise(command);
            if (stdout) {
                const cookies = stdout.trim().split('\n');
                const secureCookies = cookies.filter(cookie => cookie.includes('Secure') && cookie.includes('HttpOnly'));
                const status = secureCookies.length === cookies.length ? 'secure' : 'insecure';
                const message = status === 'secure'
                    ? "Tất cả cookies được cấu hình an toàn với Secure và HttpOnly flags."
                    : "Một số cookies không được cấu hình với Secure và HttpOnly flags. Dữ liệu cookie dễ bị đánh cắp.";
                return { status, header: stdout.trim(), message };
            } else {
                return { status: 'no cookies', header: null, message: "Không tìm thấy cookie nào." };
            }
        } catch (e) {
            return { status: 'error', header: null, message: e.message };
        }
    }
};

module.exports = headerChecks;