const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const { DOM } = require("./utils/dom");
const { logger } = require("./utils/logger");
const clc = require("./utils/cli-color");

class Browser {
    constructor() {
        this.initialized = false;
        this.browser = null;
        this.page = null;
        this.document = null;
        this.DOM = null;
        this.hasDisplayed = false;
        this.headless = process.env.NODE_ENV !== "development";
        this.puppeteerPath = undefined;
    }

    isInitialized(headless = "new") {
        return this.initialized;
    }

    async uninitialize() {
        try {
            await this.browser.close();
            logger("browser closed");
        } catch {
            logger("browser already closed");
        }
    }

    async initialize() {
        if (this.isInitialized()) return this.initialized;
        logger(clc.success("initialize browser"));
        puppeteer.use(StealthPlugin());
        const browser = await puppeteer.launch({
            headless: false, // (this.headless),
            args: [
                "--disable-web-security",
                "--fast-start",
                "--disable-extensions",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--no-gpu",
                "--disable-background-timer-throttling",
                "--disable-renderer-backgrounding",
                "--override-plugin-power-saver-for-testing=never",
                "--disable-extensions-http-throttling",
                "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
            ],
            executablePath: this.puppeteerPath || puppeteer.executablePath(),
            channel: "chrome",
        });
        this.browser = browser;
        let pages = await browser.pages();
        let page = pages[0];
        this.document = await page.evaluateHandle(() => document);
        this.page = page;
        await page.setRequestInterception(false);
        if (process.env.NODE_ENV === "development") {
            await page.setViewport({
                width: 0,
                height: 0,
                deviceScaleFactor: 1,
                hasTouch: true,
                isLandscape: false,
                isMobile: false,
            });
        }
        await page.setJavaScriptEnabled(true);
        page.setDefaultNavigationTimeout(0);
        const userAgent =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36";
        await page.setUserAgent(userAgent);
        this.initialized = true;
        logger(clc.success("browser done setting up"));
        return this.initialized;
    }

    async waitingPageLoad(page) {
        return new Promise(async (resolve) => {
            try {
                let interval;
                let pass = true;
                const minute = 1000 * 60;
                async function check() {
                    if (pass) {
                        pass = false;
                        const waitingRoomTimeLeft = await page.evaluate(
                            async () => {
                                try {
                                    const contentContainer = document.querySelector(
                                        ".content-container"
                                    );
                                    if (!contentContainer) return;
                                    const sections = contentContainer.querySelectorAll("section");
                                    const h2Element = sections[0].querySelector("h2");
                                    const h2Text = h2Element?.innerText || "";
                                    const regex = /\d+/g;
                                    const matches = h2Text.match(regex);
                                    if (matches) return matches[0];
                                } catch (error) {
                                    return;
                                }
                            },
                            minute
                        );
                        const waiting = waitingRoomTimeLeft != null;
                        if (waiting) {
                            logger(
                                `Currently in cloudflare's waiting room. Time left: ${clc.warn(
                                    waitingRoomTimeLeft
                                )}`
                            );
                        } else {
                            clearInterval(interval);
                            resolve("done");
                        }
                        pass = true;
                    }
                }
                interval = setInterval(check, minute);
                await check();
            } catch (error) {
                logger(
                    `There was a fatal error while checking for cloudflare's waiting room.`
                );
                console.log(error);
            }
        });
    }

    async request(url, options) {
        const page = this.page;
        const method = options.method;
        const body = method == "GET" ? {} : options.body;
        const headers = options.headers;
        let response;
        await page.setRequestInterception(true);
        let initialRequest = true;
        page.once("request", (request) => {
            const data = {
                method: method,
                postData: body,
                headers: headers,
            };
            if (request.isNavigationRequest() && !initialRequest) {
                return request.abort();
            }
            try {
                initialRequest = false;
                request.continue(data);
            } catch (error) {
                logger("Non fatal error: " + error);
            }
        });
        response = await page.goto(url, { waitUntil: "networkidle2" });
        return response;
    }

    async goto(url, extraHeader) {
        const page = this.page;
        if (!page) {
            logger("page not found");
            return;
        }
        logger(`go to ${url}`);
        await page.setExtraHTTPHeaders(extraHeader ? extraHeader : {
            accept:
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "accept-language": "vi;q=0.9",
            "cache-control": "no-cache",
            pragma: "no-cache",
            "sec-ch-ua":
                '"Chromium";v="128", "Not;A=Brand";v="24", "Brave";v="128"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": "same-origin",
            "sec-fetch-user": "?1",
            "sec-gpc": "1",
            "upgrade-insecure-requests": "1",
        });
        await page.goto(url);
        this.document = await page.evaluateHandle(() => document);
        this.DOM = new DOM(this.page);
    }
}

module.exports = Browser;