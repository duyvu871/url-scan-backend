import { Server } from 'socket.io';
import * as stream from "node:stream";

declare global {
    var __basedir: string;
    var __rootdir: string;
    var __io: Server;
    var __dirbusterStream__: Record<string, stream.Writable>
}

export {};