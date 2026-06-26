/*
 * Vencord, a Discord client mod
 * Based on Undiscord by victornpb <https://github.com/victornpb/undiscord>
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import ErrorBoundary from "@components/ErrorBoundary";
import definePlugin from "@utils/types";
import { findByPropsLazy, findComponentByCodeLazy } from "@webpack";
import { React, useState } from "@webpack/common";
import type { PropsWithChildren } from "react";

import { UndiscordPanel } from "./components";
import { UndiscordCore } from "./core";
import managedStyle from "./styles.css?managed";

const core = new UndiscordCore();

const ReactDOM = findByPropsLazy("createRoot");

const HeaderBarIcon = findComponentByCodeLazy(".HEADER_BAR_BADGE_BOTTOM,", 'position:"bottom"');

let root: { render(el: any): void; unmount(): void } | null = null;
let container: HTMLDivElement | null = null;
let onPanelClose: (() => void) | null = null;

function openPanel() {
    if (container) {
        container.style.display = "";
        return;
    }

    container = document.createElement("div");
    container.id = "vc-undiscord-root";
    const appMount = document.getElementById("app-mount");
    (appMount ?? document.body).appendChild(container);

    root = ReactDOM.createRoot(container);
    root.render(
        React.createElement(UndiscordPanel, {
            core,
            onClose: closePanel,
        })
    );
}

function closePanel() {
    if (container) {
        container.style.display = "none";
    }
    onPanelClose?.();
}

function TrashIcon() {
    return (
        <svg aria-hidden="false" width="18" height="18" fill="none" viewBox="0 0 24 24">
            <path fill="currentColor" d="M15 3.999V2H9V3.999H3V5.999H21V3.999H15Z" />
            <path fill="currentColor" d="M5 6.99902V18.999C5 20.101 5.897 20.999 7 20.999H17C18.103 20.999 19 20.101 19 18.999V6.99902H5ZM11 17H9V11H11V17ZM15 17H13V11H15V17Z" />
        </svg>
    );
}

function UndiscordTitleBarButton() {
    const [isOpen, setIsOpen] = useState(false);

    onPanelClose = () => setIsOpen(false);

    return (
        <HeaderBarIcon
            className="vc-undiscord-titlebar-btn"
            onClick={() => {
                if (isOpen) {
                    closePanel();
                } else {
                    openPanel();
                    setIsOpen(true);
                }
            }}
            onContextMenu={openPanel}
            tooltip={isOpen ? null : "Delete Messages (Undiscord)"}
            icon={TrashIcon}
            selected={isOpen}
        />
    );
}

export default definePlugin({
    name: "Undiscord",
    description: "Bulk delete messages in any Discord channel or DM. Original by victornpb.",
    authors: [
        { name: "victornpb", id: 0n },
        { name: "Tetra_Sky", id: 406453997294190594n }
    ],
    tags: ["Chat", "Utility", "Privacy"],
    managedStyle,

    start() {},

    stop() {
        root?.unmount();
        container?.remove();
        root = null;
        container = null;
    },

    patches: [
        {
            find: '?"BACK_FORWARD_NAVIGATION":',
            replacement: {
                match: /(trailing:.{0,50}?)\i\.Fragment,(?=\{children:\[)/,
                replace: "$1$self.TrailingWrapper,"
            }
        }
    ],

    TrailingWrapper({ children }: PropsWithChildren) {
        return (
            <>
                {children}
                <ErrorBoundary key="vc-undiscord-titlebar" noop>
                    <UndiscordTitleBarButton />
                </ErrorBoundary>
            </>
        );
    },

    toolboxActions: {
        "Open Undiscord"() {
            openPanel();
        },
    },
});
