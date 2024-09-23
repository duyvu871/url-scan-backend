const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const cors = require('cors');
const flash = require('connect-flash');
const AsyncMiddleware = require("./helpers/async-wrapper");
const socket = require("socket.io")
const cache = require("./services/cache");
const http = require("node:http");
const fs = require("node:fs");
const { v4: uuidv4 } = require('uuid');
const hash = require('./helpers/hash');
const validation = require('./services/validation');
const socketLoader = require('./routes/socket');

require('dotenv').config({
    path: path.join(__dirname, '../.env')
});
process.env.NODE_ENV = process.env.NODE_ENV.trim() || 'development';
console.log('Environment:', process.env.NODE_ENV);
global.__basedir = __dirname;
global.__rootdir = path.resolve(__dirname, '../');

fs.mkdirSync(path.join(global.__rootdir, 'storages'), { recursive: true });
fs.mkdirSync(path.join(global.__rootdir, 'storages', 'screenshots'), { recursive: true });

const listenPort = process.env.PORT || 4000;

const app = express();
const apiRouter = express.Router();

app.enable('trust proxy'); // trust first proxy
app.use(cors({
    origin: "*",
})); // enable cors
app.use(bodyParser.json({
    limit: '10mb'
})); // parse application/json
app.use(bodyParser.urlencoded({
    extended: true
})); // parse application/x-www-form-urlencoded
app.use(bodyParser.text()); // parse text/plain
app.use(flash()); // flash messages
app.use(helmet({
    crossOriginResourcePolicy: false,
})); // secure express app
app.get('/health', (req, res) => {
    res.status(200).send('OK').end();
}); // server health check
app.head('/health', (req, res) => {
    res.status(200).send('OK').end();
}); // server health check
app.use("/storages", express.static(path.join(global.__rootdir, 'storages')));

apiRouter.post('/init-scan', AsyncMiddleware.asyncHandler(async (req, res) => {
    if (!req.body.url) return res.status(400).send({error: 'url is required'}).end();
    if (!validation.isValidUrl(req.body.url)) return res.status(400).send({error: 'url is not valid'}).end();
    const clientId = uuidv4();
    cache.set(clientId, {
        url: req.body.url,
        status: 'pending',
        result: null
    });
    res.status(200).send({ clientId }).end();
}));

apiRouter.get('/get-scan-status/:clientId', (req, res) => {
    const cacheData = cache.get(req.params.clientId);
    if (!cacheData) return res.status(404).send({error: 'Client not found'}).end();
    res.status(200).send(cacheData).end();
});

apiRouter.post('/get-technologies', AsyncMiddleware.asyncHandler(async (req, res) => {
    // if (!req.body.url && !req.body.clientId) return res.status(400).send({error: 'url is required'}).end();
    // if (!validation.isValidUrl(req.body.url) && !req.body.clientId) return res.status(400).send({error: 'url is not valid'}).end();
    if (!req.body.clientId) return res.status(200).send({error: 'clientId is not provided'}).end();
    const cacheData = cache.get(req.body.clientId);
    if (!cacheData) return res.status(404).send({error: 'Client not found'}).end();
    const url = cacheData.url;
    const getTechnologies = require('./services/get-technologies');
    const technologies = await getTechnologies(url);
    if (technologies) return res.status(200).send(technologies).end();
    res.status(404).send({error: 'No technologies found'}).end();
}));

apiRouter.post('/take-screenshot', AsyncMiddleware.asyncHandler(async (req, res) => {
    // if (!req.body.url && !req.body.clientId) return res.status(400).send({error: 'url is required'}).end();
    // if ((req.body.url || !validation.isValidUrl(req.body.url)) && !req.body.clientId) return res.status(400).send({error: 'url is not valid'}).end();
    if (!req.body.clientId) return res.status(200).send({error: 'clientId is not provided'}).end();
    const cacheData = cache.get(req.body.clientId);
    if (!cacheData) return res.status(404).send({error: 'Client not found'}).end();
    const url = cacheData.url;
    const takePageScreenShot = require('./services/take-page-screenshot');
    const [err, staticFilePath] = await takePageScreenShot(url);
    if (err) {
        res.status(500).send({
            error: 'Error when take screenshot'
        }).end();
    }
    res.status(200).send({
        path: staticFilePath
    }).end();
}));

