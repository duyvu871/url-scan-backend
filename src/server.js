const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const helmet = require("helmet");
const cors = require("cors");
const flash = require("connect-flash");
const AsyncMiddleware = require("./helpers/async-wrapper");
const socket = require("socket.io");
const cache = require("./services/cache");
const http = require("node:http");
const fs = require("node:fs");
const { v4: uuidv4 } = require("uuid");
const hash = require("./helpers/hash");
const validation = require("./services/validation");
const socketLoader = require("./routes/socket");
const { initRedis, getRedis } = require("./configs/redis");
const {URL} = require("url");
const ipGeoTest = require("./services/ip-geo");
const {nmap} = require("./services/nmap");
const processLookupMiddleware =
    require("./middlewares/process-lookup").processLookup;

require("dotenv").config({
    path: path.posix.join(process.cwd(), ".env"),
});
process.env.NODE_ENV = process.env.NODE_ENV.trim() || "development";
console.log("Environment:", process.env.NODE_ENV);
globalThis.__basedir = __dirname;
globalThis.__rootdir = path.resolve(__dirname, "../");

fs.mkdirSync(path.join(globalThis.__rootdir, "storages"), { recursive: true });
fs.mkdirSync(path.join(globalThis.__rootdir, "storages", "screenshots"), { recursive: true });
fs.mkdirSync(path.join(globalThis.__rootdir, "storages", "dirbuster"), { recursive: true });

const listenPort = process.env.PORT || 4000;
const app = express();

app.enable("trust proxy"); // trust first proxy
app.use(
    cors({
        origin: "*",
    }),
); // enable cors
app.use(
    bodyParser.json({
        limit: "10mb",
    }),
); // parse application/json
app.use(
    bodyParser.urlencoded({
        extended: true,
    }),
); // parse application/x-www-form-urlencoded
app.use(bodyParser.text()); // parse text/plain
app.use(flash()); // flash messages
app.use(
    helmet({
        crossOriginResourcePolicy: false,
    }),
); // secure express app
app.get("/health", (req, res) => {
    res.status(200).send("OK").end();
}); // server health check
app.head("/health", (req, res) => {
    res.status(200).send("OK").end();
}); // server health check
app.use(
    "/storages",
    express.static(path.join(globalThis.__rootdir, "storages")),
);

const apiRouter = express.Router();

apiRouter.post(
    "/init-scan",
    AsyncMiddleware.asyncHandler(async (req, res) => {
        if (!req.body.url)
            return res.status(400).send({ error: "url is required" }).end();
        if (!validation.isValidUrl(req.body.url))
            return res.status(400).send({ error: "url is not valid" }).end();
        const URL = require("url").URL;
        const myURL = new URL(req.body.url);
        const domain = myURL.hostname;
        const isDomainExists =
            await require("./services/dns").checkDomainExists(domain);
        if (!isDomainExists)
            return res.status(404).send({ error: "Domain not found" }).end();
        const clientId = uuidv4();
        const { create } = require("./services/db/scan");
        await create(clientId, {
            url: req.body.url,
            clientId: clientId,
            status: "pending",
            timestamp: Date.now(),
        });
        res.status(200).send({
            url: req.body.url,
            clientId: clientId,
            status: "pending",
            timestamp: Date.now(),
        }).end();
    }),
);

