# SuperTrainer 主题皮肤系统（Theme Skin）

为 [RunTrainer / SuperTrainer](https://github.com/runner2778/runtrainer) 增加的可定制主题皮肤功能，作为独立源码包发布，供开发者集成与二次开发。

## 功能

- 用户上传图片作为**背景壁纸**，并**自动取色**生成配色（可手动微调）
- **多套皮肤**命名保存 / 切换 / 删除（上限 20 套）
- 皮肤**导出 / 导入**为 JSON 文件（背景图 base64 内嵌，分享后原样还原）
- 定制范围：背景图、9 项配色、圆角、侧栏宽度、密度、遮罩强度
- 保留原有 system / light / dark 基础模式

## 目录结构

```
├── theme-skin.patch   # 完整 git 补丁（相对原仓库 0f9ee0d）
├── files/             # 改动后的完整源码（覆盖式集成用）
│   ├── src/runtrainer/…
│   └── web/…
└── README.md
```

## 集成方式

### 方式一：git apply（推荐，需在原仓库内）

```bash
git apply theme-skin.patch
```

> 补丁基于原仓库提交 `0f9ee0d`（AI 教练升级 + 证据层预测 + …）。若你的仓库基于更高版本，可能有少量冲突，按提示手动合并即可。

### 方式二：覆盖 files/ 目录

把 `files/` 下的文件按相对路径覆盖到 runtrainer 仓库对应位置（`web/js/theme.js` 为新增文件）。

## 文件清单

| 文件 | 状态 | 说明 |
|------|------|------|
| web/js/theme.js | 新增 | 颜色工具、图片压缩、64 桶取色、皮肤规范化 |
| web/js/main.js | 修改 | store 扩展 + applySkin/clearCustomTheme/applyTheme |
| web/js/pages/settings.js | 修改 | 「主题皮肤」卡片 UI + 编辑/保存/删除/导入导出 |
| web/css/app.css | 修改 | --sidebar-w/--overlay、color-mix 遮罩、布局覆盖层 |
| web/index.html | 修改 | 移除 body 冲突的 :data-theme 绑定 |
| src/runtrainer/services/settings_service.py | 修改 | get/set_theme_skins、get/set_active_skin |
| src/runtrainer/api/bridge.py | 修改 | get_settings/set_setting 皮肤字段；export_theme_skin |

## 依赖注意

pywebview 6.x 已弃用 `OPEN_DIALOG/SAVE_DIALOG` 常量，导出功能改用 `FileDialog.SAVE` 枚举（代码已带兼容兜底）。

## 使用

集成后启动应用，进入「设置 → 主题皮肤」：上传图片作背景 + 自动取色、新建/保存/切换/删除皮肤、导出/导入 JSON。
