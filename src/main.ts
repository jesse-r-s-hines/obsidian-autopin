import { Plugin, WorkspaceLeaf } from 'obsidian';
import { AutoPinSettingTab, AutoPinSettings, DEFAULT_SETTINGS } from './settings';

interface PinnedChangedHandlerContext {
    plugin: AutoPinPlugin,
    leaf: WorkspaceLeaf,
}

export default class AutoPinPlugin extends Plugin {
    settings: AutoPinSettings;

    /**
     * Keep a set of leaves that we have already autopinned and added a 'pinned-change' handler to.
     * Use WeakSet to avoid a memory leak.
     */
    seenLeaves: WeakSet<WorkspaceLeaf> = new WeakSet()

    /** If true, temporarily disable the close on unpin handler, regardles of settings.closeOnUnpin  */
    disableCloseOnUnpin = false

    /** 
     * Return true if this is a basic navigation link that should have autopin behavior.
     * We don't want to autopin the sidebar panels or the blank "New Tab" page
     */
    private isBasicTab = (leaf?: WorkspaceLeaf|null): leaf is WorkspaceLeaf => {
        return !!(leaf && leaf.view.navigation && leaf.view.getViewType() != "empty")
    }

    private getAllBasicTabs = () => {
        const leaves: WorkspaceLeaf[] = []
        this.app.workspace.iterateAllLeaves((l) => {
            if (this.isBasicTab(l)) {
                leaves.push(l)
            }
        })
        return leaves
    }

    /** Get leaves for the same file as leaf (not including leaf itself) */
    private getDuplicateLeaves = (leaf: WorkspaceLeaf) => {
        const duplicates = this.getAllBasicTabs()
            .filter(l => (
                leaf !== l
                && leaf.view.getState().file == l.view.getState().file
                && leaf.view.getViewType() == l.view.getViewType()
            ))
            // sort most recently used leaf first
            .sort((a, b) => (b as any).activeTime - (a as any).activeTime)
        return duplicates
    }

    private onPinnedChangedHandler = function(this: PinnedChangedHandlerContext, pinned: boolean) {
        if (this.plugin.settings.closeOnUnpin && !pinned && !this.plugin.disableCloseOnUnpin) {
            this.leaf.detach() // detach means close
        }
    }

    /** Pin leaf if it was just opened. Add a unpin event to it if needed */
    private autoPin = (leaf?: WorkspaceLeaf|null) => {
        if (this.isBasicTab(leaf) && !this.seenLeaves.has(leaf)) {
            leaf.setPinned(true)
            leaf.on('pinned-change', this.onPinnedChangedHandler, {plugin: this, leaf: leaf})
            this.seenLeaves.add(leaf)
        }
    }

    async onload() {
        await this.loadSettings();

        // This adds a settings tab so the user can configure various aspects of the plugin
        this.addSettingTab(new AutoPinSettingTab(this.app, this));

        this.app.workspace.onLayoutReady(() => {
            this.getAllBasicTabs().forEach(leaf => this.autoPin(leaf))
            this.registerEvent(this.app.workspace.on('active-leaf-change', leaf => {
                if (this.isBasicTab(leaf)) {
                    const duplicates = this.getDuplicateLeaves(leaf)
                    // Close and switch to existing if enabled, and leaf was just opened
                    if (this.settings.switchToExisting && !this.seenLeaves.has(leaf) && duplicates.length > 0) {
                        this.app.workspace.setActiveLeaf(duplicates[0])
                        leaf.detach() // close new leaf
                    } else {
                        this.autoPin(leaf)
                    }
                }
            }))

            this.registerEvent(this.app.workspace.on('file-menu', (menu, file, source, leaf) => {
                // Hack to make close all etc. work even when tabs are pinned by temporarily unpinning all tabs, then
                // running "Close to right" etc, then repinning the remaining tabs
                if (this.settings.closeOnUnpin && source == 'tab-header') {
                    (menu as any).items.forEach((item: any) => {
                        if (item.section == 'close') {
                            const originalCallback = item.callback
                            item.onClick((evt: any) => {
                                this.disableCloseOnUnpin = true
                                this.getAllBasicTabs().forEach(leaf => leaf.setPinned(false))
                                originalCallback(evt)
                                this.getAllBasicTabs().forEach(leaf => leaf.setPinned(true))
                                this.disableCloseOnUnpin = false
                            })
                        }
                    });
                }
            }))
        })
    }

    onunload() {
        super.onunload()
        // Using `registerEvent` for the leaf.on('pinned-change') handlers will cause a memory leak as the event refs
        // will never get removed from this._events, so remove them manually here.
        this.app.workspace.iterateAllLeaves(leaf => { leaf.off('pinned-change', this.onPinnedChangedHandler) })
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}