apiRouter.post('/domain-dir-buster', AsyncMiddleware.asyncHandler(async (req, res) => {
    if (!req.body.clientId) return res.status(200).send({error: 'clientId is not provided'}).end();
    const cacheData = cache.get(req.body.clientId);
    if (!cacheData) return res.status(404).send({error: 'Client not found'}).end();
    const url = cacheData.url;
    let clientId = req.body.clientId;

    const events = {
        data: (data) => {
            // res.write(data);
            // console.log(data);
            globalThis.__io.of('/dirbuster').to(clientId).emit('data', data);
        },
        error: (err) => {
            console.error('Lỗi khi bắt sự kiện:', err);
            res.status(500).send({ error: 'Error when buster directory' }).end();
        },
        end: () => {
            res.end();
        },
        clientId: clientId
    };

    const domainDirBuster = require('./services/domain-dir-buster');
    domainDirBuster(url, events, 20000);

    res.status(200).send({ clientId }).end();
}));

apiRouter.post('/domain-dir-buster/:clientId/abort', (req, res) => {
    if (globalThis.__dirbusterStream__ && globalThis.__dirbusterStream__[req.params.clientId]) {
        // console.log(req.params.clientId);
        globalThis.__dirbusterStream__[req.params.clientId].end();
        res.status(200).send({ message: 'Aborted' }).end();
    } else {
        res.status(404).send({ error: 'Client not found' }).end();
    }
});

apiRouter.post('/check-headers', AsyncMiddleware.asyncHandler(async (req, res) => {
    if (!req.body.clientId) return res.status(200).send({error: 'clientId is not provided'}).end();
    const cacheData = cache.get(req.body.clientId);
    if (!cacheData) return res.status(404).send({error: 'Client not found'}).end();
    const url = cacheData.url;

    try {
        const headerChecks = require("./services/header-secure-check-message");
        const results = {};
        for (const checkName in headerChecks) {
            results[checkName] = await headerChecks[checkName](url);
        }
        // console.log(results);

        res.json({ results });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
}));

apiRouter.post('/get-headers', AsyncMiddleware.asyncHandler(async (req, res) => {
    if (!req.body.clientId) return res.status(200).send({error: 'clientId is not provided'}).end();
    const cacheData = cache.get(req.body.clientId);
    if (!cacheData) return res.status(404).send({error: 'Client not found'}).end();
    const url = cacheData.url;

    try {
        const headerChecks = require("./services/header-secure-check");
        const headers = await headerChecks.getHeaders(url);
        res.json({ headers });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
}));

apiRouter.post('/nmap', AsyncMiddleware.asyncHandler(async (req, res) => {
    if (!req.body.clientId) return res.status(200).send({error: 'clientId is not provided'}).end();
    const cacheData = cache.get(req.body.clientId);
    if (!cacheData) return res.status(404).send({error: 'Client not found'}).end();
    const url = cacheData.url;

    try {
        const nmap = require("./services/nmap");
        const results = await nmap(url);
        if (!results) return res.status(404).send({error: 'No data found'}).end();
        res.json({ results });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
}));

app.use('/api/v1', apiRouter);

const httpServer = http.createServer(app);
const io = new socket.Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    path: '/socket',
});

global.__io = io;
io.on("connection", (socket) => {
    console.log("User connected");
    socket.on("disconnect", () => {
        console.log("User disconnected");
    });
});
socketLoader.loadDirBuster(io);

httpServer.listen(listenPort).on("listening", () => {
    console.log(`Server is running on http://localhost:${listenPort}`);
});