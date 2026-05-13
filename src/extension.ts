import * as vscode from "vscode";
import * as settings from "./settings";
import { set_wallpaper, reset_wallpaper } from "./wallpaper_handler";

/** 更新图片 */
async function change_wallpaper(reload: boolean) {
    if (
        !settings.get_one_setting<boolean>(settings.SettingName.WallpaperEnable)
    ) {
        return;
    }

    try {
        set_wallpaper();
    } catch (e: any) {
        vscode.window.showErrorMessage(e.message);
        return;
    }

    reload && vscode.commands.executeCommand("workbench.action.reloadWindow");
}

export async function activate(context: vscode.ExtensionContext) {
    // 启动 vscode 时就更新底层的图片链接，方便下一次启动时有全新的壁纸
    await change_wallpaper(false);

    const set_it = vscode.commands.registerCommand(
        settings.extension_name + ".set-wallpaper",
        async () => await change_wallpaper(true),
    );

    const reset_it = vscode.commands.registerCommand(
        settings.extension_name + ".reset-wallpaper",
        async () => {
            if (
                settings.get_one_setting(settings.SettingName.WallpaperEnable)
            ) {
                reset_wallpaper();
                await settings.set_one_setting(
                    settings.SettingName.WallpaperEnable,
                    false,
                );
                vscode.commands.executeCommand("workbench.action.reloadWindow");
            }
        },
    );

    context.subscriptions.push(set_it, reset_it);
}

export function deactivate() {
    // 不能在这里调用，它会在重新加载 VSCode 时触发
    // reset_wallpaper();
}
