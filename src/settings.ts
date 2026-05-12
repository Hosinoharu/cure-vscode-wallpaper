/** 读取插件的配置项 */

import { workspace } from "vscode";

export const extension_name = "cure-vscode-wallpaper";

export enum SettingName {
    /** 是否启用背景图片 */
    WallpaperEnable = "enableWallpaper",
    /** 图片目录，将从中读取图片并设置成背景图片 */
    ImagePath = "imagePath",
}

export function get_one_setting<T>(type: SettingName): T | undefined {
    return workspace.getConfiguration(extension_name).get<T>(type);
}

export async function set_one_setting<T>(type: SettingName, value: T) {
    await workspace.getConfiguration(extension_name).update(type, value, true);
}
