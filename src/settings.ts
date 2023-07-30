import { App, PluginSettingTab, Setting } from 'obsidian';
import AutoPin from './main';

export interface AutoPinSettings {
    closeOnUnpin: boolean,
    switchToExisting: boolean,
}

export const DEFAULT_SETTINGS: AutoPinSettings = {
    closeOnUnpin: true,
    switchToExisting: true,
}

export class AutoPinSettingTab extends PluginSettingTab {
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