apiRouter.post(
    "/get-dns-info",
    processLookupMiddleware,
    AsyncMiddleware.asyncHandler(async (req, res) => {
        const cacheData = req.cacheData;
        if (!cacheData)
            return res.status(404).send({ error: "Client not found" }).end();
        const execData = await cacheData.exec();
        if (!execData) return res.status(404).send({ error: "Client not found" }).end();
        if (execData.ips && execData.ips?.length) {
            try {
                const asn = execData.asn.country ? execData.asn : await ipGeoTest.getASNInfo(execData.ips[0].ip[0]);
                const geo = execData.geo.country ? execData.geo : await ipGeoTest.getIPInfo(execData.ips[0].ip[0]);

                if (!execData.asn.country || !execData.geo.country) {

                    const update = await require("./services/db/scan").update(
                        execData.clientId,
                        { geo, asn },
                    );
                }
                return res.status(200).send({
                    ips: execData.ips,
                    asn: asn,
                    geo: geo,
                }).end();
            } catch (error) {
                console.error(error);
                return res.status(200).send({ ips: execData.ips }).end();
            }
        }
        const url = execData.url;
        const {
            resolve4,
            resolve6,
        } = require("./services/dns");
        const {getIPInfo, getASNInfo} = require('./services/ip-geo');
        const URL = require("url").URL;
        try {
            const myURL = new URL(url);
            const domain = myURL.hostname;
            const ipInfo = {
                geo: {},
                asn: {},
            };
            const ips = [
                {
                    ip: await resolve4(domain),
                    family: "v4",
                },
                {
                    ip: await resolve6(domain),
                    family: "v6",
                },
            ];
            if (!ips[0].ip.length && !ips[1].ip.length)
                return res.status(404).send({ error: "No DNS info found" }).end();
            if (ips[0].ip[0]) {
                await Promise.all([
                    getIPInfo(ips[0].ip[0]),
                    getASNInfo(ips[0].ip[0]),
                ]).then(([geo, asn]) => {
                    Object.assign(ipInfo, {
                        geo: geo,
                        asn: asn,
                    });
                });
            }
            // console.logs(ipInfo)
            const update = await require("./services/db/scan").update(
                execData.clientId,
                { ips: ips, geo: ipInfo.geo, asn: ipInfo.asn },
            );
            if (!update)
                return res.status(500).send({ error: "Error when update data" }).end();
            return res.status(200).send({
                ips: ips,
                geo: ipInfo.geo,
                asn: ipInfo.asn,
            }).end();
        } catch (e) {
            console.log(e);
            res.status(404).send({ error: "No DNS info found" }).end();
        }
    }),
);

apiRouter.get("/get-scan-status/:clientId",
    AsyncMiddleware.asyncHandler(async (req, res) => {
    const clientId = req.params.clientId;
    if (!clientId)
        return res.status(404).send({ error: "Client not found" }).end();
    const execData = await require('./services/db/scan').get({ clientId }, { _id: 0, __v: 0 });
    if (!execData) return res.status(404).send({ error: "Client not found" }).end();
    res.status(200).send(execData).end();
}));

apiRouter.post(
    "/get-technologies",
    processLookupMiddleware,
    AsyncMiddleware.asyncHandler(async (req, res) => {
        const cacheData = req.cacheData;
        if (!cacheData)
            return res.status(404).send({ error: "Client not found" }).end();
        const execData = await cacheData.exec();
        if (!execData) return res.status(404).send({ error: "Client not found" }).end();
        if (execData.technology) return res.status(200).send(JSON.parse(execData.technology)).end();
        const url = execData.url;
        const getTechnologies = require("./services/get-technologies");
        const technologies = await getTechnologies(url);
        const update = await require("./services/db/scan").update(
            execData.clientId,
            { technology: JSON.stringify(technologies) },
        );
        if (!update)
            return res.status(500).send({ error: "Error when update data" }).end();
        if (technologies) return res.status(200).send(technologies).end();
        res.status(404).send({ error: "No technologies found" }).end();
    }),
);

apiRouter.post(
    "/take-screenshot",
    processLookupMiddleware,
    AsyncMiddleware.asyncHandler(async (req, res) => {
        const cacheData = req.cacheData;
        if (!cacheData)
            return res.status(404).send({ error: "Client not found" }).end();
        const execData = await cacheData.exec();
        if (!execData) return res.status(404).send({ error: "Client not found" }).end();
        if (execData.screenshot)
            return res.status(200).send({ path: execData.screenshot }).end();
        const url = execData.url;
        const takePageScreenShot = require("./services/take-page-screenshot");
        const [err, staticFilePath] = await takePageScreenShot(url);
        if (err) {
            res
                .status(500)
                .send({
                    error: "Error when take screenshot",
                })
                .end();
        }
        const update = await require("./services/db/scan").update(
            execData.clientId,
            { screenshot: staticFilePath },
        );
        if (!update)
            return res.status(500).send({ error: "Error when update data" }).end();
        res
            .status(200)
            .send({
                path: staticFilePath,
            })
            .end();
    }),
);

