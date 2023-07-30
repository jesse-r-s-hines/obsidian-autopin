import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';

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

    async onload() {
        await this.loadSettings();

        // This adds a settings tab so the user can configure various aspects of the plugin
        this.addSettingTab(new AutoPinSettingTab(this.app, this));
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
