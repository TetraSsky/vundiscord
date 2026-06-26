/*
 * Vencord, a Discord client mod
 * Based on Undiscord by victornpb <https://github.com/victornpb/undiscord>
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";

const logger = new Logger("UndiscordCore");

export const wait = (ms: number) => new Promise<void>(done => setTimeout(done, ms));
export const msToHMS = (s: number) =>
    `${Math.floor(s / 3.6e6)}h ${Math.floor((s % 3.6e6) / 6e4)}m ${Math.floor((s % 6e4) / 1000)}s`;

export const toSnowflake = (date: string) =>
    /:/.test(date)
        ? ((new Date(date).getTime() - 1420070400000) * Math.pow(2, 22))
        : date;

export interface UndiscordOptions {
    authToken: string | null;
    authorId: string | null;
    guildId: string | null;
    channelId: string | null;
    minId: string | null;
    maxId: string | null;
    content: string | null;
    hasLink: boolean | null;
    hasFile: boolean | null;
    includeNsfw: boolean | null;
    includePinned: boolean | null;
    pattern: string | null;
    searchDelay: number;
    deleteDelay: number;
    maxAttempt: number;
    askForConfirmation: boolean;
}

export interface UndiscordState {
    running: boolean;
    delCount: number;
    failCount: number;
    grandTotal: number;
    offset: number;
    iterations: number;
    _searchResponse: any;
    _messagesToDelete: any[];
    _skippedMessages: any[];
}

export interface UndiscordStats {
    startTime: Date;
    endTime?: Date;
    throttledCount: number;
    throttledTotalTime: number;
    lastPing: number | null;
    avgPing: number | null;
    etr: number;
}

export type LogLevel = "debug" | "info" | "verb" | "warn" | "error" | "success";

export type LogFn = (level: LogLevel, ...args: any[]) => void;
export type EventCallback = (state: UndiscordState, stats: UndiscordStats) => void;

export class UndiscordCore {
    options: UndiscordOptions = {
        authToken: null,
        authorId: null,
        guildId: null,
        channelId: null,
        minId: null,
        maxId: null,
        content: null,
        hasLink: null,
        hasFile: null,
        includeNsfw: null,
        includePinned: null,
        pattern: null,
        searchDelay: 30000,
        deleteDelay: 1000,
        maxAttempt: 2,
        askForConfirmation: true,
    };

    state: UndiscordState = {
        running: false,
        delCount: 0,
        failCount: 0,
        grandTotal: 0,
        offset: 0,
        iterations: 0,
        _searchResponse: null,
        _messagesToDelete: [],
        _skippedMessages: [],
    };

    stats: UndiscordStats = {
        startTime: new Date(),
        throttledCount: 0,
        throttledTotalTime: 0,
        lastPing: null,
        avgPing: null,
        etr: 0,
    };

    onStart: EventCallback | undefined;
    onProgress: EventCallback | undefined;
    onStop: EventCallback | undefined;
    onLog: LogFn | undefined;

    private _beforeTs = 0;
    private _stopResolve: (() => void) | null = null;

    resetState() {
        this.state = {
            running: false,
            delCount: 0,
            failCount: 0,
            grandTotal: 0,
            offset: 0,
            iterations: 0,
            _searchResponse: null,
            _messagesToDelete: [],
            _skippedMessages: [],
        };
        this.options.askForConfirmation = true;
    }

    private log(level: LogLevel, ...args: any[]) {
        if (this.onLog) this.onLog(level, ...args);
        switch (level) {
            case "error": logger.error(...args); break;
            case "warn": logger.warn(...args); break;
            case "debug": logger.debug(...args); break;
            default: logger.info(...args); break;
        }
    }

    async runBatch(queue: Partial<UndiscordOptions>[]) {
        if (this.state.running) return this.log("error", "Already running!");

        this.log("info", `Running batch with queue of ${queue.length} jobs`);
        for (let i = 0; i < queue.length; i++) {
            const job = queue[i];
            this.log("info", "Starting job...", `(${i + 1}/${queue.length})`);

            this.options = { ...this.options, ...job };

            await this.run(true);
            if (!this.state.running) break;

            this.log("info", "Job ended.", `(${i + 1}/${queue.length})`);
            this.resetState();
            this.options.askForConfirmation = false;
            this.state.running = true;
        }

        this.log("info", "Batch finished.");
        this.state.running = false;
    }

    async run(isJob = false) {
        if (this.state.running && !isJob) return this.log("error", "Already running!");

        this.state.running = true;
        this.stats.startTime = new Date();

        this.log("success", `\nStarted at ${this.stats.startTime.toLocaleString()}`);
        this.log("debug",
            `authorId = "${this.options.authorId}"`,
            `guildId = "${this.options.guildId}"`,
            `channelId = "${this.options.channelId}"`,
            `searchDelay = ${this.options.searchDelay}ms`,
            `deleteDelay = ${this.options.deleteDelay}ms`,
        );

        if (this.onStart) this.onStart(this.state, this.stats);

        do {
            this.state.iterations++;

            this.log("verb", "Fetching messages...");
            await this.search();

            await this.filterResponse();

            this.log("verb",
                `Grand total: ${this.state.grandTotal}`,
                `To be deleted: ${this.state._messagesToDelete.length}`,
                `Skipped: ${this.state._skippedMessages.length}`,
            );
            this.printStats();

            this.calcEtr();
            this.log("verb", `Estimated time remaining: ${msToHMS(this.stats.etr)}`);

            if (this.state._messagesToDelete.length > 0) {
                if (await this.confirm() === false) {
                    this.state.running = false;
                    break;
                }
                await this.deleteMessagesFromList();

                if (this.state.delCount + this.state.failCount >= this.state.grandTotal) {
                    this.state.running = false;
                    break;
                }
            } else if (this.state._skippedMessages.length > 0) {
                this.state.offset += this.state._skippedMessages.length;
                this.log("verb", "There's nothing we can delete on this page, checking next page...");
            } else if (this.state.grandTotal > 0 && this.state.iterations < 2) {
                this.log("warn", "API reported results but returned no messages. Retrying in 30s...");
                await wait(30000);
                continue;
            } else {
                this.log("verb", "Ended because API returned an empty page.");
                if (isJob) break;
                this.state.running = false;
                break;
            }

            this.log("verb", `Waiting ${(this.options.searchDelay / 1000).toFixed(2)}s before next page...`);

            // Wait for the search delay or stop
            await Promise.race([
                wait(this.options.searchDelay),
                new Promise<void>(r => { this._stopResolve = r; }),
            ]);

        } while (this.state.running);

        this.stats.endTime = new Date();
        this.log("success", `Ended at ${this.stats.endTime!.toLocaleString()}! Total time: ${msToHMS(this.stats.endTime!.getTime() - this.stats.startTime.getTime())}`);
        this.printStats();
        this.log("debug", `Deleted ${this.state.delCount} messages, ${this.state.failCount} failed.\n`);

        if (this.onStop) this.onStop(this.state, this.stats);
    }

    stop() {
        this.state.running = false;
        this._stopResolve?.();
        if (this.onStop) this.onStop(this.state, this.stats);
    }

    calcEtr() {
        this.stats.etr =
            (this.options.searchDelay * Math.round(this.state.grandTotal / 25)) +
            ((this.options.deleteDelay + (this.stats.avgPing ?? 500)) * this.state.grandTotal);
    }

    async confirm(): Promise<boolean> {
        if (!this.options.askForConfirmation) return true;
        this.log("verb", "Waiting for your confirmation...");

        const preview = this.state._messagesToDelete
            .slice(0, 5)
            .map((m: any) =>
                `${m.author.username}#${m.author.discriminator}: ${m.attachments?.length ? "[ATTACHMENTS]" : (m.content || "[empty]")}`)
            .join("\n");

        const confirmed = window.confirm(
            `Do you want to delete ~${this.state.grandTotal} messages? (Estimated time: ${msToHMS(this.stats.etr)})\n\n` +
            `---- Preview (first 5) ----\n${preview}`
        );

        if (!confirmed) {
            this.log("error", "Aborted by you!");
            return false;
        }
        this.log("verb", "OK");
        this.options.askForConfirmation = false;
        return true;
    }

    async search() {
        let API_SEARCH_URL: string;
        if (this.options.guildId === "@me") {
            API_SEARCH_URL = `https://discord.com/api/v9/channels/${this.options.channelId}/messages/`;
        } else {
            API_SEARCH_URL = `https://discord.com/api/v9/guilds/${this.options.guildId}/messages/`;
        }

        const params = new URLSearchParams();
        if (this.options.authorId) params.append("author_id", this.options.authorId);
        if (this.options.guildId !== "@me" && this.options.channelId) params.append("channel_id", this.options.channelId);
        if (this.options.minId) params.append("min_id", String(toSnowflake(this.options.minId)));
        if (this.options.maxId) params.append("max_id", String(toSnowflake(this.options.maxId)));
        params.append("sort_by", "timestamp");
        params.append("sort_order", "desc");
        params.append("offset", String(this.state.offset));
        if (this.options.hasLink) params.append("has", "link");
        if (this.options.hasFile) params.append("has", "file");
        if (this.options.content) params.append("content", this.options.content);
        if (this.options.includeNsfw) params.append("include_nsfw", "true");

        let resp: Response;
        try {
            this.beforeRequest();
            resp = await fetch(API_SEARCH_URL + "search?" + params.toString() + "&_=" + Date.now(), {
                headers: { "Authorization": this.options.authToken! },
                cache: "no-store",
            });
            this.afterRequest();
        } catch (err) {
            this.state.running = false;
            this.log("error", "Search request threw an error:", err);
            throw err;
        }

        if (resp.status === 202) {
            let w = ((await resp.json()).retry_after ?? 0) * 1000;
            w = w || this.options.searchDelay;
            this.stats.throttledCount++;
            this.stats.throttledTotalTime += w;
            this.log("warn", `This channel isn't indexed yet. Waiting ${w}ms...`);
            await wait(w);
            return await this.search();
        }

        if (!resp.ok) {
            if (resp.status === 429) {
                let w = ((await resp.json()).retry_after ?? 0) * 1000;
                w = w || this.options.searchDelay;
                this.stats.throttledCount++;
                this.stats.throttledTotalTime += w;
                this.options.searchDelay += w;
                w = this.options.searchDelay;
                this.log("warn", `Rate limited for ${w}ms! Increasing search delay...`);
                await wait(w * 2);
                return await this.search();
            } else {
                this.state.running = false;
                const body = await resp.json().catch(() => resp.statusText);
                this.log("error", `Error searching messages, API responded with status ${resp.status}!`, body);
                throw resp;
            }
        }

        const data = await resp.json();
        this.state._searchResponse = data;
        return data;
    }

    async filterResponse() {
        const data = this.state._searchResponse;
        const total = data.total_results;
        if (total > this.state.grandTotal) this.state.grandTotal = total;

        const discoveredMessages = data.messages.map((convo: any[]) =>
            convo.find((message: any) => message.hit === true)
        );

        let messagesToDelete = discoveredMessages.filter(
            (msg: any) => msg.type === 0 || (msg.type >= 6 && msg.type <= 21)
        );
        messagesToDelete = messagesToDelete.filter(
            (msg: any) => msg.pinned ? this.options.includePinned : true
        );

        if (this.options.pattern) {
            try {
                const regex = new RegExp(this.options.pattern, "i");
                messagesToDelete = messagesToDelete.filter((msg: any) => regex.test(msg.content));
            } catch (e) {
                this.log("warn", "Ignoring RegExp because pattern is malformed!", e);
            }
        }

        const skippedMessages = discoveredMessages.filter(
            (msg: any) => !messagesToDelete.find((m: any) => m.id === msg.id)
        );

        this.state._messagesToDelete = messagesToDelete;
        this.state._skippedMessages = skippedMessages;
    }

    async deleteMessagesFromList() {
        for (let i = 0; i < this.state._messagesToDelete.length; i++) {
            const message = this.state._messagesToDelete[i];
            if (!this.state.running) return this.log("error", "Stopped by you!");

            this.log("debug",
                `[${this.state.delCount + 1}/${this.state.grandTotal}] ` +
                `${new Date(message.timestamp).toLocaleString()} ` +
                `${message.author.username}#${message.author.discriminator}: ` +
                `${(message.content || "").replace(/\n/g, "↵")}` +
                (message.attachments?.length ? ` [ATTACHMENTS:${message.attachments.length}]` : ""),
                `{ID:${message.id}}`
            );

            let attempt = 0;
            while (attempt < this.options.maxAttempt) {
                const result = await this.deleteMessage(message);
                if (result === "RETRY") {
                    attempt++;
                    this.log("verb", `Retrying in ${this.options.deleteDelay}ms... (${attempt}/${this.options.maxAttempt})`);
                    await wait(this.options.deleteDelay);
                } else break;
            }

            this.calcEtr();
            if (this.onProgress) this.onProgress(this.state, this.stats);

            await wait(this.options.deleteDelay);
        }
    }

    async deleteMessage(message: any): Promise<"OK" | "RETRY" | "FAILED" | "FAIL_SKIP"> {
        const API_DELETE_URL = `https://discord.com/api/v9/channels/${message.channel_id}/messages/${message.id}`;
        let resp: Response;
        try {
            this.beforeRequest();
            resp = await fetch(API_DELETE_URL, {
                method: "DELETE",
                headers: { "Authorization": this.options.authToken! },
                cache: "no-store",
            });
            this.afterRequest();
        } catch (err) {
            this.log("error", "Delete request threw an error:", err);
            this.state.failCount++;
            return "FAILED";
        }

        if (!resp.ok) {
            if (resp.status === 429) {
                const w = ((await resp.json()).retry_after ?? 1) * 1000;
                this.stats.throttledCount++;
                this.stats.throttledTotalTime += w;
                this.options.deleteDelay = w;
                this.log("warn", `Rate limited for ${w}ms! Adjusted delete delay.`);
                await wait(w * 2);
                return "RETRY";
            } else {
                const body = await resp.text();
                try {
                    const r = JSON.parse(body);
                    if (resp.status === 400 && r.code === 50083) {
                        this.log("warn", "Thread is archived. Skipping message...");
                        this.state.offset++;
                        this.state.failCount++;
                        return "FAIL_SKIP";
                    }
                    this.log("error", `Error deleting message, API responded with status ${resp.status}!`, r);
                } catch {
                    this.log("error", `Error deleting message, status ${resp.status}: ${body}`);
                }
                this.state.failCount++;
                return "FAILED";
            }
        }

        this.state.delCount++;
        return "OK";
    }

    private beforeRequest() {
        this._beforeTs = Date.now();
    }

    private afterRequest() {
        this.stats.lastPing = Date.now() - this._beforeTs;
        this.stats.avgPing =
            this.stats.avgPing && this.stats.avgPing > 0
                ? this.stats.avgPing * 0.9 + this.stats.lastPing * 0.1
                : this.stats.lastPing;
    }

    printStats() {
        this.log("verb",
            `Delete delay: ${this.options.deleteDelay}ms, Search delay: ${this.options.searchDelay}ms`,
            `Last Ping: ${this.stats.lastPing}ms, Average Ping: ${(this.stats.avgPing ?? 0) | 0}ms`,
        );
        this.log("verb",
            `Rate Limited: ${this.stats.throttledCount} times.`,
            `Total time throttled: ${msToHMS(this.stats.throttledTotalTime)}.`
        );
    }
}