apiRouter.post(
    "/domain-dir-buster",
    processLookupMiddleware,
    AsyncMiddleware.asyncHandler(async (req, res) => {
        const cacheData = req.cacheData;
        if (!cacheData)
            return res.status(404).send({ error: "Client not found" }).end();
        const execData = await cacheData.exec();
        if (!execData) return res.status(404).send({ error: "Client not found" }).end();
        const url = execData.url;
        let clientId = execData.clientId;

        const events = {
            data: (data) => {
                // res.write(data);
                // console.logs(data);
                globalThis.__io.of("/dirbuster").to(clientId).emit("data", data);
            },
            error: (err) => {
                console.error("Lỗi khi bắt sự kiện:", err);
                res.status(500).send({ error: "Error when buster directory" }).end();
            },
            end: () => {
                res.end();
            },
            clientId: clientId,
        };

        const domainDirBuster = require("./services/domain-dir-buster");
        domainDirBuster(url, events, 20000);

        res.status(200).send({ clientId }).end();
    }),
);

apiRouter.post(
    "/domain-dir-buster/:clientId/abort",
    processLookupMiddleware,
    (req, res) => {
        if (
            globalThis.__dirbusterStream__ &&
            globalThis.__dirbusterStream__[req.params.clientId]
        ) {
            // console.logs(req.params.clientId);
            globalThis.__dirbusterStream__[req.params.clientId].end();
            res.status(200).send({ message: "Aborted" }).end();
        } else {
            res.status(404).send({ error: "Client not found" }).end();
        }
    },
);

apiRouter.post(
    "/check-headers",
    processLookupMiddleware,
    AsyncMiddleware.asyncHandler(async (req, res) => {
        const cacheData = req.cacheData;
        if (!cacheData)
            return res.status(404).send({ error: "Client not found" }).end();
        const execData = await cacheData.exec();
        if (!execData) return res.status(404).send({ error: "Client not found" }).end();
        if (execData.headerChecks)
            return res.status(200).send({
                headerChecks: JSON.parse(execData.headerChecks),
            }).end();
        const url = execData.url;

        try {
            const headerChecks = require("./services/header-secure-check-message");
            const results = [];
            const names = [];
            for (const checkName in headerChecks) {
                names.push(checkName);
                results.push(headerChecks[checkName](url));
            }
            const allResults = await Promise.all(results);
            const responseResults = allResults.reduce((acc, cur, index) => {
                return {
                    ...acc,
                    [names[index]]: cur,
                };
            }, {});
            const update = await require("./services/db/scan").update(
                execData.clientId,
                { headerChecks: JSON.stringify(responseResults) },
            );
            if (!update)
                return res.status(500).send({ error: "Error when update data" }).end();

            res.json({ headerChecks: responseResults }).end();
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Internal server error" });
        }
    }),
);

apiRouter.post(
    "/get-headers",
    processLookupMiddleware,
    AsyncMiddleware.asyncHandler(async (req, res) => {
        const cacheData = req.cacheData;
        if (!cacheData)
            return res.status(404).send({ error: "Client not found" }).end();
        const execData = await cacheData.exec();
        if (!execData) return res.status(404).send({ error: "Client not found" }).end();
        if (execData.headers) return res.status(200).send({
            headers: JSON.parse(execData.headers)
        }).end();
        const url = execData.url;
        try {
            const headerChecks = require("./services/header-secure-check");
            const headers = await headerChecks.getHeaders(url);
            // console.logs(headers);
            const update = await require("./services/db/scan").update(
                execData.clientId,
                { headers: JSON.stringify(headers) },
            );
            if (!update)
                return res.status(500).send({ error: "Error when update data" }).end();
            res.json({ headers });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Internal server error" });
        }
    }),
);

