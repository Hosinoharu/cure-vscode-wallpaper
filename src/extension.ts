import * as vscode from "vscode";
import * as settings from "./settings";
import { set_wallpaper, reset_wallpaper } from "./wallpaper_handler";

/** 启动 vscode 时就更新图片！
 *
 * 可能出现【循环设置图片】的情况：启动之后更新图片，但更新图片后又需要重新启动来生效等等，
 * 所以需要一个【状态】来记录插件当前的工作状态。
 *
 * - 'true' 表示上一次是【因为打开 vscode 而更新背景图片】，
 * 		那么本次启动会**更新图片用于下次启动**，但不会重新加载 vscode，这样下一次打开时，就可以看到全新的界面了
 * - 否则本次启动将【自动更新背景图片并重启 vscode】这出现于第一次安装插件的时候啦！
 *
 * @param state 设置当前的工作状态
 */
async function change_wallpaper(context: vscode.ExtensionContext) {
    if (
        !settings.get_one_setting<boolean>(settings.SettingName.WallpaperEnable)
    ) {
        return;
    }

    const state = context.globalState.get<boolean>("cure-state");
    try {
        set_wallpaper();
        if (!state) {
            await context.globalState.update("cure-state", true);
            vscode.commands.executeCommand("workbench.action.reloadWindow");
        }
    } catch (e: any) {
        vscode.window.showErrorMessage(e.message);
    }
}

export async function activate(context: vscode.ExtensionContext) {
    await change_wallpaper(context);

    const set_it = vscode.commands.registerCommand(
        "cure-vscode-wallpaper.set-wallpaper",
        async () => {
            let ok = true;

            if (
                !settings.get_one_setting(settings.SettingName.WallpaperEnable)
            ) {
                try {
                    set_wallpaper();
                    await context.globalState.update("state", true);
                    await settings.set_one_setting(
                        settings.SettingName.WallpaperEnable,
                        true,
                    );
                } catch (e: any) {
                    ok = false;
                    vscode.window.showErrorMessage(e.message);
                    return;
                }
            }

            // 重启就可以自动更新图片了！
            ok &&
                vscode.commands.executeCommand("workbench.action.reloadWindow");
        },
    );

    const reset_it = vscode.commands.registerCommand(
        "cure-vscode-wallpaper.reset-wallpaper",
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
