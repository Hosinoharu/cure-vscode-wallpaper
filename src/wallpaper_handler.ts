/**
 * 文档 https://github.com/Hosinoharu/cure-vscode-wallpaper/wiki/about-design
 *
 * 此处实现：生成注入的文件、对 VSCode 文件的读写
 */

import fs from "fs";
import path from "path";
import * as vscode from "vscode";
import * as settings from "./settings";
import CureLogger from "./logger";

const logger = new CureLogger("file_handler");

// #region constants

const base_path = path.join(vscode.env.appRoot, "out/vs");
const workbench_path = path.join(base_path, "code/electron-browser/workbench");
const agents_path = path.join(base_path, "sessions/electron-browser");

/** 要修改的文件的路径 */
const workbench_html_file = path.join(workbench_path, "workbench.html");
/** Agents Window HTML 文件路径 */
const agents_html_file = path.join(agents_path, "sessions.html");

/** 因为要在 html 中插入一个 script ，所以使用该 id 标记，确保只会写入一次。
 *
 * 后续所有的变动都是修改【插件要注入的那个文件】，只需要确保该文件会被注入到 VSCode 中就可以了
 */
const scriptId = settings.extension_name + "-inject-script";

/** 在生成要注入的文件时，用这个文件名 */
const inject_filename = settings.extension_name + "-inject-file.js";

/** 要注入的文件的完整路径 */
const inject_file_path = path.join(workbench_path, inject_filename);
/** 注入到 agents window 的、js 文件路径 */
const inject_file_path_for_agents = path.join(agents_path, inject_filename);

// #endregion

// #region 修改 vscode 的文件

/** 注入 JS 文件到  html 中。
 *
 * 重复注入将更新时间戳。
 *
 * # 为什么会有时间戳？
 * 这涉及到【缓存问题】。在我调用 vscode API 重新加载 vscode（并不是关闭、再打开 vscode）时，
 * 并没有使用最新的文件，为了禁用缓存，所以在 html 中插入 script 时，尾部使用 ?curetime=xxx 来禁用缓存。
 *
 * @param html 要注入的 html 文件路径
 * @param js_path 要注入的 js 文件路径，作为 `script` 的 `src` 属性值。 可以是相对路径
 *
 * @returns 注入成功则返回 true
 *
 */
function install_script_to_html(html: string, js_path: string): boolean {
    if (!fs.existsSync(html)) {
        logger.error(`html file not found: ${html}`);
        return false;
    }

    const file_content = fs.readFileSync(html, "utf-8");
    let new_content = "";

    // #cure-tip 重复注入
    if (file_content.includes(scriptId)) {
        // 更新时间戳
        new_content = file_content.replace(
            /curetime=\d+/,
            `curetime=${Date.now()}`,
        );
        logger.log(`update inject script curetime`);
    } else {
        // #cure-warn 因为注入的文件放置到了对应的目录下，所以可以直接使用 ./ 访问
        const script_tag = `<script id="${scriptId}" src="${js_path}?curetime=${Date.now()}"></script>`;
        // 注意写入到底部！！！
        new_content = file_content.replace("</html>", `${script_tag}</html>`);
        logger.log(`inject script to workbench.html: ${js_path}`);
    }

    fs.writeFileSync(html, new_content, "utf-8");
    return true;
}

/** 取消注入 */
function uninstall_script_from_html(html: string): boolean {
    if (!fs.existsSync(html)) {
        logger.error(`workbench.html file not found: ${html}`);
        return false;
    }

    const file_content = fs.readFileSync(html, "utf-8");
    if (!file_content.includes(scriptId)) {
        return true;
    }

    const pattern = new RegExp(`<script id="${scriptId}" src=".*"></script>`);
    const new_content = file_content.replace(pattern, "");

    fs.writeFileSync(html, new_content, "utf-8");
    logger.log(`uninstall script from workbench.html`);
    return true;
}

//#endregion

//#region 操作注入的文件

/** 传入图片的路径、js 路径，生成一个注入的文件！ */
function gen_inject_script_file(image_path: string, js_path: string) {
    const image_url = path_to_vscode_file_protocol(image_path);
    // #cure-tip 构建立即调用函数，传入图片地址
    const content = `;(${inject_function.toString()})("${image_url}");`;
    fs.writeFileSync(js_path, content, "utf-8");
    logger.log("generate inject script file");
}

