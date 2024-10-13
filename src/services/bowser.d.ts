import { Browser as BrowserType, Page, ElementHandle } from "puppeteer";

export type BrowserOptions = {};

export type RequestOptions = {
    method: "GET" | "POST" | "PUT" | "DELETE";
    body: any;
    headers: Record<string, string>;
};

export declare class Browser {
    initialized: boolean;
    browser: BrowserType;
    page: Page;
    document: ElementHandle<Document>;
    DOM: any;
    hasDisplayed: boolean;
    headless: boolean;
    puppeteerPath: string | undefined;

    isInitialized(headless?: string): boolean;
    uninitialize(): Promise<void>;
    initialize(): Promise<boolean>;
    waitingPageLoad(page: Page): Promise<string>;
    request(url: string, options: RequestOptions): Promise<any>;
    goto(url: string, extraHeader?: Record<string, string>): Promise<void>;
}