module.exports = {
    apps: [
        {
            name: 'connected-brain-back-end',
            script: 'npm run start',
            out_file: "./back-end-out.log",
            error_file: "./back-end-error.log",
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