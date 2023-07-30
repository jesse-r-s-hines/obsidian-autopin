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

    /** 
     * Return true if this is a basic navigation link that should have autopin behavior.
     * We don't want to autopin the sidebar panels or the blank "New Tab" page
     */
    private isBasicTab = (leaf?: WorkspaceLeaf|null): leaf is WorkspaceLeaf => {
        return !!(leaf && leaf.view.navigation && leaf.view.getViewType() != "empty")
    }


    /** Get leaves for the same file as leaf (not including leaf itself) */
    private getDuplicateLeaves = (leaf: WorkspaceLeaf) => {
        const duplicates: WorkspaceLeaf[] = []
        this.app.workspace.iterateAllLeaves((l) => {
            if (
                leaf !== l && this.isBasicTab(l)
                && leaf.view.getState().file == l.view.getState().file
                && leaf.view.getViewType() == l.view.getViewType()
            ) {
                duplicates.push(l)
            }
        })
        // sort most recently used leaf first
        duplicates.sort((a, b) => (b as any).activeTime - (a as any).activeTime)
        return duplicates
    }

    private onPinnedChangedHandler = function(this: PinnedChangedHandlerContext, pinned: boolean) {
        if (this.plugin.settings.closeOnUnpin && !pinned) {
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
        this.registerEvent
    }


    async onload() {
        await this.loadSettings();

        // This adds a settings tab so the user can configure various aspects of the plugin
        this.addSettingTab(new AutoPinSettingTab(this.app, this));

        this.app.workspace.onLayoutReady(() => {
            this.app.workspace.iterateAllLeaves(this.autoPin)
            this.registerEvent(this.app.workspace.on('active-leaf-change', leaf => {
                if (this.isBasicTab(leaf)) {
                    const duplicates = this.getDuplicateLeaves(leaf)
                    // Close and switch to existing if enabled, and leaf was just opened
                    if (this.settings.switchToExisting && !this.seenLeaves.has(leaf) && duplicates.length > 0) {
                        leaf.detach() // close new leaf
                        this.app.workspace.setActiveLeaf(duplicates[0])
                    } else {
                        this.autoPin(leaf)
                    }
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
