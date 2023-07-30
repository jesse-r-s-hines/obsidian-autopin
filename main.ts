import { App, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, Workspace } from 'obsidian';

// Remember to rename these classes and interfaces!

interface AutoPinSettings {
    closeOnUnpin: boolean,
    switchToExisting: boolean,
}

const DEFAULT_SETTINGS: AutoPinSettings = {
    closeOnUnpin: true,
    switchToExisting: true,
}

export default class AutoPin extends Plugin {
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
    private isBasicLeaf = (leaf?: WorkspaceLeaf|null): leaf is WorkspaceLeaf => {
        return !!(leaf && leaf.view.navigation && leaf.view.getViewType() != "empty")
    }


    /** Get leaves for the same file as leaf (not including leaf itself) */
    private getDuplicateLeaves = (leaf: WorkspaceLeaf) => {
        const duplicates: WorkspaceLeaf[] = []
        this.app.workspace.iterateAllLeaves((l) => {
            if (
                leaf !== l && this.isBasicLeaf(l)
                && leaf.view.getState().file == l.view.getState().file
                && leaf.view.getViewType() == l.view.getViewType()
            ) {
                duplicates.push(l)
            }
        })
        // sort most recently used leaf first
        duplicates.sort((a: any, b: any) => b.activeTime - a.activeTime)
        return duplicates
    }

    /** Pin leaf if it was just opened. Add a unpin event to it if needed */
    private autoPin = (leaf?: WorkspaceLeaf|null) => {
        if (this.isBasicLeaf(leaf) && !this.seenLeaves.has(leaf)) {
            leaf.setPinned(true)
            leaf.on('pinned-change', pinned => {
                if (this.settings.closeOnUnpin && !pinned) {
                    leaf.detach() // detach means close
                }
            })
            this.seenLeaves.add(leaf)
        }
    }


    async onload() {
        await this.loadSettings();

        // This adds a settings tab so the user can configure various aspects of the plugin
        this.addSettingTab(new AutoPinSettingTab(this.app, this));

        this.app.workspace.onLayoutReady(() => {
            this.app.workspace.iterateAllLeaves(this.autoPin)
            this.app.workspace.on('active-leaf-change', leaf => {
                if (this.isBasicLeaf(leaf)) {
                    const duplicates = this.getDuplicateLeaves(leaf)
                    // Close and switch to existing if enabled, and leaf was just opened
                    if (this.settings.switchToExisting && !this.seenLeaves.has(leaf) && duplicates.length > 0) {
                        leaf.detach() // close new leaf
                        this.app.workspace.setActiveLeaf(duplicates[0])
                    } else {
                        this.autoPin(leaf)
                    }
                }
            })
        })
    }

    onunload() {
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}


class AutoPinSettingTab extends PluginSettingTab {
    plugin: AutoPin;

    constructor(app: App, plugin: AutoPin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName('Close tab on unpin')
            .setDesc('Automatically close tabs when they are unpinned')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.closeOnUnpin)
                .onChange(async (value) => {
                    this.plugin.settings.closeOnUnpin = value;
                    await this.plugin.saveSettings();
                })
            )

        new Setting(containerEl)
            .setName('Switch to existing tab')
            .setDesc('If a file is already open, switch to the existing tab instead of opening a new one.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.switchToExisting)
                .onChange(async (value) => {
                    this.plugin.settings.switchToExisting = value;
                    await this.plugin.saveSettings();
                })
            )
    }
}