apiRouter.post(
    "/nmap",
    processLookupMiddleware,
    AsyncMiddleware.asyncHandler(async (req, res) => {
        if (!req.body.clientId)
            return res.status(200).send({ error: "clientId is not provided" }).end();
        const cacheData = cache.get(req.body.clientId);
        if (!cacheData)
            return res.status(404).send({ error: "Client not found" }).end();
        const url = cacheData.url;

        try {
            initRedis();
            const nmap = require("./services/nmap");
            // const results = await nmap(url);
            await getRedis().instanceRedis?.publish(
                "nmap",
                JSON.stringify(cacheData),
            );
            // console.logs(results);
            // if (!results) return res.status(404).send({error: 'No data found'}).end();
            res.json({ message: "nmap started" });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Internal server error" });
        }
    }),
);

apiRouter.post("/check-ssl",
    processLookupMiddleware,
    AsyncMiddleware.asyncHandler(async (req, res) => {
        const cacheData = req.cacheData;
        if (!cacheData)
            return res.status(404).send({ error: "Client not found" }).end();
        const execData = await cacheData.exec();
        if (!execData) return res.status(404).send({ error: "Client not found" }).end();
        const url = execData.url;
        try {
            const myURL = new URL(url);
            const domain = myURL.hostname;
            const ssl = require("./services/get-ssl-certificate");
            const checkSSLExpiry = await require("./services/ssl-checker")(domain);
            console.log(checkSSLExpiry)
            const keyPem = (await ssl.get(domain, 10000))?.pemEncoded;
            const checkSSLCert = require("ssl-validator");
            const checkSSL = await checkSSLCert.validateSSL(keyPem);
            const results = {
                checkSSLExpiry,
                checkSSL,
            };
            if (!results) return res.status(404).send({ error: "No data found" }).end();
            res.json({ results });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Internal server error" });
        }
    })
);

app.use("/api/v1", apiRouter);
const httpServer = http.createServer(app);
const io = new socket.Server(httpServer, {
    cors: {
        origin: "*",
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    },
    path: "/socket",
});
globalThis.__io = io;

io.on("connection", (socket) => {
    console.log("User connected", socket.id)

    socket.on('start_nmap_scan', async (data) => {
        try {
            console.log("nmap connected");

            console.log(data);
            const parseData = JSON.parse(data);

            if (!parseData.clientId) {
                socket.emit('error', { error: 'clientId is not provided' });
                return;
            }

            const cacheData = require('./services/db/scan').getOne({ clientId: parseData.clientId });
            if (!cacheData) {
                socket.emit('error', { error: 'clientId is not found' });
                return;
            }

            const executedData = await cacheData.exec();
            console.log(executedData)
            const url = executedData.url;
            const domain = new URL(url).hostname;

            const { nmap } = require("./services/nmap");
            nmap.nmapLocation = "nmap";
            let quickscan = new nmap.NmapScan(`${domain} --min-parallelism 4 --max-parallelism 10 -Pn -sT -vv --stats-every 1s -O --script http-enum`);
            quickscan.on('progress', (data) => {
                socket.emit('progress', data);
                console.log('scanProgress', data);
            });
            quickscan.on('complete', (data) => {
                socket.emit('complete', data);
                console.log(data);
            });

            quickscan.on('error', (error) => {
                socket.emit('error', { error: 'Internal server error' });
                console.log(error);
            });

            quickscan.startScan();
            console.log(data);
            socket.on("disconnect", () => {
                quickscan.cancelScan();
            });
        } catch (e) {
            console.log('nmap error', e);
            socket.emit('error', { error: 'Internal server error' });
        }
    });
});

socketLoader.loadDirBuster(io);

// startNmapSubscribe();

httpServer.listen(listenPort).on("listening", async () => {
    await require("./services/db/loader").loadMongo();
    console.log(`Server is running on http://localhost:${listenPort}`);
});