/** 删除生成的注入文件 */
function del_inject_script_file(js_path: string) {
    if (fs.existsSync(js_path)) {
        fs.unlinkSync(js_path);
        logger.log("reset background image and delete inject file");
    }
}

/** 这个函数的内容（字符串形式）就是要注入的内容，在这里不能被调用
 *
 * 后续获取其字符串形式，构建一个立即函数调用、并进行传参。
 *
 * @param image_url 背景图片的 url，必须是 `vscode-files://` 开头的 url 才行
 */
function inject_function(image_url: string) {
    /** 插入到 dom 中的元素的 id */
    const maskId = "cure-vscode-wallpaper-mask";

    /** 创建一个遮罩，并添加到 dom 中 */
    function create_window_mask() {
        let mask = document.getElementById(maskId);
        if (mask) {
            mask.style.backgroundImage = `url(${image_url})`;
            return;
        }

        mask = document.createElement("div");
        mask.id = maskId;
        mask.style.position = "fixed";
        mask.style.top = "0";
        mask.style.left = "0";
        mask.style.width = "100vw";
        mask.style.height = "100vh";
        mask.style.opacity = ".2"; // 这个值默认就非常不错了
        mask.style.zIndex = "2";
        mask.style.pointerEvents = "none";
        mask.style.backgroundSize = "cover";
        // 这个加上就太晃眼了
        // mask.style.mixBlendMode = "lighten";
        mask.style.backgroundImage = `url(${image_url})`;

        document.body.appendChild(mask);
    }

    create_window_mask();
}

/** vscode 程序运行时，（即相当于一个 Web 应用），访问本地文件时不能用 `file:///` 协议，
 *
 * 需要使用 `vscode-file://` 协议，所以本函数**将文件路径转为对应的协议咯**
 */
function path_to_vscode_file_protocol(path: string) {
    // 需要将 path 中的 \ 替换为 /，放在此处处理非常合适
    // 因为只要是【生成的路径】，都要调用本方法进行转换！
    const p = path.replace(/\\/g, "/");
    return "vscode-file://vscode-app/" + p;
}

//#endregion

/** 从目录 folder 中读取所有图片，然后随机选择一张，返回图片路径哟 */
function get_one_image_path(folder: string) {
    const files = fs.readdirSync(folder);
    const images = files.filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return [".jpg", ".jpeg", ".png"].includes(ext);
    });

    if (images.length !== 0) {
        const index = Math.floor(Math.random() * images.length);
        return path.join(folder, images[index]);
    }
}

// #region core 设置壁纸

/** 从图片目录中随机取出一张图片，将其设置为 VSCode 背景图片！ */
export function set_wallpaper() {
    const impage_path_setting = settings.get_one_setting<string>(
        settings.SettingName.ImagePath,
    );
    if (!impage_path_setting) {
        throw new Error("please set image path first");
    }

    if (!fs.existsSync(impage_path_setting)) {
        throw new Error(`image path not exist: ${impage_path_setting}`);
    }

    // #cure-tip 因为注入的文件放置到了对应的目录下，所以可以直接使用 ./ 访问
    // 先修改 html 再创建注入脚本，这样可以避免多余的存在性检查
    if (install_script_to_html(workbench_html_file, `./${inject_filename}`)) {
        const image_path = get_one_image_path(impage_path_setting);
        if (!image_path) {
            throw new Error("no image found in the image path");
        }

        logger.log(`set wallpaper: ${image_path}`);
        gen_inject_script_file(image_path, inject_file_path);
    }

    if (install_script_to_html(agents_html_file, `./${inject_filename}`)) {
        const image_path = get_one_image_path(impage_path_setting);
        if (!image_path) {
            throw new Error("no image found in the image path");
        }

        logger.log(`set wallpaper for agents window: ${image_path}`);
        gen_inject_script_file(image_path, inject_file_path_for_agents);
    }
}

/** 取消设置 VSCode 背景图片 */
export function reset_wallpaper() {
    if (uninstall_script_from_html(workbench_html_file)) {
        del_inject_script_file(inject_file_path);
    }
    if (uninstall_script_from_html(agents_html_file)) {
        del_inject_script_file(inject_file_path_for_agents);
    }
}

// #endregion
