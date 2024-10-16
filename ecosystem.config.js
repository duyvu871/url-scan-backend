module.exports = {
    apps: [
        {
            name: 'connected-brain-back-end-url-scanner',
            script: 'src/server.js',
            out_file: "./back-end-out.logs",
            error_file: "./back-end-error.logs",
            log_date_format: "DD-MM HH:mm:ss Z",
            env: {
                NODE_ENV: 'development',
                PORT: 4000
            },
            env_production: {
                NODE_ENV: 'production',
                PORT: 4000
            },
        },
    ],
}