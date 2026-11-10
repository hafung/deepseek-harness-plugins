# 打包与发布

每个插件独立维护 `package.json` 的版本号，Git tag 使用 `<插件目录名>-v<版本>`，例如 `dsh-experts-v1.0.0`。根目录是开发项目，不作为插件发布。

## 发布前

1. 更新目标插件的版本号、说明，以及根 README 的版本表。
2. 运行 `pnpm test`，并在目标 Harness 桌面版本中完成安装、启用、交互和卸载验收。
3. 提交并推送源码。

## 生成下载包

安装 Python 3 后，在仓库根目录执行：

```sh
python3 scripts/package-plugins.py
```

Windows 也可以使用 `py scripts/package-plugins.py`。

`dist/` 中会生成每个插件的 ZIP 和 `SHA256SUMS`。打包只包含插件 `files` 清单中的文件、`package.json` 和仓库的 MIT 许可证，不包含依赖、测试、本机存档或调试文件。ZIP 中保留插件目录，解压后选择包含 `package.json` 的目录安装。

## 发布到 GitHub

以下以专家插件为例；将版本号和文件名替换成实际版本，先把说明写到仓库外的临时 Markdown 文件中，再执行：

```sh
git tag dsh-experts-v1.0.0
git push origin dsh-experts-v1.0.0
gh release create dsh-experts-v1.0.0 dist/dsh-experts-1.0.0.zip --verify-tag --title "专家 1.0.0" --notes-file /path/to/release-notes.md
```

发布说明应包含功能变化、开发对照的 Harness 版本、安装方法和升级注意事项。

GitHub 分发不需要 npm。当前插件保留 `private: true`，避免误发 npm；若以后要发布 npm 或使用会过滤私有包的插件索引生成器，再调整该字段和包名。

## 更新预览图

设置 `DSH_SMOKE_SCREENSHOT_DIR` 指向 `docs/images` 后运行 `pnpm test`，可重新生成 README 使用的预览图。图片来自测试页面，不包含本机 Harness 的会话或存档。
