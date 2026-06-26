/*
 * Vencord, a Discord client mod
 * Based on Undiscord by victornpb <https://github.com/victornpb/undiscord>
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useSettings } from "@api/Settings";
import { classes } from "@utils/misc";
import { findByPropsLazy } from "@webpack";
import { Button, Forms, React, TextInput, Tooltip, useEffect, useRef, useState } from "@webpack/common";

import type { LogFn, LogLevel, UndiscordCore } from "./core";
import { msToHMS } from "./core";

function cl(...args: (string | false | null | undefined)[]) {
    return args.filter(Boolean).map(c => `vc-undiscord-${c}`).join(" ");
}


const getGuildId = () => {
    const m = location.href.match(/channels\/([\w@]+)\/(\d+)/);
    return m?.[1] ?? null;
};

const getChannelId = () => {
    const m = location.href.match(/channels\/([\w@]+)\/(\d+)/);
    return m?.[2] ?? null;
};

function randomId() {
    return Math.random().toString(36).slice(2, 10);
}

interface LogEntry {
    id: string;
    level: LogLevel;
    text: string;
}


interface UndiscordPanelProps {
    core: UndiscordCore;
    onClose: () => void;
}

export function UndiscordPanel({ core, onClose }: UndiscordPanelProps) {
    const { settings: pluginSettings } = useSettings();
    const undiscordSettings = (pluginSettings?.Undiscord ?? {}) as Record<string, any>;

    const [authorId, setAuthorId] = useState(undiscordSettings.authorId ?? "");
    const [guildId, setGuildId] = useState(undiscordSettings.guildId ?? "");
    const [channelId, setChannelId] = useState(undiscordSettings.channelId ?? "");
    const [includeNsfw, setIncludeNsfw] = useState(undiscordSettings.includeNsfw ?? false);
    const [searchText, setSearchText] = useState(undiscordSettings.searchText ?? "");
    const [hasLink, setHasLink] = useState(undiscordSettings.hasLink ?? false);
    const [hasFile, setHasFile] = useState(undiscordSettings.hasFile ?? false);
    const [includePinned, setIncludePinned] = useState(undiscordSettings.includePinned ?? false);
    const [pattern, setPattern] = useState(undiscordSettings.pattern ?? "");
    const [minId, setMinId] = useState(undiscordSettings.minId ?? "");
    const [maxId, setMaxId] = useState(undiscordSettings.maxId ?? "");
    const [minDate, setMinDate] = useState(undiscordSettings.minDate ?? "");
    const [maxDate, setMaxDate] = useState(undiscordSettings.maxDate ?? "");
    const [searchDelay, setSearchDelay] = useState(undiscordSettings.searchDelay ?? 30000);
    const [deleteDelay, setDeleteDelay] = useState(undiscordSettings.deleteDelay ?? 1000);
    const [token, setToken] = useState(undiscordSettings.token ?? "");

    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [running, setRunning] = useState(false);
    const [progress, setProgress] = useState({ value: 0, max: 0, percent: "", elapsed: "", remaining: "" });
    const [autoScroll, setAutoScroll] = useState(true);
    const [streamerMode, setStreamerMode] = useState(true);
    const [sidebarVisible, setSidebarVisible] = useState(true);

    const logRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    const [position, setPosition] = useState({ x: window.innerWidth - 820, y: 70 });
    const [size, setSize] = useState({ w: 800, h: Math.min(600, window.innerHeight - 100) });
    const dragState = useRef<{ type: string; sx: number; sy: number; px: number; py: number; pw: number; ph: number } | null>(null);

    useEffect(() => {
        const logFn: LogFn = (level, ...args) => {
            const text = args.map(a => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
            setLogs(prev => [...prev, { id: randomId(), level, text }]);
        };
        core.onLog = logFn;

        core.onStart = () => setRunning(true);
        core.onProgress = (state, stats) => {
            const value = state.delCount + state.failCount;
            const max = Math.max(state.grandTotal, value, 1);
            const percent = max ? Math.round((value / max) * 100) + "%" : "";
            setProgress({
                value,
                max,
                percent,
                elapsed: msToHMS(Date.now() - stats.startTime.getTime()),
                remaining: msToHMS(stats.etr),
            });
        };
        core.onStop = () => setRunning(false);

        // Set initial progress if already running
        if (core.state.running) {
            setRunning(true);
            const state = core.state;
            const stats = core.stats;
            const value = state.delCount + state.failCount;
            const max = Math.max(state.grandTotal, value, 1);
            setProgress({
                value,
                max,
                percent: max ? Math.round((value / max) * 100) + "%" : "",
                elapsed: msToHMS(Date.now() - stats.startTime.getTime()),
                remaining: msToHMS(stats.etr),
            });
        }
    }, [core]);

    useEffect(() => {
        if (autoScroll && logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [logs, autoScroll]);

    useEffect(() => { core.options.searchDelay = searchDelay; }, [searchDelay]);
    useEffect(() => { core.options.deleteDelay = deleteDelay; }, [deleteDelay]);

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!dragState.current) return;
            const ds = dragState.current;
            const dx = e.clientX - ds.sx;
            const dy = e.clientY - ds.sy;

            if (ds.type === "move") {
                setPosition({
                    x: Math.max(0, Math.min(window.innerWidth - size.w, ds.px + dx)),
                    y: Math.max(0, Math.min(window.innerHeight - 50, ds.py + dy)),
                });
            } else {
                let nw = ds.pw;
                let nh = ds.ph;
                let nx = position.x;
                let ny = position.y;

                if (ds.type.includes("r")) nw = Math.max(400, Math.min(window.innerWidth - position.x, ds.pw + dx));
                if (ds.type.includes("l")) {
                    nw = Math.max(400, Math.min(position.x + size.w, ds.pw - dx));
                    nx = position.x + (size.w - nw);
                }
                if (ds.type.includes("b")) nh = Math.max(300, Math.min(window.innerHeight - position.y, ds.ph + dy));
                if (ds.type.includes("t")) {
                    nh = Math.max(300, Math.min(position.y + size.h, ds.ph - dy));
                    ny = position.y + (size.h - nh);
                }

                setSize({ w: nw, h: nh });
                if (nx !== position.x || ny !== position.y) {
                    setPosition({ x: nx, y: ny });
                }
            }
        };

        const onUp = () => { dragState.current = null; };

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, [position, size]);

    const startDrag = (type: string) => (e: React.MouseEvent) => {
        dragState.current = {
            type,
            sx: e.clientX,
            sy: e.clientY,
            px: position.x,
            py: position.y,
            pw: size.w,
            ph: size.h,
        };
    };

    const handleStart = async () => {
        if (!guildId) {
            alert("Please fill the Server ID field!");
            return;
        }
        const authToken = token || await getDiscordToken();
        if (!authToken) {
            alert("Could not get authorization token. Please enter it manually in the Advanced section.");
            return;
        }

        core.resetState();
        core.options = {
            authToken,
            authorId: authorId || null,
            guildId,
            channelId: channelId || null,
            minId: minId || minDate || null,
            maxId: maxId || maxDate || null,
            content: searchText || null,
            hasLink: hasLink || null,
            hasFile: hasFile || null,
            includeNsfw: includeNsfw || null,
            includePinned: includePinned || null,
            pattern: pattern || null,
            searchDelay,
            deleteDelay,
            maxAttempt: 2,
            askForConfirmation: true,
        };

        const channelIds = channelId.split(",").map((s: string) => s.trim()).filter(Boolean);
        if (channelIds.length > 1) {
            await core.runBatch(channelIds.map(ch => ({ guildId, channelId: ch })));
        } else {
            await core.run();
        }
    };

    const handleStop = () => core.stop();
    const handleClearLogs = () => setLogs([]);

    const logClass = (level: LogLevel) => {
        const map: Record<string, string> = {
            debug: cl("log-debug"),
            info: cl("log-info"),
            verb: cl("log-verb"),
            warn: cl("log-warn"),
            error: cl("log-error"),
            success: cl("log-success"),
        };
        return map[level] ?? "";
    };

    const edgeH = (t: string) => (
        <div
            className={`vc-undiscord-grab-${t}`}
            onMouseDown={startDrag(t)}
        />
    );

    return (
        <div
            ref={panelRef}
            className={classes(cl("panel"), streamerMode && cl("streamer-mode"))}
            style={{
                position: "fixed",
                zIndex: 100,
                top: position.y,
                left: position.x,
                width: size.w,
                height: size.h,
            }}
        >
            {/* Header */}
            <div className={cl("header")} onMouseDown={startDrag("move")}>
                <svg width="20" height="20" viewBox="0 0 24 24" style={{ marginRight: 8 }}>
                    <path fill="currentColor" d="M15 3.999V2H9V3.999H3V5.999H21V3.999H15Z" />
                    <path fill="currentColor" d="M5 6.99902V18.999C5 20.101 5.897 20.999 7 20.999H17C18.103 20.999 19 20.101 19 18.999V6.99902H5ZM11 17H9V11H11V17ZM15 17H13V11H15V17Z" />
                </svg>
                <span className={cl("header-title")}>Undiscord — Bulk Delete Messages</span>
                <div style={{ flex: 1 }} />
                <div className={cl("header-btn")} onClick={onClose} title="Close">
                    <svg width="20" height="20" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z" />
                    </svg>
                </div>
            </div>

            {/* Body */}
            <div className={cl("body")}>
                {/* Sidebar */}
                {sidebarVisible && (
                    <div className={cl("sidebar")}>
                        <h3 className={cl("section-title")}>General</h3>

                        <Forms.FormTitle>Author ID</Forms.FormTitle>
                        <div className={cl("input-row")} data-sensitive>
                            <TextInput value={authorId} onChange={setAuthorId} placeholder="Your user ID" />
                            <Button size={Button.Sizes.SMALL} onClick={() => {
                                const uid = getCurrentUserId();
                                if (uid) setAuthorId(uid);
                            }}>Me</Button>
                        </div>

                        <Forms.FormTitle>Server ID</Forms.FormTitle>
                        <div className={cl("input-row")} data-sensitive>
                            <TextInput value={guildId} onChange={setGuildId} placeholder="Guild/Server ID" />
                            <Button size={Button.Sizes.SMALL} onClick={() => {
                                const gid = getGuildId();
                                if (gid) setGuildId(gid);
                            }}>Current</Button>
                        </div>

                        <Forms.FormTitle>Channel ID</Forms.FormTitle>
                        <div className={cl("input-row")} data-sensitive>
                            <TextInput value={channelId} onChange={setChannelId} placeholder="Channel ID (comma-separated for multiple)" />
                            <Button size={Button.Sizes.SMALL} onClick={() => {
                                const cid = getChannelId();
                                if (cid) setChannelId(cid);
                            }}>Current</Button>
                        </div>
                        <label className={cl("checkbox")}>
                            <input type="checkbox" checked={includeNsfw} onChange={e => setIncludeNsfw(e.target.checked)} />
                            <span>This is a NSFW channel</span>
                        </label>

                        <hr className={cl("divider")} />
                        <h3 className={cl("section-title")}>Filters</h3>

                        <Forms.FormTitle>Search</Forms.FormTitle>
                        <div data-sensitive>
                            <TextInput value={searchText} onChange={setSearchText} placeholder="Containing text..." />
                        </div>

                        <label className={cl("checkbox")}>
                            <input type="checkbox" checked={hasLink} onChange={e => setHasLink(e.target.checked)} />
                            <span>Has: link</span>
                        </label>
                        <label className={cl("checkbox")}>
                            <input type="checkbox" checked={hasFile} onChange={e => setHasFile(e.target.checked)} />
                            <span>Has: file</span>
                        </label>
                        <label className={cl("checkbox")}>
                            <input type="checkbox" checked={includePinned} onChange={e => setIncludePinned(e.target.checked)} />
                            <span>Include pinned</span>
                        </label>

                        <Forms.FormTitle>Pattern (regex)</Forms.FormTitle>
                        <div data-sensitive>
                            <TextInput value={pattern} onChange={setPattern} placeholder="/regular expression/i" />
                        </div>

                        <hr className={cl("divider")} />
                        <h3 className={cl("section-title")}>Message Interval</h3>

                        <Forms.FormTitle>After message ID</Forms.FormTitle>
                        <TextInput value={minId} onChange={setMinId} placeholder="Message ID" />

                        <Forms.FormTitle>Before message ID</Forms.FormTitle>
                        <TextInput value={maxId} onChange={setMaxId} placeholder="Message ID" />

                        <hr className={cl("divider")} />
                        <h3 className={cl("section-title")}>Date Range</h3>

                        <Forms.FormTitle>After date</Forms.FormTitle>
                        <input className={cl("date-input")} type="datetime-local" value={minDate} onChange={e => setMinDate(e.target.value)} />

                        <Forms.FormTitle>Before date</Forms.FormTitle>
                        <input className={cl("date-input")} type="datetime-local" value={maxDate} onChange={e => setMaxDate(e.target.value)} />

                        <hr className={cl("divider")} />
                        <h3 className={cl("section-title")}>Advanced</h3>

                        <Forms.FormTitle>Search delay: {searchDelay}ms</Forms.FormTitle>
                        <input
                            type="range"
                            min={100}
                            max={60000}
                            step={100}
                            value={searchDelay}
                            onChange={e => setSearchDelay(Number(e.target.value))}
                            className={cl("slider")}
                        />

                        <Forms.FormTitle>Delete delay: {deleteDelay}ms</Forms.FormTitle>
                        <input
                            type="range"
                            min={50}
                            max={10000}
                            step={50}
                            value={deleteDelay}
                            onChange={e => setDeleteDelay(Number(e.target.value))}
                            className={cl("slider")}
                        />

                        <Forms.FormTitle>Authorization Token</Forms.FormTitle>
                        <div className={cl("input-row")} data-sensitive>
                            <TextInput value={token} onChange={setToken} placeholder="Auto-detected if empty" type="password" />
                            <Button size={Button.Sizes.SMALL} onClick={async () => {
                                const t = await getDiscordToken();
                                if (t) setToken(t);
                            }}>Fill</Button>
                        </div>
                    </div>
                )}

                {/* Main */}
                <div className={cl("main")}>
                    {/* Toolbar */}
                    <div className={cl("toolbar")}>
                        <Button
                            size={Button.Sizes.SMALL}
                            onClick={() => setSidebarVisible(!sidebarVisible)}
                        >
                            {sidebarVisible ? "◀" : "▶"}
                        </Button>

                        <Button
                            size={Button.Sizes.SMALL}
                            color={running ? undefined : Button.Colors.RED}
                            onClick={handleStart}
                            disabled={running}
                        >
                            ▶ Delete
                        </Button>

                        <Button
                            size={Button.Sizes.SMALL}
                            onClick={handleStop}
                            disabled={!running}
                        >
                            ⏹ Stop
                        </Button>

                        <Button
                            size={Button.Sizes.SMALL}
                            onClick={handleClearLogs}
                        >
                            Clear Log
                        </Button>

                        <Tooltip text="Hide sensitive info for screenshots">
                            {({ onMouseEnter, onMouseLeave }) => (
                                <label className={cl("checkbox", "toolbar-check")} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
                                    <input type="checkbox" checked={streamerMode} onChange={e => setStreamerMode(e.target.checked)} />
                                    <span>Streamer Mode</span>
                                </label>
                            )}
                        </Tooltip>
                    </div>

                    {/* Progress */}
                    {running && (
                        <div className={cl("progress-container")}>
                            <progress
                                className={cl("progress")}
                                value={progress.value}
                                max={progress.max || undefined}
                            />
                            <span className={cl("progress-text")}>
                                {progress.percent || "..."} ({progress.value}/{progress.max})
                                {" "}Elapsed: {progress.elapsed} Remaining: {progress.remaining}
                            </span>
                        </div>
                    )}

                    {/* Log */}
                    <div ref={logRef} className={cl("log")}>
                        {logs.length === 0 && (
                            <div className={cl("log-empty")}>
                                Ready. Configure options on the left and click "Delete" to start.
                            </div>
                        )}
                        {logs.map(entry => (
                            <div key={entry.id} className={classes(cl("log-entry"), logClass(entry.level))}>
                                <span className={cl("log-level")}>[{entry.level.toUpperCase()}]</span>{" "}
                                <span>{entry.text}</span>
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className={cl("footer")}>
                        <label className={cl("checkbox")}>
                            <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} />
                            <span>Auto-scroll</span>
                        </label>
                        <div style={{ flex: 1 }} />
                    </div>
                </div>
            </div>

            {/* Resize handles */}
            {edgeH("t")}
            {edgeH("b")}
            {edgeH("l")}
            {edgeH("r")}
            {edgeH("tl")}
            {edgeH("tr")}
            {edgeH("bl")}
            {edgeH("br")}
        </div>
    );
}

/**
 * Attempt to extract the Discord auth token from Discord's own webpack modules.
 */
let getTokenModule: any = null;

function findTokenModule() {
    if (getTokenModule) return getTokenModule;
    try {
        const mod = findByPropsLazy("getToken");
        getTokenModule = mod;
        return mod;
    } catch {
        return null;
    }
}

export async function getDiscordToken(): Promise<string | null> {
    try {
        // Try webpack module first
        const mod = findTokenModule();
        if (mod?.getToken) {
            const token = mod.getToken();
            if (token) return token;
        }
    } catch { /* ignore */ }

    try {
        const iframe = document.body.appendChild(document.createElement("iframe"));
        const LS = iframe.contentWindow?.localStorage;
        if (LS) {
            const token = JSON.parse(LS.token ?? "null");
            iframe.remove();
            if (token) return token;
        }
        iframe.remove();
    } catch { /* ignore */ }

    return null;
}

function getCurrentUserId(): string | null {
    try {
        const mod = findByPropsLazy("getCurrentUser");
        return mod?.getCurrentUser?.()?.id ?? null;
    } catch {
        return null;
    }
}
